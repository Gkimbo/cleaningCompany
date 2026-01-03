/* eslint-disable no-console */
import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class MessageService {
  /**
   * Get all conversations for the current user
   */
  static async getConversations(token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/messages/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching conversations:", error);
      return { error: error.message };
    }
  }

  /**
   * Get all messages in a specific conversation
   */
  static async getMessages(conversationId, token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/conversation/${conversationId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching messages:", error);
      return { error: error.message };
    }
  }

  /**
   * Send a message in a conversation
   */
  static async sendMessage(conversationId, content, token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/messages/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId, content }),
      });
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      return await response.json();
    } catch (error) {
      console.error("Error sending message:", error);
      return { error: error.message };
    }
  }

  /**
   * Create or get a conversation for a specific appointment
   */
  static async createAppointmentConversation(appointmentId, token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/conversation/appointment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ appointmentId }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to create conversation");
      }
      return await response.json();
    } catch (error) {
      console.error("Error creating conversation:", error);
      return { error: error.message };
    }
  }

  /**
   * Send a broadcast message (owner only)
   */
  static async sendBroadcast(content, targetAudience, title, token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/messages/broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, targetAudience, title }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send broadcast");
      }
      return await response.json();
    } catch (error) {
      console.error("Error sending broadcast:", error);
      return { error: error.message };
    }
  }

  /**
   * Get total unread message count
   */
  static async getUnreadCount(token) {
    if (!token) {
      return { unreadCount: 0 };
    }
    try {
      const response = await fetch(`${baseURL}/api/v1/messages/unread-count`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch unread count");
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching unread count:", error);
      return { unreadCount: 0 };
    }
  }

  /**
   * Mark a conversation as read
   */
  static async markAsRead(conversationId, token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/mark-read/${conversationId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to mark as read");
      }
      return await response.json();
    } catch (error) {
      console.error("Error marking as read:", error);
      return { error: error.message };
    }
  }

  /**
   * Create or get a support conversation with the owner
   */
  static async createSupportConversation(token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/conversation/support`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create support conversation");
      }
      return await response.json();
    } catch (error) {
      console.error("Error creating support conversation:", error);
      return { error: error.message };
    }
  }

  /**
   * Add a participant to a conversation
   */
  static async addParticipant(conversationId, userIdToAdd, token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/messages/add-participant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId, userIdToAdd }),
      });
      if (!response.ok) {
        throw new Error("Failed to add participant");
      }
      return await response.json();
    } catch (error) {
      console.error("Error adding participant:", error);
      return { error: error.message };
    }
  }

  /**
   * Get list of staff members that current user can message (owner/HR only)
   */
  static async getStaffList(search, token) {
    try {
      const url = search
        ? `${baseURL}/api/v1/messages/staff?search=${encodeURIComponent(search)}`
        : `${baseURL}/api/v1/messages/staff`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch staff list");
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching staff list:", error);
      return { error: error.message, staff: [] };
    }
  }

  /**
   * Create or get a 1-on-1 conversation with another owner/HR member
   */
  static async createDirectConversation(targetUserId, token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/conversation/hr-direct`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ targetUserId }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create conversation");
      }
      return await response.json();
    } catch (error) {
      console.error("Error creating direct conversation:", error);
      return { error: error.message };
    }
  }

  /**
   * Create a custom group conversation with selected members
   */
  static async createGroupConversation(memberIds, title, token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/conversation/custom-group`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ memberIds, title }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create group");
      }
      return await response.json();
    } catch (error) {
      console.error("Error creating group conversation:", error);
      return { error: error.message };
    }
  }

  /**
   * Create or get the HR Team group conversation (owner only)
   */
  static async createHRGroupConversation(token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/conversation/hr-group`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create HR group");
      }
      return await response.json();
    } catch (error) {
      console.error("Error creating HR group conversation:", error);
      return { error: error.message };
    }
  }

  /**
   * Get all internal (owner-HR) conversations
   */
  static async getInternalConversations(token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/conversations/internal`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch internal conversations");
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching internal conversations:", error);
      return { error: error.message, conversations: [] };
    }
  }

  /**
   * Add or toggle a reaction on a message
   */
  static async addReaction(messageId, emoji, token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/${messageId}/react`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ emoji }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to add reaction");
      }
      return await response.json();
    } catch (error) {
      console.error("Error adding reaction:", error);
      return { error: error.message };
    }
  }

  /**
   * Remove a reaction from a message
   */
  static async removeReaction(messageId, emoji, token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/${messageId}/react/${encodeURIComponent(emoji)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to remove reaction");
      }
      return await response.json();
    } catch (error) {
      console.error("Error removing reaction:", error);
      return { error: error.message };
    }
  }

  /**
   * Delete a message (soft delete)
   */
  static async deleteMessage(messageId, token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/${messageId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete message");
      }
      return await response.json();
    } catch (error) {
      console.error("Error deleting message:", error);
      return { error: error.message };
    }
  }

  /**
   * Mark specific messages as read (creates read receipts)
   */
  static async markMessagesRead(messageIds, token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/mark-messages-read`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ messageIds }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to mark messages as read");
      }
      return await response.json();
    } catch (error) {
      console.error("Error marking messages as read:", error);
      return { error: error.message };
    }
  }

  /**
   * Update conversation title (owner/HR only, internal conversations only)
   */
  static async updateConversationTitle(conversationId, title, token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/conversation/${conversationId}/title`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update title");
      }
      return await response.json();
    } catch (error) {
      console.error("Error updating conversation title:", error);
      return { error: error.message };
    }
  }

  /**
   * Delete an entire conversation (owner only)
   */
  static async deleteConversation(conversationId, token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/conversation/${conversationId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete conversation");
      }
      return await response.json();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      return { error: error.message };
    }
  }

  /**
   * Report a message as suspicious activity
   * @param {number} messageId - The ID of the message to report
   * @param {string} token - Auth token
   * @returns {Promise<Object>} - Result with success/error status
   */
  static async reportSuspiciousActivity(messageId, token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/messages/${messageId}/report-suspicious`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      if (!response.ok) {
        // Handle "already reported" case specially
        if (response.status === 409) {
          return { alreadyReported: true, message: data.error };
        }
        throw new Error(data.error || "Failed to report suspicious activity");
      }
      return data;
    } catch (error) {
      console.error("Error reporting suspicious activity:", error);
      return { error: error.message };
    }
  }

  /**
   * Create or get a direct conversation between cleaner and their client
   * @param {number} clientUserId - Required when cleaner is calling (the client to message)
   * @param {number} cleanerUserId - Optional when client is calling (defaults to their preferred cleaner)
   * @param {string} token - Auth token
   */
  static async createCleanerClientConversation(clientUserId, cleanerUserId, token) {
    try {
      const body = {};
      if (clientUserId) body.clientUserId = clientUserId;
      if (cleanerUserId) body.cleanerUserId = cleanerUserId;

      const response = await fetch(
        `${baseURL}/api/v1/messages/conversation/cleaner-client`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create conversation");
      }
      return await response.json();
    } catch (error) {
      console.error("Error creating cleaner-client conversation:", error);
      return { error: error.message };
    }
  }
}

export default MessageService;
