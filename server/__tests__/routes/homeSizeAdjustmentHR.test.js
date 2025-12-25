const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock calculatePrice service FIRST before requiring models
jest.mock("../../services/CalculatePrice", () => jest.fn().mockResolvedValue(17500));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
  HomeSizeAdjustmentRequest: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
  HomeSizeAdjustmentPhoto: {
    create: jest.fn(),
  },
  Op: {
    or: Symbol("or"),
    in: Symbol("in"),
    ne: Symbol("ne"),
    gte: Symbol("gte"),
  },
}));

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendHomeSizeAdjustmentRequest: jest.fn().mockResolvedValue(true),
  sendAdjustmentApproved: jest.fn().mockResolvedValue(true),
  sendAdjustmentNeedsOwnerReview: jest.fn().mockResolvedValue(true),
  sendAdjustmentResolved: jest.fn().mockResolvedValue(true),
}));

// Mock Push notification service
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushHomeSizeAdjustment: jest.fn().mockResolvedValue(true),
  sendPushAdjustmentApproved: jest.fn().mockResolvedValue(true),
  sendPushAdjustmentNeedsReview: jest.fn().mockResolvedValue(true),
}));

const {
  User,
  UserAppointments,
  UserHomes,
  HomeSizeAdjustmentRequest,
} = require("../../models");

describe("HomeSizeAdjustment Router - HR Access", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  // Helper to create mock HR user
  const createMockHRUser = (overrides = {}) => ({
    id: 5,
    firstName: "HR",
    lastName: "Staff",
    username: "hrstaff",
    email: "hr@example.com",
    type: "humanResources",
    notifications: ["email", "phone"],
    ...overrides,
  });

  // Helper to create mock owner
  const createMockOwner = (overrides = {}) => ({
    id: 3,
    firstName: "Owner",
    lastName: "User",
    username: "owner1",
    email: "owner@example.com",
    type: "owner",
    notifications: ["email", "phone"],
    ...overrides,
  });

  // Helper to create mock dispute request
  const createMockRequest = (overrides = {}) => ({
    id: 1,
    homeId: 10,
    appointmentId: 100,
    cleanerId: 2,
    homeownerId: 1,
    status: "pending_owner",
    originalNumBeds: "3",
    originalNumBaths: "2",
    originalNumHalfBaths: "0",
    reportedNumBeds: "4",
    reportedNumBaths: "3",
    reportedNumHalfBaths: "1",
    priceDifference: 2500,
    cleanerNotes: "Home is larger",
    ownerNotes: null,
    createdAt: new Date("2025-01-15"),
    save: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  const createMockHome = (overrides = {}) => ({
    id: 10,
    address: "123 Main St",
    city: "Boston",
    state: "MA",
    zipcode: "02101",
    numBeds: "3",
    numBaths: "2",
    numHalfBaths: "0",
    notes: "",
    save: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  const createMockHomeowner = (overrides = {}) => ({
    id: 1,
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    type: "homeowner",
    falseHomeSizeCount: 0,
    ownerPrivateNotes: "",
    notifications: ["email"],
    save: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  const createMockCleaner = (overrides = {}) => ({
    id: 2,
    firstName: "Jane",
    lastName: "Cleaner",
    email: "jane@example.com",
    type: "cleaner",
    falseClaimCount: 0,
    notifications: ["email"],
    save: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  const createMockAppointment = (overrides = {}) => ({
    id: 100,
    price: "15000",
    bringSheets: false,
    bringTowels: false,
    timeToBeCompleted: "AM",
    sheetConfigurations: [],
    towelConfigurations: [],
    completed: false,
    save: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    const homeSizeAdjustmentRouter = require("../../routes/api/v1/homeSizeAdjustmentRouter");
    app.use("/api/v1/home-size-adjustment", homeSizeAdjustmentRouter);
  });

  describe("GET /pending - HR Access", () => {
    it("should allow HR user to view pending disputes", async () => {
      const token = generateToken(5);
      const mockHR = createMockHRUser();
      const mockRequests = [
        createMockRequest({ id: 1, status: "pending_owner" }),
        createMockRequest({ id: 2, status: "expired" }),
        createMockRequest({ id: 3, status: "denied" }),
      ];

      User.findByPk.mockResolvedValue(mockHR);
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue(mockRequests);

      const res = await request(app)
        .get("/api/v1/home-size-adjustment/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("adjustments");
      expect(res.body.adjustments).toHaveLength(3);
    });

    it("should include photos in response for HR user", async () => {
      const token = generateToken(5);
      const mockHR = createMockHRUser();
      const mockRequests = [
        {
          ...createMockRequest(),
          photos: [
            { id: 1, roomType: "bedroom", photoUrl: "http://example.com/photo.jpg" },
          ],
        },
      ];

      User.findByPk.mockResolvedValue(mockHR);
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue(mockRequests);

      const res = await request(app)
        .get("/api/v1/home-size-adjustment/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(HomeSizeAdjustmentRequest.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({
              as: "photos",
            }),
          ]),
        })
      );
    });

    it("should include falseClaimCount for cleaners (HR view)", async () => {
      const token = generateToken(5);
      const mockHR = createMockHRUser();

      User.findByPk.mockResolvedValue(mockHR);
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue([]);

      await request(app)
        .get("/api/v1/home-size-adjustment/pending")
        .set("Authorization", `Bearer ${token}`);

      // Verify that the query includes falseClaimCount attribute
      expect(HomeSizeAdjustmentRequest.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({
              as: "cleaner",
              attributes: expect.arrayContaining(["falseClaimCount"]),
            }),
          ]),
        })
      );
    });

    it("should include falseHomeSizeCount for homeowners (HR view)", async () => {
      const token = generateToken(5);
      const mockHR = createMockHRUser();

      User.findByPk.mockResolvedValue(mockHR);
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue([]);

      await request(app)
        .get("/api/v1/home-size-adjustment/pending")
        .set("Authorization", `Bearer ${token}`);

      // Verify that the query includes falseHomeSizeCount attribute
      expect(HomeSizeAdjustmentRequest.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({
              as: "homeowner",
              attributes: expect.arrayContaining(["falseHomeSizeCount"]),
            }),
          ]),
        })
      );
    });
  });

  describe("GET /:id - HR Access", () => {
    it("should allow HR user to view dispute details", async () => {
      const token = generateToken(5);
      const mockHR = createMockHRUser();
      const mockRequest = createMockRequest();

      User.findByPk.mockResolvedValue(mockHR);
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);

      const res = await request(app)
        .get("/api/v1/home-size-adjustment/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it("should include photos for HR user viewing dispute", async () => {
      const token = generateToken(5);
      const mockHR = createMockHRUser();

      User.findByPk.mockResolvedValue(mockHR);
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(createMockRequest());

      await request(app)
        .get("/api/v1/home-size-adjustment/1")
        .set("Authorization", `Bearer ${token}`);

      expect(HomeSizeAdjustmentRequest.findByPk).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({
              as: "photos",
            }),
          ]),
        })
      );
    });
  });

  describe("POST /:id/owner-resolve - HR Access", () => {
    // Note: API uses `approve` (boolean) not `decision`
    const resolveApproveData = {
      approve: true,
      finalBeds: "4",
      finalBaths: "3",
      ownerNote: "Verified home is larger",
    };

    const resolveDenyData = {
      approve: false,
      ownerNote: "Cleaner's report was inaccurate",
    };

    const setupResolveMocks = (resolver, requestOverrides = {}) => {
      const mockRequest = createMockRequest(requestOverrides);
      const mockHomeowner = createMockHomeowner();
      const mockCleaner = createMockCleaner();
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment();

      User.findByPk
        .mockResolvedValueOnce(resolver) // First call: get resolver
        .mockResolvedValueOnce(mockHomeowner) // Second: get homeowner
        .mockResolvedValueOnce(mockCleaner); // Third: get cleaner
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserAppointments.findAll.mockResolvedValue([]);

      return { mockRequest, mockHomeowner, mockCleaner, mockHome, mockAppointment };
    };

    it("should allow HR user to approve dispute", async () => {
      const token = generateToken(5);
      const mockHR = createMockHRUser();
      setupResolveMocks(mockHR, { status: "pending_owner" });

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send(resolveApproveData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should allow HR user to deny dispute", async () => {
      const token = generateToken(5);
      const mockHR = createMockHRUser();
      const { mockRequest } = setupResolveMocks(mockHR, { status: "pending_owner" });

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send(resolveDenyData);

      expect(res.status).toBe(200);
      expect(mockRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "owner_denied",
        })
      );
    });

    it("should allow HR to resolve expired disputes", async () => {
      const token = generateToken(5);
      const mockHR = createMockHRUser();
      setupResolveMocks(mockHR, { status: "expired" });

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send(resolveApproveData);

      expect(res.status).toBe(200);
    });

    it("should reject disputes with invalid status for resolution", async () => {
      const token = generateToken(5);
      const mockHR = createMockHRUser();
      // Status "denied" is not allowed for resolution
      setupResolveMocks(mockHR, { status: "owner_denied" });

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send(resolveApproveData);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("This request is not awaiting owner review");
    });

    it("should deny non-owner and non-HR users from resolving", async () => {
      const token = generateToken(1);

      // Mock a regular user (not owner or HR)
      User.findByPk.mockReset();
      User.findByPk.mockResolvedValue({
        id: 1,
        type: null,
        firstName: "Regular",
        lastName: "User",
      });

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send(resolveApproveData);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Owner or HR access required");
    });
  });

  describe("HR vs Owner - Same Permissions", () => {
    it("should give HR same dispute viewing permissions as owner", async () => {
      const hrToken = generateToken(5);
      const ownerToken = generateToken(3);
      const mockHR = createMockHRUser();
      const mockOwner = createMockOwner();
      const mockRequests = [createMockRequest()];

      // HR request
      User.findByPk.mockResolvedValue(mockHR);
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue(mockRequests);

      const hrRes = await request(app)
        .get("/api/v1/home-size-adjustment/pending")
        .set("Authorization", `Bearer ${hrToken}`);

      jest.clearAllMocks();

      // Owner request
      User.findByPk.mockResolvedValue(mockOwner);
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue(mockRequests);

      const ownerRes = await request(app)
        .get("/api/v1/home-size-adjustment/pending")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(hrRes.status).toBe(200);
      expect(ownerRes.status).toBe(200);
    });

    it("should give HR same dispute resolution permissions as owner", async () => {
      const resolveData = {
        approve: true,
        finalBeds: "4",
        finalBaths: "3",
        ownerNote: "Test",
      };

      const setupMocks = (resolver) => {
        const mockRequest = createMockRequest({ status: "pending_owner" });
        const mockHomeowner = {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          falseHomeSizeCount: 0,
          ownerPrivateNotes: "",
          notifications: ["email"],
          update: jest.fn().mockResolvedValue(true),
        };
        const mockCleaner = {
          id: 2,
          firstName: "Jane",
          lastName: "Cleaner",
          email: "jane@example.com",
          falseClaimCount: 0,
          notifications: ["email"],
          update: jest.fn().mockResolvedValue(true),
        };
        const mockHome = {
          id: 10,
          numBeds: "3",
          numBaths: "2",
          update: jest.fn().mockResolvedValue(true),
        };
        const mockAppointment = {
          id: 100,
          price: "15000",
          bringSheets: false,
          bringTowels: false,
          timeToBeCompleted: "AM",
          sheetConfigurations: [],
          towelConfigurations: [],
          update: jest.fn().mockResolvedValue(true),
        };

        User.findByPk
          .mockResolvedValueOnce(resolver)
          .mockResolvedValueOnce(mockHomeowner)
          .mockResolvedValueOnce(mockCleaner);
        HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
        UserHomes.findByPk.mockResolvedValue(mockHome);
        UserAppointments.findByPk.mockResolvedValue(mockAppointment);
        UserAppointments.findAll.mockResolvedValue([]);
      };

      // HR resolution
      setupMocks(createMockHRUser());
      const hrRes = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${generateToken(5)}`)
        .send(resolveData);

      jest.clearAllMocks();

      // Owner resolution
      setupMocks(createMockOwner());
      const ownerRes = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${generateToken(3)}`)
        .send(resolveData);

      expect(hrRes.status).toBe(200);
      expect(ownerRes.status).toBe(200);
    });
  });
});
