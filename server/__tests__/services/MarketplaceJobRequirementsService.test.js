/**
 * MarketplaceJobRequirementsService Tests
 */

// Mock models
jest.mock("../../models", () => ({
  EmployeeJobAssignment: {
    findByPk: jest.fn(),
  },
  JobPhoto: {
    count: jest.fn(),
  },
  UserAppointments: {},
  ChecklistVersion: {
    findOne: jest.fn(),
  },
  CleanerClient: {
    findOne: jest.fn(),
  },
  sequelize: {},
}));

const {
  EmployeeJobAssignment,
  JobPhoto,
  ChecklistVersion,
  CleanerClient,
} = require("../../models");

const MarketplaceJobRequirementsService = require("../../services/MarketplaceJobRequirementsService");

describe("MarketplaceJobRequirementsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isMarketplaceJob", () => {
    it("should return true when job is not from own client and not booked by self", async () => {
      CleanerClient.findOne.mockResolvedValue(null);
      const appointment = { userId: 10, bookedByCleanerId: null };
      const businessOwnerId = 1;

      const result = await MarketplaceJobRequirementsService.isMarketplaceJob(
        appointment,
        businessOwnerId
      );

      expect(result).toBe(true);
      expect(CleanerClient.findOne).toHaveBeenCalledWith({
        where: {
          cleanerId: businessOwnerId,
          clientId: appointment.userId,
          status: "active",
        },
      });
    });

    it("should return false when job is from own client", async () => {
      CleanerClient.findOne.mockResolvedValue({ id: 1, cleanerId: 1, clientId: 10 });
      const appointment = { userId: 10, bookedByCleanerId: null };
      const businessOwnerId = 1;

      const result = await MarketplaceJobRequirementsService.isMarketplaceJob(
        appointment,
        businessOwnerId
      );

      expect(result).toBe(false);
    });

    it("should return false when job was booked by business owner", async () => {
      CleanerClient.findOne.mockResolvedValue(null);
      const appointment = { userId: 10, bookedByCleanerId: 1 };
      const businessOwnerId = 1;

      const result = await MarketplaceJobRequirementsService.isMarketplaceJob(
        appointment,
        businessOwnerId
      );

      expect(result).toBe(false);
    });

    it("should return false when both own client and booked by self", async () => {
      CleanerClient.findOne.mockResolvedValue({ id: 1 });
      const appointment = { userId: 10, bookedByCleanerId: 1 };
      const businessOwnerId = 1;

      const result = await MarketplaceJobRequirementsService.isMarketplaceJob(
        appointment,
        businessOwnerId
      );

      expect(result).toBe(false);
    });
  });

  describe("updatePhotoCounts", () => {
    it("should update photo counts and mark photos completed when both types exist", async () => {
      const mockAssignment = {
        appointmentId: 100,
        update: jest.fn(),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);
      JobPhoto.count
        .mockResolvedValueOnce(2) // before photos
        .mockResolvedValueOnce(3); // after photos

      const result = await MarketplaceJobRequirementsService.updatePhotoCounts(1, 5);

      expect(result.beforePhotoCount).toBe(2);
      expect(result.afterPhotoCount).toBe(3);
      expect(result.photosCompleted).toBe(true);
      expect(mockAssignment.update).toHaveBeenCalledWith({
        beforePhotoCount: 2,
        afterPhotoCount: 3,
        photosCompleted: true,
      });
    });

    it("should not mark photos completed when only before photos exist", async () => {
      const mockAssignment = {
        appointmentId: 100,
        update: jest.fn(),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);
      JobPhoto.count
        .mockResolvedValueOnce(2) // before photos
        .mockResolvedValueOnce(0); // after photos

      const result = await MarketplaceJobRequirementsService.updatePhotoCounts(1, 5);

      expect(result.photosCompleted).toBe(false);
    });

    it("should not mark photos completed when only after photos exist", async () => {
      const mockAssignment = {
        appointmentId: 100,
        update: jest.fn(),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);
      JobPhoto.count
        .mockResolvedValueOnce(0) // before photos
        .mockResolvedValueOnce(2); // after photos

      const result = await MarketplaceJobRequirementsService.updatePhotoCounts(1, 5);

      expect(result.photosCompleted).toBe(false);
    });

    it("should throw error when assignment not found", async () => {
      EmployeeJobAssignment.findByPk.mockResolvedValue(null);

      await expect(
        MarketplaceJobRequirementsService.updatePhotoCounts(999, 5)
      ).rejects.toThrow("Assignment not found");
    });
  });

  describe("isChecklistComplete", () => {
    it("should return true when all sections are complete", () => {
      const progress = {
        kitchen: {
          total: ["item1", "item2", "item3"],
          completed: ["item1", "item2", "item3"],
        },
        bathroom: {
          total: ["item1", "item2"],
          completed: ["item1", "item2"],
        },
      };

      const result = MarketplaceJobRequirementsService.isChecklistComplete(progress);

      expect(result).toBe(true);
    });

    it("should return false when a section is incomplete", () => {
      const progress = {
        kitchen: {
          total: ["item1", "item2", "item3"],
          completed: ["item1", "item2"], // missing item3
        },
        bathroom: {
          total: ["item1", "item2"],
          completed: ["item1", "item2"],
        },
      };

      const result = MarketplaceJobRequirementsService.isChecklistComplete(progress);

      expect(result).toBe(false);
    });

    it("should return false when progress is null", () => {
      const result = MarketplaceJobRequirementsService.isChecklistComplete(null);
      expect(result).toBe(false);
    });

    it("should return false when progress is not an object", () => {
      const result = MarketplaceJobRequirementsService.isChecklistComplete("invalid");
      expect(result).toBe(false);
    });

    it("should return false when section is missing total array", () => {
      const progress = {
        kitchen: {
          completed: ["item1"],
        },
      };

      const result = MarketplaceJobRequirementsService.isChecklistComplete(progress);

      expect(result).toBe(false);
    });

    it("should return false when section is missing completed array", () => {
      const progress = {
        kitchen: {
          total: ["item1"],
        },
      };

      const result = MarketplaceJobRequirementsService.isChecklistComplete(progress);

      expect(result).toBe(false);
    });
  });

  describe("updateChecklistProgress", () => {
    it("should update checklist progress and mark complete when all done", async () => {
      const mockAssignment = {
        update: jest.fn(),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      const progress = {
        kitchen: {
          total: ["item1", "item2"],
          completed: ["item1", "item2"],
        },
      };

      const result = await MarketplaceJobRequirementsService.updateChecklistProgress(1, progress);

      expect(result.checklistProgress).toEqual(progress);
      expect(result.checklistCompleted).toBe(true);
      expect(mockAssignment.update).toHaveBeenCalledWith({
        checklistProgress: progress,
        checklistCompleted: true,
      });
    });

    it("should not mark complete when checklist is incomplete", async () => {
      const mockAssignment = {
        update: jest.fn(),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      const progress = {
        kitchen: {
          total: ["item1", "item2"],
          completed: ["item1"], // incomplete
        },
      };

      const result = await MarketplaceJobRequirementsService.updateChecklistProgress(1, progress);

      expect(result.checklistCompleted).toBe(false);
    });

    it("should throw error when assignment not found", async () => {
      EmployeeJobAssignment.findByPk.mockResolvedValue(null);

      await expect(
        MarketplaceJobRequirementsService.updateChecklistProgress(999, {})
      ).rejects.toThrow("Assignment not found");
    });
  });

  describe("getPublishedChecklist", () => {
    it("should return checklist snapshot data when active checklist exists", async () => {
      const mockChecklist = {
        snapshotData: {
          sections: [
            { id: "kitchen", name: "Kitchen", items: [] },
          ],
        },
      };
      ChecklistVersion.findOne.mockResolvedValue(mockChecklist);

      const result = await MarketplaceJobRequirementsService.getPublishedChecklist();

      expect(result).toEqual(mockChecklist.snapshotData);
      expect(ChecklistVersion.findOne).toHaveBeenCalledWith({
        where: { isActive: true },
        order: [["version", "DESC"]],
      });
    });

    it("should return null when no active checklist exists", async () => {
      ChecklistVersion.findOne.mockResolvedValue(null);

      const result = await MarketplaceJobRequirementsService.getPublishedChecklist();

      expect(result).toBeNull();
    });
  });

  describe("getCompletionStatus", () => {
    it("should return completion status for marketplace job", async () => {
      const mockAssignment = {
        isMarketplacePickup: true,
        status: "started",
        canComplete: jest.fn().mockReturnValue(false),
        getCompletionRequirements: jest.fn().mockReturnValue({
          required: true,
          missing: ["checklist", "before_photos"],
          checklistCompleted: false,
          beforePhotoCount: 0,
          afterPhotoCount: 0,
          photosCompleted: false,
        }),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      const result = await MarketplaceJobRequirementsService.getCompletionStatus(1);

      expect(result.assignmentId).toBe(1);
      expect(result.isMarketplacePickup).toBe(true);
      expect(result.canComplete).toBe(false);
      expect(result.requirements.missing).toContain("checklist");
      expect(result.requirements.missing).toContain("before_photos");
    });

    it("should throw error when assignment not found", async () => {
      EmployeeJobAssignment.findByPk.mockResolvedValue(null);

      await expect(
        MarketplaceJobRequirementsService.getCompletionStatus(999)
      ).rejects.toThrow("Assignment not found");
    });
  });

  describe("validateCompletionRequirements", () => {
    it("should return true for non-marketplace jobs", async () => {
      const mockAssignment = {
        isMarketplacePickup: false,
        getCompletionRequirements: jest.fn(),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      const result = await MarketplaceJobRequirementsService.validateCompletionRequirements(1);

      expect(result).toBe(true);
      expect(mockAssignment.getCompletionRequirements).not.toHaveBeenCalled();
    });

    it("should return true when all requirements are met", async () => {
      const mockAssignment = {
        isMarketplacePickup: true,
        getCompletionRequirements: jest.fn().mockReturnValue({
          required: true,
          missing: [],
        }),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      const result = await MarketplaceJobRequirementsService.validateCompletionRequirements(1);

      expect(result).toBe(true);
    });

    it("should throw error when checklist is missing", async () => {
      const mockAssignment = {
        isMarketplacePickup: true,
        getCompletionRequirements: jest.fn().mockReturnValue({
          required: true,
          missing: ["checklist"],
        }),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      await expect(
        MarketplaceJobRequirementsService.validateCompletionRequirements(1)
      ).rejects.toThrow("complete the cleaning checklist");
    });

    it("should throw error when photos are missing", async () => {
      const mockAssignment = {
        isMarketplacePickup: true,
        getCompletionRequirements: jest.fn().mockReturnValue({
          required: true,
          missing: ["before_photos", "after_photos"],
        }),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      await expect(
        MarketplaceJobRequirementsService.validateCompletionRequirements(1)
      ).rejects.toThrow("upload before photos");
    });

    it("should throw error when assignment not found", async () => {
      EmployeeJobAssignment.findByPk.mockResolvedValue(null);

      await expect(
        MarketplaceJobRequirementsService.validateCompletionRequirements(999)
      ).rejects.toThrow("Assignment not found");
    });
  });

  describe("initializeChecklistProgress", () => {
    it("should initialize progress with all sections from checklist", async () => {
      const mockChecklist = {
        snapshotData: {
          sections: [
            { id: "kitchen", name: "Kitchen", items: [{ id: "k1" }, { id: "k2" }] },
            { id: "bathroom", name: "Bathroom", items: [{ id: "b1" }] },
          ],
        },
      };
      ChecklistVersion.findOne.mockResolvedValue(mockChecklist);

      const result = await MarketplaceJobRequirementsService.initializeChecklistProgress();

      expect(result.kitchen).toEqual({
        total: ["k1", "k2"],
        completed: [],
      });
      expect(result.bathroom).toEqual({
        total: ["b1"],
        completed: [],
      });
    });

    it("should return empty object when no checklist exists", async () => {
      ChecklistVersion.findOne.mockResolvedValue(null);

      const result = await MarketplaceJobRequirementsService.initializeChecklistProgress();

      expect(result).toEqual({});
    });

    it("should handle sections with no items", async () => {
      const mockChecklist = {
        snapshotData: {
          sections: [
            { id: "empty", name: "Empty Section" },
          ],
        },
      };
      ChecklistVersion.findOne.mockResolvedValue(mockChecklist);

      const result = await MarketplaceJobRequirementsService.initializeChecklistProgress();

      expect(result.empty).toEqual({
        total: [],
        completed: [],
      });
    });
  });

  describe("markChecklistItemComplete", () => {
    it("should add item to completed list", async () => {
      const mockAssignment = {
        checklistProgress: {
          kitchen: { total: ["k1", "k2"], completed: [] },
        },
        update: jest.fn(),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      const result = await MarketplaceJobRequirementsService.markChecklistItemComplete(
        1,
        "kitchen",
        "k1"
      );

      expect(result.checklistProgress.kitchen.completed).toContain("k1");
    });

    it("should not duplicate completed item", async () => {
      const mockAssignment = {
        checklistProgress: {
          kitchen: { total: ["k1", "k2"], completed: ["k1"] },
        },
        update: jest.fn(),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      await MarketplaceJobRequirementsService.markChecklistItemComplete(1, "kitchen", "k1");

      // Should still only have one k1
      expect(mockAssignment.update).toHaveBeenCalled();
    });

    it("should initialize section if not exists", async () => {
      const mockAssignment = {
        checklistProgress: {},
        update: jest.fn(),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      await MarketplaceJobRequirementsService.markChecklistItemComplete(1, "newSection", "item1");

      expect(mockAssignment.update).toHaveBeenCalled();
    });

    it("should throw error when assignment not found", async () => {
      EmployeeJobAssignment.findByPk.mockResolvedValue(null);

      await expect(
        MarketplaceJobRequirementsService.markChecklistItemComplete(999, "kitchen", "k1")
      ).rejects.toThrow("Assignment not found");
    });
  });

  describe("markChecklistItemIncomplete", () => {
    it("should remove item from completed list", async () => {
      const mockAssignment = {
        checklistProgress: {
          kitchen: { total: ["k1", "k2"], completed: ["k1", "k2"] },
        },
        update: jest.fn(),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      await MarketplaceJobRequirementsService.markChecklistItemIncomplete(1, "kitchen", "k1");

      expect(mockAssignment.update).toHaveBeenCalled();
    });

    it("should handle missing section gracefully", async () => {
      const mockAssignment = {
        checklistProgress: {},
        update: jest.fn(),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      // Should not throw
      await MarketplaceJobRequirementsService.markChecklistItemIncomplete(1, "kitchen", "k1");

      expect(mockAssignment.update).toHaveBeenCalled();
    });

    it("should throw error when assignment not found", async () => {
      EmployeeJobAssignment.findByPk.mockResolvedValue(null);

      await expect(
        MarketplaceJobRequirementsService.markChecklistItemIncomplete(999, "kitchen", "k1")
      ).rejects.toThrow("Assignment not found");
    });
  });

  describe("bulkUpdateChecklistProgress", () => {
    it("should update multiple items across sections", async () => {
      const mockAssignment = {
        checklistProgress: {
          kitchen: { total: ["k1", "k2"], completed: [] },
          bathroom: { total: ["b1"], completed: [] },
        },
        update: jest.fn(),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      const updates = {
        kitchen: [
          { itemId: "k1", completed: true },
          { itemId: "k2", completed: true },
        ],
        bathroom: [
          { itemId: "b1", completed: true },
        ],
      };

      const result = await MarketplaceJobRequirementsService.bulkUpdateChecklistProgress(1, updates);

      expect(result.checklistCompleted).toBe(true);
    });

    it("should handle toggling items off", async () => {
      const mockAssignment = {
        checklistProgress: {
          kitchen: { total: ["k1", "k2"], completed: ["k1", "k2"] },
        },
        update: jest.fn(),
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      const updates = {
        kitchen: [
          { itemId: "k1", completed: false },
        ],
      };

      const result = await MarketplaceJobRequirementsService.bulkUpdateChecklistProgress(1, updates);

      expect(result.checklistCompleted).toBe(false);
    });

    it("should throw error when assignment not found", async () => {
      EmployeeJobAssignment.findByPk.mockResolvedValue(null);

      await expect(
        MarketplaceJobRequirementsService.bulkUpdateChecklistProgress(999, {})
      ).rejects.toThrow("Assignment not found");
    });
  });
});
