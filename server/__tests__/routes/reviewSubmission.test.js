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
    findByPk: jest.fn(),
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

describe("Review Submission Flow", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  beforeAll(() => {
    process.env.SESSION_SECRET = secretKey;
    app = express();
    app.use(express.json());
    const reviewsRouter = require("../../routes/api/v1/reviewsRouter");
    app.use("/api/v1/reviews", reviewsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /reviews/submit - Homeowner reviewing Cleaner", () => {
    it("should submit homeowner-to-cleaner review with all aspect ratings", async () => {
      const token = generateToken(1);
      const reviewData = {
        userId: 2, // cleaner being reviewed
        appointmentId: 100,
        reviewType: "homeowner_to_cleaner",
        review: 4.5,
        reviewComment: "Excellent cleaning service!",
        cleaningQuality: 5,
        punctuality: 4,
        professionalism: 5,
        communication: 4,
        attentionToDetail: 5,
        thoroughness: 4,
        respectOfProperty: 5,
        followedInstructions: 4,
        wouldRecommend: true,
      };

      const mockNewReview = { id: 1, ...reviewData, reviewerId: 1 };
      const mockStatus = {
        hasHomeownerReviewed: true,
        hasCleanerReviewed: false,
        bothReviewed: false,
        isPublished: false,
      };

      ReviewsClass.submitReview.mockResolvedValue(mockNewReview);
      ReviewsClass.getReviewStatus.mockResolvedValue(mockStatus);

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send(reviewData);

      expect(res.status).toBe(201);
      expect(res.body.review).toBeTruthy();
      expect(res.body.status.hasHomeownerReviewed).toBe(true);
      expect(res.body.status.bothReviewed).toBe(false);
      expect(res.body.message).toContain("will be visible once the other party");
    });

    it("should return bothReviewed message when cleaner already reviewed", async () => {
      const token = generateToken(1);
      const reviewData = {
        userId: 2,
        appointmentId: 100,
        reviewType: "homeowner_to_cleaner",
        review: 4.5,
      };

      ReviewsClass.submitReview.mockResolvedValue({ id: 1, ...reviewData });
      ReviewsClass.getReviewStatus.mockResolvedValue({
        hasHomeownerReviewed: true,
        hasCleanerReviewed: true,
        bothReviewed: true,
        isPublished: true,
      });

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send(reviewData);

      expect(res.status).toBe(201);
      expect(res.body.status.bothReviewed).toBe(true);
      expect(res.body.message).toContain("Both reviews submitted");
    });
  });

  describe("POST /reviews/submit - Cleaner reviewing Homeowner", () => {
    it("should submit cleaner-to-homeowner review with all aspect ratings", async () => {
      const token = generateToken(2); // cleaner
      const reviewData = {
        userId: 1, // homeowner being reviewed
        appointmentId: 100,
        reviewType: "cleaner_to_homeowner",
        review: 4.0,
        reviewComment: "Great home to clean!",
        accuracyOfDescription: 5,
        homeReadiness: 4,
        easeOfAccess: 5,
        homeCondition: 4,
        respectfulness: 5,
        safetyConditions: 4,
        communication: 4,
        wouldWorkForAgain: true,
      };

      const mockNewReview = { id: 2, ...reviewData, reviewerId: 2 };
      const mockStatus = {
        hasHomeownerReviewed: false,
        hasCleanerReviewed: true,
        bothReviewed: false,
        isPublished: false,
      };

      ReviewsClass.submitReview.mockResolvedValue(mockNewReview);
      ReviewsClass.getReviewStatus.mockResolvedValue(mockStatus);

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send(reviewData);

      expect(res.status).toBe(201);
      expect(res.body.review).toBeTruthy();
      expect(res.body.status.hasCleanerReviewed).toBe(true);
      expect(ReviewsClass.submitReview).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewerId: 2,
          userId: 1,
          reviewType: "cleaner_to_homeowner",
        })
      );
    });

    it("should handle wouldWorkForAgain as false", async () => {
      const token = generateToken(2);
      const reviewData = {
        userId: 1,
        appointmentId: 100,
        reviewType: "cleaner_to_homeowner",
        review: 2.0,
        wouldWorkForAgain: false,
      };

      ReviewsClass.submitReview.mockResolvedValue({ id: 2, ...reviewData });
      ReviewsClass.getReviewStatus.mockResolvedValue({ bothReviewed: false });

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send(reviewData);

      expect(res.status).toBe(201);
      expect(ReviewsClass.submitReview).toHaveBeenCalledWith(
        expect.objectContaining({
          wouldWorkForAgain: false,
        })
      );
    });
  });

  describe("Review Status Endpoint", () => {
    it("should return complete status for appointment with both reviews", async () => {
      const token = generateToken(1);
      const mockStatus = {
        hasHomeownerReviewed: true,
        hasCleanerReviewed: true,
        userHasReviewed: true,
        bothReviewed: true,
        isPublished: true,
      };

      ReviewsClass.getReviewStatus.mockResolvedValue(mockStatus);

      const res = await request(app)
        .get("/api/v1/reviews/status/100")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.bothReviewed).toBe(true);
      expect(res.body.isPublished).toBe(true);
    });

    it("should return partial status when only one party reviewed", async () => {
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
      expect(res.body.hasCleanerReviewed).toBe(false);
      expect(res.body.bothReviewed).toBe(false);
    });
  });

  describe("Pending Reviews Endpoint", () => {
    it("should return pending reviews for client with home details", async () => {
      const token = generateToken(1);

      User.findByPk.mockResolvedValue({ id: 1, type: "client" });
      ReviewsClass.getPendingReviewsForUser.mockResolvedValue([
        { id: 100, date: "2025-12-30", homeId: 10, employeesAssigned: ["2"] },
      ]);
      UserHomes.findByPk.mockResolvedValue({
        id: 10,
        address: "123 Main St",
        city: "Boston",
        nickName: "Beach House",
      });
      User.findAll.mockResolvedValue([
        { id: 2, username: "karin_cleaner", firstName: "Karin", lastName: "Smith" },
      ]);

      const res = await request(app)
        .get("/api/v1/reviews/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingReviews).toHaveLength(1);
      expect(res.body.pendingReviews[0].home.nickName).toBe("Beach House");
      expect(res.body.pendingReviews[0].cleaners).toHaveLength(1);
    });

    it("should return pending reviews for cleaner", async () => {
      const token = generateToken(2);

      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });
      ReviewsClass.getPendingReviewsForUser.mockResolvedValue([
        { id: 100, date: "2025-12-30", homeId: 10, employeesAssigned: ["2"] },
      ]);
      UserHomes.findByPk.mockResolvedValue({
        id: 10,
        address: "456 Oak Ave",
        city: "Cambridge",
      });
      User.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/reviews/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(ReviewsClass.getPendingReviewsForUser).toHaveBeenCalledWith(2, "cleaner");
    });
  });

  describe("Error Handling", () => {
    it("should return 400 for duplicate review attempt", async () => {
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

    it("should return 400 for Sequelize validation errors", async () => {
      const token = generateToken(1);
      const error = new Error("Validation error");
      error.name = "SequelizeValidationError";

      ReviewsClass.submitReview.mockRejectedValue(error);

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: 2, appointmentId: 100 });

      expect(res.status).toBe(400);
    });

    it("should return 500 for unexpected errors", async () => {
      const token = generateToken(1);

      ReviewsClass.submitReview.mockRejectedValue(new Error("Database connection failed"));

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: 2, appointmentId: 100 });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to submit review");
    });
  });
});

afterAll(() => {
  jest.clearAllMocks();
});
