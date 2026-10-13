import {clone,unique,endpoint,projectEvidence,owners,owns} from './domain.mjs';
import {dossierForActor,projectAssignedContact,projectResearch} from './dossiers.mjs';
export const ARCHIVE_TRANSPORT=2;
export function fingerprint(value) {
  const s=JSON.stringify(value);let hash=2166136261;
  for(let i=0;i<s.length;i++)hash=Math.imul(hash^s.charCodeAt(i),16777619);
  return (hash>>>0).toString(16);
}
export function endpointUsers(state,actor,users) {
  const d=dossierForActor(state,actor?.id);
  if(Array.isArray(d?.recipientUserIds))return unique(d.recipientUserIds).filter(id=>{const u=users.find(u=>u.id===id);return u&&!u.isGM&&owns(actor,u);});
  return owners(actor,users);
}
export function endpointReady(state,actor,users) {
  const ids=endpointUsers(state,actor,users);
  return Boolean(ids.length&&ids.some(id=>users.find(u=>u.id===id)?.getFlag?.('altered-carbon-oni','publicKey')?.kid));
}
export function publicEndpoint(state,actorId) {
  const ep=endpoint(state,actorId);
  return {enabled:ep.enabled,jammed:ep.jammed,clearance:ep.clearance,trace:ep.trace,masked:ep.masked,access:clone(ep.access||{})};
}
export function releasedResearch(state,d,{includePaused=false}={}) {
  if(!d)return [];
  return state.research.filter(f=>d.research[f.id]?.released&&(includePaused||!d.research[f.id].deliveryPaused)).map(projectResearch);
}
export function historicalCards(files) {
  return files.filter(f=>f.category==='Historical contacts').map(f=>{
    const c=f.contact||{};
    const names=c.names?.length?c.names:unique([...f.body.matchAll(/Historical name: ([^\n]+)/g)].map(m=>m[1]));
    const categories=c.categories||unique([...f.body.matchAll(/ · (enemy|rival|ally|loved-one)\n/g)].map(m=>m[1]));
    return {id:f.id,researchId:f.id,name:names.join(' / ')||f.title.replace(/ · Relationship archive$/,''),categories:clone(categories),sleeves:clone(c.sleeves||[]),status:f.status,body:f.body,source:f.source,type:'historical'};
  });
}
export function archiveProjection(state,actorId) {
  const d=dossierForActor(state,actorId),research=releasedResearch(state,d);
  return {type:'archive',transportVersion:ARCHIVE_TRANSPORT,explicitRecipients:Array.isArray(d?.recipientUserIds),actorId,contacts:state.contacts.filter(c=>c.grants.includes(actorId)).map(c=>projectAssignedContact(state,c,actorId)),
    research,historicalContacts:historicalCards(research),
    evidence:Object.entries(d?.evidenceGrants||{}).flatMap(([id,g])=>{const e=state.evidence.find(e=>e.id===id);return e&&!g.paused?[projectEvidence(e,g.verdict||'Unverified')]:[];}),endpoint:publicEndpoint(state,actorId)};
}
export function archiveSignature(state,actor,users) {
  const d=dossierForActor(state,actor?.id),ids=endpointUsers(state,actor,users).sort();
  return `${ids.map(id=>`${id}:${users.find(u=>u.id===id)?.getFlag?.('altered-carbon-oni','publicKey')?.kid||'missing'}`).join('|')}|${fingerprint(archiveProjection(state,actor.id))}|${d?.archiveEpoch||0}`;
}
/** Convert old per-file/control jobs into one snapshot per endpoint. No releases are broadened. */
export function migrateArchiveTransport(state) {
  if(state.archiveTransport===ARCHIVE_TRANSPORT)return false;
  for(const d of Object.values(state.dossiers||{})){
    d.evidenceGrants??={};d.archiveDelivery='';d.archiveEpoch??=0;
    for(const g of Object.values(d.research||{}))if(g.deliverySuppressed)g.deliveryPaused=true;
    for(const id of d.pendingEvidence||[])d.evidenceGrants[id]??={verdict:'Unverified',paused:Boolean(d.evidenceSuppressed?.[id])};
  }
  const refs=new Set(['directory','research-ref','evidence-ref','archive-ref']);
  const count=state.outbox.filter(o=>refs.has(o.data?.type)).length;
  state.outbox=state.outbox.filter(o=>!refs.has(o.data?.type));state.archiveTransport=ARCHIVE_TRANSPORT;
  state.archiveMigration={from:'1.1.0',retiredJobs:count,at:Date.now()};return true;
}
