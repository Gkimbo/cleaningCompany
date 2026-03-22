/**
 * StorageManager - Manages offline storage and cleanup
 *
 * Handles storage quotas, cleanup of old data, and storage health monitoring.
 */

import { Q } from "@nozbe/watermelondb";
import database, {
  offlineJobsCollection,
  offlinePhotosCollection,
  offlineChecklistItemsCollection,
  syncQueueCollection,
  syncConflictsCollection,
} from "./database";
import PhotoStorage from "./PhotoStorage";
import { OFFLINE_JOB_STATUS } from "./constants";

// Storage limits
const STORAGE_WARNING_THRESHOLD_MB = 100; // Warn when above 100MB
const STORAGE_CRITICAL_THRESHOLD_MB = 200; // Critical when above 200MB
const OLD_JOB_THRESHOLD_HOURS = 24; // Jobs older than 24 hours after completion
const OLD_SYNC_QUEUE_THRESHOLD_HOURS = 72; // Completed sync operations older than 72 hours
const FAILED_PHOTO_MAX_ATTEMPTS = 5; // Max attempts before giving up on photo upload

class StorageManager {
  constructor() {
    this._listeners = new Set();
  }

  /**
   * Subscribe to storage updates
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Notify listeners of storage changes
   */
  _notify(stats) {
    this._listeners.forEach((listener) => {
      try {
        listener(stats);
      } catch (error) {
        console.error("StorageManager listener error:", error);
      }
    });
  }

  /**
   * Get comprehensive storage statistics
   */
  async getStorageStats() {
    try {
      // Get photo storage stats
      const photoStats = await PhotoStorage.getStorageStats();

      // Get database record counts - use optimized queries with filters where possible
      const [
        jobCount,
        photoCount,
        checklistItemCount,
        syncQueueCount,
        conflictCount,
        pendingPhotos,
        pendingSyncOps,
        unresolvedConflicts,
      ] = await Promise.all([
        offlineJobsCollection.query().fetchCount(),
        offlinePhotosCollection.query().fetchCount(),
        offlineChecklistItemsCollection.query().fetchCount(),
        syncQueueCollection.query().fetchCount(),
        syncConflictsCollection.query().fetchCount(),
        // Filtered counts - more efficient than fetching all and filtering in JS
        offlinePhotosCollection.query(Q.where("uploaded", false)).fetchCount(),
        syncQueueCollection.query(Q.where("status", Q.oneOf(["pending", "failed"]))).fetchCount(),
        syncConflictsCollection.query(Q.where("resolved", false)).fetchCount(),
      ]);

      // Determine storage health
      const sizeInMB = photoStats.totalSize / (1024 * 1024);
      let health = "good";
      if (sizeInMB >= STORAGE_CRITICAL_THRESHOLD_MB) {
        health = "critical";
      } else if (sizeInMB >= STORAGE_WARNING_THRESHOLD_MB) {
        health = "warning";
      }

      const stats = {
        // Photo storage
        photoStorageBytes: photoStats.totalSize,
        photoStorageFormatted: photoStats.formattedSize,
        totalPhotoCount: photoStats.photoCount,
        pendingPhotoCount: pendingPhotos,
        uploadedPhotoCount: photoStats.photoCount - pendingPhotos,

        // Database records
        jobCount,
        checklistItemCount,
        syncQueueCount,
        pendingSyncCount: pendingSyncOps,
        conflictCount,
        unresolvedConflictCount: unresolvedConflicts,

        // Health
        health,
        healthMessage: this._getHealthMessage(health, sizeInMB),

        // Thresholds
        warningThresholdMB: STORAGE_WARNING_THRESHOLD_MB,
        criticalThresholdMB: STORAGE_CRITICAL_THRESHOLD_MB,
      };

      this._notify(stats);
      return stats;
    } catch (error) {
      console.error("Failed to get storage stats:", error);
      return {
        health: "unknown",
        healthMessage: "Unable to determine storage status",
        error: error.message,
      };
    }
  }

  /**
   * Get health message based on status
   */
  _getHealthMessage(health, sizeInMB) {
    switch (health) {
      case "critical":
        return `Storage critical (${sizeInMB.toFixed(1)}MB). Please sync and cleanup.`;
      case "warning":
        return `Storage high (${sizeInMB.toFixed(1)}MB). Consider syncing soon.`;
      default:
        return `Storage healthy (${sizeInMB.toFixed(1)}MB)`;
    }
  }

  /**
   * Run full cleanup routine
   */
  async runCleanup() {
    const results = {
      cleanedJobs: 0,
      cleanedPhotos: 0,
      cleanedSyncQueue: 0,
      cleanedConflicts: 0,
      errors: [],
    };

    try {
      // 1. Clean up old completed jobs
      const jobResult = await this._cleanupOldJobs();
      results.cleanedJobs = jobResult.cleaned;
      if (jobResult.error) results.errors.push(jobResult.error);

      // 2. Clean up uploaded photos
      const photoResult = await this._cleanupUploadedPhotos();
      results.cleanedPhotos = photoResult.cleaned;
      if (photoResult.error) results.errors.push(photoResult.error);

      // 3. Clean up old sync queue entries
      const syncResult = await this._cleanupSyncQueue();
      results.cleanedSyncQueue = syncResult.cleaned;
      if (syncResult.error) results.errors.push(syncResult.error);

      // 4. Clean up resolved conflicts
      const conflictResult = await this._cleanupResolvedConflicts();
      results.cleanedConflicts = conflictResult.cleaned;
      if (conflictResult.error) results.errors.push(conflictResult.error);

      // 5. Sync photo records with filesystem
      await PhotoStorage.syncWithFileSystem();

      console.log("[StorageManager] Cleanup complete:", results);
      return results;
    } catch (error) {
      console.error("[StorageManager] Cleanup failed:", error);
      results.errors.push(error.message);
      return results;
    }
  }

  /**
   * Clean up old completed jobs
   */
  async _cleanupOldJobs() {
    try {
      const jobs = await offlineJobsCollection.query().fetch();
      const threshold = Date.now() - OLD_JOB_THRESHOLD_HOURS * 60 * 60 * 1000;
      let cleaned = 0;

      // Filter jobs first to identify which ones need cleanup
      const jobsToCleanup = jobs.filter(
        (job) =>
          job.status === OFFLINE_JOB_STATUS.COMPLETED &&
          !job.requiresSync &&
          job.completedAt &&
          job.completedAt.getTime() < threshold
      );

      if (jobsToCleanup.length === 0) {
        return { cleaned: 0 };
      }

      // Fetch checklist items ONCE (not inside loop) to avoid N+1 queries
      const allChecklistItems = await offlineChecklistItemsCollection.query().fetch();
      const jobIdsToCleanup = new Set(jobsToCleanup.map((j) => j.id));

      // Group checklist items by jobId for O(1) lookup
      const checklistItemsByJobId = new Map();
      for (const item of allChecklistItems) {
        if (jobIdsToCleanup.has(item.jobId)) {
          if (!checklistItemsByJobId.has(item.jobId)) {
            checklistItemsByJobId.set(item.jobId, []);
          }
          checklistItemsByJobId.get(item.jobId).push(item);
        }
      }

      await database.write(async () => {
        for (const job of jobsToCleanup) {
          // Clean up associated photos first
          await PhotoStorage.cleanupUploadedPhotos(job.id);

          // Clean up checklist items (using pre-fetched data, not a new query)
          const jobItems = checklistItemsByJobId.get(job.id) || [];
          for (const item of jobItems) {
            await item.markAsDeleted();
          }

          // Delete the job
          await job.markAsDeleted();
          cleaned++;
        }
      });

      return { cleaned };
    } catch (error) {
      console.error("[StorageManager] Failed to cleanup old jobs:", error);
      return { cleaned: 0, error: error.message };
    }
  }

  /**
   * Clean up uploaded photos
   */
  async _cleanupUploadedPhotos() {
    try {
      const photos = await offlinePhotosCollection.query().fetch();
      let cleaned = 0;
      let failed = 0;

      for (const photo of photos) {
        try {
          // Clean up uploaded photos
          if (photo.uploaded) {
            await PhotoStorage.deletePhoto(photo.id);
            cleaned++;
          }
          // Also clean up photos that have exceeded max upload attempts
          else if (photo.uploadAttempts >= FAILED_PHOTO_MAX_ATTEMPTS) {
            console.warn(`[StorageManager] Giving up on photo ${photo.id} after ${photo.uploadAttempts} attempts`);
            await PhotoStorage.deletePhoto(photo.id);
            cleaned++;
          }
        } catch (deleteError) {
          // Log error but continue with other photos
          console.error(`[StorageManager] Failed to delete photo ${photo.id}:`, deleteError);
          failed++;
        }
      }

      if (failed > 0) {
        console.warn(`[StorageManager] Photo cleanup completed with ${failed} failures`);
      }

      return { cleaned, failed };
    } catch (error) {
      console.error("[StorageManager] Failed to cleanup photos:", error);
      return { cleaned: 0, error: error.message };
    }
  }

  /**
   * Clean up old sync queue entries
   */
  async _cleanupSyncQueue() {
    try {
      const operations = await syncQueueCollection.query().fetch();
      const threshold = Date.now() - OLD_SYNC_QUEUE_THRESHOLD_HOURS * 60 * 60 * 1000;
      let cleaned = 0;

      await database.write(async () => {
        for (const op of operations) {
          // Only clean up completed operations older than threshold
          // Guard against null createdAt to prevent null reference error
          if (op.status === "completed" && op.createdAt && op.createdAt.getTime() < threshold) {
            await op.markAsDeleted();
            cleaned++;
          }
        }
      });

      return { cleaned };
    } catch (error) {
      console.error("[StorageManager] Failed to cleanup sync queue:", error);
      return { cleaned: 0, error: error.message };
    }
  }

  /**
   * Clean up resolved conflicts
   */
  async _cleanupResolvedConflicts() {
    try {
      const conflicts = await syncConflictsCollection.query().fetch();
      const threshold = Date.now() - OLD_SYNC_QUEUE_THRESHOLD_HOURS * 60 * 60 * 1000;
      let cleaned = 0;

      await database.write(async () => {
        for (const conflict of conflicts) {
          // Only clean up resolved conflicts older than threshold
          // Guard against null createdAt to prevent null reference error
          if (conflict.resolved && conflict.createdAt && conflict.createdAt.getTime() < threshold) {
            await conflict.markAsDeleted();
            cleaned++;
          }
        }
      });

      return { cleaned };
    } catch (error) {
      console.error("[StorageManager] Failed to cleanup conflicts:", error);
      return { cleaned: 0, error: error.message };
    }
  }

  /**
   * Force cleanup when storage is critical
   */
  async forceCriticalCleanup() {
    console.warn("[StorageManager] Running critical cleanup");

    // Run normal cleanup first
    const results = await this.runCleanup();

    // If still critical, be more aggressive
    const stats = await this.getStorageStats();
    if (stats.health === "critical") {
      // Clean up all uploaded photos regardless of age
      const photos = await offlinePhotosCollection.query().fetch();
      let extraCleaned = 0;

      for (const photo of photos) {
        if (photo.uploaded) {
          await PhotoStorage.deletePhoto(photo.id);
          extraCleaned++;
        }
      }

      results.cleanedPhotos += extraCleaned;
    }

    return results;
  }

  /**
   * Get cleanup recommendations
   */
  async getCleanupRecommendations() {
    const stats = await this.getStorageStats();
    const recommendations = [];

    if (stats.uploadedPhotoCount > 0) {
      // Calculate estimated savings, avoiding division by zero
      const estimatedSavings = stats.totalPhotoCount > 0
        ? Math.round((stats.photoStorageBytes * stats.uploadedPhotoCount) / stats.totalPhotoCount / (1024 * 1024))
        : 0;
      recommendations.push({
        type: "uploaded_photos",
        message: `${stats.uploadedPhotoCount} uploaded photos can be removed`,
        action: "cleanupUploadedPhotos",
        savingsEstimate: `~${estimatedSavings}MB`,
      });
    }

    if (stats.pendingSyncCount > 0) {
      recommendations.push({
        type: "pending_sync",
        message: `${stats.pendingSyncCount} operations waiting to sync`,
        action: "triggerSync",
        priority: "high",
      });
    }

    if (stats.unresolvedConflictCount > 0) {
      recommendations.push({
        type: "conflicts",
        message: `${stats.unresolvedConflictCount} sync conflicts need resolution`,
        action: "resolveConflicts",
        priority: "high",
      });
    }

    return recommendations;
  }
}

// Export singleton
export default new StorageManager();
