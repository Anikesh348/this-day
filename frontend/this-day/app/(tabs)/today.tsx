import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
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

  const [today, setToday] = useState<Entry | null>(null);
  const [previous, setPrevious] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);

    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();

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
    }, []),
  );

  const openDay = (date: string) => {
    router.push({
      pathname: "day/[date]",
      params: {
        date,
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
          <Image
            source={{
              uri: apiUrl(`/api/media/immich/${assetId}?type=thumbnail`),
            }}
            style={styles.image}
          />
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

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Title>This Day</Title>
            <Muted style={styles.subtitle}>Private. Calm. Timeless.</Muted>
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
            params: { from: "today" },
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
    borderRadius: 18,
    backgroundColor: "#111",
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
});
