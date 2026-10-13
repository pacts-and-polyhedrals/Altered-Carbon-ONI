import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contactRecord,evidenceRecord,projectContact,projectEvidence,safeMedia,owns,validTransition} from '../scripts/domain.mjs';
test('GM-only contact identity and grants never enter a public projection',()=>{
  const c=contactRecord({name:'Elias North',gmNotes:'Dr Lucan Vey',sourceId:'C01',grants:['PC01']},'c');
  const p=projectContact(c);assert.equal(p.name,'Elias North');assert.ok(!JSON.stringify(p).includes('Lucan'));assert.ok(!('grants'in p));assert.ok(!('sourceId'in p));
});
test('red herrings are visually identical to unverified genuine evidence',()=>{
  const a=evidenceRecord({title:'Receipt',body:'Transfer record',truth:'red-herring',gmNotes:'False lead'},'e');
  const b={...a,truth:'genuine',gmNotes:'True'};assert.deepEqual(projectEvidence(a),projectEvidence(b));assert.equal(projectEvidence(a).verdict,'Unverified');
});
test('explicit GM assessments can be revealed without leaking the truth label',()=>{const e=evidenceRecord({title:'x',truth:'forged'},'x');assert.equal(projectEvidence(e,'Signature inconsistent').verdict,'Signature inconsistent');assert.ok(!('truth'in projectEvidence(e)));});
test('attachments reject executable URLs, HTML, traversal and protocol-relative URLs',()=>{
  for(const s of ['javascript:alert(1)','data:text/html,<h1>x</h1>','//evil.test/x','modules/../secret.png','https://x.test/"onload=bad','file:///etc/passwd'])assert.throws(()=>safeMedia(s));
  assert.equal(safeMedia('modules/cold-storage/assets/portraits/pc01-nia-calder-portrait.svg'),'modules/cold-storage/assets/portraits/pc01-nia-calder-portrait.svg');assert.equal(safeMedia('https://x.test/p.png?a=1&b=2'),'https://x.test/p.png?a=1&b=2');
});
test('ownership includes co-owners and excludes observers',()=>{const a={ownership:{default:0,A:3,B:2}};assert.ok(owns(a,{id:'A'}));assert.ok(!owns(a,{id:'B'}));assert.ok(owns(a,{id:'G',isGM:true}));});
test('only the receiver can answer and ended calls cannot be revived',()=>{const c={actors:['A','B'],receiverActors:['B'],status:'ringing'};assert.throws(()=>validTransition(c,'accept','A'));assert.equal(validTransition(c,'accept','B'),'connected');assert.throws(()=>validTransition({...c,status:'ended'},'accept','B'));});
