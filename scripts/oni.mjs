import {ID,owns} from './domain.mjs';
import {ONIRuntime,registerSettings} from './runtime.mjs';
import {ONIApplication,unlockAudio} from './app.mjs';
let runtime,app;
export function openONI(actor=null) {
  unlockAudio();
  if(!runtime){ui.notifications.warn('ONI is still initializing.');return;}
  if(actor&&!runtime.canUseEndpoint(actor)){ui.notifications.warn('Select a character you own.');return;}
  app??=new ONIApplication(runtime,{actorId:actor?.id});
  if(actor)app.actorId=actor.id;
  else if(!game.actors.get(app.actorId)||!runtime.canUseEndpoint(game.actors.get(app.actorId)))app.actorId=app.initialActor();
  app.render({force:true});return app;
}
export function addControl(controls) {
  const tool={name:'acONI',title:'ONI · contacts, calls & evidence',icon:'fa-solid fa-eye',button:true,visible:true,onChange:()=>openONI()};
  if(controls?.tokens?.tools){tool.order=Object.keys(controls.tokens.tools).length;controls.tokens.tools.acONI=tool;}
}
Hooks.once('init',()=>{
  registerSettings();
  game.keybindings.register(ID,'open',{name:'Open ONI',editable:[{key:'KeyO',modifiers:['ALT']}],onDown:()=>{openONI();return true;},restricted:false});
});
Hooks.on('getSceneControlButtons',addControl);
Hooks.on('renderTokenHUD',(hud,html)=>{
  const actor=hud.object?.actor;if(!actor||!(runtime?runtime.canUseEndpoint(actor):owns(actor,game.user)))return;
  const root=html instanceof HTMLElement?html:html?.[0];const col=root?.querySelector('.col.right');if(!col||col.querySelector('[data-oni-hud]'))return;
  const b=document.createElement('button');b.type='button';b.className='control-icon';b.dataset.oniHud='true';b.title='Open ONI';b.setAttribute('aria-label','Open ONI contacts, calls and evidence');b.innerHTML='<i class="fa-solid fa-eye"></i>';
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openONI(actor);});col.appendChild(b);
});
Hooks.on('renderChatMessageHTML',(message,html)=>{
  if(message.getFlag(ID,'sealed')){const root=html instanceof HTMLElement?html:html?.[0];if(root)root.style.display='none';}
});
Hooks.once('ready',async()=>{
  if(game.system.id!=='altered-carbon-rpg'){ui.notifications.error('ONI requires the Altered Carbon RPG system.');return;}
  runtime=new ONIRuntime();app=new ONIApplication(runtime);
  const publicAPI={version:'1.2.0',open:openONI,
    contacts:actor=>runtime.directory(actor?.id||game.user.character?.id).contacts,
    send:options=>runtime.request('send',options),
    dispatch:options=>{if(!game.user.isGM)throw new Error('GM access required.');return runtime.request('dispatch',options);},
    importColdStorage:()=>{if(!game.user.isGM)throw new Error('GM access required.');return runtime.request('import-cold');},
    syncRoster:()=>{if(!game.user.isGM)throw new Error('GM access required.');return runtime.request('sync-roster');},
    research:actor=>runtime.actorResearch(actor?.id||game.user.character?.id),
    releaseContact:options=>{if(!game.user.isGM)throw new Error('GM access required.');return runtime.request('contact-release',options);},
    releaseContacts:options=>{if(!game.user.isGM)throw new Error('GM access required.');return runtime.request('release-contacts',options);},
    releaseLifetimes:options=>{if(!game.user.isGM)throw new Error('GM access required.');return runtime.request('release-lifetimes',options);},
    assignPlayer:options=>{if(!game.user.isGM)throw new Error('GM access required.');return runtime.request('assign-player',options);},
    rebuildArchive:options=>{if(!game.user.isGM)throw new Error('GM access required.');return runtime.request('rebuild-archive',options);},
    releaseResearch:options=>{if(!game.user.isGM)throw new Error('GM access required.');return runtime.request('research-release',options);},
    releaseScene:options=>{if(!game.user.isGM)throw new Error('GM access required.');return runtime.request('scene-release',options);},
    diagnostics:()=>{if(!game.user.isGM)throw new Error('GM access required.');return runtime.diagnostics();},
    repair:()=>{if(!game.user.isGM)throw new Error('GM access required.');return runtime.request('repair');},
    refresh:()=>runtime.request('sync',{actorId:game.user.character?.id||app.actorId})};
  game.modules.get(ID).api=publicAPI;game.acONI=publicAPI;
  await runtime.start();
});
