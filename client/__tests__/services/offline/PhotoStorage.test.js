/**
 * PhotoStorage Tests
 *
 * Tests for the photo storage service that manages local photo files.
 */

import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";

// Mock dependencies
jest.mock("expo-file-system", () => ({
  documentDirectory: "/mock/documents/",
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
}));

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(),
}));

jest.mock("../../../src/services/offline/database", () => ({
  __esModule: true,
  default: {
    write: jest.fn((fn) => fn()),
  },
  offlinePhotosCollection: {
    query: jest.fn(() => ({
      fetch: jest.fn().mockResolvedValue([]),
    })),
    create: jest.fn(),
    find: jest.fn(),
  },
}));

let PhotoStorage;
let database;
let offlinePhotosCollection;

describe("PhotoStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    database = require("../../../src/services/offline/database").default;
    offlinePhotosCollection = require("../../../src/services/offline/database").offlinePhotosCollection;
    PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;

    // Default mocks
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
    FileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
    FileSystem.copyAsync.mockResolvedValue(undefined);
    FileSystem.deleteAsync.mockResolvedValue(undefined);
    FileSystem.readDirectoryAsync.mockResolvedValue([]);
    Crypto.randomUUID.mockResolvedValue("test-uuid-1234");
  });

  describe("initialize", () => {
    it("should create directory if it does not exist", async () => {
      FileSystem.getInfoAsync.mockResolvedValue({ exists: false });

      await PhotoStorage.initialize();

      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        expect.stringContaining("offline_photos"),
        { intermediates: true }
      );
    });

    it("should not create directory if it already exists", async () => {
      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });

      await PhotoStorage.initialize();

      expect(FileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    });

    it("should only initialize once", async () => {
      FileSystem.getInfoAsync.mockResolvedValue({ exists: false });

      await PhotoStorage.initialize();
      await PhotoStorage.initialize();

      expect(FileSystem.getInfoAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe("savePhoto", () => {
    beforeEach(async () => {
      // Reset initialization state
      jest.resetModules();
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;
    });

    it("should copy photo to local storage", async () => {
      offlinePhotosCollection.create.mockResolvedValue({ id: "photo-1" });

      await PhotoStorage.savePhoto(
        "file:///temp/photo.jpg",
        "job-1",
        "before",
        "Kitchen"
      );

      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: "file:///temp/photo.jpg",
        to: expect.stringContaining("job-1_before_Kitchen_test-uuid-1234.jpg"),
      });
    });

    it("should create photo record in database", async () => {
      offlinePhotosCollection.create.mockResolvedValue({ id: "photo-1" });

      await PhotoStorage.savePhoto(
        "file:///temp/photo.jpg",
        "job-1",
        "before",
        "Kitchen"
      );

      expect(offlinePhotosCollection.create).toHaveBeenCalled();
    });

    it("should include watermark data", async () => {
      offlinePhotosCollection.create.mockImplementation(async (callback) => {
        const photo = {
          id: "photo-1",
          _raw: {},
        };
        callback(photo);
        return photo;
      });

      const result = await PhotoStorage.savePhoto(
        "file:///temp/photo.jpg",
        "job-1",
        "before",
        "Kitchen",
        { deviceId: "device-123" }
      );

      expect(result.watermarkData).toMatchObject({
        jobId: "job-1",
        photoType: "before",
        room: "Kitchen",
        deviceId: "device-123",
      });
    });

    it("should sanitize room name in filename", async () => {
      offlinePhotosCollection.create.mockResolvedValue({ id: "photo-1" });

      await PhotoStorage.savePhoto(
        "file:///temp/photo.jpg",
        "job-1",
        "before",
        "Living Room #1"
      );

      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: expect.any(String),
        to: expect.stringContaining("Living_Room__1"),
      });
    });

    it("should throw if copy fails", async () => {
      FileSystem.copyAsync.mockRejectedValue(new Error("Copy failed"));

      await expect(
        PhotoStorage.savePhoto("file:///temp/photo.jpg", "job-1", "before", "Kitchen")
      ).rejects.toThrow("Copy failed");
    });
  });

  describe("getPhotosForJob", () => {
    it("should return photos filtered by job ID", async () => {
      const photos = [
        { id: "1", jobId: "job-1" },
        { id: "2", jobId: "job-2" },
        { id: "3", jobId: "job-1" },
      ];

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(photos),
      });

      const result = await PhotoStorage.getPhotosForJob("job-1");

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.jobId === "job-1")).toBe(true);
    });
  });

  describe("getUnuploadedPhotos", () => {
    it("should return only photos that have not been uploaded", async () => {
      const photos = [
        { id: "1", uploaded: false },
        { id: "2", uploaded: true },
        { id: "3", uploaded: false },
      ];

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(photos),
      });

      const result = await PhotoStorage.getUnuploadedPhotos();

      expect(result).toHaveLength(2);
      expect(result.every((p) => !p.uploaded)).toBe(true);
    });
  });

  describe("markAsUploaded", () => {
    it("should mark photo as uploaded", async () => {
      const photo = {
        update: jest.fn(),
      };

      offlinePhotosCollection.find.mockResolvedValue(photo);

      await PhotoStorage.markAsUploaded("photo-1");

      expect(offlinePhotosCollection.find).toHaveBeenCalledWith("photo-1");
      expect(photo.update).toHaveBeenCalled();
    });
  });

  describe("incrementUploadAttempts", () => {
    it("should increment upload attempts", async () => {
      const photo = {
        uploadAttempts: 2,
        update: jest.fn(),
      };

      offlinePhotosCollection.find.mockResolvedValue(photo);

      await PhotoStorage.incrementUploadAttempts("photo-1");

      expect(photo.update).toHaveBeenCalled();
    });
  });

  describe("deletePhoto", () => {
    it("should delete photo from database and filesystem", async () => {
      const photo = {
        localUri: "/mock/documents/offline_photos/photo.jpg",
        markAsDeleted: jest.fn(),
      };

      offlinePhotosCollection.find.mockResolvedValue(photo);
      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });

      await PhotoStorage.deletePhoto("photo-1");

      expect(photo.markAsDeleted).toHaveBeenCalled();
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(photo.localUri);
    });

    it("should not try to delete file if it does not exist", async () => {
      const photo = {
        localUri: "/mock/documents/offline_photos/photo.jpg",
        markAsDeleted: jest.fn(),
      };

      offlinePhotosCollection.find.mockResolvedValue(photo);
      FileSystem.getInfoAsync.mockResolvedValue({ exists: false });

      await PhotoStorage.deletePhoto("photo-1");

      expect(photo.markAsDeleted).toHaveBeenCalled();
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });
  });

  describe("cleanupUploadedPhotos", () => {
    it("should delete all uploaded photos for a job", async () => {
      const photos = [
        { id: "1", jobId: "job-1", uploaded: true },
        { id: "2", jobId: "job-1", uploaded: false },
        { id: "3", jobId: "job-1", uploaded: true },
      ];

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(photos),
      });

      // Mock deletePhoto behavior
      const deletedPhotoIds = [];
      offlinePhotosCollection.find.mockImplementation((id) => {
        deletedPhotoIds.push(id);
        return Promise.resolve({
          localUri: `/mock/path/${id}.jpg`,
          markAsDeleted: jest.fn(),
        });
      });

      await PhotoStorage.cleanupUploadedPhotos("job-1");

      expect(deletedPhotoIds).toContain("1");
      expect(deletedPhotoIds).toContain("3");
      expect(deletedPhotoIds).not.toContain("2");
    });
  });

  describe("getStorageStats", () => {
    beforeEach(async () => {
      jest.resetModules();
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;
    });

    it("should return storage statistics", async () => {
      FileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true }) // initialize check
        .mockResolvedValueOnce({ exists: true }) // stats check
        .mockResolvedValueOnce({ exists: true, size: 1024 }) // file 1
        .mockResolvedValueOnce({ exists: true, size: 2048 }); // file 2

      FileSystem.readDirectoryAsync.mockResolvedValue(["photo1.jpg", "photo2.jpg"]);

      const stats = await PhotoStorage.getStorageStats();

      expect(stats.totalSize).toBe(3072);
      expect(stats.photoCount).toBe(2);
      expect(stats.formattedSize).toBe("3 KB");
    });

    it("should return zero stats if directory does not exist", async () => {
      FileSystem.getInfoAsync.mockResolvedValue({ exists: false });

      const stats = await PhotoStorage.getStorageStats();

      expect(stats.totalSize).toBe(0);
      expect(stats.photoCount).toBe(0);
    });

    it("should handle errors gracefully", async () => {
      FileSystem.getInfoAsync.mockRejectedValue(new Error("Access denied"));

      const stats = await PhotoStorage.getStorageStats();

      expect(stats.totalSize).toBe(0);
      expect(stats.formattedSize).toBe("0 B");
    });
  });

  describe("clearAllPhotos", () => {
    beforeEach(async () => {
      jest.resetModules();
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;
    });

    it("should delete all photos and recreate directory", async () => {
      const photos = [
        { markAsDeleted: jest.fn() },
        { markAsDeleted: jest.fn() },
      ];

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(photos),
      });

      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });

      await PhotoStorage.clearAllPhotos();

      expect(photos[0].markAsDeleted).toHaveBeenCalled();
      expect(photos[1].markAsDeleted).toHaveBeenCalled();
      expect(FileSystem.deleteAsync).toHaveBeenCalled();
      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalled();
    });
  });

  describe("photoExists", () => {
    it("should return true if photo file exists", async () => {
      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });

      const result = await PhotoStorage.photoExists("/path/to/photo.jpg");

      expect(result).toBe(true);
    });

    it("should return false if photo file does not exist", async () => {
      FileSystem.getInfoAsync.mockResolvedValue({ exists: false });

      const result = await PhotoStorage.photoExists("/path/to/photo.jpg");

      expect(result).toBe(false);
    });

    it("should return false on error", async () => {
      FileSystem.getInfoAsync.mockRejectedValue(new Error("Access denied"));

      const result = await PhotoStorage.photoExists("/path/to/photo.jpg");

      expect(result).toBe(false);
    });
  });

  describe("syncWithFileSystem", () => {
    beforeEach(async () => {
      jest.resetModules();
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;
    });

    it("should delete orphaned photo records", async () => {
      const photo = {
        id: "orphan-1",
        localUri: "/path/to/missing.jpg",
        uploaded: false,
        markAsDeleted: jest.fn(),
      };

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([photo]),
      });

      FileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true }) // initialize
        .mockResolvedValueOnce({ exists: false }); // photo check

      await PhotoStorage.syncWithFileSystem();

      expect(photo.markAsDeleted).toHaveBeenCalled();
    });

    it("should not delete uploaded photo records even if file is missing", async () => {
      const photo = {
        id: "uploaded-1",
        localUri: "/path/to/missing.jpg",
        uploaded: true,
        markAsDeleted: jest.fn(),
      };

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([photo]),
      });

      FileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true }) // initialize
        .mockResolvedValueOnce({ exists: false }); // photo check

      await PhotoStorage.syncWithFileSystem();

      expect(photo.markAsDeleted).not.toHaveBeenCalled();
    });
  });

  describe("_formatBytes", () => {
    beforeEach(() => {
      jest.resetModules();
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;
    });

    it("should format bytes correctly", () => {
      expect(PhotoStorage._formatBytes(0)).toBe("0 B");
      expect(PhotoStorage._formatBytes(500)).toBe("500 B");
      expect(PhotoStorage._formatBytes(1024)).toBe("1 KB");
      expect(PhotoStorage._formatBytes(1536)).toBe("1.5 KB");
      expect(PhotoStorage._formatBytes(1048576)).toBe("1 MB");
      expect(PhotoStorage._formatBytes(1073741824)).toBe("1 GB");
    });
  });
});
