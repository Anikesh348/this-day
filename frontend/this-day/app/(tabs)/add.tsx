import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

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

  /** Forced backfill when coming from calendar/day */
  const forcedBackfill = mode === "backfill" && !!date;

  /** Toggle only allowed when NOT forced */
  const [entryMode, setEntryMode] = useState<"today" | "past">("today");

  const [pastDate, setPastDate] = useState<Date>(
    date ? new Date(date) : new Date()
  );

  const isBackfill = forcedBackfill || entryMode === "past";

  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);

  /** 🔙 Back navigation */
  const handleBack = () => {
    if (from === "today") {
      router.replace("/today");
    } else if (from === "calendar") {
      router.replace("/calendar");
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/today");
    }
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

  /** 📸 Camera (ONLY for today) */
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.card}>
          <Title>{isBackfill ? "Add Memory" : "Add Entry"}</Title>

          <Muted>
            {forcedBackfill
              ? `For ${new Date(date!).toDateString()}`
              : "Capture this moment"}
          </Muted>

          {/* Toggle only when from Today */}
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

          {/* Caption */}
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Write something…"
            placeholderTextColor={Colors.dark.textMuted}
            multiline
            style={styles.input}
          />

          {/* Media Preview */}
          {media.length > 0 && (
            <View style={styles.grid}>
              {media.map((m, i) => (
                <Image key={i} source={{ uri: m.uri }} style={styles.image} />
              ))}
            </View>
          )}

          {/* Media actions */}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  scroll: {
    paddingVertical: 24,
    alignItems: "center",
  },

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
    borderRadius: 18,
    overflow: "hidden",
  },

  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },

  toggleActive: {
    backgroundColor: Colors.dark.accent,
  },

  input: {
    marginTop: 20,
    minHeight: 120,
    borderRadius: 18,
    padding: 16,
    backgroundColor: Colors.dark.surfaceAlt,
    color: Colors.dark.textPrimary,
    fontSize: 16,
    textAlignVertical: "top",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },

  image: {
    width: "48%",
    height: 120,
    borderRadius: 14,
    backgroundColor: "#000",
  },

  actions: {
    marginTop: 20,
    flexDirection: "row",
    gap: 12,
  },

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
});
