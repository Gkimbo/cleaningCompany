/* eslint-disable no-console */
import HttpClient from "../HttpClient";

class MessageService {
  /**
   * Get all conversations for the current user
   */
  static async getConversations(token) {
    const result = await HttpClient.get("/messages/conversations", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[MessageService] getConversations failed:", result.error);
      return { error: result.error || "Failed to fetch conversations" };
    }

    return result;
  }

  /**
   * Get all messages in a specific conversation
   */
  static async getMessages(conversationId, token) {
    const result = await HttpClient.get(`/messages/conversation/${conversationId}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[MessageService] getMessages failed:", result.error);
      return { error: result.error || "Failed to fetch messages" };
    }

    return result;
  }

  /**
   * Send a message in a conversation
   */
  static async sendMessage(conversationId, content, token) {
    const result = await HttpClient.post("/messages/send", { conversationId, content }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to send message" };
    }

    return result;
  }

  /**
   * Create or get a conversation for a specific appointment
   */
  static async createAppointmentConversation(appointmentId, token) {
    const result = await HttpClient.post("/messages/conversation/appointment", { appointmentId }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to create conversation" };
    }

    return result;
  }

  /**
   * Send a broadcast message (owner only)
   */
  static async sendBroadcast(content, targetAudience, title, token) {
    const result = await HttpClient.post("/messages/broadcast", { content, targetAudience, title }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to send broadcast" };
    }

    return result;
  }

  /**
   * Get total unread message count
   */
  static async getUnreadCount(token) {
    if (!token) {
      return { unreadCount: 0 };
    }

    const result = await HttpClient.get("/messages/unread-count", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[MessageService] getUnreadCount failed:", result.error);
      return { unreadCount: 0 };
    }

    return result;
  }

  /**
   * Mark a conversation as read
   */
  static async markAsRead(conversationId, token) {
    const result = await HttpClient.patch(`/messages/mark-read/${conversationId}`, {}, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to mark as read" };
    }

    return result;
  }

  /**
   * Create or get a support conversation with the owner
   */
  static async createSupportConversation(token) {
    const result = await HttpClient.post("/messages/conversation/support", {}, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to connect to support" };
    }

    return result;
  }

  /**
   * Add a participant to a conversation
   */
  static async addParticipant(conversationId, userIdToAdd, token) {
    const result = await HttpClient.post("/messages/add-participant", { conversationId, userIdToAdd }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to add participant" };
    }

    return result;
  }

  /**
   * Get list of staff members that current user can message (owner/HR only)
   */
  static async getStaffList(search, token) {
    const url = search
      ? `/messages/staff?search=${encodeURIComponent(search)}`
      : "/messages/staff";
    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[MessageService] getStaffList failed:", result.error);
      return { error: result.error, staff: [] };
    }

    return result;
  }

  /**
   * Create or get a 1-on-1 conversation with another owner/HR member
   */
  static async createDirectConversation(targetUserId, token) {
    const result = await HttpClient.post("/messages/conversation/hr-direct", { targetUserId }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to create conversation" };
    }

    return result;
  }

  /**
   * Create or get a 1-on-1 conversation between owner and any user (owner only)
   */
  static async createOwnerDirectConversation(targetUserId, token) {
    const result = await HttpClient.post("/messages/conversation/owner-direct", { targetUserId }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to create conversation" };
    }

    return result;
  }

  /**
   * Create a custom group conversation with selected members
   */
  static async createGroupConversation(memberIds, title, token) {
    const result = await HttpClient.post("/messages/conversation/custom-group", { memberIds, title }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to create group" };
    }

    return result;
  }

  /**
   * Create or get the HR Team group conversation (owner only)
   */
  static async createHRGroupConversation(token) {
    const result = await HttpClient.post("/messages/conversation/hr-group", {}, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to create HR group" };
    }

    return result;
  }

  // =====================================
  // BUSINESS OWNER - EMPLOYEE MESSAGING
  // =====================================

  /**
   * Get list of employees for business owner messaging
   */
  static async getBusinessEmployees(token) {
    const result = await HttpClient.get("/messages/business-employees", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[MessageService] getBusinessEmployees failed:", result.error);
      return { error: result.error, employees: [] };
    }

    return result;
  }

  /**
   * Create or get a 1-on-1 conversation with an employee
   */
  static async createEmployeeConversation(employeeId, token) {
    const result = await HttpClient.post("/messages/employee-conversation", { employeeId }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to create conversation" };
    }

    return result;
  }

  /**
   * Create a group conversation with multiple employees
   */
  static async createEmployeeGroupConversation(employeeIds, title, token) {
    const result = await HttpClient.post("/messages/employee-group-conversation", { employeeIds, title }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to create group" };
    }

    return result;
  }

  /**
   * Get all internal (owner-HR) conversations
   */
  static async getInternalConversations(token) {
    const result = await HttpClient.get("/messages/conversations/internal", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[MessageService] getInternalConversations failed:", result.error);
      return { error: result.error, conversations: [] };
    }

    return result;
  }

  /**
   * Add or toggle a reaction on a message
   */
  static async addReaction(messageId, emoji, token) {
    const result = await HttpClient.post(`/messages/${messageId}/react`, { emoji }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to add reaction" };
    }

    return result;
  }

  /**
   * Remove a reaction from a message
   */
  static async removeReaction(messageId, emoji, token) {
    const result = await HttpClient.delete(`/messages/${messageId}/react/${encodeURIComponent(emoji)}`, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to remove reaction" };
    }

    return result;
  }

  /**
   * Delete a message (soft delete)
   */
  static async deleteMessage(messageId, token) {
    const result = await HttpClient.delete(`/messages/${messageId}`, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to delete message" };
    }

    return result;
  }

  /**
   * Mark specific messages as read (creates read receipts)
   */
  static async markMessagesRead(messageIds, token) {
    const result = await HttpClient.post("/messages/mark-messages-read", { messageIds }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to mark messages as read" };
    }

    return result;
  }

  /**
   * Update conversation title (owner/HR only, internal conversations only)
   */
  static async updateConversationTitle(conversationId, title, token) {
    const result = await HttpClient.patch(`/messages/conversation/${conversationId}/title`, { title }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to update title" };
    }

    return result;
  }

  /**
   * Delete an entire conversation (owner only)
   */
  static async deleteConversation(conversationId, token) {
    const result = await HttpClient.delete(`/messages/conversation/${conversationId}`, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to delete conversation" };
    }

    return result;
  }

  /**
   * Cleanup an empty support conversation (delete if no messages were sent)
   */
  static async cleanupEmptySupportConversation(conversationId, token) {
    const result = await HttpClient.delete(`/messages/conversation/support/${conversationId}/cleanup`, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to cleanup conversation" };
    }

    return result;
  }

  /**
   * Report a message as suspicious activity
   */
  static async reportSuspiciousActivity(messageId, token) {
    const result = await HttpClient.post(`/messages/${messageId}/report-suspicious`, {}, { token });

    if (result.status === 409) {
      return { alreadyReported: true, message: result.error };
    }

    if (result.success === false) {
      return { error: result.error || "Failed to report suspicious activity" };
    }

    return result;
  }

  /**
   * Create or get a direct conversation between cleaner and their client
   */
  static async createCleanerClientConversation(clientUserId, cleanerUserId, token) {
    const body = {};
    if (clientUserId) body.clientUserId = clientUserId;
    if (cleanerUserId) body.cleanerUserId = cleanerUserId;

    const result = await HttpClient.post("/messages/conversation/cleaner-client", body, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to create conversation" };
    }

    return result;
  }
}

export default MessageService;
