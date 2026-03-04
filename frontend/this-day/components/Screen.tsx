import { useTheme } from "@/theme/ThemeProvider";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

export function Screen({ children }: { children: React.ReactNode }) {
  const { colors, gradientColors, gradientEnabled } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {gradientEnabled && (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
      )}
      <View style={styles.container}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
});
