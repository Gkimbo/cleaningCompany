import { useState, useEffect, useCallback } from "react";
import { useOffline } from "../OfflineContext";
import OfflineManager from "../OfflineManager";
import PhotoStorage from "../PhotoStorage";
import NetworkMonitor from "../NetworkMonitor";
import database, { offlineJobsCollection, offlineChecklistItemsCollection } from "../database";
import { OFFLINE_JOB_STATUS } from "../constants";

/**
 * Hook for managing a single offline job
 */
export function useOfflineJob(serverId) {
  const { isOffline, isOnline } = useOffline();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load the job
  const loadJob = useCallback(async () => {
    if (!serverId) {
      setLoading(false);
      return;
    }

    try {
      const localJob = await OfflineManager.getLocalJob(serverId);
      setJob(localJob);
      setError(null);
    } catch (err) {
      console.error("Error loading offline job:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  // Start the job
  const startJob = useCallback(
    async (locationData = {}) => {
      if (!job) throw new Error("Job not loaded");

      await OfflineManager.startJob(serverId, locationData);
      await loadJob();
    },
    [job, serverId, loadJob]
  );

  // Complete the job
  const completeJob = useCallback(
    async (hoursWorked = null) => {
      if (!job) throw new Error("Job not loaded");

      await OfflineManager.completeJob(serverId, hoursWorked);
      await loadJob();
    },
    [job, serverId, loadJob]
  );

  // Get photos for the job
  const getPhotos = useCallback(async () => {
    if (!job) return { before: [], after: [] };

    const photos = await PhotoStorage.getPhotosForJob(job.id);
    return {
      before: photos.filter((p) => p.photoType === "before"),
      after: photos.filter((p) => p.photoType === "after"),
    };
  }, [job]);

  // Save a photo
  const savePhoto = useCallback(
    async (uri, photoType, room, watermarkData = {}) => {
      if (!job) throw new Error("Job not loaded");

      return await PhotoStorage.savePhoto(uri, job.id, photoType, room, watermarkData);
    },
    [job]
  );

  // Delete a photo
  const deletePhoto = useCallback(async (photoId) => {
    await PhotoStorage.deletePhoto(photoId);
  }, []);

  return {
    job,
    loading,
    error,
    isOffline,
    isOnline,
    startJob,
    completeJob,
    getPhotos,
    savePhoto,
    deletePhoto,
    refresh: loadJob,
  };
}

/**
 * Hook for managing offline checklist
 */
export function useOfflineChecklist(jobId, appointmentId) {
  const { isOffline } = useOffline();
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(true);

  // Load checklist items
  const loadItems = useCallback(async () => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    try {
      const checklistItems = await offlineChecklistItemsCollection.query().fetch();
      const jobItems = checklistItems.filter((i) => i.jobId === jobId);

      const itemsMap = {};
      jobItems.forEach((item) => {
        itemsMap[item.itemId] = {
          completed: item.completed,
          completedAt: item.completedAt,
        };
      });
      setItems(itemsMap);
    } catch (err) {
      console.error("Error loading offline checklist:", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Mark item complete (one-way)
  const markComplete = useCallback(
    async (itemId) => {
      if (!jobId) return;

      // Check if already completed
      if (items[itemId]?.completed) {
        return; // Already completed, no-op
      }

      try {
        await OfflineManager.updateChecklistItem(jobId, itemId, true);
        setItems((prev) => ({
          ...prev,
          [itemId]: { completed: true, completedAt: new Date() },
        }));
      } catch (err) {
        console.error("Error marking item complete:", err);
        throw err;
      }
    },
    [jobId, items]
  );

  // Check if item is completed
  const isItemCompleted = useCallback(
    (itemId) => {
      return items[itemId]?.completed === true;
    },
    [items]
  );

  // Get completion stats
  const getStats = useCallback(
    (totalItems) => {
      const completedCount = Object.values(items).filter((i) => i.completed).length;
      return {
        completed: completedCount,
        total: totalItems,
        percent: totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0,
      };
    },
    [items]
  );

  return {
    items,
    loading,
    isOffline,
    markComplete,
    isItemCompleted,
    getStats,
    refresh: loadItems,
  };
}

/**
 * Hook for photo capture with offline support
 */
export function useOfflinePhotos(jobId, photoType) {
  const { isOffline } = useOffline();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Load photos
  const loadPhotos = useCallback(async () => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    try {
      const allPhotos = await PhotoStorage.getPhotosForJob(jobId);
      const filteredPhotos = allPhotos.filter((p) => p.photoType === photoType);
      setPhotos(filteredPhotos);
    } catch (err) {
      console.error("Error loading photos:", err);
    } finally {
      setLoading(false);
    }
  }, [jobId, photoType]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // Save a photo locally
  const savePhoto = useCallback(
    async (uri, room, watermarkData = {}) => {
      if (!jobId) throw new Error("Job not loaded");

      setUploading(true);
      try {
        const result = await PhotoStorage.savePhoto(uri, jobId, photoType, room, watermarkData);
        await loadPhotos();
        return result;
      } finally {
        setUploading(false);
      }
    },
    [jobId, photoType, loadPhotos]
  );

  // Delete a photo
  const deletePhoto = useCallback(
    async (photoId) => {
      await PhotoStorage.deletePhoto(photoId);
      await loadPhotos();
    },
    [loadPhotos]
  );

  // Get photos by room
  const getPhotosByRoom = useCallback(
    (roomName) => {
      return photos.filter((p) => p.room === roomName);
    },
    [photos]
  );

  // Get rooms with photos
  const getRoomsWithPhotos = useCallback(() => {
    const rooms = new Set();
    photos.forEach((p) => {
      if (p.room) rooms.add(p.room);
    });
    return rooms;
  }, [photos]);

  return {
    photos,
    loading,
    uploading,
    isOffline,
    savePhoto,
    deletePhoto,
    getPhotosByRoom,
    getRoomsWithPhotos,
    refresh: loadPhotos,
  };
}

export default { useOfflineJob, useOfflineChecklist, useOfflinePhotos };
