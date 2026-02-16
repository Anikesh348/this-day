import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Audio, ResizeMode, Video } from "expo-av";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
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
import { createBackfilledEntry, createEntry, updateEntry } from "@/services/entries";
import { apiUrl } from "@/services/apiBase";

type MediaItem = ImagePicker.ImagePickerAsset & {
  loading?: boolean;
  previewUri?: string | null;
};

const MAX_MEDIA_ITEMS = 5;
const MAX_VIDEO_DURATION_MS = 10 * 1000;

function normalizeDurationMs(duration?: number | null) {
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  // Some providers return seconds, others milliseconds.
  return duration > 1000 ? duration : duration * 1000;
}

async function probeVideoDurationMs(uri: string) {
  const sound = new Audio.Sound();

  try {
    await sound.loadAsync({ uri }, { shouldPlay: false }, false);
    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return null;

    return typeof status.durationMillis === "number" ? status.durationMillis : null;
  } catch {
    return null;
  } finally {
    try {
      await sound.unloadAsync();
    } catch {
      // no-op
    }
  }
}

async function generateWebVideoThumbnail(uri: string): Promise<string | null> {
  if (Platform.OS !== "web") return null;

  return new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: string | null) => {
      if (settled) return;
      settled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
      resolve(result);
    };

    const captureFrame = () => {
      try {
        const width = video.videoWidth || 96;
        const height = video.videoHeight || 96;

        if (!width || !height) {
          finish(null);
          return;
        }

        const maxSide = 420;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          finish(null);
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        finish(null);
      }
    };

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = uri;

    video.onloadedmetadata = () => {
      const targetTime = Number.isFinite(video.duration)
        ? Math.min(0.12, Math.max(0, video.duration - 0.01))
        : 0;

      if (targetTime <= 0) {
        captureFrame();
        return;
      }

      try {
        video.currentTime = targetTime;
      } catch {
        captureFrame();
      }
    };

    video.onseeked = captureFrame;
    video.onloadeddata = () => {
      if (video.currentTime === 0) {
        captureFrame();
      }
    };
    video.onerror = () => finish(null);

    timeoutId = setTimeout(() => finish(null), 4500);
  });
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parseAssetIdsParam(raw?: string) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((id): id is string => typeof id === "string" && !!id);
  } catch {
    return [];
  }
}

export default function AddEntryScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const params = useLocalSearchParams<{
    mode?: "backfill" | "edit";
    date?: string;
    from?: "today" | "day";
    entryId?: string;
    entryCaption?: string;
    existingAssetIds?: string;
  }>();

  const mode = firstParam(params.mode);
  const date = firstParam(params.date);
  const from = firstParam(params.from);
  const entryId = firstParam(params.entryId);
  const entryCaption = firstParam(params.entryCaption) ?? "";
  const existingAssetIdsParam = firstParam(params.existingAssetIds);
  const parsedExistingAssetIds = useMemo(
    () => parseAssetIdsParam(existingAssetIdsParam),
    [existingAssetIdsParam],
  );

  const isEditMode = mode === "edit" && !!entryId;
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
  const [existingAssetIds, setExistingAssetIds] = useState<string[]>([]);
  const [removedAssetIds, setRemovedAssetIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const isBackfill = forcedBackfill || entryMode === "past";
  const displayDate = isEditMode
    ? (date ?? toISTDateString(new Date()))
    : forcedBackfill
      ? date!
      : pastDateString;
  const visibleExistingAssetIds = existingAssetIds.filter(
    (id) => !removedAssetIds.includes(id),
  );

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
      setCaption(isEditMode ? entryCaption : "");
      setMedia([]);
      setExistingAssetIds(isEditMode ? parsedExistingAssetIds : []);
      setRemovedAssetIds([]);
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
    }, [date, entryCaption, isEditMode, parsedExistingAssetIds]),
  );

  useEffect(() => {
    if (!validationMessage) return;

    const t = setTimeout(() => setValidationMessage(null), 3200);
    return () => clearTimeout(t);
  }, [validationMessage]);

  useEffect(() => {
    if (!showSuccess) return;

    if (countdown === 0) {
      setShowSuccess(false);
      if (isEditMode && from === "day" && date) {
        router.replace({ pathname: "day/[date]", params: { date } });
      } else {
        router.replace("/today");
      }
      return;
    }

    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showSuccess, countdown, isEditMode, from, date, router]);


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

    if (res.canceled) return;

    await addSelectedMedia(res.assets);
  };

  const captureFromCamera = async () => {
    Keyboard.dismiss();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
    });

    if (res.canceled) return;

    await addSelectedMedia(res.assets);
  };

  const validateVideoAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const validAssets: ImagePicker.ImagePickerAsset[] = [];
    let skippedLongVideoCount = 0;
    let skippedUnknownVideoCount = 0;

    for (const asset of assets) {
      if (asset.type !== "video") {
        validAssets.push(asset);
        continue;
      }

      const knownDurationMs = normalizeDurationMs(asset.duration);
      const durationMs =
        knownDurationMs ?? (await probeVideoDurationMs(asset.uri));

      if (durationMs === null) {
        skippedUnknownVideoCount += 1;
        continue;
      }

      if (durationMs > MAX_VIDEO_DURATION_MS) {
        skippedLongVideoCount += 1;
        continue;
      }

      validAssets.push(asset);
    }

    return { validAssets, skippedLongVideoCount, skippedUnknownVideoCount };
  };

  const addSelectedMedia = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const remainingSlots =
      MAX_MEDIA_ITEMS - (visibleExistingAssetIds.length + media.length);

    if (remainingSlots <= 0) {
      setValidationMessage(
        `You can only attach up to ${MAX_MEDIA_ITEMS} media items.`,
      );
      return;
    }

    const { validAssets, skippedLongVideoCount, skippedUnknownVideoCount } =
      await validateVideoAssets(assets);

    const limitedAssets = validAssets.slice(0, remainingSlots);
    const skippedForLimitCount = Math.max(0, validAssets.length - remainingSlots);

    if (limitedAssets.length > 0) {
      const preparedAssets = await Promise.all(
        limitedAssets.map(async (asset) => {
          if (Platform.OS === "web" && asset.type === "video") {
            const previewUri = await generateWebVideoThumbnail(asset.uri);
            return {
              ...asset,
              previewUri,
              loading: false,
            };
          }

          return {
            ...asset,
            loading: !(Platform.OS === "web" && asset.type === "video"),
          };
        }),
      );

      setMedia((p) => [
        ...p,
        ...preparedAssets,
      ]);
    }

    const messages: string[] = [];
    if (skippedLongVideoCount > 0) {
      messages.push(
        `${skippedLongVideoCount} video${skippedLongVideoCount > 1 ? "s were" : " was"} skipped because duration exceeds 10 seconds.`,
      );
    }

    if (skippedUnknownVideoCount > 0) {
      messages.push(
        `${skippedUnknownVideoCount} video${skippedUnknownVideoCount > 1 ? "s were" : " was"} skipped because duration could not be verified.`,
      );
    }

    if (skippedForLimitCount > 0) {
      messages.push(
        `${skippedForLimitCount} item${skippedForLimitCount > 1 ? "s were" : " was"} skipped because the max is ${MAX_MEDIA_ITEMS}.`,
      );
    }

    if (messages.length > 0) {
      setValidationMessage(messages.join("\n"));
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

  const removeExistingMedia = (assetId: string) => {
    setRemovedAssetIds((prev) =>
      prev.includes(assetId) ? prev : [...prev, assetId],
    );
  };

  const submit = async () => {
    if (submitting) return;

    Keyboard.dismiss();
    setValidationMessage(null);
    setSubmitting(true);

    try {
      const trimmedCaption = caption.trim();
      const totalMediaCount = visibleExistingAssetIds.length + media.length;

      if (!trimmedCaption && totalMediaCount === 0) {
        setValidationMessage("Add a caption or at least one media item.");
        return;
      }

      const { validAssets, skippedLongVideoCount, skippedUnknownVideoCount } =
        await validateVideoAssets(media);

      if (
        skippedLongVideoCount > 0 ||
        skippedUnknownVideoCount > 0 ||
        validAssets.length !== media.length
      ) {
        const messages: string[] = [];
        if (skippedLongVideoCount > 0) {
          messages.push(
            `${skippedLongVideoCount} selected video${skippedLongVideoCount > 1 ? "s exceed" : " exceeds"} 10 seconds.`,
          );
        }
        if (skippedUnknownVideoCount > 0) {
          messages.push(
            `${skippedUnknownVideoCount} selected video${skippedUnknownVideoCount > 1 ? "s have" : " has"} unknown duration.`,
          );
        }
        messages.push("Please remove invalid videos before saving.");
        setValidationMessage(messages.join("\n"));
        return;
      }

      const files = validAssets.map((m) => ({
        uri: m.uri,
        name: getFileName(m),
        type: getMimeType(m),
      }));

      if (isEditMode && entryId) {
        await updateEntry(entryId, trimmedCaption, files, removedAssetIds);
      } else if (isBackfill) {
        await createBackfilledEntry(displayDate, trimmedCaption, files);
      } else {
        await createEntry(trimmedCaption, files);
      }
      setShowSuccess(true);
      setCountdown(3);
    } catch (error) {
      console.error("Failed to save entry", error);
    } finally {
      setSubmitting(false);
    }
  };

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
        <Title>{isEditMode ? "Edit Entry" : "New Entry"}</Title>
        <View style={{ width: 26 }} />
      </View>

      {/* META */}
      <View style={styles.meta}>
        {!forcedBackfill && !isEditMode && (
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
            if (!isBackfill || isEditMode) return;
            setTempDate(new Date(`${pastDateString}T00:00:00`));
            setShowDatePicker(true);
          }}
          style={[
            styles.datePill,
            (!isBackfill || isEditMode) && { opacity: 0.6 },
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

          {!isEditMode && (forcedBackfill || entryMode === "past") && (
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
          <Body style={{ color: "white" }}>{isEditMode ? "Update" : "Save"}</Body>
        </Pressable>
      </View>

      {!!validationMessage && (
        <View style={styles.validationBanner}>
          <Body style={styles.validationText}>{validationMessage}</Body>
        </View>
      )}

      {/* MEDIA */}
      {(visibleExistingAssetIds.length > 0 || media.length > 0) && (
        <View style={styles.mediaStripContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mediaStrip}
          >
            {visibleExistingAssetIds.map((assetId) => (
              <View key={`existing-${assetId}`} style={styles.mediaWrapper}>
                <Image
                  source={{
                    uri: apiUrl(`/api/media/immich/${assetId}?type=thumbnail`),
                  }}
                  style={styles.media}
                />

                <View style={styles.existingBadge}>
                  <Body style={styles.existingBadgeText}>Saved</Body>
                </View>

                <Pressable
                  style={styles.removeBtn}
                  onPress={() => removeExistingMedia(assetId)}
                >
                  <Ionicons name="close" size={16} color="white" />
                </Pressable>
              </View>
            ))}

            {media.map((m) => (
              <View key={m.uri} style={styles.mediaWrapper}>
                {m.type === "video" && Platform.OS === "web" && m.previewUri ? (
                  <View style={styles.videoPreviewWrap}>
                    <Image source={{ uri: m.previewUri }} style={styles.media} />
                    <View style={styles.videoPreviewBadge}>
                      <Ionicons name="play" size={14} color="#fff" />
                    </View>
                  </View>
                ) : m.type === "video" ? (
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
                  style={{
                    ...(styles.webDateInput as any),
                    border: "none",
                    outline: "none",
                  }}
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
            <Title>
              {isEditMode
                ? "Your changes will be securely synced to the cloud."
                : "Your entry will be securely synced to the cloud."}
            </Title>
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
  validationBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(228,88,88,0.15)",
    borderWidth: 1,
    borderColor: "rgba(228,88,88,0.45)",
  },
  validationText: {
    fontSize: 12,
    lineHeight: 17,
    color: "#FFD5D5",
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
  videoPreviewWrap: {
    width: "100%",
    height: "100%",
  },
  videoPreviewBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },

  existingBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
  },

  existingBadgeText: {
    fontSize: 10,
    color: "#fff",
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
