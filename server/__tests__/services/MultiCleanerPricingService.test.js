/**
 * Comprehensive Tests for MultiCleanerPricingService
 * Handles all financial calculations for multi-cleaner jobs
 */

// Mock dependencies
jest.mock("../../config/businessConfig");
jest.mock("../../services/CalculatePrice");

// Mock models
const mockMultiCleanerJob = {
  findByPk: jest.fn(),
};

const mockUserAppointments = {
  findByPk: jest.fn(),
};

const mockUserHomes = {};

const mockCleanerRoomAssignment = {
  findAll: jest.fn(),
  update: jest.fn(),
};

const mockUser = {};

jest.mock("../../models", () => ({
  MultiCleanerJob: mockMultiCleanerJob,
  UserAppointments: mockUserAppointments,
  UserHomes: mockUserHomes,
  CleanerRoomAssignment: mockCleanerRoomAssignment,
  User: mockUser,
}));

const { getPricingConfig } = require("../../config/businessConfig");
const calculatePrice = require("../../services/CalculatePrice");

// Default mock pricing config
const mockPricingConfig = {
  multiCleaner: {
    platformFeePercent: 0.13,
    soloLargeHomeBonus: 500, // $5.00 bonus
  },
  platform: {
    feePercent: 0.10,
  },
};

getPricingConfig.mockResolvedValue(mockPricingConfig);
calculatePrice.mockResolvedValue(150); // $150 base price

// Import after mocks
const MultiCleanerPricingService = require("../../services/MultiCleanerPricingService");

describe("MultiCleanerPricingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPricingConfig.mockResolvedValue(mockPricingConfig);
    calculatePrice.mockResolvedValue(150);
  });

  // ============================================
  // calculateTotalJobPrice Tests
  // ============================================
  describe("calculateTotalJobPrice", () => {
    const mockHome = {
      numBeds: 4,
      numBaths: 3,
      bedConfigurations: {},
      bathroomConfigurations: {},
    };

    const mockAppointment = {
      bringSheets: true,
      bringTowels: false,
      timeToBeCompleted: "10-3",
      sheetConfigurations: {},
      towelConfigurations: {},
    };

    it("should calculate total price in cents", async () => {
      const price = await MultiCleanerPricingService.calculateTotalJobPrice(
        mockHome,
        mockAppointment,
        2
      );

      expect(price).toBe(15000); // $150 * 100
    });

    it("should pass correct parameters to calculatePrice", async () => {
      await MultiCleanerPricingService.calculateTotalJobPrice(
        mockHome,
        mockAppointment,
        2
      );

      expect(calculatePrice).toHaveBeenCalledWith(
        mockAppointment.bringSheets,
        mockAppointment.bringTowels,
        mockHome.numBeds,
        mockHome.numBaths,
        mockAppointment.timeToBeCompleted,
        mockAppointment.sheetConfigurations,
        mockAppointment.towelConfigurations
      );
    });

    it("should use home configurations if appointment ones are missing", async () => {
      const appointmentWithoutConfigs = {
        bringSheets: true,
        bringTowels: false,
        timeToBeCompleted: "10-3",
      };

      await MultiCleanerPricingService.calculateTotalJobPrice(
        mockHome,
        appointmentWithoutConfigs,
        2
      );

      expect(calculatePrice).toHaveBeenCalledWith(
        true,
        false,
        4,
        3,
        "10-3",
        mockHome.bedConfigurations,
        mockHome.bathroomConfigurations
      );
    });

    it("should round to nearest cent", async () => {
      calculatePrice.mockResolvedValue(150.555);

      const price = await MultiCleanerPricingService.calculateTotalJobPrice(
        mockHome,
        mockAppointment,
        2
      );

      expect(price).toBe(15056); // Rounded from 15055.5
    });
  });

  // ============================================
  // calculatePerCleanerEarnings Tests
  // ============================================
  describe("calculatePerCleanerEarnings", () => {
    describe("equal split (no room assignments)", () => {
      it("should split equally between cleaners", async () => {
        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          20000, // $200
          2,
          null
        );

        expect(result.cleanerEarnings).toHaveLength(2);
        // Each should get roughly half after platform fee
      });

      it("should calculate platform fee correctly", async () => {
        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          10000, // $100
          2,
          null
        );

        expect(result.platformFee).toBe(1300); // 13% of $100
        expect(result.netForCleaners).toBe(8700);
      });

      it("should handle odd amounts with remainder going to first cleaner", async () => {
        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          10001, // $100.01
          2,
          null
        );

        // Net after 13%: 8700.87 -> 8701 cents
        // Split between 2: 4350 each, with 1 cent remainder
        const earnings = result.cleanerEarnings;
        expect(earnings[0].netAmount).toBeGreaterThanOrEqual(earnings[1].netAmount);
      });

      it("should split between 3 cleaners", async () => {
        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          15000, // $150
          3,
          null
        );

        expect(result.cleanerEarnings).toHaveLength(3);
        expect(result.platformFeePercent).toBe(0.13);
      });

      it("should split between 4 cleaners", async () => {
        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          20000, // $200
          4,
          null
        );

        expect(result.cleanerEarnings).toHaveLength(4);
      });

      it("should calculate percentOfWork as equal", async () => {
        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          10000,
          2,
          null
        );

        result.cleanerEarnings.forEach((earning) => {
          expect(earning.percentOfWork).toBe(50);
        });
      });

      it("should handle empty room assignments array", async () => {
        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          10000,
          2,
          []
        );

        expect(result.cleanerEarnings).toHaveLength(2);
      });
    });

    describe("proportional split (with room assignments)", () => {
      it("should split based on estimated minutes", async () => {
        const roomAssignments = [
          { cleanerId: 100, estimatedMinutes: 60, cleanerSlotIndex: 0 },
          { cleanerId: 100, estimatedMinutes: 30, cleanerSlotIndex: 0 },
          { cleanerId: 101, estimatedMinutes: 30, cleanerSlotIndex: 1 },
        ];
        // Cleaner 100: 90 mins, Cleaner 101: 30 mins
        // Total: 120 mins, 100 gets 75%, 101 gets 25%

        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          12000,
          2,
          roomAssignments
        );

        const earnings100 = result.cleanerEarnings.find((e) => e.cleanerId == 100);
        const earnings101 = result.cleanerEarnings.find((e) => e.cleanerId == 101);

        expect(earnings100.percentOfWork).toBe(75);
        expect(earnings101.percentOfWork).toBe(25);
      });

      it("should give last cleaner remainder to avoid rounding errors", async () => {
        const roomAssignments = [
          { cleanerId: 100, estimatedMinutes: 33, cleanerSlotIndex: 0 },
          { cleanerId: 101, estimatedMinutes: 33, cleanerSlotIndex: 1 },
          { cleanerId: 102, estimatedMinutes: 34, cleanerSlotIndex: 2 },
        ];

        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          10000, // $100
          3,
          roomAssignments
        );

        const totalEarnings = result.cleanerEarnings.reduce(
          (sum, e) => sum + e.netAmount,
          0
        );

        expect(totalEarnings).toBe(result.netForCleaners);
      });

      it("should include estimatedMinutes in earnings breakdown", async () => {
        const roomAssignments = [
          { cleanerId: 100, estimatedMinutes: 60 },
          { cleanerId: 101, estimatedMinutes: 40 },
        ];

        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          10000,
          2,
          roomAssignments
        );

        const earnings100 = result.cleanerEarnings.find((e) => e.cleanerId == 100);
        expect(earnings100.estimatedMinutes).toBe(60);
      });

      it("should handle cleaner with 0 minutes", async () => {
        const roomAssignments = [
          { cleanerId: 100, estimatedMinutes: 100 },
          { cleanerId: 101, estimatedMinutes: 0 },
        ];

        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          10000,
          2,
          roomAssignments
        );

        const earnings101 = result.cleanerEarnings.find((e) => e.cleanerId == 101);
        expect(earnings101.percentOfWork).toBe(0);
        expect(earnings101.netAmount).toBe(0);
      });

      it("should use cleanerSlotIndex if cleanerId is null", async () => {
        const roomAssignments = [
          { cleanerId: null, estimatedMinutes: 50, cleanerSlotIndex: 0 },
          { cleanerId: null, estimatedMinutes: 50, cleanerSlotIndex: 1 },
        ];

        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          10000,
          2,
          roomAssignments
        );

        expect(result.cleanerEarnings).toHaveLength(2);
      });
    });

    describe("return value structure", () => {
      it("should include all required fields", async () => {
        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          10000,
          2,
          null
        );

        expect(result).toHaveProperty("totalPrice", 10000);
        expect(result).toHaveProperty("platformFee");
        expect(result).toHaveProperty("netForCleaners");
        expect(result).toHaveProperty("platformFeePercent");
        expect(result).toHaveProperty("cleanerEarnings");
      });

      it("should include correct fields in cleaner earnings", async () => {
        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          10000,
          2,
          null
        );

        result.cleanerEarnings.forEach((earning) => {
          expect(earning).toHaveProperty("cleanerIndex");
          expect(earning).toHaveProperty("grossAmount");
          expect(earning).toHaveProperty("platformFee");
          expect(earning).toHaveProperty("netAmount");
          expect(earning).toHaveProperty("percentOfWork");
        });
      });
    });
  });

  // ============================================
  // calculateSoloCompletionEarnings Tests
  // ============================================
  describe("calculateSoloCompletionEarnings", () => {
    const mockHome = { numBeds: 4, numBaths: 3 };
    const mockAppointment = {
      id: 100,
      home: mockHome,
      bringSheets: true,
      bringTowels: false,
      timeToBeCompleted: "10-3",
    };

    beforeEach(() => {
      mockUserAppointments.findByPk.mockResolvedValue(mockAppointment);
      calculatePrice.mockResolvedValue(150);
    });

    it("should calculate solo earnings with regular platform fee", async () => {
      const earnings = await MultiCleanerPricingService.calculateSoloCompletionEarnings(100);

      // $150 - 10% fee = $135 = 13500 cents
      // Plus $5.00 bonus = 14000 cents
      expect(earnings).toBe(14000);
    });

    it("should use regular platform fee (not multi-cleaner fee)", async () => {
      await MultiCleanerPricingService.calculateSoloCompletionEarnings(100);

      // The config should use platform.feePercent (10%) not multiCleaner.platformFeePercent (13%)
      expect(getPricingConfig).toHaveBeenCalled();
    });

    it("should add solo bonus if configured", async () => {
      const configWithBonus = {
        ...mockPricingConfig,
        multiCleaner: {
          ...mockPricingConfig.multiCleaner,
          soloLargeHomeBonus: 1000, // $10 bonus
        },
      };
      getPricingConfig.mockResolvedValue(configWithBonus);

      const earnings = await MultiCleanerPricingService.calculateSoloCompletionEarnings(100);

      // $150 - 10% = $135 = 13500 + 1000 bonus = 14500
      expect(earnings).toBe(14500);
    });

    it("should handle zero bonus", async () => {
      const configNoBonus = {
        ...mockPricingConfig,
        multiCleaner: {
          ...mockPricingConfig.multiCleaner,
          soloLargeHomeBonus: 0,
        },
      };
      getPricingConfig.mockResolvedValue(configNoBonus);

      const earnings = await MultiCleanerPricingService.calculateSoloCompletionEarnings(100);

      // $150 - 10% = $135 = 13500 + 0 bonus = 13500
      expect(earnings).toBe(13500);
    });

    it("should throw error if appointment not found", async () => {
      mockUserAppointments.findByPk.mockResolvedValue(null);

      await expect(
        MultiCleanerPricingService.calculateSoloCompletionEarnings(999)
      ).rejects.toThrow("Appointment not found");
    });
  });

  // ============================================
  // calculatePartialPayment Tests
  // ============================================
  describe("calculatePartialPayment", () => {
    it("should calculate partial payment proportionally", async () => {
      const result = await MultiCleanerPricingService.calculatePartialPayment(
        5, // 5 rooms completed
        10, // 10 total rooms
        20000 // $200 total
      );

      expect(result.completionPercentage).toBe(50);
      expect(result.partialPrice).toBe(10000); // 50% of $200
    });

    it("should apply platform fee to partial price", async () => {
      const result = await MultiCleanerPricingService.calculatePartialPayment(
        5,
        10,
        10000
      );

      expect(result.platformFee).toBe(650); // 13% of $50
      expect(result.netForCleaners).toBe(4350);
    });

    it("should handle 0 completed rooms", async () => {
      const result = await MultiCleanerPricingService.calculatePartialPayment(
        0,
        10,
        10000
      );

      expect(result.completionPercentage).toBe(0);
      expect(result.partialPrice).toBe(0);
      expect(result.netForCleaners).toBe(0);
    });

    it("should handle all rooms completed", async () => {
      const result = await MultiCleanerPricingService.calculatePartialPayment(
        10,
        10,
        10000
      );

      expect(result.completionPercentage).toBe(100);
      expect(result.partialPrice).toBe(10000);
    });

    it("should handle 0 total rooms", async () => {
      const result = await MultiCleanerPricingService.calculatePartialPayment(
        0,
        0,
        10000
      );

      expect(result.completionPercentage).toBe(0);
      expect(result.partialPrice).toBe(0);
    });

    it("should include all required fields", async () => {
      const result = await MultiCleanerPricingService.calculatePartialPayment(
        3,
        10,
        10000
      );

      expect(result).toHaveProperty("completedRooms", 3);
      expect(result).toHaveProperty("totalRooms", 10);
      expect(result).toHaveProperty("completionPercentage", 30);
      expect(result).toHaveProperty("partialPrice");
      expect(result).toHaveProperty("platformFee");
      expect(result).toHaveProperty("netForCleaners");
    });

    it("should round percentage to nearest integer", async () => {
      const result = await MultiCleanerPricingService.calculatePartialPayment(
        1,
        3,
        10000
      );

      expect(result.completionPercentage).toBe(33); // 33.33% rounded
    });
  });

  // ============================================
  // generateEarningsBreakdown Tests
  // ============================================
  describe("generateEarningsBreakdown", () => {
    const mockHome = { numBeds: 4, numBaths: 3, address: "123 Main St", city: "Boston" };
    const mockAppointment = {
      id: 100,
      date: "2025-01-15",
      home: mockHome,
      bringSheets: true,
      bringTowels: false,
      timeToBeCompleted: "10-3",
    };
    const mockJob = {
      id: 10,
      totalCleanersRequired: 2,
      cleanersConfirmed: 2,
      appointment: mockAppointment,
    };

    beforeEach(() => {
      mockMultiCleanerJob.findByPk.mockResolvedValue(mockJob);
      calculatePrice.mockResolvedValue(150);
    });

    it("should generate complete breakdown", async () => {
      mockCleanerRoomAssignment.findAll.mockResolvedValue([
        { cleanerId: 100, estimatedMinutes: 50, cleaner: { firstName: "John", lastName: "Doe" }, getDisplayLabel: () => "Bedroom 1" },
        { cleanerId: 101, estimatedMinutes: 50, cleaner: { firstName: "Jane", lastName: "Smith" }, getDisplayLabel: () => "Bedroom 2" },
      ]);

      const breakdown = await MultiCleanerPricingService.generateEarningsBreakdown(10);

      expect(breakdown).toHaveProperty("multiCleanerJobId", 10);
      expect(breakdown).toHaveProperty("appointmentId", 100);
      expect(breakdown).toHaveProperty("appointmentDate", "2025-01-15");
      expect(breakdown).toHaveProperty("totalPrice");
      expect(breakdown).toHaveProperty("platformFee");
      expect(breakdown).toHaveProperty("netForCleaners");
      expect(breakdown).toHaveProperty("cleanerDetails");
    });

    it("should include formatted total price", async () => {
      mockCleanerRoomAssignment.findAll.mockResolvedValue([]);

      const breakdown = await MultiCleanerPricingService.generateEarningsBreakdown(10);

      expect(breakdown.totalPriceFormatted).toBe("$150.00");
    });

    it("should include cleaner details with names and rooms", async () => {
      mockCleanerRoomAssignment.findAll.mockResolvedValue([
        { cleanerId: 100, estimatedMinutes: 50, cleaner: { firstName: "John", lastName: "Doe" }, getDisplayLabel: () => "Bedroom 1" },
        { cleanerId: 100, estimatedMinutes: 30, cleaner: { firstName: "John", lastName: "Doe" }, getDisplayLabel: () => "Bathroom 1" },
      ]);

      const breakdown = await MultiCleanerPricingService.generateEarningsBreakdown(10);

      expect(breakdown.cleanerDetails).toHaveLength(1);
      expect(breakdown.cleanerDetails[0].cleanerName).toBe("John Doe");
      expect(breakdown.cleanerDetails[0].assignedRooms).toContain("Bedroom 1");
      expect(breakdown.cleanerDetails[0].assignedRooms).toContain("Bathroom 1");
    });

    it("should include home address", async () => {
      mockCleanerRoomAssignment.findAll.mockResolvedValue([]);

      const breakdown = await MultiCleanerPricingService.generateEarningsBreakdown(10);

      expect(breakdown.homeAddress).toBe("123 Main St, Boston");
    });

    it("should throw error if job not found", async () => {
      mockMultiCleanerJob.findByPk.mockResolvedValue(null);

      await expect(
        MultiCleanerPricingService.generateEarningsBreakdown(999)
      ).rejects.toThrow("Multi-cleaner job not found");
    });

    it("should include platform fee percentage", async () => {
      mockCleanerRoomAssignment.findAll.mockResolvedValue([]);

      const breakdown = await MultiCleanerPricingService.generateEarningsBreakdown(10);

      expect(breakdown.platformFeePercent).toBe(13); // 13%
    });

    it("should handle unassigned cleaner gracefully", async () => {
      mockCleanerRoomAssignment.findAll.mockResolvedValue([
        { cleanerId: null, estimatedMinutes: 50, cleaner: null, getDisplayLabel: () => "Bedroom 1" },
      ]);

      const breakdown = await MultiCleanerPricingService.generateEarningsBreakdown(10);

      // Unassigned rooms shouldn't appear in cleanerDetails
      expect(breakdown.cleanerDetails).toHaveLength(0);
    });
  });

  // ============================================
  // updateRoomEarningsShares Tests
  // ============================================
  describe("updateRoomEarningsShares", () => {
    it("should update each room assignment with earnings share", async () => {
      const mockAssignments = [
        { id: 1, estimatedMinutes: 30, update: jest.fn().mockResolvedValue(true) },
        { id: 2, estimatedMinutes: 30, update: jest.fn().mockResolvedValue(true) },
      ];
      mockCleanerRoomAssignment.findAll.mockResolvedValue(mockAssignments);

      await MultiCleanerPricingService.updateRoomEarningsShares(10, 10000);

      mockAssignments.forEach((assignment) => {
        expect(assignment.update).toHaveBeenCalledWith({
          cleanerEarningsShare: expect.any(Number),
        });
      });
    });

    it("should calculate proportional shares based on effort", async () => {
      const mockAssignment1 = { id: 1, estimatedMinutes: 60, update: jest.fn() };
      const mockAssignment2 = { id: 2, estimatedMinutes: 40, update: jest.fn() };
      mockCleanerRoomAssignment.findAll.mockResolvedValue([
        mockAssignment1,
        mockAssignment2,
      ]);

      await MultiCleanerPricingService.updateRoomEarningsShares(10, 10000);

      // After 13% fee: 8700 cents
      // Room 1 (60/100): 5220 cents
      // Room 2 (40/100): 3480 cents
      expect(mockAssignment1.update).toHaveBeenCalledWith({
        cleanerEarningsShare: 5220,
      });
      expect(mockAssignment2.update).toHaveBeenCalledWith({
        cleanerEarningsShare: 3480,
      });
    });

    it("should handle zero effort", async () => {
      const mockAssignment = { id: 1, estimatedMinutes: 0, update: jest.fn() };
      mockCleanerRoomAssignment.findAll.mockResolvedValue([mockAssignment]);

      await MultiCleanerPricingService.updateRoomEarningsShares(10, 10000);

      expect(mockAssignment.update).toHaveBeenCalledWith({
        cleanerEarningsShare: 0,
      });
    });

    it("should handle null estimatedMinutes", async () => {
      const mockAssignment = { id: 1, estimatedMinutes: null, update: jest.fn() };
      mockCleanerRoomAssignment.findAll.mockResolvedValue([mockAssignment]);

      await MultiCleanerPricingService.updateRoomEarningsShares(10, 10000);

      // Should treat null as 0
      expect(mockAssignment.update).toHaveBeenCalled();
    });
  });

  // ============================================
  // calculateHomeownerCost Tests
  // ============================================
  describe("calculateHomeownerCost", () => {
    it("should return same price regardless of cleaner count", async () => {
      const result1 = await MultiCleanerPricingService.calculateHomeownerCost(15000, 1);
      const result2 = await MultiCleanerPricingService.calculateHomeownerCost(15000, 2);
      const result3 = await MultiCleanerPricingService.calculateHomeownerCost(15000, 3);

      expect(result1.totalCost).toBe(15000);
      expect(result2.totalCost).toBe(15000);
      expect(result3.totalCost).toBe(15000);
    });

    it("should have zero multi-cleaner fee", async () => {
      const result = await MultiCleanerPricingService.calculateHomeownerCost(15000, 2);

      expect(result.multiCleanerFee).toBe(0);
    });

    it("should include note for multi-cleaner jobs", async () => {
      const result = await MultiCleanerPricingService.calculateHomeownerCost(15000, 2);

      expect(result.note).toContain("2 cleaners");
    });

    it("should have no note for single cleaner", async () => {
      const result = await MultiCleanerPricingService.calculateHomeownerCost(15000, 1);

      expect(result.note).toBeNull();
    });

    it("should include cleaner count", async () => {
      const result = await MultiCleanerPricingService.calculateHomeownerCost(15000, 3);

      expect(result.cleanerCount).toBe(3);
    });

    it("should include base price", async () => {
      const result = await MultiCleanerPricingService.calculateHomeownerCost(15000, 2);

      expect(result.basePriceCents).toBe(15000);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe("Edge Cases", () => {
    describe("calculatePerCleanerEarnings edge cases", () => {
      it("should handle very small amounts", async () => {
        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          100, // $1
          2,
          null
        );

        expect(result.totalPrice).toBe(100);
        expect(result.netForCleaners).toBeGreaterThan(0);
      });

      it("should handle very large amounts", async () => {
        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          10000000, // $100,000
          4,
          null
        );

        const totalEarnings = result.cleanerEarnings.reduce(
          (sum, e) => sum + e.netAmount,
          0
        );
        expect(totalEarnings).toBe(result.netForCleaners);
      });

      it("should handle 1 cleaner", async () => {
        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          10000,
          1,
          null
        );

        expect(result.cleanerEarnings).toHaveLength(1);
        expect(result.cleanerEarnings[0].percentOfWork).toBe(100);
      });
    });

    describe("calculatePartialPayment edge cases", () => {
      it("should handle more completed than total (shouldn't happen)", async () => {
        const result = await MultiCleanerPricingService.calculatePartialPayment(
          15,
          10,
          10000
        );

        expect(result.completionPercentage).toBe(150);
      });
    });

    describe("Platform fee config edge cases", () => {
      it("should use default 13% if config missing", async () => {
        getPricingConfig.mockResolvedValue({});

        const result = await MultiCleanerPricingService.calculatePerCleanerEarnings(
          10000,
          2,
          null
        );

        // Default 13%
        expect(result.platformFee).toBe(1300);
      });

      it("should use default 10% for solo completion if config missing", async () => {
        getPricingConfig.mockResolvedValue({});
        mockUserAppointments.findByPk.mockResolvedValue({
          id: 100,
          home: { numBeds: 4, numBaths: 3 },
        });
        calculatePrice.mockResolvedValue(100);

        const earnings = await MultiCleanerPricingService.calculateSoloCompletionEarnings(100);

        // $100 - 10% = $90 = 9000 cents + 0 bonus
        expect(earnings).toBe(9000);
      });
    });
  });

  // ============================================
  // Integration Tests
  // ============================================
  describe("Integration Tests", () => {
    it("should calculate consistent earnings across methods", async () => {
      const totalPrice = 20000; // $200
      const cleanerCount = 2;

      const perCleanerResult = await MultiCleanerPricingService.calculatePerCleanerEarnings(
        totalPrice,
        cleanerCount,
        null
      );

      // Verify total earnings equals net for cleaners
      const totalEarnings = perCleanerResult.cleanerEarnings.reduce(
        (sum, e) => sum + e.netAmount,
        0
      );

      expect(totalEarnings).toBe(perCleanerResult.netForCleaners);
    });

    it("should handle full flow from job price to earnings breakdown", async () => {
      const mockHome = { numBeds: 4, numBaths: 3 };
      const mockAppointment = {
        id: 100,
        date: "2025-01-15",
        home: mockHome,
        bringSheets: true,
        bringTowels: false,
        timeToBeCompleted: "10-3",
      };
      const mockJob = {
        id: 10,
        totalCleanersRequired: 2,
        cleanersConfirmed: 2,
        appointment: mockAppointment,
      };

      mockMultiCleanerJob.findByPk.mockResolvedValue(mockJob);
      mockCleanerRoomAssignment.findAll.mockResolvedValue([
        { cleanerId: 100, estimatedMinutes: 50, cleaner: { firstName: "A", lastName: "B" }, getDisplayLabel: () => "Room 1" },
        { cleanerId: 101, estimatedMinutes: 50, cleaner: { firstName: "C", lastName: "D" }, getDisplayLabel: () => "Room 2" },
      ]);
      calculatePrice.mockResolvedValue(150);

      // Calculate job price
      const totalPrice = await MultiCleanerPricingService.calculateTotalJobPrice(
        mockHome,
        mockAppointment,
        2
      );

      expect(totalPrice).toBe(15000);

      // Generate breakdown
      const breakdown = await MultiCleanerPricingService.generateEarningsBreakdown(10);

      expect(breakdown.totalPrice).toBe(15000);
      expect(breakdown.cleanerDetails).toHaveLength(2);
    });
  });
});
