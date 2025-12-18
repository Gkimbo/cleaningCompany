const express = require("express");
const request = require("supertest");

// Mock models
jest.mock("../../models", () => ({
  UserApplications: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    destroy: jest.fn(),
  },
  User: {
    findAll: jest.fn(),
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
}));

jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendNewApplicationNotification: jest.fn(),
}));

const { UserApplications, User } = require("../../models");
const ApplicationInfoClass = require("../../services/ApplicationInfoClass");
const Email = require("../../services/sendNotifications/EmailClass");

const applicationRouter = require("../../routes/api/v1/applicationRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/applications", applicationRouter);

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

    it("should notify managers about new application", async () => {
      ApplicationInfoClass.addApplicationToDB.mockResolvedValue({
        id: 1,
        ...validApplicationData,
      });
      User.findAll.mockResolvedValue([
        {
          id: 1,
          email: "manager@test.com",
          notifications: [],
          update: jest.fn(),
        },
      ]);

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
      const mockApplications = [
        { id: 1, firstName: "John", lastName: "Doe", status: "pending" },
        { id: 2, firstName: "Jane", lastName: "Smith", status: "approved" },
      ];
      UserApplications.findAll.mockResolvedValue(mockApplications);

      const response = await request(app).get("/api/v1/applications/all-applications");

      expect(response.status).toBe(200);
      expect(response.body.serializedApplications).toHaveLength(2);
    });

    it("should return empty array when no applications", async () => {
      UserApplications.findAll.mockResolvedValue([]);

      const response = await request(app).get("/api/v1/applications/all-applications");

      expect(response.status).toBe(200);
      expect(response.body.serializedApplications).toHaveLength(0);
    });

    it("should handle database error", async () => {
      UserApplications.findAll.mockRejectedValue(new Error("Database error"));

      const response = await request(app).get("/api/v1/applications/all-applications");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to fetch applications");
    });
  });

  describe("GET /:id", () => {
    it("should return a specific application", async () => {
      const mockApplication = {
        id: 1,
        firstName: "John",
        lastName: "Doe",
        status: "pending",
      };
      UserApplications.findByPk.mockResolvedValue(mockApplication);

      const response = await request(app).get("/api/v1/applications/1");

      expect(response.status).toBe(200);
      expect(response.body.application).toEqual(mockApplication);
    });

    it("should return 404 for non-existent application", async () => {
      UserApplications.findByPk.mockResolvedValue(null);

      const response = await request(app).get("/api/v1/applications/999");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Application not found");
    });

    it("should handle database error", async () => {
      UserApplications.findByPk.mockRejectedValue(new Error("Database error"));

      const response = await request(app).get("/api/v1/applications/1");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to fetch application");
    });
  });

  describe("DELETE /:id", () => {
    it("should delete an application successfully", async () => {
      UserApplications.destroy.mockResolvedValue(1);

      const response = await request(app).delete("/api/v1/applications/1");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Application deleted successfully");
      expect(UserApplications.destroy).toHaveBeenCalledWith({ where: { id: "1" } });
    });

    it("should handle database error", async () => {
      UserApplications.destroy.mockRejectedValue(new Error("Database error"));

      const response = await request(app).delete("/api/v1/applications/1");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to delete application");
    });
  });

  describe("PATCH /:id/status", () => {
    const mockApplication = {
      id: 1,
      status: "pending",
      update: jest.fn(),
    };

    beforeEach(() => {
      UserApplications.findByPk.mockResolvedValue(mockApplication);
    });

    it("should update status to approved", async () => {
      const response = await request(app)
        .patch("/api/v1/applications/1/status")
        .send({ status: "approved" });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("approved");
      expect(mockApplication.update).toHaveBeenCalledWith({ status: "approved" });
    });

    it("should update status to rejected", async () => {
      const response = await request(app)
        .patch("/api/v1/applications/1/status")
        .send({ status: "rejected" });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("rejected");
    });

    it("should update status to under_review", async () => {
      const response = await request(app)
        .patch("/api/v1/applications/1/status")
        .send({ status: "under_review" });

      expect(response.status).toBe(200);
    });

    it("should update status to background_check", async () => {
      const response = await request(app)
        .patch("/api/v1/applications/1/status")
        .send({ status: "background_check" });

      expect(response.status).toBe(200);
    });

    it("should return 400 for invalid status", async () => {
      const response = await request(app)
        .patch("/api/v1/applications/1/status")
        .send({ status: "invalid_status" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid status value");
    });

    it("should return 404 for non-existent application", async () => {
      UserApplications.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .patch("/api/v1/applications/999/status")
        .send({ status: "approved" });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Application not found");
    });

    it("should handle database error", async () => {
      mockApplication.update.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .patch("/api/v1/applications/1/status")
        .send({ status: "approved" });

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
      UserApplications.findByPk.mockResolvedValue(mockApplication);
    });

    it("should update admin notes successfully", async () => {
      const response = await request(app)
        .patch("/api/v1/applications/1/notes")
        .send({ adminNotes: "Great candidate, schedule interview" });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Notes updated successfully");
      expect(mockApplication.update).toHaveBeenCalledWith({
        adminNotes: "Great candidate, schedule interview",
      });
    });

    it("should return 404 for non-existent application", async () => {
      UserApplications.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .patch("/api/v1/applications/999/notes")
        .send({ adminNotes: "Some notes" });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Application not found");
    });

    it("should handle database error", async () => {
      mockApplication.update.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .patch("/api/v1/applications/1/notes")
        .send({ adminNotes: "Some notes" });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to update notes");
    });

    it("should allow empty notes", async () => {
      const response = await request(app)
        .patch("/api/v1/applications/1/notes")
        .send({ adminNotes: "" });

      expect(response.status).toBe(200);
    });
  });
});
