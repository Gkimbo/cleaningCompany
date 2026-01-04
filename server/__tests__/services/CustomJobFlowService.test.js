/**
 * CustomJobFlowService Tests
 */

// Mock models
jest.mock("../../models", () => ({
  CustomJobFlow: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  },
  CustomJobFlowChecklist: {
    create: jest.fn(),
    findOne: jest.fn(),
    destroy: jest.fn(),
  },
  ClientJobFlowAssignment: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    destroy: jest.fn(),
  },
  CleanerClient: {
    findOne: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
  ChecklistVersion: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
  },
  sequelize: {},
  Op: require("sequelize").Op,
}));

// Mock MarketplaceJobRequirementsService
jest.mock("../../services/MarketplaceJobRequirementsService", () => ({
  isMarketplaceJob: jest.fn(),
}));

const {
  CustomJobFlow,
  CustomJobFlowChecklist,
  ClientJobFlowAssignment,
  CleanerClient,
  UserHomes,
  ChecklistVersion,
} = require("../../models");

const MarketplaceJobRequirementsService = require("../../services/MarketplaceJobRequirementsService");
const CustomJobFlowService = require("../../services/CustomJobFlowService");

describe("CustomJobFlowService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createFlow", () => {
    it("should create a new flow with default values", async () => {
      const mockFlow = {
        id: 1,
        businessOwnerId: 1,
        name: "Deep Clean",
        photoRequirement: "optional",
        isDefault: false,
        status: "active",
      };
      CustomJobFlow.update.mockResolvedValue([0]);
      CustomJobFlow.create.mockResolvedValue(mockFlow);

      const result = await CustomJobFlowService.createFlow(1, {
        name: "Deep Clean",
      });

      expect(result).toEqual(mockFlow);
      expect(CustomJobFlow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessOwnerId: 1,
          name: "Deep Clean",
          photoRequirement: "optional",
          isDefault: false,
          status: "active",
        })
      );
    });

    it("should unset existing default when creating new default flow", async () => {
      const mockFlow = { id: 1, isDefault: true };
      CustomJobFlow.update.mockResolvedValue([1]);
      CustomJobFlow.create.mockResolvedValue(mockFlow);

      await CustomJobFlowService.createFlow(1, {
        name: "New Default",
        isDefault: true,
      });

      expect(CustomJobFlow.update).toHaveBeenCalledWith(
        { isDefault: false },
        { where: { businessOwnerId: 1, isDefault: true } }
      );
    });

    it("should create flow with all provided options", async () => {
      const mockFlow = {
        id: 1,
        businessOwnerId: 1,
        name: "Premium Clean",
        description: "Full deep clean",
        photoRequirement: "required",
        jobNotes: "Use eco-friendly products",
        isDefault: true,
        status: "active",
      };
      CustomJobFlow.update.mockResolvedValue([1]);
      CustomJobFlow.create.mockResolvedValue(mockFlow);

      const result = await CustomJobFlowService.createFlow(1, {
        name: "Premium Clean",
        description: "Full deep clean",
        photoRequirement: "required",
        jobNotes: "Use eco-friendly products",
        isDefault: true,
      });

      expect(result.photoRequirement).toBe("required");
      expect(result.jobNotes).toBe("Use eco-friendly products");
    });
  });

  describe("getFlowById", () => {
    it("should return flow with checklist when found", async () => {
      const mockFlow = {
        id: 1,
        businessOwnerId: 1,
        name: "Test Flow",
        checklist: { id: 1, snapshotData: {} },
      };
      CustomJobFlow.findOne.mockResolvedValue(mockFlow);

      const result = await CustomJobFlowService.getFlowById(1, 1);

      expect(result).toEqual(mockFlow);
      expect(CustomJobFlow.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, businessOwnerId: 1 },
        })
      );
    });

    it("should throw error when flow not found", async () => {
      CustomJobFlow.findOne.mockResolvedValue(null);

      await expect(CustomJobFlowService.getFlowById(999, 1)).rejects.toThrow(
        "Flow not found or access denied"
      );
    });

    it("should throw error when accessing another owner's flow", async () => {
      CustomJobFlow.findOne.mockResolvedValue(null);

      await expect(CustomJobFlowService.getFlowById(1, 999)).rejects.toThrow(
        "Flow not found or access denied"
      );
    });
  });

  describe("getFlowsByBusinessOwner", () => {
    it("should return active flows by default", async () => {
      const mockFlows = [
        { id: 1, name: "Flow 1", isDefault: true },
        { id: 2, name: "Flow 2", isDefault: false },
      ];
      CustomJobFlow.findAll.mockResolvedValue(mockFlows);

      const result = await CustomJobFlowService.getFlowsByBusinessOwner(1);

      expect(result).toEqual(mockFlows);
      expect(CustomJobFlow.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessOwnerId: 1, status: "active" },
        })
      );
    });

    it("should filter by status when provided", async () => {
      CustomJobFlow.findAll.mockResolvedValue([]);

      await CustomJobFlowService.getFlowsByBusinessOwner(1, { status: "archived" });

      expect(CustomJobFlow.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessOwnerId: 1, status: "archived" },
        })
      );
    });
  });

  describe("updateFlow", () => {
    it("should update allowed fields", async () => {
      const mockFlow = {
        id: 1,
        update: jest.fn(),
      };
      CustomJobFlow.findOne.mockResolvedValue(mockFlow);

      await CustomJobFlowService.updateFlow(1, 1, {
        name: "Updated Name",
        description: "Updated description",
        photoRequirement: "hidden",
        jobNotes: "New notes",
      });

      expect(mockFlow.update).toHaveBeenCalledWith({
        name: "Updated Name",
        description: "Updated description",
        photoRequirement: "hidden",
        jobNotes: "New notes",
      });
    });

    it("should not update restricted fields", async () => {
      const mockFlow = {
        id: 1,
        update: jest.fn(),
      };
      CustomJobFlow.findOne.mockResolvedValue(mockFlow);

      await CustomJobFlowService.updateFlow(1, 1, {
        name: "Updated Name",
        status: "archived", // Should be filtered out
        isDefault: true, // Should be filtered out
        businessOwnerId: 999, // Should be filtered out
      });

      expect(mockFlow.update).toHaveBeenCalledWith({
        name: "Updated Name",
      });
    });
  });

  describe("archiveFlow", () => {
    it("should archive flow and remove default status", async () => {
      const mockFlow = {
        id: 1,
        isDefault: true,
        update: jest.fn(),
      };
      CustomJobFlow.findOne.mockResolvedValue(mockFlow);

      await CustomJobFlowService.archiveFlow(1, 1);

      expect(mockFlow.update).toHaveBeenCalledWith({
        status: "archived",
        isDefault: false,
      });
    });
  });

  describe("setDefaultFlow", () => {
    it("should clear existing default and set new default", async () => {
      const mockFlow = {
        id: 2,
        update: jest.fn(),
      };
      CustomJobFlow.update.mockResolvedValue([1]);
      CustomJobFlow.findOne.mockResolvedValue(mockFlow);

      const result = await CustomJobFlowService.setDefaultFlow(1, 2);

      expect(CustomJobFlow.update).toHaveBeenCalledWith(
        { isDefault: false },
        { where: { businessOwnerId: 1, isDefault: true } }
      );
      expect(mockFlow.update).toHaveBeenCalledWith({ isDefault: true });
      expect(result).toEqual(mockFlow);
    });

    it("should return null when flowId is null", async () => {
      CustomJobFlow.update.mockResolvedValue([0]);

      const result = await CustomJobFlowService.setDefaultFlow(1, null);

      expect(result).toBeNull();
    });
  });

  describe("createChecklistFromScratch", () => {
    it("should create checklist with provided data", async () => {
      const mockChecklist = {
        id: 1,
        customJobFlowId: 1,
        snapshotData: { sections: [] },
      };
      CustomJobFlow.findOne.mockResolvedValue({ id: 1 });
      CustomJobFlowChecklist.findOne.mockResolvedValue(null);
      CustomJobFlowChecklist.create.mockResolvedValue(mockChecklist);

      const result = await CustomJobFlowService.createChecklistFromScratch(1, 1, {
        sections: [],
      });

      expect(result).toEqual(mockChecklist);
      expect(CustomJobFlowChecklist.create).toHaveBeenCalledWith({
        customJobFlowId: 1,
        forkedFromPlatformVersion: null,
        snapshotData: { sections: [] },
      });
    });

    it("should throw error if checklist already exists", async () => {
      CustomJobFlow.findOne.mockResolvedValue({ id: 1 });
      CustomJobFlowChecklist.findOne.mockResolvedValue({ id: 1 });

      await expect(
        CustomJobFlowService.createChecklistFromScratch(1, 1, { sections: [] })
      ).rejects.toThrow("Checklist already exists");
    });
  });

  describe("forkPlatformChecklist", () => {
    it("should fork the active platform checklist", async () => {
      const platformChecklist = {
        version: 5,
        snapshotData: {
          sections: [{ id: "kitchen", name: "Kitchen", items: [] }],
        },
      };
      const mockChecklist = {
        id: 1,
        forkedFromPlatformVersion: 5,
        snapshotData: platformChecklist.snapshotData,
      };
      CustomJobFlow.findOne.mockResolvedValue({ id: 1 });
      CustomJobFlowChecklist.findOne.mockResolvedValue(null);
      ChecklistVersion.findOne.mockResolvedValue(platformChecklist);
      CustomJobFlowChecklist.create.mockResolvedValue(mockChecklist);

      const result = await CustomJobFlowService.forkPlatformChecklist(1, 1);

      expect(result.forkedFromPlatformVersion).toBe(5);
      expect(CustomJobFlowChecklist.create).toHaveBeenCalledWith(
        expect.objectContaining({
          forkedFromPlatformVersion: 5,
        })
      );
    });

    it("should throw error if no platform checklist exists", async () => {
      CustomJobFlow.findOne.mockResolvedValue({ id: 1 });
      CustomJobFlowChecklist.findOne.mockResolvedValue(null);
      ChecklistVersion.findOne.mockResolvedValue(null);

      await expect(
        CustomJobFlowService.forkPlatformChecklist(1, 1)
      ).rejects.toThrow("No platform checklist found");
    });
  });

  describe("assignFlowToClient", () => {
    it("should create client assignment", async () => {
      const mockAssignment = {
        id: 1,
        businessOwnerId: 1,
        cleanerClientId: 10,
        customJobFlowId: 2,
      };
      CustomJobFlow.findOne.mockResolvedValue({ id: 2 });
      CleanerClient.findOne.mockResolvedValue({ id: 10 });
      ClientJobFlowAssignment.findOne.mockResolvedValue(null);
      ClientJobFlowAssignment.create.mockResolvedValue(mockAssignment);

      const result = await CustomJobFlowService.assignFlowToClient(1, 10, 2);

      expect(result).toEqual(mockAssignment);
      expect(ClientJobFlowAssignment.create).toHaveBeenCalledWith({
        businessOwnerId: 1,
        cleanerClientId: 10,
        homeId: null,
        customJobFlowId: 2,
      });
    });

    it("should update existing assignment", async () => {
      const existingAssignment = {
        id: 1,
        update: jest.fn(),
      };
      CustomJobFlow.findOne.mockResolvedValue({ id: 3 });
      CleanerClient.findOne.mockResolvedValue({ id: 10 });
      ClientJobFlowAssignment.findOne.mockResolvedValue(existingAssignment);

      await CustomJobFlowService.assignFlowToClient(1, 10, 3);

      expect(existingAssignment.update).toHaveBeenCalledWith({ customJobFlowId: 3 });
    });

    it("should throw error if client not found", async () => {
      CustomJobFlow.findOne.mockResolvedValue({ id: 2 });
      CleanerClient.findOne.mockResolvedValue(null);

      await expect(
        CustomJobFlowService.assignFlowToClient(1, 999, 2)
      ).rejects.toThrow("Client not found");
    });
  });

  describe("resolveFlowForAppointment", () => {
    it("should return platform flow for marketplace jobs", async () => {
      MarketplaceJobRequirementsService.isMarketplaceJob.mockResolvedValue(true);

      const appointment = { id: 1, userId: 10, homeId: 5 };
      const result = await CustomJobFlowService.resolveFlowForAppointment(appointment, 1);

      expect(result.usesPlatformFlow).toBe(true);
      expect(result.customJobFlowId).toBeNull();
      expect(result.photoRequirement).toBe("platform_required");
      expect(result.source).toBe("marketplace");
    });

    it("should use job override when provided", async () => {
      MarketplaceJobRequirementsService.isMarketplaceJob.mockResolvedValue(false);
      const mockFlow = {
        id: 5,
        photoRequirement: "required",
        isActive: () => true,
      };
      CustomJobFlow.findOne.mockResolvedValue(mockFlow);

      const appointment = { id: 1, userId: 10, homeId: 5 };
      const result = await CustomJobFlowService.resolveFlowForAppointment(
        appointment,
        1,
        5 // job override
      );

      expect(result.usesPlatformFlow).toBe(false);
      expect(result.customJobFlowId).toBe(5);
      expect(result.source).toBe("job_override");
    });

    it("should return no flow when nothing is configured", async () => {
      MarketplaceJobRequirementsService.isMarketplaceJob.mockResolvedValue(false);
      ClientJobFlowAssignment.findOne.mockResolvedValue(null);
      CleanerClient.findOne.mockResolvedValue(null);
      CustomJobFlow.findOne.mockResolvedValue(null);

      const appointment = { id: 1, userId: 10, homeId: 5 };
      const result = await CustomJobFlowService.resolveFlowForAppointment(appointment, 1);

      expect(result.usesPlatformFlow).toBe(false);
      expect(result.customJobFlowId).toBeNull();
      expect(result.flow).toBeNull();
      expect(result.source).toBe("none");
    });

    it("should use home assignment when available", async () => {
      MarketplaceJobRequirementsService.isMarketplaceJob.mockResolvedValue(false);
      const mockFlow = {
        id: 10,
        photoRequirement: "hidden",
        isActive: () => true,
      };
      ClientJobFlowAssignment.findOne.mockResolvedValue({
        flow: mockFlow,
      });
      CleanerClient.findOne.mockResolvedValue(null);

      const appointment = { id: 1, userId: 10, homeId: 5 };
      const result = await CustomJobFlowService.resolveFlowForAppointment(appointment, 1);

      expect(result.customJobFlowId).toBe(10);
      expect(result.source).toBe("home");
    });

    it("should use client assignment when no home assignment exists", async () => {
      MarketplaceJobRequirementsService.isMarketplaceJob.mockResolvedValue(false);
      const mockFlow = {
        id: 8,
        photoRequirement: "optional",
        isActive: () => true,
      };
      // First call (home) returns null, second call (client) returns assignment
      ClientJobFlowAssignment.findOne
        .mockResolvedValueOnce(null) // home assignment
        .mockResolvedValueOnce({ flow: mockFlow }); // client assignment
      CleanerClient.findOne.mockResolvedValue({ id: 15 });

      const appointment = { id: 1, userId: 10, homeId: 5 };
      const result = await CustomJobFlowService.resolveFlowForAppointment(appointment, 1);

      expect(result.customJobFlowId).toBe(8);
      expect(result.source).toBe("client");
    });

    it("should use default flow when no assignments exist", async () => {
      MarketplaceJobRequirementsService.isMarketplaceJob.mockResolvedValue(false);
      ClientJobFlowAssignment.findOne.mockResolvedValue(null);
      CleanerClient.findOne.mockResolvedValue(null);
      const defaultFlow = {
        id: 3,
        isDefault: true,
        photoRequirement: "optional",
      };
      CustomJobFlow.findOne.mockResolvedValue(defaultFlow);

      const appointment = { id: 1, userId: 10, homeId: null };
      const result = await CustomJobFlowService.resolveFlowForAppointment(appointment, 1);

      expect(result.customJobFlowId).toBe(3);
      expect(result.source).toBe("default");
    });
  });
});
