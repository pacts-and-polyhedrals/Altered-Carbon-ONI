import {ID,esc,owns} from './domain.mjs';
import {renderView} from './view.mjs';
import {plainHandout} from './runtime.mjs';
import {dossierForActor} from './dossiers.mjs';
import {captureViewState,restoreViewState} from './ui-state.mjs';
const api=foundry.applications.api;
export class ONIApplication extends api.HandlebarsApplicationMixin(api.ApplicationV2) {
  static DEFAULT_OPTIONS={id:'altered-carbon-oni-hud',classes:['ac-oni-app'],window:{title:'ONI · Optical Neural Interface',icon:'fa-solid fa-eye'},position:{width:1120,height:790},actions:{act:this.onAction}};
  static PARTS={main:{template:'modules/altered-carbon-oni/templates/interface.hbs'}};
  constructor(runtime,{actorId}={}) {
    super();this.runtime=runtime;this.actorId=actorId||this.initialActor();this.tab=game.user.isGM?'gm':'inbox';this.gmSection='pcs';this.drafts={};this.viewStates=new Map();this.dirtyForms=new Set();this.runtime.ui=this;this.busy=0;
  }
  initialActor() {
    const controlled=canvas?.tokens?.controlled?.find(t=>this.runtime.canUseEndpoint(t.actor))?.actor;
    const character=this.runtime.canUseEndpoint(game.user.character)?game.user.character:null;
    return controlled?.id||character?.id||this.runtime.ownedActors.find(a=>a.type==='character')?.id||this.runtime.ownedActors[0]?.id||'';
  }
  async _prepareContext(options) {
    const c=await super._prepareContext(options);
    if(game.user.isGM&&this.runtime.ready){try{const s=this.runtime.state,bound=dossierForActor(s,this.actorId);if(bound)this.dossierId=bound.id;else if(!s.dossiers[this.dossierId]){const d=Object.values(s.dossiers)[0];if(d)this.dossierId=d.id;}}catch{}}
    return {...c,body:renderView(this.runtime,this),oniSignature:this.refreshSignature()};
  }
  _onRender(context,options) {
    super._onRender(context,options);
    this.events?.abort();this.events=new AbortController();const opts={signal:this.events.signal};
    this.element.addEventListener('submit',event=>{const form=event.target.closest('[data-oni-form]');if(!form)return;event.preventDefault();this.run(()=>this.submit(form));},opts);
    this.element.addEventListener('change',event=>{const which=event.target.dataset.oniSelect;if(!which){const form=event.target.closest('[data-oni-form]');if(form)this.dirtyForms.add(this.draftKey(form));return;}
      this.captureUI();this[which==='actor'?'actorId':which]=event.target.value;
      if(which==='actor'){
        this.selection='';this.contactId='';this.evidenceId='';this.researchId='';this.lastNotice='';
        if(game.user.isGM)this.dossierId=dossierForActor(this.runtime.state,this.actorId)?.id||'';
      }
      if(which==='dossierId'){const d=this.runtime.state.dossiers[this.dossierId];this.actorId=d?.actorId||'';this.selection='';this.contactId='';this.researchId='';this.lastNotice='';}
      this.render({force:true});},opts);
    this.element.addEventListener('input',event=>{
      const which=event.target.dataset.oniFilter;if(!which){const form=event.target.closest('[data-oni-form]');if(form)this.dirtyForms.add(this.draftKey(form));return;}this[which]=event.target.value;
      const caret=event.target.selectionStart;clearTimeout(this.filterTimer);this.filterTimer=setTimeout(async()=>{
        this.captureUI();await this.render({force:true});const input=this.element.querySelector(`[data-oni-filter="${which}"]`);
        if(input){input.focus();try{input.setSelectionRange(caret,caret);}catch{}}
      },220);
    },opts);
    this.element.addEventListener('focusout',()=>{if(this.pendingRefresh)setTimeout(()=>{if(!this.editing()){this.pendingRefresh=false;this.refresh();}},50);},opts);
    this.restoreDrafts();
    this.lastSignature=context.oniSignature;
    const state=this.viewStates.get(this.viewKey());restoreViewState(this.element,state);
    if(state)requestAnimationFrame(()=>restoreViewState(this.element,state));
  }
  viewKey() { return `${this.actorId}:${this.tab}:${this.gmSection}:${this.dossierId||''}:${this.contactView||'current'}`; }
  captureUI() { if(!this.element)return;this.captureDrafts();this.viewStates.set(this.viewKey(),captureViewState(this.element)); }
  refreshSignature() { return `${this.runtime.uiVersion}:${this.runtime.authority?.id||''}:${this.runtime.lastError}:${JSON.stringify(game.user.getFlag(ID,'readIds')||[])}:${this.viewKey()}`; }
  draftKey(form) { return `${this.actorId}:${this.tab}:${this.gmSection}:${form.dataset.oniForm}:${form.querySelector('[name="id"],[name="contactId"],[name="requestId"],[name="callId"],[name="dossierId"],[name="sceneId"]')?.value||''}`; }
  captureDrafts() {
    for(const f of this.element?.querySelectorAll('[data-oni-form]')||[]){if(!this.dirtyForms.has(this.draftKey(f)))continue;const fields=[];
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
  refresh() {
    if(!this.rendered||this.lastSignature===this.refreshSignature())return;
    if(this.busy||this.editing()){this.pendingRefresh=true;return;}
    if(this.refreshTimer)return;this.refreshTimer=setTimeout(()=>{this.refreshTimer=null;if(this.busy||this.editing()){this.pendingRefresh=true;return;}if(this.lastSignature!==this.refreshSignature()){this.captureUI();this.render({force:true});}},60);
  }
  async run(fn) { this.busy++;try{await fn();}catch(e){ui.notifications.error(`ONI: ${e.message}`);console.error('ONI | UI action',e);}finally{this.busy--;if(!this.busy&&this.pendingRefresh){this.pendingRefresh=false;this.refresh();}} }
  static async onAction(event,target) { await this.run(()=>this.action(target.dataset.oni,target.dataset.id)); }
  async action(op,id) {
    this.captureUI();
    const r=this.runtime;
    if(op==='tab'){this.tab=id;this.selection='';}
    else if(op==='gm-tab'){this.gmSection=id;}
    else if(op==='packet'){this.selection=id;await r.markRead(id);}
    else if(op==='read'){await r.markRead(id);}
    else if(op==='read-all'){const ids=r.packets(this.actorId).map(p=>p.id),old=game.user.getFlag(ID,'readIds')||[];await game.user.setFlag(ID,'readIds',[...new Set([...ids,...old])].slice(0,1500));}
    else if(op==='contact'){this.contactId=id;}
    else if(op==='contact-view'){this.contactView=id;}
    else if(op==='evidence'){this.tab='evidence';this.evidenceId=id;await r.markFileRead(this.actorId,'evidence',id);}
    else if(op==='research'){this.tab='research';this.researchId=id;await r.markFileRead(this.actorId,'research',id);}
    else if(op==='new-note'){this.tab='research';this.newNote=!this.newNote;}
    else if(op==='save-research'){await r.request('research-note',{actorId:this.actorId,packetId:id});ui.notifications.info('Transmission saved to this PC’s research archive.');}
    else if(['release-channel','hide-channel','release-history','verify-contact'].includes(op)){
      await this.sendRequest('contact-release',{...JSON.parse(id),actorId:this.actorId,mode:{'release-channel':'release','hide-channel':'hide','release-history':'history','verify-contact':'verify'}[op]});
    }
    else if(op==='release-research'){await this.sendRequest('research-release',{...JSON.parse(id),actorId:this.actorId});}
    else if(['release-lifetimes','release-contacts','rebuild-archive'].includes(op)){await this.sendRequest(op,{dossierId:id,actorId:this.actorId});}
    else if(op==='cancel-archive-jobs'){await this.sendRequest(op,this.outboxScope==='all'?{}:{dossierIds:[this.dossierId]});}
    else if(op==='edit-research'){this.tab='gm';this.gmSection='research';this.editResearchId=id;}
    else if(op==='new-research'){this.editResearchId='';delete this.drafts[`${this.actorId}:gm:research:research-save:`];}
    else if(op==='guide'){
      const journal=game.journal?.find(j=>j.getFlag?.(ID,'guide')===(game.user.isGM?'gm':'player'));
      if(journal)await journal.sheet.render({force:true});else ui.notifications.info('The ONI guides are created when a GM prepares this world.');
    }
    else if(op==='repair'){await this.sendRequest(op,{});}
    else if(op==='diagnostics-export'){foundry.utils.saveDataToFile(JSON.stringify(r.diagnostics(),null,2),'application/json',`ONI-diagnostics-${game.world.id}.json`);}
    else if(op==='analyze'){await r.request('operation',{actorId:this.actorId,op:'analyze',evidenceId:id,body:'Inspect authenticity, provenance and relevant details.'});ui.notifications.info('ONI analysis request queued.');}
    else if(op==='power'){await r.request('power',{actorId:this.actorId,enabled:!r.directory(this.actorId).endpoint.enabled});}
    else if(['answer','decline','hangup'].includes(op)){await r.request('call-action',{actorId:this.actorId,callId:id,action:op==='answer'?'accept':op});}
    else if(['gm-answer','gm-decline','gm-hangup'].includes(op)){await r.request('gm-call',{callId:id,action:op==='gm-answer'?'accept':op==='gm-decline'?'decline':'hangup'});}
    else if(op==='request'){this.requestId=id;}
    else if(op==='new-contact'){this.editContactId='';delete this.drafts[`${this.actorId}:gm:contacts:contact-save:`];}
    else if(op==='new-evidence'){this.editEvidenceId='';delete this.drafts[`${this.actorId}:gm:evidence:evidence-save:`];}
    else if(op==='edit-contact'){this.editContactId=id;}
    else if(op==='edit-evidence'){this.editEvidenceId=id;}
    else if(op==='import-cold'){await r.request(op);ui.notifications.info('Cold Storage dossiers and research preparation queued.');}
    else if(op==='sync-roster'){await r.request(op);ui.notifications.info('PC roster sync requested.');}
    else if(op==='cancel-job'){await r.request(op,{id});}
    else if(op==='remove-contact'||op==='remove-evidence'){
      const yes=await api.DialogV2.confirm({window:{title:'Remove ONI record'},content:'<p>Remove this record from the ONI vault? Previously delivered evidence remains in PC inboxes.</p>'});
      if(yes){await r.request('remove',{id,type:op==='remove-evidence'?'evidence':'contact'});this.editContactId='';this.editEvidenceId='';}
    }
    else if(op==='key-backup'){foundry.utils.saveDataToFile(r.keys.backup(),'application/json',`ONI-endpoint-${game.user.id}.json`);}
    else if(op==='world-export'){foundry.utils.saveDataToFile(r.exportWorld(),'application/json',`ONI-world-${game.world.id}.json`);}
    this.render({force:true});
  }
  async sendRequest(action,data) {
    const r=this.runtime,id=await r.request(action,data);await r.schedule();
    if(game.user.isGM&&r.isAuthority){const result=r.state.processed[id];if(result?.status==='rejected')throw new Error(result.error||'This request was rejected.');
      const summary=result?.result;if(summary?.name){const d=r.state.dossiers[summary.dossierId];const message=`${summary.name}: ${summary.section}${summary.count!=null?` (${summary.count})`:''}. ${d?r.archiveStatus(d):''}`;this.lastNotice=message;ui.notifications.info(message);}}
    return id;
  }
  async submit(form) {
    this.captureUI();const r=this.runtime,kind=form.dataset.oniForm,fd=new FormData(form),d=Object.fromEntries(fd.entries()),key=this.draftKey(form);
    d.actorIds=fd.getAll('actorIds');d.dossierIds=fd.getAll('dossierIds');d.grants=d.actorIds;d.actorId=d.actorId||this.actorId;
    d.media={type:d.mediaType||'image',path:d.mediaPath||'',caption:d.mediaCaption||''};
    for(const k of ['manual','jammed','masked','release'])d[k]=fd.has(k);
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
      await this.sendRequest(kind,d);ui.notifications.info(kind==='scene-release'?'Scene discoveries saved for the checked PCs.':'ONI changes saved.');
      if(kind==='research-note')this.newNote=false;
    }
    delete this.drafts[key];this.dirtyForms.delete(key);this.render({force:true});
  }
  notify(record) {
    const p=record.payload,data=p.kind==='request'?{type:'request',title:'New ONI request',from:{name:game.actors.get(p.data.data.actorId)?.name||record.author.name}}:p.data;
    if(data.type==='directory'||(data.type==='call'&&data.call.status==='ringing'&&data.call.expiresAt<Date.now()))return;
    const holder=document.querySelector('#ac-oni-notifications')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'ac-oni-notifications'}));
    const toast=document.createElement('button');toast.type='button';toast.className=`oni-toast ${data.type==='call'?'call':''}`;
    toast.innerHTML=`<span class="oni-toast-symbol"><i class="fa-solid ${data.type==='call'?'fa-phone':'fa-eye'}"></i></span><span><small>ONI / ${esc(data.from?.name||'PRIVATE CHANNEL')}</small><b>${esc(data.title)}</b><em>Open transmission</em></span>`;
    toast.addEventListener('click',()=>{this.captureUI();const target=p.actorIds.find(id=>this.runtime.canUseEndpoint(game.actors.get(id)));if(target)this.actorId=target;this.tab=p.kind==='request'?'gm':data.type==='archive'?data.destination||'research':data.type==='call'?'calls':data.research?'research':data.evidence?'evidence':'inbox';if(data.type!=='archive'&&data.research)this.researchId=data.research.id;if(data.type!=='archive'&&data.evidence)this.evidenceId=data.evidence.id;if(p.kind==='request'){this.gmSection='queue';this.requestId=record.id;}this.selection=record.id;this.render({force:true});rMark(this.runtime,record.id);toast.remove();});
    holder.appendChild(toast);while(holder.children.length>3)holder.firstChild.remove();setTimeout(()=>toast.remove(),16000);
    if(game.settings.get(ID,'sound'))tone();
  }
}
function rMark(r,id){r.markRead(id).catch(e=>console.warn('ONI | Mark read',e));}
let audio;
function tone(){try{const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return;audio??=new C();if(audio.state!=='running')return;const t=audio.currentTime,g=audio.createGain(),o=audio.createOscillator();o.type='sine';o.frequency.setValueAtTime(740,t);o.frequency.setValueAtTime(990,t+.08);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.08,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+.23);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.24);}catch{}}
export function unlockAudio(){try{const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(C){audio??=new C();audio.resume().catch(()=>{});}}catch{}}
