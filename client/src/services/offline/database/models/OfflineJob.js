import { Model } from "@nozbe/watermelondb";
import { field, date, children, json } from "@nozbe/watermelondb/decorators";

const sanitizeJSON = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default class OfflineJob extends Model {
  static table = "offline_jobs";

  static associations = {
    offline_photos: { type: "has_many", foreignKey: "job_id" },
    offline_checklist_items: { type: "has_many", foreignKey: "job_id" },
    sync_queue: { type: "has_many", foreignKey: "job_id" },
  };

  @field("server_id") serverId;
  @field("appointment_id") appointmentId;
  @field("status") status;
  @json("job_data", sanitizeJSON) jobData;
  @date("started_at") startedAt;
  @date("completed_at") completedAt;
  @field("start_latitude") startLatitude;
  @field("start_longitude") startLongitude;
  @json("checklist_progress", sanitizeJSON) checklistProgress;
  @field("requires_sync") requiresSync;
  @field("locked") locked;
  @date("created_at") createdAt;
  @date("updated_at") updatedAt;

  @children("offline_photos") photos;
  @children("offline_checklist_items") checklistItems;
  @children("sync_queue") syncOperations;

  // Helper to check if job can be modified
  get isEditable() {
    return !this.locked && this.status !== "completed";
  }

  // Get job display info
  get displayInfo() {
    const data = this.jobData || {};
    return {
      address: data.home?.address || "Unknown",
      nickname: data.home?.nickname || "Home",
      scheduledTime: data.scheduledTime,
      homeowner: data.homeowner?.firstName || "Customer",
    };
  }
}
