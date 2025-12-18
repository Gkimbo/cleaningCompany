const { UserReviews, User, UserAppointments } = require("../models");
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
      wouldRecommend,
      // Cleaner reviewing Homeowner
      accuracyOfDescription,
      homeReadiness,
      easeOfAccess,
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

    // Create the review (unpublished by default)
    const newReview = await UserReviews.create({
      userId,
      reviewerId,
      appointmentId,
      reviewType,
      review,
      reviewComment,
      privateComment,
      cleaningQuality,
      punctuality,
      professionalism,
      communication,
      wouldRecommend,
      accuracyOfDescription,
      homeReadiness,
      easeOfAccess,
      wouldWorkForAgain,
      isPublished: false,
    });

    // Check if both parties have reviewed - if so, publish both
    await this.checkAndPublishReviews(appointmentId);

    return newReview;
  }

  // Check if both parties have submitted reviews for an appointment
  static async checkAndPublishReviews(appointmentId) {
    const reviews = await UserReviews.findAll({
      where: { appointmentId },
    });

    // Check if we have both types of reviews
    const homeownerReview = reviews.find(
      (r) => r.reviewType === "homeowner_to_cleaner"
    );
    const cleanerReview = reviews.find(
      (r) => r.reviewType === "cleaner_to_homeowner"
    );

    // If both reviews exist, publish both
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

  // Legacy method for backwards compatibility
  static async addReviewToDB({
    userId,
    reviewerId,
    appointmentId,
    rating,
    comment,
  }) {
    const newReview = await UserReviews.create({
      userId,
      reviewerId,
      appointmentId,
      review: rating,
      reviewComment: comment,
      isPublished: true, // Legacy reviews are published immediately
    });
    return newReview;
  }
}

module.exports = ReviewsClass;
