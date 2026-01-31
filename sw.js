/* =========================================================
   sw.js // THE WIRED
   cache-bust v4 (fix "stuck broken" PWA)
========================================================= */

const CACHE_NAME = "wired-log-ps1-v4";

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
  "./static.js",
  "./audio.js",

  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/wired-girl.png",
  "./assets/bg.jpg",

  // もしあるなら（無くてもOK、404でも致命傷ではないが気になるなら消してOK）
  "./assets/lain-shadow.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Supabase等の外部は触らない（キャッシュで壊すと地獄）
  if (url.origin !== location.origin) return;

  // HTMLは “network first” にして最新版を優先（壊れた状態を引きずらない）
  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // その他は “cache first + update in background”
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
