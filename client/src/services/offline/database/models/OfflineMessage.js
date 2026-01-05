import { Model } from "@nozbe/watermelondb";
import { field, date, readonly } from "@nozbe/watermelondb/decorators";

// Message types
export const MESSAGE_TYPES = {
  JOB_NOTE: "job_note", // Internal note about a job
  DRAFT_MESSAGE: "draft_message", // Draft message to send when online
  COWORKER_MESSAGE: "coworker_message", // Message to coworker on same job
};

// Message status
export const MESSAGE_STATUS = {
  DRAFT: "draft", // Still being edited
  PENDING_SYNC: "pending_sync", // Ready to sync when online
  SYNCED: "synced", // Successfully synced to server
  FAILED: "failed", // Sync failed
};

/**
 * OfflineMessage - WatermelonDB model for offline messages and job notes
 *
 * Supports:
 * - Job notes (internal notes about a job)
 * - Draft messages (messages queued to send when online)
 * - Coworker messages (multi-cleaner job communication)
 */
export default class OfflineMessage extends Model {
  static table = "offline_messages";

  @field("server_id") serverId;
  @field("job_id") jobId;
  @field("appointment_id") appointmentId;
  @field("recipient_id") recipientId;
  @field("message_type") messageType;
  @field("content") content;
  @field("status") status;

  @readonly @date("created_at") createdAt;
  @date("synced_at") syncedAt;

  // Check if message is ready to sync
  get canSync() {
    return this.status === MESSAGE_STATUS.PENDING_SYNC;
  }

  // Check if message is a job note
  get isJobNote() {
    return this.messageType === MESSAGE_TYPES.JOB_NOTE;
  }

  // Check if message is a draft
  get isDraft() {
    return this.status === MESSAGE_STATUS.DRAFT;
  }

  // Check if already synced
  get isSynced() {
    return this.status === MESSAGE_STATUS.SYNCED;
  }

  // Mark as ready to sync
  async markReadyToSync() {
    await this.update((msg) => {
      msg.status = MESSAGE_STATUS.PENDING_SYNC;
    });
  }

  // Mark as synced
  async markSynced(serverId = null) {
    await this.update((msg) => {
      msg.status = MESSAGE_STATUS.SYNCED;
      msg.serverId = serverId;
      msg._raw.synced_at = Date.now();
    });
  }

  // Mark as failed
  async markFailed() {
    await this.update((msg) => {
      msg.status = MESSAGE_STATUS.FAILED;
    });
  }

  // Format for display
  get formattedDate() {
    if (!this.createdAt) return "";
    return new Date(this.createdAt).toLocaleString();
  }

  // Get preview of content (first 50 chars)
  get preview() {
    if (!this.content) return "";
    return this.content.length > 50 ? `${this.content.substring(0, 50)}...` : this.content;
  }
}
