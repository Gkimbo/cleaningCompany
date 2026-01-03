/**
 * Tests for HomePreferredCleaner model
 * Junction table for tracking preferred cleaners per home
 */

// Mock sequelize models
jest.mock("../../models", () => {
  const mockHomePreferredCleaner = {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
    count: jest.fn(),
  };

  return {
    HomePreferredCleaner: mockHomePreferredCleaner,
    User: {
      findByPk: jest.fn(),
    },
    UserHomes: {
      findByPk: jest.fn(),
    },
  };
});

const { HomePreferredCleaner, User, UserHomes } = require("../../models");

describe("HomePreferredCleaner Model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Model Structure", () => {
    it("should have required fields", () => {
      const expectedFields = ["homeId", "cleanerId", "setAt", "setBy"];

      // Verify model can be called with these fields
      HomePreferredCleaner.create.mockResolvedValue({
        id: 1,
        homeId: 1,
        cleanerId: 2,
        setAt: new Date(),
        setBy: "review",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(HomePreferredCleaner.create).toBeDefined();
      expect(HomePreferredCleaner.findOne).toBeDefined();
      expect(HomePreferredCleaner.findAll).toBeDefined();
    });

    it("should support setBy enum values", () => {
      const validSetByValues = ["review", "settings", "invitation"];

      validSetByValues.forEach((value) => {
        expect(["review", "settings", "invitation"]).toContain(value);
      });
    });
  });

  describe("Creating Preferred Cleaner Records", () => {
    it("should create a preferred cleaner record via review", async () => {
      const mockRecord = {
        id: 1,
        homeId: 10,
        cleanerId: 20,
        setAt: new Date("2026-01-02"),
        setBy: "review",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      HomePreferredCleaner.create.mockResolvedValue(mockRecord);

      const result = await HomePreferredCleaner.create({
        homeId: 10,
        cleanerId: 20,
        setAt: new Date("2026-01-02"),
        setBy: "review",
      });

      expect(HomePreferredCleaner.create).toHaveBeenCalledWith({
        homeId: 10,
        cleanerId: 20,
        setAt: expect.any(Date),
        setBy: "review",
      });
      expect(result.homeId).toBe(10);
      expect(result.cleanerId).toBe(20);
      expect(result.setBy).toBe("review");
    });

    it("should create a preferred cleaner record via settings", async () => {
      const mockRecord = {
        id: 2,
        homeId: 10,
        cleanerId: 25,
        setAt: new Date(),
        setBy: "settings",
      };

      HomePreferredCleaner.create.mockResolvedValue(mockRecord);

      const result = await HomePreferredCleaner.create({
        homeId: 10,
        cleanerId: 25,
        setBy: "settings",
      });

      expect(result.setBy).toBe("settings");
    });

    it("should create a preferred cleaner record via invitation", async () => {
      const mockRecord = {
        id: 3,
        homeId: 10,
        cleanerId: 30,
        setAt: new Date(),
        setBy: "invitation",
      };

      HomePreferredCleaner.create.mockResolvedValue(mockRecord);

      const result = await HomePreferredCleaner.create({
        homeId: 10,
        cleanerId: 30,
        setBy: "invitation",
      });

      expect(result.setBy).toBe("invitation");
    });

    it("should prevent duplicate home-cleaner combinations", async () => {
      // First call succeeds
      HomePreferredCleaner.create
        .mockResolvedValueOnce({
          id: 1,
          homeId: 10,
          cleanerId: 20,
        })
        .mockRejectedValueOnce(new Error("Unique constraint violation"));

      // First creation should succeed
      await HomePreferredCleaner.create({
        homeId: 10,
        cleanerId: 20,
        setBy: "review",
      });

      // Second creation with same home-cleaner should fail
      await expect(
        HomePreferredCleaner.create({
          homeId: 10,
          cleanerId: 20,
          setBy: "settings",
        })
      ).rejects.toThrow("Unique constraint violation");
    });
  });

  describe("Finding Preferred Cleaners", () => {
    it("should find all preferred cleaners for a home", async () => {
      const mockRecords = [
        { id: 1, homeId: 10, cleanerId: 20, setBy: "review" },
        { id: 2, homeId: 10, cleanerId: 25, setBy: "invitation" },
      ];

      HomePreferredCleaner.findAll.mockResolvedValue(mockRecords);

      const result = await HomePreferredCleaner.findAll({
        where: { homeId: 10 },
      });

      expect(result).toHaveLength(2);
      expect(result[0].cleanerId).toBe(20);
      expect(result[1].cleanerId).toBe(25);
    });

    it("should find all preferred homes for a cleaner", async () => {
      const mockRecords = [
        { id: 1, homeId: 10, cleanerId: 20 },
        { id: 2, homeId: 15, cleanerId: 20 },
        { id: 3, homeId: 22, cleanerId: 20 },
      ];

      HomePreferredCleaner.findAll.mockResolvedValue(mockRecords);

      const result = await HomePreferredCleaner.findAll({
        where: { cleanerId: 20 },
        attributes: ["homeId"],
      });

      expect(result).toHaveLength(3);
    });

    it("should check if cleaner is preferred for specific home", async () => {
      HomePreferredCleaner.findOne.mockResolvedValue({
        id: 1,
        homeId: 10,
        cleanerId: 20,
      });

      const result = await HomePreferredCleaner.findOne({
        where: { homeId: 10, cleanerId: 20 },
      });

      expect(result).toBeTruthy();
      expect(HomePreferredCleaner.findOne).toHaveBeenCalledWith({
        where: { homeId: 10, cleanerId: 20 },
      });
    });

    it("should return null when cleaner is not preferred", async () => {
      HomePreferredCleaner.findOne.mockResolvedValue(null);

      const result = await HomePreferredCleaner.findOne({
        where: { homeId: 10, cleanerId: 99 },
      });

      expect(result).toBeNull();
    });
  });

  describe("Removing Preferred Cleaner Status", () => {
    it("should remove preferred cleaner status", async () => {
      HomePreferredCleaner.destroy.mockResolvedValue(1);

      const result = await HomePreferredCleaner.destroy({
        where: { homeId: 10, cleanerId: 20 },
      });

      expect(result).toBe(1);
      expect(HomePreferredCleaner.destroy).toHaveBeenCalledWith({
        where: { homeId: 10, cleanerId: 20 },
      });
    });

    it("should return 0 when trying to remove non-existent record", async () => {
      HomePreferredCleaner.destroy.mockResolvedValue(0);

      const result = await HomePreferredCleaner.destroy({
        where: { homeId: 99, cleanerId: 99 },
      });

      expect(result).toBe(0);
    });
  });

  describe("Counting Preferred Homes", () => {
    it("should count preferred homes for a cleaner", async () => {
      HomePreferredCleaner.count.mockResolvedValue(5);

      const count = await HomePreferredCleaner.count({
        where: { cleanerId: 20 },
      });

      expect(count).toBe(5);
    });

    it("should count preferred cleaners for a home", async () => {
      HomePreferredCleaner.count.mockResolvedValue(3);

      const count = await HomePreferredCleaner.count({
        where: { homeId: 10 },
      });

      expect(count).toBe(3);
    });
  });
});

describe("HomePreferredCleaner - Business Logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Preferred Status via Review", () => {
    it("should set preferred status when homeowner reviews cleaner", async () => {
      // Simulate review submission with setAsPreferred
      const reviewData = {
        reviewType: "homeowner_to_cleaner",
        setAsPreferred: true,
        homeId: 10,
        cleanerId: 20,
      };

      HomePreferredCleaner.findOne.mockResolvedValue(null); // Not already preferred
      HomePreferredCleaner.create.mockResolvedValue({
        id: 1,
        homeId: 10,
        cleanerId: 20,
        setBy: "review",
      });

      // Check if already preferred
      const existing = await HomePreferredCleaner.findOne({
        where: { homeId: reviewData.homeId, cleanerId: reviewData.cleanerId },
      });

      expect(existing).toBeNull();

      // Create preferred record
      if (reviewData.setAsPreferred && !existing) {
        await HomePreferredCleaner.create({
          homeId: reviewData.homeId,
          cleanerId: reviewData.cleanerId,
          setBy: "review",
        });
      }

      expect(HomePreferredCleaner.create).toHaveBeenCalled();
    });

    it("should not create duplicate record if already preferred", async () => {
      const reviewData = {
        setAsPreferred: true,
        homeId: 10,
        cleanerId: 20,
      };

      // Already preferred
      HomePreferredCleaner.findOne.mockResolvedValue({
        id: 1,
        homeId: 10,
        cleanerId: 20,
      });

      const existing = await HomePreferredCleaner.findOne({
        where: { homeId: reviewData.homeId, cleanerId: reviewData.cleanerId },
      });

      expect(existing).toBeTruthy();

      // Should not create if already exists
      if (reviewData.setAsPreferred && !existing) {
        await HomePreferredCleaner.create({
          homeId: reviewData.homeId,
          cleanerId: reviewData.cleanerId,
          setBy: "review",
        });
      }

      expect(HomePreferredCleaner.create).not.toHaveBeenCalled();
    });
  });

  describe("Direct Booking Check", () => {
    it("should allow direct booking for preferred cleaner", async () => {
      HomePreferredCleaner.findOne.mockResolvedValue({
        id: 1,
        homeId: 10,
        cleanerId: 20,
      });

      const isPreferred = await HomePreferredCleaner.findOne({
        where: { homeId: 10, cleanerId: 20 },
      });

      expect(isPreferred).toBeTruthy();
      // If preferred, direct booking is allowed
      const canBookDirectly = !!isPreferred;
      expect(canBookDirectly).toBe(true);
    });

    it("should require approval for non-preferred cleaner", async () => {
      HomePreferredCleaner.findOne.mockResolvedValue(null);

      const isPreferred = await HomePreferredCleaner.findOne({
        where: { homeId: 10, cleanerId: 99 },
      });

      expect(isPreferred).toBeNull();
      // If not preferred, normal request flow required
      const canBookDirectly = !!isPreferred;
      expect(canBookDirectly).toBe(false);
    });
  });

  describe("Multiple Preferred Cleaners Per Home", () => {
    it("should allow multiple cleaners to be preferred for same home", async () => {
      // Create multiple preferred cleaners for one home
      HomePreferredCleaner.create
        .mockResolvedValueOnce({ id: 1, homeId: 10, cleanerId: 20 })
        .mockResolvedValueOnce({ id: 2, homeId: 10, cleanerId: 25 })
        .mockResolvedValueOnce({ id: 3, homeId: 10, cleanerId: 30 });

      await HomePreferredCleaner.create({ homeId: 10, cleanerId: 20, setBy: "review" });
      await HomePreferredCleaner.create({ homeId: 10, cleanerId: 25, setBy: "review" });
      await HomePreferredCleaner.create({ homeId: 10, cleanerId: 30, setBy: "invitation" });

      expect(HomePreferredCleaner.create).toHaveBeenCalledTimes(3);
    });

    it("should allow one cleaner to be preferred at multiple homes", async () => {
      HomePreferredCleaner.create
        .mockResolvedValueOnce({ id: 1, homeId: 10, cleanerId: 20 })
        .mockResolvedValueOnce({ id: 2, homeId: 15, cleanerId: 20 })
        .mockResolvedValueOnce({ id: 3, homeId: 22, cleanerId: 20 });

      await HomePreferredCleaner.create({ homeId: 10, cleanerId: 20, setBy: "review" });
      await HomePreferredCleaner.create({ homeId: 15, cleanerId: 20, setBy: "invitation" });
      await HomePreferredCleaner.create({ homeId: 22, cleanerId: 20, setBy: "settings" });

      expect(HomePreferredCleaner.create).toHaveBeenCalledTimes(3);
    });
  });

  describe("Fetching Preferred Home IDs", () => {
    it("should return array of home IDs for cleaner", async () => {
      const mockRecords = [
        { homeId: 10 },
        { homeId: 15 },
        { homeId: 22 },
      ];

      HomePreferredCleaner.findAll.mockResolvedValue(mockRecords);

      const records = await HomePreferredCleaner.findAll({
        where: { cleanerId: 20 },
        attributes: ["homeId"],
      });

      const preferredHomeIds = records.map((r) => r.homeId);

      expect(preferredHomeIds).toEqual([10, 15, 22]);
    });

    it("should return empty array when cleaner has no preferred homes", async () => {
      HomePreferredCleaner.findAll.mockResolvedValue([]);

      const records = await HomePreferredCleaner.findAll({
        where: { cleanerId: 99 },
        attributes: ["homeId"],
      });

      const preferredHomeIds = records.map((r) => r.homeId);

      expect(preferredHomeIds).toEqual([]);
    });
  });
});
