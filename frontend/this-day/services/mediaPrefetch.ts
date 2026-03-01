import { Image, Platform } from "react-native";

import api from "@/services/api";
import { apiUrl } from "@/services/apiBase";
import { ensureMediaCached } from "@/services/mediaCache";

export type MediaKind = "image" | "video" | "unknown";

export type MediaMeta = {
  id: string;
  mediaType: MediaKind;
  contentType: string | null;
  contentLength: number | null;
  requiresBrowserFallback: boolean;
};

type PrefetchOptions = {
  cancelled?: () => boolean;
  maxConcurrency?: number;
};

type ImageLoadPlanOptions = {
  preferFastStart?: boolean;
};

type RawMeta = Partial<MediaMeta> & {
  id?: unknown;
  mediaType?: unknown;
  contentType?: unknown;
  contentLength?: unknown;
  requiresBrowserFallback?: unknown;
};

const DEFAULT_META: Omit<MediaMeta, "id"> = {
  mediaType: "unknown",
  contentType: null,
  contentLength: null,
  requiresBrowserFallback: false,
};

const metaCache = new Map<string, MediaMeta>();

export function isLikelyIOSWeb() {
  if (Platform.OS !== "web") return false;
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent ?? "";
  const isIOSDevice = /iP(hone|ad|od)/.test(ua);
  const isTouchMac = /\bMacintosh\b/.test(ua) && navigator.maxTouchPoints > 1;
  return isIOSDevice || isTouchMac;
}

export function getMediaUrl(
  assetId: string,
  type: "thumbnail" | "preview" | "full" = "full",
) {
  return apiUrl(`/api/media/immich/${assetId}?type=${type}`);
}

function toUniqueAssetIds(assetIds: Array<string | null | undefined>) {
  return Array.from(new Set(assetIds.filter(Boolean) as string[]));
}

function parseRawMeta(assetId: string, raw?: RawMeta | null): MediaMeta {
  const mediaType =
    raw?.mediaType === "image" ||
    raw?.mediaType === "video" ||
    raw?.mediaType === "unknown"
      ? raw.mediaType
      : DEFAULT_META.mediaType;

  const contentType =
    typeof raw?.contentType === "string" && raw.contentType.trim().length > 0
      ? raw.contentType
      : DEFAULT_META.contentType;

  const contentLength =
    typeof raw?.contentLength === "number" && Number.isFinite(raw.contentLength)
      ? raw.contentLength
      : DEFAULT_META.contentLength;

  const requiresBrowserFallback = raw?.requiresBrowserFallback === true;

  return {
    id: assetId,
    mediaType,
    contentType,
    contentLength,
    requiresBrowserFallback,
  };
}

export async function fetchMediaMeta(
  assetIds: Array<string | null | undefined>,
): Promise<Record<string, MediaMeta>> {
  const uniqueIds = toUniqueAssetIds(assetIds);
  const result: Record<string, MediaMeta> = {};

  if (uniqueIds.length === 0) return result;

  const uncachedIds = uniqueIds.filter((id) => !metaCache.has(id));

  if (uncachedIds.length > 0) {
    try {
      const response = await api.post("/api/media/immich/meta", {
        assetIds: uncachedIds,
      });
      const items = Array.isArray(response?.data?.items)
        ? (response.data.items as RawMeta[])
        : [];

      for (const id of uncachedIds) {
        const raw = items.find((item) => item?.id === id) ?? null;
        metaCache.set(id, parseRawMeta(id, raw));
      }
    } catch {
      for (const id of uncachedIds) {
        if (!metaCache.has(id)) {
          metaCache.set(id, parseRawMeta(id, null));
        }
      }
    }
  }

  for (const id of uniqueIds) {
    result[id] = metaCache.get(id) ?? parseRawMeta(id, null);
  }

  return result;
}

async function preloadImageElement(url: string, timeoutMs = 15000) {
  if (Platform.OS !== "web") {
    await Image.prefetch(url);
    return;
  }

  if (typeof window === "undefined" || typeof window.Image === "undefined") {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const img = new window.Image();
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      img.onload = null;
      img.onerror = null;
      window.clearTimeout(timer);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("image preload timeout"));
    }, timeoutMs);

    img.onload = () => {
      cleanup();
      resolve();
    };

    img.onerror = () => {
      cleanup();
      reject(new Error("image preload failed"));
    };

    img.decoding = "async";
    img.src = url;
  });
}

export async function prefetchImageUrl(url: string, persistWebCache = false) {
  if (!url) return;

  try {
    await preloadImageElement(url);
  } catch {
    try {
      await fetch(url, {
        method: "GET",
        cache: "force-cache",
      });
    } catch {
      // Best-effort only.
    }
  }

  if (persistWebCache && Platform.OS === "web") {
    try {
      await ensureMediaCached(url);
    } catch {
      // Best-effort only.
    }
  }
}

async function runQueued(
  tasks: Array<() => Promise<void>>,
  maxConcurrency: number,
  cancelled?: () => boolean,
) {
  if (tasks.length === 0) return;

  let cursor = 0;
  const workerCount = Math.max(1, Math.min(maxConcurrency, tasks.length));

  const workers = new Array(workerCount).fill(null).map(async () => {
    while (cursor < tasks.length) {
      if (cancelled?.()) return;
      const index = cursor;
      cursor += 1;
      await tasks[index]().catch(() => {
        // Best-effort only.
      });
    }
  });

  await Promise.all(workers);
}

export async function prefetchImagesForDay(
  assetIds: string[],
  metaById: Record<string, MediaMeta>,
  options?: PrefetchOptions,
) {
  const uniqueIds = toUniqueAssetIds(assetIds);
  const imageIds = uniqueIds.filter((id) => {
    const mediaType = metaById[id]?.mediaType ?? "unknown";
    return mediaType !== "video";
  });

  if (imageIds.length === 0) return;

  const iosWeb = isLikelyIOSWeb();
  const isWeb = Platform.OS === "web";
  const thumbnailTasks = imageIds.map((id) => {
    const previewUrl = getMediaUrl(id, "preview");
    return () => prefetchImageUrl(previewUrl, false);
  });

  const maxFullPrefetch = isWeb ? (iosWeb ? 1 : 4) : 6;
  const fullTasks = imageIds
    .filter((id) => !metaById[id]?.requiresBrowserFallback)
    .slice(0, maxFullPrefetch)
    .map((id) => {
      const fullUrl = getMediaUrl(id, "full");
      const persistWebCache = isWeb && !iosWeb;
      return () => prefetchImageUrl(fullUrl, persistWebCache);
    });

  await runQueued(
    [...thumbnailTasks, ...fullTasks],
    options?.maxConcurrency ?? (isWeb ? (iosWeb ? 2 : 4) : 4),
    options?.cancelled,
  );
}

export function getImageLoadPlan(
  assetId: string,
  meta?: MediaMeta | null,
  options?: ImageLoadPlanOptions,
) {
  const fullUrl = getMediaUrl(assetId, "full");
  const previewUrl = getMediaUrl(assetId, "preview");
  const thumbnailUrl = getMediaUrl(assetId, "thumbnail");

  const isWeb = Platform.OS === "web";
  const iosWeb = isLikelyIOSWeb();
  const requiresBrowserFallback = !!meta?.requiresBrowserFallback;
  const preferFastStart = options?.preferFastStart ?? isWeb;

  const startWithPreview =
    requiresBrowserFallback || (isWeb && (preferFastStart || iosWeb));

  const primaryUrl = startWithPreview ? previewUrl : fullUrl;
  const fallbackUrls: string[] = [];

  if (primaryUrl !== fullUrl && !requiresBrowserFallback) {
    fallbackUrls.push(fullUrl);
  }
  if (primaryUrl !== previewUrl) {
    fallbackUrls.push(previewUrl);
  }
  if (!fallbackUrls.includes(thumbnailUrl) && primaryUrl !== thumbnailUrl) {
    fallbackUrls.push(thumbnailUrl);
  }

  const upgradeUrl =
    primaryUrl === previewUrl && !requiresBrowserFallback ? fullUrl : null;

  return {
    primaryUrl,
    previewUrl,
    fullUrl,
    fallbackUrls,
    upgradeUrl,
    requiresBrowserFallback,
  };
}

export function clearMediaMetaCache() {
  metaCache.clear();
}
