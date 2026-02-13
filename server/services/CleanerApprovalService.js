/**
 * CleanerApprovalService
 *
 * Handles the approval workflow for non-preferred cleaners
 * joining multi-cleaner jobs. Preferred cleaners are auto-approved.
 */

const { Op } = require("sequelize");

// 48 hours in milliseconds
const APPROVAL_TIMEOUT_MS = 48 * 60 * 60 * 1000;

class CleanerApprovalService {
  /**
   * Check if a cleaner is preferred for a specific home
   * @param {number} cleanerId - The cleaner's user ID
   * @param {number} homeId - The home ID
   * @returns {Promise<boolean>}
   */
  static async isPreferredCleaner(cleanerId, homeId) {
    const { HomePreferredCleaner, UserHomes } = require("../models");

    // Check HomePreferredCleaner table
    const preferredRecord = await HomePreferredCleaner.findOne({
      where: { homeId, cleanerId },
    });

    if (preferredRecord) {
      return true;
    }

    // Also check the primary preferredCleanerId on UserHomes
    const home = await UserHomes.findByPk(homeId);
    if (home && home.preferredCleanerId === cleanerId) {
      return true;
    }

    return false;
  }

  /**
   * Request to join a multi-cleaner job
   * Auto-approves if cleaner is preferred, otherwise creates approval request
   * @param {number} multiCleanerJobId - Job ID
   * @param {number} cleanerId - Cleaner ID
   * @param {Array<number>} roomAssignmentIds - Room assignment IDs to tentatively assign
   * @returns {Promise<Object>} Result with status
   */
  static async requestToJoin(multiCleanerJobId, cleanerId, roomAssignmentIds = []) {
    const {
      MultiCleanerJob,
      UserAppointments,
      UserHomes,
      CleanerJoinRequest,
    } = require("../models");
    const MultiCleanerService = require("./MultiCleanerService");
    const NotificationService = require("./NotificationService");

    const job = await MultiCleanerJob.findByPk(multiCleanerJobId);
    if (!job) {
      throw new Error("Multi-cleaner job not found");
    }

    if (job.isFilled()) {
      throw new Error("All cleaner slots are already filled");
    }

    const appointment = await UserAppointments.findByPk(job.appointmentId, {
      include: [{ model: UserHomes, as: "home" }],
    });

    if (!appointment || !appointment.home) {
      throw new Error("Appointment or home not found");
    }

    const homeId = appointment.homeId;
    const homeownerId = appointment.userId;

    // Check if cleaner is preferred for this home
    const isPreferred = await this.isPreferredCleaner(cleanerId, homeId);

    if (isPreferred) {
      // Auto-approve: directly fill the slot
      await MultiCleanerService.fillSlot(multiCleanerJobId, cleanerId, roomAssignmentIds);

      return {
        status: "approved",
        autoApproved: true,
        isPreferred: true,
        message: "You have been automatically approved as a preferred cleaner.",
      };
    }

    // Non-preferred cleaner: create approval request
    const expiresAt = new Date(Date.now() + APPROVAL_TIMEOUT_MS);

    // Check for existing pending request
    const existingRequest = await CleanerJoinRequest.findOne({
      where: {
        multiCleanerJobId,
        cleanerId,
        status: "pending",
      },
    });

    if (existingRequest) {
      throw new Error("You already have a pending request for this job");
    }

    const joinRequest = await CleanerJoinRequest.create({
      multiCleanerJobId,
      appointmentId: job.appointmentId,
      homeId,
      cleanerId,
      homeownerId,
      status: "pending",
      roomAssignmentIds,
      expiresAt,
    });

    // Notify homeowner
    await this.notifyHomeownerOfRequest(joinRequest, appointment, cleanerId);

    return {
      status: "pending",
      autoApproved: false,
      isPreferred: false,
      joinRequestId: joinRequest.id,
      expiresAt,
      message: "Your request to join has been sent to the homeowner for approval.",
    };
  }

  /**
   * Homeowner approves a join request
   * @param {number} joinRequestId - Join request ID
   * @param {number} homeownerId - Homeowner user ID
   * @returns {Promise<Object>} Result
   */
  static async approveRequest(joinRequestId, homeownerId) {
    const { CleanerJoinRequest, User, MultiCleanerJob } = require("../models");
    const MultiCleanerService = require("./MultiCleanerService");
    const NotificationService = require("./NotificationService");
    const EncryptionService = require("./EncryptionService");

    const request = await CleanerJoinRequest.findByPk(joinRequestId, {
      include: [{ model: MultiCleanerJob, as: "multiCleanerJob" }],
    });

    if (!request) {
      throw new Error("Join request not found");
    }

    if (request.homeownerId !== homeownerId) {
      throw new Error("You are not authorized to approve this request");
    }

    if (request.status !== "pending") {
      throw new Error(`Request is no longer pending (status: ${request.status})`);
    }

    // Check if job is still open
    if (request.multiCleanerJob && request.multiCleanerJob.isFilled()) {
      await request.cancel();
      throw new Error("This job has already been filled");
    }

    // Fill the slot
    await MultiCleanerService.fillSlot(
      request.multiCleanerJobId,
      request.cleanerId,
      request.roomAssignmentIds || []
    );

    // Create cleaner-appointment assignment so job shows in cleaner's My Jobs
    const { UserCleanerAppointments } = require("../models");
    await UserCleanerAppointments.findOrCreate({
      where: {
        appointmentId: request.appointmentId,
        employeeId: request.cleanerId,
      },
    });

    // Update request status
    await request.approve();

    // Notify the cleaner
    const cleaner = await User.findByPk(request.cleanerId);
    const cleanerFirstName = cleaner ? EncryptionService.decrypt(cleaner.firstName) : "Cleaner";

    await NotificationService.createNotification({
      userId: request.cleanerId,
      type: "join_request_approved",
      title: "Request Approved!",
      body: "Your request to join the cleaning job has been approved by the homeowner.",
      data: {
        appointmentId: request.appointmentId,
        multiCleanerJobId: request.multiCleanerJobId,
      },
      relatedAppointmentId: request.appointmentId,
    });

    // Check if job is now filled and cancel other pending requests
    const updatedJob = await MultiCleanerJob.findByPk(request.multiCleanerJobId);
    if (updatedJob && updatedJob.isFilled()) {
      await this.cancelPendingRequestsForJob(request.multiCleanerJobId);
    }

    return {
      success: true,
      message: "Cleaner has been approved and assigned to the job.",
    };
  }

  /**
   * Homeowner declines a join request
   * @param {number} joinRequestId - Join request ID
   * @param {number} homeownerId - Homeowner user ID
   * @param {string} reason - Optional decline reason
   * @returns {Promise<Object>} Result
   */
  static async declineRequest(joinRequestId, homeownerId, reason = null) {
    const { CleanerJoinRequest, User } = require("../models");
    const NotificationService = require("./NotificationService");

    const request = await CleanerJoinRequest.findByPk(joinRequestId);

    if (!request) {
      throw new Error("Join request not found");
    }

    if (request.homeownerId !== homeownerId) {
      throw new Error("You are not authorized to decline this request");
    }

    if (request.status !== "pending") {
      throw new Error(`Request is no longer pending (status: ${request.status})`);
    }

    // Update request status
    await request.decline(reason);

    // Notify the cleaner
    await NotificationService.createNotification({
      userId: request.cleanerId,
      type: "join_request_declined",
      title: "Request Not Approved",
      body: reason
        ? `The homeowner did not approve your request to join. Reason: ${reason}`
        : "The homeowner did not approve your request to join this cleaning job.",
      data: {
        appointmentId: request.appointmentId,
        multiCleanerJobId: request.multiCleanerJobId,
        reason,
      },
      relatedAppointmentId: request.appointmentId,
    });

    return {
      success: true,
      message: "Request has been declined.",
    };
  }

  /**
   * Auto-approve expired pending requests (called by cron job)
   * @returns {Promise<Object>} Result with counts
   */
  static async autoApproveExpiredRequests() {
    const { CleanerJoinRequest, MultiCleanerJob, User } = require("../models");
    const MultiCleanerService = require("./MultiCleanerService");
    const NotificationService = require("./NotificationService");
    const EncryptionService = require("./EncryptionService");

    const expiredRequests = await CleanerJoinRequest.findExpiredPendingRequests();

    let approved = 0;
    let cancelled = 0;
    let errors = 0;

    for (const request of expiredRequests) {
      try {
        // Check if job is still open
        const job = await MultiCleanerJob.findByPk(request.multiCleanerJobId);

        if (!job || job.isFilled()) {
          // Job is filled or gone, cancel this request
          await request.cancel();
          cancelled++;
          continue;
        }

        // Auto-approve: fill the slot
        await MultiCleanerService.fillSlot(
          request.multiCleanerJobId,
          request.cleanerId,
          request.roomAssignmentIds || []
        );

        // Update request status
        await request.autoApprove();

        // Notify the cleaner
        await NotificationService.createNotification({
          userId: request.cleanerId,
          type: "join_request_auto_approved",
          title: "Request Auto-Approved",
          body: "Your request to join the cleaning job has been automatically approved.",
          data: {
            appointmentId: request.appointmentId,
            multiCleanerJobId: request.multiCleanerJobId,
          },
          relatedAppointmentId: request.appointmentId,
        });

        // Notify the homeowner that cleaner was auto-approved
        await NotificationService.createNotification({
          userId: request.homeownerId,
          type: "cleaner_auto_approved",
          title: "Cleaner Assigned",
          body: "A cleaner has been automatically assigned to your cleaning job after the approval period expired.",
          data: {
            appointmentId: request.appointmentId,
            multiCleanerJobId: request.multiCleanerJobId,
            cleanerId: request.cleanerId,
          },
          relatedAppointmentId: request.appointmentId,
        });

        // Check if job is now filled and cancel other pending requests
        const updatedJob = await MultiCleanerJob.findByPk(request.multiCleanerJobId);
        if (updatedJob && updatedJob.isFilled()) {
          const cancelledCount = await this.cancelPendingRequestsForJob(request.multiCleanerJobId);
          cancelled += cancelledCount;
        }

        approved++;
      } catch (error) {
        console.error(`[CleanerApprovalService] Error auto-approving request ${request.id}:`, error);
        errors++;
      }
    }

    return { approved, cancelled, errors, total: expiredRequests.length };
  }

  /**
   * Cancel pending requests when a job gets filled
   * @param {number} multiCleanerJobId - Job ID
   */
  static async cancelPendingRequestsForJob(multiCleanerJobId) {
    const { CleanerJoinRequest } = require("../models");
    const NotificationService = require("./NotificationService");

    const pendingRequests = await CleanerJoinRequest.findAll({
      where: {
        multiCleanerJobId,
        status: "pending",
      },
    });

    for (const request of pendingRequests) {
      await request.cancel();

      // Notify the cleaner
      await NotificationService.createNotification({
        userId: request.cleanerId,
        type: "join_request_cancelled",
        title: "Request Cancelled",
        body: "The job you requested to join has been filled by other cleaners.",
        data: {
          appointmentId: request.appointmentId,
          multiCleanerJobId: request.multiCleanerJobId,
        },
        relatedAppointmentId: request.appointmentId,
      });
    }

    return pendingRequests.length;
  }

  /**
   * Notify homeowner about a new join request
   */
  static async notifyHomeownerOfRequest(joinRequest, appointment, cleanerId) {
    const { User } = require("../models");
    const NotificationService = require("./NotificationService");
    const EncryptionService = require("./EncryptionService");

    const cleaner = await User.findByPk(cleanerId);
    const home = appointment.home;

    const cleanerFirstName = cleaner ? EncryptionService.decrypt(cleaner.firstName) : "A cleaner";
    const cleanerLastName = cleaner ? EncryptionService.decrypt(cleaner.lastName) : "";
    const cleanerName = `${cleanerFirstName} ${cleanerLastName}`.trim();

    const homeAddress = home
      ? `${EncryptionService.decrypt(home.address)}, ${EncryptionService.decrypt(home.city)}`
      : "your home";

    const appointmentDate = new Date(appointment.date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    // Calculate hours until expiration
    const hoursUntilExpiry = Math.round(
      (new Date(joinRequest.expiresAt) - new Date()) / (1000 * 60 * 60)
    );

    // In-app notification
    await NotificationService.createNotification({
      userId: joinRequest.homeownerId,
      type: "cleaner_join_request",
      title: "Cleaner Wants to Join Your Job",
      body: `${cleanerName} wants to join the cleaning at ${homeAddress} on ${appointmentDate}. You have ${hoursUntilExpiry} hours to respond.`,
      data: {
        joinRequestId: joinRequest.id,
        appointmentId: appointment.id,
        cleanerId,
        cleanerName,
        expiresAt: joinRequest.expiresAt,
      },
      actionRequired: true,
      relatedAppointmentId: appointment.id,
      expiresAt: joinRequest.expiresAt,
    });
  }

  /**
   * Get pending join requests for a homeowner
   * @param {number} homeownerId - Homeowner user ID
   * @returns {Promise<Array>} Pending requests
   */
  static async getPendingRequestsForHomeowner(homeownerId) {
    const { CleanerJoinRequest } = require("../models");
    return CleanerJoinRequest.findPendingForHomeowner(homeownerId);
  }

  /**
   * Get pending join requests for an appointment
   * @param {number} appointmentId - Appointment ID
   * @returns {Promise<Array>} Pending requests
   */
  static async getPendingRequestsForAppointment(appointmentId) {
    const { CleanerJoinRequest, User } = require("../models");

    return CleanerJoinRequest.findAll({
      where: {
        appointmentId,
        status: "pending",
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
      include: [
        { model: User, as: "cleaner" },
      ],
      order: [["createdAt", "DESC"]],
    });
  }

  /**
   * Get pending join requests for a cleaner
   * @param {number} cleanerId - Cleaner user ID
   * @returns {Promise<Array>} Pending requests with job and appointment details
   */
  static async getPendingRequestsForCleaner(cleanerId) {
    const { CleanerJoinRequest, MultiCleanerJob, UserAppointments, UserHomes, User } = require("../models");

    return CleanerJoinRequest.findAll({
      where: {
        cleanerId,
        status: "pending",
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
      include: [
        {
          model: MultiCleanerJob,
          as: "multiCleanerJob",
        },
        {
          model: UserAppointments,
          as: "appointment",
          include: [
            { model: UserHomes, as: "home" },
          ],
        },
        {
          model: User,
          as: "homeowner",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  }

  /**
   * Cleaner cancels/withdraws their own join request
   * @param {number} joinRequestId - Join request ID
   * @param {number} cleanerId - Cleaner user ID (must be the request owner)
   * @returns {Promise<Object>} Result
   */
  static async cancelRequest(joinRequestId, cleanerId) {
    const { CleanerJoinRequest } = require("../models");

    const request = await CleanerJoinRequest.findByPk(joinRequestId);

    if (!request) {
      throw new Error("Join request not found");
    }

    if (request.cleanerId !== cleanerId) {
      throw new Error("You are not authorized to cancel this request");
    }

    if (request.status !== "pending") {
      throw new Error(`Request is no longer pending (status: ${request.status})`);
    }

    // Cancel the request
    await request.cancel();

    return {
      success: true,
      message: "Your request has been cancelled.",
    };
  }

  /**
   * Get multi-cleaner job IDs that a cleaner has pending requests for
   * @param {number} cleanerId - Cleaner user ID
   * @returns {Promise<Array<number>>} Array of multiCleanerJobIds
   */
  static async getPendingJobIdsForCleaner(cleanerId) {
    const { CleanerJoinRequest } = require("../models");

    const requests = await CleanerJoinRequest.findAll({
      where: {
        cleanerId,
        status: "pending",
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
      attributes: ["multiCleanerJobId"],
    });

    return requests.map((r) => r.multiCleanerJobId);
  }
}

module.exports = CleanerApprovalService;
