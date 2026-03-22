const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
}));

const { User } = require("../../models");
const verifyITOrOwner = require("../../middleware/verifyITOrOwner");

describe("verifyITOrOwner Middleware", () => {
  const secretKey = process.env.SESSION_SECRET || "test-secret";
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe("Authorization Header Validation", () => {
    it("should return 401 when no authorization header is provided", async () => {
      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Authorization token required" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when authorization header does not start with Bearer", async () => {
      req.headers.authorization = "Basic sometoken";

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Authorization token required" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when authorization header is just 'Bearer'", async () => {
      req.headers.authorization = "Bearer";

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Authorization token required" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when authorization header has empty token", async () => {
      req.headers.authorization = "Bearer ";

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Token Validation", () => {
    it("should return 401 for invalid token", async () => {
      req.headers.authorization = "Bearer invalid-token";

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 for expired token", async () => {
      const expiredToken = jwt.sign({ userId: 1 }, secretKey, { expiresIn: "-1h" });
      req.headers.authorization = `Bearer ${expiredToken}`;

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 for token signed with wrong secret", async () => {
      const wrongSecretToken = jwt.sign({ userId: 1 }, "wrong-secret");
      req.headers.authorization = `Bearer ${wrongSecretToken}`;

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 for malformed JWT token", async () => {
      req.headers.authorization = "Bearer not.a.valid.jwt.token";

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("User Validation", () => {
    it("should return 401 when user not found in database", async () => {
      const token = jwt.sign({ userId: 999 }, secretKey);
      req.headers.authorization = `Bearer ${token}`;
      User.findByPk.mockResolvedValue(null);

      await verifyITOrOwner(req, res, next);

      expect(User.findByPk).toHaveBeenCalledWith(999);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 for regular homeowner user", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      req.headers.authorization = `Bearer ${token}`;
      User.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        username: "testuser",
      });

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "IT or Owner access required" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 for cleaner user", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);
      req.headers.authorization = `Bearer ${token}`;
      User.findByPk.mockResolvedValue({
        id: 2,
        type: "cleaner",
        username: "cleaner1",
      });

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "IT or Owner access required" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 for HR user (not IT)", async () => {
      const token = jwt.sign({ userId: 3 }, secretKey);
      req.headers.authorization = `Bearer ${token}`;
      User.findByPk.mockResolvedValue({
        id: 3,
        type: "humanResources",
        username: "hruser",
      });

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "IT or Owner access required" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 for employee user", async () => {
      const token = jwt.sign({ userId: 4 }, secretKey);
      req.headers.authorization = `Bearer ${token}`;
      User.findByPk.mockResolvedValue({
        id: 4,
        type: "employee",
        username: "employee1",
      });

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "IT or Owner access required" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 for user with null type", async () => {
      const token = jwt.sign({ userId: 5 }, secretKey);
      req.headers.authorization = `Bearer ${token}`;
      User.findByPk.mockResolvedValue({
        id: 5,
        type: null,
        username: "nulluser",
      });

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "IT or Owner access required" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 for user with undefined type", async () => {
      const token = jwt.sign({ userId: 6 }, secretKey);
      req.headers.authorization = `Bearer ${token}`;
      User.findByPk.mockResolvedValue({
        id: 6,
        username: "noTypeUser",
      });

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "IT or Owner access required" });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Successful Authorization", () => {
    it("should call next() and set req.user for owner type user", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      req.headers.authorization = `Bearer ${token}`;
      const mockOwner = {
        id: 1,
        type: "owner",
        username: "owner1",
        firstName: "Owner",
        lastName: "User",
      };
      User.findByPk.mockResolvedValue(mockOwner);

      await verifyITOrOwner(req, res, next);

      expect(User.findByPk).toHaveBeenCalledWith(1);
      expect(req.user).toEqual(mockOwner);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should call next() and set req.user for IT type user", async () => {
      const token = jwt.sign({ userId: 2 }, secretKey);
      req.headers.authorization = `Bearer ${token}`;
      const mockIT = {
        id: 2,
        type: "it",
        username: "itstaff1",
        firstName: "IT",
        lastName: "Staff",
      };
      User.findByPk.mockResolvedValue(mockIT);

      await verifyITOrOwner(req, res, next);

      expect(User.findByPk).toHaveBeenCalledWith(2);
      expect(req.user).toEqual(mockIT);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should work with token that has additional claims", async () => {
      const token = jwt.sign({ userId: 1, role: "admin", extra: "data" }, secretKey);
      req.headers.authorization = `Bearer ${token}`;
      const mockOwner = {
        id: 1,
        type: "owner",
        username: "owner1",
      };
      User.findByPk.mockResolvedValue(mockOwner);

      await verifyITOrOwner(req, res, next);

      expect(User.findByPk).toHaveBeenCalledWith(1);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should return 500 for unexpected database errors", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      req.headers.authorization = `Bearer ${token}`;
      User.findByPk.mockRejectedValue(new Error("Database connection failed"));

      // Mock console.error to suppress output during test
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Server error" });
      expect(next).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle database timeout gracefully", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      req.headers.authorization = `Bearer ${token}`;
      User.findByPk.mockRejectedValue(new Error("Connection timeout"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Server error" });

      consoleSpy.mockRestore();
    });
  });

  describe("Case Sensitivity", () => {
    it("should be case sensitive for user type 'it'", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      req.headers.authorization = `Bearer ${token}`;
      User.findByPk.mockResolvedValue({
        id: 1,
        type: "IT", // uppercase - should fail
        username: "itstaff",
      });

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("should be case sensitive for user type 'owner'", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      req.headers.authorization = `Bearer ${token}`;
      User.findByPk.mockResolvedValue({
        id: 1,
        type: "Owner", // mixed case - should fail
        username: "owner1",
      });

      await verifyITOrOwner(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
