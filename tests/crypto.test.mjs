import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {EndpointKeys} from '../scripts/crypto.mjs';
import {user,memoryStorage} from './helpers.mjs';
test('real WebCrypto encrypts for recipients and denies an unrelated player',async()=>{
  const a=user('a'),b=user('b'),e=user('eve'),map=new Map();
  for(const u of [a,b,e]){const k=new EndpointKeys({crypto:webcrypto,storage:memoryStorage(),user:u,worldId:'w'});await k.init();map.set(u.id,k);}
  const privateText={body:'Unique private evidence 931',truth:'red-herring'},sealed=await map.get('a').seal(privateText,[a,b]);
  assert.ok(!JSON.stringify(sealed).includes(privateText.body));assert.ok(!JSON.stringify(sealed).includes('red-herring'));
  assert.deepEqual(await map.get('b').open(sealed,a),privateText);assert.equal(await map.get('eve').open(sealed,a),null);
  const tamper=structuredClone(sealed);tamper.iv=tamper.iv.slice(0,-2)+'AA';await assert.rejects(()=>map.get('b').open(tamper,a),/signature/);
  await assert.rejects(()=>map.get('b').open(sealed,e),/Invalid private/);
  const recovered=new EndpointKeys({crypto:webcrypto,storage:memoryStorage(),user:b,worldId:'w'});
  await assert.rejects(()=>recovered.init(),/another browser/);await recovered.restore(JSON.parse(map.get('b').backup()),false);assert.deepEqual(await recovered.open(sealed,a),privateText);
  await assert.rejects(()=>recovered.restore(JSON.parse(map.get('a').backup()),false),/different Foundry user/);
});
test('large evidence bundles are encoded without JavaScript argument-size overflows',async()=>{
  const a=user('a'),k=new EndpointKeys({crypto:webcrypto,storage:memoryStorage(),user:a,worldId:'w'});await k.init();
  const data={body:'f'.repeat(210000)},s=await k.seal(data,[a]);assert.deepEqual(await k.open(s,a),data);
});
test('HTTP environments without WebCrypto fail closed and never send plaintext',async()=>{const k=new EndpointKeys({crypto:{},storage:memoryStorage(),user:user('a'),worldId:'w'});await assert.rejects(()=>k.init(),/HTTPS/);});
