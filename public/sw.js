const CACHE='frame-shell-v2';
const SHELL=['/','/index.html','/manifest.webmanifest','/favicon.svg','/frame-ultra-instinct.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{const copy=response.clone();void caches.open(CACHE).then(c=>c.put('/index.html',copy));return response}).catch(()=>caches.match('/index.html')));
  return;
 }
 event.respondWith(caches.match(request).then(cached=>{
  const fresh=fetch(request).then(response=>{if(response.ok)void caches.open(CACHE).then(c=>c.put(request,response.clone()));return response}).catch(()=>cached);
  return cached||fresh;
 }));
});
