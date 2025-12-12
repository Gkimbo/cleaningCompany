const express = require("express");
const { Op } = require("sequelize");
const authenticateToken = require("../../../middleware/authenticatedToken");
const {
  User,
  Message,
  Conversation,
  ConversationParticipant,
  UserAppointments,
} = require("../../../models");
const Email = require("../../../services/sendNotifications/EmailClass");

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
                  attributes: ["id", "username"],
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
                  attributes: ["id", "username", "type"],
                },
              ],
            },
          ],
        },
      ],
      order: [[{ model: Conversation, as: "conversation" }, "updatedAt", "DESC"]],
    });

    // Calculate unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      participations.map(async (p) => {
        const unreadCount = await Message.count({
          where: {
            conversationId: p.conversationId,
            createdAt: { [Op.gt]: p.lastReadAt || new Date(0) },
            senderId: { [Op.ne]: userId },
          },
        });
        return {
          ...p.toJSON(),
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

    // Verify user is a participant
    const participant = await ConversationParticipant.findOne({
      where: { conversationId, userId },
    });

    if (!participant) {
      return res.status(403).json({ error: "Not authorized to view this conversation" });
    }

    const messages = await Message.findAll({
      where: { conversationId },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "username", "type"],
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
              attributes: ["id", "username", "type"],
            },
          ],
        },
      ],
    });

    return res.json({ messages, conversation });
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

    // Create the message
    const message = await Message.create({
      conversationId,
      senderId,
      content: content.trim(),
      messageType: "text",
    });

    // Get message with sender info
    const messageWithSender = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "username", "type"],
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

    for (const p of otherParticipants) {
      // Emit to user's personal room for unread count update
      io.to(`user_${p.userId}`).emit("unread_update", { conversationId });

      // Send email notification if user has email notifications enabled
      if (p.user.notifications && p.user.notifications.includes("email")) {
        await Email.sendNewMessageNotification(
          p.user.email,
          p.user.username,
          sender.username,
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
              attributes: ["id", "username", "type"],
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

      // Add manager as participant (find by type or username pattern)
      const manager = await User.findOne({
        where: {
          [Op.or]: [
            { username: "manager1" },
            { type: "manager" },
          ],
        },
      });
      if (manager && manager.id !== appointment.userId) {
        await ConversationParticipant.findOrCreate({
          where: {
            conversationId: conversation.id,
            userId: manager.id,
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
                attributes: ["id", "username", "type"],
              },
            ],
          },
        ],
      });
    }

    return res.json({ conversation });
  } catch (error) {
    console.error("Error creating/getting appointment conversation:", error);
    return res.status(500).json({ error: "Failed to create conversation" });
  }
});

/**
 * POST /api/v1/messages/broadcast
 * Manager-only: Send a broadcast message to all cleaners, homeowners, or everyone
 */
messageRouter.post("/broadcast", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { content, targetAudience, title } = req.body;
    // targetAudience: "all", "cleaners", "homeowners"

    // Verify user is a manager
    const user = await User.findByPk(userId);
    if (!user || (user.username !== "manager1" && user.type !== "manager")) {
      return res.status(403).json({ error: "Only managers can send broadcasts" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Broadcast content is required" });
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
      targetUsers = await User.findAll({
        where: {
          type: { [Op.or]: [null, { [Op.ne]: "cleaner" }] },
          username: { [Op.ne]: "manager1" },
        },
      });
    } else {
      // "all" - everyone except the manager sending it
      targetUsers = await User.findAll({
        where: { id: { [Op.ne]: userId } },
      });
    }

    // Add manager as participant
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
          attributes: ["id", "username", "type"],
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
        await Email.sendBroadcastNotification(
          targetUser.email,
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
 * Create or get a support conversation with the manager
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

    // Don't allow managers to create support conversations with themselves
    if (user.username === "manager1" || user.type === "manager") {
      return res.status(400).json({ error: "Managers cannot create support conversations" });
    }

    // Find the manager
    const manager = await User.findOne({
      where: {
        [Op.or]: [
          { username: "manager1" },
          { type: "manager" },
        ],
      },
    });

    if (!manager) {
      return res.status(404).json({ error: "No manager available" });
    }

    // Check if a support conversation already exists between this user and manager
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
              where: { userId: manager.id },
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
                attributes: ["id", "username", "type"],
              },
            ],
          },
        ],
      });
    } else {
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

      // Add manager as participant
      await ConversationParticipant.create({
        conversationId: conversation.id,
        userId: manager.id,
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
                attributes: ["id", "username", "type"],
              },
            ],
          },
        ],
      });

      // Notify manager of new support conversation
      const io = req.app.get("io");
      io.to(`user_${manager.id}`).emit("new_support_conversation", {
        conversation,
        user: { id: user.id, username: user.username, type: user.type },
      });

      // Send email notification to manager
      if (manager.email) {
        await Email.sendNewMessageNotification(
          manager.email,
          manager.username,
          user.username,
          `New support request from ${user.username}`
        );
      }
    }

    return res.json({ conversation });
  } catch (error) {
    console.error("Error creating/getting support conversation:", error);
    return res.status(500).json({ error: "Failed to create support conversation" });
  }
});

/**
 * POST /api/v1/messages/add-participant
 * Add a participant to an existing conversation (e.g., when cleaner is assigned)
 */
messageRouter.post("/add-participant", authenticateToken, async (req, res) => {
  try {
    const { conversationId, userIdToAdd } = req.body;
    const requesterId = req.userId;

    // Verify requester is a participant
    const requesterParticipant = await ConversationParticipant.findOne({
      where: { conversationId, userId: requesterId },
    });

    if (!requesterParticipant) {
      return res.status(403).json({ error: "Not authorized" });
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

module.exports = messageRouter;
