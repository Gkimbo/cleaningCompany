const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

const secretKey = process.env.SESSION_SECRET || "test-secret";

// Mock models
jest.mock("../../models", () => ({
  UserApplications: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    destroy: jest.fn(),
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
  Op: {
    or: Symbol("or"),
  },
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
  sendHRHiringNotification: jest.fn(),
}));

const { UserApplications, User, UserBills } = require("../../models");
const ApplicationInfoClass = require("../../services/ApplicationInfoClass");
const Email = require("../../services/sendNotifications/EmailClass");

const applicationRouter = require("../../routes/api/v1/applicationRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/applications", applicationRouter);

// Helper to generate token
const generateToken = (userId) => {
  return jwt.sign({ userId }, secretKey);
};

// Mock owner user for authentication
const mockOwner = {
  id: 1,
  username: "owner1",
  type: "owner",
};

describe("Application Router", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validApplicationData = {
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@test.com",
    phone: "555-123-4567",
    dateOfBirth: "1990-01-15",
    streetAddress: "123 Main St",
    city: "Boston",
    state: "MA",
    zipCode: "02101",
    ssnLast4: "1234",
    driversLicenseNumber: "DL12345",
    driversLicenseState: "MA",
    idPhoto: "base64photodata",
    isAuthorizedToWork: true,
    hasValidDriversLicense: true,
    hasReliableTransportation: true,
    experience: "3 years professional cleaning",
    previousEmployer: "ABC Cleaning Co",
    previousEmployerPhone: "555-987-6543",
    previousEmploymentDuration: "2 years",
    reasonForLeaving: "Looking for better opportunity",
    references: [
      { name: "Jane Smith", phone: "555-111-2222", relationship: "Former supervisor" },
    ],
    hasCriminalHistory: false,
    criminalHistoryExplanation: "",
    emergencyContactName: "Mary Doe",
    emergencyContactPhone: "555-333-4444",
    emergencyContactRelation: "Spouse",
    availableStartDate: "2025-02-01",
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    message: "I am very excited to join your team!",
    backgroundConsent: true,
    drugTestConsent: true,
    referenceCheckConsent: true,
  };

  describe("POST /submitted", () => {
    it("should submit a new application successfully", async () => {
      ApplicationInfoClass.addApplicationToDB.mockResolvedValue({
        id: 1,
        ...validApplicationData,
        status: "pending",
      });
      User.findAll.mockResolvedValue([]);

      const response = await request(app)
        .post("/api/v1/applications/submitted")
        .send(validApplicationData);

      expect(response.status).toBe(201);
      expect(response.body.applicationInfo).toBeDefined();
      expect(ApplicationInfoClass.addApplicationToDB).toHaveBeenCalled();
    });

    it("should notify owners about new application", async () => {
      ApplicationInfoClass.addApplicationToDB.mockResolvedValue({
        id: 1,
        ...validApplicationData,
      });
      const mockOwner = {
        id: 1,
        email: "owner@test.com",
        notificationEmail: null,
        notifications: [],
        update: jest.fn(),
        getNotificationEmail: function () {
          return this.notificationEmail || this.email;
        },
      };
      User.findAll.mockResolvedValue([mockOwner]);

      const response = await request(app)
        .post("/api/v1/applications/submitted")
        .send(validApplicationData);

      expect(response.status).toBe(201);
      expect(Email.sendNewApplicationNotification).toHaveBeenCalled();
    });

    it("should handle database error", async () => {
      ApplicationInfoClass.addApplicationToDB.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app)
        .post("/api/v1/applications/submitted")
        .send(validApplicationData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to connect to database");
    });

    it("should continue if notification fails", async () => {
      ApplicationInfoClass.addApplicationToDB.mockResolvedValue({
        id: 1,
        ...validApplicationData,
      });
      User.findAll.mockRejectedValue(new Error("Notification error"));

      const response = await request(app)
        .post("/api/v1/applications/submitted")
        .send(validApplicationData);

      // Should still succeed even if notifications fail
      expect(response.status).toBe(201);
    });
  });

  describe("GET /all-applications", () => {
    it("should return all applications", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      const mockApplications = [
        { id: 1, firstName: "John", lastName: "Doe", status: "pending" },
        { id: 2, firstName: "Jane", lastName: "Smith", status: "approved" },
      ];
      UserApplications.findAll.mockResolvedValue(mockApplications);

      const response = await request(app)
        .get("/api/v1/applications/all-applications")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.serializedApplications).toHaveLength(2);
    });

    it("should return empty array when no applications", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/applications/all-applications")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.serializedApplications).toHaveLength(0);
    });

    it("should handle database error", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findAll.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .get("/api/v1/applications/all-applications")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to fetch applications");
    });
  });

  describe("GET /:id", () => {
    it("should return a specific application", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      const mockApplication = {
        id: 1,
        firstName: "John",
        lastName: "Doe",
        status: "pending",
      };
      UserApplications.findByPk.mockResolvedValue(mockApplication);

      const response = await request(app)
        .get("/api/v1/applications/1")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.application).toEqual(mockApplication);
    });

    it("should return 404 for non-existent application", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/applications/999")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Application not found");
    });

    it("should handle database error", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .get("/api/v1/applications/1")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to fetch application");
    });
  });

  describe("DELETE /:id", () => {
    it("should delete an application successfully", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue({ id: 1 });
      UserApplications.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete("/api/v1/applications/1")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Application deleted successfully");
      expect(UserApplications.destroy).toHaveBeenCalledWith({ where: { id: "1" } });
    });

    it("should handle database error", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue({ id: 1 });
      UserApplications.destroy.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .delete("/api/v1/applications/1")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to delete application");
    });
  });

  describe("PATCH /:id/status", () => {
    const mockApplication = {
      id: 1,
      status: "pending",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      update: jest.fn(),
    };

    beforeEach(() => {
      mockApplication.update.mockReset();
      mockApplication.update.mockResolvedValue(true);
    });

    it("should update status to under_review", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue(mockApplication);

      const response = await request(app)
        .patch("/api/v1/applications/1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "under_review" });

      expect(response.status).toBe(200);
    });

    it("should update status to background_check", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue(mockApplication);

      const response = await request(app)
        .patch("/api/v1/applications/1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "background_check" });

      expect(response.status).toBe(200);
    });

    it("should return 400 for invalid status", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);

      const response = await request(app)
        .patch("/api/v1/applications/1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "invalid_status" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid status value");
    });

    it("should return 404 for non-existent application", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .patch("/api/v1/applications/999/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "under_review" });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Application not found");
    });

    it("should handle database error", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      mockApplication.update.mockRejectedValue(new Error("Database error"));
      UserApplications.findByPk.mockResolvedValue(mockApplication);

      const response = await request(app)
        .patch("/api/v1/applications/1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "under_review" });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to update status");
    });
  });

  describe("PATCH /:id/notes", () => {
    const mockApplication = {
      id: 1,
      adminNotes: "",
      update: jest.fn(),
    };

    beforeEach(() => {
      mockApplication.update.mockReset();
      mockApplication.update.mockResolvedValue(true);
    });

    it("should update admin notes successfully", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue(mockApplication);

      const response = await request(app)
        .patch("/api/v1/applications/1/notes")
        .set("Authorization", `Bearer ${token}`)
        .send({ adminNotes: "Great candidate, schedule interview" });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Notes updated successfully");
      expect(mockApplication.update).toHaveBeenCalledWith({
        adminNotes: "Great candidate, schedule interview",
      });
    });

    it("should return 404 for non-existent application", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .patch("/api/v1/applications/999/notes")
        .set("Authorization", `Bearer ${token}`)
        .send({ adminNotes: "Some notes" });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Application not found");
    });

    it("should handle database error", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue(mockApplication);
      mockApplication.update.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .patch("/api/v1/applications/1/notes")
        .set("Authorization", `Bearer ${token}`)
        .send({ adminNotes: "Some notes" });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to update notes");
    });

    it("should allow empty notes", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue(mockApplication);

      const response = await request(app)
        .patch("/api/v1/applications/1/notes")
        .set("Authorization", `Bearer ${token}`)
        .send({ adminNotes: "" });

      expect(response.status).toBe(200);
    });
  });

  describe("POST /:id/hire", () => {
    const mockApplication = {
      id: 1,
      status: "approved",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "555-123-4567",
      update: jest.fn(),
    };

    const hireData = {
      username: "johnd",
      password: "SecurePass123!",
      email: "john@example.com",
      firstName: "John",
      lastName: "Doe",
      phone: "555-123-4567",
    };

    beforeEach(() => {
      mockApplication.update.mockReset();
      mockApplication.update.mockResolvedValue(true);
      mockApplication.status = "approved";
    });

    it("should hire an applicant successfully", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      User.findOne.mockResolvedValue(null); // No existing user
      User.create.mockResolvedValue({
        id: 10,
        ...hireData,
        type: "cleaner",
      });
      UserBills.create.mockResolvedValue({ id: 1 });
      UserApplications.findByPk.mockResolvedValue(mockApplication);

      const response = await request(app)
        .post("/api/v1/applications/1/hire")
        .set("Authorization", `Bearer ${token}`)
        .send(hireData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Applicant hired and cleaner account created");
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe("johnd");
      expect(User.create).toHaveBeenCalled();
      expect(UserBills.create).toHaveBeenCalled();
      expect(Email.sendEmailCongragulations).toHaveBeenCalled();
    });

    it("should return 409 if email already exists", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      User.findOne.mockImplementation(({ where }) => {
        if (where.email) return { id: 5, email: "john@example.com" };
        return null;
      });
      UserApplications.findByPk.mockResolvedValue(mockApplication);

      const response = await request(app)
        .post("/api/v1/applications/1/hire")
        .set("Authorization", `Bearer ${token}`)
        .send(hireData);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("An account already has this email");
    });

    it("should return 410 if username already exists", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      User.findOne.mockImplementation(({ where }) => {
        if (where.email) return null;
        if (where.username) return { id: 5, username: "johnd" };
        return null;
      });
      UserApplications.findByPk.mockResolvedValue(mockApplication);

      const response = await request(app)
        .post("/api/v1/applications/1/hire")
        .set("Authorization", `Bearer ${token}`)
        .send(hireData);

      expect(response.status).toBe(410);
      expect(response.body.error).toBe("Username already exists");
    });

    it("should return 400 if application already hired", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      const hiredApplication = { ...mockApplication, status: "hired" };
      UserApplications.findByPk.mockResolvedValue(hiredApplication);

      const response = await request(app)
        .post("/api/v1/applications/1/hire")
        .set("Authorization", `Bearer ${token}`)
        .send(hireData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Application has already been hired");
    });

    it("should return 404 for non-existent application", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/applications/999/hire")
        .set("Authorization", `Bearer ${token}`)
        .send(hireData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Application not found");
    });

    it("should return 401 without authorization", async () => {
      const response = await request(app)
        .post("/api/v1/applications/1/hire")
        .send(hireData);

      expect(response.status).toBe(401);
    });

    it("should return 403 for non-owner/HR users", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue({ id: 1, type: "cleaner" });

      const response = await request(app)
        .post("/api/v1/applications/1/hire")
        .set("Authorization", `Bearer ${token}`)
        .send(hireData);

      expect(response.status).toBe(403);
    });
  });

  describe("PATCH /:id/status - hired status prevention", () => {
    const mockHiredApplication = {
      id: 1,
      status: "hired",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      update: jest.fn(),
    };

    it("should return 400 when trying to change status of hired application", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue(mockHiredApplication);

      const response = await request(app)
        .patch("/api/v1/applications/1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "pending" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Cannot change status of hired application");
    });

    it("should allow hired as a valid status value", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      const pendingApplication = {
        id: 1,
        status: "pending",
        update: jest.fn().mockResolvedValue(true),
      };
      UserApplications.findByPk.mockResolvedValue(pendingApplication);

      const response = await request(app)
        .patch("/api/v1/applications/1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "hired" });

      // hired is now a valid status, but typically set via /hire endpoint
      expect(response.status).toBe(200);
    });
  });

  describe("PATCH /:id/status - approved status (no account creation)", () => {
    const mockApplication = {
      id: 1,
      status: "pending",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      update: jest.fn(),
    };

    beforeEach(() => {
      mockApplication.update.mockReset();
      mockApplication.update.mockResolvedValue(true);
    });

    it("should update status to approved without creating account", async () => {
      const token = generateToken(1);
      User.findByPk.mockResolvedValue(mockOwner);
      UserApplications.findByPk.mockResolvedValue(mockApplication);

      const response = await request(app)
        .patch("/api/v1/applications/1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Application approved");
      // Should NOT create a user account
      expect(User.create).not.toHaveBeenCalled();
      expect(UserBills.create).not.toHaveBeenCalled();
      expect(Email.sendEmailCongragulations).not.toHaveBeenCalled();
    });
  });
});
