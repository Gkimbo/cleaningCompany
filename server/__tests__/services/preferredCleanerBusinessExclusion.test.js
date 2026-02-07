/**
 * Tests for Preferred Cleaner Business Exclusion
 * Verifies that business owners and their employees cannot get preferred status
 * when cleaning for their own clients
 */

const PreferredCleanerService = require("../../services/PreferredCleanerService");

// Mock the models
const mockModels = {
  UserHomes: {
    findByPk: jest.fn(),
  },
  CleanerClient: {
    findOne: jest.fn(),
  },
  BusinessEmployee: {
    findOne: jest.fn(),
  },
};

describe("PreferredCleanerService.isBusinessCleanerForHome", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Business owner cleaning own client", () => {
    it("should return true when cleaner is business owner with active CleanerClient relationship", async () => {
      const cleanerId = 100; // Business owner
      const homeId = 1;
      const homeOwnerId = 50; // Client

      // Mock home lookup
      mockModels.UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        userId: homeOwnerId,
      });

      // Mock: business owner has active relationship with this client
      mockModels.CleanerClient.findOne.mockResolvedValue({
        id: 1,
        cleanerId: cleanerId,
        clientId: homeOwnerId,
        status: "active",
      });

      const result = await PreferredCleanerService.isBusinessCleanerForHome(
        cleanerId,
        homeId,
        mockModels
      );

      expect(result).toBe(true);
      expect(mockModels.CleanerClient.findOne).toHaveBeenCalledWith({
        where: {
          cleanerId: cleanerId,
          clientId: homeOwnerId,
          status: "active",
        },
      });
    });

    it("should return false when CleanerClient relationship is not active", async () => {
      const cleanerId = 100;
      const homeId = 1;
      const homeOwnerId = 50;

      mockModels.UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        userId: homeOwnerId,
      });

      // No active relationship (status is "inactive" or doesn't exist)
      mockModels.CleanerClient.findOne.mockResolvedValue(null);
      mockModels.BusinessEmployee.findOne.mockResolvedValue(null);

      const result = await PreferredCleanerService.isBusinessCleanerForHome(
        cleanerId,
        homeId,
        mockModels
      );

      expect(result).toBe(false);
    });
  });

  describe("Employee cleaning business owner's client", () => {
    it("should return true when cleaner is employee of business owner with client relationship", async () => {
      const employeeUserId = 200; // Employee
      const businessOwnerId = 100; // Business owner
      const homeId = 1;
      const homeOwnerId = 50; // Client

      mockModels.UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        userId: homeOwnerId,
      });

      // Employee has no direct relationship with client
      mockModels.CleanerClient.findOne
        .mockResolvedValueOnce(null) // First call: check direct relationship
        .mockResolvedValueOnce({
          // Second call: check business owner's relationship
          id: 1,
          cleanerId: businessOwnerId,
          clientId: homeOwnerId,
          status: "active",
        });

      // Employee works for business owner
      mockModels.BusinessEmployee.findOne.mockResolvedValue({
        id: 1,
        userId: employeeUserId,
        businessOwnerId: businessOwnerId,
        status: "active",
      });

      const result = await PreferredCleanerService.isBusinessCleanerForHome(
        employeeUserId,
        homeId,
        mockModels
      );

      expect(result).toBe(true);
      expect(mockModels.BusinessEmployee.findOne).toHaveBeenCalledWith({
        where: {
          userId: employeeUserId,
          status: "active",
        },
      });
    });

    it("should return false when employee is not active", async () => {
      const employeeUserId = 200;
      const homeId = 1;
      const homeOwnerId = 50;

      mockModels.UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        userId: homeOwnerId,
      });

      mockModels.CleanerClient.findOne.mockResolvedValue(null);
      // Employee is terminated
      mockModels.BusinessEmployee.findOne.mockResolvedValue(null);

      const result = await PreferredCleanerService.isBusinessCleanerForHome(
        employeeUserId,
        homeId,
        mockModels
      );

      expect(result).toBe(false);
    });

    it("should return false when business owner has no relationship with home owner", async () => {
      const employeeUserId = 200;
      const businessOwnerId = 100;
      const homeId = 1;
      const homeOwnerId = 50;

      mockModels.UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        userId: homeOwnerId,
      });

      // No relationships
      mockModels.CleanerClient.findOne.mockResolvedValue(null);

      // Employee is active but their business owner has no client relationship
      mockModels.BusinessEmployee.findOne.mockResolvedValue({
        id: 1,
        userId: employeeUserId,
        businessOwnerId: businessOwnerId,
        status: "active",
      });

      const result = await PreferredCleanerService.isBusinessCleanerForHome(
        employeeUserId,
        homeId,
        mockModels
      );

      expect(result).toBe(false);
    });
  });

  describe("Marketplace cleaner", () => {
    it("should return false for marketplace cleaner with no business relationship", async () => {
      const cleanerId = 300; // Regular marketplace cleaner
      const homeId = 1;
      const homeOwnerId = 50;

      mockModels.UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        userId: homeOwnerId,
      });

      // No business relationships
      mockModels.CleanerClient.findOne.mockResolvedValue(null);
      mockModels.BusinessEmployee.findOne.mockResolvedValue(null);

      const result = await PreferredCleanerService.isBusinessCleanerForHome(
        cleanerId,
        homeId,
        mockModels
      );

      expect(result).toBe(false);
    });
  });

  describe("Business owner cleaning marketplace client", () => {
    it("should return false when business owner has no CleanerClient relationship with home owner", async () => {
      const businessOwnerId = 100; // Business owner
      const homeId = 1;
      const marketplaceClientId = 999; // Someone they found on marketplace

      mockModels.UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        userId: marketplaceClientId,
      });

      // No CleanerClient relationship (this is a marketplace pickup)
      mockModels.CleanerClient.findOne.mockResolvedValue(null);
      mockModels.BusinessEmployee.findOne.mockResolvedValue(null);

      const result = await PreferredCleanerService.isBusinessCleanerForHome(
        businessOwnerId,
        homeId,
        mockModels
      );

      expect(result).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should return false when home is not found", async () => {
      mockModels.UserHomes.findByPk.mockResolvedValue(null);

      const result = await PreferredCleanerService.isBusinessCleanerForHome(
        100,
        999,
        mockModels
      );

      expect(result).toBe(false);
    });

    it("should return false when CleanerClient status is inactive", async () => {
      const cleanerId = 100;
      const homeId = 1;
      const homeOwnerId = 50;

      mockModels.UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        userId: homeOwnerId,
      });

      // The query only returns active relationships, so null means no match
      mockModels.CleanerClient.findOne.mockResolvedValue(null);
      mockModels.BusinessEmployee.findOne.mockResolvedValue(null);

      const result = await PreferredCleanerService.isBusinessCleanerForHome(
        cleanerId,
        homeId,
        mockModels
      );

      expect(result).toBe(false);
    });

    it("should return false when CleanerClient status is cancelled", async () => {
      const cleanerId = 100;
      const homeId = 1;
      const homeOwnerId = 50;

      mockModels.UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        userId: homeOwnerId,
      });

      // Cancelled relationships are not returned (only active)
      mockModels.CleanerClient.findOne.mockResolvedValue(null);
      mockModels.BusinessEmployee.findOne.mockResolvedValue(null);

      const result = await PreferredCleanerService.isBusinessCleanerForHome(
        cleanerId,
        homeId,
        mockModels
      );

      expect(result).toBe(false);
    });
  });
});

describe("Preferred Cleaner Eligibility - Integration scenarios", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Scenario: Client invited by business owner leaves review", () => {
    it("should block preferred status when client reviews their business owner", async () => {
      const businessOwnerId = 100;
      const clientId = 50;
      const homeId = 1;

      mockModels.UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        userId: clientId,
      });

      mockModels.CleanerClient.findOne.mockResolvedValue({
        id: 1,
        cleanerId: businessOwnerId,
        clientId: clientId,
        status: "active",
      });

      const isBusinessCleaner = await PreferredCleanerService.isBusinessCleanerForHome(
        businessOwnerId,
        homeId,
        mockModels
      );

      // Business owner should NOT be able to get preferred status
      expect(isBusinessCleaner).toBe(true);
    });

    it("should block preferred status when client reviews business owner's employee", async () => {
      const employeeUserId = 200;
      const businessOwnerId = 100;
      const clientId = 50;
      const homeId = 1;

      mockModels.UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        userId: clientId,
      });

      mockModels.CleanerClient.findOne
        .mockResolvedValueOnce(null) // Employee has no direct relationship
        .mockResolvedValueOnce({
          // Business owner has relationship
          id: 1,
          cleanerId: businessOwnerId,
          clientId: clientId,
          status: "active",
        });

      mockModels.BusinessEmployee.findOne.mockResolvedValue({
        id: 1,
        userId: employeeUserId,
        businessOwnerId: businessOwnerId,
        status: "active",
      });

      const isBusinessCleaner = await PreferredCleanerService.isBusinessCleanerForHome(
        employeeUserId,
        homeId,
        mockModels
      );

      // Employee should NOT be able to get preferred status for boss's client
      expect(isBusinessCleaner).toBe(true);
    });
  });

  describe("Scenario: Marketplace client leaves review", () => {
    it("should allow preferred status when marketplace client reviews cleaner", async () => {
      const cleanerId = 300;
      const marketplaceClientId = 60;
      const homeId = 2;

      mockModels.UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        userId: marketplaceClientId,
      });

      mockModels.CleanerClient.findOne.mockResolvedValue(null);
      mockModels.BusinessEmployee.findOne.mockResolvedValue(null);

      const isBusinessCleaner = await PreferredCleanerService.isBusinessCleanerForHome(
        cleanerId,
        homeId,
        mockModels
      );

      // Marketplace cleaner CAN get preferred status
      expect(isBusinessCleaner).toBe(false);
    });

    it("should allow preferred status when business owner picks up marketplace job", async () => {
      const businessOwnerId = 100;
      const marketplaceClientId = 70; // Someone NOT in CleanerClient table
      const homeId = 3;

      mockModels.UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        userId: marketplaceClientId,
      });

      // No CleanerClient relationship exists
      mockModels.CleanerClient.findOne.mockResolvedValue(null);
      mockModels.BusinessEmployee.findOne.mockResolvedValue(null);

      const isBusinessCleaner = await PreferredCleanerService.isBusinessCleanerForHome(
        businessOwnerId,
        homeId,
        mockModels
      );

      // Business owner CAN get preferred status for marketplace clients
      expect(isBusinessCleaner).toBe(false);
    });
  });

  describe("Scenario: Former client relationship", () => {
    it("should allow preferred status after CleanerClient relationship ends", async () => {
      const businessOwnerId = 100;
      const formerClientId = 50;
      const homeId = 1;

      mockModels.UserHomes.findByPk.mockResolvedValue({
        id: homeId,
        userId: formerClientId,
      });

      // Relationship ended (status is inactive, so findOne returns null)
      mockModels.CleanerClient.findOne.mockResolvedValue(null);
      mockModels.BusinessEmployee.findOne.mockResolvedValue(null);

      const isBusinessCleaner = await PreferredCleanerService.isBusinessCleanerForHome(
        businessOwnerId,
        homeId,
        mockModels
      );

      // After relationship ends, cleaner CAN get preferred status
      expect(isBusinessCleaner).toBe(false);
    });
  });
});
