/**
 * Tests for MessageClass service methods
 * Covers: updateConversationTitle, deleteConversation, deleteMessage, addReaction
 */

// Mock HttpClient
jest.mock("../../src/services/HttpClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import HttpClient from "../../src/services/HttpClient";
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

      HttpClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await MessageService.updateConversationTitle(1, "New Title", mockToken);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/messages/conversation/1/title",
        { title: "New Title" },
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.conversation.title).toBe("New Title");
    });

    it("should return error when update fails", async () => {
      HttpClient.patch.mockResolvedValueOnce({
        success: false,
        error: "Only owner or HR can edit titles",
      });

      const result = await MessageService.updateConversationTitle(1, "New Title", mockToken);

      expect(result.error).toBe("Only owner or HR can edit titles");
    });

    it("should return error for non-internal conversations", async () => {
      HttpClient.patch.mockResolvedValueOnce({
        success: false,
        error: "Can only edit titles of internal conversations",
      });

      const result = await MessageService.updateConversationTitle(1, "New Title", mockToken);

      expect(result.error).toBe("Can only edit titles of internal conversations");
    });

    it("should handle network errors gracefully", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Network error" });

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

      HttpClient.delete.mockResolvedValueOnce(mockResponse);

      const result = await MessageService.deleteConversation(1, mockToken);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/messages/conversation/1",
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should return error when user is not owner", async () => {
      HttpClient.delete.mockResolvedValueOnce({
        success: false,
        error: "Only the owner can delete conversations",
      });

      const result = await MessageService.deleteConversation(1, mockToken);

      expect(result.error).toBe("Only the owner can delete conversations");
    });

    it("should return error for non-existent conversation", async () => {
      HttpClient.delete.mockResolvedValueOnce({
        success: false,
        error: "Conversation not found",
      });

      const result = await MessageService.deleteConversation(999, mockToken);

      expect(result.error).toBe("Conversation not found");
    });

    it("should handle network errors gracefully", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false, error: "Connection refused" });

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

      HttpClient.delete.mockResolvedValueOnce(mockResponse);

      const result = await MessageService.deleteMessage(1, mockToken);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/messages/1",
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.deletedAt).toBeDefined();
    });

    it("should return error when user is not message sender", async () => {
      HttpClient.delete.mockResolvedValueOnce({
        success: false,
        error: "You can only delete your own messages",
      });

      const result = await MessageService.deleteMessage(1, mockToken);

      expect(result.error).toBe("You can only delete your own messages");
    });

    it("should return error for non-existent message", async () => {
      HttpClient.delete.mockResolvedValueOnce({
        success: false,
        error: "Message not found",
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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await MessageService.addReaction(1, "👍", mockToken);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/messages/1/react",
        { emoji: "👍" },
        { token: mockToken }
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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await MessageService.addReaction(1, "👍", mockToken);

      expect(result.action).toBe("removed");
      expect(result.reactions).toEqual([]);
    });

    it("should handle reaction errors", async () => {
      HttpClient.post.mockResolvedValueOnce({
        success: false,
        error: "Message not found",
      });

      const result = await MessageService.addReaction(999, "👍", mockToken);

      expect(result.error).toBe("Message not found");
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

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await MessageService.getMessages(1, mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/messages/conversation/1",
        { token: mockToken }
      );
      expect(result.messages).toHaveLength(2);
      expect(result.conversation.title).toBe("Test Chat");
    });

    it("should return error when not a participant", async () => {
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        error: "Not authorized to view this conversation",
      });

      const result = await MessageService.getMessages(1, mockToken);

      expect(result.error).toBe("Not authorized to view this conversation");
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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await MessageService.sendMessage(1, "Hello World", mockToken);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/messages/send",
        { conversationId: 1, content: "Hello World" },
        { token: mockToken }
      );
      expect(result.message.content).toBe("Hello World");
    });

    it("should return error for empty content", async () => {
      HttpClient.post.mockResolvedValueOnce({
        success: false,
        error: "Message content is required",
      });

      const result = await MessageService.sendMessage(1, "   ", mockToken);

      expect(result.error).toBe("Message content is required");
    });

    it("should return error when not a participant", async () => {
      HttpClient.post.mockResolvedValueOnce({
        success: false,
        error: "Not authorized to send messages in this conversation",
      });

      const result = await MessageService.sendMessage(999, "Hello", mockToken);

      expect(result.error).toBe("Not authorized to send messages in this conversation");
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

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await MessageService.getConversations(mockToken);

      expect(result.conversations).toHaveLength(2);
      expect(result.conversations[0].unreadCount).toBe(2);
    });
  });

  describe("markAsRead", () => {
    it("should mark conversation as read", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: true });

      const result = await MessageService.markAsRead(1, mockToken);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/messages/mark-read/1",
        {},
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getUnreadCount", () => {
    it("should return total unread count", async () => {
      HttpClient.get.mockResolvedValueOnce({ unreadCount: 5 });

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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await MessageService.createDirectConversation(2, mockToken);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/messages/conversation/hr-direct",
        { targetUserId: 2 },
        { token: mockToken }
      );
      expect(result.conversation.title).toBe("John Doe");
      expect(result.conversation.title).not.toContain("Direct -");
    });

    it("should return error for non-HR/non-owner users", async () => {
      HttpClient.post.mockResolvedValueOnce({
        success: false,
        error: "Only owner or HR can use this endpoint",
      });

      const result = await MessageService.createDirectConversation(2, mockToken);

      expect(result.error).toBe("Only owner or HR can use this endpoint");
    });
  });

  describe("createCleanerClientConversation", () => {
    describe("When cleaner initiates", () => {
      it("should create conversation with clientUserId", async () => {
        const mockResponse = {
          conversation: {
            id: 1,
            conversationType: "cleaner-client",
            title: "John Cleaner & Jane Client",
            participants: [
              { userId: 100, user: { id: 100, firstName: "John" } },
              { userId: 200, user: { id: 200, firstName: "Jane" } },
            ],
          },
        };

        HttpClient.post.mockResolvedValueOnce(mockResponse);

        const result = await MessageService.createCleanerClientConversation(200, null, mockToken);

        expect(HttpClient.post).toHaveBeenCalledWith(
          "/messages/conversation/cleaner-client",
          { clientUserId: 200 },
          { token: mockToken }
        );
        expect(result.conversation.conversationType).toBe("cleaner-client");
      });

      it("should return error when no active relationship with client", async () => {
        HttpClient.post.mockResolvedValueOnce({
          success: false,
          error: "No active relationship with this client",
        });

        const result = await MessageService.createCleanerClientConversation(999, null, mockToken);

        expect(result.error).toBe("No active relationship with this client");
      });

      it("should return existing conversation if one exists", async () => {
        const mockResponse = {
          conversation: {
            id: 5, // Existing conversation ID
            conversationType: "cleaner-client",
            title: "John Cleaner & Jane Client",
            participants: [],
          },
        };

        HttpClient.post.mockResolvedValueOnce(mockResponse);

        const result = await MessageService.createCleanerClientConversation(200, null, mockToken);

        expect(result.conversation.id).toBe(5);
      });
    });

    describe("When client (homeowner) initiates", () => {
      it("should create conversation with cleanerUserId", async () => {
        const mockResponse = {
          conversation: {
            id: 1,
            conversationType: "cleaner-client",
            title: "John Cleaner & Jane Client",
            participants: [],
          },
        };

        HttpClient.post.mockResolvedValueOnce(mockResponse);

        const result = await MessageService.createCleanerClientConversation(null, 100, mockToken);

        expect(HttpClient.post).toHaveBeenCalledWith(
          "/messages/conversation/cleaner-client",
          { cleanerUserId: 100 },
          { token: mockToken }
        );
      });

      it("should auto-find preferred cleaner when no cleanerUserId specified", async () => {
        const mockResponse = {
          conversation: {
            id: 1,
            conversationType: "cleaner-client",
            participants: [],
          },
        };

        HttpClient.post.mockResolvedValueOnce(mockResponse);

        const result = await MessageService.createCleanerClientConversation(null, null, mockToken);

        expect(HttpClient.post).toHaveBeenCalledWith(
          "/messages/conversation/cleaner-client",
          {},
          { token: mockToken }
        );
      });

      it("should return error if no preferred cleaner found", async () => {
        HttpClient.post.mockResolvedValueOnce({
          success: false,
          error: "No preferred cleaner found. Please specify cleanerUserId.",
        });

        const result = await MessageService.createCleanerClientConversation(null, null, mockToken);

        expect(result.error).toBe("No preferred cleaner found. Please specify cleanerUserId.");
      });

      it("should return error if no relationship with specified cleaner", async () => {
        HttpClient.post.mockResolvedValueOnce({
          success: false,
          error: "No active relationship with this cleaner",
        });

        const result = await MessageService.createCleanerClientConversation(null, 999, mockToken);

        expect(result.error).toBe("No active relationship with this cleaner");
      });
    });

    describe("Error handling", () => {
      it("should handle network errors gracefully", async () => {
        HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network error" });

        const result = await MessageService.createCleanerClientConversation(200, null, mockToken);

        expect(result.error).toBe("Network error");
      });

      it("should handle server errors", async () => {
        HttpClient.post.mockResolvedValueOnce({
          success: false,
          error: "Internal server error",
        });

        const result = await MessageService.createCleanerClientConversation(200, null, mockToken);

        expect(result.error).toBe("Internal server error");
      });

      it("should handle invalid response format", async () => {
        HttpClient.post.mockResolvedValueOnce({
          success: false,
        });

        const result = await MessageService.createCleanerClientConversation(200, null, mockToken);

        expect(result.error).toBe("Failed to create conversation");
      });
    });
  });
});
