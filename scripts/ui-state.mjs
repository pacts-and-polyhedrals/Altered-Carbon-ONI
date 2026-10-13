/** Preserve native DOM state across ApplicationV2 part replacement. */
function formKey(form) {
  const id=form?.querySelector('[name="id"],[name="contactId"],[name="requestId"],[name="callId"],[name="dossierId"],[name="sceneId"]')?.value||'';
  return `${form?.dataset.oniForm||''}:${id}`;
}
function detailKey(el,index) { return el.dataset.oniState||`${formKey(el.closest('form'))}:${el.querySelector('summary')?.textContent.trim()||''}:${index}`; }
function controlKey(el) {
  if(el.id)return `id:${el.id}`;
  if(el.dataset.oniSelect)return `select:${el.dataset.oniSelect}`;
  if(el.dataset.oniFilter)return `filter:${el.dataset.oniFilter}`;
  if(el.tagName==='SUMMARY')return `summary:${el.parentElement.dataset.oniState||el.textContent.trim()}`;
  if(el.dataset.oni)return `action:${el.dataset.oni}:${el.dataset.id||''}`;
  return `field:${formKey(el.closest('form'))}:${el.name||''}:${['checkbox','radio'].includes(el.type)?el.value:''}`;
}
const scrollers=root=>[root,...root.querySelectorAll('.window-content,[data-oni-scroll],.oni-list,.oni-table-wrap,.oni-lines')];
const scrollKey=(el,index)=>el.dataset.oniScroll||`${el.className}:${index}`;
export function captureViewState(root) {
  if(!root)return null;
  const active=root.ownerDocument.activeElement;
  return {scroll:scrollers(root).map((el,i)=>({key:scrollKey(el,i),top:el.scrollTop,left:el.scrollLeft})),
    details:[...root.querySelectorAll('details')].map((el,i)=>({key:detailKey(el,i),open:el.open})),
    focus:root.contains(active)?{key:controlKey(active),start:active.selectionStart,end:active.selectionEnd}:null};
}
export function restoreViewState(root,state) {
  if(!root||!state)return;
  for(const [i,el] of [...root.querySelectorAll('details')].entries()){
    const old=state.details.find(s=>s.key===detailKey(el,i));if(old)el.open=old.open;
  }
  if(state.focus){
    const el=[...root.querySelectorAll('input,select,textarea,summary,button')].find(el=>controlKey(el)===state.focus.key);
    if(el){el.focus({preventScroll:true});if(typeof state.focus.start==='number')try{el.setSelectionRange(state.focus.start,state.focus.end);}catch{}}
  }
  for(const [i,el] of scrollers(root).entries()){
    const old=state.scroll.find(s=>s.key===scrollKey(el,i));if(old){el.scrollTop=old.top;el.scrollLeft=old.left;}
  }
}
