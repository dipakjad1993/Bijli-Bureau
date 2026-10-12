/* BijliBureau Service Worker v2026.16 — offline-first.
   App shell + DB: cache-first. Live FX/climate: network-first with snapshot fallback. */
const CACHE = "bijlibureau-v2026-16";
const SHELL = ["./","./index.html","./css/styles.css?v=16","./js/database.js?v=16","./js/forensics.js?v=16","./js/app.js?v=16","./manifest.webmanifest","./methodology.html"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  const liveHost = u.hostname.includes("open.er-api.com") || u.hostname.includes("open-meteo.com") || u.hostname.includes("googletagmanager") || u.hostname.includes("google-analytics");
  if (liveHost) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
    return res;
  }).catch(() => caches.match("./index.html"))));
});
