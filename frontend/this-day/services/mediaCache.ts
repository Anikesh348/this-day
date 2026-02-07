import { Platform } from "react-native";

export const CACHE_PREFIX = "thisday-";
export const MEDIA_CACHE_NAME = `${CACHE_PREFIX}full-media-v2`;

const isWeb = Platform.OS === "web";

export async function ensureMediaCached(url: string) {
  if (!isWeb) return;
  if (!("caches" in window)) return;

  const cache = await window.caches.open(MEDIA_CACHE_NAME);
  const cached = await cache.match(url, { ignoreVary: true });
  if (cached) return;

  const response = await fetch(url, { cache: "reload" });
  if (response && response.ok) {
    await cache.put(url, response.clone());
  }
}

export async function getCachedBlobUrl(url: string) {
  if (!isWeb) return null;
  if (!("caches" in window)) return null;

  const cache = await window.caches.open(MEDIA_CACHE_NAME);
  const cached = await cache.match(url, { ignoreVary: true });
  if (!cached) return null;

  const blob = await cached.blob();
  return URL.createObjectURL(blob);
}

export async function fetchAndCacheBlobUrl(url: string) {
  if (!isWeb) return null;
  if (!("caches" in window)) return null;

  const response = await fetch(url, { cache: "reload" });
  if (!response || !response.ok) return null;

  try {
    const cache = await window.caches.open(MEDIA_CACHE_NAME);
    await cache.put(url, response.clone());
  } catch {
    // Best-effort only
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
