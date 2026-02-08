import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Body, Muted, Title } from "@/components/Text";
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

export default function TodayScreen() {
  const router = useRouter();

  // 🆕 read `from`
  const { date, from } = useLocalSearchParams<{
    date?: string;
    from?: "calendar";
  }>();

  const [today, setToday] = useState<Entry | null>(null);
  const [previous, setPrevious] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoIds, setVideoIds] = useState<Record<string, true>>({});
  const checkedIds = useRef(new Set<string>());

  const targetDate = useMemo(() => {
    if (!date) return new Date();
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [date]);

  const loadData = async () => {
    setLoading(true);

    const y = targetDate.getFullYear();
    const m = targetDate.getMonth() + 1;
    const day = targetDate.getDate();

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
    }, [targetDate]),
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

  function getHeaderDateLabel(date?: string) {
    // Use provided YYYY-MM-DD as IST date if valid
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split("-").map(Number);

      // Create date explicitly in IST (no UTC parsing)
      const istDate = new Date(
        Date.UTC(y, m - 1, d, 0, 0, 0) + 5.5 * 60 * 60 * 1000,
      );

      return istDate.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      });
    }

    // Fallback → real "today" in IST
    return new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          {["calendar", "day"].includes(from) ? (
            <Pressable onPress={handleBack} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={26} color="white" />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}

          <View style={styles.headerCenter}>
            <Muted style={styles.subtitle}>{getHeaderDateLabel(date)}</Muted>
            <Muted style={[styles.subtitle, styles.tagline]}>
              Private. Calm. Timeless.
            </Muted>
          </View>

          <Pressable
            onPress={loadData}
            disabled={loading}
            style={({ pressed }) => [
              styles.refreshBtn,
              pressed && { opacity: 0.6 },
              loading && { opacity: 0.4 },
            ]}
          >
            <Ionicons name="refresh" size={30} color={Colors.dark.textMuted} />
          </Pressable>
        </View>

        <View style={styles.stack}>
          {loading && <Muted>Loading…</Muted>}

          {!loading && (
            <>
              {today ? renderCard(today, "Today") : renderEmpty("Today")}
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
    justifyContent: "space-between",
    marginBottom: 28,
  },

  // 🆕
  backBtn: {
    width: 34,
    padding: 6,
    alignItems: "flex-start",
  },

  headerText: {
    alignItems: "center",
    flex: 1,
  },

  subtitle: {
    marginTop: 4,
    opacity: 0.85,
  },

  refreshBtn: {
    position: "absolute",
    right: 0,
    padding: 8,
    borderRadius: 20,
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
