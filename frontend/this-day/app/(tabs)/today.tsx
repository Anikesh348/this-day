import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Body, Muted } from "@/components/Text";
import {
  getSameDayPreviousMonths,
  getSameDayPreviousYears,
  getSameDaySummary,
} from "@/services/entries";
import { apiUrl } from "@/services/apiBase";
import { useTheme } from "@/theme/ThemeProvider";
import { ThemeName } from "@/theme/colors";

interface Entry {
  _id: string;
  caption: string;
  date: string; // YYYY-MM-DD
  immichAssetIds?: string[];
  createdAt?: string;
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function toISTDateKey(value: Date) {
  return new Date(value.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function parseDateKey(rawDate?: string) {
  if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
  return toISTDateKey(new Date());
}

function formatDayDateLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const stableDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return stableDate.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export default function TodayScreen() {
  const { colors, themeName } = useTheme();
  const styles = useMemo(() => createStyles(colors, themeName), [colors, themeName]);
  const router = useRouter();

  const { date, from } = useLocalSearchParams<{
    date?: string;
    from?: "calendar" | "day" | "today";
  }>();

  const [today, setToday] = useState<Entry | null>(null);
  const [pastEntries, setPastEntries] = useState<Entry[]>([]);
  const [pastIndex, setPastIndex] = useState(0);
  const [pastCarouselWidth, setPastCarouselWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [videoIds, setVideoIds] = useState<Record<string, true>>({});
  const checkedIds = useRef(new Set<string>());
  const latestLoadRequestId = useRef(0);

  const targetDateKey = useMemo(() => parseDateKey(date), [date]);

  const loadData = async () => {
    const requestId = latestLoadRequestId.current + 1;
    latestLoadRequestId.current = requestId;
    setLoading(true);

    const [y, m, day] = targetDateKey.split("-").map(Number);

    const [todayRes, yearRes, monthRes] = await Promise.allSettled([
      getSameDaySummary(y, m, day),
      getSameDayPreviousYears(y, m, day),
      getSameDayPreviousMonths(y, m, day),
    ]);

    if (requestId !== latestLoadRequestId.current) return;

    if (todayRes.status === "fulfilled" && todayRes.value.data?.length > 0) {
      setToday(todayRes.value.data[0]);
    } else {
      setToday(null);
    }

    const yearEntries =
      yearRes.status === "fulfilled" && Array.isArray(yearRes.value.data)
        ? (yearRes.value.data as Entry[])
        : [];
    const monthEntries =
      monthRes.status === "fulfilled" && Array.isArray(monthRes.value.data)
        ? (monthRes.value.data as Entry[])
        : [];

    const combined = [...yearEntries, ...monthEntries];
    const deduped = new Map<string, Entry>();
    combined.forEach((entry) => {
      if (!entry?._id) return;
      if (!deduped.has(entry._id)) {
        deduped.set(entry._id, entry);
      }
    });

    const sorted = Array.from(deduped.values()).sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });
    setPastEntries(sorted);

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [targetDateKey]),
  );

  useEffect(() => {
    setPastIndex(0);
  }, [targetDateKey, pastEntries.length]);

  useEffect(() => {
    const ids = [
      today?.immichAssetIds?.[0],
      ...pastEntries.map((entry) => entry.immichAssetIds?.[0]),
    ].filter(Boolean) as string[];

    const pending = ids.filter((id) => !checkedIds.current.has(id));
    if (pending.length === 0) return;

    const fetchType = async (assetId: string) => {
      checkedIds.current.add(assetId);
      try {
        const res = await fetch(
          apiUrl(`/api/media/immich/${assetId}?type=full`),
          { method: "HEAD" },
        );
        const type = res.headers.get("content-type") ?? "";
        if (type.startsWith("video/")) {
          setVideoIds((prev) =>
            prev[assetId] ? prev : { ...prev, [assetId]: true },
          );
        }
      } catch {}
    };

    pending.forEach((id) => void fetchType(id));
  }, [today, pastEntries]);

  const openDay = (entryDate: string) => {
    const dayOrigin = from === "calendar" || from === "day" ? "calendar" : "today";
    router.push({
      pathname: "day/[date]",
      params: {
        date: entryDate,
        from: dayOrigin,
      },
    });
  };

  const formatDate = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // 🆕 back handler
  const handleBack = () => {
    router.replace("/calendar");
  };

  const renderCard = (
    entry: Entry,
    label: string,
    showDateHint = false,
    extraStyle?: any,
    keyPrefix?: string,
    positionText?: string,
    showDots?: boolean,
    dotCount?: number,
    activeDotIndex?: number,
  ) => {
    const assetId = entry.immichAssetIds?.[0];
    const hasCaption = entry.caption && entry.caption.trim().length > 0;

    return (
      <Pressable
        key={`${keyPrefix ?? "entry"}-${entry._id}`}
        style={[styles.card, styles.entryCard, extraStyle]}
        onPress={() => openDay(entry.date)}
      >
        <View style={styles.cardHeader}>
          <Muted style={styles.cardLabel}>{label}</Muted>
          {(showDateHint || !!positionText) && (
            <View style={styles.cardHeaderRight}>
              {showDateHint && (
                <Muted style={styles.dateHint}>{formatDate(entry.date)}</Muted>
              )}
              {!!positionText && (
                <Muted style={styles.positionHint}>{positionText}</Muted>
              )}
            </View>
          )}
        </View>

        <View style={styles.imageWrap}>
          {assetId ? (
            <Image
              source={{
                uri: apiUrl(`/api/media/immich/${assetId}?type=thumbnail`),
              }}
              style={styles.image}
            />
          ) : (
            <View style={styles.mediaPlaceholder}>
              <Ionicons name="image-outline" size={22} color={colors.textMuted} />
              <Muted style={styles.mediaPlaceholderText}>No media</Muted>
            </View>
          )}
          {assetId && videoIds[assetId] && (
              <View style={styles.videoBadge}>
                <Ionicons name="play" size={16} color="white" />
              </View>
          )}
        </View>

        <View style={styles.captionSlot}>
          {hasCaption ? (
            <Body numberOfLines={2} ellipsizeMode="tail" style={styles.captionPreview}>
              {entry.caption}
            </Body>
          ) : (
            <Muted style={styles.captionFallback}>No details added</Muted>
          )}
        </View>

        {showDots && (dotCount ?? 0) > 1 && (
          <View style={styles.inCardDotsWrap}>
            <View style={styles.carouselDots}>
              {Array.from({ length: dotCount ?? 0 }).map((_, index) => (
                <View
                  key={`${entry._id}-dot-${index}`}
                  style={[
                    styles.carouselDot,
                    index === activeDotIndex && styles.carouselDotActive,
                  ]}
                />
              ))}
            </View>
          </View>
        )}
      </Pressable>
    );
  };

  const renderEmpty = (label: string) => (
    <View style={[styles.card, styles.emptyCard]}>
      <Muted style={styles.cardLabel}>{label}</Muted>
      <Muted>No entries yet</Muted>
    </View>
  );

  const onPastMomentumEnd = useCallback(
    (event: any) => {
      if (!pastCarouselWidth) return;
      const offsetX = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(offsetX / pastCarouselWidth);
      const clamped = Math.max(0, Math.min(nextIndex, pastEntries.length - 1));
      setPastIndex(clamped);
    },
    [pastCarouselWidth, pastEntries.length],
  );

  const onPastScroll = useCallback(
    (event: any) => {
      if (!pastCarouselWidth) return;
      const offsetX = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(offsetX / pastCarouselWidth);
      const clamped = Math.max(0, Math.min(nextIndex, pastEntries.length - 1));
      setPastIndex((prev) => (prev === clamped ? prev : clamped));
    },
    [pastCarouselWidth, pastEntries.length],
  );

  const showBackButton = from === "calendar" || from === "day";
  const primaryCardLabel =
    targetDateKey === toISTDateKey(new Date())
      ? "Today"
      : formatDayDateLabel(targetDateKey);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            {showBackButton ? (
              <Pressable onPress={handleBack} style={styles.sideBtn}>
                <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
              </Pressable>
            ) : (
              <View style={styles.sideBtn} />
            )}
          </View>

          <View style={styles.headerCenter}>
            <Muted style={styles.subtitle}>{formatDayDateLabel(targetDateKey)}</Muted>
            <Muted style={[styles.subtitle, styles.tagline]}>
              Private. Calm. Timeless.
            </Muted>
          </View>

          <View style={styles.headerSide}>
            <Pressable
              onPress={loadData}
              disabled={loading}
              style={({ pressed }) => [
                styles.sideBtn,
                pressed && { opacity: 0.6 },
                loading && { opacity: 0.4 },
              ]}
            >
              <Ionicons
                name="refresh"
                size={28}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.stack}>
          {loading && <Muted>Loading…</Muted>}

          {!loading && (
            <>
              {today
                ? renderCard(today, primaryCardLabel)
                : renderEmpty(primaryCardLabel)}
              {pastEntries.length > 0 ? (
                <View
                  style={styles.pastCarouselWrap}
                  onLayout={(event) => {
                    const nextWidth = Math.round(event.nativeEvent.layout.width);
                    if (nextWidth > 0 && nextWidth !== pastCarouselWidth) {
                      setPastCarouselWidth(nextWidth);
                    }
                  }}
                >
                  <ScrollView
                    horizontal
                    pagingEnabled
                    decelerationRate="fast"
                    showsHorizontalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onScroll={onPastScroll}
                    onMomentumScrollEnd={onPastMomentumEnd}
                  >
                    {pastEntries.map((entry, index) =>
                      renderCard(
                        entry,
                        "From Your Past",
                        true,
                        [
                          styles.pastSlide,
                          pastCarouselWidth ? { width: pastCarouselWidth } : undefined,
                        ],
                        "past",
                        pastEntries.length > 1
                          ? `${index + 1} / ${pastEntries.length}`
                          : undefined,
                        true,
                        pastEntries.length,
                        pastIndex,
                      ),
                    )}
                  </ScrollView>
                </View>
              ) : (
                renderEmpty("From Your Past")
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Floating Add Button */}
      <Pressable
        style={styles.fabOuter}
        onPress={() =>
          router.push({
            pathname: "/add",
            params: date
              ? { from: "day", mode: "backfill", date, fromDay: "calendar" }
              : { from: "today" },
          })
        }
      >
        <View style={styles.fabInner}>
          <Ionicons name="add" size={28} color="white" />
        </View>
      </Pressable>
    </Screen>
  );
}

const createStyles = (
  colors: {
    surface: string;
    surfaceAlt: string;
    border: string;
    accent: string;
    accentGlow: string;
  },
  themeName: ThemeName,
) => {
  const isDefault = themeName === "default";
  const isCute = themeName === "cute";

  const cardBackground = isDefault
    ? "#1C1F24"
    : isCute
      ? "#FFF8FD"
      : colors.surface;
  const cardBorder = isDefault ? "rgba(255,255,255,0.06)" : colors.border;
  const mediaBackground = isDefault ? "#111" : colors.surfaceAlt;
  const fabColor = isDefault ? "#6C8CFF" : colors.accent;
  const fabOuter = isDefault ? "rgba(108,140,255,0.18)" : colors.accentGlow;

  return StyleSheet.create({
    scroll: {
      paddingTop: 40,
      paddingBottom: 120,
      paddingHorizontal: 6,
    },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 28,
    },

    headerSide: {
      width: 44,
      alignItems: "center",
      justifyContent: "center",
    },

    sideBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
    },

    subtitle: {
      marginTop: 4,
      opacity: 0.85,
    },

    stack: {
      width: "100%",
      maxWidth: 480,
      alignSelf: "center",
      gap: 22,
    },

    card: {
      backgroundColor: cardBackground,
      borderRadius: 26,
      padding: 18,
      borderWidth: 1,
      borderColor: cardBorder,
    },

    entryCard: {
      minHeight: 368,
    },

    emptyCard: {
      alignItems: "center",
      paddingVertical: 32,
    },

    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },

    cardHeaderRight: {
      alignItems: "flex-end",
      gap: 2,
    },

    cardLabel: {
      fontSize: 13,
      letterSpacing: 0.4,
    },

    dateHint: {
      fontSize: 12,
      opacity: 0.7,
    },

    positionHint: {
      fontSize: 12,
      letterSpacing: 0.2,
      opacity: 0.9,
    },

    image: {
      width: "100%",
      height: 230,
      backgroundColor: mediaBackground,
    },

    imageWrap: {
      width: "100%",
      height: 230,
      borderRadius: 18,
      overflow: "hidden",
      position: "relative",
      marginTop: 2,
    },

    mediaPlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: mediaBackground,
      gap: 4,
    },

    mediaPlaceholderText: {
      fontSize: 12,
      opacity: 0.75,
    },

    videoBadge: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: "rgba(0,0,0,0.6)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    headerCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    captionSlot: {
      minHeight: 54,
      marginTop: 10,
      justifyContent: "flex-start",
    },

    captionPreview: {
      fontSize: 15,
      lineHeight: 22,
      opacity: 0.9,
    },

    captionFallback: {
      opacity: 0.75,
    },

    pastCarouselWrap: {
      width: "100%",
    },

    pastSlide: {
      width: "100%",
    },

    carouselDots: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },

    carouselDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: isDefault ? "rgba(255,255,255,0.25)" : colors.border,
    },

    carouselDotActive: {
      width: 16,
      borderRadius: 8,
      backgroundColor: colors.accent,
    },

    inCardDotsWrap: {
      marginTop: 12,
      alignItems: "center",
      justifyContent: "center",
    },

    fabOuter: {
      position: "absolute",
      right: 20,
      bottom: 64,
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: fabOuter,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: fabColor,
      shadowOpacity: 0.5,
      shadowRadius: 32,
      elevation: 20,
    },

    fabInner: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: fabColor,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 10,
    },
    tagline: {
      opacity: 0.7,
      marginTop: 2,
    },
  });
};
