/**
 * Tests for HR Application Review System
 * Tests authorization, status updates, account creation on approval, and rejection handling
 */

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock bcrypt
jest.mock("bcrypt", () => ({
  genSalt: jest.fn().mockResolvedValue("mock-salt"),
  hash: jest.fn().mockResolvedValue("hashed-password"),
}));

// Mock models
jest.mock("../../models", () => ({
  UserApplications: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    destroy: jest.fn(),
    count: jest.fn(),
  },
  User: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  UserBills: {
    create: jest.fn(),
  },
  Op: require("sequelize").Op,
}));

jest.mock("../../services/ApplicationInfoClass", () => ({
  addApplicationToDB: jest.fn(),
}));

jest.mock("../../serializers/ApplicationSerializer", () => ({
  serializeArray: jest.fn((apps) => apps),
  serializeOne: jest.fn((app) => app),
}));

jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendNewApplicationNotification: jest.fn(),
  sendEmailCongragulations: jest.fn(),
  sendApplicationRejected: jest.fn(),
  sendHRHiringNotification: jest.fn(),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNewApplication: jest.fn(),
}));

jest.mock("../../utils/passwordGenerator", () => ({
  generateSecurePassword: jest.fn().mockReturnValue("SecurePass123!"),
  generateUniqueUsername: jest.fn().mockResolvedValue("john_doe"),
}));

const { UserApplications, User, UserBills } = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");
const { generateSecurePassword, generateUniqueUsername } = require("../../utils/passwordGenerator");

describe("HR Application Review System", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  const mockOwner = {
    id: 1,
    username: "owner1",
    firstName: "Owner",
    lastName: "User",
    email: "owner@test.com",
    type: "owner",
    getNotificationEmail: jest.fn().mockReturnValue("owner@test.com"),
  };

  const mockHR = {
    id: 2,
    username: "hr_staff",
    firstName: "HR",
    lastName: "Staff",
    email: "hr@test.com",
    type: "humanResources",
  };

  const mockCleaner = {
    id: 3,
    username: "cleaner1",
    type: "cleaner",
  };

  const mockApplication = {
    id: 10,
    firstName: "John",
    lastName: "Doe",
    email: "john@test.com",
    phone: "555-1234",
    status: "pending",
    update: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    const applicationRouter = require("../../routes/api/v1/applicationRouter");
    app.use("/api/v1/applications", applicationRouter);
  });

  // ============================================
  // AUTHORIZATION TESTS
  // ============================================
  describe("Authorization", () => {
    describe("GET /all-applications", () => {
      it("should return 401 without authorization header", async () => {
        const res = await request(app).get("/api/v1/applications/all-applications");
        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Authorization token required");
      });

      it("should return 401 for invalid token", async () => {
        const res = await request(app)
          .get("/api/v1/applications/all-applications")
          .set("Authorization", "Bearer invalid-token");
        expect(res.status).toBe(401);
      });

      it("should return 403 for cleaner user", async () => {
        const token = generateToken(3);
        User.findByPk.mockResolvedValue(mockCleaner);

        const res = await request(app)
          .get("/api/v1/applications/all-applications")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe("Only owner or HR can access this resource");
      });

      it("should allow owner access", async () => {
        const token = generateToken(1);
        User.findByPk.mockResolvedValue(mockOwner);
        UserApplications.findAll.mockResolvedValue([mockApplication]);

        const res = await request(app)
          .get("/api/v1/applications/all-applications")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
      });

      it("should allow HR access", async () => {
        const token = generateToken(2);
        User.findByPk.mockResolvedValue(mockHR);
        UserApplications.findAll.mockResolvedValue([mockApplication]);

        const res = await request(app)
          .get("/api/v1/applications/all-applications")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
      });
    });
  });

  // ============================================
  // STATUS UPDATE TESTS - INTERMEDIATE STATUSES
  // ============================================
  describe("Status Updates - Intermediate", () => {
    beforeEach(() => {
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue({ ...mockApplication });
    });

    it("should update status to under_review", async () => {
      const token = generateToken(1);
      const app2 = { ...mockApplication, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(app2);

      const res = await request(app)
        .patch("/api/v1/applications/10/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "under_review" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("under_review");
      expect(app2.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "under_review",
          reviewedBy: 1,
        })
      );
    });

    it("should update status to background_check", async () => {
      const token = generateToken(1);
      const app2 = { ...mockApplication, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(app2);

      const res = await request(app)
        .patch("/api/v1/applications/10/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "background_check" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("background_check");
    });

    it("should allow HR to change status", async () => {
      const token = generateToken(2);
      User.findByPk.mockResolvedValue(mockHR);
      const app2 = { ...mockApplication, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(app2);

      const res = await request(app)
        .patch("/api/v1/applications/10/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "under_review" });

      expect(res.status).toBe(200);
      expect(app2.update).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewedBy: 2,
        })
      );
    });
  });

  // ============================================
  // APPROVAL TESTS
  // ============================================
  describe("Application Approval", () => {
    const pendingApp = {
      id: 10,
      firstName: "John",
      lastName: "Doe",
      email: "john@test.com",
      phone: "555-1234",
      status: "pending",
      update: jest.fn().mockResolvedValue(true),
    };

    const createdUser = {
      id: 100,
      username: "john_doe",
      email: "john@test.com",
      firstName: "John",
      lastName: "Doe",
    };

    beforeEach(() => {
      UserApplications.findByPk.mockResolvedValue({ ...pendingApp });
      User.create.mockResolvedValue(createdUser);
      UserBills.create.mockResolvedValue({});
      User.findAll.mockResolvedValue([mockOwner]);
      User.findOne.mockResolvedValue(null); // No existing user
    });

    it("should approve application without creating account (approval is separate from hiring)", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      const appToApprove = { ...pendingApp, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(appToApprove);

      const res = await request(app)
        .patch("/api/v1/applications/10/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Application approved");
      // User creation happens on hire, not on approval
      expect(User.create).not.toHaveBeenCalled();
    });

    it("should update application status to approved with reviewedBy", async () => {
      const token = generateToken(2);
      User.findByPk.mockResolvedValue(mockHR);
      const appToApprove = { ...pendingApp, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(appToApprove);

      await request(app)
        .patch("/api/v1/applications/10/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(appToApprove.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "approved",
          reviewedBy: 2,
        })
      );
    });

    it("should prevent changing status of hired application", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      const hiredApp = { ...pendingApp, status: "hired" };
      UserApplications.findByPk.mockResolvedValue(hiredApp);

      const res = await request(app)
        .patch("/api/v1/applications/10/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Cannot change status of hired application");
    });
  });

  // ============================================
  // HIRING TESTS (account creation happens here)
  // ============================================
  describe("Application Hiring", () => {
    const approvedApp = {
      id: 10,
      firstName: "John",
      lastName: "Doe",
      email: "john@test.com",
      phone: "555-1234",
      status: "approved",
      update: jest.fn().mockResolvedValue(true),
    };

    const createdUser = {
      id: 100,
      username: "john_doe",
      email: "john@test.com",
      firstName: "John",
      lastName: "Doe",
    };

    beforeEach(() => {
      UserApplications.findByPk.mockResolvedValue({ ...approvedApp });
      User.create.mockResolvedValue(createdUser);
      UserBills.create.mockResolvedValue({});
      User.findAll.mockResolvedValue([mockOwner]);
      User.findOne.mockResolvedValue(null); // No existing user
    });

    it("should create cleaner account on hire by owner", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      const appToHire = { ...approvedApp, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(appToHire);

      const res = await request(app)
        .post("/api/v1/applications/10/hire")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: "john_doe",
          password: "SecurePass123!",
          email: "john@test.com",
          firstName: "John",
          lastName: "Doe",
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Applicant hired and cleaner account created");
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe("john_doe");

      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "John",
          lastName: "Doe",
          email: "john@test.com",
          type: "cleaner",
        })
      );
      expect(UserBills.create).toHaveBeenCalled();
    });

    it("should send welcome email to new cleaner on hire", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      const appToHire = { ...approvedApp, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(appToHire);

      await request(app)
        .post("/api/v1/applications/10/hire")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: "john_doe",
          password: "SecurePass123!",
          email: "john@test.com",
          firstName: "John",
          lastName: "Doe",
        });

      expect(Email.sendEmailCongragulations).toHaveBeenCalledWith(
        "John",
        "Doe",
        "john_doe",
        "SecurePass123!",
        "john@test.com",
        "cleaner"
      );
    });

    it("should notify owner when HR hires", async () => {
      const token = generateToken(2);
      User.findByPk.mockResolvedValue(mockHR);
      const appToHire = { ...approvedApp, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(appToHire);

      await request(app)
        .post("/api/v1/applications/10/hire")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: "john_doe",
          password: "SecurePass123!",
          email: "john@test.com",
          firstName: "John",
          lastName: "Doe",
        });

      expect(Email.sendHRHiringNotification).toHaveBeenCalledWith(
        "owner@test.com",
        "HR Staff",
        "John Doe",
        "john@test.com",
        "hired"
      );
    });

    it("should update application with userId and reviewedBy on hire", async () => {
      const token = generateToken(2);
      User.findByPk.mockResolvedValue(mockHR);
      const appToHire = { ...approvedApp, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(appToHire);

      await request(app)
        .post("/api/v1/applications/10/hire")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: "john_doe",
          password: "SecurePass123!",
          email: "john@test.com",
          firstName: "John",
          lastName: "Doe",
        });

      expect(appToHire.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "hired",
          userId: 100,
          reviewedBy: 2,
        })
      );
    });

    it("should prevent re-hiring already hired application", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      const hiredApp = { ...approvedApp, status: "hired" };
      UserApplications.findByPk.mockResolvedValue(hiredApp);

      const res = await request(app)
        .post("/api/v1/applications/10/hire")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: "john_doe",
          password: "SecurePass123!",
          email: "john@test.com",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Application has already been hired");
    });
  });

  // ============================================
  // REJECTION TESTS
  // ============================================
  describe("Application Rejection", () => {
    const pendingApp = {
      id: 10,
      firstName: "John",
      lastName: "Doe",
      email: "john@test.com",
      status: "pending",
      update: jest.fn().mockResolvedValue(true),
    };

    beforeEach(() => {
      User.findAll.mockResolvedValue([mockOwner]);
    });

    it("should reject application by owner", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      const appToReject = { ...pendingApp, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(appToReject);

      const res = await request(app)
        .patch("/api/v1/applications/10/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "rejected" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Application rejected");
    });

    it("should store rejection reason", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      const appToReject = { ...pendingApp, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(appToReject);

      await request(app)
        .patch("/api/v1/applications/10/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "rejected", rejectionReason: "Insufficient experience" });

      expect(appToReject.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "rejected",
          rejectionReason: "Insufficient experience",
        })
      );
    });

    it("should send rejection email to applicant", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      const appToReject = { ...pendingApp, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(appToReject);

      await request(app)
        .patch("/api/v1/applications/10/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "rejected", rejectionReason: "Not qualified" });

      expect(Email.sendApplicationRejected).toHaveBeenCalledWith(
        "john@test.com",
        "John",
        "Doe",
        "Not qualified"
      );
    });

    it("should notify owner when HR rejects", async () => {
      const token = generateToken(2);
      User.findByPk.mockResolvedValue(mockHR);
      const appToReject = { ...pendingApp, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(appToReject);

      await request(app)
        .patch("/api/v1/applications/10/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "rejected", rejectionReason: "Background check failed" });

      expect(Email.sendHRHiringNotification).toHaveBeenCalledWith(
        "owner@test.com",
        "HR Staff",
        "John Doe",
        "john@test.com",
        "rejected",
        "Background check failed"
      );
    });

    it("should allow rejection without reason", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      const appToReject = { ...pendingApp, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(appToReject);

      const res = await request(app)
        .patch("/api/v1/applications/10/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "rejected" });

      expect(res.status).toBe(200);
      expect(appToReject.update).toHaveBeenCalledWith(
        expect.objectContaining({
          rejectionReason: null,
        })
      );
    });

    it("should reject application at any stage except approved", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      const underReviewApp = { ...pendingApp, status: "under_review", update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(underReviewApp);

      const res = await request(app)
        .patch("/api/v1/applications/10/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "rejected" });

      expect(res.status).toBe(200);
    });
  });

  // ============================================
  // ADMIN NOTES TESTS
  // ============================================
  describe("Admin Notes", () => {
    it("should allow HR to add notes", async () => {
      const token = generateToken(2);
      User.findByPk.mockResolvedValue(mockHR);
      const appWithNotes = { ...mockApplication, update: jest.fn().mockResolvedValue(true) };
      UserApplications.findByPk.mockResolvedValue(appWithNotes);

      const res = await request(app)
        .patch("/api/v1/applications/10/notes")
        .set("Authorization", `Bearer ${token}`)
        .send({ adminNotes: "Schedule interview for next week" });

      expect(res.status).toBe(200);
      expect(appWithNotes.update).toHaveBeenCalledWith({
        adminNotes: "Schedule interview for next week",
      });
    });

    it("should return 401 without auth for notes", async () => {
      const res = await request(app)
        .patch("/api/v1/applications/10/notes")
        .send({ adminNotes: "Test" });

      expect(res.status).toBe(401);
    });
  });

  // ============================================
  // DELETE TESTS
  // ============================================
  describe("Delete Application", () => {
    it("should allow HR to delete application", async () => {
      const token = generateToken(2);
      User.findByPk.mockResolvedValue(mockHR);
      UserApplications.findByPk.mockResolvedValue(mockApplication);
      UserApplications.destroy.mockResolvedValue(1);

      const res = await request(app)
        .delete("/api/v1/applications/10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Application deleted successfully");
    });

    it("should return 404 for non-existent application", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/v1/applications/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // ============================================
  // GET SINGLE APPLICATION TESTS
  // ============================================
  describe("Get Single Application", () => {
    it("should allow HR to view single application", async () => {
      const token = generateToken(2);
      User.findByPk.mockResolvedValue(mockHR);
      UserApplications.findByPk.mockResolvedValue(mockApplication);

      const res = await request(app)
        .get("/api/v1/applications/10")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.application).toBeDefined();
    });

    it("should return 404 for non-existent application", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/applications/999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // ============================================
  // VALIDATION TESTS
  // ============================================
  describe("Validation", () => {
    it("should return 400 for invalid status value", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);

      const res = await request(app)
        .patch("/api/v1/applications/10/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "invalid_status" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid status value");
    });

    it("should return 404 for non-existent application on status update", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .patch("/api/v1/applications/999/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Application not found");
    });
  });
});
