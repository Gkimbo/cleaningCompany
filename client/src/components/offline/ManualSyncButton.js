import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSyncStatus, useNetworkStatus as useNetworkStatusHook } from "../../services/offline/OfflineContext";
import SyncEngine from "../../services/offline/SyncEngine";
import { colors, spacing, typography, radius, shadows } from "../../services/styles/theme";
import { SYNC_STATUS } from "../../services/offline/constants";

/**
 * ManualSyncButton - Allows users to manually trigger sync
 *
 * Shows sync status and progress, with ability to retry failed syncs.
 */
export default function ManualSyncButton({ style, variant = "primary", showDetails = true }) {
  const { syncStatus, pendingSyncCount, updateSyncStatus } = useSyncStatus();
  const { isOffline } = useNetworkStatusHook();
  const [isTriggering, setIsTriggering] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleSync = useCallback(async () => {
    if (isOffline) {
      setLastResult({ success: false, message: "No internet connection" });
      return;
    }

    if (syncStatus === SYNC_STATUS.SYNCING) {
      return; // Already syncing
    }

    setIsTriggering(true);
    setLastResult(null);
    updateSyncStatus(SYNC_STATUS.SYNCING);

    try {
      const result = await SyncEngine.startSync();

      if (result.success) {
        updateSyncStatus(SYNC_STATUS.COMPLETED);
        setLastResult({
          success: true,
          message: result.synced > 0 ? `Synced ${result.synced} items` : "All up to date",
        });
      } else {
        updateSyncStatus(SYNC_STATUS.ERROR);
        setLastResult({
          success: false,
          message: result.reason === "offline" ? "No internet connection" : result.error || "Sync failed",
        });
      }
    } catch (error) {
      console.error("Manual sync error:", error);
      updateSyncStatus(SYNC_STATUS.ERROR);
      setLastResult({ success: false, message: error.message });
    } finally {
      setIsTriggering(false);
    }
  }, [isOffline, syncStatus, updateSyncStatus]);

  const handleRetry = useCallback(async () => {
    setIsTriggering(true);
    setLastResult(null);
    updateSyncStatus(SYNC_STATUS.SYNCING);

    try {
      const result = await SyncEngine.retryFailed();

      if (result.success) {
        updateSyncStatus(SYNC_STATUS.COMPLETED);
        setLastResult({ success: true, message: `Retried ${result.synced} items` });
      } else {
        updateSyncStatus(SYNC_STATUS.ERROR);
        setLastResult({ success: false, message: result.error || "Retry failed" });
      }
    } catch (error) {
      updateSyncStatus(SYNC_STATUS.ERROR);
      setLastResult({ success: false, message: error.message });
    } finally {
      setIsTriggering(false);
    }
  }, [updateSyncStatus]);

  const isSyncing = syncStatus === SYNC_STATUS.SYNCING || isTriggering;
  const hasError = syncStatus === SYNC_STATUS.ERROR;
  const hasPending = pendingSyncCount > 0;

  // Determine button state
  const getButtonConfig = () => {
    if (isOffline) {
      return {
        disabled: true,
        text: "Offline",
        subtext: hasPending ? `${pendingSyncCount} pending` : null,
        bgColor: colors.neutral[300],
        textColor: colors.neutral[500],
      };
    }

    if (isSyncing) {
      return {
        disabled: true,
        text: "Syncing...",
        subtext: `${pendingSyncCount} remaining`,
        bgColor: colors.primary[500],
        textColor: colors.neutral[0],
        showSpinner: true,
      };
    }

    if (hasError) {
      return {
        disabled: false,
        text: "Retry Sync",
        subtext: "Some items failed",
        bgColor: colors.error[500],
        textColor: colors.neutral[0],
        onPress: handleRetry,
      };
    }

    if (hasPending) {
      return {
        disabled: false,
        text: "Sync Now",
        subtext: `${pendingSyncCount} items`,
        bgColor: variant === "primary" ? colors.primary[500] : colors.neutral[100],
        textColor: variant === "primary" ? colors.neutral[0] : colors.primary[600],
        onPress: handleSync,
      };
    }

    return {
      disabled: true,
      text: "All Synced",
      subtext: null,
      bgColor: colors.success[100],
      textColor: colors.success[700],
    };
  };

  const config = getButtonConfig();

  return (
    <View style={style}>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: config.bgColor }]}
        onPress={config.onPress || handleSync}
        disabled={config.disabled}
        activeOpacity={0.7}
      >
        <View style={styles.buttonContent}>
          {config.showSpinner && (
            <ActivityIndicator size="small" color={config.textColor} style={styles.spinner} />
          )}
          <Text style={[styles.buttonText, { color: config.textColor }]}>{config.text}</Text>
        </View>
        {showDetails && config.subtext && (
          <Text style={[styles.subtextInline, { color: config.textColor }]}>{config.subtext}</Text>
        )}
      </TouchableOpacity>

      {lastResult && showDetails && (
        <View
          style={[
            styles.resultBadge,
            { backgroundColor: lastResult.success ? colors.success[50] : colors.error[50] },
          ]}
        >
          <Text
            style={[
              styles.resultText,
              { color: lastResult.success ? colors.success[700] : colors.error[700] },
            ]}
          >
            {lastResult.message}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  spinner: {
    marginRight: spacing.xs,
  },
  buttonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  subtextInline: {
    fontSize: typography.fontSize.xs,
    marginLeft: spacing.sm,
    opacity: 0.8,
  },
  resultBadge: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignSelf: "center",
  },
  resultText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
});
