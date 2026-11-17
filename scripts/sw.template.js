/* MeowDeck build-versioned service worker. No user data is cached by this worker. */
const PREFIX='meowdeck-shell-';
const CACHE=PREFIX+self.MEOW_BUILD_ID;
const MANIFEST='/offline-precache.json';
async function installShell(){
  const manifestResponse=await fetch(MANIFEST,{cache:'no-store'});
  if(!manifestResponse.ok)throw Error('offline manifest unavailable');
  const manifest=await manifestResponse.clone().json();
  if(manifest.buildId!==self.MEOW_BUILD_ID||!Array.isArray(manifest.urls))throw Error('offline manifest mismatch');
  const cache=await caches.open(CACHE);
  try {
    // Each install is complete or rejected. Never announce ready with missing required chunks.
    for(const url of manifest.urls){
      if(typeof url!=='string'||!url.startsWith('/')||url.startsWith('//'))throw Error('invalid offline path');
      const response=await fetch(url,{cache:'reload',redirect:'error'});
      if(!response.ok)throw Error(`precache failed: ${url}`);
      await cache.put(url,response);
    }
    await cache.put(MANIFEST,manifestResponse);
  }catch(e){await caches.delete(CACHE);throw e;}
}
self.addEventListener('install',event=>event.waitUntil(installShell()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=(await caches.keys()).filter(k=>k.startsWith(PREFIX));
  // Retain previous shell for clients that have not accepted a refresh yet.
  if(keys.length>3){for(const old of keys.filter(k=>k!==CACHE).slice(0,keys.length-3))await caches.delete(old);}
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE_AFTER_SAVE'){void self.skipWaiting();return;}
  if(event.data?.type==='OFFLINE_STATUS'){
    event.waitUntil((async()=>{
      const cache=await caches.open(CACHE);
      const stored=await cache.match(MANIFEST);
      let ready=false;
      if(stored){try{const manifest=await stored.json();ready=manifest.buildId===self.MEOW_BUILD_ID&&
        (await Promise.all(manifest.urls.map(url=>cache.match(url)))).every(Boolean);}catch{/* cache incomplete */}}
      event.ports?.[0]?.postMessage({ready});
    })());
  }
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.headers.has('RSC')||request.headers.has('Next-Router-Prefetch')||url.pathname.startsWith('/_next/data/')||url.pathname.startsWith('/api/'))return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{const online=await fetch(request);if(url.pathname==='/'&&!url.search&&online.ok&&online.headers.get('content-type')?.includes('text/html')){
        // Keep shell update atomic; cache navigation only when it is safe HTML.
        const cache=await caches.open(CACHE);await cache.put('/',online.clone());
      }return online;}catch{
        const matches=await caches.match('/',{cacheName:CACHE});if(matches)return matches;
        return Response.error();
      }
    })());return;
  }
  if(url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/assets/meowdeck/')||url.pathname.startsWith('/icons/')||url.pathname==='/manifest.webmanifest'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const matched=await cache.match(url.pathname);if(matched)return matched;
      try{return await fetch(request);}catch{return Response.error();}
    })());
  }
});
