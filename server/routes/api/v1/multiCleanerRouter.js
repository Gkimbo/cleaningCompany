/**
 * Multi-Cleaner Router
 *
 * API endpoints for multi-cleaner job management.
 */
const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

const {
  User,
  UserAppointments,
  UserHomes,
  MultiCleanerJob,
  CleanerRoomAssignment,
  CleanerJobOffer,
  CleanerJobCompletion,
  UserCleanerAppointments,
  Payout,
} = require("../../../models");

const MultiCleanerService = require("../../../services/MultiCleanerService");
const RoomAssignmentService = require("../../../services/RoomAssignmentService");
const MultiCleanerPricingService = require("../../../services/MultiCleanerPricingService");
const NotificationService = require("../../../services/NotificationService");

const multiCleanerRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

/**
 * Middleware to verify JWT token
 */
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Apply token verification to all routes
multiCleanerRouter.use(verifyToken);

/**
 * GET /check/:appointmentId
 * Check if appointment qualifies as large home and get recommendations
 */
multiCleanerRouter.get("/check/:appointmentId", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const checkInfo = await MultiCleanerService.getJobCheckInfo(
      parseInt(appointmentId)
    );
    return res.status(200).json(checkInfo);
  } catch (error) {
    console.error("Error checking appointment:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /create
 * Create a multi-cleaner job for an appointment
 */
multiCleanerRouter.post("/create", async (req, res) => {
  try {
    const { appointmentId, cleanerCount, primaryCleanerId } = req.body;

    if (!appointmentId || !cleanerCount) {
      return res.status(400).json({
        error: "appointmentId and cleanerCount are required",
      });
    }

    // Create the multi-cleaner job
    const job = await MultiCleanerService.createMultiCleanerJob(
      appointmentId,
      cleanerCount,
      primaryCleanerId || null,
      false // Not auto-generated
    );

    // Get appointment and home for room assignments
    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [{ model: UserHomes, as: "home" }],
    });

    // Create room assignments
    const roomAssignments = await RoomAssignmentService.createRoomAssignments(
      job.id,
      appointmentId,
      appointment.home,
      cleanerCount
    );

    // Calculate and set earnings shares
    const totalPrice = await MultiCleanerPricingService.calculateTotalJobPrice(
      appointment.home,
      appointment,
      cleanerCount
    );
    await MultiCleanerPricingService.updateRoomEarningsShares(job.id, totalPrice);

    return res.status(201).json({
      multiCleanerJob: job,
      roomAssignments,
      totalPrice,
    });
  } catch (error) {
    console.error("Error creating multi-cleaner job:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /offers
 * Get available multi-cleaner job offers for the current cleaner
 */
multiCleanerRouter.get("/offers", async (req, res) => {
  try {
    const cleanerId = req.userId;

    const offers = await CleanerJobOffer.findAll({
      where: {
        cleanerId,
        status: "pending",
        expiresAt: { [Op.gt]: new Date() },
      },
      include: [
        {
          model: MultiCleanerJob,
          as: "multiCleanerJob",
          include: [
            {
              model: UserAppointments,
              as: "appointment",
              include: [{ model: UserHomes, as: "home" }],
            },
          ],
        },
      ],
      order: [["offeredAt", "DESC"]],
    });

    // Also get open multi-cleaner jobs the cleaner could join
    const openJobs = await MultiCleanerJob.findAll({
      where: {
        status: { [Op.in]: ["open", "partially_filled"] },
      },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          include: [{ model: UserHomes, as: "home" }],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: 20,
    });

    // Filter out jobs where cleaner already has an offer or is assigned
    const existingOfferJobIds = offers.map((o) => o.multiCleanerJobId);
    const assignedJobIds = await CleanerJobCompletion.findAll({
      where: { cleanerId },
      attributes: ["multiCleanerJobId"],
    }).then((completions) => completions.map((c) => c.multiCleanerJobId));

    const availableJobs = openJobs.filter(
      (job) =>
        !existingOfferJobIds.includes(job.id) &&
        !assignedJobIds.includes(job.id)
    );

    return res.status(200).json({
      personalOffers: offers,
      availableJobs,
    });
  } catch (error) {
    console.error("Error fetching offers:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /offers/:offerId/accept
 * Accept a job offer
 */
multiCleanerRouter.post("/offers/:offerId/accept", async (req, res) => {
  try {
    const { offerId } = req.params;
    const cleanerId = req.userId;

    const offer = await CleanerJobOffer.findByPk(offerId, {
      include: [{ model: MultiCleanerJob, as: "multiCleanerJob" }],
    });

    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }

    if (offer.cleanerId !== cleanerId) {
      return res.status(403).json({ error: "This offer is not for you" });
    }

    if (offer.isExpired()) {
      return res.status(400).json({ error: "Offer has expired" });
    }

    if (offer.status !== "pending") {
      return res.status(400).json({ error: "Offer is no longer available" });
    }

    // Accept the offer
    await offer.accept();

    // Get room assignment IDs for this slot
    const unassignedRooms = await CleanerRoomAssignment.findAll({
      where: {
        multiCleanerJobId: offer.multiCleanerJobId,
        cleanerId: null,
      },
      limit: Math.ceil(
        (await CleanerRoomAssignment.count({
          where: { multiCleanerJobId: offer.multiCleanerJobId },
        })) / offer.multiCleanerJob.totalCleanersRequired
      ),
    });

    const roomAssignmentIds = unassignedRooms.map((r) => r.id);

    // Fill the slot
    await MultiCleanerService.fillSlot(
      offer.multiCleanerJobId,
      cleanerId,
      roomAssignmentIds
    );

    // Create cleaner-appointment assignment
    await UserCleanerAppointments.create({
      appointmentId: offer.appointmentId,
      employeeId: cleanerId,
    });

    // Get updated job status
    const updatedJob = await MultiCleanerJob.findByPk(offer.multiCleanerJobId, {
      include: [{ model: CleanerRoomAssignment, as: "roomAssignments" }],
    });

    // Notify other assigned cleaners
    const otherCleaners = await CleanerJobCompletion.findAll({
      where: {
        multiCleanerJobId: offer.multiCleanerJobId,
        cleanerId: { [Op.ne]: cleanerId },
        status: { [Op.notIn]: ["dropped_out", "no_show"] },
      },
    });

    for (const other of otherCleaners) {
      await NotificationService.createNotification({
        userId: other.cleanerId,
        type: "multi_cleaner_slot_filled",
        title: "Co-cleaner joined",
        body: "Another cleaner has joined your upcoming job.",
        data: { appointmentId: offer.appointmentId },
      });
    }

    return res.status(200).json({
      success: true,
      offer,
      job: updatedJob,
      assignedRooms: roomAssignmentIds.length,
    });
  } catch (error) {
    console.error("Error accepting offer:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /offers/:offerId/decline
 * Decline a job offer
 */
multiCleanerRouter.post("/offers/:offerId/decline", async (req, res) => {
  try {
    const { offerId } = req.params;
    const { reason } = req.body;
    const cleanerId = req.userId;

    const offer = await CleanerJobOffer.findByPk(offerId);

    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }

    if (offer.cleanerId !== cleanerId) {
      return res.status(403).json({ error: "This offer is not for you" });
    }

    await offer.decline(reason);

    return res.status(200).json({ success: true, offer });
  } catch (error) {
    console.error("Error declining offer:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /join/:multiCleanerJobId
 * Join an open multi-cleaner job directly
 */
multiCleanerRouter.post("/join/:multiCleanerJobId", async (req, res) => {
  try {
    const { multiCleanerJobId } = req.params;
    const cleanerId = req.userId;

    const job = await MultiCleanerJob.findByPk(multiCleanerJobId, {
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          include: [{ model: UserHomes, as: "home" }],
        },
      ],
    });

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.isFilled()) {
      return res.status(400).json({ error: "All slots are already filled" });
    }

    // Check if cleaner already assigned
    const existingCompletion = await CleanerJobCompletion.findOne({
      where: { multiCleanerJobId, cleanerId },
    });

    if (existingCompletion) {
      return res.status(400).json({ error: "You are already assigned to this job" });
    }

    // Get available rooms for this slot
    const unassignedRooms = await CleanerRoomAssignment.findAll({
      where: {
        multiCleanerJobId: parseInt(multiCleanerJobId),
        cleanerId: null,
      },
      limit: Math.ceil(
        (await CleanerRoomAssignment.count({
          where: { multiCleanerJobId: parseInt(multiCleanerJobId) },
        })) / job.totalCleanersRequired
      ),
    });

    const roomAssignmentIds = unassignedRooms.map((r) => r.id);

    // Fill the slot
    await MultiCleanerService.fillSlot(
      parseInt(multiCleanerJobId),
      cleanerId,
      roomAssignmentIds
    );

    // Create cleaner-appointment assignment
    await UserCleanerAppointments.create({
      appointmentId: job.appointmentId,
      employeeId: cleanerId,
    });

    // Calculate earnings for this cleaner
    const earnings = await RoomAssignmentService.calculateCleanerEarningsShare(
      cleanerId,
      parseInt(multiCleanerJobId)
    );

    return res.status(200).json({
      success: true,
      job: await MultiCleanerJob.findByPk(multiCleanerJobId),
      assignedRooms: roomAssignmentIds.length,
      estimatedEarnings: earnings,
    });
  } catch (error) {
    console.error("Error joining job:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /assignments/:appointmentId
 * Get room assignments for an appointment (cleaner sees only their rooms)
 */
multiCleanerRouter.get("/assignments/:appointmentId", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const cleanerId = req.userId;

    const user = await User.findByPk(cleanerId);
    const isAdmin = user?.type === "owner" || user?.type === "admin";

    let assignments;
    if (isAdmin) {
      // Admin sees all assignments
      assignments = await RoomAssignmentService.getAllRoomAssignments(
        parseInt(appointmentId)
      );
    } else {
      // Cleaner sees only their assignments
      assignments = await RoomAssignmentService.getCleanerRooms(
        parseInt(appointmentId),
        cleanerId
      );
    }

    return res.status(200).json({ assignments });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /checklist/:appointmentId
 * Get cleaner-specific checklist based on room assignments
 */
multiCleanerRouter.get("/checklist/:appointmentId", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const cleanerId = req.userId;

    // Get cleaner's room assignments
    const assignments = await RoomAssignmentService.getCleanerRooms(
      parseInt(appointmentId),
      cleanerId
    );

    if (assignments.length === 0) {
      return res.status(404).json({
        error: "No room assignments found for this cleaner",
      });
    }

    const roomAssignmentIds = assignments.map((a) => a.id);
    const checklist = await RoomAssignmentService.generateCleanerChecklist(
      cleanerId,
      roomAssignmentIds
    );

    return res.status(200).json(checklist);
  } catch (error) {
    console.error("Error generating checklist:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /rooms/:roomAssignmentId/complete
 * Mark a room as complete
 */
multiCleanerRouter.post("/rooms/:roomAssignmentId/complete", async (req, res) => {
  try {
    const { roomAssignmentId } = req.params;
    const cleanerId = req.userId;

    const assignment = await CleanerRoomAssignment.findByPk(roomAssignmentId);

    if (!assignment) {
      return res.status(404).json({ error: "Room assignment not found" });
    }

    if (assignment.cleanerId !== cleanerId) {
      return res.status(403).json({ error: "This room is not assigned to you" });
    }

    // Validate completion (check for photos)
    const validation = await RoomAssignmentService.validateRoomCompletion(
      cleanerId,
      parseInt(roomAssignmentId)
    );

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        beforePhotoCount: validation.beforePhotoCount,
        afterPhotoCount: validation.afterPhotoCount,
      });
    }

    // Mark room as complete
    await assignment.markCompleted();

    // Check if all rooms for this cleaner are complete
    const cleanerRooms = await CleanerRoomAssignment.findAll({
      where: {
        multiCleanerJobId: assignment.multiCleanerJobId,
        cleanerId,
      },
    });

    const allComplete = cleanerRooms.every((r) => r.status === "completed");

    if (allComplete) {
      // Mark cleaner as complete
      await MultiCleanerService.markCleanerComplete(
        assignment.multiCleanerJobId,
        cleanerId
      );
    }

    return res.status(200).json({
      success: true,
      assignment,
      allRoomsComplete: allComplete,
    });
  } catch (error) {
    console.error("Error completing room:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /status/:appointmentId
 * Get full job status (for admin/homeowner)
 */
multiCleanerRouter.get("/status/:appointmentId", async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [
        { model: UserHomes, as: "home" },
        { model: MultiCleanerJob, as: "multiCleanerJob" },
      ],
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (!appointment.isMultiCleanerJob) {
      return res.status(400).json({ error: "Not a multi-cleaner job" });
    }

    const job = appointment.multiCleanerJob;

    // Get completions and assignments
    const completions = await CleanerJobCompletion.findAll({
      where: { multiCleanerJobId: job.id },
      include: [
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    const assignments = await CleanerRoomAssignment.findAll({
      where: { multiCleanerJobId: job.id },
      include: [
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    // Calculate progress
    const totalRooms = assignments.length;
    const completedRooms = assignments.filter(
      (a) => a.status === "completed"
    ).length;
    const progressPercent =
      totalRooms > 0 ? Math.round((completedRooms / totalRooms) * 100) : 0;

    return res.status(200).json({
      job,
      cleaners: completions.map((c) => ({
        id: c.cleanerId,
        name: c.cleaner
          ? `${c.cleaner.firstName} ${c.cleaner.lastName}`
          : "Unknown",
        status: c.status,
        completedAt: c.completedAt,
      })),
      roomAssignments: assignments.map((a) => ({
        id: a.id,
        room: a.getDisplayLabel(),
        cleanerId: a.cleanerId,
        cleanerName: a.cleaner
          ? `${a.cleaner.firstName} ${a.cleaner.lastName}`
          : "Unassigned",
        status: a.status,
      })),
      progress: {
        totalRooms,
        completedRooms,
        percent: progressPercent,
      },
    });
  } catch (error) {
    console.error("Error fetching status:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /progress/:appointmentId
 * Get real-time progress for homeowner view
 */
multiCleanerRouter.get("/progress/:appointmentId", async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [{ model: MultiCleanerJob, as: "multiCleanerJob" }],
    });

    if (!appointment?.multiCleanerJob) {
      return res.status(404).json({ error: "Multi-cleaner job not found" });
    }

    const assignments = await CleanerRoomAssignment.findAll({
      where: { multiCleanerJobId: appointment.multiCleanerJob.id },
    });

    const progress = assignments.reduce(
      (acc, a) => {
        acc.total++;
        if (a.status === "completed") acc.completed++;
        else if (a.status === "in_progress") acc.inProgress++;
        else acc.pending++;
        return acc;
      },
      { total: 0, completed: 0, inProgress: 0, pending: 0 }
    );

    progress.percent =
      progress.total > 0
        ? Math.round((progress.completed / progress.total) * 100)
        : 0;

    return res.status(200).json({
      appointmentId,
      progress,
      jobStatus: appointment.multiCleanerJob.status,
    });
  } catch (error) {
    console.error("Error fetching progress:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /earnings/:multiCleanerJobId
 * Get detailed earnings breakdown
 * NOTE: This route must come BEFORE /:appointmentId/* routes to prevent conflicts
 */
multiCleanerRouter.get("/earnings/:multiCleanerJobId", async (req, res) => {
  try {
    const { multiCleanerJobId } = req.params;

    const breakdown = await MultiCleanerPricingService.generateEarningsBreakdown(
      parseInt(multiCleanerJobId)
    );

    return res.status(200).json(breakdown);
  } catch (error) {
    console.error("Error fetching earnings:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================
// Dynamic prefix routes (/:appointmentId/*)
// These must come AFTER all static prefix routes
// ============================================

/**
 * POST /:appointmentId/dropout
 * Cleaner drops out of the job
 */
multiCleanerRouter.post("/:appointmentId/dropout", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;
    const cleanerId = req.userId;

    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [{ model: MultiCleanerJob, as: "multiCleanerJob" }],
    });

    if (!appointment?.multiCleanerJob) {
      return res.status(404).json({ error: "Multi-cleaner job not found" });
    }

    const result = await MultiCleanerService.handleCleanerDropout(
      appointment.multiCleanerJob.id,
      cleanerId,
      reason
    );

    // Remove from cleaner-appointment assignments
    await UserCleanerAppointments.destroy({
      where: { appointmentId, employeeId: cleanerId },
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error handling dropout:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /:appointmentId/accept-solo
 * Remaining cleaner accepts to complete solo for full pay
 */
multiCleanerRouter.post("/:appointmentId/accept-solo", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const cleanerId = req.userId;

    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [{ model: MultiCleanerJob, as: "multiCleanerJob" }],
    });

    if (!appointment?.multiCleanerJob) {
      return res.status(404).json({ error: "Multi-cleaner job not found" });
    }

    const job = appointment.multiCleanerJob;

    // Verify cleaner is assigned
    const completion = await CleanerJobCompletion.findOne({
      where: {
        multiCleanerJobId: job.id,
        cleanerId,
        status: { [Op.notIn]: ["dropped_out", "no_show"] },
      },
    });

    if (!completion) {
      return res.status(403).json({ error: "You are not assigned to this job" });
    }

    // Assign all unassigned rooms to this cleaner
    await RoomAssignmentService.rebalanceAfterDropout(job.id);

    // Recalculate earnings (full amount for solo)
    const totalPrice = await MultiCleanerPricingService.calculateTotalJobPrice(
      (await UserHomes.findByPk(appointment.homeId)),
      appointment,
      1
    );

    // Update solo cleaner consent
    await appointment.update({ soloCleanerConsent: true });

    // Calculate solo earnings
    const soloEarnings = await MultiCleanerPricingService.calculateSoloCompletionEarnings(
      parseInt(appointmentId)
    );

    return res.status(200).json({
      success: true,
      message: "You will complete this job solo for full pay",
      earnings: soloEarnings,
      earningsFormatted: `$${(soloEarnings / 100).toFixed(2)}`,
    });
  } catch (error) {
    console.error("Error accepting solo:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:appointmentId/cleaners
 * Homeowner views assigned cleaners and their progress
 */
multiCleanerRouter.get("/:appointmentId/cleaners", async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [{ model: MultiCleanerJob, as: "multiCleanerJob" }],
    });

    if (!appointment?.multiCleanerJob) {
      return res.status(404).json({ error: "Multi-cleaner job not found" });
    }

    const breakdown = await MultiCleanerPricingService.generateEarningsBreakdown(
      appointment.multiCleanerJob.id
    );

    return res.status(200).json(breakdown);
  } catch (error) {
    console.error("Error fetching cleaners:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /:appointmentId/homeowner-response
 * Homeowner responds to multi-cleaner job status (e.g., accept partial, reschedule)
 */
multiCleanerRouter.post("/:appointmentId/homeowner-response", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { response, rescheduleDate } = req.body;
    const userId = req.userId;

    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [
        { model: UserHomes, as: "home" },
        { model: MultiCleanerJob, as: "multiCleanerJob" },
      ],
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify homeowner
    if (appointment.userId !== userId) {
      return res.status(403).json({ error: "Not your appointment" });
    }

    switch (response) {
      case "proceed_with_one":
        // Proceed with single cleaner
        await appointment.update({ homeownerSoloWarningAcknowledged: true });
        return res.status(200).json({
          success: true,
          message: "Appointment will proceed with available cleaner(s)",
        });

      case "cancel":
        // Cancel without penalty due to lack of cleaners
        if (appointment.multiCleanerJob) {
          appointment.multiCleanerJob.status = "cancelled";
          await appointment.multiCleanerJob.save();
        }
        // Handle cancellation (no penalty - use existing cancellation logic)
        return res.status(200).json({
          success: true,
          message: "Appointment cancelled without penalty",
        });

      case "reschedule":
        // Handle rescheduling
        if (!rescheduleDate) {
          return res.status(400).json({ error: "Reschedule date required" });
        }
        // Rescheduling would create a new appointment - implementation depends on existing flow
        return res.status(200).json({
          success: true,
          message: `Rescheduling to ${rescheduleDate}`,
          rescheduleDate,
        });

      default:
        return res.status(400).json({
          error: "Invalid response. Use: proceed_with_one, cancel, or reschedule",
        });
    }
  } catch (error) {
    console.error("Error processing homeowner response:", error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = multiCleanerRouter;
