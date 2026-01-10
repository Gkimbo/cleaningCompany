import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useOffline } from "../../services/offline/OfflineContext";
import { colors, spacing, typography, shadows } from "../../services/styles/theme";
import { SYNC_STATUS } from "../../services/offline/constants";

export default function OfflineBanner() {
  const {
    isOffline,
    isOnline,
    syncStatus,
    pendingSyncCount,
    autoSyncEvent,
    triggerManualSync
  } = useOffline();

  // Show success banner briefly after sync completes
  const showSuccessBanner = syncStatus === SYNC_STATUS.COMPLETED && autoSyncEvent?.type === "sync_completed";

  // Don't show banner when online and no pending syncs (unless showing success)
  if (isOnline && pendingSyncCount === 0 && syncStatus === SYNC_STATUS.IDLE && !showSuccessBanner) {
    return null;
  }

  // Handle tap to retry sync
  const handleTap = () => {
    if (syncStatus === SYNC_STATUS.ERROR) {
      triggerManualSync();
    }
  };

  // Determine banner content based on state
  const getBannerConfig = () => {
    // Success state (shown briefly after auto-sync completes)
    if (showSuccessBanner) {
      const syncedCount = autoSyncEvent?.syncedCount || 0;
      return {
        backgroundColor: colors.success[500],
        text: "Sync Complete",
        subtext: syncedCount > 0 ? `${syncedCount} changes synced` : "All data up to date",
        icon: "cloud-check",
        tappable: false,
      };
    }

    if (isOffline) {
      return {
        backgroundColor: colors.warning[500],
        text: "Offline Mode",
        subtext: pendingSyncCount > 0 ? `${pendingSyncCount} changes pending sync` : "Changes will sync when online",
        icon: "cloud-offline",
        tappable: false,
      };
    }

    if (syncStatus === SYNC_STATUS.SYNCING) {
      return {
        backgroundColor: colors.primary[500],
        text: "Syncing...",
        subtext: `${pendingSyncCount} changes remaining`,
        icon: "cloud-sync",
        tappable: false,
      };
    }

    if (syncStatus === SYNC_STATUS.ERROR) {
      const retryInfo = autoSyncEvent?.type === "sync_retry_scheduled"
        ? `Retrying in ${Math.round(autoSyncEvent.delay / 1000)}s...`
        : "Tap to retry";
      return {
        backgroundColor: colors.error[500],
        text: "Sync Error",
        subtext: retryInfo,
        icon: "cloud-alert",
        tappable: autoSyncEvent?.type !== "sync_retry_scheduled",
      };
    }

    if (pendingSyncCount > 0) {
      return {
        backgroundColor: colors.warning[500],
        text: "Changes Pending",
        subtext: `${pendingSyncCount} changes waiting to sync`,
        icon: "cloud-upload",
        tappable: false,
      };
    }

    return null;
  };

  const config = getBannerConfig();
  if (!config) return null;

  const content = (
    <View style={styles.content}>
      <Text style={styles.mainText}>{config.text}</Text>
      {config.subtext && <Text style={styles.subText}>{config.subtext}</Text>}
    </View>
  );

  if (config.tappable) {
    return (
      <TouchableOpacity
        style={[styles.container, { backgroundColor: config.backgroundColor }]}
        onPress={handleTap}
        activeOpacity={0.8}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: config.backgroundColor }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  mainText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  subText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.xs,
    opacity: 0.9,
  },
});
