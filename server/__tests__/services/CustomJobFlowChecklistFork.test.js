/**
 * Custom Job Flow Checklist Fork Tests
 * Tests for forking platform checklist and re-importing functionality
 */

// Mock models
jest.mock("../../models", () => {
  return {
    CustomJobFlow: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    CustomJobFlowChecklist: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn(),
    },
    ChecklistVersion: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
    },
    ClientJobFlowAssignment: {
      findAll: jest.fn(),
      create: jest.fn(),
      destroy: jest.fn(),
    },
    sequelize: {
      transaction: jest.fn((callback) => callback({ commit: jest.fn(), rollback: jest.fn() })),
    },
  };
});

const {
  CustomJobFlow,
  CustomJobFlowChecklist,
  ChecklistVersion,
} = require("../../models");

const CustomJobFlowService = require("../../services/CustomJobFlowService");

describe("CustomJobFlowService - Checklist Forking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockFlow = {
    id: 1,
    businessOwnerId: 10,
    name: "Quick Clean",
    status: "active",
  };

  const mockPlatformChecklist = {
    id: 1,
    version: 1,
    isActive: true,
    snapshotData: {
      sections: [
        {
          title: "Kitchen",
          icon: "🍳",
          displayOrder: 1,
          items: [
            { content: "Clean countertops", displayOrder: 1 },
            { content: "Wipe appliances", displayOrder: 2 },
          ],
        },
        {
          title: "Bathroom",
          icon: "🚿",
          displayOrder: 2,
          items: [
            { content: "Clean toilet", displayOrder: 1 },
            { content: "Clean sink", displayOrder: 2 },
          ],
        },
      ],
    },
  };

  describe("forkPlatformChecklist", () => {
    it("should successfully fork platform checklist to a flow", async () => {
      CustomJobFlow.findOne.mockResolvedValue(mockFlow);
      CustomJobFlowChecklist.findOne.mockResolvedValue(null); // No existing checklist
      ChecklistVersion.findOne.mockResolvedValue(mockPlatformChecklist);

      const mockCreatedChecklist = {
        id: 1,
        customJobFlowId: 1,
        forkedFromPlatformVersion: 1,
        snapshotData: mockPlatformChecklist.snapshotData,
      };
      CustomJobFlowChecklist.create.mockResolvedValue(mockCreatedChecklist);

      const result = await CustomJobFlowService.forkPlatformChecklist(1, 10);

      expect(CustomJobFlowChecklist.create).toHaveBeenCalledWith({
        customJobFlowId: 1,
        forkedFromPlatformVersion: 1,
        snapshotData: mockPlatformChecklist.snapshotData,
      });
      expect(result.forkedFromPlatformVersion).toBe(1);
      expect(result.snapshotData.sections.length).toBe(2);
    });

    it("should delete existing checklist and create new one when re-importing", async () => {
      const existingChecklist = {
        id: 5,
        customJobFlowId: 1,
        snapshotData: { sections: [{ title: "Old Section" }] },
        destroy: jest.fn().mockResolvedValue(true),
      };

      CustomJobFlow.findOne.mockResolvedValue(mockFlow);
      CustomJobFlowChecklist.findOne.mockResolvedValue(existingChecklist);
      ChecklistVersion.findOne.mockResolvedValue(mockPlatformChecklist);

      const mockCreatedChecklist = {
        id: 6,
        customJobFlowId: 1,
        forkedFromPlatformVersion: 1,
        snapshotData: mockPlatformChecklist.snapshotData,
      };
      CustomJobFlowChecklist.create.mockResolvedValue(mockCreatedChecklist);

      const result = await CustomJobFlowService.forkPlatformChecklist(1, 10);

      // Should have deleted the existing checklist
      expect(existingChecklist.destroy).toHaveBeenCalled();

      // Should have created new checklist
      expect(CustomJobFlowChecklist.create).toHaveBeenCalled();
      expect(result.snapshotData.sections.length).toBe(2);
    });

    it("should throw error when flow not found", async () => {
      CustomJobFlow.findOne.mockResolvedValue(null);

      await expect(
        CustomJobFlowService.forkPlatformChecklist(999, 10)
      ).rejects.toThrow();
    });

    it("should throw error when no platform checklist exists", async () => {
      CustomJobFlow.findOne.mockResolvedValue(mockFlow);
      CustomJobFlowChecklist.findOne.mockResolvedValue(null);
      ChecklistVersion.findOne.mockResolvedValue(null);

      await expect(
        CustomJobFlowService.forkPlatformChecklist(1, 10)
      ).rejects.toThrow("No platform checklist found to fork");
    });

    it("should use specific version when versionId is provided", async () => {
      const specificVersion = {
        id: 2,
        version: 2,
        snapshotData: {
          sections: [{ title: "Version 2 Section" }],
        },
      };

      CustomJobFlow.findOne.mockResolvedValue(mockFlow);
      CustomJobFlowChecklist.findOne.mockResolvedValue(null);
      ChecklistVersion.findByPk.mockResolvedValue(specificVersion);

      const mockCreatedChecklist = {
        id: 1,
        forkedFromPlatformVersion: 2,
        snapshotData: specificVersion.snapshotData,
      };
      CustomJobFlowChecklist.create.mockResolvedValue(mockCreatedChecklist);

      const result = await CustomJobFlowService.forkPlatformChecklist(1, 10, 2);

      expect(ChecklistVersion.findByPk).toHaveBeenCalledWith(2);
      expect(result.forkedFromPlatformVersion).toBe(2);
    });

    it("should throw error when user is not authorized for the flow", async () => {
      const otherUserFlow = {
        id: 1,
        businessOwnerId: 999, // Different owner
        name: "Other User Flow",
      };

      CustomJobFlow.findOne.mockResolvedValue(null); // Won't find for wrong owner

      await expect(
        CustomJobFlowService.forkPlatformChecklist(1, 10)
      ).rejects.toThrow();
    });
  });

  describe("Checklist serialization with sections and sectionNames", () => {
    it("should include sections convenience field in serialized output", () => {
      const CustomJobFlowChecklistSerializer = require("../../serializers/CustomJobFlowChecklistSerializer");

      const checklist = {
        id: 1,
        customJobFlowId: 1,
        forkedFromPlatformVersion: 1,
        snapshotData: {
          sections: [
            { title: "Kitchen", items: [{}, {}] },
            { title: "Bathroom", items: [{}, {}, {}] },
          ],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const serialized = CustomJobFlowChecklistSerializer.serializeOne(checklist);

      expect(serialized.sections).toEqual(checklist.snapshotData.sections);
      expect(serialized.sectionNames).toEqual(["Kitchen", "Bathroom"]);
      expect(serialized.sectionCount).toBe(2);
      expect(serialized.itemCount).toBe(5);
    });

    it("should handle empty snapshotData gracefully", () => {
      const CustomJobFlowChecklistSerializer = require("../../serializers/CustomJobFlowChecklistSerializer");

      const checklist = {
        id: 1,
        customJobFlowId: 1,
        snapshotData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const serialized = CustomJobFlowChecklistSerializer.serializeOne(checklist);

      expect(serialized.sections).toEqual([]);
      expect(serialized.sectionNames).toEqual([]);
      expect(serialized.sectionCount).toBe(0);
      expect(serialized.itemCount).toBe(0);
    });
  });
});
