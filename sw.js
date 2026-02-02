/* docs/sw.js (SAFE for PWA + Supabase) */
const CACHE_NAME = "wired-log-ps1-v10"; // ★更新したら必ず増やす
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./supabase.js",
  "./noise.js",
  "./crt.js",
  "./ps1.js",
  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/wired-girl.png",
  "./assets/bg.jpg",
  "./static.html",
  "./static.js",
  "./assets/lain-shadow.png",
  "./audio.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ✅ Supabase は SW が一切触らない（GETでも！）
  if (url.hostname.includes("supabase.co")) return;

  // GET以外はSWが触らない（POST/PUT/DELETE素通し）
  if (req.method !== "GET") return;

  // 同一オリジン以外は触らない
  if (url.origin !== self.location.origin) return;

  const accept = req.headers.get("accept") || "";
  const isNav = req.mode === "navigate" || accept.includes("text/html");

  // ナビゲーションはネット優先、落ちたらキャッシュ
  if (isNav) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(req)) || (await caches.match("./index.html"));
      }
    })());
    return;
  }

  // 静的ファイルはキャッシュ優先＋裏で更新
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          await cache.put(req, fresh.clone());
        } catch {}
      })());
      return cached;
    }

    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      await cache.put(req, fresh.clone());
      return fresh;
    } catch {
      return new Response("", { status: 504, statusText: "offline" });
    }
  })());
});
