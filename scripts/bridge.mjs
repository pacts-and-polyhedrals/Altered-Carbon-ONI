import {ID, OPS} from './domain.mjs';
let importer=()=>import('../../../systems/altered-carbon-rpg/module/rolls.mjs');
export function setRollImporter(fn) { importer=fn; }
export function oniItems(actor) {
  const items=actor?.items?.contents||[...(actor?.items||[])],sleeve=items.find(i=>i.type==='sleeve'&&i.system?.status==='active');
  return items.filter(i=>i.type==='augmentation' && ['AUG011','core.augment.oni-implant'].includes(i.system?.catalogId) && (!i.system.sleeveId||i.system.sleeveId===sleeve?.id));
}
export function hasImplant(actor) { return oniItems(actor).some(i=>i.system.active!==false); }
export function hasDeck(actor) {
  return Boolean(usableDeck(actor));
}
export function usableDeck(actor) {
  return (actor?.items?.contents||[...(actor?.items||[])]).find(i=>i.type==='equipment'&&['SW001','SW002','core.equipment.deck','core.equipment.deck-portable'].includes(i.system?.catalogId)&&i.system?.active!==false&&i.system?.exhausted!==true&&i.system?.equipState==='equipped');
}
export function findSkill(actor,name) { return actor?.items?.find(i=>i.type==='skill' && i.name.toLowerCase()===name.toLowerCase()); }
export async function operationRoll(actor,op,{difficulty=0,requestId=''}={}) {
  const profile=OPS[op];if(!profile)throw new Error('Unknown ONI operation.');
  const skill=findSkill(actor,profile.skill);if(!skill)throw new Error(`${actor.name} has no ${profile.skill} skill. Add the system skill to that actor first.`);
  // Existing rules engine supplies ONI +2 and deck / masking Traits. No duplicate bonuses.
  if(op==='mask' && !hasDeck(actor))throw new Error('Identity masking requires a deck.');
  // Recover an already saved native roll after a GM reconnect / delivery retry.
  const prior=(globalThis.game?.messages?.contents||[]).find(m=>m.author?.isGM&&m.getFlag?.('altered-carbon-rpg','oni')?.requestId===requestId&&requestId&&m.getFlag?.('altered-carbon-rpg','check')?.actorUuid===actor.uuid);
  if(prior)return {...prior.getFlag('altered-carbon-rpg','check'),chatMessageId:prior.id,recovered:true};
  const {rollSkill}=await importer();
  const activity=profile.activity==='oni-netrunning'&&!hasImplant(actor)?'':profile.activity;
  const deck=['search','hack','mask','trace','analyze'].includes(op)?usableDeck(actor):null;
  const legacy=String(deck?.system.bonusDice||'').split(',').map(Number).filter(n=>[4,6,8,10,12].includes(n));
  const sides=skill.skillDieSides||[12,10,8,6,4][Math.max(0,Math.min(4,Number(skill.system.level||1)-1))];
  const bonusDice=legacy.length?legacy:Array(Math.max(0,Math.min(10,Number(deck?.system.bonusDiceCount||0)))).fill(sides);
  const result=await rollSkill(actor,skill,{difficulty,activity,itemTag:deck?['deck']:[],gearBonus:Number(deck?.system.gearBonus||0),bonusDice,rollMode:'gmroll',
    contextLabel:`ONI · ${profile.name}`,chatFlags:{oni:{module:ID,requestId,op}}});
  if(!result.blocked&&deck){
    try{const d=await deck.useDepletion({skillSides:result.sides});result.depletion={itemId:deck.id,itemName:deck.name,depletion:d.depletion,exhausted:d.exhausted,passed:d.passed,added:d.added};}
    catch(error){result.depletionError=error.message;globalThis.ui?.notifications?.warn?.(`ONI deck Depletion needs manual resolution: ${error.message}`);}
  }
  return result;
}
/** Route-aware paths, like the supplied Cold Storage system bridge. */
export async function sourceJSON(name) {
  const cold=game.modules.get('cold-storage')?.active;
  const bases=[...(cold?['../../cold-storage/content-src/']:[]),'../../../systems/altered-carbon-rpg/data/cold-storage/'];
  const errors=[];
  for(const base of bases){try{const r=await fetch(new URL(`${base}${name}.json`,import.meta.url));if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json();}catch(e){errors.push(e.message);}}
  throw new Error(`Could not load ${name} from the installed Cold Storage / system data: ${errors.join('; ')}. Update to Cold Storage 1.9.0 / Altered Carbon 2.4.9 or newer.`);
}
