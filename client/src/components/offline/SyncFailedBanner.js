import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSyncStatus, useNetworkStatus as useNetworkStatusHook } from "../../services/offline/OfflineContext";
import SyncEngine from "../../services/offline/SyncEngine";
import { AutoSyncOrchestrator } from "../../services/offline";
import { colors, spacing, typography, radius, shadows } from "../../services/styles/theme";
import { SYNC_STATUS } from "../../services/offline/constants";

/**
 * SyncFailedBanner - Shows when auto-sync has given up after multiple attempts
 *
 * Displays a prominent banner prompting the user to manually retry sync.
 * Automatically hides when sync succeeds or when dismissed.
 */
export default function SyncFailedBanner({ style }) {
  const { syncStatus, pendingSyncCount, updateSyncStatus } = useSyncStatus();
  const { isOffline } = useNetworkStatusHook();
  const [showBanner, setShowBanner] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const slideAnimRef = useRef(new Animated.Value(-100));
  const slideAnim = slideAnimRef.current;
  const isMountedRef = useRef(true);

  // Track mounted state to prevent memory leaks from async operations
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Stop any running animations to prevent memory leaks
      slideAnim.stopAnimation();
    };
  }, [slideAnim]);

  // Listen for sync_gave_up events from AutoSyncOrchestrator
  useEffect(() => {
    const handleAutoSyncEvent = (event) => {
      if (!isMountedRef.current) return;

      if (event.type === "sync_gave_up") {
        setFailedCount(event.pendingCount || 0);
        setShowBanner(true);
        // Animate banner sliding in
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 10,
        }).start();
      } else if (event.type === "sync_completed") {
        // Hide banner on successful sync
        hideBanner();
      }
    };

    const unsubscribe = AutoSyncOrchestrator.subscribe(handleAutoSyncEvent);
    return () => unsubscribe();
  }, [slideAnim, hideBanner]);

  // Check initial state for any stuck failed operations
  useEffect(() => {
    const checkFailedOperations = async () => {
      try {
        const summary = await SyncEngine.getPendingSummary();
        // Check if still mounted before setting state
        if (!isMountedRef.current) return;

        // Show banner if there are failed operations that can be retried
        if (summary.failedCount > 0 && summary.canRetryFailed) {
          setFailedCount(summary.failedCount);
          setShowBanner(true);
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      } catch (error) {
        console.error("Error checking failed operations:", error);
      }
    };

    // Only check if we're online (otherwise banner isn't helpful)
    if (!isOffline) {
      checkFailedOperations();
    }
  }, [isOffline, slideAnim]);

  const hideBanner = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      // Check mounted state before setting state in animation callback
      if (isMountedRef.current) {
        setShowBanner(false);
      }
    });
  }, [slideAnim]);

  const handleRetry = useCallback(async () => {
    if (isOffline) {
      return;
    }

    setIsRetrying(true);
    updateSyncStatus(SYNC_STATUS.SYNCING);

    try {
      // First try to retry failed operations
      const retryResult = await SyncEngine.retryFailed();

      // Check if still mounted after async operation
      if (!isMountedRef.current) return;

      if (retryResult.success || retryResult.retriedCount > 0) {
        // Now run a full sync to process the retried operations
        const syncResult = await SyncEngine.startSync();

        // Check if still mounted after async operation
        if (!isMountedRef.current) return;

        if (syncResult.success) {
          updateSyncStatus(SYNC_STATUS.COMPLETED);
          hideBanner();
        } else {
          updateSyncStatus(SYNC_STATUS.ERROR);
          // Update failed count
          const summary = await SyncEngine.getPendingSummary();
          if (isMountedRef.current) {
            setFailedCount(summary.failedCount);
          }
        }
      } else {
        updateSyncStatus(SYNC_STATUS.ERROR);
      }
    } catch (error) {
      console.error("Manual retry error:", error);
      if (isMountedRef.current) {
        updateSyncStatus(SYNC_STATUS.ERROR);
      }
    } finally {
      if (isMountedRef.current) {
        setIsRetrying(false);
      }
    }
  }, [isOffline, updateSyncStatus, hideBanner]);

  if (!showBanner || isOffline) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Feather name="alert-triangle" size={20} color={colors.warning[700]} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>Sync Failed</Text>
          <Text style={styles.message}>
            {failedCount > 0
              ? `${failedCount} item${failedCount > 1 ? "s" : ""} couldn't be synced.`
              : "Some data couldn't be synced."}
            {" "}Your work is saved locally.
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            disabled={isRetrying}
            activeOpacity={0.7}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color={colors.neutral[0]} />
            ) : (
              <>
                <Feather name="refresh-cw" size={14} color={colors.neutral[0]} />
                <Text style={styles.retryText}>Retry</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dismissButton}
            onPress={hideBanner}
            activeOpacity={0.7}
          >
            <Feather name="x" size={18} color={colors.neutral[500]} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.warning[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.warning[200],
    ...shadows.sm,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.warning[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
  },
  message: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.warning[600],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  retryText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[0],
  },
  dismissButton: {
    padding: spacing.xs,
  },
});
