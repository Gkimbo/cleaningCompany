/**
 * Cleaner Approval Router
 *
 * API endpoints for homeowner approval/decline of non-preferred cleaners
 * joining multi-cleaner jobs.
 */
const express = require("express");
const jwt = require("jsonwebtoken");

const CleanerApprovalService = require("../../../services/CleanerApprovalService");
const EncryptionService = require("../../../services/EncryptionService");

const cleanerApprovalRouter = express.Router();
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

cleanerApprovalRouter.use(verifyToken);

/**
 * GET /my-requests
 * Get pending join requests for the authenticated cleaner
 */
cleanerApprovalRouter.get("/my-requests", async (req, res) => {
  try {
    const { CleanerRoomAssignment } = require("../../../models");
    const requests = await CleanerApprovalService.getPendingRequestsForCleaner(req.userId);

    // Serialize with appointment, home details, and room assignments
    const serialized = await Promise.all(requests.map(async (r) => {
      // Get room assignments for this request
      let assignedRooms = [];
      if (r.roomAssignmentIds && r.roomAssignmentIds.length > 0) {
        const roomAssignments = await CleanerRoomAssignment.findAll({
          where: { id: r.roomAssignmentIds },
        });
        assignedRooms = roomAssignments.map((ra) => ({
          id: ra.id,
          roomType: ra.roomType,
          roomNumber: ra.roomNumber,
          roomLabel: ra.roomLabel,
        }));
      }

      // Calculate assigned bedrooms and bathrooms for linens
      const assignedBedrooms = assignedRooms.filter((r) => r.roomType === "bedroom").length;
      const assignedBathrooms = assignedRooms.filter((r) => r.roomType === "bathroom").length;

      return {
        id: r.id,
        multiCleanerJobId: r.multiCleanerJobId,
        appointmentId: r.appointmentId,
        homeId: r.homeId,
        status: r.status,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
        roomAssignmentIds: r.roomAssignmentIds,
        assignedRooms,
        assignedBedrooms,
        assignedBathrooms,
        appointment: r.appointment
          ? {
              id: r.appointment.id,
              date: r.appointment.date,
              price: r.appointment.price,
              timeToBeCompleted: r.appointment.timeToBeCompleted,
              bringSheets: r.appointment.bringSheets,
              bringTowels: r.appointment.bringTowels,
              home: r.appointment.home
                ? {
                    id: r.appointment.home.id,
                    nickName: r.appointment.home.nickName,
                    address: EncryptionService.decrypt(r.appointment.home.address),
                    city: EncryptionService.decrypt(r.appointment.home.city),
                    state: EncryptionService.decrypt(r.appointment.home.state),
                    zipcode: r.appointment.home.zipcode,
                    numBeds: r.appointment.home.numBeds,
                    numBaths: r.appointment.home.numBaths,
                    latitude: r.appointment.home.latitude,
                    longitude: r.appointment.home.longitude,
                  }
                : null,
            }
          : null,
        multiCleanerJob: r.multiCleanerJob
          ? {
              id: r.multiCleanerJob.id,
              totalCleanersRequired: r.multiCleanerJob.totalCleanersRequired,
              cleanersConfirmed: r.multiCleanerJob.cleanersConfirmed,
              status: r.multiCleanerJob.status,
            }
          : null,
      };
    }));

    return res.json({ requests: serialized });
  } catch (error) {
    console.error("Error fetching cleaner's pending requests:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /pending
 * Get pending join requests for the authenticated homeowner
 */
cleanerApprovalRouter.get("/pending", async (req, res) => {
  try {
    const requests = await CleanerApprovalService.getPendingRequestsForHomeowner(req.userId);

    // Serialize with decrypted cleaner names
    const serialized = requests.map((r) => ({
      id: r.id,
      cleanerId: r.cleanerId,
      cleanerName: r.cleaner
        ? `${EncryptionService.decrypt(r.cleaner.firstName)} ${EncryptionService.decrypt(r.cleaner.lastName)}`.trim()
        : "Unknown",
      cleanerFirstName: r.cleaner ? EncryptionService.decrypt(r.cleaner.firstName) : "",
      appointmentId: r.appointmentId,
      multiCleanerJobId: r.multiCleanerJobId,
      homeId: r.homeId,
      appointmentDate: r.appointment?.date,
      homeAddress: r.appointment?.home
        ? `${EncryptionService.decrypt(r.appointment.home.address)}, ${EncryptionService.decrypt(r.appointment.home.city)}`
        : null,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }));

    return res.json({ requests: serialized });
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /appointment/:appointmentId
 * Get pending join requests for a specific appointment
 */
cleanerApprovalRouter.get("/appointment/:appointmentId", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const requests = await CleanerApprovalService.getPendingRequestsForAppointment(
      parseInt(appointmentId)
    );

    // Serialize with decrypted cleaner names
    const serialized = requests.map((r) => ({
      id: r.id,
      cleanerId: r.cleanerId,
      cleanerName: r.cleaner
        ? `${EncryptionService.decrypt(r.cleaner.firstName)} ${EncryptionService.decrypt(r.cleaner.lastName)}`.trim()
        : "Unknown",
      cleanerFirstName: r.cleaner ? EncryptionService.decrypt(r.cleaner.firstName) : "",
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }));

    return res.json({ requests: serialized });
  } catch (error) {
    console.error("Error fetching appointment requests:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /:requestId/approve
 * Homeowner approves a join request
 */
cleanerApprovalRouter.post("/:requestId/approve", async (req, res) => {
  try {
    const { requestId } = req.params;
    const result = await CleanerApprovalService.approveRequest(
      parseInt(requestId),
      req.userId
    );
    return res.json(result);
  } catch (error) {
    console.error("Error approving request:", error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /:requestId/decline
 * Homeowner declines a join request
 */
cleanerApprovalRouter.post("/:requestId/decline", async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const result = await CleanerApprovalService.declineRequest(
      parseInt(requestId),
      req.userId,
      reason
    );
    return res.json(result);
  } catch (error) {
    console.error("Error declining request:", error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /:requestId/cancel
 * Cleaner cancels/withdraws their own join request
 */
cleanerApprovalRouter.post("/:requestId/cancel", async (req, res) => {
  try {
    const { requestId } = req.params;
    const result = await CleanerApprovalService.cancelRequest(
      parseInt(requestId),
      req.userId
    );
    return res.json(result);
  } catch (error) {
    console.error("Error cancelling request:", error);
    return res.status(400).json({ error: error.message });
  }
});

module.exports = cleanerApprovalRouter;
