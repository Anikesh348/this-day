import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

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
  caption?: string | null;
  immichAssetIds: (string | null)[];
  createdAt: string;
}

export default function DayViewScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{
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
            prev[assetId] ? prev : { ...prev, [assetId]: true },
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
    router.replace({
      pathname: "/today",
      params: { date, from: "day" },
    });
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <Pressable onPress={handleBack} style={styles.iconBtn}>
              <Ionicons
                name="chevron-back"
                size={24}
                color={Colors.dark.textPrimary}
              />
            </Pressable>
          </View>

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
            <Muted style={styles.dayMeta}>
              {loading
                ? "Loading entries..."
                : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
            </Muted>
          </View>

          <View style={styles.headerSide}>
            <Pressable
              onPress={loadData}
              disabled={loading}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.6 },
                loading && { opacity: 0.4 },
              ]}
            >
              <Ionicons
                name="refresh"
                size={24}
                color={Colors.dark.textMuted}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.stack}>
          {loading && <Muted>Loading…</Muted>}

          {!loading && entries.length === 0 && (
            <View style={[styles.card, styles.emptyCard]}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="reader-outline"
                  size={22}
                  color={Colors.dark.textMuted}
                />
              </View>
              <Muted style={styles.emptyTitle}>No entries for this day</Muted>
              <Muted style={styles.emptySubtitle}>
                Tap the + button to add your first memory.
              </Muted>
            </View>
          )}

          {!loading &&
            entries.map((entry) => (
              <View key={entry._id} style={styles.card}>
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(79,139,255,0.16)", "rgba(79,139,255,0.01)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardGradient}
                />

                {/* Card header */}
                <View style={styles.cardHeader}>
                  <Muted style={styles.timePill}>
                    {new Date(entry.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Muted>

                  <View style={styles.cardActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.editBtn,
                        pressed && styles.actionPressed,
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: "/add",
                          params: {
                            mode: "edit",
                            from: "day",
                            date,
                            entryId: entry._id,
                            entryCaption: entry.caption ?? "",
                            existingAssetIds: JSON.stringify(
                              entry.immichAssetIds.filter(Boolean),
                            ),
                          },
                        })
                      }
                    >
                      <Ionicons
                        name="create-outline"
                        size={14}
                        color={Colors.dark.textPrimary}
                      />
                      <Muted style={styles.editBtnText}>Edit</Muted>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.deleteBtnIcon,
                        pressed && styles.actionPressed,
                      ]}
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
                                `/api/media/immich/${assetId}?type=thumbnail`,
                              ),
                            }}
                            style={styles.thumbnail}
                          />
                          {videoIds[assetId as string] && (
                            <View style={styles.videoBadge}>
                              <Ionicons name="play" size={14} color="white" />
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
    paddingTop: 20,
    paddingBottom: 120,
    paddingHorizontal: 6,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    marginBottom: 22,
  },

  headerText: {
    flex: 1,
    alignItems: "center",
  },

  headerSide: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  title: {
    marginBottom: 2,
  },

  subtitle: {
    opacity: 0.75,
  },

  dayMeta: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.dark.textMuted,
  },

  stack: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    gap: 18,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },

  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  emptyCard: {
    alignItems: "center",
    paddingVertical: 30,
  },

  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 10,
  },

  emptyTitle: {
    color: Colors.dark.textSecondary,
  },

  emptySubtitle: {
    marginTop: 4,
    opacity: 0.74,
    fontSize: 12,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  deleteBtnIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,92,92,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,92,92,0.2)",
  },

  actionPressed: {
    opacity: 0.72,
  },

  editBtnText: {
    fontSize: 12,
    color: Colors.dark.textPrimary,
  },

  timePill: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  caption: {
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 12,
    color: Colors.dark.textPrimary,
  },

  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },

  thumbnail: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    borderRadius: 16,
    backgroundColor: "#111",
  },

  thumbWrap: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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
    backgroundColor: "#171B22",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
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
    backgroundColor: "rgba(79,139,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6C8CFF",
    shadowOpacity: 0.38,
    shadowRadius: 26,
    elevation: 12,
  },

  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 7,
  },
});
