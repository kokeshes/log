// docs/sw.js (RESTORE SW)
// 目的：壊れたキャッシュを強制的に掃除して、最新を取りに行く。
// “オフライン対応”は復旧後に戻す。

const CACHE_NAME = "wired-restore-v1";

// 最低限だけ（壊れやすいJS群は入れない）
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/wired-girl.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

// “GETだけ”
// 基本：ネット優先（死んでたらキャッシュ）
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith((async ()=>{
    try{
      const res = await fetch(req, { cache: "no-store" });
      // 最新取れたらキャッシュ更新
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
      return res;
    }catch{
      const cached = await caches.match(req);
      return cached || caches.match("./index.html");
    }
  })());
});
