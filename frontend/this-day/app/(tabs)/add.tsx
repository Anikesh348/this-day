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
    date ?? toISTDateString(new Date()),
  );

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  const [caption, setCaption] = useState("");
  const EDITOR_HEIGHT = 180;

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const isBackfill = forcedBackfill || entryMode === "past";
  const displayDate = forcedBackfill ? date! : pastDateString;

  const getMimeType = (m: ImagePicker.ImagePickerAsset) => {
    if (m.mimeType) return m.mimeType;

    if (m.type === "video") return "video/mp4";
    return "image/jpeg";
  };

  const getFileName = (m: ImagePicker.ImagePickerAsset) => {
    if (m.fileName) return m.fileName;

    const ext = m.type === "video" ? "mp4" : "jpg";
    return `file-${Date.now()}.${ext}`;
  };

  function toISTDateString(date: Date) {
    const ist = new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000);

    return ist.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  useFocusEffect(
    useCallback(() => {
      setCaption("");
      setMedia([]);
      setSubmitting(false);
      setEntryMode("today");
      setPastDateString(date ?? toISTDateString(new Date()));
      setShowSuccess(false);
      setCountdown(3);
      setTempDate(null);

      requestAnimationFrame(() => inputRef.current?.focus());

      return () => {
        inputRef.current?.blur();
        Keyboard.dismiss();
      };
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
        ...res.assets.map((a) => ({
          ...a,
          loading: !(Platform.OS === "web" && a.type === "video"),
        })),
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
        ...res.assets.map((a) => ({
          ...a,
          loading: !(Platform.OS === "web" && a.type === "video"),
        })),
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
      name: getFileName(m),
      type: getMimeType(m),
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

  const setDateFromPreset = (dateToSet: Date) => {
    const istDateString = toISTDateString(dateToSet);
    setTempDate(dateToSet);
    setPastDateString(istDateString);
  };

  const quickPresets = [
    { label: "Today", offsetDays: 0 },
    { label: "Yesterday", offsetDays: -1 },
    { label: "Last Week", offsetDays: -7 },
    { label: "Last Month", offsetDays: -30 },
  ];

  return (
    <Screen>
      <View style={styles.root}>
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
        <Pressable
          onPress={() => {
            if (!isBackfill) return;
            setTempDate(new Date(`${pastDateString}T00:00:00`));
            setShowDatePicker(true);
          }}
          style={[
            styles.datePill,
            !isBackfill && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="calendar-outline" size={16} color="#8AA4FF" />
          <Muted style={styles.dateText}>
            {new Date(`${displayDate}T00:00:00`).toDateString()}
          </Muted>
        </Pressable>
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
                    onReadyForDisplay={() => markLoaded(m.uri)}
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
      <View style={{ flex: 1 }}>
        <View style={styles.composer}>
          <TextInput
            ref={inputRef}
            autoFocus
            multiline
            scrollEnabled
            value={caption}
            onChangeText={setCaption}
            placeholder="What's new?"
            placeholderTextColor={Platform.OS === "web" ? "#8A8F98" : "#666"}
            onFocus={() => {
              setIsEditorFocused(true);
            }}
            onBlur={() => setIsEditorFocused(false)}
            style={[
              styles.editor,
              { height: EDITOR_HEIGHT },
              Platform.OS === "web" && styles.editorWeb,
              Platform.OS === "web" &&
                isEditorFocused &&
                styles.editorWebFocused,
            ]}
          />
        </View>
      </View>

      {/* DATE PICKER */}
      <Modal transparent visible={showDatePicker} animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Title style={styles.pickerTitle}>Pick a date</Title>
              <Muted>{new Date(`${pastDateString}T00:00:00`).toDateString()}</Muted>
            </View>

            <View style={styles.pickerChips}>
              {quickPresets.map((preset) => {
                const d = new Date();
                d.setDate(d.getDate() + preset.offsetDays);
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => setDateFromPreset(d)}
                    style={({ pressed }) => [
                      styles.chip,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Body style={styles.chipText}>{preset.label}</Body>
                  </Pressable>
                );
              })}
            </View>

            {Platform.OS === "web" ? (
              <View style={styles.webDateInputWrap}>
                <input
                  type="date"
                  value={pastDateString}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    setPastDateString(e.target.value);
                    setTempDate(new Date(`${e.target.value}T00:00:00`));
                  }}
                  style={styles.webDateInput as any}
                />
              </View>
            ) : (
              <DateTimePicker
                value={tempDate ?? new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                onChange={(_, d) => {
                  if (!d) return;
                  const istDateString = toISTDateString(d);
                  setTempDate(d);
                  setPastDateString(istDateString);
                }}
              />
            )}

            <View style={styles.pickerActions}>
              <Pressable onPress={() => setShowDatePicker(false)}>
                <Body style={{ color: "#aaa" }}>Cancel</Body>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowDatePicker(false); // pastDateString already correct
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 6,
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
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(108,140,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(108,140,255,0.25)",
  },
  dateText: {
    color: "#C9D4FF",
  },
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
    marginVertical: 0,
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

  editorWeb: {
    borderWidth: 1,
    borderColor: "#2C3440",
    borderRadius: 14,
    padding: 12,
  },

  editorWebFocused: {
    borderColor: "#6C8CFF",
    backgroundColor: "#0F1115",
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

  composer: { paddingHorizontal: 16, paddingVertical: 2 },
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
  pickerHeader: {
    gap: 4,
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 18,
  },
  pickerChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  chipText: {
    color: "#D7DCE5",
    fontSize: 13,
  },
  webDateInputWrap: {
    borderRadius: 14,
    padding: 10,
    backgroundColor: "#13161B",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  webDateInput: {
    width: "100%",
    backgroundColor: "transparent",
    color: "white",
    border: "none",
    outline: "none",
    fontSize: 16,
    padding: 6,
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
