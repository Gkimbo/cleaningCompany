const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock the icalParser module
jest.mock("../../services/icalParser", () => ({
  getCheckoutDates: jest.fn(),
  validateIcalUrl: jest.fn(),
  detectPlatform: jest.fn(),
}));

// Mock the calculatePrice module
jest.mock("../../services/CalculatePrice", () => jest.fn(() => 150));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  UserAppointments: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  UserBills: {
    findOne: jest.fn(),
  },
  CalendarSync: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

const { User, CalendarSync, UserHomes, UserAppointments, UserBills } = require("../../models");
const { getCheckoutDates, validateIcalUrl, detectPlatform } = require("../../services/icalParser");
const calendarSyncRouter = require("../../routes/api/v1/calendarSyncRouter");

// Create test app
const app = express();
app.use(express.json());
app.use("/api/v1/calendar-sync", calendarSyncRouter);

const secretKey = process.env.SESSION_SECRET || "test-secret-key";

// Helper to create JWT token
const createToken = (userId = 1) => {
  return jwt.sign({ userId }, secretKey, { expiresIn: "1h" });
};

describe("Calendar Sync Router", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/v1/calendar-sync", () => {
    it("should return all calendar syncs for authenticated user", async () => {
      const mockSyncs = [
        {
          id: 1,
          userId: 1,
          homeId: 1,
          platform: "airbnb",
          icalUrl: "https://airbnb.com/calendar/123.ics",
          isActive: true,
          home: { id: 1, nickName: "Beach House", address: "123 Ocean Dr", city: "Miami" },
        },
        {
          id: 2,
          userId: 1,
          homeId: 2,
          platform: "vrbo",
          icalUrl: "https://vrbo.com/calendar/456.ics",
          isActive: true,
          home: { id: 2, nickName: "Mountain Cabin", address: "456 Pine Rd", city: "Aspen" },
        },
      ];

      CalendarSync.findAll.mockResolvedValue(mockSyncs);

      const response = await request(app)
        .get("/api/v1/calendar-sync")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.syncs).toHaveLength(2);
      expect(CalendarSync.findAll).toHaveBeenCalled();
    });

    it("should return 401 without authorization header", async () => {
      const response = await request(app).get("/api/v1/calendar-sync");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Authorization token required");
    });

    it("should return 401 with invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/calendar-sync")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired token");
    });
  });

  describe("GET /api/v1/calendar-sync/home/:homeId", () => {
    it("should return syncs for a specific home", async () => {
      const mockHome = { id: 1, userId: 1, nickName: "Beach House" };
      const mockSyncs = [
        { id: 1, homeId: 1, platform: "airbnb", isActive: true },
      ];

      UserHomes.findOne.mockResolvedValue(mockHome);
      CalendarSync.findAll.mockResolvedValue(mockSyncs);

      const response = await request(app)
        .get("/api/v1/calendar-sync/home/1")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.syncs).toHaveLength(1);
    });

    it("should return 404 if home not found or not owned by user", async () => {
      UserHomes.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/calendar-sync/home/999")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Home not found");
    });
  });

  describe("POST /api/v1/calendar-sync", () => {
    const validPayload = {
      homeId: 1,
      icalUrl: "https://www.airbnb.com/calendar/ical/12345.ics?s=abc123",
      autoCreateAppointments: true,
      daysAfterCheckout: 0,
    };

    it("should create a new calendar sync", async () => {
      const mockHome = { id: 1, userId: 1, nickName: "Beach House" };
      const mockNewSync = {
        id: 1,
        ...validPayload,
        userId: 1,
        platform: "airbnb",
        isActive: true,
        lastSyncAt: new Date(),
        lastSyncStatus: "success",
      };

      UserHomes.findOne.mockResolvedValue(mockHome);
      CalendarSync.findOne.mockResolvedValue(null);
      validateIcalUrl.mockReturnValue(true);
      detectPlatform.mockReturnValue("airbnb");
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-02-01", uid: "uid1" },
        { checkoutDate: "2025-02-15", uid: "uid2" },
      ]);
      CalendarSync.create.mockResolvedValue(mockNewSync);

      const response = await request(app)
        .post("/api/v1/calendar-sync")
        .set("Authorization", `Bearer ${createToken()}`)
        .send(validPayload);

      expect(response.status).toBe(201);
      expect(response.body.sync).toBeDefined();
      expect(response.body.upcomingCheckouts).toBe(2);
      expect(response.body.message).toContain("connected successfully");
    });

    it("should return 400 if iCal URL is invalid", async () => {
      validateIcalUrl.mockReturnValue(false);

      const response = await request(app)
        .post("/api/v1/calendar-sync")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({ ...validPayload, icalUrl: "not-a-valid-url" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid iCal URL");
    });

    it("should return 400 if homeId is missing", async () => {
      const response = await request(app)
        .post("/api/v1/calendar-sync")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({ icalUrl: validPayload.icalUrl });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("required");
    });

    it("should return 400 if icalUrl is missing", async () => {
      const response = await request(app)
        .post("/api/v1/calendar-sync")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({ homeId: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("required");
    });

    it("should return 404 if home not found", async () => {
      validateIcalUrl.mockReturnValue(true);
      UserHomes.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/calendar-sync")
        .set("Authorization", `Bearer ${createToken()}`)
        .send(validPayload);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Home not found");
    });

    it("should return 400 if calendar already connected", async () => {
      const mockHome = { id: 1, userId: 1 };
      const existingSync = { id: 1, icalUrl: validPayload.icalUrl };

      validateIcalUrl.mockReturnValue(true);
      UserHomes.findOne.mockResolvedValue(mockHome);
      CalendarSync.findOne.mockResolvedValue(existingSync);

      const response = await request(app)
        .post("/api/v1/calendar-sync")
        .set("Authorization", `Bearer ${createToken()}`)
        .send(validPayload);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("already connected");
    });

    it("should return 400 if iCal fetch fails", async () => {
      const mockHome = { id: 1, userId: 1 };

      validateIcalUrl.mockReturnValue(true);
      UserHomes.findOne.mockResolvedValue(mockHome);
      CalendarSync.findOne.mockResolvedValue(null);
      detectPlatform.mockReturnValue("airbnb");
      getCheckoutDates.mockRejectedValue(new Error("Network timeout"));

      const response = await request(app)
        .post("/api/v1/calendar-sync")
        .set("Authorization", `Bearer ${createToken()}`)
        .send(validPayload);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Failed to fetch calendar");
    });
  });

  describe("PATCH /api/v1/calendar-sync/:id", () => {
    it("should update calendar sync settings", async () => {
      const mockSync = {
        id: 1,
        userId: 1,
        isActive: true,
        autoCreateAppointments: true,
        daysAfterCheckout: 0,
        update: jest.fn().mockResolvedValue(true),
      };

      CalendarSync.findOne.mockResolvedValue(mockSync);

      const response = await request(app)
        .patch("/api/v1/calendar-sync/1")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(mockSync.update).toHaveBeenCalledWith({ isActive: false });
    });

    it("should update autoCreateAppointments setting", async () => {
      const mockSync = {
        id: 1,
        userId: 1,
        update: jest.fn().mockResolvedValue(true),
      };

      CalendarSync.findOne.mockResolvedValue(mockSync);

      const response = await request(app)
        .patch("/api/v1/calendar-sync/1")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({ autoCreateAppointments: false });

      expect(response.status).toBe(200);
      expect(mockSync.update).toHaveBeenCalledWith({ autoCreateAppointments: false });
    });

    it("should update daysAfterCheckout setting", async () => {
      const mockSync = {
        id: 1,
        userId: 1,
        update: jest.fn().mockResolvedValue(true),
      };

      CalendarSync.findOne.mockResolvedValue(mockSync);

      const response = await request(app)
        .patch("/api/v1/calendar-sync/1")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({ daysAfterCheckout: 1 });

      expect(response.status).toBe(200);
      expect(mockSync.update).toHaveBeenCalledWith({ daysAfterCheckout: 1 });
    });

    it("should return 404 if sync not found", async () => {
      CalendarSync.findOne.mockResolvedValue(null);

      const response = await request(app)
        .patch("/api/v1/calendar-sync/999")
        .set("Authorization", `Bearer ${createToken()}`)
        .send({ isActive: false });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Calendar sync not found");
    });
  });

  describe("DELETE /api/v1/calendar-sync/:id", () => {
    it("should delete calendar sync", async () => {
      const mockSync = {
        id: 1,
        userId: 1,
        destroy: jest.fn().mockResolvedValue(true),
      };

      CalendarSync.findOne.mockResolvedValue(mockSync);

      const response = await request(app)
        .delete("/api/v1/calendar-sync/1")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Calendar sync removed");
      expect(mockSync.destroy).toHaveBeenCalled();
    });

    it("should return 404 if sync not found", async () => {
      CalendarSync.findOne.mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/v1/calendar-sync/999")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Calendar sync not found");
    });
  });

  describe("POST /api/v1/calendar-sync/:id/sync", () => {
    it("should manually trigger a sync and create appointments", async () => {
      const mockHome = {
        id: 1,
        numBeds: 3,
        numBaths: 2,
        sheetsProvided: "yes",
        towelsProvided: "no",
        timeToBeCompleted: "anytime",
        keyPadCode: "1234",
        keyLocation: null,
        cleanersNeeded: 1,
      };

      const mockSync = {
        id: 1,
        userId: 1,
        homeId: 1,
        icalUrl: "https://airbnb.com/calendar/123.ics",
        autoCreateAppointments: true,
        daysAfterCheckout: 0,
        syncedEventUids: [],
        home: mockHome,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockBill = {
        dataValues: {
          cancellationFee: 0,
          appointmentDue: 100,
        },
        update: jest.fn().mockResolvedValue(true),
      };

      CalendarSync.findOne.mockResolvedValue(mockSync);
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Reserved" },
      ]);
      UserAppointments.findOne.mockResolvedValue(null);
      UserBills.findOne.mockResolvedValue(mockBill);
      UserAppointments.create.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post("/api/v1/calendar-sync/1/sync")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Sync completed successfully");
      expect(response.body.checkoutsFound).toBe(1);
      expect(response.body.appointmentsCreated).toBe(1);
    });

    it("should skip already synced events", async () => {
      const mockSync = {
        id: 1,
        userId: 1,
        homeId: 1,
        icalUrl: "https://airbnb.com/calendar/123.ics",
        autoCreateAppointments: true,
        daysAfterCheckout: 0,
        syncedEventUids: ["uid1"],
        home: { id: 1, numBeds: 2, numBaths: 1 },
        update: jest.fn().mockResolvedValue(true),
      };

      CalendarSync.findOne.mockResolvedValue(mockSync);
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Reserved" },
      ]);
      // Mock that an appointment already exists for this date - so it will be skipped
      UserAppointments.findOne.mockResolvedValue({ id: 1, homeId: 1, date: "2025-03-01" });

      const response = await request(app)
        .post("/api/v1/calendar-sync/1/sync")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.appointmentsCreated).toBe(0);
    });

    it("should return 400 if sync fetch fails", async () => {
      const mockSync = {
        id: 1,
        userId: 1,
        icalUrl: "https://airbnb.com/calendar/123.ics",
        update: jest.fn().mockResolvedValue(true),
      };

      CalendarSync.findOne.mockResolvedValue(mockSync);
      getCheckoutDates.mockRejectedValue(new Error("Connection refused"));

      const response = await request(app)
        .post("/api/v1/calendar-sync/1/sync")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Sync failed");
    });

    it("should return 404 if sync not found", async () => {
      CalendarSync.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/calendar-sync/999/sync")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/v1/calendar-sync/:id/preview", () => {
    it("should return preview of upcoming appointments", async () => {
      const mockHome = {
        id: 1,
        numBeds: 3,
        numBaths: 2,
        sheetsProvided: "yes",
        towelsProvided: "no",
        timeToBeCompleted: "anytime",
      };

      const mockSync = {
        id: 1,
        userId: 1,
        homeId: 1,
        platform: "airbnb",
        icalUrl: "https://airbnb.com/calendar/123.ics",
        daysAfterCheckout: 0,
        syncedEventUids: [],
        home: mockHome,
      };

      CalendarSync.findOne.mockResolvedValue(mockSync);
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Guest A" },
        { checkoutDate: "2025-03-15", uid: "uid2", summary: "Guest B" },
      ]);
      UserAppointments.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/calendar-sync/1/preview")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.preview).toHaveLength(2);
      expect(response.body.totalCheckouts).toBe(2);
      expect(response.body.willCreate).toBe(2);
      expect(response.body.preview[0]).toHaveProperty("checkoutDate");
      expect(response.body.preview[0]).toHaveProperty("cleaningDate");
      expect(response.body.preview[0]).toHaveProperty("price");
      expect(response.body.preview[0]).toHaveProperty("status");
    });

    it("should mark already synced events correctly", async () => {
      const mockSync = {
        id: 1,
        userId: 1,
        homeId: 1,
        platform: "airbnb",
        icalUrl: "https://airbnb.com/calendar/123.ics",
        daysAfterCheckout: 0,
        syncedEventUids: ["uid1"],
        home: { id: 1, numBeds: 2, numBaths: 1 },
      };

      CalendarSync.findOne.mockResolvedValue(mockSync);
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Guest A" },
        { checkoutDate: "2025-03-15", uid: "uid2", summary: "Guest B" },
      ]);
      UserAppointments.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/calendar-sync/1/preview")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.preview[0].status).toBe("already_synced");
      expect(response.body.preview[1].status).toBe("will_create");
      expect(response.body.willCreate).toBe(1);
    });

    it("should mark existing appointments correctly", async () => {
      const mockSync = {
        id: 1,
        userId: 1,
        homeId: 1,
        platform: "airbnb",
        icalUrl: "https://airbnb.com/calendar/123.ics",
        daysAfterCheckout: 0,
        syncedEventUids: [],
        home: { id: 1, numBeds: 2, numBaths: 1 },
      };

      CalendarSync.findOne.mockResolvedValue(mockSync);
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Guest A" },
      ]);
      UserAppointments.findOne.mockResolvedValue({ id: 1, date: "2025-03-01" });

      const response = await request(app)
        .get("/api/v1/calendar-sync/1/preview")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.preview[0].status).toBe("appointment_exists");
      expect(response.body.willCreate).toBe(0);
    });

    it("should return 404 if sync not found", async () => {
      CalendarSync.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/calendar-sync/999/preview")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/v1/calendar-sync/disclaimer/status", () => {
    it("should return accepted: true when disclaimer has been accepted", async () => {
      const acceptedDate = new Date("2025-01-15T10:30:00Z");
      User.findByPk.mockResolvedValue({
        id: 1,
        calendarSyncDisclaimerAcceptedAt: acceptedDate,
      });

      const response = await request(app)
        .get("/api/v1/calendar-sync/disclaimer/status")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.accepted).toBe(true);
      expect(response.body.acceptedAt).toBe(acceptedDate.toISOString());
    });

    it("should return accepted: false when disclaimer has not been accepted", async () => {
      User.findByPk.mockResolvedValue({
        id: 1,
        calendarSyncDisclaimerAcceptedAt: null,
      });

      const response = await request(app)
        .get("/api/v1/calendar-sync/disclaimer/status")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.accepted).toBe(false);
      expect(response.body.acceptedAt).toBeNull();
    });

    it("should return 404 if user not found", async () => {
      User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/calendar-sync/disclaimer/status")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should return 401 without authorization", async () => {
      const response = await request(app)
        .get("/api/v1/calendar-sync/disclaimer/status");

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/v1/calendar-sync/disclaimer/accept", () => {
    it("should accept the disclaimer and return timestamp", async () => {
      const mockUser = {
        id: 1,
        calendarSyncDisclaimerAcceptedAt: null,
        update: jest.fn().mockResolvedValue(true),
      };

      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .post("/api/v1/calendar-sync/disclaimer/accept")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.acceptedAt).toBeDefined();
      expect(mockUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarSyncDisclaimerAcceptedAt: expect.any(Date),
        })
      );
    });

    it("should allow re-accepting the disclaimer", async () => {
      const mockUser = {
        id: 1,
        calendarSyncDisclaimerAcceptedAt: new Date("2024-01-01"),
        update: jest.fn().mockResolvedValue(true),
      };

      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .post("/api/v1/calendar-sync/disclaimer/accept")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return 404 if user not found", async () => {
      User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/calendar-sync/disclaimer/accept")
        .set("Authorization", `Bearer ${createToken()}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("User not found");
    });

    it("should return 401 without authorization", async () => {
      const response = await request(app)
        .post("/api/v1/calendar-sync/disclaimer/accept");

      expect(response.status).toBe(401);
    });
  });
});
