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
  CancellationAppeal,
} = require("../../../models");
const verifyHROrOwner = require("../../../middleware/verifyHROrOwner");
const EncryptionService = require("../../../services/EncryptionService");
const HomeSizeAdjustmentSerializer = require("../../../serializers/HomeSizeAdjustmentSerializer");

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

    // Serialize with decryption
    const disputes = HomeSizeAdjustmentSerializer.serializeArray(requests);

    return res.json({ disputes });
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

    // Serialize with decryption
    const dispute = HomeSizeAdjustmentSerializer.serializeOne(request);

    return res.json({ dispute });
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
          ? `${EncryptionService.decrypt(conv.messages[0].sender.firstName)} ${EncryptionService.decrypt(conv.messages[0].sender.lastName)}`
          : null,
        customer: customer?.user
          ? {
              id: customer.user.id,
              name: `${EncryptionService.decrypt(customer.user.firstName)} ${EncryptionService.decrypt(customer.user.lastName)}`,
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

    // Count pending appeals
    let pendingAppeals = 0;
    let slaBreachCount = 0;
    try {
      pendingAppeals = await CancellationAppeal.count({
        where: {
          status: {
            [Op.in]: ["submitted", "under_review", "awaiting_documents"],
          },
        },
      });

      // Count appeals past SLA deadline
      slaBreachCount = await CancellationAppeal.count({
        where: {
          status: {
            [Op.in]: ["submitted", "under_review", "awaiting_documents"],
          },
          slaDeadline: {
            [Op.lt]: new Date(),
          },
        },
      });
    } catch (appealError) {
      // CancellationAppeal table may not exist yet
      console.log("Appeals table not available yet:", appealError.message);
    }

    return res.json({
      pendingDisputes,
      supportConversations,
      disputesResolvedThisWeek,
      pendingAppeals,
      slaBreachCount,
    });
  } catch (error) {
    console.error("Error fetching quick stats:", error);
    return res.status(500).json({ error: "Failed to fetch quick stats" });
  }
});

// ============================================================================
// APPEAL MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /appeals/overview
 * Get appeal dashboard overview stats
 */
hrDashboardRouter.get("/appeals/overview", verifyHROrOwner, async (req, res) => {
  try {
    const now = new Date();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    // Get counts by status
    const statusCounts = await CancellationAppeal.findAll({
      attributes: [
        "status",
        [require("sequelize").fn("COUNT", require("sequelize").col("id")), "count"],
      ],
      group: ["status"],
      raw: true,
    });

    // Get counts by priority for pending appeals
    const priorityCounts = await CancellationAppeal.findAll({
      where: {
        status: {
          [Op.in]: ["submitted", "under_review", "awaiting_documents"],
        },
      },
      attributes: [
        "priority",
        [require("sequelize").fn("COUNT", require("sequelize").col("id")), "count"],
      ],
      group: ["priority"],
      raw: true,
    });

    // Get SLA breach count
    const slaBreachCount = await CancellationAppeal.count({
      where: {
        status: {
          [Op.in]: ["submitted", "under_review", "awaiting_documents"],
        },
        slaDeadline: {
          [Op.lt]: now,
        },
      },
    });

    // Get appeals resolved this week
    const appealsResolvedThisWeek = await CancellationAppeal.count({
      where: {
        status: {
          [Op.in]: ["approved", "partially_approved", "denied"],
        },
        closedAt: {
          [Op.gte]: weekStart,
        },
      },
    });

    // Get appeals submitted this week
    const appealsSubmittedThisWeek = await CancellationAppeal.count({
      where: {
        submittedAt: {
          [Op.gte]: weekStart,
        },
      },
    });

    // Get average resolution time (for appeals closed this month)
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const closedAppeals = await CancellationAppeal.findAll({
      where: {
        status: {
          [Op.in]: ["approved", "partially_approved", "denied"],
        },
        closedAt: {
          [Op.gte]: monthStart,
        },
      },
      attributes: ["submittedAt", "closedAt"],
      raw: true,
    });

    let avgResolutionHours = null;
    if (closedAppeals.length > 0) {
      const totalHours = closedAppeals.reduce((sum, appeal) => {
        const submitted = new Date(appeal.submittedAt);
        const closed = new Date(appeal.closedAt);
        return sum + (closed - submitted) / (1000 * 60 * 60);
      }, 0);
      avgResolutionHours = Math.round(totalHours / closedAppeals.length);
    }

    return res.json({
      statusCounts: statusCounts.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      priorityCounts: priorityCounts.reduce((acc, row) => {
        acc[row.priority] = parseInt(row.count);
        return acc;
      }, {}),
      slaBreachCount,
      appealsResolvedThisWeek,
      appealsSubmittedThisWeek,
      avgResolutionHours,
    });
  } catch (error) {
    console.error("Error fetching appeal overview:", error);
    return res.status(500).json({ error: "Failed to fetch appeal overview" });
  }
});

/**
 * GET /appeals/sla-summary
 * Get SLA status summary for appeals
 */
hrDashboardRouter.get("/appeals/sla-summary", verifyHROrOwner, async (req, res) => {
  try {
    const now = new Date();

    // Get pending appeals with SLA info
    const pendingAppeals = await CancellationAppeal.findAll({
      where: {
        status: {
          [Op.in]: ["submitted", "under_review", "awaiting_documents"],
        },
      },
      attributes: ["id", "status", "priority", "slaDeadline", "submittedAt", "assignedTo"],
      order: [["slaDeadline", "ASC"]],
      raw: true,
    });

    // Categorize by SLA status
    const breached = [];
    const dueWithin4Hours = [];
    const dueWithin24Hours = [];
    const onTrack = [];

    const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    pendingAppeals.forEach(appeal => {
      const deadline = new Date(appeal.slaDeadline);
      if (deadline < now) {
        breached.push(appeal);
      } else if (deadline < fourHoursFromNow) {
        dueWithin4Hours.push(appeal);
      } else if (deadline < twentyFourHoursFromNow) {
        dueWithin24Hours.push(appeal);
      } else {
        onTrack.push(appeal);
      }
    });

    return res.json({
      total: pendingAppeals.length,
      breached: {
        count: breached.length,
        appeals: breached,
      },
      dueWithin4Hours: {
        count: dueWithin4Hours.length,
        appeals: dueWithin4Hours,
      },
      dueWithin24Hours: {
        count: dueWithin24Hours.length,
        appeals: dueWithin24Hours,
      },
      onTrack: {
        count: onTrack.length,
        appeals: onTrack,
      },
    });
  } catch (error) {
    console.error("Error fetching SLA summary:", error);
    return res.status(500).json({ error: "Failed to fetch SLA summary" });
  }
});

/**
 * GET /appeals/my-assigned
 * Get appeals assigned to the current HR user
 */
hrDashboardRouter.get("/appeals/my-assigned", verifyHROrOwner, async (req, res) => {
  try {
    const userId = req.user.id;

    const appeals = await CancellationAppeal.findAll({
      where: {
        assignedTo: userId,
        status: {
          [Op.in]: ["submitted", "under_review", "awaiting_documents"],
        },
      },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          attributes: ["id", "date", "price"],
        },
        {
          model: User,
          as: "appealer",
          attributes: ["id", "username", "firstName", "lastName"],
        },
      ],
      order: [["slaDeadline", "ASC"]],
    });

    return res.json({ appeals });
  } catch (error) {
    console.error("Error fetching assigned appeals:", error);
    return res.status(500).json({ error: "Failed to fetch assigned appeals" });
  }
});

module.exports = hrDashboardRouter;
