/**
 * BackgroundSync - Background fetch integration for offline sync
 *
 * Registers background tasks to sync data when the app is not active.
 */

import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import SyncEngine from "./SyncEngine";
import NetworkMonitor from "./NetworkMonitor";
import OfflineManager from "./OfflineManager";
import AutoSyncOrchestrator from "./AutoSyncOrchestrator";
import {
  BACKGROUND_SYNC_TASK,
  BACKGROUND_FETCH_TASK,
  BACKGROUND_FETCH_INTERVAL_MS,
} from "./constants";

// Define the background sync task
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    console.log("[BackgroundSync] Starting background sync task");

    // Check if online
    await NetworkMonitor.refresh();
    if (!NetworkMonitor.isOnline) {
      console.log("[BackgroundSync] Offline, skipping sync");
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Run sync
    const result = await SyncEngine.startSync();

    if (result.success && result.synced > 0) {
      console.log(`[BackgroundSync] Synced ${result.synced} operations`);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error("[BackgroundSync] Task error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Define the background fetch task (for preloading)
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log("[BackgroundFetch] Starting background fetch task");

    // Check if online
    await NetworkMonitor.refresh();
    if (!NetworkMonitor.isOnline) {
      console.log("[BackgroundFetch] Offline, skipping fetch");
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Preload jobs
    await OfflineManager.preloadJobs();

    console.log("[BackgroundFetch] Preload complete");
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("[BackgroundFetch] Task error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

class BackgroundSync {
  constructor() {
    this._registered = false;
  }

  /**
   * Register background tasks
   */
  async register() {
    if (this._registered) return;

    try {
      // Check if background fetch is available
      const status = await BackgroundFetch.getStatusAsync();

      if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
        console.warn("[BackgroundSync] Background fetch is restricted");
        return false;
      }

      if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
        console.warn("[BackgroundSync] Background fetch is denied");
        return false;
      }

      // Register sync task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: BACKGROUND_FETCH_INTERVAL_MS / 1000, // In seconds
        stopOnTerminate: false,
        startOnBoot: true,
      });

      // Register fetch task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: BACKGROUND_FETCH_INTERVAL_MS / 1000,
        stopOnTerminate: false,
        startOnBoot: true,
      });

      this._registered = true;
      console.log("[BackgroundSync] Tasks registered successfully");
      return true;
    } catch (error) {
      console.error("[BackgroundSync] Registration error:", error);
      return false;
    }
  }

  /**
   * Unregister background tasks
   */
  async unregister() {
    try {
      const syncRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
      if (syncRegistered) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      }

      const fetchRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
      if (fetchRegistered) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      }

      this._registered = false;
      console.log("[BackgroundSync] Tasks unregistered");
      return true;
    } catch (error) {
      console.error("[BackgroundSync] Unregistration error:", error);
      return false;
    }
  }

  /**
   * Check if tasks are registered
   */
  async isRegistered() {
    const syncRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    const fetchRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    return syncRegistered && fetchRegistered;
  }

  /**
   * Trigger immediate sync (when app comes to foreground)
   * Uses AutoSyncOrchestrator for consistent cooldown/retry behavior
   */
  async triggerImmediateSync() {
    if (!NetworkMonitor.isOnline) return { success: false, reason: "offline" };

    // Use orchestrator for cooldown and retry logic consistency
    return await AutoSyncOrchestrator.onConnectivityRestored();
  }

  /**
   * Get background fetch status
   */
  async getStatus() {
    const status = await BackgroundFetch.getStatusAsync();
    const registered = await this.isRegistered();

    return {
      available: status === BackgroundFetch.BackgroundFetchStatus.Available,
      restricted: status === BackgroundFetch.BackgroundFetchStatus.Restricted,
      denied: status === BackgroundFetch.BackgroundFetchStatus.Denied,
      registered,
    };
  }
}

// Export singleton
export default new BackgroundSync();
