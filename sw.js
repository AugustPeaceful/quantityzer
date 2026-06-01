const CACHE='quantityzer-v1';
const ASSETS=['/','/index.html','/app.js','/manifest.json','/icons/icon-192.png','/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(ASSETS.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  if(e.request.url.includes('api.anthropic.com'))return;
  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{ if(r.ok){const cl=r.clone();caches.open(CACHE).then(ca=>ca.put(e.request,cl));} return r; }).catch(()=>caches.match('/index.html'))));
});
