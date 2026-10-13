import {webcrypto} from 'node:crypto';
import {ID} from '../scripts/domain.mjs';
import {EndpointKeys} from '../scripts/crypto.mjs';
import {ONIRuntime,registerSettings} from '../scripts/runtime.mjs';
export class Collection extends Map {
  get contents(){return [...this.values()];}filter(fn){return this.contents.filter(fn);}find(fn){return this.contents.find(fn);}some(fn){return this.contents.some(fn);}map(fn){return this.contents.map(fn);}
  [Symbol.iterator](){return this.values();}
}
export function memoryStorage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};}
export function user(id,isGM=false){return {id,name:id,isGM,active:true,flags:{},getFlag(scope,key){return this.flags[scope]?.[key];},async setFlag(scope,key,v){(this.flags[scope]??={})[key]=structuredClone(v);}};}
export function actor(id,owner){const a={id,uuid:`Actor.${id}`,name:id,type:'character',img:'',ownership:{default:0,[owner]:3},items:new Collection(),
  testUserPermission(u){return u.isGM||Number(this.ownership[u.id]??this.ownership.default)>=3;},getFlag(scope,key){return this.flags?.[scope]?.[key];},
  async updateEmbeddedDocuments(_type,updates){for(const x of updates){const i=this.items.get(x._id);i.system.active=x['system.active'];}}};return a;}
export function message(data,id){const m={...structuredClone(data),id,timestamp:Date.now(),getFlag(scope,key){return this.flags?.[scope]?.[key];},
  get author(){return game.users.get(this.user);},async update(v){Object.assign(this,structuredClone(v));},async delete(){game.messages.delete(this.id);}};return m;}
export async function fixture(){
  const gm=user('gm',true),alice=user('alice'),bob=user('bob'),eve=user('eve'),pcA=actor('PC-A','alice'),pcB=actor('PC-B','bob');
  const values=new Map();globalThis.game={user:gm,users:new Collection([gm,alice,bob,eve].map(u=>[u.id,u])),actors:new Collection([[pcA.id,pcA],[pcB.id,pcB]]),messages:new Collection(),world:{id:'test-world'},modules:new Collection(),
    settings:{register(_s,k,d){values.set(k,d.default);},get(_s,k){return values.get(k);},async set(_s,k,v){values.set(k,v);return v;}}};
  let next=1;globalThis.foundry={utils:{randomID:()=>`id${String(next++).padStart(13,'0')}`}};
  globalThis.ui={notifications:{error:()=>{},warn:()=>{},info:()=>{}}};globalThis.Hooks={callAll:()=>{}};
  globalThis.ChatMessage={implementation:{async create(data){const m=message(data,foundry.utils.randomID());game.messages.set(m.id,m);return m;}}};
  registerSettings();const keys=new Map();for(const u of [gm,alice,bob,eve]){const k=new EndpointKeys({crypto:webcrypto,storage:memoryStorage(),user:u,worldId:'test-world'});await k.init();keys.set(u.id,k);}
  const runtime=new ONIRuntime();runtime.keys=keys.get('gm');runtime.ready=true;await runtime.saveState(runtime.state);
  async function request(u,action,data){
    const sealed=await keys.get(u.id).seal({schema:1,kind:'request',data:{action,data},eventId:'request',actorIds:[]},[u,gm]);
    const m=await ChatMessage.implementation.create({user:u.id,content:'ONI · encrypted transmission',whisper:[u.id,gm.id],flags:{[ID]:{sealed}}});await runtime.decode(m);return m;
  }
  return {gm,alice,bob,eve,pcA,pcB,keys,runtime,request,values};
}
