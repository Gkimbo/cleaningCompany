const express = require("express");
const jwt = require("jsonwebtoken");
const { JobPhoto, UserAppointments, User, CleanerJobCompletion } = require("../../../models");

const jobPhotosRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid token" });
  }
};

/**
 * Upload a job photo (before, after, or passes)
 * POST /api/v1/job-photos/upload
 */
jobPhotosRouter.post("/upload", authenticateToken, async (req, res) => {
  const { appointmentId, photoType, photoData, room, notes, isNotApplicable } = req.body;
  const cleanerId = req.user.userId;

  try {
    // Validate required fields
    if (!appointmentId || !photoType) {
      return res.status(400).json({
        error: "appointmentId and photoType are required",
      });
    }

    // For passes with N/A, photoData is not required
    if (!photoData && !isNotApplicable) {
      return res.status(400).json({
        error: "photoData is required unless marking as N/A",
      });
    }

    // Validate photoType
    if (!["before", "after", "passes"].includes(photoType)) {
      return res.status(400).json({
        error: "photoType must be 'before', 'after', or 'passes'",
      });
    }

    // Verify the appointment exists and cleaner is assigned
    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const cleanerIdStr = cleanerId.toString();
    if (
      !appointment.employeesAssigned ||
      !appointment.employeesAssigned.includes(cleanerIdStr)
    ) {
      return res.status(403).json({
        error: "You are not assigned to this appointment",
      });
    }

    // If uploading 'after' photos, verify 'before' photos exist
    if (photoType === "after") {
      const beforePhotos = await JobPhoto.count({
        where: { appointmentId, cleanerId, photoType: "before" },
      });
      if (beforePhotos === 0) {
        return res.status(400).json({
          error: "You must upload before photos first",
        });
      }
    }

    // Create the photo record
    const photo = await JobPhoto.create({
      appointmentId,
      cleanerId,
      photoType,
      photoData: isNotApplicable ? null : photoData,
      room: room || null,
      notes: notes || null,
      takenAt: new Date(),
      isNotApplicable: isNotApplicable || false,
    });

    // Track job start time on first before photo upload
    if (photoType === "before") {
      // Check if this is the first before photo for this cleaner
      const beforePhotoCount = await JobPhoto.count({
        where: { appointmentId, cleanerId, photoType: "before" },
      });

      // If this is the first before photo (count is 1 after creating above)
      if (beforePhotoCount === 1) {
        const now = new Date();

        if (appointment.isMultiCleanerJob && appointment.multiCleanerJobId) {
          // For multi-cleaner jobs, update CleanerJobCompletion
          await CleanerJobCompletion.update(
            { jobStartedAt: now },
            { where: { appointmentId, cleanerId, jobStartedAt: null } }
          );
        } else {
          // For single-cleaner jobs, update the appointment
          if (!appointment.jobStartedAt) {
            await appointment.update({ jobStartedAt: now });
          }
        }
        console.log(`[JobPhotos] Set jobStartedAt for appointment ${appointmentId}, cleaner ${cleanerId}`);
      }
    }

    return res.status(201).json({
      success: true,
      photo: {
        id: photo.id,
        appointmentId: photo.appointmentId,
        photoType: photo.photoType,
        room: photo.room,
        takenAt: photo.takenAt,
        isNotApplicable: photo.isNotApplicable,
      },
    });
  } catch (error) {
    console.error("Error uploading job photo:", error);
    return res.status(500).json({ error: "Failed to upload photo" });
  }
});

/**
 * Get photos for an appointment
 * GET /api/v1/job-photos/:appointmentId
 */
jobPhotosRouter.get("/:appointmentId", authenticateToken, async (req, res) => {
  const { appointmentId } = req.params;
  const userId = req.user.userId;

  console.log(`[JobPhotos] Fetching photos for appointment ${appointmentId} by user ${userId}`);

  try {
    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) {
      console.log(`[JobPhotos] Appointment ${appointmentId} not found`);
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Check if user is authorized (either the cleaner or the home owner/admin)
    const user = await User.findByPk(userId);
    const isAssignedCleaner =
      appointment.employeesAssigned &&
      appointment.employeesAssigned.includes(userId.toString());
    const isOwner = appointment.userId === userId;
    const isAdmin = user && user.type === "admin";

    console.log(`[JobPhotos] Authorization check: isAssignedCleaner=${isAssignedCleaner}, isOwner=${isOwner}, isAdmin=${isAdmin}`);

    if (!isAssignedCleaner && !isOwner && !isAdmin) {
      console.log(`[JobPhotos] User ${userId} not authorized to view photos for appointment ${appointmentId}`);
      return res.status(403).json({ error: "Not authorized to view photos" });
    }

    const photos = await JobPhoto.findAll({
      where: { appointmentId },
      attributes: ["id", "photoType", "photoData", "room", "notes", "takenAt", "cleanerId", "isNotApplicable"],
      order: [["takenAt", "ASC"]],
    });

    const beforePhotos = photos.filter((p) => p.photoType === "before");
    const afterPhotos = photos.filter((p) => p.photoType === "after");
    const passesPhotos = photos.filter((p) => p.photoType === "passes");

    console.log(`[JobPhotos] Returning ${beforePhotos.length} before, ${afterPhotos.length} after, and ${passesPhotos.length} passes photos`);

    // Passes are considered complete if there's at least one passes photo (including N/A)
    const hasPassesPhotos = passesPhotos.length > 0;

    return res.json({
      appointmentId: parseInt(appointmentId),
      beforePhotos,
      afterPhotos,
      passesPhotos,
      hasBeforePhotos: beforePhotos.length > 0,
      hasAfterPhotos: afterPhotos.length > 0,
      hasPassesPhotos,
      canComplete: beforePhotos.length > 0 && afterPhotos.length > 0 && hasPassesPhotos,
    });
  } catch (error) {
    console.error("Error fetching job photos:", error);
    return res.status(500).json({ error: "Failed to fetch photos" });
  }
});

/**
 * Get photo status for an appointment (lightweight check)
 * GET /api/v1/job-photos/:appointmentId/status
 * Works for both cleaners (see their own photos) and homeowners (see all photos)
 */
jobPhotosRouter.get("/:appointmentId/status", authenticateToken, async (req, res) => {
  const { appointmentId } = req.params;
  const userId = req.user.userId;

  console.log(`[JobPhotos] Status request for appointment ${appointmentId} by user ${userId}`);

  try {
    // Check if user is the homeowner for this appointment
    const appointment = await UserAppointments.findByPk(appointmentId);
    const isHomeowner = appointment && appointment.userId === userId;
    console.log(`[JobPhotos] User ${userId} isHomeowner: ${isHomeowner}, appointment.userId: ${appointment?.userId}`);

    // For homeowners, show all photos; for cleaners, show their own photos
    const whereClause = isHomeowner
      ? { appointmentId, photoType: "before" }
      : { appointmentId, cleanerId: userId, photoType: "before" };

    const afterWhereClause = isHomeowner
      ? { appointmentId, photoType: "after" }
      : { appointmentId, cleanerId: userId, photoType: "after" };

    const passesWhereClause = isHomeowner
      ? { appointmentId, photoType: "passes" }
      : { appointmentId, cleanerId: userId, photoType: "passes" };

    const beforeCount = await JobPhoto.count({ where: whereClause });
    const afterCount = await JobPhoto.count({ where: afterWhereClause });
    const passesCount = await JobPhoto.count({ where: passesWhereClause });

    return res.json({
      appointmentId: parseInt(appointmentId),
      beforePhotosCount: beforeCount,
      afterPhotosCount: afterCount,
      passesPhotosCount: passesCount,
      hasBeforePhotos: beforeCount > 0,
      hasAfterPhotos: afterCount > 0,
      hasPassesPhotos: passesCount > 0,
      canComplete: beforeCount > 0 && afterCount > 0 && passesCount > 0,
    });
  } catch (error) {
    console.error("Error fetching photo status:", error);
    return res.status(500).json({ error: "Failed to fetch photo status" });
  }
});

/**
 * Delete a photo (only by the cleaner who uploaded it)
 * DELETE /api/v1/job-photos/:photoId
 */
jobPhotosRouter.delete("/:photoId", authenticateToken, async (req, res) => {
  const { photoId } = req.params;
  const cleanerId = req.user.userId;

  try {
    const photo = await JobPhoto.findByPk(photoId);
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    if (photo.cleanerId !== cleanerId) {
      return res.status(403).json({
        error: "You can only delete your own photos",
      });
    }

    // Check if the job is already completed
    const appointment = await UserAppointments.findByPk(photo.appointmentId);
    if (appointment && appointment.completed) {
      return res.status(400).json({
        error: "Cannot delete photos from completed jobs",
      });
    }

    await photo.destroy();

    return res.json({ success: true, message: "Photo deleted" });
  } catch (error) {
    console.error("Error deleting photo:", error);
    return res.status(500).json({ error: "Failed to delete photo" });
  }
});

/**
 * Get flow settings for an appointment
 * Returns photo requirements and custom checklist if configured
 * GET /api/v1/job-photos/:appointmentId/flow-settings
 */
jobPhotosRouter.get("/:appointmentId/flow-settings", authenticateToken, async (req, res) => {
  const { appointmentId } = req.params;
  const cleanerId = req.user.userId;

  try {
    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [
        {
          model: require("../../../models").UserHomes,
          as: "home",
          attributes: ["id", "preferredCleanerId"],
        },
      ],
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify cleaner is assigned
    const cleanerIdStr = cleanerId.toString();
    if (!appointment.employeesAssigned?.includes(cleanerIdStr)) {
      return res.status(403).json({ error: "You are not assigned to this appointment" });
    }

    // Check if there's a job flow for this appointment
    const AppointmentJobFlowService = require("../../../services/AppointmentJobFlowService");

    // Try to get flow details - this service checks for assigned flows
    const flowDetails = await AppointmentJobFlowService.getFlowDetailsForAppointment(appointmentId);

    if (flowDetails) {
      return res.json({
        photoRequirement: flowDetails.photoRequirement || "required",
        hasChecklist: flowDetails.hasChecklist || false,
        checklist: flowDetails.checklist || null,
        jobNotes: flowDetails.jobNotes || null,
      });
    }

    // No custom flow, return defaults
    const isBusinessOwner = appointment.home?.preferredCleanerId === cleanerId;
    return res.json({
      photoRequirement: isBusinessOwner ? "optional" : "required",
      hasChecklist: false,
      checklist: null,
      jobNotes: null,
    });
  } catch (error) {
    console.error("Error fetching flow settings:", error);
    return res.status(500).json({ error: "Failed to fetch flow settings" });
  }
});

module.exports = jobPhotosRouter;
