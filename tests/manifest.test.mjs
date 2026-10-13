import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('separate module manifest has complete runtime files and honest v14 compatibility',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(root,'module.json')));assert.equal(m.id,'altered-carbon-oni');assert.equal(m.compatibility.minimum,'14');assert.equal(m.compatibility.verified,undefined);assert.equal(m.socket,false);
  assert.equal(m.relationships.systems[0].id,'altered-carbon-rpg');assert.equal(m.relationships.systems[0].compatibility.minimum,'2.4.9');
  for(const p of [...m.esmodules,...m.styles,'templates/interface.hbs'])assert.ok(fs.existsSync(path.join(root,p)),p);
});
test('runtime does not use an unsealed module socket or depend on third-party packages',()=>{
  const files=fs.readdirSync(path.join(root,'scripts')).filter(x=>x.endsWith('.mjs')&&x!=='validate.mjs');
  for(const file of files){const s=fs.readFileSync(path.join(root,'scripts',file),'utf8');assert.ok(!s.includes('game.socket'));for(const match of s.matchAll(/from\s+['"]([^'"]+)['"]/g))assert.ok(match[1].startsWith('.'));}
});
test('the install manifest stays prominent in README and points at the real repository download',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(root,'module.json'))),readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
  assert.equal(m.manifest,'https://raw.githubusercontent.com/pacts-and-polyhedrals/Altered-Carbon-ONI/main/module.json');
  assert.equal(m.download,'https://github.com/pacts-and-polyhedrals/Altered-Carbon-ONI/archive/refs/heads/main.zip');
  assert.ok(readme.split('\n').slice(0,20).join('\n').includes(m.manifest));
  assert.ok(readme.includes('1.1.0'));assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,m.version);
});
