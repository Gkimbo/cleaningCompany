const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
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
}));

// Mock calculatePrice service
jest.mock("../../services/CalculatePrice", () => jest.fn());

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendHomeSizeAdjustmentRequest: jest.fn().mockResolvedValue(true),
  sendAdjustmentApproved: jest.fn().mockResolvedValue(true),
  sendAdjustmentNeedsOwnerReview: jest.fn().mockResolvedValue(true),
  sendAdjustmentResolved: jest.fn().mockResolvedValue(true),
  sendAdjustmentDisputedEmail: jest.fn().mockResolvedValue(true),
}));

// Mock NotificationService
jest.mock("../../services/NotificationService", () => ({
  notifyUser: jest.fn().mockResolvedValue({ id: 1 }),
}));

// Mock Stripe
const mockStripe = {
  customers: {
    retrieve: jest.fn(),
  },
  paymentIntents: {
    create: jest.fn(),
  },
};
jest.mock("stripe", () => {
  return jest.fn(() => mockStripe);
});

// Mock recordPaymentTransaction
jest.mock("../../routes/api/v1/paymentRouter", () => ({
  recordPaymentTransaction: jest.fn().mockResolvedValue({ id: 1 }),
}));

const NotificationService = require("../../services/NotificationService");
const { recordPaymentTransaction } = require("../../routes/api/v1/paymentRouter");

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
  HomeSizeAdjustmentPhoto,
} = require("../../models");
const calculatePrice = require("../../services/CalculatePrice");
const Email = require("../../services/sendNotifications/EmailClass");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");

describe("HomeSizeAdjustment Router", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  // Helper to create mock user
  const createMockUser = (overrides = {}) => {
    const user = {
      id: 1,
      firstName: "John",
      lastName: "Doe",
      username: "johndoe",
      email: "john@example.com",
      notificationEmail: null,
      type: "homeowner",
      notifications: ["email", "phone"],
      expoPushToken: "ExponentPushToken[xxx]",
      ownerPrivateNotes: null,
      falseHomeSizeCount: 0,
      falseClaimCount: 0,
      update: jest.fn().mockImplementation(function (data) {
        Object.assign(this, data);
        return Promise.resolve(this);
      }),
      ...overrides,
    };
    // Add the getNotificationEmail method
    user.getNotificationEmail = function () {
      return this.notificationEmail || this.email;
    };
    return user;
  };

  // Helper to create mock appointment
  const createMockAppointment = (overrides = {}) => ({
    id: 1,
    userId: 1,
    homeId: 1,
    date: "2025-01-15",
    price: "150.00",
    completed: false,
    employeesAssigned: ["2"],
    bringSheets: false,
    bringTowels: false,
    timeToBeCompleted: "AM",
    sheetConfigurations: [],
    towelConfigurations: [],
    update: jest.fn().mockImplementation(function (data) {
      Object.assign(this, data);
      return Promise.resolve(this);
    }),
    ...overrides,
  });

  // Helper to create mock home
  const createMockHome = (overrides = {}) => ({
    id: 1,
    userId: 1,
    address: "123 Main St",
    city: "Boston",
    state: "MA",
    zipcode: "02101",
    numBeds: "3",
    numBaths: "2",
    update: jest.fn().mockImplementation(function (data) {
      Object.assign(this, data);
      return Promise.resolve(this);
    }),
    ...overrides,
  });

  // Helper to create mock adjustment request
  const createMockRequest = (overrides = {}) => ({
    id: 1,
    appointmentId: 1,
    homeId: 1,
    cleanerId: 2,
    homeownerId: 1,
    originalNumBeds: "3",
    originalNumBaths: "2",
    originalPrice: 150.0,
    reportedNumBeds: "4",
    reportedNumBaths: "3",
    calculatedNewPrice: 200.0,
    priceDifference: 50.0,
    status: "pending_homeowner",
    cleanerNote: "Home is larger than listed",
    homeownerResponse: null,
    ownerNote: null,
    ownerId: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    update: jest.fn().mockImplementation(function (data) {
      Object.assign(this, data);
      return Promise.resolve(this);
    }),
    ...overrides,
  });

  beforeAll(() => {
    process.env.SESSION_SECRET = secretKey;

    app = express();
    app.use(express.json());

    const homeSizeAdjustmentRouter = require("../../routes/api/v1/homeSizeAdjustmentRouter");
    app.use("/api/v1/home-size-adjustment", homeSizeAdjustmentRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    calculatePrice.mockResolvedValue(200);
  });

  describe("Authentication Middleware", () => {
    it("should return 401 without authorization header", async () => {
      const res = await request(app).post("/api/v1/home-size-adjustment");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Authorization token required");
    });

    it("should return 403 with invalid token", async () => {
      const res = await request(app)
        .post("/api/v1/home-size-adjustment")
        .set("Authorization", "Bearer invalid_token");

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Invalid token");
    });
  });

  describe("POST / - Create Adjustment Request", () => {
    describe("Photo Validation", () => {
      it("should require photos to be provided", async () => {
        const token = generateToken(2); // cleaner

        const res = await request(app)
          .post("/api/v1/home-size-adjustment")
          .set("Authorization", `Bearer ${token}`)
          .send({
            appointmentId: 1,
            reportedNumBeds: "4",
            reportedNumBaths: "3",
            cleanerNote: "Home is larger",
            // No photos provided
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("Photos are required");
      });

      it("should require correct number of bedroom photos", async () => {
        const token = generateToken(2);

        UserAppointments.findByPk.mockResolvedValue(createMockAppointment());

        const res = await request(app)
          .post("/api/v1/home-size-adjustment")
          .set("Authorization", `Bearer ${token}`)
          .send({
            appointmentId: 1,
            reportedNumBeds: "4",
            reportedNumBaths: "2",
            cleanerNote: "Home is larger",
            photos: [
              { roomType: "bedroom", roomNumber: 1, photoData: "base64data1" },
              { roomType: "bedroom", roomNumber: 2, photoData: "base64data2" },
              // Missing bedroom 3 and 4
              { roomType: "bathroom", roomNumber: 1, photoData: "base64data3" },
              { roomType: "bathroom", roomNumber: 2, photoData: "base64data4" },
            ],
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("bedroom");
        expect(res.body.missingType).toBe("bedroom");
      });

      it("should require correct number of bathroom photos", async () => {
        const token = generateToken(2);

        UserAppointments.findByPk.mockResolvedValue(createMockAppointment());

        const res = await request(app)
          .post("/api/v1/home-size-adjustment")
          .set("Authorization", `Bearer ${token}`)
          .send({
            appointmentId: 1,
            reportedNumBeds: "2",
            reportedNumBaths: "3",
            cleanerNote: "Home is larger",
            photos: [
              { roomType: "bedroom", roomNumber: 1, photoData: "base64data1" },
              { roomType: "bedroom", roomNumber: 2, photoData: "base64data2" },
              { roomType: "bathroom", roomNumber: 1, photoData: "base64data3" },
              // Missing bathroom 2 and 3
            ],
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("bathroom");
        expect(res.body.missingType).toBe("bathroom");
      });

      it("should require photoData, roomType, and roomNumber for each photo", async () => {
        const token = generateToken(2);

        UserAppointments.findByPk.mockResolvedValue(createMockAppointment());

        const res = await request(app)
          .post("/api/v1/home-size-adjustment")
          .set("Authorization", `Bearer ${token}`)
          .send({
            appointmentId: 1,
            reportedNumBeds: "1",
            reportedNumBaths: "1",
            photos: [
              { roomType: "bedroom", roomNumber: 1 }, // Missing photoData
              { roomType: "bathroom", roomNumber: 1, photoData: "base64data" },
            ],
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("photoData, roomType, and roomNumber");
      });

      it("should save photos when valid", async () => {
        const token = generateToken(2);

        UserAppointments.findByPk.mockResolvedValue(createMockAppointment());
        HomeSizeAdjustmentRequest.findOne.mockResolvedValue(null);
        UserHomes.findByPk.mockResolvedValue(createMockHome());
        HomeSizeAdjustmentRequest.create.mockResolvedValue(createMockRequest());
        HomeSizeAdjustmentPhoto.create.mockResolvedValue({});
        User.findByPk.mockImplementation((id) => {
          if (id === 1) return Promise.resolve(createMockUser());
          if (id === 2) return Promise.resolve(createMockUser({ id: 2, type: "cleaner" }));
        });

        const res = await request(app)
          .post("/api/v1/home-size-adjustment")
          .set("Authorization", `Bearer ${token}`)
          .send({
            appointmentId: 1,
            reportedNumBeds: "2",
            reportedNumBaths: "1",
            cleanerNote: "Home is larger",
            photos: [
              { roomType: "bedroom", roomNumber: 1, photoData: "base64data1" },
              { roomType: "bedroom", roomNumber: 2, photoData: "base64data2" },
              { roomType: "bathroom", roomNumber: 1, photoData: "base64data3" },
            ],
          });

        expect(res.status).toBe(201);
        expect(HomeSizeAdjustmentPhoto.create).toHaveBeenCalledTimes(3);
      });
    });

    describe("Authorization", () => {
      it("should require cleaner to be assigned to appointment", async () => {
        const token = generateToken(99); // Not assigned

        UserAppointments.findByPk.mockResolvedValue(
          createMockAppointment({ employeesAssigned: ["2"] })
        );

        const res = await request(app)
          .post("/api/v1/home-size-adjustment")
          .set("Authorization", `Bearer ${token}`)
          .send({
            appointmentId: 1,
            reportedNumBeds: "4",
            reportedNumBaths: "3",
            photos: [
              { roomType: "bedroom", roomNumber: 1, photoData: "data" },
              { roomType: "bedroom", roomNumber: 2, photoData: "data" },
              { roomType: "bedroom", roomNumber: 3, photoData: "data" },
              { roomType: "bedroom", roomNumber: 4, photoData: "data" },
              { roomType: "bathroom", roomNumber: 1, photoData: "data" },
              { roomType: "bathroom", roomNumber: 2, photoData: "data" },
              { roomType: "bathroom", roomNumber: 3, photoData: "data" },
            ],
          });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("You are not assigned to this appointment");
      });
    });

    describe("Duplicate Prevention", () => {
      it("should prevent duplicate pending requests", async () => {
        const token = generateToken(2);

        UserAppointments.findByPk.mockResolvedValue(createMockAppointment());
        HomeSizeAdjustmentRequest.findOne.mockResolvedValue(createMockRequest());

        const res = await request(app)
          .post("/api/v1/home-size-adjustment")
          .set("Authorization", `Bearer ${token}`)
          .send({
            appointmentId: 1,
            reportedNumBeds: "4",
            reportedNumBaths: "3",
            photos: [
              { roomType: "bedroom", roomNumber: 1, photoData: "data" },
              { roomType: "bedroom", roomNumber: 2, photoData: "data" },
              { roomType: "bedroom", roomNumber: 3, photoData: "data" },
              { roomType: "bedroom", roomNumber: 4, photoData: "data" },
              { roomType: "bathroom", roomNumber: 1, photoData: "data" },
              { roomType: "bathroom", roomNumber: 2, photoData: "data" },
              { roomType: "bathroom", roomNumber: 3, photoData: "data" },
            ],
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("already exists");
      });
    });
  });

  describe("GET /pending - Owner Only Fields", () => {
    it("should include tracking fields for owners", async () => {
      const token = generateToken(3);

      const mockOwner = createMockUser({ id: 3, type: "owner" });
      const mockHomeowner = createMockUser({
        id: 1,
        falseHomeSizeCount: 2,
        ownerPrivateNotes: "Previous incident noted",
      });
      const mockCleaner = createMockUser({
        id: 2,
        type: "cleaner",
        falseClaimCount: 1,
        ownerPrivateNotes: "Made false claim before",
      });

      User.findByPk.mockResolvedValue(mockOwner);
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue([
        {
          ...createMockRequest({ status: "pending_owner" }),
          home: createMockHome(),
          appointment: createMockAppointment(),
          cleaner: mockCleaner,
          homeowner: mockHomeowner,
          photos: [],
        },
      ]);

      const res = await request(app)
        .get("/api/v1/home-size-adjustment/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      // Owners should see tracking fields
      expect(HomeSizeAdjustmentRequest.findAll).toHaveBeenCalled();
    });

    it("should include photos for owners", async () => {
      const token = generateToken(3);

      const mockOwner = createMockUser({ id: 3, type: "owner" });

      User.findByPk.mockResolvedValue(mockOwner);
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue([
        {
          ...createMockRequest({ status: "pending_owner" }),
          home: createMockHome(),
          appointment: createMockAppointment(),
          cleaner: createMockUser({ id: 2, type: "cleaner" }),
          homeowner: createMockUser({ id: 1 }),
          photos: [
            { id: 1, roomType: "bedroom", roomNumber: 1, photoUrl: "data:image..." },
          ],
        },
      ]);

      const res = await request(app)
        .get("/api/v1/home-size-adjustment/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it("should NOT include photos for homeowners", async () => {
      const token = generateToken(1);

      const mockHomeowner = createMockUser({ id: 1, type: "homeowner" });

      User.findByPk.mockResolvedValue(mockHomeowner);
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue([
        {
          ...createMockRequest(),
          home: createMockHome(),
          appointment: createMockAppointment(),
          cleaner: createMockUser({ id: 2, type: "cleaner" }),
          homeowner: mockHomeowner,
          // Photos should not be included in query for non-owners
        },
      ]);

      const res = await request(app)
        .get("/api/v1/home-size-adjustment/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("POST /:id/homeowner-response - Bulk Updates", () => {
    it("should update all future appointments when homeowner approves", async () => {
      const token = generateToken(1);

      const mockRequest = createMockRequest();
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment();
      const mockFutureAppointments = [
        createMockAppointment({ id: 2, date: "2025-02-01" }),
        createMockAppointment({ id: 3, date: "2025-03-01" }),
      ];

      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserAppointments.findAll.mockResolvedValue(mockFutureAppointments);
      User.findByPk.mockImplementation((id) => {
        if (id === 1) return Promise.resolve(createMockUser({ id: 1 }));
        if (id === 2) return Promise.resolve(createMockUser({ id: 2, type: "cleaner" }));
      });

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/homeowner-response")
        .set("Authorization", `Bearer ${token}`)
        .send({ approve: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Verify home was updated
      expect(mockHome.update).toHaveBeenCalledWith({
        numBeds: "4",
        numBaths: "3",
      });
      // Verify future appointments were queried
      expect(UserAppointments.findAll).toHaveBeenCalled();
      // Verify each future appointment was updated
      expect(mockFutureAppointments[0].update).toHaveBeenCalled();
      expect(mockFutureAppointments[1].update).toHaveBeenCalled();
    });

    it("should escalate to owner when homeowner denies", async () => {
      const token = generateToken(1);

      const mockRequest = createMockRequest();
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment();
      const mockOwners = [createMockUser({ id: 3, type: "owner" })];

      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      User.findByPk.mockImplementation((id) => {
        if (id === 1) return Promise.resolve(createMockUser({ id: 1 }));
        if (id === 2) return Promise.resolve(createMockUser({ id: 2, type: "cleaner" }));
      });
      User.findAll.mockResolvedValue(mockOwners);

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/homeowner-response")
        .set("Authorization", `Bearer ${token}`)
        .send({
          approve: false,
          reason: "The home size is correct as listed",
        });

      expect(res.status).toBe(200);
      expect(mockRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending_owner",
          homeownerResponse: "The home size is correct as listed",
        })
      );
      expect(Email.sendAdjustmentNeedsOwnerReview).toHaveBeenCalled();
    });
  });

  describe("POST /:id/owner-resolve - False Claim Tracking", () => {
    it("should add note and increment count on homeowner when owner approves", async () => {
      const token = generateToken(3);

      const mockOwner = createMockUser({ id: 3, type: "owner" });
      const mockHomeowner = createMockUser({
        id: 1,
        type: "homeowner",
        falseHomeSizeCount: 1,
        ownerPrivateNotes: "Previous note",
      });
      const mockCleaner = createMockUser({ id: 2, type: "cleaner" });
      const mockRequest = createMockRequest({ status: "pending_owner" });
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment();

      User.findByPk.mockImplementation((id) => {
        if (id === 3) return Promise.resolve(mockOwner);
        if (id === 1) return Promise.resolve(mockHomeowner);
        if (id === 2) return Promise.resolve(mockCleaner);
      });
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserAppointments.findAll.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send({
          approve: true,
          ownerNote: "Verified home is larger than listed",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Homeowner should have note added and count incremented
      expect(mockHomeowner.update).toHaveBeenCalledWith(
        expect.objectContaining({
          falseHomeSizeCount: 2, // Was 1, now 2
        })
      );
      // Check that ownerPrivateNotes was updated
      const updateCall = mockHomeowner.update.mock.calls[0][0];
      expect(updateCall.ownerPrivateNotes).toContain("HOME SIZE DISCREPANCY");
      expect(updateCall.ownerPrivateNotes).toContain("Previous note");
    });

    it("should add note and increment count on cleaner when owner denies", async () => {
      const token = generateToken(3);

      const mockOwner = createMockUser({ id: 3, type: "owner" });
      const mockHomeowner = createMockUser({ id: 1, type: "homeowner" });
      const mockCleaner = createMockUser({
        id: 2,
        type: "cleaner",
        falseClaimCount: 0,
        ownerPrivateNotes: null,
      });
      const mockRequest = createMockRequest({ status: "pending_owner" });
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment();

      User.findByPk.mockImplementation((id) => {
        if (id === 3) return Promise.resolve(mockOwner);
        if (id === 1) return Promise.resolve(mockHomeowner);
        if (id === 2) return Promise.resolve(mockCleaner);
      });
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send({
          approve: false,
          ownerNote: "Home size is correctly listed",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Cleaner should have note added and count incremented
      expect(mockCleaner.update).toHaveBeenCalledWith(
        expect.objectContaining({
          falseClaimCount: 1, // Was 0, now 1
        })
      );
      // Check that ownerPrivateNotes was added
      const updateCall = mockCleaner.update.mock.calls[0][0];
      expect(updateCall.ownerPrivateNotes).toContain("FALSE CLAIM");
    });

    it("should update all future appointments when owner approves", async () => {
      const token = generateToken(3);

      const mockOwner = createMockUser({ id: 3, type: "owner" });
      const mockHomeowner = createMockUser({ id: 1 });
      const mockCleaner = createMockUser({ id: 2, type: "cleaner" });
      const mockRequest = createMockRequest({ status: "pending_owner" });
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment();
      const mockFutureAppointments = [
        createMockAppointment({ id: 2, date: "2025-02-01" }),
        createMockAppointment({ id: 3, date: "2025-03-01" }),
        createMockAppointment({ id: 4, date: "2025-04-01" }),
      ];

      User.findByPk.mockImplementation((id) => {
        if (id === 3) return Promise.resolve(mockOwner);
        if (id === 1) return Promise.resolve(mockHomeowner);
        if (id === 2) return Promise.resolve(mockCleaner);
      });
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserAppointments.findAll.mockResolvedValue(mockFutureAppointments);

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send({
          approve: true,
          ownerNote: "Verified - home is larger",
          finalBeds: "5",
          finalBaths: "3",
        });

      expect(res.status).toBe(200);
      // Verify all future appointments were updated
      expect(mockFutureAppointments[0].update).toHaveBeenCalled();
      expect(mockFutureAppointments[1].update).toHaveBeenCalled();
      expect(mockFutureAppointments[2].update).toHaveBeenCalled();
    });

    it("should NOT update appointments when owner denies", async () => {
      const token = generateToken(3);

      const mockOwner = createMockUser({ id: 3, type: "owner" });
      const mockHomeowner = createMockUser({ id: 1 });
      const mockCleaner = createMockUser({ id: 2, type: "cleaner" });
      const mockRequest = createMockRequest({ status: "pending_owner" });
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment();

      User.findByPk.mockImplementation((id) => {
        if (id === 3) return Promise.resolve(mockOwner);
        if (id === 1) return Promise.resolve(mockHomeowner);
        if (id === 2) return Promise.resolve(mockCleaner);
      });
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send({
          approve: false,
          ownerNote: "Home is correctly sized",
        });

      expect(res.status).toBe(200);
      // Home should NOT be updated
      expect(mockHome.update).not.toHaveBeenCalled();
      // Triggering appointment should NOT be updated
      expect(mockAppointment.update).not.toHaveBeenCalled();
    });

    it("should require owner role", async () => {
      const token = generateToken(1); // Not a owner

      User.findByPk.mockResolvedValue(createMockUser({ id: 1, type: "homeowner" }));

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send({ approve: true, ownerNote: "Test" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Owner or HR access required");
    });

    it("should allow owner to override with custom bed/bath values", async () => {
      const token = generateToken(3);

      const mockOwner = createMockUser({ id: 3, type: "owner" });
      const mockHomeowner = createMockUser({ id: 1 });
      const mockCleaner = createMockUser({ id: 2, type: "cleaner" });
      const mockRequest = createMockRequest({
        status: "pending_owner",
        reportedNumBeds: "4",
        reportedNumBaths: "3",
      });
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment();

      User.findByPk.mockImplementation((id) => {
        if (id === 3) return Promise.resolve(mockOwner);
        if (id === 1) return Promise.resolve(mockHomeowner);
        if (id === 2) return Promise.resolve(mockCleaner);
      });
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserAppointments.findAll.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send({
          approve: true,
          ownerNote: "Split the difference",
          finalBeds: "3.5", // Custom value
          finalBaths: "2.5", // Custom value
        });

      expect(res.status).toBe(200);
      expect(res.body.finalBeds).toBe("3.5");
      expect(res.body.finalBaths).toBe("2.5");
      // Home should be updated with owner's custom values
      expect(mockHome.update).toHaveBeenCalledWith({
        numBeds: "3.5",
        numBaths: "2.5",
      });
    });
  });

  describe("GET /:id - Single Request with Owner Fields", () => {
    it("should include tracking fields and photos for owners", async () => {
      const token = generateToken(3);

      const mockOwner = createMockUser({ id: 3, type: "owner" });

      User.findByPk.mockResolvedValue(mockOwner);
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue({
        ...createMockRequest(),
        home: createMockHome(),
        appointment: createMockAppointment(),
        cleaner: createMockUser({ id: 2, type: "cleaner", falseClaimCount: 1 }),
        homeowner: createMockUser({ id: 1, falseHomeSizeCount: 2 }),
        photos: [{ id: 1, roomType: "bedroom", roomNumber: 1, photoUrl: "data..." }],
      });

      const res = await request(app)
        .get("/api/v1/home-size-adjustment/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe("Notes Format", () => {
    it("should append notes with timestamp", async () => {
      const token = generateToken(3);

      const mockOwner = createMockUser({ id: 3, type: "owner", firstName: "Admin", lastName: "User" });
      const mockCleaner = createMockUser({
        id: 2,
        type: "cleaner",
        falseClaimCount: 0,
        ownerPrivateNotes: null,
      });
      const mockRequest = createMockRequest({ status: "pending_owner" });

      User.findByPk.mockImplementation((id) => {
        if (id === 3) return Promise.resolve(mockOwner);
        if (id === 1) return Promise.resolve(createMockUser({ id: 1 }));
        if (id === 2) return Promise.resolve(mockCleaner);
      });
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(createMockHome());
      UserAppointments.findByPk.mockResolvedValue(createMockAppointment());

      await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send({ approve: false, ownerNote: "Test denial" });

      const updateCall = mockCleaner.update.mock.calls[0][0];
      // Note should contain timestamp format [YYYY-MM-DDTHH:mm:ss...]
      expect(updateCall.ownerPrivateNotes).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
      // Note should contain owner name
      expect(updateCall.ownerPrivateNotes).toContain("Admin User");
    });

    it("should preserve existing notes when adding new ones", async () => {
      const token = generateToken(3);

      const existingNote = "[2025-01-01] Previous incident noted";
      const mockOwner = createMockUser({ id: 3, type: "owner" });
      const mockHomeowner = createMockUser({
        id: 1,
        falseHomeSizeCount: 1,
        ownerPrivateNotes: existingNote,
      });
      const mockRequest = createMockRequest({ status: "pending_owner" });

      User.findByPk.mockImplementation((id) => {
        if (id === 3) return Promise.resolve(mockOwner);
        if (id === 1) return Promise.resolve(mockHomeowner);
        if (id === 2) return Promise.resolve(createMockUser({ id: 2, type: "cleaner" }));
      });
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(createMockHome());
      UserAppointments.findByPk.mockResolvedValue(createMockAppointment());
      UserAppointments.findAll.mockResolvedValue([]);

      await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send({ approve: true, ownerNote: "Second incident" });

      const updateCall = mockHomeowner.update.mock.calls[0][0];
      // Should contain both old and new notes
      expect(updateCall.ownerPrivateNotes).toContain(existingNote);
      expect(updateCall.ownerPrivateNotes).toContain("HOME SIZE DISCREPANCY");
    });
  });

  describe("POST /:id/homeowner-response - Stripe Charge", () => {
    it("should charge homeowner via Stripe when approving with price difference > 0", async () => {
      const token = generateToken(1);

      const mockHomeowner = createMockUser({
        id: 1,
        stripeCustomerId: "cus_test123",
      });
      const mockCleaner = createMockUser({ id: 2, type: "cleaner" });
      const mockRequest = createMockRequest({ priceDifference: 50.0 });
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment();

      User.findByPk.mockImplementation((id) => {
        if (id === 1) return Promise.resolve(mockHomeowner);
        if (id === 2) return Promise.resolve(mockCleaner);
      });
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserAppointments.findAll.mockResolvedValue([]);

      mockStripe.customers.retrieve.mockResolvedValue({
        invoice_settings: { default_payment_method: "pm_test123" },
      });
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: "pi_test123",
        status: "succeeded",
      });

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/homeowner-response")
        .set("Authorization", `Bearer ${token}`)
        .send({ approve: true });

      expect(res.status).toBe(200);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000, // 50.00 * 100 cents
          currency: "usd",
          customer: "cus_test123",
          payment_method: "pm_test123",
          confirm: true,
          off_session: true,
        })
      );
      expect(recordPaymentTransaction).toHaveBeenCalled();
    });

    it("should mark charge as failed when homeowner has no stripeCustomerId", async () => {
      const token = generateToken(1);

      const mockHomeowner = createMockUser({
        id: 1,
        stripeCustomerId: null, // No Stripe customer
      });
      const mockCleaner = createMockUser({ id: 2, type: "cleaner" });
      const mockRequest = createMockRequest({ priceDifference: 50.0 });
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment();

      User.findByPk.mockImplementation((id) => {
        if (id === 1) return Promise.resolve(mockHomeowner);
        if (id === 2) return Promise.resolve(mockCleaner);
      });
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserAppointments.findAll.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/homeowner-response")
        .set("Authorization", `Bearer ${token}`)
        .send({ approve: true });

      expect(res.status).toBe(200);
      // Stripe should not be called
      expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
      // Request should be updated with chargeStatus: "failed"
      expect(mockRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          chargeStatus: "failed",
        })
      );
    });

    it("should mark charge as failed when homeowner has no payment method", async () => {
      const token = generateToken(1);

      const mockHomeowner = createMockUser({
        id: 1,
        stripeCustomerId: "cus_test123",
      });
      const mockCleaner = createMockUser({ id: 2, type: "cleaner" });
      const mockRequest = createMockRequest({ priceDifference: 50.0 });
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment();

      User.findByPk.mockImplementation((id) => {
        if (id === 1) return Promise.resolve(mockHomeowner);
        if (id === 2) return Promise.resolve(mockCleaner);
      });
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserAppointments.findAll.mockResolvedValue([]);

      mockStripe.customers.retrieve.mockResolvedValue({
        invoice_settings: { default_payment_method: null },
        default_source: null,
      });

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/homeowner-response")
        .set("Authorization", `Bearer ${token}`)
        .send({ approve: true });

      expect(res.status).toBe(200);
      expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
      expect(mockRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          chargeStatus: "failed",
        })
      );
    });

    it("should not attempt Stripe charge when priceDifference is 0", async () => {
      const token = generateToken(1);

      const mockHomeowner = createMockUser({
        id: 1,
        stripeCustomerId: "cus_test123",
      });
      const mockCleaner = createMockUser({ id: 2, type: "cleaner" });
      const mockRequest = createMockRequest({ priceDifference: 0 });
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment();

      User.findByPk.mockImplementation((id) => {
        if (id === 1) return Promise.resolve(mockHomeowner);
        if (id === 2) return Promise.resolve(mockCleaner);
      });
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserAppointments.findAll.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/homeowner-response")
        .set("Authorization", `Bearer ${token}`)
        .send({ approve: true });

      expect(res.status).toBe(200);
      expect(mockStripe.customers.retrieve).not.toHaveBeenCalled();
      expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
    });
  });

  describe("POST /:id/homeowner-response - Cleaner Dispute Notification", () => {
    it("should notify cleaner when homeowner disputes the claim", async () => {
      const token = generateToken(1);

      const mockHomeowner = createMockUser({ id: 1 });
      const mockCleaner = createMockUser({ id: 2, type: "cleaner", email: "cleaner@test.com" });
      const mockRequest = createMockRequest();
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment();
      const mockOwners = [createMockUser({ id: 3, type: "owner" })];

      User.findByPk.mockImplementation((id) => {
        if (id === 1) return Promise.resolve(mockHomeowner);
        if (id === 2) return Promise.resolve(mockCleaner);
      });
      User.findAll.mockResolvedValue(mockOwners);
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/homeowner-response")
        .set("Authorization", `Bearer ${token}`)
        .send({
          approve: false,
          reason: "The home size is correct",
        });

      expect(res.status).toBe(200);
      // Should notify cleaner about the dispute
      expect(NotificationService.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 2,
          type: "adjustment_disputed",
          title: "Home Size Claim Disputed",
        })
      );
    });

    it("should include dispute reason in notification data", async () => {
      const token = generateToken(1);

      const mockHomeowner = createMockUser({ id: 1 });
      const mockCleaner = createMockUser({ id: 2, type: "cleaner" });
      const mockRequest = createMockRequest();
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment();
      const mockOwners = [createMockUser({ id: 3, type: "owner" })];

      User.findByPk.mockImplementation((id) => {
        if (id === 1) return Promise.resolve(mockHomeowner);
        if (id === 2) return Promise.resolve(mockCleaner);
      });
      User.findAll.mockResolvedValue(mockOwners);
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const disputeReason = "I measured and it's definitely 3 beds";

      await request(app)
        .post("/api/v1/home-size-adjustment/1/homeowner-response")
        .set("Authorization", `Bearer ${token}`)
        .send({
          approve: false,
          reason: disputeReason,
        });

      expect(NotificationService.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            disputeReason: disputeReason,
          }),
        })
      );
    });
  });

  describe("POST /:id/owner-resolve - Stripe Charge", () => {
    it("should charge homeowner via Stripe when owner approves with price difference > 0", async () => {
      const token = generateToken(3);

      const mockOwner = createMockUser({ id: 3, type: "owner" });
      const mockHomeowner = createMockUser({
        id: 1,
        stripeCustomerId: "cus_homeowner123",
      });
      const mockCleaner = createMockUser({ id: 2, type: "cleaner" });
      const mockRequest = createMockRequest({
        status: "pending_owner",
      });
      const mockHome = createMockHome();
      // Set appointment price to 150, calculatePrice returns 200, so priceDiff = 50
      const mockAppointment = createMockAppointment({ price: "150.00" });

      User.findByPk.mockImplementation((id) => {
        if (id === 3) return Promise.resolve(mockOwner);
        if (id === 1) return Promise.resolve(mockHomeowner);
        if (id === 2) return Promise.resolve(mockCleaner);
      });
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserAppointments.findAll.mockResolvedValue([]);

      // calculatePrice returns 200, appointment.price is 150, so priceDiff = 50
      calculatePrice.mockResolvedValue(200);

      mockStripe.customers.retrieve.mockResolvedValue({
        invoice_settings: { default_payment_method: "pm_owner_test" },
      });
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: "pi_owner_test",
        status: "succeeded",
      });

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send({ approve: true, ownerNote: "Photos confirm larger size" });

      expect(res.status).toBe(200);
      // priceDiff = 200 - 150 = 50, amount = 50 * 100 = 5000 cents
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          customer: "cus_homeowner123",
        })
      );
      expect(recordPaymentTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "charge",
          status: "succeeded",
          amount: 5000,
        })
      );
    });

    it("should handle Stripe error gracefully", async () => {
      const token = generateToken(3);

      const mockOwner = createMockUser({ id: 3, type: "owner" });
      const mockHomeowner = createMockUser({
        id: 1,
        stripeCustomerId: "cus_homeowner123",
      });
      const mockCleaner = createMockUser({ id: 2, type: "cleaner" });
      const mockRequest = createMockRequest({
        status: "pending_owner",
      });
      const mockHome = createMockHome();
      const mockAppointment = createMockAppointment({ price: "150.00" });

      User.findByPk.mockImplementation((id) => {
        if (id === 3) return Promise.resolve(mockOwner);
        if (id === 1) return Promise.resolve(mockHomeowner);
        if (id === 2) return Promise.resolve(mockCleaner);
      });
      HomeSizeAdjustmentRequest.findByPk.mockResolvedValue(mockRequest);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      UserAppointments.findAll.mockResolvedValue([]);

      mockStripe.customers.retrieve.mockResolvedValue({
        invoice_settings: { default_payment_method: "pm_test" },
      });
      mockStripe.paymentIntents.create.mockRejectedValue(new Error("Card declined"));

      const res = await request(app)
        .post("/api/v1/home-size-adjustment/1/owner-resolve")
        .set("Authorization", `Bearer ${token}`)
        .send({ approve: true, ownerNote: "Approved" });

      // Should still succeed but mark charge as failed
      expect(res.status).toBe(200);
      expect(mockRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          chargeStatus: "failed",
        })
      );
    });
  });
});

afterAll(() => {
  jest.clearAllMocks();
});
