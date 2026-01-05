import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { useOffline } from "../../services/offline/OfflineContext";
import SyncEngine from "../../services/offline/SyncEngine";
import { colors, spacing, typography, radius, shadows } from "../../services/styles/theme";
import { MAX_OFFLINE_DURATION_MS, SYNC_STATUS } from "../../services/offline/constants";

// Warning thresholds
const WARNING_THRESHOLD_MS = 36 * 60 * 60 * 1000; // 36 hours - show warning
const CRITICAL_THRESHOLD_MS = 44 * 60 * 60 * 1000; // 44 hours - show critical warning

/**
 * OfflineLimitWarning - Shows warnings when approaching 48-hour offline limit
 *
 * Displays banners at 36 hours, critical at 44 hours, and modal at 48 hours.
 */
export default function OfflineLimitWarning() {
  const { offlineSince, isOnline, getOfflineDuration, updateSyncStatus, pendingSyncCount } = useOffline();
  const [warningLevel, setWarningLevel] = useState(null); // 'warning' | 'critical' | 'exceeded'
  const [showModal, setShowModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check offline duration periodically
  useEffect(() => {
    if (!offlineSince || isOnline) {
      setWarningLevel(null);
      setShowModal(false);
      return;
    }

    const checkDuration = () => {
      const duration = getOfflineDuration();

      if (duration >= MAX_OFFLINE_DURATION_MS) {
        setWarningLevel("exceeded");
        setShowModal(true);
      } else if (duration >= CRITICAL_THRESHOLD_MS) {
        setWarningLevel("critical");
      } else if (duration >= WARNING_THRESHOLD_MS) {
        setWarningLevel("warning");
      } else {
        setWarningLevel(null);
      }
    };

    checkDuration();
    const interval = setInterval(checkDuration, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [offlineSince, isOnline, getOfflineDuration]);

  const formatTimeRemaining = useCallback(() => {
    const duration = getOfflineDuration();
    const remaining = MAX_OFFLINE_DURATION_MS - duration;

    if (remaining <= 0) return "Limit exceeded";

    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  }, [getOfflineDuration]);

  const handleSyncAttempt = useCallback(async () => {
    setIsSyncing(true);
    updateSyncStatus(SYNC_STATUS.SYNCING);

    try {
      const result = await SyncEngine.startSync();
      if (result.success) {
        updateSyncStatus(SYNC_STATUS.COMPLETED);
        setShowModal(false);
      } else {
        updateSyncStatus(SYNC_STATUS.ERROR);
      }
    } catch (error) {
      console.error("Sync attempt failed:", error);
      updateSyncStatus(SYNC_STATUS.ERROR);
    } finally {
      setIsSyncing(false);
    }
  }, [updateSyncStatus]);

  // Don't show if online or no offline time tracked
  if (!offlineSince || isOnline || !warningLevel) {
    return null;
  }

  const getWarningConfig = () => {
    switch (warningLevel) {
      case "exceeded":
        return {
          backgroundColor: colors.error[500],
          title: "Offline Limit Reached",
          message: "Please connect to sync your data. Some features may be limited.",
          urgent: true,
        };
      case "critical":
        return {
          backgroundColor: colors.error[400],
          title: "Sync Soon",
          message: `${formatTimeRemaining()} - Connect to avoid data sync issues`,
          urgent: true,
        };
      case "warning":
        return {
          backgroundColor: colors.warning[500],
          title: "Offline Mode",
          message: `${formatTimeRemaining()} until sync required`,
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
      <View style={[styles.banner, { backgroundColor: config.backgroundColor }]}>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle}>{config.title}</Text>
          <Text style={styles.bannerMessage}>{config.message}</Text>
        </View>
        {pendingSyncCount > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>{pendingSyncCount}</Text>
          </View>
        )}
      </View>

      {/* Modal for exceeded limit */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Offline Limit Exceeded</Text>
            </View>

            <Text style={styles.modalBody}>
              You have been offline for more than 48 hours. To ensure your work data is safely stored, please
              connect to the internet and sync your changes.
            </Text>

            {pendingSyncCount > 0 && (
              <View style={styles.pendingInfo}>
                <Text style={styles.pendingInfoText}>
                  {pendingSyncCount} {pendingSyncCount === 1 ? "change" : "changes"} waiting to sync
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.primaryButton]}
                onPress={handleSyncAttempt}
                disabled={isSyncing}
              >
                <Text style={styles.primaryButtonText}>{isSyncing ? "Syncing..." : "Try to Sync"}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalButton, styles.secondaryButton]} onPress={() => setShowModal(false)}>
                <Text style={styles.secondaryButtonText}>Continue Offline</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.warningNote}>
              Continuing offline may result in data conflicts when you eventually sync.
            </Text>
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
  pendingBadge: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
  pendingText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.error[600],
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
    color: colors.error[600],
    textAlign: "center",
  },
  modalBody: {
    fontSize: typography.fontSize.md,
    color: colors.neutral[700],
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  pendingInfo: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  pendingInfoText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
    textAlign: "center",
  },
  modalActions: {
    gap: spacing.sm,
  },
  modalButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
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
    backgroundColor: colors.neutral[100],
  },
  secondaryButtonText: {
    color: colors.neutral[700],
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
  },
  warningNote: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
    textAlign: "center",
    marginTop: spacing.md,
  },
});
