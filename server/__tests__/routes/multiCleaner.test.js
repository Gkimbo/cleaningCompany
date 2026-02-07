/**
 * Integration tests for Multi-Cleaner Router
 * Tests all API endpoints for multi-cleaner job management
 */
const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock all dependencies before requiring the router
jest.mock("../../services/MultiCleanerService");
jest.mock("../../services/RoomAssignmentService");
jest.mock("../../services/MultiCleanerPricingService");
jest.mock("../../services/NotificationService");
jest.mock("../../serializers/MultiCleanerJobSerializer", () => ({
  serializeOne: jest.fn((job) => job),
  serializeMany: jest.fn((jobs) => jobs),
  serializeOffer: jest.fn((offer) => offer),
  serializeOffersResponse: jest.fn((offers, availableJobs) => ({
    personalOffers: offers,
    availableJobs: availableJobs,
  })),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
  MultiCleanerJob: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  CleanerRoomAssignment: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  },
  CleanerJobOffer: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  CleanerJobCompletion: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  UserCleanerAppointments: {
    create: jest.fn(),
    destroy: jest.fn(),
  },
  Payout: {},
}));

const {
  User,
  UserAppointments,
  UserHomes,
  MultiCleanerJob,
  CleanerRoomAssignment,
  CleanerJobOffer,
  CleanerJobCompletion,
  UserCleanerAppointments,
} = require("../../models");

const MultiCleanerService = require("../../services/MultiCleanerService");
const RoomAssignmentService = require("../../services/RoomAssignmentService");
const MultiCleanerPricingService = require("../../services/MultiCleanerPricingService");
const NotificationService = require("../../services/NotificationService");
const MultiCleanerJobSerializer = require("../../serializers/MultiCleanerJobSerializer");

describe("Multi-Cleaner Router", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const multiCleanerRouter = require("../../routes/api/v1/multiCleanerRouter");
    app.use("/api/v1/multi-cleaner", multiCleanerRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Authentication Tests
  // ============================================
  describe("Authentication", () => {
    it("should return 401 for missing authorization token", async () => {
      const res = await request(app).get("/api/v1/multi-cleaner/offers");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Authorization token required");
    });

    it("should return 401 for invalid token", async () => {
      const res = await request(app)
        .get("/api/v1/multi-cleaner/offers")
        .set("Authorization", "Bearer invalid_token");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid or expired token");
    });

    it("should allow valid token", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      CleanerJobOffer.findAll.mockResolvedValue([]);
      MultiCleanerJob.findAll.mockResolvedValue([]);
      CleanerJobCompletion.findAll.mockResolvedValue([]);
      UserAppointments.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/multi-cleaner/offers")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  // ============================================
  // GET /check/:appointmentId Tests
  // ============================================
  describe("GET /check/:appointmentId", () => {
    it("should return check info for appointment", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      MultiCleanerService.getJobCheckInfo.mockResolvedValue({
        isLargeHome: true,
        isEdgeLargeHome: false,
        soloAllowed: false,
        multiCleanerRequired: true,
        recommendedCleaners: 2,
        estimatedDuration: 180,
        numBeds: 4,
        numBaths: 3,
      });

      const res = await request(app)
        .get("/api/v1/multi-cleaner/check/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLargeHome).toBe(true);
      expect(res.body.soloAllowed).toBe(false);
      expect(res.body.multiCleanerRequired).toBe(true);
      expect(res.body.recommendedCleaners).toBe(2);
      expect(MultiCleanerService.getJobCheckInfo).toHaveBeenCalledWith(1);
    });

    it("should return soloAllowed true for edge large homes", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      MultiCleanerService.getJobCheckInfo.mockResolvedValue({
        isLargeHome: true,
        isEdgeLargeHome: true,
        soloAllowed: true,
        multiCleanerRequired: false,
        recommendedCleaners: 2,
        estimatedDuration: 150,
        numBeds: 3,
        numBaths: 3,
      });

      const res = await request(app)
        .get("/api/v1/multi-cleaner/check/2")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isLargeHome).toBe(true);
      expect(res.body.isEdgeLargeHome).toBe(true);
      expect(res.body.soloAllowed).toBe(true);
      expect(res.body.multiCleanerRequired).toBe(false);
    });

    it("should return 500 on service error", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      MultiCleanerService.getJobCheckInfo.mockRejectedValue(
        new Error("Database error")
      );

      const res = await request(app)
        .get("/api/v1/multi-cleaner/check/1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Database error");
    });
  });

  // ============================================
  // POST /create Tests
  // ============================================
  describe("POST /create", () => {
    const mockHome = {
      id: 1,
      numBeds: 4,
      numBaths: 3,
    };

    const mockAppointment = {
      id: 100,
      home: mockHome,
      homeId: 1,
    };

    it("should create a multi-cleaner job", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      MultiCleanerService.createMultiCleanerJob.mockResolvedValue({
        id: 1,
        appointmentId: 100,
        totalCleanersRequired: 2,
        cleanersConfirmed: 0,
        status: "open",
      });

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      // Mock MultiCleanerJob.findByPk for the fetch after creation
      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 1,
        appointmentId: 100,
        totalCleanersRequired: 2,
        cleanersConfirmed: 0,
        status: "open",
        appointment: mockAppointment,
      });

      RoomAssignmentService.createRoomAssignments.mockResolvedValue([
        { id: 1, roomType: "bedroom", roomNumber: 1 },
        { id: 2, roomType: "bathroom", roomNumber: 1 },
      ]);

      MultiCleanerPricingService.calculateTotalJobPrice.mockResolvedValue(15000);
      MultiCleanerPricingService.updateRoomEarningsShares.mockResolvedValue(true);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/create")
        .set("Authorization", `Bearer ${token}`)
        .send({ appointmentId: 100, cleanerCount: 2 });

      expect(res.status).toBe(201);
      expect(res.body.multiCleanerJob.id).toBe(1);
      expect(res.body.roomAssignments).toHaveLength(2);
      expect(res.body.totalPrice).toBe(15000);
    });

    it("should return 400 for missing required fields", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/create")
        .set("Authorization", `Bearer ${token}`)
        .send({ appointmentId: 100 }); // Missing cleanerCount

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("appointmentId and cleanerCount are required");
    });

    it("should return 500 on service error", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      MultiCleanerService.createMultiCleanerJob.mockRejectedValue(
        new Error("Appointment not found")
      );

      const res = await request(app)
        .post("/api/v1/multi-cleaner/create")
        .set("Authorization", `Bearer ${token}`)
        .send({ appointmentId: 999, cleanerCount: 2 });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Appointment not found");
    });
  });

  // ============================================
  // GET /offers Tests
  // ============================================
  describe("GET /offers", () => {
    it("should return personal offers and available jobs", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      CleanerJobOffer.findAll.mockResolvedValue([
        {
          id: 1,
          cleanerId: 100,
          status: "pending",
          multiCleanerJobId: 10,
          multiCleanerJob: {
            id: 10,
            appointment: { id: 1, home: { numBeds: 4 } },
          },
        },
      ]);

      MultiCleanerJob.findAll.mockResolvedValue([
        {
          id: 11,
          status: "open",
          appointment: { id: 2, home: { numBeds: 3 } },
        },
      ]);

      CleanerJobCompletion.findAll.mockResolvedValue([]);
      UserAppointments.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/multi-cleaner/offers")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.personalOffers).toHaveLength(1);
      expect(res.body.availableJobs).toHaveLength(1);
    });

    it("should filter out jobs cleaner is already assigned to", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      CleanerJobOffer.findAll.mockResolvedValue([]);

      MultiCleanerJob.findAll.mockResolvedValue([
        { id: 10, status: "open", appointment: { home: {} } },
        { id: 11, status: "open", appointment: { home: {} } },
      ]);

      CleanerJobCompletion.findAll.mockResolvedValue([
        { multiCleanerJobId: 10 },
      ]);
      UserAppointments.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/multi-cleaner/offers")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.availableJobs).toHaveLength(1);
      expect(res.body.availableJobs[0].id).toBe(11);
    });
  });

  // ============================================
  // POST /offers/:offerId/accept Tests
  // ============================================
  describe("POST /offers/:offerId/accept", () => {
    const createMockOffer = (cleanerId, status = "pending") => ({
      id: 1,
      cleanerId,
      status,
      multiCleanerJobId: 10,
      appointmentId: 100,
      multiCleanerJob: {
        id: 10,
        totalCleanersRequired: 2,
      },
      isExpired: jest.fn().mockReturnValue(false),
      accept: jest.fn().mockResolvedValue(true),
    });

    it("should accept a valid offer", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);
      const mockOffer = createMockOffer(100);

      CleanerJobOffer.findByPk.mockResolvedValue(mockOffer);
      CleanerRoomAssignment.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      CleanerRoomAssignment.count.mockResolvedValue(4);
      MultiCleanerService.fillSlot.mockResolvedValue(true);
      UserCleanerAppointments.create.mockResolvedValue({});
      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 10,
        roomAssignments: [{ id: 1 }, { id: 2 }],
      });
      CleanerJobCompletion.findAll.mockResolvedValue([]);
      NotificationService.createNotification.mockResolvedValue({});

      const res = await request(app)
        .post("/api/v1/multi-cleaner/offers/1/accept")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockOffer.accept).toHaveBeenCalled();
      expect(MultiCleanerService.fillSlot).toHaveBeenCalledWith(10, 100, [1, 2]);
    });

    it("should return 404 for non-existent offer", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      CleanerJobOffer.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/offers/999/accept")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Offer not found");
    });

    it("should return 403 if offer is not for the cleaner", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);
      const mockOffer = createMockOffer(999); // Different cleaner

      CleanerJobOffer.findByPk.mockResolvedValue(mockOffer);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/offers/1/accept")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("This offer is not for you");
    });

    it("should return 400 if offer is expired", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);
      const mockOffer = createMockOffer(100);
      mockOffer.isExpired.mockReturnValue(true);

      CleanerJobOffer.findByPk.mockResolvedValue(mockOffer);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/offers/1/accept")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Offer has expired");
    });

    it("should return 400 if offer is no longer pending", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);
      const mockOffer = createMockOffer(100, "accepted");

      CleanerJobOffer.findByPk.mockResolvedValue(mockOffer);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/offers/1/accept")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Offer is no longer available");
    });
  });

  // ============================================
  // POST /offers/:offerId/decline Tests
  // ============================================
  describe("POST /offers/:offerId/decline", () => {
    it("should decline an offer", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);
      const mockOffer = {
        id: 1,
        cleanerId: 100,
        decline: jest.fn().mockResolvedValue(true),
      };

      CleanerJobOffer.findByPk.mockResolvedValue(mockOffer);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/offers/1/decline")
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Schedule conflict" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockOffer.decline).toHaveBeenCalledWith("Schedule conflict");
    });

    it("should return 403 if offer is not for the cleaner", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);
      const mockOffer = { id: 1, cleanerId: 999 };

      CleanerJobOffer.findByPk.mockResolvedValue(mockOffer);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/offers/1/decline")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ============================================
  // POST /join/:multiCleanerJobId Tests
  // ============================================
  describe("POST /join/:multiCleanerJobId", () => {
    it("should allow cleaner to join an open job", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      MultiCleanerJob.findByPk
        .mockResolvedValueOnce({
          id: 10,
          appointmentId: 100,
          totalCleanersRequired: 2,
          isFilled: jest.fn().mockReturnValue(false),
          appointment: { home: {} },
        })
        .mockResolvedValueOnce({ id: 10 });

      CleanerJobCompletion.findOne.mockResolvedValue(null);
      CleanerRoomAssignment.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      CleanerRoomAssignment.count.mockResolvedValue(4);
      MultiCleanerService.fillSlot.mockResolvedValue(true);
      UserCleanerAppointments.create.mockResolvedValue({});
      RoomAssignmentService.calculateCleanerEarningsShare.mockResolvedValue(7500);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/join/10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.estimatedEarnings).toBe(7500);
    });

    it("should return 404 for non-existent job", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      MultiCleanerJob.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/join/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Job not found");
    });

    it("should return 400 if job is already filled", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 10,
        isFilled: jest.fn().mockReturnValue(true),
        appointment: { home: {} },
      });

      const res = await request(app)
        .post("/api/v1/multi-cleaner/join/10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("All slots are already filled");
    });

    it("should return 400 if cleaner is already assigned", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 10,
        isFilled: jest.fn().mockReturnValue(false),
        appointment: { home: {} },
      });

      CleanerJobCompletion.findOne.mockResolvedValue({ id: 1, cleanerId: 100 });

      const res = await request(app)
        .post("/api/v1/multi-cleaner/join/10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("You are already assigned to this job");
    });
  });

  // ============================================
  // GET /assignments/:appointmentId Tests
  // ============================================
  describe("GET /assignments/:appointmentId", () => {
    it("should return cleaner-specific assignments", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 100, type: "cleaner" });
      RoomAssignmentService.getCleanerRooms.mockResolvedValue([
        { id: 1, roomType: "bedroom", roomNumber: 1 },
        { id: 2, roomType: "bathroom", roomNumber: 1 },
      ]);

      const res = await request(app)
        .get("/api/v1/multi-cleaner/assignments/100")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.assignments).toHaveLength(2);
      expect(RoomAssignmentService.getCleanerRooms).toHaveBeenCalledWith(100, 100);
    });

    it("should return all assignments for admin", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      RoomAssignmentService.getAllRoomAssignments.mockResolvedValue([
        { id: 1, cleanerId: 100 },
        { id: 2, cleanerId: 100 },
        { id: 3, cleanerId: 101 },
        { id: 4, cleanerId: 101 },
      ]);

      const res = await request(app)
        .get("/api/v1/multi-cleaner/assignments/100")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.assignments).toHaveLength(4);
      expect(RoomAssignmentService.getAllRoomAssignments).toHaveBeenCalledWith(100);
    });
  });

  // ============================================
  // GET /checklist/:appointmentId Tests
  // ============================================
  describe("GET /checklist/:appointmentId", () => {
    it("should return cleaner-specific checklist", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      RoomAssignmentService.getCleanerRooms.mockResolvedValue([
        { id: 1, roomType: "bedroom", roomNumber: 1 },
      ]);

      RoomAssignmentService.generateCleanerChecklist.mockResolvedValue({
        rooms: [{ name: "Bedroom 1", tasks: ["Make bed", "Vacuum floor"] }],
        totalTasks: 2,
      });

      const res = await request(app)
        .get("/api/v1/multi-cleaner/checklist/100")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.rooms).toHaveLength(1);
      expect(res.body.totalTasks).toBe(2);
    });

    it("should return 404 if cleaner has no assignments", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      RoomAssignmentService.getCleanerRooms.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/multi-cleaner/checklist/100")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("No room assignments found for this cleaner");
    });
  });

  // ============================================
  // POST /rooms/:roomAssignmentId/complete Tests
  // ============================================
  describe("POST /rooms/:roomAssignmentId/complete", () => {
    it("should complete a room successfully", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      const mockAssignment = {
        id: 1,
        cleanerId: 100,
        multiCleanerJobId: 10,
        markCompleted: jest.fn().mockResolvedValue(true),
      };

      CleanerRoomAssignment.findByPk.mockResolvedValue(mockAssignment);
      RoomAssignmentService.validateRoomCompletion.mockResolvedValue({
        valid: true,
      });
      CleanerRoomAssignment.findAll.mockResolvedValue([
        { status: "completed" },
        { status: "completed" },
      ]);
      MultiCleanerService.markCleanerComplete.mockResolvedValue(true);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/rooms/1/complete")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.allRoomsComplete).toBe(true);
      expect(mockAssignment.markCompleted).toHaveBeenCalled();
    });

    it("should return 404 for non-existent room assignment", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      CleanerRoomAssignment.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/rooms/999/complete")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Room assignment not found");
    });

    it("should return 403 if room is not assigned to the cleaner", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      CleanerRoomAssignment.findByPk.mockResolvedValue({
        id: 1,
        cleanerId: 999, // Different cleaner
      });

      const res = await request(app)
        .post("/api/v1/multi-cleaner/rooms/1/complete")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("This room is not assigned to you");
    });

    it("should return 400 if validation fails (missing photos)", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      CleanerRoomAssignment.findByPk.mockResolvedValue({
        id: 1,
        cleanerId: 100,
      });

      RoomAssignmentService.validateRoomCompletion.mockResolvedValue({
        valid: false,
        error: "Missing before photos",
        beforePhotoCount: 0,
        afterPhotoCount: 0,
      });

      const res = await request(app)
        .post("/api/v1/multi-cleaner/rooms/1/complete")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Missing before photos");
      expect(res.body.beforePhotoCount).toBe(0);
    });
  });

  // ============================================
  // GET /status/:appointmentId Tests
  // ============================================
  describe("GET /status/:appointmentId", () => {
    it("should return full job status", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        isMultiCleanerJob: true,
        home: { numBeds: 4 },
        multiCleanerJob: { id: 10, status: "in_progress" },
      });

      CleanerJobCompletion.findAll.mockResolvedValue([
        {
          cleanerId: 100,
          status: "started",
          cleaner: { firstName: "John", lastName: "Doe" },
        },
        {
          cleanerId: 101,
          status: "assigned",
          cleaner: { firstName: "Jane", lastName: "Smith" },
        },
      ]);

      CleanerRoomAssignment.findAll.mockResolvedValue([
        { id: 1, cleanerId: 100, status: "completed", cleaner: {}, getDisplayLabel: () => "Bedroom 1" },
        { id: 2, cleanerId: 100, status: "in_progress", cleaner: {}, getDisplayLabel: () => "Bathroom 1" },
        { id: 3, cleanerId: 101, status: "pending", cleaner: {}, getDisplayLabel: () => "Kitchen" },
        { id: 4, cleanerId: 101, status: "pending", cleaner: {}, getDisplayLabel: () => "Living Room" },
      ]);

      const res = await request(app)
        .get("/api/v1/multi-cleaner/status/100")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cleaners).toHaveLength(2);
      expect(res.body.roomAssignments).toHaveLength(4);
      expect(res.body.progress.totalRooms).toBe(4);
      expect(res.body.progress.completedRooms).toBe(1);
      expect(res.body.progress.percent).toBe(25);
    });

    it("should return 404 for non-existent appointment", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/multi-cleaner/status/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Appointment not found");
    });

    it("should return 400 if not a multi-cleaner job", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        isMultiCleanerJob: false,
      });

      const res = await request(app)
        .get("/api/v1/multi-cleaner/status/100")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Not a multi-cleaner job");
    });
  });

  // ============================================
  // GET /progress/:appointmentId Tests
  // ============================================
  describe("GET /progress/:appointmentId", () => {
    it("should return job progress", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        multiCleanerJob: { id: 10, status: "in_progress" },
      });

      CleanerRoomAssignment.findAll.mockResolvedValue([
        { status: "completed" },
        { status: "completed" },
        { status: "in_progress" },
        { status: "pending" },
      ]);

      const res = await request(app)
        .get("/api/v1/multi-cleaner/progress/100")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.progress.total).toBe(4);
      expect(res.body.progress.completed).toBe(2);
      expect(res.body.progress.inProgress).toBe(1);
      expect(res.body.progress.pending).toBe(1);
      expect(res.body.progress.percent).toBe(50);
    });

    it("should return 404 if multi-cleaner job not found", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        multiCleanerJob: null,
      });

      const res = await request(app)
        .get("/api/v1/multi-cleaner/progress/100")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Multi-cleaner job not found");
    });
  });

  // ============================================
  // POST /:appointmentId/dropout Tests
  // ============================================
  describe("POST /:appointmentId/dropout", () => {
    it("should handle cleaner dropout", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        multiCleanerJob: { id: 10 },
      });

      MultiCleanerService.handleCleanerDropout.mockResolvedValue({
        remainingCleaners: 1,
        soloOfferSent: true,
      });

      UserCleanerAppointments.destroy.mockResolvedValue(1);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/100/dropout")
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Emergency" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.remainingCleaners).toBe(1);
      expect(MultiCleanerService.handleCleanerDropout).toHaveBeenCalledWith(
        10, 100, "Emergency"
      );
    });

    it("should return 404 if multi-cleaner job not found", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        multiCleanerJob: null,
      });

      const res = await request(app)
        .post("/api/v1/multi-cleaner/100/dropout")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Multi-cleaner job not found");
    });
  });

  // ============================================
  // POST /:appointmentId/accept-solo Tests
  // ============================================
  describe("POST /:appointmentId/accept-solo", () => {
    it("should accept solo completion", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        homeId: 1,
        multiCleanerJob: { id: 10 },
        update: jest.fn().mockResolvedValue(true),
      });

      CleanerJobCompletion.findOne.mockResolvedValue({
        id: 1,
        cleanerId: 100,
        status: "assigned",
      });

      RoomAssignmentService.rebalanceAfterDropout.mockResolvedValue(true);
      UserHomes.findByPk.mockResolvedValue({ numBeds: 4, numBaths: 3 });
      MultiCleanerPricingService.calculateTotalJobPrice.mockResolvedValue(15000);
      MultiCleanerPricingService.calculateSoloCompletionEarnings.mockResolvedValue(12000);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/100/accept-solo")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.earnings).toBe(12000);
      expect(res.body.earningsFormatted).toBe("$120.00");
    });

    it("should return 403 if cleaner is not assigned", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        multiCleanerJob: { id: 10 },
      });

      CleanerJobCompletion.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/100/accept-solo")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("You are not assigned to this job");
    });
  });

  // ============================================
  // GET /:appointmentId/cleaners Tests
  // ============================================
  describe("GET /:appointmentId/cleaners", () => {
    it("should return cleaners and earnings breakdown", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        multiCleanerJob: { id: 10 },
      });

      MultiCleanerPricingService.generateEarningsBreakdown.mockResolvedValue({
        totalPrice: 15000,
        platformFee: 1500,
        cleanerTotal: 13500,
        cleaners: [
          { id: 100, name: "John Doe", earnings: 6750 },
          { id: 101, name: "Jane Smith", earnings: 6750 },
        ],
      });

      const res = await request(app)
        .get("/api/v1/multi-cleaner/100/cleaners")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.totalPrice).toBe(15000);
      expect(res.body.cleaners).toHaveLength(2);
    });
  });

  // ============================================
  // POST /:appointmentId/homeowner-response Tests
  // ============================================
  describe("POST /:appointmentId/homeowner-response", () => {
    it("should handle proceed_with_one response", async () => {
      const token = jwt.sign({ userId: 200 }, secretKey);

      const mockAppointment = {
        id: 100,
        userId: 200,
        multiCleanerJob: { id: 10 },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);

      const res = await request(app)
        .post("/api/v1/multi-cleaner/100/homeowner-response")
        .set("Authorization", `Bearer ${token}`)
        .send({ response: "proceed_with_one" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockAppointment.update).toHaveBeenCalledWith({
        homeownerSoloWarningAcknowledged: true,
      });
    });

    it("should handle cancel response", async () => {
      const token = jwt.sign({ userId: 200 }, secretKey);

      const mockJob = {
        id: 10,
        status: "partially_filled",
        save: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        userId: 200,
        multiCleanerJob: mockJob,
      });

      const res = await request(app)
        .post("/api/v1/multi-cleaner/100/homeowner-response")
        .set("Authorization", `Bearer ${token}`)
        .send({ response: "cancel" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockJob.status).toBe("cancelled");
    });

    it("should handle reschedule response", async () => {
      const token = jwt.sign({ userId: 200 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        userId: 200,
        multiCleanerJob: { id: 10 },
      });

      const res = await request(app)
        .post("/api/v1/multi-cleaner/100/homeowner-response")
        .set("Authorization", `Bearer ${token}`)
        .send({ response: "reschedule", rescheduleDate: "2025-02-01" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rescheduleDate).toBe("2025-02-01");
    });

    it("should return 400 for reschedule without date", async () => {
      const token = jwt.sign({ userId: 200 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        userId: 200,
        multiCleanerJob: { id: 10 },
      });

      const res = await request(app)
        .post("/api/v1/multi-cleaner/100/homeowner-response")
        .set("Authorization", `Bearer ${token}`)
        .send({ response: "reschedule" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Reschedule date required");
    });

    it("should return 403 if not appointment owner", async () => {
      const token = jwt.sign({ userId: 200 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        userId: 999, // Different user
      });

      const res = await request(app)
        .post("/api/v1/multi-cleaner/100/homeowner-response")
        .set("Authorization", `Bearer ${token}`)
        .send({ response: "cancel" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Not your appointment");
    });

    it("should return 400 for invalid response", async () => {
      const token = jwt.sign({ userId: 200 }, secretKey);

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        userId: 200,
        multiCleanerJob: { id: 10 },
      });

      const res = await request(app)
        .post("/api/v1/multi-cleaner/100/homeowner-response")
        .set("Authorization", `Bearer ${token}`)
        .send({ response: "invalid" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        "Invalid response. Use: proceed_with_one, proceed_edge_case, cancel_edge_case, cancel, or reschedule"
      );
    });

    // Edge Case Decision Response Tests
    describe("Edge Case Responses", () => {
      it("should handle proceed_edge_case response successfully", async () => {
        const token = jwt.sign({ userId: 200 }, secretKey);
        const mockMultiCleanerJob = {
          id: 10,
          appointmentId: 100,
          edgeCaseDecisionRequired: true,
          homeownerDecision: "pending",
          update: jest.fn().mockResolvedValue(true),
        };
        const mockAppointment = {
          id: 100,
          userId: 200,
          multiCleanerJob: mockMultiCleanerJob,
        };

        UserAppointments.findByPk.mockResolvedValue(mockAppointment);

        const res = await request(app)
          .post("/api/v1/multi-cleaner/100/homeowner-response")
          .set("Authorization", `Bearer ${token}`)
          .send({ response: "proceed_edge_case" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain("proceed with 1 cleaner");
      });

      it("should reject proceed_edge_case when no edge case decision required", async () => {
        const token = jwt.sign({ userId: 200 }, secretKey);
        const mockMultiCleanerJob = {
          id: 10,
          appointmentId: 100,
          edgeCaseDecisionRequired: false,
          homeownerDecision: null,
        };
        const mockAppointment = {
          id: 100,
          userId: 200,
          multiCleanerJob: mockMultiCleanerJob,
        };

        UserAppointments.findByPk.mockResolvedValue(mockAppointment);

        const res = await request(app)
          .post("/api/v1/multi-cleaner/100/homeowner-response")
          .set("Authorization", `Bearer ${token}`)
          .send({ response: "proceed_edge_case" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("No edge case decision required for this appointment");
      });

      it("should reject cancel_edge_case when no edge case decision required", async () => {
        const token = jwt.sign({ userId: 200 }, secretKey);
        const mockMultiCleanerJob = {
          id: 10,
          appointmentId: 100,
          edgeCaseDecisionRequired: false,
          homeownerDecision: null,
        };
        const mockAppointment = {
          id: 100,
          userId: 200,
          multiCleanerJob: mockMultiCleanerJob,
        };

        UserAppointments.findByPk.mockResolvedValue(mockAppointment);

        const res = await request(app)
          .post("/api/v1/multi-cleaner/100/homeowner-response")
          .set("Authorization", `Bearer ${token}`)
          .send({ response: "cancel_edge_case" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("No edge case decision required for this appointment");
      });

      it("should reject edge case response when decision already made (proceed)", async () => {
        const token = jwt.sign({ userId: 200 }, secretKey);
        const mockMultiCleanerJob = {
          id: 10,
          appointmentId: 100,
          edgeCaseDecisionRequired: true,
          homeownerDecision: "proceed", // Already decided
        };
        const mockAppointment = {
          id: 100,
          userId: 200,
          multiCleanerJob: mockMultiCleanerJob,
        };

        UserAppointments.findByPk.mockResolvedValue(mockAppointment);

        const res = await request(app)
          .post("/api/v1/multi-cleaner/100/homeowner-response")
          .set("Authorization", `Bearer ${token}`)
          .send({ response: "proceed_edge_case" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Decision has already been made");
        expect(res.body.currentDecision).toBe("proceed");
      });

      it("should reject edge case response when decision already made (auto_proceeded)", async () => {
        const token = jwt.sign({ userId: 200 }, secretKey);
        const mockMultiCleanerJob = {
          id: 10,
          appointmentId: 100,
          edgeCaseDecisionRequired: true,
          homeownerDecision: "auto_proceeded", // Already auto-proceeded
        };
        const mockAppointment = {
          id: 100,
          userId: 200,
          multiCleanerJob: mockMultiCleanerJob,
        };

        UserAppointments.findByPk.mockResolvedValue(mockAppointment);

        const res = await request(app)
          .post("/api/v1/multi-cleaner/100/homeowner-response")
          .set("Authorization", `Bearer ${token}`)
          .send({ response: "cancel_edge_case" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Decision has already been made");
        expect(res.body.currentDecision).toBe("auto_proceeded");
      });

      it("should reject proceed_edge_case when no multi-cleaner job exists", async () => {
        const token = jwt.sign({ userId: 200 }, secretKey);
        const mockAppointment = {
          id: 100,
          userId: 200,
          multiCleanerJob: null,
        };

        UserAppointments.findByPk.mockResolvedValue(mockAppointment);

        const res = await request(app)
          .post("/api/v1/multi-cleaner/100/homeowner-response")
          .set("Authorization", `Bearer ${token}`)
          .send({ response: "proceed_edge_case" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("No edge case decision required for this appointment");
      });
    });
  });

  // ============================================
  // GET /earnings/:multiCleanerJobId Tests
  // ============================================
  describe("GET /earnings/:multiCleanerJobId", () => {
    it("should return earnings breakdown", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      MultiCleanerPricingService.generateEarningsBreakdown.mockResolvedValue({
        totalPrice: 15000,
        platformFee: 1500,
        cleanerTotal: 13500,
        cleaners: [{ id: 100, name: "John", earnings: 6750 }],
        rooms: [{ id: 1, name: "Bedroom 1", earnings: 3000 }],
      });

      const res = await request(app)
        .get("/api/v1/multi-cleaner/earnings/10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.totalPrice).toBe(15000);
      expect(res.body.cleaners).toHaveLength(1);
      expect(MultiCleanerPricingService.generateEarningsBreakdown).toHaveBeenCalledWith(10);
    });

    it("should return 500 on service error", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      MultiCleanerPricingService.generateEarningsBreakdown.mockRejectedValue(
        new Error("Job not found")
      );

      const res = await request(app)
        .get("/api/v1/multi-cleaner/earnings/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Job not found");
    });
  });

  // ============================================
  // Edge Cases and Error Handling
  // ============================================
  describe("Edge Cases and Error Handling", () => {
    describe("Invalid Input Handling", () => {
      it("should handle non-numeric appointmentId in check endpoint", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        MultiCleanerService.getJobCheckInfo.mockRejectedValue(
          new Error("Invalid appointment ID")
        );

        const res = await request(app)
          .get("/api/v1/multi-cleaner/check/invalid")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(500);
      });

      it("should handle missing body in create endpoint", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        const res = await request(app)
          .post("/api/v1/multi-cleaner/create")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("appointmentId and cleanerCount are required");
      });

      it("should handle zero cleaner count", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        const res = await request(app)
          .post("/api/v1/multi-cleaner/create")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 100, cleanerCount: 0 });

        expect(res.status).toBe(400);
      });

      it("should handle negative cleaner count", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        MultiCleanerService.createMultiCleanerJob.mockRejectedValue(
          new Error("Invalid cleaner count")
        );

        const res = await request(app)
          .post("/api/v1/multi-cleaner/create")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 100, cleanerCount: -1 });

        // Service throws error which is caught by error handler
        expect(res.status).toBe(500);
      });
    });

    describe("Concurrent Access Scenarios", () => {
      it("should handle job already filled when trying to join", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        MultiCleanerJob.findByPk.mockResolvedValue({
          id: 10,
          isFilled: jest.fn().mockReturnValue(true),
          appointment: { home: {} },
        });

        const res = await request(app)
          .post("/api/v1/multi-cleaner/join/10")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("All slots are already filled");
      });

      it("should handle offer expired between check and accept", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        CleanerJobOffer.findByPk.mockResolvedValue({
          id: 1,
          cleanerId: 100,
          status: "pending",
          multiCleanerJob: { id: 10 },
          isExpired: jest.fn().mockReturnValue(true),
        });

        const res = await request(app)
          .post("/api/v1/multi-cleaner/offers/1/accept")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Offer has expired");
      });

      it("should handle offer already accepted by another request", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        CleanerJobOffer.findByPk.mockResolvedValue({
          id: 1,
          cleanerId: 100,
          status: "accepted", // Already accepted
          multiCleanerJob: { id: 10 },
          isExpired: jest.fn().mockReturnValue(false),
        });

        const res = await request(app)
          .post("/api/v1/multi-cleaner/offers/1/accept")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Offer is no longer available");
      });
    });

    describe("Authorization Edge Cases", () => {
      it("should handle expired JWT token", async () => {
        const expiredToken = jwt.sign(
          { userId: 100, exp: Math.floor(Date.now() / 1000) - 3600 }, // Expired 1 hour ago
          process.env.SESSION_SECRET || "test-secret"
        );

        const res = await request(app)
          .get("/api/v1/multi-cleaner/offers")
          .set("Authorization", `Bearer ${expiredToken}`);

        expect(res.status).toBe(401);
      });

      it("should handle malformed JWT token", async () => {
        const res = await request(app)
          .get("/api/v1/multi-cleaner/offers")
          .set("Authorization", "Bearer malformed.token.here");

        expect(res.status).toBe(401);
      });

      it("should handle Authorization header without Bearer prefix", async () => {
        const token = jwt.sign({ userId: 100 }, process.env.SESSION_SECRET || "test-secret");

        const res = await request(app)
          .get("/api/v1/multi-cleaner/offers")
          .set("Authorization", token);

        expect(res.status).toBe(401);
      });
    });

    describe("Data Consistency Edge Cases", () => {
      it("should handle job status transitions correctly", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 100,
          multiCleanerJob: { id: 10, status: "completed" }, // Already completed
        });

        CleanerRoomAssignment.findAll.mockResolvedValue([
          { status: "completed" },
          { status: "completed" },
        ]);

        const res = await request(app)
          .get("/api/v1/multi-cleaner/progress/100")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.progress.percent).toBe(100);
      });

      it("should handle empty room assignments list", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 100,
          multiCleanerJob: { id: 10, status: "open" },
        });

        CleanerRoomAssignment.findAll.mockResolvedValue([]);

        const res = await request(app)
          .get("/api/v1/multi-cleaner/progress/100")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.progress.total).toBe(0);
        expect(res.body.progress.percent).toBe(0);
      });
    });

    describe("Partial Room Completion", () => {
      it("should not mark cleaner complete if some rooms pending", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        const mockAssignment = {
          id: 1,
          cleanerId: 100,
          multiCleanerJobId: 10,
          markCompleted: jest.fn().mockResolvedValue(true),
        };

        CleanerRoomAssignment.findByPk.mockResolvedValue(mockAssignment);
        RoomAssignmentService.validateRoomCompletion.mockResolvedValue({ valid: true });

        // Only 1 of 2 rooms complete
        CleanerRoomAssignment.findAll.mockResolvedValue([
          { status: "completed" },
          { status: "pending" },
        ]);

        const res = await request(app)
          .post("/api/v1/multi-cleaner/rooms/1/complete")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.allRoomsComplete).toBe(false);
        expect(MultiCleanerService.markCleanerComplete).not.toHaveBeenCalled();
      });
    });

    describe("Dropout Scenarios", () => {
      it("should handle dropout with no reason provided", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 100,
          multiCleanerJob: { id: 10 },
        });

        MultiCleanerService.handleCleanerDropout.mockResolvedValue({
          remainingCleaners: 1,
        });

        UserCleanerAppointments.destroy.mockResolvedValue(1);

        const res = await request(app)
          .post("/api/v1/multi-cleaner/100/dropout")
          .set("Authorization", `Bearer ${token}`)
          .send({}); // No reason

        expect(res.status).toBe(200);
        expect(MultiCleanerService.handleCleanerDropout).toHaveBeenCalledWith(
          10, 100, undefined
        );
      });

      it("should handle dropout when cleaner is last remaining", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 100,
          multiCleanerJob: { id: 10 },
        });

        MultiCleanerService.handleCleanerDropout.mockResolvedValue({
          remainingCleaners: 0,
          canProceedSolo: false,
        });

        UserCleanerAppointments.destroy.mockResolvedValue(1);

        const res = await request(app)
          .post("/api/v1/multi-cleaner/100/dropout")
          .set("Authorization", `Bearer ${token}`)
          .send({ reason: "Personal emergency" });

        expect(res.status).toBe(200);
        expect(res.body.remainingCleaners).toBe(0);
      });
    });

    describe("Solo Completion Edge Cases", () => {
      it("should handle accept-solo when cleaner has dropped_out status", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        UserAppointments.findByPk.mockResolvedValue({
          id: 100,
          multiCleanerJob: { id: 10 },
        });

        // No active completion found (cleaner already dropped out)
        CleanerJobCompletion.findOne.mockResolvedValue(null);

        const res = await request(app)
          .post("/api/v1/multi-cleaner/100/accept-solo")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("You are not assigned to this job");
      });
    });

    describe("Large Data Handling", () => {
      it("should handle job with many rooms", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        // Generate 20 rooms
        const manyRooms = Array.from({ length: 20 }, (_, i) => ({
          id: i + 1,
          cleanerId: i % 2 === 0 ? 100 : 101,
          status: i < 10 ? "completed" : "pending",
          cleaner: {},
          getDisplayLabel: () => `Room ${i + 1}`,
        }));

        UserAppointments.findByPk.mockResolvedValue({
          id: 100,
          isMultiCleanerJob: true,
          home: { numBeds: 10, numBaths: 10 },
          multiCleanerJob: { id: 10, status: "in_progress" },
        });

        CleanerJobCompletion.findAll.mockResolvedValue([
          { cleanerId: 100, status: "started", cleaner: { firstName: "John", lastName: "Doe" } },
          { cleanerId: 101, status: "started", cleaner: { firstName: "Jane", lastName: "Smith" } },
        ]);

        CleanerRoomAssignment.findAll.mockResolvedValue(manyRooms);

        const res = await request(app)
          .get("/api/v1/multi-cleaner/status/100")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.roomAssignments).toHaveLength(20);
        expect(res.body.progress.totalRooms).toBe(20);
        expect(res.body.progress.completedRooms).toBe(10);
        expect(res.body.progress.percent).toBe(50);
      });

      it("should handle job with many cleaners", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        // 4 cleaners
        const manyCleaners = Array.from({ length: 4 }, (_, i) => ({
          cleanerId: 100 + i,
          status: "assigned",
          cleaner: { firstName: `Cleaner${i}`, lastName: "Test" },
        }));

        UserAppointments.findByPk.mockResolvedValue({
          id: 100,
          isMultiCleanerJob: true,
          home: { numBeds: 8, numBaths: 6 },
          multiCleanerJob: { id: 10, status: "filled" },
        });

        CleanerJobCompletion.findAll.mockResolvedValue(manyCleaners);
        CleanerRoomAssignment.findAll.mockResolvedValue([]);

        const res = await request(app)
          .get("/api/v1/multi-cleaner/status/100")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.cleaners).toHaveLength(4);
      });
    });

    describe("Service Error Propagation", () => {
      it("should propagate service errors with proper message", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        MultiCleanerService.createMultiCleanerJob.mockRejectedValue(
          new Error("Database connection failed")
        );

        const res = await request(app)
          .post("/api/v1/multi-cleaner/create")
          .set("Authorization", `Bearer ${token}`)
          .send({ appointmentId: 100, cleanerCount: 2 });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe("Database connection failed");
      });

      it("should handle notification service failures gracefully", async () => {
        const token = jwt.sign({ userId: 100 }, secretKey);

        const mockOffer = {
          id: 1,
          cleanerId: 100,
          status: "pending",
          multiCleanerJobId: 10,
          appointmentId: 100,
          multiCleanerJob: { id: 10, totalCleanersRequired: 2 },
          isExpired: jest.fn().mockReturnValue(false),
          accept: jest.fn().mockResolvedValue(true),
        };

        CleanerJobOffer.findByPk.mockResolvedValue(mockOffer);
        CleanerRoomAssignment.findAll.mockResolvedValue([{ id: 1 }]);
        CleanerRoomAssignment.count.mockResolvedValue(2);
        MultiCleanerService.fillSlot.mockResolvedValue(true);
        UserCleanerAppointments.create.mockResolvedValue({});
        MultiCleanerJob.findByPk.mockResolvedValue({ id: 10, roomAssignments: [] });

        // Other cleaners to notify
        CleanerJobCompletion.findAll.mockResolvedValue([
          { cleanerId: 101 },
        ]);

        // Notification fails but shouldn't break the flow
        NotificationService.createNotification.mockRejectedValue(
          new Error("Push notification failed")
        );

        const res = await request(app)
          .post("/api/v1/multi-cleaner/offers/1/accept")
          .set("Authorization", `Bearer ${token}`);

        // Should still fail because the error isn't caught
        expect(res.status).toBe(500);
      });
    });
  });

  // ============================================
  // Integration Flow Tests
  // ============================================
  describe("Integration Flow Tests", () => {
    it("should handle complete job creation flow", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      const mockHome = { id: 1, numBeds: 5, numBaths: 4 };
      const mockAppointment = { id: 100, home: mockHome, homeId: 1 };

      // Step 1: Check if large home
      MultiCleanerService.getJobCheckInfo.mockResolvedValue({
        isLargeHome: true,
        recommendedCleaners: 2,
      });

      const checkRes = await request(app)
        .get("/api/v1/multi-cleaner/check/100")
        .set("Authorization", `Bearer ${token}`);

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.isLargeHome).toBe(true);

      // Step 2: Create multi-cleaner job
      MultiCleanerService.createMultiCleanerJob.mockResolvedValue({
        id: 1,
        appointmentId: 100,
        totalCleanersRequired: 2,
        cleanersConfirmed: 0,
        status: "open",
      });

      UserAppointments.findByPk.mockResolvedValue(mockAppointment);
      RoomAssignmentService.createRoomAssignments.mockResolvedValue([
        { id: 1, roomType: "bedroom", roomNumber: 1 },
        { id: 2, roomType: "bedroom", roomNumber: 2 },
        { id: 3, roomType: "bathroom", roomNumber: 1 },
        { id: 4, roomType: "bathroom", roomNumber: 2 },
      ]);
      MultiCleanerPricingService.calculateTotalJobPrice.mockResolvedValue(18000);
      MultiCleanerPricingService.updateRoomEarningsShares.mockResolvedValue(true);

      // Mock findByPk for fetching job with associations
      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 1,
        appointmentId: 100,
        totalCleanersRequired: 2,
        cleanersConfirmed: 0,
        status: "open",
        appointment: mockAppointment,
      });

      // Mock serializer
      MultiCleanerJobSerializer.serializeOne.mockReturnValue({
        id: 1,
        appointmentId: 100,
        totalCleanersRequired: 2,
        cleanersConfirmed: 0,
        status: "open",
      });

      const createRes = await request(app)
        .post("/api/v1/multi-cleaner/create")
        .set("Authorization", `Bearer ${token}`)
        .send({ appointmentId: 100, cleanerCount: 2 });

      expect(createRes.status).toBe(201);
      expect(createRes.body.multiCleanerJob.status).toBe("open");
      expect(createRes.body.roomAssignments).toHaveLength(4);
    });

    it("should handle complete offer accept flow", async () => {
      const token = jwt.sign({ userId: 100 }, secretKey);

      const mockOffer = {
        id: 1,
        cleanerId: 100,
        status: "pending",
        multiCleanerJobId: 10,
        appointmentId: 100,
        multiCleanerJob: { id: 10, totalCleanersRequired: 2 },
        isExpired: jest.fn().mockReturnValue(false),
        accept: jest.fn().mockResolvedValue(true),
      };

      // Accept offer
      CleanerJobOffer.findByPk.mockResolvedValue(mockOffer);
      CleanerRoomAssignment.findAll.mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);
      CleanerRoomAssignment.count.mockResolvedValue(4);
      MultiCleanerService.fillSlot.mockResolvedValue(true);
      UserCleanerAppointments.create.mockResolvedValue({});
      MultiCleanerJob.findByPk.mockResolvedValue({
        id: 10,
        roomAssignments: [{ id: 1 }, { id: 2 }],
      });
      CleanerJobCompletion.findAll.mockResolvedValue([]);
      NotificationService.createNotification.mockResolvedValue({});

      const res = await request(app)
        .post("/api/v1/multi-cleaner/offers/1/accept")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockOffer.accept).toHaveBeenCalled();
    });
  });

  afterAll(async () => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });
});
