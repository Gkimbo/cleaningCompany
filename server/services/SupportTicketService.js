/**
 * SupportTicketService
 *
 * Service for creating and managing support tickets.
 * Supports linking tickets to support conversations.
 */

const EncryptionService = require("./EncryptionService");

// Helper to format decrypted user name
const formatUserName = (user) => {
  if (!user) return null;
  const firstName = user.firstName ? EncryptionService.decrypt(user.firstName) : "";
  const lastName = user.lastName ? EncryptionService.decrypt(user.lastName) : "";
  return `${firstName} ${lastName}`.trim() || null;
};

class SupportTicketService {
  /**
   * Create a support ticket from a support conversation
   */
  static async createFromConversation(conversationId, ticketData, reporterId) {
    const {
      SupportTicket,
      Conversation,
      ConversationParticipant,
      User,
    } = require("../models");

    // Validate conversation exists and is a support type
    const conversation = await Conversation.findByPk(conversationId, {
      include: [
        {
          model: ConversationParticipant,
          as: "participants",
          include: [{ model: User, as: "user", attributes: ["id", "type", "firstName", "lastName"] }],
        },
      ],
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.conversationType !== "support") {
      throw new Error("Can only create tickets from support conversations");
    }

    // Validate reporter is HR or owner
    const reporter = await User.findByPk(reporterId);
    if (!reporter || !["owner", "humanResources"].includes(reporter.type)) {
      throw new Error("Only HR or owners can create support tickets");
    }

    // Auto-detect subject user from conversation (non-HR/owner participant)
    let subjectUserId = ticketData.subjectUserId;
    let subjectType = ticketData.subjectType;

    if (!subjectUserId && conversation.participants) {
      const subjectParticipant = conversation.participants.find(
        (p) => p.user && !["owner", "humanResources"].includes(p.user.type)
      );
      if (subjectParticipant) {
        subjectUserId = subjectParticipant.userId;
        subjectType = subjectParticipant.user.type === "cleaner" ? "cleaner" : "homeowner";
      }
    }

    // Calculate SLA deadline based on priority (48 hours default, 24 for high/urgent)
    const slaDeadline = new Date();
    if (ticketData.priority === "urgent") {
      slaDeadline.setHours(slaDeadline.getHours() + 12);
    } else if (ticketData.priority === "high") {
      slaDeadline.setHours(slaDeadline.getHours() + 24);
    } else {
      slaDeadline.setHours(slaDeadline.getHours() + 48);
    }

    // Create the ticket
    const ticket = await SupportTicket.create({
      conversationId,
      reporterId,
      subjectUserId: subjectUserId || null,
      subjectType: subjectType || "general",
      category: ticketData.category,
      description: ticketData.description,
      status: "submitted",
      priority: ticketData.priority || "normal",
      slaDeadline,
      submittedAt: new Date(),
    });

    return ticket;
  }

  /**
   * Create a support ticket directly (without conversation link)
   */
  static async createDirect(ticketData, reporterId) {
    const { SupportTicket, User } = require("../models");

    // Validate reporter is HR or owner
    const reporter = await User.findByPk(reporterId);
    if (!reporter || !["owner", "humanResources"].includes(reporter.type)) {
      throw new Error("Only HR or owners can create support tickets");
    }

    // Validate subject user if provided
    if (ticketData.subjectUserId) {
      const subject = await User.findByPk(ticketData.subjectUserId);
      if (!subject) {
        throw new Error("Subject user not found");
      }
    }

    // Calculate SLA deadline based on priority
    const slaDeadline = new Date();
    if (ticketData.priority === "urgent") {
      slaDeadline.setHours(slaDeadline.getHours() + 12);
    } else if (ticketData.priority === "high") {
      slaDeadline.setHours(slaDeadline.getHours() + 24);
    } else {
      slaDeadline.setHours(slaDeadline.getHours() + 48);
    }

    // Create the ticket
    const ticket = await SupportTicket.create({
      conversationId: null,
      reporterId,
      subjectUserId: ticketData.subjectUserId || null,
      subjectType: ticketData.subjectType || "general",
      category: ticketData.category,
      description: ticketData.description,
      status: "submitted",
      priority: ticketData.priority || "normal",
      slaDeadline,
      submittedAt: new Date(),
    });

    return ticket;
  }

  /**
   * Get messages from linked support conversation
   */
  static async getLinkedMessages(ticketId) {
    const { SupportTicket, Message, User } = require("../models");

    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket) {
      throw new Error("Support ticket not found");
    }

    if (!ticket.conversationId) {
      return { messages: [], hasConversation: false };
    }

    const messages = await Message.findAll({
      where: { conversationId: ticket.conversationId },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "firstName", "lastName", "type"],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    return {
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        messageType: m.messageType,
        createdAt: m.createdAt?.toISOString() || null,
        sender: m.sender
          ? {
              id: m.sender.id,
              name: formatUserName(m.sender),
              type: m.sender.type,
            }
          : null,
      })),
      hasConversation: true,
      conversationId: ticket.conversationId,
    };
  }

  /**
   * Resolve a support ticket
   */
  static async resolve(ticketId, decision, notes, reviewerId) {
    const { SupportTicket } = require("../models");

    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket) {
      throw new Error("Support ticket not found");
    }

    const status = decision === "resolved" ? "resolved" : "closed";

    await ticket.update({
      status,
      resolution: { decision, notes },
      resolutionNotes: notes,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      closedAt: new Date(),
    });

    return ticket;
  }
}

module.exports = SupportTicketService;
