/* sw.js — THE WIRED LOG
   cache bust: bump CACHE_NAME when you change core files
*/2
const CACHE_NAME = "wired-log-v12";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./supabase.js",
  "./audio.js",
  "./noise.js",
  "./ps1.js",
  "./crt.js",
  "./static.html",
  "./static.js",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE);
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // remove old caches
      const keys = await caches.keys();
      await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // only GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Supabase / external assets should go network-first (don't cache)
  if (url.origin !== location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      // For navigation, try network first then cache
      if (req.mode === "navigate") {
        try{
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put("./index.html", fresh.clone());
          return fresh;
        }catch(_){
          const cached = await caches.match("./index.html");
          return cached || Response.error();
        }
      }

      // For other requests: cache-first, then network
      const cached = await caches.match(req);
      if (cached) return cached;

      try{
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      }catch(_){
        return cached || Response.error();
      }
    })()
  );
});
