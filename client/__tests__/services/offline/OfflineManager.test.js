/**
 * OfflineManager Tests
 *
 * Tests for the main offline orchestration service.
 */

// Unmock OfflineManager so we can test the real implementation
jest.unmock("../../../src/services/offline/OfflineManager");

import { OFFLINE_JOB_STATUS, MAX_OFFLINE_DURATION_MS } from "../../../src/services/offline/constants";

// Mock dependencies
jest.mock("../../../src/services/offline/database", () => ({
  __esModule: true,
  default: {
    write: jest.fn((fn) => fn()),
    unsafeResetDatabase: jest.fn(),
  },
  offlineJobsCollection: {
    query: jest.fn(() => ({
      fetch: jest.fn().mockResolvedValue([]),
    })),
    create: jest.fn(),
    find: jest.fn(),
  },
  offlineChecklistItemsCollection: {
    query: jest.fn(() => ({
      fetch: jest.fn().mockResolvedValue([]),
    })),
    create: jest.fn(),
  },
  syncQueueCollection: {
    create: jest.fn(),
  },
  isOfflineAvailable: true,
}));

jest.mock("../../../src/services/offline/NetworkMonitor", () => ({
  __esModule: true,
  default: {
    isOnline: true,
  },
}));

jest.mock("../../../src/services/offline/PhotoStorage", () => ({
  __esModule: true,
  default: {
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanupUploadedPhotos: jest.fn().mockResolvedValue(undefined),
    clearAllPhotos: jest.fn().mockResolvedValue(undefined),
    saveMismatchPhoto: jest.fn().mockResolvedValue({
      id: "photo-123",
      localUri: "/local/path/photo.jpg",
      roomType: "bedroom",
      roomNumber: 1,
    }),
    deleteMismatchPhotosForJob: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../../src/services/fetchRequests/BusinessEmployeeService", () => ({
  __esModule: true,
  default: {
    getMyJobs: jest.fn().mockResolvedValue({ jobs: [] }),
    getJobFlow: jest.fn().mockResolvedValue(null),
  },
}));

let OfflineManager;
let database;
let offlineJobsCollection;
let offlineChecklistItemsCollection;
let syncQueueCollection;
let BusinessEmployeeService;
let PhotoStorage;

describe("OfflineManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Re-require modules to get fresh mocks
    database = require("../../../src/services/offline/database").default;
    offlineJobsCollection = require("../../../src/services/offline/database").offlineJobsCollection;
    offlineChecklistItemsCollection = require("../../../src/services/offline/database").offlineChecklistItemsCollection;
    syncQueueCollection = require("../../../src/services/offline/database").syncQueueCollection;
    BusinessEmployeeService = require("../../../src/services/fetchRequests/BusinessEmployeeService").default;
    PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;
    OfflineManager = require("../../../src/services/offline/OfflineManager").default;

    // Re-apply default mock implementations
    offlineJobsCollection.query.mockReturnValue({
      fetch: jest.fn().mockResolvedValue([]),
    });
    offlineChecklistItemsCollection.query.mockReturnValue({
      fetch: jest.fn().mockResolvedValue([]),
    });
    BusinessEmployeeService.getMyJobs.mockResolvedValue({ jobs: [] });
  });

  describe("initialization", () => {
    it("should initialize only once", async () => {
      const PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;

      await OfflineManager.initialize("test-token");
      await OfflineManager.initialize("test-token");

      // PhotoStorage.initialize should only be called once
      expect(PhotoStorage.initialize).toHaveBeenCalledTimes(1);
    });

    it("should initialize PhotoStorage", async () => {
      const PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;

      await OfflineManager.initialize("test-token");

      expect(PhotoStorage.initialize).toHaveBeenCalled();
    });

    it("should preload jobs when online", async () => {
      BusinessEmployeeService.getMyJobs.mockResolvedValue({
        jobs: [
          {
            id: 1,
            appointmentId: 100,
            appointment: { dateTime: new Date().toISOString() },
          },
        ],
      });

      await OfflineManager.initialize("test-token");

      expect(BusinessEmployeeService.getMyJobs).toHaveBeenCalledWith("test-token", { upcoming: true });
    });
  });

  describe("preloadJobs", () => {
    beforeEach(async () => {
      // Reset initialization state
      jest.resetModules();
      database = require("../../../src/services/offline/database").default;
      offlineJobsCollection = require("../../../src/services/offline/database").offlineJobsCollection;
      syncQueueCollection = require("../../../src/services/offline/database").syncQueueCollection;
      BusinessEmployeeService = require("../../../src/services/fetchRequests/BusinessEmployeeService").default;
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;
      OfflineManager = require("../../../src/services/offline/OfflineManager").default;

      // Re-apply default mock implementations
      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });
      BusinessEmployeeService.getMyJobs.mockResolvedValue({ jobs: [] });
    });

    it("should not preload without auth token", async () => {
      await OfflineManager.preloadJobs();

      expect(BusinessEmployeeService.getMyJobs).not.toHaveBeenCalled();
    });

    it("should filter jobs to today and tomorrow only", async () => {
      // Add 1 hour buffer to avoid timing issues where 'now' in preloadJobs
      // might be slightly after the test-created dates
      const today = new Date();
      today.setHours(today.getHours() + 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(tomorrow.getHours() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      BusinessEmployeeService.getMyJobs.mockResolvedValue({
        jobs: [
          { id: 1, appointment: { dateTime: today.toISOString() } },
          { id: 2, appointment: { dateTime: tomorrow.toISOString() } },
          { id: 3, appointment: { dateTime: nextWeek.toISOString() } },
        ],
      });

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      await OfflineManager.initialize("test-token");

      // Should create jobs for today and tomorrow only
      expect(offlineJobsCollection.create).toHaveBeenCalledTimes(2);
    });

    it("should update existing jobs if not modified locally", async () => {
      const existingJob = {
        id: "local-1",
        serverId: 1,
        requiresSync: false,
        update: jest.fn(),
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([existingJob]),
      });

      // Mock find to return the same job (used to re-fetch fresh state inside write block)
      offlineJobsCollection.find.mockResolvedValue(existingJob);

      // Add buffer time to ensure job is in the future
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      BusinessEmployeeService.getMyJobs.mockResolvedValue({
        jobs: [
          { id: 1, appointment: { dateTime: futureDate.toISOString() } },
        ],
      });

      OfflineManager.setAuthToken("test-token");
      await OfflineManager.preloadJobs();

      expect(existingJob.update).toHaveBeenCalled();
    });

    it("should not update jobs that require sync", async () => {
      const existingJob = {
        id: "local-1",
        serverId: 1,
        requiresSync: true,
        update: jest.fn(),
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([existingJob]),
      });

      // Mock find to return the same job (used to re-fetch fresh state inside write block)
      offlineJobsCollection.find.mockResolvedValue(existingJob);

      // Add buffer time to ensure job is in the future
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      BusinessEmployeeService.getMyJobs.mockResolvedValue({
        jobs: [
          { id: 1, appointment: { dateTime: futureDate.toISOString() } },
        ],
      });

      OfflineManager.setAuthToken("test-token");
      await OfflineManager.preloadJobs();

      expect(existingJob.update).not.toHaveBeenCalled();
    });
  });

  describe("getLocalJobs", () => {
    it("should return all local jobs", async () => {
      const mockJobs = [
        { id: "1", status: OFFLINE_JOB_STATUS.ASSIGNED },
        { id: "2", status: OFFLINE_JOB_STATUS.STARTED },
      ];

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockJobs),
      });

      const jobs = await OfflineManager.getLocalJobs();

      expect(jobs).toHaveLength(2);
    });

    it("should filter by status", async () => {
      const mockJobs = [
        { id: "1", status: OFFLINE_JOB_STATUS.ASSIGNED },
        { id: "2", status: OFFLINE_JOB_STATUS.STARTED },
      ];

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockJobs),
      });

      const jobs = await OfflineManager.getLocalJobs({ status: OFFLINE_JOB_STATUS.ASSIGNED });

      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe(OFFLINE_JOB_STATUS.ASSIGNED);
    });

    it("should filter for upcoming jobs", async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const mockJobs = [
        { id: "1", jobData: { scheduledTime: future.toISOString() } },
        { id: "2", jobData: { scheduledTime: past.toISOString() } },
      ];

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockJobs),
      });

      const jobs = await OfflineManager.getLocalJobs({ upcoming: true });

      expect(jobs).toHaveLength(1);
    });
  });

  describe("getLocalJob", () => {
    it("should find job by server ID", async () => {
      const mockJobs = [
        { id: "local-1", serverId: 100 },
        { id: "local-2", serverId: 200 },
      ];

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockJobs),
      });

      const job = await OfflineManager.getLocalJob(100);

      expect(job.serverId).toBe(100);
    });

    it("should return undefined if not found", async () => {
      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      const job = await OfflineManager.getLocalJob(999);

      expect(job).toBeUndefined();
    });
  });

  describe("startJob", () => {
    it("should throw if job not found", async () => {
      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      await expect(OfflineManager.startJob(999)).rejects.toThrow("Job not found");
    });

    it("should throw if job is locked", async () => {
      const mockJob = {
        id: "local-1",
        serverId: 100,
        locked: true,
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockJob]),
      });

      await expect(OfflineManager.startJob(100)).rejects.toThrow("Job is locked");
    });

    it("should update job status and add to sync queue", async () => {
      const mockJob = {
        id: "local-1",
        serverId: 100,
        locked: false,
        update: jest.fn(),
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockJob]),
      });

      await OfflineManager.startJob(100, { latitude: 37.7749, longitude: -122.4194 });

      expect(mockJob.update).toHaveBeenCalled();
      expect(syncQueueCollection.create).toHaveBeenCalled();
    });
  });

  describe("completeJob", () => {
    it("should throw if job not found", async () => {
      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      await expect(OfflineManager.completeJob(999)).rejects.toThrow("Job not found");
    });

    it("should throw if already completed and locked", async () => {
      const mockJob = {
        id: "local-1",
        serverId: 100,
        locked: true,
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockJob]),
      });

      await expect(OfflineManager.completeJob(100)).rejects.toThrow("already completed and locked");
    });

    it("should lock job after completion", async () => {
      const mockJob = {
        id: "local-1",
        serverId: 100,
        locked: false,
        update: jest.fn(),
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockJob]),
      });

      await OfflineManager.completeJob(100, 3.5);

      expect(mockJob.update).toHaveBeenCalled();
      expect(syncQueueCollection.create).toHaveBeenCalled();
    });
  });

  describe("updateChecklistItem", () => {
    it("should throw if trying to uncheck", async () => {
      await expect(
        OfflineManager.updateChecklistItem("job-1", "section-1", "item-1", false)
      ).rejects.toThrow("cannot be unchecked");
    });

    it("should throw if job not found", async () => {
      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      await expect(
        OfflineManager.updateChecklistItem(999, "section-1", "item-1", true)
      ).rejects.toThrow("Job not found");
    });

    it("should throw if job is locked", async () => {
      const mockJob = {
        id: "local-1",
        serverId: 100,
        locked: true,
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockJob]),
      });

      offlineChecklistItemsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      await expect(
        OfflineManager.updateChecklistItem(100, "section-1", "item-1", true)
      ).rejects.toThrow("locked and cannot be modified");
    });
  });

  describe("getDataFreshness", () => {
    it("should return not fresh if never preloaded", () => {
      const freshness = OfflineManager.getDataFreshness();

      expect(freshness.isFresh).toBe(false);
      expect(freshness.lastUpdated).toBeNull();
    });
  });

  describe("checkOfflineDuration", () => {
    it("should return exceeded false if no offline since", async () => {
      const result = await OfflineManager.checkOfflineDuration(null);

      expect(result.exceeded).toBe(false);
    });

    it("should return exceeded true if past max duration", async () => {
      const offlineSince = new Date(Date.now() - MAX_OFFLINE_DURATION_MS - 1000);

      const result = await OfflineManager.checkOfflineDuration(offlineSince);

      expect(result.exceeded).toBe(true);
    });

    it("should return exceeded false if within max duration", async () => {
      const offlineSince = new Date(Date.now() - 60000); // 1 minute ago

      const result = await OfflineManager.checkOfflineDuration(offlineSince);

      expect(result.exceeded).toBe(false);
    });
  });

  describe("cleanupOldJobs", () => {
    it("should clean up old completed jobs", async () => {
      const oldCompletedJob = {
        id: "local-1",
        status: OFFLINE_JOB_STATUS.COMPLETED,
        requiresSync: false,
        completedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
        markAsDeleted: jest.fn(),
      };

      const recentJob = {
        id: "local-2",
        status: OFFLINE_JOB_STATUS.COMPLETED,
        requiresSync: false,
        completedAt: new Date(), // Now
        markAsDeleted: jest.fn(),
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([oldCompletedJob, recentJob]),
      });

      await OfflineManager.cleanupOldJobs();

      expect(oldCompletedJob.markAsDeleted).toHaveBeenCalled();
      expect(recentJob.markAsDeleted).not.toHaveBeenCalled();
    });

    it("should not clean up jobs that require sync", async () => {
      const oldJobNeedsSync = {
        id: "local-1",
        status: OFFLINE_JOB_STATUS.COMPLETED,
        requiresSync: true,
        completedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        markAsDeleted: jest.fn(),
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([oldJobNeedsSync]),
      });

      await OfflineManager.cleanupOldJobs();

      expect(oldJobNeedsSync.markAsDeleted).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("should reset database and clear photos", async () => {
      const PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;
      database.unsafeResetDatabase = jest.fn();

      await OfflineManager.reset();

      expect(database.write).toHaveBeenCalled();
      expect(PhotoStorage.clearAllPhotos).toHaveBeenCalled();
    });
  });

  describe("submitHomeSizeMismatch", () => {
    it("should throw if job not found", async () => {
      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      await expect(
        OfflineManager.submitHomeSizeMismatch(999, {
          appointmentId: 1,
          reportedNumBeds: "3",
          reportedNumBaths: "2",
          photos: [],
        })
      ).rejects.toThrow("Job not found");
    });

    it("should save photos and queue mismatch report", async () => {
      const mockJob = {
        id: "local-1",
        serverId: 100,
        update: jest.fn(),
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockJob]),
      });

      const mismatchData = {
        appointmentId: 1,
        reportedNumBeds: "3",
        reportedNumBaths: "2",
        cleanerNote: "Extra bedroom found",
        photos: [
          { roomType: "bedroom", roomNumber: 1, photoData: "data:image/jpeg;base64,abc123" },
          { roomType: "bathroom", roomNumber: 1, photoData: "data:image/jpeg;base64,def456" },
        ],
      };

      const result = await OfflineManager.submitHomeSizeMismatch(100, mismatchData);

      expect(result.success).toBe(true);
      expect(result.queuedForSync).toBe(true);
      expect(result.photoCount).toBe(2);
      expect(PhotoStorage.saveMismatchPhoto).toHaveBeenCalledTimes(2);
      expect(syncQueueCollection.create).toHaveBeenCalled();
      expect(mockJob.update).toHaveBeenCalled();
    });

    it("should work with no photos", async () => {
      const mockJob = {
        id: "local-1",
        serverId: 100,
        update: jest.fn(),
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockJob]),
      });

      const mismatchData = {
        appointmentId: 1,
        reportedNumBeds: "3",
        reportedNumBaths: "2",
        cleanerNote: null,
        photos: [],
      };

      const result = await OfflineManager.submitHomeSizeMismatch(100, mismatchData);

      expect(result.success).toBe(true);
      expect(result.photoCount).toBe(0);
      expect(PhotoStorage.saveMismatchPhoto).not.toHaveBeenCalled();
      expect(syncQueueCollection.create).toHaveBeenCalled();
    });

    it("should find job by appointment ID when serverId lookup fails", async () => {
      const mockJob = {
        id: "local-1",
        serverId: 100,
        appointmentId: 500, // The appointment ID
        update: jest.fn(),
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockJob]),
      });

      const mismatchData = {
        appointmentId: 500,
        reportedNumBeds: "3",
        reportedNumBaths: "2",
        cleanerNote: null,
        photos: [],
      };

      // Pass appointment ID (500), not server ID (100)
      const result = await OfflineManager.submitHomeSizeMismatch(500, mismatchData);

      expect(result.success).toBe(true);
      expect(result.queuedForSync).toBe(true);
      expect(syncQueueCollection.create).toHaveBeenCalled();
      expect(mockJob.update).toHaveBeenCalled();
    });
  });

  describe("getLocalJobByAppointmentId", () => {
    it("should find job by appointment ID", async () => {
      const mockJob = {
        id: "local-1",
        serverId: 100,
        appointmentId: 500,
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockJob]),
      });

      const job = await OfflineManager.getLocalJobByAppointmentId(500);

      expect(job).toEqual(mockJob);
    });

    it("should return undefined if not found", async () => {
      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      const job = await OfflineManager.getLocalJobByAppointmentId(999);

      expect(job).toBeUndefined();
    });
  });
});
