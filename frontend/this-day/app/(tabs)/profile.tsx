import { Screen } from "@/components/Screen";
import { Body, Muted, Title } from "@/components/Text";
import { clearToken } from "@/services/auth";
import { Colors } from "@/theme/colors";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, View, Platform } from "react-native";
import { useState } from "react";
import { CACHE_PREFIX } from "@/services/mediaCache";

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
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Title>Profile</Title>
          <Muted style={styles.subtitle}>Your account & preferences</Muted>
        </View>

        {/* Identity card */}
        <View style={styles.card}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
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

        {/* Actions */}
        <View style={styles.actions}>
          {Platform.OS === "web" && (
            <View style={styles.cacheBlock}>
              <Pressable
                style={[
                  styles.cacheBtn,
                  cacheClearing && { opacity: 0.6 },
                ]}
                onPress={clearWebCache}
                disabled={cacheClearing}
              >
                <Ionicons name="trash-outline" size={18} color="#FFD166" />
                <Body style={styles.cacheText}>
                  {cacheClearing ? "Clearing…" : "Clear Media Cache"}
                </Body>
              </Pressable>
              {!!cacheMessage && (
                <Muted style={styles.cacheMessage}>{cacheMessage}</Muted>
              )}
            </View>
          )}

          <Pressable style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color="#FF6B6B" />
            <Body style={styles.logoutText}>Sign Out</Body>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#1C1F24",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
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
    backgroundColor: Colors.dark.accent,
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

  actions: {
    marginTop: 40,
    gap: 14,
  },

  cacheBlock: {
    gap: 8,
  },

  cacheBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: "rgba(255,209,102,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,209,102,0.3)",
  },

  cacheText: {
    color: "#FFD166",
  },

  cacheMessage: {
    textAlign: "center",
    opacity: 0.75,
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
});
