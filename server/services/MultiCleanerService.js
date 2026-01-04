/**
 * MultiCleanerService
 *
 * Core service for multi-cleaner job management.
 * Handles job creation, slot management, offers, and edge cases.
 */
const { Op } = require("sequelize");
const { getPricingConfig } = require("../config/businessConfig");

class MultiCleanerService {
  /**
   * Check if a home qualifies as a "large home" requiring multiple cleaners
   * @param {number} numBeds - Number of bedrooms
   * @param {number} numBaths - Number of bathrooms
   * @param {Object} pricingConfig - Optional pricing config
   * @returns {Promise<boolean>}
   */
  static async isLargeHome(numBeds, numBaths, pricingConfig = null) {
    const config = pricingConfig || (await getPricingConfig());
    const bedsThreshold = config?.multiCleaner?.largeHomeBedsThreshold || 3;
    const bathsThreshold = config?.multiCleaner?.largeHomeBathsThreshold || 3;

    const beds = parseFloat(numBeds) || 0;
    const baths = parseFloat(numBaths) || 0;

    // Both conditions must be met (3+ beds AND 3+ baths)
    return beds >= bedsThreshold && baths >= bathsThreshold;
  }

  /**
   * Check if a home is an "edge" large home (right at the threshold)
   * Edge homes allow solo cleaning with a warning
   * @param {number} numBeds - Number of bedrooms
   * @param {number} numBaths - Number of bathrooms
   * @param {Object} pricingConfig - Optional pricing config
   * @returns {Promise<boolean>}
   */
  static async isEdgeLargeHome(numBeds, numBaths, pricingConfig = null) {
    const config = pricingConfig || (await getPricingConfig());
    const bedsThreshold = config?.multiCleaner?.largeHomeBedsThreshold || 3;
    const bathsThreshold = config?.multiCleaner?.largeHomeBathsThreshold || 3;

    const beds = parseFloat(numBeds) || 0;
    const baths = parseFloat(numBaths) || 0;

    // Edge case: exactly at threshold (e.g., 3 beds AND 3 baths)
    // These homes can be cleaned solo with a warning
    return beds === bedsThreshold && baths === bathsThreshold;
  }

  /**
   * Check if solo cleaning is allowed for a home
   * Solo is allowed only for edge large homes, not for clearly large homes
   * @param {number} numBeds - Number of bedrooms
   * @param {number} numBaths - Number of bathrooms
   * @param {Object} pricingConfig - Optional pricing config
   * @returns {Promise<boolean>}
   */
  static async isSoloAllowed(numBeds, numBaths, pricingConfig = null) {
    const isLarge = await this.isLargeHome(numBeds, numBaths, pricingConfig);

    // Not a large home - solo is default (no multi-cleaner needed)
    if (!isLarge) {
      return true;
    }

    // Large home - solo only allowed for edge cases
    const isEdge = await this.isEdgeLargeHome(numBeds, numBaths, pricingConfig);
    return isEdge;
  }

  /**
   * Check if multi-cleaner is required (no solo option)
   * @param {number} numBeds - Number of bedrooms
   * @param {number} numBaths - Number of bathrooms
   * @param {Object} pricingConfig - Optional pricing config
   * @returns {Promise<boolean>}
   */
  static async isMultiCleanerRequired(numBeds, numBaths, pricingConfig = null) {
    const isLarge = await this.isLargeHome(numBeds, numBaths, pricingConfig);
    if (!isLarge) {
      return false;
    }

    // Multi-cleaner required for large homes that are NOT edge cases
    const isEdge = await this.isEdgeLargeHome(numBeds, numBaths, pricingConfig);
    return !isEdge;
  }

  /**
   * Calculate recommended number of cleaners for a home
   * @param {Object} home - Home object with numBeds, numBaths, squareFootage
   * @returns {Promise<number>}
   */
  static async calculateRecommendedCleaners(home) {
    const beds = parseFloat(home.numBeds) || 0;
    const baths = parseFloat(home.numBaths) || 0;
    const sqFt = home.squareFootage || 0;

    // Base calculation on room count
    const roomCount = beds + Math.ceil(baths);

    // 1 cleaner per 3-4 rooms, minimum 2 for large homes
    if (roomCount <= 4) return 1;
    if (roomCount <= 7) return 2;
    if (roomCount <= 10) return 3;
    return Math.min(4, Math.ceil(roomCount / 3));
  }

  /**
   * Estimate job duration in minutes
   * @param {Object} home - Home object
   * @param {number} cleanerCount - Number of cleaners assigned
   * @returns {Promise<number>}
   */
  static async estimateJobDuration(home, cleanerCount = 1) {
    const beds = parseFloat(home.numBeds) || 1;
    const baths = parseFloat(home.numBaths) || 1;

    // Base estimate: 30 min per bedroom, 20 min per bathroom, plus 30 min base
    const baseMinutes = 30 + beds * 30 + baths * 20;

    // Divide by number of cleaners (with some overlap inefficiency)
    const efficiencyFactor = cleanerCount > 1 ? 0.85 : 1; // 15% overlap overhead for multi-cleaner
    return Math.ceil((baseMinutes / cleanerCount) / efficiencyFactor);
  }

  /**
   * Create a multi-cleaner job for an appointment
   * @param {number} appointmentId - Appointment ID
   * @param {number} cleanerCount - Number of cleaners needed
   * @param {number} primaryCleanerId - Optional primary cleaner ID
   * @param {boolean} isAutoGenerated - Whether system auto-created this
   * @returns {Promise<Object>} Created MultiCleanerJob
   */
  static async createMultiCleanerJob(
    appointmentId,
    cleanerCount,
    primaryCleanerId = null,
    isAutoGenerated = false
  ) {
    const {
      MultiCleanerJob,
      UserAppointments,
      UserHomes,
    } = require("../models");

    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [{ model: UserHomes, as: "home" }],
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const estimatedMinutes = await this.estimateJobDuration(
      appointment.home,
      cleanerCount
    );

    const multiCleanerJob = await MultiCleanerJob.create({
      appointmentId,
      totalCleanersRequired: cleanerCount,
      cleanersConfirmed: 0,
      status: "open",
      primaryCleanerId,
      isAutoGenerated,
      totalEstimatedMinutes: estimatedMinutes,
      openedToMarketAt: new Date(),
    });

    // Update appointment to mark as multi-cleaner
    await appointment.update({
      isMultiCleanerJob: true,
      multiCleanerJobId: multiCleanerJob.id,
      cleanerSlotsRemaining: cleanerCount,
    });

    return multiCleanerJob;
  }

  /**
   * Convert existing appointment to multi-cleaner job
   * @param {number} appointmentId - Appointment ID
   * @returns {Promise<Object>} Created MultiCleanerJob
   */
  static async convertToMultiCleanerJob(appointmentId) {
    const { UserAppointments, UserHomes } = require("../models");

    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [{ model: UserHomes, as: "home" }],
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const recommendedCleaners = await this.calculateRecommendedCleaners(
      appointment.home
    );

    return this.createMultiCleanerJob(
      appointmentId,
      recommendedCleaners,
      null,
      true
    );
  }

  /**
   * Fill a cleaner slot in a multi-cleaner job
   * @param {number} multiCleanerJobId - Job ID
   * @param {number} cleanerId - Cleaner ID
   * @param {Array<number>} roomAssignmentIds - Room assignment IDs for this cleaner
   * @returns {Promise<Object>} Updated MultiCleanerJob
   */
  static async fillSlot(multiCleanerJobId, cleanerId, roomAssignmentIds = []) {
    const {
      MultiCleanerJob,
      CleanerRoomAssignment,
      CleanerJobCompletion,
      UserAppointments,
    } = require("../models");

    const job = await MultiCleanerJob.findByPk(multiCleanerJobId);
    if (!job) {
      throw new Error("Multi-cleaner job not found");
    }

    if (job.isFilled()) {
      throw new Error("All cleaner slots are already filled");
    }

    // Assign rooms to cleaner
    if (roomAssignmentIds.length > 0) {
      await CleanerRoomAssignment.update(
        { cleanerId },
        { where: { id: roomAssignmentIds } }
      );
    }

    // Create completion record for this cleaner
    await CleanerJobCompletion.create({
      appointmentId: job.appointmentId,
      cleanerId,
      multiCleanerJobId,
      status: "assigned",
    });

    // Increment confirmed cleaners
    job.cleanersConfirmed += 1;
    await job.updateStatus();

    // Update appointment slots remaining
    await UserAppointments.update(
      { cleanerSlotsRemaining: job.getRemainingSlots() },
      { where: { id: job.appointmentId } }
    );

    return job;
  }

  /**
   * Release a cleaner slot (when cleaner drops out)
   * @param {number} multiCleanerJobId - Job ID
   * @param {number} cleanerId - Cleaner ID
   * @returns {Promise<Object>} Updated MultiCleanerJob
   */
  static async releaseSlot(multiCleanerJobId, cleanerId) {
    const {
      MultiCleanerJob,
      CleanerRoomAssignment,
      CleanerJobCompletion,
      UserAppointments,
    } = require("../models");

    const job = await MultiCleanerJob.findByPk(multiCleanerJobId);
    if (!job) {
      throw new Error("Multi-cleaner job not found");
    }

    // Unassign rooms from cleaner
    await CleanerRoomAssignment.update(
      { cleanerId: null, status: "pending" },
      { where: { multiCleanerJobId, cleanerId } }
    );

    // Mark completion as dropped out
    await CleanerJobCompletion.update(
      { status: "dropped_out" },
      { where: { multiCleanerJobId, cleanerId } }
    );

    // Decrement confirmed cleaners
    job.cleanersConfirmed = Math.max(0, job.cleanersConfirmed - 1);
    await job.updateStatus();

    // Update appointment slots remaining
    await UserAppointments.update(
      { cleanerSlotsRemaining: job.getRemainingSlots() },
      { where: { id: job.appointmentId } }
    );

    return job;
  }

  /**
   * Check if all slots are filled
   * @param {number} multiCleanerJobId - Job ID
   * @returns {Promise<boolean>}
   */
  static async checkAllSlotsFilled(multiCleanerJobId) {
    const { MultiCleanerJob } = require("../models");
    const job = await MultiCleanerJob.findByPk(multiCleanerJobId);
    return job ? job.isFilled() : false;
  }

  /**
   * Create a job offer for a cleaner
   * @param {number} multiCleanerJobId - Job ID
   * @param {number} cleanerId - Cleaner ID
   * @param {string} offerType - 'primary_invite', 'market_open', 'urgent_fill'
   * @param {number} earningsOffered - Earnings in cents
   * @param {Array} roomsOffered - Array of room assignment details
   * @returns {Promise<Object>} Created CleanerJobOffer
   */
  static async createJobOffer(
    multiCleanerJobId,
    cleanerId,
    offerType = "market_open",
    earningsOffered,
    roomsOffered = null
  ) {
    const { CleanerJobOffer, MultiCleanerJob } = require("../models");
    const config = await getPricingConfig();

    const job = await MultiCleanerJob.findByPk(multiCleanerJobId);
    if (!job) {
      throw new Error("Multi-cleaner job not found");
    }

    // Check if cleaner already has an offer for this job
    const existingOffer = await CleanerJobOffer.findOne({
      where: {
        multiCleanerJobId,
        cleanerId,
        status: { [Op.in]: ["pending", "accepted"] },
      },
    });

    if (existingOffer) {
      throw new Error("Cleaner already has an active offer for this job");
    }

    const expirationHours = config?.multiCleaner?.offerExpirationHours || 48;
    const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

    return CleanerJobOffer.create({
      multiCleanerJobId,
      cleanerId,
      appointmentId: job.appointmentId,
      offerType,
      status: "pending",
      earningsOffered,
      roomsOffered,
      expiresAt,
    });
  }

  /**
   * Handle cleaner dropout from a job
   * @param {number} multiCleanerJobId - Job ID
   * @param {number} cleanerId - Cleaner who dropped out
   * @param {string} reason - Optional reason
   * @returns {Promise<Object>} Result with remaining cleaners and options
   */
  static async handleCleanerDropout(multiCleanerJobId, cleanerId, reason = null) {
    const {
      MultiCleanerJob,
      CleanerJobCompletion,
      UserAppointments,
    } = require("../models");
    const NotificationService = require("./NotificationService");

    // Release the slot
    const job = await this.releaseSlot(multiCleanerJobId, cleanerId);

    // Get remaining active cleaners
    const remainingCompletions = await CleanerJobCompletion.findAll({
      where: {
        multiCleanerJobId,
        status: { [Op.notIn]: ["dropped_out", "no_show"] },
      },
    });

    const appointment = await UserAppointments.findByPk(job.appointmentId, {
      include: ["home", "user"],
    });

    // Notify remaining cleaners and homeowner
    for (const completion of remainingCompletions) {
      await NotificationService.createNotification({
        userId: completion.cleanerId,
        type: "cleaner_dropout",
        title: "Co-cleaner unavailable",
        body: `A co-cleaner has dropped out of the job on ${appointment.date}. You may be offered to complete the job solo for full pay.`,
        data: { appointmentId: job.appointmentId, multiCleanerJobId },
        actionRequired: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    // Notify homeowner
    await NotificationService.createNotification({
      userId: appointment.userId,
      type: "cleaner_dropout",
      title: "Cleaner update for your appointment",
      body: `One of the cleaners for your ${appointment.date} appointment is no longer available. We're working to find a replacement.`,
      data: { appointmentId: job.appointmentId },
    });

    return {
      job,
      remainingCleaners: remainingCompletions.length,
      canProceedSolo: remainingCompletions.length >= 1,
    };
  }

  /**
   * Handle cleaner no-show
   * @param {number} multiCleanerJobId - Job ID
   * @param {number} cleanerId - Cleaner who didn't show
   * @returns {Promise<Object>} Result
   */
  static async handleNoShow(multiCleanerJobId, cleanerId) {
    const { CleanerJobCompletion } = require("../models");

    // Mark as no-show
    await CleanerJobCompletion.update(
      { status: "no_show" },
      { where: { multiCleanerJobId, cleanerId } }
    );

    // Handle similar to dropout
    return this.handleCleanerDropout(multiCleanerJobId, cleanerId, "No-show");
  }

  /**
   * Offer solo completion to remaining cleaner
   * @param {number} multiCleanerJobId - Job ID
   * @param {number} remainingCleanerId - Remaining cleaner ID
   * @returns {Promise<Object>} Created notification/offer
   */
  static async offerSoloCompletion(multiCleanerJobId, remainingCleanerId) {
    const { MultiCleanerJob, UserAppointments } = require("../models");
    const NotificationService = require("./NotificationService");
    const MultiCleanerPricingService = require("./MultiCleanerPricingService");

    const job = await MultiCleanerJob.findByPk(multiCleanerJobId);
    const appointment = await UserAppointments.findByPk(job.appointmentId);

    // Calculate full earnings for solo completion
    const fullEarnings = await MultiCleanerPricingService.calculateSoloCompletionEarnings(
      job.appointmentId
    );

    await NotificationService.createNotification({
      userId: remainingCleanerId,
      type: "solo_completion_offer",
      title: "Solo completion offer",
      body: `You can complete this job solo for $${(fullEarnings / 100).toFixed(2)}. Accept within 12 hours.`,
      data: {
        appointmentId: job.appointmentId,
        multiCleanerJobId,
        earningsOffered: fullEarnings,
      },
      actionRequired: true,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    });

    return { fullEarnings, appointment };
  }

  /**
   * Handle partial completion when only some cleaners finish
   * @param {number} multiCleanerJobId - Job ID
   * @returns {Promise<Object>} Partial completion details
   */
  static async handlePartialCompletion(multiCleanerJobId) {
    const {
      MultiCleanerJob,
      CleanerRoomAssignment,
      CleanerJobCompletion,
    } = require("../models");

    const job = await MultiCleanerJob.findByPk(multiCleanerJobId);

    // Get all room assignments
    const allRooms = await CleanerRoomAssignment.findAll({
      where: { multiCleanerJobId },
    });

    const completedRooms = allRooms.filter((r) => r.status === "completed");
    const totalRooms = allRooms.length;

    // Get completions by status
    const completions = await CleanerJobCompletion.findAll({
      where: { multiCleanerJobId },
    });

    const completedCleaners = completions.filter(
      (c) => c.status === "completed"
    );
    const incompleteCleaners = completions.filter(
      (c) => !["completed", "dropped_out", "no_show"].includes(c.status)
    );

    return {
      job,
      totalRooms,
      completedRooms: completedRooms.length,
      completionPercentage: Math.round((completedRooms.length / totalRooms) * 100),
      completedCleaners: completedCleaners.length,
      incompleteCleaners: incompleteCleaners.length,
    };
  }

  /**
   * Mark a cleaner as complete for their portion
   * @param {number} multiCleanerJobId - Job ID
   * @param {number} cleanerId - Cleaner ID
   * @returns {Promise<Object>} Updated completion
   */
  static async markCleanerComplete(multiCleanerJobId, cleanerId) {
    const { CleanerJobCompletion, CleanerRoomAssignment } = require("../models");

    // Mark all assigned rooms as complete
    await CleanerRoomAssignment.update(
      { status: "completed", completedAt: new Date() },
      { where: { multiCleanerJobId, cleanerId } }
    );

    // Mark completion record
    const completion = await CleanerJobCompletion.findOne({
      where: { multiCleanerJobId, cleanerId },
    });

    if (completion) {
      await completion.markCompleted();
    }

    // Check if job is fully complete
    await this.checkJobFullyComplete(multiCleanerJobId);

    return completion;
  }

  /**
   * Check if the entire multi-cleaner job is complete
   * @param {number} multiCleanerJobId - Job ID
   * @returns {Promise<boolean>}
   */
  static async checkJobFullyComplete(multiCleanerJobId) {
    const { MultiCleanerJob, CleanerRoomAssignment } = require("../models");

    const job = await MultiCleanerJob.findByPk(multiCleanerJobId);
    if (!job) return false;

    // Check if all rooms are complete
    const incompleteRooms = await CleanerRoomAssignment.count({
      where: {
        multiCleanerJobId,
        status: { [Op.ne]: "completed" },
      },
    });

    if (incompleteRooms === 0) {
      job.status = "completed";
      await job.save();
      return true;
    }

    return false;
  }

  /**
   * Get job check info for an appointment (used by API)
   * @param {number} appointmentId - Appointment ID
   * @returns {Promise<Object>} Job check info
   */
  static async getJobCheckInfo(appointmentId) {
    const { UserAppointments, UserHomes } = require("../models");

    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [{ model: UserHomes, as: "home" }],
    });

    if (!appointment || !appointment.home) {
      throw new Error("Appointment or home not found");
    }

    const home = appointment.home;
    const isLarge = await this.isLargeHome(home.numBeds, home.numBaths);
    const isEdge = await this.isEdgeLargeHome(home.numBeds, home.numBaths);
    const soloAllowed = await this.isSoloAllowed(home.numBeds, home.numBaths);
    const multiCleanerRequired = await this.isMultiCleanerRequired(
      home.numBeds,
      home.numBaths
    );
    const recommendedCleaners = await this.calculateRecommendedCleaners(home);
    const estimatedMinutes = await this.estimateJobDuration(
      home,
      recommendedCleaners
    );

    return {
      isLargeHome: isLarge,
      isEdgeLargeHome: isEdge,
      soloAllowed,
      multiCleanerRequired,
      recommendedCleaners,
      estimatedMinutes,
      estimatedHours: (estimatedMinutes / 60).toFixed(1),
      numBeds: home.numBeds,
      numBaths: home.numBaths,
      squareFootage: home.squareFootage,
    };
  }

  /**
   * Find unfilled jobs that need urgent notifications
   * @returns {Promise<Array>} Jobs needing urgent fill
   */
  static async findJobsNeedingUrgentFill() {
    const { MultiCleanerJob, UserAppointments } = require("../models");
    const config = await getPricingConfig();
    const urgentDays = config?.multiCleaner?.urgentFillDays || 7;

    const urgentDate = new Date();
    urgentDate.setDate(urgentDate.getDate() + urgentDays);

    return MultiCleanerJob.findAll({
      where: {
        status: { [Op.in]: ["open", "partially_filled"] },
        urgentNotificationSentAt: null,
      },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            date: {
              [Op.lte]: urgentDate.toISOString().split("T")[0],
            },
          },
        },
      ],
    });
  }

  /**
   * Find jobs that need homeowner final warning
   * @returns {Promise<Array>} Jobs needing final warning
   */
  static async findJobsNeedingFinalWarning() {
    const { MultiCleanerJob, UserAppointments } = require("../models");
    const config = await getPricingConfig();
    const finalDays = config?.multiCleaner?.finalWarningDays || 3;

    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + finalDays);

    return MultiCleanerJob.findAll({
      where: {
        status: { [Op.in]: ["open", "partially_filled"] },
        finalWarningAt: null,
      },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            date: {
              [Op.lte]: warningDate.toISOString().split("T")[0],
            },
          },
        },
      ],
    });
  }
}

module.exports = MultiCleanerService;
