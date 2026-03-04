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
import { SYNC_OPERATION_TYPES, OPERATION_SEQUENCE, SYNC_STATUS as OP_STATUS } from "./database/models/SyncQueue";
import NetworkMonitor from "./NetworkMonitor";
import { API_BASE } from "../config";
import { ONE_DAY_MS } from "./constants";

// Message retention constants
const SYNCED_MESSAGE_RETENTION_MS = ONE_DAY_MS; // 24 hours
const DEFAULT_FAILED_MESSAGE_RETENTION_DAYS = 7;
const MAX_MESSAGE_CONTENT_LENGTH = 5000;

class OfflineMessagingService {
  constructor() {
    this._authToken = null;
  }

  setAuthToken(token) {
    this._authToken = token;
  }

  /**
   * Validate message content
   * @returns {object} { valid: boolean, error?: string }
   */
  _validateContent(content, fieldName = "Content") {
    if (!content || typeof content !== "string") {
      return { valid: false, error: `${fieldName} must be a non-empty string` };
    }
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: `${fieldName} cannot be empty or whitespace only` };
    }
    if (trimmed.length > MAX_MESSAGE_CONTENT_LENGTH) {
      return { valid: false, error: `${fieldName} exceeds maximum length of ${MAX_MESSAGE_CONTENT_LENGTH} characters` };
    }
    return { valid: true };
  }

  /**
   * Safely parse operation payload
   * Handles both JSON strings and already-parsed objects
   * @returns {object|null} Parsed payload or null if invalid
   */
  _parsePayload(payload) {
    if (!payload) return null;

    // Already an object
    if (typeof payload === "object") {
      return payload;
    }

    // Try to parse JSON string
    if (typeof payload === "string") {
      try {
        return JSON.parse(payload);
      } catch (e) {
        console.warn("[OfflineMessagingService] Failed to parse payload JSON:", e.message);
        return null;
      }
    }

    return null;
  }

  // =====================
  // JOB NOTES
  // =====================

  /**
   * Add a note to a job (works offline)
   */
  async addJobNote(jobId, appointmentId, content) {
    // Validate content
    const validation = this._validateContent(content, "Note content");
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

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
        op.status = OP_STATUS.PENDING;
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
        // Also clean up any pending sync queue entries for this message
        const allSyncOps = await syncQueueCollection.query().fetch();
        const relatedOps = allSyncOps.filter((op) => {
          const payload = this._parsePayload(op.payload);
          return payload && payload.messageId === messageId;
        });

        for (const op of relatedOps) {
          await op.markAsDeleted();
        }

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
    // Validate content
    const validation = this._validateContent(content, "Draft content");
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

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
          op.status = OP_STATUS.PENDING;
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
        // Also clean up any pending sync queue entries for this message
        const allSyncOps = await syncQueueCollection.query().fetch();
        const relatedOps = allSyncOps.filter((op) => {
          const payload = this._parsePayload(op.payload);
          return payload && payload.messageId === messageId;
        });

        for (const op of relatedOps) {
          await op.markAsDeleted();
        }

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
    // Validate content
    const validation = this._validateContent(content, "Message content");
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

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
        op.status = OP_STATUS.PENDING;
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
   * Clean up synced messages older than retention period
   */
  async cleanupSyncedMessages() {
    const messages = await offlineMessagesCollection.query().fetch();
    const threshold = Date.now() - SYNCED_MESSAGE_RETENTION_MS;
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

  /**
   * Clean up permanently failed messages older than specified threshold
   * Failed messages are kept for default retention period to allow user review, then cleaned up
   */
  async cleanupFailedMessages(maxAgeDays = DEFAULT_FAILED_MESSAGE_RETENTION_DAYS) {
    const messages = await offlineMessagesCollection.query().fetch();
    const threshold = Date.now() - maxAgeDays * ONE_DAY_MS;
    let cleaned = 0;

    // Filter failed messages that exceed the age threshold
    const messagesToCleanup = messages.filter(
      (message) =>
        message.status === MESSAGE_STATUS.FAILED &&
        message.createdAt?.getTime() < threshold
    );

    if (messagesToCleanup.length === 0) {
      return 0;
    }

    // Fetch ALL sync ops ONCE (not inside loop) to avoid N+1 queries
    const allSyncOps = await syncQueueCollection.query().fetch();

    // Build a map of messageId -> sync operations for O(1) lookup
    const syncOpsByMessageId = new Map();
    for (const op of allSyncOps) {
      const payload = this._parsePayload(op.payload);
      if (payload?.messageId) {
        if (!syncOpsByMessageId.has(payload.messageId)) {
          syncOpsByMessageId.set(payload.messageId, []);
        }
        syncOpsByMessageId.get(payload.messageId).push(op);
      }
    }

    // Delete messages and their sync ops atomically
    await database.write(async () => {
      for (const message of messagesToCleanup) {
        try {
          // Delete related sync queue entries first
          const relatedOps = syncOpsByMessageId.get(message.id) || [];
          for (const op of relatedOps) {
            await op.markAsDeleted();
          }

          // Then delete the message
          await message.markAsDeleted();
          cleaned++;
        } catch (cleanupError) {
          // Log but continue with other messages
          console.error(`[OfflineMessagingService] Failed to cleanup message ${message.id}:`, cleanupError);
        }
      }
    });

    return cleaned;
  }

  /**
   * Get all failed messages (for user review before deletion)
   */
  async getFailedMessages() {
    const messages = await offlineMessagesCollection.query().fetch();
    return messages
      .filter((m) => m.status === MESSAGE_STATUS.FAILED)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Retry a failed message (requeue for sync)
   */
  async retryFailedMessage(messageId) {
    try {
      const message = await offlineMessagesCollection.find(messageId);

      if (message.status !== MESSAGE_STATUS.FAILED) {
        return { success: false, error: "Message is not in failed state" };
      }

      await database.write(async () => {
        // Reset message status to pending
        await message.update((m) => {
          m.status = MESSAGE_STATUS.PENDING_SYNC;
        });

        // Create new sync queue entry
        await syncQueueCollection.create((op) => {
          op.jobId = message.jobId;
          op.operationType = SYNC_OPERATION_TYPES.MESSAGE;
          op.sequenceNumber = OPERATION_SEQUENCE[SYNC_OPERATION_TYPES.MESSAGE];
          op._raw.payload = JSON.stringify({
            messageId: message.id,
            messageType: message.messageType,
            recipientId: message.recipientId,
            appointmentId: message.appointmentId,
            content: message.content,
          });
          op.status = OP_STATUS.PENDING;
          op.attempts = 0;
          op._raw.created_at = Date.now();
          op._raw.updated_at = Date.now();
        });
      });

      return { success: true, message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Comprehensive cleanup - runs all cleanup operations
   */
  async runCleanup() {
    const syncedCleaned = await this.cleanupSyncedMessages();
    const failedCleaned = await this.cleanupFailedMessages();
    return {
      syncedCleaned,
      failedCleaned,
      total: syncedCleaned + failedCleaned,
    };
  }
}

// Export singleton
export default new OfflineMessagingService();
