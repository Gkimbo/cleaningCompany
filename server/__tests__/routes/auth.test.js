const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  UserBills: {
    create: jest.fn(),
  },
  TermsAndConditions: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
  },
  UserTermsAcceptance: {
    create: jest.fn(),
  },
}));

// Mock passport
jest.mock("passport", () => ({
  authenticate: jest.fn(() => (req, res, next) => {
    if (req.body.username === "validuser" && req.body.password === "validpass") {
      req.user = { id: 1 };
      req.login = (user, callback) => callback(null);
      next();
    } else {
      res.status(401).json({ error: "Authentication failed" });
    }
  }),
  initialize: jest.fn(() => (req, res, next) => next()),
  session: jest.fn(() => (req, res, next) => next()),
}));

const { User, UserBills, TermsAndConditions, UserTermsAcceptance } = require("../../models");

describe("Authentication Routes", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Mock session
    app.use((req, res, next) => {
      req.session = {
        destroy: jest.fn((cb) => cb && cb()),
      };
      req.login = jest.fn((user, cb) => cb(null));
      next();
    });

    const sessionRouter = require("../../routes/api/v1/userSessionsRouter");
    app.use("/api/v1/user-sessions", sessionRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /login", () => {
    it("should login with valid credentials", async () => {
      const hashedPassword = await bcrypt.hash("testpassword", 10);

      User.findOne.mockResolvedValue({
        id: 1,
        username: "testuser",
        password: hashedPassword,
        email: "test@example.com",
        type: null,
        daysWorking: null,
        lastLogin: new Date(),
        loginCount: 0,
        update: jest.fn().mockResolvedValue(true),
      });
      TermsAndConditions.findOne.mockResolvedValue(null); // No terms to accept

      const res = await request(app)
        .post("/api/v1/user-sessions/login")
        .send({
          username: "testuser",
          password: "testpassword",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("token");
      expect(res.body.requiresTermsAcceptance).toBe(false);
    });

    it("should return 401 for invalid password", async () => {
      const hashedPassword = await bcrypt.hash("testpassword", 10);

      User.findOne.mockResolvedValue({
        id: 1,
        username: "testuser",
        password: hashedPassword,
      });

      const res = await request(app)
        .post("/api/v1/user-sessions/login")
        .send({
          username: "testuser",
          password: "wrongpassword",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid password");
    });

    it("should return 404 for non-existent user", async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/user-sessions/login")
        .send({
          username: "nonexistent",
          password: "anypassword",
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("No account found");
    });
  });

  describe("GET /current", () => {
    it("should return current user with valid token", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findOne.mockResolvedValue({
        id: 1,
        username: "testuser",
        email: "test@example.com",
        type: null,
        daysWorking: null,
        lastLogin: new Date(),
      });

      const res = await request(app)
        .get("/api/v1/user-sessions/current")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("token");
    });

    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/v1/user-sessions/current");

      expect(res.status).toBe(401);
    });

    it("should return 403 with invalid token", async () => {
      const res = await request(app)
        .get("/api/v1/user-sessions/current")
        .set("Authorization", "Bearer invalid_token");

      expect(res.status).toBe(403);
    });
  });

  describe("POST /logout", () => {
    it("should logout successfully", async () => {
      const res = await request(app).post("/api/v1/user-sessions/logout");

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Logout successful");
    });
  });
});

describe("User Registration Routes", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const usersRouter = require("../../routes/api/v1/usersRouter");
    app.use("/api/v1/users", usersRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST / (register)", () => {
    it("should create a new user successfully", async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        id: 1,
        dataValues: {
          id: 1,
          username: "newuser",
          email: "new@example.com",
          type: null,
          daysWorking: null,
          lastLogin: new Date(),
        },
        update: jest.fn().mockResolvedValue(true),
      });
      UserBills.create.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .post("/api/v1/users")
        .send({
          username: "newuser",
          password: "testpassword123",
          email: "new@example.com",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("token");
    });

    it("should return 409 if email already exists", async () => {
      User.findOne.mockResolvedValueOnce({ id: 1, email: "existing@example.com" });

      const res = await request(app)
        .post("/api/v1/users")
        .send({
          username: "newuser",
          password: "testpassword123",
          email: "existing@example.com",
        });

      expect(res.status).toBe(409);
    });

    it("should return 410 if username already exists", async () => {
      User.findOne
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ id: 1, username: "existinguser" }); // username check

      const res = await request(app)
        .post("/api/v1/users")
        .send({
          username: "existinguser",
          password: "testpassword123",
          email: "new@example.com",
        });

      expect(res.status).toBe(410);
    });
  });

  describe("GET /employees", () => {
    it("should return list of employees", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findAll = jest.fn().mockResolvedValue([
        {
          dataValues: {
            id: 2,
            username: "cleaner1",
            email: "cleaner@example.com",
            type: "cleaner",
            daysWorking: ["Monday", "Tuesday"],
          },
        },
      ]);

      const res = await request(app)
        .get("/api/v1/users/employees")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("users");
      expect(Array.isArray(res.body.users)).toBe(true);
    });
  });
});

afterAll(async () => {
  // Clear all mocks and timers
  jest.clearAllMocks();
  jest.useRealTimers();
});
