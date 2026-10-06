import fs from 'node:fs';
import crypto from 'node:crypto';
const base = '/peyrieu-school-demo/';
const list = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? list(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
const files = list('dist')
  .filter((f) => !f.endsWith('sw.js'))
  .map((f) => base + f.slice(5));
const hash = crypto.createHash('sha256');
list('dist')
  .filter((f) => !f.endsWith('sw.js'))
  .sort()
  .forEach((f) => hash.update(fs.readFileSync(f)));
const version = hash.digest('hex').slice(0, 12);
fs.writeFileSync(
  'dist/sw.js',
  `const CACHE='peyrieu-demo-${version}';const BASE=${JSON.stringify(base)};const ASSETS=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('peyrieu-demo-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;event.respondWith(caches.open(CACHE).then(async cache=>{if(event.request.mode==='navigate'){try{return await fetch(event.request)}catch{return await cache.match(BASE+'index.html')}}return await cache.match(event.request,{ignoreVary:true})||fetch(event.request)}))});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.openWindow(BASE+'#/notifications'))});
`,
);
console.log(`Scoped service worker: ${files.length} assets; ${version}`);
