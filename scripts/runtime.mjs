import {ID,SCHEMA,OPS,TERMINAL,clone,text,int,esc,unique,owns,owners,allowedContact,initialState,endpoint,assertOnline,canReceive,validTransition,contactRecord,evidenceRecord,projectContact,projectEvidence,cleanMedia} from './domain.mjs';
import {EndpointKeys} from './crypto.mjs';
import {operationRoll,oniItems,hasImplant,sourceJSON} from './bridge.mjs';
import {DOSSIER_VERSION,SCENE_RELEASES,dossierState,sourceId,buildColdDossiers,dossierForActor,projectAssignedContact,setContactRelease,researchRecord,researchGrant,projectResearch,diagnosticReport} from './dossiers.mjs';
import {ensureGuides} from './guide.mjs';

const uid=()=>foundry.utils.randomID(16);
const content='<p class="ac-oni-envelope">ONI · encrypted transmission</p>';
export function registerSettings() {
  const add=(key,data)=>game.settings.register(ID,key,data);
  add('vaultId',{scope:'world',config:false,type:String,default:''});
  add('autoSetup',{name:'Automatically prepare Cold Storage ONI dossiers',hint:'Prepare all PC contacts, lifetime research and guides after Cold Storage imports. Follow GM relationship reveals and ownership changes without resetting existing ONI releases.',scope:'world',config:true,type:Boolean,default:true});
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
    return dossierState(clone(v.payload.data));
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
      Hooks.on('userConnected',()=>{this.automationDirty=true;this.schedule();});
      Hooks.on('updateUser',()=>{this.automationDirty=true;this.schedule();this.refresh();});
      for(const name of ['Actor','Item']){
        Hooks.on(`create${name}`,(doc,options,userId)=>this.worldChanged(doc,userId));
        Hooks.on(`update${name}`,(doc,changes,options,userId)=>this.worldChanged(doc,userId));
        Hooks.on(`delete${name}`,(doc,options,userId)=>this.worldChanged(doc,userId));
      }
      this.automationDirty=true;
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
  worldChanged(doc,userId) {
    if(!this.isAuthority||!game.settings.get(ID,'autoSetup'))return;
    const actor=doc?.parent?.documentName==='Actor'?doc.parent:doc?.type==='character'?doc:null;
    if(actor&&game.users.get(userId)?.isGM&&doc.type==='relationship')(this.revealActors??=new Set()).add(actor.id);
    this.automationDirty=true;clearTimeout(this.setupTimer);this.setupTimer=setTimeout(()=>this.schedule(),1200);
  }
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
    if(this.automationDirty){
      this.automationDirty=false;const before=JSON.stringify(state);
      const reveals=[...(this.revealActors||[])];this.revealActors?.clear();
      try{await this.maintain(state,{revealActors:reveals});if(JSON.stringify(state)!==before)await this.saveState(state);}
      catch(e){this.lastError=`Automatic preparation: ${e.message}`;console.warn('ONI | Preparation can be retried from Diagnostics',e);}
      state=this.state;
    }
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
    const before=JSON.stringify(state);this.queueResearch(state);if(JSON.stringify(state)!==before)await this.saveState(state);
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
    for(const actorId of unique(actorIds)){
      if(data.type==='directory')state.outbox=state.outbox.filter(o=>!(o.data.type==='directory'&&o.actorIds.includes(actorId)));
      state.outbox.push({id:uid(),actorIds:[actorId],data:sequenced(),deliverAt});
    }
  }
  snapshot(state,actorId) {
    const ep=endpoint(state,actorId);
    const granted=state.contacts.filter(c=>c.grants.includes(actorId));
    const contacts=ep.enabled&&!ep.jammed?granted.map(c=>projectAssignedContact(state,c,actorId)):this.directory(actorId).contacts.filter(c=>granted.some(g=>g.id===c.id));
    this.enqueue(state,[actorId],{type:'directory',actorId,contacts,
      endpoint:{enabled:ep.enabled,jammed:ep.jammed,clearance:ep.clearance,trace:ep.trace,masked:ep.masked,access:ep.access||{}},incoming:false});
    const d=dossierForActor(state,actorId);if(d)d.directorySignature=this.directorySignature(state,actorId);
  }
  snapshots(state) { for(const a of this.actors.filter(a=>a.type==='character'&&owners(a,this.users).length))this.snapshot(state,a.id); }
  async flush() {
    let state=this.state,changed=0;
    for(const job of [...state.outbox]){
      if(!this.isAuthority)return;
      if(job.deliverAt>Date.now())continue;
      let data=job.data,grant;
      if(data.type==='research-ref'){
        grant=state.dossiers[data.dossierId]?.research[data.researchId];const file=state.research.find(r=>r.id===data.researchId);
        if(!grant?.released||!file){state.outbox=state.outbox.filter(o=>o.id!==job.id);changed++;continue;}
        data={type:'research',title:file.title,body:'A file has been added to your personal research archive.',research:projectResearch(file),from:{name:'Personal continuity archive'},sequence:job.data.sequence,incoming:job.data.incoming};
      }
      if(data.type==='evidence-ref'){
        const file=state.evidence.find(e=>e.id===data.evidenceId);
        if(!file){continue;}
        data={type:'evidence',title:file.title,body:'Recovered scene record.',evidence:projectEvidence(file),from:{name:'Cold Storage / recovered record'},sequence:job.data.sequence,incoming:true};
      }
      const knownCallEnd=job.data.type==='call'&&TERMINAL.has(job.data.call?.status)&&job.actorIds.every(id=>this.calls(id).some(c=>c.id===job.data.call.id));
      if(job.data.type!=='directory'&&!knownCallEnd&&job.actorIds.some(id=>!canReceive(state,id)))continue;
      const already=[...this.decoded.values()].some(r=>r.payload.kind==='packet'&&r.payload.eventId===job.id);
      if(!already){
        const ids=unique([...(job.userIds||job.actorIds.flatMap(id=>owners(game.actors.get(id),this.users))),...this.gms.map(u=>u.id)]);
        // An actor with no player owner remains queued, rather than becoming a GM-only delivery.
        if(!job.userIds&&!ids.some(id=>!game.users.get(id)?.isGM))continue;
        if(ids.some(id=>!game.users.get(id)?.getFlag(ID,'publicKey')?.kid))continue;
        try { await this.post('packet',data,ids,{eventId:job.id,actorIds:job.actorIds}); }
        catch(e){
          const current=state.outbox.find(o=>o.id===job.id);if(current&&current.lastError!==e.message){current.lastError=text(e.message,600);changed++;}
          console.warn('ONI | Outbox retained for retry',job.id,e.message);continue;
        }
      }
      if(grant&&state.dossiers[job.data.dossierId]?.research[job.data.researchId])state.dossiers[job.data.dossierId].research[job.data.researchId].delivery=job.data.signature;
      if(job.data.type==='evidence-ref'&&state.dossiers[job.data.dossierId])state.dossiers[job.data.dossierId].evidenceDelivery[job.data.evidenceId]=job.data.signature;
      state.outbox=state.outbox.filter(o=>o.id!==job.id);changed++;
      // Event IDs make crash retries safe; checkpoint batches avoid resealing the
      // entire lifetime archive for every small reference-library delivery.
      if(changed>=12){await this.saveState(state);changed=0;}
    }
    if(changed)await this.saveState(state);
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
    const gmOnly=new Set(['contact-save','evidence-save','remove','import-cold','sync-roster','dispatch','resolve','configure','cancel-job','gm-call','contact-release','research-release','research-save','release-lifetimes','scene-release','bind-actor','repair']);
    if(gmOnly.has(action)&&!user.isGM)throw new Error('Only a GM can perform that action.');
    if(action==='sync'){this.actorFor(data,user);this.snapshot(state,data.actorId);this.queueResearch(state);return;}
    if(action==='research-note'){
      const actor=this.actorFor(data,user),d=this.ensureActorDossier(state,actor);
      let body=text(data.body,24000),title=text(data.title,160),source='Personal ONI note';
      if(data.packetId){
        const packet=this.packets(actor.id).find(p=>p.id===data.packetId);if(!packet)throw new Error('That transmission is not available to this PC.');
        const p=packet.payload.data;body=[p.body,p.evidence?.body,p.research?.body].filter(Boolean).join('\n\n');title=p.title;source=`Saved transmission / ${p.from?.name||'ONI'}`;
      }
      if(!body.trim())throw new Error('Write a note or save a transmission with text.');
      const id=`note:${rid}`;this.upsert(state.research,researchRecord({title:title||'Personal research note',body,source,pcId:d.id,category:'Personal notes',status:'personal'},id));
      researchGrant(d,id).released=true;this.queueResearch(state);return;
    }
    if(action==='bind-actor'){
      const d=state.dossiers[data.dossierId],actor=game.actors.get(data.bindActorId);if(!d||actor?.type!=='character')throw new Error('Choose a prepared PC and a character actor.');
      if(Object.values(state.dossiers).some(p=>p.id!==d.id&&p.actorId===actor.id))throw new Error('That actor is already bound to another dossier.');
      const old=d.actorId;d.actorId=actor.id;d.manualBinding=true;this.migrateBinding(state,d,old);this.syncDossiers(state);this.snapshots(state);this.queueResearch(state);return;
    }
    if(action==='contact-release'){
      const d=state.dossiers[data.dossierId];if(!d)throw new Error('Choose a PC dossier.');
      setContactRelease(state,d,data.contactId,data.mode);if(d.actorId)this.snapshot(state,d.actorId);this.queueResearch(state,{notify:true});return;
    }
    if(action==='research-release'||action==='release-lifetimes'){
      const d=state.dossiers[data.dossierId];if(!d)throw new Error('Choose a PC dossier.');
      const ids=action==='release-lifetimes'?state.research.filter(r=>r.pcId===d.id&&['Past life','Historical contacts'].includes(r.category)).map(r=>r.id):[data.researchId];
      for(const id of ids){if(!state.research.some(r=>r.id===id)||!d.research[id])throw new Error('That file is not assigned to this PC.');d.research[id].released=true;delete d.research[id].deliverySuppressed;}
      this.queueResearch(state,{notify:true});return;
    }
    if(action==='research-save'){
      const previous=state.research.find(r=>r.id===data.id),id=data.id||uid();
      const file=researchRecord({...previous,...data,sourceId:previous?.sourceId||data.sourceId,pcId:previous?.pcId||'',revision:(previous?.revision||0)+1},id);
      this.upsert(state.research,file);
      for(const dossierId of unique(data.dossierIds)){const d=state.dossiers[dossierId];if(!d)throw new Error('Choose valid PC dossiers.');researchGrant(d,id).released=data.release===true||d.research[id].released;}
      this.queueResearch(state,{notify:true});return;
    }
    if(action==='scene-release'){
      const scene=SCENE_RELEASES.find(s=>s.id===data.sceneId);if(!scene)throw new Error('Choose a scene bundle.');
      if(!unique(data.dossierIds).length)throw new Error('Choose at least one PC dossier.');
      for(const id of unique(data.dossierIds)){
        const d=state.dossiers[id];if(!d)throw new Error('Choose valid PC dossiers.');if(d.sceneReleases.includes(scene.id))continue;
        for(const cid of scene.contacts)setContactRelease(state,d,`cold:${cid}`,'release');
        // Unbound PCs retain a small evidence intent until their actor is imported.
        d.pendingEvidence??=[];d.pendingEvidence=unique([...d.pendingEvidence,...scene.evidence.map(id=>`cold:${id}`)]);
        d.sceneReleases.push(scene.id);
      }
      this.syncDossiers(state);this.snapshots(state);this.queueResearch(state);return;
    }
    if(action==='repair'){await this.maintain(state,{force:true});this.lastError='';this.snapshots(state);this.queueResearch(state);return;}
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
      const c=contactRecord({...previous,...data,sourceId:previous?.sourceId||data.sourceId},data.id||uid());this.upsert(state.contacts,c);
      for(const d of Object.values(state.dossiers)){if(!d.actorId)continue;d.contacts[c.id]??={historicalNames:[],categories:[],sleeves:[],identity:false};const a=d.contacts[c.id];a.current=c.grants.includes(d.actorId);if(!a.current)a.identity=false;if(c.type==='pc'&&!a.current)d.blockedPeers=unique([...d.blockedPeers,c.id]);else d.blockedPeers=d.blockedPeers.filter(id=>id!==c.id);}
      this.snapshots(state);return;
    }
    if(action==='evidence-save'){const previous=state.evidence.find(e=>e.id===data.id);const e=evidenceRecord({...previous,...data,sourceId:previous?.sourceId||data.sourceId,media:data.media||{}},data.id||uid());this.upsert(state.evidence,e);return;}
    if(action==='remove'){
      const list=data.type==='evidence'?'evidence':'contacts';state[list]=state[list].filter(c=>c.id!==data.id);
      if(list==='contacts')this.snapshots(state);return;
    }
    if(action==='sync-roster'){
      this.syncDossiers(state);this.snapshots(state);this.queueResearch(state);return;
    }
    if(action==='import-cold'){await this.importCold(state);state.guides={...state.guides,...await ensureGuides()};this.snapshots(state);this.queueResearch(state);return;}
    if(action==='dispatch'){
      if(!unique(data.actorIds).length)throw new Error('Choose at least one recipient PC.');
      for(const id of data.actorIds)if(!game.actors.get(id))throw new Error('A selected PC no longer exists.');
      const from=state.contacts.find(c=>c.id===data.contactId);if(!from)throw new Error('Choose a caller / sender from the directory.');
      // Sender's public card becomes available to the recipients, without revealing private notes.
      from.grants=unique([...from.grants,...data.actorIds]);for(const id of data.actorIds)this.snapshot(state,id);
      for(const actorId of data.actorIds){const d=dossierForActor(state,actorId);if(d)setContactRelease(state,d,from.id,'release');}
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
    if(action==='cancel-job'){
      const job=state.outbox.find(o=>o.id===data.id),d=state.dossiers[job?.data.dossierId];
      if(d&&job.data.type==='research-ref')d.research[job.data.researchId].deliverySuppressed=job.data.signature;
      if(d&&job.data.type==='evidence-ref')(d.evidenceSuppressed??={})[job.data.evidenceId]=job.data.signature;
      state.outbox=state.outbox.filter(o=>o.id!==data.id);return;
    }
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
  async importCold(state,{load=sourceJSON,plain=plainHandout}={}) {
    const names=['contacts','factions','benefactors','journals','pregens','previous-sleeves','relationships'];
    const lists=await Promise.all(names.map(load)),data=Object.fromEntries(names.map((n,i)=>[n,lists[i]]));
    const {contacts,factions,benefactors,journals}=data;
    for(const name of names)if(!Array.isArray(data[name]))throw new Error(`Cold Storage ${name} is not a list.`);
    // Public cover roles are authored explicitly; source presentFunction can contain spoilers.
    const roles=['Clinical consultant','Protectorate captain','Private financier','Resleeving specialist','Mutual-aid coordinator','Community organiser','Identity-services broker','Archive custodian','Continuity prosecutor','Recovery agent','Relay engineer','Data architect','Private investor','Bay City detective','Psychosurgeon','Information broker','Extraction consultant','Virtuality artist','Religious adviser','Continuity advocate'];
    for(const c of contacts){
      const id=`cold:${c.id}`;if(state.contacts.some(x=>x.id===id))continue;
      const linked=this.actors.find(a=>a.getFlag?.('cold-storage','sourceId')===c.id);
      this.upsert(state.contacts,contactRecord({name:c.currentIdentity,type:'contact',role:roles[Number(c.id.slice(1))-1]||'Contact',portrait:safeActorImage(linked),faction:c.faction||'',address:`ONI / ${c.currentIdentity}`,description:'A private contact channel. Availability and response are controlled by your GM.',
        gmNotes:`Historical identity: ${c.historicalIdentity}\nActual role: ${c.presentFunction}\nAllegiance: ${c.alignment}\nAgenda: ${c.agenda}\nRecognition: ${(c.recognitionClues||[]).join('\n')}`,sourceId:c.id,grants:[]},id));
    }
    for(const f of factions){const id=`cold:${f.id}`;if(!state.contacts.some(c=>c.id===id))this.upsert(state.contacts,contactRecord({name:f.name,type:'faction',role:'Faction liaison',description:f.public,address:`ONI / ${f.name}`,gmNotes:`${f.secret}\nGoal: ${f.goal}`,sourceId:f.id,grants:[]},id));}
    for(const b of benefactors){const id=`cold:${b.id}`;if(!state.contacts.some(c=>c.id===id))this.upsert(state.contacts,contactRecord({name:b.name,type:'benefactor',role:b.portfolio,description:b.portfolio,address:`ONI / ${b.name}`,gmNotes:`Root: ${b.root}\nOrigin: ${b.origin}\nAgenda: ${b.agenda}`,sourceId:b.id,grants:[]},id));}
    for(const j of journals.filter(j=>j.category==='handout'&&/^H\d\d$/.test(j.id))){const id=`cold:${j.id}`;
      if(!state.evidence.some(e=>e.id===id))this.upsert(state.evidence,evidenceRecord({title:j.title,body:plain(j.body),source:'Cold Storage / recovered record',truth:'unknown',gmNotes:'Imported handout. Review and release only at the appropriate scene.',sourceId:j.id,media:{}},id));
    }
    const services=[['city','Bay City Civic Index','Public notices, maps and service directory'],['relay','Sable Needle Relay Desk','Transit and relay service enquiries'],['clinical','Continuity Clinical Desk','Appointments and continuity-care enquiries'],['archive','Quiet Archive Catalogue','Permission-based testimony and record enquiries'],['escrow','Benefactor Escrow Channel','Requests for support, introductions and contractual terms'],['virtual','Virtuality Gateway','Permission-based invitations to virtual environments']];
    for(const [key,name,description] of services){const id=`service:${key}`;if(!state.contacts.some(c=>c.id===id))this.upsert(state.contacts,contactRecord({name,type:'system',role:'Service endpoint',description,address:`ONI / ${key}`,gmNotes:'ONI module service template, newly authored for this interface; not a claim that this endpoint appears in the adventure. GM adjudicates all responses.',grants:[]},id));}
    if(!state.contacts.some(c=>c.id==='cold:marlowe'))this.upsert(state.contacts,contactRecord({name:'Marlowe',type:'ai',role:'Anansi House host',address:'ONI / Anansi House',description:'An independent service AI at Anansi House.',sourceId:'marlowe',grants:[],gmNotes:'Source: Cold Storage G14. Independent hotel service AI; not one of the hidden Benefactor roots.'},'cold:marlowe'));
    buildColdDossiers(state,data,plain);
    this.syncDossiers(state,{revealActors:this.actors.filter(a=>/^PC0[1-8]$/.test(sourceId(a))).map(a=>a.id)});
    this.queueResearch(state);
  }
  ensureActorDossier(state,actor) {
    dossierState(state);let d=dossierForActor(state,actor.id);if(d)return d;
    const id=`actor:${actor.id}`;
    d=state.dossiers[id]??={id,sourceId:'',name:actor.name,role:'Custom PC',actorId:actor.id,contacts:{},research:{},blockedPeers:[],sceneReleases:[]};return d;
  }
  migrateBinding(state,d,old) {
    if(old===d.actorId)return;
    for(const c of state.contacts){
      const a=d.contacts[c.id];if(old&&c.grants.includes(old)){if(a&&a.current!==false)a.current=true;c.grants=c.grants.filter(id=>id!==old);}
      if(a?.current&&d.actorId)c.grants=unique([...c.grants,d.actorId]);
    }
    if(old)state.outbox=state.outbox.filter(o=>!o.actorIds.includes(old));
    d.directorySignature='';
  }
  syncDossiers(state,{revealActors=[]}={}) {
    dossierState(state);
    for(const d of Object.values(state.dossiers)){
      const old=d.actorId;
      if(!d.manualBinding&&d.sourceId){const candidates=this.actors.filter(a=>a.type==='character'&&sourceId(a)===d.sourceId);if(candidates.length===1)d.actorId=candidates[0].id;else if(!candidates.some(a=>a.id===old))d.actorId='';}
      if(d.manualBinding&&!game.actors.get(d.actorId))d.actorId='';
      this.migrateBinding(state,d,old);
    }
    for(const actor of this.actors.filter(a=>a.type==='character'&&owners(a,this.users).length))this.ensureActorDossier(state,actor);
    const all=Object.values(state.dossiers);
    for(const target of all){
      const actor=game.actors.get(target.actorId),id=target.sourceId?`team:${target.id}`:`pc:${target.actorId}`;
      if(!target.sourceId&&!target.actorId)continue;
      // Replace only the old automatically generated Cold Storage peer card.
      if(target.sourceId&&actor)state.contacts=state.contacts.filter(c=>c.id!==`pc:${actor.id}`);
      let c=state.contacts.find(c=>c.id===id);
      if(!c){c=contactRecord({name:actor?.name||target.name,type:'pc',role:'Team ONI',actorId:actor?.id||'',portrait:safeActorImage(actor),address:`DHF / ${actor?.name||target.name}`,grants:[]},id);state.contacts.push(c);}
      c.actorId=actor?.id||'';c.name=actor?.name||target.name;if(actor)c.portrait=safeActorImage(actor);
      const available=actor&&owners(actor,this.users).length&&actor.getFlag?.('cold-storage','selectionState')!=='reserve';
      for(const d of all){
        if(d.id===target.id)continue;
        const a=d.contacts[id]??={historicalNames:[],categories:[],sleeves:[],identity:false};
        const receiver=game.actors.get(d.actorId),eligible=available&&receiver&&owners(receiver,this.users).length&&receiver.getFlag?.('cold-storage','selectionState')!=='reserve';
        if(eligible&&!d.blockedPeers.includes(id)){if(!a.current)a.autoPeer=true;a.current=true;c.grants=unique([...c.grants,d.actorId]);}
        else if(a.autoPeer){a.current=false;c.grants=c.grants.filter(id=>id!==d.actorId);}
      }
    }
    for(const d of all){
      for(const c of state.contacts.filter(c=>c.type!=='pc')){
        const a=d.contacts[c.id]??={historicalNames:[],categories:[],sleeves:[],identity:false};
        if(d.actorId&&c.grants.includes(d.actorId)&&a.current!==false)a.current=true;
        if(a.current&&d.actorId)c.grants=unique([...c.grants,d.actorId]);
      }
      const actor=game.actors.get(d.actorId);if(!actor)continue;
      d.displayName=actor.name;d.selection=actor.getFlag?.('cold-storage','selectionState')||'custom';
      if(revealActors.includes(actor.id)){
        const groups=new Map();
        for(const item of actor.items?.contents||[...(actor.items||[])])if(item.type==='relationship'){
          const authorId=item._stats?.lastModifiedBy;if(authorId&&game.users.get(authorId)&&!game.users.get(authorId).isGM)continue;
          const cid=`cold:${item.system?.contactId}`,a=d.contacts[cid],rid=sourceId(item);
          if(a?.relationshipIds?.includes(rid)){if(!groups.has(cid))groups.set(cid,[]);groups.get(cid).push(item);}
        }
        for(const [cid,items] of groups){
          const a=d.contacts[cid];a.observedReveals??={};let changed=false;
          for(const item of items){const rid=sourceId(item),value=item.system.revealState||'unknown';if(a.observedReveals[rid]!==value){changed=true;a.observedReveals[rid]=value;}}
          if(!changed)continue;
          const confirmed=items.some(i=>i.system.revealState==='confirmed'&&!i.getFlag?.('cold-storage','unverifiedArchive'));
          const familiar=items.some(i=>['familiar','suspected','confirmed','hostile','reconciled'].includes(i.system.revealState));
          if(confirmed)setContactRelease(state,d,cid,'verify');else if(familiar)setContactRelease(state,d,cid,'release');else if(a.current)setContactRelease(state,d,cid,'hide');
        }
      }
      if(d.directorySignature!==this.directorySignature(state,actor.id))this.snapshot(state,actor.id);
    }
    for(const c of state.contacts)c.grants=c.grants.filter(id=>game.actors.get(id));
    this.queueEvidence(state);
  }
  recipientSignature(actorId) {
    const actor=game.actors.get(actorId);return `${actorId}|${owners(actor,this.users).sort().map(id=>`${id}:${game.users.get(id).getFlag(ID,'publicKey')?.kid||'missing'}`).join('|')}`;
  }
  directorySignature(state,actorId) {
    const s=JSON.stringify([endpoint(state,actorId),state.contacts.filter(c=>c.grants.includes(actorId)).map(c=>projectAssignedContact(state,c,actorId))]);
    let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return `${this.recipientSignature(actorId)}|${h>>>0}`;
  }
  queueResearch(state,{notify=false}={}) {
    dossierState(state);
    for(const d of Object.values(state.dossiers)){
      if(!game.actors.get(d.actorId))continue;
      for(const [id,grant] of Object.entries(d.research)){
        const file=state.research.find(r=>r.id===id);if(!grant.released||!file)continue;
        const signature=`${this.recipientSignature(d.actorId)}|${file.revision}`;
        if(grant.delivery===signature||grant.deliverySuppressed===signature)continue;
        const old=state.outbox.find(o=>o.data.type==='research-ref'&&o.data.dossierId===d.id&&o.data.researchId===id);
        if(old?.data.signature===signature)continue;
        if(old)state.outbox=state.outbox.filter(o=>o.id!==old.id);
        this.enqueue(state,[d.actorId],{type:'research-ref',dossierId:d.id,researchId:id,title:file.title,signature,incoming:notify&&!grant.silent});
      }
    }
  }
  queueEvidence(state) {
    for(const d of Object.values(state.dossiers||{})){
      if(!game.actors.get(d.actorId))continue;d.evidenceDelivery??={};
      for(const id of d.pendingEvidence||[]){
        const file=state.evidence.find(e=>e.id===id);if(!file)continue;
        const signature=`${this.recipientSignature(d.actorId)}|1`;if(d.evidenceDelivery[id]===signature||d.evidenceSuppressed?.[id]===signature)continue;
        const old=state.outbox.find(o=>o.data.type==='evidence-ref'&&o.data.dossierId===d.id&&o.data.evidenceId===id);
        if(old?.data.signature===signature)continue;if(old)state.outbox=state.outbox.filter(o=>o.id!==old.id);
        this.enqueue(state,[d.actorId],{type:'evidence-ref',dossierId:d.id,evidenceId:id,title:file.title,signature,incoming:true});
      }
    }
  }
  async maintain(state,{force=false,revealActors=[]}={}) {
    if(force)for(const d of Object.values(state.dossiers)){for(const g of Object.values(d.research))delete g.deliverySuppressed;d.evidenceSuppressed={};}
    state.guides={...state.guides,...await ensureGuides()};
    const hasCold=this.actors.some(a=>a.type==='character'&&/^PC0[1-8]$/.test(sourceId(a)));
    if(force||(game.settings.get(ID,'autoSetup')&&hasCold&&state.imports.cold?.version!==DOSSIER_VERSION))await this.importCold(state);
    else this.syncDossiers(state,{revealActors});
    this.queueResearch(state);
  }
  deliveryReason(job,state=this.state) {
    if(job.deliverAt>Date.now())return `Scheduled for ${new Date(job.deliverAt).toLocaleString()}`;
    for(const id of job.actorIds){
      const actor=game.actors.get(id);if(!actor)return 'PC actor was deleted; bind the dossier to its replacement.';
      const ep=state.actors[id];if(job.data.type!=='directory'&&(ep?.enabled===false||ep?.jammed))return ep.jammed?'Signal blocked by GM.':'PC is off-grid.';
      if(!owners(actor,this.users).length)return 'No player owner assigned.';
    }
    const ids=job.userIds||job.actorIds.flatMap(id=>owners(game.actors.get(id),this.users));
    const missing=ids.filter(id=>!game.users.get(id)?.getFlag(ID,'publicKey')?.kid);
    if(missing.length)return `Waiting for endpoint keys: ${missing.map(id=>game.users.get(id)?.name||id).join(', ')}.`;
    return job.lastError?`Last delivery failed: ${job.lastError}`:'Ready for the next GM delivery cycle.';
  }
  diagnostics() {
    const state=this.state,guideIds=Object.values(state.guides).filter(id=>game.journal?.get(id));
    return diagnosticReport(state,{actors:this.actors,users:this.users,ready:this.ready,authority:this.authority,bytes:new TextEncoder().encode(JSON.stringify(state)).length,guideIds});
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
  actorResearch(actorId) {
    const result=new Map();for(const r of this.packets(actorId).sort((a,b)=>(b.payload.data.sequence||0)-(a.payload.data.sequence||0))){const file=r.payload.data.research;if(file&&!result.has(file.id))result.set(file.id,file);}return [...result.values()];
  }
  calls(actorId) {
    const result=new Map();for(const r of this.packets(actorId).sort((a,b)=>(b.payload.data.sequence||0)-(a.payload.data.sequence||0))){const c=r.payload.data.call;if(c&&!result.has(c.id))result.set(c.id,c);}return [...result.values()];
  }
  async markRead(id) {
    const read=game.user.getFlag(ID,'readIds')||[];if(!read.includes(id))await game.user.setFlag(ID,'readIds',[id,...read].slice(0,1500));this.refresh();
  }
  async markFileRead(actorId,kind,fileId) {
    if(!['research','evidence'].includes(kind))return;
    const ids=this.packets(actorId).filter(r=>r.payload.data[kind]?.id===fileId).map(r=>r.id);
    if(!ids.length)return;const read=game.user.getFlag(ID,'readIds')||[];
    await game.user.setFlag(ID,'readIds',unique([...ids,...read]).slice(0,1500));this.refresh();
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
    state.dossiers=clone(backup.state.dossiers||{});state.research=(backup.state.research||[]).map(r=>researchRecord(r,r.id));state.imports=clone(backup.state.imports||{});state.guides=clone(backup.state.guides||{});
    if(state.research.length>2000||Object.keys(state.dossiers).length>100)throw new Error('This backup exceeds the ONI dossier limits.');
    for(const d of Object.values(state.dossiers)){for(const g of Object.values(d.research||{}))g.delivery='';d.directorySignature='';d.evidenceDelivery={};}
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
  return (doc.body.textContent||'').replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g,'$1').replace(/\n\s*\n(?:\s*\n)+/g,'\n\n').trim();
}
