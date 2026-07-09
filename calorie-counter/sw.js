// App-shell cache only — makes the page installable and load instantly.
// Never touches Supabase/USDA/OFF/esm.sh requests, so auth and live data
// always hit the network; only this app's own static files are cached.
const CACHE = "calorie-counter-v1";
const ASSETS = [
  "/calorie-counter/",
  "/calorie-counter/index.html",
  "/calorie-counter/manifest.json",
  "/calorie-counter/icon-192.png",
  "/calorie-counter/icon-512.png",
  "/calorie-counter/src/main.js",
  "/calorie-counter/src/auth.js",
  "/calorie-counter/src/barcode.js",
  "/calorie-counter/src/config.js",
  "/calorie-counter/src/foodSearch.js",
  "/calorie-counter/src/log.js",
  "/calorie-counter/src/mealTypes.js",
  "/calorie-counter/src/summary.js",
  "/calorie-counter/src/supabaseClient.js",
  "/calorie-counter/src/sources/off.js",
  "/calorie-counter/src/sources/taco.js",
  "/calorie-counter/src/sources/usda.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: serve the cached shell instantly, refresh it in
// the background. config.js will briefly serve stale credentials after a
// change until the next reload completes the revalidation — acceptable
// for a personal app, avoided entirely by just reloading after an update.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(event.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
