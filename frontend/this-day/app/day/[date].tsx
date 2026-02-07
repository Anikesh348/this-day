import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Dimensions,
} from "react-native";

import { Screen } from "@/components/Screen";
import { Body, Muted, Title } from "@/components/Text";
import { deleteEntry, getDayEntries } from "@/services/entries";
import { Colors } from "@/theme/colors";
import { apiUrl } from "@/services/apiBase";
import { ensureMediaCached } from "@/services/mediaCache";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_GAP = 8;
const GRID_COLUMNS = 3;
const GRID_ITEM_SIZE =
  (SCREEN_WIDTH - 16 * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

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
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const prefetchedIds = useRef(new Set<string>());
  const [videoIds, setVideoIds] = useState<Record<string, true>>({});

  const loadData = async () => {
    if (!date) return;
    setLoading(true);

    const [y, m, d] = date.split("-").map(Number);

    try {
      const res = await getDayEntries(y, m, d);
      setEntries(res.data);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [date]),
  );

  useEffect(() => {
    if (entries.length === 0) return;

    const ids = entries
      .flatMap((entry) => entry.immichAssetIds ?? [])
      .filter(Boolean) as string[];

    if (ids.length === 0) return;

    const uniqueIds = ids.filter((id) => !prefetchedIds.current.has(id));
    if (uniqueIds.length === 0) return;

    const CONCURRENCY = 3;
    let index = 0;

    const prefetchOne = async (assetId: string) => {
      prefetchedIds.current.add(assetId);
      const mediaUrl = apiUrl(`/api/media/immich/${assetId}?type=full`);

      try {
        const res = await fetch(mediaUrl, { method: "HEAD" });
        const type = res.headers.get("content-type") ?? "";
        if (type.startsWith("video/")) {
          setVideoIds((prev) =>
            prev[assetId] ? prev : { ...prev, [assetId]: true }
          );
        } else if (type.startsWith("image/")) {
          if (Platform.OS === "web") {
            await ensureMediaCached(mediaUrl);
          } else {
            await Image.prefetch(mediaUrl);
          }
        }
      } catch {
        // Best-effort only; ignore failures to keep UI responsive.
      }
    };

    const workers = new Array(CONCURRENCY).fill(0).map(async () => {
      while (index < uniqueIds.length) {
        const id = uniqueIds[index];
        index += 1;
        await prefetchOne(id);
      }
    });

    Promise.all(workers).catch(() => {});
  }, [entries]);

  const handleBack = () => {
    router.replace(from === "calendar" ? "/calendar" : "/today");
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backBtn}>
            <Ionicons
              name="chevron-back"
              size={26}
              color={Colors.dark.textPrimary}
            />
          </Pressable>

          <View style={styles.headerText}>
            <Title style={styles.title}>
              {new Date(date!).toLocaleDateString(undefined, {
                weekday: "long",
              })}
            </Title>

            <Muted style={styles.subtitle}>
              {new Date(date!).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </Muted>
          </View>

          <Pressable
            onPress={loadData}
            disabled={loading}
            style={({ pressed }) => [
              styles.refreshBtn,
              pressed && { opacity: 0.6 },
              loading && { opacity: 0.4 },
            ]}
          >
            <Ionicons name="refresh" size={30} color={Colors.dark.textMuted} />
          </Pressable>
        </View>

        <View style={styles.stack}>
          {loading && <Muted>Loading…</Muted>}

          {!loading && entries.length === 0 && (
            <View style={[styles.card, styles.emptyCard]}>
              <Muted>No entries for this day</Muted>
            </View>
          )}

          {!loading &&
            entries.map((entry) => (
              <View key={entry._id} style={styles.card}>
                {/* Card header */}
                <View style={styles.cardHeader}>
                  <Muted style={styles.time}>
                    {new Date(entry.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Muted>

                  <Pressable
                    onPress={() => {
                      setDeleteTargetId(entry._id);
                      setDeleteModalVisible(true);
                    }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={Colors.dark.textPrimary}
                    />
                  </Pressable>
                </View>

                {entry.caption && (
                  <Body style={styles.caption}>{entry.caption}</Body>
                )}

                {entry.immichAssetIds?.filter(Boolean).length > 0 && (
                  <View style={styles.mediaGrid}>
                    {entry.immichAssetIds.filter(Boolean).map((assetId) => (
                      <Pressable
                        key={assetId!}
                        onPress={() =>
                          router.push({
                            pathname: "media/[assetId]",
                            params: {
                              assetId,
                              caption: entry?.caption,
                              date,
                            },
                          })
                        }
                      >
                        <View style={styles.thumbWrap}>
                          <Image
                            source={{
                              uri: apiUrl(
                                `/api/media/immich/${assetId}?type=thumbnail`
                              ),
                            }}
                            style={styles.thumbnail}
                          />
                          {videoIds[assetId as string] && (
                            <View style={styles.videoBadge}>
                              <Ionicons
                                name="play"
                                size={14}
                                color="white"
                              />
                            </View>
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ))}
        </View>
      </ScrollView>

      {/* Delete Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Title style={styles.modalTitle}>Delete entry?</Title>
            <Muted style={styles.modalSubtitle}>
              This action cannot be undone.
            </Muted>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Body>Cancel</Body>
              </Pressable>

              <Pressable
                style={styles.deleteBtn}
                onPress={async () => {
                  if (!deleteTargetId) return;
                  await deleteEntry(deleteTargetId);
                  setEntries((p) => p.filter((e) => e._id !== deleteTargetId));
                  setDeleteModalVisible(false);
                }}
              >
                <Body style={{ color: "white" }}>Delete</Body>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* FAB */}
      <Pressable
        style={styles.fabOuter}
        onPress={() =>
          router.push({
            pathname: "/add",
            params: { mode: "backfill", date, from: "day" },
          })
        }
      >
        <View style={styles.fabInner}>
          <Ionicons name="add" size={28} color="white" />
        </View>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: 36,
    paddingBottom: 120,
    paddingHorizontal: 6,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },

  headerText: {
    alignItems: "center",
  },

  backBtn: {
    position: "absolute",
    left: 0,
    top: 2,
  },

  refreshBtn: {
    position: "absolute",
    right: 0,
    padding: 8,
    borderRadius: 20,
  },

  title: {
    marginBottom: 2,
  },

  subtitle: {
    opacity: 0.75,
  },

  stack: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    gap: 22,
  },

  card: {
    backgroundColor: "#1C1F24",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  emptyCard: {
    alignItems: "center",
    paddingVertical: 32,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  time: {
    fontSize: 12,
    opacity: 0.75,
  },

  caption: {
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 12,
  },

  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },

  thumbnail: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    borderRadius: 14,
    backgroundColor: "#111",
  },

  thumbWrap: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },

  videoBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalCard: {
    width: "86%",
    backgroundColor: "#1E2126",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  modalTitle: {
    fontSize: 18,
    marginBottom: 6,
  },

  modalSubtitle: {
    opacity: 0.75,
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
  },

  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  deleteBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#E45858",
  },

  fabOuter: {
    position: "absolute",
    right: 20,
    bottom: 64,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(108,140,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6C8CFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
