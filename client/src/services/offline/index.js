// Offline Mode Services
// Main entry point for offline functionality

// Core services
export { default as NetworkMonitor } from "./NetworkMonitor";
export { default as OfflineManager } from "./OfflineManager";
export { default as PhotoStorage } from "./PhotoStorage";
export { default as SyncEngine } from "./SyncEngine";
export { default as ConflictResolver } from "./ConflictResolver";
export { default as BackgroundSync } from "./BackgroundSync";
export { default as StorageManager } from "./StorageManager";

// Database
export { default as database } from "./database";
export {
  offlineJobsCollection,
  offlinePhotosCollection,
  offlineChecklistItemsCollection,
  syncQueueCollection,
  syncConflictsCollection,
  // Business Owner collections
  offlineEmployeesCollection,
  offlineOwnerAssignmentsCollection,
  offlineDashboardCacheCollection,
  // Messaging collection
  offlineMessagesCollection,
  resetDatabase,
  getPendingSyncCount,
  getJobsRequiringSync,
} from "./database";

// Context
export { OfflineProvider, useOffline, useNetworkStatus, useSyncStatus } from "./OfflineContext";

// Hooks
export { useOfflineJob, useOfflineChecklist, useOfflinePhotos } from "./hooks";

// Offline-aware services
export { default as OfflineBusinessEmployeeService } from "./OfflineBusinessEmployeeService";
export { default as OfflineBusinessOwnerService } from "./OfflineBusinessOwnerService";
export { default as OfflineMessagingService } from "./OfflineMessagingService";

// Constants
export * from "./constants";

// Database models
export { default as OfflineJob } from "./database/models/OfflineJob";
export { default as OfflinePhoto } from "./database/models/OfflinePhoto";
export { default as OfflineChecklistItem } from "./database/models/OfflineChecklistItem";
export { default as SyncQueue, SYNC_OPERATION_TYPES, OPERATION_SEQUENCE } from "./database/models/SyncQueue";
export { default as SyncConflict, CONFLICT_TYPES, RESOLUTION_TYPES } from "./database/models/SyncConflict";
// Business Owner models
export { default as OfflineEmployee } from "./database/models/OfflineEmployee";
export { default as OfflineOwnerAssignment } from "./database/models/OfflineOwnerAssignment";
export { default as OfflineDashboardCache, CACHE_KEYS } from "./database/models/OfflineDashboardCache";
// Messaging models
export { default as OfflineMessage, MESSAGE_TYPES, MESSAGE_STATUS } from "./database/models/OfflineMessage";
