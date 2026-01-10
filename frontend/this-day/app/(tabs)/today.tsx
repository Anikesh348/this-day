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

interface Entry {
  _id: string;
  caption: string;
  date: string;
  immichAssetIds?: string[];
}

export default function TodayScreen() {
  const router = useRouter();

  const [today, setToday] = useState<Entry | null>(null);
  const [previous, setPrevious] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * ✅ Fetch logic (reusable)
   */
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

  /**
   * ✅ CRITICAL FIX:
   * Runs every time the screen becomes active
   */
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
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

  const renderCard = (entry: Entry, label: string) => {
    const assetId = entry.immichAssetIds?.[0];

    return (
      <Pressable style={styles.card} onPress={() => openDay(entry.date)}>
        <Muted style={styles.cardLabel}>{label}</Muted>

        {assetId ? (
          <Image
            source={{
              uri: `https://thisday.hostingfrompurva.xyz/api/media/immich/${assetId}?type=thumbnail`,
            }}
            style={styles.image}
          />
        ) : (
          <Body numberOfLines={5}>{entry.caption}</Body>
        )}
      </Pressable>
    );
  };

  const renderEmpty = (label: string) => (
    <View style={styles.card}>
      <Muted style={styles.cardLabel}>{label}</Muted>
      <Muted>No entries found</Muted>
    </View>
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Title>This Day</Title>
        <Muted>Private. Calm. Timeless.</Muted>

        <View style={styles.stack}>
          {loading && <Muted>Loading…</Muted>}

          {!loading && (
            <>
              {today ? renderCard(today, "Today") : renderEmpty("Today")}

              {previous
                ? renderCard(previous, "From Your Past")
                : renderEmpty("From Your Past")}
            </>
          )}
        </View>
      </ScrollView>

      {/* Add Entry */}
      <Pressable
        style={styles.fab}
        onPress={() =>
          router.push({
            pathname: "/add",
            params: { from: "today" },
          })
        }
      >
        <Ionicons name="add" size={28} color="white" />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingVertical: 32,
    paddingHorizontal: 8,
    alignItems: "center",
  },

  stack: {
    marginTop: 24,
    width: "100%",
    maxWidth: 420,
    gap: 20,
  },

  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },

  cardLabel: {
    marginBottom: 12,
  },

  image: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    backgroundColor: "#222",
  },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 96,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.dark.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
});
