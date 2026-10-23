const BASE=new URL('./',self.registration.scope).pathname;
const CACHE='frame-shell-v8';
const SHELL=[BASE,BASE+'index.html',BASE+'manifest.webmanifest',BASE+'frame-logo.svg',BASE+'frame-ultra-instinct.svg'];
const cacheKey=url=>new URL(url,self.location.origin).pathname;
const isAsset=request=>/\.(?:js|css|woff2?|png|jpe?g|webp|svg|ico|json)$/i.test(new URL(request.url).pathname);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 const fallback=BASE+'index.html';
 if(request.mode==='navigate'){
  if(!isAsset(request))return;
 event.respondWith(fetch(request).then(response=>{const copy=response.clone();void caches.open(CACHE).then(c=>c.put(fallback,copy));return response}).catch(()=>caches.match(fallback)));
  return;
 }
 event.respondWith(fetch(request).then(response=>{
  if(response.ok)void caches.open(CACHE).then(c=>c.put(cacheKey(request.url),response.clone()));
  return response;
 }).catch(()=>caches.match(cacheKey(request.url))));
});