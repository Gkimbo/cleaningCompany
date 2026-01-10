import { Model } from "@nozbe/watermelondb";
import { field, date, relation, json } from "@nozbe/watermelondb/decorators";

const sanitizeJSON = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Operation types in strict order
export const SYNC_OPERATION_TYPES = {
  START: "start",
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
  [SYNC_OPERATION_TYPES.ACCURACY]: 2,
  [SYNC_OPERATION_TYPES.BEFORE_PHOTO]: 3,
  [SYNC_OPERATION_TYPES.CHECKLIST]: 4,
  [SYNC_OPERATION_TYPES.AFTER_PHOTO]: 5,
  [SYNC_OPERATION_TYPES.PASSES_PHOTO]: 6,
  [SYNC_OPERATION_TYPES.COMPLETE]: 7,
  [SYNC_OPERATION_TYPES.MESSAGE]: 8,
};

export const SYNC_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  FAILED: "failed",
};

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
