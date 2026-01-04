/**
 * MultiCleanerChecklist
 * Room-based checklist for multi-cleaner jobs
 * Shows only the rooms assigned to the current cleaner
 * Includes real-time progress sync with co-cleaners
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const MultiCleanerChecklist = ({
  appointmentId,
  rooms,
  checklistItems,
  onRoomComplete,
  onItemToggle,
  coCleanerProgress,
  loading = false,
  onRefresh,
}) => {
  const [expandedRoom, setExpandedRoom] = useState(null);
  const [localChecklist, setLocalChecklist] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  // Initialize local checklist state from props
  useEffect(() => {
    if (checklistItems) {
      const initialState = {};
      Object.keys(checklistItems).forEach((roomId) => {
        initialState[roomId] = checklistItems[roomId].reduce((acc, item) => {
          acc[item.id] = item.completed || false;
          return acc;
        }, {});
      });
      setLocalChecklist(initialState);
    }
  }, [checklistItems]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    }
    setRefreshing(false);
  }, [onRefresh]);

  const toggleItem = (roomId, itemId) => {
    const newState = {
      ...localChecklist,
      [roomId]: {
        ...localChecklist[roomId],
        [itemId]: !localChecklist[roomId]?.[itemId],
      },
    };
    setLocalChecklist(newState);
    onItemToggle?.(roomId, itemId, newState[roomId][itemId]);
  };

  const getRoomProgress = (roomId) => {
    const items = checklistItems?.[roomId] || [];
    const roomState = localChecklist[roomId] || {};
    const completed = Object.values(roomState).filter(Boolean).length;
    return { completed, total: items.length };
  };

  const isRoomComplete = (roomId) => {
    const { completed, total } = getRoomProgress(roomId);
    return total > 0 && completed === total;
  };

  const getTotalProgress = () => {
    let totalCompleted = 0;
    let totalItems = 0;
    Object.keys(localChecklist).forEach((roomId) => {
      const { completed, total } = getRoomProgress(roomId);
      totalCompleted += completed;
      totalItems += total;
    });
    return { completed: totalCompleted, total: totalItems };
  };

  const getRoomIcon = (roomType) => {
    switch (roomType?.toLowerCase()) {
      case "bedroom":
        return "moon";
      case "bathroom":
        return "droplet";
      case "kitchen":
        return "coffee";
      case "living_room":
        return "tv";
      case "dining_room":
        return "grid";
      default:
        return "square";
    }
  };

  const getRoomStatus = (room) => {
    if (room.status === "completed") {
      return { label: "Completed", color: colors.success[600], bg: colors.success[100] };
    }
    if (room.status === "in_progress") {
      return { label: "In Progress", color: colors.warning[600], bg: colors.warning[100] };
    }
    return { label: "Pending", color: colors.neutral[600], bg: colors.neutral[100] };
  };

  const totalProgress = getTotalProgress();
  const progressPercent = totalProgress.total > 0
    ? Math.round((totalProgress.completed / totalProgress.total) * 100)
    : 0;

  return (
    <View style={styles.container}>
      {/* Header with Overall Progress */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Cleaning Checklist</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {totalProgress.completed} of {totalProgress.total} tasks completed ({progressPercent}%)
        </Text>
      </View>

      {/* Co-Cleaner Progress (if available) */}
      {coCleanerProgress && coCleanerProgress.length > 0 && (
        <View style={styles.coCleanerSection}>
          <Text style={styles.coCleanerTitle}>Team Progress</Text>
          <View style={styles.coCleanerList}>
            {coCleanerProgress.map((cleaner, index) => (
              <View key={index} style={styles.coCleanerRow}>
                <View style={styles.coCleanerAvatar}>
                  <Feather name="user" size={14} color={colors.primary[600]} />
                </View>
                <Text style={styles.coCleanerName} numberOfLines={1}>
                  {cleaner.name}
                </Text>
                <View style={styles.coCleanerProgressContainer}>
                  <View style={styles.coCleanerProgressBar}>
                    <View
                      style={[
                        styles.coCleanerProgressFill,
                        { width: `${cleaner.percent}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.coCleanerPercent}>{cleaner.percent}%</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Room List */}
      <ScrollView
        style={styles.roomsList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {rooms?.map((room) => {
          const progress = getRoomProgress(room.id);
          const status = getRoomStatus(room);
          const isExpanded = expandedRoom === room.id;
          const roomComplete = isRoomComplete(room.id);

          return (
            <View key={room.id} style={styles.roomCard}>
              {/* Room Header */}
              <Pressable
                style={styles.roomHeader}
                onPress={() => setExpandedRoom(isExpanded ? null : room.id)}
              >
                <View style={[styles.roomIcon, roomComplete && styles.roomIconComplete]}>
                  <Feather
                    name={roomComplete ? "check" : getRoomIcon(room.roomType)}
                    size={20}
                    color={roomComplete ? colors.white : colors.primary[600]}
                  />
                </View>

                <View style={styles.roomInfo}>
                  <Text style={styles.roomName}>{room.displayLabel || room.roomLabel}</Text>
                  <View style={styles.roomMeta}>
                    <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                      <Text style={[styles.statusText, { color: status.color }]}>
                        {status.label}
                      </Text>
                    </View>
                    <Text style={styles.roomProgress}>
                      {progress.completed}/{progress.total}
                    </Text>
                  </View>
                </View>

                <Feather
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.neutral[400]}
                />
              </Pressable>

              {/* Checklist Items */}
              {isExpanded && (
                <View style={styles.checklistContainer}>
                  {checklistItems?.[room.id]?.map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.checklistItem}
                      onPress={() => toggleItem(room.id, item.id)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          localChecklist[room.id]?.[item.id] && styles.checkboxChecked,
                        ]}
                      >
                        {localChecklist[room.id]?.[item.id] && (
                          <Feather name="check" size={14} color={colors.white} />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.checklistText,
                          localChecklist[room.id]?.[item.id] && styles.checklistTextChecked,
                        ]}
                      >
                        {item.text}
                      </Text>
                    </Pressable>
                  ))}

                  {/* Room Complete Button */}
                  <Pressable
                    style={[
                      styles.completeRoomButton,
                      !roomComplete && styles.completeRoomButtonDisabled,
                    ]}
                    onPress={() => onRoomComplete?.(room.id)}
                    disabled={!roomComplete || loading}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <>
                        <Feather
                          name="check-circle"
                          size={18}
                          color={roomComplete ? colors.white : colors.neutral[400]}
                        />
                        <Text
                          style={[
                            styles.completeRoomText,
                            !roomComplete && styles.completeRoomTextDisabled,
                          ]}
                        >
                          Mark Room Complete
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}

        {/* All Rooms Complete Message */}
        {rooms?.every((room) => room.status === "completed") && (
          <View style={styles.allCompleteSection}>
            <View style={styles.allCompleteIcon}>
              <Feather name="check-circle" size={48} color={colors.success[600]} />
            </View>
            <Text style={styles.allCompleteTitle}>Great job!</Text>
            <Text style={styles.allCompleteText}>
              You've completed all your assigned rooms. Don't forget to upload your
              after photos for each room.
            </Text>
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.neutral[900],
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.neutral[200],
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary[500],
    borderRadius: 4,
  },
  progressText: {
    ...typography.sm,
    color: colors.neutral[600],
    marginTop: spacing.sm,
    textAlign: "center",
  },
  coCleanerSection: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  coCleanerTitle: {
    ...typography.base,
    fontWeight: "600",
    color: colors.neutral[700],
    marginBottom: spacing.md,
  },
  coCleanerList: {
    gap: spacing.sm,
  },
  coCleanerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  coCleanerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  coCleanerName: {
    ...typography.sm,
    color: colors.neutral[700],
    flex: 1,
  },
  coCleanerProgressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    width: 100,
  },
  coCleanerProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.neutral[200],
    borderRadius: 3,
    overflow: "hidden",
  },
  coCleanerProgressFill: {
    height: "100%",
    backgroundColor: colors.primary[400],
    borderRadius: 3,
  },
  coCleanerPercent: {
    ...typography.xs,
    color: colors.neutral[600],
    width: 30,
    textAlign: "right",
  },
  roomsList: {
    flex: 1,
    padding: spacing.md,
  },
  roomCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    ...shadows.sm,
    overflow: "hidden",
  },
  roomHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  roomIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  roomIconComplete: {
    backgroundColor: colors.success[500],
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    ...typography.base,
    fontWeight: "600",
    color: colors.neutral[800],
  },
  roomMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusText: {
    ...typography.xs,
    fontWeight: "600",
  },
  roomProgress: {
    ...typography.sm,
    color: colors.neutral[500],
  },
  checklistContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    padding: spacing.lg,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  checklistText: {
    ...typography.base,
    color: colors.neutral[700],
    flex: 1,
  },
  checklistTextChecked: {
    color: colors.neutral[400],
    textDecorationLine: "line-through",
  },
  completeRoomButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  completeRoomButtonDisabled: {
    backgroundColor: colors.neutral[200],
  },
  completeRoomText: {
    ...typography.base,
    fontWeight: "600",
    color: colors.white,
  },
  completeRoomTextDisabled: {
    color: colors.neutral[500],
  },
  allCompleteSection: {
    alignItems: "center",
    padding: spacing.xxl,
    backgroundColor: colors.success[50],
    borderRadius: radius.xl,
    marginTop: spacing.lg,
  },
  allCompleteIcon: {
    marginBottom: spacing.md,
  },
  allCompleteTitle: {
    ...typography.xl,
    fontWeight: "700",
    color: colors.success[700],
    marginBottom: spacing.sm,
  },
  allCompleteText: {
    ...typography.base,
    color: colors.success[600],
    textAlign: "center",
    lineHeight: 22,
  },
});

export default MultiCleanerChecklist;
