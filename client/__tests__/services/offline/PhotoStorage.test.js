/**
 * PhotoStorage Tests
 *
 * Tests for the photo storage service that manages local photo files.
 */

// Mock dependencies
const mockFileSystem = {
  documentDirectory: "/mock/documents/",
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  EncodingType: { Base64: "base64" },
  getFreeDiskStorageAsync: jest.fn().mockResolvedValue(1024 * 1024 * 1024), // 1GB free
};

jest.mock("expo-file-system", () => mockFileSystem);
jest.mock("expo-file-system/legacy", () => mockFileSystem);

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
  syncQueueCollection: {
    create: jest.fn(),
  },
}));

let PhotoStorage;
let database;
let offlinePhotosCollection;
let syncQueueCollection;
let FileSystem;
let Crypto;

describe("PhotoStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Re-require all mocked modules after resetModules
    FileSystem = require("expo-file-system");
    Crypto = require("expo-crypto");
    database = require("../../../src/services/offline/database").default;
    offlinePhotosCollection = require("../../../src/services/offline/database").offlinePhotosCollection;
    syncQueueCollection = require("../../../src/services/offline/database").syncQueueCollection;
    PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;

    // Default mocks
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
    FileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
    FileSystem.copyAsync.mockResolvedValue(undefined);
    FileSystem.deleteAsync.mockResolvedValue(undefined);
    FileSystem.readDirectoryAsync.mockResolvedValue([]);
    Crypto.randomUUID.mockReturnValue("test-uuid-1234");
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
      FileSystem = require("expo-file-system");
      Crypto = require("expo-crypto");
      offlinePhotosCollection = require("../../../src/services/offline/database").offlinePhotosCollection;
      syncQueueCollection = require("../../../src/services/offline/database").syncQueueCollection;
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;

      // Re-apply default mocks
      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
      FileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
      FileSystem.copyAsync.mockResolvedValue(undefined);
      Crypto.randomUUID.mockReturnValue("test-uuid-1234");
      syncQueueCollection.create.mockResolvedValue({ id: "sync-1" });
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
      syncQueueCollection.create.mockImplementation(async (callback) => {
        const op = { id: "sync-1", _raw: {} };
        callback(op);
        return op;
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

    it("should queue photo for sync", async () => {
      offlinePhotosCollection.create.mockImplementation(async (callback) => {
        const photo = { id: "photo-1", _raw: {} };
        callback(photo);
        return photo;
      });
      let syncOp = null;
      syncQueueCollection.create.mockImplementation(async (callback) => {
        syncOp = { id: "sync-1", _raw: {} };
        callback(syncOp);
        return syncOp;
      });

      const result = await PhotoStorage.savePhoto(
        "file:///temp/photo.jpg",
        "job-1",
        "before",
        "Kitchen"
      );

      expect(result.queuedForSync).toBe(true);
      expect(syncQueueCollection.create).toHaveBeenCalled();
      expect(syncOp.jobId).toBe("job-1");
      expect(syncOp.operationType).toBe("before_photo");
    });

    it("should use correct operation type for after photos", async () => {
      offlinePhotosCollection.create.mockImplementation(async (callback) => {
        const photo = { id: "photo-1", _raw: {} };
        callback(photo);
        return photo;
      });
      let syncOp = null;
      syncQueueCollection.create.mockImplementation(async (callback) => {
        syncOp = { id: "sync-1", _raw: {} };
        callback(syncOp);
        return syncOp;
      });

      await PhotoStorage.savePhoto(
        "file:///temp/photo.jpg",
        "job-1",
        "after",
        "Kitchen"
      );

      expect(syncOp.operationType).toBe("after_photo");
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
      FileSystem = require("expo-file-system");
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;

      // Re-apply default mocks
      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
      FileSystem.readDirectoryAsync.mockResolvedValue([]);
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
      // First call succeeds (for initialize), then subsequent calls fail
      FileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true }) // initialize succeeds
        .mockRejectedValue(new Error("Access denied")); // stats call fails

      const stats = await PhotoStorage.getStorageStats();

      expect(stats.totalSize).toBe(0);
      expect(stats.formattedSize).toBe("0 B");
    });
  });

  describe("clearAllPhotos", () => {
    beforeEach(async () => {
      jest.resetModules();
      FileSystem = require("expo-file-system");
      database = require("../../../src/services/offline/database").default;
      offlinePhotosCollection = require("../../../src/services/offline/database").offlinePhotosCollection;
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;

      // Re-apply default mocks
      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
      FileSystem.deleteAsync.mockResolvedValue(undefined);
      FileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
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
      FileSystem = require("expo-file-system");
      database = require("../../../src/services/offline/database").default;
      offlinePhotosCollection = require("../../../src/services/offline/database").offlinePhotosCollection;
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;

      // Re-apply default mocks
      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
    });

    it("should delete orphaned photo records after 3 missing checks", async () => {
      // Photo has already been missing 2 times, this will be the 3rd
      const photo = {
        id: "orphan-1",
        localUri: "/path/to/missing.jpg",
        uploaded: false,
        _raw: { missing_file_checks: 2 },
        markAsDeleted: jest.fn(),
        update: jest.fn(),
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

    it("should increment missing count but not delete on first missing check", async () => {
      const photo = {
        id: "maybe-orphan-1",
        localUri: "/path/to/missing.jpg",
        uploaded: false,
        _raw: { missing_file_checks: 0 },
        markAsDeleted: jest.fn(),
        update: jest.fn(),
      };

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([photo]),
      });

      FileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true }) // initialize
        .mockResolvedValueOnce({ exists: false }); // photo check

      await PhotoStorage.syncWithFileSystem();

      expect(photo.markAsDeleted).not.toHaveBeenCalled();
      expect(photo.update).toHaveBeenCalled();
    });

    it("should reset missing count when file is found again", async () => {
      const photo = {
        id: "recovered-1",
        localUri: "/path/to/recovered.jpg",
        uploaded: false,
        _raw: { missing_file_checks: 2 },
        markAsDeleted: jest.fn(),
        update: jest.fn(),
      };

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([photo]),
      });

      FileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true }) // initialize
        .mockResolvedValueOnce({ exists: true }); // photo check - file found

      await PhotoStorage.syncWithFileSystem();

      expect(photo.markAsDeleted).not.toHaveBeenCalled();
      expect(photo.update).toHaveBeenCalled();
    });

    it("should not delete uploaded photo records even if file is missing", async () => {
      const photo = {
        id: "uploaded-1",
        localUri: "/path/to/missing.jpg",
        uploaded: true,
        _raw: {},
        markAsDeleted: jest.fn(),
        update: jest.fn(),
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

    it("should skip N/A records (no actual files)", async () => {
      const photo = {
        id: "na-record-1",
        localUri: "",
        uploaded: false,
        _raw: { is_not_applicable: true },
        markAsDeleted: jest.fn(),
        update: jest.fn(),
      };

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([photo]),
      });

      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });

      await PhotoStorage.syncWithFileSystem();

      expect(photo.markAsDeleted).not.toHaveBeenCalled();
      expect(photo.update).not.toHaveBeenCalled();
    });
  });

  describe("_formatBytes", () => {
    beforeEach(() => {
      jest.resetModules();
      FileSystem = require("expo-file-system");
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

  describe("saveNARecord", () => {
    beforeEach(async () => {
      jest.resetModules();
      FileSystem = require("expo-file-system");
      database = require("../../../src/services/offline/database").default;
      offlinePhotosCollection = require("../../../src/services/offline/database").offlinePhotosCollection;
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;

      // Re-apply default mocks
      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
    });

    it("should create N/A record without photo file", async () => {
      offlinePhotosCollection.create.mockImplementation(async (callback) => {
        const photo = {
          id: "na-record-1",
          _raw: {},
        };
        callback(photo);
        return photo;
      });

      const result = await PhotoStorage.saveNARecord("job-1", "No passes at property");

      expect(result.id).toBe("na-record-1");
      expect(result.isNotApplicable).toBe(true);
    });

    it("should set correct fields for N/A record", async () => {
      let createdPhoto = null;
      offlinePhotosCollection.create.mockImplementation(async (callback) => {
        createdPhoto = {
          id: "na-record-1",
          _raw: {},
        };
        callback(createdPhoto);
        return createdPhoto;
      });

      await PhotoStorage.saveNARecord("job-1", "No passes at property");

      expect(createdPhoto.jobId).toBe("job-1");
      expect(createdPhoto.photoType).toBe("passes");
      expect(createdPhoto.room).toBe("N/A");
      expect(createdPhoto.localUri).toBe("");
      expect(createdPhoto._raw.is_not_applicable).toBe(true);
    });

    it("should include notes in watermark data", async () => {
      let watermarkData = null;
      offlinePhotosCollection.create.mockImplementation(async (callback) => {
        const photo = {
          id: "na-record-1",
          _raw: {},
        };
        callback(photo);
        watermarkData = JSON.parse(photo._raw.watermark_data);
        return photo;
      });

      await PhotoStorage.saveNARecord("job-1", "No passes at this property");

      expect(watermarkData.isNotApplicable).toBe(true);
      expect(watermarkData.notes).toBe("No passes at this property");
      expect(watermarkData.photoType).toBe("passes");
    });

    it("should not copy any file for N/A record", async () => {
      offlinePhotosCollection.create.mockResolvedValue({ id: "na-record-1", _raw: {} });

      await PhotoStorage.saveNARecord("job-1");

      expect(FileSystem.copyAsync).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      offlinePhotosCollection.create.mockRejectedValue(new Error("Database error"));

      await expect(PhotoStorage.saveNARecord("job-1")).rejects.toThrow("Database error");
    });
  });

  describe("hasNAPassesForJob", () => {
    beforeEach(async () => {
      jest.resetModules();
      FileSystem = require("expo-file-system");
      offlinePhotosCollection = require("../../../src/services/offline/database").offlinePhotosCollection;
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;

      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
    });

    it("should return true if N/A passes record exists for job", async () => {
      const photos = [
        { id: "1", jobId: "job-1", photoType: "before", _raw: {} },
        { id: "2", jobId: "job-1", photoType: "passes", _raw: { is_not_applicable: true } },
      ];

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(photos),
      });

      const result = await PhotoStorage.hasNAPassesForJob("job-1");

      expect(result).toBe(true);
    });

    it("should return false if no N/A passes record exists", async () => {
      const photos = [
        { id: "1", jobId: "job-1", photoType: "before", _raw: {} },
        { id: "2", jobId: "job-1", photoType: "passes", _raw: {} }, // passes photo but not N/A
      ];

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(photos),
      });

      const result = await PhotoStorage.hasNAPassesForJob("job-1");

      expect(result).toBe(false);
    });

    it("should return false if no passes photos exist", async () => {
      const photos = [
        { id: "1", jobId: "job-1", photoType: "before", _raw: {} },
        { id: "2", jobId: "job-1", photoType: "after", _raw: {} },
      ];

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(photos),
      });

      const result = await PhotoStorage.hasNAPassesForJob("job-1");

      expect(result).toBe(false);
    });

    it("should return false if no photos exist for job", async () => {
      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      });

      const result = await PhotoStorage.hasNAPassesForJob("job-1");

      expect(result).toBe(false);
    });
  });

  describe("savePhoto with passes type", () => {
    beforeEach(async () => {
      jest.resetModules();
      FileSystem = require("expo-file-system");
      Crypto = require("expo-crypto");
      offlinePhotosCollection = require("../../../src/services/offline/database").offlinePhotosCollection;
      syncQueueCollection = require("../../../src/services/offline/database").syncQueueCollection;
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;

      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
      FileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
      FileSystem.copyAsync.mockResolvedValue(undefined);
      Crypto.randomUUID.mockReturnValue("test-uuid-5678");
      syncQueueCollection.create.mockResolvedValue({ id: "sync-1" });
    });

    it("should save passes photo with correct type", async () => {
      let savedPhoto = null;
      offlinePhotosCollection.create.mockImplementation(async (callback) => {
        savedPhoto = { id: "passes-1", _raw: {} };
        callback(savedPhoto);
        return savedPhoto;
      });
      syncQueueCollection.create.mockImplementation(async (callback) => {
        const op = { id: "sync-1", _raw: {} };
        callback(op);
        return op;
      });

      await PhotoStorage.savePhoto(
        "file:///temp/pass.jpg",
        "job-1",
        "passes",
        "Beach Pass"
      );

      expect(savedPhoto.photoType).toBe("passes");
      expect(savedPhoto.room).toBe("Beach Pass");
    });

    it("should use correct filename for passes", async () => {
      offlinePhotosCollection.create.mockResolvedValue({ id: "passes-1" });

      await PhotoStorage.savePhoto(
        "file:///temp/pass.jpg",
        "job-1",
        "passes",
        "Parking Pass"
      );

      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: "file:///temp/pass.jpg",
        to: expect.stringContaining("job-1_passes_Parking_Pass_test-uuid-5678.jpg"),
      });
    });
  });

  describe("saveMismatchPhoto", () => {
    beforeEach(async () => {
      jest.resetModules();
      FileSystem = require("expo-file-system");
      Crypto = require("expo-crypto");
      database = require("../../../src/services/offline/database").default;
      offlinePhotosCollection = require("../../../src/services/offline/database").offlinePhotosCollection;
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;

      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
      FileSystem.writeAsStringAsync = jest.fn().mockResolvedValue(undefined);
      FileSystem.EncodingType = { Base64: "base64" };
      Crypto.randomUUID.mockReturnValue("mismatch-uuid-1234");
    });

    it("should save mismatch photo from base64 data", async () => {
      let savedPhoto = null;
      offlinePhotosCollection.create.mockImplementation(async (callback) => {
        savedPhoto = { id: "mismatch-1", _raw: {} };
        callback(savedPhoto);
        return savedPhoto;
      });

      const result = await PhotoStorage.saveMismatchPhoto(
        "data:image/jpeg;base64,abc123",
        100,
        "bedroom",
        1
      );

      expect(result.id).toBe("mismatch-1");
      expect(result.roomType).toBe("bedroom");
      expect(result.roomNumber).toBe(1);
      expect(result.localUri).toContain("mismatch");
    });

    it("should return correct result structure", async () => {
      // Re-apply mock since jest.resetModules clears it
      FileSystem.writeAsStringAsync = jest.fn().mockResolvedValue(undefined);

      offlinePhotosCollection.create.mockImplementation(async (callback) => {
        const photo = { id: "mismatch-2", _raw: {} };
        callback(photo);
        return photo;
      });

      const result = await PhotoStorage.saveMismatchPhoto(
        "data:image/jpeg;base64,abc123content",
        100,
        "bathroom",
        2
      );

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("localUri");
      expect(result.roomType).toBe("bathroom");
      expect(result.roomNumber).toBe(2);
    });

    it("should set correct photo type as mismatch", async () => {
      // Re-apply mock since jest.resetModules clears it
      FileSystem.writeAsStringAsync = jest.fn().mockResolvedValue(undefined);

      let savedPhoto = null;
      offlinePhotosCollection.create.mockImplementation(async (callback) => {
        savedPhoto = { id: "mismatch-1", _raw: {} };
        callback(savedPhoto);
        return savedPhoto;
      });

      await PhotoStorage.saveMismatchPhoto("base64data", 100, "bedroom", 1);

      expect(savedPhoto.photoType).toBe("mismatch");
      expect(savedPhoto.room).toBe("bedroom_1");
    });
  });

  describe("getMismatchPhotosForJob", () => {
    beforeEach(async () => {
      jest.resetModules();
      FileSystem = require("expo-file-system");
      offlinePhotosCollection = require("../../../src/services/offline/database").offlinePhotosCollection;
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;

      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
    });

    it("should return only mismatch photos for the job", async () => {
      const photos = [
        { id: "1", jobId: 100, photoType: "before" },
        { id: "2", jobId: 100, photoType: "mismatch" },
        { id: "3", jobId: 100, photoType: "after" },
        { id: "4", jobId: 100, photoType: "mismatch" },
        { id: "5", jobId: 200, photoType: "mismatch" }, // Different job
      ];

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(photos),
      });

      const result = await PhotoStorage.getMismatchPhotosForJob(100);

      expect(result).toHaveLength(2);
      expect(result.every(p => p.photoType === "mismatch")).toBe(true);
      expect(result.every(p => p.jobId === 100)).toBe(true);
    });

    it("should return empty array if no mismatch photos exist", async () => {
      const photos = [
        { id: "1", jobId: 100, photoType: "before" },
        { id: "2", jobId: 100, photoType: "after" },
      ];

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(photos),
      });

      const result = await PhotoStorage.getMismatchPhotosForJob(100);

      expect(result).toHaveLength(0);
    });
  });

  describe("deleteMismatchPhotosForJob", () => {
    beforeEach(async () => {
      jest.resetModules();
      FileSystem = require("expo-file-system");
      database = require("../../../src/services/offline/database").default;
      offlinePhotosCollection = require("../../../src/services/offline/database").offlinePhotosCollection;
      PhotoStorage = require("../../../src/services/offline/PhotoStorage").default;

      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
      FileSystem.deleteAsync.mockResolvedValue(undefined);
    });

    it("should delete all mismatch photos for the job", async () => {
      const photos = [
        { id: "1", jobId: 100, photoType: "before" },
        { id: "2", jobId: 100, photoType: "mismatch" },
        { id: "3", jobId: 100, photoType: "mismatch" },
      ];

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(photos),
      });

      const deletedPhotoIds = [];
      offlinePhotosCollection.find.mockImplementation((id) => {
        deletedPhotoIds.push(id);
        return Promise.resolve({
          localUri: `/mock/path/${id}.jpg`,
          markAsDeleted: jest.fn(),
        });
      });

      await PhotoStorage.deleteMismatchPhotosForJob(100);

      expect(deletedPhotoIds).toContain("2");
      expect(deletedPhotoIds).toContain("3");
      expect(deletedPhotoIds).not.toContain("1"); // Not a mismatch photo
    });

    it("should handle errors gracefully for individual photos", async () => {
      const photos = [
        { id: "1", jobId: 100, photoType: "mismatch" },
        { id: "2", jobId: 100, photoType: "mismatch" },
      ];

      offlinePhotosCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(photos),
      });

      let deletedCount = 0;
      offlinePhotosCollection.find.mockImplementation((id) => {
        if (id === "1") {
          return Promise.reject(new Error("Not found"));
        }
        deletedCount++;
        return Promise.resolve({
          localUri: `/mock/path/${id}.jpg`,
          markAsDeleted: jest.fn(),
        });
      });

      // Should not throw, even if one photo fails
      await PhotoStorage.deleteMismatchPhotosForJob(100);

      // Second photo should still be deleted
      expect(deletedCount).toBe(1);
    });
  });
});
