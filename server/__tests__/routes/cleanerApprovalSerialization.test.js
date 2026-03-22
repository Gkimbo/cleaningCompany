const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock EncryptionService to verify decryption is called
const mockDecrypt = jest.fn((value) => {
  if (!value) return value;
  if (typeof value !== "string") return value;
  return `decrypted_${value}`;
});

jest.mock("../../services/EncryptionService", () => ({
  decrypt: mockDecrypt,
  encrypt: jest.fn((value) => `encrypted_${value}`),
}));

// Mock CleanerApprovalService
jest.mock("../../services/CleanerApprovalService", () => ({
  getPendingRequestsForCleaner: jest.fn(),
  getPendingRequestsForHomeowner: jest.fn(),
}));

// Mock models
jest.mock("../../models", () => ({
  CleanerRoomAssignment: {
    findAll: jest.fn(),
  },
}));

const CleanerApprovalService = require("../../services/CleanerApprovalService");
const { CleanerRoomAssignment } = require("../../models");

describe("Cleaner Approval Router - Serialization Tests", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());

    // Import router after mocks are set up
    const cleanerApprovalRouter = require("../../routes/api/v1/cleanerApprovalRouter");
    app.use("/api/v1/cleaner-approval", cleanerApprovalRouter);
  });

  describe("GET /my-requests - Cleaner's Pending Requests Serialization", () => {
    it("should decrypt all home address fields including zipcode", async () => {
      const mockRequests = [
        {
          id: 1,
          multiCleanerJobId: 100,
          appointmentId: 200,
          homeId: 300,
          status: "pending",
          expiresAt: new Date("2024-01-20"),
          createdAt: new Date("2024-01-15"),
          roomAssignmentIds: [],
          appointment: {
            id: 200,
            date: "2024-01-20",
            price: 15000,
            timeToBeCompleted: "10:00 AM",
            bringSheets: true,
            bringTowels: false,
            home: {
              id: 300,
              nickName: "Beach House",
              address: "encrypted_123_main_st",
              city: "encrypted_boston",
              state: "encrypted_ma",
              zipcode: "encrypted_02101",
              numBeds: 3,
              numBaths: 2,
              latitude: 42.3601,
              longitude: -71.0589,
            },
          },
          multiCleanerJob: {
            id: 100,
            totalCleanersRequired: 2,
            cleanersConfirmed: 1,
            status: "pending",
          },
        },
      ];

      CleanerApprovalService.getPendingRequestsForCleaner.mockResolvedValue(mockRequests);
      CleanerRoomAssignment.findAll.mockResolvedValue([]);

      const token = generateToken(1);
      const response = await request(app)
        .get("/api/v1/cleaner-approval/my-requests")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.requests).toHaveLength(1);

      const homeData = response.body.requests[0].appointment.home;

      // Verify all encrypted fields are decrypted - including zipcode fix
      expect(homeData.address).toBe("decrypted_encrypted_123_main_st");
      expect(homeData.city).toBe("decrypted_encrypted_boston");
      expect(homeData.state).toBe("decrypted_encrypted_ma");
      expect(homeData.zipcode).toBe("decrypted_encrypted_02101");

      // Verify decrypt was called for each encrypted field
      expect(mockDecrypt).toHaveBeenCalledWith("encrypted_123_main_st");
      expect(mockDecrypt).toHaveBeenCalledWith("encrypted_boston");
      expect(mockDecrypt).toHaveBeenCalledWith("encrypted_ma");
      expect(mockDecrypt).toHaveBeenCalledWith("encrypted_02101");

      // Verify non-encrypted fields remain unchanged
      expect(homeData.numBeds).toBe(3);
      expect(homeData.numBaths).toBe(2);
      expect(homeData.nickName).toBe("Beach House");
    });

    it("should handle null home gracefully", async () => {
      const mockRequests = [
        {
          id: 1,
          multiCleanerJobId: 100,
          appointmentId: 200,
          homeId: 300,
          status: "pending",
          expiresAt: new Date("2024-01-20"),
          createdAt: new Date("2024-01-15"),
          roomAssignmentIds: [],
          appointment: {
            id: 200,
            date: "2024-01-20",
            price: 15000,
            home: null,
          },
          multiCleanerJob: null,
        },
      ];

      CleanerApprovalService.getPendingRequestsForCleaner.mockResolvedValue(mockRequests);

      const token = generateToken(1);
      const response = await request(app)
        .get("/api/v1/cleaner-approval/my-requests")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.requests[0].appointment.home).toBeNull();
    });

    it("should include room assignments when present", async () => {
      const mockRequests = [
        {
          id: 1,
          multiCleanerJobId: 100,
          appointmentId: 200,
          homeId: 300,
          status: "pending",
          expiresAt: new Date("2024-01-20"),
          createdAt: new Date("2024-01-15"),
          roomAssignmentIds: [1, 2],
          appointment: {
            id: 200,
            date: "2024-01-20",
            price: 15000,
            home: {
              id: 300,
              address: "encrypted_address",
              city: "encrypted_city",
              state: "encrypted_state",
              zipcode: "encrypted_zip",
            },
          },
        },
      ];

      const mockRoomAssignments = [
        { id: 1, roomType: "bedroom", roomNumber: 1, roomLabel: "Master Bedroom" },
        { id: 2, roomType: "bathroom", roomNumber: 1, roomLabel: "Master Bath" },
      ];

      CleanerApprovalService.getPendingRequestsForCleaner.mockResolvedValue(mockRequests);
      CleanerRoomAssignment.findAll.mockResolvedValue(mockRoomAssignments);

      const token = generateToken(1);
      const response = await request(app)
        .get("/api/v1/cleaner-approval/my-requests")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.requests[0].assignedRooms).toHaveLength(2);
      expect(response.body.requests[0].assignedBedrooms).toBe(1);
      expect(response.body.requests[0].assignedBathrooms).toBe(1);
    });
  });

  describe("GET /pending - Homeowner's Pending Requests Serialization", () => {
    it("should decrypt cleaner names and home address", async () => {
      const mockRequests = [
        {
          id: 1,
          cleanerId: 10,
          cleaner: {
            firstName: "encrypted_john",
            lastName: "encrypted_doe",
          },
          appointmentId: 200,
          multiCleanerJobId: 100,
          homeId: 300,
          appointment: {
            date: "2024-01-20",
            home: {
              address: "encrypted_456_elm_st",
              city: "encrypted_cambridge",
            },
          },
          expiresAt: new Date("2024-01-25"),
          createdAt: new Date("2024-01-15"),
        },
      ];

      CleanerApprovalService.getPendingRequestsForHomeowner.mockResolvedValue(mockRequests);

      const token = generateToken(1);
      const response = await request(app)
        .get("/api/v1/cleaner-approval/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.requests).toHaveLength(1);

      const req = response.body.requests[0];

      // Verify cleaner name is decrypted
      expect(req.cleanerName).toBe("decrypted_encrypted_john decrypted_encrypted_doe");
      expect(req.cleanerFirstName).toBe("decrypted_encrypted_john");

      // Verify home address is decrypted
      expect(req.homeAddress).toBe("decrypted_encrypted_456_elm_st, decrypted_encrypted_cambridge");

      // Verify decrypt was called for cleaner fields
      expect(mockDecrypt).toHaveBeenCalledWith("encrypted_john");
      expect(mockDecrypt).toHaveBeenCalledWith("encrypted_doe");
      expect(mockDecrypt).toHaveBeenCalledWith("encrypted_456_elm_st");
      expect(mockDecrypt).toHaveBeenCalledWith("encrypted_cambridge");
    });

    it("should handle missing cleaner gracefully", async () => {
      const mockRequests = [
        {
          id: 1,
          cleanerId: 10,
          cleaner: null,
          appointmentId: 200,
          multiCleanerJobId: 100,
          homeId: 300,
          appointment: {
            date: "2024-01-20",
            home: null,
          },
          expiresAt: new Date("2024-01-25"),
          createdAt: new Date("2024-01-15"),
        },
      ];

      CleanerApprovalService.getPendingRequestsForHomeowner.mockResolvedValue(mockRequests);

      const token = generateToken(1);
      const response = await request(app)
        .get("/api/v1/cleaner-approval/pending")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.requests[0].cleanerName).toBe("Unknown");
      expect(response.body.requests[0].cleanerFirstName).toBe("");
      expect(response.body.requests[0].homeAddress).toBeNull();
    });
  });

  describe("Authorization", () => {
    it("should reject requests without token", async () => {
      const response = await request(app)
        .get("/api/v1/cleaner-approval/my-requests");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Authorization token required");
    });

    it("should reject requests with invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/cleaner-approval/my-requests")
        .set("Authorization", "Bearer invalid_token");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired token");
    });
  });
});
