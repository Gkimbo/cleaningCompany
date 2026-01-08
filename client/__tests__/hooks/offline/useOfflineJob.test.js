/**
 * useOfflineJob Hook Tests
 *
 * Tests for the offline job management hook.
 */

import { renderHook, act, waitFor } from "@testing-library/react-native";
import React from "react";

// Mock dependencies first
jest.mock("../../../src/services/offline/OfflineContext", () => ({
  useOffline: jest.fn(() => ({
    isOffline: false,
    isOnline: true,
  })),
}));

jest.mock("../../../src/services/offline/OfflineManager", () => ({
  __esModule: true,
  default: {
    getLocalJob: jest.fn(),
    startJob: jest.fn(),
    completeJob: jest.fn(),
    updateChecklistItem: jest.fn(),
  },
}));

jest.mock("../../../src/services/offline/PhotoStorage", () => ({
  __esModule: true,
  default: {
    getPhotosForJob: jest.fn().mockResolvedValue([]),
    savePhoto: jest.fn(),
    deletePhoto: jest.fn(),
  },
}));

jest.mock("../../../src/services/offline/NetworkMonitor", () => ({
  __esModule: true,
  default: {
    isOnline: true,
  },
}));

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
  offlineChecklistItemsCollection: {
    query: jest.fn(() => ({
      fetch: jest.fn().mockResolvedValue([]),
    })),
  },
}));

// Import after mocks
import { useOfflineJob, useOfflineChecklist, useOfflinePhotos } from "../../../src/services/offline/hooks/useOfflineJob";
import OfflineManager from "../../../src/services/offline/OfflineManager";
import PhotoStorage from "../../../src/services/offline/PhotoStorage";
import { useOffline } from "../../../src/services/offline/OfflineContext";
import { offlineChecklistItemsCollection } from "../../../src/services/offline/database";

describe("useOfflineJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    OfflineManager.getLocalJob.mockResolvedValue(null);
  });

  describe("initialization", () => {
    it("should load job on mount", async () => {
      const mockJob = { id: "local-1", serverId: 100 };
      OfflineManager.getLocalJob.mockResolvedValue(mockJob);

      const { result } = renderHook(() => useOfflineJob(100));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.job).toEqual(mockJob);
      expect(OfflineManager.getLocalJob).toHaveBeenCalledWith(100);
    });

    it("should not load if no serverId provided", async () => {
      const { result } = renderHook(() => useOfflineJob(null));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(OfflineManager.getLocalJob).not.toHaveBeenCalled();
    });

    it("should handle errors during load", async () => {
      OfflineManager.getLocalJob.mockRejectedValue(new Error("Load failed"));

      const { result } = renderHook(() => useOfflineJob(100));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe("startJob", () => {
    it("should start job with location data", async () => {
      const mockJob = { id: "local-1", serverId: 100 };
      OfflineManager.getLocalJob.mockResolvedValue(mockJob);
      OfflineManager.startJob.mockResolvedValue(mockJob);

      const { result } = renderHook(() => useOfflineJob(100));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.startJob({ latitude: 37.7749, longitude: -122.4194 });
      });

      expect(OfflineManager.startJob).toHaveBeenCalledWith(100, {
        latitude: 37.7749,
        longitude: -122.4194,
      });
    });

    it("should throw if job not loaded", async () => {
      const { result } = renderHook(() => useOfflineJob(100));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(result.current.startJob()).rejects.toThrow("Job not loaded");
    });
  });

  describe("completeJob", () => {
    it("should complete job with hours worked", async () => {
      const mockJob = { id: "local-1", serverId: 100 };
      OfflineManager.getLocalJob.mockResolvedValue(mockJob);
      OfflineManager.completeJob.mockResolvedValue(mockJob);

      const { result } = renderHook(() => useOfflineJob(100));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.completeJob(3.5);
      });

      expect(OfflineManager.completeJob).toHaveBeenCalledWith(100, 3.5);
    });
  });

  describe("photos", () => {
    it("should get photos grouped by type", async () => {
      const mockJob = { id: "local-1", serverId: 100 };
      OfflineManager.getLocalJob.mockResolvedValue(mockJob);

      const photos = [
        { id: "1", photoType: "before" },
        { id: "2", photoType: "after" },
        { id: "3", photoType: "before" },
      ];
      PhotoStorage.getPhotosForJob.mockResolvedValue(photos);

      const { result } = renderHook(() => useOfflineJob(100));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let photosResult;
      await act(async () => {
        photosResult = await result.current.getPhotos();
      });

      expect(photosResult.before).toHaveLength(2);
      expect(photosResult.after).toHaveLength(1);
    });

    it("should save photo", async () => {
      const mockJob = { id: "local-1", serverId: 100 };
      OfflineManager.getLocalJob.mockResolvedValue(mockJob);
      PhotoStorage.savePhoto.mockResolvedValue({ id: "photo-1" });

      const { result } = renderHook(() => useOfflineJob(100));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.savePhoto(
          "file:///temp/photo.jpg",
          "before",
          "Kitchen",
          { deviceId: "device-1" }
        );
      });

      expect(PhotoStorage.savePhoto).toHaveBeenCalledWith(
        "file:///temp/photo.jpg",
        "local-1",
        "before",
        "Kitchen",
        { deviceId: "device-1" }
      );
    });

    it("should delete photo", async () => {
      const mockJob = { id: "local-1", serverId: 100 };
      OfflineManager.getLocalJob.mockResolvedValue(mockJob);

      const { result } = renderHook(() => useOfflineJob(100));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deletePhoto("photo-1");
      });

      expect(PhotoStorage.deletePhoto).toHaveBeenCalledWith("photo-1");
    });
  });

  describe("network status", () => {
    it("should reflect offline status", async () => {
      useOffline.mockReturnValue({
        isOffline: true,
        isOnline: false,
      });

      const { result } = renderHook(() => useOfflineJob(100));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isOffline).toBe(true);
      expect(result.current.isOnline).toBe(false);
    });
  });
});

describe("useOfflineChecklist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOffline.mockReturnValue({
      isOffline: false,
      isOnline: true,
    });
  });

  describe("initialization", () => {
    it("should load checklist items on mount", async () => {
      const items = [
        { jobId: "job-1", itemId: "item-1", completed: true, completedAt: new Date() },
        { jobId: "job-1", itemId: "item-2", completed: false, completedAt: null },
      ];

      offlineChecklistItemsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(items),
      });

      const { result } = renderHook(() => useOfflineChecklist("job-1", "appointment-1"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.items["item-1"].completed).toBe(true);
      expect(result.current.items["item-2"].completed).toBe(false); // Not completed yet
    });

    it("should not load if no jobId", async () => {
      const { result } = renderHook(() => useOfflineChecklist(null, "appointment-1"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(offlineChecklistItemsCollection.query).not.toHaveBeenCalled();
    });
  });

  describe("markComplete", () => {
    it("should mark item as complete", async () => {
      offlineChecklistItemsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      OfflineManager.updateChecklistItem.mockResolvedValue({ completed: true });

      const { result } = renderHook(() => useOfflineChecklist("job-1", "appointment-1"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.markComplete("item-1");
      });

      expect(OfflineManager.updateChecklistItem).toHaveBeenCalledWith("job-1", "item-1", true);
      expect(result.current.items["item-1"].completed).toBe(true);
    });

    it("should not mark already completed items", async () => {
      const items = [
        { jobId: "job-1", itemId: "item-1", completed: true, completedAt: new Date() },
      ];

      offlineChecklistItemsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(items),
      });

      const { result } = renderHook(() => useOfflineChecklist("job-1", "appointment-1"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.markComplete("item-1");
      });

      expect(OfflineManager.updateChecklistItem).not.toHaveBeenCalled();
    });
  });

  describe("isItemCompleted", () => {
    it("should return completion status", async () => {
      const items = [
        { jobId: "job-1", itemId: "item-1", completed: true, completedAt: new Date() },
      ];

      offlineChecklistItemsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(items),
      });

      const { result } = renderHook(() => useOfflineChecklist("job-1", "appointment-1"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isItemCompleted("item-1")).toBe(true);
      expect(result.current.isItemCompleted("item-2")).toBe(false);
    });
  });

  describe("getStats", () => {
    it("should calculate completion stats", async () => {
      const items = [
        { jobId: "job-1", itemId: "item-1", completed: true, completedAt: new Date() },
        { jobId: "job-1", itemId: "item-2", completed: true, completedAt: new Date() },
      ];

      offlineChecklistItemsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(items),
      });

      const { result } = renderHook(() => useOfflineChecklist("job-1", "appointment-1"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const stats = result.current.getStats(5);

      expect(stats.completed).toBe(2);
      expect(stats.total).toBe(5);
      expect(stats.percent).toBe(40);
    });

    it("should handle zero total items", async () => {
      offlineChecklistItemsCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      const { result } = renderHook(() => useOfflineChecklist("job-1", "appointment-1"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const stats = result.current.getStats(0);

      expect(stats.percent).toBe(0);
    });
  });
});

describe("useOfflinePhotos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOffline.mockReturnValue({
      isOffline: false,
      isOnline: true,
    });
    PhotoStorage.getPhotosForJob.mockResolvedValue([]);
  });

  describe("initialization", () => {
    it("should load photos filtered by type", async () => {
      const photos = [
        { id: "1", photoType: "before", room: "Kitchen" },
        { id: "2", photoType: "after", room: "Kitchen" },
        { id: "3", photoType: "before", room: "Bathroom" },
      ];

      PhotoStorage.getPhotosForJob.mockResolvedValue(photos);

      const { result } = renderHook(() => useOfflinePhotos("job-1", "before"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.photos).toHaveLength(2);
      expect(result.current.photos.every((p) => p.photoType === "before")).toBe(true);
    });
  });

  describe("savePhoto", () => {
    it("should save photo and refresh list", async () => {
      PhotoStorage.savePhoto.mockResolvedValue({ id: "new-photo" });

      const { result } = renderHook(() => useOfflinePhotos("job-1", "before"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.savePhoto(
          "file:///temp/photo.jpg",
          "Kitchen",
          { deviceId: "device-1" }
        );
      });

      expect(PhotoStorage.savePhoto).toHaveBeenCalledWith(
        "file:///temp/photo.jpg",
        "job-1",
        "before",
        "Kitchen",
        { deviceId: "device-1" }
      );
    });

    it("should set uploading state during save", async () => {
      let resolvePromise;
      PhotoStorage.savePhoto.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );

      const { result } = renderHook(() => useOfflinePhotos("job-1", "before"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let savePromise;
      act(() => {
        savePromise = result.current.savePhoto("file:///photo.jpg", "Kitchen");
      });

      expect(result.current.uploading).toBe(true);

      await act(async () => {
        resolvePromise({ id: "photo-1" });
        await savePromise;
      });

      expect(result.current.uploading).toBe(false);
    });
  });

  describe("deletePhoto", () => {
    it("should delete photo and refresh list", async () => {
      const { result } = renderHook(() => useOfflinePhotos("job-1", "before"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deletePhoto("photo-1");
      });

      expect(PhotoStorage.deletePhoto).toHaveBeenCalledWith("photo-1");
    });
  });

  describe("getPhotosByRoom", () => {
    it("should filter photos by room", async () => {
      const photos = [
        { id: "1", photoType: "before", room: "Kitchen" },
        { id: "2", photoType: "before", room: "Bathroom" },
        { id: "3", photoType: "before", room: "Kitchen" },
      ];

      PhotoStorage.getPhotosForJob.mockResolvedValue(photos);

      const { result } = renderHook(() => useOfflinePhotos("job-1", "before"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const kitchenPhotos = result.current.getPhotosByRoom("Kitchen");

      expect(kitchenPhotos).toHaveLength(2);
    });
  });

  describe("getRoomsWithPhotos", () => {
    it("should return unique rooms", async () => {
      const photos = [
        { id: "1", photoType: "before", room: "Kitchen" },
        { id: "2", photoType: "before", room: "Bathroom" },
        { id: "3", photoType: "before", room: "Kitchen" },
      ];

      PhotoStorage.getPhotosForJob.mockResolvedValue(photos);

      const { result } = renderHook(() => useOfflinePhotos("job-1", "before"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const rooms = result.current.getRoomsWithPhotos();

      expect(rooms.size).toBe(2);
      expect(rooms.has("Kitchen")).toBe(true);
      expect(rooms.has("Bathroom")).toBe(true);
    });
  });
});
