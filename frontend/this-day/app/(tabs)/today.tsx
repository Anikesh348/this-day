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
import { Colors } from "@/theme/colors";
import { apiUrl } from "@/services/apiBase";

interface Entry {
  _id: string;
  caption: string;
  date: string; // YYYY-MM-DD
  immichAssetIds?: string[];
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
  const router = useRouter();

  const { date, from } = useLocalSearchParams<{
    date?: string;
    from?: "calendar" | "day" | "today";
  }>();

  const [today, setToday] = useState<Entry | null>(null);
  const [previous, setPrevious] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoIds, setVideoIds] = useState<Record<string, true>>({});
  const checkedIds = useRef(new Set<string>());

  const targetDateKey = useMemo(() => parseDateKey(date), [date]);

  const loadData = async () => {
    setLoading(true);

    const [y, m, day] = targetDateKey.split("-").map(Number);

    const [todayRes, yearRes, monthRes] = await Promise.allSettled([
      getSameDaySummary(y, m, day),
      getSameDayPreviousYears(y, m, day),
      getSameDayPreviousMonths(y, m, day),
    ]);

    if (todayRes.status === "fulfilled" && todayRes.value.data?.length > 0) {
      setToday(todayRes.value.data[0]);
    } else {
      setToday(null);
    }

    if (yearRes.status === "fulfilled" && yearRes.value.data?.length > 0) {
      setPrevious(yearRes.value.data[0]);
    } else if (
      monthRes.status === "fulfilled" &&
      monthRes.value.data?.length > 0
    ) {
      setPrevious(monthRes.value.data[0]);
    } else {
      setPrevious(null);
    }

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [targetDateKey]),
  );

  useEffect(() => {
    const ids = [
      today?.immichAssetIds?.[0],
      previous?.immichAssetIds?.[0],
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
  }, [today, previous]);

  const openDay = (entryDate: string) => {
    router.push({
      pathname: "day/[date]",
      params: {
        date: entryDate,
        from: "today",
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

  const renderCard = (entry: Entry, label: string, showDateHint = false) => {
    const assetId = entry.immichAssetIds?.[0];
    const hasCaption = entry.caption && entry.caption.trim().length > 0;

    return (
      <Pressable style={styles.card} onPress={() => openDay(entry.date)}>
        <View style={styles.cardHeader}>
          <Muted style={styles.cardLabel}>{label}</Muted>
          {showDateHint && (
            <Muted style={styles.dateHint}>{formatDate(entry.date)}</Muted>
          )}
        </View>

        {assetId && (
          <View style={styles.imageWrap}>
            <Image
              source={{
                uri: apiUrl(`/api/media/immich/${assetId}?type=thumbnail`),
              }}
              style={styles.image}
            />
            {videoIds[assetId] && (
              <View style={styles.videoBadge}>
                <Ionicons name="play" size={16} color="white" />
              </View>
            )}
          </View>
        )}

        {hasCaption && (
          <Body
            numberOfLines={2}
            style={[styles.captionPreview, assetId && { marginTop: 10 }]}
          >
            {entry.caption}
          </Body>
        )}

        {!assetId && !hasCaption && <Muted>No details added</Muted>}
      </Pressable>
    );
  };

  const renderEmpty = (label: string) => (
    <View style={[styles.card, styles.emptyCard]}>
      <Muted style={styles.cardLabel}>{label}</Muted>
      <Muted>No entries yet</Muted>
    </View>
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
                <Ionicons name="chevron-back" size={26} color="white" />
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
                color={Colors.dark.textMuted}
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
              {previous
                ? renderCard(previous, "From Your Past", true)
                : renderEmpty("From Your Past")}
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

const styles = StyleSheet.create({
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
    backgroundColor: "#1C1F24",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  emptyCard: {
    alignItems: "center",
    paddingVertical: 32,
  },

  cardHeader: {
    marginBottom: 12,
  },

  cardLabel: {
    fontSize: 13,
    letterSpacing: 0.4,
  },

  dateHint: {
    marginTop: 2,
    fontSize: 12,
    opacity: 0.7,
  },

  image: {
    width: "100%",
    height: 230,
    backgroundColor: "#111",
  },

  imageWrap: {
    width: "100%",
    height: 230,
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
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

  captionPreview: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.9,
  },

  fabOuter: {
    position: "absolute",
    right: 20,
    bottom: 64,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(108,140,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6C8CFF",
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 20,
  },

  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6C8CFF",
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
