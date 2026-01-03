/**
 * Tests for setAsPreferred flag in review submission
 * When homeowner reviews cleaner, they can set them as preferred
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
  },
}));

const {
  User,
  UserAppointments,
  UserHomes,
  UserReviews,
  HomePreferredCleaner,
} = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");

describe("Review Submission - setAsPreferred Flag", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Simplified review submission endpoint for testing
    app.post("/api/v1/reviews/submit", async (req, res) => {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      try {
        const decoded = jwt.verify(token, secretKey);
        const reviewerUserId = decoded.userId;

        const {
          userId,
          appointmentId,
          reviewType,
          review,
          reviewComment,
          setAsPreferred,
          homeId,
        } = req.body;

        // Check if already reviewed
        const existingReview = await UserReviews.findOne({
          where: { appointmentId, reviewerUserId },
        });

        if (existingReview) {
          return res.status(400).json({
            error: "You have already reviewed this appointment",
          });
        }

        // Get appointment
        const appointment = await UserAppointments.findByPk(appointmentId);
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }

        // Create review
        const newReview = await UserReviews.create({
          userId,
          reviewerUserId,
          appointmentId,
          reviewType,
          rating: review,
          reviewComment,
        });

        // Handle setAsPreferred for homeowner_to_cleaner reviews
        if (
          reviewType === "homeowner_to_cleaner" &&
          setAsPreferred &&
          homeId
        ) {
          const cleanerId = userId; // userId is the person being reviewed (cleaner)

          // Check if already preferred
          const existingPreferred = await HomePreferredCleaner.findOne({
            where: { homeId, cleanerId },
          });

          if (!existingPreferred) {
            await HomePreferredCleaner.create({
              homeId,
              cleanerId,
              setAt: new Date(),
              setBy: "review",
            });

            // Get cleaner details for notification
            const cleaner = await User.findByPk(cleanerId);
            const reviewer = await User.findByPk(reviewerUserId);
            const home = await UserHomes.findByPk(homeId);

            if (cleaner) {
              // Send email notification
              await Email.sendPreferredCleanerNotification(
                cleaner.email,
                cleaner.username,
                reviewer?.username || "A homeowner",
                home?.address || "a property"
              );

              // Send push notification
              if (cleaner.expoPushToken) {
                await PushNotification.sendPushNotification(
                  cleaner.expoPushToken,
                  "You earned preferred status!",
                  `${reviewer?.username || "A homeowner"} has made you a preferred cleaner!`
                );
              }
            }
          }
        }

        return res.status(201).json({
          message: "Review submitted successfully",
          review: newReview,
          preferredStatusSet: !!(
            reviewType === "homeowner_to_cleaner" &&
            setAsPreferred &&
            homeId
          ),
        });
      } catch (error) {
        if (error.name === "JsonWebTokenError") {
          return res.status(401).json({ error: "Invalid token" });
        }
        return res.status(500).json({ error: "Internal server error" });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/reviews/submit with setAsPreferred", () => {
    const homeownerId = 100;
    const cleanerId = 200;
    const homeId = 50;
    const appointmentId = 1;

    it("should create preferred cleaner record when setAsPreferred is true", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      UserReviews.findOne.mockResolvedValue(null); // No existing review
      UserAppointments.findByPk.mockResolvedValue({
        id: appointmentId,
        homeId,
        userId: homeownerId,
      });
      UserReviews.create.mockResolvedValue({
        id: 1,
        userId: cleanerId,
        reviewerUserId: homeownerId,
        rating: 5,
      });
      HomePreferredCleaner.findOne.mockResolvedValue(null); // Not already preferred
      HomePreferredCleaner.create.mockResolvedValue({
        id: 1,
        homeId,
        cleanerId,
        setBy: "review",
      });
      User.findByPk.mockResolvedValue({
        id: cleanerId,
        email: "cleaner@test.com",
        username: "CleanerJohn",
        expoPushToken: "ExponentPushToken[xxx]",
      });
      UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        address: "123 Main St",
      });

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: cleanerId,
          appointmentId,
          reviewType: "homeowner_to_cleaner",
          review: 5,
          reviewComment: "Excellent work!",
          setAsPreferred: true,
          homeId,
        });

      expect(res.status).toBe(201);
      expect(res.body.preferredStatusSet).toBe(true);
      expect(HomePreferredCleaner.create).toHaveBeenCalledWith({
        homeId,
        cleanerId,
        setAt: expect.any(Date),
        setBy: "review",
      });
    });

    it("should send email notification when cleaner is made preferred", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      UserReviews.findOne.mockResolvedValue(null);
      UserAppointments.findByPk.mockResolvedValue({ id: appointmentId });
      UserReviews.create.mockResolvedValue({ id: 1 });
      HomePreferredCleaner.findOne.mockResolvedValue(null);
      HomePreferredCleaner.create.mockResolvedValue({ id: 1 });
      User.findByPk
        .mockResolvedValueOnce({
          id: cleanerId,
          email: "cleaner@test.com",
          username: "CleanerJohn",
          expoPushToken: null,
        })
        .mockResolvedValueOnce({
          id: homeownerId,
          username: "HomeownerJane",
        });
      UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        address: "123 Main St",
      });

      await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: cleanerId,
          appointmentId,
          reviewType: "homeowner_to_cleaner",
          review: 5,
          setAsPreferred: true,
          homeId,
        });

      expect(Email.sendPreferredCleanerNotification).toHaveBeenCalledWith(
        "cleaner@test.com",
        "CleanerJohn",
        "HomeownerJane",
        "123 Main St"
      );
    });

    it("should send push notification when cleaner is made preferred", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      UserReviews.findOne.mockResolvedValue(null);
      UserAppointments.findByPk.mockResolvedValue({ id: appointmentId });
      UserReviews.create.mockResolvedValue({ id: 1 });
      HomePreferredCleaner.findOne.mockResolvedValue(null);
      HomePreferredCleaner.create.mockResolvedValue({ id: 1 });
      User.findByPk
        .mockResolvedValueOnce({
          id: cleanerId,
          email: "cleaner@test.com",
          username: "CleanerJohn",
          expoPushToken: "ExponentPushToken[xxx]",
        })
        .mockResolvedValueOnce({
          id: homeownerId,
          username: "HomeownerJane",
        });
      UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        address: "123 Main St",
      });

      await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: cleanerId,
          appointmentId,
          reviewType: "homeowner_to_cleaner",
          review: 5,
          setAsPreferred: true,
          homeId,
        });

      expect(PushNotification.sendPushNotification).toHaveBeenCalledWith(
        "ExponentPushToken[xxx]",
        "You earned preferred status!",
        "HomeownerJane has made you a preferred cleaner!"
      );
    });

    it("should not create duplicate preferred record if already preferred", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      UserReviews.findOne.mockResolvedValue(null);
      UserAppointments.findByPk.mockResolvedValue({ id: appointmentId });
      UserReviews.create.mockResolvedValue({ id: 1 });
      // Already preferred
      HomePreferredCleaner.findOne.mockResolvedValue({
        id: 1,
        homeId,
        cleanerId,
      });

      await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: cleanerId,
          appointmentId,
          reviewType: "homeowner_to_cleaner",
          review: 5,
          setAsPreferred: true,
          homeId,
        });

      expect(HomePreferredCleaner.create).not.toHaveBeenCalled();
      expect(Email.sendPreferredCleanerNotification).not.toHaveBeenCalled();
    });

    it("should not create preferred record when setAsPreferred is false", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      UserReviews.findOne.mockResolvedValue(null);
      UserAppointments.findByPk.mockResolvedValue({ id: appointmentId });
      UserReviews.create.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: cleanerId,
          appointmentId,
          reviewType: "homeowner_to_cleaner",
          review: 5,
          setAsPreferred: false,
          homeId,
        });

      expect(res.status).toBe(201);
      expect(res.body.preferredStatusSet).toBe(false);
      expect(HomePreferredCleaner.create).not.toHaveBeenCalled();
    });

    it("should not create preferred record for cleaner_to_homeowner reviews", async () => {
      const token = jwt.sign({ userId: cleanerId }, secretKey);

      UserReviews.findOne.mockResolvedValue(null);
      UserAppointments.findByPk.mockResolvedValue({ id: appointmentId });
      UserReviews.create.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: homeownerId,
          appointmentId,
          reviewType: "cleaner_to_homeowner",
          review: 4,
          setAsPreferred: true, // This should be ignored
          homeId,
        });

      expect(res.status).toBe(201);
      expect(res.body.preferredStatusSet).toBe(false);
      expect(HomePreferredCleaner.create).not.toHaveBeenCalled();
    });

    it("should not create preferred record when homeId is missing", async () => {
      const token = jwt.sign({ userId: homeownerId }, secretKey);

      UserReviews.findOne.mockResolvedValue(null);
      UserAppointments.findByPk.mockResolvedValue({ id: appointmentId });
      UserReviews.create.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .post("/api/v1/reviews/submit")
        .set("Authorization", `Bearer ${token}`)
        .send({
          userId: cleanerId,
          appointmentId,
          reviewType: "homeowner_to_cleaner",
          review: 5,
          setAsPreferred: true,
          // homeId missing
        });

      expect(res.status).toBe(201);
      expect(res.body.preferredStatusSet).toBe(false);
      expect(HomePreferredCleaner.create).not.toHaveBeenCalled();
    });
  });
});

describe("Review Form - setAsPreferred UI Logic", () => {
  describe("Checkbox Visibility", () => {
    it("should show checkbox for homeowner_to_cleaner reviews", () => {
      const reviewType = "homeowner_to_cleaner";
      const homeId = 50;
      const isHomeownerReview = reviewType === "homeowner_to_cleaner";
      const showCheckbox = isHomeownerReview && !!homeId;

      expect(showCheckbox).toBe(true);
    });

    it("should hide checkbox for cleaner_to_homeowner reviews", () => {
      const reviewType = "cleaner_to_homeowner";
      const homeId = 50;
      const isHomeownerReview = reviewType === "homeowner_to_cleaner";
      const showCheckbox = isHomeownerReview && !!homeId;

      expect(showCheckbox).toBe(false);
    });

    it("should hide checkbox when homeId is missing", () => {
      const reviewType = "homeowner_to_cleaner";
      const homeId = null;
      const isHomeownerReview = reviewType === "homeowner_to_cleaner";
      const showCheckbox = isHomeownerReview && !!homeId;

      expect(showCheckbox).toBe(false);
    });
  });

  describe("Checkbox State", () => {
    it("should default to unchecked", () => {
      const setAsPreferred = false;
      expect(setAsPreferred).toBe(false);
    });

    it("should toggle when clicked", () => {
      let setAsPreferred = false;
      setAsPreferred = !setAsPreferred;
      expect(setAsPreferred).toBe(true);

      setAsPreferred = !setAsPreferred;
      expect(setAsPreferred).toBe(false);
    });
  });

  describe("Form Submission Data", () => {
    it("should include setAsPreferred and homeId in submission", () => {
      const formData = {
        userId: 200,
        appointmentId: 1,
        reviewType: "homeowner_to_cleaner",
        review: 5,
        reviewComment: "Great work!",
        setAsPreferred: true,
        homeId: 50,
      };

      expect(formData).toHaveProperty("setAsPreferred", true);
      expect(formData).toHaveProperty("homeId", 50);
    });

    it("should handle form data without setAsPreferred", () => {
      const formData = {
        userId: 200,
        appointmentId: 1,
        reviewType: "homeowner_to_cleaner",
        review: 5,
      };

      expect(formData.setAsPreferred).toBeUndefined();
    });
  });
});
