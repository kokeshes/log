// docs/sw.js
const CACHE = "wired-cache-v9"; // ← v9に上げたならここも一致させる
const ASSETS = [
  "./",
  "./index.html",
  "./static.html",
  "./styles.css",
  "./app.js",
  "./supabase.js",
  "./noise.js",
  "./crt.js",
  "./ps1.js",
  "./audio.js",
  "./static.js",
  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/wired-girl.png",
  "./assets/lain-shadow.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async ()=>{
    const cache = await caches.open(CACHE);
    // ★ addAll が落ちてもSW全体は生かす
    for (const url of ASSETS){
      try{
        await cache.add(url);
      }catch(e){
        // 取れないやつがあっても継続
        // console.log はSWだと見づらいので無言でもOK
      }
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Supabase など外部APIは触らない（Abort増える）
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  event.respondWith((async ()=>{
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;

    try{
      const res = await fetch(req);
      // 成功したら静的ファイルだけキャッシュ
      if (req.method === "GET" && res.ok && (url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname.endsWith(".html") || url.pathname.endsWith(".png") || url.pathname.endsWith(".json"))){
        cache.put(req, res.clone()).catch(()=>{});
      }
      return res;
    }catch(e){
      // ネット死んでる時：キャッシュが無ければそのまま落とす
      return cached || Response.error();
    }
  })());
});