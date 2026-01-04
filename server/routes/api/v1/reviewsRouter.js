const express = require("express");
const jwt = require("jsonwebtoken");
const { User, UserAppointments, UserReviews, UserHomes, HomePreferredCleaner } = require("../../../models");
const ReviewsClass = require("../../../services/ReviewsClass");
const ReviewSerializer = require("../../../serializers/ReviewSerializer");
const EmailClass = require("../../../services/sendNotifications/EmailClass");
const PushNotificationClass = require("../../../services/sendNotifications/PushNotificationClass");
const EncryptionService = require("../../../services/EncryptionService");

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

        // Check if cleaner is already preferred for this home (for homeowner reviews)
        let isCleanerPreferred = false;
        if (home && assignedCleaners.length > 0 && userRole !== "cleaner") {
          const preferredRecord = await HomePreferredCleaner.findOne({
            where: {
              homeId: home.id,
              cleanerId: assignedCleaners[0].id,
            },
          });
          isCleanerPreferred = !!preferredRecord;
        }

        return {
          appointmentId: apt.id,
          date: apt.date,
          price: apt.price,
          home: home ? {
            id: home.id,
            address: EncryptionService.decrypt(home.address),
            city: EncryptionService.decrypt(home.city),
            nickName: home.nickName,
          } : null,
          cleaners: assignedCleaners,
          completedAt: apt.updatedAt,
          isCleanerPreferred,
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
      setAsPreferred: reviewData.setAsPreferred,
      homeId: reviewData.homeId,
    });

    const newReview = await ReviewsClass.submitReview(reviewData);

    // Handle preferred cleaner feature for homeowner reviews
    if (reviewData.reviewType === "homeowner_to_cleaner" && reviewData.homeId) {
      try {
        const cleanerId = reviewData.userId; // The cleaner being reviewed
        const homeId = reviewData.homeId;

        // Check if already a preferred cleaner for this home
        const existingPreferred = await HomePreferredCleaner.findOne({
          where: { homeId, cleanerId },
        });

        if (reviewData.setAsPreferred && !existingPreferred) {
          // Add as preferred cleaner
          await HomePreferredCleaner.create({
            homeId,
            cleanerId,
            setAt: new Date(),
            setBy: "review",
          });

          console.log("[Reviews] Created preferred cleaner record:", { homeId, cleanerId });

          // Get cleaner and home details for notifications
          const cleaner = await User.findByPk(cleanerId);
          const home = await UserHomes.findByPk(homeId);
          const homeowner = await User.findByPk(req.userId);

          if (cleaner && home && homeowner) {
            const homeAddress = home.nickName || EncryptionService.decrypt(home.address) || "their home";
            const homeownerName = homeowner.firstName
              ? `${EncryptionService.decrypt(homeowner.firstName)} ${homeowner.lastName ? EncryptionService.decrypt(homeowner.lastName) : ""}`.trim()
              : "A homeowner";

            // Send email notification to the cleaner
            try {
              await EmailClass.sendPreferredCleanerNotification(
                cleaner.getNotificationEmail(),
                cleaner.firstName ? EncryptionService.decrypt(cleaner.firstName) : "there",
                homeownerName,
                homeAddress
              );
              console.log("[Reviews] Sent preferred cleaner email to:", cleaner.email);
            } catch (emailError) {
              console.error("[Reviews] Failed to send preferred cleaner email:", emailError);
            }

            // Send push notification to the cleaner
            if (cleaner.expoPushToken) {
              try {
                await PushNotificationClass.sendPushNotification(
                  cleaner.expoPushToken,
                  "You earned preferred status!",
                  `${homeownerName} gave you preferred booking status for ${homeAddress}. You can now book directly without requesting approval!`
                );
                console.log("[Reviews] Sent preferred cleaner push notification");
              } catch (pushError) {
                console.error("[Reviews] Failed to send preferred cleaner push:", pushError);
              }
            }
          }
        } else if (!reviewData.setAsPreferred && existingPreferred) {
          // Remove from preferred cleaner list
          await HomePreferredCleaner.destroy({
            where: { homeId, cleanerId },
          });

          console.log("[Reviews] Removed preferred cleaner record:", { homeId, cleanerId });
        }
      } catch (preferredError) {
        // Log but don't fail the request if preferred cleaner feature has an issue
        console.error("[Reviews] Error handling preferred cleaner:", preferredError);
      }
    }

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
