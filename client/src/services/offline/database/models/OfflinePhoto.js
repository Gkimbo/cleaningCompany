import { Model } from "@nozbe/watermelondb";
import { field, date, relation, json } from "@nozbe/watermelondb/decorators";

const sanitizeJSON = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default class OfflinePhoto extends Model {
  static table = "offline_photos";

  static associations = {
    offline_jobs: { type: "belongs_to", key: "job_id" },
  };

  @field("job_id") jobId;
  @field("photo_type") photoType; // 'before', 'after', or 'passes'
  @field("room") room;
  @field("local_uri") localUri;
  @json("watermark_data", sanitizeJSON) watermarkData;
  @field("uploaded") uploaded;
  @field("upload_attempts") uploadAttempts;
  @field("is_not_applicable") isNotApplicable; // For passes marked as N/A
  @date("created_at") createdAt;

  @relation("offline_jobs", "job_id") job;

  // Check if photo can be retried
  get canRetry() {
    return !this.uploaded && this.uploadAttempts < 5;
  }

  // Get watermark info
  get watermarkInfo() {
    return this.watermarkData || {};
  }
}
