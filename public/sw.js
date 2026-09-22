'use strict';
const CACHE='vv-cockpit-shell-v1';
const ASSETS=['/','/index.html','/manifest.webmanifest','/icons/vv-cockpit.svg','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin||new URL(req.url).pathname.startsWith('/api/'))return;
  event.respondWith(fetch(req).then(response=>{
    if(response.ok && (req.mode==='navigate'||ASSETS.includes(new URL(req.url).pathname))) {
      const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(req,clone));
    }
    return response;
  }).catch(()=>caches.match(req).then(cached=>cached||Response.error())));
});
