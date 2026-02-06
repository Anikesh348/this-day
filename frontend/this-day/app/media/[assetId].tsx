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
import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDayEntries } from "@/services/entries";
import { Colors } from "@/theme/colors";

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

type MediaKind = "image" | "video";

type MediaItem = {
  id: string;
  caption?: string | null;
};

export default function MediaViewerScreen() {
  const router = useRouter();
  const { assetId, caption, date } = useLocalSearchParams<{
    assetId: string;
    caption?: string;
    date?: string;
  }>();

  if (!assetId) return null;

  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<MediaItem>>(null);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const [downloading, setDownloading] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

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

          const nextItems: MediaItem[] = [];
          for (const entry of res.data ?? []) {
            const ids = (entry.immichAssetIds ?? []).filter(Boolean) as string[];
            for (const id of ids) {
              nextItems.push({ id, caption: entry.caption });
            }
          }

          if (!cancelled && nextItems.length > 0) {
            setItems(nextItems);
            return;
          }
        }

        if (!cancelled) {
          setItems([{ id: assetId, caption }]);
        }
      } catch {
        if (!cancelled) {
          setItems([{ id: assetId, caption }]);
        }
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assetId, caption, date]);

  /* =========================================================
   * Sync active index to assetId
   * ======================================================= */
  const initialIndex = useMemo(() => {
    const found = items.findIndex((item) => item.id === assetId);
    return found >= 0 ? found : 0;
  }, [items, assetId]);

  useEffect(() => {
    if (items.length === 0) return;
    setActiveIndex(initialIndex);
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
      } catch {}
    });
  }, [items, initialIndex]);

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

  /* =========================================================
   * Download
   * ======================================================= */
  const handleDownload = async () => {
    const current = items[activeIndex];
    if (!current) return;

    const mediaUrl = `https://thisdayapi.hostingfrompurva.xyz/api/media/immich/${current.id}?type=full`;

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
        const res = await fetch(mediaUrl, {
          headers: { Range: "bytes=0-1" },
        });
        const type = res.headers.get("content-type") ?? "";
        if (type.startsWith("video/")) ext = "mp4";
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
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={({ viewableItems }) => {
          if (viewableItems.length === 0) return;
          setActiveIndex(viewableItems[0].index ?? 0);
        }}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 70 }}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <MediaSlide
            item={item}
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
          {items.length > 1 && (
            <Text style={styles.hintText}>Swipe to see more</Text>
          )}
        </Animated.View>
      </SafeAreaView>

      {itemsLoading && (
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
  width,
  height,
  isActive,
  onToggleControls,
}: {
  item: MediaItem;
  width: number;
  height: number;
  isActive: boolean;
  onToggleControls: () => void;
}) {
  const mediaUrl = `https://thisdayapi.hostingfrompurva.xyz/api/media/immich/${item.id}?type=full`;
  const videoRef = useRef<Video>(null);
  const imageOpacity = useRef(new Animated.Value(0)).current;

  const [mediaType, setMediaType] = useState<MediaKind | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [localVideoUri, setLocalVideoUri] = useState<string | null>(null);

  /* =========================================================
   * Detect media type
   * ======================================================= */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setLocalVideoUri(null);
    imageOpacity.setValue(0);

    (async () => {
      try {
        const res = await fetch(mediaUrl, {
          headers: { Range: "bytes=0-1" },
        });
        const type = res.headers.get("content-type") ?? "";
        if (!cancelled) {
          setMediaType(type.startsWith("video/") ? "video" : "image");
        }
      } catch {
        if (!cancelled) setMediaType("image");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item.id]);

  /* =========================================================
   * Optional video preload (only when active)
   * ======================================================= */
  useEffect(() => {
    if (mediaType !== "video") return;
    if (Platform.OS === "web" || !isActive) {
      setLoading(false);
      return;
    }

    const dir = getWritableDir();
    if (!dir) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const fileUri = `${dir}${item.id}.mp4`;
        const info = await FileSystem.getInfoAsync(fileUri);
        if (!info.exists) {
          await FileSystem.downloadAsync(mediaUrl, fileUri);
        }
        if (!cancelled) {
          setLocalVideoUri(fileUri);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaType, item.id, isActive]);

  /* =========================================================
   * Playback state (iOS replay fix included)
   * ======================================================= */
  const onPlaybackStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    // ✅ iOS fix: rewind after finish so it can play again
    if (status.didJustFinish && !status.isLooping) {
      videoRef.current?.setPositionAsync(0);
    }
  };

  /* =========================================================
   * Image fade-in
   * ======================================================= */
  const onImageLoad = () => {
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      style={[styles.slide, { width, height }]}
      onPress={onToggleControls}
    >
      {mediaType === "image" && (
        <Animated.Image
          source={{ uri: mediaUrl }}
          style={[styles.media, { opacity: imageOpacity }]}
          resizeMode="contain"
          onLoadEnd={() => {
            setLoading(false);
            onImageLoad();
          }}
          onError={() => setError(true)}
        />
      )}

      {mediaType === "video" &&
        (Platform.OS === "web" ? (
          <video src={mediaUrl} controls autoPlay style={styles.webVideo} />
        ) : (
          <Video
            ref={videoRef}
            source={{ uri: localVideoUri ?? mediaUrl }}
            style={styles.media}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={isActive}
            useNativeControls
            onPlaybackStatusUpdate={onPlaybackStatus}
          />
        ))}

      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="white" />
        </View>
      )}
      {error && <Text style={styles.errorText}>Failed to load media</Text>}
    </Pressable>
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

  hintText: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    textAlign: "center",
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

  loadingWrap: {
    flex: 1,
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
});
