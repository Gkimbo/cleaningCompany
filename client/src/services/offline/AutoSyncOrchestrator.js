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

class AutoSyncOrchestrator {
  constructor() {
    this._authToken = null;
    this._lastSyncAttempt = 0;
    this._autoRetryCount = 0;
    this._retryTimeout = null;
    this._listeners = new Set();
    this._isAutoSyncing = false;
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
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Notify all listeners of an event
   */
  _notify(event) {
    this._listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("[AutoSyncOrchestrator] Listener error:", error);
      }
    });
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
        this._notify({ type: "sync_gave_up" });
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

    this._retryTimeout = setTimeout(async () => {
      // Only retry if still online
      if (NetworkMonitor.isOnline) {
        await this._performAutoSync();
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
   * Cleanup
   */
  destroy() {
    this.cancelPendingRetry();
    this._listeners.clear();
  }
}

// Export singleton
export default new AutoSyncOrchestrator();
