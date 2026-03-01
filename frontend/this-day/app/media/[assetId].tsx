import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
  Text,
  Animated,
  useWindowDimensions,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";

import { getDayEntries } from "@/services/entries";
import { Colors } from "@/theme/colors";
import { apiUrl } from "@/services/apiBase";
import { prefetchImageUrl } from "@/services/mediaPrefetch";
import { consumeMediaOpenHint } from "@/services/mediaNavigationState";

/* =========================================================
 * Writable directory helper (Expo Go safe)
 * ======================================================= */
function getWritableDir(): string | null {
  const fs = FileSystem as unknown as {
    documentDirectory?: string;
    cacheDirectory?: string;
  };
  return fs.documentDirectory ?? fs.cacheDirectory ?? null;
}

type MediaKind = "image" | "video" | "unknown";

type MediaItem = {
  id: string;
  occurrenceKey: string;
  caption?: string | null;
};

type MediaDescriptor = {
  kind: MediaKind;
  contentType: string | null;
};

const TYPE_PREFETCH_COUNT = 48;
const TYPE_PREFETCH_CONCURRENCY = 4;
const PREFETCH_RADIUS = 2;
const IMAGE_CANDIDATE_TIMEOUT_MS = 4500;

function flattenDayItems(entries: any[]): MediaItem[] {
  const result: MediaItem[] = [];

  for (const entry of entries ?? []) {
    const ids = (entry?.immichAssetIds ?? []).filter(Boolean) as string[];
    ids.forEach((id, index) => {
      result.push({
        id,
        caption: entry?.caption,
        occurrenceKey: `${entry?._id ?? "entry"}:${id}:${index}`,
      });
    });
  }

  return result;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  if (items.length === 0) return;

  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  const workers = new Array(workerCount).fill(null).map(async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]).catch(() => {
        // Best-effort only.
      });
    }
  });

  await Promise.all(workers);
}

function isLikelyIncompatibleOriginal(contentType?: string | null) {
  if (!contentType) return false;

  const normalized = contentType.toLowerCase();
  return (
    normalized.includes("heic") ||
    normalized.includes("heif") ||
    normalized.includes("tiff")
  );
}

export default function MediaViewerScreen() {
  const router = useRouter();
  const { assetId, caption, date } = useLocalSearchParams<{
    assetId: string;
    caption?: string;
    date?: string;
  }>();

  if (!assetId) return null;

  const initialHint = useMemo(
    () => consumeMediaOpenHint({ assetId, date }),
    [assetId, date],
  );

  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<MediaItem>>(null);
  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 70,
  }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index?: number | null }> }) => {
      if (viewableItems.length === 0) return;
      setActiveIndex(viewableItems[0].index ?? 0);
    },
  ).current;

  const [items, setItems] = useState<MediaItem[]>(() => {
    if (initialHint?.items?.length) {
      return initialHint.items.map((item) => ({
        id: item.id,
        occurrenceKey: item.occurrenceKey,
        caption: item.caption,
      }));
    }

    return [
      {
        id: assetId,
        occurrenceKey: `${assetId}:fallback:0`,
        caption,
      },
    ];
  });
  const [itemsLoading, setItemsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(() => {
    if (!initialHint?.items?.length) return 0;
    return Math.max(0, Math.min(initialHint.index ?? 0, initialHint.items.length - 1));
  });

  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const [downloading, setDownloading] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [mediaKinds, setMediaKinds] = useState<Record<string, MediaKind>>({});
  const [mediaContentTypes, setMediaContentTypes] = useState<
    Record<string, string | null>
  >({});

  const mediaTypeRequests = useRef(new Map<string, Promise<MediaDescriptor>>());
  const warmedImageItems = useRef(new Set<string>());
  const mediaKindsRef = useRef<Record<string, MediaKind>>({});
  const mediaContentTypesRef = useRef<Record<string, string | null>>({});

  useEffect(() => {
    mediaKindsRef.current = mediaKinds;
  }, [mediaKinds]);

  useEffect(() => {
    mediaContentTypesRef.current = mediaContentTypes;
  }, [mediaContentTypes]);

  const ensureMediaKind = useCallback(
    async (mediaId: string): Promise<MediaDescriptor> => {
      const cached = mediaKindsRef.current[mediaId];
      const cachedContentType = mediaContentTypesRef.current[mediaId] ?? null;
      if (cached && cached !== "unknown") {
        return {
          kind: cached,
          contentType: cachedContentType,
        };
      }

      const inFlight = mediaTypeRequests.current.get(mediaId);
      if (inFlight) {
        return inFlight;
      }

      const request: Promise<MediaDescriptor> = (async (): Promise<MediaDescriptor> => {
        try {
          const response = await fetch(
            apiUrl(`/api/media/immich/${mediaId}?type=full`),
            { method: "HEAD" },
          );
          const contentType = response.headers.get("content-type") ?? null;
          const normalizedType = (contentType ?? "").toLowerCase();
          const nextType: MediaKind = normalizedType.startsWith("video/")
            ? "video"
            : "image";

          mediaKindsRef.current = {
            ...mediaKindsRef.current,
            [mediaId]: nextType,
          };
          mediaContentTypesRef.current = {
            ...mediaContentTypesRef.current,
            [mediaId]: contentType,
          };

          setMediaKinds((prev) =>
            prev[mediaId] === nextType ? prev : { ...prev, [mediaId]: nextType },
          );
          setMediaContentTypes((prev) =>
            prev[mediaId] === contentType
              ? prev
              : { ...prev, [mediaId]: contentType },
          );

          return {
            kind: nextType,
            contentType,
          };
        } catch {
          mediaKindsRef.current = {
            ...mediaKindsRef.current,
            [mediaId]: "image",
          };
          mediaContentTypesRef.current = {
            ...mediaContentTypesRef.current,
            [mediaId]: null,
          };

          setMediaKinds((prev) =>
            prev[mediaId] ? prev : { ...prev, [mediaId]: "image" },
          );
          setMediaContentTypes((prev) =>
            prev[mediaId] === null ? prev : { ...prev, [mediaId]: null },
          );
          return {
            kind: "image" as MediaKind,
            contentType: null,
          };
        } finally {
          mediaTypeRequests.current.delete(mediaId);
        }
      })();

      mediaTypeRequests.current.set(mediaId, request);
      return request;
    },
    [],
  );

  /* =========================================================
   * Load day assets (for swipe)
   * ======================================================= */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setItemsLoading(true);

      try {
        if (date) {
          const [y, m, d] = date.split("-").map(Number);
          const res = await getDayEntries(y, m, d);

          const nextItems = flattenDayItems(res?.data ?? []);

          if (!cancelled && nextItems.length > 0) {
            const foundIndex = nextItems.findIndex((item) => item.id === assetId);
            setItems(nextItems);
            setActiveIndex(foundIndex >= 0 ? foundIndex : 0);
            return;
          }
        }

        if (!cancelled) {
          setItems([
            {
              id: assetId,
              occurrenceKey: `${assetId}:fallback:0`,
              caption,
            },
          ]);
          setActiveIndex(0);
        }
      } catch {
        if (!cancelled) {
          setItems([
            {
              id: assetId,
              occurrenceKey: `${assetId}:fallback:0`,
              caption,
            },
          ]);
          setActiveIndex(0);
        }
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assetId, caption, date]);

  useEffect(() => {
    const ids = Array.from(new Set(items.map((item) => item.id))).slice(
      0,
      TYPE_PREFETCH_COUNT,
    );

    void runWithConcurrency(ids, TYPE_PREFETCH_CONCURRENCY, async (id) => {
      await ensureMediaKind(id);
    });
  }, [ensureMediaKind, items]);

  useEffect(() => {
    if (items.length === 0) return;

    const start = Math.max(0, activeIndex - PREFETCH_RADIUS);
    const end = Math.min(items.length - 1, activeIndex + PREFETCH_RADIUS);
    const windowItems = items.slice(start, end + 1);

    let cancelled = false;

    const warm = async () => {
      for (const item of windowItems) {
        if (cancelled) return;

        const thumbnailUrl = apiUrl(`/api/media/immich/${item.id}?type=thumbnail`);
        const previewUrl = apiUrl(`/api/media/immich/${item.id}?type=preview`);
        const fullUrl = apiUrl(`/api/media/immich/${item.id}?type=full`);

        await prefetchImageUrl(thumbnailUrl, false).catch(() => {
          // Best-effort only.
        });

        const descriptor = await ensureMediaKind(item.id);
        if (descriptor.kind !== "image") continue;

        if (warmedImageItems.current.has(item.occurrenceKey)) continue;
        warmedImageItems.current.add(item.occurrenceKey);

        const preferredUrl = isLikelyIncompatibleOriginal(descriptor.contentType)
          ? previewUrl
          : fullUrl;

        await prefetchImageUrl(preferredUrl, Platform.OS === "web").catch(() => {
          // Best-effort only.
        });
      }
    };

    void warm();

    return () => {
      cancelled = true;
    };
  }, [activeIndex, ensureMediaKind, items]);

  /* =========================================================
   * Sync active index to assetId
   * ======================================================= */
  useEffect(() => {
    if (items.length === 0) return;
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({
          index: activeIndex,
          animated: false,
        });
      } catch {}
    });
  }, [items, activeIndex]);

  /* =========================================================
   * Controls toggle
   * ======================================================= */
  const toggleControls = () => {
    const nextVisible = !controlsVisible;
    Animated.timing(controlsOpacity, {
      toValue: nextVisible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setControlsVisible(nextVisible));
  };

  const handlePrev = () => {
    const nextIndex = Math.max(activeIndex - 1, 0);
    if (nextIndex === activeIndex) return;
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setActiveIndex(nextIndex);
  };

  const handleNext = () => {
    const nextIndex = Math.min(activeIndex + 1, items.length - 1);
    if (nextIndex === activeIndex) return;
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setActiveIndex(nextIndex);
  };

  /* =========================================================
   * Download
   * ======================================================= */
  const handleDownload = async () => {
    const current = items[activeIndex];
    if (!current) return;

    const mediaUrl = apiUrl(`/api/media/immich/${current.id}?type=full`);

    if (Platform.OS === "web") {
      window.open(mediaUrl, "_blank");
      return;
    }

    try {
      setDownloading(true);
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) return;

      const dir = getWritableDir();
      if (!dir) return;

      let ext = "jpg";
      try {
        const descriptor = await ensureMediaKind(current.id);
        if (descriptor.kind === "video") ext = "mp4";
      } catch {
        ext = "jpg";
      }

      const fileUri = `${dir}${current.id}.${ext}`;

      const { uri } = await FileSystem.downloadAsync(mediaUrl, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
    } finally {
      setDownloading(false);
    }
  };

  /* =========================================================
   * Render
   * ======================================================= */
  return (
    <View style={styles.root}>
      <StatusBar style="light" hidden={!controlsVisible} />

      <FlatList
        ref={listRef}
        data={items}
        horizontal
        pagingEnabled
        key={width}
        keyExtractor={(item) => item.occurrenceKey}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <MediaSlide
            item={item}
            mediaType={mediaKinds[item.id] ?? "unknown"}
            imageContentType={mediaContentTypes[item.id] ?? null}
            width={width}
            height={height}
            isActive={index === activeIndex}
            onToggleControls={toggleControls}
          />
        )}
        ListEmptyComponent={
          <View style={[styles.loadingWrap, { width, height }]}> 
            <ActivityIndicator size="large" color="white" />
          </View>
        }
      />

      {/* Top gradient */}
      <LinearGradient
        colors={["rgba(3,5,10,0.9)", "transparent"]}
        style={styles.topGradient}
        pointerEvents="none"
      />

      {/* Bottom gradient */}
      <LinearGradient
        colors={["transparent", "rgba(3,5,10,0.95)"]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Overlays */}
      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <Animated.View style={[styles.topBar, { opacity: controlsOpacity }]}> 
          <IconButton icon="close" onPress={() => router.back()} />
          <View style={styles.topCenter}>
            {items.length > 0 && (
              <View style={styles.indexPill}>
                <Text style={styles.indexText}>
                  {activeIndex + 1} / {items.length}
                </Text>
              </View>
            )}
          </View>
          <IconButton
            icon="download-outline"
            onPress={handleDownload}
            loading={downloading}
          />
        </Animated.View>

        <Animated.View
          style={[styles.bottomBar, { opacity: controlsOpacity }]}
        >
          {!!items[activeIndex]?.caption && (
            <View style={styles.captionCard}>
              <Text style={styles.captionText}>
                {items[activeIndex]?.caption}
              </Text>
            </View>
          )}
        </Animated.View>

        {items.length > 1 && (
          <Animated.View
            style={[styles.navButtons, { opacity: controlsOpacity }]}
            pointerEvents={controlsVisible ? "box-none" : "none"}
          >
            <Pressable
              onPress={handlePrev}
              style={({ pressed }) => [
                styles.navButton,
                styles.navLeft,
                pressed && { opacity: 0.7 },
                activeIndex === 0 && styles.navDisabled,
              ]}
              disabled={activeIndex === 0}
            >
              <Ionicons name="chevron-back" size={22} color="white" />
            </Pressable>
            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [
                styles.navButton,
                styles.navRight,
                pressed && { opacity: 0.7 },
                activeIndex === items.length - 1 && styles.navDisabled,
              ]}
              disabled={activeIndex === items.length - 1}
            >
              <Ionicons name="chevron-forward" size={22} color="white" />
            </Pressable>
          </Animated.View>
        )}
      </SafeAreaView>

      {itemsLoading && items.length === 0 && (
        <View style={[styles.loadingOverlay, { width, height }]}> 
          <ActivityIndicator size="large" color="white" />
        </View>
      )}
    </View>
  );
}

/* =========================================================
 * Slide
 * ======================================================= */
function MediaSlide({
  item,
  mediaType,
  imageContentType,
  width,
  height,
  isActive,
  onToggleControls,
}: {
  item: MediaItem;
  mediaType: MediaKind;
  imageContentType: string | null;
  width: number;
  height: number;
  isActive: boolean;
  onToggleControls: () => void;
}) {
  const mediaUrl = apiUrl(`/api/media/immich/${item.id}?type=full`);
  const previewUrl = apiUrl(`/api/media/immich/${item.id}?type=preview`);
  const thumbnailUrl = apiUrl(`/api/media/immich/${item.id}?type=thumbnail`);
  const videoRef = useRef<Video>(null);
  const webVideoRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [webAutoplayBlocked, setWebAutoplayBlocked] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [imageCandidateIndex, setImageCandidateIndex] = useState(0);

  const imageCandidates = useMemo(() => {
    if (mediaType === "video") return [];
    if (mediaType === "unknown") return [previewUrl, thumbnailUrl];

    if (isLikelyIncompatibleOriginal(imageContentType)) {
      return [previewUrl, thumbnailUrl];
    }

    return [mediaUrl, previewUrl, thumbnailUrl];
  }, [imageContentType, mediaType, mediaUrl, previewUrl, thumbnailUrl]);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setIsPlaying(false);
    setWebAutoplayBlocked(false);
    setImageCandidateIndex(0);
  }, [item.occurrenceKey, retryToken]);

  useEffect(() => {
    if (mediaType === "video") return;
    if (error || !loading) return;
    if (imageCandidates.length === 0) return;

    const timeoutId = setTimeout(() => {
      if (imageCandidateIndex < imageCandidates.length - 1) {
        setImageCandidateIndex((prev) =>
          Math.min(prev + 1, imageCandidates.length - 1),
        );
        return;
      }

      setError(true);
      setLoading(false);
    }, IMAGE_CANDIDATE_TIMEOUT_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [error, imageCandidateIndex, imageCandidates.length, loading, mediaType]);

  /* =========================================================
   * Playback state (iOS replay fix included)
   * ======================================================= */
  const onPlaybackStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if ("error" in status) {
        setError(true);
        setLoading(false);
      }
      return;
    }

    setIsPlaying(status.isPlaying);

    if (status.didJustFinish && !status.isLooping) {
      videoRef.current?.setPositionAsync(0);
    }
  };

  /* =========================================================
   * Auto play/pause when slide becomes active
   * ======================================================= */
  useEffect(() => {
    if (mediaType !== "video" || Platform.OS === "web") return;

    let cancelled = false;
    requestAnimationFrame(() => {
      if (cancelled) return;
      (async () => {
        try {
          if (isActive) {
            await videoRef.current?.playAsync();
          } else {
            await videoRef.current?.pauseAsync();
          }
        } catch {
          // Best-effort only; ignore play/pause errors during transitions.
        }
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [isActive, mediaType]);

  /* =========================================================
   * Web autoplay/pause handling
   * ======================================================= */
  useEffect(() => {
    if (mediaType !== "video" || Platform.OS !== "web") return;
    const el = webVideoRef.current as
      | (HTMLVideoElement & { play?: () => Promise<void> })
      | null;
    if (!el) return;

    if (isActive && !webAutoplayBlocked) {
      try {
        el.muted = false;
      } catch {}
      const maybePromise = el.play?.();
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(() => setWebAutoplayBlocked(true));
      }
    } else {
      try {
        el.pause?.();
        el.currentTime = 0;
      } catch {}
    }
  }, [isActive, mediaType, webAutoplayBlocked]);

  const retryLoad = () => {
    setRetryToken((t) => t + 1);
  };

  const handleWebPlayWithSound = async () => {
    const el = webVideoRef.current as
      | (HTMLVideoElement & { play?: () => Promise<void> })
      | null;
    if (!el) return;
    try {
      el.muted = false;
      const maybePromise = el.play?.();
      if (maybePromise) {
        await maybePromise;
      }
      setWebAutoplayBlocked(false);
    } catch {
      setWebAutoplayBlocked(true);
    }
  };

  return (
    <View style={[styles.slide, { width, height }]}>
      {mediaType !== "video" && (
        <Pressable style={styles.pressableFill} onPress={onToggleControls}>
          <ExpoImage
            key={`${item.occurrenceKey}:${retryToken}`}
            source={{ uri: imageCandidates[imageCandidateIndex] ?? thumbnailUrl }}
            placeholder={{ uri: thumbnailUrl }}
            style={styles.media}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={120}
            onLoad={() => setLoading(false)}
            onDisplay={() => setLoading(false)}
            onError={() => {
              if (imageCandidateIndex < imageCandidates.length - 1) {
                setImageCandidateIndex((prev) => prev + 1);
                setLoading(true);
                return;
              }

              setError(true);
              setLoading(false);
            }}
          />
        </Pressable>
      )}

      {mediaType === "video" &&
        (Platform.OS === "web" ? (
          <video
            ref={webVideoRef}
            src={mediaUrl}
            controls
            autoPlay={isActive}
            muted={false}
            playsInline
            preload="metadata"
            onLoadedData={() => setLoading(false)}
            onError={() => {
              setError(true);
              setLoading(false);
            }}
            loop
            style={styles.webVideo}
          />
        ) : (
          <View style={styles.videoWrap}>
            <Video
              ref={videoRef}
              source={{ uri: mediaUrl }}
              style={styles.media}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={isActive}
              isMuted={false}
              volume={1.0}
              isLooping
              useNativeControls
              onLoad={() => setLoading(false)}
              onPlaybackStatusUpdate={onPlaybackStatus}
            />
            <View pointerEvents="box-none" style={styles.videoOverlay}>
              <Pressable
                onPress={async () => {
                  if (isPlaying) {
                    await videoRef.current?.pauseAsync();
                  } else {
                    await videoRef.current?.playAsync();
                  }
                }}
                style={({ pressed }) => [
                  styles.videoControlButton,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={26}
                  color="white"
                />
              </Pressable>
            </View>
          </View>
        ))}

      {loading && (
        <View pointerEvents="none" style={styles.slideLoadingOverlay}>
          <ActivityIndicator size="large" color="white" />
        </View>
      )}
      {Platform.OS === "web" && isActive && webAutoplayBlocked && (
        <View pointerEvents="box-none" style={styles.videoOverlay}>
          <Pressable
            onPress={handleWebPlayWithSound}
            style={({ pressed }) => [
              styles.videoControlButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="volume-high" size={26} color="white" />
          </Pressable>
          <Text style={styles.webHintText}>Tap to play with sound</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Failed to load media</Text>
          <Pressable
            onPress={retryLoad}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/* =========================================================
 * Icon Button
 * ======================================================= */
function IconButton({
  icon,
  onPress,
  loading,
}: {
  icon: any;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.iconButton}>
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Ionicons name={icon} size={22} color="white" />
      )}
    </Pressable>
  );
}

/* =========================================================
 * Styles
 * ======================================================= */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#05070C",
  },

  slide: {
    justifyContent: "center",
    backgroundColor: "#05070C",
  },

  pressableFill: {
    flex: 1,
  },

  media: { width: "100%", height: "100%" },

  webVideo: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    backgroundColor: "black",
  },

  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "space-between",
  },

  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },

  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 240,
  },

  topBar: {
    paddingHorizontal: 16,
    paddingTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  topCenter: {
    alignItems: "center",
    justifyContent: "center",
  },

  indexPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  indexText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    letterSpacing: 0.4,
  },

  bottomBar: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 8,
  },

  captionCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(8,10,16,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  captionText: {
    color: Colors.dark.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  errorText: {
    color: "#aaa",
    textAlign: "center",
    marginTop: 20,
  },

  errorWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },

  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  retryText: {
    color: Colors.dark.textPrimary,
    fontSize: 14,
    letterSpacing: 0.2,
  },

  webHintText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  slideLoadingOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(3,5,10,0.65)",
  },

  videoWrap: {
    flex: 1,
  },

  videoOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  videoControlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  navButtons: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
  },

  navButton: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  navLeft: {
    left: 10,
  },

  navRight: {
    right: 10,
  },

  navDisabled: {
    opacity: 0.35,
  },
});
