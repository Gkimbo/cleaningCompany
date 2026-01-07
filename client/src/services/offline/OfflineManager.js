import database, {
  offlineJobsCollection,
  offlineChecklistItemsCollection,
  syncQueueCollection,
  isOfflineAvailable,
} from "./database";
import NetworkMonitor from "./NetworkMonitor";
import PhotoStorage from "./PhotoStorage";
import { PRELOAD_DAYS_AHEAD, OFFLINE_JOB_STATUS, MAX_OFFLINE_DURATION_MS } from "./constants";
import { SYNC_OPERATION_TYPES, OPERATION_SEQUENCE, SYNC_STATUS } from "./database/models/SyncQueue";
import BusinessEmployeeService from "../fetchRequests/BusinessEmployeeService";

class OfflineManager {
  constructor() {
    this._initialized = false;
    this._authToken = null;
    this._lastPreloadTime = null;
    this._preloadInProgress = false;
  }

  // Check if offline functionality is available
  get isAvailable() {
    return isOfflineAvailable;
  }

  // Initialize the offline manager with auth token
  async initialize(authToken) {
    if (this._initialized) return;
    if (!isOfflineAvailable) {
      console.warn("Offline manager: database not available (running in Expo Go)");
      return;
    }

    this._authToken = authToken;

    // Initialize photo storage
    await PhotoStorage.initialize();

    this._initialized = true;

    // Do initial preload if online
    if (NetworkMonitor.isOnline) {
      await this.preloadJobs();
    }
  }

  // Update auth token (e.g., after token refresh)
  setAuthToken(authToken) {
    this._authToken = authToken;
  }

  // Preload jobs for today and tomorrow
  async preloadJobs() {
    if (!isOfflineAvailable || !this._authToken || this._preloadInProgress) return;

    this._preloadInProgress = true;

    try {
      // Fetch upcoming jobs from server
      const { jobs } = await BusinessEmployeeService.getMyJobs(this._authToken, {
        upcoming: true,
      });

      if (!jobs || !Array.isArray(jobs)) {
        this._preloadInProgress = false;
        return;
      }

      // Filter to only today and tomorrow
      const now = new Date();
      const maxDate = new Date(now);
      maxDate.setDate(maxDate.getDate() + PRELOAD_DAYS_AHEAD);

      const upcomingJobs = jobs.filter((job) => {
        const jobDate = new Date(job.appointment?.dateTime || job.scheduledTime);
        return jobDate >= now && jobDate <= maxDate;
      });

      // Save/update jobs in local database
      await database.write(async () => {
        for (const job of upcomingJobs) {
          const serverId = job.id;

          // Check if job already exists locally
          const existingJobs = await offlineJobsCollection.query().fetch();
          const existing = existingJobs.find((j) => j.serverId === serverId);

          if (existing) {
            // Update existing job if not modified locally
            if (!existing.requiresSync) {
              await existing.update((j) => {
                j._raw.job_data = JSON.stringify(this._formatJobData(job));
                j._raw.updated_at = Date.now();
              });
            }
          } else {
            // Create new local job
            await offlineJobsCollection.create((j) => {
              j.serverId = serverId;
              j.appointmentId = job.appointmentId;
              j.status = job.status || OFFLINE_JOB_STATUS.ASSIGNED;
              j._raw.job_data = JSON.stringify(this._formatJobData(job));
              j.requiresSync = false;
              j.locked = false;
              j._raw.created_at = Date.now();
              j._raw.updated_at = Date.now();
            });
          }
        }
      });

      this._lastPreloadTime = new Date();
    } catch (error) {
      console.error("Failed to preload jobs:", error);
    } finally {
      this._preloadInProgress = false;
    }
  }

  // Format job data for local storage
  _formatJobData(job) {
    return {
      appointment: job.appointment,
      home: job.appointment?.home,
      homeowner: job.appointment?.user,
      scheduledTime: job.appointment?.dateTime,
      status: job.status,
      paymentAmount: job.paymentAmount,
      isSelfAssignment: job.isSelfAssignment,
      businessOwner: job.businessOwner,
      checklist: job.checklist || [],
    };
  }

  // Get locally stored jobs
  async getLocalJobs(filters = {}) {
    if (!isOfflineAvailable) return [];
    const jobs = await offlineJobsCollection.query().fetch();

    let filtered = jobs;

    if (filters.status) {
      filtered = filtered.filter((j) => j.status === filters.status);
    }

    if (filters.upcoming) {
      const now = new Date();
      filtered = filtered.filter((j) => {
        const data = j.jobData;
        const scheduledTime = new Date(data?.scheduledTime);
        return scheduledTime >= now;
      });
    }

    return filtered;
  }

  // Get a specific local job by server ID
  async getLocalJob(serverId) {
    if (!isOfflineAvailable) return null;
    const jobs = await offlineJobsCollection.query().fetch();
    return jobs.find((j) => j.serverId === serverId);
  }

  // Start a job (offline-capable)
  async startJob(serverId, locationData = {}) {
    const job = await this.getLocalJob(serverId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.locked) {
      throw new Error("Job is locked and cannot be modified");
    }

    await database.write(async () => {
      // Update job status
      await job.update((j) => {
        j.status = OFFLINE_JOB_STATUS.STARTED;
        j._raw.started_at = Date.now();
        j.startLatitude = locationData.latitude || null;
        j.startLongitude = locationData.longitude || null;
        j.requiresSync = true;
        j._raw.updated_at = Date.now();
      });

      // Add to sync queue
      await syncQueueCollection.create((op) => {
        op.jobId = job.id;
        op.operationType = SYNC_OPERATION_TYPES.START;
        op.sequenceNumber = OPERATION_SEQUENCE[SYNC_OPERATION_TYPES.START];
        op._raw.payload = JSON.stringify({
          serverId,
          startedAt: Date.now(),
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        });
        op.status = SYNC_STATUS.PENDING;
        op.attempts = 0;
        op._raw.created_at = Date.now();
        op._raw.updated_at = Date.now();
      });
    });

    return job;
  }

  // Complete a job (offline-capable)
  async completeJob(serverId, hoursWorked = null) {
    const job = await this.getLocalJob(serverId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.locked) {
      throw new Error("Job is already completed and locked");
    }

    await database.write(async () => {
      // Update job status and lock it
      await job.update((j) => {
        j.status = OFFLINE_JOB_STATUS.COMPLETED;
        j._raw.completed_at = Date.now();
        j.requiresSync = true;
        j.locked = true; // Lock after completion
        j._raw.updated_at = Date.now();
      });

      // Add to sync queue
      await syncQueueCollection.create((op) => {
        op.jobId = job.id;
        op.operationType = SYNC_OPERATION_TYPES.COMPLETE;
        op.sequenceNumber = OPERATION_SEQUENCE[SYNC_OPERATION_TYPES.COMPLETE];
        op._raw.payload = JSON.stringify({
          serverId,
          completedAt: Date.now(),
          hoursWorked,
        });
        op.status = SYNC_STATUS.PENDING;
        op.attempts = 0;
        op._raw.created_at = Date.now();
        op._raw.updated_at = Date.now();
      });
    });

    return job;
  }

  // Update checklist item (one-way, can only check, not uncheck)
  async updateChecklistItem(jobId, itemId, completed = true) {
    if (!completed) {
      throw new Error("Checklist items cannot be unchecked");
    }

    const job = await this.getLocalJob(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.locked) {
      throw new Error("Job is locked and cannot be modified");
    }

    // Find or create checklist item
    const items = await offlineChecklistItemsCollection.query().fetch();
    let item = items.find((i) => i.jobId === job.id && i.itemId === itemId);

    if (item && item.completed) {
      return item; // Already completed, no-op
    }

    await database.write(async () => {
      if (item) {
        await item.update((i) => {
          i.completed = true;
          i._raw.completed_at = Date.now();
        });
      } else {
        item = await offlineChecklistItemsCollection.create((i) => {
          i.jobId = job.id;
          i.itemId = itemId;
          i.completed = true;
          i._raw.completed_at = Date.now();
          i._raw.created_at = Date.now();
        });
      }

      // Update job's checklist progress
      await job.update((j) => {
        const progress = j.checklistProgress || {};
        progress[itemId] = { completed: true, completedAt: Date.now() };
        j._raw.checklist_progress = JSON.stringify(progress);
        j.requiresSync = true;
        j._raw.updated_at = Date.now();
      });

      // Add to sync queue if not already queued
      await syncQueueCollection.create((op) => {
        op.jobId = job.id;
        op.operationType = SYNC_OPERATION_TYPES.CHECKLIST;
        op.sequenceNumber = OPERATION_SEQUENCE[SYNC_OPERATION_TYPES.CHECKLIST];
        op._raw.payload = JSON.stringify({
          serverId: job.serverId,
          itemId,
          completed: true,
          completedAt: Date.now(),
        });
        op.status = SYNC_STATUS.PENDING;
        op.attempts = 0;
        op._raw.created_at = Date.now();
        op._raw.updated_at = Date.now();
      });
    });

    return item;
  }

  // Get data freshness info
  getDataFreshness() {
    if (!this._lastPreloadTime) {
      return { isFresh: false, lastUpdated: null, ageMs: null };
    }

    const ageMs = Date.now() - this._lastPreloadTime.getTime();
    const isFresh = ageMs < 15 * 60 * 1000; // Consider data fresh if less than 15 minutes old

    return {
      isFresh,
      lastUpdated: this._lastPreloadTime,
      ageMs,
      formattedAge: this._formatAge(ageMs),
    };
  }

  // Format age in human readable format
  _formatAge(ms) {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  // Check if we've exceeded max offline duration
  async checkOfflineDuration(offlineSince) {
    if (!offlineSince) return { exceeded: false };

    const duration = Date.now() - offlineSince.getTime();
    return {
      exceeded: duration >= MAX_OFFLINE_DURATION_MS,
      duration,
      formattedDuration: this._formatAge(duration),
    };
  }

  // Clean up completed synced jobs (older than 24 hours)
  async cleanupOldJobs() {
    if (!isOfflineAvailable) return;
    const jobs = await offlineJobsCollection.query().fetch();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    await database.write(async () => {
      for (const job of jobs) {
        if (
          job.status === OFFLINE_JOB_STATUS.COMPLETED &&
          !job.requiresSync &&
          job.completedAt &&
          job.completedAt.getTime() < oneDayAgo
        ) {
          // Clean up photos first
          await PhotoStorage.cleanupUploadedPhotos(job.id);

          // Then delete the job
          await job.markAsDeleted();
        }
      }
    });
  }

  // Reset all offline data (for debugging/logout)
  async reset() {
    if (isOfflineAvailable && database) {
      await database.write(async () => {
        await database.unsafeResetDatabase();
      });
    }
    await PhotoStorage.clearAllPhotos();
    this._lastPreloadTime = null;
    this._initialized = false;
  }
}

// Export singleton instance
export default new OfflineManager();
