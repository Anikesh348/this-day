import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image as ExpoImage } from "expo-image";
import { Audio, ResizeMode, Video } from "expo-av";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TextInputContentSizeChangeEventData,
  View,
} from "react-native";

import { Screen } from "@/components/Screen";
import { Body, Muted, Title } from "@/components/Text";
import {
  createBackfilledEntry,
  createEntry,
  type EntryFile,
  updateEntry,
} from "@/services/entries";
import { apiUrl } from "@/services/apiBase";
import { ThemeName } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

type MediaItem = ImagePicker.ImagePickerAsset & {
  clientMediaId: string;
  loading?: boolean;
  previewUri?: string | null;
  uploadName: string;
  uploadMimeType: string;
  webFile?: Blob | null;
};

type ExistingPreviewLevel = "thumbnail" | "preview" | "full" | "failed";

type ThemePalette = {
  headerIcon: string;
  accentIcon: string;
  toggleBackground: string;
  toggleActiveBackground: string;
  datePillBackground: string;
  datePillBorder: string;
  dateText: string;
  iconButtonBackground: string;
  saveButtonBackground: string;
  saveButtonText: string;
  validationBackground: string;
  validationBorder: string;
  validationText: string;
  progressBackground: string;
  progressBorder: string;
  progressText: string;
  mediaWrapperBackground: string;
  previewFallbackBackground: string;
  previewFallbackBorder: string;
  previewFallbackIcon: string;
  previewFallbackText: string;
  editorText: string;
  editorBorder: string;
  editorBackground: string;
  editorFocusedBorder: string;
  editorFocusedBackground: string;
  placeholder: string;
  pickerCardBackground: string;
  chipBackground: string;
  chipBorder: string;
  chipText: string;
  dateInputBackground: string;
  dateInputBorder: string;
  dateInputText: string;
  pickerCancel: string;
  pickerConfirm: string;
  successCardBackground: string;
  successIcon: string;
};

function buildThemePalette(
  colors: {
    surface: string;
    surfaceAlt: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentGlow: string;
  },
  themeName: ThemeName,
): ThemePalette {
  if (themeName === "cute") {
    return {
      headerIcon: colors.textPrimary,
      accentIcon: colors.accent,
      toggleBackground: "#FBEAF5",
      toggleActiveBackground: "#FFD8EC",
      datePillBackground: "#FFF8FD",
      datePillBorder: "#EDB9DB",
      dateText: "#8A4D70",
      iconButtonBackground: "#FFF8FD",
      saveButtonBackground: colors.accent,
      saveButtonText: "#FFFFFF",
      validationBackground: "rgba(255,90,122,0.14)",
      validationBorder: "rgba(255,90,122,0.36)",
      validationText: "#8C2F4E",
      progressBackground: "rgba(255,111,179,0.12)",
      progressBorder: "rgba(255,111,179,0.3)",
      progressText: "#8A4D70",
      mediaWrapperBackground: "#FFEAF6",
      previewFallbackBackground: "#FFF4FB",
      previewFallbackBorder: "#EDB9DB",
      previewFallbackIcon: "#B76A94",
      previewFallbackText: "#8A4D70",
      editorText: colors.textPrimary,
      editorBorder: "#EDB9DB",
      editorBackground: "#FFF8FD",
      editorFocusedBorder: colors.accent,
      editorFocusedBackground: "#FFFFFF",
      placeholder: "#AD6D93",
      pickerCardBackground: "#FFF8FD",
      chipBackground: "#FFEAF6",
      chipBorder: "#EDB9DB",
      chipText: "#8A4D70",
      dateInputBackground: "#FFFFFF",
      dateInputBorder: "#EDB9DB",
      dateInputText: colors.textPrimary,
      pickerCancel: "#8A4D70",
      pickerConfirm: colors.accent,
      successCardBackground: "#FFF8FD",
      successIcon: colors.accent,
    };
  }

  if (themeName === "onyx") {
    return {
      headerIcon: colors.textPrimary,
      accentIcon: colors.accent,
      toggleBackground: colors.surface,
      toggleActiveBackground: colors.surfaceAlt,
      datePillBackground: colors.surface,
      datePillBorder: colors.border,
      dateText: colors.textSecondary,
      iconButtonBackground: colors.surface,
      saveButtonBackground: colors.accent,
      saveButtonText: "#1B1406",
      validationBackground: "rgba(255,95,119,0.14)",
      validationBorder: "rgba(255,95,119,0.35)",
      validationText: "#FF9EAE",
      progressBackground: "rgba(230,193,90,0.16)",
      progressBorder: "rgba(230,193,90,0.34)",
      progressText: "#F5E3B8",
      mediaWrapperBackground: colors.surface,
      previewFallbackBackground: colors.surfaceAlt,
      previewFallbackBorder: colors.border,
      previewFallbackIcon: "#E6C15A",
      previewFallbackText: colors.textSecondary,
      editorText: colors.textPrimary,
      editorBorder: colors.border,
      editorBackground: colors.surface,
      editorFocusedBorder: colors.accent,
      editorFocusedBackground: colors.surfaceAlt,
      placeholder: colors.textMuted,
      pickerCardBackground: colors.surface,
      chipBackground: colors.surfaceAlt,
      chipBorder: colors.border,
      chipText: colors.textPrimary,
      dateInputBackground: colors.surfaceAlt,
      dateInputBorder: colors.border,
      dateInputText: colors.textPrimary,
      pickerCancel: colors.textMuted,
      pickerConfirm: colors.accent,
      successCardBackground: colors.surface,
      successIcon: colors.accent,
    };
  }

  return {
    headerIcon: "#FFFFFF",
    accentIcon: "#8AA4FF",
    toggleBackground: "#1F2328",
    toggleActiveBackground: "#2C3440",
    datePillBackground: "rgba(108,140,255,0.08)",
    datePillBorder: "rgba(108,140,255,0.25)",
    dateText: "#C9D4FF",
    iconButtonBackground: "#1F2328",
    saveButtonBackground: "#6C8CFF",
    saveButtonText: "#FFFFFF",
    validationBackground: "rgba(228,88,88,0.15)",
    validationBorder: "rgba(228,88,88,0.45)",
    validationText: "#FFD5D5",
    progressBackground: "rgba(108,140,255,0.12)",
    progressBorder: "rgba(108,140,255,0.4)",
    progressText: "#D8E2FF",
    mediaWrapperBackground: "#111",
    previewFallbackBackground: "#161A20",
    previewFallbackBorder: "rgba(255,255,255,0.12)",
    previewFallbackIcon: "#C9D4FF",
    previewFallbackText: "#C9D4FF",
    editorText: "#FFFFFF",
    editorBorder: "#2C3440",
    editorBackground: "#0F1115",
    editorFocusedBorder: "#6C8CFF",
    editorFocusedBackground: "#0F1115",
    placeholder: "#8A8F98",
    pickerCardBackground: "#1F2328",
    chipBackground: "rgba(255,255,255,0.06)",
    chipBorder: "rgba(255,255,255,0.12)",
    chipText: "#D7DCE5",
    dateInputBackground: "#13161B",
    dateInputBorder: "rgba(255,255,255,0.12)",
    dateInputText: "#FFFFFF",
    pickerCancel: "#AAAAAA",
    pickerConfirm: "#6C8CFF",
    successCardBackground: "#1F2328",
    successIcon: "#6C8CFF",
  };
}

const MAX_MEDIA_ITEMS = 3;
const MAX_VIDEO_DURATION_MS = 10 * 1000;
const LOCAL_PREVIEW_LOAD_TIMEOUT_MS = 4500;
const MIN_EDITOR_HEIGHT = 120;
const MAX_EDITOR_HEIGHT = 320;

function normalizeDurationMs(duration?: number | null) {
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  // Some providers return seconds, others milliseconds.
  return duration > 1000 ? duration : duration * 1000;
}

function createClientMediaId() {
  const maybeCrypto = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (maybeCrypto?.randomUUID) {
    return maybeCrypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeUploadFileName(input?: string | null, fallbackExt = "jpg") {
  const raw = (input ?? "").trim();
  if (!raw) {
    return `file-${Date.now()}.${fallbackExt}`;
  }
  const sanitized = raw.replace(/[^\w.\- ]+/g, "_");
  if (/\.[a-z0-9]+$/i.test(sanitized)) {
    return sanitized;
  }
  return `${sanitized}.${fallbackExt}`;
}

function fallbackMimeType(asset: ImagePicker.ImagePickerAsset) {
  if (asset.type === "video") return "video/mp4";
  return "image/jpeg";
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

function extensionFromPath(input?: string | null) {
  if (!input) return null;
  const normalized = input.toLowerCase().split("#")[0]?.split("?")[0] ?? "";
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === normalized.length - 1) return null;
  return normalized.slice(dotIndex + 1);
}

function isDefinitelyUnsupportedWebImageAsset(asset: {
  type?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  uri?: string | null;
}) {
  if (Platform.OS !== "web" || asset.type === "video") return false;

  const mime = (asset.mimeType ?? "").toLowerCase();
  const ext =
    extensionFromPath(asset.fileName) ?? extensionFromPath(asset.uri);

  if (mime.includes("tiff") || mime.includes("raw")) {
    return true;
  }

  if (!ext) return false;

  return ["tif", "tiff", "dng", "cr2", "cr3", "nef", "arw"].includes(
    ext,
  );
}

export default function AddEntryScreen() {
  const { colors, themeName } = useTheme();
  const palette = useMemo(
    () => buildThemePalette(colors, themeName),
    [colors, themeName],
  );
  const styles = useMemo(() => createStyles(palette), [palette]);

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
  const [editorHeight, setEditorHeight] = useState(MIN_EDITOR_HEIGHT);

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [existingAssetIds, setExistingAssetIds] = useState<string[]>([]);
  const [removedAssetIds, setRemovedAssetIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const [failedLocalPreviewUris, setFailedLocalPreviewUris] = useState<
    Record<string, true>
  >({});
  const [existingPreviewLevels, setExistingPreviewLevels] = useState<
    Record<string, ExistingPreviewLevel>
  >({});
  const localPreviewTimeoutsRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const generatedObjectUrlsRef = useRef<Record<string, string>>({});

  const [showSuccess, setShowSuccess] = useState(false);

  const isBackfill = forcedBackfill || entryMode === "past";
  const displayDate = isEditMode
    ? (date ?? toISTDateString(new Date()))
    : forcedBackfill
      ? date!
      : pastDateString;
  const visibleExistingAssetIds = existingAssetIds.filter(
    (id) => !removedAssetIds.includes(id),
  );

  const releaseGeneratedObjectUrl = useCallback((clientMediaId: string) => {
    const objectUrl = generatedObjectUrlsRef.current[clientMediaId];
    if (!objectUrl || Platform.OS !== "web") return;
    URL.revokeObjectURL(objectUrl);
    delete generatedObjectUrlsRef.current[clientMediaId];
  }, []);

  const releaseAllGeneratedObjectUrls = useCallback(() => {
    if (Platform.OS !== "web") return;
    Object.keys(generatedObjectUrlsRef.current).forEach((clientMediaId) => {
      const objectUrl = generatedObjectUrlsRef.current[clientMediaId];
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      delete generatedObjectUrlsRef.current[clientMediaId];
    });
  }, []);

  function toISTDateString(date: Date) {
    const ist = new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000);

    return ist.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  useFocusEffect(
    useCallback(() => {
      Object.values(localPreviewTimeoutsRef.current).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      localPreviewTimeoutsRef.current = {};
      releaseAllGeneratedObjectUrls();
      setCaption(isEditMode ? entryCaption : "");
      setMedia([]);
      setExistingAssetIds(isEditMode ? parsedExistingAssetIds : []);
      setRemovedAssetIds([]);
      setSubmitting(false);
      setIsPreparingMedia(false);
      setEntryMode("today");
      setPastDateString(date ?? toISTDateString(new Date()));
      setShowSuccess(false);
      setTempDate(null);
      setUploadStatus(null);
      setFailedLocalPreviewUris({});
      setExistingPreviewLevels({});
      setEditorHeight(MIN_EDITOR_HEIGHT);

      requestAnimationFrame(() => inputRef.current?.focus());

      return () => {
        Object.values(localPreviewTimeoutsRef.current).forEach((timeoutId) => {
          clearTimeout(timeoutId);
        });
        localPreviewTimeoutsRef.current = {};
        releaseAllGeneratedObjectUrls();
        inputRef.current?.blur();
        Keyboard.dismiss();
      };
    }, [
      date,
      entryCaption,
      isEditMode,
      parsedExistingAssetIds,
      releaseAllGeneratedObjectUrls,
    ]),
  );

  useEffect(() => {
    if (!validationMessage) return;

    const t = setTimeout(() => setValidationMessage(null), 3200);
    return () => clearTimeout(t);
  }, [validationMessage]);

  useEffect(() => {
    if (!showSuccess) return;

    const t = setTimeout(() => {
      setShowSuccess(false);
      router.replace("/today");
    }, 650);
    return () => clearTimeout(t);
  }, [showSuccess, router]);


  const handleBack = () => {
    if (from === "day" && date) {
      router.replace({ pathname: "day/[date]", params: { date } });
    } else {
      router.replace("/today");
    }
  };

  const addFromGallery = async () => {
    if (submitting || isPreparingMedia) return;

    Keyboard.dismiss();
    const remainingSlots =
      MAX_MEDIA_ITEMS - (visibleExistingAssetIds.length + media.length);
    if (remainingSlots <= 0) {
      setValidationMessage(
        `You can only attach up to ${MAX_MEDIA_ITEMS} media items.`,
      );
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      orderedSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
    });

    if (res.canceled) return;

    await addSelectedMedia(res.assets);
  };

  const captureFromCamera = async () => {
    if (submitting || isPreparingMedia) return;

    Keyboard.dismiss();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
      videoMaxDuration: MAX_VIDEO_DURATION_MS / 1000,
    });

    if (res.canceled) return;

    await addSelectedMedia(res.assets);
  };

  const prepareMediaItem = async (
    asset: ImagePicker.ImagePickerAsset,
  ): Promise<MediaItem> => {
    const clientMediaId = createClientMediaId();
    const fallbackExt = asset.type === "video" ? "mp4" : "jpg";
    let uploadName = safeUploadFileName(
      asset.file?.name ?? asset.fileName,
      fallbackExt,
    );
    let uploadMimeType = (asset.mimeType ?? fallbackMimeType(asset)).toLowerCase();
    let localUri = asset.uri;
    let webFile: Blob | null =
      Platform.OS === "web" && asset.file instanceof Blob ? asset.file : null;
    let loading = !(Platform.OS === "web" && asset.type === "video");
    let previewUri: string | null = null;

    if (Platform.OS === "web" && webFile) {
      const webName = (webFile as { name?: unknown }).name;
      if (typeof webName === "string" && webName.trim().length > 0) {
        uploadName = safeUploadFileName(webName, fallbackExt);
      }

      const webType = (webFile as { type?: unknown }).type;
      if (typeof webType === "string" && webType.trim().length > 0) {
        uploadMimeType = webType.toLowerCase();
      }
    }

    if (Platform.OS === "web" && asset.type === "video") {
      previewUri = await generateWebVideoThumbnail(asset.uri);
      loading = false;
    }

    return {
      ...asset,
      uri: localUri,
      fileName: uploadName,
      mimeType: uploadMimeType,
      clientMediaId,
      loading,
      previewUri,
      uploadName,
      uploadMimeType,
      webFile,
    };
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
      setIsPreparingMedia(true);
      try {
        const preparedAssets = await Promise.all(
          limitedAssets.map((asset) => prepareMediaItem(asset)),
        );

        setMedia((p) => [...p, ...preparedAssets]);
      } catch (error) {
        console.error("Failed to prepare selected media", error);
        setValidationMessage(
          "Some selected media could not be prepared. Please try again.",
        );
      } finally {
        setIsPreparingMedia(false);
      }
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

  const markLoaded = (clientMediaId: string) => {
    const timeoutId = localPreviewTimeoutsRef.current[clientMediaId];
    if (timeoutId) {
      clearTimeout(timeoutId);
      delete localPreviewTimeoutsRef.current[clientMediaId];
    }

    setMedia((p) =>
      p.map((m) =>
        m.clientMediaId === clientMediaId ? { ...m, loading: false } : m,
      ),
    );
  };

  const removeMedia = (clientMediaId: string) => {
    const timeoutId = localPreviewTimeoutsRef.current[clientMediaId];
    if (timeoutId) {
      clearTimeout(timeoutId);
      delete localPreviewTimeoutsRef.current[clientMediaId];
    }

    releaseGeneratedObjectUrl(clientMediaId);
    setMedia((p) => p.filter((m) => m.clientMediaId !== clientMediaId));
    setFailedLocalPreviewUris((prev) => {
      if (!prev[clientMediaId]) return prev;
      const next = { ...prev };
      delete next[clientMediaId];
      return next;
    });
  };

  const removeExistingMedia = (assetId: string) => {
    setRemovedAssetIds((prev) =>
      prev.includes(assetId) ? prev : [...prev, assetId],
    );
    setExistingPreviewLevels((prev) => {
      if (!prev[assetId]) return prev;
      const next = { ...prev };
      delete next[assetId];
      return next;
    });
  };

  const markLocalPreviewFailed = (clientMediaId: string) => {
    const timeoutId = localPreviewTimeoutsRef.current[clientMediaId];
    if (timeoutId) {
      clearTimeout(timeoutId);
      delete localPreviewTimeoutsRef.current[clientMediaId];
    }

    markLoaded(clientMediaId);
    setFailedLocalPreviewUris((prev) =>
      prev[clientMediaId] ? prev : { ...prev, [clientMediaId]: true },
    );
  };

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const pendingPreviewIds = new Set(
      media
        .filter(
          (item) =>
            item.type !== "video" &&
            item.loading &&
            !failedLocalPreviewUris[item.clientMediaId] &&
            !isDefinitelyUnsupportedWebImageAsset(item),
        )
        .map((item) => item.clientMediaId),
    );

    Object.keys(localPreviewTimeoutsRef.current).forEach((clientMediaId) => {
      if (pendingPreviewIds.has(clientMediaId)) return;

      clearTimeout(localPreviewTimeoutsRef.current[clientMediaId]);
      delete localPreviewTimeoutsRef.current[clientMediaId];
    });

    pendingPreviewIds.forEach((clientMediaId) => {
      if (localPreviewTimeoutsRef.current[clientMediaId]) return;

      localPreviewTimeoutsRef.current[clientMediaId] = setTimeout(() => {
        markLocalPreviewFailed(clientMediaId);
      }, LOCAL_PREVIEW_LOAD_TIMEOUT_MS);
    });
  }, [failedLocalPreviewUris, media]);

  const advanceExistingPreviewLevel = (assetId: string) => {
    setExistingPreviewLevels((prev) => {
      const current = prev[assetId] ?? "thumbnail";
      const nextLevel: ExistingPreviewLevel =
        current === "thumbnail"
          ? "preview"
          : current === "preview"
            ? "full"
            : "failed";

      if (current === nextLevel) return prev;
      return { ...prev, [assetId]: nextLevel };
    });
  };

  const handleEditorContentSizeChange = (
    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => {
    const measuredHeight = Math.ceil(event.nativeEvent.contentSize.height);
    const clampedHeight = Math.max(
      MIN_EDITOR_HEIGHT,
      Math.min(MAX_EDITOR_HEIGHT, measuredHeight),
    );

    setEditorHeight((prev) => (prev === clampedHeight ? prev : clampedHeight));
  };

  const submit = async () => {
    if (submitting) return;

    Keyboard.dismiss();
    setValidationMessage(null);
    const trimmedCaption = caption.trim();
    const hasAnyMedia = visibleExistingAssetIds.length + media.length > 0;

    if (isPreparingMedia) {
      setValidationMessage("Please wait until selected media is ready.");
      return;
    }

    if (!trimmedCaption && !hasAnyMedia) {
      setValidationMessage("Add a caption or at least one media item before saving.");
      return;
    }

    setSubmitting(true);
    setUploadStatus(null);

    try {
      const files: EntryFile[] = media.map((m) => ({
        uri: m.uri,
        name: m.uploadName,
        type: m.uploadMimeType,
        clientMediaId: m.clientMediaId,
        webFile: m.webFile ?? null,
      }));

      if (isEditMode && entryId) {
        await updateEntry(entryId, trimmedCaption, files, removedAssetIds);
      } else if (isBackfill) {
        setUploadStatus(
          files.length > 0
            ? `Uploading media 0/${files.length}`
            : "Finalizing entry...",
        );
        await createBackfilledEntry(
          displayDate,
          trimmedCaption,
          files,
          (uploaded, total) => {
            if (total === 0 || uploaded >= total) {
              setUploadStatus("Finalizing entry...");
              return;
            }
            setUploadStatus(`Uploading media ${uploaded}/${total}`);
          },
        );
      } else {
        setUploadStatus(
          files.length > 0
            ? `Uploading media 0/${files.length}`
            : "Finalizing entry...",
        );
        await createEntry(trimmedCaption, files, (uploaded, total) => {
          if (total === 0 || uploaded >= total) {
            setUploadStatus("Finalizing entry...");
            return;
          }
          setUploadStatus(`Uploading media ${uploaded}/${total}`);
        });
      }
      setUploadStatus(null);
      setShowSuccess(true);
    } catch (error) {
      console.error("Failed to save entry", error);
      setValidationMessage("Failed to save entry. Please try again.");
      setUploadStatus(null);
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
          <Ionicons name="chevron-back" size={26} color={palette.headerIcon} />
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
          <Ionicons name="calendar-outline" size={16} color={palette.accentIcon} />
          <Muted style={styles.dateText}>
            {new Date(`${displayDate}T00:00:00`).toDateString()}
          </Muted>
        </Pressable>
      </View>

      {/* ACTION ROW */}
      <View style={styles.actions}>
        <View style={styles.actionLeft}>
          <Pressable
            style={[
              styles.iconBtn,
              (submitting || isPreparingMedia) && styles.disabledControl,
            ]}
            onPress={addFromGallery}
            disabled={submitting || isPreparingMedia}
          >
            <Ionicons name="images-outline" size={22} color={palette.accentIcon} />
          </Pressable>

          <Pressable
            style={[
              styles.iconBtn,
              (submitting || isPreparingMedia) && styles.disabledControl,
            ]}
            onPress={captureFromCamera}
            disabled={submitting || isPreparingMedia}
          >
            <Ionicons name="camera-outline" size={22} color={palette.accentIcon} />
          </Pressable>

          {!isEditMode && (forcedBackfill || entryMode === "past") && (
            <Pressable
              style={styles.iconBtn}
              onPress={() => {
                setTempDate(new Date(`${pastDateString}T00:00:00`));
                setShowDatePicker(true);
              }}
            >
              <Ionicons name="calendar-outline" size={22} color={palette.accentIcon} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={[
            styles.saveBtn,
            (submitting || isPreparingMedia) && styles.disabledControl,
          ]}
          onPress={submit}
          disabled={submitting || isPreparingMedia}
        >
          <Body style={{ color: palette.saveButtonText }}>
            {isEditMode ? "Update" : "Save"}
          </Body>
        </Pressable>
      </View>

      {!!validationMessage && (
        <View style={styles.validationBanner}>
          <Body style={styles.validationText}>{validationMessage}</Body>
        </View>
      )}

      {isPreparingMedia && (
        <View style={styles.progressBanner}>
          <Body style={styles.progressText}>Preparing media for upload...</Body>
        </View>
      )}

      {!!uploadStatus && (
        <View style={styles.progressBanner}>
          <Body style={styles.progressText}>{uploadStatus}</Body>
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
            {visibleExistingAssetIds.map((assetId) => {
              const level = existingPreviewLevels[assetId] ?? "thumbnail";
              const hasFailed = level === "failed";

              return (
                <View key={`existing-${assetId}`} style={styles.mediaWrapper}>
                  {hasFailed ? (
                    <View style={styles.previewFallback}>
                      <Ionicons name="image-outline" size={20} color={palette.previewFallbackIcon} />
                      <Muted style={styles.previewFallbackText}>Preview unavailable</Muted>
                    </View>
                  ) : (
                    <ExpoImage
                      source={{
                        uri: apiUrl(`/api/media/immich/${assetId}?type=${level}`),
                      }}
                      style={styles.media}
                      cachePolicy="memory-disk"
                      contentFit="cover"
                      transition={90}
                      onError={() => advanceExistingPreviewLevel(assetId)}
                    />
                  )}

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
              );
            })}

            {media.map((m) => {
              const isUnsupportedWebImage =
                Platform.OS === "web" && isDefinitelyUnsupportedWebImageAsset(m);
              const hasLocalPreviewFailed = !!failedLocalPreviewUris[m.clientMediaId];

              return (
                <View key={m.clientMediaId} style={styles.mediaWrapper}>
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
                      onLoad={() => markLoaded(m.clientMediaId)}
                      onReadyForDisplay={() => markLoaded(m.clientMediaId)}
                    />
                  ) : isUnsupportedWebImage || hasLocalPreviewFailed ? (
                    <View style={styles.previewFallback}>
                      <Ionicons
                        name={isUnsupportedWebImage ? "document-text-outline" : "image-outline"}
                        size={20}
                        color={palette.previewFallbackIcon}
                      />
                      <Muted style={styles.previewFallbackText}>
                        {isUnsupportedWebImage ? "Format selected" : "Preview unavailable"}
                      </Muted>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: m.uri }}
                      style={styles.media}
                      resizeMode="cover"
                      onLoadEnd={() => markLoaded(m.clientMediaId)}
                      onError={() => markLocalPreviewFailed(m.clientMediaId)}
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
                      onPress={() => removeMedia(m.clientMediaId)}
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* CAPTION */}
      <View
        style={[
          styles.captionSection,
          Platform.OS === "web" && styles.captionSectionWeb,
        ]}
      >
        <View style={[styles.composer, Platform.OS === "web" && styles.composerWeb]}>
          <TextInput
            ref={inputRef}
            autoFocus
            multiline
            scrollEnabled={editorHeight >= MAX_EDITOR_HEIGHT}
            value={caption}
            onChangeText={setCaption}
            onContentSizeChange={handleEditorContentSizeChange}
            placeholder="What's new?"
            placeholderTextColor={palette.placeholder}
            onFocus={() => {
              setIsEditorFocused(true);
            }}
            onBlur={() => setIsEditorFocused(false)}
            style={[
              styles.editor,
              { height: editorHeight },
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
                <Body style={{ color: palette.pickerCancel }}>Cancel</Body>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowDatePicker(false); // pastDateString already correct
                }}
              >
                <Ionicons name="checkmark-circle" size={28} color={palette.pickerConfirm} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* SUCCESS MODAL */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={64} color={palette.successIcon} />
            <Title>
              {isEditMode
                ? "Your changes will be securely synced to the cloud."
                : "Your entry will be securely synced to the cloud."}
            </Title>
            <Muted>Opening home…</Muted>
          </View>
        </View>
      </Modal>
      </View>
    </Screen>
  );
}

const createStyles = (palette: ThemePalette) =>
  StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
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
    backgroundColor: palette.toggleBackground,
    borderRadius: 16,
    padding: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 6, alignItems: "center" },
  toggleActive: { backgroundColor: palette.toggleActiveBackground, borderRadius: 12 },
  dateLabel: { paddingHorizontal: 16, paddingBottom: 10, paddingTop: 10 },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: palette.datePillBackground,
    borderWidth: 1,
    borderColor: palette.datePillBorder,
  },
  dateText: {
    color: palette.dateText,
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
    backgroundColor: palette.iconButtonBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledControl: {
    opacity: 0.6,
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: palette.saveButtonBackground,
  },
  validationBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: palette.validationBackground,
    borderWidth: 1,
    borderColor: palette.validationBorder,
  },
  validationText: {
    fontSize: 12,
    lineHeight: 17,
    color: palette.validationText,
  },
  progressBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: palette.progressBackground,
    borderWidth: 1,
    borderColor: palette.progressBorder,
  },
  progressText: {
    fontSize: 12,
    lineHeight: 17,
    color: palette.progressText,
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
    backgroundColor: palette.mediaWrapperBackground,
  },

  media: {
    width: "100%",
    height: "100%",
  },
  previewFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: palette.previewFallbackBackground,
    borderWidth: 1,
    borderColor: palette.previewFallbackBorder,
  },
  previewFallbackText: {
    fontSize: 11,
    color: palette.previewFallbackText,
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

  captionSection: { flex: 1 },
  captionSectionWeb: {
    minHeight: 0,
    overflow: "hidden",
  },
  composer: { paddingHorizontal: 16, paddingVertical: 2 },
  composerWeb: {
    flex: 1,
    minHeight: 0,
  },
  editor: { fontSize: 20, color: palette.editorText },

  editorWeb: {
    borderWidth: 1,
    borderColor: palette.editorBorder,
    borderRadius: 14,
    padding: 12,
    backgroundColor: palette.editorBackground,
  },

  editorWebFocused: {
    borderColor: palette.editorFocusedBorder,
    backgroundColor: palette.editorFocusedBackground,
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

  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerCard: {
    backgroundColor: palette.pickerCardBackground,
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
    backgroundColor: palette.chipBackground,
    borderWidth: 1,
    borderColor: palette.chipBorder,
  },
  chipText: {
    color: palette.chipText,
    fontSize: 13,
  },
  webDateInputWrap: {
    borderRadius: 14,
    padding: 10,
    backgroundColor: palette.dateInputBackground,
    borderWidth: 1,
    borderColor: palette.dateInputBorder,
  },
  webDateInput: {
    width: "100%",
    backgroundColor: "transparent",
    color: palette.dateInputText,
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
    backgroundColor: palette.successCardBackground,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    width: "80%",
  },
  });
