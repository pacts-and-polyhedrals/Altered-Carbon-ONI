import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture,actor,message} from './helpers.mjs';
import {ID,owners,contactRecord} from '../scripts/domain.mjs';
import {ONIRuntime} from '../scripts/runtime.mjs';
import {migrateArchiveTransport} from '../scripts/archive.mjs';

async function client(f,user,fn){const old=game.user;try{game.user=user;const r=new ONIRuntime();r.keys=f.keys.get(user.id);r.ready=true;for(const m of game.messages.contents)await r.decode(m);return await fn(r);}finally{game.user=old;}}
const cold=process.env.AC_COLD_PATH;
async function anikWorld(){
 const f=await fixture();f.pcA.name='Anik Rao';f.pcA.flags={'cold-storage':{sourceId:'PC07',selectionState:'active'}};f.pcB.flags={'cold-storage':{sourceId:'PC01',selectionState:'active'}};
 f.pcA.ownership.default=3;f.pcB.ownership.default=3;f.alice.character=f.pcA;f.bob.character=f.pcB;
 for(const n of [2,3,4,5,6,8]){const a=actor(`OTHER${n}`,'not-a-player');a.ownership={default:3};a.flags={'cold-storage':{sourceId:`PC0${n}`,selectionState:'active'}};game.actors.set(a.id,a);}
 const load=async n=>JSON.parse(fs.readFileSync(path.join(cold,'content-src',`${n}.json`),'utf8'));
 const original=f.runtime.importCold.bind(f.runtime);f.runtime.importCold=s=>original(s,{load,plain:s=>s.replace(/<[^>]*>/g,' ')});
 const s=f.runtime.state;await f.runtime.importCold(s);await f.runtime.saveState(s);await f.runtime.drain();return f;
}
async function act(f,action,data,user=f.gm){const q=await f.request(user,action,data);await f.runtime.drain();assert.equal(f.runtime.state.processed[q.id].status,'accepted');return q;}

test('broad default Owner permission never becomes an ONI broadcast',async()=>{
 const f=await fixture();f.pcA.ownership={default:3};f.pcB.ownership={default:3};f.alice.character=f.pcA;f.bob.character=f.pcB;
 assert.deepEqual(owners(f.pcA,game.users.contents),['alice']);assert.deepEqual(owners(f.pcB,game.users.contents),['bob']);
 const s=f.runtime.state;s.contacts.push(contactRecord({name:'Sender'},'sender'));await f.runtime.saveState(s);
 await act(f,'dispatch',{actorIds:['PC-A'],contactId:'sender',body:'Only the assigned PC'});
 const packet=f.runtime.packets('PC-A').find(p=>p.payload.data.body==='Only the assigned PC');assert.ok(packet.message.getFlag(ID,'sealed').keys.alice);assert.ok(!packet.message.getFlag(ID,'sealed').keys.bob);assert.ok(!packet.message.getFlag(ID,'sealed').keys.eve);
 await client(f,f.bob,r=>assert.equal(r.canUseEndpoint(f.pcA),false));
});
test('a targeted release for actual Anik changes no other PC and uses one complete private snapshot',{skip:!cold},async()=>{
 const f=await anikWorld(),r=f.runtime;
 const before=Object.fromEntries(Object.entries(r.state.dossiers).map(([id,d])=>[id,Object.values(d.research).filter(g=>g.released).length]));
 await act(f,'release-lifetimes',{dossierId:'PC07',actorId:'PC-A'});await act(f,'release-contacts',{dossierId:'PC07'});
 const s=r.state;assert.equal(s.research.filter(file=>file.pcId==='PC07'&&['Past life','Historical contacts'].includes(file.category)&&s.dossiers.PC07.research[file.id].released).length,17);
 for(const [id,d] of Object.entries(s.dossiers))if(id!=='PC07')assert.equal(Object.values(d.research).filter(g=>g.released).length,before[id],id);
 await client(f,f.alice,p=>{assert.equal(p.actorResearch('PC-A').length,37);assert.equal(p.historicalContacts('PC-A').length,11);assert.equal(p.directory('PC-A').contacts.length,43);assert.equal(p.actorResearch('PC-B').length,0);});
 await client(f,f.bob,p=>{assert.equal(p.actorResearch('PC-B').length,20);assert.equal(p.historicalContacts('PC-B').length,0);assert.equal(p.directory('PC-B').contacts.filter(c=>c.type!=='pc').length,0);});
 const packets=r.actorRecords('PC-A').filter(p=>p.payload.data.type==='archive'),latest=packets[0];assert.ok(!latest.message.getFlag(ID,'sealed').keys.bob);assert.ok(!latest.message.getFlag(ID,'sealed').keys.eve);
 assert.ok(!JSON.stringify(latest.payload).includes('gmNotes'));assert.equal(await f.keys.get('bob').open(latest.message.getFlag(ID,'sealed'),f.gm),null);
 assert.equal(s.outbox.filter(o=>['research-ref','evidence-ref'].includes(o.data.type)).length,0);
});
test('unowned and uninitialized PCs expose their published GM preview without populating the outbox',{skip:!cold},async()=>{
 const f=await anikWorld(),r=f.runtime;delete f.alice.flags[ID].publicKey;
 await act(f,'release-lifetimes',{dossierId:'PC07'});await act(f,'contact-release',{dossierId:'PC07',contactId:'cold:C11',mode:'release'});
 assert.equal(r.actorResearch('PC-A').length,37);assert.ok(r.directory('PC-A').contacts.some(c=>c.id==='cold:C11'));
 assert.equal(r.state.outbox.filter(o=>o.actorIds.includes('PC-A')).length,0);assert.match(r.archiveStatus(r.state.dossiers.PC07),/connect once/);
 assert.equal(await client(f,f.alice,p=>p.actorResearch('PC-A').length),20);
});
test('rebuilding Anik restores cancelled published content without unpausing other PCs',{skip:!cold},async()=>{
 const f=await anikWorld(),r=f.runtime;await act(f,'release-lifetimes',{dossierId:'PC07'});await act(f,'power',{actorId:'PC-A',enabled:false},f.alice);
 await act(f,'rebuild-archive',{dossierId:'PC07'});const job=r.state.outbox.find(o=>o.data.dossierId==='PC07'&&o.data.type==='archive-ref');assert.ok(job);
 await act(f,'cancel-job',{id:job.id});let s=r.state;s.dossiers.PC01.archivePaused=true;await r.saveState(s);await act(f,'repair',{});assert.ok(r.state.dossiers.PC07.archivePaused);assert.ok(r.state.dossiers.PC01.archivePaused);
 await act(f,'rebuild-archive',{dossierId:'PC07'});assert.equal(r.state.dossiers.PC07.archivePaused,false);assert.equal(r.state.dossiers.PC01.archivePaused,true);assert.equal(r.state.outbox.filter(o=>o.data.type==='archive-ref'&&o.data.dossierId==='PC07').length,1);
 await act(f,'power',{actorId:'PC-A',enabled:true},f.alice);assert.equal(await client(f,f.alice,p=>p.actorResearch('PC-A').length),37);
});
test('migration retires old jobs without granting new knowledge or undoing cancellations',async()=>{
 const f=await fixture(),s=f.runtime.state;s.archiveTransport=1;s.dossiers.PC07={id:'PC07',actorId:'PC-A',research:{life:{released:true,deliverySuppressed:'cancelled'},sealed:{released:false}},contacts:{},pendingEvidence:['h'],evidenceSuppressed:{h:'cancelled'}};
 s.outbox=[{id:'old1',actorIds:['PC-A'],data:{type:'research-ref',dossierId:'PC07',researchId:'life'}},{id:'msg',actorIds:['PC-B'],data:{type:'message',body:'Preserve this'}}];
 assert.ok(migrateArchiveTransport(s));assert.equal(s.outbox.length,1);assert.equal(s.outbox[0].id,'msg');assert.equal(s.dossiers.PC07.research.life.deliveryPaused,true);assert.equal(s.dossiers.PC07.research.sealed.released,false);assert.equal(s.dossiers.PC07.evidenceGrants.h.paused,true);assert.equal(migrateArchiveTransport(s),false);
});
test('private recipient selection overrides permissive actor ownership',async()=>{
 const f=await fixture(),r=f.runtime;f.pcA.ownership={default:3};f.pcB.ownership={default:3};await act(f,'sync-roster',{});
 // Explicit binding prepares a profile even when the world has no selected player characters.
 let s=r.state;const d=r.ensureActorDossier(s,f.pcA);await r.saveState(s);await act(f,'assign-player',{dossierId:d.id,playerUserId:'alice'});
 await act(f,'contact-save',{id:'entry',name:'Private contact',grants:['PC-A']});const snapshot=r.actorRecords('PC-A').find(p=>p.payload.data.type==='archive');assert.ok(snapshot.message.getFlag(ID,'sealed').keys.alice);assert.ok(!snapshot.message.getFlag(ID,'sealed').keys.bob);
 await client(f,f.alice,p=>assert.ok(p.directory('PC-A').contacts.some(c=>c.id==='entry')));
});
test('an uninitialized co-owner cannot block the initialized player’s archive',async()=>{
 const f=await fixture(),r=f.runtime;f.pcA.ownership.eve=3;delete f.eve.flags[ID].publicKey;
 await act(f,'contact-save',{id:'entry',name:'Ready for the primary player',grants:['PC-A']});
 assert.ok(r.deliveredDirectory('PC-A').contacts.some(c=>c.id==='entry'));
 assert.equal(r.state.outbox.filter(o=>o.data.type==='archive-ref'&&o.actorIds.includes('PC-A')).length,0);
 const p=r.actorRecords('PC-A').find(p=>p.payload.data.type==='archive');assert.ok(p.message.getFlag(ID,'sealed').keys.alice);assert.ok(!p.message.getFlag(ID,'sealed').keys.eve);
});
test('a newly assigned player cannot save an old transmission they never received',async()=>{
 const f=await fixture(),r=f.runtime;await act(f,'contact-save',{id:'sender',name:'Source'});
 await act(f,'dispatch',{actorIds:['PC-A'],contactId:'sender',body:'An old owner’s private knowledge'});
 const packet=r.packets('PC-A').find(p=>p.payload.data.body==='An old owner’s private knowledge');
 f.pcA.ownership={eve:3};const request=await f.request(f.eve,'research-note',{actorId:'PC-A',packetId:packet.id});await r.drain();
 assert.equal(r.state.processed[request.id].status,'rejected');assert.ok(!r.state.research.some(f=>f.id===`note:${request.id}`));
});
test('parallel native create/update handlers await the same decrypt',async()=>{
 const f=await fixture(),r=f.runtime;
 const sealed=await f.keys.get('gm').seal({schema:1,kind:'packet',data:{type:'message',body:'One result'},actorIds:['PC-A'],eventId:'same'},[f.gm,f.alice]);
 const m=message({user:'gm',flags:{[ID]:{sealed}}},'parallel');let count=0;const open=r.keys.open.bind(r.keys);r.keys.open=async(...args)=>{count++;await new Promise(resolve=>setTimeout(resolve,20));return open(...args);};
 const [a,b]=await Promise.all([r.decode(m),r.decode(m)]);assert.equal(count,1);assert.equal(a,b);assert.equal(a.payload.data.body,'One result');
});
test('a delayed old decrypt cannot overwrite a newer vault update',async()=>{
 const f=await fixture(),r=f.runtime,doc=game.messages.get(game.settings.get(ID,'vaultId')),open=r.keys.open.bind(r.keys);
 const oldState=r.state;oldState.marker='old';const newer={...oldState,marker:'new',revision:oldState.revision+1};
 const old=await r.keys.seal({schema:1,kind:'vault',data:oldState,eventId:doc.id},[f.gm]);const latest=await r.keys.seal({schema:1,kind:'vault',data:newer,eventId:doc.id},[f.gm]);
 doc.flags[ID].sealed=old;let release;const gate=new Promise(resolve=>release=resolve);r.keys.open=async(e,...args)=>{if(e.signature===old.signature)await gate;return open(e,...args);};
 const delayed=r.decode(doc,true);doc.flags[ID].sealed=latest;await r.decode(doc,true);release();await delayed;assert.equal(r.state.marker,'new');assert.equal(r.state.revision,newer.revision);
});
