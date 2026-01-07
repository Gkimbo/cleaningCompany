/**
 * ConflictResolver - Handles resolution of sync conflicts
 *
 * Implements timestamp-based resolution and handles special cases
 * like cancellation and multi-cleaner conflicts.
 */

import database, { syncConflictsCollection, offlineJobsCollection } from "./database";
import { CONFLICT_TYPES, RESOLUTION_TYPES } from "./database/models/SyncConflict";

class ConflictResolver {
  /**
   * Get all unresolved conflicts
   */
  async getUnresolvedConflicts() {
    const conflicts = await syncConflictsCollection.query().fetch();
    return conflicts.filter((c) => !c.resolved);
  }

  /**
   * Get conflicts for a specific job
   */
  async getConflictsForJob(jobId) {
    const conflicts = await syncConflictsCollection.query().fetch();
    return conflicts.filter((c) => c.jobId === jobId);
  }

  /**
   * Auto-resolve a conflict based on rules
   */
  async autoResolve(conflict) {
    switch (conflict.conflictType) {
      case CONFLICT_TYPES.CANCELLATION:
        return await this._resolveCancellation(conflict);
      case CONFLICT_TYPES.MULTI_CLEANER:
        return await this._resolveMultiCleaner(conflict);
      case CONFLICT_TYPES.DATA_MISMATCH:
        return await this._resolveDataMismatch(conflict);
      default:
        return { resolved: false, reason: "Unknown conflict type" };
    }
  }

  /**
   * Manually resolve a conflict with specified resolution
   */
  async manualResolve(conflictId, resolution) {
    try {
      const conflict = await syncConflictsCollection.find(conflictId);
      await conflict.resolve(resolution);

      // Apply resolution
      await this._applyResolution(conflict, resolution);

      return { success: true };
    } catch (error) {
      console.error("Error resolving conflict:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resolve cancellation conflict
   * Rule: If cleaner started before cancellation, cleaner wins
   */
  async _resolveCancellation(conflict) {
    const localData = conflict.localData || {};
    const serverData = conflict.serverData || {};

    const localStartTime = localData.startedAt ? new Date(localData.startedAt).getTime() : 0;
    const serverCancelTime = serverData.cancelledAt
      ? new Date(serverData.cancelledAt).getTime()
      : Date.now();

    if (localStartTime > 0 && localStartTime < serverCancelTime) {
      // Cleaner started before cancellation - cleaner wins
      await conflict.resolve(RESOLUTION_TYPES.LOCAL_WINS);
      return {
        resolved: true,
        resolution: RESOLUTION_TYPES.LOCAL_WINS,
        reason: "Work started before cancellation",
      };
    }

    // Cancellation came first - server wins
    await conflict.resolve(RESOLUTION_TYPES.SERVER_WINS);

    // Mark job as cancelled locally
    const job = await this._getJob(conflict.jobId);
    if (job) {
      await database.write(async () => {
        await job.update((j) => {
          j.status = "cancelled";
          j.locked = true;
          j.requiresSync = false;
        });
      });
    }

    return {
      resolved: true,
      resolution: RESOLUTION_TYPES.SERVER_WINS,
      reason: "Cancellation occurred before work started",
    };
  }

  /**
   * Resolve multi-cleaner conflict
   * Rule: Merge room-scoped data, each cleaner's work is preserved
   */
  async _resolveMultiCleaner(conflict) {
    // For multi-cleaner, we merge data
    // Each cleaner's checklist items and photos are room-scoped
    // and can coexist

    await conflict.resolve(RESOLUTION_TYPES.MERGED);

    return {
      resolved: true,
      resolution: RESOLUTION_TYPES.MERGED,
      reason: "Room-scoped data merged from multiple cleaners",
    };
  }

  /**
   * Resolve data mismatch conflict
   * Rule: Most recent timestamp wins
   */
  async _resolveDataMismatch(conflict) {
    const localData = conflict.localData || {};
    const serverData = conflict.serverData || {};

    const localTime = localData.updatedAt ? new Date(localData.updatedAt).getTime() : 0;
    const serverTime = serverData.updatedAt ? new Date(serverData.updatedAt).getTime() : 0;

    let resolution;
    let reason;

    if (localTime >= serverTime) {
      resolution = RESOLUTION_TYPES.LOCAL_WINS;
      reason = "Local data is more recent";
    } else {
      resolution = RESOLUTION_TYPES.SERVER_WINS;
      reason = "Server data is more recent";
    }

    await conflict.resolve(resolution);
    await this._applyResolution(conflict, resolution);

    return { resolved: true, resolution, reason };
  }

  /**
   * Apply a resolution to the job
   */
  async _applyResolution(conflict, resolution) {
    const job = await this._getJob(conflict.jobId);
    if (!job) return;

    switch (resolution) {
      case RESOLUTION_TYPES.LOCAL_WINS:
        // Keep local data, continue syncing
        break;

      case RESOLUTION_TYPES.SERVER_WINS:
        // Discard local changes, refresh from server
        await database.write(async () => {
          await job.update((j) => {
            j.requiresSync = false;
            // Server data would be refreshed on next preload
          });
        });
        break;

      case RESOLUTION_TYPES.MERGED:
        // Both data sets are kept (handled at sync level)
        break;
    }
  }

  /**
   * Get job by local ID
   */
  async _getJob(localJobId) {
    try {
      return await offlineJobsCollection.find(localJobId);
    } catch {
      return null;
    }
  }

  /**
   * Get conflict summary for UI display
   */
  async getConflictSummary() {
    const unresolved = await this.getUnresolvedConflicts();

    const summary = {
      total: unresolved.length,
      cancellations: 0,
      multiCleaner: 0,
      dataMismatch: 0,
    };

    unresolved.forEach((c) => {
      switch (c.conflictType) {
        case CONFLICT_TYPES.CANCELLATION:
          summary.cancellations++;
          break;
        case CONFLICT_TYPES.MULTI_CLEANER:
          summary.multiCleaner++;
          break;
        case CONFLICT_TYPES.DATA_MISMATCH:
          summary.dataMismatch++;
          break;
      }
    });

    return summary;
  }

  /**
   * Auto-resolve all conflicts
   */
  async autoResolveAll() {
    const unresolved = await this.getUnresolvedConflicts();
    const results = [];

    for (const conflict of unresolved) {
      const result = await this.autoResolve(conflict);
      results.push({
        conflictId: conflict.id,
        ...result,
      });
    }

    return results;
  }
}

// Export singleton
export default new ConflictResolver();
