import { Screen } from "@/components/Screen";
import { Body, Muted, Title } from "@/components/Text";
import { Colors, THEME_OPTIONS } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export default function ThemeScreen() {
  const router = useRouter();
  const { themeName, setTheme, gradientEnabled, setGradientEnabled, colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.replace("/profile")} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Title style={styles.title}>Theme</Title>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.section}>
          <Muted style={styles.sectionTitle}>Choose Theme</Muted>
          <View style={styles.list}>
            {THEME_OPTIONS.map((option) => {
              const selected = option.key === themeName;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setTheme(option.key)}
                  style={[styles.option, selected && styles.optionActive]}
                >
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: Colors[option.key].accent },
                    ]}
                  />
                  <View style={styles.optionTextWrap}>
                    <Body style={styles.optionLabel}>{option.label}</Body>
                    <Muted style={styles.optionDescription}>{option.description}</Muted>
                  </View>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Muted style={styles.sectionTitle}>Effects</Muted>
          <Pressable
            onPress={() => setGradientEnabled(!gradientEnabled)}
            style={[styles.option, gradientEnabled && styles.optionActive]}
          >
            <Ionicons
              name={gradientEnabled ? "checkbox" : "square-outline"}
              size={20}
              color={gradientEnabled ? colors.accent : colors.textMuted}
            />
            <View style={styles.optionTextWrap}>
              <Body style={styles.optionLabel}>Gradient Background</Body>
              <Muted style={styles.optionDescription}>
                Blend the selected theme with a soft gradient
              </Muted>
            </View>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const createStyles = (colors: {
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  accent: string;
}) =>
  StyleSheet.create({
    container: {
      paddingTop: 32,
      paddingHorizontal: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 26,
    },
    backBtn: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      marginBottom: 0,
    },
    section: {
      gap: 10,
      marginBottom: 18,
    },
    sectionTitle: {
      fontSize: 13,
      letterSpacing: 0.3,
    },
    list: {
      gap: 10,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionActive: {
      borderColor: colors.accent,
      backgroundColor: colors.surfaceAlt,
    },
    swatch: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    optionTextWrap: {
      flex: 1,
    },
    optionLabel: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    optionDescription: {
      fontSize: 12,
      marginTop: 1,
      opacity: 0.75,
    },
  });
