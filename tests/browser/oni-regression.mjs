class Collection extends Map{get contents(){return [...this.values()]}filter(f){return this.contents.filter(f)}find(f){return this.contents.find(f)}some(f){return this.contents.some(f)}[Symbol.iterator](){return this.values()}}
const hooks=new Map();window.Hooks={on(n,fn){(hooks.get(n)||hooks.set(n,[]).get(n)).push(fn)},callAll(n,...a){for(const f of hooks.get(n)||[])f(...a)}};
const notices=[];const note=t=>{notices.push(t);document.querySelector('#notes').textContent=t};
window.ui={notifications:{info:note,error:t=>{window.qaErrors.push(t);note(t)},warn:note}};window.qaErrors=[];window.canvas={tokens:{controlled:[]}};
class BaseApp{
 constructor(){this.rendered=false;this.element=document.querySelector('#surface');this.renderCount=0;}
 async _prepareContext(){return {}}
 async render(){const c=await this._prepareContext({});this.element.querySelector('.window-content').innerHTML=`<div class="oni-app-body">${c.body}</div>`;this.rendered=true;this.renderCount++;this._onRender(c,{});return this;}
 _onRender(){this.element.onclick=e=>{const t=e.target.closest('[data-action]');if(t)this.constructor.DEFAULT_OPTIONS.actions[t.dataset.action]?.call(this,e,t)}}
}
window.foundry={utils:{randomID:()=>crypto.randomUUID().replaceAll('-','').slice(0,16),saveDataToFile:()=>{}},applications:{api:{ApplicationV2:BaseApp,HandlebarsApplicationMixin:c=>c,DialogV2:{confirm:async()=>true}}}};
const mkUser=(id,isGM=false)=>({id,name:isGM?'GM':`Player ${id}`,isGM,active:true,flags:{},getFlag(s,k){return this.flags[s]?.[k]},async setFlag(s,k,v){(this.flags[s]??={})[k]=structuredClone(v);Hooks.callAll('updateUser',this,{flags:{[s]:{[k]:v}}},{},game.user?.id)}});
const gm=mkUser('GM',true),players=Array.from({length:8},(_,i)=>mkUser(`P${i+1}`));
const pregens=await fetch('/modules/cold-storage/content-src/pregens.json').then(r=>r.json());
const actors=pregens.map((p,i)=>({id:`ACTOR${i+1}`,documentName:'Actor',uuid:`Actor.ACTOR${i+1}`,name:p.name,type:'character',img:'',ownership:{default:3},flags:{'cold-storage':{sourceId:p.id,selectionState:'active'}},items:new Collection(),getFlag(s,k){return this.flags[s]?.[k]},testUserPermission(u){return u.isGM||Number(this.ownership[u.id]??this.ownership.default)>=3},async update(data){for(const [k,v] of Object.entries(data))if(k.startsWith('ownership.'))this.ownership[k.slice(10)]=v;Hooks.callAll('updateActor',this,data,{},game.user.id)},async updateEmbeddedDocuments(){}}));
for(let i=0;i<8;i++)players[i].character=actors[i];
const values=new Map();window.game={user:gm,users:new Collection([gm,...players].map(u=>[u.id,u])),actors:new Collection(actors.map(a=>[a.id,a])),messages:new Collection(),modules:new Collection([['cold-storage',{active:true}]]),journal:new Collection(),system:{id:'altered-carbon-rpg',version:'2.4.9'},world:{id:'oni-regression'},settings:{register(s,k,d){values.set(k,d.default)},get(s,k){return values.get(k)},async set(s,k,v){values.set(k,v);return v}}};
window.ChatMessage={implementation:{async create(data){const m={...structuredClone(data),id:foundry.utils.randomID(),timestamp:Date.now(),get author(){return game.users.get(this.user)},getFlag(s,k){return this.flags?.[s]?.[k]},async update(v){Object.assign(this,structuredClone(v));Hooks.callAll('updateChatMessage',this,v,{},game.user.id)}};game.messages.set(m.id,m);Hooks.callAll('createChatMessage',m,{},game.user.id);return m;}}};
window.JournalEntry={implementation:{async create(data){const j={...data,id:foundry.utils.randomID(),pages:new Collection(data.pages.map((p,i)=>[String(i),{...p,id:String(i),getFlag(s,k){return this.flags[s]?.[k]}}])),getFlag(s,k){return this.flags[s]?.[k]},sheet:{render:async()=>{}}};game.journal.set(j.id,j);return j;}}};
const {ID}=await import('/modules/altered-carbon-oni/scripts/domain.mjs');
const {EndpointKeys}=await import('/modules/altered-carbon-oni/scripts/crypto.mjs');
const {ONIRuntime,registerSettings}=await import('/modules/altered-carbon-oni/scripts/runtime.mjs');
const {ONIApplication}=await import('/modules/altered-carbon-oni/scripts/app.mjs');
registerSettings();const keys=new Map();
for(const u of players){const map=new Map(),k=new EndpointKeys({user:u,worldId:game.world.id,storage:{getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)}});await k.init();keys.set(u.id,k);}
const r=new ONIRuntime();window.gmRuntime=r;const gmApp=new ONIApplication(r,{actorId:'ACTOR1'});await r.start();await r.schedule();clearInterval(r.timer);await gmApp.render({force:true});
const rawRequest=async(user,action,data)=>{
 const k=user.isGM?r.keys:keys.get(user.id),sealed=await k.seal({schema:1,kind:'request',data:{action,data},eventId:foundry.utils.randomID(),actorIds:[]},[user,gm]);
 const doc=await ChatMessage.implementation.create({user:user.id,content:'ONI',whisper:[user.id,gm.id],flags:{[ID]:{sealed}}});await r.decode(doc);await r.schedule();return doc.id;
};
window.qa={gm,players,actors,keys,r,gmApp,notices,rawRequest,
 async player(id){game.user=players.find(p=>p.id===id);const p=new ONIRuntime();p.keys=keys.get(id);p.ready=true;for(const m of game.messages.contents)await p.decode(m);const app=new ONIApplication(p,{actorId:game.user.character.id});await app.render({force:true});this.playerRuntime=p;this.playerApp=app;return {files:p.actorResearch(app.actorId).length,contacts:p.directory(app.actorId).contacts.length,historical:p.historicalContacts(app.actorId).length};},
 async gmView(){game.user=gm;await gmApp.render({force:true});},
 async noisyRefresh(){r.uiVersion++;r.refresh();},
 async settle(){await r.schedule();await new Promise(resolve=>setTimeout(resolve,120));}
};window.qaReady=true;
