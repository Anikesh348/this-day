import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { Screen } from "@/components/Screen";
import { Body, Muted } from "@/components/Text";
import { deleteEntry, getDayEntries } from "@/services/entries";
import { Colors } from "@/theme/colors";

interface Entry {
  _id: string;
  caption: string;
  immichAssetIds: (string | null)[];
  createdAt: string;
}

export default function DayViewScreen() {
  const router = useRouter();
  const { date, from } = useLocalSearchParams<{
    date: string;
    from?: "calendar" | "today";
  }>();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;

    const [y, m, d] = date.split("-").map(Number);

    getDayEntries(y, m, d)
      .then((res) => setEntries(res.data))
      .finally(() => setLoading(false));
  }, [date]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (from === "calendar") {
      router.replace("/calendar");
    } else {
      router.replace("/today");
    }
  };

  const handleAdd = () => {
    router.push({
      pathname: "/add",
      params: {
        mode: "backfill",
        date,
      },
    });
  };

  const performDelete = async (entryId: string) => {
    try {
      setDeletingId(entryId);
      await deleteEntry(entryId);
      setEntries((prev) => prev.filter((e) => e._id !== entryId));
    } catch (err) {
      Alert.alert(
        "Delete failed",
        "Could not delete the entry. Please try again."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (entryId: string) => {
    if (Platform.OS === "web") {
      if (window.confirm("This entry will be permanently deleted.")) {
        performDelete(entryId);
      }
      return;
    }

    Alert.alert("Delete Entry", "This entry will be permanently deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => performDelete(entryId),
      },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={handleBack}>
          <Ionicons
            name="chevron-back"
            size={26}
            color={Colors.dark.textPrimary}
          />
        </Pressable>

        <Muted>
          {new Date(date!).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </Muted>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {entries.map((entry) => (
          <View key={entry._id} style={styles.entryCard}>
            {/* Header row */}
            <View style={styles.entryHeader}>
              <Muted style={styles.time}>
                {new Date(entry.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Muted>

              <Pressable
                onPress={() => confirmDelete(entry._id)}
                disabled={deletingId === entry._id}
                hitSlop={10}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={
                    deletingId === entry._id
                      ? Colors.dark.textMuted
                      : Colors.dark.textPrimary
                  }
                />
              </Pressable>
            </View>

            {/* Caption */}
            {entry.caption && (
              <Body style={styles.caption}>{entry.caption}</Body>
            )}

            {/* Media */}
            {entry.immichAssetIds?.filter(Boolean).length > 0 && (
              <View style={styles.mediaGrid}>
                {entry.immichAssetIds.filter(Boolean).map((assetId) => (
                  <Image
                    key={assetId!}
                    source={{
                      uri: `https://thisday.hostingfrompurva.xyz/api/media/immich/${assetId}?type=full`,
                    }}
                    style={styles.image}
                  />
                ))}
              </View>
            )}
          </View>
        ))}

        {entries.length === 0 && (
          <Muted style={{ marginTop: 40 }}>No entries for this day.</Muted>
        )}
      </ScrollView>

      {/* Add Entry FAB */}
      <Pressable style={styles.fab} onPress={handleAdd}>
        <Ionicons name="add" size={28} color="white" />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },

  scroll: {
    paddingBottom: 120,
  },

  entryCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },

  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  caption: {
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 12,
  },

  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  image: {
    width: "48%",
    height: 160,
    borderRadius: 14,
    backgroundColor: "#000",
  },

  time: {
    fontSize: 12,
  },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 96,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.dark.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
});
