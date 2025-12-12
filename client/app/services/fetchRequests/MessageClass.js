/* eslint-disable no-console */
const baseURL = "http://localhost:3000";

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
   * Send a broadcast message (manager only)
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
   * Create or get a support conversation with the manager
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
}

export default MessageService;
