import {ID,esc,owns} from './domain.mjs';
import {renderView} from './view.mjs';
import {plainHandout} from './runtime.mjs';
const api=foundry.applications.api;
export class ONIApplication extends api.HandlebarsApplicationMixin(api.ApplicationV2) {
  static DEFAULT_OPTIONS={id:'altered-carbon-oni-hud',classes:['ac-oni-app'],window:{title:'ONI · Optical Neural Interface',icon:'fa-solid fa-eye'},position:{width:1120,height:790},actions:{act:this.onAction}};
  static PARTS={main:{template:'modules/altered-carbon-oni/templates/interface.hbs'}};
  constructor(runtime,{actorId}={}) {
    super();this.runtime=runtime;this.actorId=actorId||this.initialActor();this.tab='inbox';this.gmSection='queue';this.drafts={};this.runtime.ui=this;
  }
  initialActor() {
    const controlled=canvas?.tokens?.controlled?.find(t=>owns(t.actor,game.user))?.actor;
    return controlled?.id||game.user.character?.id||this.runtime.ownedActors.find(a=>a.type==='character')?.id||this.runtime.ownedActors[0]?.id||'';
  }
  async _prepareContext(options) { const c=await super._prepareContext(options);return {...c,body:renderView(this.runtime,this)}; }
  _onRender(context,options) {
    super._onRender(context,options);
    this.events?.abort();this.events=new AbortController();const opts={signal:this.events.signal};
    this.element.addEventListener('submit',event=>{const form=event.target.closest('[data-oni-form]');if(!form)return;event.preventDefault();this.run(()=>this.submit(form));},opts);
    this.element.addEventListener('change',event=>{const which=event.target.dataset.oniSelect;if(!which)return;
      this.captureDrafts();this[which==='actor'?'actorId':which]=event.target.value;
      if(which==='actor'){this.selection='';this.contactId='';this.evidenceId='';}
      this.render({force:true});},opts);
    this.element.addEventListener('focusout',()=>{if(this.pendingRefresh)setTimeout(()=>{if(!this.editing()){this.pendingRefresh=false;this.captureDrafts();this.render({force:true});}},50);},opts);
    this.restoreDrafts();
  }
  draftKey(form) { return `${this.actorId}:${this.tab}:${this.gmSection}:${form.dataset.oniForm}:${form.querySelector('[name="id"],[name="contactId"],[name="requestId"],[name="callId"]')?.value||''}`; }
  captureDrafts() {
    for(const f of this.element?.querySelectorAll('[data-oni-form]')||[]){const fields=[];
      for(const e of f.elements){if(!e.name||['file','hidden','submit'].includes(e.type))continue;fields.push({name:e.name,type:e.type,value:e.value,checked:e.checked});}
      this.drafts[this.draftKey(f)]=fields;
    }
  }
  restoreDrafts() {
    for(const f of this.element?.querySelectorAll('[data-oni-form]')||[]){const fields=this.drafts[this.draftKey(f)];if(!fields)continue;
      for(const e of f.elements){const v=fields.find(x=>x.name===e.name&&(e.type!=='checkbox'||x.value===e.value));if(!v)continue;if(e.type==='checkbox')e.checked=v.checked;else if(e.type!=='file')e.value=v.value;}
    }
  }
  editing() { return Boolean(this.element?.contains(document.activeElement)&&document.activeElement?.matches('input,select,textarea')); }
  refresh() { if(!this.rendered)return;if(this.editing()){this.pendingRefresh=true;return;}this.captureDrafts();this.render({force:true}); }
  async run(fn) { try{await fn();}catch(e){ui.notifications.error(`ONI: ${e.message}`);console.error('ONI | UI action',e);} }
  static async onAction(event,target) { await this.run(()=>this.action(target.dataset.oni,target.dataset.id)); }
  async action(op,id) {
    this.captureDrafts();
    const r=this.runtime;
    if(op==='tab'){this.tab=id;this.selection='';}
    else if(op==='gm-tab'){this.gmSection=id;}
    else if(op==='packet'){this.selection=id;await r.markRead(id);}
    else if(op==='read'){await r.markRead(id);}
    else if(op==='read-all'){const ids=r.packets(this.actorId).map(p=>p.id),old=game.user.getFlag(ID,'readIds')||[];await game.user.setFlag(ID,'readIds',[...new Set([...ids,...old])].slice(0,1500));}
    else if(op==='contact'){this.contactId=id;}
    else if(op==='evidence'){this.tab='evidence';this.evidenceId=id;}
    else if(op==='analyze'){await r.request('operation',{actorId:this.actorId,op:'analyze',evidenceId:id,body:'Inspect authenticity, provenance and relevant details.'});ui.notifications.info('ONI analysis request queued.');}
    else if(op==='power'){await r.request('power',{actorId:this.actorId,enabled:!r.directory(this.actorId).endpoint.enabled});}
    else if(['answer','decline','hangup'].includes(op)){await r.request('call-action',{actorId:this.actorId,callId:id,action:op==='answer'?'accept':op});}
    else if(['gm-answer','gm-decline','gm-hangup'].includes(op)){await r.request('gm-call',{callId:id,action:op==='gm-answer'?'accept':op==='gm-decline'?'decline':'hangup'});}
    else if(op==='request'){this.requestId=id;}
    else if(op==='new-contact'){this.editContactId='';delete this.drafts[`${this.actorId}:gm:contacts:contact-save:`];}
    else if(op==='new-evidence'){this.editEvidenceId='';delete this.drafts[`${this.actorId}:gm:evidence:evidence-save:`];}
    else if(op==='edit-contact'){this.editContactId=id;}
    else if(op==='edit-evidence'){this.editEvidenceId=id;}
    else if(op==='import-cold'){await r.request(op);ui.notifications.info('Cold Storage import requested. Entries remain GM-only until released.');}
    else if(op==='sync-roster'){await r.request(op);ui.notifications.info('PC roster sync requested.');}
    else if(op==='cancel-job'){await r.request(op,{id});}
    else if(op==='remove-contact'||op==='remove-evidence'){
      const yes=await api.DialogV2.confirm({window:{title:'Remove ONI record'},content:'<p>Remove this record from the ONI vault? Previously delivered evidence remains in PC inboxes.</p>'});
      if(yes){await r.request('remove',{id,type:op==='remove-evidence'?'evidence':'contact'});this.editContactId='';this.editEvidenceId='';}
    }
    else if(op==='key-backup'){foundry.utils.saveDataToFile(r.keys.backup(),'application/json',`ONI-endpoint-${game.user.id}.json`);}
    else if(op==='world-export'){foundry.utils.saveDataToFile(r.exportWorld(),'application/json',`ONI-world-${game.world.id}.json`);}
    await r.schedule();this.render({force:true});
  }
  async submit(form) {
    this.captureDrafts();const r=this.runtime,kind=form.dataset.oniForm,fd=new FormData(form),d=Object.fromEntries(fd.entries());
    d.actorIds=fd.getAll('actorIds');d.grants=d.actorIds;d.actorId=d.actorId||this.actorId;
    d.media={type:d.mediaType||'image',path:d.mediaPath||'',caption:d.mediaCaption||''};
    for(const k of ['manual','jammed','masked'])d[k]=fd.has(k);
    if(kind==='preferences'){for(const k of ['sound','dnd','reduceMotion'])await game.settings.set(ID,k,fd.has(k));}
    else if(kind==='key-import'){
      const file=fd.get('file');if(!file?.size)throw new Error('Choose your ONI endpoint backup.');if(file.size>50000)throw new Error('Not an ONI endpoint key file.');
      await r.keys.restore(JSON.parse(await file.text()),false);if(!r.ready)await r.start();else{r.cache.clear();r.decoded.clear();for(const m of game.messages.contents||[...game.messages])await r.decode(m);}
      ui.notifications.info('ONI endpoint key restored.');
    }else if(kind==='world-import'){
      const file=fd.get('file');if(!file?.size||file.size>10000000)throw new Error('Choose an ONI world export under 10 MB.');
      const backup=JSON.parse(await file.text());
      const yes=await api.DialogV2.confirm({window:{title:'Restore ONI world data'},content:'<p>Replace this world\'s ONI catalog, requests and history with the selected backup? Existing actors and adventure content are preserved. Restored transmissions are resealed to their current owners.</p>'});
      if(yes)await r.restoreWorld(backup);
    }else if(kind==='journal-import'){
      if(!game.user.isGM)throw new Error('GM access required.');const page=await fromUuid(d.uuid);
      if(page?.documentName!=='JournalEntryPage'||page.type!=='text')throw new Error('Choose a journal text page.');
      await r.request('evidence-save',{title:page.name,body:plainHandout(page.text.content),source:page.parent.name,media:{},gmNotes:`Copied from ${page.uuid}. Hidden secret sections excluded; review before delivery.`});
    }else {
      if(kind==='dispatch'){const minutes=Number(d.delayMinutes)||0;d.deliverAt=minutes>0?Date.now()+Math.max(0,Math.min(10080,minutes))*60000:0;}
      await r.request(kind,d);ui.notifications.info('ONI request saved.');
    }
    delete this.drafts[this.draftKey(form)];await r.schedule();this.render({force:true});
  }
  notify(record) {
    const p=record.payload,data=p.kind==='request'?{type:'request',title:'New ONI request',from:{name:game.actors.get(p.data.data.actorId)?.name||record.author.name}}:p.data;
    if(data.type==='directory'||(data.type==='call'&&data.call.status==='ringing'&&data.call.expiresAt<Date.now()))return;
    const holder=document.querySelector('#ac-oni-notifications')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'ac-oni-notifications'}));
    const toast=document.createElement('button');toast.type='button';toast.className=`oni-toast ${data.type==='call'?'call':''}`;
    toast.innerHTML=`<span class="oni-toast-symbol"><i class="fa-solid ${data.type==='call'?'fa-phone':'fa-eye'}"></i></span><span><small>ONI / ${esc(data.from?.name||'PRIVATE CHANNEL')}</small><b>${esc(data.title)}</b><em>Open transmission</em></span>`;
    toast.addEventListener('click',()=>{const target=p.actorIds.find(id=>owns(game.actors.get(id),game.user));if(target)this.actorId=target;this.tab=p.kind==='request'?'gm':data.type==='call'?'calls':'inbox';if(p.kind==='request'){this.gmSection='queue';this.requestId=record.id;}this.selection=record.id;this.render({force:true});rMark(this.runtime,record.id);toast.remove();});
    holder.appendChild(toast);while(holder.children.length>3)holder.firstChild.remove();setTimeout(()=>toast.remove(),16000);
    if(game.settings.get(ID,'sound'))tone();
  }
}
function rMark(r,id){r.markRead(id).catch(e=>console.warn('ONI | Mark read',e));}
let audio;
function tone(){try{const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return;audio??=new C();if(audio.state!=='running')return;const t=audio.currentTime,g=audio.createGain(),o=audio.createOscillator();o.type='sine';o.frequency.setValueAtTime(740,t);o.frequency.setValueAtTime(990,t+.08);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.08,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+.23);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.24);}catch{}}
export function unlockAudio(){try{const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(C){audio??=new C();audio.resume().catch(()=>{});}}catch{}}
