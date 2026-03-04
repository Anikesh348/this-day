import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";

function AnimatedTabIcon({
  focused,
  name,
  activeColor,
  inactiveColor,
  styles,
}: {
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
  activeColor: string;
  inactiveColor: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(focused ? 1.1 : 1, {
          stiffness: 160,
          damping: 16,
        }),
      },
    ],
    opacity: withSpring(focused ? 1 : 0.6),
  }));

  return (
    <Animated.View style={[styles.iconWrapper, animatedStyle]}>
      <Ionicons
        name={name}
        size={22}
        color={focused ? activeColor : inactiveColor}
      />
      {focused && <View style={styles.activeDot} />}
    </Animated.View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,

        // ✅ Fixed bottom bar (no floating)
        tabBarStyle: {
          height: Platform.OS === "ios" ? 72 : 64,
          paddingBottom: Platform.OS === "ios" ? 18 : 10,
          paddingTop: 8,

          backgroundColor: colors.surface,
          borderTopWidth: 0,

          shadowColor: colors.accentGlow,
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 20,
        },

        // ✅ THIS fixes vertical centering
        tabBarItemStyle: {
          justifyContent: "center",
          alignItems: "center",
        },
      }}
    >
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon
              focused={focused}
              name="calendar-outline"
              activeColor={colors.accent}
              inactiveColor={colors.textPrimary}
              styles={styles}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="today"
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon
              focused={focused}
              name="home-outline"
              activeColor={colors.accent}
              inactiveColor={colors.textPrimary}
              styles={styles}
            />
          ),
        }}
        listeners={() => ({
          tabPress: () => {
            const now = new Date();
            const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
            const todayIST = ist.toISOString().slice(0, 10);

            // ✅ HARD reset of route + params
            router.replace({
              pathname: "/today",
              params: {
                date: todayIST,
              },
            });
          },
        })}
      />

      <Tabs.Screen
        name="add"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.addWrapper}>
              <Ionicons
                name="add"
                size={24}
                color={focused ? colors.accent : colors.textPrimary}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon
              focused={focused}
              name="person-outline"
              activeColor={colors.accent}
              inactiveColor={colors.textPrimary}
              styles={styles}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const createStyles = (colors: {
  accent: string;
  accentGlow: string;
}) =>
  StyleSheet.create({
    iconWrapper: {
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },

    activeDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.accent,
      marginTop: 2,
    },

    addWrapper: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentGlow,
    },
  });
