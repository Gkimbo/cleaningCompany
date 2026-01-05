import { Model } from "@nozbe/watermelondb";
import { field, date, relation, json } from "@nozbe/watermelondb/decorators";

const sanitizeJSON = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const CONFLICT_TYPES = {
  CANCELLATION: "cancellation", // Homeowner cancelled while cleaner was working
  MULTI_CLEANER: "multi_cleaner", // Multiple cleaners worked on same job offline
  DATA_MISMATCH: "data_mismatch", // Server data differs from local
};

export const RESOLUTION_TYPES = {
  LOCAL_WINS: "local_wins",
  SERVER_WINS: "server_wins",
  MERGED: "merged",
};

export default class SyncConflict extends Model {
  static table = "sync_conflicts";

  static associations = {
    offline_jobs: { type: "belongs_to", key: "job_id" },
  };

  @field("job_id") jobId;
  @field("conflict_type") conflictType;
  @json("local_data", sanitizeJSON) localData;
  @json("server_data", sanitizeJSON) serverData;
  @field("resolution") resolution;
  @field("resolved") resolved;
  @date("created_at") createdAt;
  @date("resolved_at") resolvedAt;

  @relation("offline_jobs", "job_id") job;

  // Resolve with specified resolution type
  async resolve(resolutionType) {
    await this.update((conflict) => {
      conflict.resolution = resolutionType;
      conflict.resolved = true;
      conflict.resolvedAt = new Date();
    });
  }

  // Get conflict summary for display
  get summary() {
    switch (this.conflictType) {
      case CONFLICT_TYPES.CANCELLATION:
        return "Job was cancelled while you were working offline";
      case CONFLICT_TYPES.MULTI_CLEANER:
        return "Another cleaner also worked on this job";
      case CONFLICT_TYPES.DATA_MISMATCH:
        return "Server data differs from local changes";
      default:
        return "Unknown conflict";
    }
  }
}
