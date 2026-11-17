export type PwaState='unsupported'|'loading'|'ready'|'failed';
export interface PwaController {
  update:()=>Promise<void>;
  install:()=>Promise<void>;
  dispose:()=>void;
}
interface InstallPromptEvent extends Event {prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
export function setupPwa(callback:(status:PwaState,update:boolean,installable:boolean)=>void,canUpdate:()=>Promise<boolean>):PwaController{
  if(typeof window==='undefined'||!('serviceWorker' in navigator)||!window.isSecureContext){callback('unsupported',false,false);return {update:async()=>{},install:async()=>{},dispose:()=>{}};}
  let active=true,applyingUpdate=false,reg:ServiceWorkerRegistration|null=null,waiting:ServiceWorker|null=null,prompt:InstallPromptEvent|null=null;
  let currentStatus:PwaState='loading';
  const emit=(status:PwaState,update:boolean,installable:boolean)=>{currentStatus=status;callback(status,update,installable);};
  emit('loading',false,false);
  const onPrompt=(event:Event)=>{event.preventDefault();prompt=event as InstallPromptEvent;emit(currentStatus,Boolean(waiting),true);};
  window.addEventListener('beforeinstallprompt',onPrompt);
  const askStatus=async()=>{
    const worker=navigator.serviceWorker.controller||reg?.active;
    if(!worker)return;
    try{
      const ready=await new Promise<boolean>(resolve=>{
        const channel=new MessageChannel();const timer=window.setTimeout(()=>resolve(false),3500);
        channel.port1.onmessage=(ev:MessageEvent<{ready:boolean}>)=>{clearTimeout(timer);resolve(ev.data?.ready===true);channel.port1.close();};
        worker.postMessage({type:'OFFLINE_STATUS'},[channel.port2]);
      });
      if(active)emit(ready?'ready':'loading',Boolean(waiting),Boolean(prompt));
    }catch{if(active)emit('failed',Boolean(waiting),Boolean(prompt));}
  };
  const notifyWaiting=()=>{waiting=reg?.waiting||null;if(active&&waiting)emit(currentStatus,true,Boolean(prompt));};
  // A first-install clients.claim() must NEVER reload an active game.
  const onController=()=>{if(active&&applyingUpdate)window.location.reload();};
  navigator.serviceWorker.addEventListener('controllerchange',onController);
  void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'})
    .then(r=>{if(!active)return;reg=r;notifyWaiting();
      r.addEventListener('updatefound',()=>{const installing=r.installing;installing?.addEventListener('statechange',()=>{if(installing.state==='installed'&&navigator.serviceWorker.controller)notifyWaiting();if(installing.state==='activated')void askStatus();if(installing.state==='redundant'&&active)emit('failed',false,Boolean(prompt));});});
      void navigator.serviceWorker.ready.then(()=>askStatus());
    }).catch(()=>{if(active)emit('failed',false,false);});
  return {
    async update(){if(!waiting||!await canUpdate())return;applyingUpdate=true;waiting.postMessage({type:'ACTIVATE_AFTER_SAVE'});},
    async install(){if(prompt){await prompt.prompt();await prompt.userChoice;prompt=null;emit(currentStatus,Boolean(waiting),false);}},
    dispose(){active=false;window.removeEventListener('beforeinstallprompt',onPrompt);navigator.serviceWorker.removeEventListener('controllerchange',onController);}
  };
}
