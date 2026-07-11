// App-shell cache only — makes the page installable and load instantly.
// Never touches Supabase/USDA/OFF/esm.sh requests, so auth and live data
// always hit the network; only this app's own static files are cached.
const CACHE = "calorie-counter-v2";
const ASSETS = [
  "/calorie-counter/",
  "/calorie-counter/index.html",
  "/calorie-counter/manifest.json",
  "/calorie-counter/icon-192.png",
  "/calorie-counter/icon-512.png",
  "/calorie-counter/src/main.js",
  "/calorie-counter/src/auth.js",
  "/calorie-counter/src/barcode.js",
  "/calorie-counter/src/bodyLog.js",
  "/calorie-counter/src/config.js",
  "/calorie-counter/src/foodSearch.js",
  "/calorie-counter/src/log.js",
  "/calorie-counter/src/mealTypes.js",
  "/calorie-counter/src/summary.js",
  "/calorie-counter/src/supabaseClient.js",
  "/calorie-counter/src/targets.js",
  "/calorie-counter/src/trends.js",
  "/calorie-counter/src/sources/off.js",
  "/calorie-counter/src/sources/recipes.js",
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

// Network-first, falling back to cache only when offline. This app is
// under frequent active development — a stale-while-revalidate strategy
// (serve cache instantly, refresh in the background) meant a fix could be
// live on the server for several reloads before a given browser actually
// showed it, since the *page's* code only updates from whatever the
// background fetch cached on some *previous* load. Network-first trades a
// few milliseconds of latency (negligible for these file sizes) for
// always running the latest deployed code whenever there's a connection;
// the cache still serves the app shell when there isn't one.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(event.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
