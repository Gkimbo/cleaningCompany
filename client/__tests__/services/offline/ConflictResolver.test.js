/**
 * ConflictResolver Tests
 *
 * Tests for the conflict resolution service.
 */

import { CONFLICT_TYPES, RESOLUTION_TYPES } from "../../../src/services/offline/database/models/SyncConflict";

// Mock dependencies
jest.mock("../../../src/services/offline/database", () => ({
  __esModule: true,
  default: {
    write: jest.fn((fn) => fn()),
  },
  syncConflictsCollection: {
    query: jest.fn(() => ({
      fetch: jest.fn().mockResolvedValue([]),
    })),
    find: jest.fn(),
  },
  offlineJobsCollection: {
    find: jest.fn(),
  },
}));

let ConflictResolver;
let database;
let syncConflictsCollection;
let offlineJobsCollection;

describe("ConflictResolver", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    database = require("../../../src/services/offline/database").default;
    syncConflictsCollection = require("../../../src/services/offline/database").syncConflictsCollection;
    offlineJobsCollection = require("../../../src/services/offline/database").offlineJobsCollection;
    ConflictResolver = require("../../../src/services/offline/ConflictResolver").default;
  });

  describe("getUnresolvedConflicts", () => {
    it("should return only unresolved conflicts", async () => {
      const conflicts = [
        { id: "1", resolved: false },
        { id: "2", resolved: true },
        { id: "3", resolved: false },
      ];

      syncConflictsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(conflicts),
      });

      const result = await ConflictResolver.getUnresolvedConflicts();

      expect(result).toHaveLength(2);
      expect(result.every((c) => !c.resolved)).toBe(true);
    });

    it("should return empty array if no conflicts", async () => {
      syncConflictsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      const result = await ConflictResolver.getUnresolvedConflicts();

      expect(result).toHaveLength(0);
    });
  });

  describe("getConflictsForJob", () => {
    it("should return conflicts for specific job", async () => {
      const conflicts = [
        { id: "1", jobId: "job-1" },
        { id: "2", jobId: "job-2" },
        { id: "3", jobId: "job-1" },
      ];

      syncConflictsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(conflicts),
      });

      const result = await ConflictResolver.getConflictsForJob("job-1");

      expect(result).toHaveLength(2);
      expect(result.every((c) => c.jobId === "job-1")).toBe(true);
    });
  });

  describe("autoResolve", () => {
    describe("cancellation conflicts", () => {
      it("should resolve in favor of cleaner if started before cancellation", async () => {
        const conflict = {
          conflictType: CONFLICT_TYPES.CANCELLATION,
          localData: { startedAt: new Date(Date.now() - 60000).toISOString() }, // Started 1 minute ago
          serverData: { cancelledAt: new Date().toISOString() }, // Cancelled now
          resolve: jest.fn(),
        };

        const result = await ConflictResolver.autoResolve(conflict);

        expect(result.resolved).toBe(true);
        expect(result.resolution).toBe(RESOLUTION_TYPES.LOCAL_WINS);
        expect(result.reason).toContain("started before");
        expect(conflict.resolve).toHaveBeenCalledWith(RESOLUTION_TYPES.LOCAL_WINS);
      });

      it("should resolve in favor of server if cancellation came first", async () => {
        const conflict = {
          conflictType: CONFLICT_TYPES.CANCELLATION,
          localData: { startedAt: new Date().toISOString() }, // Started now
          serverData: { cancelledAt: new Date(Date.now() - 60000).toISOString() }, // Cancelled 1 minute ago
          resolve: jest.fn(),
          jobId: "job-1",
        };

        const job = {
          update: jest.fn(),
        };

        offlineJobsCollection.find.mockResolvedValue(job);

        const result = await ConflictResolver.autoResolve(conflict);

        expect(result.resolved).toBe(true);
        expect(result.resolution).toBe(RESOLUTION_TYPES.SERVER_WINS);
        expect(conflict.resolve).toHaveBeenCalledWith(RESOLUTION_TYPES.SERVER_WINS);
      });

      it("should resolve in favor of server if local never started", async () => {
        const conflict = {
          conflictType: CONFLICT_TYPES.CANCELLATION,
          localData: {}, // Never started
          serverData: { cancelledAt: new Date().toISOString() },
          resolve: jest.fn(),
          jobId: "job-1",
        };

        const job = {
          update: jest.fn(),
        };

        offlineJobsCollection.find.mockResolvedValue(job);

        const result = await ConflictResolver.autoResolve(conflict);

        expect(result.resolution).toBe(RESOLUTION_TYPES.SERVER_WINS);
      });
    });

    describe("multi-cleaner conflicts", () => {
      it("should merge data for multi-cleaner conflicts", async () => {
        const conflict = {
          conflictType: CONFLICT_TYPES.MULTI_CLEANER,
          resolve: jest.fn(),
        };

        const result = await ConflictResolver.autoResolve(conflict);

        expect(result.resolved).toBe(true);
        expect(result.resolution).toBe(RESOLUTION_TYPES.MERGED);
        expect(conflict.resolve).toHaveBeenCalledWith(RESOLUTION_TYPES.MERGED);
      });
    });

    describe("data mismatch conflicts", () => {
      it("should resolve in favor of local if local data is more recent", async () => {
        const conflict = {
          conflictType: CONFLICT_TYPES.DATA_MISMATCH,
          localData: { updatedAt: new Date().toISOString() }, // Now
          serverData: { updatedAt: new Date(Date.now() - 60000).toISOString() }, // 1 minute ago
          resolve: jest.fn(),
          jobId: "job-1",
        };

        offlineJobsCollection.find.mockResolvedValue(null);

        const result = await ConflictResolver.autoResolve(conflict);

        expect(result.resolved).toBe(true);
        expect(result.resolution).toBe(RESOLUTION_TYPES.LOCAL_WINS);
      });

      it("should resolve in favor of server if server data is more recent", async () => {
        const conflict = {
          conflictType: CONFLICT_TYPES.DATA_MISMATCH,
          localData: { updatedAt: new Date(Date.now() - 60000).toISOString() }, // 1 minute ago
          serverData: { updatedAt: new Date().toISOString() }, // Now
          resolve: jest.fn(),
          jobId: "job-1",
        };

        const job = {
          update: jest.fn(),
        };

        offlineJobsCollection.find.mockResolvedValue(job);

        const result = await ConflictResolver.autoResolve(conflict);

        expect(result.resolved).toBe(true);
        expect(result.resolution).toBe(RESOLUTION_TYPES.SERVER_WINS);
      });
    });

    it("should handle unknown conflict types", async () => {
      const conflict = {
        conflictType: "unknown_type",
      };

      const result = await ConflictResolver.autoResolve(conflict);

      expect(result.resolved).toBe(false);
      expect(result.reason).toContain("Unknown conflict type");
    });
  });

  describe("manualResolve", () => {
    it("should resolve conflict with specified resolution", async () => {
      const conflict = {
        id: "conflict-1",
        resolve: jest.fn(),
        jobId: "job-1",
      };

      syncConflictsCollection.find.mockResolvedValue(conflict);
      offlineJobsCollection.find.mockResolvedValue(null);

      const result = await ConflictResolver.manualResolve("conflict-1", RESOLUTION_TYPES.LOCAL_WINS);

      expect(result.success).toBe(true);
      expect(conflict.resolve).toHaveBeenCalledWith(RESOLUTION_TYPES.LOCAL_WINS);
    });

    it("should handle errors during manual resolution", async () => {
      syncConflictsCollection.find.mockRejectedValue(new Error("Not found"));

      const result = await ConflictResolver.manualResolve("non-existent", RESOLUTION_TYPES.LOCAL_WINS);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not found");
    });

    it("should apply server wins resolution to job", async () => {
      const conflict = {
        id: "conflict-1",
        resolve: jest.fn(),
        jobId: "job-1",
      };

      const job = {
        update: jest.fn(),
      };

      syncConflictsCollection.find.mockResolvedValue(conflict);
      offlineJobsCollection.find.mockResolvedValue(job);

      await ConflictResolver.manualResolve("conflict-1", RESOLUTION_TYPES.SERVER_WINS);

      expect(job.update).toHaveBeenCalled();
    });
  });

  describe("getConflictSummary", () => {
    it("should return summary counts by type", async () => {
      const conflicts = [
        { conflictType: CONFLICT_TYPES.CANCELLATION, resolved: false },
        { conflictType: CONFLICT_TYPES.CANCELLATION, resolved: false },
        { conflictType: CONFLICT_TYPES.MULTI_CLEANER, resolved: false },
        { conflictType: CONFLICT_TYPES.DATA_MISMATCH, resolved: false },
        { conflictType: CONFLICT_TYPES.CANCELLATION, resolved: true }, // Should not count
      ];

      syncConflictsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(conflicts),
      });

      const summary = await ConflictResolver.getConflictSummary();

      expect(summary.total).toBe(4);
      expect(summary.cancellations).toBe(2);
      expect(summary.multiCleaner).toBe(1);
      expect(summary.dataMismatch).toBe(1);
    });

    it("should return zero counts when no conflicts", async () => {
      syncConflictsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      const summary = await ConflictResolver.getConflictSummary();

      expect(summary.total).toBe(0);
      expect(summary.cancellations).toBe(0);
      expect(summary.multiCleaner).toBe(0);
      expect(summary.dataMismatch).toBe(0);
    });
  });

  describe("autoResolveAll", () => {
    it("should auto-resolve all unresolved conflicts", async () => {
      const conflicts = [
        {
          id: "1",
          conflictType: CONFLICT_TYPES.CANCELLATION,
          resolved: false,
          localData: { startedAt: new Date(Date.now() - 60000).toISOString() },
          serverData: { cancelledAt: new Date().toISOString() },
          resolve: jest.fn(),
        },
        {
          id: "2",
          conflictType: CONFLICT_TYPES.MULTI_CLEANER,
          resolved: false,
          resolve: jest.fn(),
        },
      ];

      syncConflictsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(conflicts),
      });

      const results = await ConflictResolver.autoResolveAll();

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.resolved)).toBe(true);
    });

    it("should return empty array if no unresolved conflicts", async () => {
      syncConflictsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      const results = await ConflictResolver.autoResolveAll();

      expect(results).toHaveLength(0);
    });
  });
});
