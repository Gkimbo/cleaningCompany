import { Q } from "@nozbe/watermelondb";
import database, {
  offlineJobsCollection,
  offlineChecklistItemsCollection,
  syncQueueCollection,
  syncConflictsCollection,
  isOfflineAvailable,
} from "./database";
import NetworkMonitor from "./NetworkMonitor";
import PhotoStorage from "./PhotoStorage";
import { PRELOAD_DAYS_AHEAD, OFFLINE_JOB_STATUS, MAX_OFFLINE_DURATION_MS, ONE_DAY_MS, DATA_FRESHNESS_THRESHOLD_MS } from "./constants";
import { SYNC_OPERATION_TYPES, OPERATION_SEQUENCE, SYNC_STATUS } from "./database/models/SyncQueue";
import { CONFLICT_TYPES } from "./database/models/SyncConflict";
import BusinessEmployeeService from "../fetchRequests/BusinessEmployeeService";

// Maximum time for preload before auto-reset (2 minutes)
const PRELOAD_TIMEOUT_MS = 2 * 60 * 1000;
// Timeout for individual fetch operations (30 seconds)
const FETCH_OPERATION_TIMEOUT_MS = 30 * 1000;

// Utility to wrap a promise with a timeout
// Properly cleans up the timer to prevent memory leaks and test warnings
const withTimeout = (promise, timeoutMs, operationName = "Operation") => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
};

class OfflineManager {
  constructor() {
    this._initialized = false;
    this._authToken = null;
    this._lastPreloadTime = null;
    this._preloadInProgress = false;
    this._preloadStartTime = null; // Track when preload started to detect stuck state
    // Generation counter to track preload ownership - reset at 1 million to prevent overflow
    // (JavaScript's MAX_SAFE_INTEGER is 9007199254740991, but we reset early for safety)
    this._preloadGeneration = 0;
    this._maxPreloadGeneration = 1000000;
  }

  // Check if offline functionality is available
  get isAvailable() {
    return isOfflineAvailable;
  }

  // Initialize the offline manager with auth token
  async initialize(authToken) {
    if (this._initialized) return;
    if (!isOfflineAvailable) {
      console.log("[OfflineManager] Database not available (running in Expo Go)");
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
    if (!isOfflineAvailable || !this._authToken) return;

    // Check if a previous preload is stuck (exceeded timeout)
    if (this._preloadInProgress) {
      const elapsed = this._preloadStartTime ? Date.now() - this._preloadStartTime : 0;
      if (elapsed < PRELOAD_TIMEOUT_MS) {
        // Preload is still in progress and within timeout - skip
        console.log("[OfflineManager] Preload already in progress, skipping");
        return;
      }
      // Preload exceeded timeout - reset and allow new preload
      // Note: The old preload is still running but we'll let THIS preload take over
      console.warn(`[OfflineManager] Previous preload stuck for ${elapsed}ms, starting new preload`);
      // Don't reset _preloadInProgress here - increment generation instead
    }

    // Increment generation to track this preload instance
    // This ensures only THIS preload can clear the flag in finally
    // Reset counter if it exceeds max to prevent overflow (very unlikely but safe)
    if (this._preloadGeneration >= this._maxPreloadGeneration) {
      this._preloadGeneration = 0;
    }
    const currentGeneration = ++this._preloadGeneration;

    this._preloadInProgress = true;
    this._preloadStartTime = Date.now();

    try {
      // Fetch upcoming jobs from server with timeout protection
      const jobsResponse = await withTimeout(
        BusinessEmployeeService.getMyJobs(this._authToken, { upcoming: true }),
        FETCH_OPERATION_TIMEOUT_MS,
        "Fetch jobs"
      );
      const jobs = jobsResponse?.jobs;

      if (!jobs || !Array.isArray(jobs)) {
        // Only clear flag if this preload is still the current one
        if (currentGeneration === this._preloadGeneration) {
          this._preloadInProgress = false;
          this._preloadStartTime = null;
        }
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

      // Fetch job flows for all upcoming jobs in parallel with timeout protection
      // This includes photo requirements AND checklist data - critical for offline mode
      // Use Promise.allSettled to handle individual failures gracefully
      const flowPromises = upcomingJobs.map(async (job) => {
        const flowData = await withTimeout(
          BusinessEmployeeService.getJobFlow(this._authToken, job.id),
          FETCH_OPERATION_TIMEOUT_MS,
          `Fetch job flow ${job.id}`
        );
        return { jobId: job.id, flow: flowData };
      });

      const flowSettled = await Promise.allSettled(flowPromises);
      const flowsByJobId = new Map();
      const failedFlowJobs = [];

      flowSettled.forEach((result, index) => {
        // Bounds check - ensure index is within upcomingJobs array
        if (index >= upcomingJobs.length) {
          console.error(`[OfflineManager] Flow result index ${index} out of bounds (${upcomingJobs.length} jobs)`);
          return;
        }
        const job = upcomingJobs[index];
        if (result.status === "fulfilled") {
          // Validate that the fulfilled result's jobId matches the expected job
          // This catches any potential ordering/mapping issues
          if (result.value.jobId !== job.id) {
            console.error(
              `[OfflineManager] Job ID mismatch at index ${index}: expected ${job.id}, got ${result.value.jobId}`
            );
            // Use the result's jobId since that's what the server returned
          }
          flowsByJobId.set(result.value.jobId, result.value.flow);
        } else {
          // Track failed flows but still allow job to be saved with null flow
          console.warn(`[OfflineManager] Failed to fetch job flow for job ${job.id}:`, result.reason);
          flowsByJobId.set(job.id, null);
          failedFlowJobs.push(job.id);
        }
      });

      if (failedFlowJobs.length > 0) {
        console.warn(`[OfflineManager] ${failedFlowJobs.length} job flows failed to fetch`);
      }

      // Fetch all existing jobs once (outside the write block for efficiency)
      const existingJobs = await offlineJobsCollection.query().fetch();
      const existingJobsByServerId = new Map(existingJobs.map((j) => [j.serverId, j]));

      // Save/update jobs in local database
      // Process each job individually to allow partial success
      const saveResults = { saved: 0, updated: 0, failed: 0, errors: [] };

      for (const job of upcomingJobs) {
        // CRITICAL: Check if a newer preload has started
        // If so, stop processing to avoid conflicting writes with the new preload
        if (currentGeneration !== this._preloadGeneration) {
          console.log(`[OfflineManager] Preload generation ${currentGeneration} superseded, stopping job processing`);
          saveResults.aborted = true;
          break;
        }

        const serverId = job.id;
        const flowData = flowsByJobId.get(serverId);
        const flowLoadFailed = failedFlowJobs.includes(serverId);
        const existingFromCache = existingJobsByServerId.get(serverId);
        const serverStatus = job.status;

        try {
          await database.write(async () => {
            // CRITICAL: Re-fetch the job inside the write block to get the CURRENT state
            // This prevents race condition where user modifies job between our initial fetch
            // (line 154) and this write block. Without this, we could overwrite user's changes
            // that occurred during the preload operation.
            let existing = existingFromCache;
            let jobWasDeleted = false;
            if (existingFromCache) {
              try {
                existing = await offlineJobsCollection.find(existingFromCache.id);
              } catch (refetchError) {
                // Job was deleted between fetch and now - DO NOT recreate it
                // This respects user's intentional deletion and prevents data duplication
                console.warn(`[OfflineManager] Job ${serverId} was deleted during preload, skipping (not recreating)`);
                jobWasDeleted = true;
              }
            }

            // Skip jobs that were intentionally deleted - don't resurrect them
            if (jobWasDeleted) {
              saveResults.skipped = (saveResults.skipped || 0) + 1;
              return; // Skip to next job in the loop
            }

            if (existing) {
              // CRITICAL: Check for server cancellation even when we have local changes
              // This prevents silent data loss where user doesn't know job was cancelled
              if (serverStatus === "cancelled" && existing.requiresSync) {
                console.warn(`[OfflineManager] Job ${serverId} was cancelled on server but has local changes`);
                // Create conflict to alert user - their work may be lost
                await syncConflictsCollection.create((conflict) => {
                  conflict.jobId = existing.id;
                  conflict.conflictType = CONFLICT_TYPES.CANCELLATION;
                  conflict._raw.local_data = JSON.stringify({
                    status: existing.status,
                    startedAt: existing.startedAt,
                    completedAt: existing.completedAt,
                    requiresSync: true,
                  });
                  conflict._raw.server_data = JSON.stringify({
                    status: serverStatus,
                    cancelledAt: job.cancelledAt,
                    reason: "Detected during preload - job cancelled while offline changes pending",
                  });
                  conflict.resolved = false;
                  conflict._raw.created_at = Date.now();
                });
                // Update job with cancellation flag so UI can show warning
                await existing.update((j) => {
                  j._raw.server_cancelled = true;
                  j._raw.server_cancelled_at = job.cancelledAt || Date.now();
                  j._raw.updated_at = Date.now();
                });
                saveResults.updated++;
              } else if (!existing.requiresSync) {
                // Normal update for jobs without local changes
                await existing.update((j) => {
                  j._raw.job_data = JSON.stringify(this._formatJobData(job, flowData, flowLoadFailed));
                  j._raw.updated_at = Date.now();
                  // Clear any previous cancellation flags if job is no longer cancelled
                  if (serverStatus !== "cancelled") {
                    j._raw.server_cancelled = false;
                  }
                });
                saveResults.updated++;
              } else {
                // EXPLICIT: requiresSync is true and server status is not cancelled
                // Preserve local changes - do NOT overwrite with server data
                // This is intentional to prevent data loss from unsynced user actions
                console.log(`[OfflineManager] Preserving local changes for job ${serverId} (requiresSync=true, serverStatus=${serverStatus})`);
                // Track as skipped in results for debugging
                saveResults.skipped = (saveResults.skipped || 0) + 1;
              }
            } else {
              // Create new local job
              await offlineJobsCollection.create((j) => {
                j.serverId = serverId;
                j.appointmentId = job.appointmentId;
                j.status = job.status || OFFLINE_JOB_STATUS.ASSIGNED;
                j._raw.job_data = JSON.stringify(this._formatJobData(job, flowData, flowLoadFailed));
                j.requiresSync = false;
                j.locked = false;
                j._raw.created_at = Date.now();
                j._raw.updated_at = Date.now();
              });
              saveResults.saved++;
            }
          });
        } catch (jobError) {
          console.error(`[OfflineManager] Failed to save job ${serverId}:`, jobError);
          saveResults.failed++;
          saveResults.errors.push({ jobId: serverId, error: jobError.message });
        }
      }

      // Log preload summary
      const abortedMsg = saveResults.aborted ? " (ABORTED - superseded by newer preload)" : "";
      console.log(
        `[OfflineManager] Preload complete: ${saveResults.saved} new, ${saveResults.updated} updated, ` +
        `${saveResults.skipped || 0} skipped (local changes), ${saveResults.failed} failed${abortedMsg}`
      );

      if (saveResults.failed > 0) {
        console.warn(`[OfflineManager] Preload completed with ${saveResults.failed} failures:`, saveResults.errors);
      }

      // Only update last preload time if not aborted
      if (!saveResults.aborted) {
        this._lastPreloadTime = new Date();
      }
    } catch (error) {
      console.error("[OfflineManager] Failed to preload jobs:", error);
    } finally {
      // Only clear the flag if THIS preload is still the current one
      // This prevents a stale preload from clearing the flag of a newer preload
      if (currentGeneration === this._preloadGeneration) {
        this._preloadInProgress = false;
        this._preloadStartTime = null;
      } else {
        console.log(`[OfflineManager] Preload generation ${currentGeneration} superseded by ${this._preloadGeneration}, not clearing flag`);
      }
    }
  }

  // Format job data for local storage
  // flowData can be: object (success), null (failed to fetch), or undefined (not attempted)
  _formatJobData(job, flowData = null, flowLoadFailed = false) {
    // Guard against null/undefined job object
    if (!job) {
      console.error("[OfflineManager] _formatJobData called with null/undefined job");
      return {
        appointment: null,
        home: null,
        homeowner: null,
        scheduledTime: null,
        status: "unknown",
        flowDataLoaded: false,
        flowLoadFailed: true,
        hasJobFlow: false,
        requirementsUnverified: true,
        requirementsWarning: "Job data unavailable",
      };
    }

    // Safely access appointment data (may be missing in malformed jobs)
    const appointment = job.appointment || {};

    return {
      appointment: job.appointment,
      home: appointment.home || null,
      homeowner: appointment.user || null,
      scheduledTime: appointment.dateTime || null,
      status: job.status || "unknown",
      paymentAmount: job.paymentAmount,
      isSelfAssignment: job.isSelfAssignment,
      businessOwner: job.businessOwner,

      // Flow data status - helps UI know if data is complete
      flowDataLoaded: flowData !== null && !flowLoadFailed,
      flowLoadFailed: flowLoadFailed,

      // Job flow metadata
      hasJobFlow: flowData?.hasJobFlow || false,
      appointmentJobFlowId: flowData?.appointmentJobFlowId || null,
      isMarketplaceFlow: flowData?.isMarketplaceFlow || false,

      // Photo requirements from business owner settings
      // Default to "optional" when flow data unavailable so user can still work offline
      photoRequirement: flowData?.photoRequirement || "optional",
      requiresPhotos: flowData?.requiresPhotos || false,
      photosHidden: flowData?.photosHidden || false,
      beforePhotoCount: flowData?.beforePhotoCount || 0,
      afterPhotoCount: flowData?.afterPhotoCount || 0,
      photosCompleted: flowData?.photosCompleted || false,

      // Checklist data
      hasChecklist: flowData?.hasChecklist || false,
      checklist: flowData?.checklist || job.checklist || null,
      checklistProgress: flowData?.checklistProgress || {},
      checklistCompleted: flowData?.checklistCompleted || false,
      checklistCompletionPercentage: flowData?.checklistCompletionPercentage || 0,

      // Notes
      jobNotes: flowData?.jobNotes || null,
      employeeNotes: flowData?.employeeNotes || null,

      // Completion status - be more conservative when flow data failed to load
      // If flowLoadFailed, we don't know the actual requirements, so flag it
      canComplete: flowLoadFailed ? true : (flowData?.canComplete ?? true),
      missingRequirements: flowData?.missingRequirements || [],
      // New flag: indicates requirements couldn't be verified due to flow load failure
      requirementsUnverified: flowLoadFailed,
      requirementsWarning: flowLoadFailed
        ? "Could not verify job requirements. Some requirements may apply when you sync."
        : null,
    };
  }

  // Get cached checklist for a job
  async getLocalChecklist(serverId) {
    const job = await this.getLocalJob(serverId);
    if (!job) return null;

    const jobData = job.jobData || {};
    return {
      checklist: jobData.checklist || [],
      progress: job.checklistProgress || jobData.checklistProgress || {},
      checklistCompleted: jobData.checklistCompleted || false,
      jobNotes: jobData.jobNotes || null,
      hasChecklist: jobData.hasChecklist || false,
      itemCount: jobData.itemCount || 0,
      completedCount: jobData.completedCount || 0,
      completionPercentage: jobData.checklistCompletionPercentage || 0,
      isOfflineData: true,
    };
  }

  // Get cached job flow (includes photo requirements and checklist)
  async getLocalJobFlow(serverId) {
    const job = await this.getLocalJob(serverId);
    if (!job) return null;

    const jobData = job.jobData || {};
    return {
      // Job flow metadata
      hasJobFlow: jobData.hasJobFlow || false,
      appointmentJobFlowId: jobData.appointmentJobFlowId || null,
      isMarketplaceFlow: jobData.isMarketplaceFlow || false,

      // Photo requirements
      photoRequirement: jobData.photoRequirement || "optional",
      requiresPhotos: jobData.requiresPhotos || false,
      photosHidden: jobData.photosHidden || false,
      beforePhotoCount: jobData.beforePhotoCount || 0,
      afterPhotoCount: jobData.afterPhotoCount || 0,
      photosCompleted: jobData.photosCompleted || false,

      // Checklist
      hasChecklist: jobData.hasChecklist || false,
      checklist: jobData.checklist || null,
      checklistProgress: job.checklistProgress || jobData.checklistProgress || {},
      checklistCompleted: jobData.checklistCompleted || false,
      checklistCompletionPercentage: jobData.checklistCompletionPercentage || 0,

      // Notes
      jobNotes: jobData.jobNotes || null,
      employeeNotes: jobData.employeeNotes || null,

      // Completion
      canComplete: jobData.canComplete ?? true,
      missingRequirements: jobData.missingRequirements || [],

      isOfflineData: true,
    };
  }

  // Check if offline storage is available
  // Use this before getLocalJobs to distinguish "offline unavailable" from "no jobs"
  isOfflineAvailable() {
    return isOfflineAvailable;
  }

  // Get locally stored jobs
  // Returns empty array if offline unavailable OR no jobs match filters
  // Use isOfflineAvailable() to distinguish these cases if needed
  async getLocalJobs(filters = {}) {
    if (!isOfflineAvailable) {
      console.warn("[OfflineManager] getLocalJobs called but offline storage is not available");
      return [];
    }
    const jobs = await offlineJobsCollection.query().fetch();

    // Validate filters object
    if (!filters || typeof filters !== "object") {
      return jobs;
    }

    let filtered = jobs;

    // Validate status filter - must be a non-empty string
    if (filters.status && typeof filters.status === "string") {
      filtered = filtered.filter((j) => j.status === filters.status);
    }

    if (filters.upcoming) {
      const now = new Date();
      filtered = filtered.filter((j) => {
        const data = j.jobData;
        const scheduledTime = new Date(data?.scheduledTime);
        // Validate parsed date is valid
        return !isNaN(scheduledTime.getTime()) && scheduledTime >= now;
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

  // Get a specific local job by appointment ID
  async getLocalJobByAppointmentId(appointmentId) {
    if (!isOfflineAvailable) return null;
    const jobs = await offlineJobsCollection.query().fetch();
    return jobs.find((j) => j.appointmentId === appointmentId);
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

    // Validate and sanitize locationData
    const sanitizedLocation = this._sanitizeLocationData(locationData);

    await database.write(async () => {
      // Update job status
      await job.update((j) => {
        j.status = OFFLINE_JOB_STATUS.STARTED;
        j._raw.started_at = Date.now();
        j.startLatitude = sanitizedLocation.latitude;
        j.startLongitude = sanitizedLocation.longitude;
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
          latitude: sanitizedLocation.latitude,
          longitude: sanitizedLocation.longitude,
        });
        op.status = SYNC_STATUS.PENDING;
        op.attempts = 0;
        op._raw.created_at = Date.now();
        op._raw.updated_at = Date.now();
      });
    });

    return job;
  }

  // Validate and sanitize location data
  _sanitizeLocationData(locationData) {
    // Handle null/undefined input
    if (!locationData || typeof locationData !== "object") {
      return { latitude: null, longitude: null };
    }

    // Validate latitude (-90 to 90)
    const lat = parseFloat(locationData.latitude);
    const validLat = !isNaN(lat) && lat >= -90 && lat <= 90 ? lat : null;

    // Validate longitude (-180 to 180)
    const lng = parseFloat(locationData.longitude);
    const validLng = !isNaN(lng) && lng >= -180 && lng <= 180 ? lng : null;

    return {
      latitude: validLat,
      longitude: validLng,
    };
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
  async updateChecklistItem(jobId, sectionId, itemId, completed = true) {
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

      // Check if there's already a pending/failed sync operation for this checklist item
      const existingOps = await syncQueueCollection
        .query(
          Q.where("job_id", job.id),
          Q.where("operation_type", SYNC_OPERATION_TYPES.CHECKLIST),
          Q.where("status", Q.oneOf([SYNC_STATUS.PENDING, SYNC_STATUS.ERROR]))
        )
        .fetch();

      // Find one with matching itemId in payload
      const existingOp = existingOps.find((op) => {
        try {
          const payload = typeof op.payload === "string" ? JSON.parse(op.payload) : op.payload;
          return payload && payload.itemId === itemId;
        } catch {
          return false;
        }
      });

      if (existingOp) {
        // Reset existing operation instead of creating duplicate
        await existingOp.update((op) => {
          op.status = SYNC_STATUS.PENDING;
          op.attempts = 0;
          op._raw.updated_at = Date.now();
        });
      } else {
        // Add to sync queue (no existing operation found)
        await syncQueueCollection.create((op) => {
          op.jobId = job.id;
          op.operationType = SYNC_OPERATION_TYPES.CHECKLIST;
          op.sequenceNumber = OPERATION_SEQUENCE[SYNC_OPERATION_TYPES.CHECKLIST];
          op._raw.payload = JSON.stringify({
            serverId: job.serverId,
            sectionId,
            itemId,
            completed: true,
            completedAt: Date.now(),
          });
          op.status = SYNC_STATUS.PENDING;
          op.attempts = 0;
          op._raw.created_at = Date.now();
          op._raw.updated_at = Date.now();
        });
      }
    });

    return item;
  }

  // Submit a home size mismatch report (offline-capable)
  // jobIdOrAppointmentId can be either the job's server ID or the appointment ID
  async submitHomeSizeMismatch(jobIdOrAppointmentId, mismatchData) {
    // Try to find job by server ID first, then by appointment ID
    let job = await this.getLocalJob(jobIdOrAppointmentId);
    if (!job) {
      job = await this.getLocalJobByAppointmentId(jobIdOrAppointmentId);
    }
    if (!job) {
      throw new Error("Job not found");
    }

    const {
      appointmentId,
      reportedNumBeds,
      reportedNumBaths,
      cleanerNote,
      photos, // Array of { roomType, roomNumber, photoData (base64) }
    } = mismatchData;

    try {
      // Use the job's actual server ID for consistency
      const jobServerId = job.serverId;

      // Save photos to local storage
      const savedPhotos = [];
      for (const photo of photos) {
        const savedPhoto = await PhotoStorage.saveMismatchPhoto(
          photo.photoData,
          jobServerId,
          photo.roomType,
          photo.roomNumber
        );
        savedPhotos.push({
          id: savedPhoto.id,
          localUri: savedPhoto.localUri,
          roomType: savedPhoto.roomType,
          roomNumber: savedPhoto.roomNumber,
        });
      }

      // Create sync queue entry for the mismatch report
      await database.write(async () => {
        await syncQueueCollection.create((op) => {
          op.jobId = job.id;
          op.operationType = SYNC_OPERATION_TYPES.HOME_SIZE_MISMATCH;
          op.sequenceNumber = OPERATION_SEQUENCE[SYNC_OPERATION_TYPES.HOME_SIZE_MISMATCH];
          op._raw.payload = JSON.stringify({
            serverId: jobServerId,
            appointmentId,
            reportedNumBeds,
            reportedNumBaths,
            cleanerNote,
            photos: savedPhotos,
          });
          op.status = SYNC_STATUS.PENDING;
          op.attempts = 0;
          op._raw.created_at = Date.now();
          op._raw.updated_at = Date.now();
        });

        // Mark job as requiring sync
        await job.update((j) => {
          j.requiresSync = true;
          j._raw.updated_at = Date.now();
        });
      });

      return {
        success: true,
        queuedForSync: true,
        photoCount: savedPhotos.length,
      };
    } catch (error) {
      console.error("[OfflineManager] Failed to queue mismatch report:", error);
      throw error;
    }
  }

  // Get data freshness info
  getDataFreshness() {
    if (!this._lastPreloadTime) {
      return { isFresh: false, lastUpdated: null, ageMs: null };
    }

    const ageMs = Date.now() - this._lastPreloadTime.getTime();
    const isFresh = ageMs < DATA_FRESHNESS_THRESHOLD_MS;

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
    const oneDayAgo = Date.now() - ONE_DAY_MS;

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

  // Get count of pending sync operations (for logout warning)
  async getPendingSyncCount() {
    if (!isOfflineAvailable) return 0;
    try {
      const allOperations = await syncQueueCollection.query().fetch();
      return allOperations.filter(
        (op) => op.status === "pending" || (op.status === "failed" && op.canRetry)
      ).length;
    } catch (error) {
      console.error("[OfflineManager] Error getting pending sync count:", error);
      return 0;
    }
  }

  // Get summary of pending operations for UI display
  async getPendingSyncSummary() {
    if (!isOfflineAvailable) return { pendingCount: 0, failedCount: 0, byType: {} };
    try {
      const allOperations = await syncQueueCollection.query().fetch();
      const pending = allOperations.filter((op) => op.status === "pending");
      const failed = allOperations.filter(
        (op) => op.status === "failed" && op.canRetry
      );

      // Group by operation type
      const byType = {};
      [...pending, ...failed].forEach((op) => {
        byType[op.operationType] = (byType[op.operationType] || 0) + 1;
      });

      return {
        pendingCount: pending.length,
        failedCount: failed.length,
        totalUnsyncedCount: pending.length + failed.length,
        byType,
      };
    } catch (error) {
      console.error("[OfflineManager] Error getting pending sync summary:", error);
      return { pendingCount: 0, failedCount: 0, byType: {} };
    }
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
