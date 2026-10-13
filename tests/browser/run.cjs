const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium:playwright}=require(process.env.ONI_PLAYWRIGHT_PATH||'playwright');
const os=require('node:os');
const root=path.resolve(__dirname,'../..');
const output=path.resolve(process.env.ONI_BROWSER_OUTPUT||path.join(os.tmpdir(),'oni-browser-regressions'));
let browser,server;
(async()=>{
 const cold=process.env.AC_COLD_PATH;
 assert.ok(cold&&fs.existsSync(path.join(cold,'content-src/pregens.json')),'Set AC_COLD_PATH to the Cold Storage source repository.');
 fs.mkdirSync(output,{recursive:true});
 server=http.createServer((req,res)=>{
  try{
   const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
   const mounts=[['/modules/altered-carbon-oni/',root],['/modules/cold-storage/',path.resolve(cold)],['/systems/altered-carbon-rpg/',process.env.AC_SYSTEM_PATH&&path.resolve(process.env.AC_SYSTEM_PATH)]];
   const mount=mounts.find(([prefix,folder])=>folder&&name.startsWith(prefix));
   const folder=mount?mount[1]:__dirname;
   const file=path.resolve(folder,mount?name.slice(mount[0].length):name.slice(1));
   if(!file.startsWith(folder+path.sep))throw new Error('Invalid path');
   const bytes=fs.readFileSync(file),mime={'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
   res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await playwright.launch({...(process.env.ONI_CHROMIUM_EXECUTABLE?{executablePath:process.env.ONI_CHROMIUM_EXECUTABLE}:{}),headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/oni-regression.html`);
 await page.waitForFunction(()=>window.qaReady,{timeout:60000});
 // A token HUD / macro changes the endpoint without using the header selector.
 await page.evaluate(async()=>{qa.gmApp.actorId='ACTOR2';await qa.gmApp.render({force:true});});
 assert.equal(await page.locator('[data-oni-select="dossierId"]').inputValue(),'PC02');
 await page.locator('#oni-actor-select').selectOption('ACTOR7');
 await page.waitForFunction(()=>qa.gmApp.dossierId==='PC07'&&qa.gmApp.actorId==='ACTOR7');
 assert.equal(await page.locator('[data-oni-select="dossierId"]').inputValue(),'PC07');
 await page.locator('[data-oni="release-lifetimes"][data-id="PC07"]').click();
 await page.waitForFunction(()=>Object.values(qa.r.state.dossiers.PC07.research).filter(g=>g.released).length===37);
 await page.locator('[data-oni="release-contacts"][data-id="PC07"]').click();
 await page.waitForFunction(()=>qa.r.directory('ACTOR7').contacts.length===43);
 const scope=await page.evaluate(()=>Object.fromEntries(Object.values(qa.r.state.dossiers).map(d=>[d.id,{past:qa.r.state.research.filter(f=>f.pcId===d.id&&['Past life','Historical contacts'].includes(f.category)&&d.research[f.id]?.released).length,current:qa.r.state.contacts.filter(c=>c.type!=='pc'&&c.grants.includes(d.actorId)).length}])));
 assert.equal(scope.PC07.past,17);assert.equal(scope.PC07.current,36);
 for(const [id,s] of Object.entries(scope))if(id!=='PC07'){assert.equal(s.past,0,id);assert.equal(s.current,0,id);}
 // Actual DOM: expand a clue lower in the scrolling contact table.
 const table=page.locator('[data-oni-scroll="pc-contact-table"]');
 const details=page.locator('[data-oni-state="recognition:cold:C13"]');
 await details.locator('summary').click();
 const before=await table.evaluate(e=>e.scrollTop);assert.ok(before>100);
 const outer=await page.locator('.window-content').evaluate(e=>e.scrollTop);
 for(let i=0;i<4;i++){await page.evaluate(()=>qa.noisyRefresh());await page.waitForTimeout(110);}
 assert.equal(await details.evaluate(e=>e.open),true);
 assert.ok(Math.abs(await table.evaluate(e=>e.scrollTop)-before)<2);
 assert.ok(Math.abs(await page.locator('.window-content').evaluate(e=>e.scrollTop)-outer)<2);
 const count=await page.evaluate(()=>qa.gmApp.renderCount);
 await page.evaluate(()=>{for(let i=0;i<6;i++)qa.r.refresh();});await page.waitForTimeout(120);
 assert.equal(await page.evaluate(()=>qa.gmApp.renderCount),count);
 await page.screenshot({path:path.join(output,'oni-gm-anik-regression.png'),fullPage:true});
 await page.locator('[data-oni="gm-tab"][data-id="contacts"]').click();
 await page.locator('[data-oni="edit-contact"][data-id="cold:C01"]').click();
 await page.locator('[name="description"]').fill('Draft survives an incoming update.');
 await page.evaluate(()=>qa.noisyRefresh());await page.waitForTimeout(150);
 assert.equal(await page.locator('[name="description"]').inputValue(),'Draft survives an incoming update.');
 // Use real decryption for Anik's player and a different PC's player.
 const p7=await page.evaluate(()=>{qa.r.ui=null;return qa.player('P7');});
 assert.equal(p7.files,37);assert.equal(p7.contacts,43);assert.equal(p7.historical,11);
 await page.locator('.oni-rail [data-oni="tab"][data-id="contacts"]').click();
 await page.locator('[data-oni="contact-view"][data-id="history"]').click();
 await page.locator('[data-oni-select="historyCategory"]').selectOption('enemy');
 const history=page.locator('.oni-history-card');assert.ok(await history.count()>0);
 await history.first().locator('summary').click();
 const histState=await history.first().getAttribute('data-oni-state');
 await page.evaluate(()=>{qa.playerRuntime.uiVersion++;qa.playerRuntime.refresh();});await page.waitForTimeout(120);
 assert.equal(await page.locator(`[data-oni-state="${histState}"]`).evaluate(e=>e.open),true);
 await page.screenshot({path:path.join(output,'oni-player-anik-regression.png'),fullPage:true});
 const p1=await page.evaluate(()=>qa.player('P1'));assert.equal(p1.files,20);assert.equal(p1.historical,0);assert.equal(p1.contacts,7);
 assert.ok(!(await page.locator('#surface').innerText()).includes('root genesis register'));
 await page.locator('.oni-rail [data-oni="tab"][data-id="research"]').click();
 await page.locator('[data-oni-filter="researchSearch"]').fill('continuity');await page.waitForTimeout(400);
 assert.equal(await page.locator('[data-oni-filter="researchSearch"]').inputValue(),'continuity');
 assert.equal(await page.locator('[data-oni-filter="researchSearch"]').evaluate(e=>e===document.activeElement),true);
 await page.setViewportSize({width:650,height:1000});await page.waitForTimeout(150);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(overflow<=2,`overflow ${overflow}`);
 assert.deepEqual(await page.evaluate(()=>qaErrors),[]);assert.deepEqual(errors,[]);
 const report={browser:browser.version(),actorAndDossierStayAligned:true,externalActorAndDossierStayAligned:true,anikFiles:37,anikLifetimeAndRelationshipFiles:17,historicalContacts:11,currentContacts:43,otherPCsUnchanged:true,expandedDetailsPreserved:true,innerAndOuterScrollPreserved:true,idleRefreshDoesNotRender:true,draftsAndSearchFocusPreserved:true,realRecipientDecryption:true,mobileOverflow:overflow,pageErrors:errors};fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));});
