import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

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

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function toISTDateString(date: Date) {
  const ist = new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function parseDateString(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatStandardDateLabel(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function getHeaderDateLabel(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
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
    from?: "calendar" | "day";
  }>();

  const [today, setToday] = useState<Entry | null>(null);
  const [previous, setPrevious] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoIds, setVideoIds] = useState<Record<string, true>>({});
  const checkedIds = useRef(new Set<string>());

  const selectedDateString = useMemo(() => {
    if (date && DATE_REGEX.test(date)) return date;
    return toISTDateString(new Date());
  }, [date]);

  const targetDate = useMemo(() => {
    return parseDateString(selectedDateString);
  }, [selectedDateString]);

  const isViewingToday = selectedDateString === toISTDateString(new Date());
  const topCardLabel = isViewingToday
    ? "Today"
    : formatStandardDateLabel(selectedDateString);
  const showBack = from === "calendar" || from === "day";

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
    return formatStandardDateLabel(date);
  };

  const handleBack = () => {
    router.replace("/calendar");
  };

  const renderCard = (entry: Entry, label: string, showDateHint = false) => {
    const assetId = entry.immichAssetIds?.[0];
    const hasCaption = entry.caption && entry.caption.trim().length > 0;

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => openDay(entry.date)}
      >
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(79,139,255,0.2)", "rgba(79,139,255,0.02)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        />

        <View style={styles.cardHeader}>
          <View>
            <Muted style={styles.cardLabel}>{label}</Muted>
            {showDateHint && (
              <Muted style={styles.dateHint}>{formatDate(entry.date)}</Muted>
            )}
          </View>
          <View style={styles.cardArrow}>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={Colors.dark.textMuted}
            />
          </View>
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
      <View style={styles.emptyIcon}>
        <Ionicons
          name="calendar-clear-outline"
          size={22}
          color={Colors.dark.textMuted}
        />
      </View>
      <Muted style={styles.cardLabel}>{label}</Muted>
      <Muted style={styles.emptyText}>No entries yet</Muted>
    </View>
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            {showBack ? (
              <Pressable onPress={handleBack} style={styles.iconBtn}>
                <Ionicons name="chevron-back" size={26} color="white" />
              </Pressable>
            ) : (
              <View style={styles.iconSpacer} />
            )}
          </View>

          <View style={styles.headerCenter}>
            <Muted style={styles.subtitle}>
              {getHeaderDateLabel(selectedDateString)}
            </Muted>
            <Muted style={[styles.subtitle, styles.tagline]}>
              Private. Calm. Timeless.
            </Muted>
          </View>

          <View style={styles.headerSide}>
            <Pressable
              onPress={loadData}
              disabled={loading}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.6 },
                loading && { opacity: 0.4 },
              ]}
            >
              <Ionicons
                name="refresh"
                size={30}
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
                ? renderCard(today, topCardLabel)
                : renderEmpty(topCardLabel)}
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
    paddingTop: 24,
    paddingBottom: 120,
    paddingHorizontal: 6,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    marginBottom: 28,
  },

  headerSide: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  iconSpacer: {
    width: 44,
    height: 44,
  },

  subtitle: {
    marginTop: 4,
    textAlign: "center",
    opacity: 0.85,
  },

  stack: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    gap: 18,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },

  cardPressed: {
    opacity: 0.86,
  },

  emptyCard: {
    alignItems: "center",
    paddingVertical: 28,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  cardArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  cardLabel: {
    fontSize: 13,
    letterSpacing: 0.5,
    color: Colors.dark.textSecondary,
  },

  dateHint: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.dark.textMuted,
  },

  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 8,
  },

  emptyText: {
    marginTop: 4,
    opacity: 0.78,
  },

  image: {
    width: "100%",
    height: 230,
    backgroundColor: "#111",
  },

  imageWrap: {
    width: "100%",
    height: 236,
    borderRadius: 20,
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
    paddingHorizontal: 8,
  },

  captionPreview: {
    fontSize: 16,
    lineHeight: 22,
    opacity: 0.95,
  },

  fabOuter: {
    position: "absolute",
    right: 20,
    bottom: 64,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(79,139,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6C8CFF",
    shadowOpacity: 0.4,
    shadowRadius: 28,
    elevation: 14,
  },

  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 7,
  },
  tagline: {
    opacity: 0.7,
    marginTop: 2,
  },
});
