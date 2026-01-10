// Offline mode configuration constants

// Maximum time allowed offline before forcing sync prompt (in milliseconds)
export const MAX_OFFLINE_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours

// Background fetch interval (minimum allowed by OS)
export const BACKGROUND_FETCH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Sync retry configuration
export const SYNC_MAX_ATTEMPTS = 5;
export const SYNC_BASE_DELAY_MS = 1000; // 1 second
export const SYNC_MAX_DELAY_MS = 16000; // 16 seconds

// Photo configuration
export const PHOTO_COMPRESSION_QUALITY = 0.7;
export const PHOTO_MAX_WIDTH = 1920;
export const PHOTO_MAX_HEIGHT = 1080;

// Preload configuration
export const PRELOAD_DAYS_AHEAD = 2; // Today + tomorrow

// Network debounce (to avoid rapid online/offline toggling)
export const NETWORK_DEBOUNCE_MS = 2000; // 2 seconds

// Auto-sync configuration
export const AUTO_SYNC_COOLDOWN_MS = 30000; // 30 seconds cooldown between auto-syncs
export const MAX_AUTO_RETRY_ATTEMPTS = 3; // Max retries before giving up

// Storage paths
export const OFFLINE_PHOTOS_DIRECTORY = "offline_photos";

// Job statuses
export const OFFLINE_JOB_STATUS = {
  ASSIGNED: "assigned",
  STARTED: "started",
  COMPLETED: "completed",
  PENDING_SYNC: "pending_sync",
};

// Sync operation types (in order)
export const SYNC_OPERATION_ORDER = [
  "start",
  "accuracy",
  "before_photo",
  "checklist",
  "after_photo",
  "complete",
];

// Background task identifiers
export const BACKGROUND_SYNC_TASK = "OFFLINE_SYNC_TASK";
export const BACKGROUND_FETCH_TASK = "OFFLINE_FETCH_TASK";

// Network status
export const NETWORK_STATUS = {
  ONLINE: "online",
  OFFLINE: "offline",
  UNKNOWN: "unknown",
};

// Sync status
export const SYNC_STATUS = {
  IDLE: "idle",
  SYNCING: "syncing",
  COMPLETED: "completed",
  ERROR: "error",
};

// Calculate exponential backoff delay
export function getRetryDelay(attempt) {
  const delay = SYNC_BASE_DELAY_MS * Math.pow(2, attempt);
  return Math.min(delay, SYNC_MAX_DELAY_MS);
}

// Error messages for user-facing display
export const ERROR_MESSAGES = {
  // Network errors
  OFFLINE: "You're currently offline. Changes will sync when you're back online.",
  NO_CONNECTION: "Unable to connect. Please check your internet connection.",
  CONNECTION_LOST: "Connection lost during sync. We'll retry automatically.",
  TIMEOUT: "Request timed out. Please try again.",

  // Sync errors
  SYNC_FAILED: "Sync failed. Your changes are saved locally and will retry.",
  SYNC_PARTIAL: "Some items failed to sync. We'll keep trying.",
  SYNC_CONFLICT: "There's a conflict with your data. Please review.",
  SYNC_IN_PROGRESS: "Sync already in progress. Please wait.",

  // Auth errors
  AUTH_EXPIRED: "Your session expired. Please log in again to sync.",
  AUTH_REQUIRED: "Please log in to sync your data.",

  // Storage errors
  STORAGE_FULL: "Storage is full. Please sync and clear old data.",
  STORAGE_ERROR: "Failed to save locally. Please try again.",
  PHOTO_SAVE_FAILED: "Failed to save photo. Please try again.",
  PHOTO_NOT_FOUND: "Photo not found. It may have been deleted.",

  // Job errors
  JOB_NOT_FOUND: "Job not found. It may have been removed.",
  JOB_LOCKED: "This job is completed and cannot be modified.",
  JOB_CANCELLED: "This job has been cancelled.",
  JOB_ALREADY_STARTED: "This job has already been started.",

  // Checklist errors
  CHECKLIST_LOCKED: "Checklist items cannot be unchecked once completed.",
  CHECKLIST_SAVE_FAILED: "Failed to save checklist progress.",

  // Conflict errors
  CONFLICT_CANCELLATION: "This job was cancelled while you were offline.",
  CONFLICT_MULTI_CLEANER: "Another cleaner also worked on this job.",
  CONFLICT_DATA_MISMATCH: "The data on the server differs from your local changes.",

  // Offline limit
  OFFLINE_LIMIT_WARNING: "You've been offline for a while. Please sync soon.",
  OFFLINE_LIMIT_CRITICAL: "Approaching offline limit. Connect to sync your data.",
  OFFLINE_LIMIT_EXCEEDED: "Offline limit exceeded. Please connect to sync.",

  // Generic
  UNKNOWN_ERROR: "Something went wrong. Please try again.",
  RETRY_LATER: "Please try again later.",
};

// Error codes mapped to user-friendly messages
export const ERROR_CODE_MAP = {
  NETWORK_ERROR: ERROR_MESSAGES.NO_CONNECTION,
  FETCH_ERROR: ERROR_MESSAGES.NO_CONNECTION,
  TIMEOUT_ERROR: ERROR_MESSAGES.TIMEOUT,
  AUTH_ERROR: ERROR_MESSAGES.AUTH_EXPIRED,
  401: ERROR_MESSAGES.AUTH_EXPIRED,
  403: ERROR_MESSAGES.AUTH_REQUIRED,
  404: ERROR_MESSAGES.JOB_NOT_FOUND,
  409: ERROR_MESSAGES.SYNC_CONFLICT,
  500: ERROR_MESSAGES.UNKNOWN_ERROR,
  503: ERROR_MESSAGES.RETRY_LATER,
};

/**
 * Get user-friendly error message from error object or code
 */
export function getErrorMessage(error) {
  if (!error) return ERROR_MESSAGES.UNKNOWN_ERROR;

  // Check if it's already a user-friendly message
  if (Object.values(ERROR_MESSAGES).includes(error)) {
    return error;
  }

  // Check error code
  if (error.code && ERROR_CODE_MAP[error.code]) {
    return ERROR_CODE_MAP[error.code];
  }

  // Check HTTP status
  if (error.status && ERROR_CODE_MAP[error.status]) {
    return ERROR_CODE_MAP[error.status];
  }

  // Check if it's a network error
  if (error.message) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("fetch")) {
      return ERROR_MESSAGES.NO_CONNECTION;
    }
    if (msg.includes("timeout")) {
      return ERROR_MESSAGES.TIMEOUT;
    }
    if (msg.includes("offline")) {
      return ERROR_MESSAGES.OFFLINE;
    }
  }

  // Return the error message if it's short enough, otherwise generic
  if (error.message && error.message.length < 100) {
    return error.message;
  }

  return ERROR_MESSAGES.UNKNOWN_ERROR;
}
