import { Model } from "@nozbe/watermelondb";
import { field, date, relation, json } from "@nozbe/watermelondb/decorators";

const sanitizeJSON = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    // Log parsing errors to help diagnose data corruption
    console.warn("[SyncQueue] JSON parse error:", error.message, "Raw value:", typeof raw === "string" ? raw.substring(0, 100) : typeof raw);
    return null;
  }
};

// Operation types in strict order
export const SYNC_OPERATION_TYPES = {
  START: "start",
  HOME_SIZE_MISMATCH: "home_size_mismatch", // Must sync before starting job
  ACCURACY: "accuracy",
  BEFORE_PHOTO: "before_photo",
  CHECKLIST: "checklist",
  AFTER_PHOTO: "after_photo",
  PASSES_PHOTO: "passes_photo", // Beach/parking/lift pass verification
  COMPLETE: "complete",
  MESSAGE: "message", // Messages and notes sync last
};

// Sequence order for strict sync ordering
export const OPERATION_SEQUENCE = {
  [SYNC_OPERATION_TYPES.START]: 1,
  [SYNC_OPERATION_TYPES.HOME_SIZE_MISMATCH]: 2, // Before accuracy, sync ASAP
  [SYNC_OPERATION_TYPES.ACCURACY]: 3,
  [SYNC_OPERATION_TYPES.BEFORE_PHOTO]: 4,
  [SYNC_OPERATION_TYPES.CHECKLIST]: 5,
  [SYNC_OPERATION_TYPES.AFTER_PHOTO]: 6,
  [SYNC_OPERATION_TYPES.PASSES_PHOTO]: 7,
  [SYNC_OPERATION_TYPES.COMPLETE]: 8,
  [SYNC_OPERATION_TYPES.MESSAGE]: 9,
};

export const SYNC_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  FAILED: "failed",
};

// Valid operation types as a Set for O(1) lookup
const VALID_OPERATION_TYPES = new Set(Object.values(SYNC_OPERATION_TYPES));

// Validate that an operation type is valid
export function isValidOperationType(operationType) {
  return VALID_OPERATION_TYPES.has(operationType);
}

// Get sequence number for an operation type, with validation
export function getSequenceNumber(operationType) {
  if (!isValidOperationType(operationType)) {
    console.error(`[SyncQueue] Invalid operation type: ${operationType}`);
    return null;
  }
  return OPERATION_SEQUENCE[operationType];
}

export default class SyncQueue extends Model {
  static table = "sync_queue";

  static associations = {
    offline_jobs: { type: "belongs_to", key: "job_id" },
  };

  @field("job_id") jobId;
  @field("operation_type") operationType;
  @field("sequence_number") sequenceNumber;
  @json("payload", sanitizeJSON) payload;
  @field("status") status;
  @field("attempts") attempts;
  @field("last_error") lastError;
  @date("created_at") createdAt;
  @date("updated_at") updatedAt;

  @relation("offline_jobs", "job_id") job;

  // Max retry attempts
  static MAX_ATTEMPTS = 5;

  // Check if operation can be retried
  get canRetry() {
    return this.status === SYNC_STATUS.FAILED && this.attempts < SyncQueue.MAX_ATTEMPTS;
  }

  // Increment attempts and update status
  async markInProgress() {
    await this.update((op) => {
      op.status = SYNC_STATUS.IN_PROGRESS;
      op.updatedAt = new Date();
    });
  }

  async markCompleted() {
    await this.update((op) => {
      op.status = SYNC_STATUS.COMPLETED;
      op.updatedAt = new Date();
    });
  }

  async markFailed(error) {
    await this.update((op) => {
      op.status = SYNC_STATUS.FAILED;
      op.attempts = op.attempts + 1;
      op.lastError = error?.message || String(error);
      op.updatedAt = new Date();
    });
  }
}
