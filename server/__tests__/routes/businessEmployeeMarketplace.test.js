/**
 * Business Employee Marketplace Routes Tests
 * Tests for checklist, photos, and completion status endpoints
 */

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock sequelize
jest.mock("sequelize", () => ({
  Op: {
    ne: Symbol("ne"),
    notIn: Symbol("notIn"),
    in: Symbol("in"),
  },
  Sequelize: {
    Op: {
      ne: Symbol("ne"),
      notIn: Symbol("notIn"),
      in: Symbol("in"),
    },
  },
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  BusinessEmployee: {
    findOne: jest.fn(),
  },
  EmployeeJobAssignment: {
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  JobPhoto: {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
  },
  UserAppointments: {},
  UserHomes: {},
  sequelize: {
    Sequelize: {
      Op: {
        ne: Symbol("ne"),
        notIn: Symbol("notIn"),
        in: Symbol("in"),
      },
    },
  },
}));

// Mock services
jest.mock("../../services/MarketplaceJobRequirementsService", () => ({
  getPublishedChecklist: jest.fn(),
  markChecklistItemComplete: jest.fn(),
  markChecklistItemIncomplete: jest.fn(),
  bulkUpdateChecklistProgress: jest.fn(),
  updatePhotoCounts: jest.fn(),
  getCompletionStatus: jest.fn(),
}));

jest.mock("../../services/BusinessEmployeeService");
jest.mock("../../services/EmployeeJobAssignmentService");
jest.mock("../../serializers/BusinessEmployeeSerializer");
jest.mock("../../serializers/EmployeeJobAssignmentSerializer");

const {
  User,
  BusinessEmployee,
  EmployeeJobAssignment,
  JobPhoto,
} = require("../../models");

const MarketplaceJobRequirementsService = require("../../services/MarketplaceJobRequirementsService");

// Set up express app with the router
const businessEmployeeRouter = require("../../routes/api/v1/businessEmployeeRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/business-employee", businessEmployeeRouter);

describe("Business Employee Marketplace Routes", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";

  // Mock employee user
  const employeeUser = {
    id: 5,
    employeeOfBusinessId: 10,
    accountFrozen: false,
  };

  const employeeRecord = {
    id: 1,
    userId: 5,
    businessOwnerId: 10,
    status: "active",
    firstName: "John",
    lastName: "Doe",
    canViewClientDetails: true,
  };

  const employeeToken = jwt.sign({ userId: 5 }, secretKey);

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock setup for authenticated employee
    User.findByPk.mockResolvedValue(employeeUser);
    BusinessEmployee.findOne.mockResolvedValue(employeeRecord);
  });

  describe("GET /my-jobs/:assignmentId/checklist", () => {
    it("should return checklist and progress for assigned job", async () => {
      const mockAssignment = {
        id: 1,
        businessEmployeeId: 1,
        isMarketplacePickup: true,
        checklistProgress: { kitchen: { total: ["k1"], completed: ["k1"] } },
        checklistCompleted: true,
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      const mockChecklist = {
        sections: [
          { id: "kitchen", name: "Kitchen", items: [{ id: "k1", name: "Clean counters" }] },
        ],
      };
      MarketplaceJobRequirementsService.getPublishedChecklist.mockResolvedValue(mockChecklist);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1/checklist")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.checklist).toEqual(mockChecklist);
      expect(response.body.progress).toEqual(mockAssignment.checklistProgress);
      expect(response.body.checklistCompleted).toBe(true);
      expect(response.body.isMarketplacePickup).toBe(true);
    });

    it("should return 404 for unassigned job", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/999/checklist")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Assignment not found");
    });

    it("should return 401 without token", async () => {
      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1/checklist");

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /my-jobs/:assignmentId/checklist", () => {
    it("should mark checklist item as complete", async () => {
      const mockAssignment = {
        id: 1,
        businessEmployeeId: 1,
        status: "started",
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      MarketplaceJobRequirementsService.markChecklistItemComplete.mockResolvedValue({
        checklistProgress: { kitchen: { total: ["k1"], completed: ["k1"] } },
        checklistCompleted: true,
      });

      const response = await request(app)
        .put("/api/v1/business-employee/my-jobs/1/checklist")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          sectionId: "kitchen",
          itemId: "k1",
          completed: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Checklist updated");
      expect(MarketplaceJobRequirementsService.markChecklistItemComplete).toHaveBeenCalledWith(
        1,
        "kitchen",
        "k1"
      );
    });

    it("should mark checklist item as incomplete", async () => {
      const mockAssignment = {
        id: 1,
        businessEmployeeId: 1,
        status: "started",
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      MarketplaceJobRequirementsService.markChecklistItemIncomplete.mockResolvedValue({
        checklistProgress: { kitchen: { total: ["k1"], completed: [] } },
        checklistCompleted: false,
      });

      const response = await request(app)
        .put("/api/v1/business-employee/my-jobs/1/checklist")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          sectionId: "kitchen",
          itemId: "k1",
          completed: false,
        });

      expect(response.status).toBe(200);
      expect(MarketplaceJobRequirementsService.markChecklistItemIncomplete).toHaveBeenCalled();
    });

    it("should return 404 for completed job", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(null);

      const response = await request(app)
        .put("/api/v1/business-employee/my-jobs/1/checklist")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          sectionId: "kitchen",
          itemId: "k1",
          completed: true,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("not found");
    });
  });

  describe("PUT /my-jobs/:assignmentId/checklist/bulk", () => {
    it("should bulk update checklist items", async () => {
      const mockAssignment = {
        id: 1,
        businessEmployeeId: 1,
        status: "started",
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      MarketplaceJobRequirementsService.bulkUpdateChecklistProgress.mockResolvedValue({
        checklistProgress: {
          kitchen: { total: ["k1", "k2"], completed: ["k1", "k2"] },
        },
        checklistCompleted: true,
      });

      const response = await request(app)
        .put("/api/v1/business-employee/my-jobs/1/checklist/bulk")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          updates: {
            kitchen: [
              { itemId: "k1", completed: true },
              { itemId: "k2", completed: true },
            ],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.checklistCompleted).toBe(true);
    });

    it("should return 404 for unassigned job", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(null);

      const response = await request(app)
        .put("/api/v1/business-employee/my-jobs/999/checklist/bulk")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ updates: {} });

      expect(response.status).toBe(404);
    });
  });

  describe("POST /my-jobs/:assignmentId/photos", () => {
    it("should upload before photo successfully", async () => {
      const mockAssignment = {
        id: 1,
        businessEmployeeId: 1,
        appointmentId: 100,
        status: "started",
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      JobPhoto.create.mockResolvedValue({
        id: 1,
        photoType: "before",
        room: "Kitchen",
        takenAt: new Date(),
      });

      MarketplaceJobRequirementsService.updatePhotoCounts.mockResolvedValue({
        beforePhotoCount: 1,
        afterPhotoCount: 0,
        photosCompleted: false,
      });

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/photos")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          photoType: "before",
          photoData: "base64encodeddata",
          room: "Kitchen",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.beforePhotoCount).toBe(1);
    });

    it("should require before photos before after photos", async () => {
      const mockAssignment = {
        id: 1,
        businessEmployeeId: 1,
        appointmentId: 100,
        status: "started",
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      JobPhoto.count.mockResolvedValue(0); // No before photos

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/photos")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          photoType: "after",
          photoData: "base64encodeddata",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("before photos first");
    });

    it("should allow after photos when before photos exist", async () => {
      const mockAssignment = {
        id: 1,
        businessEmployeeId: 1,
        appointmentId: 100,
        status: "started",
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      JobPhoto.count.mockResolvedValue(2); // Has before photos

      JobPhoto.create.mockResolvedValue({
        id: 2,
        photoType: "after",
        takenAt: new Date(),
      });

      MarketplaceJobRequirementsService.updatePhotoCounts.mockResolvedValue({
        beforePhotoCount: 2,
        afterPhotoCount: 1,
        photosCompleted: true,
      });

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/photos")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          photoType: "after",
          photoData: "base64encodeddata",
        });

      expect(response.status).toBe(201);
      expect(response.body.photosCompleted).toBe(true);
    });

    it("should return 400 for missing required fields", async () => {
      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/photos")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("required");
    });

    it("should return 400 for invalid photoType", async () => {
      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/1/photos")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          photoType: "invalid",
          photoData: "data",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("before");
    });

    it("should return 404 for unassigned job", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/business-employee/my-jobs/999/photos")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          photoType: "before",
          photoData: "data",
        });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /my-jobs/:assignmentId/photos", () => {
    it("should return photos grouped by type", async () => {
      const mockAssignment = {
        id: 1,
        businessEmployeeId: 1,
        appointmentId: 100,
        photosCompleted: true,
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      JobPhoto.findAll.mockResolvedValue([
        { id: 1, photoType: "before", photoData: "data1", room: "Kitchen", takenAt: new Date() },
        { id: 2, photoType: "before", photoData: "data2", room: "Bathroom", takenAt: new Date() },
        { id: 3, photoType: "after", photoData: "data3", room: "Kitchen", takenAt: new Date() },
      ]);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1/photos")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.beforePhotos).toHaveLength(2);
      expect(response.body.afterPhotos).toHaveLength(1);
      expect(response.body.beforePhotoCount).toBe(2);
      expect(response.body.afterPhotoCount).toBe(1);
      expect(response.body.photosCompleted).toBe(true);
    });

    it("should return 404 for unassigned job", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/999/photos")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /my-jobs/:assignmentId/photos/:photoId", () => {
    it("should delete own photo successfully", async () => {
      const mockAssignment = {
        id: 1,
        businessEmployeeId: 1,
        appointmentId: 100,
        status: "started",
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      const mockPhoto = {
        id: 1,
        cleanerId: 5,
        appointmentId: 100,
        destroy: jest.fn(),
      };
      JobPhoto.findOne.mockResolvedValue(mockPhoto);

      MarketplaceJobRequirementsService.updatePhotoCounts.mockResolvedValue({
        beforePhotoCount: 0,
        afterPhotoCount: 0,
        photosCompleted: false,
      });

      const response = await request(app)
        .delete("/api/v1/business-employee/my-jobs/1/photos/1")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockPhoto.destroy).toHaveBeenCalled();
    });

    it("should return 404 for non-existent photo", async () => {
      const mockAssignment = {
        id: 1,
        businessEmployeeId: 1,
        appointmentId: 100,
        status: "started",
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);
      JobPhoto.findOne.mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/v1/business-employee/my-jobs/1/photos/999")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Photo not found");
    });

    it("should return 404 for completed job", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/v1/business-employee/my-jobs/1/photos/1")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /my-jobs/:assignmentId/completion-status", () => {
    it("should return completion status for marketplace job", async () => {
      const mockAssignment = {
        id: 1,
        businessEmployeeId: 1,
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      MarketplaceJobRequirementsService.getCompletionStatus.mockResolvedValue({
        assignmentId: 1,
        isMarketplacePickup: true,
        status: "started",
        canComplete: false,
        requirements: {
          required: true,
          missing: ["checklist", "after_photos"],
          checklistCompleted: false,
          beforePhotoCount: 2,
          afterPhotoCount: 0,
          photosCompleted: false,
        },
      });

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1/completion-status")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.isMarketplacePickup).toBe(true);
      expect(response.body.canComplete).toBe(false);
      expect(response.body.requirements.missing).toContain("checklist");
      expect(response.body.requirements.missing).toContain("after_photos");
    });

    it("should show job can complete when all requirements met", async () => {
      const mockAssignment = {
        id: 1,
        businessEmployeeId: 1,
      };
      EmployeeJobAssignment.findOne.mockResolvedValue(mockAssignment);

      MarketplaceJobRequirementsService.getCompletionStatus.mockResolvedValue({
        assignmentId: 1,
        isMarketplacePickup: true,
        status: "started",
        canComplete: true,
        requirements: {
          required: true,
          missing: [],
          checklistCompleted: true,
          beforePhotoCount: 3,
          afterPhotoCount: 3,
          photosCompleted: true,
        },
      });

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1/completion-status")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.canComplete).toBe(true);
      expect(response.body.requirements.missing).toHaveLength(0);
    });

    it("should return 404 for unassigned job", async () => {
      EmployeeJobAssignment.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/999/completion-status")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("Authentication", () => {
    it("should return 401 for missing token", async () => {
      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1/checklist");

      expect(response.status).toBe(401);
    });

    it("should return 401 for invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1/checklist")
        .set("Authorization", "Bearer invalid_token");

      expect(response.status).toBe(401);
    });

    it("should return 403 for non-employee user", async () => {
      User.findByPk.mockResolvedValue({
        id: 5,
        employeeOfBusinessId: null, // Not an employee
        accountFrozen: false,
      });

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1/checklist")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("employee access");
    });

    it("should return 403 for frozen account", async () => {
      User.findByPk.mockResolvedValue({
        id: 5,
        employeeOfBusinessId: 10,
        accountFrozen: true,
      });

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1/checklist")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("suspended");
    });

    it("should return 403 for inactive employee", async () => {
      User.findByPk.mockResolvedValue(employeeUser);
      BusinessEmployee.findOne.mockResolvedValue(null); // No active employee record

      const response = await request(app)
        .get("/api/v1/business-employee/my-jobs/1/checklist")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("not found or inactive");
    });
  });
});
