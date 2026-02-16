import { Screen } from "@/components/Screen";
import { Body, Muted, Title } from "@/components/Text";
import { clearToken } from "@/services/auth";
import { Colors } from "@/theme/colors";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Platform,
} from "react-native";
import { useState } from "react";
import { CACHE_PREFIX } from "@/services/mediaCache";
import { LinearGradient } from "expo-linear-gradient";

const appVersion =
  (require("../../package.json") as { version?: string }).version ?? "0.0.0";

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();
  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  const logout = async () => {
    await signOut();
    await clearToken();
    router.replace("/login");
  };

  const clearWebCache = async () => {
    if (Platform.OS !== "web") return;
    if (!("caches" in window)) {
      setCacheMessage("Cache API not supported in this browser.");
      return;
    }

    setCacheClearing(true);
    setCacheMessage(null);
    try {
      const names = await window.caches.keys();
      const targets = names.filter((name) => name.startsWith(CACHE_PREFIX));
      await Promise.all(targets.map((name) => window.caches.delete(name)));
      setCacheMessage(
        targets.length > 0
          ? `Cleared ${targets.length} cache${targets.length > 1 ? "s" : ""}.`
          : "No media caches found."
      );
    } catch {
      setCacheMessage("Failed to clear cache. Try again.");
    } finally {
      setCacheClearing(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Muted style={styles.kicker}>Account</Muted>
            <Title>Profile</Title>
            <Muted style={styles.subtitle}>
              Manage your account and app data
            </Muted>
          </View>

          <LinearGradient
            colors={["rgba(79,139,255,0.32)", "rgba(79,139,255,0.07)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileCard}
          >
            <View style={styles.profileTopRow}>
              <View style={styles.avatarOuter}>
                {user?.imageUrl ? (
                  <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Ionicons name="person-outline" size={28} color="white" />
                  </View>
                )}
              </View>
              <View style={styles.versionPill}>
                <Muted style={styles.versionPillText}>v{appVersion}</Muted>
              </View>
            </View>

            <View style={styles.identity}>
              <Body style={styles.name}>{user?.fullName ?? "Anonymous"}</Body>
              <Muted style={styles.email}>
                {user?.primaryEmailAddress?.emailAddress ?? "No email"}
              </Muted>
            </View>
          </LinearGradient>

          <View style={styles.section}>
            <Muted style={styles.sectionTitle}>Storage</Muted>
            {Platform.OS === "web" ? (
              <Pressable
                style={[
                  styles.actionCard,
                  styles.cacheCard,
                  cacheClearing && { opacity: 0.6 },
                ]}
                onPress={clearWebCache}
                disabled={cacheClearing}
              >
                <View style={styles.actionLeft}>
                  <View style={[styles.iconBubble, styles.cacheBubble]}>
                    <Ionicons name="trash-outline" size={18} color="#FFD166" />
                  </View>
                  <View style={styles.actionCopy}>
                    <Body style={styles.actionTitle}>
                      {cacheClearing ? "Clearing cache…" : "Clear Media Cache"}
                    </Body>
                    <Muted style={styles.actionSubtitle}>
                      Remove locally cached media files on this browser
                    </Muted>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={Colors.dark.textMuted}
                />
              </Pressable>
            ) : (
              <View style={[styles.actionCard, styles.disabledCard]}>
                <View style={styles.actionLeft}>
                  <View style={[styles.iconBubble, styles.disabledBubble]}>
                    <Ionicons
                      name="desktop-outline"
                      size={18}
                      color={Colors.dark.textMuted}
                    />
                  </View>
                  <View style={styles.actionCopy}>
                    <Body style={styles.actionTitle}>Media Cache</Body>
                    <Muted style={styles.actionSubtitle}>
                      Cache controls are currently available on web
                    </Muted>
                  </View>
                </View>
              </View>
            )}
            {!!cacheMessage && (
              <Muted style={styles.cacheMessage}>{cacheMessage}</Muted>
            )}
          </View>

          <View style={styles.section}>
            <Muted style={styles.sectionTitle}>Security</Muted>
            <Pressable style={[styles.actionCard, styles.logoutCard]} onPress={logout}>
              <View style={styles.actionLeft}>
                <View style={[styles.iconBubble, styles.logoutBubble]}>
                  <Ionicons name="log-out-outline" size={18} color="#FF6B6B" />
                </View>
                <View style={styles.actionCopy}>
                  <Body style={styles.actionTitle}>Sign Out</Body>
                  <Muted style={styles.actionSubtitle}>
                    End your current session on this device
                  </Muted>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Colors.dark.textMuted}
              />
            </Pressable>
          </View>

          <View style={styles.versionBlock}>
            <Muted style={styles.versionText}>Version {appVersion}</Muted>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 30,
    paddingBottom: 84,
    paddingHorizontal: 16,
  },

  container: {
    width: "100%",
    maxWidth: 540,
    alignSelf: "center",
  },

  header: {
    marginBottom: 22,
  },

  kicker: {
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontSize: 11,
    color: Colors.dark.accent,
  },

  subtitle: {
    marginTop: 6,
    opacity: 0.75,
  },

  profileCard: {
    backgroundColor: "#1C1F24",
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  avatarOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#111",
  },

  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.dark.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  versionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  versionPillText: {
    color: Colors.dark.textPrimary,
    fontSize: 12,
    letterSpacing: 0.3,
  },

  identity: {
    marginTop: 16,
  },

  name: {
    fontSize: 20,
    marginBottom: 4,
  },

  email: {
    fontSize: 14,
    opacity: 0.8,
  },

  section: {
    marginTop: 22,
    gap: 10,
  },

  sectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    opacity: 0.75,
  },

  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  cacheCard: {
    backgroundColor: "rgba(255,209,102,0.12)",
    borderColor: "rgba(255,209,102,0.3)",
  },

  logoutCard: {
    backgroundColor: "rgba(255,107,107,0.12)",
    borderColor: "rgba(255,107,107,0.25)",
  },

  disabledCard: {
    opacity: 0.86,
  },

  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },

  actionCopy: {
    flex: 1,
    minWidth: 0,
  },

  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  cacheBubble: {
    backgroundColor: "rgba(255,209,102,0.16)",
    borderColor: "rgba(255,209,102,0.5)",
  },

  logoutBubble: {
    backgroundColor: "rgba(255,107,107,0.16)",
    borderColor: "rgba(255,107,107,0.45)",
  },

  disabledBubble: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
  },

  actionTitle: {
    color: Colors.dark.textPrimary,
    marginBottom: 2,
    flexShrink: 1,
  },

  actionSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    opacity: 0.85,
    flexShrink: 1,
  },

  cacheMessage: {
    marginLeft: 4,
    opacity: 0.75,
    fontSize: 12,
  },

  versionBlock: {
    marginTop: 24,
    alignItems: "center",
  },

  versionText: {
    fontSize: 12,
    opacity: 0.6,
  },
});
