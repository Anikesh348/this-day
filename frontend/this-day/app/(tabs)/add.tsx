import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ResizeMode, Video } from "expo-av";
import DateTimePicker from "@react-native-community/datetimepicker";
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
  Platform,
} from "react-native";

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

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);

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
      setShowSuccess(false);
      setCountdown(3);
      setTempDate(null);
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
      setMedia((p) => [
        ...p,
        ...res.assets.map((a) => ({ ...a, loading: true })),
      ]);
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
      setMedia((p) => [
        ...p,
        ...res.assets.map((a) => ({ ...a, loading: true })),
      ]);
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

  const submit = () => {
    if (submitting) return;

    setSubmitting(true);
    setCountdown(3);
    setShowSuccess(true);

    const files = media.map((m) => {
      let mime = "image/jpeg";
      let name = m.fileName;

      if (m.type === "video") {
        mime = m.mimeType ?? "video/mp4";
        name = name ?? `video-${Date.now()}.mp4`;
      } else {
        name = name ?? `image-${Date.now()}.jpg`;
      }

      return { uri: m.uri, name, type: mime };
    });

    (async () => {
      try {
        if (isBackfill) {
          const d = forcedBackfill ? date! : pastDateString;
          await createBackfilledEntry(d, caption, files);
        } else {
          await createEntry(caption, files);
        }
      } catch (err) {
        console.error("Entry upload failed", err);
      } finally {
        setSubmitting(false);
      }
    })();
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
          <>
            <Pressable
              style={styles.dateRow}
              onPress={() => {
                if (forcedBackfill) return;
                setTempDate(new Date(`${pastDateString}T00:00:00`));
                setShowDatePicker(true);
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={Colors.dark.textMuted}
              />
              <Body>{new Date(`${displayDate}T00:00:00`).toDateString()}</Body>
            </Pressable>

            {/* Date Picker Modal with Tick */}
            <Modal transparent visible={showDatePicker} animationType="fade">
              <View style={styles.pickerOverlay}>
                <View style={styles.pickerCard}>
                  <DateTimePicker
                    value={tempDate ?? new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    maximumDate={new Date()}
                    onChange={(_, d) => d && setTempDate(d)}
                  />

                  <View style={styles.pickerActions}>
                    <Pressable onPress={() => setShowDatePicker(false)}>
                      <Body style={{ color: Colors.dark.textMuted }}>
                        Cancel
                      </Body>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        if (tempDate) {
                          setPastDateString(
                            tempDate.toISOString().slice(0, 10)
                          );
                        }
                        setShowDatePicker(false);
                      }}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={28}
                        color="#6C8CFF"
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>
          </>
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
          <Body style={{ color: "white" }}>Save Entry</Body>
        </Pressable>
      </ScrollView>
      {/* Success Popup */}
      <Modal
        visible={showSuccess}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={64} color="#6C8CFF" />

            <Title style={{ marginTop: 16 }}>
              Your entry will be securely synced to the cloud.
            </Title>

            <Muted style={{ marginTop: 8 }}>Redirecting in {countdown}s…</Muted>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 16, paddingTop: 32 },
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

  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerCard: {
    backgroundColor: "#1F2328",
    borderRadius: 22,
    padding: 16,
    width: "90%",
  },
  pickerActions: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },

  successCard: {
    backgroundColor: "#1F2328",
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: "center",
    width: "80%",
  },
});
