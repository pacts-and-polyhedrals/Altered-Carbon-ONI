/** Pure ONI protocol, projections and tabletop state. No Foundry globals. */
export const ID = 'altered-carbon-oni';
export const SCHEMA = 1;
export const TERMINAL = new Set(['ended', 'declined', 'missed', 'cancelled']);
export const TYPES = ['contact', 'benefactor', 'faction', 'system', 'ai', 'pc'];
export const MODES = ['message', 'audio-call', 'video-call', 'service'];
export const OPS = {
  search: {name:'Search network', skill:'Digital Networking', activity:'oni-netrunning'},
  history: {name:'Historical research', skill:'History', activity:'oni-netrunning'},
  navigate: {name:'Plot a route', skill:'Navigation', activity:'oni-netrunning'},
  analyze: {name:'Analyze evidence', skill:'Data Analysis', activity:''},
  hack: {name:'Intrude / bypass security', skill:'Data Engineering', activity:''},
  mask: {name:'Mask ONI identity', skill:'Digital Networking', activity:'mask-oni'},
  trace: {name:'Trace a signal', skill:'Digital Networking', activity:'oni-netrunning'}
};
export function clone(v) { return JSON.parse(JSON.stringify(v)); }
export function text(v, max=12000) { return String(v ?? '').slice(0, max); }
export function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function int(v, lo=0, hi=6) { const n=Number(v); return Math.max(lo, Math.min(hi, Number.isFinite(n) ? Math.trunc(n) : lo)); }
export function unique(v) { return [...new Set((Array.isArray(v)?v:[]).filter(x=>typeof x==='string'))]; }
export function safeMedia(v) {
  const s=text(v, 2000).trim();
  if (!s) return '';
  if (/[<>"'\\\s]/.test(s) || /^(javascript|data|blob|file):/i.test(s)) throw new Error('Use a Foundry file path or an HTTPS media URL.');
  if (/^https:\/\//i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith('//') || s.split(/[/?#]/).includes('..')) throw new Error('Use a Foundry file path or an HTTPS media URL.');
  return s;
}
export function cleanMedia(v={}) {
  const type=['image','video','audio','document'].includes(v.type)?v.type:'image';
  return {type, path:safeMedia(v.path), caption:text(v.caption,300)};
}
export function contactRecord(v, id) {
  if (!text(v.name,120).trim()) throw new Error('A directory entry needs a name.');
  return {id, name:text(v.name,120), type:TYPES.includes(v.type)?v.type:'contact', role:text(v.role,160),
    description:text(v.description), address:text(v.address,180), portrait:safeMedia(v.portrait),
    faction:text(v.faction,160), availability:['online','busy','offline','blocked'].includes(v.availability)?v.availability:'online',
    clearance:int(v.clearance,0,5), difficulty:int(v.difficulty,0,5), actorId:text(v.actorId,100),
    gmNotes:text(v.gmNotes,24000), grants:unique(v.grants), sourceId:text(v.sourceId,100)};
}
export function evidenceRecord(v, id) {
  if (!text(v.title,160).trim()) throw new Error('Evidence needs a title.');
  return {id,title:text(v.title,160),body:text(v.body,24000),source:text(v.source,200),media:cleanMedia(v.media),
    truth:['genuine','red-herring','forged','unknown'].includes(v.truth)?v.truth:'unknown',gmNotes:text(v.gmNotes,24000),sourceId:text(v.sourceId,100)};
}
/** Deliberate allowlists. Never spread a private source record into player data. */
export function projectContact(c) {
  return {id:c.id,name:c.name,type:c.type,role:c.role,description:c.description,address:c.address,
    portrait:c.portrait,faction:c.faction,availability:c.availability,clearance:c.clearance,difficulty:c.difficulty,actorId:c.type==='pc'?c.actorId:''};
}
export function projectEvidence(e, verdict='Unverified') {
  return {id:e.id,title:e.title,body:e.body,source:e.source,media:clone(e.media),verdict:text(verdict,180)};
}
export function owns(actor, user) {
  if (!actor || !user) return false;
  if (user.isGM) return true;
  if (typeof actor.testUserPermission==='function') return actor.testUserPermission(user,'OWNER');
  return Number(actor.ownership?.[user.id] ?? actor.ownership?.default ?? 0) >= 3;
}
export function assignedCharacterId(user) { return typeof user?.character==='string'?user.character.replace(/^Actor\./,''):user?.character?.id||''; }
/** Private ONI routing ignores world-wide default Owner permissions. */
export function owners(actor, users) {
  if(!actor)return [];
  const candidates=users.filter(u=>!u.isGM&&owns(actor,u));
  const assigned=candidates.filter(u=>assignedCharacterId(u)===actor.id);
  const explicit=candidates.filter(u=>Number(actor.ownership?.[u.id]??0)>=3&&!assignedCharacterId(u));
  return unique([...assigned,...explicit].map(u=>u.id));
}
export function allowedContact(c, actorId, user) { return Boolean(c && (user?.isGM || c.grants?.includes(actorId))); }
export function initialState() { return {schema:SCHEMA,revision:0,contacts:[],evidence:[],actors:{},processed:{},outbox:[],pending:[],calls:[],operations:[],dossiers:{},research:[],imports:{},guides:{},archiveTransport:2}; }
export function endpoint(state, actorId) { return {enabled:true,jammed:false,clearance:0,trace:0,masked:false,...state.actors[actorId]}; }
export function assertOnline(state, actorId) {
  const e=endpoint(state,actorId);
  if (!e.enabled) throw new Error('ONI is off-grid. Reconnect before transmitting.');
  if (e.jammed) throw new Error('Signal blocked. Your GM must restore the connection.');
  return e;
}
export function validTransition(call, action, actorId, gm=false) {
  if (!call || TERMINAL.has(call.status)) throw new Error('This call is closed.');
  if(call.status==='ringing'&&Number(call.expiresAt)>0&&Date.now()>=call.expiresAt)throw new Error('This call has timed out.');
  if (!gm && !call.actors.includes(actorId)) throw new Error('You are not a participant in that call.');
  if (action==='accept' || action==='decline') {
    if (call.status!=='ringing') throw new Error('This call is no longer ringing.');
    if (!gm && !call.receiverActors.includes(actorId)) throw new Error('Only a called endpoint may answer.');
    return action==='accept'?'connected':'declined';
  }
  if (action==='hangup') return call.status==='ringing'?'cancelled':'ended';
  throw new Error('Unknown call action.');
}
export function canReceive(state, actorId) { const e=endpoint(state,actorId);return e.enabled&&!e.jammed; }
export function isNewer(a,b) { return Number(a?.timestamp||0)>Number(b?.timestamp||0); }
