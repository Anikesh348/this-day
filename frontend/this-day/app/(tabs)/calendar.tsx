import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CalendarList } from "react-native-calendars";

import { getCalendar } from "@/services/entries";
import { Colors } from "@/theme/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Grid Constants
const COLUMN_COUNT = 7;
const MARGIN = 10;
const GAP = 8;
const DAY_SIZE =
  (SCREEN_WIDTH - MARGIN * 2 - GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

/**
 * 🔧 Helper: get today's date string in IST (YYYY-MM-DD)
 */
function getTodayISTString() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

/**
 * 🔧 Helper: previous month
 */
function getPreviousMonth(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export default function CalendarScreen() {
  const router = useRouter();

  const [entries, setEntries] = useState<Record<string, any>>({});
  const loadedMonths = useRef<Set<string>>(new Set());
  const monthLoadTimeout = useRef<NodeJS.Timeout | null>(null);

  const todayString = getTodayISTString();
  const currentMonth = todayString.substring(0, 7) + "-01";

  /**
   * 🧠 Load month exactly once (layout-safe)
   */
  const loadMonth = useCallback(async (year: number, month: number) => {
    const key = `${year}-${month}`;
    if (loadedMonths.current.has(key)) return;

    // 🔒 Lock immediately → prevents bounce
    loadedMonths.current.add(key);

    try {
      const res = await getCalendar(year, month);
      if (!res?.data?.length) return;

      const map: Record<string, any> = {};
      for (const d of res.data) {
        map[d.date] = d;
      }

      // 🔑 Stable merge (no re-layout)
      setEntries((prev) => ({ ...prev, ...map }));
    } catch (e) {
      console.error(e);
    }
  }, []);

  /**
   * 🔥 Preload current + previous month
   */
  useFocusEffect(
    useCallback(() => {
      const [year, month] = todayString.split("-").map(Number);
      const prev = getPreviousMonth(year, month);

      loadMonth(year, month);
      loadMonth(prev.year, prev.month);

      return () => {
        if (monthLoadTimeout.current) {
          clearTimeout(monthLoadTimeout.current);
        }
      };
    }, [todayString, loadMonth])
  );

  /**
   * ✅ Frozen day renderer (no layout changes ever)
   */
  const renderDay = useCallback(
    ({ date, state }: any) => {
      const entry = entries[date.dateString];
      const hasEntry = !!entry?.immichAssetId;
      const assetId = entry?.immichAssetId;

      const isToday = date.dateString === todayString;
      const isFuture = date.dateString > todayString;
      const isDisabled = state === "disabled";

      return (
        <Pressable
          onPress={() => {
            if (isFuture) return;

            router.push({
              pathname: "day/[date]",
              params: {
                date: date.dateString,
                from: "calendar",
              },
            });
          }}
          style={({ pressed }) => [
            styles.dayCell,
            pressed && !isFuture && { opacity: 0.7 },
          ]}
        >
          <View
            style={[
              styles.visualContainer,
              isToday && styles.todayOutline,
              isFuture && styles.futureDay,
              isDisabled && { opacity: 0.15 },
            ]}
          >
            {/* 🔒 Image layer ALWAYS mounted */}
            <Image
              source={
                hasEntry
                  ? {
                      uri: `https://thisdayapi.hostingfrompurva.xyz/api/media/immich/${assetId}?type=thumbnail`,
                    }
                  : undefined
              }
              style={[styles.dayImage, { opacity: hasEntry ? 1 : 0 }]}
            />

            {/* ❌ No-entry cross */}
            {!hasEntry && !isFuture && !isToday && !isDisabled && (
              <View style={styles.crossContainer}>
                <View style={styles.crossLine} />
                <View
                  style={[
                    styles.crossLine,
                    { transform: [{ rotate: "-45deg" }] },
                  ]}
                />
              </View>
            )}

            {/* 📅 Date badge */}
            <View
              style={[
                styles.dateBadge,
                isToday && styles.todayBadge,
                isFuture && { backgroundColor: "transparent" },
              ]}
            >
              <Text style={[styles.dateText, isFuture && { color: "#444" }]}>
                {date.day}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [entries, todayString, router]
  );

  return (
    <View style={styles.container}>
      <CalendarList
        current={currentMonth}
        pastScrollRange={12}
        futureScrollRange={0}
        showScrollIndicator={false}
        calendarWidth={SCREEN_WIDTH}
        calendarHeight={SCREEN_WIDTH * 1.2} // 🔒 harder lock
        removeClippedSubviews={false} // 🔑 no recycling bounce
        contentContainerStyle={{ paddingBottom: 100 }}
        onVisibleMonthsChange={(months) => {
          if (monthLoadTimeout.current) {
            clearTimeout(monthLoadTimeout.current);
          }

          monthLoadTimeout.current = setTimeout(() => {
            months.forEach((m) => loadMonth(m.year, m.month));
          }, 180); // 🧠 stronger debounce
        }}
        theme={
          {
            backgroundColor: Colors.dark.background,
            calendarBackground: Colors.dark.background,
            monthTextColor: "#FFFFFF",
            textSectionTitleColor: Colors.dark.textMuted,
            textMonthFontSize: 28,
            textMonthFontWeight: "800",
            "stylesheet.calendar.header": {
              header: {
                flexDirection: "row",
                justifyContent: "flex-start",
                paddingLeft: MARGIN,
                marginTop: 20,
                marginBottom: 10,
              },
              monthText: {
                fontSize: 28,
                fontWeight: "800",
                color: "white",
              },
            },
          } as any
        }
        dayComponent={renderDay}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  dayCell: {
    width: DAY_SIZE + GAP / 2,
    height: DAY_SIZE + 10,
    alignItems: "center",
    justifyContent: "center",
  },
  visualContainer: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#161616",
    position: "relative",

    // 🔒 Border ALWAYS present
    borderWidth: 2,
    borderColor: "transparent",
  },
  todayOutline: {
    borderColor: Colors.dark.accent,
  },
  dayImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  futureDay: {
    backgroundColor: "transparent",
    borderColor: "#222",
  },
  dateBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 5,
    borderRadius: 5,
    minWidth: 18,
    alignItems: "center",
  },
  todayBadge: {
    backgroundColor: Colors.dark.accent,
  },
  dateText: {
    color: "white",
    fontWeight: "700",
    fontSize: 10,
  },
  crossContainer: {
    position: "absolute",
    width: 14,
    height: 14,
    opacity: 0.15,
    justifyContent: "center",
    alignItems: "center",
  },
  crossLine: {
    position: "absolute",
    width: 14,
    height: 1.5,
    backgroundColor: "#fff",
    transform: [{ rotate: "45deg" }],
  },
});
