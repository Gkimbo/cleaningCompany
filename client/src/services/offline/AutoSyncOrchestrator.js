/**
 * AutoSyncOrchestrator - Coordinates automatic sync when connectivity is restored
 *
 * Responsibilities:
 * - Trigger sync when device comes back online
 * - Coordinate sync and preload with cooldowns to prevent spam
 * - Handle errors with retry logic
 * - Notify listeners of progress
 */

import SyncEngine from "./SyncEngine";
import OfflineManager from "./OfflineManager";
import NetworkMonitor from "./NetworkMonitor";
import { AUTO_SYNC_COOLDOWN_MS, MAX_AUTO_RETRY_ATTEMPTS, getRetryDelay } from "./constants";

// Maximum listeners to prevent memory leaks from runaway subscriptions
const MAX_LISTENERS = 50;

class AutoSyncOrchestrator {
  constructor() {
    this._authToken = null;
    this._lastSyncAttempt = 0;
    this._autoRetryCount = 0;
    this._retryTimeout = null;
    this._listeners = new Set();
    this._isAutoSyncing = false;
    this._destroyed = false; // Flag to prevent operations after destroy
    this._generation = 0; // Incremented on destroy to invalidate pending callbacks
  }

  /**
   * Set auth token for sync operations
   */
  setAuthToken(token) {
    this._authToken = token;
    SyncEngine.setAuthToken(token);
    OfflineManager.setAuthToken(token);
  }

  /**
   * Subscribe to orchestrator events
   * Events: sync_started, sync_completed, sync_error, sync_retry_scheduled, sync_gave_up
   */
  subscribe(listener) {
    // Guard against too many listeners (memory leak protection)
    if (this._listeners.size >= MAX_LISTENERS) {
      console.warn(`[AutoSyncOrchestrator] Max listeners (${MAX_LISTENERS}) reached. Subscription rejected.`);
      // Return a no-op unsubscribe function
      return () => {};
    }
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Notify all listeners of an event
   */
  _notify(event) {
    // Don't notify if destroyed
    if (this._destroyed) return;

    // Collect failed listeners to remove AFTER iteration (avoid mutation during iteration)
    const listenersToRemove = [];

    this._listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("[AutoSyncOrchestrator] Listener error:", error);
        // If listener throws, it's likely from an unmounted component - mark for removal
        listenersToRemove.push(listener);
      }
    });

    // Remove failed listeners after iteration completes
    for (const listener of listenersToRemove) {
      this._listeners.delete(listener);
    }
  }

  /**
   * Check if cooldown period has elapsed
   */
  _canSync() {
    const now = Date.now();
    return now - this._lastSyncAttempt >= AUTO_SYNC_COOLDOWN_MS;
  }

  /**
   * Handle connectivity restored event - main entry point
   */
  async onConnectivityRestored() {
    console.log("[AutoSyncOrchestrator] Connectivity restored");

    // Check if destroyed
    if (this._destroyed) {
      console.log("[AutoSyncOrchestrator] Orchestrator destroyed, skipping");
      return { skipped: true, reason: "destroyed" };
    }

    // Check cooldown
    if (!this._canSync()) {
      console.log("[AutoSyncOrchestrator] In cooldown period, skipping");
      return { skipped: true, reason: "cooldown" };
    }

    // Check if already syncing
    if (this._isAutoSyncing || SyncEngine.isSyncing) {
      console.log("[AutoSyncOrchestrator] Already syncing, skipping");
      return { skipped: true, reason: "already_syncing" };
    }

    // Check auth token
    if (!this._authToken) {
      console.log("[AutoSyncOrchestrator] No auth token, skipping");
      return { skipped: true, reason: "no_auth" };
    }

    // Reset retry count on new connectivity event
    this._autoRetryCount = 0;

    return this._performAutoSync();
  }

  /**
   * Perform the auto-sync sequence
   */
  async _performAutoSync() {
    // Don't sync if destroyed
    if (this._destroyed) {
      console.log("[AutoSyncOrchestrator] Sync cancelled - orchestrator destroyed");
      return { skipped: true, reason: "destroyed" };
    }

    this._isAutoSyncing = true;
    this._lastSyncAttempt = Date.now();

    this._notify({ type: "sync_started" });

    try {
      // Step 1: Sync pending operations
      console.log("[AutoSyncOrchestrator] Starting sync of pending operations");
      const syncResult = await SyncEngine.startSync();

      if (!syncResult.success && syncResult.reason !== "offline" && syncResult.reason !== "no_pending") {
        throw new Error(syncResult.error || syncResult.reason || "Sync failed");
      }

      // Step 2: Preload fresh job data
      console.log("[AutoSyncOrchestrator] Starting job preload");
      if (!OfflineManager._preloadInProgress) {
        await OfflineManager.preloadJobs();
      }

      // Success
      this._autoRetryCount = 0;
      this._notify({
        type: "sync_completed",
        syncedCount: syncResult.synced || 0,
        errors: syncResult.errors || [],
      });

      console.log("[AutoSyncOrchestrator] Auto-sync completed successfully");
      return { success: true, synced: syncResult.synced || 0 };
    } catch (error) {
      console.error("[AutoSyncOrchestrator] Auto-sync error:", error);

      this._notify({
        type: "sync_error",
        error: error.message,
      });

      // Schedule retry if under max attempts
      if (this._autoRetryCount < MAX_AUTO_RETRY_ATTEMPTS) {
        this._scheduleRetry();
      } else {
        // Get pending count for the notification
        let pendingCount = 0;
        try {
          pendingCount = await OfflineManager.getPendingSyncCount();
        } catch (e) {
          console.error("[AutoSyncOrchestrator] Failed to get pending count:", e);
        }
        this._notify({ type: "sync_gave_up", pendingCount });
      }

      return { success: false, error: error.message };
    } finally {
      this._isAutoSyncing = false;
    }
  }

  /**
   * Schedule a retry with exponential backoff
   */
  _scheduleRetry() {
    this._autoRetryCount++;
    const delay = getRetryDelay(this._autoRetryCount);

    console.log(`[AutoSyncOrchestrator] Scheduling retry #${this._autoRetryCount} in ${delay}ms`);

    this._notify({
      type: "sync_retry_scheduled",
      attempt: this._autoRetryCount,
      delay,
    });

    // Clear any existing timeout
    if (this._retryTimeout) {
      clearTimeout(this._retryTimeout);
    }

    // Capture current generation to detect if destroyed during timeout
    const scheduledGeneration = this._generation;

    this._retryTimeout = setTimeout(async () => {
      // Don't retry if destroyed or generation changed (more robust than just checking _destroyed)
      if (this._destroyed || this._generation !== scheduledGeneration) {
        console.log("[AutoSyncOrchestrator] Retry cancelled - orchestrator destroyed or reset");
        return;
      }
      if (NetworkMonitor.isOnline) {
        try {
          await this._performAutoSync();
        } catch (error) {
          // Catch any unhandled errors to prevent unhandled promise rejection
          // The error is already logged inside _performAutoSync, but we catch here
          // in case _performAutoSync itself throws unexpectedly (e.g., if destroyed mid-sync)
          console.error("[AutoSyncOrchestrator] Scheduled retry failed unexpectedly:", error);
        }
      }
    }, delay);
  }

  /**
   * Cancel any pending retry
   */
  cancelPendingRetry() {
    if (this._retryTimeout) {
      clearTimeout(this._retryTimeout);
      this._retryTimeout = null;
    }
    this._autoRetryCount = 0;
  }

  /**
   * Manual trigger (bypasses cooldown)
   */
  async triggerManualSync() {
    this._lastSyncAttempt = 0; // Reset cooldown
    this._autoRetryCount = 0;
    return this.onConnectivityRestored();
  }

  /**
   * Get current orchestrator state
   */
  getState() {
    return {
      isAutoSyncing: this._isAutoSyncing,
      lastSyncAttempt: this._lastSyncAttempt,
      autoRetryCount: this._autoRetryCount,
      canSync: this._canSync(),
      hasAuthToken: !!this._authToken,
    };
  }

  /**
   * Cleanup - cancels pending retries and signals any in-progress sync to stop
   */
  destroy() {
    this._destroyed = true; // Set flag first to prevent any new operations
    this._generation++; // Invalidate any pending callbacks
    this.cancelPendingRetry();

    // If sync is in progress, signal it to stop gracefully
    if (this._isAutoSyncing && SyncEngine._abortController) {
      console.log("[AutoSyncOrchestrator] Aborting in-progress sync during destroy");
      SyncEngine._abortController.abort();
    }

    this._listeners.clear();
    this._isAutoSyncing = false;
  }

  /**
   * Reset destroyed state (for re-initialization)
   */
  reset() {
    this._destroyed = false;
    this._generation++; // Invalidate any stale callbacks from before reset
    this._authToken = null;
    this._lastSyncAttempt = 0;
    this._autoRetryCount = 0;
    this._isAutoSyncing = false;
  }
}

// Export singleton
export default new AutoSyncOrchestrator();
