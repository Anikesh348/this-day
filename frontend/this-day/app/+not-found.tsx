import { Screen } from "@/components/Screen";
import { Body, Title } from "@/components/Text";
import { Stack, useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

export default function NotFoundScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <Screen>
        <View style={styles.container}>
          <Title style={styles.title}>This screen does not exist.</Title>
          <Pressable onPress={() => router.replace("/today")} style={styles.link}>
            <Body style={styles.linkText}>Go to home screen</Body>
          </Pressable>
        </View>
      </Screen>
    </>
  );
}

const createStyles = (colors: {
  border: string;
  surface: string;
  accent: string;
}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    title: {
      textAlign: "center",
      marginBottom: 0,
    },
    link: {
      marginTop: 16,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    linkText: {
      color: colors.accent,
    },
  });
