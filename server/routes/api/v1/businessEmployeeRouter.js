const express = require("express");
const router = express.Router();
const verifyBusinessEmployee = require("../../../middleware/verifyBusinessEmployee");
const authenticateToken = require("../../../middleware/authenticatedToken");
const BusinessEmployeeService = require("../../../services/BusinessEmployeeService");
const EmployeeJobAssignmentService = require("../../../services/EmployeeJobAssignmentService");
const MarketplaceJobRequirementsService = require("../../../services/MarketplaceJobRequirementsService");
const AppointmentJobFlowService = require("../../../services/AppointmentJobFlowService");
const BusinessEmployeeSerializer = require("../../../serializers/BusinessEmployeeSerializer");
const EmployeeJobAssignmentSerializer = require("../../../serializers/EmployeeJobAssignmentSerializer");
const { BusinessEmployee, EmployeeJobAssignment, User, JobPhoto, AppointmentJobFlow, sequelize } = require("../../../models");

// =====================================
// Public Routes (Invitation)
// =====================================

/**
 * GET /invite/:token - Validate invitation token
 */
router.get("/invite/:token", async (req, res) => {
  try {
    const result = await BusinessEmployeeService.validateInviteToken(req.params.token);

    if (!result) {
      return res.status(404).json({ error: "Invalid invitation link" });
    }

    if (result.isExpired) {
      return res.status(410).json({ error: "Invitation has expired", isExpired: true });
    }

    if (result.isAlreadyAccepted) {
      return res.status(409).json({ error: "Invitation already accepted", isAlreadyAccepted: true });
    }

    if (result.isTerminated) {
      return res.status(410).json({ error: "This employee record has been terminated", isTerminated: true });
    }

    res.json({
      valid: true,
      invitation: BusinessEmployeeSerializer.serializeInvitation(result),
    });
  } catch (error) {
    console.error("Error validating invite:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /invite/:token/accept - Accept invitation
 * Requires authenticated user
 */
router.post("/invite/:token/accept", authenticateToken, async (req, res) => {
  try {
    const employee = await BusinessEmployeeService.acceptInvite(
      req.params.token,
      req.user.id
    );

    res.json({
      message: "Welcome! You have joined the team.",
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        status: employee.status,
      },
    });
  } catch (error) {
    console.error("Error accepting invite:", error);
    res.status(400).json({ error: error.message });
  }
});

// =====================================
// Protected Routes (Authenticated Employee)
// =====================================

// Apply employee middleware to all routes below
router.use(verifyBusinessEmployee);

/**
 * GET /my-jobs - Get assigned jobs
 */
router.get("/my-jobs", async (req, res) => {
  try {
    const { status, upcoming } = req.query;

    const jobs = await EmployeeJobAssignmentService.getMyJobs(req.user.id, {
      status,
      upcoming: upcoming === "true",
    });

    res.json({ jobs: EmployeeJobAssignmentSerializer.serializeArrayForEmployee(jobs, req.employeeRecord) });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /my-jobs/:assignmentId - Get single job details
 * For marketplace jobs, address visibility is restricted until within 24 hours or job started
 */
router.get("/my-jobs/:assignmentId", async (req, res) => {
  try {
    const { EmployeeJobAssignment, UserAppointments, UserHomes, User, BusinessEmployee } = require("../../../models");
    const { Op } = require("sequelize");

    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: parseInt(req.params.assignmentId),
        businessEmployeeId: req.employeeRecord.id,
        // Only show jobs in valid states
        status: { [Op.notIn]: ["cancelled", "no_show"] },
      },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          include: [
            {
              model: UserHomes,
              as: "home",
              // Fetch all fields, we'll filter below based on permissions
              attributes: ["id", "address", "numBeds", "numBaths", "keyPadCode", "keyLocation", "notes"],
            },
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "phone", "email"],
            },
          ],
        },
      ],
    });

    if (!assignment) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Check marketplace job address visibility restrictions
    const isMarketplace = assignment.isMarketplacePickup;
    const jobDate = new Date(assignment.appointment.date);
    const now = new Date();
    const hoursUntilJob = (jobDate - now) / (1000 * 60 * 60);
    const isWithin24Hours = hoursUntilJob <= 24;
    const hasStarted = assignment.status === "started" || assignment.status === "completed";
    const canViewDetails = req.employeeRecord.canViewClientDetails;

    // For marketplace jobs not within 24 hours and not started, restrict address
    const addressRestricted = isMarketplace && !isWithin24Hours && !hasStarted;

    // Get plain object for manipulation
    const plainAssignment = assignment.get({ plain: true });

    // Apply visibility restrictions to home data
    if (plainAssignment.appointment.home) {
      if (addressRestricted) {
        // Restrict address for marketplace jobs not yet within 24 hours
        const fullAddress = plainAssignment.appointment.home.address;
        const parts = fullAddress ? fullAddress.split(",") : [];
        const generalArea = parts.length >= 2
          ? parts[parts.length - 2].trim().split(" ")[0] + " area"
          : "Location confirmed";

        plainAssignment.appointment.home = {
          id: plainAssignment.appointment.home.id,
          numBeds: plainAssignment.appointment.home.numBeds,
          numBaths: plainAssignment.appointment.home.numBaths,
          generalArea,
          addressRestricted: true,
          restrictionMessage: "Full address available 24 hours before scheduled time or when job starts",
        };
      } else if (!canViewDetails) {
        // No permission to view client details
        plainAssignment.appointment.home = {
          id: plainAssignment.appointment.home.id,
          numBeds: plainAssignment.appointment.home.numBeds,
          numBaths: plainAssignment.appointment.home.numBaths,
        };
      }
    }

    // Apply visibility restrictions to user data
    if (plainAssignment.appointment.user) {
      if (addressRestricted || !canViewDetails) {
        plainAssignment.appointment.user = {
          id: plainAssignment.appointment.user.id,
          firstName: plainAssignment.appointment.user.firstName,
        };
      }
    }

    // Serialize the job with proper permissions
    const jobData = EmployeeJobAssignmentSerializer.serializeForEmployee(
      { ...assignment.dataValues, appointment: plainAssignment.appointment },
      req.employeeRecord
    );

    // Preserve the visibility restriction info
    if (addressRestricted) {
      jobData.addressRestricted = true;
      jobData.restrictionMessage = "Full address available 24 hours before scheduled time or when job starts";
    }

    // Fetch co-workers assigned to the same appointment
    const coWorkerAssignments = await EmployeeJobAssignment.findAll({
      where: {
        appointmentId: assignment.appointmentId,
        businessEmployeeId: { [Op.ne]: req.employeeRecord.id }, // Exclude current employee
        status: { [Op.notIn]: ["cancelled"] }, // Exclude cancelled assignments
      },
      include: [
        {
          model: BusinessEmployee,
          as: "employee",
          attributes: ["id", "firstName", "lastName", "phone"],
        },
      ],
    });

    // Format co-workers list
    jobData.coWorkers = coWorkerAssignments.map((cw) => ({
      id: cw.employee?.id,
      firstName: cw.employee?.firstName,
      lastName: cw.employee?.lastName,
      phone: cw.employee?.phone,
    }));

    // Add current employee info
    jobData.currentEmployee = {
      firstName: req.employeeRecord.firstName,
      lastName: req.employeeRecord.lastName,
    };

    // Add marketplace job requirements info
    if (isMarketplace) {
      jobData.isMarketplacePickup = true;
      jobData.requiresChecklist = true;
      jobData.requiresPhotos = true;
      jobData.completionRequirements = assignment.getCompletionRequirements();
    }

    res.json({ job: jobData });
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /my-jobs/:assignmentId/start - Start a job
 */
router.post("/my-jobs/:assignmentId/start", async (req, res) => {
  try {
    const assignment = await EmployeeJobAssignmentService.startJob(
      parseInt(req.params.assignmentId),
      req.user.id
    );

    res.json({ message: "Job started", assignment });
  } catch (error) {
    console.error("Error starting job:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /my-jobs/:assignmentId/complete - Complete a job
 */
router.post("/my-jobs/:assignmentId/complete", async (req, res) => {
  try {
    const { hoursWorked } = req.body;

    const assignment = await EmployeeJobAssignmentService.completeJob(
      parseInt(req.params.assignmentId),
      req.user.id,
      hoursWorked
    );

    res.json({ message: "Job completed", assignment });
  } catch (error) {
    console.error("Error completing job:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /my-earnings - Get earnings summary
 */
router.get("/my-earnings", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const now = new Date();
    const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const end = endDate || now.toISOString().split("T")[0];

    // Get completed assignments
    const assignments = await EmployeeJobAssignment.findAll({
      where: {
        businessEmployeeId: req.employeeRecord.id,
        status: "completed",
      },
      include: [
        {
          model: require("../../../models").UserAppointments,
          as: "appointment",
          where: {
            date: {
              [require("sequelize").Op.gte]: start,
              [require("sequelize").Op.lte]: end,
            },
          },
          attributes: ["id", "date"],
        },
      ],
    });

    const totalEarnings = assignments.reduce((sum, a) => sum + a.payAmount, 0);
    const jobCount = assignments.length;
    const paidCount = assignments.filter(
      (a) => a.payoutStatus === "paid" || a.payoutStatus === "paid_outside_platform"
    ).length;
    const pendingCount = jobCount - paidCount;
    const pendingAmount = assignments
      .filter((a) => a.payoutStatus === "pending")
      .reduce((sum, a) => sum + a.payAmount, 0);

    res.json({
      period: { startDate: start, endDate: end },
      summary: {
        totalEarnings,
        jobCount,
        paidCount,
        pendingCount,
        pendingAmount,
      },
      formatted: {
        totalEarnings: `$${(totalEarnings / 100).toFixed(2)}`,
        pendingAmount: `$${(pendingAmount / 100).toFixed(2)}`,
      },
      // Only include job breakdown if allowed
      jobs: req.employeeRecord.canViewJobEarnings
        ? assignments.map((a) => ({
            date: a.appointment.date,
            payAmount: a.payAmount,
            formattedPay: `$${(a.payAmount / 100).toFixed(2)}`,
            status: a.payoutStatus,
          }))
        : undefined,
    });
  } catch (error) {
    console.error("Error fetching earnings:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /my-profile - Get employee profile
 */
router.get("/my-profile", async (req, res) => {
  try {
    const employee = await BusinessEmployee.findByPk(req.employeeRecord.id, {
      include: [
        {
          model: User,
          as: "businessOwner",
          attributes: ["id", "firstName", "lastName", "businessName"],
        },
      ],
    });

    res.json({
      profile: BusinessEmployeeSerializer.serializeProfile(employee),
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================
// Stripe Connect Routes (for employees using Stripe)
// =====================================

/**
 * POST /stripe-connect/onboard - Start Stripe Connect onboarding
 */
router.post("/stripe-connect/onboard", async (req, res) => {
  try {
    if (req.employeeRecord.paymentMethod !== "stripe_connect") {
      return res.status(400).json({ error: "This employee is not set up for Stripe payments" });
    }

    // TODO: Implement Stripe Connect onboarding for employees
    // This would create a connected account and return an onboarding link
    res.status(501).json({ error: "Stripe Connect onboarding not yet implemented" });
  } catch (error) {
    console.error("Error starting Stripe onboarding:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /stripe-connect/status - Check Stripe Connect status
 */
router.get("/stripe-connect/status", async (req, res) => {
  try {
    res.json({
      paymentMethod: req.employeeRecord.paymentMethod,
      stripeConnectOnboarded: req.employeeRecord.stripeConnectOnboarded,
      stripeAccountId: req.employeeRecord.stripeConnectAccountId || null,
    });
  } catch (error) {
    console.error("Error checking Stripe status:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================
// Marketplace Job Requirements Routes
// (Checklist and Photos for marketplace pickups)
// =====================================

/**
 * GET /my-jobs/:assignmentId/checklist - Get checklist for a job
 */
router.get("/my-jobs/:assignmentId/checklist", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);

    // Verify employee is assigned to this job
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessEmployeeId: req.employeeRecord.id,
      },
      include: [{ model: AppointmentJobFlow, as: "jobFlow" }],
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // Use AppointmentJobFlowService if job flow exists, otherwise fall back to legacy
    if (assignment.jobFlow) {
      const checklistInfo = await AppointmentJobFlowService.getChecklist(assignment.jobFlow.id);
      res.json({
        checklist: checklistInfo.snapshotData,
        progress: checklistInfo.progress || {},
        checklistCompleted: checklistInfo.completed,
        jobNotes: checklistInfo.jobNotes,
        hasChecklist: checklistInfo.hasChecklist,
        itemCount: checklistInfo.itemCount,
        completedCount: checklistInfo.completedCount,
        completionPercentage: checklistInfo.completionPercentage,
        isMarketplacePickup: assignment.isMarketplacePickup,
      });
    } else {
      // Legacy fallback for assignments without job flow
      const checklist = await MarketplaceJobRequirementsService.getPublishedChecklist();
      res.json({
        checklist,
        progress: assignment.checklistProgress || {},
        checklistCompleted: assignment.checklistCompleted,
        isMarketplacePickup: assignment.isMarketplacePickup,
      });
    }
  } catch (error) {
    console.error("Error fetching checklist:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /my-jobs/:assignmentId/checklist - Update checklist progress
 * Accepts either:
 *   - status: "completed" | "na" | null (new format)
 *   - completed: boolean (legacy format, converted to status)
 */
router.put("/my-jobs/:assignmentId/checklist", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);
    const { sectionId, itemId, status, completed } = req.body;

    // Normalize status - prefer 'status' param, fall back to 'completed' boolean
    let normalizedStatus = status;
    if (normalizedStatus === undefined && completed !== undefined) {
      normalizedStatus = completed ? "completed" : null;
    }

    // Verify employee is assigned to this job
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessEmployeeId: req.employeeRecord.id,
        status: { [sequelize.Sequelize.Op.in]: ["assigned", "started"] },
      },
      include: [{ model: AppointmentJobFlow, as: "jobFlow" }],
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found or job already completed" });
    }

    let result;

    // Use AppointmentJobFlowService if job flow exists, otherwise fall back to legacy
    if (assignment.jobFlow) {
      result = await AppointmentJobFlowService.updateChecklistProgress(
        assignment.jobFlow.id,
        sectionId,
        itemId,
        normalizedStatus
      );

      // Sync to legacy fields for backwards compatibility
      await assignment.update({
        checklistProgress: result.checklistProgress,
        checklistCompleted: result.checklistCompleted,
      });
    } else {
      // Legacy fallback - doesn't support N/A, only completed/incomplete
      const isCompleted = normalizedStatus === "completed";
      if (isCompleted) {
        result = await MarketplaceJobRequirementsService.markChecklistItemComplete(
          assignmentId,
          sectionId,
          itemId
        );
      } else {
        result = await MarketplaceJobRequirementsService.markChecklistItemIncomplete(
          assignmentId,
          sectionId,
          itemId
        );
      }
    }

    res.json({
      message: "Checklist updated",
      ...result,
    });
  } catch (error) {
    console.error("Error updating checklist:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /my-jobs/:assignmentId/checklist/bulk - Bulk update checklist progress
 */
router.put("/my-jobs/:assignmentId/checklist/bulk", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);
    const { updates } = req.body;

    // Verify employee is assigned to this job
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessEmployeeId: req.employeeRecord.id,
        status: { [sequelize.Sequelize.Op.in]: ["assigned", "started"] },
      },
      include: [{ model: AppointmentJobFlow, as: "jobFlow" }],
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found or job already completed" });
    }

    let result;

    // Use AppointmentJobFlowService if job flow exists, otherwise fall back to legacy
    if (assignment.jobFlow) {
      result = await AppointmentJobFlowService.bulkUpdateChecklistProgress(
        assignment.jobFlow.id,
        updates
      );

      // Sync to legacy fields for backwards compatibility
      await assignment.update({
        checklistProgress: result.checklistProgress,
        checklistCompleted: result.checklistCompleted,
      });
    } else {
      // Legacy fallback
      result = await MarketplaceJobRequirementsService.bulkUpdateChecklistProgress(
        assignmentId,
        updates
      );
    }

    res.json({
      message: "Checklist updated",
      ...result,
    });
  } catch (error) {
    console.error("Error bulk updating checklist:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /my-jobs/:assignmentId/photos - Upload a photo for a job
 */
router.post("/my-jobs/:assignmentId/photos", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);
    const { photoType, photoData, room, notes } = req.body;

    if (!photoType || !photoData) {
      return res.status(400).json({ error: "photoType and photoData are required" });
    }

    if (!["before", "after"].includes(photoType)) {
      return res.status(400).json({ error: "photoType must be 'before' or 'after'" });
    }

    // Verify employee is assigned to this job
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessEmployeeId: req.employeeRecord.id,
        status: { [sequelize.Sequelize.Op.in]: ["assigned", "started"] },
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found or job already completed" });
    }

    // If uploading 'after' photos, verify 'before' photos exist
    if (photoType === "after") {
      const beforeCount = await JobPhoto.count({
        where: {
          appointmentId: assignment.appointmentId,
          cleanerId: req.user.id,
          photoType: "before",
        },
      });
      if (beforeCount === 0) {
        return res.status(400).json({ error: "You must upload before photos first" });
      }
    }

    // Create the photo
    const photo = await JobPhoto.create({
      appointmentId: assignment.appointmentId,
      cleanerId: req.user.id,
      photoType,
      photoData,
      room: room || null,
      notes: notes || null,
      takenAt: new Date(),
    });

    // Update photo counts - use AppointmentJobFlowService if job flow exists
    let photoCounts;
    if (assignment.appointmentJobFlowId) {
      photoCounts = await AppointmentJobFlowService.updatePhotoCounts(
        assignment.appointmentJobFlowId,
        req.user.id
      );
      // Sync to legacy fields
      await assignment.update({
        beforePhotoCount: photoCounts.beforePhotoCount,
        afterPhotoCount: photoCounts.afterPhotoCount,
        photosCompleted: photoCounts.photosCompleted,
      });
    } else {
      // Legacy fallback
      photoCounts = await MarketplaceJobRequirementsService.updatePhotoCounts(
        assignmentId,
        req.user.id
      );
    }

    res.status(201).json({
      success: true,
      photo: {
        id: photo.id,
        photoType: photo.photoType,
        room: photo.room,
        takenAt: photo.takenAt,
      },
      ...photoCounts,
    });
  } catch (error) {
    console.error("Error uploading photo:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /my-jobs/:assignmentId/photos - Get photos for a job
 */
router.get("/my-jobs/:assignmentId/photos", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);

    // Verify employee is assigned to this job
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessEmployeeId: req.employeeRecord.id,
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // Get photos for this appointment uploaded by this employee
    const photos = await JobPhoto.findAll({
      where: {
        appointmentId: assignment.appointmentId,
        cleanerId: req.user.id,
      },
      attributes: ["id", "photoType", "photoData", "room", "notes", "takenAt"],
      order: [["takenAt", "ASC"]],
    });

    const beforePhotos = photos.filter((p) => p.photoType === "before");
    const afterPhotos = photos.filter((p) => p.photoType === "after");

    res.json({
      beforePhotos,
      afterPhotos,
      beforePhotoCount: beforePhotos.length,
      afterPhotoCount: afterPhotos.length,
      photosCompleted: assignment.photosCompleted,
    });
  } catch (error) {
    console.error("Error fetching photos:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /my-jobs/:assignmentId/photos/:photoId - Delete a photo
 */
router.delete("/my-jobs/:assignmentId/photos/:photoId", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);
    const photoId = parseInt(req.params.photoId);

    // Verify employee is assigned to this job
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessEmployeeId: req.employeeRecord.id,
        status: { [sequelize.Sequelize.Op.in]: ["assigned", "started"] },
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found or job already completed" });
    }

    // Find and delete the photo
    const photo = await JobPhoto.findOne({
      where: {
        id: photoId,
        cleanerId: req.user.id,
        appointmentId: assignment.appointmentId,
      },
    });

    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    await photo.destroy();

    // Update photo counts - use AppointmentJobFlowService if job flow exists
    let photoCounts;
    if (assignment.appointmentJobFlowId) {
      photoCounts = await AppointmentJobFlowService.updatePhotoCounts(
        assignment.appointmentJobFlowId,
        req.user.id
      );
      // Sync to legacy fields
      await assignment.update({
        beforePhotoCount: photoCounts.beforePhotoCount,
        afterPhotoCount: photoCounts.afterPhotoCount,
        photosCompleted: photoCounts.photosCompleted,
      });
    } else {
      // Legacy fallback
      photoCounts = await MarketplaceJobRequirementsService.updatePhotoCounts(
        assignmentId,
        req.user.id
      );
    }

    res.json({
      success: true,
      message: "Photo deleted",
      ...photoCounts,
    });
  } catch (error) {
    console.error("Error deleting photo:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /my-jobs/:assignmentId/completion-status - Get completion status for a job
 */
router.get("/my-jobs/:assignmentId/completion-status", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);

    // Verify employee is assigned to this job
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessEmployeeId: req.employeeRecord.id,
      },
      include: [{ model: AppointmentJobFlow, as: "jobFlow" }],
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // Use AppointmentJobFlowService if job flow exists, otherwise fall back to legacy
    if (assignment.jobFlow) {
      const status = await AppointmentJobFlowService.getCompletionStatus(assignment.jobFlow.id);
      res.json({
        ...status,
        assignmentId,
        status: assignment.status,
      });
    } else {
      // Legacy fallback
      const status = await MarketplaceJobRequirementsService.getCompletionStatus(assignmentId);
      res.json(status);
    }
  } catch (error) {
    console.error("Error fetching completion status:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /my-jobs/:assignmentId/flow-details - Get full job flow details
 */
router.get("/my-jobs/:assignmentId/flow-details", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);

    // Verify employee is assigned to this job
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessEmployeeId: req.employeeRecord.id,
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const flowDetails = await AppointmentJobFlowService.getFlowDetailsForEmployee(assignmentId);

    res.json(flowDetails);
  } catch (error) {
    console.error("Error fetching flow details:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /my-jobs/:assignmentId/notes - Add employee notes
 */
router.post("/my-jobs/:assignmentId/notes", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);
    const { notes } = req.body;

    // Verify employee is assigned to this job
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessEmployeeId: req.employeeRecord.id,
        status: { [sequelize.Sequelize.Op.in]: ["assigned", "started"] },
      },
      include: [{ model: AppointmentJobFlow, as: "jobFlow" }],
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found or job already completed" });
    }

    if (!assignment.jobFlow) {
      return res.status(400).json({ error: "No job flow associated with this assignment" });
    }

    const updatedFlow = await AppointmentJobFlowService.updateEmployeeNotes(
      assignment.jobFlow.id,
      notes
    );

    res.json({
      message: "Notes updated",
      employeeNotes: updatedFlow.employeeNotes,
    });
  } catch (error) {
    console.error("Error updating notes:", error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
