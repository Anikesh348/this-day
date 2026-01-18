import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  Text,
  Animated,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "@/components/Screen";
import { useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";

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

export default function MediaViewerScreen() {
  const router = useRouter();
  const { assetId, caption } = useLocalSearchParams<{
    assetId: string;
    caption: string;
  }>();

  if (!assetId) return null;

  const mediaUrl = `https://thisdayapi.hostingfrompurva.xyz/api/media/immich/${assetId}?type=full`;

  const videoRef = useRef<Video>(null);

  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const imageOpacity = useRef(new Animated.Value(0)).current;

  const [mediaType, setMediaType] = useState<MediaKind | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [localVideoUri, setLocalVideoUri] = useState<string | null>(null);

  /* =========================================================
   * Detect media type
   * ======================================================= */
  useEffect(() => {
    let cancelled = false;

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
  }, [assetId]);

  /* =========================================================
   * Optional video preload
   * ======================================================= */
  useEffect(() => {
    if (mediaType !== "video" || Platform.OS === "web") {
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
        const fileUri = `${dir}${assetId}.mp4`;
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
  }, [mediaType, assetId]);

  /* =========================================================
   * Playback state (iOS replay fix included)
   * ======================================================= */
  const onPlaybackStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setIsPlaying(status.isPlaying);

    // ✅ iOS fix: rewind after finish so it can play again
    if (status.didJustFinish && !status.isLooping) {
      videoRef.current?.setPositionAsync(0);
    }
  };

  /* =========================================================
   * Controls toggle
   * ======================================================= */
  const toggleControls = () => {
    Animated.timing(controlsOpacity, {
      toValue: controlsVisible ? 0 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setControlsVisible(!controlsVisible));
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

  /* =========================================================
   * Download
   * ======================================================= */
  const handleDownload = async () => {
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

      const ext = mediaType === "video" ? "mp4" : "jpg";
      const fileUri = `${dir}${assetId}.${ext}`;

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
    <Screen>
      <StatusBar style="light" hidden={!controlsVisible} />
      <View style={styles.container}>
        {/* Top gradient */}
        <LinearGradient
          colors={["rgba(0,0,0,0.7)", "transparent"]}
          style={styles.topGradient}
        />

        {/* Top bar */}
        <Animated.View style={[styles.topBar, { opacity: controlsOpacity }]}>
          <IconButton icon="close" onPress={() => router.back()} />
          <IconButton
            icon="download-outline"
            onPress={handleDownload}
            loading={downloading}
          />
        </Animated.View>

        {/* Media */}
        <Pressable style={styles.mediaContainer} onPress={toggleControls}>
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
                shouldPlay
                useNativeControls
                onPlaybackStatusUpdate={onPlaybackStatus}
              />
            ))}

          {loading && <ActivityIndicator size="large" color="white" />}
          {error && <Text style={styles.errorText}>Failed to load media</Text>}
        </Pressable>

        {/* Bottom gradient + meta */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.75)"]}
          style={styles.bottomGradient}
        >
          <Text style={styles.metaText}>{caption}</Text>
        </LinearGradient>

        {/* Play overlay */}
        {/* {mediaType === "video" && !isPlaying && (
          <View style={styles.playOverlay}>
            <Ionicons name="play" size={44} color="white" />
          </View>
        )} */}
      </View>
    </Screen>
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
  container: { flex: 1, backgroundColor: "#000" },

  mediaContainer: { flex: 1, justifyContent: "center" },

  media: { width: "100%", height: "100%" },

  webVideo: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    backgroundColor: "black",
  },

  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 5,
  },

  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 16,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    paddingHorizontal: 20,
    paddingBottom: 28,
    justifyContent: "flex-end",
  },

  metaText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    letterSpacing: 0.4,
  },

  playOverlay: {
    position: "absolute",
    alignSelf: "center",
    top: "45%",
  },

  errorText: {
    color: "#aaa",
    textAlign: "center",
    marginTop: 20,
  },
});
