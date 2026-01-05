import { Model } from "@nozbe/watermelondb";
import { field, date, relation } from "@nozbe/watermelondb/decorators";

export default class OfflineChecklistItem extends Model {
  static table = "offline_checklist_items";

  static associations = {
    offline_jobs: { type: "belongs_to", key: "job_id" },
  };

  @field("job_id") jobId;
  @field("item_id") itemId;
  @field("room") room;
  @field("description") description;
  @field("completed") completed;
  @date("completed_at") completedAt;
  @date("created_at") createdAt;

  @relation("offline_jobs", "job_id") job;

  // One-way check - once completed, cannot be unchecked
  async markComplete() {
    if (this.completed) return; // Already completed, no-op

    await this.update((item) => {
      item.completed = true;
      item.completedAt = new Date();
    });
  }
}
