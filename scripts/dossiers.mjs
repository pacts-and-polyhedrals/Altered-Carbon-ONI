import {clone,text,unique,contactRecord,projectContact} from './domain.mjs';

export const DOSSIER_VERSION=1;
export const SCENE_RELEASES=[
  {id:'ward',name:'SC01 · Resurrection Ward',contacts:['C04'],evidence:['H01'],source:'G08'},
  {id:'breach',name:'SC02 · Recovery team',contacts:['C02'],evidence:['H02'],source:'G09'},
  {id:'rainline',name:'SC03 · Rainline leads',contacts:['C14','GOD01','GOD02','GOD03'],evidence:['H14'],source:'G10'},
  {id:'quiet',name:'Lead A · Quiet Archive',contacts:['C08','F05'],evidence:['H03'],source:'G11'},
  {id:'lotus',name:'Lead B · Blue Lotus',contacts:['C07','F04'],evidence:['H04'],source:'G12'},
  {id:'relay',name:'Lead C · Relay Seventeen',contacts:['C11','F03'],evidence:['H05'],source:'G13'},
  {id:'anansi',name:'SC04 · Anansi House',contacts:['C04','marlowe'],evidence:['H06','H15'],source:'G14'},
  {id:'virtuality',name:'SC05 · Recovered virtuality',contacts:[],evidence:['H07','H08','H09'],source:'G15–G18'},
  {id:'spire',name:'SC06 · Spire and council',contacts:['GOD01','GOD02','GOD03'],evidence:['H10','H11','H12','H13','H16'],source:'G19–G21'}
];
export function dossierState(state) {
  state.dossiers??={};state.research??=[];state.imports??={};state.guides??={};return state;
}
export function sourceId(doc) { return doc?.getFlag?.('cold-storage','sourceId')||doc?.flags?.['cold-storage']?.sourceId||''; }
export function researchRecord(v,id) {
  if(!text(v.title,160).trim())throw new Error('Research needs a title.');
  return {id,title:text(v.title,160),body:text(v.body,24000),source:text(v.source,200),category:text(v.category||'Research',80),
    pcId:text(v.pcId,100),sourceId:text(v.sourceId,100),status:['confirmed','disputed','unverified','personal'].includes(v.status)?v.status:'unverified',
    gmNotes:text(v.gmNotes,12000),revision:Math.max(1,Number(v.revision)||1)};
}
export function projectResearch(r) { return {id:r.id,title:r.title,body:r.body,source:r.source,category:r.category,status:r.status,revision:r.revision}; }
const add=(list,record)=>{if(!list.some(r=>r.id===record.id))list.push(record);};
function assignContact(d,id) { return d.contacts[id]??={historicalNames:[],categories:[],sleeves:[],disputed:false,identity:false,observedReveals:{}}; }
export function researchGrant(d,id,starter=false) { return d.research[id]??={released:starter,delivery:'',silent:starter}; }
/** Additive source import: stable IDs preserve releases, custom text and delivery receipts. */
export function buildColdDossiers(state,data,plain) {
  dossierState(state);
  for(const key of ['pregens','relationships','previous-sleeves','journals'])if(!Array.isArray(data[key]))throw new Error(`Cold Storage ${key} is not a list.`);
  const pcs=new Set(data.pregens.map(p=>p.id)),contactIds=new Set(state.contacts.map(c=>c.id));
  if(data.relationships.some(r=>!pcs.has(r.pcId)||!contactIds.has(`cold:${r.contactId}`)))throw new Error('A Cold Storage relationship has no matching PC or contact. Import was stopped.');
  for(const p of data.pregens){
    const d=state.dossiers[p.id]??={id:p.id,sourceId:p.id,name:p.name,role:p.role,actorId:'',contacts:{},research:{},blockedPeers:[],sceneReleases:[]};
    d.contacts??={};d.research??={};d.blockedPeers??=[];d.sceneReleases??=[];
    for(const c of state.contacts.filter(c=>c.type!=='pc'))assignContact(d,c.id);
    const sleeves=data['previous-sleeves'].filter(s=>s.pcId===p.id).sort((a,b)=>a.years[0]-b.years[0]);
    const index=`cold:index:${p.id}`;
    add(state.research,researchRecord({title:`${p.name} · Continuity index`,pcId:p.id,category:'Continuity',status:'confirmed',source:'Cold Storage / pregen and sleeve archive',sourceId:p.id,
      body:`Name: ${p.name}\nRecorded profession: ${p.role}\nLast secure shared memory: ${p.storedSince}\nCurrent year: ${p.year}\nInert storage: ${p.storageYears} years\nCurrent sleeve ordinal: ${p.currentSleeveOrdinal}\n\nRecorded lifetimes\n${sleeves.map(s=>`${s.years.join('–')} · ${s.name} · ${s.continuityStatus==='disputed'?'DISPUTED ARCHIVE CLAIM':'recorded lifetime'}`).join('\n')}\n\nThis is an index of the source archive, not proof of a present-day identity. Detailed memories and relationship records are released as they become available. Disputed entries do not count as verified extra lifetimes.`},index));
    researchGrant(d,index,true);
    const card=data.journals.find(j=>j.id===`${p.id}-CARD`);
    if(card){const id=`cold:card:${p.id}`;add(state.research,researchRecord({title:card.title,body:plain(card.body),pcId:p.id,category:'Personal briefing',source:'Cold Storage / private character card',sourceId:card.id,status:'unverified'},id));researchGrant(d,id,true);}
    for(const s of sleeves){
      const id=`cold:life:${s.id}`,disputed=s.continuityStatus==='disputed';
      add(state.research,researchRecord({title:`${s.name} · ${s.years.join('–')}`,pcId:p.id,category:'Past life',status:disputed?'disputed':'confirmed',source:`Cold Storage / ${s.id}`,sourceId:s.id,
        body:`${disputed?'DISPUTED ARCHIVE CLAIM — not a verified lifetime.\n\n':''}${s.continuityNote||''}\n\n${s.history}\n\nTransfer / loss: ${s.lossOrTransfer}\n\nSurviving memory: ${s.importantMemory}\n\nUnresolved record: ${s.unresolvedConsequence}`},id));
      researchGrant(d,id);
    }
    for(const cid of unique(data.relationships.filter(r=>r.pcId===p.id).map(r=>r.contactId))){
      const rels=data.relationships.filter(r=>r.pcId===p.id&&r.contactId===cid),a=assignContact(d,`cold:${cid}`);
      a.historicalNames=unique(rels.map(r=>r.contactHistoricalIdentity));a.categories=unique(rels.map(r=>r.category));a.sleeves=unique(rels.map(r=>r.pcSleeveName));
      a.disputed=rels.some(r=>r.continuityUnverified);a.relationshipIds=rels.map(r=>r.id);
      a.recognitionClues=unique(rels.flatMap(r=>r.recognitionClues||[]));
      a.historyId=`cold:history:${p.id}:${cid}`;
      add(state.research,researchRecord({title:`${a.historicalNames.join(' / ')} · Relationship archive`,pcId:p.id,category:'Historical contacts',status:a.disputed?'disputed':'unverified',source:'Cold Storage / relationship archive',sourceId:`${p.id}:${cid}`,
        body:rels.map(r=>`${r.continuityUnverified?'DISPUTED ARCHIVE CLAIM\n':''}${r.pcSleeveName} · ${r.category}\nHistorical name: ${r.contactHistoricalIdentity}\n${r.historicalIncident}`).join('\n\n')+'\n\nHistorical names and emotional familiarity do not prove who occupies a present-day sleeve. No present-day identity link is supplied by this file.'},a.historyId));
      researchGrant(d,a.historyId);
    }
    for(const j of data.journals.filter(j=>j.visibility==='public'&&j.category==='primer')){
      const id=`cold:primer:${j.id}`;add(state.research,researchRecord({title:j.title,body:plain(j.body),category:'Reference library',source:'Cold Storage / player primer',sourceId:j.id,status:'confirmed'},id));researchGrant(d,id,true);
    }
  }
  state.imports.cold={version:DOSSIER_VERSION,pcCount:data.pregens.length,relationshipCount:data.relationships.length,lifetimeCount:data['previous-sleeves'].length,preparedAt:state.imports.cold?.preparedAt||Date.now()};
  return state;
}
export function dossierForActor(state,actorId) { return Object.values(state.dossiers||{}).find(d=>d.actorId===actorId); }
export function projectAssignedContact(state,c,actorId) {
  const card=projectContact(c),a=dossierForActor(state,actorId)?.contacts?.[c.id];
  if(a?.identity&&a.historicalNames.length)card.identity={historicalNames:clone(a.historicalNames),status:'GM-verified identity link'};
  return card;
}
export function setContactRelease(state,d,contactId,mode) {
  const c=state.contacts.find(c=>c.id===contactId);if(!c)throw new Error('Contact no longer exists.');
  const a=assignContact(d,c.id);
  if(mode==='history'){
    if(!a.historyId)throw new Error('This contact has no historical relationship record.');
    researchGrant(d,a.historyId).released=true;
    delete d.research[a.historyId].deliverySuppressed;
  }else if(mode==='verify'){
    if(!a.historicalNames.length)throw new Error('This contact has no authored historical identity link.');
    a.identity=true;a.current=true;if(a.historyId)researchGrant(d,a.historyId).released=true;
    if(a.historyId)delete d.research[a.historyId].deliverySuppressed;
    if(d.actorId)c.grants=unique([...c.grants,d.actorId]);
  }else if(mode==='release'){
    a.current=true;a.autoPeer=false;if(d.actorId)c.grants=unique([...c.grants,d.actorId]);d.blockedPeers=d.blockedPeers.filter(id=>id!==c.id);
  }else if(mode==='hide'){
    a.current=false;a.identity=false;if(d.actorId)c.grants=c.grants.filter(id=>id!==d.actorId);
    if(c.type==='pc')d.blockedPeers=unique([...d.blockedPeers,c.id]);
  }else throw new Error('Choose release, history, verify or hide.');
}
export function diagnosticReport(state,{actors,users,ready,authority,bytes,guideIds=[]}) {
  dossierState(state);const checks=[],push=(level,title,detail,fix='')=>checks.push({level,title,detail,fix});
  push(ready?'ok':'error','Encrypted endpoint',ready?'This browser can read its ONI records.':'Restore or initialize this browser’s endpoint key.');
  push(authority?'ok':'warning','GM processing',authority?'A registered GM is available.':'Requests wait until a registered GM connects.');
  push(state.imports.cold?'ok':'warning','Cold Storage dossiers',state.imports.cold?`${Object.keys(state.dossiers).length} prepared PCs; ${state.imports.cold.relationshipCount} relationships; ${state.imports.cold.lifetimeCount} lifetime records.`:'Run Prepare / repair Cold Storage to build the dossiers.','prepare');
  for(const d of Object.values(state.dossiers)){
    const candidates=d.sourceId?actors.filter(a=>a.type==='character'&&sourceId(a)===d.sourceId):[],actor=actors.find(a=>a.id===d.actorId);
    if(candidates.length>1){push('error',d.name,'Multiple actors carry the same Cold Storage source ID. Keep one authoritative PC actor.');continue;}
    if(!actor){push('warning',d.name,'Dossier prepared; waiting for the Cold Storage PC actor. Import the adventure or use Bind actor.');continue;}
    const own=users.filter(u=>!u.isGM&&(actor.testUserPermission?.(u,'OWNER')??Number(actor.ownership?.[u.id]??actor.ownership?.default??0)>=3));
    if(!own.length)push('warning',d.name,'No player owner; files stay prepared until a player is assigned.');
    else if(own.some(u=>!u.getFlag?.('altered-carbon-oni','publicKey')?.kid))push('warning',d.name,`${own.filter(u=>!u.getFlag?.('altered-carbon-oni','publicKey')?.kid).map(u=>u.name).join(', ')} must connect once to initialize ONI. Delivery remains queued.`);
    else push('ok',d.name,`${own.map(u=>u.name).join(', ')} · ${Object.values(d.research).filter(g=>g.released).length} research files released.`);
  }
  push(bytes<550000?'ok':bytes<680000?'warning':'error','GM vault capacity',`${Math.round(bytes/1024)} KiB used; encrypted record limit is 700 KB. Research outbox jobs contain references, not duplicated archives.`);
  push(guideIds.length===2?'ok':'warning','In-world guides',guideIds.length===2?'Player guide and private GM guide are installed.':'Prepare / repair creates the missing guides.','prepare');
  const missing=Object.values(state.dossiers).flatMap(d=>Object.keys(d.research).filter(id=>!state.research.some(r=>r.id===id)));
  if(missing.length)push('error','Missing research files',`${missing.length} assigned files have no source record. Prepare / repair restores source files.`, 'prepare');
  const stale=state.contacts.flatMap(c=>c.grants.filter(id=>!actors.some(a=>a.id===id)));
  if(stale.length)push('warning','Stale contact grants',`${stale.length} grants refer to deleted actors. Safe repairs remove these stale references.`, 'prepare');
  const failed=state.outbox.filter(o=>o.lastError);if(failed.length)push('warning','Delivery errors',`${failed.length} jobs had a failed delivery. Outbox shows the saved error; jobs remain available for retry.`);
  return {version:'1.1.0',generatedAt:new Date().toISOString(),checks,summary:{errors:checks.filter(c=>c.level==='error').length,warnings:checks.filter(c=>c.level==='warning').length,preparedPCs:Object.keys(state.dossiers).length,researchFiles:state.research.length,queuedPackets:state.outbox.length}};
}
