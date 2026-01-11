import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";

import { Screen } from "@/components/Screen";
import { useState } from "react";

/**
 * Safe FS access (Expo typing bug workaround)
 */
function getWritableDir(): string | null {
  const fs = FileSystem as unknown as {
    documentDirectory?: string;
    cacheDirectory?: string;
  };
  return fs.documentDirectory ?? fs.cacheDirectory ?? null;
}

export default function MediaViewerScreen() {
  const router = useRouter();
  const { assetId, type } = useLocalSearchParams<{
    assetId: string;
    type?: "image" | "video";
  }>();

  const [loading, setLoading] = useState(true);

  if (!assetId) return null;

  const mediaUrl = `https://thisdayapi.hostingfrompurva.xyz/api/media/immich/${assetId}?type=full`;

  /**
   * Download:
   * - Native → MediaLibrary
   * - Web → browser download
   */
  const handleDownload = async () => {
    if (Platform.OS === "web") {
      window.open(mediaUrl, "_blank");
      return;
    }

    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) return;

    const dir = getWritableDir();
    if (!dir) return;

    const ext = type === "video" ? "mp4" : "jpg";
    const fileUri = `${dir}${assetId}.${ext}`;

    const { uri } = await FileSystem.downloadAsync(mediaUrl, fileUri);
    await MediaLibrary.saveToLibraryAsync(uri);
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color="white" />
          </Pressable>

          <Pressable onPress={handleDownload} hitSlop={10}>
            <Ionicons name="download-outline" size={22} color="white" />
          </Pressable>
        </View>

        {/* Media */}
        <View style={styles.mediaContainer}>
          {type === "video" ? (
            Platform.OS === "web" ? (
              // ✅ WEB SAFE VIDEO
              <video
                src={mediaUrl}
                controls
                style={styles.webVideo}
                onLoadedData={() => setLoading(false)}
              />
            ) : (
              // ✅ NATIVE VIDEO
              <Video
                source={{ uri: mediaUrl }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                style={styles.media}
                onLoad={() => setLoading(false)}
              />
            )
          ) : (
            <Image
              source={{ uri: mediaUrl }}
              resizeMode="contain"
              style={styles.media}
              onLoadEnd={() => setLoading(false)}
            />
          )}

          {loading && (
            <View style={styles.loader}>
              <ActivityIndicator color="white" />
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  topBar: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  mediaContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  media: {
    width: "100%",
    height: "100%",
  },

  webVideo: {
    width: "100%",
    height: "100%",
    backgroundColor: "black",
  },

  loader: {
    position: "absolute",
  },
});
