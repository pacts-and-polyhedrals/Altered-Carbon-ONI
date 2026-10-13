import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture,actor,Collection} from './helpers.mjs';
import {ID,initialState,contactRecord} from '../scripts/domain.mjs';
import {ONIRuntime} from '../scripts/runtime.mjs';
import {SCENE_RELEASES,setContactRelease,projectAssignedContact,projectResearch,researchRecord} from '../scripts/dossiers.mjs';
import {ensureGuides,PLAYER_GUIDE,GM_GUIDE} from '../scripts/guide.mjs';
import {renderView} from '../scripts/view.mjs';

// Constructed campaign data, not redistributed Cold Storage adventure content.
function campaign(){
  const pregens=Array.from({length:8},(_,i)=>({id:`PC0${i+1}`,name:`Investigator ${i+1}`,role:'Investigator',storedSince:2274,year:2384,storageYears:110,currentSleeveOrdinal:5}));
  const contacts=Array.from({length:20},(_,i)=>({id:`C${String(i+1).padStart(2,'0')}`,currentIdentity:`Current ${i+1}`,historicalIdentity:`Historical ${i+1}`,presentFunction:'SECRET TRUE ROLE',agenda:'SECRET AGENDA',alignment:'SECRET ALIGNMENT',recognitionClues:['Private recognition']}));
  const sleeves=pregens.map(p=>({id:`${p.id}-S1`,pcId:p.id,index:1,name:`Old ${p.id}`,years:[2200,2220],history:`History of ${p.id}`,importantMemory:'A witnessed event',lossOrTransfer:'Transfer',unresolvedConsequence:'Unresolved',continuityStatus:p.id==='PC01'?'disputed':'confirmed'}));
  const relationships=pregens.map(p=>({id:`R-${p.id}-1-ally`,pcId:p.id,pcSleeveId:`${p.id}-S1`,pcSleeveName:`Old ${p.id}`,contactId:'C01',contactHistoricalIdentity:'Historical 1',category:'ally',historicalIncident:`Private historical incident for ${p.id}`,recognitionClues:['Private recognition'],continuityUnverified:p.id==='PC01',revealState:'unknown'}));
  const journals=[{id:'J00',title:'Common knowledge',body:'Public reference text',visibility:'public',category:'primer'},...pregens.map(p=>({id:`${p.id}-CARD`,title:`${p.name} private card`,body:`PRIVATE CARD ${p.id}`,visibility:'gm',category:'personal'})),...Array.from({length:16},(_,i)=>({id:`H${String(i+1).padStart(2,'0')}`,title:`Handout ${i+1}`,body:`EVIDENCE ${i+1}`,category:'handout',visibility:'gm'}))];
  return {pregens,contacts,relationships,journals,'previous-sleeves':sleeves,factions:Array.from({length:6},(_,i)=>({id:`F0${i+1}`,name:`Faction ${i+1}`,public:'Public role',secret:'SECRET FACTION',goal:'SECRET GOAL'})),benefactors:Array.from({length:3},(_,i)=>({id:`GOD0${i+1}`,name:`Benefactor ${i+1}`,portfolio:'Public portfolio',root:'SECRET ROOT',agenda:'SECRET AGENDA'}))};
}
const plain=html=>html.replace(/<[^>]*>/g,' '); // Source-contract tests use authored HTML, not arbitrary incoming markup.
async function setup(){
  const f=await fixture();f.pcA.flags={'cold-storage':{sourceId:'PC01',selectionState:'active'}};f.pcB.flags={'cold-storage':{sourceId:'PC02',selectionState:'active'}};
  const data=campaign(),r=f.runtime,original=r.importCold.bind(r);
  r.importCold=(state)=>original(state,{load:async n=>data[n],plain});
  const s=r.state;await r.importCold(s);await r.saveState(s);return {...f,data};
}
async function submit(f,action,data,user=f.gm){const q=await f.request(user,action,data);await f.runtime.drain();return q;}
async function asPlayer(f,user,read){const prior=game.user;try{game.user=user;const p=new ONIRuntime();p.ready=true;p.keys=f.keys.get(user.id);for(const m of game.messages.contents)await p.decode(m);return await read(p);}finally{game.user=prior;}}
function relationItem(id,pcId,state,disputed=false){return {id,type:'relationship',system:{contactId:'C01',revealState:state},flags:{'cold-storage':{sourceId:`R-${pcId}-1-ally`,unverifiedArchive:disputed}},getFlag(s,k){return this.flags[s]?.[k];}};}

test('preparation includes eight named dossiers, complete assignments and sealed lifetimes before actors exist',async()=>{
  const f=await setup(),s=f.runtime.state;
  assert.equal(Object.keys(s.dossiers).length,8);assert.equal(s.dossiers.PC03.actorId,'');
  for(const d of Object.values(s.dossiers)){assert.ok(d.contacts['cold:C20']);assert.ok(d.contacts['cold:GOD03']);assert.ok(d.contacts['service:archive']);assert.ok(d.research[`cold:life:${d.id}-S1`]);assert.equal(d.research[`cold:life:${d.id}-S1`].released,false);}
  assert.ok(s.dossiers.PC01.contacts['team:PC02'].current);assert.ok(!s.dossiers.PC01.contacts['cold:C01'].current);
  assert.equal(s.imports.cold.relationshipCount,8);
});
test('starter research is encrypted to the correct PC, excludes other private cards and hidden current links',async()=>{
  const f=await setup(),r=f.runtime;await r.drain();
  const files=r.actorResearch('PC-A');assert.equal(files.length,3);assert.ok(files.some(f=>f.body==='PRIVATE CARD PC01'));assert.ok(!JSON.stringify(files).includes('PRIVATE CARD PC02'));assert.ok(!JSON.stringify(files).includes('SECRET'));
  const p=r.actorRecords('PC-A').find(p=>p.payload.data.type==='archive'&&p.payload.data.research.some(f=>f.body==='PRIVATE CARD PC01'));
  assert.equal(await f.keys.get('bob').open(p.message.getFlag(ID,'sealed'),f.gm),null);assert.ok(!p.payload.data.incoming);
  assert.ok(!JSON.stringify(r.directory('PC-A')).includes('Historical 1'));
});
test('a contact channel, historical file and verified link are separate deliberate releases',async()=>{
  const f=await setup(),r=f.runtime;
  await submit(f,'contact-release',{dossierId:'PC01',contactId:'cold:C01',mode:'release'});
  let c=r.directory('PC-A').contacts.find(c=>c.id==='cold:C01');assert.ok(c);assert.equal(c.identity,undefined);assert.ok(!r.actorResearch('PC-A').some(f=>f.category==='Historical contacts'));
  await submit(f,'contact-release',{dossierId:'PC01',contactId:'cold:C01',mode:'history'});
  assert.ok(r.actorResearch('PC-A').some(f=>f.body.includes('Private historical incident for PC01')));assert.equal(r.directory('PC-A').contacts.find(c=>c.id==='cold:C01').identity,undefined);
  await submit(f,'contact-release',{dossierId:'PC01',contactId:'cold:C01',mode:'verify'});
  c=r.directory('PC-A').contacts.find(c=>c.id==='cold:C01');assert.deepEqual(c.identity.historicalNames,['Historical 1']);assert.ok(!JSON.stringify(c).includes('SECRET'));
});
test('reimport preserves released history, edited contact and research bodies, custom notes and explicit hides',async()=>{
  const f=await setup(),r=f.runtime;
  await submit(f,'contact-release',{dossierId:'PC01',contactId:'cold:C01',mode:'verify'});
  await submit(f,'contact-release',{dossierId:'PC01',contactId:'team:PC02',mode:'hide'});
  let s=r.state;s.contacts.find(c=>c.id==='cold:C01').name='Edited public alias';s.research.find(f=>f.id==='cold:card:PC01').body='My table interpretation';await r.saveState(s);
  await submit(f,'research-note',{actorId:'PC-A',title:'Personal knowledge',body:'A new lead'},f.alice);
  const before=r.actorResearch('PC-A').length;await submit(f,'import-cold',{});await r.drain();
  s=r.state;assert.equal(s.contacts.find(c=>c.id==='cold:C01').name,'Edited public alias');assert.equal(s.research.find(f=>f.id==='cold:card:PC01').body,'My table interpretation');assert.ok(s.dossiers.PC01.contacts['cold:C01'].identity);assert.ok(!r.directory('PC-A').contacts.some(c=>c.id==='team:PC02'));assert.equal(r.actorResearch('PC-A').length,before);
});
test('released dossiers wait for actor import then automatically bind, preserve release intent and deliver',async()=>{
  const f=await setup(),r=f.runtime;
  await submit(f,'contact-release',{dossierId:'PC03',contactId:'cold:C01',mode:'release'});
  const a=actor('newPC','eve');a.flags={'cold-storage':{sourceId:'PC03',selectionState:'active'}};game.actors.set(a.id,a);
  r.automationDirty=true;await r.drain();assert.equal(r.state.dossiers.PC03.actorId,'newPC');assert.ok(r.directory('newPC').contacts.some(c=>c.id==='cold:C01'));assert.ok(r.actorResearch('newPC').some(f=>f.body==='PRIVATE CARD PC03'));
});
test('research stays stored without missing-key outbox clutter and publishes once after initialization',async()=>{
  const f=await setup(),r=f.runtime,pub=f.alice.getFlag(ID,'publicKey');delete f.alice.flags[ID].publicKey;
  await r.drain();let jobs=r.state.outbox.filter(j=>j.actorIds.includes('PC-A'));assert.equal(jobs.length,0);assert.match(r.archiveStatus(r.state.dossiers.PC01),/connect once/);assert.equal(await asPlayer(f,f.alice,p=>p.actorResearch('PC-A').length),0);assert.equal(r.actorResearch('PC-A').length,3);
  f.alice.flags[ID].publicKey=pub;r.automationDirty=true;await r.drain();await r.drain();assert.equal(r.actorResearch('PC-A').length,3);
  const rr=new ONIRuntime();rr.keys=f.keys.get('gm');rr.ready=true;for(const m of game.messages.contents)await rr.decode(m);await rr.drain();assert.equal(rr.actorRecords('PC-A').filter(p=>p.payload.data.type==='archive').length,1);
});
test('lifetime bulk release retains disputed labels and never publishes present-day identity links',async()=>{
  const f=await setup(),r=f.runtime;await submit(f,'release-lifetimes',{dossierId:'PC01'});
  const files=r.actorResearch('PC-A');assert.ok(files.some(f=>f.category==='Past life'&&f.status==='disputed'));assert.ok(files.some(f=>f.category==='Historical contacts'&&f.status==='disputed'));assert.ok(!r.directory('PC-A').contacts.some(c=>c.id==='cold:C01'));
});
test('research remains cached off-grid while newly released archives wait for reconnection',async()=>{
  const f=await setup(),r=f.runtime;await r.drain();await submit(f,'power',{actorId:'PC-A',enabled:false},f.alice);
  await submit(f,'release-lifetimes',{dossierId:'PC01'});assert.equal(await asPlayer(f,f.alice,p=>p.actorResearch('PC-A').length),3);assert.equal(r.actorResearch('PC-A').length,5);assert.ok(r.state.outbox.some(j=>j.data.type==='archive-ref'&&j.actorIds.includes('PC-A')));
  await submit(f,'power',{actorId:'PC-A',enabled:true},f.alice);assert.equal(r.actorResearch('PC-A').length,5);
});
test('scene bundles deliver only selected PCs, are repeat safe, and retain pending reserve discoveries',async()=>{
  const f=await setup(),r=f.runtime;
  await submit(f,'scene-release',{sceneId:'ward',dossierIds:['PC01','PC03']});
  assert.ok(r.directory('PC-A').contacts.some(c=>c.id==='cold:C04'));assert.equal(r.actorEvidence('PC-A')[0].id,'cold:H01');assert.equal(r.actorEvidence('PC-B').length,0);
  assert.ok(r.state.dossiers.PC03.pendingEvidence.includes('cold:H01'));
  const count=r.packets('PC-A').filter(p=>p.payload.data.evidence).length;await submit(f,'scene-release',{sceneId:'ward',dossierIds:['PC01']});assert.equal(r.packets('PC-A').filter(p=>p.payload.data.evidence).length,count);
  const a=actor('reserve','eve');a.flags={'cold-storage':{sourceId:'PC03',selectionState:'reserve'}};game.actors.set(a.id,a);r.automationDirty=true;await r.drain();assert.equal(r.actorEvidence(a.id)[0].id,'cold:H01');assert.ok(!r.directory('PC-A').contacts.some(c=>c.id==='team:PC03'));
});
test('players cannot release contacts, verify links, assign research or write another PC’s note',async()=>{
  const f=await setup(),r=f.runtime;
  for(const [action,data] of [['contact-release',{dossierId:'PC01',contactId:'cold:C01',mode:'verify'}],['research-release',{dossierId:'PC01',researchId:'cold:life:PC01-S1'}],['research-save',{title:'Fake archive',body:'Fake',dossierIds:['PC02']}],['bind-actor',{dossierId:'PC02',bindActorId:'PC-A'}],['scene-release',{sceneId:'spire',dossierIds:['PC01']}],['research-note',{actorId:'PC-B',title:'Fake',body:'Fake'}]]){
    const q=await submit(f,action,data,f.alice);assert.equal(r.state.processed[q.id].status,'rejected',action);
  }
  assert.ok(!r.directory('PC-A').contacts.some(c=>c.id==='cold:C01'));
});
test('new GM dashboard relationship states synchronize but unchanged states preserve manual ONI hides',async()=>{
  const f=await setup(),r=f.runtime,i=relationItem('rel','PC02','familiar');f.pcB.items.set(i.id,i);
  let s=r.state;r.syncDossiers(s,{revealActors:['PC-B']});await r.saveState(s);await r.flush();assert.ok(r.directory('PC-B').contacts.some(c=>c.id==='cold:C01'));assert.equal(r.directory('PC-B').contacts.find(c=>c.id==='cold:C01').identity,undefined);
  await submit(f,'contact-release',{dossierId:'PC02',contactId:'cold:C01',mode:'hide'});s=r.state;r.syncDossiers(s,{revealActors:['PC-B']});assert.ok(!s.contacts.find(c=>c.id==='cold:C01').grants.includes('PC-B'));
  i.system.revealState='confirmed';r.syncDossiers(s,{revealActors:['PC-B']});await r.saveState(s);r.queueResearch(s);await r.saveState(s);await r.flush();assert.ok(r.directory('PC-B').contacts.find(c=>c.id==='cold:C01').identity);
});
test('ownership changes automatically reseal the released research archive to its new owner',async()=>{
  const f=await setup(),r=f.runtime;await r.drain();f.pcA.ownership={default:0,eve:3};r.automationDirty=true;await r.drain();
  const records=r.actorRecords('PC-A').filter(p=>p.payload.data.type==='archive');assert.equal(records.length,2);
  for(const p of records.slice(0,1)){assert.ok(p.message.getFlag(ID,'sealed').keys.eve);assert.ok(!p.message.getFlag(ID,'sealed').keys.alice);}
  game.user=f.alice;assert.equal(r.actorResearch('PC-A').length,0);game.user=f.gm;
});
test('PC dossier, scene, research and diagnostic controls render with all new sections and escape notes',async()=>{
  const f=await setup(),r=f.runtime;await r.drain();
  for(const section of ['pcs','scenes','research','diagnostics']){const html=renderView(r,{actorId:'PC-A',tab:'gm',gmSection:section,dossierId:'PC01'});assert.ok(html.includes('GM PRIVATE'));assert.ok(!html.includes('undefined'));}
  const gmHtml=renderView(r,{actorId:'PC-A',tab:'gm',gmSection:'pcs',dossierId:'PC01'});assert.ok(gmHtml.includes('Current 20'));assert.ok(gmHtml.includes('Historical 1'));assert.ok(gmHtml.includes('Release channel'));assert.ok(gmHtml.includes('Release past lives & historical contacts to this PC'));
  await submit(f,'research-note',{actorId:'PC-A',title:'<script>title</script>',body:'<img src=x onerror=alert(1)>'},f.alice);
  game.user=f.alice;const html=renderView(r,{actorId:'PC-A',tab:'research',researchSearch:'onerror'});assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('PRIVATE CARD PC02'));assert.ok(!html.includes('Historical 1'));game.user=f.gm;
});
test('research projection excludes GM fields and source bindings',()=>{
  const p=projectResearch(researchRecord({title:'File',body:'Public',gmNotes:'SECRET',pcId:'PC01',sourceId:'SECRET-ID'},'f'));
  assert.ok(!JSON.stringify(p).includes('SECRET'));assert.equal(p.pcId,undefined);
});
test('cancelling an archive remains paused through repair until a deliberate release',async()=>{
  const f=await setup(),r=f.runtime;await r.drain();await submit(f,'power',{actorId:'PC-A',enabled:false},f.alice);await submit(f,'research-release',{dossierId:'PC01',researchId:'cold:life:PC01-S1'});
  const job=r.state.outbox.find(j=>j.data.type==='archive-ref'&&j.data.dossierId==='PC01');await submit(f,'cancel-job',{id:job.id});await submit(f,'repair',{});await r.drain();assert.ok(!r.state.outbox.some(j=>j.data.type==='archive-ref'&&j.data.dossierId==='PC01'));assert.equal(r.state.dossiers.PC01.archivePaused,true);
  await submit(f,'research-release',{dossierId:'PC01',researchId:'cold:life:PC01-S1'});assert.ok(r.state.outbox.some(j=>j.data.type==='archive-ref'&&j.data.dossierId==='PC01'));
});
test('opening a research file clears that PC’s corresponding unread notices',async()=>{
  const f=await setup(),r=f.runtime;await r.drain();await submit(f,'research-release',{dossierId:'PC01',researchId:'cold:life:PC01-S1'});game.user=f.alice;
  const before=r.unread('PC-A');assert.equal(before,1);await r.markFileRead('PC-A','research','cold:life:PC01-S1');assert.equal(r.unread('PC-A'),0);game.user=f.gm;
});
test('a native delivery failure remains queued with a useful diagnostic and retries without duplicates',async()=>{
  const f=await setup(),r=f.runtime,post=r.post.bind(r);let fail=true;
  r.post=async(kind,data,ids,options)=>{if(fail&&kind==='packet'&&data.research&&options.actorIds.includes('PC-A')){fail=false;throw new Error('Foundry rejected the private delivery');}return post(kind,data,ids,options);};
  await r.flush();const job=r.state.outbox.find(j=>j.lastError);assert.ok(job);assert.match(r.deliveryReason(job),/Foundry rejected/);assert.equal(await asPlayer(f,f.alice,p=>p.actorResearch('PC-A').length),0);assert.equal(r.actorResearch('PC-A').length,3);
  await r.drain();assert.equal(await asPlayer(f,f.alice,p=>p.actorResearch('PC-A').length),3);assert.equal(r.actorRecords('PC-A').filter(p=>p.payload.data.type==='archive').length,1);
});
test('player-authored relationship changes cannot trigger automated identity releases',async()=>{
  const f=await setup(),r=f.runtime,i=relationItem('rel','PC02','confirmed');i.parent={documentName:'Actor',id:'PC-B'};i._stats={lastModifiedBy:'bob'};f.pcB.items.set(i.id,i);
  r.worldChanged(i,'bob');clearTimeout(r.setupTimer);assert.ok(!r.revealActors?.has('PC-B'));
  let s=r.state;r.syncDossiers(s,{revealActors:['PC-B']});assert.ok(!s.dossiers.PC02.contacts['cold:C01'].identity);
  i._stats.lastModifiedBy='gm';r.worldChanged(i,'gm');clearTimeout(r.setupTimer);assert.ok(r.revealActors.has('PC-B'));
  r.automationDirty=true;await r.drain();assert.ok(r.state.dossiers.PC02.contacts['cold:C01'].identity);
});
test('automatic preparation initializes an existing Cold Storage world without manual roster or import steps',async()=>{
  const f=await fixture(),r=f.runtime,data=campaign();f.pcA.flags={'cold-storage':{sourceId:'PC01',selectionState:'active'}};
  const original=r.importCold.bind(r);let imports=0;r.importCold=s=>{imports++;return original(s,{load:async n=>data[n],plain});};
  r.automationDirty=true;await r.drain();assert.equal(Object.keys(r.state.dossiers).length,9);assert.ok(r.actorResearch('PC-A').some(f=>f.body==='PRIVATE CARD PC01'));assert.equal(imports,1);
  r.automationDirty=true;await r.drain();assert.equal(imports,1);
});
test('GM world recovery retains dossier bindings, identity releases, custom research and disputed status',async()=>{
  const f=await setup(),r=f.runtime;await submit(f,'release-lifetimes',{dossierId:'PC01'});await submit(f,'contact-release',{dossierId:'PC02',contactId:'cold:C01',mode:'verify'});await submit(f,'research-note',{actorId:'PC-A',title:'Preserved note',body:'My investigation'},f.alice);
  const backup=JSON.parse(r.exportWorld()),old=game.settings.get(ID,'vaultId');game.messages.delete(old);r.decoded.delete(old);await r.restoreWorld(backup);
  assert.equal(r.state.dossiers.PC01.actorId,'PC-A');assert.ok(r.state.dossiers.PC02.contacts['cold:C01'].identity);assert.ok(r.actorResearch('PC-A').some(f=>f.title==='Preserved note'));assert.ok(r.actorResearch('PC-A').some(f=>f.status==='disputed'));assert.notEqual(game.settings.get(ID,'vaultId'),old);
});
test('a crash during a batched archive checkpoint recovers without delivering source files twice',async()=>{
  const f=await setup(),r=f.runtime,save=r.saveState.bind(r);let failed=false;
  r.saveState=async state=>{if(!failed&&r.actorRecords('PC-A').some(p=>p.payload.data.type==='archive')){failed=true;throw new Error('Simulated checkpoint crash');}return save(state);};
  await assert.rejects(()=>r.flush(),/checkpoint crash/);
  const rr=new ONIRuntime();rr.keys=f.keys.get('gm');rr.ready=true;for(const m of game.messages.contents)await rr.decode(m);await rr.drain();
  assert.equal(rr.actorRecords('PC-A').filter(p=>p.payload.data.type==='archive').length,1);assert.equal(rr.actorResearch('PC-A').length,3);assert.ok(!rr.state.outbox.some(j=>j.data.type==='archive-ref'));
});
test('in-world guides install once with player-safe and private GM ownership and retain additional pages',async()=>{
  const f=await fixture();game.journal=new Collection();let n=0,created=0;
  globalThis.JournalEntry={implementation:{async create(data){created++;const j={...structuredClone(data),id:`guide${++n}`,pages:new Collection(data.pages.map((p,i)=>[String(i),{...p,id:String(i),getFlag(s,k){return this.flags[s]?.[k];}}])),getFlag(s,k){return this.flags[s]?.[k];}};game.journal.set(j.id,j);return j;}}};
  const ids=await ensureGuides();await ensureGuides();assert.equal(created,2);assert.equal(game.journal.get(ids.player).ownership.default,2);assert.equal(game.journal.get(ids.gm).ownership.default,0);assert.equal(PLAYER_GUIDE.length,8);assert.equal(GM_GUIDE.length,12);
  delete globalThis.JournalEntry;
});

const coldPath=process.env.AC_COLD_PATH;
test('supplied Cold Storage contract covers all 160 links, 46 lifetimes, private cards and scene sources',{skip:!coldPath},async()=>{
  const f=await fixture(),r=f.runtime;game.actors.clear();
  const original=r.importCold.bind(r);r.importCold=s=>original(s,{load:async n=>JSON.parse(fs.readFileSync(path.join(coldPath,'content-src',`${n}.json`),'utf8')),plain});
  const s=r.state;await r.importCold(s);assert.equal(Object.keys(s.dossiers).length,8);assert.equal(s.imports.cold.relationshipCount,160);assert.equal(s.imports.cold.lifetimeCount,46);
  assert.equal(s.research.filter(r=>r.category==='Past life').length,46);assert.equal(s.research.filter(r=>r.category==='Personal briefing').length,8);
  const assignments=Object.values(s.dossiers).flatMap(d=>Object.values(d.contacts));assert.equal(assignments.flatMap(a=>a.relationshipIds||[]).length,160);
  for(const scene of SCENE_RELEASES){for(const cid of scene.contacts)assert.ok(s.contacts.some(c=>c.id===`cold:${cid}`));for(const eid of scene.evidence)assert.ok(s.evidence.some(e=>e.id===`cold:${eid}`));}
  for(const d of Object.values(s.dossiers)){const card=s.research.find(f=>f.id===`cold:card:${d.id}`);assert.ok(card.body.includes(d.name));assert.ok(!d.research['cold:primer:J15']);assert.ok(!d.research['cold:primer:J17']);}
});
test('full eight-PC archive and all lifetime-release intents fit the encrypted vault without duplicated file bodies',{skip:!coldPath},async()=>{
  const f=await fixture(),r=f.runtime;game.actors.clear();
  for(let i=1;i<=8;i++){const a=actor(`actor${i}`,i<=4?'alice':'bob');a.flags={'cold-storage':{sourceId:`PC0${i}`,selectionState:'active'}};game.actors.set(a.id,a);}
  const s=r.state;await r.importCold(s,{load:async n=>JSON.parse(fs.readFileSync(path.join(coldPath,'content-src',`${n}.json`),'utf8')),plain});
  for(const d of Object.values(s.dossiers)){for(const grant of Object.values(d.research))grant.released=true;}
  r.queueResearch(s,{notify:true});const bytes=new TextEncoder().encode(JSON.stringify(s)).length;assert.ok(bytes<600000,`${bytes} bytes`);
  const archives=s.outbox.filter(o=>o.data.type==='archive-ref');assert.equal(archives.length,8);assert.equal(new Set(archives.map(j=>j.actorIds[0])).size,8);
  for(const job of archives){assert.equal(job.data.research,undefined);assert.equal(job.data.body,undefined);}
  await r.saveState(s);assert.equal(Object.keys(r.state.dossiers).length,8);
  console.log(JSON.stringify({coldStorageDiagnostics:{bytes,preparedResearchFiles:s.research.length,archiveDeliveryIntents:archives.length}}));
});
