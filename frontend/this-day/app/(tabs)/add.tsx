import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";

import { Screen } from "@/components/Screen";
import { Body, Muted, Title } from "@/components/Text";
import { createBackfilledEntry, createEntry } from "@/services/entries";
import { Colors } from "@/theme/colors";

export default function AddEntryScreen() {
  const router = useRouter();
  const { mode, date, from } = useLocalSearchParams<{
    mode?: "backfill";
    date?: string;
    from?: "today" | "calendar";
  }>();

  /** Forced backfill */
  const forcedBackfill = mode === "backfill" && !!date;

  /** State */
  const [entryMode, setEntryMode] = useState<"today" | "past">("today");
  const [pastDate, setPastDate] = useState<Date>(
    date ? new Date(date) : new Date()
  );
  const [showCalendar, setShowCalendar] = useState(false);

  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isBackfill = forcedBackfill || entryMode === "past";

  /**
   * ✅ RESET STATE on focus
   */
  useFocusEffect(
    useCallback(() => {
      setCaption("");
      setMedia([]);
      setSubmitting(false);
      setEntryMode("today");
      setPastDate(date ? new Date(date) : new Date());
      setShowCalendar(false);
    }, [date])
  );

  /** 🔙 Back navigation */
  const handleBack = () => {
    if (from === "today") router.replace("/today");
    else if (from === "calendar") router.replace("/calendar");
    else if (router.canGoBack()) router.back();
    else router.replace("/today");
  };

  /** 🖼 Gallery */
  const addFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.9,
    });

    if (!res.canceled) {
      setMedia((prev) => [...prev, ...res.assets]);
    }
  };

  /** 📸 Camera */
  const captureFromCamera = async () => {
    if (isBackfill) return;

    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
    });

    if (!res.canceled) {
      setMedia((prev) => [...prev, ...res.assets]);
    }
  };

  /** 💾 Submit */
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const files = media.map((m) => ({
        uri: m.uri,
        name: m.fileName ?? `media-${Date.now()}.jpg`,
        type: m.type === "video" ? "video/mp4" : "image/jpeg",
      }));

      if (isBackfill) {
        const d = forcedBackfill ? date! : pastDate.toISOString().slice(0, 10);
        await createBackfilledEntry(d, caption, files);
      } else {
        await createEntry(caption, files);
      }

      router.replace("/today");
    } finally {
      setSubmitting(false);
    }
  };

  const pastDateString = pastDate.toISOString().slice(0, 10);

  return (
    <Screen>
      {/* Top bar */}
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
        <View style={styles.card}>
          <Title>{isBackfill ? "Add Memory" : "Add Entry"}</Title>

          <Muted>
            {forcedBackfill
              ? `For ${new Date(date!).toDateString()}`
              : "Capture this moment"}
          </Muted>

          {/* Toggle */}
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

          {/* 📅 Past date selector */}
          {!forcedBackfill && entryMode === "past" && (
            <Pressable
              style={styles.dateRow}
              onPress={() => setShowCalendar(true)}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={Colors.dark.textMuted}
              />
              <Body>
                {pastDate.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Body>
            </Pressable>
          )}

          {/* Caption */}
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Write something…"
            placeholderTextColor={Colors.dark.textMuted}
            multiline
            style={styles.input}
          />

          {/* Media preview */}
          {media.length > 0 && (
            <View style={styles.grid}>
              {media.map((m, i) => (
                <Image key={i} source={{ uri: m.uri }} style={styles.image} />
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable style={styles.actionBtn} onPress={addFromGallery}>
              <Ionicons
                name="images-outline"
                size={20}
                color={Colors.dark.accent}
              />
              <Body>Gallery</Body>
            </Pressable>

            {!isBackfill && (
              <Pressable style={styles.actionBtn} onPress={captureFromCamera}>
                <Ionicons
                  name="camera-outline"
                  size={20}
                  color={Colors.dark.accent}
                />
                <Body>Camera</Body>
              </Pressable>
            )}
          </View>

          {/* Save */}
          <Pressable
            style={[styles.submitButton, submitting && { opacity: 0.6 }]}
            onPress={submit}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Body>Save</Body>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* 📅 Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Calendar
              current={pastDateString}
              maxDate={new Date().toISOString().slice(0, 10)}
              onDayPress={(day) => {
                setPastDate(new Date(`${day.dateString}T00:00:00`));
                setShowCalendar(false);
              }}
              theme={{
                calendarBackground: Colors.dark.surface,
                dayTextColor: Colors.dark.textPrimary,
                monthTextColor: Colors.dark.textPrimary,
                selectedDayBackgroundColor: Colors.dark.accent,
                todayTextColor: Colors.dark.accent,
                arrowColor: Colors.dark.textPrimary,
              }}
              markedDates={{
                [pastDateString]: {
                  selected: true,
                },
              }}
            />

            <Pressable
              style={styles.closeBtn}
              onPress={() => setShowCalendar(false)}
            >
              <Body>Close</Body>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 16, paddingTop: 8 },
  scroll: { paddingVertical: 24, alignItems: "center" },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Colors.dark.surface,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },

  toggle: {
    marginTop: 16,
    flexDirection: "row",
    backgroundColor: Colors.dark.surfaceAlt,
    borderRadius: 20,
    padding: 4, // ⬅ important
  },

  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 16, // ⬅ button owns curve
  },

  toggleActive: {
    backgroundColor: Colors.dark.accent,
  },

  dateRow: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.dark.surfaceAlt,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  input: {
    marginTop: 20,
    minHeight: 120,
    borderRadius: 18,
    padding: 16,
    backgroundColor: Colors.dark.surfaceAlt,
    color: Colors.dark.textPrimary,
    fontSize: 16,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  image: { width: "48%", height: 120, borderRadius: 14 },

  actions: { marginTop: 20, flexDirection: "row", gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceAlt,
  },

  submitButton: {
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: Colors.dark.accent,
    alignItems: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,1)", // ⬅ darker overlay
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    backgroundColor: Colors.dark.surface, // ⬅ solid background
    borderRadius: 22,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20, // ⬅ Android/Web depth
  },

  closeBtn: {
    marginTop: 12,
    padding: 12,
    alignItems: "center",
  },
});
