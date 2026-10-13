import {ID,SCHEMA,OPS,TERMINAL,clone,text,int,esc,unique,owns,owners,allowedContact,initialState,endpoint,assertOnline,canReceive,validTransition,contactRecord,evidenceRecord,projectContact,projectEvidence,cleanMedia} from './domain.mjs';
import {EndpointKeys} from './crypto.mjs';
import {operationRoll,oniItems,hasImplant,sourceJSON} from './bridge.mjs';

const uid=()=>foundry.utils.randomID(16);
const content='<p class="ac-oni-envelope">ONI · encrypted transmission</p>';
export function registerSettings() {
  const add=(key,data)=>game.settings.register(ID,key,data);
  add('vaultId',{scope:'world',config:false,type:String,default:''});
  add('requireImplant',{name:'Require an active ONI implant',hint:'With this on, online operations require an active AUG011 implant. With it off, characters may use a paired ONI terminal; only actual implants receive the system bonus.',scope:'world',config:true,type:Boolean,default:false});
  add('traceClock',{name:'Enable optional trace clock',hint:'House rule: failed intrusion / tracing adds one segment to a six-segment clock. At six the GM receives an alert. No automatic damage or identity disclosure.',scope:'world',config:true,type:Boolean,default:false});
  add('ringSeconds',{name:'Call ring timeout (seconds)',scope:'world',config:true,type:Number,default:60,range:{min:15,max:180,step:15}});
  add('sound',{name:'ONI notification tones',scope:'client',config:true,type:Boolean,default:false});
  add('dnd',{name:'Do not disturb',hint:'Keep unread messages but suppress pop-up notifications.',scope:'client',config:true,type:Boolean,default:false});
  add('reduceMotion',{name:'Reduce ONI motion',scope:'client',config:true,type:Boolean,default:false});
}
/** One elected GM serializes world changes. Transport is signed, encrypted ChatMessages. */
export class ONIRuntime {
  constructor() { this.cache=new Map();this.decoded=new Map();this.chain=Promise.resolve();this.ui=null;this.lastError='';this.ready=false;this.notified=new Set(); }
  get users() { return game.users.contents||[...game.users]; }
  get actors() { return game.actors.contents||[...game.actors]; }
  get gms() { return this.users.filter(u=>u.isGM&&u.getFlag(ID,'publicKey')?.kid); }
  get ownedActors() { return this.actors.filter(a=>['character','npc','ai'].includes(a.type)&&owns(a,game.user)); }
  get authority() {
    const id=game.settings.get(ID,'vaultId'), doc=id?game.messages.get(id):null;
    return this.gms.filter(u=>u.active&&(!id||doc?.getFlag(ID,'sealed')?.keys?.[u.id]?.kid===u.getFlag(ID,'publicKey').kid)).sort((a,b)=>a.id.localeCompare(b.id))[0]||null;
  }
  get isAuthority() { return this.authority?.id===game.user.id; }
  get state() {
    if(!game.user.isGM)throw new Error('GM access required.');
    const id=game.settings.get(ID,'vaultId');
    if(!id)return initialState();
    const v=this.decoded.get(id);
    if(!v||v.payload.kind!=='vault'||!v.author.isGM)throw new Error('The GM vault cannot be opened in this browser. Restore its endpoint key or ask the original GM to reseal it. Do not clear the world chat archive.');
    return clone(v.payload.data);
  }
  async start() {
    try {
      this.keys=new EndpointKeys({user:game.user,worldId:game.world.id});await this.keys.init();
      for(const m of (game.messages.contents||[...game.messages]))await this.decode(m);
      this.ready=true;this.lastError='';
      if(this.isAuthority)await this.saveState(this.state); // Wrap newly registered co-GM keys.
      Hooks.on('createChatMessage',m=>{this.onMessage(m).catch(e=>this.error(e));});
      Hooks.on('updateChatMessage',m=>{this.onMessage(m,true).catch(e=>this.error(e));});
      Hooks.on('deleteChatMessage',m=>{this.cache.delete(m.id);this.decoded.delete(m.id);this.refresh();});
      Hooks.on('userConnected',()=>this.schedule());
      Hooks.on('updateUser',()=>{this.schedule();this.refresh();});
      this.timer=setInterval(()=>this.schedule(),8000);
      this.schedule();
      if(!game.user.isGM)for(const a of this.ownedActors.filter(a=>a.type==='character'))await this.request('sync',{actorId:a.id});
      if(!game.user.isGM&&!game.settings.get(ID,'dnd')){
        const unread=this.ownedActors.reduce((n,a)=>n+this.unread(a.id),0);
        if(unread)ui.notifications.info(`ONI: ${unread} unread transmission${unread===1?'':'s'}. Open the eye button to view your inbox.`);
      }
      this.refresh();return true;
    } catch(e) { this.ready=false;this.error(e);return false; }
  }
  error(e) { console.error('ONI |',e);this.lastError=e.message;ui.notifications.error(`ONI: ${e.message}`);this.refresh(); }
  refresh() { this.ui?.refresh?.();Hooks.callAll('acONIChanged',this); }
  async decode(m,force=false) {
    const e=m.getFlag?.(ID,'sealed');if(!e||!this.keys?.bundle)return null;
    const tag=e.signature;
    if(!force&&this.cache.get(m.id)===tag)return this.decoded.get(m.id)||null;
    this.cache.set(m.id,tag);
    const author=typeof m.author==='object'?m.author:game.users.get(m.user?.id||m.user);
    try {
      const payload=await this.keys.open(e,author);
      if(!payload||payload.schema!==SCHEMA||!['request','packet','vault'].includes(payload.kind)||!payload.data||typeof payload.data!=='object'){this.decoded.delete(m.id);return null;}
      if(payload.kind==='request'&&(typeof payload.data.action!=='string'||!payload.data.data||typeof payload.data.data!=='object'))return null;
      if(payload.kind==='packet'&&!Array.isArray(payload.actorIds))return null;
      if(payload.kind!=='request'&&!author?.isGM){this.decoded.delete(m.id);return null;}
      const record={message:m,id:m.id,timestamp:m.timestamp,author,payload};this.decoded.set(m.id,record);return record;
    } catch(error) { this.decoded.delete(m.id);console.warn('ONI | Cannot decrypt or verify record',m.id,error.message);return null; }
  }
  async onMessage(m,force=false) {
    const r=await this.decode(m,force);if(!r)return;
    if(r.payload.kind==='request'){
      this.schedule();
      if(game.user.isGM&&!r.author.isGM&&!force&&!game.settings.get(ID,'dnd'))this.ui?.notify?.(r);
    }
    else if(r.payload.kind==='packet'&&!force&&!this.notified.has(r.payload.eventId)) {
      this.notified.add(r.payload.eventId);
      const mine=r.payload.actorIds?.some(id=>owns(game.actors.get(id),game.user))||r.payload.data.recipientUserId===game.user.id;
      if(!game.user.isGM&&mine&&r.payload.data.incoming!==false){
        if(!game.settings.get(ID,'dnd'))this.ui?.notify?.(r);
      }
    }
    this.refresh();
  }
  async post(kind,data,userIds,{eventId=uid(),actorIds=[]}={}) {
    const ids=unique(userIds),users=ids.map(id=>game.users.get(id)).filter(Boolean);
    const payload={schema:SCHEMA,kind,data,eventId,actorIds,createdAt:Date.now()};
    const sealed=await this.keys.seal(payload,users);
    const doc=await ChatMessage.implementation.create({user:game.user.id,speaker:{alias:'ONI'},content,whisper:ids,blind:kind==='vault',flags:{[ID]:{sealed}}});
    if(!doc)throw new Error('Foundry did not save the private ONI record.');
    await this.decode(doc);return doc;
  }
  async request(action,data={}) {
    if(!this.ready)throw new Error(this.lastError||'ONI endpoint is not ready.');
    if(!this.gms.length)throw new Error('A GM must open ONI once before private transmissions can be queued.');
    const doc=await this.post('request',{action,data},unique([game.user.id,...this.gms.map(u=>u.id)]));
    this.schedule();return doc.id;
  }
  async saveState(state) {
    if(!this.isAuthority)throw new Error('The active ONI GM must process this change.');
    state.revision++;const id=game.settings.get(ID,'vaultId');
    if(id){
      const doc=game.messages.get(id);if(!doc)throw new Error('The ONI vault was deleted. Restore the world backup or import your ONI world export.');
      const payload={schema:SCHEMA,kind:'vault',data:state,eventId:id,actorIds:[],createdAt:Date.now()};
      const sealed=await this.keys.seal(payload,this.gms);
      // Exact envelope replacement; no partial merge retaining obsolete encrypted keys.
      await doc.update({content,flags:{[ID]:{sealed}},user:game.user.id,whisper:this.gms.map(u=>u.id),blind:true},{diff:false,recursive:false});
      await this.decode(doc,true);
    } else {
      const doc=await this.post('vault',state,this.gms.map(u=>u.id));await game.settings.set(ID,'vaultId',doc.id);
    }
  }
  schedule() {
    if(!this.ready||!this.isAuthority)return this.chain;
    this.chain=this.chain.then(()=>this.drain()).catch(e=>this.error(e));return this.chain;
  }
  async drain() {
    if(!this.isAuthority)return;
    let state=this.state;
    const vault=game.messages.get(game.settings.get(ID,'vaultId'));
    if(vault&&this.gms.some(u=>vault.getFlag(ID,'sealed')?.keys?.[u.id]?.kid!==u.getFlag(ID,'publicKey')?.kid))await this.saveState(state);
    const requests=[...this.decoded.values()].filter(r=>r.payload.kind==='request'&&!state.processed[r.id]).sort((a,b)=>a.timestamp-b.timestamp||a.id.localeCompare(b.id));
    for(const r of requests){
      if(!this.isAuthority)return;
      state=this.state;
      try { await this.apply(state,r);state.processed[r.id]={status:'accepted',at:Date.now()}; }
      catch(e) { state=this.state;state.processed[r.id]={status:'rejected',at:Date.now()};
        this.enqueue(state,[],{type:'receipt',title:'Transmission rejected',body:e.message,recipientUserId:r.author.id,incoming:true},[r.author.id]);
      }
      await this.saveState(state);
      await this.reconcileImplants();
    }
    state=this.state;
    let changed=false;
    for(const c of state.calls){
      if(c.status==='ringing'&&Date.now()>=c.expiresAt){c.status='missed';c.updatedAt=Date.now();
        state.outbox=state.outbox.filter(o=>o.data?.call?.id!==c.id);this.callEvent(state,c,'Missed call');changed=true;}
    }
    if(changed)await this.saveState(state);
    await this.reconcileImplants();
    await this.flush();this.refresh();
  }
  async reconcileImplants() {
    const state=this.state;let changed=false;
    for(const [actorId,ep] of Object.entries(state.actors)){
      if(!ep.shutdownItems?.length)continue;const actor=game.actors.get(actorId);if(!actor)continue;
      const ids=ep.shutdownItems.filter(id=>actor.items.get(id)),updates=ids.filter(id=>Boolean(actor.items.get(id).system.active)!==Boolean(ep.enabled)).map(_id=>({_id,'system.active':Boolean(ep.enabled)}));
      if(updates.length)await actor.updateEmbeddedDocuments('Item',updates);
      if(ep.enabled){ep.shutdownItems=[];changed=true;}
    }
    if(changed)await this.saveState(state);
  }
  enqueue(state,actorIds,data,userIds=null,deliverAt=0) {
    const sequenced=()=>({...clone(data),sequence:state.eventSequence=(state.eventSequence||0)+1});
    if(userIds){state.outbox.push({id:uid(),actorIds:[],userIds:unique(userIds),data:sequenced(),deliverAt});return;}
    for(const actorId of unique(actorIds))state.outbox.push({id:uid(),actorIds:[actorId],data:sequenced(),deliverAt});
  }
  snapshot(state,actorId) {
    const ep=endpoint(state,actorId);
    const granted=state.contacts.filter(c=>c.grants.includes(actorId));
    const contacts=ep.enabled&&!ep.jammed?granted.map(projectContact):this.directory(actorId).contacts.filter(c=>granted.some(g=>g.id===c.id));
    this.enqueue(state,[actorId],{type:'directory',actorId,contacts,
      endpoint:{enabled:ep.enabled,jammed:ep.jammed,clearance:ep.clearance,trace:ep.trace,masked:ep.masked,access:ep.access||{}},incoming:false});
  }
  snapshots(state) { for(const a of this.actors.filter(a=>a.type==='character'&&owners(a,this.users).length))this.snapshot(state,a.id); }
  async flush() {
    let state=this.state;
    for(const job of [...state.outbox]){
      if(!this.isAuthority)return;
      if(job.deliverAt>Date.now())continue;
      const knownCallEnd=job.data.type==='call'&&TERMINAL.has(job.data.call?.status)&&job.actorIds.every(id=>this.calls(id).some(c=>c.id===job.data.call.id));
      if(job.data.type!=='directory'&&!knownCallEnd&&job.actorIds.some(id=>!canReceive(state,id)))continue;
      const already=[...this.decoded.values()].some(r=>r.payload.kind==='packet'&&r.payload.eventId===job.id);
      if(!already){
        const ids=unique([...(job.userIds||job.actorIds.flatMap(id=>owners(game.actors.get(id),this.users))),...this.gms.map(u=>u.id)]);
        // An actor with no player owner remains queued, rather than becoming a GM-only delivery.
        if(!job.userIds&&!ids.some(id=>!game.users.get(id)?.isGM))continue;
        if(ids.some(id=>!game.users.get(id)?.getFlag(ID,'publicKey')?.kid))continue;
        try { await this.post('packet',job.data,ids,{eventId:job.id,actorIds:job.actorIds}); }
        catch(e){console.warn('ONI | Outbox retained for retry',job.id,e.message);continue;}
      }
      state=this.state;state.outbox=state.outbox.filter(o=>o.id!==job.id);await this.saveState(state);
    }
  }
  actorFor(data,user) {
    const actor=game.actors.get(data.actorId);if(!owns(actor,user))throw new Error('You do not own that ONI endpoint.');return actor;
  }
  checkOnline(state,actor) {
    const ep=assertOnline(state,actor.id);
    if(game.settings.get(ID,'requireImplant')&&!hasImplant(actor))throw new Error('This sleeve needs an active ONI Implant (AUG011).');return ep;
  }
  async apply(state,record) {
    const {action,data}=record.payload.data,user=record.author,rid=record.id;
    if(!data||typeof data!=='object')throw new Error('Malformed request.');
    const gmOnly=new Set(['contact-save','evidence-save','remove','import-cold','sync-roster','dispatch','resolve','configure','cancel-job','gm-call']);
    if(gmOnly.has(action)&&!user.isGM)throw new Error('Only a GM can perform that action.');
    if(action==='sync'){this.actorFor(data,user);this.snapshot(state,data.actorId);return;}
    if(action==='power'){
      const actor=this.actorFor(data,user),ep=endpoint(state,actor.id);ep.enabled=data.enabled===true;
      if(!ep.enabled)ep.shutdownItems=unique([...(ep.shutdownItems||[]),...oniItems(actor).filter(i=>i.system.active!==false).map(i=>i.id)]);
      state.actors[actor.id]=ep;this.snapshot(state,actor.id);
      if(!ep.enabled)for(const c of state.calls.filter(c=>c.actors.includes(actor.id)&&!TERMINAL.has(c.status))){c.status='ended';c.updatedAt=Date.now();this.callEvent(state,c,'Signal disconnected');}
      return;
    }
    if(action==='send'){
      const actor=this.actorFor(data,user),ep=this.checkOnline(state,actor);
      const c=state.contacts.find(c=>c.id===data.contactId);if(!allowedContact(c,actor.id,user))throw new Error('That channel has not been released to this PC.');
      if(!['online','busy'].includes(c.availability))throw new Error(`${c.name}: channel ${c.availability}.`);
      if(ep.clearance<c.clearance&&Number(ep.access?.[c.id]||0)<c.clearance)throw new Error('This channel requires authorization. Request network access first.');
      const mode=['message','audio-call','video-call','service'].includes(data.mode)?data.mode:'message';
      const outgoing={type:'message',title:text(data.title,160)||'Transmission',body:text(data.body),media:cleanMedia(data.media),
        from:{id:`pc:${actor.id}`,name:actor.name,portrait:safeActorImage(actor)},to:projectContact(c),mode,incoming:false};
      if(!outgoing.body&&!outgoing.media.path&&!mode.includes('call'))throw new Error('Add a message or attachment.');
      if(c.type==='pc'){
        if(!game.actors.get(c.actorId))throw new Error('That PC endpoint no longer exists. Ask the GM to sync the roster.');
        if(mode.includes('call')){this.createCall(state,{from:outgoing.from,to:projectContact(c),actors:[actor.id,c.actorId],receiverActors:[c.actorId],mode});}
        else{this.enqueue(state,[c.actorId],{...outgoing,incoming:true});this.enqueue(state,[actor.id],outgoing);}
      } else {
        state.pending.push({id:rid,kind:'contact',actorId:actor.id,userId:user.id,contactId:c.id,mode,title:outgoing.title,body:outgoing.body,media:outgoing.media,createdAt:Date.now()});
        this.enqueue(state,[actor.id],{...outgoing,title:mode.includes('call')?'Call requested':outgoing.title,status:'Awaiting response',incoming:false});
      }
      return;
    }
    if(action==='operation'){
      const actor=this.actorFor(data,user);this.checkOnline(state,actor);
      if(!OPS[data.op])throw new Error('Unknown operation.');
      if(data.op==='analyze'){
        if(!this.actorEvidence(actor.id).some(e=>e.id===data.evidenceId)&&!user.isGM)throw new Error('That evidence has not been delivered to this endpoint.');
      } else if(data.contactId){const c=state.contacts.find(c=>c.id===data.contactId);if(!allowedContact(c,actor.id,user))throw new Error('Unknown channel.');}
      state.pending.push({id:rid,kind:'operation',actorId:actor.id,userId:user.id,contactId:text(data.contactId,100),evidenceId:text(data.evidenceId,100),op:data.op,body:text(data.body),createdAt:Date.now()});
      this.enqueue(state,[actor.id],{type:'receipt',title:`${OPS[data.op].name} requested`,body:'Awaiting GM adjudication.',incoming:false});return;
    }
    if(action==='forward'){
      const actor=this.actorFor(data,user);this.checkOnline(state,actor);
      const e=this.actorEvidence(actor.id).find(e=>e.id===data.evidenceId);if(!e)throw new Error('You do not have this evidence.');
      const c=state.contacts.find(c=>c.id===data.contactId);if(!allowedContact(c,actor.id,user)||c.type!=='pc')throw new Error('Choose a released PC channel.');
      this.enqueue(state,[c.actorId],{type:'evidence',title:e.title,body:'Forwarded evidence',evidence:clone(e),from:{name:actor.name,id:`pc:${actor.id}`,portrait:safeActorImage(actor)},incoming:true});
      this.enqueue(state,[actor.id],{type:'receipt',title:'Evidence forwarded',body:`${e.title} → ${c.name}`,incoming:false});return;
    }
    if(action==='call-action'||action==='call-line'||action==='feed'){
      const actor=this.actorFor(data,user);this.checkOnline(state,actor);
      const c=state.calls.find(c=>c.id===data.callId);if(!c||!c.actors.includes(actor.id))throw new Error('You are not a participant in that call.');
      if(action==='call-action'){c.status=validTransition(c,data.action,actor.id);c.updatedAt=Date.now();this.callEvent(state,c,`Call ${c.status}`);return;}
      if(c.status!=='connected')throw new Error('Connect the call before transmitting.');
      if(action==='feed'){
        const media=cleanMedia(data.media);if(!media.path)throw new Error('Choose a visual feed file.');
        this.enqueue(state,c.actors,{type:'feed',callId:c.id,title:`Shared sight · ${actor.name}`,body:text(data.body),media,from:{name:actor.name,id:`pc:${actor.id}`,portrait:safeActorImage(actor)},incoming:true});
      }else{const body=text(data.body);if(!body.trim())throw new Error('Enter a call message.');this.enqueue(state,c.actors,{type:'call-line',callId:c.id,title:actor.name,body,from:{name:actor.name,id:`pc:${actor.id}`,portrait:safeActorImage(actor)},incoming:true});}
      return;
    }
    if(action==='contact-save'){
      const previous=state.contacts.find(c=>c.id===data.id);
      const c=contactRecord({...previous,...data,sourceId:previous?.sourceId||data.sourceId},data.id||uid());this.upsert(state.contacts,c);this.snapshots(state);return;
    }
    if(action==='evidence-save'){const previous=state.evidence.find(e=>e.id===data.id);const e=evidenceRecord({...previous,...data,sourceId:previous?.sourceId||data.sourceId,media:data.media||{}},data.id||uid());this.upsert(state.evidence,e);return;}
    if(action==='remove'){
      const list=data.type==='evidence'?'evidence':'contacts';state[list]=state[list].filter(c=>c.id!==data.id);
      if(list==='contacts')this.snapshots(state);return;
    }
    if(action==='sync-roster'){
      const pcs=this.actors.filter(a=>a.type==='character'&&owners(a,this.users).length);
      state.contacts=state.contacts.filter(c=>!c.id.startsWith('pc:'));
      for(const a of pcs)this.upsert(state.contacts,contactRecord({name:a.name,type:'pc',role:'Team ONI',portrait:safeActorImage(a),address:`DHF / ${a.name}`,actorId:a.id,availability:'online',grants:pcs.filter(p=>p.id!==a.id).map(p=>p.id)},`pc:${a.id}`));
      this.snapshots(state);return;
    }
    if(action==='import-cold'){await this.importCold(state);this.snapshots(state);return;}
    if(action==='dispatch'){
      if(!unique(data.actorIds).length)throw new Error('Choose at least one recipient PC.');
      for(const id of data.actorIds)if(!game.actors.get(id))throw new Error('A selected PC no longer exists.');
      const from=state.contacts.find(c=>c.id===data.contactId);if(!from)throw new Error('Choose a caller / sender from the directory.');
      // Sender's public card becomes available to the recipients, without revealing private notes.
      from.grants=unique([...from.grants,...data.actorIds]);for(const id of data.actorIds)this.snapshot(state,id);
      const mode=['audio-call','video-call','message','feed'].includes(data.mode)?data.mode:'message';
      if(mode.includes('call')){if(Number(data.deliverAt)>Date.now())throw new Error('Place calls immediately; delayed delivery applies to messages and files.');this.createCall(state,{from:projectContact(from),to:{name:'Selected endpoints'},actors:unique(data.actorIds),receiverActors:unique(data.actorIds),mode});return;}
      const e=state.evidence.find(e=>e.id===data.evidenceId);
      const packet={type:e?'evidence':mode==='feed'?'feed':'message',title:text(data.title,160)||e?.title||'Incoming transmission',body:text(data.body),media:cleanMedia(data.media),from:projectContact(from),incoming:true};
      if(e)packet.evidence=projectEvidence(e,text(data.verdict,180)||'Unverified');
      if(!packet.body&&!packet.media.path&&!e)throw new Error('Add a message, evidence or media.');
      this.enqueue(state,unique(data.actorIds),packet,null,Math.max(0,Number(data.deliverAt)||0));return;
    }
    if(action==='configure'){
      const actor=game.actors.get(data.actorId);if(!actor)throw new Error('Choose a PC endpoint.');
      state.actors[actor.id]={...endpoint(state,actor.id),jammed:data.jammed===true,clearance:int(data.clearance,0,5),trace:int(data.trace),masked:data.masked===true};
      this.snapshot(state,actor.id);return;
    }
    if(action==='gm-call'){
      const c=state.calls.find(c=>c.id===data.callId);if(!c)throw new Error('Call not found.');
      if(data.action){c.status=validTransition(c,data.action,'',true);c.updatedAt=Date.now();this.callEvent(state,c,`Call ${c.status}`);return;}
      if(c.status!=='connected')throw new Error('Connect the call first.');
      const speaker=state.contacts.find(x=>x.id===data.contactId);if(!speaker)throw new Error('Choose a speaking identity.');
      const media=cleanMedia(data.media);if(!text(data.body).trim()&&!media.path)throw new Error('Enter dialogue or choose a visual feed.');
      this.enqueue(state,c.actors,{type:media.path?'feed':'call-line',callId:c.id,title:media.path?`Shared sight · ${speaker.name}`:speaker.name,body:text(data.body),media,from:projectContact(speaker),incoming:true});return;
    }
    if(action==='cancel-job'){state.outbox=state.outbox.filter(o=>o.id!==data.id);return;}
    if(action==='resolve'){await this.resolve(state,data);return;}
    throw new Error('Unsupported ONI action.');
  }
  upsert(list,record) { const i=list.findIndex(c=>c.id===record.id);if(i<0)list.push(record);else list[i]=record; }
  createCall(state,{from,to,actors,receiverActors,mode}) {
    if(actors.some(id=>state.calls.some(c=>c.actors.includes(id)&&!TERMINAL.has(c.status))))throw new Error('One endpoint is already in a call. End that call first.');
    const call={id:uid(),from,to,actors:unique(actors),receiverActors:unique(receiverActors),mode,status:'ringing',
      startedAt:Date.now(),expiresAt:Date.now()+int(game.settings.get(ID,'ringSeconds'),15,180)*1000,updatedAt:Date.now()};
    state.calls.push(call);this.callEvent(state,call,'Incoming call');return call;
  }
  callEvent(state,call,title) {
    const c={id:call.id,from:call.from,to:call.to,actors:call.actors,receiverActors:call.receiverActors,mode:call.mode,status:call.status,startedAt:call.startedAt,expiresAt:call.expiresAt,updatedAt:call.updatedAt};
    for(const actorId of call.actors){const outgoing=call.status==='ringing'&&!call.receiverActors.includes(actorId);
      this.enqueue(state,[actorId],{type:'call',title:outgoing?`Calling ${call.to.name}`:title,body:'',call:c,from:outgoing?call.to:call.from,incoming:!outgoing});
    }
  }
  async resolve(state,data) {
    const p=state.pending.find(p=>p.id===data.requestId);if(!p)throw new Error('That request is already resolved.');
    const actor=game.actors.get(p.actorId);if(!actor)throw new Error('The requesting PC no longer exists.');
    const c=state.contacts.find(c=>c.id===p.contactId),method=data.method;
    if(method==='roll'){
      if(p.kind!=='operation')throw new Error('This request is a contact conversation.');
      if(p.rolled)throw new Error('This operation already has a roll. Resolve it or deny it; a new attempt needs a new request.');
      this.checkOnline(state,actor);
      const result=await operationRoll(actor,p.op,{difficulty:int(data.difficulty??c?.difficulty,0,5),requestId:p.id});
      if(result.blocked)throw new Error(result.reason||'Skill check blocked.');
      p.rolled={success:result.success,successDegrees:result.successDegrees,failureDegrees:result.failureDegrees,ace:result.ace,catastrophe:result.catastrophe,tr:result.tr,best:result.best,chatMessageId:result.chatMessageId,...(result.depletion?{depletion:result.depletion}:{}),...(result.depletionError?{depletionError:result.depletionError}:{})};
      this.enqueue(state,[p.actorId],{type:'check',title:OPS[p.op].name,body:result.success?'Check succeeded. Awaiting the channel result.':'Check failed. Awaiting GM consequences.',check:p.rolled,incoming:true});
      const ep=endpoint(state,actor.id);
      if(p.op==='mask')ep.masked=result.success===true;
      if(p.op==='hack'&&result.success&&c)ep.access={...ep.access,[c.id]:c.clearance};
      if(game.settings.get(ID,'traceClock')&&!result.success&&['hack','trace','mask'].includes(p.op)){
        ep.trace=Math.min(6,ep.trace+1);if(ep.trace===6)ui.notifications.warn(`ONI trace clock full: ${actor.name}. Adjudicate interception or identity exposure.`);
      }
      state.actors[actor.id]=ep;this.snapshot(state,actor.id);return;
    }
    if(method==='deny'){
      this.enqueue(state,[p.actorId],{type:'receipt',title:'Channel response',body:text(data.body)||'Request declined.',from:c?projectContact(c):{name:'ONI'},incoming:true});
    }else if(method==='connect'){
      if(!c||!p.mode?.includes('call'))throw new Error('Choose a call request to connect.');
      const call=this.createCall(state,{from:projectContact(c),to:{name:actor.name},actors:[actor.id],receiverActors:[actor.id],mode:p.mode});
      // NPC answering an outgoing PC call connects immediately; inbound GM calls still ring.
      call.status='connected';call.updatedAt=Date.now();state.outbox=state.outbox.filter(o=>o.data?.call?.id!==call.id);this.callEvent(state,call,'Call connected');
    }else if(method==='reply'){
      if(p.kind==='operation'&&!p.rolled&&!data.manual)throw new Error('Roll this operation first, or choose a manual GM ruling.');
      const e=state.evidence.find(e=>e.id===data.evidenceId);
      const packet={type:e?'evidence':'message',title:text(data.title,160)||'Channel response',body:text(data.body),from:c?projectContact(c):{name:'ONI / analysis'},media:cleanMedia(data.media),incoming:true};
      if(e)packet.evidence=projectEvidence(e,text(data.verdict,180)||'Unverified');
      if(!packet.body&&!e&&!packet.media.path)throw new Error('Write a response or attach evidence.');this.enqueue(state,[actor.id],packet);
    }else throw new Error('Choose reply, connect, roll or deny.');
    state.pending=state.pending.filter(r=>r.id!==p.id);
  }
  async importCold(state) {
    const [contacts,factions,benefactors,journals]=await Promise.all(['contacts','factions','benefactors','journals'].map(sourceJSON));
    // Public cover roles are authored explicitly; source presentFunction can contain spoilers.
    const roles=['Clinical consultant','Protectorate captain','Private financier','Resleeving specialist','Mutual-aid coordinator','Community organiser','Identity-services broker','Archive custodian','Continuity prosecutor','Recovery agent','Relay engineer','Data architect','Private investor','Bay City detective','Psychosurgeon','Information broker','Extraction consultant','Virtuality artist','Religious adviser','Continuity advocate'];
    for(const [i,c] of contacts.entries()){
      const id=`cold:${c.id}`;if(state.contacts.some(x=>x.id===id))continue;
      const linked=this.actors.find(a=>a.getFlag?.('cold-storage','sourceId')===c.id);
      this.upsert(state.contacts,contactRecord({name:c.currentIdentity,type:'contact',role:roles[i]||'Contact',portrait:safeActorImage(linked),faction:c.faction||'',address:`ONI / ${c.currentIdentity}`,description:'A private contact channel. Availability and response are controlled by your GM.',
        gmNotes:`Historical identity: ${c.historicalIdentity}\nActual role: ${c.presentFunction}\nAllegiance: ${c.alignment}\nAgenda: ${c.agenda}\nRecognition: ${(c.recognitionClues||[]).join('\n')}`,sourceId:c.id,grants:[]},id));
    }
    for(const f of factions){const id=`cold:${f.id}`;if(!state.contacts.some(c=>c.id===id))this.upsert(state.contacts,contactRecord({name:f.name,type:'faction',role:'Faction liaison',description:f.public,address:`ONI / ${f.name}`,gmNotes:`${f.secret}\nGoal: ${f.goal}`,sourceId:f.id,grants:[]},id));}
    for(const b of benefactors){const id=`cold:${b.id}`;if(!state.contacts.some(c=>c.id===id))this.upsert(state.contacts,contactRecord({name:b.name,type:'benefactor',role:b.portfolio,description:b.portfolio,address:`ONI / ${b.name}`,gmNotes:`Root: ${b.root}\nOrigin: ${b.origin}\nAgenda: ${b.agenda}`,sourceId:b.id,grants:[]},id));}
    for(const j of journals.filter(j=>j.category==='handout'&&/^H\d\d$/.test(j.id))){const id=`cold:${j.id}`;
      if(!state.evidence.some(e=>e.id===id))this.upsert(state.evidence,evidenceRecord({title:j.title,body:plainHandout(j.body),source:'Cold Storage / recovered record',truth:'unknown',gmNotes:'Imported handout. Review and release only at the appropriate scene.',sourceId:j.id,media:{}},id));
    }
    const services=[['city','Bay City Civic Index','Public notices, maps and service directory'],['relay','Sable Needle Relay Desk','Transit and relay service enquiries'],['clinical','Continuity Clinical Desk','Appointments and continuity-care enquiries'],['archive','Quiet Archive Catalogue','Permission-based testimony and record enquiries'],['escrow','Benefactor Escrow Channel','Requests for support, introductions and contractual terms'],['virtual','Virtuality Gateway','Permission-based invitations to virtual environments']];
    for(const [key,name,description] of services){const id=`service:${key}`;if(!state.contacts.some(c=>c.id===id))this.upsert(state.contacts,contactRecord({name,type:'system',role:'Service endpoint',description,address:`ONI / ${key}`,gmNotes:'ONI module service template, newly authored for this interface; not a claim that this endpoint appears in the adventure. GM adjudicates all responses.',grants:[]},id));}
  }
  directory(actorId) {
    if(!game.user.isGM&&!owns(game.actors.get(actorId),game.user))return {contacts:[],endpoint:{enabled:true,jammed:false,clearance:0,trace:0,masked:false,access:{}}};
    const rows=[...this.decoded.values()].filter(r=>r.payload.kind==='packet'&&r.payload.data.type==='directory'&&r.payload.data.actorId===actorId);
    return rows.sort((a,b)=>(b.payload.data.sequence||0)-(a.payload.data.sequence||0)||b.timestamp-a.timestamp)[0]?.payload.data||{contacts:[],endpoint:{enabled:true,jammed:false,clearance:0,trace:0,masked:false,access:{}}};
  }
  packets(actorId) {
    if(!game.user.isGM&&!owns(game.actors.get(actorId),game.user))return [];
    return [...this.decoded.values()].filter(r=>r.payload.kind==='packet'&&(r.payload.actorIds.includes(actorId)||(r.payload.actorIds.length===0&&r.payload.data.recipientUserId===game.user.id))&&r.payload.data.type!=='directory')
      .sort((a,b)=>b.timestamp-a.timestamp||b.id.localeCompare(a.id));
  }
  actorEvidence(actorId) {
    const result=new Map();for(const r of this.packets(actorId)){const e=r.payload.data.evidence;if(e&&!result.has(e.id))result.set(e.id,e);}return [...result.values()];
  }
  calls(actorId) {
    const result=new Map();for(const r of this.packets(actorId).sort((a,b)=>(b.payload.data.sequence||0)-(a.payload.data.sequence||0))){const c=r.payload.data.call;if(c&&!result.has(c.id))result.set(c.id,c);}return [...result.values()];
  }
  async markRead(id) {
    const read=game.user.getFlag(ID,'readIds')||[];if(!read.includes(id))await game.user.setFlag(ID,'readIds',[id,...read].slice(0,1500));this.refresh();
  }
  unread(actorId) {
    const read=new Set(game.user.getFlag(ID,'readIds')||[]);return this.packets(actorId).filter(r=>r.payload.data.incoming!==false&&!read.has(r.id)).length;
  }
  exportWorld() { return JSON.stringify({module:ID,schema:SCHEMA,exportedAt:new Date().toISOString(),state:this.state,history:[...this.decoded.values()].filter(r=>r.payload.kind==='packet').map(r=>clone(r.payload))},null,2); }
  async restoreWorld(backup) {
    if(!game.user.isGM||!this.keys?.bundle)throw new Error('A registered GM endpoint is required.');
    if(backup.module!==ID||backup.schema!==SCHEMA||!Array.isArray(backup.state?.contacts)||!Array.isArray(backup.state?.evidence))throw new Error('Not an ONI world export.');
    if(backup.state.contacts.length>1000||backup.state.evidence.length>1000||(backup.history?.length||0)>10000)throw new Error('This backup exceeds the ONI import limits.');
    if(this.authority&&this.authority.id!==game.user.id)throw new Error('The active ONI GM must perform the restore.');
    const state=initialState();
    state.contacts=backup.state.contacts.map(c=>contactRecord(c,c.id));state.evidence=backup.state.evidence.map(e=>evidenceRecord(e,e.id));
    state.actors=clone(backup.state.actors||{});state.processed=clone(backup.state.processed||{});state.eventSequence=Number(backup.state.eventSequence)||0;
    state.pending=clone(backup.state.pending||[]);state.outbox=clone(backup.state.outbox||[]);
    // Live calls cannot be reanimated from an old backup. Retain their history as ended.
    state.calls=(backup.state.calls||[]).map(c=>({...clone(c),status:TERMINAL.has(c.status)?c.status:'ended',updatedAt:Date.now()}));
    const existing=new Set([...this.decoded.values()].map(r=>r.payload.eventId));
    for(const p of backup.history||[]){if(p.kind==='packet'&&p.actorIds?.length&&!existing.has(p.eventId)){
      const data=clone(p.data);if(data.call&&!TERMINAL.has(data.call.status)){data.call.status='ended';data.call.updatedAt=Date.now();}
      this.enqueue(state,p.actorIds,data);
    }}
    this.snapshots(state);
    const old=game.settings.get(ID,'vaultId');
    // Recovery also works when the old vault no longer exists or cannot be decrypted.
    await game.settings.set(ID,'vaultId','');
    try{await this.saveState(state);}catch(e){await game.settings.set(ID,'vaultId',old);throw e;}
    if(!this.ready)await this.start();else await this.schedule();this.refresh();
  }
}
export function safeActorImage(a) { try{return cleanMedia({path:a?.img}).path;}catch{return '';} }
export function plainHandout(html) {
  const doc=new DOMParser().parseFromString(String(html||''),'text/html');
  doc.querySelectorAll('script,style,iframe,.secret').forEach(e=>e.remove());
  doc.querySelectorAll('p,h1,h2,h3,h4,li,br').forEach(e=>e.append('\n\n'));
  return (doc.body.textContent||'').replace(/\n\s*\n(?:\s*\n)+/g,'\n\n').trim();
}
