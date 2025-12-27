/**
 * HR Dashboard Router
 * Provides dispute management and support conversation access for HR staff
 * HR has same access as owner for disputes and support, but NOT financial data
 */

const express = require("express");
const { Op } = require("sequelize");
const {
  User,
  UserAppointments,
  UserHomes,
  Message,
  Conversation,
  ConversationParticipant,
  HomeSizeAdjustmentRequest,
  HomeSizeAdjustmentPhoto,
} = require("../../../models");
const verifyHROrOwner = require("../../../middleware/verifyHROrOwner");

const hrDashboardRouter = express.Router();

/**
 * GET /disputes/pending
 * Get all disputes that need HR attention
 */
hrDashboardRouter.get("/disputes/pending", verifyHROrOwner, async (req, res) => {
  try {
    const requests = await HomeSizeAdjustmentRequest.findAll({
      where: {
        status: {
          [Op.in]: ["pending_owner", "expired", "denied"],
        },
      },
      include: [
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "address", "city", "state", "zipcode", "nickName"],
        },
        {
          model: UserAppointments,
          as: "appointment",
          attributes: ["id", "date", "price"],
        },
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "username", "firstName", "lastName", "ownerPrivateNotes", "falseClaimCount"],
        },
        {
          model: User,
          as: "homeowner",
          attributes: ["id", "username", "firstName", "lastName", "ownerPrivateNotes", "falseHomeSizeCount"],
        },
        {
          model: HomeSizeAdjustmentPhoto,
          as: "photos",
          attributes: ["id", "roomType", "roomNumber", "photoUrl", "createdAt"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({ disputes: requests });
  } catch (error) {
    console.error("Error fetching pending disputes:", error);
    return res.status(500).json({ error: "Failed to fetch pending disputes" });
  }
});

/**
 * GET /disputes/:id
 * Get a specific dispute with full details
 */
hrDashboardRouter.get("/disputes/:id", verifyHROrOwner, async (req, res) => {
  const { id } = req.params;

  try {
    const request = await HomeSizeAdjustmentRequest.findByPk(id, {
      include: [
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "address", "city", "state", "zipcode", "nickName", "numBeds", "numBaths", "numHalfBaths"],
        },
        {
          model: UserAppointments,
          as: "appointment",
          attributes: ["id", "date", "price"],
        },
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "username", "firstName", "lastName", "ownerPrivateNotes", "falseClaimCount"],
        },
        {
          model: User,
          as: "homeowner",
          attributes: ["id", "username", "firstName", "lastName", "ownerPrivateNotes", "falseHomeSizeCount"],
        },
        {
          model: HomeSizeAdjustmentPhoto,
          as: "photos",
          attributes: ["id", "roomType", "roomNumber", "photoUrl", "createdAt"],
        },
      ],
    });

    if (!request) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    return res.json({ dispute: request });
  } catch (error) {
    console.error("Error fetching dispute:", error);
    return res.status(500).json({ error: "Failed to fetch dispute" });
  }
});

/**
 * GET /support-conversations
 * Get all support conversations for HR dashboard
 */
hrDashboardRouter.get("/support-conversations", verifyHROrOwner, async (req, res) => {
  try {
    const conversations = await Conversation.findAll({
      where: { conversationType: "support" },
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
              attributes: ["id", "firstName", "lastName", "type"],
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
              attributes: ["id", "firstName", "lastName", "type"],
            },
          ],
        },
      ],
      order: [["updatedAt", "DESC"]],
    });

    // Format for frontend
    const formattedConversations = conversations.map((conv) => {
      // Find the customer (non-owner, non-HR participant)
      const customer = conv.participants?.find(
        (p) => p.user && p.user.type !== "owner" && p.user.type !== "humanResources"
      );

      return {
        id: conv.id,
        title: conv.title,
        updatedAt: conv.updatedAt,
        createdAt: conv.createdAt,
        lastMessage: conv.messages?.[0]?.content?.substring(0, 100),
        lastMessageAt: conv.messages?.[0]?.createdAt,
        lastMessageSender: conv.messages?.[0]?.sender
          ? `${conv.messages[0].sender.firstName} ${conv.messages[0].sender.lastName}`
          : null,
        customer: customer?.user
          ? {
              id: customer.user.id,
              name: `${customer.user.firstName} ${customer.user.lastName}`,
              type: customer.user.type,
            }
          : null,
      };
    });

    return res.json({ conversations: formattedConversations });
  } catch (error) {
    console.error("Error fetching support conversations:", error);
    return res.status(500).json({ error: "Failed to fetch support conversations" });
  }
});

/**
 * GET /quick-stats
 * Get quick overview stats for HR dashboard
 */
hrDashboardRouter.get("/quick-stats", verifyHROrOwner, async (req, res) => {
  try {
    // Count pending disputes
    const pendingDisputes = await HomeSizeAdjustmentRequest.count({
      where: {
        status: {
          [Op.in]: ["pending_owner", "expired", "denied"],
        },
      },
    });

    // Count support conversations
    const supportConversations = await Conversation.count({
      where: { conversationType: "support" },
    });

    // Get disputes resolved this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const disputesResolvedThisWeek = await HomeSizeAdjustmentRequest.count({
      where: {
        status: {
          [Op.in]: ["owner_approved", "owner_denied"],
        },
        ownerResolvedAt: {
          [Op.gte]: weekStart,
        },
      },
    });

    return res.json({
      pendingDisputes,
      supportConversations,
      disputesResolvedThisWeek,
    });
  } catch (error) {
    console.error("Error fetching quick stats:", error);
    return res.status(500).json({ error: "Failed to fetch quick stats" });
  }
});

module.exports = hrDashboardRouter;
