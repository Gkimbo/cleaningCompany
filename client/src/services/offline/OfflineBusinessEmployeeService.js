/**
 * OfflineBusinessEmployeeService
 * Offline-aware wrapper around BusinessEmployeeService
 * Falls back to local data when offline
 */

import BusinessEmployeeService from "../fetchRequests/BusinessEmployeeService";
import OfflineManager from "./OfflineManager";
import NetworkMonitor from "./NetworkMonitor";
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
        OfflineManager.preloadJobs().catch(console.error);
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
        if (result.success) {
          // Update local data to match
          const localJob = await OfflineManager.getLocalJob(assignmentId);
          if (localJob) {
            await localJob.update((j) => {
              j.status = OFFLINE_JOB_STATUS.STARTED;
              j._raw.started_at = Date.now();
              j.requiresSync = false;
            });
          }
          return result;
        }
        return result;
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
            await localJob.update((j) => {
              j.status = OFFLINE_JOB_STATUS.COMPLETED;
              j._raw.completed_at = Date.now();
              j.locked = true;
              j.requiresSync = false;
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
      checklist: jobData.checklist,
      // Offline-specific fields
      isLocalData: true,
      requiresSync: localJob.requiresSync,
      locked: localJob.locked,
      checklistProgress: localJob.checklistProgress,
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
