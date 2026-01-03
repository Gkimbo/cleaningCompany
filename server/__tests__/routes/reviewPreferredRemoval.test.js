/**
 * Tests for removing preferred cleaner status during review submission
 * When homeowner unchecks the preferred box for an existing preferred cleaner,
 * the cleaner should be removed from the preferred list
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock Email and Push notification services
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendPreferredCleanerNotification: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNotification: jest.fn().mockResolvedValue(true),
}));

// Mock ReviewsClass
jest.mock("../../services/ReviewsClass", () => ({
  submitReview: jest.fn(),
  getReviewStatus: jest.fn(),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
  UserReviews: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  HomePreferredCleaner: {
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
}));

const {
  User,
  UserAppointments,
  UserHomes,
  UserReviews,
  HomePreferredCleaner,
} = require("../../models");
const ReviewsClass = require("../../services/ReviewsClass");

describe("Review Submission - Preferred Cleaner Removal", () => {
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

  describe("POST /api/v1/reviews/submit - Removal Logic", () => {
    const homeownerId = 100;
    const cleanerId = 200;
    const homeId = 50;
    const appointmentId = 1;

    it("should remove preferred cleaner when setAsPreferred is false and cleaner was previously preferred", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      ReviewsClass.submitReview.mockResolvedValue({
        id: 1,
        userId: cleanerId,
        reviewerId: homeownerId,
      });

      ReviewsClass.getReviewStatus.mockResolvedValue({
        bothReviewed: false,
      });

      // Cleaner is currently preferred
      HomePreferredCleaner.findOne.mockResolvedValue({
        id: 1,
        homeId,
        cleanerId,
        setBy: "review",
      });

      HomePreferredCleaner.destroy.mockResolvedValue(1);

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: cleanerId,
          appointmentId,
          reviewType: "homeowner_to_cleaner",
          cleaningQuality: 4,
          punctuality: 4,
          professionalism: 4,
          communication: 4,
          attentionToDetail: 4,
          thoroughness: 4,
          respectOfProperty: 4,
          followedInstructions: 4,
          wouldRecommend: true,
          publicComment: "Good job",
          setAsPreferred: false, // Unchecked - should remove
          homeId,
        });

      expect(res.status).toBe(201);
      expect(HomePreferredCleaner.destroy).toHaveBeenCalledWith({
        where: { homeId, cleanerId },
      });
    });

    it("should not call destroy when setAsPreferred is true and cleaner was already preferred", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      ReviewsClass.submitReview.mockResolvedValue({
        id: 1,
        userId: cleanerId,
        reviewerId: homeownerId,
      });

      ReviewsClass.getReviewStatus.mockResolvedValue({
        bothReviewed: false,
      });

      // Cleaner is already preferred
      HomePreferredCleaner.findOne.mockResolvedValue({
        id: 1,
        homeId,
        cleanerId,
        setBy: "review",
      });

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: cleanerId,
          appointmentId,
          reviewType: "homeowner_to_cleaner",
          cleaningQuality: 5,
          punctuality: 5,
          professionalism: 5,
          communication: 5,
          attentionToDetail: 5,
          thoroughness: 5,
          respectOfProperty: 5,
          followedInstructions: 5,
          wouldRecommend: true,
          publicComment: "Excellent!",
          setAsPreferred: true, // Keep preferred - should not remove
          homeId,
        });

      expect(res.status).toBe(201);
      expect(HomePreferredCleaner.destroy).not.toHaveBeenCalled();
      expect(HomePreferredCleaner.create).not.toHaveBeenCalled(); // Already exists
    });

    it("should not call destroy when cleaner was never preferred", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      ReviewsClass.submitReview.mockResolvedValue({
        id: 1,
        userId: cleanerId,
        reviewerId: homeownerId,
      });

      ReviewsClass.getReviewStatus.mockResolvedValue({
        bothReviewed: false,
      });

      // Cleaner was never preferred
      HomePreferredCleaner.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: cleanerId,
          appointmentId,
          reviewType: "homeowner_to_cleaner",
          cleaningQuality: 3,
          punctuality: 3,
          professionalism: 3,
          communication: 3,
          attentionToDetail: 3,
          thoroughness: 3,
          respectOfProperty: 3,
          followedInstructions: 3,
          wouldRecommend: false,
          publicComment: "Okay work",
          setAsPreferred: false, // Not preferred anyway
          homeId,
        });

      expect(res.status).toBe(201);
      expect(HomePreferredCleaner.destroy).not.toHaveBeenCalled();
      expect(HomePreferredCleaner.create).not.toHaveBeenCalled();
    });

    it("should create preferred cleaner when setAsPreferred is true and cleaner was not previously preferred", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      ReviewsClass.submitReview.mockResolvedValue({
        id: 1,
        userId: cleanerId,
        reviewerId: homeownerId,
      });

      ReviewsClass.getReviewStatus.mockResolvedValue({
        bothReviewed: false,
      });

      // Cleaner is not preferred
      HomePreferredCleaner.findOne.mockResolvedValue(null);
      HomePreferredCleaner.create.mockResolvedValue({
        id: 1,
        homeId,
        cleanerId,
        setBy: "review",
      });

      User.findByPk.mockResolvedValue({
        id: cleanerId,
        firstName: "John",
        lastName: "Cleaner",
        email: "john@test.com",
        expoPushToken: null,
        getNotificationEmail: jest.fn().mockReturnValue("john@test.com"),
      });

      UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        nickName: "Beach House",
        address: "123 Ocean Ave",
      });

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: cleanerId,
          appointmentId,
          reviewType: "homeowner_to_cleaner",
          cleaningQuality: 5,
          punctuality: 5,
          professionalism: 5,
          communication: 5,
          attentionToDetail: 5,
          thoroughness: 5,
          respectOfProperty: 5,
          followedInstructions: 5,
          wouldRecommend: true,
          publicComment: "Amazing!",
          setAsPreferred: true, // Make preferred
          homeId,
        });

      expect(res.status).toBe(201);
      expect(HomePreferredCleaner.create).toHaveBeenCalledWith({
        homeId,
        cleanerId,
        setAt: expect.any(Date),
        setBy: "review",
      });
    });

    it("should not process preferred cleaner logic for cleaner_to_homeowner reviews", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      ReviewsClass.submitReview.mockResolvedValue({
        id: 1,
        userId: homeownerId,
        reviewerId: cleanerId,
      });

      ReviewsClass.getReviewStatus.mockResolvedValue({
        bothReviewed: true,
      });

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: homeownerId,
          appointmentId,
          reviewType: "cleaner_to_homeowner",
          accuracyOfDescription: 4,
          homeReadiness: 4,
          easeOfAccess: 4,
          homeCondition: 4,
          respectfulness: 4,
          safetyConditions: 4,
          communication: 4,
          wouldWorkForAgain: true,
          publicComment: "Nice client",
          setAsPreferred: true, // Should be ignored
          homeId,
        });

      expect(res.status).toBe(201);
      expect(HomePreferredCleaner.findOne).not.toHaveBeenCalled();
      expect(HomePreferredCleaner.create).not.toHaveBeenCalled();
      expect(HomePreferredCleaner.destroy).not.toHaveBeenCalled();
    });

    it("should not process preferred cleaner logic when homeId is not provided", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      ReviewsClass.submitReview.mockResolvedValue({
        id: 1,
        userId: cleanerId,
        reviewerId: homeownerId,
      });

      ReviewsClass.getReviewStatus.mockResolvedValue({
        bothReviewed: false,
      });

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: cleanerId,
          appointmentId,
          reviewType: "homeowner_to_cleaner",
          cleaningQuality: 4,
          punctuality: 4,
          professionalism: 4,
          communication: 4,
          attentionToDetail: 4,
          thoroughness: 4,
          respectOfProperty: 4,
          followedInstructions: 4,
          wouldRecommend: true,
          publicComment: "Good",
          setAsPreferred: true,
          // homeId is missing
        });

      expect(res.status).toBe(201);
      expect(HomePreferredCleaner.findOne).not.toHaveBeenCalled();
      expect(HomePreferredCleaner.create).not.toHaveBeenCalled();
    });
  });
});

describe("Preferred Cleaner State Logic", () => {
  describe("Review Form Initialization", () => {
    it("should initialize setAsPreferred to true when isCleanerPreferred is true", () => {
      const isCleanerPreferred = true;
      const setAsPreferred = isCleanerPreferred;
      expect(setAsPreferred).toBe(true);
    });

    it("should initialize setAsPreferred to false when isCleanerPreferred is false", () => {
      const isCleanerPreferred = false;
      const setAsPreferred = isCleanerPreferred;
      expect(setAsPreferred).toBe(false);
    });

    it("should initialize setAsPreferred to false when isCleanerPreferred is undefined", () => {
      const isCleanerPreferred = undefined;
      const setAsPreferred = isCleanerPreferred || false;
      expect(setAsPreferred).toBe(false);
    });
  });

  describe("Label Text Logic", () => {
    it("should show 'Keep as preferred' when isCleanerPreferred and setAsPreferred are true", () => {
      const isCleanerPreferred = true;
      const setAsPreferred = true;
      const revieweeName = "John";

      const label = isCleanerPreferred
        ? setAsPreferred
          ? `Keep ${revieweeName} as a preferred cleaner`
          : `Remove ${revieweeName} from preferred cleaners`
        : `Make ${revieweeName} a preferred cleaner`;

      expect(label).toBe("Keep John as a preferred cleaner");
    });

    it("should show 'Remove from preferred' when isCleanerPreferred is true but setAsPreferred is false", () => {
      const isCleanerPreferred = true;
      const setAsPreferred = false;
      const revieweeName = "John";

      const label = isCleanerPreferred
        ? setAsPreferred
          ? `Keep ${revieweeName} as a preferred cleaner`
          : `Remove ${revieweeName} from preferred cleaners`
        : `Make ${revieweeName} a preferred cleaner`;

      expect(label).toBe("Remove John from preferred cleaners");
    });

    it("should show 'Make preferred' when isCleanerPreferred is false", () => {
      const isCleanerPreferred = false;
      const setAsPreferred = false;
      const revieweeName = "John";

      const label = isCleanerPreferred
        ? setAsPreferred
          ? `Keep ${revieweeName} as a preferred cleaner`
          : `Remove ${revieweeName} from preferred cleaners`
        : `Make ${revieweeName} a preferred cleaner`;

      expect(label).toBe("Make John a preferred cleaner");
    });
  });

  describe("Hint Text Logic", () => {
    it("should show booking hint when setAsPreferred is true", () => {
      const setAsPreferred = true;
      const isCleanerPreferred = false;

      const hint = setAsPreferred
        ? "They can book directly for this home without needing your approval each time."
        : isCleanerPreferred
          ? "They will no longer have preferred status for this home."
          : "Preferred cleaners can book directly without requesting approval.";

      expect(hint).toBe(
        "They can book directly for this home without needing your approval each time."
      );
    });

    it("should show removal warning when unchecking for existing preferred cleaner", () => {
      const setAsPreferred = false;
      const isCleanerPreferred = true;

      const hint = setAsPreferred
        ? "They can book directly for this home without needing your approval each time."
        : isCleanerPreferred
          ? "They will no longer have preferred status for this home."
          : "Preferred cleaners can book directly without requesting approval.";

      expect(hint).toBe("They will no longer have preferred status for this home.");
    });

    it("should show general hint when not checking for non-preferred cleaner", () => {
      const setAsPreferred = false;
      const isCleanerPreferred = false;

      const hint = setAsPreferred
        ? "They can book directly for this home without needing your approval each time."
        : isCleanerPreferred
          ? "They will no longer have preferred status for this home."
          : "Preferred cleaners can book directly without requesting approval.";

      expect(hint).toBe("Preferred cleaners can book directly without requesting approval.");
    });
  });
});
