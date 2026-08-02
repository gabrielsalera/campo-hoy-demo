const CACHE = "campo-hoy-integral-v8-6-demo-2";
const APP_ASSETS = [
  "./",
  "index.html",
  "styles.css?v=8.6",
  "app.js?v=8.6",
  "supabase-lite.js?v=8.6",
  "config.js",
  "manifest.webmanifest",
  "icon.svg",
  "data/initial-data.json",
  "data/profiles.json",
  "data/heifers.json",
  "data/audit.json"
];
const OPTIONAL_ASSETS = [
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(async (cache) => {
        await cache.addAll(APP_ASSETS);
        await Promise.allSettled(OPTIONAL_ASSETS.map((url) => cache.add(new Request(url, { mode: "cors" }))));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put("index.html", response.clone());
    }
    return response;
  } catch (_error) {
    return (await caches.match("index.html")) || (await caches.match("./"));
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }
  const isAppAsset = url.origin === self.location.origin;
  const isOptionalAsset = OPTIONAL_ASSETS.includes(url.href);
  if (isAppAsset || isOptionalAsset) event.respondWith(cacheFirst(event.request));
});
