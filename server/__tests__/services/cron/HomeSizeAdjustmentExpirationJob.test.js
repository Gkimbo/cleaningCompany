/**
 * Tests for Home Size Adjustment Expiration Job
 * Tests the cron job that expires pending adjustment requests after 24 hours
 */

const { Op } = require("sequelize");

// Mock models
jest.mock("../../../models", () => ({
  HomeSizeAdjustmentRequest: {
    findAll: jest.fn(),
  },
  User: {
    findAll: jest.fn(),
  },
  UserHomes: {},
}));

// Mock NotificationService
jest.mock("../../../services/NotificationService", () => ({
  notifyUser: jest.fn().mockResolvedValue({ id: 1 }),
}));

// Mock EncryptionService
jest.mock("../../../services/EncryptionService", () => ({
  decrypt: jest.fn((val) => val ? `decrypted_${val}` : null),
}));

const { HomeSizeAdjustmentRequest, User } = require("../../../models");
const NotificationService = require("../../../services/NotificationService");
const { processExpiredAdjustments } = require("../../../services/cron/HomeSizeAdjustmentExpirationJob");

describe("HomeSizeAdjustmentExpirationJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("processExpiredAdjustments", () => {
    it("should find and expire pending_homeowner requests past their deadline", async () => {
      const mockExpiredRequest = {
        id: 1,
        cleanerId: 2,
        homeownerId: 1,
        appointmentId: 10,
        caseNumber: "HSA-001",
        status: "pending_homeowner",
        expiresAt: new Date(Date.now() - 1000), // Expired
        cleaner: { id: 2, firstName: "John" },
        homeowner: { id: 1, firstName: "Jane" },
        home: { id: 1, address: "123 Main St" },
        update: jest.fn().mockResolvedValue(true),
      };

      HomeSizeAdjustmentRequest.findAll.mockResolvedValue([mockExpiredRequest]);
      User.findAll.mockResolvedValue([{ id: 3, type: "owner" }]);

      const result = await processExpiredAdjustments(null);

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(mockExpiredRequest.update).toHaveBeenCalledWith({
        status: "expired",
        resolvedAt: expect.any(Date),
      });
    });

    it("should notify cleaner when request expires", async () => {
      const mockExpiredRequest = {
        id: 1,
        cleanerId: 2,
        homeownerId: 1,
        appointmentId: 10,
        caseNumber: "HSA-001",
        status: "pending_homeowner",
        expiresAt: new Date(Date.now() - 1000),
        cleaner: { id: 2, firstName: "John" },
        homeowner: { id: 1, firstName: "Jane" },
        home: { id: 1, address: "123 Main St" },
        update: jest.fn().mockResolvedValue(true),
      };

      HomeSizeAdjustmentRequest.findAll.mockResolvedValue([mockExpiredRequest]);
      User.findAll.mockResolvedValue([]);

      await processExpiredAdjustments(null);

      expect(NotificationService.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 2,
          type: "adjustment_expired",
          title: "Adjustment Request Expired",
        })
      );
    });

    it("should notify all owners when request expires", async () => {
      const mockExpiredRequest = {
        id: 1,
        cleanerId: 2,
        homeownerId: 1,
        appointmentId: 10,
        caseNumber: "HSA-001",
        status: "pending_homeowner",
        expiresAt: new Date(Date.now() - 1000),
        cleaner: { id: 2, firstName: "John" },
        homeowner: { id: 1, firstName: "Jane" },
        home: { id: 1, address: "123 Main St" },
        update: jest.fn().mockResolvedValue(true),
      };

      const mockOwners = [
        { id: 3, type: "owner" },
        { id: 4, type: "owner" },
      ];

      HomeSizeAdjustmentRequest.findAll.mockResolvedValue([mockExpiredRequest]);
      User.findAll.mockResolvedValue(mockOwners);

      await processExpiredAdjustments(null);

      // Should notify each owner
      expect(NotificationService.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 3,
          type: "adjustment_expired_review",
          actionRequired: true,
        })
      );
      expect(NotificationService.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 4,
          type: "adjustment_expired_review",
          actionRequired: true,
        })
      );
    });

    it("should handle multiple expired requests", async () => {
      const mockExpiredRequests = [
        {
          id: 1,
          cleanerId: 2,
          homeownerId: 1,
          appointmentId: 10,
          caseNumber: "HSA-001",
          cleaner: { id: 2, firstName: "John" },
          homeowner: { id: 1, firstName: "Jane" },
          home: { id: 1, address: "123 Main St" },
          update: jest.fn().mockResolvedValue(true),
        },
        {
          id: 2,
          cleanerId: 5,
          homeownerId: 6,
          appointmentId: 20,
          caseNumber: "HSA-002",
          cleaner: { id: 5, firstName: "Bob" },
          homeowner: { id: 6, firstName: "Alice" },
          home: { id: 2, address: "456 Oak Ave" },
          update: jest.fn().mockResolvedValue(true),
        },
      ];

      HomeSizeAdjustmentRequest.findAll.mockResolvedValue(mockExpiredRequests);
      User.findAll.mockResolvedValue([]);

      const result = await processExpiredAdjustments(null);

      expect(result.processed).toBe(2);
      expect(mockExpiredRequests[0].update).toHaveBeenCalled();
      expect(mockExpiredRequests[1].update).toHaveBeenCalled();
    });

    it("should return 0 processed when no expired requests", async () => {
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue([]);

      const result = await processExpiredAdjustments(null);

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(0);
      expect(NotificationService.notifyUser).not.toHaveBeenCalled();
    });

    it("should count errors but continue processing", async () => {
      const mockExpiredRequests = [
        {
          id: 1,
          cleanerId: 2,
          homeownerId: 1,
          appointmentId: 10,
          caseNumber: "HSA-001",
          cleaner: { id: 2, firstName: "John" },
          homeowner: { id: 1, firstName: "Jane" },
          home: { id: 1, address: "123 Main St" },
          update: jest.fn().mockRejectedValue(new Error("DB Error")),
        },
        {
          id: 2,
          cleanerId: 5,
          homeownerId: 6,
          appointmentId: 20,
          caseNumber: "HSA-002",
          cleaner: { id: 5, firstName: "Bob" },
          homeowner: { id: 6, firstName: "Alice" },
          home: { id: 2, address: "456 Oak Ave" },
          update: jest.fn().mockResolvedValue(true),
        },
      ];

      HomeSizeAdjustmentRequest.findAll.mockResolvedValue(mockExpiredRequests);
      User.findAll.mockResolvedValue([]);

      const result = await processExpiredAdjustments(null);

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(1);
    });

    it("should query with correct where clause", async () => {
      HomeSizeAdjustmentRequest.findAll.mockResolvedValue([]);

      await processExpiredAdjustments(null);

      expect(HomeSizeAdjustmentRequest.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: "pending_homeowner",
            expiresAt: { [Op.lt]: expect.any(Date) },
          },
        })
      );
    });

    it("should include case number in owner notification", async () => {
      const mockExpiredRequest = {
        id: 1,
        cleanerId: 2,
        homeownerId: 1,
        appointmentId: 10,
        caseNumber: "HSA-12345",
        reportedNumBeds: "4",
        reportedNumBaths: "3",
        cleaner: { id: 2, firstName: "John" },
        homeowner: { id: 1, firstName: "Jane" },
        home: { id: 1, address: "123 Main St" },
        update: jest.fn().mockResolvedValue(true),
      };

      HomeSizeAdjustmentRequest.findAll.mockResolvedValue([mockExpiredRequest]);
      User.findAll.mockResolvedValue([{ id: 3, type: "owner" }]);

      await processExpiredAdjustments(null);

      expect(NotificationService.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 3,
          data: expect.objectContaining({
            caseNumber: "HSA-12345",
            reportedBeds: "4",
            reportedBaths: "3",
          }),
        })
      );
    });
  });
});
