import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {contactRecord,evidenceRecord,projectEvidence} from '../scripts/domain.mjs';
import {renderView} from '../scripts/view.mjs';
test('all interface panels and GM subpanels produce controls without rendering failures',async()=>{
  const f=await fixture(),r=f.runtime,s=r.state;
  s.contacts.push(contactRecord({name:'Lena',gmNotes:'SECRET AGENDA',grants:['PC-A']},'npc'));s.evidence.push(evidenceRecord({title:'Receipt',truth:'red-herring',gmNotes:'SECRET FORGERY'},'e'));
  s.pending.push({id:'req',kind:'operation',op:'search',actorId:'PC-A',body:'Lookup',createdAt:Date.now()});
  await r.saveState(s);r.snapshot(s,'PC-A');r.enqueue(s,['PC-A'],{type:'evidence',title:'Receipt',evidence:projectEvidence(s.evidence[0]),incoming:true});r.createCall(s,{from:{name:'Lena',id:'npc'},to:{name:'PC-A'},actors:['PC-A'],receiverActors:['PC-A'],mode:'video-call'});await r.saveState(s);await r.flush();
  const app={actorId:'PC-A',tab:'inbox',gmSection:'queue'};
  for(const tab of ['inbox','contacts','evidence','calls','network','settings','gm']){
    app.tab=tab;const html=renderView(r,app);assert.ok(html.includes('oni-shell'));assert.ok(html.includes('oni-main'));
    if(tab!=='gm')assert.ok(!html.includes('SECRET AGENDA')&&!html.includes('SECRET FORGERY'));
  }
  app.tab='gm';for(const section of ['queue','dispatch','contacts','evidence','signals','calls','outbox']){app.gmSection=section;assert.ok(renderView(r,app).includes('GM PRIVATE'));}
});
test('player UI has no GM controls, hidden identity or red-herring classification',async()=>{
  const f=await fixture(),r=f.runtime,s=r.state;s.contacts.push(contactRecord({name:'Elias North',gmNotes:'Dr Lucan Vey',grants:['PC-A']},'npc'));s.evidence.push(evidenceRecord({title:'Receipt',truth:'red-herring'},'e'));await r.saveState(s);
  await f.request(f.gm,'dispatch',{actorIds:['PC-A'],contactId:'npc',evidenceId:'e'});await r.drain();
  game.user=f.alice;const p=Object.create(Object.getPrototypeOf(r));Object.assign(p,r);p.keys=f.keys.get('alice');p.cache=new Map();p.decoded=new Map();for(const m of game.messages.contents)await p.decode(m);
  for(const tab of ['inbox','contacts','evidence','network','settings']){const html=renderView(p,{actorId:'PC-A',tab});assert.ok(!html.includes('data-id="gm"'));assert.ok(!html.includes('Dr Lucan Vey'));assert.ok(!html.includes('red-herring'));}
  assert.equal(p.directory('PC-B').contacts.length,0);
});
test('hostile titles and messages stay escaped in the rendered HTML',async()=>{
  const f=await fixture(),r=f.runtime,s=r.state;const bad='<img src=x onerror=alert(1)>';
  r.enqueue(s,['PC-A'],{type:'message',title:bad,body:'<script>alert(2)</script>',incoming:true});await r.saveState(s);await r.flush();const html=renderView(r,{actorId:'PC-A',tab:'inbox'});
  assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes(bad));
});
