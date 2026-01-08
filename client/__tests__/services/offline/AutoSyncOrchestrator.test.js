/**
 * AutoSyncOrchestrator Tests
 *
 * Tests for the auto-sync orchestrator that handles automatic sync
 * when connectivity is restored.
 */

import { AUTO_SYNC_COOLDOWN_MS, MAX_AUTO_RETRY_ATTEMPTS, getRetryDelay } from "../../../src/services/offline/constants";

// Mock dependencies
jest.mock("../../../src/services/offline/SyncEngine", () => ({
  __esModule: true,
  default: {
    isSyncing: false,
    setAuthToken: jest.fn(),
    startSync: jest.fn(),
  },
}));

jest.mock("../../../src/services/offline/OfflineManager", () => ({
  __esModule: true,
  default: {
    _preloadInProgress: false,
    setAuthToken: jest.fn(),
    preloadJobs: jest.fn(),
  },
}));

jest.mock("../../../src/services/offline/NetworkMonitor", () => ({
  __esModule: true,
  default: {
    isOnline: true,
  },
}));

let AutoSyncOrchestrator;
let SyncEngine;
let OfflineManager;
let NetworkMonitor;

describe("AutoSyncOrchestrator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.useFakeTimers();

    // Re-require modules
    SyncEngine = require("../../../src/services/offline/SyncEngine").default;
    OfflineManager = require("../../../src/services/offline/OfflineManager").default;
    NetworkMonitor = require("../../../src/services/offline/NetworkMonitor").default;
    AutoSyncOrchestrator = require("../../../src/services/offline/AutoSyncOrchestrator").default;

    SyncEngine.startSync.mockResolvedValue({ success: true, synced: 5 });
    OfflineManager.preloadJobs.mockResolvedValue();
    NetworkMonitor.isOnline = true;
  });

  afterEach(() => {
    AutoSyncOrchestrator.destroy();
    jest.useRealTimers();
  });

  describe("setAuthToken", () => {
    it("should set token on both SyncEngine and OfflineManager", () => {
      AutoSyncOrchestrator.setAuthToken("test-token");

      expect(SyncEngine.setAuthToken).toHaveBeenCalledWith("test-token");
      expect(OfflineManager.setAuthToken).toHaveBeenCalledWith("test-token");
    });
  });

  describe("subscribe", () => {
    it("should allow subscribing to events", () => {
      const listener = jest.fn();

      const unsubscribe = AutoSyncOrchestrator.subscribe(listener);

      expect(typeof unsubscribe).toBe("function");
    });

    it("should call listeners when events occur", async () => {
      const listener = jest.fn();
      AutoSyncOrchestrator.subscribe(listener);
      AutoSyncOrchestrator.setAuthToken("test-token");

      await AutoSyncOrchestrator.onConnectivityRestored();

      expect(listener).toHaveBeenCalled();
    });

    it("should stop calling listener after unsubscribe", async () => {
      const listener = jest.fn();
      const unsubscribe = AutoSyncOrchestrator.subscribe(listener);
      AutoSyncOrchestrator.setAuthToken("test-token");

      unsubscribe();

      await AutoSyncOrchestrator.onConnectivityRestored();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("onConnectivityRestored", () => {
    it("should skip if no auth token", async () => {
      const result = await AutoSyncOrchestrator.onConnectivityRestored();

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("no_auth");
      expect(SyncEngine.startSync).not.toHaveBeenCalled();
    });

    it("should skip if already syncing", async () => {
      AutoSyncOrchestrator.setAuthToken("test-token");
      SyncEngine.isSyncing = true;

      const result = await AutoSyncOrchestrator.onConnectivityRestored();

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("already_syncing");

      SyncEngine.isSyncing = false;
    });

    it("should perform sync when conditions are met", async () => {
      AutoSyncOrchestrator.setAuthToken("test-token");

      const result = await AutoSyncOrchestrator.onConnectivityRestored();

      expect(result.success).toBe(true);
      expect(result.synced).toBe(5);
      expect(SyncEngine.startSync).toHaveBeenCalled();
    });

    it("should preload jobs after sync", async () => {
      AutoSyncOrchestrator.setAuthToken("test-token");

      await AutoSyncOrchestrator.onConnectivityRestored();

      expect(OfflineManager.preloadJobs).toHaveBeenCalled();
    });

    it("should skip preload if already in progress", async () => {
      AutoSyncOrchestrator.setAuthToken("test-token");
      OfflineManager._preloadInProgress = true;

      await AutoSyncOrchestrator.onConnectivityRestored();

      expect(OfflineManager.preloadJobs).not.toHaveBeenCalled();

      OfflineManager._preloadInProgress = false;
    });

    it("should notify listeners of sync_started event", async () => {
      const listener = jest.fn();
      AutoSyncOrchestrator.subscribe(listener);
      AutoSyncOrchestrator.setAuthToken("test-token");

      await AutoSyncOrchestrator.onConnectivityRestored();

      expect(listener).toHaveBeenCalledWith({ type: "sync_started" });
    });

    it("should notify listeners of sync_completed event", async () => {
      const listener = jest.fn();
      AutoSyncOrchestrator.subscribe(listener);
      AutoSyncOrchestrator.setAuthToken("test-token");

      await AutoSyncOrchestrator.onConnectivityRestored();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "sync_completed",
          syncedCount: 5,
        })
      );
    });
  });

  describe("cooldown", () => {
    it("should skip if within cooldown period", async () => {
      AutoSyncOrchestrator.setAuthToken("test-token");

      // First call succeeds
      await AutoSyncOrchestrator.onConnectivityRestored();

      // Second call within cooldown should skip
      const result = await AutoSyncOrchestrator.onConnectivityRestored();

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("cooldown");
    });

    it("should allow sync after cooldown period", async () => {
      AutoSyncOrchestrator.setAuthToken("test-token");

      // First call
      await AutoSyncOrchestrator.onConnectivityRestored();

      // Advance past cooldown
      jest.advanceTimersByTime(AUTO_SYNC_COOLDOWN_MS + 1000);

      // Should succeed now
      const result = await AutoSyncOrchestrator.onConnectivityRestored();

      expect(result.success).toBe(true);
    });
  });

  describe("retry logic", () => {
    it("should schedule retry on sync failure", async () => {
      const listener = jest.fn();
      AutoSyncOrchestrator.subscribe(listener);
      AutoSyncOrchestrator.setAuthToken("test-token");
      SyncEngine.startSync.mockRejectedValueOnce(new Error("Network error"));

      await AutoSyncOrchestrator.onConnectivityRestored();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "sync_retry_scheduled",
          attempt: 1,
        })
      );
    });

    it("should retry after delay", async () => {
      AutoSyncOrchestrator.setAuthToken("test-token");
      SyncEngine.startSync
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ success: true, synced: 3 });

      await AutoSyncOrchestrator.onConnectivityRestored();

      // Advance timers to trigger retry
      const retryDelay = getRetryDelay(1);
      jest.advanceTimersByTime(retryDelay);

      // Wait for retry to complete
      await Promise.resolve();

      expect(SyncEngine.startSync).toHaveBeenCalledTimes(2);
    });

    it("should not retry if offline", async () => {
      AutoSyncOrchestrator.setAuthToken("test-token");
      SyncEngine.startSync.mockRejectedValueOnce(new Error("Network error"));

      await AutoSyncOrchestrator.onConnectivityRestored();

      // Go offline
      NetworkMonitor.isOnline = false;

      // Advance timers
      const retryDelay = getRetryDelay(1);
      jest.advanceTimersByTime(retryDelay);
      await Promise.resolve();

      // Should only have been called once (initial attempt)
      expect(SyncEngine.startSync).toHaveBeenCalledTimes(1);
    });

    it("should give up after max attempts", async () => {
      const listener = jest.fn();
      AutoSyncOrchestrator.subscribe(listener);
      AutoSyncOrchestrator.setAuthToken("test-token");
      SyncEngine.startSync.mockRejectedValue(new Error("Persistent error"));

      // First attempt
      await AutoSyncOrchestrator.onConnectivityRestored();

      // Verify we got the first error and retry scheduled
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: "sync_error" }));
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: "sync_retry_scheduled", attempt: 1 }));

      // After MAX_AUTO_RETRY_ATTEMPTS, the orchestrator should give up
      // The first call was attempt 0, so we need to trigger 3 more retries to hit MAX (3)
      for (let i = 1; i <= MAX_AUTO_RETRY_ATTEMPTS; i++) {
        const delay = getRetryDelay(i);
        jest.advanceTimersByTime(delay);
        // Flush promises
        await Promise.resolve();
        await Promise.resolve();
      }

      expect(listener).toHaveBeenCalledWith({ type: "sync_gave_up" });
    }, 10000);
  });

  describe("cancelPendingRetry", () => {
    it("should cancel scheduled retry", async () => {
      AutoSyncOrchestrator.setAuthToken("test-token");
      SyncEngine.startSync.mockRejectedValueOnce(new Error("Network error"));

      await AutoSyncOrchestrator.onConnectivityRestored();

      // Cancel before retry fires
      AutoSyncOrchestrator.cancelPendingRetry();

      // Advance past retry delay
      jest.advanceTimersByTime(60000);
      await Promise.resolve();

      // Should only have initial call
      expect(SyncEngine.startSync).toHaveBeenCalledTimes(1);
    });

    it("should reset retry count", () => {
      AutoSyncOrchestrator.cancelPendingRetry();

      const state = AutoSyncOrchestrator.getState();
      expect(state.autoRetryCount).toBe(0);
    });
  });

  describe("triggerManualSync", () => {
    it("should bypass cooldown", async () => {
      AutoSyncOrchestrator.setAuthToken("test-token");

      // First auto sync
      await AutoSyncOrchestrator.onConnectivityRestored();

      // Manual sync should bypass cooldown
      const result = await AutoSyncOrchestrator.triggerManualSync();

      expect(result.success).toBe(true);
      expect(SyncEngine.startSync).toHaveBeenCalledTimes(2);
    });

    it("should reset retry count", async () => {
      AutoSyncOrchestrator.setAuthToken("test-token");

      await AutoSyncOrchestrator.triggerManualSync();

      const state = AutoSyncOrchestrator.getState();
      expect(state.autoRetryCount).toBe(0);
    });
  });

  describe("getState", () => {
    it("should return current orchestrator state", () => {
      AutoSyncOrchestrator.setAuthToken("test-token");

      const state = AutoSyncOrchestrator.getState();

      expect(state).toHaveProperty("isAutoSyncing");
      expect(state).toHaveProperty("lastSyncAttempt");
      expect(state).toHaveProperty("autoRetryCount");
      expect(state).toHaveProperty("canSync");
      expect(state).toHaveProperty("hasAuthToken");
      expect(state.hasAuthToken).toBe(true);
    });

    it("should reflect auth token status", () => {
      const stateBefore = AutoSyncOrchestrator.getState();
      expect(stateBefore.hasAuthToken).toBe(false);

      AutoSyncOrchestrator.setAuthToken("token");

      const stateAfter = AutoSyncOrchestrator.getState();
      expect(stateAfter.hasAuthToken).toBe(true);
    });
  });

  describe("destroy", () => {
    it("should cancel pending retries", async () => {
      AutoSyncOrchestrator.setAuthToken("test-token");
      SyncEngine.startSync.mockRejectedValueOnce(new Error("Error"));

      await AutoSyncOrchestrator.onConnectivityRestored();

      AutoSyncOrchestrator.destroy();

      const state = AutoSyncOrchestrator.getState();
      expect(state.autoRetryCount).toBe(0);
    });

    it("should clear all listeners", async () => {
      const listener = jest.fn();
      AutoSyncOrchestrator.subscribe(listener);
      AutoSyncOrchestrator.setAuthToken("test-token");

      AutoSyncOrchestrator.destroy();

      await AutoSyncOrchestrator.onConnectivityRestored();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle listener errors gracefully", async () => {
      const badListener = jest.fn().mockImplementation(() => {
        throw new Error("Listener error");
      });
      const goodListener = jest.fn();

      AutoSyncOrchestrator.subscribe(badListener);
      AutoSyncOrchestrator.subscribe(goodListener);
      AutoSyncOrchestrator.setAuthToken("test-token");

      // Should not throw
      await expect(AutoSyncOrchestrator.onConnectivityRestored()).resolves.toBeDefined();

      // Good listener should still be called
      expect(goodListener).toHaveBeenCalled();
    });

    it("should notify sync_error on failure", async () => {
      const listener = jest.fn();
      AutoSyncOrchestrator.subscribe(listener);
      AutoSyncOrchestrator.setAuthToken("test-token");
      SyncEngine.startSync.mockRejectedValueOnce(new Error("Sync failed"));

      await AutoSyncOrchestrator.onConnectivityRestored();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "sync_error",
          error: "Sync failed",
        })
      );
    });

    it("should handle sync returning failure without throwing", async () => {
      AutoSyncOrchestrator.setAuthToken("test-token");
      SyncEngine.startSync.mockResolvedValueOnce({
        success: false,
        reason: "offline",
      });

      const result = await AutoSyncOrchestrator.onConnectivityRestored();

      // Should not throw, just continue (offline is acceptable)
      expect(result.success).toBe(true);
    });
  });
});
