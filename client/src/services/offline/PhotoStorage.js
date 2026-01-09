import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import {
  OFFLINE_PHOTOS_DIRECTORY,
  PHOTO_COMPRESSION_QUALITY,
  PHOTO_MAX_WIDTH,
  PHOTO_MAX_HEIGHT,
} from "./constants";
import database, { offlinePhotosCollection } from "./database";

class PhotoStorage {
  constructor() {
    this._baseDirectory = null;
    this._initialized = false;
  }

  // Initialize storage directory
  async initialize() {
    if (this._initialized) return;

    this._baseDirectory = `${FileSystem.documentDirectory}${OFFLINE_PHOTOS_DIRECTORY}/`;

    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(this._baseDirectory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this._baseDirectory, { intermediates: true });
    }

    this._initialized = true;
  }

  // Generate a unique filename for a photo
  async _generateFilename(jobId, photoType, room) {
    const uuid = await Crypto.randomUUID();
    const sanitizedRoom = room.replace(/[^a-zA-Z0-9]/g, "_");
    return `${jobId}_${photoType}_${sanitizedRoom}_${uuid}.jpg`;
  }

  // Save a photo locally
  async savePhoto(uri, jobId, photoType, room, watermarkData = {}) {
    await this.initialize();

    const filename = await this._generateFilename(jobId, photoType, room);
    const localUri = `${this._baseDirectory}${filename}`;

    try {
      // Copy the photo to our local storage
      await FileSystem.copyAsync({
        from: uri,
        to: localUri,
      });

      // Create watermark data
      const watermark = {
        timestamp: new Date().toISOString(),
        jobId,
        photoType,
        room,
        deviceId: watermarkData.deviceId || null,
        ...watermarkData,
      };

      // Save to WatermelonDB
      const photo = await database.write(async () => {
        return await offlinePhotosCollection.create((p) => {
          p.jobId = jobId;
          p.photoType = photoType;
          p.room = room;
          p.localUri = localUri;
          p._raw.watermark_data = JSON.stringify(watermark);
          p.uploaded = false;
          p.uploadAttempts = 0;
          p._raw.created_at = Date.now();
        });
      });

      return {
        id: photo.id,
        localUri,
        watermarkData: watermark,
      };
    } catch (error) {
      console.error("Failed to save photo:", error);
      throw error;
    }
  }

  // Get all photos for a job
  async getPhotosForJob(jobId) {
    const photos = await offlinePhotosCollection.query().fetch();
    return photos.filter((p) => p.jobId === jobId);
  }

  // Get unuploaded photos
  async getUnuploadedPhotos() {
    const photos = await offlinePhotosCollection.query().fetch();
    return photos.filter((p) => !p.uploaded);
  }

  // Mark photo as uploaded
  async markAsUploaded(photoId) {
    await database.write(async () => {
      const photo = await offlinePhotosCollection.find(photoId);
      await photo.update((p) => {
        p.uploaded = true;
      });
    });
  }

  // Increment upload attempts
  async incrementUploadAttempts(photoId) {
    await database.write(async () => {
      const photo = await offlinePhotosCollection.find(photoId);
      await photo.update((p) => {
        p.uploadAttempts = p.uploadAttempts + 1;
      });
    });
  }

  // Delete a photo file and record
  async deletePhoto(photoId) {
    try {
      const photo = await offlinePhotosCollection.find(photoId);
      const localUri = photo.localUri;

      // Delete from database first
      await database.write(async () => {
        await photo.markAsDeleted();
      });

      // Then delete file
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localUri);
      }
    } catch (error) {
      console.error("Failed to delete photo:", error);
      throw error;
    }
  }

  // Clean up uploaded photos for a job
  async cleanupUploadedPhotos(jobId) {
    const photos = await this.getPhotosForJob(jobId);
    const uploadedPhotos = photos.filter((p) => p.uploaded);

    for (const photo of uploadedPhotos) {
      try {
        await this.deletePhoto(photo.id);
      } catch (error) {
        console.error(`Failed to cleanup photo ${photo.id}:`, error);
      }
    }
  }

  // Get storage usage stats
  async getStorageStats() {
    await this.initialize();

    try {
      const dirInfo = await FileSystem.getInfoAsync(this._baseDirectory);
      if (!dirInfo.exists) {
        return { totalSize: 0, photoCount: 0 };
      }

      const files = await FileSystem.readDirectoryAsync(this._baseDirectory);
      let totalSize = 0;

      for (const file of files) {
        const fileInfo = await FileSystem.getInfoAsync(`${this._baseDirectory}${file}`);
        if (fileInfo.exists && fileInfo.size) {
          totalSize += fileInfo.size;
        }
      }

      return {
        totalSize,
        photoCount: files.length,
        formattedSize: this._formatBytes(totalSize),
      };
    } catch (error) {
      console.error("Failed to get storage stats:", error);
      return { totalSize: 0, photoCount: 0, formattedSize: "0 B" };
    }
  }

  // Format bytes to human readable
  _formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  // Clean up all local photos (use with caution)
  async clearAllPhotos() {
    await this.initialize();

    try {
      // Delete all photo records
      const photos = await offlinePhotosCollection.query().fetch();
      await database.write(async () => {
        for (const photo of photos) {
          await photo.markAsDeleted();
        }
      });

      // Delete the directory
      const dirInfo = await FileSystem.getInfoAsync(this._baseDirectory);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(this._baseDirectory);
        await FileSystem.makeDirectoryAsync(this._baseDirectory, { intermediates: true });
      }
    } catch (error) {
      console.error("Failed to clear all photos:", error);
      throw error;
    }
  }

  // Check if photo file exists
  async photoExists(localUri) {
    try {
      const info = await FileSystem.getInfoAsync(localUri);
      return info.exists;
    } catch {
      return false;
    }
  }

  // Save a N/A pass record (no photo file, just metadata)
  async saveNARecord(jobId, notes = null) {
    try {
      const photo = await database.write(async () => {
        return await offlinePhotosCollection.create((p) => {
          p.jobId = jobId;
          p.photoType = "passes";
          p.room = "N/A";
          p.localUri = "";
          p._raw.watermark_data = JSON.stringify({
            timestamp: new Date().toISOString(),
            jobId,
            photoType: "passes",
            isNotApplicable: true,
            notes,
          });
          p.uploaded = false;
          p.uploadAttempts = 0;
          p._raw.is_not_applicable = true;
          p._raw.created_at = Date.now();
        });
      });

      return {
        id: photo.id,
        isNotApplicable: true,
      };
    } catch (error) {
      console.error("Failed to save N/A record:", error);
      throw error;
    }
  }

  // Check if passes have been marked as N/A for a job
  async hasNAPassesForJob(jobId) {
    const photos = await this.getPhotosForJob(jobId);
    return photos.some((p) => p.photoType === "passes" && p._raw?.is_not_applicable);
  }

  // Sync photo records with file system (cleanup orphans)
  async syncWithFileSystem() {
    await this.initialize();

    const photos = await offlinePhotosCollection.query().fetch();

    for (const photo of photos) {
      const exists = await this.photoExists(photo.localUri);
      if (!exists && !photo.uploaded) {
        // Photo record exists but file is missing - mark for re-sync or delete
        console.warn(`Orphaned photo record: ${photo.id}`);
        await database.write(async () => {
          await photo.markAsDeleted();
        });
      }
    }
  }
}

// Export singleton instance
export default new PhotoStorage();
