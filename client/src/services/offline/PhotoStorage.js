import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import {
  OFFLINE_PHOTOS_DIRECTORY,
  PHOTO_COMPRESSION_QUALITY,
  PHOTO_MAX_WIDTH,
  PHOTO_MAX_HEIGHT,
  MIN_FREE_SPACE_BYTES,
  STORAGE_WARNING_THRESHOLD,
  ESTIMATED_PHOTO_SIZE,
  MISSING_FILE_CHECK_THRESHOLD,
} from "./constants";
import database, { offlinePhotosCollection, syncQueueCollection } from "./database";
import { SYNC_OPERATION_TYPES, OPERATION_SEQUENCE, SYNC_STATUS } from "./database/models/SyncQueue";

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

  // Check available storage space
  async checkStorageSpace() {
    try {
      await this.initialize();
      const info = await FileSystem.getFreeDiskStorageAsync();

      return {
        freeBytes: info,
        hasMinimumSpace: info >= MIN_FREE_SPACE_BYTES,
        isLowSpace: info < STORAGE_WARNING_THRESHOLD,
        canSavePhoto: info >= ESTIMATED_PHOTO_SIZE + MIN_FREE_SPACE_BYTES,
        formattedFree: this._formatBytes(info),
      };
    } catch (error) {
      console.error("Failed to check storage space:", error);
      // Return conservative result if check fails - safer to warn than lose data
      return {
        freeBytes: null,
        hasMinimumSpace: false,
        isLowSpace: true,
        canSavePhoto: false,
        formattedFree: "Unknown",
        error: error.message,
        checkFailed: true, // Flag to indicate check failure vs actual low space
      };
    }
  }

  // Format bytes to human readable
  _formatBytes(bytes) {
    if (bytes === null || bytes === undefined) return "Unknown";
    if (typeof bytes !== "number" || isNaN(bytes)) return "Unknown";
    if (bytes < 0) return "Unknown"; // Negative bytes don't make sense
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"]; // Added TB for completeness
    let i = Math.floor(Math.log(bytes) / Math.log(k));
    // Clamp index to valid range to prevent array out of bounds
    i = Math.min(i, sizes.length - 1);
    const value = bytes / Math.pow(k, i);
    // Format with up to 1 decimal, but strip trailing zeros
    const formatted = value % 1 === 0 ? value.toString() : value.toFixed(1);
    return `${formatted} ${sizes[i]}`;
  }

  // Save a photo locally and queue for sync
  async savePhoto(uri, jobId, photoType, room, watermarkData = {}) {
    await this.initialize();

    // Check storage space before saving
    const storageInfo = await this.checkStorageSpace();
    if (!storageInfo.canSavePhoto) {
      // If check failed (not actual low space), warn but allow save attempt
      if (storageInfo.checkFailed) {
        console.warn(`[PhotoStorage] Storage check failed, attempting save anyway: ${storageInfo.error}`);
      } else {
        const error = new Error(
          `Insufficient storage space. Only ${storageInfo.formattedFree} available. ` +
          `Please free up space or sync your photos to continue.`
        );
        error.code = "STORAGE_FULL";
        error.storageInfo = storageInfo;
        throw error;
      }
    } else if (storageInfo.isLowSpace) {
      // Warn if storage is low (but still allow saving)
      console.warn(`[PhotoStorage] Low storage warning: Only ${storageInfo.formattedFree} free`);
    }

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

      // Determine operation type based on photo type
      let operationType;
      switch (photoType) {
        case "before":
          operationType = SYNC_OPERATION_TYPES.BEFORE_PHOTO;
          break;
        case "after":
          operationType = SYNC_OPERATION_TYPES.AFTER_PHOTO;
          break;
        case "passes":
          operationType = SYNC_OPERATION_TYPES.PASSES_PHOTO;
          break;
        default:
          operationType = SYNC_OPERATION_TYPES.BEFORE_PHOTO;
      }

      // Save to WatermelonDB and add to sync queue in single transaction
      const photo = await database.write(async () => {
        const newPhoto = await offlinePhotosCollection.create((p) => {
          p.jobId = jobId;
          p.photoType = photoType;
          p.room = room;
          p.localUri = localUri;
          p._raw.watermark_data = JSON.stringify(watermark);
          p.uploaded = false;
          p.uploadAttempts = 0;
          p._raw.created_at = Date.now();
        });

        // Add to sync queue for automatic upload when online
        await syncQueueCollection.create((op) => {
          op.jobId = jobId;
          op.operationType = operationType;
          op.sequenceNumber = OPERATION_SEQUENCE[operationType];
          op._raw.payload = JSON.stringify({
            photoId: newPhoto.id,
            photoType,
            room,
          });
          op.status = SYNC_STATUS.PENDING;
          op.attempts = 0;
          op._raw.created_at = Date.now();
          op._raw.updated_at = Date.now();
        });

        return newPhoto;
      });

      return {
        id: photo.id,
        localUri,
        watermarkData: watermark,
        queuedForSync: true,
      };
    } catch (error) {
      console.error("Failed to save photo:", error);
      throw error;
    }
  }

  // Safely parse watermark data with recovery
  _parseWatermarkData(photo) {
    try {
      if (!photo._raw?.watermark_data) {
        return this._createDefaultWatermark(photo);
      }
      const parsed = JSON.parse(photo._raw.watermark_data);
      // Validate essential fields exist
      if (!parsed.timestamp || !parsed.jobId) {
        console.warn(`[PhotoStorage] Watermark data missing required fields for photo ${photo.id}`);
        return this._createDefaultWatermark(photo);
      }
      return parsed;
    } catch (error) {
      console.error(`[PhotoStorage] Failed to parse watermark data for photo ${photo.id}:`, error);
      return this._createDefaultWatermark(photo);
    }
  }

  // Create default watermark from photo metadata (recovery fallback)
  _createDefaultWatermark(photo) {
    return {
      timestamp: photo._raw?.created_at ? new Date(photo._raw.created_at).toISOString() : new Date().toISOString(),
      jobId: photo.jobId,
      photoType: photo.photoType,
      room: photo.room,
      recovered: true, // Flag indicating this was recovered
    };
  }

  // Validate and repair watermark if corrupted (proactive detection)
  async _validateAndRepairWatermark(photo) {
    try {
      if (photo._raw?.watermark_data) {
        JSON.parse(photo._raw.watermark_data);
        return false; // No repair needed
      }
    } catch {
      // Watermark is corrupted - repair it
      console.warn(`[PhotoStorage] Repairing corrupted watermark for photo ${photo.id}`);
      const recoveredWatermark = this._createDefaultWatermark(photo);
      await database.write(async () => {
        await photo.update((p) => {
          p._raw.watermark_data = JSON.stringify(recoveredWatermark);
          p._raw.watermark_repaired_at = Date.now();
        });
      });
      return true; // Repair performed
    }
    return false;
  }

  // Get all photos for a job (with proactive watermark validation)
  async getPhotosForJob(jobId, validateWatermarks = false) {
    const photos = await offlinePhotosCollection.query().fetch();
    const jobPhotos = photos.filter((p) => p.jobId === jobId);

    // Optionally validate watermarks proactively
    if (validateWatermarks) {
      for (const photo of jobPhotos) {
        await this._validateAndRepairWatermark(photo);
      }
    }

    return jobPhotos;
  }

  // Get unuploaded photos (with proactive watermark validation before sync)
  async getUnuploadedPhotos(validateWatermarks = true) {
    const photos = await offlinePhotosCollection.query().fetch();
    const unuploaded = photos.filter((p) => !p.uploaded);

    // Validate watermarks proactively before sync to catch corruption early
    if (validateWatermarks) {
      let repaired = 0;
      for (const photo of unuploaded) {
        if (await this._validateAndRepairWatermark(photo)) {
          repaired++;
        }
      }
      if (repaired > 0) {
        console.log(`[PhotoStorage] Repaired ${repaired} corrupted watermarks before sync`);
      }
    }

    return unuploaded;
  }

  // Mark photo as uploaded - returns updated photo to prevent stale references
  // Handles race conditions where photo may be deleted during operation
  async markAsUploaded(photoId) {
    let updatedPhoto = null;
    try {
      await database.write(async () => {
        // Find photo - may throw if deleted
        let photo;
        try {
          photo = await offlinePhotosCollection.find(photoId);
        } catch (findError) {
          console.warn(`[PhotoStorage] Photo ${photoId} not found during markAsUploaded (may have been deleted)`);
          return; // Exit write block gracefully
        }

        // Update the photo
        await photo.update((p) => {
          p.uploaded = true;
          p._raw.uploaded_at = Date.now();
        });

        // Re-fetch INSIDE the write block to get fresh reference with updated values
        try {
          updatedPhoto = await offlinePhotosCollection.find(photoId);
        } catch (refetchError) {
          // Photo was deleted after update (edge case) - use original reference
          console.warn(`[PhotoStorage] Photo ${photoId} deleted after update, using stale reference`);
          updatedPhoto = photo;
        }
      });
    } catch (writeError) {
      console.error(`[PhotoStorage] Failed to mark photo ${photoId} as uploaded:`, writeError);
      throw writeError;
    }
    return updatedPhoto;
  }

  // Increment upload attempts - returns updated photo to prevent stale references
  // Handles race conditions where photo may be deleted during operation
  async incrementUploadAttempts(photoId) {
    let updatedPhoto = null;
    try {
      await database.write(async () => {
        // Find photo - may throw if deleted
        let photo;
        try {
          photo = await offlinePhotosCollection.find(photoId);
        } catch (findError) {
          console.warn(`[PhotoStorage] Photo ${photoId} not found during incrementUploadAttempts (may have been deleted)`);
          return; // Exit write block gracefully
        }

        // Update the photo
        await photo.update((p) => {
          // Ensure uploadAttempts is a valid number before incrementing
          const currentAttempts = typeof p.uploadAttempts === "number" && !isNaN(p.uploadAttempts)
            ? p.uploadAttempts
            : 0;
          p.uploadAttempts = currentAttempts + 1;
          p._raw.last_attempt_at = Date.now();
        });

        // Re-fetch INSIDE the write block to get fresh reference with updated values
        try {
          updatedPhoto = await offlinePhotosCollection.find(photoId);
        } catch (refetchError) {
          // Photo was deleted after update (edge case) - use original reference
          console.warn(`[PhotoStorage] Photo ${photoId} deleted after update, using stale reference`);
          updatedPhoto = photo;
        }
      });
    } catch (writeError) {
      console.error(`[PhotoStorage] Failed to increment upload attempts for photo ${photoId}:`, writeError);
      throw writeError;
    }
    return updatedPhoto;
  }

  // Delete a photo file and record
  // Deletes file FIRST to prevent orphaned files if DB delete succeeds but file delete fails
  async deletePhoto(photoId) {
    let photo;
    let localUri;

    try {
      photo = await offlinePhotosCollection.find(photoId);
      localUri = photo.localUri;
    } catch (error) {
      // Photo record not found - nothing to delete
      console.warn(`Photo record ${photoId} not found, skipping delete`);
      return;
    }

    // Step 1: Delete file first (if it exists and has a URI)
    if (localUri) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(localUri);
        }
      } catch (fileError) {
        // Log but don't throw - file might already be deleted or inaccessible
        // We still want to clean up the database record
        console.warn(`Failed to delete photo file ${localUri}:`, fileError);
      }
    }

    // Step 2: Delete from database only after file is handled
    try {
      await database.write(async () => {
        await photo.markAsDeleted();
      });
    } catch (dbError) {
      console.error(`Failed to delete photo record ${photoId}:`, dbError);
      throw dbError;
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

  // Save a mismatch photo from base64 data
  async saveMismatchPhoto(base64Data, jobId, roomType, roomNumber) {
    await this.initialize();

    // Check storage space before saving
    const storageInfo = await this.checkStorageSpace();
    if (!storageInfo.canSavePhoto) {
      // If check failed (not actual low space), warn but allow save attempt
      if (storageInfo.checkFailed) {
        console.warn(`[PhotoStorage] Storage check failed, attempting save anyway: ${storageInfo.error}`);
      } else {
        const error = new Error(
          `Insufficient storage space. Only ${storageInfo.formattedFree} available. ` +
          `Please free up space or sync your photos to continue.`
        );
        error.code = "STORAGE_FULL";
        error.storageInfo = storageInfo;
        throw error;
      }
    }

    const uuid = await Crypto.randomUUID();
    const filename = `${jobId}_mismatch_${roomType}_${roomNumber}_${uuid}.jpg`;
    const localUri = `${this._baseDirectory}${filename}`;

    try {
      // Write base64 data to file
      // Remove the data:image/jpeg;base64, prefix if present
      const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
      await FileSystem.writeAsStringAsync(localUri, base64Content, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Create photo record in database (no sync queue - mismatch report handles that)
      const photo = await database.write(async () => {
        return await offlinePhotosCollection.create((p) => {
          p.jobId = jobId;
          p.photoType = "mismatch";
          p.room = `${roomType}_${roomNumber}`;
          p.localUri = localUri;
          p._raw.watermark_data = JSON.stringify({
            timestamp: new Date().toISOString(),
            jobId,
            photoType: "mismatch",
            roomType,
            roomNumber,
          });
          p.uploaded = false;
          p.uploadAttempts = 0;
          p._raw.created_at = Date.now();
        });
      });

      return {
        id: photo.id,
        localUri,
        roomType,
        roomNumber,
      };
    } catch (error) {
      console.error("Failed to save mismatch photo:", error);
      throw error;
    }
  }

  // Get mismatch photos for a job
  async getMismatchPhotosForJob(jobId) {
    const photos = await this.getPhotosForJob(jobId);
    return photos.filter((p) => p.photoType === "mismatch");
  }

  // Delete mismatch photos for a job (after successful sync or cancellation)
  async deleteMismatchPhotosForJob(jobId) {
    const mismatchPhotos = await this.getMismatchPhotosForJob(jobId);
    for (const photo of mismatchPhotos) {
      try {
        await this.deletePhoto(photo.id);
      } catch (error) {
        console.error(`Failed to delete mismatch photo ${photo.id}:`, error);
      }
    }
  }

  // Get photo with parsed watermark data (safe from corruption)
  async getPhotoWithWatermark(photoId) {
    try {
      const photo = await offlinePhotosCollection.find(photoId);
      return {
        ...photo,
        watermarkData: this._parseWatermarkData(photo),
      };
    } catch (error) {
      console.error(`[PhotoStorage] Failed to get photo ${photoId}:`, error);
      return null;
    }
  }

  // Repair corrupted watermark data for all photos
  async repairCorruptedWatermarks() {
    const photos = await offlinePhotosCollection.query().fetch();
    let repaired = 0;
    let errors = 0;

    for (const photo of photos) {
      try {
        // Try to parse existing watermark
        if (photo._raw?.watermark_data) {
          JSON.parse(photo._raw.watermark_data);
          continue; // Parses fine, skip
        }
      } catch {
        // Watermark is corrupted - repair it
        try {
          const recoveredWatermark = this._createDefaultWatermark(photo);
          await database.write(async () => {
            await photo.update((p) => {
              p._raw.watermark_data = JSON.stringify(recoveredWatermark);
            });
          });
          repaired++;
          console.log(`[PhotoStorage] Repaired watermark for photo ${photo.id}`);
        } catch (updateError) {
          errors++;
          console.error(`[PhotoStorage] Failed to repair watermark for photo ${photo.id}:`, updateError);
        }
      }
    }

    return { repaired, errors, total: photos.length };
  }

  // Sync photo records with file system (cleanup orphans)
  // Uses retry mechanism to avoid deleting records for temporarily unavailable files
  async syncWithFileSystem() {
    await this.initialize();

    const photos = await offlinePhotosCollection.query().fetch();

    for (const photo of photos) {
      // Skip N/A records (they don't have actual files)
      if (photo._raw?.is_not_applicable || !photo.localUri) {
        continue;
      }

      const exists = await this.photoExists(photo.localUri);
      if (!exists && !photo.uploaded) {
        // Photo record exists but file is missing
        // Check if this is a persistent issue by tracking missing count
        const currentMissingCount = (photo._raw?.missing_file_checks || 0) + 1;

        if (currentMissingCount >= MISSING_FILE_CHECK_THRESHOLD) {
          // File has been missing for multiple checks - safe to delete
          console.warn(`Orphaned photo record (missing ${currentMissingCount} times): ${photo.id}`);
          await database.write(async () => {
            await photo.markAsDeleted();
          });
        } else {
          // Increment missing count but don't delete yet
          console.warn(`Photo file temporarily missing (check ${currentMissingCount}/${MISSING_FILE_CHECK_THRESHOLD}): ${photo.id}`);
          await database.write(async () => {
            await photo.update((p) => {
              p._raw.missing_file_checks = currentMissingCount;
            });
          });
        }
      } else if (exists && photo._raw?.missing_file_checks > 0) {
        // File is back - reset the missing count
        await database.write(async () => {
          await photo.update((p) => {
            p._raw.missing_file_checks = 0;
          });
        });
      }
    }
  }
}

// Export singleton instance
export default new PhotoStorage();
