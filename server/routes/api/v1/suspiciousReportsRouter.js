/**
 * Suspicious Activity Reports Router
 * Provides report management for HR and Owner to review and take action on
 * suspicious activity reports submitted by users
 */

const express = require("express");
const { Op } = require("sequelize");
const {
  User,
  SuspiciousActivityReport,
  Message,
  Conversation,
  UserAppointments,
  UserCleanerAppointments,
  Payout,
  UserPendingRequests,
  UserHomes,
} = require("../../../models");
const EncryptionService = require("../../../services/EncryptionService");
const EmailClass = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");
const LastMinuteNotificationService = require("../../../services/LastMinuteNotificationService");
const NotificationService = require("../../../services/NotificationService");
const HomeownerFreezeService = require("../../../services/HomeownerFreezeService");
const verifyHROrOwner = require("../../../middleware/verifyHROrOwner");

const suspiciousReportsRouter = express.Router();

/**
 * GET /
 * Get all suspicious activity reports with optional filters
 * Query params: status, search, page, limit
 */
suspiciousReportsRouter.get("/", verifyHROrOwner, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};
    if (status && status !== "all") {
      where.status = status;
    }

    // Build include for searching by user name
    const userInclude = {
      model: User,
      attributes: [
        "id",
        "username",
        "firstName",
        "lastName",
        "type",
        "accountFrozen",
        "warningCount",
      ],
    };

    // Get reports with pagination
    const { count, rows: reports } = await SuspiciousActivityReport.findAndCountAll({
      where,
      include: [
        {
          ...userInclude,
          as: "reporter",
        },
        {
          ...userInclude,
          as: "reportedUser",
        },
        {
          model: User,
          as: "reviewedBy",
          attributes: ["id", "username", "firstName", "lastName"],
        },
        {
          model: UserAppointments,
          as: "appointment",
          attributes: ["id", "date"],
        },
      ],
      order: [
        ["status", "ASC"], // pending first
        ["createdAt", "DESC"],
      ],
      limit: parseInt(limit),
      offset,
    });

    // Filter by search term (reporter or reported user name) if provided
    let filteredReports = reports;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredReports = reports.filter((report) => {
        const reporterName = `${report.reporter?.firstName || ""} ${report.reporter?.lastName || ""}`.toLowerCase();
        const reportedName = `${report.reportedUser?.firstName || ""} ${report.reportedUser?.lastName || ""}`.toLowerCase();
        return reporterName.includes(searchLower) || reportedName.includes(searchLower);
      });
    }

    // Format response
    const formattedReports = filteredReports.map((report) => ({
      id: report.id,
      messageId: report.messageId,
      messageContent: report.messageContent,
      suspiciousContentTypes: report.suspiciousContentTypes,
      status: report.status,
      createdAt: report.createdAt,
      reviewedAt: report.reviewedAt,
      reviewNotes: report.reviewNotes,
      appointmentId: report.appointmentId,
      appointmentDate: report.appointment?.date,
      reporter: report.reporter
        ? {
            id: report.reporter.id,
            name: `${report.reporter.firstName || ""} ${report.reporter.lastName || ""}`.trim(),
            username: report.reporter.username,
            type: report.reporter.type,
          }
        : null,
      reportedUser: report.reportedUser
        ? {
            id: report.reportedUser.id,
            name: `${report.reportedUser.firstName || ""} ${report.reportedUser.lastName || ""}`.trim(),
            username: report.reportedUser.username,
            type: report.reportedUser.type,
            accountStatus: report.reportedUser.accountFrozen ? "suspended" :
              report.reportedUser.warningCount > 0 ? "warned" : "active",
            warningCount: report.reportedUser.warningCount,
          }
        : null,
      reviewedBy: report.reviewedBy
        ? {
            id: report.reviewedBy.id,
            name: `${report.reviewedBy.firstName || ""} ${report.reviewedBy.lastName || ""}`.trim(),
          }
        : null,
    }));

    return res.json({
      reports: formattedReports,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching suspicious reports:", error);
    return res.status(500).json({ error: "Failed to fetch reports" });
  }
});

/**
 * GET /stats
 * Get quick stats for dashboard display
 */
suspiciousReportsRouter.get("/stats", verifyHROrOwner, async (req, res) => {
  try {
    const pending = await SuspiciousActivityReport.count({
      where: { status: "pending" },
    });

    const reviewed = await SuspiciousActivityReport.count({
      where: { status: "reviewed" },
    });

    const dismissed = await SuspiciousActivityReport.count({
      where: { status: "dismissed" },
    });

    const actionTaken = await SuspiciousActivityReport.count({
      where: { status: "action_taken" },
    });

    // Get reports resolved this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const resolvedThisWeek = await SuspiciousActivityReport.count({
      where: {
        status: { [Op.in]: ["reviewed", "dismissed", "action_taken"] },
        reviewedAt: { [Op.gte]: weekStart },
      },
    });

    // Count users with warnings
    const warnedUsers = await User.count({
      where: { warningCount: { [Op.gt]: 0 } },
    });

    // Count suspended users
    const suspendedUsers = await User.count({
      where: { accountFrozen: true },
    });

    return res.json({
      pending,
      reviewed,
      dismissed,
      actionTaken,
      resolvedThisWeek,
      warnedUsers,
      suspendedUsers,
    });
  } catch (error) {
    console.error("Error fetching suspicious reports stats:", error);
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/**
 * GET /user/:userId/history
 * Get all reports for a specific user (as reported)
 * NOTE: This must come BEFORE /:id to avoid route conflict
 */
suspiciousReportsRouter.get("/user/:userId/history", verifyHROrOwner, async (req, res) => {
  const { userId } = req.params;

  try {
    const reports = await SuspiciousActivityReport.findAll({
      where: { reportedUserId: userId },
      include: [
        {
          model: User,
          as: "reporter",
          attributes: ["id", "firstName", "lastName", "type"],
        },
        {
          model: User,
          as: "reviewedBy",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Get user info
    const user = await User.findByPk(userId, {
      attributes: [
        "id",
        "username",
        "firstName",
        "lastName",
        "type",
        "accountFrozen",
        "accountFrozenAt",
        "accountFrozenReason",
        "warningCount",
      ],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      user: {
        id: user.id,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        username: user.username,
        type: user.type,
        accountStatus: user.accountFrozen ? "suspended" :
          user.warningCount > 0 ? "warned" : "active",
        warningCount: user.warningCount,
        accountFrozenAt: user.accountFrozenAt,
        accountFrozenReason: user.accountFrozenReason,
      },
      reports: reports.map((report) => ({
        id: report.id,
        messageContent: report.messageContent,
        suspiciousContentTypes: report.suspiciousContentTypes,
        status: report.status,
        createdAt: report.createdAt,
        reviewedAt: report.reviewedAt,
        reviewNotes: report.reviewNotes,
        reporter: report.reporter
          ? `${report.reporter.firstName || ""} ${report.reporter.lastName || ""}`.trim()
          : "Unknown",
        reviewedBy: report.reviewedBy
          ? `${report.reviewedBy.firstName || ""} ${report.reviewedBy.lastName || ""}`.trim()
          : null,
      })),
    });
  } catch (error) {
    console.error("Error fetching user report history:", error);
    return res.status(500).json({ error: "Failed to fetch user report history" });
  }
});

/**
 * GET /:id
 * Get a specific report with full details
 * NOTE: This catch-all route must come AFTER all specific routes
 */
suspiciousReportsRouter.get("/:id", verifyHROrOwner, async (req, res) => {
  const { id } = req.params;

  try {
    const report = await SuspiciousActivityReport.findByPk(id, {
      include: [
        {
          model: User,
          as: "reporter",
          attributes: [
            "id",
            "username",
            "firstName",
            "lastName",
            "type",
            "email",
            "accountFrozen",
            "warningCount",
          ],
        },
        {
          model: User,
          as: "reportedUser",
          attributes: [
            "id",
            "username",
            "firstName",
            "lastName",
            "type",
            "email",
            "accountFrozen",
            "accountFrozenAt",
            "accountFrozenReason",
            "warningCount",
          ],
        },
        {
          model: User,
          as: "reviewedBy",
          attributes: ["id", "username", "firstName", "lastName"],
        },
        {
          model: Message,
          as: "message",
          attributes: ["id", "content", "createdAt"],
        },
        {
          model: Conversation,
          as: "conversation",
          attributes: ["id", "conversationType", "title"],
        },
        {
          model: UserAppointments,
          as: "appointment",
          attributes: ["id", "date", "price"],
        },
      ],
    });

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Get previous reports against the same user
    const previousReports = await SuspiciousActivityReport.findAll({
      where: {
        reportedUserId: report.reportedUserId,
        id: { [Op.ne]: report.id }, // Exclude current report
      },
      include: [
        {
          model: User,
          as: "reporter",
          attributes: ["id", "firstName", "lastName"],
        },
        {
          model: User,
          as: "reviewedBy",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: 10,
    });

    // Format response
    const formattedReport = {
      id: report.id,
      messageId: report.messageId,
      messageContent: report.messageContent,
      suspiciousContentTypes: report.suspiciousContentTypes,
      status: report.status,
      createdAt: report.createdAt,
      reviewedAt: report.reviewedAt,
      reviewNotes: report.reviewNotes,
      conversationId: report.conversationId,
      conversationType: report.conversation?.conversationType,
      conversationTitle: report.conversation?.title,
      appointmentId: report.appointmentId,
      appointmentDate: report.appointment?.date,
      appointmentPrice: report.appointment?.price,
      reporter: report.reporter
        ? {
            id: report.reporter.id,
            name: `${report.reporter.firstName || ""} ${report.reporter.lastName || ""}`.trim(),
            username: report.reporter.username,
            type: report.reporter.type,
            accountStatus: report.reporter.accountFrozen ? "suspended" :
              report.reporter.warningCount > 0 ? "warned" : "active",
          }
        : null,
      reportedUser: report.reportedUser
        ? {
            id: report.reportedUser.id,
            name: `${report.reportedUser.firstName || ""} ${report.reportedUser.lastName || ""}`.trim(),
            username: report.reportedUser.username,
            type: report.reportedUser.type,
            accountStatus: report.reportedUser.accountFrozen ? "suspended" :
              report.reportedUser.warningCount > 0 ? "warned" : "active",
            warningCount: report.reportedUser.warningCount,
            accountFrozenAt: report.reportedUser.accountFrozenAt,
            accountFrozenReason: report.reportedUser.accountFrozenReason,
          }
        : null,
      reviewedBy: report.reviewedBy
        ? {
            id: report.reviewedBy.id,
            name: `${report.reviewedBy.firstName || ""} ${report.reviewedBy.lastName || ""}`.trim(),
          }
        : null,
      previousReports: previousReports.map((pr) => ({
        id: pr.id,
        suspiciousContentTypes: pr.suspiciousContentTypes,
        status: pr.status,
        createdAt: pr.createdAt,
        reviewedAt: pr.reviewedAt,
        reviewNotes: pr.reviewNotes,
        reporter: pr.reporter
          ? `${pr.reporter.firstName || ""} ${pr.reporter.lastName || ""}`.trim()
          : "Unknown",
        reviewedBy: pr.reviewedBy
          ? `${pr.reviewedBy.firstName || ""} ${pr.reviewedBy.lastName || ""}`.trim()
          : null,
      })),
    };

    return res.json({ report: formattedReport });
  } catch (error) {
    console.error("Error fetching report details:", error);
    return res.status(500).json({ error: "Failed to fetch report details" });
  }
});

/**
 * POST /:id/action
 * Take action on a report
 * Body: { action: 'dismiss'|'reviewed'|'warn'|'suspend'|'clear_flags', notes: string }
 */
suspiciousReportsRouter.post("/:id/action", verifyHROrOwner, async (req, res) => {
  const { id } = req.params;
  const { action, notes } = req.body;
  const reviewerId = req.user.id;

  // Validate action
  const validActions = ["dismiss", "reviewed", "warn", "suspend", "clear_flags"];
  if (!validActions.includes(action)) {
    return res.status(400).json({
      error: `Invalid action. Must be one of: ${validActions.join(", ")}`,
    });
  }

  // Notes required for warn and suspend
  if ((action === "warn" || action === "suspend") && !notes) {
    return res.status(400).json({
      error: "Notes are required for warn and suspend actions",
    });
  }

  try {
    const report = await SuspiciousActivityReport.findByPk(id, {
      include: [
        {
          model: User,
          as: "reportedUser",
        },
      ],
    });

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    const reportedUser = report.reportedUser;
    if (!reportedUser) {
      return res.status(404).json({ error: "Reported user not found" });
    }

    // Determine report status based on action
    let reportStatus;
    switch (action) {
      case "dismiss":
        reportStatus = "dismissed";
        break;
      case "reviewed":
        reportStatus = "reviewed";
        break;
      case "warn":
      case "suspend":
      case "clear_flags":
        reportStatus = "action_taken";
        break;
      default:
        reportStatus = "reviewed";
    }

    // Update the report
    await report.update({
      status: reportStatus,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNotes: notes || null,
    });

    // Take action on the user based on action type
    const now = new Date();
    switch (action) {
      case "dismiss":
        // If dismissing, don't change user status
        // But if this was the only report that caused a warning, we might want to decrement
        // For now, we'll leave the user status unchanged on dismiss
        break;

      case "warn":
        // Add warning to user
        await reportedUser.update({
          warningCount: reportedUser.warningCount + 1,
          accountStatusUpdatedById: reviewerId,
        });
        break;

      case "suspend":
        // Handle homeowners using HomeownerFreezeService (handles freeze + appointments + notifications)
        if (reportedUser.type === "client" || reportedUser.type === "homeowner") {
          const io = req.app.get("io");
          try {
            const freezeResult = await HomeownerFreezeService.freezeHomeowner(
              reportedUser.id,
              notes || "Suspicious activity review",
              reviewerId,
              io
            );
            console.log(
              `[SuspiciousReports] Homeowner ${reportedUser.id} frozen via suspicious report. ` +
              `Cancelled: ${freezeResult.appointmentsCancelled}, Paused: ${freezeResult.appointmentsPaused}`
            );
          } catch (freezeErr) {
            console.error("[SuspiciousReports] Error freezing homeowner:", freezeErr);
            // Continue with basic freeze if service fails
            await reportedUser.update({
              accountFrozen: true,
              accountFrozenAt: now,
              accountFrozenReason: notes,
              accountStatusUpdatedById: reviewerId,
            });
          }
          break;
        }

        // For cleaners and other user types, freeze the account manually
        await reportedUser.update({
          accountFrozen: true,
          accountFrozenAt: now,
          accountFrozenReason: notes,
          accountStatusUpdatedById: reviewerId,
        });

        // If the user is a cleaner, remove them from all future appointments
        if (reportedUser.type === "cleaner") {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const futureAssignments = await UserCleanerAppointments.findAll({
            where: { employeeId: reportedUser.id },
            include: [{
              model: UserAppointments,
              as: "appointment",
              where: {
                date: { [Op.gte]: today.toISOString().split('T')[0] },
                completed: false,
              },
            }],
          });

          const notifiedHomeowners = new Set();

          for (const assignment of futureAssignments) {
            const futureAppointment = assignment.appointment;

            // Remove from employeesAssigned array
            let futureEmployees = Array.isArray(futureAppointment.employeesAssigned)
              ? [...futureAppointment.employeesAssigned]
              : [];
            const updatedFutureEmployees = futureEmployees.filter(
              (empId) => empId !== String(reportedUser.id)
            );

            await futureAppointment.update({
              employeesAssigned: updatedFutureEmployees,
              hasBeenAssigned: updatedFutureEmployees.length > 0,
            });

            // Delete the assignment record
            await assignment.destroy();

            // Delete pending payout for this cleaner
            await Payout.destroy({
              where: {
                appointmentId: futureAppointment.id,
                cleanerId: reportedUser.id,
                status: "pending",
              },
            });

            // Reactivate pending request if no cleaners left
            if (updatedFutureEmployees.length === 0) {
              await UserPendingRequests.update(
                { status: "pending" },
                {
                  where: {
                    appointmentId: futureAppointment.id,
                    status: { [Op.in]: ["approved", "assigned"] },
                  },
                }
              );
            }

            // Calculate days until appointment
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const apptDate = new Date(futureAppointment.date);
            const daysUntil = Math.ceil((apptDate - today) / (1000 * 60 * 60 * 24));
            const isUrgentFill = daysUntil <= 7;

            // Notify homeowner
            const futureHomeowner = await User.findByPk(futureAppointment.userId);
            const futureHome = await UserHomes.findByPk(futureAppointment.homeId);

            if (futureHomeowner && futureHome) {
              const notifications = futureHomeowner.notifications || [];
              const formattedDate = new Date(futureAppointment.date).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              });
              const safeDecrypt = (val) => {
                try { return EncryptionService.decrypt(val); } catch { return val; }
              };

              // Different in-app notification based on urgency
              const inAppMessage = isUrgentFill
                ? `🚨 PRIORITY: A cleaner has been removed from the ${formattedDate} cleaning at ${futureHome?.address ? safeDecrypt(futureHome.address) : "your property"}. Kleanr is pushing your appointment to priority cleaners within 10 miles now!`
                : `A cleaner has been removed from the ${formattedDate} cleaning at ${futureHome?.address ? safeDecrypt(futureHome.address) : "your property"} due to account issues. A new cleaner will need to be assigned.`;

              notifications.unshift(inAppMessage);
              await futureHomeowner.update({ notifications: notifications.slice(0, 50) });

              // Send email and push notifications
              try {
                const futureAddress = {
                  street: safeDecrypt(futureHome.address),
                  city: safeDecrypt(futureHome.city),
                  state: safeDecrypt(futureHome.state),
                  zipcode: safeDecrypt(futureHome.zipcode),
                };

                const notificationReason = isUrgentFill ? "urgent_fill" : "account_issues";

                await EmailClass.sendEmailCancellation(
                  safeDecrypt(futureHomeowner.email),
                  futureAddress,
                  futureHomeowner.username,
                  futureAppointment.date,
                  notificationReason
                );

                if (futureHomeowner.expoPushToken) {
                  await PushNotification.sendPushCancellation(
                    futureHomeowner.expoPushToken,
                    futureHomeowner.username,
                    futureAppointment.date,
                    futureAddress,
                    notificationReason
                  );
                }
              } catch (notifyErr) {
                console.error("[SuspiciousReports] Error sending homeowner notification:", notifyErr);
              }

              // For urgent fills (within 7 days), notify nearby cleaners
              if (isUrgentFill) {
                try {
                  const io = req.app.get("io");
                  const urgentResult = await LastMinuteNotificationService.notifyCleanersForUrgentFill(
                    futureAppointment,
                    futureHome,
                    io,
                    reportedUser.id
                  );
                  console.log(
                    `[SuspiciousReports] Urgent fill: Notified ${urgentResult.notifiedCount} cleaners for appointment ${futureAppointment.id} (${daysUntil} days out)`
                  );
                } catch (urgentErr) {
                  console.error("[SuspiciousReports] Error sending urgent fill notifications:", urgentErr);
                }
              }
            }
          }

          if (futureAssignments.length > 0) {
            console.log(
              `[SuspiciousReports] Removed cleaner ${reportedUser.id} from ${futureAssignments.length} future appointments due to suspension`
            );
          }
        }

        // Notify the user that their account has been suspended
        try {
          const io = req.app.get("io");
          await NotificationService.notifyUser({
            userId: reportedUser.id,
            type: "account_frozen",
            title: "Account Suspended",
            message: "Your account has been suspended due to a suspicious activity review. Please contact support for assistance.",
            data: {
              frozenAt: now.toISOString(),
              reason: notes || "Suspicious activity review",
            },
            io,
          });
        } catch (notifyErr) {
          console.error("[SuspiciousReports] Error sending freeze notification to user:", notifyErr);
        }
        break;

      case "clear_flags":
        // Track if account was frozen before clearing
        const wasFrozen = reportedUser.accountFrozen;

        // Handle homeowners using HomeownerFreezeService (resumes paused appointments)
        if ((reportedUser.type === "client" || reportedUser.type === "homeowner") && wasFrozen) {
          const io = req.app.get("io");
          try {
            const unfreezeResult = await HomeownerFreezeService.unfreezeHomeowner(
              reportedUser.id,
              reviewerId,
              io
            );
            console.log(
              `[SuspiciousReports] Homeowner ${reportedUser.id} unfrozen via clear_flags. ` +
              `Appointments resumed: ${unfreezeResult.appointmentsResumed}`
            );
          } catch (unfreezeErr) {
            console.error("[SuspiciousReports] Error unfreezing homeowner:", unfreezeErr);
            // Fall back to basic unfreeze if service fails
            await reportedUser.update({
              accountFrozen: false,
              accountFrozenAt: null,
              accountFrozenReason: null,
              warningCount: 0,
              accountStatusUpdatedById: reviewerId,
            });
          }
        } else {
          // For cleaners and other user types, clear flags manually
          await reportedUser.update({
            accountFrozen: false,
            accountFrozenAt: null,
            accountFrozenReason: null,
            warningCount: 0,
            accountStatusUpdatedById: reviewerId,
          });

          // Notify user if their account was unfrozen
          if (wasFrozen) {
            try {
              const io = req.app.get("io");
              await NotificationService.notifyUser({
                userId: reportedUser.id,
                type: "account_unfrozen",
                title: "Account Restored",
                message: "Your account has been restored. You now have full access to the platform.",
                data: {
                  unfrozenAt: new Date().toISOString(),
                },
                io,
              });
            } catch (notifyErr) {
              console.error("[SuspiciousReports] Error sending unfreeze notification to user:", notifyErr);
            }
          }
        }
        break;

      // 'reviewed' - no action on user
      default:
        break;
    }

    // Get updated pending count for real-time badge updates
    const pendingCount = await SuspiciousActivityReport.count({
      where: { status: "pending" },
    });

    // Emit socket event for real-time updates to all HR/Owner users
    const io = req.app.get("io");
    if (io) {
      // Get all HR/Owner users to notify
      const staffToNotify = await User.findAll({
        where: {
          type: { [Op.in]: ["owner", "humanResources"] },
        },
        attributes: ["id"],
      });

      // Emit to each staff member's personal room
      for (const staff of staffToNotify) {
        io.to(`user_${staff.id}`).emit("suspicious_report_updated", {
          reportId: report.id,
          status: reportStatus,
          action,
          pendingCount,
        });
      }
    }

    // Return updated report info
    const updatedReport = await SuspiciousActivityReport.findByPk(id, {
      include: [
        {
          model: User,
          as: "reportedUser",
          attributes: [
            "id",
            "username",
            "firstName",
            "lastName",
            "accountFrozen",
            "warningCount",
          ],
        },
        {
          model: User,
          as: "reviewedBy",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    return res.json({
      success: true,
      message: `Action "${action}" completed successfully`,
      report: {
        id: updatedReport.id,
        status: updatedReport.status,
        reviewedAt: updatedReport.reviewedAt,
        reviewNotes: updatedReport.reviewNotes,
        reportedUser: {
          id: updatedReport.reportedUser.id,
          name: `${updatedReport.reportedUser.firstName || ""} ${updatedReport.reportedUser.lastName || ""}`.trim(),
          accountStatus: updatedReport.reportedUser.accountFrozen ? "suspended" :
            updatedReport.reportedUser.warningCount > 0 ? "warned" : "active",
          warningCount: updatedReport.reportedUser.warningCount,
        },
        reviewedBy: {
          id: updatedReport.reviewedBy.id,
          name: `${updatedReport.reviewedBy.firstName || ""} ${updatedReport.reviewedBy.lastName || ""}`.trim(),
        },
      },
    });
  } catch (error) {
    console.error("Error taking action on report:", error);
    return res.status(500).json({ error: "Failed to process action" });
  }
});

module.exports = suspiciousReportsRouter;
