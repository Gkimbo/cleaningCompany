const express = require("express");
const jwt = require("jsonwebtoken");
const { User, UserAppointments, UserReviews, UserHomes } = require("../../../models");
const ReviewsClass = require("../../../services/ReviewsClass");
const ReviewSerializer = require("../../../serializers/ReviewSerializer");

const reviewsRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No authorization header" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Get all published reviews for the authenticated user
reviewsRouter.get("/", verifyToken, async (req, res) => {
  try {
    const reviews = await ReviewsClass.getPublishedReviewsForUser(req.userId);
    const serializedReviews = ReviewSerializer.serializeArray(reviews);
    return res.status(200).json({ reviews: serializedReviews });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Get published reviews for a specific user (public profile)
reviewsRouter.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const reviews = await ReviewsClass.getPublishedReviewsForUser(parseInt(userId));
    const stats = await ReviewsClass.getReviewStats(parseInt(userId));
    return res.status(200).json({ reviews, stats });
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    return res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Get review status for an appointment
reviewsRouter.get("/status/:appointmentId", verifyToken, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const status = await ReviewsClass.getReviewStatus(
      parseInt(appointmentId),
      req.userId
    );
    return res.status(200).json(status);
  } catch (error) {
    console.error("Error fetching review status:", error);
    return res.status(500).json({ error: "Failed to fetch review status" });
  }
});

// Get pending reviews for the authenticated user
reviewsRouter.get("/pending", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    const userRole = user.type || "client";

    const pendingAppointments = await ReviewsClass.getPendingReviewsForUser(
      req.userId,
      userRole
    );

    // Enrich with appointment details
    const enrichedPending = await Promise.all(
      pendingAppointments.map(async (apt) => {
        const home = await UserHomes.findByPk(apt.homeId);
        const assignedCleaners = await User.findAll({
          where: {
            id: apt.employeesAssigned || [],
          },
          attributes: ["id", "username", "firstName", "lastName"],
        });

        return {
          appointmentId: apt.id,
          date: apt.date,
          price: apt.price,
          home: home ? {
            id: home.id,
            address: home.address,
            city: home.city,
            nickName: home.nickName,
          } : null,
          cleaners: assignedCleaners,
          completedAt: apt.updatedAt,
        };
      })
    );

    return res.status(200).json({ pendingReviews: enrichedPending });
  } catch (error) {
    console.error("Error fetching pending reviews:", error);
    return res.status(500).json({ error: "Failed to fetch pending reviews" });
  }
});

// Get review statistics for the authenticated user
reviewsRouter.get("/stats", verifyToken, async (req, res) => {
  try {
    const stats = await ReviewsClass.getReviewStats(req.userId);
    return res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching review stats:", error);
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Submit a new review (multi-aspect)
reviewsRouter.post("/submit", verifyToken, async (req, res) => {
  try {
    const reviewData = {
      ...req.body,
      reviewerId: req.userId,
    };

    console.log("[Reviews] Submit attempt:", {
      reviewerId: reviewData.reviewerId,
      userId: reviewData.userId,
      appointmentId: reviewData.appointmentId,
      reviewType: reviewData.reviewType,
    });

    const newReview = await ReviewsClass.submitReview(reviewData);

    // Check and return updated status
    const status = await ReviewsClass.getReviewStatus(
      reviewData.appointmentId,
      req.userId
    );

    return res.status(201).json({
      review: newReview,
      status,
      message: status.bothReviewed
        ? "Both reviews submitted! Reviews are now visible."
        : "Review submitted! It will be visible once the other party submits their review.",
    });
  } catch (error) {
    console.error("[Reviews] Error submitting review:", error.message);
    console.error("[Reviews] Full error:", error);
    if (error.message === "You have already reviewed this appointment") {
      return res.status(400).json({ error: error.message });
    }
    // Check for Sequelize validation errors
    if (error.name === "SequelizeValidationError" || error.name === "SequelizeDatabaseError") {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to submit review" });
  }
});

// Legacy submit endpoint (backwards compatibility)
reviewsRouter.post("/submit-legacy", async (req, res) => {
  const { userId, reviewerId, appointmentId, rating, comment } = req.body;
  try {
    const newReview = await ReviewsClass.addReviewToDB({
      userId,
      reviewerId,
      appointmentId,
      rating,
      comment,
    });

    return res.status(200).json({ newReview });
  } catch (error) {
    console.error("Error submitting legacy review:", error);
    return res.status(500).json({ error: "Failed to submit review" });
  }
});

// Get reviews written by the authenticated user
reviewsRouter.get("/written", verifyToken, async (req, res) => {
  try {
    const reviews = await ReviewsClass.getReviewsWrittenByUser(req.userId);
    return res.status(200).json({ reviews });
  } catch (error) {
    console.error("Error fetching written reviews:", error);
    return res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Delete a review (only unpublished reviews can be deleted)
reviewsRouter.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const review = await UserReviews.findOne({
      where: { id, reviewerId: req.userId },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.isPublished) {
      return res.status(400).json({ error: "Cannot delete published reviews" });
    }

    await review.destroy();
    return res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error);
    return res.status(500).json({ error: "Failed to delete review" });
  }
});

module.exports = reviewsRouter;
