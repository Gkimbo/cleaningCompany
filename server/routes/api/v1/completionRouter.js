/**
 * Completion Router - 2-Step Completion Confirmation Flow
 *
 * Handles the cleaner completion submission and homeowner approval process:
 * - Step 1: Cleaner submits completion with checklist data
 * - Step 2: Homeowner approves ("Looks good") or auto-approval after configurable hours
 *
 * For multi-cleaner jobs, each cleaner is handled separately via CleanerJobCompletion
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const {
  UserAppointments,
  CleanerJobCompletion,
  User,
  UserHomes,
  JobPhoto,
  PricingConfig,
  MultiCleanerJob,
  UserReviews,
  EmployeeJobAssignment,
  BusinessEmployee,
} = require("../../../models");
const NotificationService = require("../../../services/NotificationService");
const EncryptionService = require("../../../services/EncryptionService");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");
const { calculateAutoApprovalExpiration } = require("../../../services/cron/CompletionApprovalMonitor");
const {
  parseTimeWindow,
  getAutoCompleteConfig,
} = require("../../../services/cron/AutoCompleteMonitor");
const AnalyticsService = require("../../../services/AnalyticsService");

const completionRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

/**
 * Validate if completion timing is allowed
 * Rules:
 * - Allowed if time window has started (appointment date + window start time)
 * - OR allowed if cleaner has been on-site for minimum duration (30 min by default)
 *
 * @param {Object} appointment - UserAppointments record
 * @param {number} cleanerId - Cleaner ID (for multi-cleaner jobs)
 * @returns {{ allowed: boolean, reason?: string, message?: string }}
 */
async function validateCompletionTiming(appointment, cleanerId = null) {
  const now = new Date();
  const config = await getAutoCompleteConfig();
  const minOnSiteMinutes = config.minOnSiteMinutes || 30;

  // Parse appointment date and time window
  const [year, month, day] = appointment.date.split("-").map(Number);
  const timeWindow = parseTimeWindow(appointment.timeToBeCompleted);
  const windowStartTime = new Date(year, month - 1, day, timeWindow.start, 0, 0);

  // Check 1: Has time window started?
  const timeWindowStarted = now >= windowStartTime;

  // Check 2: Has cleaner been on-site long enough?
  // For multi-cleaner jobs, check CleanerJobCompletion.jobStartedAt
  // For single-cleaner jobs, check appointment.jobStartedAt
  let jobStartedAt = appointment.jobStartedAt;

  if (appointment.isMultiCleanerJob && cleanerId) {
    const completion = await CleanerJobCompletion.findOne({
      where: { appointmentId: appointment.id, cleanerId },
    });
    if (completion) {
      jobStartedAt = completion.jobStartedAt;
    }
  }

  const onSiteLongEnough = jobStartedAt &&
    (now.getTime() - new Date(jobStartedAt).getTime()) >= minOnSiteMinutes * 60 * 1000;

  if (!timeWindowStarted && !onSiteLongEnough) {
    const windowLabel = timeWindow.start === 8 ? "anytime (8 AM)" : `${timeWindow.start}:00`;
    return {
      allowed: false,
      reason: "early_completion_blocked",
      message: `Cannot complete yet. Either wait until the time window starts (${windowLabel}) or be on-site for at least ${minOnSiteMinutes} minutes.`,
      timeWindowStarted,
      onSiteLongEnough,
      jobStartedAt: jobStartedAt ? new Date(jobStartedAt).toISOString() : null,
      windowStartTime: windowStartTime.toISOString(),
    };
  }

  return { allowed: true };
}

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No authorization header" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * POST /submit/:appointmentId
 * Step 1: Cleaner submits completion with checklist data
 *
 * Body: {
 *   checklistData: { section: { completed: [], total: [] }, ... },
 *   notes: "Optional notes about the cleaning",
 *   cleanerId: number (required for multi-cleaner jobs)
 * }
 */
completionRouter.post("/submit/:appointmentId", verifyToken, async (req, res) => {
  const { appointmentId } = req.params;
  const { checklistData, notes, cleanerId } = req.body;

  try {
    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [
        { model: User, as: "user", attributes: ["id", "firstName", "lastName", "email", "expoPushToken"] },
        { model: UserHomes, as: "home", attributes: ["id", "address", "city"] },
      ],
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify the requesting user is assigned to this job
    const userIdStr = String(req.userId);
    const assignedCleaners = (appointment.employeesAssigned || []).map(String);
    if (!assignedCleaners.includes(userIdStr)) {
      return res.status(403).json({ error: "You are not assigned to this job" });
    }

    // Validate early completion timing
    const timingValidation = await validateCompletionTiming(
      appointment,
      cleanerId || req.userId
    );
    if (!timingValidation.allowed) {
      return res.status(400).json({
        error: timingValidation.message,
        reason: timingValidation.reason,
        timeWindowStarted: timingValidation.timeWindowStarted,
        onSiteLongEnough: timingValidation.onSiteLongEnough,
        jobStartedAt: timingValidation.jobStartedAt,
        windowStartTime: timingValidation.windowStartTime,
      });
    }

    // Check if payment has been captured
    if (!appointment.paid) {
      return res.status(400).json({ error: "Payment not yet captured" });
    }

    // Calculate auto-approval expiration
    const autoApprovalExpiresAt = await calculateAutoApprovalExpiration();

    // Handle multi-cleaner jobs differently
    if (appointment.isMultiCleanerJob && appointment.multiCleanerJobId) {
      return handleMultiCleanerSubmit(req, res, appointment, {
        checklistData,
        notes,
        cleanerId: cleanerId || req.userId,
        autoApprovalExpiresAt,
      });
    }

    // Single-cleaner job submission
    if (appointment.completionStatus === "submitted") {
      return res.status(400).json({ error: "Completion already submitted" });
    }

    if (appointment.completionStatus === "approved" || appointment.completionStatus === "auto_approved") {
      return res.status(400).json({ error: "Completion already approved" });
    }

    // Check for required checklist (optional: can be made stricter)
    if (!checklistData || Object.keys(checklistData).length === 0) {
      return res.status(400).json({ error: "Checklist data is required" });
    }

    // Check photo requirements from config
    const config = await PricingConfig.getActive();
    if (config?.completionRequiresPhotos) {
      const beforePhotos = await JobPhoto.count({
        where: { appointmentId, cleanerId: req.userId, photoType: "before" },
      });
      const afterPhotos = await JobPhoto.count({
        where: { appointmentId, cleanerId: req.userId, photoType: "after" },
      });

      if (beforePhotos === 0 || afterPhotos === 0) {
        return res.status(400).json({
          error: "Photos are required to submit completion",
          missingPhotos: beforePhotos === 0 ? "before" : "after",
        });
      }
    }

    // Update appointment with submission
    await appointment.update({
      completionStatus: "submitted",
      completionSubmittedAt: new Date(),
      completionChecklistData: checklistData,
      completionNotes: notes || null,
      autoApprovalExpiresAt,
    });

    // Get cleaner info for notifications
    const cleaner = await User.findByPk(req.userId);
    const cleanerName = cleaner ? EncryptionService.decrypt(cleaner.firstName) : "Your cleaner";

    // Notify homeowner
    if (appointment.user) {
      const homeownerFirstName = EncryptionService.decrypt(appointment.user.firstName);
      const homeAddress = appointment.home
        ? `${EncryptionService.decrypt(appointment.home.address)}, ${EncryptionService.decrypt(appointment.home.city)}`
        : "your home";

      // In-app notification
      await NotificationService.createNotification({
        userId: appointment.userId,
        type: "completion_submitted",
        title: "Cleaning Complete!",
        body: `${cleanerName} has finished cleaning ${homeAddress}. Please review and approve.`,
        data: { appointmentId: appointment.id },
        actionRequired: true,
        relatedAppointmentId: appointment.id,
      });

      // Email notification
      const homeownerEmail = appointment.user.email
        ? EncryptionService.decrypt(appointment.user.email)
        : null;
      if (homeownerEmail) {
        await Email.sendCompletionSubmittedHomeowner(
          homeownerEmail,
          homeownerFirstName,
          appointment.date,
          homeAddress,
          cleanerName,
          Math.round((autoApprovalExpiresAt - new Date()) / 3600000) // hours until auto-approval
        );
      }

      // Push notification
      if (appointment.user.expoPushToken) {
        await PushNotification.sendPushCompletionAwaitingApproval(
          appointment.user.expoPushToken,
          appointment.date,
          cleanerName
        );
      }
    }

    console.log(`[Completion] Single-cleaner submission for appointment ${appointmentId} by cleaner ${req.userId}`);

    return res.json({
      success: true,
      completionStatus: "submitted",
      completionSubmittedAt: appointment.completionSubmittedAt,
      autoApprovalExpiresAt,
      message: "Completion submitted. Awaiting homeowner approval.",
    });
  } catch (error) {
    console.error("[Completion] Submit error:", error);
    return res.status(500).json({ error: "Failed to submit completion" });
  }
});

/**
 * Handle multi-cleaner job submission (per-cleaner)
 */
async function handleMultiCleanerSubmit(req, res, appointment, { checklistData, notes, cleanerId, autoApprovalExpiresAt }) {
  // Find or validate the CleanerJobCompletion record
  let completion = await CleanerJobCompletion.findOne({
    where: {
      appointmentId: appointment.id,
      cleanerId,
    },
    include: [{ model: User, as: "cleaner" }],
  });

  if (!completion) {
    return res.status(404).json({ error: "No completion record found for this cleaner on this job" });
  }

  if (completion.completionStatus === "submitted") {
    return res.status(400).json({ error: "Completion already submitted" });
  }

  if (completion.completionStatus === "approved" || completion.completionStatus === "auto_approved") {
    return res.status(400).json({ error: "Completion already approved" });
  }

  // Check photo requirements
  const config = await PricingConfig.getActive();
  if (config?.completionRequiresPhotos) {
    const beforePhotos = await JobPhoto.count({
      where: { appointmentId: appointment.id, cleanerId, photoType: "before" },
    });
    const afterPhotos = await JobPhoto.count({
      where: { appointmentId: appointment.id, cleanerId, photoType: "after" },
    });

    if (beforePhotos === 0 || afterPhotos === 0) {
      return res.status(400).json({
        error: "Photos are required to submit completion",
        missingPhotos: beforePhotos === 0 ? "before" : "after",
      });
    }
  }

  // Update the completion record
  await completion.update({
    completionStatus: "submitted",
    completionSubmittedAt: new Date(),
    checklistProgress: checklistData,
    completionNotes: notes || null,
    autoApprovalExpiresAt,
  });

  // Get cleaner info
  const cleaner = await User.findByPk(cleanerId);
  const cleanerName = cleaner ? EncryptionService.decrypt(cleaner.firstName) : "A cleaner";

  // Notify homeowner
  const homeowner = await User.findByPk(appointment.userId);
  const home = await UserHomes.findByPk(appointment.homeId);

  if (homeowner) {
    const homeownerFirstName = EncryptionService.decrypt(homeowner.firstName);
    const homeAddress = home
      ? `${EncryptionService.decrypt(home.address)}, ${EncryptionService.decrypt(home.city)}`
      : "your home";

    // In-app notification
    await NotificationService.createNotification({
      userId: homeowner.id,
      type: "completion_submitted",
      title: "Cleaner Finished!",
      body: `${cleanerName} has completed their part of the cleaning at ${homeAddress}. Please review.`,
      data: { appointmentId: appointment.id, cleanerId },
      actionRequired: true,
      relatedAppointmentId: appointment.id,
    });

    // Email notification
    const homeownerEmail = homeowner.email ? EncryptionService.decrypt(homeowner.email) : null;
    if (homeownerEmail) {
      await Email.sendCompletionSubmittedHomeowner(
        homeownerEmail,
        homeownerFirstName,
        appointment.date,
        homeAddress,
        cleanerName,
        Math.round((autoApprovalExpiresAt - new Date()) / 3600000)
      );
    }

    // Push notification
    if (homeowner.expoPushToken) {
      await PushNotification.sendPushCompletionAwaitingApproval(
        homeowner.expoPushToken,
        appointment.date,
        cleanerName
      );
    }
  }

  console.log(`[Completion] Multi-cleaner submission for appointment ${appointment.id} by cleaner ${cleanerId}`);

  return res.json({
    success: true,
    completionStatus: "submitted",
    completionSubmittedAt: completion.completionSubmittedAt,
    autoApprovalExpiresAt,
    message: "Completion submitted. Awaiting homeowner approval.",
  });
}

/**
 * POST /approve/:appointmentId
 * Step 2a: Homeowner approves ("Looks good")
 *
 * Body: {
 *   cleanerId: number (required for multi-cleaner jobs)
 * }
 */
completionRouter.post("/approve/:appointmentId", verifyToken, async (req, res) => {
  const { appointmentId } = req.params;
  const { cleanerId } = req.body;

  try {
    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [
        { model: User, as: "user" },
        { model: UserHomes, as: "home" },
      ],
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify the requesting user is the homeowner
    if (appointment.userId !== req.userId) {
      return res.status(403).json({ error: "Only the homeowner can approve completion" });
    }

    // Handle multi-cleaner jobs
    if (appointment.isMultiCleanerJob && appointment.multiCleanerJobId) {
      return handleMultiCleanerApprove(req, res, appointment, cleanerId);
    }

    // Single-cleaner approval
    if (!appointment.canBeApproved()) {
      return res.status(400).json({
        error: "Completion cannot be approved",
        reason: appointment.completionStatus === "in_progress"
          ? "Cleaner has not submitted completion yet"
          : "Already approved",
      });
    }

    const now = new Date();

    // Update appointment
    await appointment.update({
      completionStatus: "approved",
      completionApprovedAt: now,
      completionApprovedBy: req.userId,
      completed: true,
    });

    // Process payout
    const paymentRouter = require("./paymentRouter");
    const payoutResults = await processPayoutAfterApproval(appointment);

    // Get cleaner info for notifications
    const cleanerIds = appointment.employeesAssigned || [];
    const assignedCleanerId = cleanerIds[0];
    const cleaner = assignedCleanerId ? await User.findByPk(assignedCleanerId) : null;

    // Notify cleaner
    if (cleaner) {
      const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);

      await NotificationService.createNotification({
        userId: cleaner.id,
        type: "completion_approved",
        title: "Job Approved!",
        body: `Your cleaning on ${appointment.date} was approved! Payment is on the way.`,
        data: { appointmentId: appointment.id },
        relatedAppointmentId: appointment.id,
      });

      const cleanerEmail = cleaner.email ? EncryptionService.decrypt(cleaner.email) : null;
      if (cleanerEmail) {
        await Email.sendCompletionApprovedCleaner(
          cleanerEmail,
          cleanerFirstName,
          appointment.date,
          appointment.price
        );
      }

      if (cleaner.expoPushToken) {
        await PushNotification.sendPushCompletionApproved(
          cleaner.expoPushToken,
          appointment.date,
          appointment.price
        );
      }
    }

    // Notify business owner if an employee completed this job
    try {
      const employeeAssignment = await EmployeeJobAssignment.findOne({
        where: {
          appointmentId: appointment.id,
          isSelfAssignment: false,
        },
        include: [{
          model: BusinessEmployee,
          as: "employee",
          attributes: ["id", "userId"],
          include: [{
            model: User,
            as: "user",
            attributes: ["id", "firstName"],
          }],
        }],
      });

      if (employeeAssignment && employeeAssignment.businessOwnerId) {
        const businessOwner = await User.findByPk(employeeAssignment.businessOwnerId);

        if (businessOwner) {
          const employeeName = employeeAssignment.employee?.user?.firstName
            ? EncryptionService.decrypt(employeeAssignment.employee.user.firstName)
            : "Your employee";
          const clientName = appointment.user
            ? EncryptionService.decrypt(appointment.user.firstName)
            : "your client";

          // In-app notification for business owner
          await NotificationService.createNotification({
            userId: businessOwner.id,
            type: "employee_job_approved",
            title: "Job Approved",
            body: `${employeeName}'s cleaning for ${clientName} was approved by the homeowner. Payment sent.`,
            data: { appointmentId: appointment.id, employeeAssignmentId: employeeAssignment.id },
            relatedAppointmentId: appointment.id,
          });

          // Push notification to business owner
          if (businessOwner.expoPushToken) {
            await PushNotification.sendPushNotification(
              businessOwner.expoPushToken,
              "Job Approved",
              `${employeeName}'s cleaning for ${clientName} was approved. Payment sent.`,
              { appointmentId: appointment.id, type: "employee_job_approved" }
            );
          }

          console.log(`[Completion] Business owner ${businessOwner.id} notified of employee job approval`);
        }
      }
    } catch (businessNotificationError) {
      console.error(`[Completion] Error notifying business owner:`, businessNotificationError);
    }

    console.log(`[Completion] Approved by homeowner for appointment ${appointmentId}`);

    // Track job completion analytics
    if (appointment.jobStartedAt) {
      const durationMinutes = Math.round((now - new Date(appointment.jobStartedAt)) / (1000 * 60));
      const assignedCleaner = (appointment.employeesAssigned || [])[0];
      await AnalyticsService.trackJobCompleted(
        appointmentId,
        assignedCleaner,
        durationMinutes,
        appointment.home?.homeType || null
      );
    }

    return res.json({
      success: true,
      message: "Cleaning approved! Payment sent to cleaner.",
      completionStatus: "approved",
      payoutResults,
    });
  } catch (error) {
    console.error("[Completion] Approve error:", error);
    return res.status(500).json({ error: "Failed to approve completion" });
  }
});

/**
 * Handle multi-cleaner approval (per-cleaner)
 */
async function handleMultiCleanerApprove(req, res, appointment, cleanerId) {
  if (!cleanerId) {
    return res.status(400).json({ error: "cleanerId is required for multi-cleaner jobs" });
  }

  const completion = await CleanerJobCompletion.findOne({
    where: {
      appointmentId: appointment.id,
      cleanerId,
    },
  });

  if (!completion) {
    return res.status(404).json({ error: "No completion record found for this cleaner" });
  }

  if (!completion.canBeApproved()) {
    return res.status(400).json({
      error: "Completion cannot be approved",
      reason: completion.completionStatus === "in_progress"
        ? "Cleaner has not submitted completion yet"
        : "Already approved",
    });
  }

  const now = new Date();

  // Update the completion record
  await completion.update({
    completionStatus: "approved",
    completionApprovedAt: now,
    completionApprovedBy: req.userId,
    status: "completed",
    completedAt: now,
  });

  // Process payout for this cleaner
  const payoutResults = await processMultiCleanerPayoutForCleaner(appointment, cleanerId);

  // Check if all cleaners in this job are now approved - if so, mark parent appointment as completed
  await checkAndUpdateParentAppointmentCompletion(appointment.id);

  // Notify cleaner
  const cleaner = await User.findByPk(cleanerId);
  if (cleaner) {
    const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);

    await NotificationService.createNotification({
      userId: cleaner.id,
      type: "completion_approved",
      title: "Job Approved!",
      body: `Your work on ${appointment.date} was approved! Payment is on the way.`,
      data: { appointmentId: appointment.id },
      relatedAppointmentId: appointment.id,
    });

    const cleanerEmail = cleaner.email ? EncryptionService.decrypt(cleaner.email) : null;
    if (cleanerEmail) {
      await Email.sendCompletionApprovedCleaner(
        cleanerEmail,
        cleanerFirstName,
        appointment.date,
        null // Price calculated separately for multi-cleaner
      );
    }

    if (cleaner.expoPushToken) {
      await PushNotification.sendPushCompletionApproved(
        cleaner.expoPushToken,
        appointment.date,
        null
      );
    }
  }

  console.log(`[Completion] Multi-cleaner approved by homeowner for appointment ${appointment.id}, cleaner ${cleanerId}`);

  return res.json({
    success: true,
    message: "Cleaner's work approved! Payment sent.",
    completionStatus: "approved",
    payoutResults,
  });
}

/**
 * POST /request-review/:appointmentId
 * Step 2b: Homeowner doesn't approve - triggers review prompt
 * Cleaner still gets paid, but homeowner can leave a review
 *
 * Body: {
 *   concerns: "Brief description of issues",
 *   cleanerId: number (required for multi-cleaner jobs)
 * }
 */
completionRouter.post("/request-review/:appointmentId", verifyToken, async (req, res) => {
  const { appointmentId } = req.params;
  const { concerns, cleanerId } = req.body;

  try {
    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [
        { model: User, as: "user" },
        { model: UserHomes, as: "home" },
      ],
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify the requesting user is the homeowner
    if (appointment.userId !== req.userId) {
      return res.status(403).json({ error: "Only the homeowner can request a review" });
    }

    // Handle multi-cleaner jobs
    if (appointment.isMultiCleanerJob && appointment.multiCleanerJobId) {
      return handleMultiCleanerRequestReview(req, res, appointment, cleanerId, concerns);
    }

    // Single-cleaner request-review
    if (appointment.completionStatus !== "submitted") {
      return res.status(400).json({
        error: "Cannot request review",
        reason: appointment.completionStatus === "in_progress"
          ? "Cleaner has not submitted completion yet"
          : "Already approved",
      });
    }

    const now = new Date();

    // Mark as approved (cleaner still gets paid) but flag for review
    await appointment.update({
      completionStatus: "approved",
      completionApprovedAt: now,
      completionApprovedBy: req.userId,
      completed: true,
      homeownerFeedbackRequired: true,
    });

    // Process payout (cleaner still gets paid!)
    const payoutResults = await processPayoutAfterApproval(appointment);

    // Get cleaner info
    const cleanerIds = appointment.employeesAssigned || [];
    const assignedCleanerId = cleanerIds[0];
    const cleaner = assignedCleanerId ? await User.findByPk(assignedCleanerId) : null;

    // Create a review prompt for the homeowner
    // This nudges them to leave a review describing the issues
    if (cleaner) {
      const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);

      // Notify cleaner that job was approved (don't mention the concerns to them yet)
      await NotificationService.createNotification({
        userId: cleaner.id,
        type: "completion_approved",
        title: "Job Approved",
        body: `Your cleaning on ${appointment.date} was approved. Payment is on the way.`,
        data: { appointmentId: appointment.id },
        relatedAppointmentId: appointment.id,
      });

      // Email cleaner
      const cleanerEmail = cleaner.email ? EncryptionService.decrypt(cleaner.email) : null;
      if (cleanerEmail) {
        await Email.sendCompletionApprovedCleaner(
          cleanerEmail,
          cleanerFirstName,
          appointment.date,
          appointment.price
        );
      }

      // Push notification to cleaner
      if (cleaner.expoPushToken) {
        await PushNotification.sendPushCompletionApproved(
          cleaner.expoPushToken,
          appointment.date,
          appointment.price
        );
      }
    }

    console.log(`[Completion] Request-review by homeowner for appointment ${appointmentId}. Concerns: ${concerns || "none specified"}`);

    return res.json({
      success: true,
      message: "Cleaner will be paid. Please leave a review to help improve future cleanings.",
      completionStatus: "approved",
      payoutResults,
      reviewPending: true,
    });
  } catch (error) {
    console.error("[Completion] Request-review error:", error);
    return res.status(500).json({ error: "Failed to process request" });
  }
});

/**
 * Handle multi-cleaner request-review (per-cleaner)
 */
async function handleMultiCleanerRequestReview(req, res, appointment, cleanerId, concerns) {
  if (!cleanerId) {
    return res.status(400).json({ error: "cleanerId is required for multi-cleaner jobs" });
  }

  const completion = await CleanerJobCompletion.findOne({
    where: {
      appointmentId: appointment.id,
      cleanerId,
    },
  });

  if (!completion) {
    return res.status(404).json({ error: "No completion record found for this cleaner" });
  }

  if (completion.completionStatus !== "submitted") {
    return res.status(400).json({
      error: "Cannot request review",
      reason: completion.completionStatus === "in_progress"
        ? "Cleaner has not submitted completion yet"
        : "Already approved",
    });
  }

  const now = new Date();

  // Mark as approved but flag for review
  await completion.update({
    completionStatus: "approved",
    completionApprovedAt: now,
    completionApprovedBy: req.userId,
    status: "completed",
    completedAt: now,
    homeownerFeedbackRequired: true,
  });

  // Process payout for this cleaner (they still get paid!)
  const payoutResults = await processMultiCleanerPayoutForCleaner(appointment, cleanerId);

  // Check if all cleaners in this job are now approved - if so, mark parent appointment as completed
  await checkAndUpdateParentAppointmentCompletion(appointment.id);

  // Notify cleaner (don't mention concerns)
  const cleaner = await User.findByPk(cleanerId);
  if (cleaner) {
    const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);

    await NotificationService.createNotification({
      userId: cleaner.id,
      type: "completion_approved",
      title: "Job Approved",
      body: `Your work on ${appointment.date} was approved. Payment is on the way.`,
      data: { appointmentId: appointment.id },
      relatedAppointmentId: appointment.id,
    });

    const cleanerEmail = cleaner.email ? EncryptionService.decrypt(cleaner.email) : null;
    if (cleanerEmail) {
      await Email.sendCompletionApprovedCleaner(
        cleanerEmail,
        cleanerFirstName,
        appointment.date,
        null
      );
    }

    if (cleaner.expoPushToken) {
      await PushNotification.sendPushCompletionApproved(
        cleaner.expoPushToken,
        appointment.date,
        null
      );
    }
  }

  console.log(`[Completion] Multi-cleaner request-review for appointment ${appointment.id}, cleaner ${cleanerId}. Concerns: ${concerns || "none"}`);

  return res.json({
    success: true,
    message: "Cleaner will be paid. Please leave a review to help improve future cleanings.",
    completionStatus: "approved",
    payoutResults,
    reviewPending: true,
  });
}

/**
 * GET /status/:appointmentId
 * Get completion status for both cleaner and homeowner
 *
 * Query params:
 *   cleanerId: number (optional, for multi-cleaner jobs)
 */
completionRouter.get("/status/:appointmentId", verifyToken, async (req, res) => {
  const { appointmentId } = req.params;
  const { cleanerId } = req.query;

  try {
    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [
        { model: User, as: "user", attributes: ["id", "firstName", "lastName"] },
        { model: UserHomes, as: "home", attributes: ["id", "address", "city"] },
      ],
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify the user has access (homeowner or assigned cleaner)
    const userIdStr = String(req.userId);
    const assignedCleaners = (appointment.employeesAssigned || []).map(String);
    const isHomeowner = appointment.userId === req.userId;
    const isCleaner = assignedCleaners.includes(userIdStr);

    if (!isHomeowner && !isCleaner) {
      return res.status(403).json({ error: "You do not have access to this appointment" });
    }

    // Handle multi-cleaner jobs
    if (appointment.isMultiCleanerJob && appointment.multiCleanerJobId) {
      return handleMultiCleanerStatus(req, res, appointment, cleanerId, isHomeowner);
    }

    // Get photos for single-cleaner job
    const cleanerIdForPhotos = appointment.employeesAssigned?.[0];
    const photos = cleanerIdForPhotos ? await JobPhoto.findAll({
      where: { appointmentId, cleanerId: cleanerIdForPhotos },
      attributes: ["id", "photoType", "photoUrl", "createdAt"],
      order: [["createdAt", "ASC"]],
    }) : [];

    // Calculate time until auto-approval
    const timeUntilAutoApproval = appointment.getTimeUntilAutoApproval();

    return res.json({
      appointmentId: appointment.id,
      date: appointment.date,
      completionStatus: appointment.completionStatus,
      completionSubmittedAt: appointment.completionSubmittedAt,
      completionApprovedAt: appointment.completionApprovedAt,
      autoApprovalExpiresAt: appointment.autoApprovalExpiresAt,
      timeUntilAutoApproval,
      checklistData: appointment.completionChecklistData,
      notes: appointment.completionNotes,
      photos: photos.map(p => ({
        id: p.id,
        type: p.photoType,
        url: p.photoUrl,
      })),
      canApprove: isHomeowner && appointment.canBeApproved(),
      isMultiCleanerJob: false,
    });
  } catch (error) {
    console.error("[Completion] Status error:", error);
    return res.status(500).json({ error: "Failed to get completion status" });
  }
});

/**
 * Handle multi-cleaner status (per-cleaner or all cleaners)
 */
async function handleMultiCleanerStatus(req, res, appointment, cleanerIdParam, isHomeowner) {
  // Get all completion records for this appointment
  const completions = await CleanerJobCompletion.findAll({
    where: { appointmentId: appointment.id },
    include: [
      { model: User, as: "cleaner", attributes: ["id", "firstName", "lastName"] },
    ],
  });

  // If specific cleaner requested, return just that one
  if (cleanerIdParam) {
    const completion = completions.find(c => c.cleanerId === parseInt(cleanerIdParam, 10));
    if (!completion) {
      return res.status(404).json({ error: "No completion record found for this cleaner" });
    }

    const photos = await JobPhoto.findAll({
      where: { appointmentId: appointment.id, cleanerId: cleanerIdParam },
      attributes: ["id", "photoType", "photoUrl", "createdAt"],
      order: [["createdAt", "ASC"]],
    });

    return res.json({
      appointmentId: appointment.id,
      date: appointment.date,
      cleanerId: completion.cleanerId,
      cleanerName: completion.cleaner
        ? `${EncryptionService.decrypt(completion.cleaner.firstName)} ${EncryptionService.decrypt(completion.cleaner.lastName)}`
        : "Unknown",
      completionStatus: completion.completionStatus,
      completionSubmittedAt: completion.completionSubmittedAt,
      completionApprovedAt: completion.completionApprovedAt,
      autoApprovalExpiresAt: completion.autoApprovalExpiresAt,
      timeUntilAutoApproval: completion.getTimeUntilAutoApproval(),
      checklistData: completion.checklistProgress,
      notes: completion.completionNotes,
      photos: photos.map(p => ({
        id: p.id,
        type: p.photoType,
        url: p.photoUrl,
      })),
      canApprove: isHomeowner && completion.canBeApproved(),
      isMultiCleanerJob: true,
    });
  }

  // Return all cleaners' statuses
  const cleanerStatuses = await Promise.all(
    completions.map(async (completion) => {
      const photos = await JobPhoto.findAll({
        where: { appointmentId: appointment.id, cleanerId: completion.cleanerId },
        attributes: ["id", "photoType", "photoUrl"],
      });

      return {
        cleanerId: completion.cleanerId,
        cleanerName: completion.cleaner
          ? `${EncryptionService.decrypt(completion.cleaner.firstName)} ${EncryptionService.decrypt(completion.cleaner.lastName)}`
          : "Unknown",
        completionStatus: completion.completionStatus,
        completionSubmittedAt: completion.completionSubmittedAt,
        completionApprovedAt: completion.completionApprovedAt,
        autoApprovalExpiresAt: completion.autoApprovalExpiresAt,
        timeUntilAutoApproval: completion.getTimeUntilAutoApproval(),
        checklistData: completion.checklistProgress,
        notes: completion.completionNotes,
        photoCount: photos.length,
        canApprove: isHomeowner && completion.canBeApproved(),
      };
    })
  );

  return res.json({
    appointmentId: appointment.id,
    date: appointment.date,
    isMultiCleanerJob: true,
    cleaners: cleanerStatuses,
    allApproved: cleanerStatuses.every(c =>
      c.completionStatus === "approved" || c.completionStatus === "auto_approved"
    ),
    pendingApprovals: cleanerStatuses.filter(c => c.completionStatus === "submitted").length,
  });
}

/**
 * Process payout after approval (single-cleaner)
 * This calls the existing payout logic from paymentRouter
 */
async function processPayoutAfterApproval(appointment) {
  try {
    // Import the payout function from paymentRouter
    // Note: processCleanerPayouts is not exported, so we need to handle this differently
    // For now, we'll duplicate the necessary logic or make a direct call

    const { Payout, StripeConnectAccount, UserPendingRequests } = require("../../../models");
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const { getPricingConfig } = require("../../../config/businessConfig");

    // Clean up pending requests
    await UserPendingRequests.destroy({
      where: { appointmentId: appointment.id },
    });

    const cleanerIds = appointment.employeesAssigned || [];
    const results = [];

    // Get platform fee from database
    const pricing = await getPricingConfig();
    const platformFeePercent = pricing.platform.feePercent;

    for (const cleanerIdStr of cleanerIds) {
      const cleanerId = parseInt(cleanerIdStr, 10);
      try {
        // Get or create payout record
        let payout = await Payout.findOne({
          where: { appointmentId: appointment.id, cleanerId },
        });

        if (payout && payout.status === "completed") {
          results.push({ cleanerId, status: "already_paid" });
          continue;
        }

        // Get cleaner's Stripe Connect account
        const connectAccount = await StripeConnectAccount.findOne({
          where: { userId: cleanerId },
        });

        if (!connectAccount || !connectAccount.payoutsEnabled) {
          results.push({
            cleanerId,
            status: "skipped",
            reason: "Cleaner has not completed Stripe onboarding",
          });
          continue;
        }

        // Calculate amounts
        const payoutPrice = appointment.discountApplied && appointment.originalPrice
          ? parseFloat(appointment.originalPrice)
          : parseFloat(appointment.price);
        const priceInCents = Math.round(payoutPrice * 100);
        const perCleanerGross = Math.round(priceInCents / cleanerIds.length);
        const platformFee = Math.round(perCleanerGross * platformFeePercent);
        const netAmount = perCleanerGross - platformFee;

        // Create payout record if it doesn't exist
        if (!payout) {
          payout = await Payout.create({
            appointmentId: appointment.id,
            cleanerId,
            grossAmount: perCleanerGross,
            platformFee,
            netAmount,
            status: "processing",
            paymentCapturedAt: new Date(),
            transferInitiatedAt: new Date(),
          });
        } else {
          await payout.update({
            grossAmount: perCleanerGross,
            platformFee,
            netAmount,
            status: "processing",
            transferInitiatedAt: new Date(),
          });
        }

        // Get the charge ID
        let chargeId = null;
        if (appointment.paymentIntentId) {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(appointment.paymentIntentId);
            chargeId = paymentIntent.latest_charge;
          } catch (err) {
            console.error(`Could not retrieve payment intent:`, err.message);
          }
        }

        // Create Stripe Transfer
        const transferParams = {
          amount: netAmount,
          currency: "usd",
          destination: connectAccount.stripeAccountId,
          metadata: {
            appointmentId: appointment.id.toString(),
            cleanerId: cleanerId.toString(),
            payoutId: payout.id.toString(),
          },
        };

        if (chargeId) {
          transferParams.source_transaction = chargeId;
        }

        const transfer = await stripe.transfers.create(transferParams);

        await payout.update({
          stripeTransferId: transfer.id,
          status: "completed",
          transferCompletedAt: new Date(),
        });

        results.push({ cleanerId, status: "success", transferId: transfer.id });
      } catch (error) {
        console.error(`[Completion] Payout error for cleaner ${cleanerId}:`, error);
        results.push({ cleanerId, status: "error", error: error.message });
      }
    }

    return results;
  } catch (error) {
    console.error("[Completion] processPayoutAfterApproval error:", error);
    throw error;
  }
}

/**
 * Process payout for a specific cleaner in a multi-cleaner job
 */
async function processMultiCleanerPayoutForCleaner(appointment, cleanerId) {
  try {
    const { Payout, StripeConnectAccount, MultiCleanerJob, CleanerRoomAssignment } = require("../../../models");
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const { getPricingConfig } = require("../../../config/businessConfig");
    const MultiCleanerPricingService = require("../../../services/MultiCleanerPricingService");

    const multiCleanerJob = await MultiCleanerJob.findByPk(appointment.multiCleanerJobId);
    if (!multiCleanerJob) {
      throw new Error("Multi-cleaner job not found");
    }

    // Get room assignments for this cleaner
    const roomAssignments = await CleanerRoomAssignment.findAll({
      where: {
        appointmentId: appointment.id,
        cleanerId,
      },
    });

    // Calculate this cleaner's share
    const pricing = await getPricingConfig();
    const cleanerShare = await MultiCleanerPricingService.calculateCleanerShare(
      appointment,
      multiCleanerJob,
      cleanerId,
      roomAssignments,
      pricing
    );

    // Get or create payout record
    let payout = await Payout.findOne({
      where: { appointmentId: appointment.id, cleanerId },
    });

    if (payout && payout.status === "completed") {
      return { cleanerId, status: "already_paid" };
    }

    // Get cleaner's Stripe Connect account
    const connectAccount = await StripeConnectAccount.findOne({
      where: { userId: cleanerId },
    });

    if (!connectAccount || !connectAccount.payoutsEnabled) {
      return {
        cleanerId,
        status: "skipped",
        reason: "Cleaner has not completed Stripe onboarding",
      };
    }

    const grossAmount = cleanerShare.grossAmount;
    const platformFee = cleanerShare.platformFee;
    const netAmount = cleanerShare.netAmount;

    // Create payout record if it doesn't exist
    if (!payout) {
      payout = await Payout.create({
        appointmentId: appointment.id,
        cleanerId,
        grossAmount,
        platformFee,
        netAmount,
        status: "processing",
        paymentCapturedAt: new Date(),
        transferInitiatedAt: new Date(),
      });
    } else {
      await payout.update({
        grossAmount,
        platformFee,
        netAmount,
        status: "processing",
        transferInitiatedAt: new Date(),
      });
    }

    // Get the charge ID
    let chargeId = null;
    if (appointment.paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(appointment.paymentIntentId);
        chargeId = paymentIntent.latest_charge;
      } catch (err) {
        console.error(`Could not retrieve payment intent:`, err.message);
      }
    }

    // Create Stripe Transfer
    const transferParams = {
      amount: netAmount,
      currency: "usd",
      destination: connectAccount.stripeAccountId,
      metadata: {
        appointmentId: appointment.id.toString(),
        cleanerId: cleanerId.toString(),
        payoutId: payout.id.toString(),
        multiCleanerJobId: multiCleanerJob.id.toString(),
      },
    };

    if (chargeId) {
      transferParams.source_transaction = chargeId;
    }

    const transfer = await stripe.transfers.create(transferParams);

    await payout.update({
      stripeTransferId: transfer.id,
      status: "completed",
      transferCompletedAt: new Date(),
    });

    // Update CleanerJobCompletion with payout ID
    await CleanerJobCompletion.update(
      { payoutId: payout.id },
      { where: { appointmentId: appointment.id, cleanerId } }
    );

    return { cleanerId, status: "success", transferId: transfer.id };
  } catch (error) {
    console.error(`[Completion] Multi-cleaner payout error for cleaner ${cleanerId}:`, error);
    return { cleanerId, status: "error", error: error.message };
  }
}

/**
 * Check if all cleaners in a multi-cleaner job have been approved
 * If so, mark the parent appointment as completed
 */
async function checkAndUpdateParentAppointmentCompletion(appointmentId) {
  try {
    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [{ model: MultiCleanerJob, as: "multiCleanerJob" }],
    });

    if (!appointment || !appointment.isMultiCleanerJob) {
      return false;
    }

    // Get all completion records for this appointment
    const completions = await CleanerJobCompletion.findAll({
      where: {
        appointmentId,
        status: { [require("sequelize").Op.notIn]: ["dropped_out", "no_show"] },
      },
    });

    if (completions.length === 0) {
      return false;
    }

    // Check if all active cleaners have been approved (approved or auto_approved)
    const allApproved = completions.every(
      (c) => c.completionStatus === "approved" || c.completionStatus === "auto_approved"
    );

    if (allApproved && !appointment.completed) {
      // All cleaners are done - mark parent appointment as completed
      await appointment.update({
        completed: true,
        completionStatus: "approved",
        completionApprovedAt: new Date(),
      });

      console.log(`[Completion] All cleaners approved for multi-cleaner appointment ${appointmentId} - marked as completed`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[Completion] Error checking parent appointment completion for ${appointmentId}:`, error);
    return false;
  }
}

module.exports = completionRouter;
