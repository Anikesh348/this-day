import { Screen } from "@/components/Screen";
import { Body, Muted, Title } from "@/components/Text";
import { clearToken } from "@/services/auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

const APP_VERSION = (
  require("../../package.json") as { version?: string }
).version ?? "1.0.0";

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { user } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();

  const logout = async () => {
    await signOut();
    await clearToken();
    router.replace("/login");
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Title>Profile</Title>
          <Muted style={styles.subtitle}>Your account & preferences</Muted>
        </View>

        <View style={styles.card}>
          <View style={styles.avatarWrapper}>
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.accent }]}>
                <Ionicons name="person-outline" size={28} color="white" />
              </View>
            )}
          </View>

          <View style={styles.identity}>
            <Body style={styles.name}>{user?.fullName ?? "Anonymous"}</Body>
            <Muted style={styles.email}>
              {user?.primaryEmailAddress?.emailAddress}
            </Muted>
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Muted style={styles.sectionTitle}>Appearance</Muted>
          <Pressable onPress={() => router.push("/theme")} style={styles.settingsLink}>
            <View style={styles.settingsLeft}>
              <Ionicons name="color-palette-outline" size={20} color={colors.accent} />
              <View style={styles.settingsTextWrap}>
                <Body style={styles.settingsLabel}>Theme & Appearance</Body>
                <Muted style={styles.settingsDescription}>Open theme settings</Muted>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color="#FF6B6B" />
            <Body style={styles.logoutText}>Sign Out</Body>
          </Pressable>
        </View>

        <View style={styles.versionBlock}>
          <Muted style={styles.versionText}>App Version {APP_VERSION}</Muted>
        </View>
      </View>
    </Screen>
  );
}

const createStyles = (colors: {
  surface: string;
  border: string;
  textMuted: string;
}) =>
  StyleSheet.create({
    container: {
      paddingTop: 32,
      paddingHorizontal: 16,
    },
    header: {
      alignItems: "center",
      marginBottom: 32,
    },
    subtitle: {
      marginTop: 4,
      opacity: 0.75,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 26,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarWrapper: {
      marginRight: 14,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#111",
    },
    avatarFallback: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    identity: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      marginBottom: 2,
    },
    email: {
      fontSize: 13,
      opacity: 0.8,
    },
    settingsSection: {
      marginTop: 24,
      gap: 10,
    },
    sectionTitle: {
      fontSize: 13,
      letterSpacing: 0.3,
    },
    settingsLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingsLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    settingsTextWrap: {
      flex: 1,
    },
    settingsLabel: {
      fontSize: 14,
    },
    settingsDescription: {
      fontSize: 12,
      marginTop: 1,
      opacity: 0.75,
    },
    actions: {
      marginTop: 30,
      gap: 14,
    },
    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 22,
      backgroundColor: "rgba(255,107,107,0.12)",
      borderWidth: 1,
      borderColor: "rgba(255,107,107,0.25)",
    },
    logoutText: {
      color: "#FF6B6B",
    },
    versionBlock: {
      marginTop: 28,
      alignItems: "center",
    },
    versionText: {
      fontSize: 12,
      opacity: 0.6,
    },
  });
