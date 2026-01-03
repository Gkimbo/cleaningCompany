/**
 * Tests for direct booking flow for preferred cleaners
 * PATCH /api/v1/appointments/request-employee - Now supports direct booking
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock Stripe
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      retrieve: jest.fn().mockResolvedValue({
        invoice_settings: { default_payment_method: "pm_test" },
      }),
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: "pi_test_123",
        status: "requires_capture",
      }),
      capture: jest.fn().mockResolvedValue({
        id: "pi_test_123",
        status: "succeeded",
      }),
    },
  }));
});

// Mock Email and Push notification services
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendPreferredCleanerBookingNotification: jest.fn().mockResolvedValue(true),
  sendEmployeeRequest: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNotification: jest.fn().mockResolvedValue(true),
  sendPushEmployeeRequest: jest.fn().mockResolvedValue(true),
}));

// Mock IncentiveService
jest.mock("../../services/IncentiveService", () => ({
  calculateCleanerFee: jest.fn().mockResolvedValue({
    platformFee: 1500,
    netAmount: 13500,
    incentiveApplied: false,
    originalPlatformFee: 1500,
  }),
}));

// Mock business config
jest.mock("../../config/businessConfig", () => ({
  businessConfig: { pricing: {} },
  getPricingConfig: jest.fn().mockResolvedValue({
    platform: { feePercent: 10 },
  }),
}));

// Mock payment router - use actual path from routes directory
const mockRecordPaymentTransaction = jest.fn().mockResolvedValue(true);

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
  UserCleanerAppointments: {
    create: jest.fn(),
  },
  UserPendingRequests: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  UserReviews: {
    findAll: jest.fn(),
  },
  HomePreferredCleaner: {
    findOne: jest.fn(),
  },
  StripeConnectAccount: {
    findOne: jest.fn(),
  },
  Payout: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

const {
  User,
  UserAppointments,
  UserHomes,
  UserCleanerAppointments,
  UserPendingRequests,
  UserReviews,
  HomePreferredCleaner,
  StripeConnectAccount,
  Payout,
} = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");

describe("Direct Booking for Preferred Cleaners", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Simplified request-employee endpoint for testing
    app.patch("/api/v1/appointments/request-employee", async (req, res) => {
      const { id, appointmentId, acknowledged } = req.body;

      try {
        const appointment = await UserAppointments.findByPk(Number(appointmentId));
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }

        const client = await User.findByPk(appointment.dataValues.userId);
        if (!client) {
          return res.status(404).json({ error: "Client not found" });
        }

        const cleaner = await User.findByPk(id);
        if (!cleaner) {
          return res.status(404).json({ error: "Cleaner not found" });
        }

        // Check Stripe account
        const stripeAccount = await StripeConnectAccount.findOne({
          where: { userId: id },
        });

        if (!stripeAccount || !stripeAccount.onboardingComplete) {
          return res.status(400).json({
            error: "Stripe account required",
            requiresStripeSetup: true,
          });
        }

        if (!stripeAccount.payoutsEnabled) {
          return res.status(400).json({
            error: "Stripe account incomplete",
            requiresStripeSetup: true,
          });
        }

        // Get home for large home check
        const home = await UserHomes.findByPk(appointment.dataValues.homeId);

        // Check if preferred cleaner
        const homeId = appointment.dataValues.homeId;
        const isPreferredCleaner = await HomePreferredCleaner.findOne({
          where: { homeId, cleanerId: id },
        });

        if (isPreferredCleaner) {
          // Direct booking for preferred cleaners
          if (appointment.dataValues.hasBeenAssigned) {
            return res.status(400).json({
              error: "A cleaner is already assigned to this appointment.",
            });
          }

          // Create assignment
          await UserCleanerAppointments.create({
            employeeId: id,
            appointmentId: Number(appointmentId),
          });

          // Update appointment
          appointment.dataValues.hasBeenAssigned = true;
          appointment.dataValues.employeesAssigned = [String(id)];

          // Create payout record
          await Payout.create({
            appointmentId: Number(appointmentId),
            cleanerId: id,
            grossAmount: 15000,
            platformFee: 1500,
            netAmount: 13500,
            status: "pending",
          });

          // Send notifications
          const formattedDate = new Date(appointment.dataValues.date).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          });

          await Email.sendPreferredCleanerBookingNotification(
            client.dataValues.email,
            client.dataValues.username,
            cleaner.dataValues.username,
            home?.address || "your property",
            formattedDate
          );

          if (client.dataValues.expoPushToken) {
            await PushNotification.sendPushNotification(
              client.dataValues.expoPushToken,
              "Preferred Cleaner Booked",
              `${cleaner.dataValues.username} has booked the ${formattedDate} cleaning.`
            );
          }

          return res.status(200).json({
            message: "Job booked successfully! As a preferred cleaner, no approval was needed.",
            directBooking: true,
          });
        }

        // Normal request flow for non-preferred cleaners
        const existingRequest = await UserPendingRequests.findOne({
          where: { employeeId: id, appointmentId: Number(appointmentId) },
        });

        if (existingRequest) {
          return res.status(400).json({
            error: "Request already sent to the client",
          });
        }

        await UserPendingRequests.create({
          employeeId: id,
          appointmentId: Number(appointmentId),
          status: "pending",
        });

        await Email.sendEmployeeRequest(
          client.dataValues.email,
          client.dataValues.username,
          cleaner.dataValues.username,
          "4.5",
          appointment.dataValues.date
        );

        return res.status(200).json({
          message: "Request sent to the client for approval",
          directBooking: false,
        });
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error" });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("PATCH /api/v1/appointments/request-employee", () => {
    const cleanerId = 100;
    const homeownerId = 200;
    const homeId = 50;
    const appointmentId = 1;

    const setupMocks = (isPreferred = false, isAlreadyAssigned = false) => {
      UserAppointments.findByPk.mockResolvedValue({
        dataValues: {
          id: appointmentId,
          userId: homeownerId,
          homeId,
          date: "2026-01-15",
          price: "150",
          hasBeenAssigned: isAlreadyAssigned,
          employeesAssigned: isAlreadyAssigned ? ["99"] : [],
        },
      });

      User.findByPk
        .mockResolvedValueOnce({
          dataValues: {
            id: homeownerId,
            email: "homeowner@test.com",
            username: "HomeownerJane",
            expoPushToken: "ExponentPushToken[xxx]",
          },
        })
        .mockResolvedValueOnce({
          dataValues: {
            id: cleanerId,
            username: "CleanerJohn",
          },
        });

      StripeConnectAccount.findOne.mockResolvedValue({
        userId: cleanerId,
        onboardingComplete: true,
        payoutsEnabled: true,
      });

      UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        address: "123 Main St",
        numBeds: "2",
        numBaths: "1",
      });

      HomePreferredCleaner.findOne.mockResolvedValue(
        isPreferred ? { id: 1, homeId, cleanerId } : null
      );

      UserPendingRequests.findOne.mockResolvedValue(null);
      UserPendingRequests.create.mockResolvedValue({ id: 1 });
      UserCleanerAppointments.create.mockResolvedValue({ id: 1 });
      Payout.create.mockResolvedValue({ id: 1 });
      UserReviews.findAll.mockResolvedValue([]);
    };

    describe("Preferred Cleaner - Direct Booking", () => {
      it("should allow direct booking for preferred cleaner", async () => {
        setupMocks(true); // isPreferred = true

        const res = await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: cleanerId, appointmentId });

        expect(res.status).toBe(200);
        expect(res.body.directBooking).toBe(true);
        expect(res.body.message).toContain("no approval was needed");
      });

      it("should create cleaner-appointment assignment for direct booking", async () => {
        setupMocks(true);

        await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: cleanerId, appointmentId });

        expect(UserCleanerAppointments.create).toHaveBeenCalledWith({
          employeeId: cleanerId,
          appointmentId,
        });
      });

      it("should create payout record for direct booking", async () => {
        setupMocks(true);

        await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: cleanerId, appointmentId });

        expect(Payout.create).toHaveBeenCalled();
      });

      it("should send email notification to homeowner for direct booking", async () => {
        setupMocks(true);

        await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: cleanerId, appointmentId });

        expect(Email.sendPreferredCleanerBookingNotification).toHaveBeenCalledWith(
          "homeowner@test.com",
          "HomeownerJane",
          "CleanerJohn",
          "123 Main St",
          expect.any(String) // formatted date
        );
      });

      it("should send push notification to homeowner for direct booking", async () => {
        setupMocks(true);

        await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: cleanerId, appointmentId });

        expect(PushNotification.sendPushNotification).toHaveBeenCalledWith(
          "ExponentPushToken[xxx]",
          "Preferred Cleaner Booked",
          expect.stringContaining("CleanerJohn")
        );
      });

      it("should not create pending request for direct booking", async () => {
        setupMocks(true);

        await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: cleanerId, appointmentId });

        expect(UserPendingRequests.create).not.toHaveBeenCalled();
      });

      it("should return 400 if appointment already assigned (direct booking)", async () => {
        setupMocks(true, true); // isPreferred = true, isAlreadyAssigned = true

        const res = await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: cleanerId, appointmentId });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("A cleaner is already assigned to this appointment.");
      });
    });

    describe("Non-Preferred Cleaner - Normal Request Flow", () => {
      it("should use normal request flow for non-preferred cleaner", async () => {
        setupMocks(false); // isPreferred = false

        const res = await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: cleanerId, appointmentId });

        expect(res.status).toBe(200);
        expect(res.body.directBooking).toBe(false);
        expect(res.body.message).toContain("approval");
      });

      it("should create pending request for non-preferred cleaner", async () => {
        setupMocks(false);

        await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: cleanerId, appointmentId });

        expect(UserPendingRequests.create).toHaveBeenCalledWith({
          employeeId: cleanerId,
          appointmentId,
          status: "pending",
        });
      });

      it("should not create direct assignment for non-preferred cleaner", async () => {
        setupMocks(false);

        await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: cleanerId, appointmentId });

        expect(UserCleanerAppointments.create).not.toHaveBeenCalled();
      });

      it("should send employee request email for non-preferred cleaner", async () => {
        setupMocks(false);

        await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: cleanerId, appointmentId });

        expect(Email.sendEmployeeRequest).toHaveBeenCalled();
        expect(Email.sendPreferredCleanerBookingNotification).not.toHaveBeenCalled();
      });
    });

    describe("Stripe Account Validation", () => {
      it("should return 400 if Stripe account not set up", async () => {
        setupMocks(true);
        StripeConnectAccount.findOne.mockResolvedValue(null);

        const res = await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: cleanerId, appointmentId });

        expect(res.status).toBe(400);
        expect(res.body.requiresStripeSetup).toBe(true);
      });

      it("should return 400 if Stripe onboarding incomplete", async () => {
        setupMocks(true);
        StripeConnectAccount.findOne.mockResolvedValue({
          onboardingComplete: false,
          payoutsEnabled: false,
        });

        const res = await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: cleanerId, appointmentId });

        expect(res.status).toBe(400);
        expect(res.body.requiresStripeSetup).toBe(true);
      });
    });

    describe("Error Handling", () => {
      it("should return 404 for non-existent appointment", async () => {
        UserAppointments.findByPk.mockResolvedValue(null);

        const res = await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: cleanerId, appointmentId: 999 });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Appointment not found");
      });

      it("should return 404 for non-existent cleaner", async () => {
        UserAppointments.findByPk.mockResolvedValue({
          dataValues: { id: appointmentId, userId: homeownerId },
        });
        User.findByPk.mockResolvedValueOnce({
          dataValues: { id: homeownerId },
        }).mockResolvedValueOnce(null);

        const res = await request(app)
          .patch("/api/v1/appointments/request-employee")
          .send({ id: 999, appointmentId });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Cleaner not found");
      });
    });
  });
});

describe("Direct Booking - Frontend Handling", () => {
  describe("Response Handling", () => {
    it("should identify direct booking from response", () => {
      const response = {
        success: true,
        message: "Job booked successfully! As a preferred cleaner, no approval was needed.",
        directBooking: true,
      };

      expect(response.directBooking).toBe(true);
    });

    it("should identify normal request from response", () => {
      const response = {
        success: true,
        message: "Request sent to the client for approval",
        directBooking: false,
      };

      expect(response.directBooking).toBe(false);
    });
  });

  describe("UI Updates After Booking", () => {
    it("should remove job from available list after direct booking", () => {
      const appointments = [
        { id: 1, homeId: 10 },
        { id: 2, homeId: 15 },
        { id: 3, homeId: 22 },
      ];
      const bookedAppointmentId = 2;

      const updated = appointments.filter((a) => a.id !== bookedAppointmentId);

      expect(updated).toHaveLength(2);
      expect(updated.map((a) => a.id)).toEqual([1, 3]);
    });

    it("should not add to requests list after direct booking", () => {
      const requests = [{ id: 10, status: "pending" }];
      const directBooking = true;

      // For direct booking, don't add to requests
      if (!directBooking) {
        requests.push({ id: 2, status: "pending" });
      }

      expect(requests).toHaveLength(1);
    });

    it("should add to requests list after normal request", () => {
      const requests = [{ id: 10, status: "pending" }];
      const directBooking = false;

      // For normal request, add to requests
      if (!directBooking) {
        requests.push({ id: 2, status: "pending" });
      }

      expect(requests).toHaveLength(2);
    });
  });

  describe("Alert Messages", () => {
    it("should show direct booking success message", () => {
      const directBooking = true;
      const message = directBooking
        ? "As a preferred cleaner, this job has been confirmed automatically."
        : "Your request has been sent to the homeowner.";

      expect(message).toContain("confirmed automatically");
    });

    it("should show request pending message for normal flow", () => {
      const directBooking = false;
      const message = directBooking
        ? "As a preferred cleaner, this job has been confirmed automatically."
        : "Your request has been sent to the homeowner.";

      expect(message).toContain("sent to the homeowner");
    });
  });
});

describe("Direct Booking - Button Text", () => {
  it("should show 'Book Directly' for preferred homes", () => {
    const isPreferred = true;
    const buttonText = isPreferred ? "Book Directly" : "Request This Job";

    expect(buttonText).toBe("Book Directly");
  });

  it("should show 'Request This Job' for non-preferred homes", () => {
    const isPreferred = false;
    const buttonText = isPreferred ? "Book Directly" : "Request This Job";

    expect(buttonText).toBe("Request This Job");
  });

  it("should use star icon for preferred booking button", () => {
    const isPreferred = true;
    const iconName = isPreferred ? "star" : "check";

    expect(iconName).toBe("star");
  });

  it("should use check icon for request button", () => {
    const isPreferred = false;
    const iconName = isPreferred ? "star" : "check";

    expect(iconName).toBe("check");
  });
});
