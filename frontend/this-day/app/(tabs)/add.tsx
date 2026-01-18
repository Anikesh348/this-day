import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ResizeMode, Video } from "expo-av";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Screen } from "@/components/Screen";
import { Body, Muted, Title } from "@/components/Text";
import { createBackfilledEntry, createEntry } from "@/services/entries";

type MediaItem = ImagePicker.ImagePickerAsset & {
  loading?: boolean;
};

export default function AddEntryScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const { mode, date, from } = useLocalSearchParams<{
    mode?: "backfill";
    date?: string;
    from?: "today" | "day";
  }>();

  const forcedBackfill = mode === "backfill" && !!date;

  const [entryMode, setEntryMode] = useState<"today" | "past">("today");
  const [pastDateString, setPastDateString] = useState(
    date ?? new Date().toISOString().slice(0, 10),
  );

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);

  const [caption, setCaption] = useState("");
  const [editorHeight, setEditorHeight] = useState(56);

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const isBackfill = forcedBackfill || entryMode === "past";
  const displayDate = forcedBackfill ? date! : pastDateString;

  useFocusEffect(
    useCallback(() => {
      setCaption("");
      setMedia([]);
      setSubmitting(false);
      setEntryMode("today");
      setPastDateString(date ?? new Date().toISOString().slice(0, 10));
      setEditorHeight(56);
      setShowSuccess(false);
      setCountdown(3);
      setTempDate(null);

      requestAnimationFrame(() => inputRef.current?.focus());
    }, [date]),
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
    if (from === "day" && date) {
      router.replace({ pathname: "day/[date]", params: { date } });
    } else {
      router.replace("/today");
    }
  };

  const addFromGallery = async () => {
    Keyboard.dismiss();
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
    Keyboard.dismiss();
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

  const markLoaded = (uri: string) => {
    setMedia((p) =>
      p.map((m) => (m.uri === uri ? { ...m, loading: false } : m)),
    );
  };

  const removeMedia = (uri: string) => {
    setMedia((p) => p.filter((m) => m.uri !== uri));
  };

  const submit = async () => {
    if (submitting) return;

    Keyboard.dismiss();
    setSubmitting(true);
    setShowSuccess(true);
    setCountdown(3);

    const files = media.map((m) => ({
      uri: m.uri,
      name: m.fileName ?? `file-${Date.now()}`,
      type: m.mimeType ?? "image/jpeg",
    }));

    try {
      if (isBackfill) {
        await createBackfilledEntry(displayDate, caption, files);
      } else {
        await createEntry(caption, files);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formattedToday = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Screen>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable onPress={handleBack}>
          <Ionicons name="chevron-back" size={26} color="white" />
        </Pressable>
        <Title>New Entry</Title>
        <View style={{ width: 26 }} />
      </View>

      {/* META */}
      <View style={styles.meta}>
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
      </View>

      {/* DATE LABEL */}
      <View style={styles.dateLabel}>
        <Muted>{new Date(`${displayDate}T00:00:00`).toDateString()}</Muted>
      </View>

      {/* ACTION ROW */}
      <View style={styles.actions}>
        <View style={styles.actionLeft}>
          <Pressable style={styles.iconBtn} onPress={addFromGallery}>
            <Ionicons name="images-outline" size={22} color="#8AA4FF" />
          </Pressable>

          <Pressable style={styles.iconBtn} onPress={captureFromCamera}>
            <Ionicons name="camera-outline" size={22} color="#8AA4FF" />
          </Pressable>

          {(forcedBackfill || entryMode === "past") && (
            <Pressable
              style={styles.iconBtn}
              onPress={() => {
                setTempDate(new Date(`${pastDateString}T00:00:00`));
                setShowDatePicker(true);
              }}
            >
              <Ionicons name="calendar-outline" size={22} color="#8AA4FF" />
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
          onPress={submit}
        >
          <Body style={{ color: "white" }}>Save</Body>
        </Pressable>
      </View>

      {/* MEDIA */}
      {media.length > 0 && (
        <View style={styles.mediaStripContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mediaStrip}
          >
            {media.map((m) => (
              <View key={m.uri} style={styles.mediaWrapper}>
                {m.type === "video" ? (
                  <Video
                    source={{ uri: m.uri }}
                    style={styles.media}
                    resizeMode={ResizeMode.COVER}
                    useNativeControls
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
          </ScrollView>
        </View>
      )}

      {/* CAPTION */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.composer}>
          <TextInput
            ref={inputRef}
            autoFocus
            multiline
            value={caption}
            onChangeText={setCaption}
            placeholder="What's new?"
            placeholderTextColor="#666"
            onContentSizeChange={(e) => setEditorHeight(150)}
            style={[styles.editor, { height: editorHeight }]}
          />
        </View>
      </KeyboardAvoidingView>

      {/* DATE PICKER */}
      <Modal transparent visible={showDatePicker} animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            {Platform.OS === "web" ? (
              <input
                type="date"
                value={pastDateString}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  setPastDateString(e.target.value);
                  setTempDate(new Date(`${e.target.value}T00:00:00`));
                }}
              />
            ) : (
              <DateTimePicker
                value={tempDate ?? new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                onChange={(_, d) => d && setTempDate(d)}
              />
            )}

            <View style={styles.pickerActions}>
              <Pressable onPress={() => setShowDatePicker(false)}>
                <Body style={{ color: "#aaa" }}>Cancel</Body>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (tempDate) {
                    setPastDateString(tempDate.toISOString().slice(0, 10));
                  }
                  setShowDatePicker(false);
                }}
              >
                <Ionicons name="checkmark-circle" size={28} color="#6C8CFF" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* SUCCESS MODAL */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={64} color="#6C8CFF" />
            <Title>Your entry will be securely synced to the cloud.</Title>
            <Muted>Redirecting in {countdown}s…</Muted>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: { paddingHorizontal: 12 },
  toggle: {
    flexDirection: "row",
    backgroundColor: "#1F2328",
    borderRadius: 16,
    padding: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 6, alignItems: "center" },
  toggleActive: { backgroundColor: "#2C3440", borderRadius: 12 },
  dateLabel: { paddingHorizontal: 16, paddingBottom: 10, paddingTop: 10 },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: "center",
  },
  actionLeft: { flexDirection: "row", gap: 12 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1F2328",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#6C8CFF",
  },
  mediaStripContainer: {
    height: 120, // ✅ fixed height
    marginVertical: 12,
  },

  mediaStrip: {
    paddingHorizontal: 12,
    alignItems: "center",
  },

  mediaWrapper: {
    width: 96,
    height: 96,
    marginRight: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#111",
  },

  media: {
    width: "100%",
    height: "100%",
  },

  mediaLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },

  composer: { paddingHorizontal: 16, paddingVertical: 10 },
  editor: { fontSize: 20, color: "white" },
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
  },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  successCard: {
    backgroundColor: "#1F2328",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    width: "80%",
  },
});
