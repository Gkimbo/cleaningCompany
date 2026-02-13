/**
 * MultiCleanerService
 *
 * Core service for multi-cleaner job management.
 * Handles job creation, slot management, offers, and edge cases.
 */
const { Op } = require("sequelize");
const { getPricingConfig } = require("../config/businessConfig");
const {
  calculateScheduledEndTime,
  getAutoCompleteConfig,
} = require("./cron/AutoCompleteMonitor");

class MultiCleanerService {
  /**
   * Check if a home qualifies as a "large home" requiring multiple cleaners
   * A home is large if it exceeds 2 bed/2 bath (i.e., 3+ beds OR 3+ baths)
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

    // Either condition triggers large home (3+ beds OR 3+ baths)
    return beds >= bedsThreshold || baths >= bathsThreshold;
  }

  /**
   * Check if a home is an "edge" large home (right at the threshold)
   * Edge homes allow solo cleaning with a warning
   * Examples: 3 bed/2 bath, 2 bed/3 bath, 3 bed/3 bath
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

    // Must be a large home first
    const isLarge = beds >= bedsThreshold || baths >= bathsThreshold;
    if (!isLarge) {
      return false;
    }

    // Edge case: at threshold but not significantly over
    // - Beds at threshold (3) but baths below threshold, OR
    // - Baths at threshold (3) but beds below threshold, OR
    // - Both exactly at threshold (3 bed/3 bath)
    const bedsAtOrBelowThreshold = beds <= bedsThreshold;
    const bathsAtOrBelowThreshold = baths <= bathsThreshold;

    // Edge if neither dimension is significantly over threshold
    return bedsAtOrBelowThreshold && bathsAtOrBelowThreshold;
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

    // Base estimate: 60 min base + 15 min per bedroom + 30 min per bathroom
    const rawMinutes = 60 + beds * 15 + baths * 30;
    // Round to nearest 30 minutes (0.5 hours)
    const baseMinutes = Math.round(rawMinutes / 30) * 30;

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

    // Get appointment data for auto-complete timing
    const appointment = await UserAppointments.findByPk(job.appointmentId);
    const autoCompleteConfig = await getAutoCompleteConfig();
    const scheduledEndTime = calculateScheduledEndTime(
      appointment.date,
      appointment.timeToBeCompleted
    );
    const autoCompleteAt = new Date(
      scheduledEndTime.getTime() + autoCompleteConfig.hoursAfterEnd * 60 * 60 * 1000
    );

    // Create completion record for this cleaner
    await CleanerJobCompletion.create({
      appointmentId: job.appointmentId,
      cleanerId,
      multiCleanerJobId,
      status: "assigned",
      autoCompleteAt,
    });

    // Increment confirmed cleaners
    job.cleanersConfirmed += 1;
    await job.updateStatus();

    // Update appointment: add cleaner to employeesAssigned and update slots
    const currentEmployees = appointment.employeesAssigned || [];
    const cleanerIdStr = String(cleanerId);
    if (!currentEmployees.includes(cleanerIdStr)) {
      currentEmployees.push(cleanerIdStr);
    }
    appointment.cleanerSlotsRemaining = job.getRemainingSlots();
    appointment.employeesAssigned = currentEmployees;
    appointment.hasBeenAssigned = currentEmployees.length > 0;
    await appointment.save();

    // Create cleaner-appointment association so job shows in cleaner's My Jobs
    const { UserCleanerAppointments } = require("../models");
    await UserCleanerAppointments.findOrCreate({
      where: {
        appointmentId: job.appointmentId,
        employeeId: cleanerId,
      },
    });

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

    // Get appointment and remove cleaner from employeesAssigned
    const appointment = await UserAppointments.findByPk(job.appointmentId);
    if (appointment) {
      const currentEmployees = appointment.employeesAssigned || [];
      const cleanerIdStr = String(cleanerId);
      const updatedEmployees = currentEmployees.filter(id => id !== cleanerIdStr);

      // Update appointment: remove cleaner from employeesAssigned and update slots
      appointment.cleanerSlotsRemaining = job.getRemainingSlots();
      appointment.employeesAssigned = updatedEmployees;
      appointment.hasBeenAssigned = updatedEmployees.length > 0;
      await appointment.save();
    }

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

    const remainingCount = remainingCompletions.length;
    const originalRequired = job.totalCleanersRequired;
    const shortfall = originalRequired - remainingCount;

    // Format date for notifications
    const appointmentDate = new Date(appointment.date);
    const formattedDate = appointmentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    // Context-aware notification for remaining cleaners
    for (const completion of remainingCompletions) {
      let notificationBody;
      let notificationType;

      if (remainingCount === 1) {
        // Only 1 cleaner left - offer solo completion
        notificationType = "cleaner_dropout_solo_offer";
        notificationBody = `A co-cleaner has dropped out of the ${formattedDate} job. You may be offered to complete it solo for full pay.`;
      } else {
        // Multiple cleaners remain - they'll need to cover extra rooms
        notificationType = "cleaner_dropout_extra_work";
        notificationBody = `A co-cleaner has dropped out of the ${formattedDate} job. You may need to cover additional rooms for extra pay.`;
      }

      await NotificationService.createNotification({
        userId: completion.cleanerId,
        type: notificationType,
        title: "Co-cleaner unavailable",
        body: notificationBody,
        data: {
          appointmentId: job.appointmentId,
          multiCleanerJobId,
          remainingCleaners: remainingCount,
          originalRequired,
          shortfall,
        },
        actionRequired: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    // Context-aware notification for homeowner
    let homeownerBody;
    if (remainingCount === 0) {
      homeownerBody = `All cleaners for your ${formattedDate} appointment are no longer available. Please reschedule or cancel.`;
    } else if (remainingCount === 1) {
      homeownerBody = `One of the cleaners for your ${formattedDate} appointment is no longer available. The remaining cleaner may complete it solo, or you can cancel without penalty.`;
    } else {
      homeownerBody = `One of the cleaners for your ${formattedDate} appointment is no longer available. The remaining ${remainingCount} cleaners can cover the work, or we'll try to find a replacement.`;
    }

    await NotificationService.createNotification({
      userId: appointment.userId,
      type: "cleaner_dropout",
      title: "Cleaner update for your appointment",
      body: homeownerBody,
      data: {
        appointmentId: job.appointmentId,
        multiCleanerJobId,
        remainingCleaners: remainingCount,
        originalRequired,
        canCancelFree: true,
      },
      actionRequired: remainingCount < originalRequired,
    });

    return {
      job,
      remainingCleaners: remainingCount,
      originalRequired,
      shortfall,
      canProceedSolo: remainingCount === 1,
      canProceedWithRebalance: remainingCount > 1,
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
   * Handle cleaner declining solo completion
   * @param {number} multiCleanerJobId - Job ID
   * @param {number} cleanerId - Cleaner who declined
   * @param {string} reason - Optional reason for declining
   * @returns {Promise<Object>} Result with next steps
   */
  static async handleSoloDecline(multiCleanerJobId, cleanerId, reason = null) {
    const { MultiCleanerJob, UserAppointments, CleanerJobCompletion } = require("../models");
    const NotificationService = require("./NotificationService");

    const job = await MultiCleanerJob.findByPk(multiCleanerJobId);
    if (!job) {
      throw new Error("Multi-cleaner job not found");
    }

    const appointment = await UserAppointments.findByPk(job.appointmentId, {
      include: ["user", "home"],
    });

    // Mark the cleaner as having declined solo
    await CleanerJobCompletion.update(
      { soloDeclined: true, soloDeclinedAt: new Date(), soloDeclineReason: reason },
      { where: { multiCleanerJobId, cleanerId } }
    );

    // Update job status
    await job.update({
      soloOfferDeclined: true,
      soloOfferDeclinedAt: new Date(),
    });

    // Notify homeowner about the decline
    const appointmentDate = new Date(appointment.date);
    const formattedDate = appointmentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    await NotificationService.createNotification({
      userId: appointment.userId,
      type: "solo_offer_declined",
      title: "Cleaner unavailable for solo cleaning",
      body: `The remaining cleaner for your ${formattedDate} appointment cannot complete it solo. You can cancel without penalty or we'll try to find another cleaner.`,
      data: {
        appointmentId: appointment.id,
        multiCleanerJobId,
        canCancelFree: true,
      },
      actionRequired: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Also release the cleaner from the job since they declined
    await this.releaseSlot(multiCleanerJobId, cleanerId);

    return {
      success: true,
      message: "Solo offer declined. Homeowner has been notified.",
      appointmentId: appointment.id,
      homeownerNotified: true,
    };
  }

  /**
   * Handle expired solo offer (cleaner didn't respond in time)
   * @param {number} multiCleanerJobId - Job ID
   * @returns {Promise<Object>} Result
   */
  static async handleExpiredSoloOffer(multiCleanerJobId) {
    const { MultiCleanerJob, UserAppointments, CleanerJobCompletion } = require("../models");
    const NotificationService = require("./NotificationService");

    const job = await MultiCleanerJob.findByPk(multiCleanerJobId);
    if (!job) {
      throw new Error("Multi-cleaner job not found");
    }

    const appointment = await UserAppointments.findByPk(job.appointmentId, {
      include: ["user"],
    });

    // Mark as expired
    await job.update({
      soloOfferExpired: true,
      soloOfferExpiredAt: new Date(),
    });

    // Notify homeowner
    const appointmentDate = new Date(appointment.date);
    const formattedDate = appointmentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    await NotificationService.createNotification({
      userId: appointment.userId,
      type: "solo_offer_expired",
      title: "Cleaner did not respond",
      body: `The remaining cleaner for your ${formattedDate} appointment did not respond to the solo offer. You can cancel without penalty or reschedule.`,
      data: {
        appointmentId: appointment.id,
        multiCleanerJobId,
        canCancelFree: true,
      },
      actionRequired: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Get and release the non-responsive cleaner
    const completion = await CleanerJobCompletion.findOne({
      where: {
        multiCleanerJobId,
        status: { [Op.notIn]: ["dropped_out", "no_show"] },
      },
    });

    if (completion) {
      await this.releaseSlot(multiCleanerJobId, completion.cleanerId);
    }

    return {
      success: true,
      message: "Solo offer expired. Homeowner notified.",
      appointmentId: appointment.id,
    };
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

  /**
   * Book a multi-cleaner job as a team (for business owners)
   * Fills all remaining slots with the specified team members at once
   * @param {number} multiCleanerJobId - The multi-cleaner job ID
   * @param {number} businessOwnerId - The business owner's user ID
   * @param {Array} teamMembers - Array of { type: "self" | "employee", businessEmployeeId?: number }
   * @returns {Promise<Object>} Result with job and assignment details
   */
  static async bookAsTeam(multiCleanerJobId, businessOwnerId, teamMembers) {
    const {
      MultiCleanerJob,
      UserAppointments,
      UserHomes,
      CleanerRoomAssignment,
      CleanerJobCompletion,
      UserCleanerAppointments,
      BusinessEmployee,
      EmployeeJobAssignment,
      User,
    } = require("../models");
    const RoomAssignmentService = require("./RoomAssignmentService");

    // Get the job with appointment details
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
      throw new Error("Multi-cleaner job not found");
    }

    const remainingSlots = job.getRemainingSlots();
    if (remainingSlots === 0) {
      throw new Error("All slots are already filled");
    }

    if (teamMembers.length !== remainingSlots) {
      throw new Error(
        `Must select exactly ${remainingSlots} team members. Got ${teamMembers.length}.`
      );
    }

    // Resolve all team member user IDs
    const resolvedMembers = [];
    for (const member of teamMembers) {
      if (member.type === "self") {
        resolvedMembers.push({
          userId: businessOwnerId,
          type: "self",
          businessEmployeeId: null,
        });
      } else if (member.type === "employee") {
        const employee = await BusinessEmployee.findOne({
          where: {
            id: member.businessEmployeeId,
            businessOwnerId,
            status: "active",
          },
        });

        if (!employee) {
          throw new Error(`Employee ${member.businessEmployeeId} not found or inactive`);
        }

        if (!employee.userId) {
          throw new Error(
            `Employee ${employee.firstName} has not accepted their invitation yet`
          );
        }

        resolvedMembers.push({
          userId: employee.userId,
          type: "employee",
          businessEmployeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
        });
      } else {
        throw new Error(`Invalid team member type: ${member.type}`);
      }
    }

    // Check for duplicates
    const userIds = resolvedMembers.map((m) => m.userId);
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length !== userIds.length) {
      throw new Error("Cannot assign the same person multiple times");
    }

    // Check none are already assigned
    for (const member of resolvedMembers) {
      const existingCompletion = await CleanerJobCompletion.findOne({
        where: { multiCleanerJobId, cleanerId: member.userId },
      });
      if (existingCompletion) {
        throw new Error(
          `Team member is already assigned to this job`
        );
      }
    }

    // Get all unassigned rooms
    const unassignedRooms = await CleanerRoomAssignment.findAll({
      where: {
        multiCleanerJobId,
        cleanerId: null,
      },
      order: [["estimatedMinutes", "DESC"]], // Largest first for balanced distribution
    });

    // Distribute rooms evenly among team members
    const roomsPerCleaner = Math.ceil(unassignedRooms.length / resolvedMembers.length);
    const assignments = [];

    for (let i = 0; i < resolvedMembers.length; i++) {
      const member = resolvedMembers[i];
      const startIdx = i * roomsPerCleaner;
      const endIdx = Math.min(startIdx + roomsPerCleaner, unassignedRooms.length);
      const memberRooms = unassignedRooms.slice(startIdx, endIdx);
      const roomIds = memberRooms.map((r) => r.id);

      // Fill the slot using existing method
      await this.fillSlot(multiCleanerJobId, member.userId, roomIds);

      // Create cleaner-appointment assignment
      await UserCleanerAppointments.findOrCreate({
        where: {
          appointmentId: job.appointmentId,
          employeeId: member.userId,
        },
      });

      // For employees, create EmployeeJobAssignment for payroll tracking
      if (member.type === "employee") {
        const earnings = await RoomAssignmentService.calculateCleanerEarningsShare(
          member.userId,
          multiCleanerJobId
        );

        await EmployeeJobAssignment.create({
          businessEmployeeId: member.businessEmployeeId,
          appointmentId: job.appointmentId,
          businessOwnerId,
          assignedBy: businessOwnerId,
          status: "assigned",
          payAmount: Math.round(earnings * 100), // Convert to cents
          payType: "flat_rate",
          isMarketplacePickup: true,
          payoutStatus: "pending",
        });
      }

      assignments.push({
        userId: member.userId,
        type: member.type,
        businessEmployeeId: member.businessEmployeeId,
        roomsAssigned: roomIds.length,
      });
    }

    // Fetch updated job
    const updatedJob = await MultiCleanerJob.findByPk(multiCleanerJobId, {
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          include: [{ model: UserHomes, as: "home" }],
        },
      ],
    });

    return {
      job: updatedJob,
      assignments,
      totalSlotsFilled: resolvedMembers.length,
    };
  }

  /**
   * Offer extra work to remaining cleaners after a dropout
   * Each remaining cleaner gets notified of their new room assignments and increased pay
   * @param {number} multiCleanerJobId - Job ID
   * @returns {Promise<Object>} Result with offers sent
   */
  static async offerExtraWorkToRemainingCleaners(multiCleanerJobId) {
    const {
      MultiCleanerJob,
      UserAppointments,
      CleanerJobCompletion,
    } = require("../models");
    const NotificationService = require("./NotificationService");
    const RoomAssignmentService = require("./RoomAssignmentService");
    const MultiCleanerPricingService = require("./MultiCleanerPricingService");

    const job = await MultiCleanerJob.findByPk(multiCleanerJobId);
    if (!job) {
      throw new Error("Multi-cleaner job not found");
    }

    const appointment = await UserAppointments.findByPk(job.appointmentId);
    const appointmentDate = new Date(appointment.date);
    const formattedDate = appointmentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    // Rebalance rooms among remaining cleaners
    const rebalanceResult = await RoomAssignmentService.rebalanceAfterDropout(multiCleanerJobId);

    // Recalculate earnings
    const earningsResult = await MultiCleanerPricingService.recalculateEarningsAfterDropout(multiCleanerJobId);

    // Get remaining active cleaners
    const remainingCompletions = await CleanerJobCompletion.findAll({
      where: {
        multiCleanerJobId,
        status: { [Op.notIn]: ["dropped_out", "no_show"] },
      },
    });

    // Notify each remaining cleaner of their new assignments and pay
    const offersSent = [];
    for (const completion of remainingCompletions) {
      const cleanerEarnings = earningsResult.earnings.find(
        (e) => e.cleanerId === completion.cleanerId
      );

      if (!cleanerEarnings) continue;

      const extraRooms = rebalanceResult.roomsPerCleaner?.[completion.cleanerId] || 0;

      await NotificationService.createNotification({
        userId: completion.cleanerId,
        type: "extra_work_offer",
        title: "Extra work available - More pay!",
        body: `A co-cleaner dropped out. You now have ${extraRooms} rooms and will earn ${cleanerEarnings.totalEarningsFormatted} (${cleanerEarnings.extraEarningsFormatted} extra). Accept within 12 hours.`,
        data: {
          appointmentId: appointment.id,
          multiCleanerJobId,
          newRoomCount: extraRooms,
          totalEarnings: cleanerEarnings.totalEarnings,
          extraEarnings: cleanerEarnings.extraEarnings,
        },
        actionRequired: true,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours to respond
      });

      offersSent.push({
        cleanerId: completion.cleanerId,
        roomCount: extraRooms,
        earnings: cleanerEarnings.totalEarnings,
        extraEarnings: cleanerEarnings.extraEarnings,
      });
    }

    // Mark job as having extra work offers pending
    await job.update({
      extraWorkOffersSentAt: new Date(),
      extraWorkOffersExpireAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    });

    return {
      success: true,
      offersSent,
      rebalanced: rebalanceResult.rebalanced,
      remainingCleaners: remainingCompletions.length,
    };
  }

  /**
   * Handle cleaner accepting extra work after dropout
   * @param {number} multiCleanerJobId - Job ID
   * @param {number} cleanerId - Cleaner ID
   * @returns {Promise<Object>} Result
   */
  static async handleAcceptExtraWork(multiCleanerJobId, cleanerId) {
    const { CleanerJobCompletion } = require("../models");
    const MultiCleanerPricingService = require("./MultiCleanerPricingService");

    // Mark cleaner as having accepted extra work
    await CleanerJobCompletion.update(
      { extraWorkAccepted: true, extraWorkAcceptedAt: new Date() },
      { where: { multiCleanerJobId, cleanerId } }
    );

    // Get updated earnings
    const earningsResult = await MultiCleanerPricingService.recalculateEarningsAfterDropout(multiCleanerJobId);
    const cleanerEarnings = earningsResult.earnings.find((e) => e.cleanerId === cleanerId);

    return {
      success: true,
      message: "Extra work accepted! Your earnings have been updated.",
      newEarnings: cleanerEarnings?.totalEarnings || 0,
      extraEarnings: cleanerEarnings?.extraEarnings || 0,
    };
  }

  /**
   * Handle cleaner declining extra work after dropout
   * @param {number} multiCleanerJobId - Job ID
   * @param {number} cleanerId - Cleaner ID
   * @param {string} reason - Optional reason
   * @returns {Promise<Object>} Result
   */
  static async handleDeclineExtraWork(multiCleanerJobId, cleanerId, reason = null) {
    const { MultiCleanerJob, UserAppointments, CleanerJobCompletion } = require("../models");
    const NotificationService = require("./NotificationService");

    const job = await MultiCleanerJob.findByPk(multiCleanerJobId);
    const appointment = await UserAppointments.findByPk(job.appointmentId, {
      include: ["user"],
    });

    // Mark cleaner as having declined extra work
    await CleanerJobCompletion.update(
      { extraWorkDeclined: true, extraWorkDeclinedAt: new Date(), extraWorkDeclineReason: reason },
      { where: { multiCleanerJobId, cleanerId } }
    );

    // Release this cleaner
    await this.releaseSlot(multiCleanerJobId, cleanerId);

    // Check remaining cleaners
    const remainingCompletions = await CleanerJobCompletion.findAll({
      where: {
        multiCleanerJobId,
        status: { [Op.notIn]: ["dropped_out", "no_show"] },
      },
    });

    const appointmentDate = new Date(appointment.date);
    const formattedDate = appointmentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    // Notify homeowner
    if (remainingCompletions.length === 0) {
      await NotificationService.createNotification({
        userId: appointment.userId,
        type: "all_cleaners_unavailable",
        title: "All cleaners unavailable",
        body: `All cleaners for your ${formattedDate} appointment are now unavailable. Please reschedule or cancel without penalty.`,
        data: {
          appointmentId: appointment.id,
          multiCleanerJobId,
          canCancelFree: true,
          mustReschedule: true,
        },
        actionRequired: true,
      });
    } else {
      await NotificationService.createNotification({
        userId: appointment.userId,
        type: "cleaner_declined_extra",
        title: "Cleaner update",
        body: `Another cleaner for your ${formattedDate} appointment is unavailable. ${remainingCompletions.length} cleaner(s) remaining.`,
        data: {
          appointmentId: appointment.id,
          multiCleanerJobId,
          remainingCleaners: remainingCompletions.length,
        },
      });
    }

    return {
      success: true,
      message: "Extra work declined. You've been removed from the job.",
      remainingCleaners: remainingCompletions.length,
    };
  }

  /**
   * Handle expired extra work offers (cleaners didn't respond in time)
   * Releases non-responsive cleaners and notifies homeowner
   * @param {number} multiCleanerJobId - Job ID
   * @returns {Promise<Object>} Result
   */
  static async handleExpiredExtraWorkOffers(multiCleanerJobId) {
    const { MultiCleanerJob, UserAppointments, CleanerJobCompletion } = require("../models");
    const NotificationService = require("./NotificationService");

    const job = await MultiCleanerJob.findByPk(multiCleanerJobId);
    if (!job) {
      throw new Error("Multi-cleaner job not found");
    }

    const appointment = await UserAppointments.findByPk(job.appointmentId, {
      include: ["user"],
    });

    // Find cleaners who didn't respond (not accepted, not declined)
    const nonResponsiveCompletions = await CleanerJobCompletion.findAll({
      where: {
        multiCleanerJobId,
        status: { [Op.notIn]: ["dropped_out", "no_show"] },
        extraWorkAccepted: { [Op.or]: [false, null] },
        extraWorkDeclined: { [Op.or]: [false, null] },
      },
    });

    // Release non-responsive cleaners
    for (const completion of nonResponsiveCompletions) {
      await CleanerJobCompletion.update(
        { extraWorkDeclined: true, extraWorkDeclinedAt: new Date(), extraWorkDeclineReason: "No response - expired" },
        { where: { id: completion.id } }
      );
      await this.releaseSlot(multiCleanerJobId, completion.cleanerId);
    }

    // Mark job as having expired extra work offers
    await job.update({
      extraWorkOffersExpired: true,
      extraWorkOffersExpiredAt: new Date(),
    });

    // Check remaining cleaners (those who accepted)
    const remainingCompletions = await CleanerJobCompletion.findAll({
      where: {
        multiCleanerJobId,
        status: { [Op.notIn]: ["dropped_out", "no_show"] },
      },
    });

    const appointmentDate = new Date(appointment.date);
    const formattedDate = appointmentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    // Notify homeowner based on remaining cleaners
    if (remainingCompletions.length === 0) {
      await NotificationService.createNotification({
        userId: appointment.userId,
        type: "all_cleaners_unavailable",
        title: "All cleaners unavailable",
        body: `The cleaners for your ${formattedDate} appointment did not respond in time. Please reschedule or cancel without penalty.`,
        data: {
          appointmentId: appointment.id,
          multiCleanerJobId,
          canCancelFree: true,
          mustReschedule: true,
        },
        actionRequired: true,
      });
    } else if (remainingCompletions.length === 1) {
      // Only one cleaner accepted - offer them solo completion
      await this.offerSoloCompletion(multiCleanerJobId, remainingCompletions[0].cleanerId);

      await NotificationService.createNotification({
        userId: appointment.userId,
        type: "extra_work_offers_expired",
        title: "Cleaner update",
        body: `Some cleaners for your ${formattedDate} appointment did not respond. 1 cleaner is available and may complete solo.`,
        data: {
          appointmentId: appointment.id,
          multiCleanerJobId,
          remainingCleaners: 1,
        },
      });
    } else {
      // Multiple cleaners accepted - they'll cover the work
      await NotificationService.createNotification({
        userId: appointment.userId,
        type: "extra_work_offers_expired",
        title: "Cleaner update",
        body: `Some cleaners for your ${formattedDate} appointment did not respond. ${remainingCompletions.length} cleaners are confirmed.`,
        data: {
          appointmentId: appointment.id,
          multiCleanerJobId,
          remainingCleaners: remainingCompletions.length,
        },
      });
    }

    return {
      success: true,
      message: "Expired extra work offers processed.",
      nonResponsiveCount: nonResponsiveCompletions.length,
      remainingCleaners: remainingCompletions.length,
      appointmentId: appointment.id,
    };
  }
}

module.exports = MultiCleanerService;
