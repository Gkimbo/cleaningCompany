/**
 * AppointmentJobFlowService Tests
 */

// Mock models
jest.mock("../../models", () => ({
  AppointmentJobFlow: {
    create: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
  },
  CustomJobFlow: {},
  CustomJobFlowChecklist: {
    findOne: jest.fn(),
  },
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
  sequelize: {},
}));

const {
  AppointmentJobFlow,
  CustomJobFlowChecklist,
  EmployeeJobAssignment,
  JobPhoto,
  ChecklistVersion,
} = require("../../models");

const AppointmentJobFlowService = require("../../services/AppointmentJobFlowService");

describe("AppointmentJobFlowService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createJobFlowForAppointment", () => {
    it("should create job flow for platform flow with checklist", async () => {
      const platformChecklist = {
        snapshotData: {
          sections: [
            { id: "kitchen", items: [{ id: "k1" }, { id: "k2" }] },
          ],
        },
      };
      AppointmentJobFlow.findOne.mockResolvedValue(null);
      ChecklistVersion.findOne.mockResolvedValue(platformChecklist);
      AppointmentJobFlow.create.mockResolvedValue({
        id: 1,
        appointmentId: 100,
        usesPlatformFlow: true,
        checklistSnapshotData: platformChecklist.snapshotData,
      });

      const flowResolution = {
        usesPlatformFlow: true,
        customJobFlowId: null,
        photoRequirement: "platform_required",
      };

      const result = await AppointmentJobFlowService.createJobFlowForAppointment(
        100,
        flowResolution
      );

      expect(result.usesPlatformFlow).toBe(true);
      expect(AppointmentJobFlow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: 100,
          usesPlatformFlow: true,
          photoRequirement: "platform_required",
        })
      );
    });

    it("should create job flow for custom flow with checklist", async () => {
      const customChecklist = {
        snapshotData: {
          sections: [
            { id: "room1", items: [{ id: "r1" }] },
          ],
        },
      };
      AppointmentJobFlow.findOne.mockResolvedValue(null);
      CustomJobFlowChecklist.findOne.mockResolvedValue(customChecklist);
      AppointmentJobFlow.create.mockResolvedValue({
        id: 1,
        appointmentId: 100,
        customJobFlowId: 5,
        usesPlatformFlow: false,
      });

      const flowResolution = {
        usesPlatformFlow: false,
        customJobFlowId: 5,
        photoRequirement: "optional",
      };

      const result = await AppointmentJobFlowService.createJobFlowForAppointment(
        100,
        flowResolution
      );

      expect(result.customJobFlowId).toBe(5);
      expect(CustomJobFlowChecklist.findOne).toHaveBeenCalledWith({
        where: { customJobFlowId: 5 },
      });
    });

    it("should throw error if job flow already exists", async () => {
      AppointmentJobFlow.findOne.mockResolvedValue({ id: 1 });

      await expect(
        AppointmentJobFlowService.createJobFlowForAppointment(100, {})
      ).rejects.toThrow("Job flow already exists");
    });
  });

  describe("initializeProgress", () => {
    it("should create progress object from snapshot data with na array", () => {
      const snapshotData = {
        sections: [
          { id: "kitchen", items: [{ id: "k1" }, { id: "k2" }] },
          { id: "bathroom", items: [{ id: "b1" }] },
        ],
      };

      const progress = AppointmentJobFlowService.initializeProgress(snapshotData);

      expect(progress.kitchen).toEqual({
        total: ["k1", "k2"],
        completed: [],
        na: [],
      });
      expect(progress.bathroom).toEqual({
        total: ["b1"],
        completed: [],
        na: [],
      });
    });

    it("should return empty object for null snapshot", () => {
      const progress = AppointmentJobFlowService.initializeProgress(null);
      expect(progress).toEqual({});
    });

    it("should handle sections without items", () => {
      const snapshotData = {
        sections: [{ id: "empty" }],
      };

      const progress = AppointmentJobFlowService.initializeProgress(snapshotData);

      expect(progress.empty).toEqual({
        total: [],
        completed: [],
        na: [],
      });
    });
  });

  describe("getChecklist", () => {
    it("should return checklist info from job flow", async () => {
      const mockJobFlow = {
        checklistSnapshotData: {
          sections: [{ id: "s1", items: [{ id: "i1" }] }],
        },
        checklistProgress: { s1: { total: ["i1"], completed: [] } },
        checklistCompleted: false,
        hasChecklist: () => true,
        getItemCount: () => 1,
        getCompletedItemCount: () => 0,
        getChecklistCompletionPercentage: () => 0,
        customFlow: { jobNotes: "Test notes" },
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      const result = await AppointmentJobFlowService.getChecklist(1);

      expect(result.snapshotData).toEqual(mockJobFlow.checklistSnapshotData);
      expect(result.progress).toEqual(mockJobFlow.checklistProgress);
      expect(result.jobNotes).toBe("Test notes");
      expect(result.hasChecklist).toBe(true);
      expect(result.completionPercentage).toBe(0);
    });

    it("should throw error when job flow not found", async () => {
      AppointmentJobFlow.findByPk.mockResolvedValue(null);

      await expect(AppointmentJobFlowService.getChecklist(999)).rejects.toThrow(
        "Job flow not found"
      );
    });
  });

  describe("updateChecklistProgress", () => {
    it("should mark item as completed with status string", async () => {
      const mockJobFlow = {
        checklistProgress: {
          kitchen: { total: ["k1", "k2"], completed: [], na: [] },
        },
        checklistSnapshotData: { sections: [] },
        hasChecklist: () => true,
        getChecklistCompletionPercentage: () => 50,
        update: jest.fn(),
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      const result = await AppointmentJobFlowService.updateChecklistProgress(
        1,
        "kitchen",
        "k1",
        "completed"
      );

      expect(result.checklistProgress.kitchen.completed).toContain("k1");
      expect(result.checklistProgress.kitchen.na).not.toContain("k1");
      expect(mockJobFlow.update).toHaveBeenCalled();
    });

    it("should mark item as N/A", async () => {
      const mockJobFlow = {
        checklistProgress: {
          kitchen: { total: ["k1", "k2"], completed: [], na: [] },
        },
        checklistSnapshotData: { sections: [] },
        hasChecklist: () => true,
        getChecklistCompletionPercentage: () => 50,
        update: jest.fn(),
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      const result = await AppointmentJobFlowService.updateChecklistProgress(
        1,
        "kitchen",
        "k1",
        "na"
      );

      expect(result.checklistProgress.kitchen.na).toContain("k1");
      expect(result.checklistProgress.kitchen.completed).not.toContain("k1");
      expect(mockJobFlow.update).toHaveBeenCalled();
    });

    it("should remove item from both arrays when status is null", async () => {
      const mockJobFlow = {
        checklistProgress: {
          kitchen: { total: ["k1", "k2"], completed: ["k1"], na: [] },
        },
        checklistSnapshotData: { sections: [] },
        hasChecklist: () => true,
        getChecklistCompletionPercentage: () => 50,
        update: jest.fn(),
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      const result = await AppointmentJobFlowService.updateChecklistProgress(
        1,
        "kitchen",
        "k1",
        null
      );

      expect(result.checklistProgress.kitchen.completed).not.toContain("k1");
      expect(result.checklistProgress.kitchen.na).not.toContain("k1");
    });

    it("should handle backwards compatibility with boolean true", async () => {
      const mockJobFlow = {
        checklistProgress: {
          kitchen: { total: ["k1", "k2"], completed: [], na: [] },
        },
        checklistSnapshotData: { sections: [] },
        hasChecklist: () => true,
        getChecklistCompletionPercentage: () => 50,
        update: jest.fn(),
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      const result = await AppointmentJobFlowService.updateChecklistProgress(
        1,
        "kitchen",
        "k1",
        true
      );

      expect(result.checklistProgress.kitchen.completed).toContain("k1");
      expect(mockJobFlow.update).toHaveBeenCalled();
    });

    it("should handle backwards compatibility with boolean false", async () => {
      const mockJobFlow = {
        checklistProgress: {
          kitchen: { total: ["k1", "k2"], completed: ["k1", "k2"], na: [] },
        },
        checklistSnapshotData: { sections: [] },
        hasChecklist: () => true,
        getChecklistCompletionPercentage: () => 50,
        update: jest.fn(),
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      const result = await AppointmentJobFlowService.updateChecklistProgress(
        1,
        "kitchen",
        "k1",
        false
      );

      expect(result.checklistProgress.kitchen.completed).not.toContain("k1");
      expect(result.checklistProgress.kitchen.completed).toContain("k2");
    });

    it("should move item from completed to na", async () => {
      const mockJobFlow = {
        checklistProgress: {
          kitchen: { total: ["k1", "k2"], completed: ["k1"], na: [] },
        },
        checklistSnapshotData: { sections: [] },
        hasChecklist: () => true,
        getChecklistCompletionPercentage: () => 50,
        update: jest.fn(),
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      const result = await AppointmentJobFlowService.updateChecklistProgress(
        1,
        "kitchen",
        "k1",
        "na"
      );

      expect(result.checklistProgress.kitchen.completed).not.toContain("k1");
      expect(result.checklistProgress.kitchen.na).toContain("k1");
    });

    it("should initialize na array if not present (backwards compat)", async () => {
      const mockJobFlow = {
        checklistProgress: {
          kitchen: { total: ["k1", "k2"], completed: [] }, // no na array
        },
        checklistSnapshotData: { sections: [] },
        hasChecklist: () => true,
        getChecklistCompletionPercentage: () => 50,
        update: jest.fn(),
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      const result = await AppointmentJobFlowService.updateChecklistProgress(
        1,
        "kitchen",
        "k1",
        "na"
      );

      expect(result.checklistProgress.kitchen.na).toContain("k1");
    });

    it("should throw error when no checklist exists", async () => {
      const mockJobFlow = {
        hasChecklist: () => false,
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      await expect(
        AppointmentJobFlowService.updateChecklistProgress(1, "kitchen", "k1", "completed")
      ).rejects.toThrow("No checklist for this job flow");
    });
  });

  describe("isChecklistComplete", () => {
    it("should return true when all sections complete", () => {
      const progress = {
        kitchen: { total: ["k1", "k2"], completed: ["k1", "k2"], na: [] },
        bathroom: { total: ["b1"], completed: ["b1"], na: [] },
      };

      expect(AppointmentJobFlowService.isChecklistComplete(progress)).toBe(true);
    });

    it("should return true when items are mix of completed and N/A", () => {
      const progress = {
        kitchen: { total: ["k1", "k2"], completed: ["k1"], na: ["k2"] },
        bathroom: { total: ["b1"], completed: [], na: ["b1"] },
      };

      expect(AppointmentJobFlowService.isChecklistComplete(progress)).toBe(true);
    });

    it("should return true when all items are N/A", () => {
      const progress = {
        kitchen: { total: ["k1", "k2"], completed: [], na: ["k1", "k2"] },
      };

      expect(AppointmentJobFlowService.isChecklistComplete(progress)).toBe(true);
    });

    it("should return false when section incomplete", () => {
      const progress = {
        kitchen: { total: ["k1", "k2"], completed: ["k1"], na: [] },
      };

      expect(AppointmentJobFlowService.isChecklistComplete(progress)).toBe(false);
    });

    it("should return false when section incomplete with some N/A", () => {
      const progress = {
        kitchen: { total: ["k1", "k2", "k3"], completed: ["k1"], na: ["k2"] },
      };

      expect(AppointmentJobFlowService.isChecklistComplete(progress)).toBe(false);
    });

    it("should return false for null progress", () => {
      expect(AppointmentJobFlowService.isChecklistComplete(null)).toBe(false);
    });

    it("should handle missing na array (backwards compat)", () => {
      const progress = {
        kitchen: { total: ["k1", "k2"], completed: ["k1", "k2"] }, // no na array
      };

      expect(AppointmentJobFlowService.isChecklistComplete(progress)).toBe(true);
    });
  });

  describe("updatePhotoCounts", () => {
    it("should update photo counts and mark complete", async () => {
      const mockJobFlow = {
        appointmentId: 100,
        photoRequirement: "required",
        update: jest.fn(),
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);
      JobPhoto.count
        .mockResolvedValueOnce(2) // before photos
        .mockResolvedValueOnce(3); // after photos

      const result = await AppointmentJobFlowService.updatePhotoCounts(1, 5);

      expect(result.beforePhotoCount).toBe(2);
      expect(result.afterPhotoCount).toBe(3);
      expect(result.photosCompleted).toBe(true);
      expect(mockJobFlow.update).toHaveBeenCalledWith({
        beforePhotoCount: 2,
        afterPhotoCount: 3,
        photosCompleted: true,
      });
    });

    it("should not mark complete when missing photos", async () => {
      const mockJobFlow = {
        appointmentId: 100,
        photoRequirement: "required",
        update: jest.fn(),
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);
      JobPhoto.count
        .mockResolvedValueOnce(2) // before photos
        .mockResolvedValueOnce(0); // no after photos

      const result = await AppointmentJobFlowService.updatePhotoCounts(1, 5);

      expect(result.photosCompleted).toBe(false);
    });
  });

  describe("canSkipPhotos", () => {
    it("should return true for optional photos", async () => {
      const mockJobFlow = {
        requiresPhotos: () => false,
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      const result = await AppointmentJobFlowService.canSkipPhotos(1);

      expect(result).toBe(true);
    });

    it("should return false for required photos", async () => {
      const mockJobFlow = {
        requiresPhotos: () => true,
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      const result = await AppointmentJobFlowService.canSkipPhotos(1);

      expect(result).toBe(false);
    });
  });

  describe("updateEmployeeNotes", () => {
    it("should update employee notes", async () => {
      const mockJobFlow = {
        update: jest.fn(),
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      await AppointmentJobFlowService.updateEmployeeNotes(1, "Great job!");

      expect(mockJobFlow.update).toHaveBeenCalledWith({
        employeeNotes: "Great job!",
      });
    });

    it("should throw error when job flow not found", async () => {
      AppointmentJobFlow.findByPk.mockResolvedValue(null);

      await expect(
        AppointmentJobFlowService.updateEmployeeNotes(999, "Notes")
      ).rejects.toThrow("Job flow not found");
    });
  });

  describe("validateCompletionRequirements", () => {
    it("should pass when all requirements met", async () => {
      const mockJobFlow = {
        validateCompletion: () => ({ isValid: true, errors: [] }),
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      const result = await AppointmentJobFlowService.validateCompletionRequirements(1);

      expect(result).toBe(true);
    });

    it("should throw error when requirements not met", async () => {
      const mockJobFlow = {
        validateCompletion: () => ({
          isValid: false,
          errors: ["Before photos are required"],
        }),
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      await expect(
        AppointmentJobFlowService.validateCompletionRequirements(1)
      ).rejects.toThrow("Before photos are required");
    });
  });

  describe("getCompletionStatus", () => {
    it("should return full completion status", async () => {
      const mockJobFlow = {
        isMarketplaceFlow: () => true,
        photoRequirement: "platform_required",
        beforePhotoCount: 2,
        afterPhotoCount: 2,
        photosCompleted: true,
        hasChecklist: () => true,
        checklistCompleted: true,
        getChecklistCompletionPercentage: () => 100,
        validateCompletion: () => ({ isValid: true, errors: [] }),
        customFlow: { jobNotes: "Test notes" },
        employeeNotes: "Done",
      };
      AppointmentJobFlow.findByPk.mockResolvedValue(mockJobFlow);

      const result = await AppointmentJobFlowService.getCompletionStatus(1);

      expect(result.isMarketplaceFlow).toBe(true);
      expect(result.photoRequirement).toBe("platform_required");
      expect(result.photosCompleted).toBe(true);
      expect(result.checklistCompleted).toBe(true);
      expect(result.canComplete).toBe(true);
      expect(result.missingRequirements).toEqual([]);
    });
  });

  describe("getFlowDetailsForEmployee", () => {
    it("should return flow details when job flow exists", async () => {
      const mockAssignment = {
        jobFlow: {
          id: 1,
          isMarketplaceFlow: () => false,
          photoRequirement: "optional",
          requiresPhotos: () => false,
          photosHidden: () => false,
          beforePhotoCount: 0,
          afterPhotoCount: 0,
          photosCompleted: false,
          hasChecklist: () => true,
          checklistSnapshotData: { sections: [] },
          checklistProgress: {},
          checklistCompleted: false,
          getChecklistCompletionPercentage: () => 0,
          validateCompletion: () => ({ isValid: true, errors: [] }),
          customFlow: { jobNotes: "Notes" },
          employeeNotes: null,
        },
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      const result = await AppointmentJobFlowService.getFlowDetailsForEmployee(1);

      expect(result.hasJobFlow).toBe(true);
      expect(result.photoRequirement).toBe("optional");
      expect(result.jobNotes).toBe("Notes");
    });

    it("should return minimal details when no job flow exists", async () => {
      const mockAssignment = {
        jobFlow: null,
      };
      EmployeeJobAssignment.findByPk.mockResolvedValue(mockAssignment);

      const result = await AppointmentJobFlowService.getFlowDetailsForEmployee(1);

      expect(result.hasJobFlow).toBe(false);
      expect(result.isMarketplaceFlow).toBe(false);
      expect(result.photoRequirement).toBe("optional");
      expect(result.canComplete).toBe(true);
    });

    it("should throw error when assignment not found", async () => {
      EmployeeJobAssignment.findByPk.mockResolvedValue(null);

      await expect(
        AppointmentJobFlowService.getFlowDetailsForEmployee(999)
      ).rejects.toThrow("Assignment not found");
    });
  });

  describe("enforcePlatformFlow", () => {
    it("should create platform flow when none exists", async () => {
      const platformChecklist = {
        snapshotData: { sections: [] },
      };
      AppointmentJobFlow.findOne.mockResolvedValue(null);
      ChecklistVersion.findOne.mockResolvedValue(platformChecklist);
      AppointmentJobFlow.create.mockResolvedValue({
        id: 1,
        usesPlatformFlow: true,
        photoRequirement: "platform_required",
      });

      const result = await AppointmentJobFlowService.enforcePlatformFlow(100);

      expect(result.usesPlatformFlow).toBe(true);
    });

    it("should update existing flow to platform flow", async () => {
      const existingFlow = {
        usesPlatformFlow: false,
        update: jest.fn(),
      };
      const platformChecklist = {
        snapshotData: { sections: [] },
      };
      AppointmentJobFlow.findOne.mockResolvedValue(existingFlow);
      ChecklistVersion.findOne.mockResolvedValue(platformChecklist);

      await AppointmentJobFlowService.enforcePlatformFlow(100);

      expect(existingFlow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          usesPlatformFlow: true,
          customJobFlowId: null,
          photoRequirement: "platform_required",
        })
      );
    });

    it("should not update already platform flow", async () => {
      const existingFlow = {
        usesPlatformFlow: true,
        update: jest.fn(),
      };
      AppointmentJobFlow.findOne.mockResolvedValue(existingFlow);

      await AppointmentJobFlowService.enforcePlatformFlow(100);

      expect(existingFlow.update).not.toHaveBeenCalled();
    });
  });
});
