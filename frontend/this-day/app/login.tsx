import { useAuth, useOAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Body, Muted, Title } from "@/components/Text";
import { clearToken, saveToken } from "@/services/auth";
import { loginBackend } from "@/services/authApi";
import { Colors } from "@/theme/colors";

export default function LoginScreen() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    let active = true;

    const syncAuthState = async () => {
      if (isSignedIn) {
        try {
          const token = await getToken({ template: "ThisDay" });
          if (token) {
            await saveToken(token);
          }
        } catch {
          // Best-effort only
        }
        if (active) {
          router.replace("/today");
        }
        return;
      }

      try {
        await clearToken();
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    };

    void syncAuthState();

    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, getToken, router]);

  const signIn = async () => {
    const { createdSessionId, setActive } = await startOAuthFlow();
    if (!createdSessionId) return;

    await setActive!({ session: createdSessionId });
    const token = await getToken({ template: "ThisDay" });
    if (!token) return;

    await saveToken(token);
    await loginBackend();
    router.replace("/today");
  };

  if (!isLoaded || checking) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.center}>
        <Title>This Day</Title>
        <Muted>Private. Calm. Timeless.</Muted>

        <Pressable style={styles.button} onPress={signIn}>
          <Body>Continue with Google</Body>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
  },
  button: {
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 22,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    shadowColor: Colors.dark.accentGlow,
    shadowOpacity: 0.4,
    shadowRadius: 30,
  },
});
