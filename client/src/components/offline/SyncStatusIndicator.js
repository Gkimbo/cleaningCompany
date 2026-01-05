import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSyncStatus, useNetworkStatus } from "../../services/offline/OfflineContext";
import { colors, spacing, typography, radius } from "../../services/styles/theme";
import { SYNC_STATUS } from "../../services/offline/constants";

export default function SyncStatusIndicator({ onPress, compact = false }) {
  const { syncStatus, pendingSyncCount } = useSyncStatus();
  const { isOnline } = useNetworkStatus();

  // Don't show if nothing to sync and idle
  if (pendingSyncCount === 0 && syncStatus === SYNC_STATUS.IDLE) {
    return null;
  }

  const getStatusConfig = () => {
    if (syncStatus === SYNC_STATUS.SYNCING) {
      return {
        color: colors.primary[500],
        bgColor: colors.primary[50],
        text: compact ? `${pendingSyncCount}` : `Syncing... (${pendingSyncCount})`,
        showSpinner: true,
      };
    }

    if (syncStatus === SYNC_STATUS.ERROR) {
      return {
        color: colors.error[600],
        bgColor: colors.error[50],
        text: compact ? "!" : "Sync failed",
        showSpinner: false,
      };
    }

    if (syncStatus === SYNC_STATUS.COMPLETED) {
      return {
        color: colors.success[600],
        bgColor: colors.success[50],
        text: compact ? "" : "Synced",
        showSpinner: false,
      };
    }

    // Pending
    if (!isOnline) {
      return {
        color: colors.warning[600],
        bgColor: colors.warning[50],
        text: compact ? `${pendingSyncCount}` : `${pendingSyncCount} pending`,
        showSpinner: false,
      };
    }

    return {
      color: colors.primary[600],
      bgColor: colors.primary[50],
      text: compact ? `${pendingSyncCount}` : `${pendingSyncCount} to sync`,
      showSpinner: false,
    };
  };

  const config = getStatusConfig();

  const content = (
    <View style={[styles.container, compact && styles.containerCompact, { backgroundColor: config.bgColor }]}>
      {config.showSpinner && <ActivityIndicator size="small" color={config.color} style={styles.spinner} />}
      {config.text ? <Text style={[styles.text, { color: config.color }]}>{config.text}</Text> : null}
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  containerCompact: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  spinner: {
    marginRight: spacing.xs,
  },
  text: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
});
