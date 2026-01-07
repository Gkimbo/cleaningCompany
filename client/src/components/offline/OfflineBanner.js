import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useNetworkStatus, useSyncStatus } from "../../services/offline/OfflineContext";
import { colors, spacing, typography, radius, shadows } from "../../services/styles/theme";
import { SYNC_STATUS } from "../../services/offline/constants";

export default function OfflineBanner() {
  const { isOffline, isOnline } = useNetworkStatus();
  const { syncStatus, pendingSyncCount } = useSyncStatus();

  // Don't show banner when online and no pending syncs
  if (isOnline && pendingSyncCount === 0 && syncStatus === SYNC_STATUS.IDLE) {
    return null;
  }

  // Determine banner content based on state
  const getBannerConfig = () => {
    if (isOffline) {
      return {
        backgroundColor: colors.warning[500],
        text: "Offline Mode",
        subtext: pendingSyncCount > 0 ? `${pendingSyncCount} changes pending sync` : "Changes will sync when online",
        icon: "cloud-offline",
      };
    }

    if (syncStatus === SYNC_STATUS.SYNCING) {
      return {
        backgroundColor: colors.primary[500],
        text: "Syncing...",
        subtext: `${pendingSyncCount} changes remaining`,
        icon: "cloud-sync",
      };
    }

    if (syncStatus === SYNC_STATUS.ERROR) {
      return {
        backgroundColor: colors.error[500],
        text: "Sync Error",
        subtext: "Tap to retry",
        icon: "cloud-alert",
      };
    }

    if (pendingSyncCount > 0) {
      return {
        backgroundColor: colors.warning[500],
        text: "Changes Pending",
        subtext: `${pendingSyncCount} changes waiting to sync`,
        icon: "cloud-upload",
      };
    }

    return null;
  };

  const config = getBannerConfig();
  if (!config) return null;

  return (
    <View style={[styles.container, { backgroundColor: config.backgroundColor }]}>
      <View style={styles.content}>
        <Text style={styles.mainText}>{config.text}</Text>
        {config.subtext && <Text style={styles.subText}>{config.subtext}</Text>}
      </View>
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
