import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.env.AC_SYSTEM_PATH;
test('supplied system gives +2 only to ONI Networking / Navigation / History',{skip:!root},async()=>{
  const {evaluateEffects}=await import(pathToFileURL(path.join(root,'module/effects.mjs')));
  const a={type:'character',items:[{id:'oni',type:'augmentation',name:'ONI Implant',system:{catalogId:'AUG011',active:true}}]};
  for(const skill of ['digital-networking','navigation','history'])assert.equal(evaluateEffects(a,{skill,activity:'oni-netrunning'}).values['check.gear'],2);
  for(const skill of ['data-analysis','data-engineering'])assert.equal(evaluateEffects(a,{skill,activity:'oni-netrunning'}).values['check.gear'],undefined);
});
test('supplied system applies masking Trait only with deck and mask activity',{skip:!root},async()=>{
  const {evaluateEffects}=await import(pathToFileURL(path.join(root,'module/effects.mjs')));
  const a={type:'character',items:[{id:'trait',type:'trait',name:'Technician masking',system:{catalogId:'trait-149'}}]};
  assert.equal(evaluateEffects(a,{skill:'digital-networking',activity:'mask-oni',itemTag:['deck']}).values['check.training'],2);
  assert.equal(evaluateEffects(a,{skill:'digital-networking',activity:'mask-oni',itemTag:[]}).values['check.training'],undefined);
});
