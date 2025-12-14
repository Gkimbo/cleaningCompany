const express = require("express");
const jwt = require("jsonwebtoken");
const { JobPhoto, UserAppointments, User } = require("../../../models");

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
 * Upload a job photo (before or after)
 * POST /api/v1/job-photos/upload
 */
jobPhotosRouter.post("/upload", authenticateToken, async (req, res) => {
  const { appointmentId, photoType, photoData, room, notes } = req.body;
  const cleanerId = req.user.userId;

  try {
    // Validate required fields
    if (!appointmentId || !photoType || !photoData) {
      return res.status(400).json({
        error: "appointmentId, photoType, and photoData are required",
      });
    }

    // Validate photoType
    if (!["before", "after"].includes(photoType)) {
      return res.status(400).json({
        error: "photoType must be 'before' or 'after'",
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
      photoData,
      room: room || null,
      notes: notes || null,
      takenAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      photo: {
        id: photo.id,
        appointmentId: photo.appointmentId,
        photoType: photo.photoType,
        room: photo.room,
        takenAt: photo.takenAt,
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

  try {
    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Check if user is authorized (either the cleaner or the home owner/admin)
    const user = await User.findByPk(userId);
    const isAssignedCleaner =
      appointment.employeesAssigned &&
      appointment.employeesAssigned.includes(userId.toString());
    const isOwner = appointment.userId === userId;
    const isAdmin = user && user.type === "admin";

    if (!isAssignedCleaner && !isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to view photos" });
    }

    const photos = await JobPhoto.findAll({
      where: { appointmentId },
      attributes: ["id", "photoType", "photoData", "room", "notes", "takenAt", "cleanerId"],
      order: [["takenAt", "ASC"]],
    });

    const beforePhotos = photos.filter((p) => p.photoType === "before");
    const afterPhotos = photos.filter((p) => p.photoType === "after");

    return res.json({
      appointmentId: parseInt(appointmentId),
      beforePhotos,
      afterPhotos,
      hasBeforePhotos: beforePhotos.length > 0,
      hasAfterPhotos: afterPhotos.length > 0,
      canComplete: beforePhotos.length > 0 && afterPhotos.length > 0,
    });
  } catch (error) {
    console.error("Error fetching job photos:", error);
    return res.status(500).json({ error: "Failed to fetch photos" });
  }
});

/**
 * Get photo status for an appointment (lightweight check)
 * GET /api/v1/job-photos/:appointmentId/status
 */
jobPhotosRouter.get("/:appointmentId/status", authenticateToken, async (req, res) => {
  const { appointmentId } = req.params;
  const cleanerId = req.user.userId;

  try {
    const beforeCount = await JobPhoto.count({
      where: { appointmentId, cleanerId, photoType: "before" },
    });

    const afterCount = await JobPhoto.count({
      where: { appointmentId, cleanerId, photoType: "after" },
    });

    return res.json({
      appointmentId: parseInt(appointmentId),
      beforePhotosCount: beforeCount,
      afterPhotosCount: afterCount,
      hasBeforePhotos: beforeCount > 0,
      hasAfterPhotos: afterCount > 0,
      canComplete: beforeCount > 0 && afterCount > 0,
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

module.exports = jobPhotosRouter;
