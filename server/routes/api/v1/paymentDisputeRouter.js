const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const {
  User,
  UserAppointments,
  Payout,
  PaymentDispute,
} = require("../../../models");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");

const paymentDisputeRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Middleware to verify token and extract user
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    }
    return res.status(403).json({ error: "Invalid token" });
  }
};

/**
 * POST /
 * Cleaner submits a payment dispute
 */
paymentDisputeRouter.post("/", authenticateToken, async (req, res) => {
  const {
    appointmentId,
    payoutId,
    issueType,
    expectedAmount,
    receivedAmount,
    description,
  } = req.body;
  const cleanerId = req.user.userId;

  try {
    // Validate required fields
    if (!appointmentId || !issueType || !description) {
      return res.status(400).json({
        error: "Appointment ID, issue type, and description are required",
      });
    }

    // Validate issue type
    const validIssueTypes = ["missing_payout", "wrong_amount", "delayed_payout"];
    if (!validIssueTypes.includes(issueType)) {
      return res.status(400).json({
        error: `Invalid issue type. Must be one of: ${validIssueTypes.join(", ")}`,
      });
    }

    // Get the appointment to verify it exists and belongs to this cleaner
    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify cleaner is assigned to this appointment
    const employeesAssigned = appointment.employeesAssigned || [];
    if (!employeesAssigned.includes(String(cleanerId))) {
      return res.status(403).json({
        error: "You are not assigned to this appointment",
      });
    }

    // Check if there's already an open dispute for this appointment
    const existingDispute = await PaymentDispute.findOne({
      where: {
        appointmentId,
        cleanerId,
        status: { [Op.in]: ["submitted", "under_review"] },
      },
    });

    if (existingDispute) {
      return res.status(400).json({
        error: "You already have an open dispute for this appointment",
        existingDisputeId: existingDispute.id,
      });
    }

    // If payoutId provided, verify it exists
    let payout = null;
    if (payoutId) {
      payout = await Payout.findByPk(payoutId);
      if (!payout) {
        return res.status(404).json({ error: "Payout not found" });
      }
      if (payout.cleanerId !== cleanerId) {
        return res.status(403).json({ error: "This payout does not belong to you" });
      }
    }

    // Calculate SLA deadline (48 hours from now)
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + 48);

    // Determine priority based on issue type and amount
    let priority = "normal";
    if (issueType === "missing_payout") {
      priority = "high";
    } else if (expectedAmount && expectedAmount > 10000) {
      // > $100
      priority = "high";
    }

    // Create the dispute
    const dispute = await PaymentDispute.create({
      appointmentId,
      payoutId: payoutId || null,
      cleanerId,
      issueType,
      expectedAmount: expectedAmount || null,
      receivedAmount: receivedAmount || (payout ? payout.netAmount : null),
      description,
      status: "submitted",
      priority,
      slaDeadline,
      submittedAt: new Date(),
    });

    // Get cleaner info for notifications
    const cleaner = await User.findByPk(cleanerId, {
      attributes: ["id", "firstName", "lastName", "username"],
    });

    // Notify owners and HR about the dispute
    const ownersAndHR = await User.findAll({
      where: {
        type: "owner",
        role: { [Op.in]: ["owner", "hr"] },
      },
    });

    for (const staff of ownersAndHR) {
      try {
        // Send email notification
        if (staff.notifications?.includes("email") && staff.email) {
          await Email.sendPaymentDisputeNotification(
            staff.email,
            staff.firstName || staff.username,
            dispute,
            cleaner,
            appointment
          );
        }

        // Send push notification
        if (staff.notifications?.includes("phone") && staff.expoPushToken) {
          await PushNotification.sendPushPaymentDispute(
            staff.expoPushToken,
            staff.firstName || staff.username,
            cleaner.firstName || cleaner.username,
            issueType,
            priority,
            dispute.id
          );
        }
      } catch (notifError) {
        console.error(`[PaymentDispute] Error sending notification to ${staff.id}:`, notifError);
      }
    }

    res.status(201).json({
      success: true,
      message: "Payment dispute submitted successfully",
      dispute: {
        id: dispute.id,
        caseNumber: dispute.caseNumber,
        status: dispute.status,
        priority: dispute.priority,
        slaDeadline: dispute.slaDeadline,
      },
    });
  } catch (error) {
    console.error("[PaymentDispute] Error creating dispute:", error);
    res.status(500).json({ error: "Failed to submit payment dispute" });
  }
});

/**
 * GET /my-disputes
 * Get cleaner's own payment disputes
 */
paymentDisputeRouter.get("/my-disputes", authenticateToken, async (req, res) => {
  const cleanerId = req.user.userId;

  try {
    const disputes = await PaymentDispute.findAll({
      where: { cleanerId },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          attributes: ["id", "date", "price", "completed"],
        },
        {
          model: Payout,
          as: "payout",
          attributes: ["id", "netAmount", "status", "completedAt"],
        },
      ],
      order: [["submittedAt", "DESC"]],
    });

    res.json({
      disputes: disputes.map((d) => ({
        id: d.id,
        caseNumber: d.caseNumber,
        issueType: d.issueType,
        status: d.status,
        priority: d.priority,
        expectedAmount: d.expectedAmount,
        receivedAmount: d.receivedAmount,
        description: d.description,
        submittedAt: d.submittedAt,
        closedAt: d.closedAt,
        resolutionNotes: d.resolutionNotes,
        appointment: d.appointment,
        payout: d.payout,
      })),
    });
  } catch (error) {
    console.error("[PaymentDispute] Error fetching disputes:", error);
    res.status(500).json({ error: "Failed to fetch payment disputes" });
  }
});

/**
 * GET /:id
 * Get a specific payment dispute
 */
paymentDisputeRouter.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const dispute = await PaymentDispute.findByPk(id, {
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          attributes: ["id", "date", "price", "completed", "homeId"],
        },
        {
          model: Payout,
          as: "payout",
          attributes: ["id", "netAmount", "status", "completedAt", "stripeTransferId"],
        },
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: User,
          as: "assignee",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    // Only the cleaner or admin/owner can view
    if (dispute.cleanerId !== userId) {
      // Check if user is admin/owner
      const user = await User.findByPk(userId);
      if (!user || !["admin", "owner", "hr"].includes(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    res.json({ dispute });
  } catch (error) {
    console.error("[PaymentDispute] Error fetching dispute:", error);
    res.status(500).json({ error: "Failed to fetch payment dispute" });
  }
});

module.exports = paymentDisputeRouter;
