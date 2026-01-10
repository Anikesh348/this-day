import { View, StyleSheet } from "react-native";
import { Body, Muted } from "./Text";
import { Colors } from "@/theme/colors";

export function EntryCard({
  caption,
  createdAt,
}: {
  caption: string;
  createdAt: string;
}) {
  return (
    <View style={styles.card}>
      <Body>{caption}</Body>
      <Muted>{new Date(createdAt).toLocaleTimeString()}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    shadowColor: Colors.dark.accentGlow,
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
});
