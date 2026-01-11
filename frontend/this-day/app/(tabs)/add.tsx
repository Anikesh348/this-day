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

  const forcedBackfill = mode === "backfill" && !!date;

  const [entryMode, setEntryMode] = useState<"today" | "past">("today");
  const [pastDateString, setPastDateString] = useState(
    date ?? new Date().toISOString().slice(0, 10)
  );

  const [showCalendar, setShowCalendar] = useState(false);
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isBackfill = forcedBackfill || entryMode === "past";

  useFocusEffect(
    useCallback(() => {
      setCaption("");
      setMedia([]);
      setSubmitting(false);
      setEntryMode("today");
      setPastDateString(date ?? new Date().toISOString().slice(0, 10));
      setShowCalendar(false);
    }, [date])
  );

  const handleBack = () => {
    if (from === "today") router.replace("/today");
    else if (from === "calendar") router.replace("/calendar");
    else router.back();
  };

  const addFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.9,
    });
    if (!res.canceled) setMedia((p) => [...p, ...res.assets]);
  };

  const captureFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;

    const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!res.canceled) setMedia((p) => [...p, ...res.assets]);
  };

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
        const d = forcedBackfill ? date! : pastDateString;
        await createBackfilledEntry(d, caption, files);
      } else {
        await createEntry(caption, files);
      }

      router.replace("/today");
    } finally {
      setSubmitting(false);
    }
  };

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
                <Body
                  style={{
                    color:
                      entryMode === v
                        ? Colors.dark.textPrimary
                        : Colors.dark.textMuted,
                  }}
                >
                  {v === "today" ? "Today" : "Past"}
                </Body>
              </Pressable>
            ))}
          </View>
        )}

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
              {new Date(`${pastDateString}T00:00:00`).toLocaleDateString(
                undefined,
                {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }
              )}
            </Body>
          </Pressable>
        )}

        {/* Writing */}
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="What happened today?"
          placeholderTextColor={Colors.dark.textMuted}
          multiline
          style={styles.editor}
        />

        {/* Media */}
        {media.length > 0 && (
          <View style={styles.mediaStrip}>
            {media.map((m, i) => (
              <Image
                key={i}
                source={{ uri: m.uri }}
                style={styles.mediaImage}
              />
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionRow}>
          <Pressable style={styles.iconBtn} onPress={addFromGallery}>
            <Ionicons name="images-outline" size={22} color="#8AA4FF" />
          </Pressable>

          <Pressable style={styles.iconBtn} onPress={captureFromCamera}>
            <Ionicons name="camera-outline" size={22} color="#8AA4FF" />
          </Pressable>
        </View>

        {/* Save */}
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

      {/* Modern Bottom-Sheet Calendar */}
      <Modal visible={showCalendar} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Muted>Select date</Muted>
              <Pressable onPress={() => setShowCalendar(false)}>
                <Ionicons
                  name="close"
                  size={22}
                  color={Colors.dark.textMuted}
                />
              </Pressable>
            </View>

            <Calendar
              current={pastDateString}
              maxDate={new Date().toISOString().slice(0, 10)}
              onDayPress={(d) => {
                setPastDateString(d.dateString);
                setShowCalendar(false);
              }}
              theme={{
                calendarBackground: Colors.dark.surface,
                dayTextColor: Colors.dark.textPrimary,
                monthTextColor: Colors.dark.textPrimary,
                selectedDayBackgroundColor: "#6C8CFF",
                todayTextColor: "#6C8CFF",
                arrowColor: Colors.dark.textPrimary,
              }}
              markedDates={{ [pastDateString]: { selected: true } }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 16, paddingTop: 8 },

  scroll: {
    padding: 24,
    paddingBottom: 140,
  },

  subtitle: {
    marginTop: 6,
    marginBottom: 20,
  },

  toggle: {
    flexDirection: "row",
    backgroundColor: "#1F2328",
    borderRadius: 20,
    padding: 4,
    marginBottom: 16,
  },

  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 16,
  },

  toggleActive: {
    backgroundColor: "#2C3440",
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
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
    lineHeight: 26,
  },

  mediaStrip: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  mediaImage: {
    width: "48%",
    height: 160,
    borderRadius: 18,
  },

  actionRow: {
    marginTop: 20,
    flexDirection: "row",
    gap: 14,
  },

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

  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,1)",
    justifyContent: "flex-end",
  },

  sheet: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
  },

  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
});
