/**
 * SyncEngine - Handles syncing offline data to the server
 *
 * Processes sync queue operations in strict order with retry logic.
 * Detects and handles conflicts.
 */

import * as FileSystem from "expo-file-system/legacy";
import database, {
  syncQueueCollection,
  offlineJobsCollection,
  offlinePhotosCollection,
  syncConflictsCollection,
} from "./database";
import NetworkMonitor from "./NetworkMonitor";
import PhotoStorage from "./PhotoStorage";
import {
  SYNC_STATUS,
  SYNC_MAX_ATTEMPTS,
  getRetryDelay,
} from "./constants";
import { SYNC_OPERATION_TYPES, OPERATION_SEQUENCE, SYNC_STATUS as OP_STATUS } from "./database/models/SyncQueue";
import { CONFLICT_TYPES } from "./database/models/SyncConflict";
import { API_BASE } from "../config";
import AnalyticsService from "../AnalyticsService";

const baseURL = API_BASE.replace("/api/v1", "");

class SyncEngine {
  constructor() {
    this._syncing = false;
    this._syncLock = null; // Promise-based lock to prevent race conditions
    this._lockPending = false; // Flag to prevent TOCTOU race during lock acquisition
    this._lockAcquiredAt = null; // Timestamp when lock was acquired (for stuck detection)
    this._authToken = null;
    // Use Map to track listener metadata for cleanup (listener -> { addedAt, lastNotified })
    this._listenersMeta = new Map();
    this._maxListeners = 100; // Prevent memory leaks from runaway subscriptions
    this._listenerStaleThresholdMs = 5 * 60 * 1000; // 5 minutes - listeners not notified are likely stale
    this._currentProgress = {
      status: SYNC_STATUS.IDLE,
      totalOperations: 0,
      completedOperations: 0,
      currentOperation: null,
      errors: [],
    };
    this._initialized = false;
    this._abortSync = false; // Flag to abort sync when network is lost
    this._authExpired = false; // Flag to indicate auth token expired during sync
    this._networkUnsubscribe = null;
    this._abortController = null; // AbortController for cancelling in-flight requests
    this._offlineMessagingService = null; // Cached lazy import to avoid circular dependency
    this._retryTimeoutId = null; // Timer for scheduled retry
    this._nextRetryTime = null; // Timestamp of next scheduled retry
  }

  // For backwards compatibility - return Set-like interface
  get _listeners() {
    return {
      size: this._listenersMeta.size,
      add: (listener) => this._listenersMeta.set(listener, { addedAt: Date.now(), lastNotified: null }),
      delete: (listener) => this._listenersMeta.delete(listener),
      forEach: (callback) => this._listenersMeta.forEach((meta, listener) => callback(listener)),
      has: (listener) => this._listenersMeta.has(listener),
    };
  }

  // Check if response indicates auth token expired (401)
  _isAuthExpiredResponse(response) {
    return response.status === 401;
  }

  // Handle auth expired - sets flag and returns appropriate result
  _handleAuthExpired() {
    console.log("[SyncEngine] Auth token expired during sync");
    this._authExpired = true;
    this._abortSync = true; // Stop sync
    return { success: false, error: "Authentication expired", canContinue: false, authExpired: true };
  }

  // Robust network error detection - avoids fragile string matching
  _isNetworkError(error) {
    if (!error) return false;

    // AbortError from AbortController
    if (error.name === "AbortError") return true;

    // TypeError from fetch when network unavailable (standard behavior)
    if (error.name === "TypeError" && error.message) {
      // Common fetch network failure patterns across platforms
      const networkPatterns = [
        "network request failed",
        "failed to fetch",
        "networkerror",
        "network error",
        "load failed",
        "internet connection",
        "connection refused",
        "connection reset",
        "timeout",
        "econnrefused",
        "enotfound",
        "enetunreach",
      ];
      const lowerMessage = error.message.toLowerCase();
      return networkPatterns.some(pattern => lowerMessage.includes(pattern));
    }

    // Check error code if available (Node.js style errors)
    if (error.code) {
      const networkCodes = ["ECONNREFUSED", "ENOTFOUND", "ENETUNREACH", "ETIMEDOUT", "ECONNRESET"];
      return networkCodes.includes(error.code);
    }

    return false;
  }

  // Safely parse JSON from response body
  // Handles non-JSON error responses gracefully (e.g., HTML error pages)
  async _safeParseResponseJson(response, fallbackMessage = "Request failed") {
    try {
      return await response.json();
    } catch (parseError) {
      console.warn(
        `[SyncEngine] Server returned non-JSON response: ${response.status} ${response.statusText}`
      );
      return { error: `${fallbackMessage} (${response.status} ${response.statusText})` };
    }
  }

  // Acquire sync lock (prevents duplicate simultaneous syncs)
  // Uses synchronous flag check to prevent TOCTOU race condition
  async _acquireSyncLock() {
    // CRITICAL: The entire check-and-set must be synchronous (no awaits between check and set)
    // to be atomic in JavaScript's single-threaded event loop.

    // Safety check: detect corrupted lock state and attempt recovery
    // This can happen if a sync crashes without proper cleanup
    if (this._detectCorruptedLockState()) {
      console.warn("[SyncEngine] Detected corrupted lock state, attempting recovery");
      this._forceResetLockState();
    }

    // If already syncing or another caller is acquiring the lock, we must wait
    if (this._syncing || this._lockPending) {
      // Store the current lock promise to wait on
      const currentLock = this._syncLock;
      if (currentLock) {
        try {
          await currentLock;
        } catch (e) {
          // Previous sync threw, that's fine
        }
      }

      // CRITICAL: After await, we must do a fresh synchronous check-and-set
      // because another caller could have acquired the lock while we were waiting.
      // Fall through to the synchronous acquisition below.
    }

    // SYNCHRONOUS ATOMIC SECTION - no awaits allowed until lock is acquired
    // Check if someone else grabbed the lock while we were waiting
    if (this._syncing || this._lockPending) {
      return false; // Another caller won the race
    }

    // Atomically mark lock as pending (prevents other callers from entering)
    this._lockPending = true;

    // Create a new lock promise with safety checks
    // IMPORTANT: releaseLock must be captured synchronously during Promise construction
    let releaseLock;
    try {
      this._syncLock = new Promise((resolve) => {
        releaseLock = resolve;
      });

      // Safety check: ensure resolver was captured correctly
      if (typeof releaseLock !== "function") {
        console.error("[SyncEngine] Failed to capture lock resolver - this should never happen");
        this._lockPending = false;
        this._syncLock = null;
        return false;
      }

      this._syncLockRelease = releaseLock;
    } catch (lockError) {
      // If Promise creation fails (should never happen), clean up and return
      console.error("[SyncEngine] Lock creation failed:", lockError);
      this._lockPending = false;
      this._syncLock = null;
      this._syncLockRelease = null;
      return false;
    }

    // Set syncing flag atomically with lock acquisition
    this._syncing = true;
    this._lockPending = false;
    this._lockAcquiredAt = Date.now(); // Track when lock was acquired for timeout detection
    // END SYNCHRONOUS ATOMIC SECTION

    return true;
  }

  // Detect if lock state has become corrupted
  // Returns true if state is inconsistent and needs recovery
  _detectCorruptedLockState() {
    // Case 1: _syncing is true but _syncLockRelease is missing
    // This means the lock was acquired but release function was lost
    if (this._syncing && !this._syncLockRelease) {
      return true;
    }

    // Case 2: _lockPending is stuck true for too long (should be transient)
    // This indicates a crash during lock acquisition
    if (this._lockPending) {
      return true;
    }

    // Case 3: _syncing is true for way too long (stuck sync - 30 min timeout)
    const STUCK_SYNC_TIMEOUT_MS = 30 * 60 * 1000;
    if (this._syncing && this._lockAcquiredAt) {
      const lockAge = Date.now() - this._lockAcquiredAt;
      if (lockAge > STUCK_SYNC_TIMEOUT_MS) {
        console.error(`[SyncEngine] Lock held for ${lockAge}ms - likely stuck sync`);
        return true;
      }
    }

    return false;
  }

  // Force reset all lock state (use only for recovery from corruption)
  _forceResetLockState() {
    console.warn("[SyncEngine] Force resetting lock state");
    this._syncing = false;
    this._lockPending = false;
    this._lockAcquiredAt = null;
    if (this._syncLockRelease) {
      try {
        this._syncLockRelease();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this._syncLock = null;
    this._syncLockRelease = null;
  }

  // Release sync lock
  _releaseSyncLock() {
    this._lockAcquiredAt = null;
    if (this._syncLockRelease) {
      this._syncLockRelease();
      this._syncLock = null;
      this._syncLockRelease = null;
    }
  }

  // Schedule a retry sync after the specified delay
  // Cancels any existing scheduled retry to prevent duplicate syncs
  _scheduleRetry(delayMs) {
    // Cancel any existing scheduled retry
    this._cancelScheduledRetry();

    // Only schedule if we have a valid delay and are not currently syncing
    if (delayMs <= 0 || this._syncing) {
      return;
    }

    this._nextRetryTime = Date.now() + delayMs;
    this._retryTimeoutId = setTimeout(async () => {
      this._retryTimeoutId = null;
      this._nextRetryTime = null;

      // Only retry if online and not already syncing
      if (NetworkMonitor.isOnline && !this._syncing) {
        console.log("[SyncEngine] Executing scheduled retry sync");
        await this.startSync();
      }
    }, delayMs);

    console.log(`[SyncEngine] Retry scheduled in ${delayMs}ms`);
  }

  // Cancel any scheduled retry
  _cancelScheduledRetry() {
    if (this._retryTimeoutId) {
      clearTimeout(this._retryTimeoutId);
      this._retryTimeoutId = null;
      this._nextRetryTime = null;
    }
  }

  // Get info about next scheduled retry (for UI/debugging)
  getNextRetryInfo() {
    if (!this._nextRetryTime) {
      return null;
    }
    return {
      scheduledAt: this._nextRetryTime,
      delayMs: Math.max(0, this._nextRetryTime - Date.now()),
    };
  }

  // Set auth token for API calls
  setAuthToken(token) {
    this._authToken = token;
  }

  // Get the current abort signal for fetch requests
  // Ensures all requests have proper abort capability when syncing
  _getAbortSignal() {
    // If not actively syncing, no abort controller needed
    if (!this._syncing) {
      return undefined;
    }

    // Syncing but no controller - inconsistent state, create one
    // This can happen if state gets corrupted or on edge case recovery
    if (!this._abortController) {
      console.warn("[SyncEngine] Creating AbortController for in-progress sync (was missing)");
      this._abortController = new AbortController();
      // If we're supposed to be aborting, abort immediately
      if (this._abortSync) {
        this._abortController.abort();
      }
      return this._abortController.signal;
    }

    // If controller is already aborted
    if (this._abortController.signal.aborted) {
      // If abort was requested, return the aborted signal
      // This will cause fetch to reject immediately with AbortError
      // which is the correct behavior - we want to stop requests when aborting
      if (this._abortSync) {
        return this._abortController.signal;
      }

      // If abort was cleared (recovery scenario), create fresh controller
      console.log("[SyncEngine] Creating fresh AbortController for recovery");
      this._abortController = new AbortController();
      return this._abortController.signal;
    }

    return this._abortController.signal;
  }

  // Explicitly reset the abort controller (for recovery scenarios)
  _resetAbortController() {
    if (this._syncing) {
      this._abortController = new AbortController();
      this._abortSync = false;
    }
  }

  /**
   * Initialize sync engine and recover from interrupted syncs
   * Call this on app startup
   */
  async initialize() {
    if (this._initialized) return;

    try {
      // Check for interrupted operations (in_progress from previous session)
      await this._recoverInterruptedOperations();
      // Clean up any orphaned operations (jobs deleted while operations pending)
      await this._cleanupOrphanedOperations();
      this._initialized = true;
      console.log("[SyncEngine] Initialized and recovered interrupted operations");
    } catch (error) {
      console.error("[SyncEngine] Initialization error:", error);
      this._initialized = true; // Mark as initialized anyway to prevent blocking
    }
  }

  /**
   * Clean up operations whose jobs no longer exist
   * Marks them as failed so they don't accumulate in the queue
   * Uses atomic verification to prevent race conditions
   */
  async _cleanupOrphanedOperations() {
    const allOperations = await syncQueueCollection.query().fetch();
    const pendingOps = allOperations.filter(
      (op) => op.status === OP_STATUS.PENDING || op.status === OP_STATUS.IN_PROGRESS
    );

    if (pendingOps.length === 0) return;

    // Get all jobs to check which ones exist (initial check)
    const allJobs = await offlineJobsCollection.query().fetch();
    const jobIds = new Set(allJobs.map((j) => j.id));

    // Find potentially orphaned operations (job doesn't exist in initial check)
    const potentiallyOrphaned = pendingOps.filter((op) => !jobIds.has(op.jobId));

    if (potentiallyOrphaned.length === 0) return;

    console.log(`[SyncEngine] Found ${potentiallyOrphaned.length} potentially orphaned operations, verifying...`);

    let actuallyOrphaned = 0;
    let stillValid = 0;

    // Process each operation individually with atomic verification
    // This prevents race condition where job is created between initial check and update
    await database.write(async () => {
      for (const op of potentiallyOrphaned) {
        // CRITICAL: Re-verify job doesn't exist INSIDE the write block
        // This is atomic with respect to the update, preventing race conditions
        try {
          await offlineJobsCollection.find(op.jobId);
          // Job exists now (was created after our initial check) - skip
          stillValid++;
          continue;
        } catch {
          // Job doesn't exist - safe to mark as orphaned
        }

        // Also re-fetch the operation to ensure it wasn't already processed
        try {
          const freshOp = await syncQueueCollection.find(op.id);
          // Only update if still in pending/in_progress state
          if (freshOp.status === OP_STATUS.PENDING || freshOp.status === OP_STATUS.IN_PROGRESS) {
            await freshOp.update((o) => {
              o.status = OP_STATUS.FAILED;
              o._raw.failed_reason = "Job was deleted (cleanup)";
              o._raw.orphaned_at = Date.now();
            });
            actuallyOrphaned++;
          }
        } catch {
          // Operation was deleted, skip
        }
      }
    });

    if (actuallyOrphaned > 0 || stillValid > 0) {
      console.log(`[SyncEngine] Orphan cleanup: ${actuallyOrphaned} marked orphaned, ${stillValid} found valid (race avoided)`);
    }
  }

  /**
   * Recover operations that were interrupted (app killed during sync)
   * Tracks recovery count to detect repeated interruptions which may indicate issues
   * Circuit breaker: after MAX_RECOVERY_ATTEMPTS, mark as failed to prevent infinite loops
   */
  async _recoverInterruptedOperations() {
    const MAX_RECOVERY_ATTEMPTS = 5; // Circuit breaker limit
    const allOperations = await syncQueueCollection.query().fetch();
    const interruptedOps = allOperations.filter((op) => op.status === OP_STATUS.IN_PROGRESS);

    if (interruptedOps.length === 0) return;

    console.log(`[SyncEngine] Found ${interruptedOps.length} interrupted operations`);

    let recovered = 0;
    let failedDueToLimit = 0;

    await database.write(async () => {
      for (const op of interruptedOps) {
        const currentRecoveryCount = op._raw?.recovery_count || 0;
        const newRecoveryCount = currentRecoveryCount + 1;

        // Circuit breaker: if recovered too many times, mark as failed
        if (newRecoveryCount > MAX_RECOVERY_ATTEMPTS) {
          console.error(
            `[SyncEngine] Operation ${op.id} (${op.operationType}) exceeded max recovery attempts (${MAX_RECOVERY_ATTEMPTS}). ` +
            `Marking as failed to prevent infinite loop. Manual intervention may be required.`
          );
          await op.update((o) => {
            o.status = OP_STATUS.FAILED;
            o._raw.recovery_count = newRecoveryCount;
            o._raw.last_recovered_at = Date.now();
            o._raw.failed_reason = `Exceeded max recovery attempts (${MAX_RECOVERY_ATTEMPTS})`;
          });
          failedDueToLimit++;
          continue;
        }

        // Warn if operation has been recovered multiple times
        if (newRecoveryCount > 1) {
          console.warn(
            `[SyncEngine] Operation ${op.id} (${op.operationType}) recovered ${newRecoveryCount}/${MAX_RECOVERY_ATTEMPTS} times. ` +
            `May have been partially synced - verify server state.`
          );
        }

        // Reset to pending so they can be retried
        await op.update((o) => {
          o.status = OP_STATUS.PENDING;
          o._raw.recovery_count = newRecoveryCount;
          o._raw.last_recovered_at = Date.now();
          // Increment attempts on recovery to prevent unlimited retries
          o.attempts = (o.attempts || 0) + 1;
        });
        recovered++;
      }
    });

    // Log summary
    if (failedDueToLimit > 0) {
      console.error(
        `[SyncEngine] ${failedDueToLimit} operations failed due to exceeding recovery limit. ` +
        `These operations will not be retried automatically.`
      );
    }
    if (recovered > 0) {
      console.log(`[SyncEngine] Recovered ${recovered} interrupted operations`);
    }
  }

  /**
   * Check if there are operations that need to be synced
   */
  async hasPendingOperations() {
    const allOperations = await syncQueueCollection.query().fetch();
    return allOperations.some(
      (op) => op.status === OP_STATUS.PENDING || (op.status === OP_STATUS.FAILED && op.canRetry)
    );
  }

  /**
   * Get summary of pending operations for UI display
   */
  async getPendingSummary() {
    const allOperations = await syncQueueCollection.query().fetch();
    const pending = allOperations.filter((op) => op.status === OP_STATUS.PENDING);
    const failed = allOperations.filter((op) => op.status === OP_STATUS.FAILED);
    const completed = allOperations.filter((op) => op.status === OP_STATUS.COMPLETED);

    // Group by operation type
    const byType = {};
    pending.forEach((op) => {
      byType[op.operationType] = (byType[op.operationType] || 0) + 1;
    });

    return {
      pendingCount: pending.length,
      failedCount: failed.length,
      completedCount: completed.length,
      totalCount: allOperations.length,
      byType,
      canRetryFailed: failed.some((op) => op.canRetry),
    };
  }

  // Clean up stale listeners that haven't been notified recently
  // These are likely from unmounted components that forgot to unsubscribe
  _cleanupStaleListeners() {
    const now = Date.now();
    let cleanedCount = 0;

    this._listenersMeta.forEach((meta, listener) => {
      // A listener is stale if:
      // 1. It was added over threshold ago AND
      // 2. It was never notified OR last notified over threshold ago
      const age = now - meta.addedAt;
      const sinceLastNotified = meta.lastNotified ? now - meta.lastNotified : age;

      if (age > this._listenerStaleThresholdMs && sinceLastNotified > this._listenerStaleThresholdMs) {
        this._listenersMeta.delete(listener);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      console.warn(`[SyncEngine] Cleaned up ${cleanedCount} stale listeners (likely from unmounted components)`);
    }

    return cleanedCount;
  }

  // Subscribe to sync progress updates
  subscribe(listener) {
    // If at max capacity, try to clean up stale listeners first
    if (this._listenersMeta.size >= this._maxListeners) {
      const cleaned = this._cleanupStaleListeners();

      // Still at capacity after cleanup - reject new subscription
      if (this._listenersMeta.size >= this._maxListeners) {
        console.error(
          `[SyncEngine] Max listeners (${this._maxListeners}) reached even after cleanup. ` +
          `New subscription rejected. Ensure components unsubscribe on unmount.`
        );
        return () => {};
      }

      // Made room - log warning but allow subscription
      if (cleaned > 0) {
        console.log(`[SyncEngine] Made room for new listener after cleaning ${cleaned} stale listeners`);
      }
    }

    this._listenersMeta.set(listener, { addedAt: Date.now(), lastNotified: null });
    return () => this._listenersMeta.delete(listener);
  }

  // Notify listeners of progress changes
  _notifyListeners() {
    const now = Date.now();
    // Collect failed listeners to remove AFTER iteration (avoid mutation during iteration)
    const listenersToRemove = [];

    this._listenersMeta.forEach((meta, listener) => {
      try {
        listener({ ...this._currentProgress });
        // Update last notified time for stale listener detection
        meta.lastNotified = now;
      } catch (error) {
        console.error("[SyncEngine] Listener error:", error);
        // If listener throws, it's likely from an unmounted component - mark for removal
        listenersToRemove.push(listener);
      }
    });

    // Remove failed listeners after iteration completes
    for (const listener of listenersToRemove) {
      this._listenersMeta.delete(listener);
    }
  }

  // Update progress and notify
  _updateProgress(updates) {
    this._currentProgress = { ...this._currentProgress, ...updates };
    this._notifyListeners();
  }

  // Get current progress
  getProgress() {
    return { ...this._currentProgress };
  }

  // Start sync process
  async startSync() {
    // Cancel any scheduled retry since we're starting a sync now
    this._cancelScheduledRetry();

    // Proactively clean up stale listeners at sync start to prevent memory accumulation
    // This runs periodically (every sync) rather than only when at max capacity
    if (this._listenersMeta.size > 0) {
      this._cleanupStaleListeners();
    }

    // Use lock to prevent race conditions between simultaneous sync calls
    // _acquireSyncLock atomically sets _syncing = true
    const lockAcquired = await this._acquireSyncLock();
    if (!lockAcquired) {
      console.log("[SyncEngine] Sync already in progress (lock not acquired)");
      return { success: false, reason: "already_syncing" };
    }

    // At this point, lock is acquired and _syncing is true
    // Check preconditions and release lock if they fail
    if (!NetworkMonitor.isOnline) {
      console.log("[SyncEngine] Cannot sync - offline");
      this._syncing = false;
      this._releaseSyncLock();
      return { success: false, reason: "offline" };
    }

    if (!this._authToken) {
      console.log("[SyncEngine] Cannot sync - no auth token");
      this._syncing = false;
      this._releaseSyncLock();
      return { success: false, reason: "no_auth" };
    }

    this._abortSync = false;
    this._authExpired = false; // Reset auth expired flag
    this._abortController = new AbortController(); // Create abort controller for fetch requests
    this._updateProgress({ status: SYNC_STATUS.SYNCING, errors: [] });

    // Subscribe to network changes to detect if we lose connectivity mid-sync
    this._networkUnsubscribe = NetworkMonitor.subscribe((state) => {
      if (!state.isOnline && this._syncing) {
        console.log("[SyncEngine] Network lost during sync, aborting gracefully");
        this._abortSync = true;
        // Abort any in-flight fetch requests immediately
        if (this._abortController && !this._abortController.signal.aborted) {
          this._abortController.abort();
        }
      }
    });

    // Track sync start time for analytics
    const syncStartTime = Date.now();

    try {
      // Get all pending operations
      const allOperations = await syncQueueCollection.query().fetch();
      const pendingOps = allOperations.filter(
        (op) => op.status === OP_STATUS.PENDING || (op.status === OP_STATUS.FAILED && op.canRetry)
      );

      if (pendingOps.length === 0) {
        this._updateProgress({ status: SYNC_STATUS.COMPLETED, totalOperations: 0 });
        return { success: true, synced: 0 };
      }

      // Group by job and sort by sequence
      const jobOperations = this._groupAndSortOperations(pendingOps);

      this._updateProgress({
        totalOperations: pendingOps.length,
        completedOperations: 0,
      });

      let syncedCount = 0;
      const errors = [];
      let abortedDueToNetwork = false;

      // Process each job's operations in order
      for (const [jobId, operations] of Object.entries(jobOperations)) {
        // Check if we need to abort due to network loss
        if (this._abortSync) {
          console.log("[SyncEngine] Aborting sync due to network loss");
          abortedDueToNetwork = true;
          break;
        }

        const job = await this._getJob(jobId);
        if (!job) {
          // Job was deleted - mark all its operations as failed to prevent orphaned queue entries
          console.warn(`[SyncEngine] Job ${jobId} not found, marking ${operations.length} operations as orphaned`);
          await database.write(async () => {
            for (const op of operations) {
              await op.update((o) => {
                o.status = OP_STATUS.FAILED;
                o._raw.failed_reason = "Job was deleted locally";
                o._raw.orphaned_at = Date.now();
              });
            }
          });
          errors.push({ jobId, error: "Job deleted locally", orphaned: true, operationCount: operations.length });
          continue;
        }

        // Check for conflicts before syncing
        const conflict = await this._checkForConflicts(job);
        if (conflict) {
          // Network errors - stop sync for retry later
          if (conflict.type === "NETWORK_ERROR" && conflict.shouldRetry) {
            console.log("[SyncEngine] Network error during conflict check, stopping for retry");
            errors.push({ jobId, error: conflict.summary, networkError: true });
            abortedDueToNetwork = true;
            break;
          }
          // Server errors should stop sync entirely for retry later
          if (conflict.type === "SERVER_ERROR" && conflict.shouldRetry) {
            console.log("[SyncEngine] Server error during conflict check, stopping for retry");
            errors.push({ jobId, error: conflict.summary, serverError: true });
            abortedDueToNetwork = true; // Treat like network error - retry later
            break;
          }
          // Aborted - stop sync immediately
          if (conflict.type === "ABORTED") {
            console.log("[SyncEngine] Conflict check aborted, stopping sync");
            abortedDueToNetwork = true;
            break;
          }
          // Auth expired - stop sync
          if (conflict.type === "AUTH_EXPIRED") {
            errors.push({ jobId, error: conflict.summary });
            break;
          }
          // Other conflicts - skip this job but continue with others
          errors.push({ jobId, error: conflict.summary });
          continue;
        }

        // Process operations in sequence order
        for (const operation of operations) {
          // Check network before each operation
          if (this._abortSync || !NetworkMonitor.isOnline) {
            console.log("[SyncEngine] Network lost, stopping sync gracefully");
            abortedDueToNetwork = true;
            break;
          }

          this._updateProgress({ currentOperation: operation.operationType });

          const result = await this._processOperation(operation, job);

          if (result.success) {
            syncedCount++;
            this._updateProgress({
              completedOperations: this._currentProgress.completedOperations + 1,
            });
          } else {
            // Check if failure was due to network
            if (result.networkError || !NetworkMonitor.isOnline) {
              console.log("[SyncEngine] Network error detected, stopping sync");
              abortedDueToNetwork = true;
              break;
            }

            errors.push({
              jobId,
              operationType: operation.operationType,
              error: result.error,
            });

            // If operation failed, don't continue with later operations for this job
            if (!result.canContinue) {
              break;
            }
          }
        }

        if (abortedDueToNetwork) break;
      }

      // Update final status
      let finalStatus;
      if (abortedDueToNetwork) {
        finalStatus = SYNC_STATUS.IDLE; // Will retry when back online
        console.log(`[SyncEngine] Sync paused due to network loss. Synced ${syncedCount} operations before pause.`);
      } else {
        finalStatus = errors.length > 0 ? SYNC_STATUS.ERROR : SYNC_STATUS.COMPLETED;
      }

      this._updateProgress({
        status: finalStatus,
        currentOperation: null,
        errors,
      });

      // Mark synced jobs as no longer requiring sync
      if (syncedCount > 0) {
        await this._updateJobSyncStatus();
      }

      // Track sync completion for analytics
      if (syncedCount > 0) {
        const syncDurationMs = Date.now() - syncStartTime;
        AnalyticsService.trackOfflineSync(syncDurationMs, syncedCount);
      }

      // Determine sync outcome with clear status
      // status: "complete" | "partial" | "interrupted" | "failed"
      let status;
      let stopReason;

      if (this._authExpired) {
        status = "interrupted";
        stopReason = "auth_expired";
      } else if (abortedDueToNetwork) {
        status = "interrupted";
        stopReason = "network_lost";
      } else if (errors.length > 0 && syncedCount > 0) {
        status = "partial"; // Some succeeded, some failed
        stopReason = "errors";
      } else if (errors.length > 0) {
        status = "failed"; // All failed
        stopReason = "errors";
      } else {
        status = "complete"; // All succeeded
      }

      return {
        // success is true only if ALL operations succeeded with no interruption
        success: status === "complete",
        // status provides more granular outcome information
        status,
        synced: syncedCount,
        failed: errors.length,
        total: pendingOps.length,
        errors,
        interrupted: abortedDueToNetwork || this._authExpired,
        reason: stopReason,
        authExpired: this._authExpired,
      };
    } catch (error) {
      console.error("[SyncEngine] Sync engine error:", error);
      this._updateProgress({
        status: SYNC_STATUS.ERROR,
        errors: [{ error: error.message }],
      });
      return { success: false, error: error.message };
    } finally {
      this._syncing = false;
      this._abortSync = false;
      // Clean up abort controller
      this._abortController = null;
      // Unsubscribe from network changes
      if (this._networkUnsubscribe) {
        this._networkUnsubscribe();
        this._networkUnsubscribe = null;
      }
      // Release the sync lock
      this._releaseSyncLock();
    }
  }

  // Group operations by job and sort by sequence number
  _groupAndSortOperations(operations) {
    const grouped = {};

    operations.forEach((op) => {
      if (!grouped[op.jobId]) {
        grouped[op.jobId] = [];
      }
      grouped[op.jobId].push(op);
    });

    // Sort each job's operations by sequence number
    Object.keys(grouped).forEach((jobId) => {
      grouped[jobId].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    });

    return grouped;
  }

  // Get job by local ID
  async _getJob(localJobId) {
    try {
      return await offlineJobsCollection.find(localJobId);
    } catch {
      return null;
    }
  }

  // Check for conflicts with server state
  async _checkForConflicts(job) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/business-employee/my-jobs/${job.serverId}`,
        {
          headers: { Authorization: `Bearer ${this._authToken}` },
          signal: this._getAbortSignal(),
        }
      );

      if (response.status === 404) {
        // Job doesn't exist on server - might have been cancelled
        await this._createConflict(job, CONFLICT_TYPES.CANCELLATION, {
          reason: "Job not found on server",
        });
        return { type: CONFLICT_TYPES.CANCELLATION, summary: "Job was cancelled" };
      }

      // Check for auth token expiration
      if (this._isAuthExpiredResponse(response)) {
        this._authExpired = true;
        this._abortSync = true;
        return { type: "AUTH_EXPIRED", summary: "Authentication expired" };
      }

      // Handle server errors (5xx) - should abort and retry later
      if (response.status >= 500) {
        console.warn(`[SyncEngine] Server error ${response.status} during conflict check`);
        return { type: "SERVER_ERROR", summary: `Server error: ${response.status}`, shouldRetry: true };
      }

      // Handle other non-OK responses (4xx except 401/404)
      if (!response.ok) {
        console.warn(`[SyncEngine] Unexpected response ${response.status} during conflict check`);
        // For client errors, let sync proceed but log for debugging
        return null;
      }

      const serverData = await response.json();

      // Check if server job is in a conflicting state
      if (serverData.job?.status === "cancelled") {
        // Check if we started before cancellation
        const localStartTime = job.startedAt?.getTime() || Date.now();
        const serverCancelTime = new Date(serverData.job.cancelledAt || 0).getTime();

        if (localStartTime < serverCancelTime) {
          // We started first - cleaner wins
          return null;
        }

        await this._createConflict(job, CONFLICT_TYPES.CANCELLATION, serverData.job);
        return { type: CONFLICT_TYPES.CANCELLATION, summary: "Job was cancelled" };
      }

      // Check for multi-cleaner conflict
      if (serverData.job?.status === "started" && job.status === "started") {
        // Another cleaner started - need to merge
        await this._createConflict(job, CONFLICT_TYPES.MULTI_CLEANER, serverData.job);
        // We can still sync room-scoped data
        return null;
      }

      return null;
    } catch (error) {
      // Detect network errors vs other errors
      if (this._isNetworkError(error)) {
        console.warn("[SyncEngine] Network error during conflict check, will retry later:", error.message);
        return { type: "NETWORK_ERROR", summary: "Network error during conflict check", shouldRetry: true };
      }

      // AbortError means we're shutting down
      if (error.name === "AbortError") {
        console.log("[SyncEngine] Conflict check aborted");
        return { type: "ABORTED", summary: "Sync aborted", shouldRetry: false };
      }

      // For other errors, log but let sync proceed (might be transient JSON parse error, etc.)
      console.error("[SyncEngine] Conflict check error (non-network):", error);
      return null;
    }
  }

  // Create a conflict record
  async _createConflict(job, conflictType, serverData) {
    await database.write(async () => {
      await syncConflictsCollection.create((conflict) => {
        conflict.jobId = job.id;
        conflict.conflictType = conflictType;
        conflict._raw.local_data = JSON.stringify({
          status: job.status,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
        });
        conflict._raw.server_data = JSON.stringify(serverData);
        conflict.resolved = false;
        conflict._raw.created_at = Date.now();
      });
    });
  }

  // Validate payload has required fields
  _validatePayload(payload, requiredFields, operationType) {
    if (!payload) {
      return { valid: false, error: `Missing payload for ${operationType}` };
    }
    const missing = requiredFields.filter((field) => payload[field] === undefined || payload[field] === null);
    if (missing.length > 0) {
      return { valid: false, error: `Missing required fields in ${operationType}: ${missing.join(", ")}` };
    }
    return { valid: true };
  }

  // Pre-validate operation before marking as in_progress (prevents stuck operations)
  _preValidateOperation(operation, job) {
    const payload = operation.payload || {};

    switch (operation.operationType) {
      case SYNC_OPERATION_TYPES.START:
      case SYNC_OPERATION_TYPES.COMPLETE:
        if (!job || !job.serverId) {
          return { valid: false, error: `Missing job or serverId for ${operation.operationType}` };
        }
        if (operation.operationType === SYNC_OPERATION_TYPES.COMPLETE && !job.appointmentId) {
          return { valid: false, error: "Missing appointmentId for JOB_COMPLETE" };
        }
        break;
      case SYNC_OPERATION_TYPES.HOME_SIZE_MISMATCH:
        if (!payload.appointmentId || payload.reportedNumBeds === undefined || payload.reportedNumBaths === undefined) {
          return { valid: false, error: "Missing required fields for HOME_SIZE_MISMATCH" };
        }
        break;
      case SYNC_OPERATION_TYPES.BEFORE_PHOTO:
      case SYNC_OPERATION_TYPES.AFTER_PHOTO:
      case SYNC_OPERATION_TYPES.PASSES_PHOTO:
        // room is optional - read from photo object during sync
        if (!payload.photoId || !payload.photoType) {
          return { valid: false, error: "Missing required fields for PHOTO" };
        }
        break;
      case SYNC_OPERATION_TYPES.CHECKLIST:
        if (!payload.itemId) {
          return { valid: false, error: "Missing itemId for CHECKLIST" };
        }
        break;
      default:
        // Unknown types will be handled in the switch below
        break;
    }
    return { valid: true };
  }

  // Process a single sync operation
  async _processOperation(operation, job) {
    // Track whether we successfully marked as in_progress
    // This determines cleanup behavior in case of errors
    let markedInProgress = false;

    try {
      // Pre-validate BEFORE marking as in_progress to prevent stuck operations
      const preValidation = this._preValidateOperation(operation, job);
      if (!preValidation.valid) {
        // Mark as failed immediately without going through in_progress state
        await operation.markFailed(preValidation.error);
        return { success: false, error: preValidation.error, canContinue: true };
      }

      // Try to mark as in_progress with explicit error handling
      try {
        await operation.markInProgress();
        markedInProgress = true;
      } catch (inProgressError) {
        console.error("[SyncEngine] Failed to mark operation as in_progress:", inProgressError);
        // Don't proceed if we can't mark as in_progress
        return { success: false, error: `Failed to start operation: ${inProgressError.message}`, canContinue: true };
      }

      // CRITICAL: Re-validate job still exists before processing
      // The job could have been deleted by user or another process between
      // when we first fetched it and now. This prevents errors deep in operation handlers.
      if (job) {
        try {
          const refreshedJob = await this._getJob(job.id);
          if (!refreshedJob) {
            await operation.markFailed("Job was deleted before operation could complete");
            return { success: false, error: "Job was deleted", canContinue: true };
          }
          // Use refreshed job reference for the operation
          job = refreshedJob;
        } catch (jobRefreshError) {
          console.warn("[SyncEngine] Could not refresh job, proceeding with original reference:", jobRefreshError.message);
          // Continue with original job reference - operation handlers have their own validation
        }
      }

      let result;

      // Most operations require a valid job - check before processing
      const operationsRequiringJob = [
        SYNC_OPERATION_TYPES.START,
        SYNC_OPERATION_TYPES.HOME_SIZE_MISMATCH,
        SYNC_OPERATION_TYPES.ACCURACY,
        SYNC_OPERATION_TYPES.BEFORE_PHOTO,
        SYNC_OPERATION_TYPES.AFTER_PHOTO,
        SYNC_OPERATION_TYPES.PASSES_PHOTO,
        SYNC_OPERATION_TYPES.CHECKLIST,
        SYNC_OPERATION_TYPES.COMPLETE,
      ];

      if (operationsRequiringJob.includes(operation.operationType) && !job) {
        await operation.markFailed("Job not found - may have been deleted");
        return { success: false, error: "Job not found", canContinue: true };
      }

      switch (operation.operationType) {
        case SYNC_OPERATION_TYPES.START:
          result = await this._syncJobStart(operation, job);
          break;
        case SYNC_OPERATION_TYPES.HOME_SIZE_MISMATCH:
          result = await this._syncHomeSizeMismatch(operation, job);
          break;
        case SYNC_OPERATION_TYPES.ACCURACY:
          result = await this._syncAccuracy(operation, job);
          break;
        case SYNC_OPERATION_TYPES.BEFORE_PHOTO:
        case SYNC_OPERATION_TYPES.AFTER_PHOTO:
        case SYNC_OPERATION_TYPES.PASSES_PHOTO:
          result = await this._syncPhoto(operation, job);
          break;
        case SYNC_OPERATION_TYPES.CHECKLIST:
          result = await this._syncChecklist(operation, job);
          break;
        case SYNC_OPERATION_TYPES.COMPLETE:
          result = await this._syncJobComplete(operation, job);
          break;
        case SYNC_OPERATION_TYPES.MESSAGE:
          result = await this._syncMessage(operation, job);
          break;
        default:
          result = { success: false, error: `Unknown operation type: ${operation.operationType}` };
      }

      if (result.success) {
        await operation.markCompleted();
      } else {
        await operation.markFailed(result.error);

        // If JOB_COMPLETE fails and we've exhausted retries, unlock the job so user can retry
        if (operation.operationType === SYNC_OPERATION_TYPES.COMPLETE &&
            operation.attempts >= SYNC_MAX_ATTEMPTS && job) {
          console.warn(`[SyncEngine] Job completion sync failed after ${SYNC_MAX_ATTEMPTS} attempts, unlocking job ${job.id}`);
          await database.write(async () => {
            await job.update((j) => {
              j.locked = false;
              // Keep requiresSync true so it will retry later
            });
          });
        }

        // If MESSAGE sync fails and we've exhausted retries, mark the underlying message as FAILED
        if (operation.operationType === SYNC_OPERATION_TYPES.MESSAGE &&
            operation.attempts >= SYNC_MAX_ATTEMPTS) {
          const payload = operation.payload || {};
          if (payload.messageId) {
            console.warn(`[SyncEngine] Message sync failed after ${SYNC_MAX_ATTEMPTS} attempts, marking message ${payload.messageId} as failed`);
            try {
              const { offlineMessagesCollection } = await import("./database");
              const message = await offlineMessagesCollection.find(payload.messageId);
              await database.write(async () => {
                await message.markFailed();
              });
            } catch (msgError) {
              // Message may have been deleted, that's OK
              console.warn(`[SyncEngine] Could not mark message as failed:`, msgError.message);
            }
          }
        }

        // Schedule retry with exponential backoff if attempts remain
        if (operation.attempts < SYNC_MAX_ATTEMPTS) {
          const delay = getRetryDelay(operation.attempts);
          // Actually schedule the retry (previous code only logged but never scheduled)
          this._scheduleRetry(delay);
        }
      }

      return result;
    } catch (error) {
      console.error("[SyncEngine] Operation processing error:", error);

      // Only need to recover if we actually marked as in_progress
      if (markedInProgress) {
        // CRITICAL: Must try to recover the operation from in_progress state
        // If markFailed throws, the operation would be permanently stuck
        try {
          await operation.markFailed(error);
        } catch (failError) {
          console.error("[SyncEngine] Failed to mark operation as failed:", failError);
          // Last resort: try to reset to pending so it can be retried
          try {
            await database.write(async () => {
              await operation.update((o) => {
                o.status = OP_STATUS.PENDING;
                o.attempts = (o.attempts || 0) + 1;
                o._raw.failed_reason = `Processing error (reset from stuck): ${error.message}`;
                o._raw.updated_at = Date.now();
              });
            });
            console.warn("[SyncEngine] Reset stuck operation to pending for retry");
          } catch (resetError) {
            // Even reset failed - log critical error but don't crash
            console.error(
              "[SyncEngine] CRITICAL: Could not recover stuck operation. Manual intervention required.",
              { operationId: operation.id, originalError: error.message, resetError: resetError.message }
            );
          }
        }
      }

      return { success: false, error: error.message, canContinue: false };
    }
  }

  // Sync job start
  async _syncJobStart(operation, job) {
    const payload = operation.payload || {};

    // Validate job has required fields (serverId comes from job, not payload)
    if (!job || !job.serverId) {
      return { success: false, error: "Missing job or serverId for JOB_START", canContinue: false };
    }

    // Check if this is a recovered operation that might have already succeeded
    if (operation._raw?.recovery_count > 0) {
      console.log(`[SyncEngine] Job start operation was recovered, checking server state first`);
      // Check current job status on server before attempting start
      try {
        const checkResponse = await fetch(
          `${baseURL}/api/v1/business-employee/my-jobs/${job.serverId}`,
          {
            headers: { Authorization: `Bearer ${this._authToken}` },
            signal: this._getAbortSignal(),
          }
        );
        if (checkResponse.ok) {
          const serverJob = await checkResponse.json();
          if (serverJob.job?.status === "started" || serverJob.job?.status === "completed") {
            console.log(`[SyncEngine] Job already ${serverJob.job.status} on server, skipping start`);
            return { success: true, canContinue: true, skippedDuplicate: true };
          }
        }
      } catch (checkError) {
        console.warn(`[SyncEngine] Could not verify server state, proceeding with start:`, checkError.message);
      }
    }

    try {
      const response = await fetch(
        `${baseURL}/api/v1/business-employee/my-jobs/${job.serverId}/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this._authToken}`,
          },
          body: JSON.stringify({
            confirmAtProperty: true,
            latitude: payload.latitude,
            longitude: payload.longitude,
            offlineStartedAt: payload.startedAt,
          }),
          signal: this._getAbortSignal(),
        }
      );

      // Check for auth token expiration
      if (this._isAuthExpiredResponse(response)) {
        return this._handleAuthExpired();
      }

      if (!response.ok) {
        const data = await this._safeParseResponseJson(response, "Failed to sync job start");
        return { success: false, error: data.error || "Failed to sync job start", canContinue: false };
      }

      return { success: true, canContinue: true };
    } catch (error) {
      // Detect abort errors (network lost mid-request)
      if (error.name === "AbortError") {
        return { success: false, error: "Request aborted - network lost", canContinue: false, networkError: true };
      }
      // Detect network errors using robust helper
      const isNetworkError = this._isNetworkError(error);
      return { success: false, error: error.message, canContinue: false, networkError: isNetworkError };
    }
  }

  // Sync home size mismatch report
  async _syncHomeSizeMismatch(operation, job) {
    const payload = operation.payload || {};

    // Validate required payload fields
    const validation = this._validatePayload(
      payload,
      ["appointmentId", "reportedNumBeds", "reportedNumBaths"],
      "HOME_SIZE_MISMATCH"
    );
    if (!validation.valid) {
      return { success: false, error: validation.error, canContinue: true };
    }

    // Validate photos array exists and is not empty (server requires photos)
    if (!payload.photos || !Array.isArray(payload.photos) || payload.photos.length === 0) {
      return { success: false, error: "Photos are required for home size mismatch report", canContinue: true };
    }

    try {
      // Build photos array with base64 data from local files
      const photosWithData = [];
      for (const photoRef of payload.photos) {
        try {
          const photo = await offlinePhotosCollection.find(photoRef.id);
          if (photo && photo.localUri) {
            // Read the photo file as base64
            const base64Content = await FileSystem.readAsStringAsync(photo.localUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            photosWithData.push({
              roomType: photoRef.roomType,
              roomNumber: photoRef.roomNumber,
              photoData: `data:image/jpeg;base64,${base64Content}`,
            });
          }
        } catch (photoError) {
          console.warn(`[SyncEngine] Failed to read mismatch photo ${photoRef.id}:`, photoError);
        }
      }

      // Validate we successfully loaded at least one photo
      if (photosWithData.length === 0) {
        return { success: false, error: "Failed to load any photos for home size mismatch report", canContinue: true };
      }

      const response = await fetch(`${baseURL}/api/v1/homes/size-adjustment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this._authToken}`,
        },
        body: JSON.stringify({
          appointmentId: payload.appointmentId,
          reportedNumBeds: payload.reportedNumBeds,
          reportedNumBaths: payload.reportedNumBaths,
          cleanerNote: payload.cleanerNote,
          photos: photosWithData,
        }),
        signal: this._getAbortSignal(),
      });

      // Check for auth token expiration
      if (this._isAuthExpiredResponse(response)) {
        return this._handleAuthExpired();
      }

      if (!response.ok) {
        const data = await this._safeParseResponseJson(response, "Failed to sync mismatch report");
        return { success: false, error: data.error || "Failed to sync mismatch report", canContinue: true };
      }

      // Clean up local mismatch photos after successful sync
      await PhotoStorage.deleteMismatchPhotosForJob(job.serverId);

      return { success: true, canContinue: true };
    } catch (error) {
      if (error.name === "AbortError") {
        return { success: false, error: "Request aborted - network lost", canContinue: true, networkError: true };
      }
      const isNetworkError = this._isNetworkError(error);
      return { success: false, error: error.message, canContinue: true, networkError: isNetworkError };
    }
  }

  // Sync accuracy confirmation
  /**
   * Sync accuracy confirmation operation.
   *
   * NOTE: This is intentionally a no-op. Accuracy confirmations (GPS location verification)
   * are bundled with JOB_START operations, not synced separately. The ACCURACY operation
   * type exists for backwards compatibility and to allow the sync queue to track that
   * accuracy was confirmed, but the actual data is sent with the START operation payload
   * (latitude, longitude fields).
   *
   * If standalone accuracy sync is needed in the future, implement the server endpoint
   * and update this handler to call it.
   */
  async _syncAccuracy(operation, job) {
    // Accuracy data is included in JOB_START payload (latitude/longitude fields)
    // This operation type exists for queue tracking but doesn't need separate sync
    if (__DEV__) {
      console.log(`[SyncEngine] ACCURACY operation ${operation.id} auto-completed (bundled with START)`);
    }
    return { success: true, canContinue: true, bundledWithStart: true };
  }

  // Sync a photo
  async _syncPhoto(operation, job) {
    const payload = operation.payload || {};

    // Validate required payload fields (room is optional - read from photo object)
    const validation = this._validatePayload(payload, ["photoId", "photoType"], "PHOTO");
    if (!validation.valid) {
      return { success: false, error: validation.error, canContinue: true };
    }

    // Validate job has appointmentId (required for server upload)
    if (!job?.appointmentId) {
      return { success: false, error: "Missing appointmentId for photo upload", canContinue: true };
    }

    const photoId = payload.photoId;

    try {
      // Get the local photo
      const photo = await offlinePhotosCollection.find(photoId);
      if (!photo) {
        return { success: false, error: "Photo not found locally", canContinue: true };
      }

      if (photo.uploaded) {
        return { success: true, canContinue: true }; // Already uploaded
      }

      // Check if this is an N/A passes record (no photo file)
      const isNotApplicable = photo._raw?.is_not_applicable || false;

      // Read photo data
      const photoUri = photo.localUri;
      const photoType = photo.photoType;
      const room = photo.room;

      // Build request body
      const requestBody = {
        appointmentId: job.appointmentId,
        photoType,
        room,
        watermarkData: photo.watermarkData,
      };

      // For N/A passes, we don't need to send photo data
      if (isNotApplicable) {
        requestBody.isNotApplicable = true;
        requestBody.notes = photo.watermarkData?.notes || "No passes available at this property";
      } else {
        // For regular photos, include the photo URI (server handles conversion)
        requestBody.photoUri = photoUri;
      }

      const response = await fetch(`${baseURL}/api/v1/job-photos/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this._authToken}`,
        },
        body: JSON.stringify(requestBody),
        signal: this._getAbortSignal(),
      });

      // Check for auth token expiration
      if (this._isAuthExpiredResponse(response)) {
        return this._handleAuthExpired();
      }

      if (!response.ok) {
        await PhotoStorage.incrementUploadAttempts(photoId);
        const data = await this._safeParseResponseJson(response, "Failed to upload photo");
        return { success: false, error: data.error || "Failed to upload photo", canContinue: true };
      }

      await PhotoStorage.markAsUploaded(photoId);
      return { success: true, canContinue: true };
    } catch (error) {
      if (error.name === "AbortError") {
        // Don't count network aborts against the photo
        return { success: false, error: "Request aborted - network lost", canContinue: true, networkError: true };
      }
      const isNetworkError = this._isNetworkError(error);
      // For non-network errors (e.g., file corruption, unexpected server errors),
      // increment the upload attempts to prevent infinite retries
      if (!isNetworkError) {
        try {
          await PhotoStorage.incrementUploadAttempts(photoId);
        } catch (incrementError) {
          console.error("[SyncEngine] Failed to increment upload attempts:", incrementError);
        }
      }
      return { success: false, error: error.message, canContinue: true, networkError: isNetworkError };
    }
  }

  // Sync checklist progress
  async _syncChecklist(operation, job) {
    const payload = operation.payload || {};

    // Validate required payload fields
    const validation = this._validatePayload(payload, ["itemId"], "CHECKLIST");
    if (!validation.valid) {
      return { success: false, error: validation.error, canContinue: true };
    }

    try {
      // Use the correct business employee checklist endpoint
      const response = await fetch(
        `${baseURL}/api/v1/business-employee/my-jobs/${job.serverId}/checklist`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this._authToken}`,
          },
          body: JSON.stringify({
            sectionId: payload.sectionId,
            itemId: payload.itemId,
            status: payload.completed ? "completed" : null,
          }),
          signal: this._getAbortSignal(),
        }
      );

      // Check for auth token expiration
      if (this._isAuthExpiredResponse(response)) {
        return this._handleAuthExpired();
      }

      if (!response.ok) {
        const data = await this._safeParseResponseJson(response, "Failed to sync checklist");
        return { success: false, error: data.error || "Failed to sync checklist", canContinue: true };
      }

      return { success: true, canContinue: true };
    } catch (error) {
      if (error.name === "AbortError") {
        return { success: false, error: "Request aborted - network lost", canContinue: true, networkError: true };
      }
      const isNetworkError = this._isNetworkError(error);
      return { success: false, error: error.message, canContinue: true, networkError: isNetworkError };
    }
  }

  // Sync job completion
  async _syncJobComplete(operation, job) {
    const payload = operation.payload || {};

    // Validate job has required fields (serverId and appointmentId come from job, not payload)
    if (!job || !job.serverId || !job.appointmentId) {
      return { success: false, error: "Missing job, serverId or appointmentId for JOB_COMPLETE", canContinue: false };
    }

    // Check server state first to prevent race condition with other devices
    try {
      const checkResponse = await fetch(
        `${baseURL}/api/v1/business-employee/my-jobs/${job.serverId}`,
        {
          headers: { Authorization: `Bearer ${this._authToken}` },
          signal: this._getAbortSignal(),
        }
      );
      if (checkResponse.ok) {
        const serverJob = await checkResponse.json();
        if (serverJob.job?.status === "completed") {
          console.log(`[SyncEngine] Job ${job.serverId} already completed on server (possibly by another device)`);
          // Create a conflict record so user is aware
          await this._createConflict(job, CONFLICT_TYPES.MULTI_CLEANER, {
            reason: "Job was completed by another device",
            serverStatus: serverJob.job.status,
            serverCompletedAt: serverJob.job.completedAt,
          });
          // Still return success since the job IS completed
          return { success: true, canContinue: true, completedByOther: true };
        }
      }
    } catch (checkError) {
      // If check fails, proceed with completion attempt
      console.warn(`[SyncEngine] Could not verify job state before completion:`, checkError.message);
    }

    try {
      const response = await fetch(`${baseURL}/api/v1/payments/complete-job`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this._authToken}`,
        },
        body: JSON.stringify({
          appointmentId: job.appointmentId,
          offlineCompletedAt: payload.completedAt,
          hoursWorked: payload.hoursWorked,
        }),
        signal: this._getAbortSignal(),
      });

      // Check for auth token expiration
      if (this._isAuthExpiredResponse(response)) {
        return this._handleAuthExpired();
      }

      if (!response.ok) {
        const data = await this._safeParseResponseJson(response, "Failed to complete job");

        // Handle race condition: job was completed by another device between our check and POST
        // Common error messages/codes indicating already completed
        const alreadyCompletedIndicators = [
          "already completed",
          "already been completed",
          "job is completed",
          "status is completed",
        ];
        const errorLower = (data.error || "").toLowerCase();
        const isAlreadyCompleted = alreadyCompletedIndicators.some(ind => errorLower.includes(ind)) ||
                                   response.status === 409 || // Conflict
                                   data.code === "ALREADY_COMPLETED";

        if (isAlreadyCompleted) {
          console.log(`[SyncEngine] Job ${job.serverId} already completed (race condition handled)`);
          // Create conflict record for user awareness
          await this._createConflict(job, CONFLICT_TYPES.MULTI_CLEANER, {
            reason: "Job was completed by another device (detected during sync)",
            detectedAt: Date.now(),
          });
          // Return success since the job IS completed - this is not an error
          return { success: true, canContinue: true, completedByOther: true };
        }

        return { success: false, error: data.error || "Failed to complete job", canContinue: false };
      }

      return { success: true, canContinue: true };
    } catch (error) {
      if (error.name === "AbortError") {
        return { success: false, error: "Request aborted - network lost", canContinue: false, networkError: true };
      }
      const isNetworkError = this._isNetworkError(error);
      return { success: false, error: error.message, canContinue: false, networkError: isNetworkError };
    }
  }

  // Lazily load OfflineMessagingService (avoids circular dependency)
  async _getOfflineMessagingService() {
    if (!this._offlineMessagingService) {
      const module = await import("./OfflineMessagingService");
      this._offlineMessagingService = module.default;
    }
    return this._offlineMessagingService;
  }

  // Sync a message or note
  async _syncMessage(operation, job) {
    const payload = operation.payload || {};

    // Validate payload has messageId
    if (!payload.messageId) {
      return { success: false, error: "Missing messageId for MESSAGE sync", canContinue: true };
    }

    try {
      // Use cached lazy import to avoid repeated dynamic imports
      const OfflineMessagingService = await this._getOfflineMessagingService();
      OfflineMessagingService.setAuthToken(this._authToken);

      const result = await OfflineMessagingService.syncMessage(payload);

      // Validate result structure
      if (!result || typeof result !== "object") {
        return { success: false, error: "Invalid response from message sync", canContinue: true };
      }

      return result;
    } catch (error) {
      if (error.name === "AbortError") {
        return { success: false, error: "Request aborted - network lost", canContinue: true, networkError: true };
      }
      const isNetworkError = this._isNetworkError(error);
      return { success: false, error: error.message, canContinue: true, networkError: isNetworkError };
    }
  }

  // Update job sync status after successful sync
  async _updateJobSyncStatus() {
    // Fetch jobs and operations ONCE (not inside loop - fixes N+1 query)
    const jobs = await offlineJobsCollection.query().fetch();
    const allOperations = await syncQueueCollection.query().fetch();

    // Group operations by jobId for O(1) lookup
    const operationsByJobId = new Map();
    for (const op of allOperations) {
      if (!operationsByJobId.has(op.jobId)) {
        operationsByJobId.set(op.jobId, []);
      }
      operationsByJobId.get(op.jobId).push(op);
    }

    await database.write(async () => {
      for (const job of jobs) {
        if (!job.requiresSync) continue;

        // Check if all operations for this job are completed
        const jobOps = operationsByJobId.get(job.id) || [];
        const allCompleted = jobOps.length === 0 || jobOps.every((op) => op.status === OP_STATUS.COMPLETED);

        if (allCompleted) {
          await job.update((j) => {
            j.requiresSync = false;
          });
        }
      }
    });
  }

  // Manual retry of failed operations
  async retryFailed() {
    const allOperations = await syncQueueCollection.query().fetch();
    const failedOps = allOperations.filter(
      (op) => op.status === OP_STATUS.FAILED && op.canRetry
    );

    await database.write(async () => {
      for (const op of failedOps) {
        await op.update((o) => {
          o.status = OP_STATUS.PENDING;
        });
      }
    });

    return this.startSync();
  }

  // Get pending sync count
  async getPendingCount() {
    const allOperations = await syncQueueCollection.query().fetch();
    return allOperations.filter(
      (op) => op.status === OP_STATUS.PENDING || op.status === OP_STATUS.FAILED
    ).length;
  }

  // Check if currently syncing
  get isSyncing() {
    return this._syncing;
  }
}

// Export singleton
export default new SyncEngine();
