import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,message,user,memoryStorage} from './helpers.mjs';
import {webcrypto} from 'node:crypto';
import {EndpointKeys} from '../scripts/crypto.mjs';
import {ID,contactRecord,evidenceRecord,initialState} from '../scripts/domain.mjs';
import {ONIRuntime} from '../scripts/runtime.mjs';
import {setRollImporter} from '../scripts/bridge.mjs';
test('GM direct delivery encrypts one PC and its co-owner, never an unrelated user',async()=>{
  const f=await fixture(),r=f.runtime;f.pcA.ownership.eve=3;
  const s=r.state;s.contacts.push(contactRecord({name:'Broker',gmNotes:'Secret enemy',grants:[]},'npc'));s.evidence.push(evidenceRecord({title:'Receipt',body:'private transfer 483',truth:'red-herring',gmNotes:'Plant this'},'e'));await r.saveState(s);
  await f.request(f.gm,'dispatch',{actorIds:[f.pcA.id],contactId:'npc',evidenceId:'e'});await r.drain();
  const p=[...r.decoded.values()].find(x=>x.payload.kind==='packet'&&x.payload.data.evidence);
  assert.deepEqual(p.payload.actorIds,['PC-A']);assert.ok(p.message.getFlag(ID,'sealed').keys.alice);assert.ok(p.message.getFlag(ID,'sealed').keys.eve);assert.ok(!p.message.getFlag(ID,'sealed').keys.bob);
  assert.equal(await f.keys.get('bob').open(p.message.getFlag(ID,'sealed'),f.gm),null);
  assert.ok(!JSON.stringify(p.payload).includes('red-herring'));assert.ok(!JSON.stringify(p.payload).includes('Plant this'));assert.ok(!JSON.stringify(p.message.flags).includes('private transfer'));
});
test('a player cannot impersonate another actor or modify the GM directory',async()=>{
  const f=await fixture(),r=f.runtime;
  const a=await f.request(f.alice,'contact-save',{name:'Forged GM contact'}),b=await f.request(f.alice,'send',{actorId:'PC-B',contactId:'nothing',body:'fake'});
  await r.drain();assert.equal(r.state.contacts.length,0);assert.equal(r.state.processed[a.id].status,'rejected');assert.equal(r.state.processed[b.id].status,'rejected');
});
test('player-authored packets are rejected even when their ciphertext is valid',async()=>{
  const f=await fixture(),r=f.runtime;
  const sealed=await f.keys.get('alice').seal({schema:1,kind:'packet',data:{body:'Forged GM answer'},actorIds:['PC-A']},[f.gm,f.alice]);
  const doc=message({user:'alice',flags:{[ID]:{sealed}}},'forged');assert.equal(await r.decode(doc),null);
});
test('off-grid blocks outbound activity and holds incoming deliveries until reconnect',async()=>{
  const f=await fixture(),r=f.runtime,s=r.state;
  s.contacts.push(contactRecord({name:'NPC',grants:['PC-A']},'npc'));s.actors['PC-A']={enabled:false};await r.saveState(s);
  const req=await f.request(f.alice,'send',{actorId:'PC-A',contactId:'npc',body:'hello'});await r.drain();assert.equal(r.state.processed[req.id].status,'rejected');
  await f.request(f.gm,'dispatch',{actorIds:['PC-A'],contactId:'npc',body:'Held message'});await r.drain();assert.ok(r.state.outbox.some(j=>j.data.body==='Held message'));
  await f.request(f.alice,'power',{actorId:'PC-A',enabled:true});await r.drain();assert.ok(!r.state.outbox.some(j=>j.data.body==='Held message'));assert.ok(r.packets('PC-A').some(p=>p.payload.data.body==='Held message'));
});
test('unknown recipient keys retain packets in the encrypted outbox',async()=>{
  const f=await fixture(),r=f.runtime,s=r.state;s.contacts.push(contactRecord({name:'NPC'},'npc'));await r.saveState(s);delete f.alice.flags[ID].publicKey;
  await f.request(f.gm,'dispatch',{actorIds:['PC-A'],contactId:'npc',body:'Later'});await r.drain();assert.ok(r.state.outbox.some(j=>j.data.body==='Later'));assert.ok(!r.packets('PC-A').some(p=>p.payload.data.body==='Later'));
});
test('request replay and GM restart do not deliver the same packet twice',async()=>{
  const f=await fixture(),r=f.runtime,s=r.state;s.contacts.push(contactRecord({name:'NPC'},'npc'));await r.saveState(s);
  const req=await f.request(f.gm,'dispatch',{actorIds:['PC-A'],contactId:'npc',body:'Once only'});await r.drain();await r.drain();
  const restarted=new ONIRuntime();restarted.keys=f.keys.get('gm');restarted.ready=true;for(const m of game.messages.contents)await restarted.decode(m);await restarted.drain();
  assert.equal(restarted.packets('PC-A').filter(p=>p.payload.data.body==='Once only').length,1);assert.equal(restarted.state.processed[req.id].status,'accepted');
});
test('calls connect, carry private dialogue and sight, and hang up for both PCs',async()=>{
  const f=await fixture(),r=f.runtime;await f.request(f.gm,'sync-roster',{});await r.drain();
  await f.request(f.alice,'send',{actorId:'PC-A',contactId:'pc:PC-B',mode:'video-call'});await r.drain();let c=r.state.calls[0];assert.equal(c.status,'ringing');
  const bad=await f.request(f.alice,'call-action',{actorId:'PC-A',callId:c.id,action:'accept'});await r.drain();assert.equal(r.state.processed[bad.id].status,'rejected');
  await f.request(f.bob,'call-action',{actorId:'PC-B',callId:c.id,action:'accept'});await r.drain();assert.equal(r.state.calls[0].status,'connected');
  await f.request(f.bob,'call-line',{actorId:'PC-B',callId:c.id,body:'Meet at the relay'});await f.request(f.alice,'feed',{actorId:'PC-A',callId:c.id,media:{path:'worlds/city/view.webp',type:'image'}});await r.drain();
  assert.ok(r.packets('PC-A').some(p=>p.payload.data.body==='Meet at the relay'));assert.ok(r.packets('PC-B').some(p=>p.payload.data.type==='feed'));
  await f.request(f.alice,'call-action',{actorId:'PC-A',callId:c.id,action:'hangup'});await r.drain();assert.equal(r.state.calls[0].status,'ended');assert.equal(r.calls('PC-B')[0].status,'ended');
});
test('expired calls become missed and do not ring when a PC returns',async()=>{
  const f=await fixture(),r=f.runtime;let s=r.state;s.calls.push({id:'expired',status:'ringing',actors:['PC-A'],receiverActors:['PC-A'],from:{name:'NPC'},to:{name:'PC-A'},mode:'audio-call',expiresAt:Date.now()-1});await r.saveState(s);await r.drain();assert.equal(r.state.calls[0].status,'missed');assert.equal(r.calls('PC-A')[0].status,'missed');
});
test('evidence can be forwarded only after delivery and only to a granted PC channel',async()=>{
  const f=await fixture(),r=f.runtime;let s=r.state;s.contacts.push(contactRecord({name:'NPC'},'npc'));s.evidence.push(evidenceRecord({title:'Lead',body:'Evidence contents',truth:'forged'},'e'));await r.saveState(s);
  await f.request(f.gm,'sync-roster',{});await r.drain();
  const bad=await f.request(f.alice,'forward',{actorId:'PC-A',contactId:'pc:PC-B',evidenceId:'e'});await r.drain();assert.equal(r.state.processed[bad.id].status,'rejected');
  await f.request(f.gm,'dispatch',{actorIds:['PC-A'],contactId:'npc',evidenceId:'e'});await r.drain();await f.request(f.alice,'forward',{actorId:'PC-A',contactId:'pc:PC-B',evidenceId:'e'});await r.drain();assert.equal(r.actorEvidence('PC-B')[0].body,'Evidence contents');assert.ok(!('truth'in r.actorEvidence('PC-B')[0]));
});
test('network operations roll once and expose no automatic answer or truth label',async()=>{
  const f=await fixture(),r=f.runtime;const skill={id:'net',uuid:'Actor.PC-A.Item.net',name:'Digital Networking',type:'skill',system:{level:3}};f.pcA.items.set('net',skill);let n=0;
  setRollImporter(async()=>({rollSkill:async()=>{n++;return {success:true,successDegrees:2,failureDegrees:0,tr:6,best:2,sides:8,chatMessageId:'roll'};}}));
  let s=r.state;s.contacts.push(contactRecord({name:'Index',type:'system',grants:['PC-A']},'idx'));await r.saveState(s);
  const q=await f.request(f.alice,'operation',{actorId:'PC-A',op:'search',contactId:'idx',body:'Search transfer routes'});await r.drain();
  await f.request(f.gm,'resolve',{requestId:q.id,method:'roll'});await r.drain();assert.equal(n,1);assert.ok(r.state.pending[0].rolled.success);
  const retry=await f.request(f.gm,'resolve',{requestId:q.id,method:'roll'});await r.drain();assert.equal(n,1);assert.equal(r.state.processed[retry.id].status,'rejected');
  await f.request(f.gm,'resolve',{requestId:q.id,method:'reply',body:'One authorized transfer route found.'});await r.drain();assert.equal(r.state.pending.length,0);assert.ok(r.packets('PC-A').some(p=>p.payload.data.body.includes('authorized transfer')));
});
test('going off-grid deactivates only this sleeve ONI and reconnect restores it',async()=>{
  const f=await fixture(),r=f.runtime;
  f.pcA.items.set('oni',{id:'oni',type:'augmentation',system:{catalogId:'AUG011',active:true}});
  f.pcA.items.set('other',{id:'other',type:'augmentation',system:{catalogId:'AUG016',active:true}});
  await f.request(f.alice,'power',{actorId:'PC-A',enabled:false});await r.drain();assert.equal(f.pcA.items.get('oni').system.active,false);assert.equal(f.pcA.items.get('other').system.active,true);
  await f.request(f.alice,'power',{actorId:'PC-A',enabled:false});await r.drain();await f.request(f.alice,'power',{actorId:'PC-A',enabled:true});await r.drain();assert.equal(f.pcA.items.get('oni').system.active,true);
});
test('scheduled evidence stays queued until due and is delivered once',async()=>{
  const f=await fixture(),r=f.runtime,s=r.state;s.contacts.push(contactRecord({name:'NPC'},'npc'));await r.saveState(s);
  await f.request(f.gm,'dispatch',{actorIds:['PC-A'],contactId:'npc',body:'Timed',deliverAt:Date.now()+60000});await r.drain();assert.ok(r.state.outbox.some(j=>j.data.body==='Timed'));assert.ok(!r.packets('PC-A').some(p=>p.payload.data.body==='Timed'));
  const now=r.state;now.outbox.filter(j=>j.data.body==='Timed').forEach(j=>j.deliverAt=0);await r.saveState(now);await r.drain();assert.equal(r.packets('PC-A').filter(p=>p.payload.data.body==='Timed').length,1);
});
test('NPC contact messages go to the GM queue and the GM answers as that contact',async()=>{
  const f=await fixture(),r=f.runtime,s=r.state;s.contacts.push(contactRecord({name:'Lena Orr',grants:['PC-A'],gmNotes:'Private agenda'},'npc'));await r.saveState(s);
  const req=await f.request(f.alice,'send',{actorId:'PC-A',contactId:'npc',body:'Need a relay record.'});await r.drain();assert.equal(r.state.pending.length,1);assert.equal(r.state.pending[0].id,req.id);
  await f.request(f.gm,'resolve',{requestId:req.id,method:'reply',body:'I retained the receipt.'});await r.drain();assert.equal(r.state.pending.length,0);const reply=r.packets('PC-A').find(p=>p.payload.data.body==='I retained the receipt.');assert.equal(reply.payload.data.from.name,'Lena Orr');assert.ok(!JSON.stringify(reply.payload).includes('Private agenda'));
});
test('GM can open a call and speak as an NPC without impersonating a PC',async()=>{
  const f=await fixture(),r=f.runtime,s=r.state;s.contacts.push(contactRecord({name:'Lena Orr'},'npc'));await r.saveState(s);
  await f.request(f.gm,'dispatch',{actorIds:['PC-A'],contactId:'npc',mode:'video-call'});await r.drain();const c=r.state.calls[0];
  await f.request(f.alice,'call-action',{actorId:'PC-A',callId:c.id,action:'accept'});await r.drain();
  await f.request(f.gm,'gm-call',{callId:c.id,contactId:'npc',body:'This is Lena.'});await r.drain();assert.equal(r.packets('PC-A').find(p=>p.payload.data.body==='This is Lena.').payload.data.from.name,'Lena Orr');
  await f.request(f.gm,'gm-call',{callId:c.id,action:'hangup'});await r.drain();assert.equal(r.state.calls[0].status,'ended');
});
test('revoking a contact removes it from the next directory snapshot',async()=>{
  const f=await fixture(),r=f.runtime;await f.request(f.gm,'contact-save',{id:'npc',name:'Contact',grants:['PC-A']});await r.drain();assert.equal(r.directory('PC-A').contacts.length,1);
  await f.request(f.gm,'contact-save',{id:'npc',name:'Contact',grants:[]});await r.drain();assert.equal(r.directory('PC-A').contacts.length,0);
});
test('a newly registered co-GM is added to the encrypted vault and can take over',async()=>{
  const f=await fixture(),r=f.runtime,other=user('zzGM',true);game.users.set(other.id,other);const k=new EndpointKeys({crypto:webcrypto,storage:memoryStorage(),user:other,worldId:game.world.id});await k.init();await r.drain();
  const doc=game.messages.get(game.settings.get(ID,'vaultId'));assert.ok(doc.getFlag(ID,'sealed').keys.zzGM);assert.equal((await k.open(doc.getFlag(ID,'sealed'),f.gm)).kind,'vault');
  f.gm.active=false;game.user=other;const rr=new ONIRuntime();rr.keys=k;rr.ready=true;for(const m of game.messages.contents)await rr.decode(m);assert.ok(rr.isAuthority);await rr.drain();
});
test('world recovery recreates a deleted vault without starting a stale live call',async()=>{
  const f=await fixture(),r=f.runtime,s=r.state;s.contacts.push(contactRecord({name:'NPC'},'npc'));await r.saveState(s);
  await f.request(f.gm,'dispatch',{actorIds:['PC-A'],contactId:'npc',mode:'video-call'});await r.drain();const backup=JSON.parse(r.exportWorld());const id=game.settings.get(ID,'vaultId');game.messages.delete(id);r.decoded.delete(id);
  await r.restoreWorld(backup);assert.equal(r.state.calls[0].status,'ended');assert.ok(r.state.contacts.some(c=>c.id==='npc'));assert.notEqual(game.settings.get(ID,'vaultId'),id);
});
test('off-grid directory updates do not reveal a newly introduced contact',async()=>{
  const f=await fixture(),r=f.runtime;await f.request(f.alice,'power',{actorId:'PC-A',enabled:false});await r.drain();
  await f.request(f.gm,'contact-save',{id:'new',name:'Newly introduced source',grants:['PC-A']});await r.drain();assert.equal(r.deliveredDirectory('PC-A').contacts.length,0);assert.equal(r.directory('PC-A').contacts.length,1);
  await f.request(f.alice,'power',{actorId:'PC-A',enabled:true});await r.drain();assert.equal(r.directory('PC-A').contacts[0].name,'Newly introduced source');
});
test('a call already seen by a PC closes visibly when that PC goes off-grid',async()=>{
  const f=await fixture(),r=f.runtime,s=r.state;s.contacts.push(contactRecord({name:'NPC'},'npc'));await r.saveState(s);
  await f.request(f.gm,'dispatch',{actorIds:['PC-A'],contactId:'npc',mode:'video-call'});await r.drain();const c=r.state.calls[0];
  await f.request(f.alice,'call-action',{actorId:'PC-A',callId:c.id,action:'accept'});await r.drain();await f.request(f.alice,'power',{actorId:'PC-A',enabled:false});await r.drain();assert.equal(r.calls('PC-A')[0].status,'ended');
});
