import { Colors } from "@/theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
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
        scale: withSpring(focused ? 1.15 : 1, {
          stiffness: 180,
          damping: 14,
        }),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.iconWrapper, animatedStyle]}>
      <Ionicons
        name={name}
        size={24}
        color={focused ? Colors.dark.accent : "#FFFFFF"}
      />
    </Animated.View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 64,
          paddingBottom: Platform.OS === "ios" ? 12 : 10,
          backgroundColor: "rgba(20,24,36,0.95)",
          borderTopWidth: 0,
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
      />

      {/* Center Add — NOT floating */}
      <Tabs.Screen
        name="add"
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon name="add-circle-outline" focused={focused} />
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
  },
});
