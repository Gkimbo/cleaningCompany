import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useOffline } from "../../services/offline/OfflineContext";
import OfflineManager from "../../services/offline/OfflineManager";
import StorageManager from "../../services/offline/StorageManager";
import { colors, spacing, typography, radius, shadows } from "../../services/styles/theme";

/**
 * OfflineModeToggle - Settings component for offline mode configuration
 *
 * Shows storage usage, allows manual preload, and cleanup of offline data.
 */
export default function OfflineModeToggle({ style }) {
  const { isOnline, pendingSyncCount } = useOffline();
  const [storageStats, setStorageStats] = useState(null);
  const [isPreloading, setIsPreloading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [lastAction, setLastAction] = useState(null);

  // Load storage stats
  const loadStats = useCallback(async () => {
    try {
      const stats = await StorageManager.getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      console.error("Failed to load storage stats:", error);
    }
  }, []);

  useEffect(() => {
    loadStats();
    // Subscribe to storage updates
    const unsubscribe = StorageManager.subscribe(setStorageStats);
    return unsubscribe;
  }, [loadStats]);

  // Handle preload
  const handlePreload = useCallback(async () => {
    if (!isOnline) {
      setLastAction({ success: false, message: "Cannot preload while offline" });
      return;
    }

    setIsPreloading(true);
    setLastAction(null);

    try {
      await OfflineManager.preloadJobs();
      await loadStats();
      setLastAction({ success: true, message: "Jobs preloaded successfully" });
    } catch (error) {
      setLastAction({ success: false, message: error.message });
    } finally {
      setIsPreloading(false);
    }
  }, [isOnline, loadStats]);

  // Handle cleanup
  const handleCleanup = useCallback(async () => {
    if (pendingSyncCount > 0) {
      setLastAction({ success: false, message: "Sync pending data before cleanup" });
      return;
    }

    setIsCleaning(true);
    setLastAction(null);

    try {
      const result = await StorageManager.runCleanup();
      await loadStats();

      const totalCleaned = result.cleanedJobs + result.cleanedPhotos + result.cleanedSyncQueue;
      if (totalCleaned > 0) {
        setLastAction({ success: true, message: `Cleaned ${totalCleaned} items` });
      } else {
        setLastAction({ success: true, message: "Nothing to clean" });
      }
    } catch (error) {
      setLastAction({ success: false, message: error.message });
    } finally {
      setIsCleaning(false);
    }
  }, [pendingSyncCount, loadStats]);

  // Get storage health color
  const getHealthColor = (health) => {
    switch (health) {
      case "critical":
        return colors.error[500];
      case "warning":
        return colors.warning[500];
      default:
        return colors.success[500];
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.sectionTitle}>Offline Mode</Text>

      {/* Status Card */}
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <View
              style={[styles.statusDot, { backgroundColor: isOnline ? colors.success[500] : colors.warning[500] }]}
            />
            <Text style={styles.statusLabel}>{isOnline ? "Online" : "Offline"}</Text>
          </View>

          {pendingSyncCount > 0 && (
            <View style={styles.statusItem}>
              <Text style={styles.pendingCount}>{pendingSyncCount}</Text>
              <Text style={styles.statusLabel}>pending sync</Text>
            </View>
          )}
        </View>
      </View>

      {/* Storage Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Storage</Text>

        {storageStats ? (
          <>
            <View style={styles.storageRow}>
              <Text style={styles.storageLabel}>Photos</Text>
              <Text style={styles.storageValue}>
                {storageStats.totalPhotoCount} ({storageStats.photoStorageFormatted})
              </Text>
            </View>

            <View style={styles.storageRow}>
              <Text style={styles.storageLabel}>Cached Jobs</Text>
              <Text style={styles.storageValue}>{storageStats.jobCount}</Text>
            </View>

            <View style={styles.storageRow}>
              <Text style={styles.storageLabel}>Sync Queue</Text>
              <Text style={styles.storageValue}>{storageStats.pendingSyncCount} pending</Text>
            </View>

            {storageStats.unresolvedConflictCount > 0 && (
              <View style={styles.storageRow}>
                <Text style={[styles.storageLabel, { color: colors.warning[600] }]}>Conflicts</Text>
                <Text style={[styles.storageValue, { color: colors.warning[600] }]}>
                  {storageStats.unresolvedConflictCount} unresolved
                </Text>
              </View>
            )}

            <View style={[styles.healthBadge, { backgroundColor: getHealthColor(storageStats.health) }]}>
              <Text style={styles.healthText}>{storageStats.healthMessage}</Text>
            </View>
          </>
        ) : (
          <ActivityIndicator size="small" color={colors.primary[500]} style={styles.loader} />
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, !isOnline && styles.actionButtonDisabled]}
          onPress={handlePreload}
          disabled={!isOnline || isPreloading}
        >
          {isPreloading ? (
            <ActivityIndicator size="small" color={colors.primary[500]} />
          ) : (
            <>
              <Text style={[styles.actionButtonText, !isOnline && styles.actionButtonTextDisabled]}>
                Preload Jobs
              </Text>
              <Text style={styles.actionButtonSubtext}>Download for offline use</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, pendingSyncCount > 0 && styles.actionButtonDisabled]}
          onPress={handleCleanup}
          disabled={pendingSyncCount > 0 || isCleaning}
        >
          {isCleaning ? (
            <ActivityIndicator size="small" color={colors.primary[500]} />
          ) : (
            <>
              <Text style={[styles.actionButtonText, pendingSyncCount > 0 && styles.actionButtonTextDisabled]}>
                Cleanup Storage
              </Text>
              <Text style={styles.actionButtonSubtext}>Remove synced data</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Last Action Result */}
      {lastAction && (
        <View
          style={[
            styles.resultBanner,
            { backgroundColor: lastAction.success ? colors.success[50] : colors.error[50] },
          ]}
        >
          <Text
            style={[styles.resultText, { color: lastAction.success ? colors.success[700] : colors.error[700] }]}
          >
            {lastAction.message}
          </Text>
        </View>
      )}

      {/* Data Freshness */}
      <View style={styles.freshnessContainer}>
        <Text style={styles.freshnessLabel}>Data freshness: </Text>
        <Text style={styles.freshnessValue}>{OfflineManager.getDataFreshness().formattedAge || "Not loaded"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[800],
    marginBottom: spacing.sm,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
  },
  pendingCount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[600],
  },
  storageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  storageLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
  },
  storageValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[800],
  },
  healthBadge: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignSelf: "flex-start",
  },
  healthText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.medium,
  },
  loader: {
    paddingVertical: spacing.lg,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    ...shadows.sm,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  actionButtonTextDisabled: {
    color: colors.neutral[400],
  },
  actionButtonSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  resultBanner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  resultText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    textAlign: "center",
  },
  freshnessContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  freshnessLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
  freshnessValue: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[700],
    fontWeight: typography.fontWeight.medium,
  },
});
