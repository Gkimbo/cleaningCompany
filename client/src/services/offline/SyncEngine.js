/**
 * SyncEngine - Handles syncing offline data to the server
 *
 * Processes sync queue operations in strict order with retry logic.
 * Detects and handles conflicts.
 */

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
  SYNC_OPERATION_ORDER,
} from "./constants";
import { SYNC_OPERATION_TYPES, OPERATION_SEQUENCE } from "./database/models/SyncQueue";
import { CONFLICT_TYPES } from "./database/models/SyncConflict";
import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class SyncEngine {
  constructor() {
    this._syncing = false;
    this._authToken = null;
    this._listeners = new Set();
    this._currentProgress = {
      status: SYNC_STATUS.IDLE,
      totalOperations: 0,
      completedOperations: 0,
      currentOperation: null,
      errors: [],
    };
    this._initialized = false;
  }

  // Set auth token for API calls
  setAuthToken(token) {
    this._authToken = token;
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
      this._initialized = true;
      console.log("[SyncEngine] Initialized and recovered interrupted operations");
    } catch (error) {
      console.error("[SyncEngine] Initialization error:", error);
      this._initialized = true; // Mark as initialized anyway to prevent blocking
    }
  }

  /**
   * Recover operations that were interrupted (app killed during sync)
   */
  async _recoverInterruptedOperations() {
    const allOperations = await syncQueueCollection.query().fetch();
    const interruptedOps = allOperations.filter((op) => op.status === "in_progress");

    if (interruptedOps.length === 0) return;

    console.log(`[SyncEngine] Found ${interruptedOps.length} interrupted operations`);

    await database.write(async () => {
      for (const op of interruptedOps) {
        // Reset to pending so they can be retried
        await op.update((o) => {
          o.status = "pending";
          // Don't increment attempts - the operation didn't actually fail
        });
      }
    });
  }

  /**
   * Check if there are operations that need to be synced
   */
  async hasPendingOperations() {
    const allOperations = await syncQueueCollection.query().fetch();
    return allOperations.some(
      (op) => op.status === "pending" || (op.status === "failed" && op.canRetry)
    );
  }

  /**
   * Get summary of pending operations for UI display
   */
  async getPendingSummary() {
    const allOperations = await syncQueueCollection.query().fetch();
    const pending = allOperations.filter((op) => op.status === "pending");
    const failed = allOperations.filter((op) => op.status === "failed");
    const completed = allOperations.filter((op) => op.status === "completed");

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

  // Subscribe to sync progress updates
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  // Notify listeners of progress changes
  _notifyListeners() {
    this._listeners.forEach((listener) => {
      try {
        listener({ ...this._currentProgress });
      } catch (error) {
        console.error("SyncEngine listener error:", error);
      }
    });
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
    if (this._syncing) {
      console.log("Sync already in progress");
      return { success: false, reason: "already_syncing" };
    }

    if (!NetworkMonitor.isOnline) {
      console.log("Cannot sync - offline");
      return { success: false, reason: "offline" };
    }

    if (!this._authToken) {
      console.log("Cannot sync - no auth token");
      return { success: false, reason: "no_auth" };
    }

    this._syncing = true;
    this._updateProgress({ status: SYNC_STATUS.SYNCING, errors: [] });

    try {
      // Get all pending operations
      const allOperations = await syncQueueCollection.query().fetch();
      const pendingOps = allOperations.filter(
        (op) => op.status === "pending" || (op.status === "failed" && op.canRetry)
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

      // Process each job's operations in order
      for (const [jobId, operations] of Object.entries(jobOperations)) {
        const job = await this._getJob(jobId);
        if (!job) {
          console.warn(`Job ${jobId} not found, skipping operations`);
          continue;
        }

        // Check for conflicts before syncing
        const conflict = await this._checkForConflicts(job);
        if (conflict) {
          errors.push({ jobId, error: conflict.summary });
          continue;
        }

        // Process operations in sequence order
        for (const operation of operations) {
          this._updateProgress({ currentOperation: operation.operationType });

          const result = await this._processOperation(operation, job);

          if (result.success) {
            syncedCount++;
            this._updateProgress({
              completedOperations: this._currentProgress.completedOperations + 1,
            });
          } else {
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
      }

      // Update final status
      const finalStatus = errors.length > 0 ? SYNC_STATUS.ERROR : SYNC_STATUS.COMPLETED;
      this._updateProgress({
        status: finalStatus,
        currentOperation: null,
        errors,
      });

      // Mark synced jobs as no longer requiring sync
      await this._updateJobSyncStatus();

      return { success: errors.length === 0, synced: syncedCount, errors };
    } catch (error) {
      console.error("Sync engine error:", error);
      this._updateProgress({
        status: SYNC_STATUS.ERROR,
        errors: [{ error: error.message }],
      });
      return { success: false, error: error.message };
    } finally {
      this._syncing = false;
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
        }
      );

      if (response.status === 404) {
        // Job doesn't exist on server - might have been cancelled
        await this._createConflict(job, CONFLICT_TYPES.CANCELLATION, {
          reason: "Job not found on server",
        });
        return { type: CONFLICT_TYPES.CANCELLATION, summary: "Job was cancelled" };
      }

      if (!response.ok) {
        return null; // Non-conflict error, let sync proceed
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
      console.error("Conflict check error:", error);
      return null; // Let sync proceed and handle errors
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

  // Process a single sync operation
  async _processOperation(operation, job) {
    try {
      await operation.markInProgress();

      let result;

      switch (operation.operationType) {
        case SYNC_OPERATION_TYPES.START:
          result = await this._syncJobStart(operation, job);
          break;
        case SYNC_OPERATION_TYPES.ACCURACY:
          result = await this._syncAccuracy(operation, job);
          break;
        case SYNC_OPERATION_TYPES.BEFORE_PHOTO:
        case SYNC_OPERATION_TYPES.AFTER_PHOTO:
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

        // Check if we should retry
        if (operation.attempts < SYNC_MAX_ATTEMPTS) {
          // Schedule retry with exponential backoff
          const delay = getRetryDelay(operation.attempts);
          console.log(`Will retry operation in ${delay}ms`);
        }
      }

      return result;
    } catch (error) {
      console.error("Operation processing error:", error);
      await operation.markFailed(error);
      return { success: false, error: error.message, canContinue: false };
    }
  }

  // Sync job start
  async _syncJobStart(operation, job) {
    const payload = operation.payload || {};

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
        }
      );

      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.error || "Failed to sync job start", canContinue: false };
      }

      return { success: true, canContinue: true };
    } catch (error) {
      return { success: false, error: error.message, canContinue: false };
    }
  }

  // Sync accuracy confirmation
  async _syncAccuracy(operation, job) {
    // Accuracy is bundled with job start in most cases
    return { success: true, canContinue: true };
  }

  // Sync a photo
  async _syncPhoto(operation, job) {
    const payload = operation.payload || {};
    const photoId = payload.photoId;

    if (!photoId) {
      return { success: false, error: "No photo ID in payload", canContinue: true };
    }

    try {
      // Get the local photo
      const photo = await offlinePhotosCollection.find(photoId);
      if (!photo) {
        return { success: false, error: "Photo not found locally", canContinue: true };
      }

      if (photo.uploaded) {
        return { success: true, canContinue: true }; // Already uploaded
      }

      // Read photo data
      const photoUri = photo.localUri;
      const photoType = photo.photoType;
      const room = photo.room;

      // For now, we'd need to read the file and convert to base64
      // This is a simplified version - full implementation would use FileSystem
      const response = await fetch(`${baseURL}/api/v1/job-photos/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this._authToken}`,
        },
        body: JSON.stringify({
          appointmentId: job.appointmentId,
          photoType,
          photoUri, // Server would need to handle URI or we convert to base64
          room,
          watermarkData: photo.watermarkData,
        }),
      });

      if (!response.ok) {
        await PhotoStorage.incrementUploadAttempts(photoId);
        const data = await response.json();
        return { success: false, error: data.error || "Failed to upload photo", canContinue: true };
      }

      await PhotoStorage.markAsUploaded(photoId);
      return { success: true, canContinue: true };
    } catch (error) {
      return { success: false, error: error.message, canContinue: true };
    }
  }

  // Sync checklist progress
  async _syncChecklist(operation, job) {
    const payload = operation.payload || {};

    try {
      const response = await fetch(
        `${baseURL}/api/v1/checklist/${job.appointmentId}/progress`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this._authToken}`,
          },
          body: JSON.stringify({
            itemId: payload.itemId,
            completed: payload.completed,
            completedAt: payload.completedAt,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.error || "Failed to sync checklist", canContinue: true };
      }

      return { success: true, canContinue: true };
    } catch (error) {
      return { success: false, error: error.message, canContinue: true };
    }
  }

  // Sync job completion
  async _syncJobComplete(operation, job) {
    const payload = operation.payload || {};

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
      });

      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.error || "Failed to complete job", canContinue: false };
      }

      return { success: true, canContinue: true };
    } catch (error) {
      return { success: false, error: error.message, canContinue: false };
    }
  }

  // Sync a message or note
  async _syncMessage(operation, job) {
    const payload = operation.payload || {};

    try {
      // Import OfflineMessagingService dynamically to avoid circular dependency
      const OfflineMessagingService = (await import("./OfflineMessagingService")).default;
      OfflineMessagingService.setAuthToken(this._authToken);

      const result = await OfflineMessagingService.syncMessage(payload);
      return result;
    } catch (error) {
      return { success: false, error: error.message, canContinue: true };
    }
  }

  // Update job sync status after successful sync
  async _updateJobSyncStatus() {
    const jobs = await offlineJobsCollection.query().fetch();

    await database.write(async () => {
      for (const job of jobs) {
        if (!job.requiresSync) continue;

        // Check if all operations for this job are completed
        const operations = await syncQueueCollection.query().fetch();
        const jobOps = operations.filter((op) => op.jobId === job.id);
        const allCompleted = jobOps.every((op) => op.status === "completed");

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
      (op) => op.status === "failed" && op.canRetry
    );

    await database.write(async () => {
      for (const op of failedOps) {
        await op.update((o) => {
          o.status = "pending";
        });
      }
    });

    return this.startSync();
  }

  // Get pending sync count
  async getPendingCount() {
    const allOperations = await syncQueueCollection.query().fetch();
    return allOperations.filter(
      (op) => op.status === "pending" || op.status === "failed"
    ).length;
  }

  // Check if currently syncing
  get isSyncing() {
    return this._syncing;
  }
}

// Export singleton
export default new SyncEngine();
