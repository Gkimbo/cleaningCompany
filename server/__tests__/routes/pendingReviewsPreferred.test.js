/**
 * Tests for pending reviews endpoint with isCleanerPreferred field
 * The endpoint should include whether the cleaner is already preferred
 * so the review form can pre-check the preferred cleaner toggle
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock ReviewsClass
jest.mock("../../services/ReviewsClass", () => ({
  getPendingReviewsForUser: jest.fn(),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
  HomePreferredCleaner: {
    findOne: jest.fn(),
  },
  UserReviews: {},
}));

const { User, UserHomes, HomePreferredCleaner } = require("../../models");
const ReviewsClass = require("../../services/ReviewsClass");

describe("Pending Reviews with isCleanerPreferred", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const reviewsRouter = require("../../routes/api/v1/reviewsRouter");
    app.use("/api/v1/reviews", reviewsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/v1/reviews/pending", () => {
    const homeownerId = 100;
    const cleanerId = 200;
    const homeId = 50;
    const appointmentId = 1;

    it("should include isCleanerPreferred: true when cleaner is preferred", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      ReviewsClass.getPendingReviewsForUser.mockResolvedValue([
        {
          id: appointmentId,
          homeId,
          date: "2025-01-15",
          price: 150,
          employeesAssigned: [cleanerId],
          updatedAt: new Date(),
        },
      ]);

      UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        address: "123 Main St",
        city: "Test City",
        nickName: "Beach House",
      });

      User.findAll.mockResolvedValue([
        {
          id: cleanerId,
          username: "cleaner1",
          firstName: "John",
          lastName: "Cleaner",
        },
      ]);

      // Cleaner is preferred for this home
      HomePreferredCleaner.findOne.mockResolvedValue({
        id: 1,
        homeId,
        cleanerId,
      });

      const res = await request(app)
        .get("/api/v1/reviews/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingReviews).toHaveLength(1);
      expect(res.body.pendingReviews[0].isCleanerPreferred).toBe(true);
    });

    it("should include isCleanerPreferred: false when cleaner is not preferred", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      ReviewsClass.getPendingReviewsForUser.mockResolvedValue([
        {
          id: appointmentId,
          homeId,
          date: "2025-01-15",
          price: 150,
          employeesAssigned: [cleanerId],
          updatedAt: new Date(),
        },
      ]);

      UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        address: "123 Main St",
        city: "Test City",
        nickName: "Beach House",
      });

      User.findAll.mockResolvedValue([
        {
          id: cleanerId,
          username: "cleaner1",
          firstName: "John",
          lastName: "Cleaner",
        },
      ]);

      // Cleaner is NOT preferred for this home
      HomePreferredCleaner.findOne.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/reviews/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingReviews).toHaveLength(1);
      expect(res.body.pendingReviews[0].isCleanerPreferred).toBe(false);
    });

    it("should return isCleanerPreferred: false when no cleaners assigned", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      ReviewsClass.getPendingReviewsForUser.mockResolvedValue([
        {
          id: appointmentId,
          homeId,
          date: "2025-01-15",
          price: 150,
          employeesAssigned: [], // No cleaners assigned
          updatedAt: new Date(),
        },
      ]);

      UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        address: "123 Main St",
        city: "Test City",
        nickName: "Beach House",
      });

      User.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/reviews/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingReviews).toHaveLength(1);
      expect(res.body.pendingReviews[0].isCleanerPreferred).toBe(false);
      expect(HomePreferredCleaner.findOne).not.toHaveBeenCalled();
    });

    it("should not check preferred status for cleaner reviewing homeowner", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        type: "cleaner",
      });

      ReviewsClass.getPendingReviewsForUser.mockResolvedValue([
        {
          id: appointmentId,
          homeId,
          date: "2025-01-15",
          price: 150,
          employeesAssigned: [cleanerId],
          updatedAt: new Date(),
        },
      ]);

      UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        address: "123 Main St",
        city: "Test City",
        nickName: "Beach House",
      });

      User.findAll.mockResolvedValue([
        {
          id: cleanerId,
          username: "cleaner1",
          firstName: "John",
          lastName: "Cleaner",
        },
      ]);

      const res = await request(app)
        .get("/api/v1/reviews/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingReviews).toHaveLength(1);
      // isCleanerPreferred should be false for cleaner reviewing
      expect(res.body.pendingReviews[0].isCleanerPreferred).toBe(false);
      // Should not check preferred status for cleaner reviews
      expect(HomePreferredCleaner.findOne).not.toHaveBeenCalled();
    });

    it("should handle multiple pending reviews with different preferred statuses", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);
      const cleanerId2 = 201;
      const homeId2 = 51;

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      ReviewsClass.getPendingReviewsForUser.mockResolvedValue([
        {
          id: 1,
          homeId,
          date: "2025-01-15",
          price: 150,
          employeesAssigned: [cleanerId],
          updatedAt: new Date(),
        },
        {
          id: 2,
          homeId: homeId2,
          date: "2025-01-16",
          price: 175,
          employeesAssigned: [cleanerId2],
          updatedAt: new Date(),
        },
      ]);

      UserHomes.findByPk
        .mockResolvedValueOnce({
          id: homeId,
          address: "123 Main St",
          city: "Test City",
          nickName: "Beach House",
        })
        .mockResolvedValueOnce({
          id: homeId2,
          address: "456 Oak Ave",
          city: "Other City",
          nickName: "Mountain Cabin",
        });

      User.findAll
        .mockResolvedValueOnce([
          { id: cleanerId, username: "cleaner1", firstName: "John", lastName: "Cleaner" },
        ])
        .mockResolvedValueOnce([
          { id: cleanerId2, username: "cleaner2", firstName: "Jane", lastName: "Smith" },
        ]);

      // First cleaner is preferred, second is not
      HomePreferredCleaner.findOne
        .mockResolvedValueOnce({ id: 1, homeId, cleanerId })
        .mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/v1/reviews/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingReviews).toHaveLength(2);
      expect(res.body.pendingReviews[0].isCleanerPreferred).toBe(true);
      expect(res.body.pendingReviews[1].isCleanerPreferred).toBe(false);
    });

    it("should return isCleanerPreferred: false when home is not found", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      ReviewsClass.getPendingReviewsForUser.mockResolvedValue([
        {
          id: appointmentId,
          homeId,
          date: "2025-01-15",
          price: 150,
          employeesAssigned: [cleanerId],
          updatedAt: new Date(),
        },
      ]);

      // Home not found
      UserHomes.findByPk.mockResolvedValue(null);

      User.findAll.mockResolvedValue([
        { id: cleanerId, username: "cleaner1", firstName: "John", lastName: "Cleaner" },
      ]);

      const res = await request(app)
        .get("/api/v1/reviews/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingReviews).toHaveLength(1);
      expect(res.body.pendingReviews[0].isCleanerPreferred).toBe(false);
      expect(res.body.pendingReviews[0].home).toBeNull();
    });

    it("should return 401 when no token provided", async () => {
      const res = await request(app).get("/api/v1/reviews/pending");

      expect(res.status).toBe(401);
    });

    it("should return empty array when no pending reviews", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      User.findByPk.mockResolvedValue({
        id: homeownerId,
        type: "homeowner",
      });

      ReviewsClass.getPendingReviewsForUser.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/reviews/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingReviews).toHaveLength(0);
    });
  });
});
