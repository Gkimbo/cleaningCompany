const { UserReviews, User, UserAppointments, BusinessEmployee, UserHomes, EmployeeJobAssignment } = require("../models");
const { Op } = require("sequelize");

class ReviewsClass {
  // Submit a new review
  static async submitReview(reviewData) {
    const {
      userId,
      reviewerId,
      appointmentId,
      reviewType,
      review,
      reviewComment,
      privateComment,
      // Homeowner reviewing Cleaner
      cleaningQuality,
      punctuality,
      professionalism,
      communication,
      attentionToDetail,
      thoroughness,
      respectOfProperty,
      followedInstructions,
      wouldRecommend,
      // Cleaner reviewing Homeowner
      accuracyOfDescription,
      homeReadiness,
      easeOfAccess,
      homeCondition,
      respectfulness,
      safetyConditions,
      wouldWorkForAgain,
    } = reviewData;

    // Check if review already exists for this user/appointment combination
    const existingReview = await UserReviews.findOne({
      where: {
        reviewerId,
        appointmentId,
        userId,
      },
    });

    if (existingReview) {
      throw new Error("You have already reviewed this appointment");
    }

    // Get reviewer's name to store with the review
    const reviewer = await User.findByPk(reviewerId);
    const reviewerName = reviewer
      ? `${reviewer.firstName || ''} ${reviewer.lastName || ''}`.trim() || reviewer.username
      : null;

    // Create the review (unpublished by default)
    const newReview = await UserReviews.create({
      userId,
      reviewerId,
      reviewerName,
      appointmentId,
      reviewType,
      review,
      reviewComment,
      privateComment,
      // Homeowner reviewing Cleaner
      cleaningQuality,
      punctuality,
      professionalism,
      communication,
      attentionToDetail,
      thoroughness,
      respectOfProperty,
      followedInstructions,
      wouldRecommend,
      // Cleaner reviewing Homeowner
      accuracyOfDescription,
      homeReadiness,
      easeOfAccess,
      homeCondition,
      respectfulness,
      safetyConditions,
      wouldWorkForAgain,
      isPublished: false,
    });

    // Check if both parties have reviewed - if so, publish both
    await this.checkAndPublishReviews(appointmentId);

    // Create review copies for business owner and all assigned employees
    if (reviewType === "homeowner_to_cleaner") {
      await this.createReviewCopiesForAllEmployees(newReview, appointmentId);
    }

    return newReview;
  }

  /**
   * Create a copy of an employee review for the business owner's profile
   * This allows reviews for employees to also appear on the business profile
   */
  static async createBusinessReviewCopy(originalReview, appointmentId) {
    try {
      const reviewedUserId = originalReview.userId;

      // Check if the reviewed user is a business employee
      const employeeRecord = await BusinessEmployee.findOne({
        where: {
          userId: reviewedUserId,
          status: "active",
        },
      });

      if (!employeeRecord) {
        // Not a business employee, no copy needed
        return null;
      }

      const businessOwnerId = employeeRecord.businessOwnerId;

      // Verify this is a job for the business owner's client
      // (we only want to copy reviews from the business owner's clients, not marketplace clients)
      const appointment = await UserAppointments.findByPk(appointmentId, {
        include: [{ model: UserHomes, as: "home" }],
      });

      if (!appointment || !appointment.home) {
        return null;
      }

      // Check if the home's preferred cleaner is the business owner
      // This indicates it's a business client job
      const isBusinessClientJob = appointment.home.preferredCleanerId === businessOwnerId;

      if (!isBusinessClientJob) {
        // This is a marketplace job, not a business client job - no copy needed
        console.log(`[Reviews] Skipping business copy - not a business client job`);
        return null;
      }

      // Create a copy of the review for the business owner's profile
      const businessReviewCopy = await UserReviews.create({
        userId: businessOwnerId, // Review goes to business owner's profile
        reviewerId: originalReview.reviewerId,
        reviewerName: originalReview.reviewerName,
        appointmentId: originalReview.appointmentId,
        reviewType: originalReview.reviewType,
        review: originalReview.review,
        reviewComment: originalReview.reviewComment,
        privateComment: originalReview.privateComment,
        // Copy all aspect ratings
        cleaningQuality: originalReview.cleaningQuality,
        punctuality: originalReview.punctuality,
        professionalism: originalReview.professionalism,
        communication: originalReview.communication,
        attentionToDetail: originalReview.attentionToDetail,
        thoroughness: originalReview.thoroughness,
        respectOfProperty: originalReview.respectOfProperty,
        followedInstructions: originalReview.followedInstructions,
        wouldRecommend: originalReview.wouldRecommend,
        // Business review fields
        businessOwnerId: businessOwnerId,
        isBusinessReview: true,
        sourceReviewId: originalReview.id,
        isPublished: originalReview.isPublished, // Match the original's publish status
      });

      console.log(`[Reviews] Created business review copy ${businessReviewCopy.id} for business owner ${businessOwnerId} from employee review ${originalReview.id}`);

      return businessReviewCopy;
    } catch (error) {
      // Log but don't fail the original review submission
      console.error("[Reviews] Error creating business review copy:", error);
      return null;
    }
  }

  /**
   * Create review copies for all employees assigned to an appointment
   * This handles multi-employee jobs where one review should appear on all profiles
   * Also creates the business owner copy if applicable
   */
  static async createReviewCopiesForAllEmployees(originalReview, appointmentId) {
    const copies = [];

    try {
      // Get ALL employee assignments for this appointment (excluding cancelled/no-shows)
      const assignments = await EmployeeJobAssignment.findAll({
        where: {
          appointmentId,
          status: { [require("sequelize").Op.notIn]: ["cancelled", "no_show", "unassigned"] },
          isSelfAssignment: false, // Only employee assignments, not self-assignments
        },
        include: [
          {
            model: BusinessEmployee,
            as: "employee",
            include: [{ model: User, as: "user" }],
          },
        ],
      });

      // If no assignments found, fall back to the original single-employee behavior
      if (assignments.length === 0) {
        const businessCopy = await this.createBusinessReviewCopy(originalReview, appointmentId);
        if (businessCopy) copies.push(businessCopy);
        return copies;
      }

      // Track if we've created a business copy
      let businessCopyCreated = false;
      let businessOwnerId = null;

      // Create copy for each employee (except the original reviewed employee)
      for (const assignment of assignments) {
        const employeeUserId = assignment.employee?.userId;
        if (!employeeUserId) continue;

        // Store the business owner ID for later
        if (!businessOwnerId && assignment.businessOwnerId) {
          businessOwnerId = assignment.businessOwnerId;
        }

        // Skip if this employee is the original review target (they already have the original review)
        if (employeeUserId === originalReview.userId) {
          continue;
        }

        // Create a copy for this employee's profile
        try {
          const employeeCopy = await UserReviews.create({
            userId: employeeUserId, // Review goes to this employee's profile
            reviewerId: originalReview.reviewerId,
            reviewerName: originalReview.reviewerName,
            appointmentId: originalReview.appointmentId,
            reviewType: originalReview.reviewType,
            review: originalReview.review,
            reviewComment: originalReview.reviewComment,
            privateComment: originalReview.privateComment,
            // Copy all aspect ratings
            cleaningQuality: originalReview.cleaningQuality,
            punctuality: originalReview.punctuality,
            professionalism: originalReview.professionalism,
            communication: originalReview.communication,
            attentionToDetail: originalReview.attentionToDetail,
            thoroughness: originalReview.thoroughness,
            respectOfProperty: originalReview.respectOfProperty,
            followedInstructions: originalReview.followedInstructions,
            wouldRecommend: originalReview.wouldRecommend,
            // Employee review copy fields
            isEmployeeReviewCopy: true,
            sourceReviewId: originalReview.id,
            isPublished: originalReview.isPublished,
          });

          copies.push(employeeCopy);
          console.log(`[Reviews] Created employee review copy ${employeeCopy.id} for employee user ${employeeUserId} from review ${originalReview.id}`);
        } catch (copyError) {
          console.error(`[Reviews] Error creating employee review copy for user ${employeeUserId}:`, copyError);
        }
      }

      // Also create the business owner copy (using the original method)
      const businessCopy = await this.createBusinessReviewCopy(originalReview, appointmentId);
      if (businessCopy) {
        copies.push(businessCopy);
        businessCopyCreated = true;
      }

      console.log(`[Reviews] Created ${copies.length} review copies for appointment ${appointmentId} (${assignments.length} employees, business copy: ${businessCopyCreated})`);

      return copies;
    } catch (error) {
      console.error("[Reviews] Error creating review copies for all employees:", error);
      // Fall back to single business copy on error
      try {
        const businessCopy = await this.createBusinessReviewCopy(originalReview, appointmentId);
        if (businessCopy) copies.push(businessCopy);
      } catch (fallbackError) {
        console.error("[Reviews] Fallback also failed:", fallbackError);
      }
      return copies;
    }
  }

  // Check if both parties have submitted reviews for an appointment
  static async checkAndPublishReviews(appointmentId) {
    const reviews = await UserReviews.findAll({
      where: {
        appointmentId,
        isBusinessReview: false, // Only check original reviews, not business copies
      },
    });

    // Check if we have both types of reviews
    const homeownerReview = reviews.find(
      (r) => r.reviewType === "homeowner_to_cleaner"
    );
    const cleanerReview = reviews.find(
      (r) => r.reviewType === "cleaner_to_homeowner"
    );

    // If both reviews exist, publish all reviews for this appointment (including business copies)
    if (homeownerReview && cleanerReview) {
      await UserReviews.update(
        { isPublished: true },
        { where: { appointmentId } }
      );
      return true;
    }

    return false;
  }

  // Get review status for an appointment (who has reviewed)
  static async getReviewStatus(appointmentId, userId) {
    const reviews = await UserReviews.findAll({
      where: { appointmentId },
      include: [
        { model: User, as: "reviewer", attributes: ["id", "username", "firstName", "lastName"] },
        { model: User, as: "reviewedUser", attributes: ["id", "username", "firstName", "lastName"] },
      ],
    });

    const hasHomeownerReviewed = reviews.some(
      (r) => r.reviewType === "homeowner_to_cleaner"
    );
    const hasCleanerReviewed = reviews.some(
      (r) => r.reviewType === "cleaner_to_homeowner"
    );
    const userHasReviewed = reviews.some((r) => r.reviewerId === userId);
    const bothReviewed = hasHomeownerReviewed && hasCleanerReviewed;

    return {
      hasHomeownerReviewed,
      hasCleanerReviewed,
      userHasReviewed,
      bothReviewed,
      isPublished: bothReviewed,
    };
  }

  // Get published reviews for a user
  static async getPublishedReviewsForUser(userId) {
    const reviews = await UserReviews.findAll({
      where: {
        userId,
        isPublished: true,
      },
      include: [
        { model: User, as: "reviewer", attributes: ["id", "username", "firstName", "lastName"] },
        { model: UserAppointments, as: "appointment" },
      ],
      order: [["createdAt", "DESC"]],
    });

    return reviews;
  }

  // Get all reviews written by a user
  static async getReviewsWrittenByUser(userId) {
    const reviews = await UserReviews.findAll({
      where: { reviewerId: userId },
      include: [
        { model: User, as: "reviewedUser", attributes: ["id", "username", "firstName", "lastName"] },
        { model: UserAppointments, as: "appointment" },
      ],
      order: [["createdAt", "DESC"]],
    });

    return reviews;
  }

  // Get pending reviews (appointments completed but not yet reviewed by user)
  static async getPendingReviewsForUser(userId, userRole) {
    // Get appointments the user was part of that are completed
    let appointments;

    if (userRole === "cleaner") {
      // Get completed appointments where this cleaner was assigned
      appointments = await UserAppointments.findAll({
        where: {
          completed: true,
        },
      });
      // Filter to those where cleaner was assigned
      appointments = appointments.filter((apt) => {
        const assigned = apt.employeesAssigned || [];
        return assigned.includes(String(userId));
      });
    } else {
      // Get completed appointments for homes owned by this user
      const { UserHomes } = require("../models");
      const userHomes = await UserHomes.findAll({
        where: { userId },
        attributes: ["id"],
      });
      const homeIds = userHomes.map((h) => h.id);

      appointments = await UserAppointments.findAll({
        where: {
          homeId: { [Op.in]: homeIds },
          completed: true,
        },
      });
    }

    // Filter to appointments not yet reviewed by this user
    const pendingReviews = [];
    for (const apt of appointments) {
      const existingReview = await UserReviews.findOne({
        where: {
          appointmentId: apt.id,
          reviewerId: userId,
        },
      });

      if (!existingReview) {
        pendingReviews.push(apt);
      }
    }

    return pendingReviews;
  }

  // Get review statistics for a user
  static async getReviewStats(userId) {
    const reviews = await UserReviews.findAll({
      where: {
        userId,
        isPublished: true,
      },
    });

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        recommendationRate: 0,
        aspectAverages: {},
      };
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.review, 0);
    const averageRating = totalRating / reviews.length;

    // Calculate recommendation rate
    const homeownerReviews = reviews.filter(
      (r) => r.reviewType === "homeowner_to_cleaner"
    );
    const cleanerReviews = reviews.filter(
      (r) => r.reviewType === "cleaner_to_homeowner"
    );

    let recommendationRate = 0;
    if (homeownerReviews.length > 0) {
      const recommendCount = homeownerReviews.filter(
        (r) => r.wouldRecommend
      ).length;
      recommendationRate = (recommendCount / homeownerReviews.length) * 100;
    } else if (cleanerReviews.length > 0) {
      const workAgainCount = cleanerReviews.filter(
        (r) => r.wouldWorkForAgain
      ).length;
      recommendationRate = (workAgainCount / cleanerReviews.length) * 100;
    }

    // Calculate aspect averages based on review type
    const aspectAverages = {};

    if (homeownerReviews.length > 0) {
      aspectAverages.cleaningQuality = this.calculateAspectAverage(
        homeownerReviews,
        "cleaningQuality"
      );
      aspectAverages.punctuality = this.calculateAspectAverage(
        homeownerReviews,
        "punctuality"
      );
      aspectAverages.professionalism = this.calculateAspectAverage(
        homeownerReviews,
        "professionalism"
      );
      aspectAverages.communication = this.calculateAspectAverage(
        homeownerReviews,
        "communication"
      );
      aspectAverages.attentionToDetail = this.calculateAspectAverage(
        homeownerReviews,
        "attentionToDetail"
      );
      aspectAverages.thoroughness = this.calculateAspectAverage(
        homeownerReviews,
        "thoroughness"
      );
      aspectAverages.respectOfProperty = this.calculateAspectAverage(
        homeownerReviews,
        "respectOfProperty"
      );
      aspectAverages.followedInstructions = this.calculateAspectAverage(
        homeownerReviews,
        "followedInstructions"
      );
    }

    if (cleanerReviews.length > 0) {
      aspectAverages.accuracyOfDescription = this.calculateAspectAverage(
        cleanerReviews,
        "accuracyOfDescription"
      );
      aspectAverages.homeReadiness = this.calculateAspectAverage(
        cleanerReviews,
        "homeReadiness"
      );
      aspectAverages.easeOfAccess = this.calculateAspectAverage(
        cleanerReviews,
        "easeOfAccess"
      );
      aspectAverages.communication = this.calculateAspectAverage(
        cleanerReviews,
        "communication"
      );
      aspectAverages.homeCondition = this.calculateAspectAverage(
        cleanerReviews,
        "homeCondition"
      );
      aspectAverages.respectfulness = this.calculateAspectAverage(
        cleanerReviews,
        "respectfulness"
      );
      aspectAverages.safetyConditions = this.calculateAspectAverage(
        cleanerReviews,
        "safetyConditions"
      );
    }

    return {
      averageRating: parseFloat(averageRating.toFixed(1)),
      totalReviews: reviews.length,
      recommendationRate: Math.round(recommendationRate),
      aspectAverages,
    };
  }

  static calculateAspectAverage(reviews, aspect) {
    const validReviews = reviews.filter((r) => r[aspect] !== null);
    if (validReviews.length === 0) return null;
    const sum = validReviews.reduce((acc, r) => acc + r[aspect], 0);
    return parseFloat((sum / validReviews.length).toFixed(1));
  }

  /**
   * Get review statistics for a business owner (business client reviews only)
   * Only includes reviews where isBusinessReview is true
   */
  static async getBusinessReviewStats(businessOwnerId) {
    const reviews = await UserReviews.findAll({
      where: {
        userId: businessOwnerId,
        isPublished: true,
        isBusinessReview: true,
      },
    });

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        recommendationRate: 0,
        aspectAverages: {},
        isBusinessStats: true,
      };
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.review, 0);
    const averageRating = totalRating / reviews.length;

    // Calculate recommendation rate
    const homeownerReviews = reviews.filter(
      (r) => r.reviewType === "homeowner_to_cleaner"
    );

    let recommendationRate = 0;
    if (homeownerReviews.length > 0) {
      const recommendCount = homeownerReviews.filter(
        (r) => r.wouldRecommend
      ).length;
      recommendationRate = (recommendCount / homeownerReviews.length) * 100;
    }

    // Calculate aspect averages
    const aspectAverages = {};
    if (homeownerReviews.length > 0) {
      aspectAverages.cleaningQuality = this.calculateAspectAverage(homeownerReviews, "cleaningQuality");
      aspectAverages.punctuality = this.calculateAspectAverage(homeownerReviews, "punctuality");
      aspectAverages.professionalism = this.calculateAspectAverage(homeownerReviews, "professionalism");
      aspectAverages.communication = this.calculateAspectAverage(homeownerReviews, "communication");
      aspectAverages.attentionToDetail = this.calculateAspectAverage(homeownerReviews, "attentionToDetail");
      aspectAverages.thoroughness = this.calculateAspectAverage(homeownerReviews, "thoroughness");
      aspectAverages.respectOfProperty = this.calculateAspectAverage(homeownerReviews, "respectOfProperty");
      aspectAverages.followedInstructions = this.calculateAspectAverage(homeownerReviews, "followedInstructions");
    }

    return {
      averageRating: parseFloat(averageRating.toFixed(1)),
      totalReviews: reviews.length,
      recommendationRate: Math.round(recommendationRate),
      aspectAverages,
      isBusinessStats: true,
    };
  }

  /**
   * Get review statistics for marketplace jobs only (excludes business client reviews)
   * Useful for showing marketplace ratings separately from business ratings
   */
  static async getMarketplaceReviewStats(cleanerId) {
    const reviews = await UserReviews.findAll({
      where: {
        userId: cleanerId,
        isPublished: true,
        isBusinessReview: false,
      },
    });

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        recommendationRate: 0,
        aspectAverages: {},
        isMarketplaceStats: true,
      };
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.review, 0);
    const averageRating = totalRating / reviews.length;

    const homeownerReviews = reviews.filter(
      (r) => r.reviewType === "homeowner_to_cleaner"
    );
    const cleanerReviews = reviews.filter(
      (r) => r.reviewType === "cleaner_to_homeowner"
    );

    let recommendationRate = 0;
    if (homeownerReviews.length > 0) {
      const recommendCount = homeownerReviews.filter(
        (r) => r.wouldRecommend
      ).length;
      recommendationRate = (recommendCount / homeownerReviews.length) * 100;
    } else if (cleanerReviews.length > 0) {
      const workAgainCount = cleanerReviews.filter(
        (r) => r.wouldWorkForAgain
      ).length;
      recommendationRate = (workAgainCount / cleanerReviews.length) * 100;
    }

    const aspectAverages = {};
    if (homeownerReviews.length > 0) {
      aspectAverages.cleaningQuality = this.calculateAspectAverage(homeownerReviews, "cleaningQuality");
      aspectAverages.punctuality = this.calculateAspectAverage(homeownerReviews, "punctuality");
      aspectAverages.professionalism = this.calculateAspectAverage(homeownerReviews, "professionalism");
      aspectAverages.communication = this.calculateAspectAverage(homeownerReviews, "communication");
      aspectAverages.attentionToDetail = this.calculateAspectAverage(homeownerReviews, "attentionToDetail");
      aspectAverages.thoroughness = this.calculateAspectAverage(homeownerReviews, "thoroughness");
      aspectAverages.respectOfProperty = this.calculateAspectAverage(homeownerReviews, "respectOfProperty");
      aspectAverages.followedInstructions = this.calculateAspectAverage(homeownerReviews, "followedInstructions");
    }

    return {
      averageRating: parseFloat(averageRating.toFixed(1)),
      totalReviews: reviews.length,
      recommendationRate: Math.round(recommendationRate),
      aspectAverages,
      isMarketplaceStats: true,
    };
  }

  /**
   * Get published business reviews for a business owner
   */
  static async getBusinessReviewsForOwner(businessOwnerId) {
    const reviews = await UserReviews.findAll({
      where: {
        userId: businessOwnerId,
        isPublished: true,
        isBusinessReview: true,
      },
      include: [
        { model: User, as: "reviewer", attributes: ["id", "username", "firstName", "lastName"] },
        { model: UserAppointments, as: "appointment" },
      ],
      order: [["createdAt", "DESC"]],
    });

    return reviews;
  }

  // Legacy method for backwards compatibility
  static async addReviewToDB({
    userId,
    reviewerId,
    appointmentId,
    rating,
    comment,
  }) {
    // Get reviewer's name to store with the review
    const reviewer = await User.findByPk(reviewerId);
    const reviewerName = reviewer
      ? `${reviewer.firstName || ''} ${reviewer.lastName || ''}`.trim() || reviewer.username
      : null;

    const newReview = await UserReviews.create({
      userId,
      reviewerId,
      reviewerName,
      appointmentId,
      review: rating,
      reviewComment: comment,
      isPublished: true, // Legacy reviews are published immediately
    });
    return newReview;
  }
}

module.exports = ReviewsClass;
