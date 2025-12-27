/**
 * Tests for MessageClass service methods
 * Covers: updateConversationTitle, deleteConversation, deleteMessage, addReaction
 */

// Mock fetch globally
global.fetch = jest.fn();

// Mock the config module
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

import MessageService from "../../src/services/fetchRequests/MessageClass";

describe("MessageClass", () => {
  const mockToken = "test-jwt-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("updateConversationTitle", () => {
    it("should update conversation title successfully", async () => {
      const mockResponse = {
        success: true,
        conversation: { id: 1, title: "New Title" },
        systemMessage: { id: 100, content: "John changed the name", messageType: "system" },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await MessageService.updateConversationTitle(1, "New Title", mockToken);

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/messages/conversation/1/title",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify({ title: "New Title" }),
        }
      );
      expect(result.success).toBe(true);
      expect(result.conversation.title).toBe("New Title");
    });

    it("should return error when update fails", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Only owner or HR can edit titles" }),
      });

      const result = await MessageService.updateConversationTitle(1, "New Title", mockToken);

      expect(result.error).toBe("Only owner or HR can edit titles");
    });

    it("should return error for non-internal conversations", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Can only edit titles of internal conversations" }),
      });

      const result = await MessageService.updateConversationTitle(1, "New Title", mockToken);

      expect(result.error).toBe("Can only edit titles of internal conversations");
    });

    it("should handle network errors gracefully", async () => {
      fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await MessageService.updateConversationTitle(1, "New Title", mockToken);

      expect(result.error).toBe("Network error");
    });
  });

  describe("deleteConversation", () => {
    it("should delete conversation successfully (owner only)", async () => {
      const mockResponse = {
        success: true,
        message: "Conversation deleted successfully",
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await MessageService.deleteConversation(1, mockToken);

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/messages/conversation/1",
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
      expect(result.success).toBe(true);
    });

    it("should return error when user is not owner", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Only the owner can delete conversations" }),
      });

      const result = await MessageService.deleteConversation(1, mockToken);

      expect(result.error).toBe("Only the owner can delete conversations");
    });

    it("should return error for non-existent conversation", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Conversation not found" }),
      });

      const result = await MessageService.deleteConversation(999, mockToken);

      expect(result.error).toBe("Conversation not found");
    });

    it("should handle network errors gracefully", async () => {
      fetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await MessageService.deleteConversation(1, mockToken);

      expect(result.error).toBe("Connection refused");
    });
  });

  describe("deleteMessage", () => {
    it("should delete (soft delete) a message successfully", async () => {
      const mockResponse = {
        success: true,
        messageId: 1,
        deletedAt: "2025-12-26T12:00:00Z",
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await MessageService.deleteMessage(1, mockToken);

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/messages/1",
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
      expect(result.success).toBe(true);
      expect(result.deletedAt).toBeDefined();
    });

    it("should return error when user is not message sender", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "You can only delete your own messages" }),
      });

      const result = await MessageService.deleteMessage(1, mockToken);

      expect(result.error).toBe("You can only delete your own messages");
    });

    it("should return error for non-existent message", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Message not found" }),
      });

      const result = await MessageService.deleteMessage(999, mockToken);

      expect(result.error).toBe("Message not found");
    });
  });

  describe("addReaction", () => {
    it("should add a reaction successfully", async () => {
      const mockResponse = {
        success: true,
        action: "added",
        reactions: [{ emoji: "👍", userId: 1, user: { firstName: "John" } }],
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await MessageService.addReaction(1, "👍", mockToken);

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/messages/1/react",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify({ emoji: "👍" }),
        }
      );
      expect(result.success).toBe(true);
      expect(result.action).toBe("added");
    });

    it("should toggle off an existing reaction", async () => {
      const mockResponse = {
        success: true,
        action: "removed",
        reactions: [],
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await MessageService.addReaction(1, "👍", mockToken);

      expect(result.action).toBe("removed");
      expect(result.reactions).toEqual([]);
    });

    it("should handle reaction errors", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Message not found" }),
      });

      const result = await MessageService.addReaction(999, "👍", mockToken);

      expect(result.error).toBe("Failed to add reaction");  // Generic error thrown
    });
  });

  describe("getMessages", () => {
    it("should fetch messages for a conversation", async () => {
      const mockResponse = {
        messages: [
          { id: 1, content: "Hello", sender: { id: 1, firstName: "John" } },
          { id: 2, content: "World", sender: { id: 2, firstName: "Jane" } },
        ],
        conversation: { id: 1, title: "Test Chat" },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await MessageService.getMessages(1, mockToken);

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/messages/conversation/1",
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
      expect(result.messages).toHaveLength(2);
      expect(result.conversation.title).toBe("Test Chat");
    });

    it("should return error when not a participant", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Not authorized to view this conversation" }),
      });

      const result = await MessageService.getMessages(1, mockToken);

      expect(result.error).toBe("Failed to fetch messages");  // Generic error thrown
    });
  });

  describe("sendMessage", () => {
    it("should send a message successfully", async () => {
      const mockResponse = {
        message: {
          id: 1,
          conversationId: 1,
          content: "Hello World",
          senderId: 1,
          sender: { id: 1, firstName: "John" },
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await MessageService.sendMessage(1, "Hello World", mockToken);

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/messages/send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify({ conversationId: 1, content: "Hello World" }),
        }
      );
      expect(result.message.content).toBe("Hello World");
    });

    it("should return error for empty content", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Message content is required" }),
      });

      const result = await MessageService.sendMessage(1, "   ", mockToken);

      expect(result.error).toBe("Failed to send message");  // Generic error thrown
    });

    it("should return error when not a participant", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Not authorized to send messages in this conversation" }),
      });

      const result = await MessageService.sendMessage(999, "Hello", mockToken);

      expect(result.error).toBe("Failed to send message");  // Generic error thrown
    });
  });

  describe("getConversations", () => {
    it("should fetch all user conversations", async () => {
      const mockResponse = {
        conversations: [
          { conversationId: 1, conversation: { title: "Chat 1" }, unreadCount: 2 },
          { conversationId: 2, conversation: { title: "Chat 2" }, unreadCount: 0 },
        ],
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await MessageService.getConversations(mockToken);

      expect(result.conversations).toHaveLength(2);
      expect(result.conversations[0].unreadCount).toBe(2);
    });
  });

  describe("markAsRead", () => {
    it("should mark conversation as read", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await MessageService.markAsRead(1, mockToken);

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/messages/mark-read/1",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getUnreadCount", () => {
    it("should return total unread count", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unreadCount: 5 }),
      });

      const result = await MessageService.getUnreadCount(mockToken);

      expect(result.unreadCount).toBe(5);
    });
  });

  describe("createDirectConversation", () => {
    it("should create direct conversation with proper title format", async () => {
      const mockResponse = {
        conversation: {
          id: 1,
          conversationType: "internal",
          title: "John Doe",  // Not "Direct - John Doe"
          participants: [],
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await MessageService.createDirectConversation(2, mockToken);

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/messages/conversation/hr-direct",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify({ targetUserId: 2 }),
        }
      );
      expect(result.conversation.title).toBe("John Doe");
      expect(result.conversation.title).not.toContain("Direct -");
    });

    it("should return error for non-HR/non-owner users", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Only owner or HR can use this endpoint" }),
      });

      const result = await MessageService.createDirectConversation(2, mockToken);

      expect(result.error).toBe("Only owner or HR can use this endpoint");
    });
  });
});
