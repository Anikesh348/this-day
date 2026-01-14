import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ResizeMode, Video } from "expo-av";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";

import { Screen } from "@/components/Screen";
import { Body, Muted, Title } from "@/components/Text";
import { createBackfilledEntry, createEntry } from "@/services/entries";
import { Colors } from "@/theme/colors";

type MediaItem = ImagePicker.ImagePickerAsset & {
  loading?: boolean;
};

export default function AddEntryScreen() {
  const router = useRouter();
  const { mode, date, from } = useLocalSearchParams<{
    mode?: "backfill";
    date?: string;
    from?: "today" | "calendar";
  }>();

  const forcedBackfill = mode === "backfill" && !!date;

  const [entryMode, setEntryMode] = useState<"today" | "past">("today");
  const [pastDateString, setPastDateString] = useState(
    date ?? new Date().toISOString().slice(0, 10)
  );

  const [showCalendar, setShowCalendar] = useState(false);
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const isBackfill = forcedBackfill || entryMode === "past";

  useFocusEffect(
    useCallback(() => {
      setCaption("");
      setMedia([]);
      setSubmitting(false);
      setEntryMode("today");
      setPastDateString(date ?? new Date().toISOString().slice(0, 10));
      setShowCalendar(false);
      setShowSuccess(false);
      setCountdown(3);
    }, [date])
  );

  useEffect(() => {
    if (!showSuccess) return;

    if (countdown === 0) {
      setShowSuccess(false);
      router.replace("/today");
      return;
    }

    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showSuccess, countdown]);

  const handleBack = () => {
    if (from === "today") router.replace("/today");
    else if (from === "calendar") router.replace("/calendar");
    else router.back();
  };

  const addFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
    });

    if (!res.canceled) {
      const items = res.assets.map((a) => ({ ...a, loading: true }));
      setMedia((p) => [...p, ...items]);
    }
  };

  const captureFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
    });

    if (!res.canceled) {
      const items = res.assets.map((a) => ({ ...a, loading: true }));
      setMedia((p) => [...p, ...items]);
    }
  };

  const removeMedia = (uri: string) => {
    setMedia((p) => p.filter((m) => m.uri !== uri));
  };

  const markLoaded = (uri: string) => {
    setMedia((p) =>
      p.map((m) => (m.uri === uri ? { ...m, loading: false } : m))
    );
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const files = media.map((m) => ({
        uri: m.uri,
        name: m.fileName ?? `media-${Date.now()}`,
        type: m.type === "video" ? "video/mp4" : "image/jpeg",
      }));

      if (isBackfill) {
        const d = forcedBackfill ? date! : pastDateString;
        await createBackfilledEntry(d, caption, files);
      } else {
        await createEntry(caption, files);
      }

      setCountdown(3);
      setShowSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  const displayDate = forcedBackfill ? date! : pastDateString;

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={handleBack}>
          <Ionicons
            name="chevron-back"
            size={26}
            color={Colors.dark.textPrimary}
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Title>New Entry</Title>
        <Muted style={styles.subtitle}>
          Write freely. This is just for you.
        </Muted>

        {!forcedBackfill && (
          <View style={styles.toggle}>
            {["today", "past"].map((v) => (
              <Pressable
                key={v}
                onPress={() => setEntryMode(v as any)}
                style={[
                  styles.toggleBtn,
                  entryMode === v && styles.toggleActive,
                ]}
              >
                <Body>{v === "today" ? "Today" : "Past"}</Body>
              </Pressable>
            ))}
          </View>
        )}

        {(forcedBackfill || entryMode === "past") && (
          <View style={styles.dateRow}>
            <Ionicons
              name="calendar-outline"
              size={18}
              color={Colors.dark.textMuted}
            />
            <Body>{new Date(`${displayDate}T00:00:00`).toDateString()}</Body>
          </View>
        )}

        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="What happened today?"
          placeholderTextColor={Colors.dark.textMuted}
          multiline
          style={styles.editor}
        />

        {media.length > 0 && (
          <View style={styles.mediaStrip}>
            {media.map((m) => (
              <View key={m.uri} style={styles.mediaWrapper}>
                {m.type === "video" ? (
                  <Video
                    source={{ uri: m.uri }}
                    style={styles.media}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    onLoad={() => markLoaded(m.uri)}
                  />
                ) : (
                  <Image
                    source={{ uri: m.uri }}
                    style={styles.media}
                    onLoadEnd={() => markLoaded(m.uri)}
                  />
                )}

                {m.loading && (
                  <View style={styles.mediaLoader}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}

                {!m.loading && (
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => removeMedia(m.uri)}
                  >
                    <Ionicons name="close" size={16} color="white" />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionRow}>
          <Pressable style={styles.iconBtn} onPress={addFromGallery}>
            <Ionicons name="images-outline" size={22} color="#8AA4FF" />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={captureFromCamera}>
            <Ionicons name="camera-outline" size={22} color="#8AA4FF" />
          </Pressable>
        </View>

        <Pressable
          style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
          onPress={submit}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Body style={{ color: "white" }}>Save Entry</Body>
          )}
        </Pressable>
      </ScrollView>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="cloud-done-outline" size={28} color="#6C8CFF" />
            <Text style={styles.successTitle}>Entry saved</Text>
            <Text style={styles.successText}>
              This entry will sync to the cloud shortly.
            </Text>
            <Text style={styles.countdownText}>
              Redirecting in {countdown}s
            </Text>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 16, paddingTop: 8 },
  scroll: { padding: 24, paddingBottom: 140 },
  subtitle: { marginBottom: 20 },

  toggle: {
    flexDirection: "row",
    backgroundColor: "#1F2328",
    borderRadius: 20,
    padding: 4,
    marginBottom: 16,
  },

  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  toggleActive: { backgroundColor: "#2C3440", borderRadius: 16 },

  dateRow: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#1F2328",
    marginBottom: 16,
  },

  editor: {
    minHeight: 180,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#1F2328",
    color: Colors.dark.textPrimary,
    fontSize: 18,
  },

  mediaStrip: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  mediaWrapper: {
    width: "48%",
    height: 160,
    borderRadius: 18,
    overflow: "hidden",
  },

  media: { width: "100%", height: "100%" },

  mediaLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },

  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 12,
    padding: 4,
  },

  actionRow: { marginTop: 20, flexDirection: "row", gap: 14 },

  iconBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1F2328",
    alignItems: "center",
    justifyContent: "center",
  },

  saveBtn: {
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 28,
    backgroundColor: "#6C8CFF",
    alignItems: "center",
  },

  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  successCard: {
    backgroundColor: "#1F2328",
    padding: 24,
    borderRadius: 22,
    alignItems: "center",
    width: "80%",
  },

  successTitle: {
    color: Colors.dark.textPrimary,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 10,
  },

  successText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
  },

  countdownText: {
    color: "#8AA4FF",
    fontSize: 13,
    marginTop: 12,
  },
});
