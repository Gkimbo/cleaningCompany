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
  hash: jest.fn((value) => `hash_${value}`),
}));

// Mock verifyHROrOwner middleware - must be before router import
jest.mock("../../middleware/verifyHROrOwner", () => {
  return (req, res, next) => {
    // Set req.user for the HR tools
    req.user = { id: req.userId, type: req.userType };
    next();
  };
});

// Mock models
jest.mock("../../models", () => {
  const { Op } = require("sequelize");
  return {
    User: {
      findByPk: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    },
    UserHomes: {
      findByPk: jest.fn(),
    },
    UserAppointments: {
      findAll: jest.fn(),
    },
    HomeSizeAdjustmentRequest: {
      findAll: jest.fn(),
    },
    HRAuditLog: {
      create: jest.fn(),
    },
    CancellationAppeal: {},
    JobLedger: {},
    UserReviews: {},
    Notification: {},
    sequelize: {
      Op,
    },
    Op,
  };
});

const { User, UserHomes, UserAppointments, HomeSizeAdjustmentRequest } = require("../../models");

describe("HR Support Tools Router - Serialization Tests", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId, type = "hr") => {
    return jwt.sign({ userId, type }, secretKey);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use((req, res, next) => {
      const token = req.headers.authorization?.split(" ")[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, secretKey);
          req.userId = decoded.userId;
          req.userType = decoded.type;
        } catch (e) {
          // Invalid token
        }
      }
      next();
    });

    // Import router after mocks are set up
    const hrSupportToolsRouter = require("../../routes/api/v1/hrSupportToolsRouter");
    app.use("/api/v1/hr-support", hrSupportToolsRouter);
  });

  describe("GET /home/:homeId/details - Home Details Serialization", () => {
    it("should decrypt all encrypted home fields", async () => {
      const mockHome = {
        id: 1,
        address: "encrypted_123_main_st",
        city: "encrypted_boston",
        state: "encrypted_ma",
        zipcode: "encrypted_02101",
        numBeds: 3,
        numBaths: 2,
        numHalfBaths: 1,
        nickName: "Beach House",
        user: {
          id: 10,
          username: "homeowner1",
          firstName: "encrypted_john",
          lastName: "encrypted_doe",
        },
      };

      const mockUser = {
        id: 1,
        type: "hr",
        accountFrozen: false,
      };

      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue([]);
      UserAppointments.findAll.mockResolvedValue([]);

      const token = generateToken(1, "hr");
      const response = await request(app)
        .get("/api/v1/hr-support/home/1/details")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);

      // Verify home address fields are decrypted
      expect(response.body.home.address).toBe("decrypted_encrypted_123_main_st");
      expect(response.body.home.city).toBe("decrypted_encrypted_boston");
      expect(response.body.home.state).toBe("decrypted_encrypted_ma");
      expect(response.body.home.zipcode).toBe("decrypted_encrypted_02101");

      // Verify owner name is decrypted
      expect(response.body.home.owner.name).toContain("decrypted_encrypted_john");
      expect(response.body.home.owner.name).toContain("decrypted_encrypted_doe");

      // Verify unencrypted fields are not modified
      expect(response.body.home.numBeds).toBe(3);
      expect(response.body.home.numBaths).toBe(2);
      expect(response.body.home.nickName).toBe("Beach House");
    });

    it("should handle null encrypted fields gracefully", async () => {
      const mockHome = {
        id: 1,
        address: null,
        city: null,
        state: null,
        zipcode: null,
        numBeds: 2,
        numBaths: 1,
        nickName: null,
        user: null,
      };

      const mockUser = {
        id: 1,
        type: "hr",
        accountFrozen: false,
      };

      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue([]);
      UserAppointments.findAll.mockResolvedValue([]);

      const token = generateToken(1, "hr");
      const response = await request(app)
        .get("/api/v1/hr-support/home/1/details")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.home.address).toBeNull();
      expect(response.body.home.city).toBeNull();
      expect(response.body.home.state).toBeNull();
      expect(response.body.home.owner).toBeNull();
    });
  });

  describe("GET /search - User Search Serialization", () => {
    it("should decrypt user PII fields in search results", async () => {
      const mockUsers = [
        {
          id: 1,
          username: "user1",
          firstName: "encrypted_alice",
          lastName: "encrypted_smith",
          email: "encrypted_alice@test.com",
          type: "client",
          createdAt: new Date("2024-01-01"),
        },
        {
          id: 2,
          username: "user2",
          firstName: "encrypted_bob",
          lastName: "encrypted_jones",
          email: "encrypted_bob@test.com",
          type: "cleaner",
          createdAt: new Date("2024-01-02"),
        },
      ];

      const mockUser = {
        id: 1,
        type: "hr",
        accountFrozen: false,
      };

      User.findByPk.mockResolvedValue(mockUser);
      User.findAll.mockResolvedValue(mockUsers);

      const token = generateToken(1, "hr");
      const response = await request(app)
        .get("/api/v1/hr-support/search?query=test")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(2);

      // Verify first user's PII is decrypted
      expect(response.body.users[0].firstName).toBe("decrypted_encrypted_alice");
      expect(response.body.users[0].lastName).toBe("decrypted_encrypted_smith");
      expect(response.body.users[0].email).toBe("decrypted_encrypted_alice@test.com");

      // Verify second user's PII is decrypted
      expect(response.body.users[1].firstName).toBe("decrypted_encrypted_bob");
      expect(response.body.users[1].lastName).toBe("decrypted_encrypted_jones");

      // Username should not be decrypted (not encrypted)
      expect(response.body.users[0].username).toBe("user1");
    });
  });
});
