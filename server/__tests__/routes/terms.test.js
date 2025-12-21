const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

// Mock models
jest.mock("../../models", () => ({
  TermsAndConditions: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
  UserTermsAcceptance: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
}));

// Mock fs module
jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  createReadStream: jest.fn(() => ({
    pipe: jest.fn(),
  })),
  unlinkSync: jest.fn(),
}));

// Mock multer
jest.mock("multer", () => {
  const multer = () => ({
    single: () => (req, res, next) => {
      req.file = {
        originalname: "test-terms.pdf",
        path: "/uploads/terms/homeowner/v1_terms_20251220.pdf",
        size: 1024,
      };
      next();
    },
  });
  multer.diskStorage = jest.fn(() => ({}));
  return multer;
});

const { TermsAndConditions, UserTermsAcceptance, User } = require("../../models");

const termsRouter = require("../../routes/api/v1/termsRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/terms", termsRouter);

const secretKey = process.env.SESSION_SECRET || "test_secret";

describe("Terms Router", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /terms/current/:type", () => {
    it("should return current terms for homeowner type", async () => {
      const mockTerms = {
        id: 1,
        type: "homeowner",
        version: 1,
        title: "Terms of Service",
        content: "Test terms content",
        contentType: "text",
        effectiveDate: new Date(),
      };

      TermsAndConditions.findOne.mockResolvedValue(mockTerms);

      const response = await request(app).get("/api/v1/terms/current/homeowner");

      expect(response.status).toBe(200);
      expect(response.body.terms).toBeDefined();
      expect(response.body.terms.type).toBe("homeowner");
      expect(response.body.terms.version).toBe(1);
      expect(response.body.terms.content).toBe("Test terms content");
    });

    it("should return current terms for cleaner type", async () => {
      const mockTerms = {
        id: 2,
        type: "cleaner",
        version: 1,
        title: "Cleaner Agreement",
        content: "Cleaner terms content",
        contentType: "text",
        effectiveDate: new Date(),
      };

      TermsAndConditions.findOne.mockResolvedValue(mockTerms);

      const response = await request(app).get("/api/v1/terms/current/cleaner");

      expect(response.status).toBe(200);
      expect(response.body.terms.type).toBe("cleaner");
    });

    it("should return PDF URL for PDF type terms", async () => {
      const mockTerms = {
        id: 1,
        type: "homeowner",
        version: 1,
        title: "Terms of Service",
        contentType: "pdf",
        pdfFileName: "terms.pdf",
        effectiveDate: new Date(),
      };

      TermsAndConditions.findOne.mockResolvedValue(mockTerms);

      const response = await request(app).get("/api/v1/terms/current/homeowner");

      expect(response.status).toBe(200);
      expect(response.body.terms.contentType).toBe("pdf");
      expect(response.body.terms.pdfUrl).toBe("/api/v1/terms/pdf/1");
    });

    it("should return null if no terms exist", async () => {
      TermsAndConditions.findOne.mockResolvedValue(null);

      const response = await request(app).get("/api/v1/terms/current/homeowner");

      expect(response.status).toBe(200);
      expect(response.body.terms).toBeNull();
    });

    it("should return 400 for invalid type", async () => {
      const response = await request(app).get("/api/v1/terms/current/invalid");

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("homeowner");
    });
  });

  describe("GET /terms/check", () => {
    it("should return requiresAcceptance true if user hasn't accepted", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "client",
        termsAcceptedVersion: null,
      });

      TermsAndConditions.findOne.mockResolvedValue({
        id: 1,
        type: "homeowner",
        version: 1,
        title: "Terms",
        contentType: "text",
        content: "Test content",
        effectiveDate: new Date(),
      });

      const response = await request(app)
        .get("/api/v1/terms/check")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.requiresAcceptance).toBe(true);
      expect(response.body.terms).toBeDefined();
    });

    it("should return requiresAcceptance true if user has outdated version", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "client",
        termsAcceptedVersion: 1,
      });

      TermsAndConditions.findOne.mockResolvedValue({
        id: 2,
        type: "homeowner",
        version: 2,
        title: "Terms v2",
        contentType: "text",
        content: "Updated content",
        effectiveDate: new Date(),
      });

      const response = await request(app)
        .get("/api/v1/terms/check")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.requiresAcceptance).toBe(true);
      expect(response.body.currentVersion).toBe(2);
      expect(response.body.acceptedVersion).toBe(1);
    });

    it("should return requiresAcceptance false if user is current", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "client",
        termsAcceptedVersion: 2,
      });

      TermsAndConditions.findOne.mockResolvedValue({
        id: 2,
        type: "homeowner",
        version: 2,
        title: "Terms v2",
        contentType: "text",
        effectiveDate: new Date(),
      });

      const response = await request(app)
        .get("/api/v1/terms/check")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.requiresAcceptance).toBe(false);
    });

    it("should return 401 without token", async () => {
      const response = await request(app).get("/api/v1/terms/check");

      expect(response.status).toBe(401);
    });

    it("should check cleaner terms for cleaner users", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({
        id: 1,
        type: "employee",
        termsAcceptedVersion: null,
      });

      TermsAndConditions.findOne.mockResolvedValue({
        id: 1,
        type: "cleaner",
        version: 1,
        title: "Cleaner Terms",
        contentType: "text",
        content: "Cleaner content",
        effectiveDate: new Date(),
      });

      const response = await request(app)
        .get("/api/v1/terms/check")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(TermsAndConditions.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: "cleaner" },
        })
      );
    });
  });

  describe("POST /terms/accept", () => {
    it("should accept terms and create acceptance record", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const mockTerms = {
        id: 1,
        version: 1,
        contentType: "text",
        content: "Terms content",
        type: "homeowner",
      };

      const mockUser = {
        id: 1,
        update: jest.fn().mockResolvedValue(true),
      };

      TermsAndConditions.findByPk.mockResolvedValue(mockTerms);
      User.findByPk.mockResolvedValue(mockUser);
      UserTermsAcceptance.create.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post("/api/v1/terms/accept")
        .set("Authorization", `Bearer ${token}`)
        .send({ termsId: 1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.acceptedVersion).toBe(1);
      expect(UserTermsAcceptance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          termsId: 1,
          termsContentSnapshot: "Terms content",
        })
      );
      expect(mockUser.update).toHaveBeenCalledWith({ termsAcceptedVersion: 1 });
    });

    it("should copy PDF for PDF terms", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const mockTerms = {
        id: 1,
        version: 1,
        contentType: "pdf",
        pdfFilePath: "/uploads/terms/homeowner/v1_terms.pdf",
        type: "homeowner",
      };

      const mockUser = {
        id: 1,
        update: jest.fn().mockResolvedValue(true),
      };

      TermsAndConditions.findByPk.mockResolvedValue(mockTerms);
      User.findByPk.mockResolvedValue(mockUser);
      UserTermsAcceptance.create.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post("/api/v1/terms/accept")
        .set("Authorization", `Bearer ${token}`)
        .send({ termsId: 1 });

      expect(response.status).toBe(200);
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it("should return 400 if termsId is missing", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const response = await request(app)
        .post("/api/v1/terms/accept")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("termsId");
    });

    it("should return 404 if terms not found", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      TermsAndConditions.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/terms/accept")
        .set("Authorization", `Bearer ${token}`)
        .send({ termsId: 999 });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /terms/history/:type (Manager only)", () => {
    it("should return version history for managers", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 1, type: "admin" });

      TermsAndConditions.findAll.mockResolvedValue([
        {
          id: 2,
          version: 2,
          title: "Terms v2",
          contentType: "text",
          effectiveDate: new Date(),
          createdAt: new Date(),
          creator: { firstName: "Admin", lastName: "User" },
        },
        {
          id: 1,
          version: 1,
          title: "Terms v1",
          contentType: "text",
          effectiveDate: new Date(),
          createdAt: new Date(),
          creator: { firstName: "Admin", lastName: "User" },
        },
      ]);

      const response = await request(app)
        .get("/api/v1/terms/history/homeowner")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.versions).toHaveLength(2);
      expect(response.body.versions[0].version).toBe(2);
    });

    it("should return 403 for non-managers", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 1, type: "client" });

      const response = await request(app)
        .get("/api/v1/terms/history/homeowner")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });
  });

  describe("POST /terms (Create text terms - Manager only)", () => {
    it("should create new text terms version", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 1, type: "admin" });
      TermsAndConditions.findOne.mockResolvedValue({ version: 1 });
      TermsAndConditions.create.mockResolvedValue({
        id: 2,
        type: "homeowner",
        version: 2,
        title: "New Terms",
        contentType: "text",
        effectiveDate: new Date(),
      });

      const response = await request(app)
        .post("/api/v1/terms")
        .set("Authorization", `Bearer ${token}`)
        .send({
          type: "homeowner",
          title: "New Terms",
          content: "New terms content",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.terms.version).toBe(2);
    });

    it("should create version 1 if no previous terms", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 1, type: "admin" });
      TermsAndConditions.findOne.mockResolvedValue(null);
      TermsAndConditions.create.mockResolvedValue({
        id: 1,
        type: "homeowner",
        version: 1,
        title: "First Terms",
        contentType: "text",
        effectiveDate: new Date(),
      });

      const response = await request(app)
        .post("/api/v1/terms")
        .set("Authorization", `Bearer ${token}`)
        .send({
          type: "homeowner",
          title: "First Terms",
          content: "First terms content",
        });

      expect(response.status).toBe(201);
      expect(response.body.terms.version).toBe(1);
    });

    it("should return 400 if missing required fields", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 1, type: "admin" });

      const response = await request(app)
        .post("/api/v1/terms")
        .set("Authorization", `Bearer ${token}`)
        .send({ type: "homeowner" });

      expect(response.status).toBe(400);
    });

    it("should return 400 for invalid type", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 1, type: "admin" });

      const response = await request(app)
        .post("/api/v1/terms")
        .set("Authorization", `Bearer ${token}`)
        .send({
          type: "invalid",
          title: "Terms",
          content: "Content",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /terms/user-acceptance/:userId (Manager only)", () => {
    it("should return user acceptance history", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "admin" }) // requireManager check
        .mockResolvedValueOnce({
          id: 2,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          type: "client",
          termsAcceptedVersion: 2,
        });

      UserTermsAcceptance.findAll.mockResolvedValue([
        {
          id: 1,
          termsId: 2,
          acceptedAt: new Date(),
          ipAddress: "192.168.1.1",
          termsContentSnapshot: "Content",
          pdfSnapshotPath: null,
          terms: {
            id: 2,
            type: "homeowner",
            version: 2,
            title: "Terms v2",
            contentType: "text",
          },
        },
      ]);

      const response = await request(app)
        .get("/api/v1/terms/user-acceptance/2")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.name).toBe("John Doe");
      expect(response.body.acceptances).toHaveLength(1);
      expect(response.body.acceptances[0].hasSnapshot).toBe(true);
    });

    it("should return 404 if user not found", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk
        .mockResolvedValueOnce({ id: 1, type: "admin" })
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .get("/api/v1/terms/user-acceptance/999")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /terms/acceptance-snapshot/:acceptanceId (Manager only)", () => {
    it("should return text snapshot content", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 1, type: "admin" });

      UserTermsAcceptance.findByPk.mockResolvedValue({
        id: 1,
        acceptedAt: new Date(),
        ipAddress: "192.168.1.1",
        termsContentSnapshot: "The exact terms content they agreed to",
        pdfSnapshotPath: null,
        terms: {
          id: 1,
          type: "homeowner",
          version: 1,
          title: "Terms v1",
          contentType: "text",
        },
        user: {
          id: 2,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        },
      });

      const response = await request(app)
        .get("/api/v1/terms/acceptance-snapshot/1")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.snapshot.content).toBe("The exact terms content they agreed to");
      expect(response.body.user.name).toBe("John Doe");
    });

    it("should return 404 if acceptance not found", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 1, type: "admin" });
      UserTermsAcceptance.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/terms/acceptance-snapshot/999")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /terms/:termsId/acceptances (Manager only)", () => {
    it("should return all acceptances for a terms version", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 1, type: "admin" });

      TermsAndConditions.findByPk.mockResolvedValue({
        id: 1,
        type: "homeowner",
        version: 1,
        title: "Terms v1",
        contentType: "text",
        effectiveDate: new Date(),
      });

      UserTermsAcceptance.findAll.mockResolvedValue([
        {
          id: 1,
          acceptedAt: new Date(),
          ipAddress: "192.168.1.1",
          termsContentSnapshot: "Content",
          user: {
            id: 2,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            type: "client",
          },
        },
        {
          id: 2,
          acceptedAt: new Date(),
          ipAddress: "192.168.1.2",
          termsContentSnapshot: "Content",
          user: {
            id: 3,
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
            type: "client",
          },
        },
      ]);

      const response = await request(app)
        .get("/api/v1/terms/1/acceptances")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.totalAcceptances).toBe(2);
      expect(response.body.acceptances).toHaveLength(2);
    });

    it("should return 404 if terms not found", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 1, type: "admin" });
      TermsAndConditions.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/terms/999/acceptances")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });
});
