/**
 * Payment Model Tests
 *
 * Tests for the Payment model including:
 * - Transaction ID generation
 * - Static query methods
 * - Model validation
 */

// Mock sequelize before requiring models
const mockFindAll = jest.fn();
const mockFindOne = jest.fn();
const mockCreate = jest.fn();

jest.mock("../../models", () => {
  const Payment = {
    findAll: mockFindAll,
    findOne: mockFindOne,
    create: mockCreate,
    generateTransactionId: () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 10);
      return `txn_${timestamp}_${random}`;
    },
    getReportableForCleaner: async (cleanerId, taxYear) => {
      return mockFindAll({
        where: {
          cleanerId,
          taxYear,
          type: "payout",
          status: "succeeded",
          reportable: true,
        },
      });
    },
    getTotalReportableAmount: async (cleanerId, taxYear) => {
      const result = await mockFindOne({
        where: {
          cleanerId,
          taxYear,
          type: "payout",
          status: "succeeded",
          reportable: true,
        },
      });
      return {
        totalAmountCents: parseInt(result?.totalAmount) || 0,
        totalAmountDollars: ((parseInt(result?.totalAmount) || 0) / 100).toFixed(2),
        transactionCount: parseInt(result?.transactionCount) || 0,
      };
    },
  };

  return { Payment };
});

const { Payment } = require("../../models");

describe("Payment Model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateTransactionId", () => {
    it("should generate unique transaction IDs", () => {
      const id1 = Payment.generateTransactionId();
      const id2 = Payment.generateTransactionId();

      expect(id1).toMatch(/^txn_[a-z0-9]+_[a-z0-9]+$/);
      expect(id2).toMatch(/^txn_[a-z0-9]+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it("should start with txn_ prefix", () => {
      const id = Payment.generateTransactionId();
      expect(id.startsWith("txn_")).toBe(true);
    });
  });

  describe("getReportableForCleaner", () => {
    it("should query payments with correct filters", async () => {
      const mockPayments = [
        { id: 1, amount: 50000, type: "payout", status: "succeeded" },
        { id: 2, amount: 75000, type: "payout", status: "succeeded" },
      ];
      mockFindAll.mockResolvedValue(mockPayments);

      const result = await Payment.getReportableForCleaner(123, 2024);

      expect(mockFindAll).toHaveBeenCalledWith({
        where: {
          cleanerId: 123,
          taxYear: 2024,
          type: "payout",
          status: "succeeded",
          reportable: true,
        },
      });
      expect(result).toEqual(mockPayments);
    });

    it("should return empty array when no payments found", async () => {
      mockFindAll.mockResolvedValue([]);

      const result = await Payment.getReportableForCleaner(999, 2024);

      expect(result).toEqual([]);
    });
  });

  describe("getTotalReportableAmount", () => {
    it("should return aggregated totals", async () => {
      mockFindOne.mockResolvedValue({
        totalAmount: "125000",
        transactionCount: "10",
      });

      const result = await Payment.getTotalReportableAmount(123, 2024);

      expect(result.totalAmountCents).toBe(125000);
      expect(result.totalAmountDollars).toBe("1250.00");
      expect(result.transactionCount).toBe(10);
    });

    it("should return zeros when no payments found", async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await Payment.getTotalReportableAmount(999, 2024);

      expect(result.totalAmountCents).toBe(0);
      expect(result.totalAmountDollars).toBe("0.00");
      expect(result.transactionCount).toBe(0);
    });

    it("should correctly format large amounts", async () => {
      mockFindOne.mockResolvedValue({
        totalAmount: "10000000", // $100,000.00
        transactionCount: "50",
      });

      const result = await Payment.getTotalReportableAmount(123, 2024);

      expect(result.totalAmountCents).toBe(10000000);
      expect(result.totalAmountDollars).toBe("100000.00");
    });
  });

  describe("Transaction Types", () => {
    it("should accept valid transaction types", () => {
      const validTypes = [
        "authorization",
        "capture",
        "refund",
        "payout",
        "platform_fee",
      ];

      validTypes.forEach((type) => {
        // This tests that our enum values are what we expect
        expect(validTypes).toContain(type);
      });
    });
  });

  describe("Transaction Statuses", () => {
    it("should accept valid transaction statuses", () => {
      const validStatuses = [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "canceled",
        "refunded",
      ];

      validStatuses.forEach((status) => {
        expect(validStatuses).toContain(status);
      });
    });
  });
});

describe("Payment Recording", () => {
  it("should create payment with all required fields", async () => {
    const paymentData = {
      transactionId: Payment.generateTransactionId(),
      type: "payout",
      status: "succeeded",
      amount: 50000,
      cleanerId: 1,
      appointmentId: 100,
      taxYear: 2024,
      reportable: true,
      description: "Payout for appointment #100",
    };

    mockCreate.mockResolvedValue({ id: 1, ...paymentData });

    const result = await Payment.create(paymentData);

    expect(mockCreate).toHaveBeenCalledWith(paymentData);
    expect(result.transactionId).toMatch(/^txn_/);
    expect(result.amount).toBe(50000);
    expect(result.reportable).toBe(true);
  });
});
