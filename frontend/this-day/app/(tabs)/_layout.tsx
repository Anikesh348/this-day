import { Colors } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

function AnimatedTabIcon({
  focused,
  name,
}: {
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
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
        color={focused ? Colors.dark.accent : "#FFFFFF"}
      />
      {focused && <View style={styles.activeDot} />}
    </Animated.View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
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

          backgroundColor: "rgba(24,28,40,0.96)",
          borderTopWidth: 0,

          shadowColor: "#000",
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
            <AnimatedTabIcon focused={focused} name="calendar-outline" />
          ),
        }}
      />

      <Tabs.Screen
        name="today"
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon focused={focused} name="home-outline" />
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
                color={focused ? Colors.dark.accent : "#FFFFFF"}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon focused={focused} name="person-outline" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.accent,
    marginTop: 2,
  },

  addWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(108,140,255,0.18)",
  },
});
