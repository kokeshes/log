/* sw.js (SAFE for iOS PWA + Supabase) */
const CACHE_NAME = "wired-log-ps1-v4"; // ★更新したら名前を変えると確実に差し替わる
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
  // static room を使ってるなら入れてOK
  "./static.html",
  "./static.js",
  "./lain-shadow.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // addAll が落ちると install 失敗するので、できるだけ確実に入れる
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

  // 1) GET以外はSWが一切触らない（POST/PUT/DELETEは素通し）
  if (req.method !== "GET") return;

  // 2) Supabase にはSWが一切触らない（GETでもキャッシュ汚染を防ぐ）
  //    ※ project-ref.supabase.co も supabase.co を含む
  if (url.hostname.includes("supabase.co")) return;

  // 3) 同一オリジン以外も触らない（CDN等があっても安全）
  if (url.origin !== self.location.origin) return;

  // 4) ナビゲーション(HTML遷移)は「ネット優先 + オフラインなら index.html」
  const accept = req.headers.get("accept") || "";
  const isNav = req.mode === "navigate" || accept.includes("text/html");

  if (isNav) {
    event.respondWith((async () => {
      try {
        // ネット優先（最新版）
        const fresh = await fetch(req, { cache: "no-store" });
        // 成功したHTMLはキャッシュしてもOK（ただし同一オリジンのみ）
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        // オフライン時は index.html にフォールバック
        const cached = await caches.match(req);
        return cached || (await caches.match("./index.html"));
      }
    })());
    return;
  }

  // 5) 静的ファイルは「キャッシュ優先 + 背景で更新」
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      // 背景更新（失敗しても無視）
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          await cache.put(req, fresh.clone());
        } catch (e) {}
      })());
      return cached;
    }

    // 初回はネット→成功したらキャッシュ
    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      await cache.put(req, fresh.clone());
      return fresh;
    } catch (e) {
      // CSS/JS等でネットもキャッシュも無い場合は何も返せないのでそのまま落とす
      return new Response("", { status: 504, statusText: "offline" });
    }
  })());
});
