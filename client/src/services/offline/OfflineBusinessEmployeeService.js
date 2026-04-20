/**
 * OfflineBusinessEmployeeService
 * Offline-aware wrapper around BusinessEmployeeService
 * Falls back to local data when offline
 */

import BusinessEmployeeService from "../fetchRequests/BusinessEmployeeService";
import OfflineManager from "./OfflineManager";
import NetworkMonitor from "./NetworkMonitor";
import database from "./database";
import { OFFLINE_JOB_STATUS } from "./constants";

class OfflineBusinessEmployeeService {
  /**
   * Get jobs - uses server when online, local when offline
   */
  static async getMyJobs(token, filters = {}) {
    if (NetworkMonitor.isOnline) {
      try {
        const result = await BusinessEmployeeService.getMyJobs(token, filters);
        // Refresh local cache in background
        OfflineManager.setAuthToken(token);
        OfflineManager.preloadJobs().catch(err => console.error("[OfflineBusinessEmployeeService] Background preload failed:", err));
        return result;
      } catch (error) {
        console.warn("Online fetch failed, falling back to offline data:", error);
      }
    }

    // Fall back to local data
    const localJobs = await OfflineManager.getLocalJobs(filters);
    return {
      jobs: localJobs.map((job) => this._formatLocalJob(job)),
      isOfflineData: true,
      dataFreshness: OfflineManager.getDataFreshness(),
    };
  }

  /**
   * Get job details - uses server when online, local when offline
   */
  static async getJobDetails(token, assignmentId) {
    if (NetworkMonitor.isOnline) {
      try {
        const result = await BusinessEmployeeService.getJobDetails(token, assignmentId);
        return result;
      } catch (error) {
        console.warn("Online fetch failed, falling back to offline data:", error);
      }
    }

    // Fall back to local data
    const localJob = await OfflineManager.getLocalJob(assignmentId);
    if (!localJob) {
      return null;
    }

    return {
      job: this._formatLocalJob(localJob),
      isOfflineData: true,
      dataFreshness: OfflineManager.getDataFreshness(),
    };
  }

  /**
   * Start a job - queues for sync when offline
   */
  static async startJob(token, assignmentId, locationData = {}) {
    if (NetworkMonitor.isOnline) {
      try {
        const result = await BusinessEmployeeService.startJob(token, assignmentId);
        // Validate response structure
        if (!result || typeof result !== "object") {
          console.warn("Online startJob returned invalid response, falling back to offline mode");
          // Fall through to offline handling
        } else if (result.success) {
          // Update local data to match
          const localJob = await OfflineManager.getLocalJob(assignmentId);
          if (localJob) {
            await database.write(async () => {
              await localJob.update((j) => {
                j.status = OFFLINE_JOB_STATUS.STARTED;
                j._raw.started_at = Date.now();
                j.requiresSync = false;
              });
            });
          }
          return result;
        } else {
          // Server returned success: false - return as-is, don't fall back to offline
          return result;
        }
      } catch (error) {
        console.warn("Online start failed, using offline mode:", error);
      }
    }

    // Start job locally and queue for sync
    try {
      await OfflineManager.startJob(assignmentId, locationData);
      return {
        success: true,
        message: "Job started (will sync when online)",
        isOfflineOperation: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        isOfflineOperation: true,
      };
    }
  }

  /**
   * Complete a job - queues for sync when offline
   */
  static async completeJob(token, assignmentId, hoursWorked = null) {
    if (NetworkMonitor.isOnline) {
      try {
        const result = await BusinessEmployeeService.completeJob(token, assignmentId, hoursWorked);
        if (result.success) {
          // Update local data
          const localJob = await OfflineManager.getLocalJob(assignmentId);
          if (localJob) {
            await database.write(async () => {
              await localJob.update((j) => {
                j.status = OFFLINE_JOB_STATUS.COMPLETED;
                j._raw.completed_at = Date.now();
                j.locked = true;
                j.requiresSync = false;
              });
            });
          }
          return result;
        }
        return result;
      } catch (error) {
        console.warn("Online complete failed, using offline mode:", error);
      }
    }

    // Complete job locally and queue for sync
    try {
      await OfflineManager.completeJob(assignmentId, hoursWorked);
      return {
        success: true,
        message: "Job completed (will sync when online)",
        isOfflineOperation: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        isOfflineOperation: true,
      };
    }
  }

  /**
   * Get earnings - requires online, returns cached message if offline
   */
  static async getEarnings(token, startDate = null, endDate = null) {
    if (NetworkMonitor.isOnline) {
      return await BusinessEmployeeService.getEarnings(token, startDate, endDate);
    }

    // Earnings require server connection
    return {
      period: {},
      summary: { totalEarnings: 0, jobCount: 0, paidCount: 0, pendingCount: 0, pendingAmount: 0 },
      formatted: { totalEarnings: "$0.00", pendingAmount: "$0.00" },
      isOfflineData: true,
      message: "Earnings data requires internet connection",
    };
  }

  /**
   * Get profile - requires online, returns null if offline
   */
  static async getProfile(token) {
    if (NetworkMonitor.isOnline) {
      return await BusinessEmployeeService.getProfile(token);
    }

    return {
      isOfflineData: true,
      message: "Profile data requires internet connection",
    };
  }

  /**
   * Get job flow (photo requirements + checklist) - uses server when online, local cache when offline
   */
  static async getJobFlow(token, assignmentId) {
    if (NetworkMonitor.isOnline) {
      try {
        const result = await BusinessEmployeeService.getJobFlow(token, assignmentId);
        if (result) {
          return result;
        }
      } catch (error) {
        console.warn("Online fetch failed, falling back to offline data:", error);
      }
    }

    // Fall back to local cache
    const localFlow = await OfflineManager.getLocalJobFlow(assignmentId);
    if (!localFlow) {
      return {
        hasJobFlow: false,
        photoRequirement: "optional",
        requiresPhotos: false,
        photosHidden: false,
        hasChecklist: false,
        checklist: null,
        isOfflineData: true,
        message: "Job flow not available offline",
      };
    }

    return localFlow;
  }

  /**
   * Get checklist for a job - uses server when online, local cache when offline
   */
  static async getChecklist(token, assignmentId) {
    if (NetworkMonitor.isOnline) {
      try {
        const result = await BusinessEmployeeService.getChecklist(token, assignmentId);
        if (result) {
          return result;
        }
      } catch (error) {
        console.warn("Online fetch failed, falling back to offline data:", error);
      }
    }

    // Fall back to local cache
    const localChecklist = await OfflineManager.getLocalChecklist(assignmentId);
    if (!localChecklist) {
      return {
        checklist: [],
        progress: {},
        checklistCompleted: false,
        hasChecklist: false,
        isOfflineData: true,
        message: "Checklist not available offline",
      };
    }

    return localChecklist;
  }

  /**
   * Update checklist item - queues for sync when offline
   */
  static async updateChecklistItem(token, assignmentId, sectionId, itemId, status) {
    if (NetworkMonitor.isOnline) {
      try {
        const result = await BusinessEmployeeService.updateChecklistItem(token, assignmentId, sectionId, itemId, status);
        if (result.success) {
          return result;
        }
      } catch (error) {
        console.warn("Online update failed, using offline mode:", error);
      }
    }

    // Update locally and queue for sync
    try {
      // For offline, we only support marking items as completed (status = "completed")
      // N/A status requires online because it may have business logic implications
      if (status === "completed") {
        await OfflineManager.updateChecklistItem(assignmentId, sectionId, itemId, true);
        return {
          success: true,
          message: "Checklist updated (will sync when online)",
          isOfflineOperation: true,
        };
      } else {
        return {
          success: false,
          error: "N/A status requires internet connection",
          isOfflineOperation: true,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        isOfflineOperation: true,
      };
    }
  }

  /**
   * Bulk update checklist - queues for sync when offline
   */
  static async bulkUpdateChecklist(token, assignmentId, updates) {
    // Validate updates parameter
    if (!updates || !Array.isArray(updates)) {
      return {
        success: false,
        error: "Updates must be a non-empty array",
        isOfflineOperation: false,
      };
    }

    if (updates.length === 0) {
      return {
        success: true,
        message: "No updates to process",
        isOfflineOperation: false,
        processedCount: 0,
        skippedCount: 0,
      };
    }

    if (NetworkMonitor.isOnline) {
      try {
        const result = await BusinessEmployeeService.bulkUpdateChecklist(token, assignmentId, updates);
        if (result.success) {
          return result;
        }
      } catch (error) {
        console.warn("Online bulk update failed, using offline mode:", error);
      }
    }

    // Update locally and queue for sync
    try {
      // Only process "completed" status updates offline
      const completedUpdates = updates.filter((u) => u.status === "completed");
      for (const update of completedUpdates) {
        await OfflineManager.updateChecklistItem(assignmentId, update.sectionId, update.itemId, true);
      }

      const skippedCount = updates.length - completedUpdates.length;
      return {
        success: true,
        message: `${completedUpdates.length} items updated (will sync when online)${skippedCount > 0 ? `. ${skippedCount} N/A items skipped (require online).` : ""}`,
        isOfflineOperation: true,
        processedCount: completedUpdates.length,
        skippedCount,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        isOfflineOperation: true,
      };
    }
  }

  /**
   * Format a local job to match server format
   */
  static _formatLocalJob(localJob) {
    const jobData = localJob.jobData || {};

    return {
      id: localJob.serverId,
      localId: localJob.id,
      appointmentId: localJob.appointmentId,
      status: localJob.status,
      startedAt: localJob.startedAt,
      completedAt: localJob.completedAt,
      appointment: jobData.appointment,
      home: jobData.home,
      user: jobData.homeowner,
      paymentAmount: jobData.paymentAmount,
      isSelfAssignment: jobData.isSelfAssignment,
      businessOwner: jobData.businessOwner,

      // Offline-specific fields
      isLocalData: true,
      requiresSync: localJob.requiresSync,
      locked: localJob.locked,

      // Job flow metadata
      hasJobFlow: jobData.hasJobFlow,
      appointmentJobFlowId: jobData.appointmentJobFlowId,
      isMarketplaceFlow: jobData.isMarketplaceFlow,

      // Photo requirements from business owner settings
      photoRequirement: jobData.photoRequirement || "optional",
      requiresPhotos: jobData.requiresPhotos || false,
      photosHidden: jobData.photosHidden || false,
      beforePhotoCount: jobData.beforePhotoCount || 0,
      afterPhotoCount: jobData.afterPhotoCount || 0,
      photosCompleted: jobData.photosCompleted || false,

      // Checklist data
      hasChecklist: jobData.hasChecklist,
      checklist: jobData.checklist,
      checklistProgress: localJob.checklistProgress || jobData.checklistProgress,
      checklistCompleted: jobData.checklistCompleted,
      checklistCompletionPercentage: jobData.checklistCompletionPercentage,

      // Notes
      jobNotes: jobData.jobNotes,
      employeeNotes: jobData.employeeNotes,

      // Completion status
      canComplete: jobData.canComplete,
      missingRequirements: jobData.missingRequirements,
    };
  }

  /**
   * Check if data is available for offline use
   */
  static async isDataAvailableOffline(assignmentId) {
    const localJob = await OfflineManager.getLocalJob(assignmentId);
    return !!localJob;
  }

  /**
   * Force refresh local data from server
   */
  static async refreshLocalData(token) {
    if (!NetworkMonitor.isOnline) {
      return { success: false, error: "No internet connection" };
    }

    try {
      OfflineManager.setAuthToken(token);
      await OfflineManager.preloadJobs();
      return { success: true, freshness: OfflineManager.getDataFreshness() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Pass through methods that require online
  static async validateInvite(inviteToken) {
    return BusinessEmployeeService.validateInvite(inviteToken);
  }

  static async acceptInvite(authToken, inviteToken) {
    return BusinessEmployeeService.acceptInvite(authToken, inviteToken);
  }

  static async getStripeStatus(token) {
    return BusinessEmployeeService.getStripeStatus(token);
  }

  static async startStripeOnboarding(token) {
    return BusinessEmployeeService.startStripeOnboarding(token);
  }
}

export default OfflineBusinessEmployeeService;
