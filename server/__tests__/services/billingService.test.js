/**
 * Billing Service Tests
 */

// Mock sequelize Op
jest.mock("sequelize", () => ({
  Op: {
    gt: Symbol("gt"),
  },
}));

// Mock models
jest.mock("../../models", () => ({
  UserBills: {
    findAll: jest.fn(),
  },
}));

const { UserBills } = require("../../models");
const {
  applyMonthlyInterest,
  startBillingScheduler,
  stopBillingScheduler,
  MONTHLY_INTEREST_RATE,
} = require("../../services/billingService");

describe("Billing Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    stopBillingScheduler();
    jest.useRealTimers();
  });

  describe("MONTHLY_INTEREST_RATE", () => {
    it("should be 10%", () => {
      expect(MONTHLY_INTEREST_RATE).toBe(0.10);
    });
  });

  describe("applyMonthlyInterest", () => {
    it("should apply 10% interest to all unpaid cancellation fees", async () => {
      const mockBill1 = {
        userId: 1,
        cancellationFee: 100,
        totalDue: 200,
        update: jest.fn().mockResolvedValue(true),
      };
      const mockBill2 = {
        userId: 2,
        cancellationFee: 50,
        totalDue: 75,
        update: jest.fn().mockResolvedValue(true),
      };

      UserBills.findAll.mockResolvedValue([mockBill1, mockBill2]);

      const result = await applyMonthlyInterest();

      expect(result.billsUpdated).toBe(2);
      expect(result.totalInterestApplied).toBe(15); // 10 + 5

      // Check bill 1: 100 + 10% = 110
      expect(mockBill1.update).toHaveBeenCalledWith({
        cancellationFee: 110,
        totalDue: 210,
      });

      // Check bill 2: 50 + 10% = 55
      expect(mockBill2.update).toHaveBeenCalledWith({
        cancellationFee: 55,
        totalDue: 80,
      });
    });

    it("should handle no bills with fees", async () => {
      UserBills.findAll.mockResolvedValue([]);

      const result = await applyMonthlyInterest();

      expect(result.billsUpdated).toBe(0);
      expect(result.totalInterestApplied).toBe(0);
    });

    it("should round interest to cents", async () => {
      const mockBill = {
        userId: 1,
        cancellationFee: 33.33, // 10% = 3.333, should round to 3.33
        totalDue: 33.33,
        update: jest.fn().mockResolvedValue(true),
      };

      UserBills.findAll.mockResolvedValue([mockBill]);

      await applyMonthlyInterest();

      expect(mockBill.update).toHaveBeenCalledWith({
        cancellationFee: 36.66,
        totalDue: 36.66,
      });
    });

    it("should handle database errors", async () => {
      UserBills.findAll.mockRejectedValue(new Error("Database error"));

      await expect(applyMonthlyInterest()).rejects.toThrow("Database error");
    });

    it("should log progress for each bill", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const mockBill = {
        userId: 1,
        cancellationFee: 25,
        totalDue: 25,
        update: jest.fn().mockResolvedValue(true),
      };

      UserBills.findAll.mockResolvedValue([mockBill]);

      await applyMonthlyInterest();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("User 1: $25 + $2.5 interest = $27.5")
      );

      consoleSpy.mockRestore();
    });

    it("should compound interest correctly over multiple months", async () => {
      // Simulate 3 months of interest on $100
      // Month 1: 100 + 10% = 110
      // Month 2: 110 + 10% = 121
      // Month 3: 121 + 10% = 133.1

      let currentFee = 100;
      let currentTotal = 100;

      const mockBill = {
        userId: 1,
        get cancellationFee() { return currentFee; },
        get totalDue() { return currentTotal; },
        update: jest.fn().mockImplementation(({ cancellationFee, totalDue }) => {
          currentFee = cancellationFee;
          currentTotal = totalDue;
          return Promise.resolve(true);
        }),
      };

      // Month 1
      UserBills.findAll.mockResolvedValue([mockBill]);
      await applyMonthlyInterest();
      expect(currentFee).toBe(110);

      // Month 2
      await applyMonthlyInterest();
      expect(currentFee).toBe(121);

      // Month 3
      await applyMonthlyInterest();
      expect(currentFee).toBe(133.1);
    });
  });

  describe("startBillingScheduler / stopBillingScheduler", () => {
    it("should start billing scheduler and log info", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      startBillingScheduler();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Billing] Scheduler initialized:")
      );

      consoleSpy.mockRestore();
    });

    it("should not start multiple schedulers", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      startBillingScheduler();
      startBillingScheduler();

      expect(consoleSpy).toHaveBeenCalledWith("[Billing] Scheduler already running");

      consoleSpy.mockRestore();
    });

    it("should stop scheduler", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      startBillingScheduler();
      stopBillingScheduler();

      expect(consoleSpy).toHaveBeenCalledWith("[Billing] Scheduler stopped");

      consoleSpy.mockRestore();
    });
  });
});
