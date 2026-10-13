import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actor} from './helpers.mjs';
import {setRollImporter,operationRoll,hasImplant,hasDeck} from '../scripts/bridge.mjs';
function equipped(a){let used=0;const deck={id:'deck',type:'equipment',name:'Deck',system:{catalogId:'SW001',equipState:'equipped',bonusDiceCount:1,gearBonus:1},async useDepletion(){used++;return {depletion:used,passed:true,added:1,exhausted:false};}};a.items.set('deck',deck);return {deck,used:()=>used};}
test('ONI uses the system activation context and never adds a second +2',async()=>{
  const a=actor('A','a');a.items.set('oni',{id:'oni',type:'augmentation',system:{catalogId:'AUG011',active:true}});a.items.set('s',{id:'s',name:'Digital Networking',type:'skill',system:{level:3}});
  let args;setRollImporter(async()=>({rollSkill:async(...a)=>{args=a;return {success:true,sides:8};}}));
  await operationRoll(a,'search',{difficulty:2,requestId:'req'});assert.equal(args[2].activity,'oni-netrunning');assert.equal(args[2].gearBonus,0);assert.equal(args[2].rollMode,'gmroll');assert.equal(args[2].difficulty,2);
  a.items.get('oni').system.active=false;await operationRoll(a,'search');assert.equal(args[2].activity,'');
});
test('masking requires an equipped, non-exhausted deck and forwards its bonuses / Depletion',async()=>{
  const a=actor('A','a');a.items.set('s',{name:'Digital Networking',type:'skill',skillDieSides:8,system:{level:3}});
  await assert.rejects(()=>operationRoll(a,'mask'),/requires a deck/);const {deck,used}=equipped(a);let options;
  setRollImporter(async()=>({rollSkill:async(_a,_s,o)=>{options=o;return {success:true,sides:8};}}));
  const result=await operationRoll(a,'mask');assert.equal(options.activity,'mask-oni');assert.deepEqual(options.itemTag,['deck']);assert.deepEqual(options.bonusDice,[8]);assert.equal(options.gearBonus,1);assert.equal(used(),1);assert.equal(result.depletion.depletion,1);
  deck.system.exhausted=true;assert.ok(!hasDeck(a));await assert.rejects(()=>operationRoll(a,'mask'),/requires a deck/);
});
test('analysis and intrusion do not receive the implant netrunning modifier',async()=>{
  const a=actor('A','a');for(const name of ['Data Analysis','Data Engineering'])a.items.set(name,{name,type:'skill',system:{level:2}});a.items.set('oni',{type:'augmentation',system:{catalogId:'AUG011',active:true}});let options;
  setRollImporter(async()=>({rollSkill:async(_a,_s,o)=>{options=o;return {success:true,sides:10};}}));
  await operationRoll(a,'analyze');assert.equal(options.activity,'');await operationRoll(a,'hack');assert.equal(options.activity,'');
});
test('an implant in an archived sleeve cannot grant active ONI bonuses',()=>{
  const a=actor('A','a');a.items.set('sleeve',{id:'new',type:'sleeve',system:{status:'active'}});a.items.set('oni',{type:'augmentation',system:{catalogId:'AUG011',active:true,sleeveId:'old'}});assert.ok(!hasImplant(a));
});
test('a saved native check is recovered instead of rolling or spending Depletion twice',async()=>{
  const a=actor('A','a');a.items.set('s',{name:'Digital Networking',type:'skill',system:{level:3}});equipped(a);
  globalThis.game={messages:{contents:[{id:'existing',author:{isGM:true},getFlag(_scope,key){return key==='oni'?{requestId:'req'}:{actorUuid:a.uuid,success:true,sides:8};}}]}};
  setRollImporter(async()=>({rollSkill:async()=>{throw new Error('Duplicate check');}}));const result=await operationRoll(a,'search',{requestId:'req'});assert.equal(result.chatMessageId,'existing');assert.ok(result.recovered);
});
