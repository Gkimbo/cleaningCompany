/**
 * StorageManager Tests
 *
 * Tests for the storage management and cleanup service.
 */

import { OFFLINE_JOB_STATUS } from "../../../src/services/offline/constants";

// Mock dependencies
jest.mock("../../../src/services/offline/database", () => ({
  __esModule: true,
  default: {
    write: jest.fn((fn) => fn()),
  },
  offlineJobsCollection: {
    query: jest.fn(() => ({
      fetch: jest.fn().mockResolvedValue([]),
    })),
  },
  offlinePhotosCollection: {
    query: jest.fn(() => ({
      fetch: jest.fn().mockResolvedValue([]),
    })),
  },
  offlineChecklistItemsCollection: {
    query: jest.fn(() => ({
      fetch: jest.fn().mockResolvedValue([]),
    })),
  },
  syncQueueCollection: {
    query: jest.fn(() => ({
      fetch: jest.fn().mockResolvedValue([]),
    })),
  },
  syncConflictsCollection: {
    query: jest.fn(() => ({
      fetch: jest.fn().mockResolvedValue([]),
    })),
  },
}));

jest.mock("../../../src/services/offline/PhotoStorage", () => ({
  __esModule: true,
  default: {
    getStorageStats: jest.fn().mockResolvedValue({
      totalSize: 0,
      photoCount: 0,
      formattedSize: "0 B",
    }),
    cleanupUploadedPhotos: jest.fn(),
    deletePhoto: jest.fn(),
    syncWithFileSystem: jest.fn(),
  },
}));

let StorageManager;
let PhotoStorage;
let offlineJobsCollection;
let offlinePhotosCollection;
let syncQueueCollection;
let syncConflictsCollection;
let offlineChecklistItemsCollection;

describe("StorageManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;
    offlineJobsCollection = require("../../../src/services/offline/database").offlineJobsCollection;
    offlinePhotosCollection = require("../../../src/services/offline/database").offlinePhotosCollection;
    syncQueueCollection = require("../../../src/services/offline/database").syncQueueCollection;
    syncConflictsCollection = require("../../../src/services/offline/database").syncConflictsCollection;
    offlineChecklistItemsCollection = require("../../../src/services/offline/database").offlineChecklistItemsCollection;
    StorageManager = require("../../../src/services/offline/StorageManager").default;
  });

  describe("subscription", () => {
    it("should allow subscribing to storage updates", () => {
      const listener = jest.fn();

      const unsubscribe = StorageManager.subscribe(listener);

      expect(typeof unsubscribe).toBe("function");
    });

    it("should call listener when stats are fetched", async () => {
      const listener = jest.fn();
      StorageManager.subscribe(listener);

      await StorageManager.getStorageStats();

      expect(listener).toHaveBeenCalled();
    });

    it("should stop calling listener after unsubscribe", async () => {
      const listener = jest.fn();
      const unsubscribe = StorageManager.subscribe(listener);

      unsubscribe();

      await StorageManager.getStorageStats();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("getStorageStats", () => {
    it("should return comprehensive storage statistics", async () => {
      const photos = [
        { uploaded: false },
        { uploaded: true },
        { uploaded: false },
      ];

      const syncOps = [
        { status: "pending" },
        { status: "failed" },
        { status: "completed" },
      ];

      const conflicts = [
        { resolved: false },
        { resolved: true },
      ];

      PhotoStorage.getStorageStats.mockResolvedValue({
        totalSize: 5 * 1024 * 1024, // 5MB
        photoCount: 3,
        formattedSize: "5 MB",
      });

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([{}, {}]),
      });

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(photos),
      });

      offlineChecklistItemsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([{}, {}, {}]),
      });

      syncQueueCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(syncOps),
      });

      syncConflictsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(conflicts),
      });

      const stats = await StorageManager.getStorageStats();

      expect(stats.photoStorageBytes).toBe(5 * 1024 * 1024);
      expect(stats.totalPhotoCount).toBe(3);
      expect(stats.pendingPhotoCount).toBe(2);
      expect(stats.uploadedPhotoCount).toBe(1);
      expect(stats.jobCount).toBe(2);
      expect(stats.checklistItemCount).toBe(3);
      expect(stats.syncQueueCount).toBe(3);
      expect(stats.pendingSyncCount).toBe(2);
      expect(stats.conflictCount).toBe(2);
      expect(stats.unresolvedConflictCount).toBe(1);
    });

    it("should determine health as good when storage is low", async () => {
      PhotoStorage.getStorageStats.mockResolvedValue({
        totalSize: 50 * 1024 * 1024, // 50MB
        photoCount: 10,
        formattedSize: "50 MB",
      });

      const stats = await StorageManager.getStorageStats();

      expect(stats.health).toBe("good");
    });

    it("should determine health as warning when storage is high", async () => {
      PhotoStorage.getStorageStats.mockResolvedValue({
        totalSize: 150 * 1024 * 1024, // 150MB
        photoCount: 50,
        formattedSize: "150 MB",
      });

      const stats = await StorageManager.getStorageStats();

      expect(stats.health).toBe("warning");
    });

    it("should determine health as critical when storage exceeds threshold", async () => {
      PhotoStorage.getStorageStats.mockResolvedValue({
        totalSize: 250 * 1024 * 1024, // 250MB
        photoCount: 100,
        formattedSize: "250 MB",
      });

      const stats = await StorageManager.getStorageStats();

      expect(stats.health).toBe("critical");
    });

    it("should handle errors gracefully", async () => {
      PhotoStorage.getStorageStats.mockRejectedValue(new Error("Storage error"));

      const stats = await StorageManager.getStorageStats();

      expect(stats.health).toBe("unknown");
      expect(stats.error).toBe("Storage error");
    });
  });

  describe("runCleanup", () => {
    it("should run all cleanup routines", async () => {
      const results = await StorageManager.runCleanup();

      expect(results).toHaveProperty("cleanedJobs");
      expect(results).toHaveProperty("cleanedPhotos");
      expect(results).toHaveProperty("cleanedSyncQueue");
      expect(results).toHaveProperty("cleanedConflicts");
      expect(results).toHaveProperty("errors");
      expect(PhotoStorage.syncWithFileSystem).toHaveBeenCalled();
    });

    it("should clean up old completed jobs", async () => {
      const oldJob = {
        id: "old-1",
        status: OFFLINE_JOB_STATUS.COMPLETED,
        requiresSync: false,
        completedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
        markAsDeleted: jest.fn(),
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([oldJob]),
      });

      offlineChecklistItemsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      const results = await StorageManager.runCleanup();

      expect(oldJob.markAsDeleted).toHaveBeenCalled();
      expect(results.cleanedJobs).toBe(1);
    });

    it("should not clean up jobs that require sync", async () => {
      const job = {
        id: "needs-sync",
        status: OFFLINE_JOB_STATUS.COMPLETED,
        requiresSync: true,
        completedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        markAsDeleted: jest.fn(),
      };

      offlineJobsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([job]),
      });

      await StorageManager.runCleanup();

      expect(job.markAsDeleted).not.toHaveBeenCalled();
    });

    it("should clean up uploaded photos", async () => {
      const photos = [
        { id: "1", uploaded: true },
        { id: "2", uploaded: false },
        { id: "3", uploaded: true },
      ];

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(photos),
      });

      const results = await StorageManager.runCleanup();

      expect(PhotoStorage.deletePhoto).toHaveBeenCalledTimes(2);
      expect(results.cleanedPhotos).toBe(2);
    });

    it("should clean up photos that exceeded max upload attempts", async () => {
      const photo = {
        id: "failed-photo",
        uploaded: false,
        uploadAttempts: 5,
      };

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([photo]),
      });

      const results = await StorageManager.runCleanup();

      expect(PhotoStorage.deletePhoto).toHaveBeenCalledWith("failed-photo");
      expect(results.cleanedPhotos).toBe(1);
    });

    it("should clean up old completed sync queue entries", async () => {
      const oldOp = {
        status: "completed",
        createdAt: new Date(Date.now() - 96 * 60 * 60 * 1000), // 96 hours ago
        markAsDeleted: jest.fn(),
      };

      syncQueueCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([oldOp]),
      });

      const results = await StorageManager.runCleanup();

      expect(oldOp.markAsDeleted).toHaveBeenCalled();
      expect(results.cleanedSyncQueue).toBe(1);
    });

    it("should clean up old resolved conflicts", async () => {
      const oldConflict = {
        resolved: true,
        createdAt: new Date(Date.now() - 96 * 60 * 60 * 1000), // 96 hours ago
        markAsDeleted: jest.fn(),
      };

      syncConflictsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([oldConflict]),
      });

      const results = await StorageManager.runCleanup();

      expect(oldConflict.markAsDeleted).toHaveBeenCalled();
      expect(results.cleanedConflicts).toBe(1);
    });
  });

  describe("forceCriticalCleanup", () => {
    it("should run normal cleanup first", async () => {
      PhotoStorage.getStorageStats.mockResolvedValue({
        totalSize: 50 * 1024 * 1024, // 50MB - not critical
        photoCount: 10,
        formattedSize: "50 MB",
      });

      await StorageManager.forceCriticalCleanup();

      expect(PhotoStorage.syncWithFileSystem).toHaveBeenCalled();
    });

    it("should aggressively clean all uploaded photos if still critical", async () => {
      PhotoStorage.getStorageStats.mockResolvedValue({
        totalSize: 250 * 1024 * 1024, // 250MB - critical
        photoCount: 100,
        formattedSize: "250 MB",
      });

      const uploadedPhotos = [
        { id: "1", uploaded: true },
        { id: "2", uploaded: true },
      ];

      // First call for cleanup, second for critical check
      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(uploadedPhotos),
      });

      const results = await StorageManager.forceCriticalCleanup();

      // Should have cleaned photos in both passes
      expect(PhotoStorage.deletePhoto).toHaveBeenCalled();
    });
  });

  describe("getCleanupRecommendations", () => {
    it("should recommend cleaning uploaded photos", async () => {
      PhotoStorage.getStorageStats.mockResolvedValue({
        totalSize: 10 * 1024 * 1024,
        photoCount: 10,
        formattedSize: "10 MB",
      });

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([
          { uploaded: true },
          { uploaded: true },
        ]),
      });

      const recommendations = await StorageManager.getCleanupRecommendations();

      const uploadedRec = recommendations.find((r) => r.type === "uploaded_photos");
      expect(uploadedRec).toBeDefined();
      // uploadedPhotoCount = photoCount (10) - pendingPhotos (0, none are !uploaded) = 10
      expect(uploadedRec.message).toContain("10 uploaded photos");
    });

    it("should recommend syncing pending operations", async () => {
      PhotoStorage.getStorageStats.mockResolvedValue({
        totalSize: 0,
        photoCount: 0,
        formattedSize: "0 B",
      });

      syncQueueCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([
          { status: "pending" },
          { status: "pending" },
          { status: "failed" },
        ]),
      });

      const recommendations = await StorageManager.getCleanupRecommendations();

      const syncRec = recommendations.find((r) => r.type === "pending_sync");
      expect(syncRec).toBeDefined();
      expect(syncRec.priority).toBe("high");
    });

    it("should recommend resolving conflicts", async () => {
      PhotoStorage.getStorageStats.mockResolvedValue({
        totalSize: 0,
        photoCount: 0,
        formattedSize: "0 B",
      });

      syncConflictsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([
          { resolved: false },
        ]),
      });

      const recommendations = await StorageManager.getCleanupRecommendations();

      const conflictRec = recommendations.find((r) => r.type === "conflicts");
      expect(conflictRec).toBeDefined();
      expect(conflictRec.priority).toBe("high");
    });

    it("should return empty array when no recommendations", async () => {
      PhotoStorage.getStorageStats.mockResolvedValue({
        totalSize: 0,
        photoCount: 0,
        formattedSize: "0 B",
      });

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      syncQueueCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      syncConflictsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      const recommendations = await StorageManager.getCleanupRecommendations();

      expect(recommendations).toHaveLength(0);
    });
  });
});
