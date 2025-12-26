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
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");

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

      // Send push notification if user has phone notifications enabled
      if (p.user.notifications && p.user.notifications.includes("phone") && p.user.expoPushToken) {
        await PushNotification.sendPushNewMessage(
          p.user.expoPushToken,
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
          type: { [Op.ne]: "owner" },
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
                attributes: ["id", "username", "type"],
              },
            ],
          },
        ],
      });

      // Notify all support staff of new support conversation
      const io = req.app.get("io");
      for (const staff of supportStaff) {
        io.to(`user_${staff.id}`).emit("new_support_conversation", {
          conversation,
          user: { id: user.id, username: user.username, type: user.type },
        });

        // Send email notification
        if (staff.email) {
          await Email.sendNewMessageNotification(
            staff.email,
            staff.username,
            user.username,
            `New support request from ${user.username}`
          );
        }

        // Send push notification
        if (staff.expoPushToken) {
          await PushNotification.sendPushNewMessage(
            staff.expoPushToken,
            staff.username,
            user.username,
            `New support request from ${user.username}`
          );
        }
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
      const title = `Direct - ${otherName}`;

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
          .map((part) => ({
            id: part.user.id,
            username: part.user.username,
            firstName: part.user.firstName,
            lastName: part.user.lastName,
            type: part.user.type,
            displayName: `${part.user.firstName || ""} ${part.user.lastName || ""}`.trim() || part.user.username,
          }));

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
                sender: {
                  ...lastMessage.sender.dataValues || lastMessage.sender,
                  displayName: `${lastMessage.sender.firstName || ""} ${lastMessage.sender.lastName || ""}`.trim() || lastMessage.sender.username,
                },
                createdAt: lastMessage.createdAt,
              }
            : null,
          unreadCount,
          participants: conv.participants.map((part) => ({
            ...part.user.dataValues || part.user,
            displayName: `${part.user.firstName || ""} ${part.user.lastName || ""}`.trim() || part.user.username,
          })),
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

module.exports = messageRouter;
