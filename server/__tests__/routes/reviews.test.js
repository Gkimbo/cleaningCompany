const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  UserReviews: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
}));

// Mock ReviewsClass
jest.mock("../../services/ReviewsClass", () => ({
  getPublishedReviewsForUser: jest.fn(),
  getReviewStats: jest.fn(),
  getReviewStatus: jest.fn(),
  getPendingReviewsForUser: jest.fn(),
  submitReview: jest.fn(),
  checkAndPublishReviews: jest.fn(),
  getReviewsWrittenByUser: jest.fn(),
  addReviewToDB: jest.fn(),
}));

// Mock ReviewSerializer
jest.mock("../../serializers/ReviewSerializer", () => ({
  serializeArray: jest.fn((reviews) => reviews),
}));

const { User, UserReviews, UserHomes } = require("../../models");
const ReviewsClass = require("../../services/ReviewsClass");
const ReviewSerializer = require("../../serializers/ReviewSerializer");

describe("Reviews Router", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  beforeAll(() => {
    // Override secret for tests
    process.env.SESSION_SECRET = secretKey;

    app = express();
    app.use(express.json());

    const reviewsRouter = require("../../routes/api/v1/reviewsRouter");
    app.use("/api/v1/reviews", reviewsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication Middleware", () => {
    it("should return 401 without authorization header", async () => {
      const res = await request(app).get("/api/v1/reviews");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("No authorization header");
    });

    it("should return 401 with invalid token", async () => {
      const res = await request(app)
        .get("/api/v1/reviews")
        .set("Authorization", "Bearer invalid_token");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid or expired token");
    });
  });

  describe("GET /reviews", () => {
    it("should return published reviews for authenticated user", async () => {
      const token = generateToken(1);
      const mockReviews = [
        { id: 1, review: 4.5, reviewComment: "Great!" },
        { id: 2, review: 5.0, reviewComment: "Excellent!" },
      ];

      ReviewsClass.getPublishedReviewsForUser.mockResolvedValue(mockReviews);

      const res = await request(app)
        .get("/api/v1/reviews")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.reviews).toHaveLength(2);
      expect(ReviewsClass.getPublishedReviewsForUser).toHaveBeenCalledWith(1);
    });

    it("should handle errors gracefully", async () => {
      const token = generateToken(1);
      ReviewsClass.getPublishedReviewsForUser.mockRejectedValue(new Error("DB Error"));

      const res = await request(app)
        .get("/api/v1/reviews")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch reviews");
    });
  });

  describe("GET /reviews/user/:userId", () => {
    it("should return public reviews for a user", async () => {
      const mockReviews = [{ id: 1, review: 4.5 }];
      const mockStats = { averageRating: 4.5, totalReviews: 1 };

      ReviewsClass.getPublishedReviewsForUser.mockResolvedValue(mockReviews);
      ReviewsClass.getReviewStats.mockResolvedValue(mockStats);

      const res = await request(app).get("/api/v1/reviews/user/2");

      expect(res.status).toBe(200);
      expect(res.body.reviews).toHaveLength(1);
      expect(res.body.stats.averageRating).toBe(4.5);
    });

    it("should not require authentication", async () => {
      ReviewsClass.getPublishedReviewsForUser.mockResolvedValue([]);
      ReviewsClass.getReviewStats.mockResolvedValue({ averageRating: 0, totalReviews: 0 });

      const res = await request(app).get("/api/v1/reviews/user/2");

      expect(res.status).toBe(200);
    });
  });

  describe("GET /reviews/status/:appointmentId", () => {
    it("should return review status for an appointment", async () => {
      const token = generateToken(1);
      const mockStatus = {
        hasHomeownerReviewed: true,
        hasCleanerReviewed: false,
        userHasReviewed: true,
        bothReviewed: false,
        isPublished: false,
      };

      ReviewsClass.getReviewStatus.mockResolvedValue(mockStatus);

      const res = await request(app)
        .get("/api/v1/reviews/status/100")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.hasHomeownerReviewed).toBe(true);
      expect(res.body.bothReviewed).toBe(false);
      expect(ReviewsClass.getReviewStatus).toHaveBeenCalledWith(100, 1);
    });
  });

  describe("GET /reviews/pending", () => {
    it("should return pending reviews for client", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({ id: 1, role: "client" });
      ReviewsClass.getPendingReviewsForUser.mockResolvedValue([
        { id: 100, date: "2025-01-15", homeId: 10, employeesAssigned: ["2"] },
      ]);
      UserHomes.findByPk.mockResolvedValue({
        id: 10,
        address: "123 Main St",
        city: "Boston",
        nickName: "Main Home",
      });
      User.findAll.mockResolvedValue([
        { id: 2, username: "cleaner1", firstName: "John", lastName: "Doe" },
      ]);

      const res = await request(app)
        .get("/api/v1/reviews/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingReviews).toHaveLength(1);
      expect(res.body.pendingReviews[0].home).toBeTruthy();
      expect(res.body.pendingReviews[0].cleaners).toBeTruthy();
    });

    it("should return pending reviews for cleaner", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue({ id: 2, role: "cleaner" });
      ReviewsClass.getPendingReviewsForUser.mockResolvedValue([
        { id: 100, date: "2025-01-15", homeId: 10, employeesAssigned: ["2"] },
      ]);
      UserHomes.findByPk.mockResolvedValue({
        id: 10,
        address: "123 Main St",
        city: "Boston",
      });
      User.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/reviews/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(ReviewsClass.getPendingReviewsForUser).toHaveBeenCalledWith(2, "cleaner");
    });

    it("should handle null home gracefully", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({ id: 1, role: "client" });
      ReviewsClass.getPendingReviewsForUser.mockResolvedValue([
        { id: 100, date: "2025-01-15", homeId: 999, employeesAssigned: [] },
      ]);
      UserHomes.findByPk.mockResolvedValue(null);
      User.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/reviews/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingReviews[0].home).toBeNull();
    });
  });

  describe("GET /reviews/stats", () => {
    it("should return review statistics", async () => {
      const token = generateToken(1);
      const mockStats = {
        averageRating: 4.5,
        totalReviews: 10,
        recommendationRate: 90,
        aspectAverages: {
          cleaningQuality: 4.7,
          punctuality: 4.3,
        },
      };

      ReviewsClass.getReviewStats.mockResolvedValue(mockStats);

      const res = await request(app)
        .get("/api/v1/reviews/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.averageRating).toBe(4.5);
      expect(res.body.recommendationRate).toBe(90);
      expect(res.body.aspectAverages.cleaningQuality).toBe(4.7);
    });
  });

  describe("POST /reviews/submit", () => {
    it("should submit a new review successfully", async () => {
      const token = generateToken(1);
      const reviewData = {
        userId: 2,
        appointmentId: 100,
        reviewType: "homeowner_to_cleaner",
        review: 4.5,
        reviewComment: "Great service!",
        cleaningQuality: 5,
        punctuality: 4,
        professionalism: 5,
        communication: 4,
        wouldRecommend: true,
      };

      const mockNewReview = { id: 1, ...reviewData, reviewerId: 1 };
      const mockStatus = {
        hasHomeownerReviewed: true,
        hasCleanerReviewed: false,
        bothReviewed: false,
      };

      ReviewsClass.submitReview.mockResolvedValue(mockNewReview);
      ReviewsClass.getReviewStatus.mockResolvedValue(mockStatus);

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send(reviewData);

      expect(res.status).toBe(201);
      expect(res.body.review).toBeTruthy();
      expect(res.body.message).toContain("will be visible once the other party");
      expect(ReviewsClass.submitReview).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewerId: 1,
          userId: 2,
        })
      );
    });

    it("should return success message when both reviewed", async () => {
      const token = generateToken(1);
      const reviewData = {
        userId: 2,
        appointmentId: 100,
        reviewType: "homeowner_to_cleaner",
        review: 4.5,
      };

      ReviewsClass.submitReview.mockResolvedValue({ id: 1, ...reviewData });
      ReviewsClass.getReviewStatus.mockResolvedValue({
        bothReviewed: true,
      });

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send(reviewData);

      expect(res.status).toBe(201);
      expect(res.body.message).toContain("Both reviews submitted");
    });

    it("should return 400 for duplicate review", async () => {
      const token = generateToken(1);

      ReviewsClass.submitReview.mockRejectedValue(
        new Error("You have already reviewed this appointment")
      );

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: 2, appointmentId: 100 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("You have already reviewed this appointment");
    });

    it("should return 500 for other errors", async () => {
      const token = generateToken(1);

      ReviewsClass.submitReview.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: 2, appointmentId: 100 });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to submit review");
    });
  });

  describe("POST /reviews/submit-legacy", () => {
    it("should create legacy review", async () => {
      const legacyData = {
        userId: 2,
        reviewerId: 1,
        appointmentId: 100,
        rating: 4,
        comment: "Good job",
      };

      ReviewsClass.addReviewToDB.mockResolvedValue({ id: 1, ...legacyData });

      const res = await request(app)
        .post("/api/v1/reviews/submit-legacy")
        .send(legacyData);

      expect(res.status).toBe(200);
      expect(res.body.newReview).toBeTruthy();
    });

    it("should not require authentication", async () => {
      ReviewsClass.addReviewToDB.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .post("/api/v1/reviews/submit-legacy")
        .send({ userId: 2, reviewerId: 1, appointmentId: 100, rating: 4 });

      expect(res.status).toBe(200);
    });
  });

  describe("GET /reviews/written", () => {
    it("should return reviews written by user", async () => {
      const token = generateToken(1);
      const mockReviews = [
        { id: 1, reviewerId: 1, review: 4.5 },
        { id: 2, reviewerId: 1, review: 5.0 },
      ];

      ReviewsClass.getReviewsWrittenByUser.mockResolvedValue(mockReviews);

      const res = await request(app)
        .get("/api/v1/reviews/written")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.reviews).toHaveLength(2);
      expect(ReviewsClass.getReviewsWrittenByUser).toHaveBeenCalledWith(1);
    });
  });

  describe("DELETE /reviews/:id", () => {
    it("should delete unpublished review", async () => {
      const token = generateToken(1);

      UserReviews.findOne.mockResolvedValue({
        id: 1,
        reviewerId: 1,
        isPublished: false,
        destroy: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app)
        .delete("/api/v1/reviews/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Review deleted successfully");
    });

    it("should return 404 for non-existent review", async () => {
      const token = generateToken(1);

      UserReviews.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/v1/reviews/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Review not found");
    });

    it("should return 400 for published review", async () => {
      const token = generateToken(1);

      UserReviews.findOne.mockResolvedValue({
        id: 1,
        reviewerId: 1,
        isPublished: true,
      });

      const res = await request(app)
        .delete("/api/v1/reviews/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Cannot delete published reviews");
    });

    it("should not allow deleting other users reviews", async () => {
      const token = generateToken(1);

      // findOne with reviewerId: 1 returns null (user 1 didn't write it)
      UserReviews.findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/v1/reviews/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});

afterAll(() => {
  jest.clearAllMocks();
});
