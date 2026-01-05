/**
 * OfflineMessagingService Tests
 *
 * Tests for the offline messaging service.
 */

import { MESSAGE_TYPES, MESSAGE_STATUS } from "../../../src/services/offline/database/models/OfflineMessage";
import { SYNC_OPERATION_TYPES } from "../../../src/services/offline/database/models/SyncQueue";

// Mock dependencies
jest.mock("../../../src/services/offline/database", () => ({
  __esModule: true,
  default: {
    write: jest.fn((fn) => fn()),
  },
  offlineMessagesCollection: {
    query: jest.fn(() => ({
      fetch: jest.fn().mockResolvedValue([]),
    })),
    create: jest.fn(),
    find: jest.fn(),
  },
  syncQueueCollection: {
    create: jest.fn(),
  },
}));

jest.mock("../../../src/services/offline/NetworkMonitor", () => ({
  __esModule: true,
  default: {
    isOnline: true,
  },
}));

// Mock fetch
global.fetch = jest.fn();

let OfflineMessagingService;
let database;
let offlineMessagesCollection;
let syncQueueCollection;
let NetworkMonitor;

describe("OfflineMessagingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    database = require("../../../src/services/offline/database").default;
    offlineMessagesCollection = require("../../../src/services/offline/database").offlineMessagesCollection;
    syncQueueCollection = require("../../../src/services/offline/database").syncQueueCollection;
    NetworkMonitor = require("../../../src/services/offline/NetworkMonitor").default;
    OfflineMessagingService = require("../../../src/services/offline/OfflineMessagingService").default;

    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: "server-msg-1" }),
    });
  });

  describe("setAuthToken", () => {
    it("should set the auth token", () => {
      OfflineMessagingService.setAuthToken("test-token");
      // Token is private, so we test indirectly through syncMessage
    });
  });

  describe("addJobNote", () => {
    it("should create a job note and add to sync queue", async () => {
      const mockMessage = {
        id: "msg-1",
        jobId: "job-1",
        messageType: MESSAGE_TYPES.JOB_NOTE,
      };

      offlineMessagesCollection.create.mockResolvedValue(mockMessage);

      const result = await OfflineMessagingService.addJobNote(
        "job-1",
        "appointment-1",
        "This is a test note"
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe(mockMessage);
      expect(offlineMessagesCollection.create).toHaveBeenCalled();
      expect(syncQueueCollection.create).toHaveBeenCalled();
    });

    it("should indicate if operation was performed offline", async () => {
      NetworkMonitor.isOnline = false;

      const mockMessage = { id: "msg-1" };
      offlineMessagesCollection.create.mockResolvedValue(mockMessage);

      const result = await OfflineMessagingService.addJobNote(
        "job-1",
        "appointment-1",
        "Offline note"
      );

      expect(result.isOfflineOperation).toBe(true);

      NetworkMonitor.isOnline = true;
    });
  });

  describe("getJobNotes", () => {
    it("should return notes filtered by job ID and sorted by date", async () => {
      const messages = [
        {
          jobId: "job-1",
          messageType: MESSAGE_TYPES.JOB_NOTE,
          createdAt: new Date(Date.now() - 60000),
        },
        {
          jobId: "job-2",
          messageType: MESSAGE_TYPES.JOB_NOTE,
          createdAt: new Date(),
        },
        {
          jobId: "job-1",
          messageType: MESSAGE_TYPES.JOB_NOTE,
          createdAt: new Date(),
        },
        {
          jobId: "job-1",
          messageType: MESSAGE_TYPES.DRAFT_MESSAGE,
          createdAt: new Date(),
        },
      ];

      offlineMessagesCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(messages),
      });

      const notes = await OfflineMessagingService.getJobNotes("job-1");

      expect(notes).toHaveLength(2);
      expect(notes.every((n) => n.jobId === "job-1")).toBe(true);
      expect(notes.every((n) => n.messageType === MESSAGE_TYPES.JOB_NOTE)).toBe(true);
      // Should be sorted newest first
      expect(notes[0].createdAt.getTime()).toBeGreaterThanOrEqual(notes[1].createdAt.getTime());
    });
  });

  describe("updateJobNote", () => {
    it("should update note content if not synced", async () => {
      const message = {
        id: "msg-1",
        status: MESSAGE_STATUS.PENDING_SYNC,
        update: jest.fn(),
      };

      offlineMessagesCollection.find.mockResolvedValue(message);

      const result = await OfflineMessagingService.updateJobNote("msg-1", "Updated content");

      expect(result.success).toBe(true);
      expect(message.update).toHaveBeenCalled();
    });

    it("should not allow editing synced notes", async () => {
      const message = {
        id: "msg-1",
        status: MESSAGE_STATUS.SYNCED,
      };

      offlineMessagesCollection.find.mockResolvedValue(message);

      const result = await OfflineMessagingService.updateJobNote("msg-1", "Updated content");

      expect(result.success).toBe(false);
      expect(result.error).toContain("synced");
    });

    it("should handle errors", async () => {
      offlineMessagesCollection.find.mockRejectedValue(new Error("Not found"));

      const result = await OfflineMessagingService.updateJobNote("non-existent", "Content");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not found");
    });
  });

  describe("deleteJobNote", () => {
    it("should delete note if not synced", async () => {
      const message = {
        id: "msg-1",
        status: MESSAGE_STATUS.PENDING_SYNC,
        markAsDeleted: jest.fn(),
      };

      offlineMessagesCollection.find.mockResolvedValue(message);

      const result = await OfflineMessagingService.deleteJobNote("msg-1");

      expect(result.success).toBe(true);
      expect(message.markAsDeleted).toHaveBeenCalled();
    });

    it("should not allow deleting synced notes", async () => {
      const message = {
        id: "msg-1",
        status: MESSAGE_STATUS.SYNCED,
      };

      offlineMessagesCollection.find.mockResolvedValue(message);

      const result = await OfflineMessagingService.deleteJobNote("msg-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("synced");
    });
  });

  describe("saveDraftMessage", () => {
    it("should create a draft message without syncing", async () => {
      const mockMessage = {
        id: "draft-1",
        status: MESSAGE_STATUS.DRAFT,
      };

      offlineMessagesCollection.create.mockResolvedValue(mockMessage);

      const result = await OfflineMessagingService.saveDraftMessage(
        "job-1",
        "appointment-1",
        "recipient-1",
        "Draft content"
      );

      expect(result.success).toBe(true);
      expect(offlineMessagesCollection.create).toHaveBeenCalled();
      // Draft should NOT be added to sync queue
      expect(syncQueueCollection.create).not.toHaveBeenCalled();
    });
  });

  describe("updateDraftMessage", () => {
    it("should update draft content", async () => {
      const message = {
        id: "draft-1",
        status: MESSAGE_STATUS.DRAFT,
        update: jest.fn(),
      };

      offlineMessagesCollection.find.mockResolvedValue(message);

      const result = await OfflineMessagingService.updateDraftMessage("draft-1", "New content");

      expect(result.success).toBe(true);
      expect(message.update).toHaveBeenCalled();
    });

    it("should not allow editing non-draft messages", async () => {
      const message = {
        id: "msg-1",
        status: MESSAGE_STATUS.PENDING_SYNC,
      };

      offlineMessagesCollection.find.mockResolvedValue(message);

      const result = await OfflineMessagingService.updateDraftMessage("msg-1", "Content");

      expect(result.success).toBe(false);
      expect(result.error).toContain("draft");
    });
  });

  describe("sendDraftMessage", () => {
    it("should update draft to pending and add to sync queue", async () => {
      const message = {
        id: "draft-1",
        jobId: "job-1",
        status: MESSAGE_STATUS.DRAFT,
        recipientId: "recipient-1",
        appointmentId: "appointment-1",
        content: "Hello",
        update: jest.fn(),
      };

      offlineMessagesCollection.find.mockResolvedValue(message);

      const result = await OfflineMessagingService.sendDraftMessage("draft-1");

      expect(result.success).toBe(true);
      expect(message.update).toHaveBeenCalled();
      expect(syncQueueCollection.create).toHaveBeenCalled();
    });

    it("should not send non-draft messages", async () => {
      const message = {
        id: "msg-1",
        status: MESSAGE_STATUS.PENDING_SYNC,
      };

      offlineMessagesCollection.find.mockResolvedValue(message);

      const result = await OfflineMessagingService.sendDraftMessage("msg-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not a draft");
    });
  });

  describe("getDraftMessages", () => {
    it("should return only draft messages", async () => {
      const messages = [
        { id: "1", status: MESSAGE_STATUS.DRAFT, createdAt: new Date() },
        { id: "2", status: MESSAGE_STATUS.PENDING_SYNC, createdAt: new Date() },
        { id: "3", status: MESSAGE_STATUS.DRAFT, createdAt: new Date() },
      ];

      offlineMessagesCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(messages),
      });

      const drafts = await OfflineMessagingService.getDraftMessages();

      expect(drafts).toHaveLength(2);
      expect(drafts.every((d) => d.status === MESSAGE_STATUS.DRAFT)).toBe(true);
    });
  });

  describe("deleteDraftMessage", () => {
    it("should delete draft messages", async () => {
      const message = {
        id: "draft-1",
        status: MESSAGE_STATUS.DRAFT,
        markAsDeleted: jest.fn(),
      };

      offlineMessagesCollection.find.mockResolvedValue(message);

      const result = await OfflineMessagingService.deleteDraftMessage("draft-1");

      expect(result.success).toBe(true);
      expect(message.markAsDeleted).toHaveBeenCalled();
    });

    it("should not delete non-draft messages", async () => {
      const message = {
        id: "msg-1",
        status: MESSAGE_STATUS.PENDING_SYNC,
      };

      offlineMessagesCollection.find.mockResolvedValue(message);

      const result = await OfflineMessagingService.deleteDraftMessage("msg-1");

      expect(result.success).toBe(false);
    });
  });

  describe("sendCoworkerMessage", () => {
    it("should create coworker message and add to sync queue", async () => {
      const mockMessage = {
        id: "coworker-msg-1",
        messageType: MESSAGE_TYPES.COWORKER_MESSAGE,
      };

      offlineMessagesCollection.create.mockResolvedValue(mockMessage);

      const result = await OfflineMessagingService.sendCoworkerMessage(
        "job-1",
        "appointment-1",
        "coworker-1",
        "Hey, can you help with the kitchen?"
      );

      expect(result.success).toBe(true);
      expect(offlineMessagesCollection.create).toHaveBeenCalled();
      expect(syncQueueCollection.create).toHaveBeenCalled();
    });
  });

  describe("syncMessage", () => {
    beforeEach(() => {
      OfflineMessagingService.setAuthToken("test-token");
    });

    it("should sync job note to server", async () => {
      const message = {
        markSynced: jest.fn(),
      };

      offlineMessagesCollection.find.mockResolvedValue(message);

      const result = await OfflineMessagingService.syncMessage({
        messageId: "msg-1",
        messageType: MESSAGE_TYPES.JOB_NOTE,
        appointmentId: "appointment-1",
        content: "Test note",
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/job-notes"),
        expect.objectContaining({ method: "POST" })
      );
      expect(message.markSynced).toHaveBeenCalled();
    });

    it("should sync coworker message to server", async () => {
      const message = {
        markSynced: jest.fn(),
      };

      offlineMessagesCollection.find.mockResolvedValue(message);

      const result = await OfflineMessagingService.syncMessage({
        messageId: "msg-1",
        messageType: MESSAGE_TYPES.COWORKER_MESSAGE,
        recipientId: "recipient-1",
        appointmentId: "appointment-1",
        content: "Hello",
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/messages"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should handle unknown message type", async () => {
      const result = await OfflineMessagingService.syncMessage({
        messageId: "msg-1",
        messageType: "unknown_type",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown message type");
    });

    it("should handle server errors", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: "Server error" }),
      });

      const result = await OfflineMessagingService.syncMessage({
        messageId: "msg-1",
        messageType: MESSAGE_TYPES.JOB_NOTE,
        content: "Note",
      });

      expect(result.success).toBe(false);
    });

    it("should handle network errors", async () => {
      global.fetch.mockRejectedValue(new Error("Network error"));

      const result = await OfflineMessagingService.syncMessage({
        messageId: "msg-1",
        messageType: MESSAGE_TYPES.JOB_NOTE,
        content: "Note",
      });

      expect(result.success).toBe(false);
      expect(result.canContinue).toBe(true);
    });
  });

  describe("getPendingCount", () => {
    it("should return count of pending sync messages", async () => {
      const messages = [
        { status: MESSAGE_STATUS.PENDING_SYNC },
        { status: MESSAGE_STATUS.SYNCED },
        { status: MESSAGE_STATUS.PENDING_SYNC },
        { status: MESSAGE_STATUS.DRAFT },
      ];

      offlineMessagesCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(messages),
      });

      const count = await OfflineMessagingService.getPendingCount();

      expect(count).toBe(2);
    });
  });

  describe("getMessagesForJob", () => {
    it("should return all messages for a job sorted by date", async () => {
      const messages = [
        { jobId: "job-1", createdAt: new Date(Date.now() - 60000) },
        { jobId: "job-2", createdAt: new Date() },
        { jobId: "job-1", createdAt: new Date() },
      ];

      offlineMessagesCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(messages),
      });

      const jobMessages = await OfflineMessagingService.getMessagesForJob("job-1");

      expect(jobMessages).toHaveLength(2);
      // Should be sorted oldest first
      expect(jobMessages[0].createdAt.getTime()).toBeLessThanOrEqual(
        jobMessages[1].createdAt.getTime()
      );
    });
  });

  describe("cleanupSyncedMessages", () => {
    it("should delete synced messages older than 24 hours", async () => {
      const oldSyncedMessage = {
        status: MESSAGE_STATUS.SYNCED,
        syncedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
        markAsDeleted: jest.fn(),
      };

      const recentSyncedMessage = {
        status: MESSAGE_STATUS.SYNCED,
        syncedAt: new Date(), // Now
        markAsDeleted: jest.fn(),
      };

      const pendingMessage = {
        status: MESSAGE_STATUS.PENDING_SYNC,
        markAsDeleted: jest.fn(),
      };

      offlineMessagesCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([
          oldSyncedMessage,
          recentSyncedMessage,
          pendingMessage,
        ]),
      });

      const cleaned = await OfflineMessagingService.cleanupSyncedMessages();

      expect(cleaned).toBe(1);
      expect(oldSyncedMessage.markAsDeleted).toHaveBeenCalled();
      expect(recentSyncedMessage.markAsDeleted).not.toHaveBeenCalled();
      expect(pendingMessage.markAsDeleted).not.toHaveBeenCalled();
    });
  });
});
