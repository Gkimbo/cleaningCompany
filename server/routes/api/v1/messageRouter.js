const express = require("express");
const { Op } = require("sequelize");
const authenticateToken = require("../../../middleware/authenticatedToken");
const {
  User,
  Message,
  Conversation,
  ConversationParticipant,
  UserAppointments,
  MessageReaction,
  MessageReadReceipt,
  CleanerClient,
  UserHomes,
  SuspiciousActivityReport,
} = require("../../../models");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");
const SuspiciousContentDetector = require("../../../services/SuspiciousContentDetector");
const EncryptionService = require("../../../services/EncryptionService");
const MessageSerializer = require("../../../serializers/MessageSerializer");

// Helper to validate numeric ID parameters
const isValidId = (id) => {
  const num = parseInt(id, 10);
  return !isNaN(num) && num > 0 && String(num) === String(id);
};

// Safe decrypt helper - returns null if decryption fails
const safeDecrypt = (value) => {
  if (!value) return null;
  try {
    return EncryptionService.decrypt(value);
  } catch (error) {
    console.error("[Messages] Decryption failed:", error.message);
    return null;
  }
};

// Helper to decrypt user PII fields from included models
// Only return safe, non-sensitive fields to the frontend
const decryptUserFields = (user) => {
  if (!user) return null;
  const data = user.dataValues || user;
  return {
    id: data.id,
    username: data.username,
    type: data.type,
    firstName: safeDecrypt(data.firstName),
    lastName: safeDecrypt(data.lastName),
    email: safeDecrypt(data.email),
    phone: safeDecrypt(data.phone),
    profilePhotoUrl: data.profilePhotoUrl,
    expoPushToken: data.expoPushToken,
    isBusinessOwner: data.isBusinessOwner,
    businessName: safeDecrypt(data.businessName),
  };
};

const messageRouter = express.Router();

/**
 * GET /api/v1/messages/conversations
 * Get all conversations for the current user with unread counts
 */
messageRouter.get("/conversations", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const participations = await ConversationParticipant.findAll({
      where: { userId },
      include: [
        {
          model: Conversation,
          as: "conversation",
          include: [
            {
              model: Message,
              as: "messages",
              limit: 1,
              order: [["createdAt", "DESC"]],
              include: [
                {
                  model: User,
                  as: "sender",
                  attributes: ["id", "username", "firstName", "lastName"],
                },
              ],
            },
            {
              model: UserAppointments,
              as: "appointment",
            },
            {
              model: ConversationParticipant,
              as: "participants",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "username", "type", "firstName", "lastName"],
                },
              ],
            },
          ],
        },
      ],
      order: [[{ model: Conversation, as: "conversation" }, "updatedAt", "DESC"]],
    });

    // Calculate unread count for each conversation and decrypt user data
    const conversationsWithUnread = await Promise.all(
      participations.map(async (p) => {
        const unreadCount = await Message.count({
          where: {
            conversationId: p.conversationId,
            createdAt: { [Op.gt]: p.lastReadAt || new Date(0) },
            senderId: { [Op.ne]: userId },
          },
        });

        const pData = p.toJSON();

        // Decrypt participant user data
        if (pData.conversation?.participants) {
          pData.conversation.participants = pData.conversation.participants.map((part) => ({
            ...part,
            user: part.user ? decryptUserFields(part.user) : null,
          }));
        }

        // Decrypt last message sender
        if (pData.conversation?.messages?.[0]?.sender) {
          pData.conversation.messages[0].sender = decryptUserFields(
            pData.conversation.messages[0].sender
          );
        }

        return {
          ...pData,
          unreadCount,
        };
      })
    );

    return res.json({ conversations: conversationsWithUnread });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

/**
 * GET /api/v1/messages/conversation/:conversationId
 * Get all messages in a specific conversation
 */
messageRouter.get("/conversation/:conversationId", authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;

    // Validate conversationId is a valid numeric ID
    if (!isValidId(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    // Verify user is a participant
    const participant = await ConversationParticipant.findOne({
      where: { conversationId, userId },
    });

    if (!participant) {
      return res.status(403).json({ error: "Not authorized to view this conversation" });
    }

    const messages = await Message.findAll({
      where: {
        conversationId,
        deletedAt: null, // Exclude soft-deleted messages
      },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "username", "type", "firstName", "lastName"],
        },
        {
          model: MessageReaction,
          as: "reactions",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "firstName", "lastName"],
            },
          ],
        },
        {
          model: MessageReadReceipt,
          as: "readReceipts",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "firstName", "lastName"],
            },
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    // Update lastReadAt for this participant
    await participant.update({ lastReadAt: new Date() });

    // Get conversation details
    const conversation = await Conversation.findByPk(conversationId, {
      include: [
        {
          model: UserAppointments,
          as: "appointment",
        },
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "type", "firstName", "lastName"],
            },
          ],
        },
      ],
    });

    const serializedConversation = MessageSerializer.serializeConversation(conversation);

    return res.json({
      messages: MessageSerializer.serializeArray(messages),
      conversation: serializedConversation,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/**
 * POST /api/v1/messages/send
 * Send a message in a conversation
 */
messageRouter.post("/send", authenticateToken, async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const senderId = req.userId;
    const io = req.app.get("io");

    // Validate conversationId
    if (!isValidId(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Verify sender is a participant
    const participant = await ConversationParticipant.findOne({
      where: { conversationId, userId: senderId },
    });

    if (!participant) {
      return res.status(403).json({ error: "Not authorized to send messages in this conversation" });
    }

    // Check if this is a completed appointment conversation
    const conversation = await Conversation.findByPk(conversationId, {
      include: [{ model: UserAppointments, as: "appointment" }],
    });

    if (
      conversation?.conversationType === "appointment" &&
      conversation?.appointment?.completed
    ) {
      return res.status(403).json({
        error: "Messaging is disabled for completed appointments",
      });
    }

    // Detect suspicious content for appointment conversations
    let hasSuspiciousContent = false;
    let suspiciousContentTypes = [];

    if (conversation?.conversationType === "appointment") {
      const detection = SuspiciousContentDetector.detect(content);
      hasSuspiciousContent = detection.isSuspicious;
      suspiciousContentTypes = detection.types;
    }

    // Create the message
    const message = await Message.create({
      conversationId,
      senderId,
      content: content.trim(),
      messageType: "text",
      hasSuspiciousContent,
      suspiciousContentTypes,
    });

    // Check if this is the first message AFTER creation (prevents race condition)
    const firstMessage = await Message.findOne({
      where: { conversationId },
      order: [["id", "ASC"]],
      attributes: ["id"],
    });
    const isFirstMessage = firstMessage && firstMessage.id === message.id;

    // Get message with sender info
    const messageWithSender = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "username", "type", "firstName", "lastName"],
        },
      ],
    });

    // Update conversation's updatedAt
    await Conversation.update(
      { updatedAt: new Date() },
      { where: { id: conversationId } }
    );

    // Emit to all participants in the conversation room
    io.to(`conversation_${conversationId}`).emit("new_message", messageWithSender);

    // Send email notifications to other participants
    const otherParticipants = await ConversationParticipant.findAll({
      where: {
        conversationId,
        userId: { [Op.ne]: senderId },
      },
      include: [
        {
          model: User,
          as: "user",
        },
      ],
    });

    const sender = await User.findByPk(senderId);
    const senderName = sender?.username || "Someone";

    for (const p of otherParticipants) {
      // Emit to user's personal room for unread count update
      io.to(`user_${p.userId}`).emit("unread_update", { conversationId });

      // Send email notification only for the first message in the conversation
      if (isFirstMessage && p.user?.notifications?.includes("email") && p.user.email) {
        const decryptedEmail = safeDecrypt(p.user.email);
        if (decryptedEmail) {
          await Email.sendNewMessageNotification(
            decryptedEmail,
            p.user.username,
            senderName,
            content
          );
        }
      }

      // Send push notification if user has phone notifications enabled
      if (p.user?.notifications?.includes("phone") && p.user.expoPushToken) {
        await PushNotification.sendPushNewMessage(
          p.user.expoPushToken,
          p.user.username,
          senderName,
          content
        );
      }
    }

    return res.status(201).json({ message: messageWithSender });
  } catch (error) {
    console.error("Error sending message:", error);
    return res.status(500).json({ error: "Failed to send message" });
  }
});

/**
 * POST /api/v1/messages/conversation/appointment
 * Create or get a conversation for a specific appointment
 */
messageRouter.post("/conversation/appointment", authenticateToken, async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const userId = req.userId;

    // Validate appointmentId
    if (!isValidId(appointmentId)) {
      return res.status(400).json({ error: "Invalid appointment ID" });
    }

    // Get appointment details
    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Check if conversation already exists for this appointment
    let conversation = await Conversation.findOne({
      where: { appointmentId, conversationType: "appointment" },
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "type", "firstName", "lastName"],
            },
          ],
        },
      ],
    });

    if (!conversation) {
      // Create new conversation
      conversation = await Conversation.create({
        appointmentId,
        conversationType: "appointment",
        createdBy: userId,
      });

      // Add homeowner as participant
      await ConversationParticipant.create({
        conversationId: conversation.id,
        userId: appointment.userId,
      });

      // Add assigned cleaners as participants
      if (appointment.employeesAssigned && appointment.employeesAssigned.length > 0) {
        for (const employeeIdStr of appointment.employeesAssigned) {
          const employeeId = parseInt(employeeIdStr);
          if (employeeId !== appointment.userId) {
            await ConversationParticipant.findOrCreate({
              where: {
                conversationId: conversation.id,
                userId: employeeId,
              },
            });
          }
        }
      }

      // Add owner as participant
      const owner = await User.findOne({
        where: { type: "owner" },
      });
      if (owner && owner.id !== appointment.userId) {
        await ConversationParticipant.findOrCreate({
          where: {
            conversationId: conversation.id,
            userId: owner.id,
          },
        });
      }

      // Reload conversation with participants
      conversation = await Conversation.findByPk(conversation.id, {
        include: [
          {
            model: ConversationParticipant,
            as: "participants",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "username", "type", "firstName", "lastName"],
              },
            ],
          },
        ],
      });
    }

    // Decrypt user PII fields before returning
    if (conversation?.participants) {
      const plainConv = conversation.toJSON ? conversation.toJSON() : conversation;
      plainConv.participants = plainConv.participants.map((part) => ({
        ...part,
        user: part.user ? decryptUserFields(part.user) : null,
      }));
      return res.json({ conversation: plainConv });
    }

    return res.json({ conversation });
  } catch (error) {
    console.error("Error creating/getting appointment conversation:", error);
    return res.status(500).json({ error: "Failed to create conversation" });
  }
});

/**
 * POST /api/v1/messages/broadcast
 * Owner-only: Send a broadcast message to all cleaners, homeowners, or everyone
 */
messageRouter.post("/broadcast", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { content, targetAudience, title } = req.body;
    // targetAudience: "all", "cleaners", "homeowners"

    // Verify user is a owner
    const user = await User.findByPk(userId);
    if (!user || user.type !== "owner") {
      return res.status(403).json({ error: "Only owners can send broadcasts" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Broadcast content is required" });
    }

    // Validate targetAudience - must be explicitly specified
    const validAudiences = ["all", "cleaners", "homeowners"];
    if (!targetAudience || !validAudiences.includes(targetAudience)) {
      return res.status(400).json({
        error: "Invalid targetAudience. Must be 'all', 'cleaners', or 'homeowners'",
      });
    }

    const io = req.app.get("io");

    // Create broadcast conversation
    const conversation = await Conversation.create({
      conversationType: "broadcast",
      title: title || "Company Announcement",
      createdBy: userId,
    });

    // Get target users based on audience
    let targetUsers;
    if (targetAudience === "cleaners") {
      targetUsers = await User.findAll({ where: { type: "cleaner" } });
    } else if (targetAudience === "homeowners") {
      // Homeowners are users with type null or type 'client' (not cleaners, employees, owners, HR)
      targetUsers = await User.findAll({
        where: {
          [Op.or]: [
            { type: null },
            { type: "client" },
          ],
        },
      });
    } else {
      // "all" - everyone except the owner sending it
      targetUsers = await User.findAll({
        where: { id: { [Op.ne]: userId } },
      });
    }

    // Add owner as participant
    await ConversationParticipant.create({
      conversationId: conversation.id,
      userId,
      lastReadAt: new Date(),
    });

    // Add all target users as participants
    for (const targetUser of targetUsers) {
      await ConversationParticipant.create({
        conversationId: conversation.id,
        userId: targetUser.id,
      });
    }

    // Create the broadcast message
    const message = await Message.create({
      conversationId: conversation.id,
      senderId: userId,
      content: content.trim(),
      messageType: "broadcast",
    });

    const messageWithSender = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "username", "type", "firstName", "lastName"],
        },
      ],
    });

    // Emit broadcast to all target users
    for (const targetUser of targetUsers) {
      io.to(`user_${targetUser.id}`).emit("broadcast", {
        conversation,
        message: messageWithSender,
      });

      // Send email notification if user has it enabled
      if (targetUser.notifications && targetUser.notifications.includes("email")) {
        const decryptedEmail = safeDecrypt(targetUser.email);
        if (decryptedEmail) {
          await Email.sendBroadcastNotification(
            decryptedEmail,
            targetUser.username,
            title || "Company Announcement",
            content
          );
        }
      }

      // Send push notification if user has phone notifications enabled
      if (targetUser.notifications && targetUser.notifications.includes("phone") && targetUser.expoPushToken) {
        await PushNotification.sendPushBroadcast(
          targetUser.expoPushToken,
          targetUser.username,
          title || "Company Announcement",
          content
        );
      }
    }

    return res.status(201).json({ conversation, message: messageWithSender });
  } catch (error) {
    console.error("Error sending broadcast:", error);
    return res.status(500).json({ error: "Failed to send broadcast" });
  }
});

/**
 * GET /api/v1/messages/unread-count
 * Get total unread message count for the current user
 */
messageRouter.get("/unread-count", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const participations = await ConversationParticipant.findAll({
      where: { userId },
    });

    let totalUnread = 0;
    for (const p of participations) {
      const count = await Message.count({
        where: {
          conversationId: p.conversationId,
          createdAt: { [Op.gt]: p.lastReadAt || new Date(0) },
          senderId: { [Op.ne]: userId },
        },
      });
      totalUnread += count;
    }

    return res.json({ unreadCount: totalUnread });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

/**
 * PATCH /api/v1/messages/mark-read/:conversationId
 * Mark all messages in a conversation as read
 */
messageRouter.patch("/mark-read/:conversationId", authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;

    if (!isValidId(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    const participant = await ConversationParticipant.findOne({
      where: { conversationId, userId },
    });

    if (!participant) {
      return res.status(403).json({ error: "Not a participant of this conversation" });
    }

    await participant.update({ lastReadAt: new Date() });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error marking as read:", error);
    return res.status(500).json({ error: "Failed to mark as read" });
  }
});

/**
 * POST /api/v1/messages/conversation/support
 * Create or get a support conversation with the owner
 * For cleaners and homeowners to contact management for help
 */
messageRouter.post("/conversation/support", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Get current user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Don't allow owners or HR to create support conversations with themselves
    if (user.type === "owner" || user.type === "humanResources") {
      return res.status(400).json({ error: "Owners and HR cannot create support conversations" });
    }

    // Find all owners and HR users who should be part of support conversations
    const supportStaff = await User.findAll({
      where: {
        [Op.or]: [
          { type: "owner" },
          { type: "humanResources" },
        ],
      },
    });

    if (supportStaff.length === 0) {
      return res.status(404).json({ error: "No support staff available" });
    }

    // Find the primary owner
    const owner = supportStaff.find(u => u.type === "owner");
    if (!owner) {
      return res.status(404).json({ error: "No owner available" });
    }

    // Check if a support conversation already exists between this user and owner
    const existingParticipation = await ConversationParticipant.findAll({
      where: { userId },
      include: [
        {
          model: Conversation,
          as: "conversation",
          where: { conversationType: "support" },
          include: [
            {
              model: ConversationParticipant,
              as: "participants",
              where: { userId: owner.id },
            },
          ],
        },
      ],
    });

    let conversation;

    if (existingParticipation.length > 0) {
      // Return existing support conversation
      conversation = await Conversation.findByPk(existingParticipation[0].conversationId, {
        include: [
          {
            model: ConversationParticipant,
            as: "participants",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "username", "type", "firstName", "lastName"],
              },
            ],
          },
        ],
      });

      // If conversation was deleted, create a new one
      if (!conversation) {
        existingParticipation.length = 0; // Reset to trigger creation below
      }
    }

    if (existingParticipation.length === 0 || !conversation) {
      // Create new support conversation
      conversation = await Conversation.create({
        conversationType: "support",
        title: `Support - ${user.username}`,
        createdBy: userId,
      });

      // Add user as participant
      await ConversationParticipant.create({
        conversationId: conversation.id,
        userId,
      });

      // Add all support staff (owner + HR) as participants
      for (const staff of supportStaff) {
        await ConversationParticipant.findOrCreate({
          where: {
            conversationId: conversation.id,
            userId: staff.id,
          },
        });
      }

      // Reload conversation with participants
      conversation = await Conversation.findByPk(conversation.id, {
        include: [
          {
            model: ConversationParticipant,
            as: "participants",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "username", "type", "firstName", "lastName"],
              },
            ],
          },
        ],
      });

      // Note: Notifications (email, push, socket) are sent when the user
      // actually sends a message via the /send endpoint, not when the
      // conversation is created. This prevents notifications from being
      // sent just by clicking "Get Help".
    }

    // Decrypt user PII fields before returning
    if (conversation?.participants) {
      const plainConv = conversation.toJSON ? conversation.toJSON() : conversation;
      plainConv.participants = plainConv.participants.map((part) => ({
        ...part,
        user: part.user ? decryptUserFields(part.user) : null,
      }));
      return res.json({ conversation: plainConv });
    }

    return res.json({ conversation });
  } catch (error) {
    console.error("Error creating/getting support conversation:", error);
    return res.status(500).json({ error: "Failed to create support conversation" });
  }
});

/**
 * DELETE /api/v1/messages/conversation/support/:conversationId/cleanup
 * Cleanup an empty support conversation (delete if no messages were sent)
 * Users can only cleanup support conversations they're a participant of
 */
messageRouter.delete("/conversation/support/:conversationId/cleanup", authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;

    if (!isValidId(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    // Find the conversation
    const conversation = await Conversation.findByPk(conversationId, {
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
        },
        {
          model: Message,
          as: "messages",
        },
      ],
    });

    if (!conversation) {
      // Conversation doesn't exist, consider it already cleaned up
      return res.json({ success: true, deleted: false, reason: "not_found" });
    }

    // Only allow cleanup of support conversations
    if (conversation.conversationType !== "support") {
      return res.status(400).json({ error: "Can only cleanup support conversations" });
    }

    // Verify user is a participant
    const isParticipant = conversation.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      return res.status(403).json({ error: "You are not a participant of this conversation" });
    }

    // Only delete if there are no messages
    if (conversation.messages && conversation.messages.length > 0) {
      return res.json({ success: true, deleted: false, reason: "has_messages" });
    }

    // Delete participants first, then conversation
    await ConversationParticipant.destroy({
      where: { conversationId: conversation.id },
    });

    await conversation.destroy();

    return res.json({ success: true, deleted: true });
  } catch (error) {
    console.error("Error cleaning up support conversation:", error);
    return res.status(500).json({ error: "Failed to cleanup conversation" });
  }
});

/**
 * POST /api/v1/messages/conversation/cleaner-client
 * Create or get a direct conversation between a cleaner (business owner) and their client
 * Either party can initiate this - the cleaner or the client
 */
messageRouter.post("/conversation/cleaner-client", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { clientUserId, cleanerUserId } = req.body;

    // Validate IDs if provided
    if (clientUserId && !isValidId(clientUserId)) {
      return res.status(400).json({ error: "Invalid client user ID" });
    }
    if (cleanerUserId && !isValidId(cleanerUserId)) {
      return res.status(400).json({ error: "Invalid cleaner user ID" });
    }

    // Get current user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let cleanerId, clientId, cleanerUser, clientUser;

    if (user.type === "cleaner") {
      // Cleaner is initiating - they need to specify which client
      if (!clientUserId) {
        return res.status(400).json({ error: "clientUserId is required for cleaner" });
      }
      cleanerId = userId;
      clientId = clientUserId;

      // Verify the cleaner-client relationship exists
      const cleanerClient = await CleanerClient.findOne({
        where: {
          cleanerId: cleanerId,
          clientId: clientId,
          status: "active",
        },
      });

      // Also check if this cleaner is preferred for any of the client's homes
      const preferredHome = await UserHomes.findOne({
        where: {
          userId: clientId,
          preferredCleanerId: cleanerId,
        },
      });

      if (!cleanerClient && !preferredHome) {
        return res.status(403).json({ error: "No active relationship with this client" });
      }

      cleanerUser = user;
      clientUser = await User.findByPk(clientId);
    } else if (user.type === "homeowner" || user.type === "client" || user.type === null || user.type === undefined) {
      // Client/homeowner is initiating - they need to specify which cleaner (or we find their preferred)
      clientId = userId;
      clientUser = user;

      if (cleanerUserId) {
        cleanerId = cleanerUserId;
      } else {
        // Find their preferred cleaner from any of their homes
        const homeWithPreferred = await UserHomes.findOne({
          where: {
            userId: clientId,
            preferredCleanerId: { [Op.ne]: null },
          },
        });

        if (homeWithPreferred) {
          cleanerId = homeWithPreferred.preferredCleanerId;
        } else {
          // Check CleanerClient relationship
          const cleanerClient = await CleanerClient.findOne({
            where: {
              clientId: clientId,
              status: "active",
            },
          });

          if (cleanerClient) {
            cleanerId = cleanerClient.cleanerId;
          } else {
            return res.status(404).json({ error: "No preferred cleaner found. Please specify cleanerUserId." });
          }
        }
      }

      // Verify the relationship
      const cleanerClient = await CleanerClient.findOne({
        where: {
          cleanerId: cleanerId,
          clientId: clientId,
          status: "active",
        },
      });

      const preferredHome = await UserHomes.findOne({
        where: {
          userId: clientId,
          preferredCleanerId: cleanerId,
        },
      });

      if (!cleanerClient && !preferredHome) {
        return res.status(403).json({ error: "No active relationship with this cleaner" });
      }

      cleanerUser = await User.findByPk(cleanerId);
    } else {
      return res.status(403).json({ error: "Only cleaners and homeowners can use this endpoint" });
    }

    if (!clientUser) {
      return res.status(404).json({ error: "Client not found" });
    }
    if (!cleanerUser) {
      return res.status(404).json({ error: "Cleaner not found" });
    }

    // Check if a cleaner-client conversation already exists between these two users
    const existingParticipation = await ConversationParticipant.findAll({
      where: { userId: cleanerId },
      include: [
        {
          model: Conversation,
          as: "conversation",
          where: { conversationType: "cleaner-client" },
          include: [
            {
              model: ConversationParticipant,
              as: "participants",
              where: { userId: clientId },
            },
          ],
        },
      ],
    });

    let conversation;

    if (existingParticipation.length > 0) {
      // Return existing conversation
      conversation = await Conversation.findByPk(existingParticipation[0].conversationId, {
        include: [
          {
            model: ConversationParticipant,
            as: "participants",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "username", "type", "firstName", "lastName"],
              },
            ],
          },
        ],
      });
    } else {
      // Create new cleaner-client conversation
      const cleanerName = `${cleanerUser.firstName || ""} ${cleanerUser.lastName || ""}`.trim() || cleanerUser.username;
      const clientName = `${clientUser.firstName || ""} ${clientUser.lastName || ""}`.trim() || clientUser.username;
      const conversationTitle = `${cleanerName} & ${clientName}`.substring(0, 255);

      conversation = await Conversation.create({
        conversationType: "cleaner-client",
        title: conversationTitle,
        createdBy: userId,
      });

      // Add both parties as participants
      await ConversationParticipant.create({
        conversationId: conversation.id,
        userId: cleanerId,
      });

      await ConversationParticipant.create({
        conversationId: conversation.id,
        userId: clientId,
      });

      // Reload conversation with participants
      conversation = await Conversation.findByPk(conversation.id, {
        include: [
          {
            model: ConversationParticipant,
            as: "participants",
            include: [
              {
                model: User,
                as: "user",
                attributes: ["id", "username", "type", "firstName", "lastName"],
              },
            ],
          },
        ],
      });
    }

    // Decrypt user PII fields before returning
    if (conversation?.participants) {
      const plainConv = conversation.toJSON ? conversation.toJSON() : conversation;
      plainConv.participants = plainConv.participants.map((part) => ({
        ...part,
        user: part.user ? decryptUserFields(part.user) : null,
      }));
      return res.json({ conversation: plainConv });
    }

    return res.json({ conversation });
  } catch (error) {
    console.error("Error creating/getting cleaner-client conversation:", error);
    return res.status(500).json({ error: "Failed to create conversation" });
  }
});

/**
 * POST /api/v1/messages/add-participant
 * Add a participant to an existing conversation (e.g., when cleaner is assigned)
 * Only conversation creator, owner, or HR can add participants
 */
messageRouter.post("/add-participant", authenticateToken, async (req, res) => {
  try {
    const { conversationId, userIdToAdd } = req.body;
    const requesterId = req.userId;

    // Validate IDs
    if (!isValidId(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }
    if (!isValidId(userIdToAdd)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Get requester info
    const requester = await User.findByPk(requesterId);
    if (!requester) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Get conversation to check type and creator
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Verify requester is a participant
    const requesterParticipant = await ConversationParticipant.findOne({
      where: { conversationId, userId: requesterId },
    });

    if (!requesterParticipant) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Only allow adding participants to certain conversation types
    const allowedTypes = ["appointment", "internal", "employee_group"];
    if (!allowedTypes.includes(conversation.conversationType)) {
      return res.status(403).json({ error: "Cannot add participants to this conversation type" });
    }

    // Only creator, owner, or HR can add participants
    const isCreator = conversation.createdBy === requesterId;
    const isOwnerOrHR = requester.type === "owner" || requester.type === "humanResources";

    if (!isCreator && !isOwnerOrHR) {
      return res.status(403).json({ error: "Only the conversation creator or admin can add participants" });
    }

    // Verify the user to add exists
    const userToAdd = await User.findByPk(userIdToAdd);
    if (!userToAdd) {
      return res.status(404).json({ error: "User not found" });
    }

    // For appointment conversations, verify the user is associated with the appointment
    if (conversation.conversationType === "appointment" && conversation.appointmentId) {
      const appointment = await UserAppointments.findByPk(conversation.appointmentId);
      if (appointment) {
        const home = await UserHomes.findByPk(appointment.homeId);
        const isHomeowner = home && home.userId === userIdToAdd;
        const isAssignedCleaner = appointment.employeesAssigned &&
          appointment.employeesAssigned.includes(String(userIdToAdd));

        // Allow owner/HR to add anyone, but log for auditing
        if (!isOwnerOrHR && !isHomeowner && !isAssignedCleaner) {
          return res.status(403).json({
            error: "Can only add users associated with this appointment",
          });
        }
      }
    }

    // Add new participant
    const [participant, created] = await ConversationParticipant.findOrCreate({
      where: { conversationId, userId: userIdToAdd },
    });

    if (created) {
      // Notify the new participant
      const io = req.app.get("io");
      io.to(`user_${userIdToAdd}`).emit("added_to_conversation", { conversationId });
    }

    return res.json({ participant, created });
  } catch (error) {
    console.error("Error adding participant:", error);
    return res.status(500).json({ error: "Failed to add participant" });
  }
});

/**
 * POST /api/v1/messages/conversation/hr-group
 * Create or get the group conversation for owner to message all HR staff
 * Owner only
 */
messageRouter.post("/conversation/hr-group", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Verify user is owner
    const user = await User.findByPk(userId);
    if (!user || user.type !== "owner") {
      return res.status(403).json({ error: "Only owner can access HR group chat" });
    }

    // Get all HR staff
    const hrStaff = await User.findAll({
      where: { type: "humanResources" },
      attributes: ["id", "username", "firstName", "lastName"],
    });

    if (hrStaff.length === 0) {
      return res.status(404).json({ error: "No HR staff available" });
    }

    // Look for existing HR group conversation
    let conversation = await Conversation.findOne({
      where: {
        conversationType: "internal",
        title: "HR Team",
      },
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "firstName", "lastName", "type"],
            },
          ],
        },
      ],
    });

    let created = false;

    if (conversation) {
      // Ensure all current HR staff are participants (in case new HR was added)
      for (const hr of hrStaff) {
        await ConversationParticipant.findOrCreate({
          where: { conversationId: conversation.id, userId: hr.id },
        });
      }
    } else {
      // Create new group conversation
      conversation = await Conversation.create({
        conversationType: "internal",
        title: "HR Team",
        createdBy: userId,
      });
      created = true;

      // Add owner
      await ConversationParticipant.create({
        conversationId: conversation.id,
        userId: userId,
      });

      // Add all HR staff
      for (const hr of hrStaff) {
        await ConversationParticipant.create({
          conversationId: conversation.id,
          userId: hr.id,
        });
      }
    }

    // Reload with full participant info
    conversation = await Conversation.findByPk(conversation.id, {
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "firstName", "lastName", "type"],
            },
          ],
        },
      ],
    });

    return res.json({ conversation, created });
  } catch (error) {
    console.error("Error creating/getting HR group conversation:", error);
    return res.status(500).json({ error: "Failed to create HR group conversation" });
  }
});

/**
 * POST /api/v1/messages/conversation/hr-direct
 * Create or get a 1-on-1 conversation between owner and specific HR, or HR-to-HR, or HR-to-owner
 * Owner or HR can call this
 */
messageRouter.post("/conversation/hr-direct", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { targetUserId } = req.body;

    // Validate targetUserId if provided
    if (targetUserId && !isValidId(targetUserId)) {
      return res.status(400).json({ error: "Invalid target user ID" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Must be owner or HR
    if (user.type !== "owner" && user.type !== "humanResources") {
      return res.status(403).json({ error: "Only owner or HR can use this endpoint" });
    }

    let otherUserId;
    let otherUser;

    if (user.type === "owner") {
      // Owner must specify which HR to message
      if (!targetUserId) {
        return res.status(400).json({ error: "targetUserId is required for owner" });
      }
      otherUser = await User.findByPk(targetUserId);
      if (!otherUser || otherUser.type !== "humanResources") {
        return res.status(400).json({ error: "Target must be an HR staff member" });
      }
      otherUserId = targetUserId;
    } else {
      // HR can message owner or another HR
      if (targetUserId) {
        otherUser = await User.findByPk(targetUserId);
        if (!otherUser || (otherUser.type !== "owner" && otherUser.type !== "humanResources")) {
          return res.status(400).json({ error: "Target must be owner or HR staff" });
        }
        if (otherUser.id === userId) {
          return res.status(400).json({ error: "Cannot message yourself" });
        }
        otherUserId = targetUserId;
      } else {
        // Default to messaging owner if no target specified
        otherUser = await User.findOne({
          where: { type: "owner" },
        });
        if (!otherUser) {
          return res.status(404).json({ error: "Owner not found" });
        }
        otherUserId = otherUser.id;
      }
    }

    // Check for existing 1-on-1 internal conversation
    const userParticipations = await ConversationParticipant.findAll({
      where: { userId },
      include: [
        {
          model: Conversation,
          as: "conversation",
          where: { conversationType: "internal" },
          include: [
            {
              model: ConversationParticipant,
              as: "participants",
            },
          ],
        },
      ],
    });

    // Find a conversation with exactly 2 participants (this user + other user)
    let existingConversation = null;
    for (const participation of userParticipations) {
      const conv = participation.conversation;
      if (conv.participants.length === 2) {
        const participantIds = conv.participants.map((p) => p.userId);
        if (participantIds.includes(userId) && participantIds.includes(otherUserId)) {
          existingConversation = conv;
          break;
        }
      }
    }

    let conversation;
    let created = false;

    if (existingConversation) {
      conversation = existingConversation;
    } else {
      // Create new 1-on-1 conversation
      const otherName = `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() || otherUser.username;
      const title = otherName;  // Just "FirstName LastName" for direct messages

      conversation = await Conversation.create({
        conversationType: "internal",
        title,
        createdBy: userId,
      });
      created = true;

      await ConversationParticipant.create({
        conversationId: conversation.id,
        userId: userId,
      });

      await ConversationParticipant.create({
        conversationId: conversation.id,
        userId: otherUserId,
      });

      // Notify the other user of new conversation
      const io = req.app.get("io");
      io.to(`user_${otherUserId}`).emit("new_internal_conversation", {
        conversationId: conversation.id,
        initiator: { id: user.id, username: user.username, type: user.type },
      });
    }

    // Reload with full details
    conversation = await Conversation.findByPk(conversation.id, {
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "firstName", "lastName", "type"],
            },
          ],
        },
      ],
    });

    return res.json({ conversation, created });
  } catch (error) {
    console.error("Error creating/getting HR direct conversation:", error);
    return res.status(500).json({ error: "Failed to create direct conversation" });
  }
});

/**
 * POST /api/v1/messages/conversation/owner-direct
 * Create or get a 1-on-1 conversation between owner and any user (cleaner, client, etc.)
 * Owner only
 */
messageRouter.post("/conversation/owner-direct", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { targetUserId } = req.body;

    if (!targetUserId || !isValidId(targetUserId)) {
      return res.status(400).json({ error: "Valid targetUserId is required" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Must be owner
    if (user.type !== "owner") {
      return res.status(403).json({ error: "Only owner can use this endpoint" });
    }

    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: "Target user not found" });
    }

    if (targetUser.id === userId) {
      return res.status(400).json({ error: "Cannot message yourself" });
    }

    // Check for existing 1-on-1 internal conversation
    const userParticipations = await ConversationParticipant.findAll({
      where: { userId },
      include: [
        {
          model: Conversation,
          as: "conversation",
          where: { conversationType: "internal" },
          include: [
            {
              model: ConversationParticipant,
              as: "participants",
            },
          ],
        },
      ],
    });

    // Find a conversation with exactly 2 participants (this user + target user)
    let existingConversation = null;
    for (const participation of userParticipations) {
      const conv = participation.conversation;
      if (conv && conv.participants && conv.participants.length === 2) {
        const participantIds = conv.participants.map((p) => p.userId);
        if (participantIds.includes(userId) && participantIds.includes(parseInt(targetUserId))) {
          existingConversation = conv;
          break;
        }
      }
    }

    if (existingConversation) {
      return res.status(200).json({ conversation: existingConversation });
    }

    // Create new conversation
    const targetFirstName = safeDecrypt(targetUser.firstName) || targetUser.username;
    const ownerFirstName = safeDecrypt(user.firstName) || user.username;
    const title = `${ownerFirstName} & ${targetFirstName}`;

    const newConversation = await Conversation.create({
      title,
      conversationType: "internal",
      createdBy: userId,
    });

    // Add both participants
    await ConversationParticipant.bulkCreate([
      { conversationId: newConversation.id, userId },
      { conversationId: newConversation.id, userId: parseInt(targetUserId) },
    ]);

    // Fetch complete conversation
    const fullConversation = await Conversation.findByPk(newConversation.id, {
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "firstName", "lastName", "type"],
            },
          ],
        },
      ],
    });

    // Notify target user via socket
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${targetUserId}`).emit("new_conversation", {
        conversation: fullConversation,
      });
    }

    return res.status(201).json({ conversation: fullConversation });
  } catch (error) {
    console.error("Error creating/getting owner direct conversation:", error);
    return res.status(500).json({ error: "Failed to create direct conversation" });
  }
});

/**
 * POST /api/v1/messages/conversation/custom-group
 * Create a custom group conversation with specific selected members
 * Owner or HR can create custom groups
 */
messageRouter.post("/conversation/custom-group", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { memberIds, title } = req.body;
    const io = req.app.get("io");

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Must be owner or HR
    if (user.type !== "owner" && user.type !== "humanResources") {
      return res.status(403).json({ error: "Only owner or HR can create custom groups" });
    }

    // Validate memberIds
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 1) {
      return res.status(400).json({ error: "At least one member is required" });
    }

    // Remove duplicates and ensure creator is not in the list (they'll be added automatically)
    const uniqueMemberIds = [...new Set(memberIds.filter((id) => id !== userId))];

    if (uniqueMemberIds.length < 1) {
      return res.status(400).json({ error: "At least one other member is required" });
    }

    // Validate all members exist and are owner or HR
    const members = await User.findAll({
      where: {
        id: { [Op.in]: uniqueMemberIds },
        [Op.or]: [
          { type: "owner" },
          { type: "humanResources" },
        ],
      },
      attributes: ["id", "username", "firstName", "lastName", "type"],
    });

    if (members.length !== uniqueMemberIds.length) {
      return res.status(400).json({ error: "All members must be valid owner or HR staff" });
    }

    // Generate title from member names if not provided
    let groupTitle = title;
    if (!groupTitle || !groupTitle.trim()) {
      const memberNames = members.map((m) => m.firstName || m.username).slice(0, 3);
      groupTitle = memberNames.join(", ");
      if (members.length > 3) {
        groupTitle += ` +${members.length - 3} more`;
      }
    }

    // Truncate title to fit VARCHAR(255) limit
    groupTitle = groupTitle.substring(0, 255);

    // Create the conversation
    const conversation = await Conversation.create({
      conversationType: "internal",
      title: groupTitle,
      createdBy: userId,
    });

    // Add creator as participant
    await ConversationParticipant.create({
      conversationId: conversation.id,
      userId: userId,
    });

    // Add all selected members as participants
    for (const member of members) {
      await ConversationParticipant.create({
        conversationId: conversation.id,
        userId: member.id,
      });

      // Notify each member of new group conversation
      io.to(`user_${member.id}`).emit("new_internal_conversation", {
        conversationId: conversation.id,
        title: groupTitle,
        initiator: { id: user.id, username: user.username, type: user.type },
        isGroup: true,
      });
    }

    // Reload with full participant info
    const fullConversation = await Conversation.findByPk(conversation.id, {
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "firstName", "lastName", "type"],
            },
          ],
        },
      ],
    });

    return res.status(201).json({
      conversation: fullConversation,
      memberNames: members.map((m) => ({
        id: m.id,
        name: `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.username,
      })),
    });
  } catch (error) {
    console.error("Error creating custom group conversation:", error);
    return res.status(500).json({ error: "Failed to create custom group" });
  }
});

/**
 * GET /api/v1/messages/staff
 * Get list of staff members that current user can message
 * Owner sees: all HR staff
 * HR sees: owner + other HR staff (excluding self)
 * Supports search query parameter for filtering by name/username
 */
messageRouter.get("/staff", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { search } = req.query;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Must be owner or HR
    if (user.type !== "owner" && user.type !== "humanResources") {
      return res.status(403).json({ error: "Only owner or HR can access this endpoint" });
    }

    let whereClause;

    if (user.type === "owner") {
      // Owner sees all HR staff
      whereClause = { type: "humanResources" };
    } else {
      // HR sees owner + other HR staff (excluding self)
      whereClause = {
        [Op.and]: [
          { id: { [Op.ne]: userId } },
          {
            [Op.or]: [
              { type: "owner" },
              { type: "humanResources" },
            ],
          },
        ],
      };
    }

    // Add search filter if provided
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      const searchCondition = {
        [Op.or]: [
          { firstName: { [Op.iLike]: searchTerm } },
          { lastName: { [Op.iLike]: searchTerm } },
          { username: { [Op.iLike]: searchTerm } },
        ],
      };
      whereClause = { [Op.and]: [whereClause, searchCondition] };
    }

    const staff = await User.findAll({
      where: whereClause,
      attributes: ["id", "username", "firstName", "lastName", "type"],
      order: [["firstName", "ASC"], ["lastName", "ASC"]],
    });

    return res.json({ staff });
  } catch (error) {
    console.error("Error fetching staff list:", error);
    return res.status(500).json({ error: "Failed to fetch staff list" });
  }
});

/**
 * GET /api/v1/messages/conversations/internal
 * Get all internal (owner-HR) conversations for the current user
 * Owner or HR only
 */
messageRouter.get("/conversations/internal", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Must be owner or HR
    if (user.type !== "owner" && user.type !== "humanResources") {
      return res.status(403).json({ error: "Only owner or HR can access internal conversations" });
    }

    // Get all internal conversations where user is a participant
    const participations = await ConversationParticipant.findAll({
      where: { userId },
      include: [
        {
          model: Conversation,
          as: "conversation",
          where: { conversationType: "internal" },
          include: [
            {
              model: Message,
              as: "messages",
              limit: 1,
              order: [["createdAt", "DESC"]],
              include: [
                {
                  model: User,
                  as: "sender",
                  attributes: ["id", "username", "firstName", "lastName"],
                },
              ],
            },
            {
              model: ConversationParticipant,
              as: "participants",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "username", "firstName", "lastName", "type"],
                },
              ],
            },
          ],
        },
      ],
      order: [[{ model: Conversation, as: "conversation" }, "updatedAt", "DESC"]],
    });

    // Calculate unread count and format response
    const conversations = await Promise.all(
      participations.map(async (p) => {
        const unreadCount = await Message.count({
          where: {
            conversationId: p.conversationId,
            createdAt: { [Op.gt]: p.lastReadAt || new Date(0) },
            senderId: { [Op.ne]: userId },
          },
        });

        const conv = p.conversation;
        const lastMessage = conv.messages && conv.messages[0] ? conv.messages[0] : null;
        const isGroupChat = conv.participants.length > 2;

        // Get other participants (not the current user)
        const otherParticipants = conv.participants
          .filter((part) => part.user.id !== userId)
          .map((part) => {
            const decryptedUser = decryptUserFields(part.user);
            return {
              id: part.user.id,
              username: part.user.username,
              firstName: decryptedUser.firstName,
              lastName: decryptedUser.lastName,
              type: part.user.type,
              displayName: `${decryptedUser.firstName || ""} ${decryptedUser.lastName || ""}`.trim() || part.user.username,
            };
          });

        // Generate display name for the conversation
        let displayName;
        if (isGroupChat) {
          // For groups, show first 3 names + count
          const names = otherParticipants.slice(0, 3).map((p) => p.firstName || p.username);
          displayName = names.join(", ");
          if (otherParticipants.length > 3) {
            displayName += ` +${otherParticipants.length - 3} more`;
          }
        } else if (otherParticipants.length === 1) {
          // For 1-on-1, show the other person's name
          displayName = otherParticipants[0].displayName;
        } else {
          displayName = conv.title || "Conversation";
        }

        return {
          id: conv.id,
          title: conv.title,
          displayName,
          isGroupChat,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                sender: (() => {
                  const decryptedSender = decryptUserFields(lastMessage.sender);
                  return {
                    ...decryptedSender,
                    displayName: `${decryptedSender.firstName || ""} ${decryptedSender.lastName || ""}`.trim() || lastMessage.sender.username,
                  };
                })(),
                createdAt: lastMessage.createdAt,
              }
            : null,
          unreadCount,
          participants: conv.participants.map((part) => {
            const decryptedUser = decryptUserFields(part.user);
            return {
              ...decryptedUser,
              displayName: `${decryptedUser.firstName || ""} ${decryptedUser.lastName || ""}`.trim() || part.user.username,
            };
          }),
          otherParticipants,
          updatedAt: conv.updatedAt,
        };
      })
    );

    return res.json({ conversations });
  } catch (error) {
    console.error("Error fetching internal conversations:", error);
    return res.status(500).json({ error: "Failed to fetch internal conversations" });
  }
});

/**
 * POST /api/v1/messages/:messageId/react
 * Add or toggle a reaction to a message
 */
messageRouter.post("/:messageId/react", authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.userId;
    const io = req.app.get("io");

    if (!isValidId(messageId)) {
      return res.status(400).json({ error: "Invalid message ID" });
    }

    if (!emoji || typeof emoji !== "string" || emoji.length === 0 || emoji.length > 10) {
      return res.status(400).json({ error: "Invalid emoji (must be 1-10 characters)" });
    }

    // Get the message with sender info
    const message = await Message.findByPk(messageId, {
      include: [
        { model: Conversation, as: "conversation" },
        {
          model: User,
          as: "sender",
          attributes: ["id", "username", "firstName", "lastName", "notifications", "expoPushToken"],
        },
      ],
    });

    if (!message || message.deletedAt) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Verify user is a participant of the conversation
    const participant = await ConversationParticipant.findOne({
      where: { conversationId: message.conversationId, userId },
    });

    if (!participant) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Check if reaction already exists
    const existingReaction = await MessageReaction.findOne({
      where: { messageId, userId, emoji },
    });

    let reaction;
    let action;

    if (existingReaction) {
      // Remove existing reaction (toggle off)
      await existingReaction.destroy();
      action = "removed";
      reaction = null;
    } else {
      // Add new reaction
      reaction = await MessageReaction.create({
        messageId,
        userId,
        emoji,
      });

      // Include user info
      reaction = await MessageReaction.findByPk(reaction.id, {
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "firstName", "lastName"],
          },
        ],
      });
      action = "added";
    }

    // Emit reaction update to all participants in the conversation
    io.to(`conversation_${message.conversationId}`).emit("message_reaction", {
      messageId: parseInt(messageId),
      reaction: reaction ? reaction.toJSON() : null,
      action,
      emoji,
      userId,
      conversationId: message.conversationId,
    });

    // Send push notification to message sender when someone else reacts (only for new reactions)
    if (action === "added" && message.senderId !== userId) {
      const reactor = await User.findByPk(userId, {
        attributes: ["id", "username", "firstName", "lastName"],
      });

      // Handle case where reactor user is not found (deleted user)
      if (!reactor) {
        console.warn(`[Messages] Reactor user ${userId} not found when sending reaction notification`);
        return res.json({ success: true, action, reaction });
      }

      const reactorName = reactor.firstName && reactor.lastName
        ? `${safeDecrypt(reactor.firstName)} ${safeDecrypt(reactor.lastName)}`
        : reactor.username;

      // Send push notification if sender has phone notifications enabled
      if (message.sender.notifications &&
          message.sender.notifications.includes("phone") &&
          message.sender.expoPushToken) {
        await PushNotification.sendPushReaction(
          message.sender.expoPushToken,
          reactorName,
          emoji,
          message.content
        );
      }

      // Emit to sender's personal room for real-time notification
      io.to(`user_${message.senderId}`).emit("reaction_notification", {
        messageId: parseInt(messageId),
        conversationId: message.conversationId,
        reactorId: userId,
        reactorName,
        emoji,
        messagePreview: (message.content || "").substring(0, 50),
      });
    }

    return res.json({ success: true, action, reaction });
  } catch (error) {
    console.error("Error reacting to message:", error);
    return res.status(500).json({ error: "Failed to react to message" });
  }
});

/**
 * DELETE /api/v1/messages/:messageId/react/:emoji
 * Remove a specific reaction from a message (users can only remove their own reactions)
 */
messageRouter.delete("/:messageId/react/:emoji", authenticateToken, async (req, res) => {
  try {
    const { messageId, emoji } = req.params;
    const userId = req.userId;
    const io = req.app.get("io");

    if (!isValidId(messageId)) {
      return res.status(400).json({ error: "Invalid message ID" });
    }

    // Validate emoji from URL params
    if (!emoji || emoji.length === 0 || emoji.length > 10) {
      return res.status(400).json({ error: "Invalid emoji" });
    }

    // Get the message
    const message = await Message.findByPk(messageId);

    if (!message || message.deletedAt) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Find the user's own reaction only - users cannot remove others' reactions
    const reaction = await MessageReaction.findOne({
      where: { messageId, userId, emoji },
    });

    if (!reaction) {
      // Check if reaction exists but belongs to someone else
      const otherReaction = await MessageReaction.findOne({
        where: { messageId, emoji },
      });
      if (otherReaction) {
        return res.status(403).json({ error: "You can only remove your own reactions" });
      }
      return res.status(404).json({ error: "Reaction not found" });
    }

    await reaction.destroy();

    // Emit reaction update
    io.to(`conversation_${message.conversationId}`).emit("message_reaction", {
      messageId: parseInt(messageId),
      reaction: null,
      action: "removed",
      emoji,
      userId,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error removing reaction:", error);
    return res.status(500).json({ error: "Failed to remove reaction" });
  }
});

/**
 * DELETE /api/v1/messages/conversation/:conversationId
 * Delete an entire conversation (owner only)
 * This permanently removes the conversation and all its messages
 * NOTE: This route MUST be defined before DELETE /:messageId to avoid path collision
 */
messageRouter.delete("/conversation/:conversationId", authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;
    const io = req.app.get("io");

    if (!isValidId(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    // Verify user is owner
    const user = await User.findByPk(userId);
    if (!user || user.type !== "owner") {
      return res.status(403).json({ error: "Only the owner can delete conversations" });
    }

    // Find the conversation
    const conversation = await Conversation.findByPk(conversationId, {
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
        },
        {
          model: Message,
          as: "messages",
        },
      ],
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get participant user IDs before deletion for socket notification
    const participantUserIds = conversation.participants.map((p) => p.userId);

    // Get message IDs for deleting reactions and read receipts
    const messageIds = conversation.messages.map((m) => m.id);

    // Delete in order: reactions, read receipts, messages, participants, conversation
    if (messageIds.length > 0) {
      await MessageReaction.destroy({
        where: { messageId: { [Op.in]: messageIds } },
      });

      await MessageReadReceipt.destroy({
        where: { messageId: { [Op.in]: messageIds } },
      });

      await Message.destroy({
        where: { conversationId },
      });
    }

    await ConversationParticipant.destroy({
      where: { conversationId },
    });

    await conversation.destroy();

    // Notify all participants that the conversation was deleted
    for (const participantUserId of participantUserIds) {
      io.to(`user_${participantUserId}`).emit("conversation_deleted", {
        conversationId: parseInt(conversationId),
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return res.status(500).json({ error: "Failed to delete conversation" });
  }
});

/**
 * DELETE /api/v1/messages/:messageId
 * Soft delete a message (only the sender can delete their own messages)
 */
messageRouter.delete("/:messageId", authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;
    const io = req.app.get("io");

    if (!isValidId(messageId)) {
      return res.status(400).json({ error: "Invalid message ID" });
    }

    const message = await Message.findByPk(messageId);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if already deleted
    if (message.deletedAt) {
      return res.status(400).json({ error: "Message already deleted" });
    }

    // Only the sender can delete their own messages
    if (message.senderId !== userId) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }

    // Soft delete - set deletedAt timestamp
    await message.update({ deletedAt: new Date() });

    // Emit message deleted event
    io.to(`conversation_${message.conversationId}`).emit("message_deleted", {
      messageId: parseInt(messageId),
      conversationId: message.conversationId,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting message:", error);
    return res.status(500).json({ error: "Failed to delete message" });
  }
});

/**
 * PATCH /api/v1/messages/conversation/:conversationId/title
 * Update conversation title (owner/HR only, internal conversations only)
 */
messageRouter.patch("/conversation/:conversationId/title", authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title } = req.body;
    const userId = req.userId;
    const io = req.app.get("io");

    if (!isValidId(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    // Validate title length (VARCHAR(255) limit)
    if (title.trim().length > 255) {
      return res.status(400).json({ error: "Title must be 255 characters or less" });
    }

    // Verify user is owner or HR
    const user = await User.findByPk(userId);
    if (!user || (user.type !== "owner" && user.type !== "humanResources")) {
      return res.status(403).json({ error: "Only owner or HR can edit conversation titles" });
    }

    // Find the conversation
    const conversation = await Conversation.findByPk(conversationId, {
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
        },
      ],
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Only allow editing internal conversations
    if (conversation.conversationType !== "internal") {
      return res.status(400).json({ error: "Can only edit titles of internal conversations" });
    }

    const oldTitle = conversation.title;
    const newTitle = title.trim();

    // Update the title
    await conversation.update({ title: newTitle });

    // Create system message recording the change
    const userName = user.firstName && user.lastName
      ? `${safeDecrypt(user.firstName)} ${safeDecrypt(user.lastName)}`
      : user.username;

    const systemMessage = await Message.create({
      conversationId: parseInt(conversationId),
      senderId: null, // System messages have no sender
      content: `${userName} changed the conversation name to "${newTitle}"`,
      messageType: "system",
    });

    // Get participant user IDs for notifications
    const participantUserIds = conversation.participants.map((p) => p.userId);

    // Emit title changed event to all participants
    for (const participantUserId of participantUserIds) {
      io.to(`user_${participantUserId}`).emit("conversation_title_changed", {
        conversationId: parseInt(conversationId),
        title: newTitle,
        oldTitle,
        changedBy: { id: user.id, name: userName },
      });
    }

    // Emit the system message to the conversation room
    io.to(`conversation_${conversationId}`).emit("new_message", systemMessage);

    return res.json({
      success: true,
      conversation: { ...conversation.toJSON(), title: newTitle },
      systemMessage,
    });
  } catch (error) {
    console.error("Error updating conversation title:", error.message, error.stack);
    return res.status(500).json({ error: error.message || "Failed to update conversation title" });
  }
});

/**
 * POST /api/v1/messages/mark-messages-read
 * Mark specific messages as read (creates read receipts)
 */
messageRouter.post("/mark-messages-read", authenticateToken, async (req, res) => {
  try {
    const { messageIds } = req.body;
    const userId = req.userId;
    const io = req.app.get("io");

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: "messageIds array is required" });
    }

    // Limit array size to prevent DOS
    const MAX_MESSAGE_IDS = 100;
    if (messageIds.length > MAX_MESSAGE_IDS) {
      return res.status(400).json({ error: `Cannot mark more than ${MAX_MESSAGE_IDS} messages at once` });
    }

    // Validate each messageId is a valid positive integer
    const validMessageIds = messageIds.filter((id) => {
      const num = parseInt(id, 10);
      return !isNaN(num) && num > 0;
    }).map((id) => parseInt(id, 10));

    if (validMessageIds.length === 0) {
      return res.status(400).json({ error: "No valid message IDs provided" });
    }

    // Get messages and verify they exist (exclude deleted messages)
    const messages = await Message.findAll({
      where: {
        id: { [Op.in]: validMessageIds },
        deletedAt: null,
      },
    });

    if (messages.length === 0) {
      return res.status(404).json({ error: "No messages found" });
    }

    // Verify user is participant of at least one of these conversations
    const conversationIds = [...new Set(messages.map((m) => m.conversationId))];
    const participations = await ConversationParticipant.findAll({
      where: { conversationId: { [Op.in]: conversationIds }, userId },
    });

    if (participations.length === 0) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Create read receipts for each message (skip if already exists)
    const readReceipts = [];
    for (const message of messages) {
      // Don't create read receipt for own messages
      if (message.senderId !== userId) {
        const [receipt, created] = await MessageReadReceipt.findOrCreate({
          where: { messageId: message.id, userId },
          defaults: { readAt: new Date() },
        });
        if (created) {
          readReceipts.push(receipt);

          // Emit read receipt to the message sender
          io.to(`user_${message.senderId}`).emit("message_read", {
            messageId: message.id,
            readBy: userId,
            readAt: receipt.readAt,
          });
        }
      }
    }

    return res.json({ success: true, receiptsCreated: readReceipts.length });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return res.status(500).json({ error: "Failed to mark messages as read" });
  }
});

/**
 * POST /api/v1/messages/:messageId/report-suspicious
 * Report a message with suspicious content
 * Creates a report for HR/Owner review and sends notifications
 */
messageRouter.post(
  "/:messageId/report-suspicious",
  authenticateToken,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const reporterId = req.userId;

      // Get the message with conversation and sender info
      const message = await Message.findByPk(messageId, {
        include: [
          {
            model: Conversation,
            as: "conversation",
            include: [{ model: UserAppointments, as: "appointment" }],
          },
          {
            model: User,
            as: "sender",
            attributes: ["id", "username", "firstName", "lastName", "type"],
          },
        ],
      });

      if (!message || message.deletedAt) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Verify the reporter is a participant in this conversation
      const participant = await ConversationParticipant.findOne({
        where: { conversationId: message.conversationId, userId: reporterId },
      });

      if (!participant) {
        return res.status(403).json({ error: "Not authorized to report this message" });
      }

      // Cannot report your own message
      if (message.senderId === reporterId) {
        return res.status(400).json({ error: "Cannot report your own message" });
      }

      // Check if the message is flagged as suspicious
      if (!message.hasSuspiciousContent) {
        return res.status(400).json({
          error: "This message is not flagged as suspicious",
        });
      }

      // Check if this message has already been reported by this user
      const existingReport = await SuspiciousActivityReport.findOne({
        where: { messageId, reporterId },
      });

      if (existingReport) {
        return res.status(409).json({
          error: "You have already reported this message",
          alreadyReported: true,
        });
      }

      // Create the report
      const report = await SuspiciousActivityReport.create({
        messageId: message.id,
        reporterId,
        reportedUserId: message.senderId,
        conversationId: message.conversationId,
        appointmentId: message.conversation?.appointmentId || null,
        suspiciousContentTypes: message.suspiciousContentTypes || [],
        messageContent: message.content,
        status: "pending",
      });

      // Get reporter info for the notification
      const reporter = await User.findByPk(reporterId, {
        attributes: ["id", "username", "firstName", "lastName", "type"],
      });

      // Get owner and HR users to notify
      const staffToNotify = await User.findAll({
        where: {
          type: { [Op.in]: ["owner", "humanResources"] },
        },
        attributes: ["id", "email", "firstName", "lastName", "type", "expoPushToken"],
      });

      // Send email notifications to owner and HR
      const reportedUserName = message.sender
        ? `${message.sender.firstName || ""} ${message.sender.lastName || ""}`.trim() ||
          message.sender.username
        : "Unknown User";

      const reporterName = reporter
        ? `${reporter.firstName || ""} ${reporter.lastName || ""}`.trim() ||
          reporter.username
        : "Unknown User";

      const suspiciousTypes = (message.suspiciousContentTypes || [])
        .map((type) => {
          const labels = {
            phone_number: "Phone Number",
            email: "Email Address",
            off_platform: "Off-Platform Communication",
          };
          return labels[type] || type;
        })
        .join(", ");

      // Get pending count for notifications
      const pendingCount = await SuspiciousActivityReport.count({
        where: { status: "pending" },
      });

      // Send notification emails
      for (const staff of staffToNotify) {
        try {
          const staffEmail = safeDecrypt(staff.email);
          if (!staffEmail) continue; // Skip if email decryption fails

          await Email.sendSuspiciousActivityReport({
            to: staffEmail,
            staffName: safeDecrypt(staff.firstName) || "Team",
            reporterName,
            reportedUserName,
            reportedUserType: message.sender?.type || "unknown",
            messageContent: message.content,
            suspiciousTypes: suspiciousTypes || "Suspicious content",
            appointmentId: message.conversation?.appointmentId,
            reportId: report.id,
          });
        } catch (emailError) {
          console.error(
            `Failed to send suspicious activity email to ${staff.email}:`,
            emailError
          );
        }
      }

      // Send push notifications to HR and Owner
      for (const staff of staffToNotify) {
        if (staff.expoPushToken) {
          try {
            await PushNotification.sendPushSuspiciousActivityReport(
              staff.expoPushToken,
              staff.firstName || "Team",
              reporterName,
              reportedUserName,
              pendingCount
            );
          } catch (pushError) {
            console.error(
              `Failed to send suspicious activity push to ${staff.id}:`,
              pushError
            );
          }
        }
      }

      // Emit socket event to notify staff in real-time
      const io = req.app.get("io");
      for (const staff of staffToNotify) {
        io.to(`user_${staff.id}`).emit("suspicious_activity_report", {
          reportId: report.id,
          reporterName,
          reportedUserName,
          messageContent: message.content,
          suspiciousTypes,
          pendingCount,
        });
      }

      return res.status(201).json({
        success: true,
        message:
          "Report submitted successfully. Our team will review this activity.",
        reportId: report.id,
      });
    } catch (error) {
      console.error("Error reporting suspicious activity:", error);
      return res.status(500).json({ error: "Failed to submit report" });
    }
  }
);

// =====================================
// Business Owner <-> Employee Messaging
// =====================================

const { BusinessEmployee } = require("../../../models");

/**
 * GET /api/v1/messages/business-employees
 * Get list of employees for messaging (business owner only)
 */
messageRouter.get("/business-employees", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId);

    if (!user || !user.isBusinessOwner) {
      return res.status(403).json({ error: "Only business owners can access this endpoint" });
    }

    // Get all active employees for this business owner
    const employees = await BusinessEmployee.findAll({
      where: {
        businessOwnerId: userId,
        status: "active",
        userId: { [Op.ne]: null }, // Only employees who have accepted invite
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "expoPushToken"],
        },
      ],
    });

    const formattedEmployees = employees.map((emp) => ({
      id: emp.id,
      userId: emp.userId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      canMessageClients: emp.canMessageClients,
    }));

    return res.json({ employees: formattedEmployees });
  } catch (error) {
    console.error("Error fetching business employees for messaging:", error);
    return res.status(500).json({ error: "Failed to fetch employees" });
  }
});

/**
 * POST /api/v1/messages/employee-conversation
 * Create or get a 1:1 conversation between business owner and employee
 */
messageRouter.post("/employee-conversation", authenticateToken, async (req, res) => {
  try {
    const { employeeId } = req.body;
    const userId = req.userId;
    const user = await User.findByPk(userId);

    // Validate employeeId if provided
    if (employeeId && !isValidId(employeeId)) {
      return res.status(400).json({ error: "Invalid employee ID" });
    }

    // Check if user is a business owner or an employee
    let businessOwnerId, employeeUserId, employee;

    if (user.isBusinessOwner) {
      // Business owner is initiating
      if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required" });
      }

      employee = await BusinessEmployee.findOne({
        where: {
          id: employeeId,
          businessOwnerId: userId,
          status: "active",
        },
        include: [{ model: User, as: "user" }],
      });

      if (!employee || !employee.userId) {
        return res.status(404).json({ error: "Employee not found or not onboarded" });
      }

      businessOwnerId = userId;
      employeeUserId = employee.userId;
    } else if (user.employeeOfBusinessId) {
      // Employee is initiating - talk to their business owner
      businessOwnerId = user.employeeOfBusinessId;
      employeeUserId = userId;

      employee = await BusinessEmployee.findOne({
        where: {
          userId,
          businessOwnerId,
          status: "active",
        },
      });

      if (!employee) {
        return res.status(404).json({ error: "Employee record not found" });
      }
    } else {
      return res.status(403).json({ error: "Not authorized for employee messaging" });
    }

    // Check if conversation already exists
    const existingConversation = await Conversation.findOne({
      where: {
        conversationType: "business_employee",
        relatedEntityId: employee.id,
      },
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "username"],
            },
          ],
        },
      ],
    });

    if (existingConversation) {
      return res.json({ conversation: existingConversation });
    }

    // Create new conversation
    const businessOwner = await User.findByPk(businessOwnerId);
    const employeeUser = await User.findByPk(employeeUserId);

    const ownerName = businessOwner.firstName && businessOwner.lastName
      ? `${safeDecrypt(businessOwner.firstName)}`
      : businessOwner.username;
    const empName = employee.firstName;
    const conversationTitle = `${ownerName} & ${empName}`.substring(0, 255);

    const conversation = await Conversation.create({
      conversationType: "business_employee",
      title: conversationTitle,
      relatedEntityId: employee.id, // Link to BusinessEmployee record
      createdBy: businessOwnerId,
    });

    // Add participants
    await ConversationParticipant.bulkCreate([
      { conversationId: conversation.id, userId: businessOwnerId, role: "business_owner" },
      { conversationId: conversation.id, userId: employeeUserId, role: "employee" },
    ]);

    // Reload with participants
    const fullConversation = await Conversation.findByPk(conversation.id, {
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "username"],
            },
          ],
        },
      ],
    });

    return res.status(201).json({ conversation: fullConversation });
  } catch (error) {
    console.error("Error creating employee conversation:", error);
    return res.status(500).json({ error: "Failed to create conversation" });
  }
});

/**
 * POST /api/v1/messages/employee-group-conversation
 * Create a group conversation with selected employees (business owner only)
 */
messageRouter.post("/employee-group-conversation", authenticateToken, async (req, res) => {
  try {
    const { employeeIds, title } = req.body;
    const userId = req.userId;

    const user = await User.findByPk(userId);
    if (!user || !user.isBusinessOwner) {
      return res.status(403).json({ error: "Only business owners can create employee group conversations" });
    }

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length < 2) {
      return res.status(400).json({ error: "At least 2 employees are required for a group conversation" });
    }

    // Verify all employees belong to this business owner
    const employees = await BusinessEmployee.findAll({
      where: {
        id: { [Op.in]: employeeIds },
        businessOwnerId: userId,
        status: "active",
        userId: { [Op.ne]: null },
      },
      include: [{ model: User, as: "user" }],
    });

    if (employees.length !== employeeIds.length) {
      return res.status(400).json({ error: "Some employees were not found or are not active" });
    }

    // Get owner name for default title
    const ownerName = user.firstName
      ? safeDecrypt(user.firstName)
      : user.username;

    // Create employee names for default title
    const employeeNames = employees.map((emp) => emp.firstName).join(", ");
    const defaultTitle = `${ownerName} & ${employeeNames}`;

    // Create the group conversation
    const conversation = await Conversation.create({
      conversationType: "employee_group",
      title: title || defaultTitle,
      createdBy: userId,
    });

    // Add business owner as participant
    await ConversationParticipant.create({
      conversationId: conversation.id,
      userId,
      role: "business_owner",
    });

    // Add all employees as participants
    for (const emp of employees) {
      await ConversationParticipant.create({
        conversationId: conversation.id,
        userId: emp.userId,
        role: "employee",
      });
    }

    // Reload with participants
    const fullConversation = await Conversation.findByPk(conversation.id, {
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "username"],
            },
          ],
        },
      ],
    });

    return res.status(201).json({ conversation: fullConversation });
  } catch (error) {
    console.error("Error creating employee group conversation:", error);
    return res.status(500).json({ error: "Failed to create group conversation" });
  }
});

/**
 * POST /api/v1/messages/employee-broadcast
 * Send a broadcast message to all employees (business owner only)
 */
messageRouter.post("/employee-broadcast", authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.userId;
    const io = req.app.get("io");

    const user = await User.findByPk(userId);
    if (!user || !user.isBusinessOwner) {
      return res.status(403).json({ error: "Only business owners can broadcast to employees" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Get all active employees
    const employees = await BusinessEmployee.findAll({
      where: {
        businessOwnerId: userId,
        status: "active",
        userId: { [Op.ne]: null },
      },
      include: [{ model: User, as: "user" }],
    });

    if (employees.length === 0) {
      return res.status(400).json({ error: "No active employees to broadcast to" });
    }

    // Find or create broadcast conversation
    let broadcastConversation = await Conversation.findOne({
      where: {
        conversationType: "employee_broadcast",
        relatedEntityId: userId, // business owner ID
      },
    });

    if (!broadcastConversation) {
      const ownerName = user.firstName
        ? safeDecrypt(user.firstName)
        : user.username;
      const broadcastTitle = `${ownerName}'s Team Announcements`.substring(0, 255);

      broadcastConversation = await Conversation.create({
        conversationType: "employee_broadcast",
        title: broadcastTitle,
        relatedEntityId: userId,
      });

      // Add business owner as participant
      await ConversationParticipant.create({
        conversationId: broadcastConversation.id,
        userId,
        role: "business_owner",
      });
    }

    // Ensure all employees are participants
    for (const emp of employees) {
      const existing = await ConversationParticipant.findOne({
        where: {
          conversationId: broadcastConversation.id,
          userId: emp.userId,
        },
      });

      if (!existing) {
        await ConversationParticipant.create({
          conversationId: broadcastConversation.id,
          userId: emp.userId,
          role: "employee",
        });
      }
    }

    // Create the broadcast message
    const message = await Message.create({
      conversationId: broadcastConversation.id,
      senderId: userId,
      content: content.trim(),
      messageType: "broadcast",
    });

    // Notify all employees
    const senderName = user.firstName && user.lastName
      ? `${safeDecrypt(user.firstName)} ${safeDecrypt(user.lastName)}`
      : user.username;

    for (const emp of employees) {
      // Socket notification
      io.to(`user_${emp.userId}`).emit("new_message", {
        conversationId: broadcastConversation.id,
        message: {
          id: message.id,
          content: message.content,
          senderId: userId,
          senderName,
          messageType: "broadcast",
          createdAt: message.createdAt,
        },
      });

      // Push notification
      if (emp.user?.expoPushToken) {
        await PushNotification.sendPush({
          pushToken: emp.user.expoPushToken,
          title: "Team Announcement",
          body: content.trim().substring(0, 100),
          data: {
            type: "employee_broadcast",
            conversationId: broadcastConversation.id,
            messageId: message.id,
          },
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: "Broadcast sent to all employees",
      messageId: message.id,
      recipientCount: employees.length,
    });
  } catch (error) {
    console.error("Error sending employee broadcast:", error);
    return res.status(500).json({ error: "Failed to send broadcast" });
  }
});

/**
 * POST /api/v1/messages/job-conversation
 * Create or get a job-specific conversation for an assignment
 */
messageRouter.post("/job-conversation", authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.body;
    const userId = req.userId;
    const user = await User.findByPk(userId);

    if (!assignmentId) {
      return res.status(400).json({ error: "Assignment ID is required" });
    }

    // Validate assignmentId
    if (!isValidId(assignmentId)) {
      return res.status(400).json({ error: "Invalid assignment ID" });
    }

    const { EmployeeJobAssignment } = require("../../../models");

    // Find the assignment
    const assignment = await EmployeeJobAssignment.findByPk(assignmentId, {
      include: [
        { model: BusinessEmployee, as: "employee" },
        {
          model: UserAppointments,
          as: "appointment",
          include: [{ model: UserHomes, as: "home" }],
        },
      ],
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // Verify user is either the business owner or the assigned employee
    const isBusinessOwner = user.isBusinessOwner && assignment.businessOwnerId === userId;
    const isEmployee = assignment.employee?.userId === userId;

    if (!isBusinessOwner && !isEmployee) {
      return res.status(403).json({ error: "Not authorized for this job conversation" });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      where: {
        conversationType: "job_chat",
        relatedEntityId: assignmentId,
      },
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "username"],
            },
          ],
        },
        {
          model: Message,
          as: "messages",
          limit: 50,
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: User,
              as: "sender",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        },
      ],
    });

    if (conversation) {
      return res.json({ conversation });
    }

    // Create new job conversation
    const jobDate = assignment.appointment?.date
      ? new Date(assignment.appointment.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";
    const address = assignment.appointment?.home?.address?.split(",")[0] || "Job";

    conversation = await Conversation.create({
      conversationType: "job_chat",
      title: `${address} - ${jobDate}`,
      relatedEntityId: assignmentId,
    });

    // Add participants
    const participants = [
      { conversationId: conversation.id, userId: assignment.businessOwnerId, role: "business_owner" },
    ];

    if (assignment.employee?.userId) {
      participants.push({
        conversationId: conversation.id,
        userId: assignment.employee.userId,
        role: "employee",
      });
    }

    await ConversationParticipant.bulkCreate(participants);

    // Create system message
    await Message.create({
      conversationId: conversation.id,
      senderId: null,
      content: `Job chat created for ${address} on ${jobDate}`,
      messageType: "system",
    });

    // Reload with full data
    const fullConversation = await Conversation.findByPk(conversation.id, {
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "username"],
            },
          ],
        },
        {
          model: Message,
          as: "messages",
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: User,
              as: "sender",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        },
      ],
    });

    return res.status(201).json({ conversation: fullConversation });
  } catch (error) {
    console.error("Error creating job conversation:", error);
    return res.status(500).json({ error: "Failed to create job conversation" });
  }
});

/**
 * GET /api/v1/messages/my-business-conversations
 * Get all business-related conversations for the current user
 */
messageRouter.get("/my-business-conversations", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId);

    if (!user.isBusinessOwner && !user.employeeOfBusinessId) {
      return res.status(403).json({ error: "Not a business owner or employee" });
    }

    // Get all business-related conversations
    const participations = await ConversationParticipant.findAll({
      where: { userId },
      include: [
        {
          model: Conversation,
          as: "conversation",
          where: {
            conversationType: { [Op.in]: ["business_employee", "employee_broadcast", "job_chat"] },
          },
          include: [
            {
              model: Message,
              as: "messages",
              limit: 1,
              order: [["createdAt", "DESC"]],
              include: [
                {
                  model: User,
                  as: "sender",
                  attributes: ["id", "firstName", "lastName"],
                },
              ],
            },
            {
              model: ConversationParticipant,
              as: "participants",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "firstName", "lastName", "username"],
                },
              ],
            },
          ],
        },
      ],
    });

    const conversations = participations
      .map((p) => p.conversation)
      .filter((c) => c !== null)
      .sort((a, b) => {
        const aLastMessage = a.messages?.[0]?.createdAt || a.createdAt;
        const bLastMessage = b.messages?.[0]?.createdAt || b.createdAt;
        return new Date(bLastMessage) - new Date(aLastMessage);
      })
      .map((conv) => {
        // Convert to plain object to allow modification
        const plainConv = conv.toJSON();

        // Decrypt participant names
        if (plainConv.participants) {
          plainConv.participants = plainConv.participants.map((p) => ({
            ...p,
            user: p.user ? decryptUserFields(p.user) : null,
          }));
        }

        // Decrypt sender in last message
        if (plainConv.messages?.[0]?.sender) {
          plainConv.messages[0].sender = decryptUserFields(plainConv.messages[0].sender);
        }

        return plainConv;
      });

    return res.json({ conversations });
  } catch (error) {
    console.error("Error fetching business conversations:", error);
    return res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// =====================================
// Employee <-> Employee Messaging
// =====================================

/**
 * GET /api/v1/messages/coworkers
 * Get list of coworkers (other employees of the same business) for messaging
 */
messageRouter.get("/coworkers", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId);

    if (!user || !user.employeeOfBusinessId) {
      return res.status(403).json({ error: "Only business employees can access this endpoint" });
    }

    // Get all active employees of the same business (excluding self)
    const coworkers = await BusinessEmployee.findAll({
      where: {
        businessOwnerId: user.employeeOfBusinessId,
        status: "active",
        userId: {
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.ne]: userId }
          ]
        },
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "expoPushToken"],
        },
      ],
    });

    const formattedCoworkers = coworkers.map((emp) => ({
      id: emp.id,
      userId: emp.userId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      status: emp.status,
    }));

    return res.json({ coworkers: formattedCoworkers });
  } catch (error) {
    console.error("Error fetching coworkers for messaging:", error);
    return res.status(500).json({ error: "Failed to fetch coworkers" });
  }
});

/**
 * POST /api/v1/messages/coworker-conversation
 * Create or get a 1:1 conversation between two employees
 */
messageRouter.post("/coworker-conversation", authenticateToken, async (req, res) => {
  try {
    const { coworkerId } = req.body;
    const userId = req.userId;
    const user = await User.findByPk(userId);

    if (!user || !user.employeeOfBusinessId) {
      return res.status(403).json({ error: "Only business employees can message coworkers" });
    }

    if (!coworkerId) {
      return res.status(400).json({ error: "Coworker ID is required" });
    }

    // Get my employee record
    const myEmployee = await BusinessEmployee.findOne({
      where: {
        userId,
        businessOwnerId: user.employeeOfBusinessId,
        status: "active",
      },
    });

    if (!myEmployee) {
      return res.status(404).json({ error: "Your employee record not found" });
    }

    // Get coworker record
    const coworker = await BusinessEmployee.findOne({
      where: {
        id: coworkerId,
        businessOwnerId: user.employeeOfBusinessId,
        status: "active",
        userId: { [Op.ne]: null },
      },
      include: [{ model: User, as: "user" }],
    });

    if (!coworker || !coworker.userId) {
      return res.status(404).json({ error: "Coworker not found" });
    }

    // Generate a unique entity ID for this pair (smaller id first for consistency)
    const sortedIds = [myEmployee.id, coworker.id].sort((a, b) => a - b);
    const pairKey = `emp_${sortedIds[0]}_${sortedIds[1]}`;

    // Check if conversation already exists
    const existingConversation = await Conversation.findOne({
      where: {
        conversationType: "employee_peer",
        title: pairKey,
      },
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "username"],
            },
          ],
        },
        {
          model: Message,
          as: "messages",
          limit: 1,
          order: [["createdAt", "DESC"]],
        },
      ],
    });

    if (existingConversation) {
      // Decrypt user names in participants
      const decryptedConversation = {
        ...existingConversation.toJSON(),
        participants: existingConversation.participants.map((p) => ({
          ...p.toJSON(),
          user: decryptUserFields(p.user),
        })),
      };
      return res.json({ conversation: decryptedConversation });
    }

    // Create new conversation
    const displayTitle = `${myEmployee.firstName} & ${coworker.firstName}`;

    const conversation = await Conversation.create({
      conversationType: "employee_peer",
      title: pairKey, // Use pair key for lookups
    });

    // Add participants
    await ConversationParticipant.bulkCreate([
      { conversationId: conversation.id, userId: userId, role: "employee", businessEmployeeId: myEmployee.id },
      { conversationId: conversation.id, userId: coworker.userId, role: "employee", businessEmployeeId: coworker.id },
    ]);

    // Reload with participants
    const fullConversation = await Conversation.findByPk(conversation.id, {
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "username"],
            },
          ],
        },
      ],
    });

    // Decrypt user names
    const decryptedConversation = {
      ...fullConversation.toJSON(),
      displayTitle,
      participants: fullConversation.participants.map((p) => ({
        ...p.toJSON(),
        user: decryptUserFields(p.user),
      })),
    };

    return res.status(201).json({ conversation: decryptedConversation });
  } catch (error) {
    console.error("Error creating coworker conversation:", error);
    return res.status(500).json({ error: "Failed to create conversation" });
  }
});

/**
 * GET /api/v1/messages/my-coworker-conversations
 * Get all employee-to-employee conversations for the current employee
 */
messageRouter.get("/my-coworker-conversations", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId);

    if (!user || !user.employeeOfBusinessId) {
      return res.status(403).json({ error: "Only business employees can access this endpoint" });
    }

    // Find all conversations where user is a participant and type is employee_peer or business_employee
    const participations = await ConversationParticipant.findAll({
      where: { userId },
      include: [
        {
          model: Conversation,
          as: "conversation",
          where: {
            conversationType: { [Op.in]: ["employee_peer", "business_employee"] },
          },
          include: [
            {
              model: Message,
              as: "messages",
              limit: 1,
              order: [["createdAt", "DESC"]],
              include: [
                {
                  model: User,
                  as: "sender",
                  attributes: ["id", "firstName", "lastName"],
                },
              ],
            },
            {
              model: ConversationParticipant,
              as: "participants",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "firstName", "lastName", "username", "isBusinessOwner"],
                },
                {
                  model: BusinessEmployee,
                  as: "businessEmployee",
                  attributes: ["id", "firstName", "lastName"],
                },
              ],
            },
          ],
        },
      ],
      order: [[{ model: Conversation, as: "conversation" }, "updatedAt", "DESC"]],
    });

    // Calculate unread counts and format
    const conversations = await Promise.all(
      participations.map(async (p) => {
        const conv = p.conversation;
        if (!conv) return null;

        const unreadCount = await Message.count({
          where: {
            conversationId: conv.id,
            createdAt: { [Op.gt]: p.lastReadAt || new Date(0) },
            senderId: { [Op.ne]: userId },
          },
        });

        // Format participants with decrypted names
        const formattedParticipants = conv.participants.map((part) => {
          const isBusinessOwner = part.user?.isBusinessOwner;
          return {
            ...part.toJSON(),
            user: decryptUserFields(part.user),
            displayName: isBusinessOwner
              ? (part.user?.firstName ? safeDecrypt(part.user.firstName) : "Business Owner")
              : (part.businessEmployee?.firstName || "Employee"),
          };
        });

        // Get the other participant's name for display
        const otherParticipant = formattedParticipants.find((part) => part.userId !== userId);
        const displayTitle = otherParticipant?.displayName || "Conversation";

        return {
          ...conv.toJSON(),
          displayTitle,
          participants: formattedParticipants,
          unreadCount,
          messages: conv.messages?.map((m) => ({
            ...m.toJSON(),
            sender: decryptUserFields(m.sender),
          })),
        };
      })
    );

    return res.json({ conversations: conversations.filter(Boolean) });
  } catch (error) {
    console.error("Error fetching coworker conversations:", error);
    return res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

module.exports = messageRouter;
