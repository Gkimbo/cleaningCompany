/**
 * MultiCleanerPricingService
 *
 * Handles all financial calculations for multi-cleaner jobs:
 * - Total job pricing
 * - Per-cleaner earnings splits
 * - Solo completion bonuses
 * - Partial work calculations
 */
const { getPricingConfig } = require("../config/businessConfig");

class MultiCleanerPricingService {
  /**
   * Calculate total job price for a multi-cleaner job
   * @param {Object} home - Home object
   * @param {Object} appointment - Appointment object
   * @param {number} cleanerCount - Number of cleaners
   * @returns {Promise<number>} Total price in cents
   */
  static async calculateTotalJobPrice(home, appointment, cleanerCount) {
    const calculatePrice = require("./CalculatePrice");

    // Get base price using existing pricing logic
    const basePrice = await calculatePrice(
      appointment.bringSheets,
      appointment.bringTowels,
      home.numBeds,
      home.numBaths,
      appointment.timeToBeCompleted,
      appointment.sheetConfigurations || home.bedConfigurations,
      appointment.towelConfigurations || home.bathroomConfigurations
    );

    // Convert to cents
    return Math.round(basePrice * 100);
  }

  /**
   * Calculate earnings breakdown for each cleaner
   * @param {number} totalPriceCents - Total job price in cents
   * @param {number} cleanerCount - Number of cleaners
   * @param {Array} roomAssignments - Room assignments (optional, for proportional split)
   * @returns {Promise<Object>} Earnings breakdown
   */
  static async calculatePerCleanerEarnings(
    totalPriceCents,
    cleanerCount,
    roomAssignments = null
  ) {
    const config = await getPricingConfig();
    const platformFeePercent =
      config?.multiCleaner?.platformFeePercent || 0.13;

    // Calculate platform cut
    const platformFee = Math.round(totalPriceCents * platformFeePercent);
    const netForCleaners = totalPriceCents - platformFee;

    if (!roomAssignments || roomAssignments.length === 0) {
      // Equal split
      const perCleanerBase = Math.floor(netForCleaners / cleanerCount);
      const remainder = netForCleaners - perCleanerBase * cleanerCount;

      const earnings = [];
      for (let i = 0; i < cleanerCount; i++) {
        // First cleaner gets the remainder (pennies)
        earnings.push({
          cleanerIndex: i,
          grossAmount: Math.round(totalPriceCents / cleanerCount),
          platformFee: Math.round(platformFee / cleanerCount),
          netAmount: perCleanerBase + (i === 0 ? remainder : 0),
          percentOfWork: Math.round(100 / cleanerCount),
        });
      }

      return {
        totalPrice: totalPriceCents,
        platformFee,
        netForCleaners,
        platformFeePercent,
        cleanerEarnings: earnings,
      };
    }

    // Proportional split based on room assignments
    const totalEffort = roomAssignments.reduce(
      (sum, r) => sum + (r.estimatedMinutes || 0),
      0
    );

    // Group assignments by cleaner
    const cleanerEfforts = {};
    for (const assignment of roomAssignments) {
      const cleanerId = assignment.cleanerId || assignment.cleanerSlotIndex;
      if (!cleanerEfforts[cleanerId]) {
        cleanerEfforts[cleanerId] = 0;
      }
      cleanerEfforts[cleanerId] += assignment.estimatedMinutes || 0;
    }

    const earnings = [];
    let allocatedAmount = 0;

    const cleanerIds = Object.keys(cleanerEfforts);
    for (let i = 0; i < cleanerIds.length; i++) {
      const cleanerId = cleanerIds[i];
      const effort = cleanerEfforts[cleanerId];
      const percentOfWork =
        totalEffort > 0 ? Math.round((effort / totalEffort) * 100) : 0;

      let netAmount;
      if (i === cleanerIds.length - 1) {
        // Last cleaner gets remainder to avoid rounding errors
        netAmount = netForCleaners - allocatedAmount;
      } else {
        netAmount = Math.round((effort / totalEffort) * netForCleaners);
        allocatedAmount += netAmount;
      }

      earnings.push({
        cleanerId,
        cleanerIndex: i,
        grossAmount: Math.round((effort / totalEffort) * totalPriceCents),
        platformFee: Math.round((effort / totalEffort) * platformFee),
        netAmount,
        percentOfWork,
        estimatedMinutes: effort,
      });
    }

    return {
      totalPrice: totalPriceCents,
      platformFee,
      netForCleaners,
      platformFeePercent,
      cleanerEarnings: earnings,
    };
  }

  /**
   * Calculate earnings for solo completion after co-cleaner dropout
   * @param {number} appointmentId - Appointment ID
   * @returns {Promise<number>} Solo completion earnings in cents
   */
  static async calculateSoloCompletionEarnings(appointmentId) {
    const { UserAppointments, UserHomes } = require("../models");
    const config = await getPricingConfig();

    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [{ model: UserHomes, as: "home" }],
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const totalPriceCents = await this.calculateTotalJobPrice(
      appointment.home,
      appointment,
      1
    );

    // For solo completion, use regular platform fee (not multi-cleaner fee)
    const platformFeePercent =
      config?.platform?.feePercent || 0.10;
    const platformFee = Math.round(totalPriceCents * platformFeePercent);

    // Add solo bonus if configured
    const soloBonus = config?.multiCleaner?.soloLargeHomeBonus || 0;

    return totalPriceCents - platformFee + soloBonus;
  }

  /**
   * Calculate partial payment based on rooms completed
   * @param {number} completedRooms - Number of completed rooms
   * @param {number} totalRooms - Total number of rooms
   * @param {number} totalPriceCents - Total job price in cents
   * @returns {Promise<Object>} Partial payment calculation
   */
  static async calculatePartialPayment(completedRooms, totalRooms, totalPriceCents) {
    const config = await getPricingConfig();
    const platformFeePercent =
      config?.multiCleaner?.platformFeePercent || 0.13;

    const completionRatio = totalRooms > 0 ? completedRooms / totalRooms : 0;
    const partialPrice = Math.round(totalPriceCents * completionRatio);
    const platformFee = Math.round(partialPrice * platformFeePercent);
    const netForCleaners = partialPrice - platformFee;

    return {
      completedRooms,
      totalRooms,
      completionPercentage: Math.round(completionRatio * 100),
      partialPrice,
      platformFee,
      netForCleaners,
    };
  }

  /**
   * Generate detailed earnings breakdown for display
   * @param {number} multiCleanerJobId - Multi-cleaner job ID
   * @returns {Promise<Object>} Detailed breakdown
   */
  static async generateEarningsBreakdown(multiCleanerJobId) {
    const {
      MultiCleanerJob,
      UserAppointments,
      UserHomes,
      CleanerRoomAssignment,
      User,
    } = require("../models");

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

    const { appointment } = job;

    // Get total price
    const totalPriceCents = await this.calculateTotalJobPrice(
      appointment.home,
      appointment,
      job.totalCleanersRequired
    );

    // Get room assignments
    const roomAssignments = await CleanerRoomAssignment.findAll({
      where: { multiCleanerJobId },
      include: [
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    // Calculate earnings per cleaner
    const earningsBreakdown = await this.calculatePerCleanerEarnings(
      totalPriceCents,
      job.totalCleanersRequired,
      roomAssignments
    );

    // Enhance with cleaner details
    const cleanerDetails = [];
    const cleanerMap = new Map();

    for (const assignment of roomAssignments) {
      if (assignment.cleanerId && !cleanerMap.has(assignment.cleanerId)) {
        cleanerMap.set(assignment.cleanerId, {
          cleaner: assignment.cleaner,
          rooms: [],
        });
      }
      if (assignment.cleanerId) {
        cleanerMap
          .get(assignment.cleanerId)
          .rooms.push(assignment.getDisplayLabel());
      }
    }

    for (const [cleanerId, data] of cleanerMap) {
      const earning = earningsBreakdown.cleanerEarnings.find(
        (e) => e.cleanerId == cleanerId
      );
      cleanerDetails.push({
        cleanerId,
        cleanerName: data.cleaner
          ? `${data.cleaner.firstName} ${data.cleaner.lastName}`
          : "Unassigned",
        assignedRooms: data.rooms,
        earnings: earning
          ? {
              grossAmount: earning.grossAmount,
              platformFee: earning.platformFee,
              netAmount: earning.netAmount,
              percentOfWork: earning.percentOfWork,
            }
          : null,
      });
    }

    return {
      multiCleanerJobId,
      appointmentId: appointment.id,
      appointmentDate: appointment.date,
      homeAddress: appointment.home
        ? `${appointment.home.address}, ${appointment.home.city}`
        : null,
      totalPrice: totalPriceCents,
      totalPriceFormatted: `$${(totalPriceCents / 100).toFixed(2)}`,
      platformFee: earningsBreakdown.platformFee,
      platformFeePercent: earningsBreakdown.platformFeePercent * 100,
      netForCleaners: earningsBreakdown.netForCleaners,
      cleanersRequired: job.totalCleanersRequired,
      cleanersConfirmed: job.cleanersConfirmed,
      cleanerDetails,
    };
  }

  /**
   * Update room assignment earnings shares
   * @param {number} multiCleanerJobId - Job ID
   * @param {number} totalPriceCents - Total price
   * @returns {Promise<void>}
   */
  static async updateRoomEarningsShares(multiCleanerJobId, totalPriceCents) {
    const { CleanerRoomAssignment } = require("../models");

    const assignments = await CleanerRoomAssignment.findAll({
      where: { multiCleanerJobId },
    });

    const totalEffort = assignments.reduce(
      (sum, a) => sum + (a.estimatedMinutes || 0),
      0
    );

    const config = await getPricingConfig();
    const platformFeePercent =
      config?.multiCleaner?.platformFeePercent || 0.13;
    const netForCleaners = Math.round(totalPriceCents * (1 - platformFeePercent));

    for (const assignment of assignments) {
      const effortRatio =
        totalEffort > 0 ? assignment.estimatedMinutes / totalEffort : 0;
      const earningsShare = Math.round(netForCleaners * effortRatio);

      await assignment.update({ cleanerEarningsShare: earningsShare });
    }
  }

  /**
   * Calculate homeowner total cost including any multi-cleaner fees
   * @param {number} basePriceCents - Base cleaning price
   * @param {number} cleanerCount - Number of cleaners
   * @returns {Promise<Object>} Cost breakdown for homeowner
   */
  static async calculateHomeownerCost(basePriceCents, cleanerCount) {
    // Currently no additional fee for multi-cleaner jobs
    // The platform absorbs any coordination costs
    return {
      basePriceCents,
      multiCleanerFee: 0,
      totalCost: basePriceCents,
      cleanerCount,
      note:
        cleanerCount > 1
          ? `This job will be cleaned by ${cleanerCount} cleaners for faster service.`
          : null,
    };
  }

  /**
   * Recalculate earnings after a cleaner dropout and room rebalancing
   * Returns the new earnings for each remaining cleaner
   * @param {number} multiCleanerJobId - Job ID
   * @returns {Promise<Object>} Updated earnings breakdown per cleaner
   */
  static async recalculateEarningsAfterDropout(multiCleanerJobId) {
    const {
      MultiCleanerJob,
      UserAppointments,
      UserHomes,
      CleanerRoomAssignment,
      CleanerJobCompletion,
    } = require("../models");

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

    const { appointment } = job;

    // Get total price based on original cleaner count (homeowner paid for full job)
    const totalPriceCents = await this.calculateTotalJobPrice(
      appointment.home,
      appointment,
      job.totalCleanersRequired
    );

    // Get remaining active cleaners
    const activeCompletions = await CleanerJobCompletion.findAll({
      where: {
        multiCleanerJobId,
        status: { [require("sequelize").Op.notIn]: ["dropped_out", "no_show"] },
      },
    });

    const remainingCleanerCount = activeCompletions.length;

    if (remainingCleanerCount === 0) {
      return { earnings: [], totalPriceCents, remainingCleaners: 0 };
    }

    // Update room earnings shares based on new assignments
    await this.updateRoomEarningsShares(multiCleanerJobId, totalPriceCents);

    // Get updated assignments with earnings
    const assignments = await CleanerRoomAssignment.findAll({
      where: { multiCleanerJobId },
    });

    // Calculate earnings per remaining cleaner
    const earningsPerCleaner = {};
    for (const completion of activeCompletions) {
      earningsPerCleaner[completion.cleanerId] = {
        cleanerId: completion.cleanerId,
        roomCount: 0,
        totalEarnings: 0,
        previousEarnings: 0, // Could track this if needed
        extraEarnings: 0,
      };
    }

    for (const assignment of assignments) {
      if (assignment.cleanerId && earningsPerCleaner[assignment.cleanerId]) {
        earningsPerCleaner[assignment.cleanerId].roomCount++;
        earningsPerCleaner[assignment.cleanerId].totalEarnings +=
          assignment.cleanerEarningsShare || 0;
      }
    }

    // Calculate what equal split would have been with original cleaners
    const config = await getPricingConfig();
    const platformFeePercent = config?.multiCleaner?.platformFeePercent || 0.13;
    const netForCleaners = Math.round(totalPriceCents * (1 - platformFeePercent));
    const originalEqualShare = Math.round(netForCleaners / job.totalCleanersRequired);

    // Calculate extra earnings for each remaining cleaner
    const earnings = Object.values(earningsPerCleaner).map((e) => ({
      ...e,
      extraEarnings: e.totalEarnings - originalEqualShare,
      totalEarningsFormatted: `$${(e.totalEarnings / 100).toFixed(2)}`,
      extraEarningsFormatted: `$${((e.totalEarnings - originalEqualShare) / 100).toFixed(2)}`,
    }));

    return {
      earnings,
      totalPriceCents,
      netForCleaners,
      remainingCleaners: remainingCleanerCount,
      originalCleanersRequired: job.totalCleanersRequired,
      platformFeePercent,
    };
  }
}

module.exports = MultiCleanerPricingService;
