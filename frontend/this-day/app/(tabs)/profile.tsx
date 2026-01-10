import { Screen } from "@/components/Screen";
import { Body, Muted, Title } from "@/components/Text";
import { clearToken } from "@/services/auth";
import { Colors } from "@/theme/colors";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

export default function ProfileScreen() {
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
      <Title>Profile</Title>

      <View style={styles.card}>
        <Body>{user?.fullName}</Body>
        <Muted>{user?.primaryEmailAddress?.emailAddress}</Muted>
      </View>

      <Pressable style={styles.logout} onPress={logout}>
        <Muted>Sign Out</Muted>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 24,
    padding: 18,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  logout: {
    marginTop: 40,
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: Colors.dark.surfaceAlt,
  },
});
