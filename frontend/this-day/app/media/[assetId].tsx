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
  Alert,
  Animated,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
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
  const { assetId } = useLocalSearchParams<{ assetId: string }>();

  if (!assetId) return null;

  const mediaUrl = `https://thisdayapi.hostingfrompurva.xyz/api/media/immich/${assetId}?type=full`;

  const videoRef = useRef<Video>(null);
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  const [mediaType, setMediaType] = useState<MediaKind | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [localVideoUri, setLocalVideoUri] = useState<string | null>(null);

  /* =========================================================
   * Detect media type (video vs image)
   * ======================================================= */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(mediaUrl, {
          headers: { Range: "bytes=0-1" },
        });

        const contentType = res.headers.get("content-type") ?? "";
        if (!cancelled) {
          setMediaType(contentType.startsWith("video/") ? "video" : "image");
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
   * Optional video preload (skip if not available)
   * ======================================================= */
  useEffect(() => {
    if (mediaType !== "video" || Platform.OS === "web") {
      setLoading(false);
      return;
    }

    const dir = getWritableDir();
    if (!dir) {
      // Expo Go → stream directly
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
   * Video playback state
   * ======================================================= */
  const onPlaybackStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
  };

  const toggleControls = () => {
    Animated.timing(controlsOpacity, {
      toValue: controlsVisible ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setControlsVisible(!controlsVisible));
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
            <Image
              source={{ uri: mediaUrl }}
              style={styles.media}
              resizeMode="contain"
              onLoadEnd={() => setLoading(false)}
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
                useNativeControls // ✅ REQUIRED FOR EXPO GO
                onPlaybackStatusUpdate={onPlaybackStatus}
              />
            ))}

          {loading && <ActivityIndicator size="large" color="white" />}
          {error && <Text style={styles.errorText}>Failed to load media</Text>}
        </Pressable>

        {/* Play icon only when paused */}
        {mediaType === "video" && !isPlaying && (
          <View style={styles.bottomControls}>
            <Ionicons name="play" size={36} color="white" />
          </View>
        )}
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
  bottomControls: {
    position: "absolute",
    alignSelf: "center",
    bottom: 60,
  },
  errorText: {
    color: "#aaa",
    textAlign: "center",
    marginTop: 20,
  },
});
