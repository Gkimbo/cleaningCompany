import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from "react-native";
import { useNavigate } from "react-router-native";
import { useOffline } from "../../services/offline/OfflineContext";
import StorageManager from "../../services/offline/StorageManager";
import SyncEngine from "../../services/offline/SyncEngine";
import PhotoStorage from "../../services/offline/PhotoStorage";
import { colors, spacing, typography, radius, shadows } from "../../services/styles/theme";
import {
  MIN_FREE_SPACE_BYTES,
  STORAGE_WARNING_THRESHOLD,
  SYNC_STATUS,
} from "../../services/offline/constants";
import { isOfflineAvailable } from "../../services/offline/database";

// Check interval (check every 2 minutes)
const STORAGE_CHECK_INTERVAL_MS = 2 * 60 * 1000;

/**
 * LowStorageWarning - Shows warnings when device storage is running low
 *
 * Displays banners at different warning levels:
 * - Warning: Under 100MB free space
 * - Critical: Under 50MB free space (can't save new photos)
 *
 * Prompts users to sync and/or clear offline data.
 */
export default function LowStorageWarning() {
  const navigate = useNavigate();
  const { isOnline, updateSyncStatus, pendingSyncCount } = useOffline();
  const [warningLevel, setWarningLevel] = useState(null); // 'warning' | 'critical'
  const [storageInfo, setStorageInfo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  // Check storage space
  const checkStorage = useCallback(async () => {
    if (!isOfflineAvailable) return;

    try {
      const info = await PhotoStorage.checkStorageSpace();
      setStorageInfo(info);

      if (info.checkFailed) {
        // Storage check failed - don't show warning (avoid false alarms)
        setWarningLevel(null);
        return;
      }

      if (info.freeBytes < MIN_FREE_SPACE_BYTES) {
        setWarningLevel("critical");
        setShowModal(true);
      } else if (info.freeBytes < STORAGE_WARNING_THRESHOLD) {
        setWarningLevel("warning");
      } else {
        setWarningLevel(null);
        setShowModal(false);
      }
    } catch (error) {
      console.error("[LowStorageWarning] Failed to check storage:", error);
      setWarningLevel(null);
    }
  }, []);

  // Check storage periodically
  useEffect(() => {
    if (!isOfflineAvailable) return;

    checkStorage();
    const interval = setInterval(checkStorage, STORAGE_CHECK_INTERVAL_MS);

    // Also subscribe to StorageManager updates
    const unsubscribe = StorageManager.subscribe(() => {
      checkStorage();
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [checkStorage]);

  // Re-check after coming online (user might have synced)
  useEffect(() => {
    if (isOnline) {
      // Delay check to allow sync to complete
      const timeout = setTimeout(checkStorage, 5000);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, checkStorage]);

  const handleSyncAttempt = useCallback(async () => {
    if (!isOnline) return;

    setIsSyncing(true);
    updateSyncStatus(SYNC_STATUS.SYNCING);

    try {
      const result = await SyncEngine.startSync();
      if (result.success) {
        updateSyncStatus(SYNC_STATUS.COMPLETED);
        // Run cleanup after successful sync
        await StorageManager.runCleanup();
        // Re-check storage
        await checkStorage();
      } else {
        updateSyncStatus(SYNC_STATUS.ERROR);
      }
    } catch (error) {
      console.error("[LowStorageWarning] Sync attempt failed:", error);
      updateSyncStatus(SYNC_STATUS.ERROR);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, updateSyncStatus, checkStorage]);

  const handleCleanup = useCallback(async () => {
    setIsCleaningUp(true);
    setCleanupResult(null);

    try {
      const result = await StorageManager.runCleanup();
      const totalCleaned =
        (result.cleanedJobs || 0) +
        (result.cleanedPhotos || 0) +
        (result.cleanedSyncQueue || 0) +
        (result.cleanedConflicts || 0);

      setCleanupResult({
        success: true,
        message: totalCleaned > 0
          ? `Cleaned ${totalCleaned} items`
          : "No items to clean up",
      });

      // Re-check storage
      await checkStorage();
    } catch (error) {
      console.error("[LowStorageWarning] Cleanup failed:", error);
      setCleanupResult({
        success: false,
        message: "Cleanup failed",
      });
    } finally {
      setIsCleaningUp(false);
    }
  }, [checkStorage]);

  const handleGoToSettings = useCallback(() => {
    setShowModal(false);
    navigate("/account-settings");
  }, [navigate]);

  const handleDismissModal = useCallback(() => {
    setShowModal(false);
    setCleanupResult(null);
  }, []);

  // Don't show if offline mode not available or no warning
  if (!isOfflineAvailable || !warningLevel) {
    return null;
  }

  const getWarningConfig = () => {
    switch (warningLevel) {
      case "critical":
        return {
          backgroundColor: colors.error[500],
          title: "Storage Critical",
          message: `Only ${storageInfo?.formattedFree || "low space"} free - Cannot save new photos`,
          urgent: true,
        };
      case "warning":
        return {
          backgroundColor: colors.warning[500],
          title: "Low Storage",
          message: `${storageInfo?.formattedFree || "Limited space"} free - Sync soon to free up space`,
          urgent: false,
        };
      default:
        return null;
    }
  };

  const config = getWarningConfig();
  if (!config) return null;

  return (
    <>
      {/* Banner */}
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: config.backgroundColor }]}
        onPress={() => setShowModal(true)}
        activeOpacity={0.8}
      >
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle}>{config.title}</Text>
          <Text style={styles.bannerMessage}>{config.message}</Text>
        </View>
        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>Tap for options</Text>
        </View>
      </TouchableOpacity>

      {/* Modal with options */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={handleDismissModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[
                styles.modalTitle,
                warningLevel === "critical" && styles.modalTitleCritical,
              ]}>
                {warningLevel === "critical" ? "Storage Full" : "Low Storage Warning"}
              </Text>
            </View>

            <Text style={styles.modalBody}>
              {warningLevel === "critical"
                ? `Your device only has ${storageInfo?.formattedFree || "very little"} storage remaining. You won't be able to take new photos until you free up space.`
                : `Your device is running low on storage (${storageInfo?.formattedFree || "limited"} free). Consider syncing and clearing old data to prevent issues.`}
            </Text>

            {pendingSyncCount > 0 && (
              <View style={styles.pendingInfo}>
                <Text style={styles.pendingInfoText}>
                  {pendingSyncCount} {pendingSyncCount === 1 ? "item" : "items"} waiting to sync
                </Text>
              </View>
            )}

            {/* Cleanup result */}
            {cleanupResult && (
              <View style={[
                styles.resultBadge,
                cleanupResult.success ? styles.resultSuccess : styles.resultError,
              ]}>
                <Text style={[
                  styles.resultText,
                  cleanupResult.success ? styles.resultTextSuccess : styles.resultTextError,
                ]}>
                  {cleanupResult.message}
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              {/* Sync button - only if online and has pending items */}
              {isOnline && pendingSyncCount > 0 && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.primaryButton]}
                  onPress={handleSyncAttempt}
                  disabled={isSyncing || isCleaningUp}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color={colors.neutral[0]} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Sync Now</Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Cleanup button */}
              <TouchableOpacity
                style={[styles.modalButton, styles.secondaryButton]}
                onPress={handleCleanup}
                disabled={isSyncing || isCleaningUp}
              >
                {isCleaningUp ? (
                  <ActivityIndicator size="small" color={colors.primary[600]} />
                ) : (
                  <Text style={styles.secondaryButtonText}>Clean Up Old Data</Text>
                )}
              </TouchableOpacity>

              {/* Settings button */}
              <TouchableOpacity
                style={[styles.modalButton, styles.tertiaryButton]}
                onPress={handleGoToSettings}
                disabled={isSyncing || isCleaningUp}
              >
                <Text style={styles.tertiaryButtonText}>Clear All Offline Data</Text>
              </TouchableOpacity>

              {/* Dismiss */}
              <TouchableOpacity
                style={[styles.modalButton, styles.dismissButton]}
                onPress={handleDismissModal}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>

            {!isOnline && (
              <Text style={styles.offlineNote}>
                Connect to the internet to sync your data
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  bannerMessage: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.xs,
    opacity: 0.9,
    marginTop: 2,
  },
  tapHint: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
  tapHintText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 400,
    ...shadows.lg,
  },
  modalHeader: {
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[600],
    textAlign: "center",
  },
  modalTitleCritical: {
    color: colors.error[600],
  },
  modalBody: {
    fontSize: typography.fontSize.md,
    color: colors.neutral[700],
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  pendingInfo: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  pendingInfoText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
    textAlign: "center",
  },
  resultBadge: {
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  resultSuccess: {
    backgroundColor: colors.success[50],
  },
  resultError: {
    backgroundColor: colors.error[50],
  },
  resultText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    textAlign: "center",
  },
  resultTextSuccess: {
    color: colors.success[700],
  },
  resultTextError: {
    color: colors.error[700],
  },
  modalActions: {
    gap: spacing.sm,
  },
  modalButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primaryButton: {
    backgroundColor: colors.primary[500],
  },
  primaryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  secondaryButton: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  secondaryButtonText: {
    color: colors.primary[700],
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
  },
  tertiaryButton: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  tertiaryButtonText: {
    color: colors.error[700],
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
  },
  dismissButton: {
    backgroundColor: colors.neutral[100],
  },
  dismissButtonText: {
    color: colors.neutral[600],
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
  },
  offlineNote: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
    textAlign: "center",
    marginTop: spacing.md,
    fontStyle: "italic",
  },
});
