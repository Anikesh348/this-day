import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CalendarList } from "react-native-calendars";

import { getCalendar } from "@/services/entries";
import { apiUrl } from "@/services/apiBase";
import { Title, Muted } from "@/components/Text";
import { useTheme } from "@/theme/ThemeProvider";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Grid Constants
const COLUMN_COUNT = 7;
const MARGIN = 10;
const GAP = 8;
const DAY_SIZE =
  (SCREEN_WIDTH - MARGIN * 2 - GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

type CalendarEntry = {
  date: string;
  immichAssetId?: string | null;
  hasCaption?: boolean;
};

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
  const { colors, themeName, gradientEnabled, gradientColors } = useTheme();
  const styles = useMemo(() => createStyles(colors, themeName), [colors, themeName]);
  const captionOnlyIconColor = useMemo(() => {
    if (themeName === "default") return "#8CB3FF";
    if (themeName === "cute") return "#D56AA3";
    return "#E6C15A";
  }, [themeName]);

  const router = useRouter();

  const [entries, setEntries] = useState<Record<string, CalendarEntry>>({});
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

      const map: Record<string, CalendarEntry> = {};
      for (const d of res.data as CalendarEntry[]) {
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
    }, [todayString, loadMonth]),
  );

  const refreshCalendar = useCallback(() => {
    const [year, month] = todayString.split("-").map(Number);
    const prev = getPreviousMonth(year, month);

    loadedMonths.current.clear();
    setEntries({});
    loadMonth(year, month);
    loadMonth(prev.year, prev.month);
  }, [todayString, loadMonth]);

  useEffect(() => {
    // Force a clean reload when theme changes so CalendarList does not keep stale cached styles.
    loadedMonths.current.clear();
    setEntries({});

    const [year, month] = todayString.split("-").map(Number);
    const prev = getPreviousMonth(year, month);
    void loadMonth(year, month);
    void loadMonth(prev.year, prev.month);
  }, [themeName, todayString, loadMonth]);

  const calendarTheme = useMemo(
    () =>
      ({
        backgroundColor: gradientEnabled ? "transparent" : colors.background,
        calendarBackground: gradientEnabled ? "transparent" : colors.background,
        monthTextColor: colors.textPrimary,
        textSectionTitleColor: colors.textMuted,
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
            color: colors.textPrimary,
          },
        },
      }) as any,
    [colors, gradientEnabled],
  );

  /**
   * ✅ Frozen day renderer (no layout changes ever)
   */
  const renderDay = useCallback(
    ({ date, state }: any) => {
      const entry = entries[date.dateString];
      const hasEntry = !!entry?.immichAssetId;
      const hasCaptionOnly = !hasEntry && !!entry?.hasCaption;
      const assetId = entry?.immichAssetId;

      const isToday = date.dateString === todayString;
      const isFuture = date.dateString > todayString;
      const isDisabled = state === "disabled";

      return (
        <Pressable
          onPress={() => {
            if (isFuture) return;

            router.push({
              pathname: "/today",
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
                      uri: apiUrl(
                        `/api/media/immich/${assetId}?type=thumbnail`,
                      ),
                    }
                  : undefined
              }
              style={[styles.dayImage, { opacity: hasEntry ? 1 : 0 }]}
            />

            {/* ❌ No-entry cross */}
            {!hasEntry && hasCaptionOnly && !isFuture && !isDisabled && (
              <View style={styles.captionOnlyBadge}>
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={captionOnlyIconColor}
                />
              </View>
            )}

            {!hasEntry && !hasCaptionOnly && !isFuture && !isToday && !isDisabled && (
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
              <Text style={[styles.dateText, isFuture && styles.futureDateText]}>
                {date.day}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [captionOnlyIconColor, entries, router, styles, todayString],
  );

  return (
    <View style={styles.container}>
      {gradientEnabled && (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
      )}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Title>Calendar</Title>
          <Muted style={styles.subtitle}>Browse by day</Muted>
        </View>
        <Pressable
          onPress={refreshCalendar}
          style={({ pressed }) => [
            styles.refreshBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="refresh" size={26} color={colors.textMuted} />
        </Pressable>
      </View>
      <CalendarList
        key={`calendar-${themeName}-${gradientEnabled ? "g" : "n"}`}
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
        theme={calendarTheme}
        dayComponent={renderDay}
      />
    </View>
  );
}

const createStyles = (colors: {
  background: string;
  accent: string;
  textPrimary: string;
  surface: string;
  border: string;
  textMuted: string;
}, themeName: "default" | "cute" | "onyx") => {
  const isDefault = themeName === "default";
  const isCute = themeName === "cute";

  const tileBackground = isDefault ? "#161616" : isCute ? "#FFF8FD" : "#18130C";
  const futureBorder = isDefault ? "#222" : isCute ? "#E7BBD6" : "#5A4826";
  const dateBadgeBackground = isDefault
    ? "rgba(0,0,0,0.5)"
    : isCute
      ? "rgba(94,42,73,0.14)"
      : "rgba(230,193,90,0.16)";
  const dateTextColor = isDefault ? "#fff" : colors.textPrimary;
  const futureDateTextColor = isDefault ? "#444" : isCute ? "#B27798" : "#A58C57";
  const crossLineColor = isDefault ? "#fff" : isCute ? "#C08AAF" : "#C9A44B";
  const crossOpacity = isDefault ? 0.15 : 0.26;
  const captionBadgeBackground = isDefault
    ? "rgba(79,139,255,0.16)"
    : isCute
      ? "rgba(255,111,179,0.16)"
      : "rgba(230,193,90,0.2)";

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 24,
    },
    gradient: {
      ...StyleSheet.absoluteFillObject,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 32,
      paddingHorizontal: MARGIN,
      marginBottom: 8,
    },
    headerText: {
      alignItems: "flex-start",
    },
    subtitle: {
      marginTop: 4,
      opacity: 0.75,
    },
    refreshBtn: {
      padding: 8,
      borderRadius: 20,
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
      backgroundColor: tileBackground,
      position: "relative",
      borderWidth: 2,
      borderColor: "transparent",
    },
    todayOutline: {
      borderColor: colors.accent,
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
      borderColor: futureBorder,
    },
    dateBadge: {
      position: "absolute",
      top: 5,
      left: 5,
      backgroundColor: dateBadgeBackground,
      paddingHorizontal: 5,
      borderRadius: 5,
      minWidth: 18,
      alignItems: "center",
    },
    todayBadge: {
      backgroundColor: colors.accent,
    },
    dateText: {
      color: dateTextColor,
      fontWeight: "700",
      fontSize: 10,
    },
    futureDateText: {
      color: futureDateTextColor,
      fontWeight: "700",
      fontSize: 10,
    },
    crossContainer: {
      position: "absolute",
      width: 14,
      height: 14,
      opacity: crossOpacity,
      justifyContent: "center",
      alignItems: "center",
    },
    captionOnlyBadge: {
      position: "absolute",
      top: "50%",
      left: "50%",
      marginTop: -14,
      marginLeft: -14,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: captionBadgeBackground,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",
    },
    crossLine: {
      position: "absolute",
      width: 14,
      height: 1.5,
      backgroundColor: crossLineColor,
      transform: [{ rotate: "45deg" }],
    },
  });
};
