import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { Slot, usePathname, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

const tokenCache =
  Platform.OS === "web"
    ? undefined
    : {
        async getToken(key: string) {
          return SecureStore.getItemAsync(key);
        },
        async saveToken(key: string, value: string) {
          await SecureStore.setItemAsync(key, value);
        },
      };

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoaded) return;

    // ❌ Not logged in → always go to login
    if (!isSignedIn) {
      if (pathname !== "/login") {
        router.replace("/login");
      }
      return;
    }

    // ✅ Logged in + root path → redirect to today
    if (isSignedIn && pathname === "/") {
      router.replace("/today");
    }
  }, [isLoaded, isSignedIn, pathname]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <AuthGate>
        <Slot />
      </AuthGate>
    </ClerkProvider>
  );
}
