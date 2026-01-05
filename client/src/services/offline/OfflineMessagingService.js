/**
 * OfflineMessagingService
 * Handles offline messaging and job notes functionality.
 *
 * Supports:
 * - Job notes (internal notes about a job)
 * - Draft messages (queued for sending when online)
 * - Coworker messages (multi-cleaner communication)
 */

import database, { offlineMessagesCollection, syncQueueCollection } from "./database";
import { MESSAGE_TYPES, MESSAGE_STATUS } from "./database/models/OfflineMessage";
import { SYNC_OPERATION_TYPES, OPERATION_SEQUENCE } from "./database/models/SyncQueue";
import NetworkMonitor from "./NetworkMonitor";
import { API_BASE } from "../config";

class OfflineMessagingService {
  constructor() {
    this._authToken = null;
  }

  setAuthToken(token) {
    this._authToken = token;
  }

  // =====================
  // JOB NOTES
  // =====================

  /**
   * Add a note to a job (works offline)
   */
  async addJobNote(jobId, appointmentId, content) {
    const message = await database.write(async () => {
      const msg = await offlineMessagesCollection.create((m) => {
        m.jobId = jobId;
        m.appointmentId = appointmentId || null;
        m.recipientId = null; // Notes have no recipient
        m.messageType = MESSAGE_TYPES.JOB_NOTE;
        m.content = content;
        m.status = MESSAGE_STATUS.PENDING_SYNC;
        m._raw.created_at = Date.now();
      });

      // Add to sync queue
      await syncQueueCollection.create((op) => {
        op.jobId = jobId;
        op.operationType = SYNC_OPERATION_TYPES.MESSAGE;
        op.sequenceNumber = OPERATION_SEQUENCE[SYNC_OPERATION_TYPES.MESSAGE];
        op._raw.payload = JSON.stringify({
          messageId: msg.id,
          messageType: MESSAGE_TYPES.JOB_NOTE,
          appointmentId,
          content,
        });
        op.status = "pending";
        op.attempts = 0;
        op._raw.created_at = Date.now();
        op._raw.updated_at = Date.now();
      });

      return msg;
    });

    return {
      success: true,
      message,
      isOfflineOperation: !NetworkMonitor.isOnline,
    };
  }

  /**
   * Get all notes for a job
   */
  async getJobNotes(jobId) {
    const messages = await offlineMessagesCollection.query().fetch();
    return messages
      .filter((m) => m.jobId === jobId && m.messageType === MESSAGE_TYPES.JOB_NOTE)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Update a draft note (before it's synced)
   */
  async updateJobNote(messageId, newContent) {
    try {
      const message = await offlineMessagesCollection.find(messageId);

      if (message.status === MESSAGE_STATUS.SYNCED) {
        return { success: false, error: "Cannot edit synced notes" };
      }

      await database.write(async () => {
        await message.update((m) => {
          m.content = newContent;
        });
      });

      return { success: true, message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a note (only if not yet synced)
   */
  async deleteJobNote(messageId) {
    try {
      const message = await offlineMessagesCollection.find(messageId);

      if (message.status === MESSAGE_STATUS.SYNCED) {
        return { success: false, error: "Cannot delete synced notes" };
      }

      await database.write(async () => {
        await message.markAsDeleted();
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // =====================
  // DRAFT MESSAGES
  // =====================

  /**
   * Save a draft message (to send when online)
   */
  async saveDraftMessage(jobId, appointmentId, recipientId, content) {
    const message = await database.write(async () => {
      return await offlineMessagesCollection.create((m) => {
        m.jobId = jobId;
        m.appointmentId = appointmentId || null;
        m.recipientId = recipientId;
        m.messageType = MESSAGE_TYPES.DRAFT_MESSAGE;
        m.content = content;
        m.status = MESSAGE_STATUS.DRAFT;
        m._raw.created_at = Date.now();
      });
    });

    return { success: true, message };
  }

  /**
   * Update a draft message
   */
  async updateDraftMessage(messageId, newContent) {
    try {
      const message = await offlineMessagesCollection.find(messageId);

      if (message.status !== MESSAGE_STATUS.DRAFT) {
        return { success: false, error: "Can only edit draft messages" };
      }

      await database.write(async () => {
        await message.update((m) => {
          m.content = newContent;
        });
      });

      return { success: true, message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a draft message (queue for sync)
   */
  async sendDraftMessage(messageId) {
    try {
      const message = await offlineMessagesCollection.find(messageId);

      if (message.status !== MESSAGE_STATUS.DRAFT) {
        return { success: false, error: "Message is not a draft" };
      }

      await database.write(async () => {
        await message.update((m) => {
          m.status = MESSAGE_STATUS.PENDING_SYNC;
        });

        // Add to sync queue
        await syncQueueCollection.create((op) => {
          op.jobId = message.jobId;
          op.operationType = SYNC_OPERATION_TYPES.MESSAGE;
          op.sequenceNumber = OPERATION_SEQUENCE[SYNC_OPERATION_TYPES.MESSAGE];
          op._raw.payload = JSON.stringify({
            messageId: message.id,
            messageType: MESSAGE_TYPES.DRAFT_MESSAGE,
            recipientId: message.recipientId,
            appointmentId: message.appointmentId,
            content: message.content,
          });
          op.status = "pending";
          op.attempts = 0;
          op._raw.created_at = Date.now();
          op._raw.updated_at = Date.now();
        });
      });

      return { success: true, message, isOfflineOperation: !NetworkMonitor.isOnline };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all draft messages
   */
  async getDraftMessages() {
    const messages = await offlineMessagesCollection.query().fetch();
    return messages
      .filter((m) => m.status === MESSAGE_STATUS.DRAFT)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Delete a draft message
   */
  async deleteDraftMessage(messageId) {
    try {
      const message = await offlineMessagesCollection.find(messageId);

      if (message.status !== MESSAGE_STATUS.DRAFT) {
        return { success: false, error: "Can only delete draft messages" };
      }

      await database.write(async () => {
        await message.markAsDeleted();
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // =====================
  // COWORKER MESSAGES
  // =====================

  /**
   * Send a message to a coworker on the same job
   */
  async sendCoworkerMessage(jobId, appointmentId, recipientId, content) {
    const message = await database.write(async () => {
      const msg = await offlineMessagesCollection.create((m) => {
        m.jobId = jobId;
        m.appointmentId = appointmentId || null;
        m.recipientId = recipientId;
        m.messageType = MESSAGE_TYPES.COWORKER_MESSAGE;
        m.content = content;
        m.status = MESSAGE_STATUS.PENDING_SYNC;
        m._raw.created_at = Date.now();
      });

      // Add to sync queue
      await syncQueueCollection.create((op) => {
        op.jobId = jobId;
        op.operationType = SYNC_OPERATION_TYPES.MESSAGE;
        op.sequenceNumber = OPERATION_SEQUENCE[SYNC_OPERATION_TYPES.MESSAGE];
        op._raw.payload = JSON.stringify({
          messageId: msg.id,
          messageType: MESSAGE_TYPES.COWORKER_MESSAGE,
          recipientId,
          appointmentId,
          content,
        });
        op.status = "pending";
        op.attempts = 0;
        op._raw.created_at = Date.now();
        op._raw.updated_at = Date.now();
      });

      return msg;
    });

    return {
      success: true,
      message,
      isOfflineOperation: !NetworkMonitor.isOnline,
    };
  }

  // =====================
  // SYNC HELPERS
  // =====================

  /**
   * Sync a message to the server (called by SyncEngine)
   */
  async syncMessage(payload) {
    const { messageId, messageType, recipientId, appointmentId, content } = payload;

    try {
      let endpoint;
      let body;

      switch (messageType) {
        case MESSAGE_TYPES.JOB_NOTE:
          endpoint = `${API_BASE}/job-notes`;
          body = { appointmentId, content };
          break;

        case MESSAGE_TYPES.DRAFT_MESSAGE:
        case MESSAGE_TYPES.COWORKER_MESSAGE:
          endpoint = `${API_BASE}/messages`;
          body = { recipientId, appointmentId, content };
          break;

        default:
          return { success: false, error: `Unknown message type: ${messageType}` };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this._authToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.error || "Failed to sync message" };
      }

      const data = await response.json();

      // Mark local message as synced
      if (messageId) {
        try {
          const message = await offlineMessagesCollection.find(messageId);
          await database.write(async () => {
            await message.markSynced(data.id || data.message?.id);
          });
        } catch {
          // Message may have been deleted
        }
      }

      return { success: true, canContinue: true };
    } catch (error) {
      return { success: false, error: error.message, canContinue: true };
    }
  }

  /**
   * Get pending messages count
   */
  async getPendingCount() {
    const messages = await offlineMessagesCollection.query().fetch();
    return messages.filter((m) => m.status === MESSAGE_STATUS.PENDING_SYNC).length;
  }

  /**
   * Get all messages for a job (for display)
   */
  async getMessagesForJob(jobId) {
    const messages = await offlineMessagesCollection.query().fetch();
    return messages.filter((m) => m.jobId === jobId).sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Clean up synced messages older than 24 hours
   */
  async cleanupSyncedMessages() {
    const messages = await offlineMessagesCollection.query().fetch();
    const threshold = Date.now() - 24 * 60 * 60 * 1000;
    let cleaned = 0;

    await database.write(async () => {
      for (const message of messages) {
        if (message.status === MESSAGE_STATUS.SYNCED && message.syncedAt?.getTime() < threshold) {
          await message.markAsDeleted();
          cleaned++;
        }
      }
    });

    return cleaned;
  }
}

// Export singleton
export default new OfflineMessagingService();
