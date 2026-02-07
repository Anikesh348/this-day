/* eslint-disable no-undef */
const CACHE_VERSION = "full-media-v1";
const FULL_MEDIA_CACHE = `thisday-${CACHE_VERSION}`;
const MAX_ENTRIES = 60;

async function trimCache(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length <= MAX_ENTRIES) return;
    const excess = keys.length - MAX_ENTRIES;
    for (let i = 0; i < excess; i += 1) {
      await cache.delete(keys[i]);
    }
  } catch {
    // Best-effort only
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("thisday-") && name !== FULL_MEDIA_CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  const isImmichMedia = url.pathname.startsWith("/api/media/immich/");
  const isFull = url.searchParams.get("type") === "full";

  if (!isImmichMedia || !isFull) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(FULL_MEDIA_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response && response.ok) {
        cache.put(request, response.clone());
        trimCache(cache);
      }
      return response;
    })()
  );
});
