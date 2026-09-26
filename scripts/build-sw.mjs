import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
const root = path.resolve("out");
const icon = await fs.readFile("public/pullup-logo.png");
for (const [name, size] of [
  ["pullup-192.png", 192],
  ["pullup-512.png", 512],
  ["pullup-apple-touch.png", 180],
]) {
  const buffer = await sharp(icon).resize(size, size).png().toBuffer();
  await fs.writeFile(path.join(root, name), buffer);
  await fs.writeFile(path.join("public", name), buffer);
}
async function walk(dir) {
  const result = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(p)));
    else if (!entry.name.endsWith(".map") && entry.name !== "sw.js")
      result.push(p);
  }
  return result;
}
const files = await walk(root),
  hash = crypto.createHash("sha256");
for (const file of files) hash.update(await fs.readFile(file));
const version = hash.digest("hex").slice(0, 14);
const urls = files.map(
  (f) => "/" + path.relative(root, f).replaceAll("\\", "/"),
);
urls.push("/");
await fs.writeFile(
  path.join(root, "sw.js"),
  `
const CACHE='training-${version}';
const ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('training-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html')));return;
 }
 if(ASSETS.includes(url.pathname))event.respondWith(caches.match(url.pathname).then(cached=>cached||fetch(event.request)));
});
`,
);
console.log("Offline shell and iPhone icons ready. Cache version:", version);

