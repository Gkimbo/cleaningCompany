/**
 * Billing Service Tests - Preferred Cleaner Perk Integration
 * Tests for perk bonus application in cleaner payouts
 */

// Create shared mock objects
const mockStripe = {
  customers: {
    retrieve: jest.fn(),
  },
  paymentIntents: {
    create: jest.fn(),
    capture: jest.fn(),
    retrieve: jest.fn(),
  },
  transfers: {
    create: jest.fn(),
  },
};

// Mock stripe
jest.mock("stripe", () => {
  return jest.fn(() => mockStripe);
});

// Mock PreferredCleanerPerksService
jest.mock("../../services/PreferredCleanerPerksService", () => ({
  calculatePayoutBonus: jest.fn(),
  recalculateTier: jest.fn(),
  isPreferredAtHome: jest.fn(),
}));

// Mock models
const mockModels = {
  User: {
    findByPk: jest.fn(),
  },
  UserBills: {
    findOne: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  UserCleanerAppointments: {
    findOne: jest.fn(),
  },
  JobPhoto: {
    count: jest.fn(),
  },
  StripeConnectAccount: {
    findOne: jest.fn(),
  },
  Payout: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Payment: {
    create: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  UserHomes: {},
  HomePreferredCleaner: {
    findOne: jest.fn(),
  },
  CleanerPreferredPerks: {
    findOne: jest.fn(),
  },
  PreferredPerksConfig: {
    findOne: jest.fn(),
  },
  EmployeeJobAssignment: {
    findOne: jest.fn(),
  },
  BusinessEmployee: {},
};

// Mock node-cron
jest.mock("node-cron", () => ({
  schedule: jest.fn(),
}));

// Mock businessConfig
jest.mock("../../config/businessConfig", () => ({
  getPricingConfig: jest.fn().mockResolvedValue({
    platform: { feePercent: 0.10, businessOwnerFeePercent: 0.10 },
  }),
}));

const BillingService = require("../../services/billingService");
const PreferredCleanerPerksService = require("../../services/PreferredCleanerPerksService");

describe("Billing Service - Preferred Cleaner Perk Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("processCleanerPayout with preferred cleaner bonus", () => {
    const createMockAppointment = (overrides = {}) => ({
      id: 1,
      homeId: 1,
      employeesAssigned: ["100"],
      amountPaid: 10000, // $100 in cents
      paymentIntentId: "pi_123",
      ...overrides,
    });

    const createMockPayoutUpdate = () => jest.fn().mockResolvedValue(true);

    it("should apply silver tier bonus (3%) to preferred home job", async () => {
      const appointment = createMockAppointment();
      const payoutUpdate = createMockPayoutUpdate();

      mockModels.StripeConnectAccount.findOne.mockResolvedValue({
        userId: 100,
        stripeAccountId: "acct_123",
      });

      mockModels.Payout.findOne.mockResolvedValue(null);
      mockModels.Payout.create.mockResolvedValue({
        id: 1,
        update: payoutUpdate,
      });

      // Mock the bonus calculation for silver tier
      PreferredCleanerPerksService.calculatePayoutBonus.mockResolvedValue({
        isPreferredJob: true,
        bonusApplied: true,
        bonusPercent: 3,
        bonusAmountCents: 30, // 3% of $10 platform fee
        tierLevel: "silver",
        originalPlatformFee: 1000, // $10
        adjustedPlatformFee: 970, // $9.70
        adjustedNetAmount: 9030, // $90.30
      });

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: "ch_123",
      });

      mockStripe.transfers.create.mockResolvedValue({
        id: "tr_123",
      });

      mockModels.Payment.create.mockResolvedValue({});

      const result = await BillingService.processCleanerPayout(
        appointment,
        mockModels
      );

      expect(result.success).toBe(true);
      expect(result.payouts[0].success).toBe(true);
      expect(result.payouts[0].amount).toBe(90.30); // $90.30 (with 3% bonus)

      // Verify payout was created with bonus fields
      expect(mockModels.Payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isPreferredHomeJob: true,
          preferredBonusApplied: true,
          preferredBonusPercent: 3,
          preferredBonusAmount: 30,
          cleanerTierAtPayout: "silver",
        })
      );

      // Verify transfer was for the correct amount (with bonus)
      expect(mockStripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 9030, // $90.30 in cents
        })
      );
    });

    it("should apply gold tier bonus (5%) to preferred home job", async () => {
      const appointment = createMockAppointment();
      const payoutUpdate = createMockPayoutUpdate();

      mockModels.StripeConnectAccount.findOne.mockResolvedValue({
        userId: 100,
        stripeAccountId: "acct_123",
      });

      mockModels.Payout.findOne.mockResolvedValue(null);
      mockModels.Payout.create.mockResolvedValue({
        id: 1,
        update: payoutUpdate,
      });

      // Mock the bonus calculation for gold tier
      PreferredCleanerPerksService.calculatePayoutBonus.mockResolvedValue({
        isPreferredJob: true,
        bonusApplied: true,
        bonusPercent: 5,
        bonusAmountCents: 50, // 5% of $10 platform fee
        tierLevel: "gold",
        originalPlatformFee: 1000,
        adjustedPlatformFee: 950, // $9.50
        adjustedNetAmount: 9050, // $90.50
      });

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: "ch_123",
      });

      mockStripe.transfers.create.mockResolvedValue({
        id: "tr_123",
      });

      mockModels.Payment.create.mockResolvedValue({});

      const result = await BillingService.processCleanerPayout(
        appointment,
        mockModels
      );

      expect(result.payouts[0].amount).toBe(90.50);

      expect(mockModels.Payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredBonusPercent: 5,
          cleanerTierAtPayout: "gold",
        })
      );
    });

    it("should apply platinum tier bonus (7%) to preferred home job", async () => {
      const appointment = createMockAppointment();
      const payoutUpdate = createMockPayoutUpdate();

      mockModels.StripeConnectAccount.findOne.mockResolvedValue({
        userId: 100,
        stripeAccountId: "acct_123",
      });

      mockModels.Payout.findOne.mockResolvedValue(null);
      mockModels.Payout.create.mockResolvedValue({
        id: 1,
        update: payoutUpdate,
      });

      // Mock the bonus calculation for platinum tier
      PreferredCleanerPerksService.calculatePayoutBonus.mockResolvedValue({
        isPreferredJob: true,
        bonusApplied: true,
        bonusPercent: 7,
        bonusAmountCents: 70, // 7% of $10 platform fee
        tierLevel: "platinum",
        originalPlatformFee: 1000,
        adjustedPlatformFee: 930, // $9.30
        adjustedNetAmount: 9070, // $90.70
      });

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: "ch_123",
      });

      mockStripe.transfers.create.mockResolvedValue({
        id: "tr_123",
      });

      mockModels.Payment.create.mockResolvedValue({});

      const result = await BillingService.processCleanerPayout(
        appointment,
        mockModels
      );

      expect(result.payouts[0].amount).toBe(90.70);

      expect(mockModels.Payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredBonusPercent: 7,
          cleanerTierAtPayout: "platinum",
        })
      );
    });

    it("should not apply bonus for non-preferred home job", async () => {
      const appointment = createMockAppointment();
      const payoutUpdate = createMockPayoutUpdate();

      mockModels.StripeConnectAccount.findOne.mockResolvedValue({
        userId: 100,
        stripeAccountId: "acct_123",
      });

      mockModels.Payout.findOne.mockResolvedValue(null);
      mockModels.Payout.create.mockResolvedValue({
        id: 1,
        update: payoutUpdate,
      });

      // Mock the bonus calculation for non-preferred job
      PreferredCleanerPerksService.calculatePayoutBonus.mockResolvedValue({
        isPreferredJob: false,
        bonusApplied: false,
        bonusPercent: 0,
        bonusAmountCents: 0,
        tierLevel: null,
        adjustedPlatformFee: 1000, // $10
        adjustedNetAmount: 9000, // $90
      });

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: "ch_123",
      });

      mockStripe.transfers.create.mockResolvedValue({
        id: "tr_123",
      });

      mockModels.Payment.create.mockResolvedValue({});

      const result = await BillingService.processCleanerPayout(
        appointment,
        mockModels
      );

      expect(result.payouts[0].amount).toBe(90.00);

      expect(mockModels.Payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isPreferredHomeJob: false,
          preferredBonusApplied: false,
          preferredBonusPercent: null,
          preferredBonusAmount: null,
          cleanerTierAtPayout: null,
        })
      );
    });

    it("should not apply bonus for bronze tier (0%)", async () => {
      const appointment = createMockAppointment();
      const payoutUpdate = createMockPayoutUpdate();

      mockModels.StripeConnectAccount.findOne.mockResolvedValue({
        userId: 100,
        stripeAccountId: "acct_123",
      });

      mockModels.Payout.findOne.mockResolvedValue(null);
      mockModels.Payout.create.mockResolvedValue({
        id: 1,
        update: payoutUpdate,
      });

      // Mock the bonus calculation for bronze tier (0% bonus)
      PreferredCleanerPerksService.calculatePayoutBonus.mockResolvedValue({
        isPreferredJob: true,
        bonusApplied: false,
        bonusPercent: 0,
        bonusAmountCents: 0,
        tierLevel: "bronze",
        adjustedPlatformFee: 1000, // $10
        adjustedNetAmount: 9000, // $90
      });

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: "ch_123",
      });

      mockStripe.transfers.create.mockResolvedValue({
        id: "tr_123",
      });

      mockModels.Payment.create.mockResolvedValue({});

      const result = await BillingService.processCleanerPayout(
        appointment,
        mockModels
      );

      expect(result.payouts[0].amount).toBe(90.00);

      expect(mockModels.Payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isPreferredHomeJob: true,
          preferredBonusApplied: false,
          cleanerTierAtPayout: "bronze",
        })
      );
    });

    it("should update existing payout with bonus fields", async () => {
      const appointment = createMockAppointment();
      const existingPayoutUpdate = jest.fn().mockResolvedValue(true);

      mockModels.StripeConnectAccount.findOne.mockResolvedValue({
        userId: 100,
        stripeAccountId: "acct_123",
      });

      // Return existing payout
      mockModels.Payout.findOne.mockResolvedValue({
        id: 1,
        update: existingPayoutUpdate,
      });

      PreferredCleanerPerksService.calculatePayoutBonus.mockResolvedValue({
        isPreferredJob: true,
        bonusApplied: true,
        bonusPercent: 5,
        bonusAmountCents: 50,
        tierLevel: "gold",
        adjustedPlatformFee: 950,
        adjustedNetAmount: 9050,
      });

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: "ch_123",
      });

      mockStripe.transfers.create.mockResolvedValue({
        id: "tr_123",
      });

      mockModels.Payment.create.mockResolvedValue({});

      await BillingService.processCleanerPayout(appointment, mockModels);

      // Verify existing payout was updated
      expect(existingPayoutUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          isPreferredHomeJob: true,
          preferredBonusApplied: true,
          preferredBonusPercent: 5,
          preferredBonusAmount: 50,
          cleanerTierAtPayout: "gold",
        })
      );
    });

    it("should handle multiple cleaners with different tier bonuses", async () => {
      const appointment = createMockAppointment({
        employeesAssigned: ["100", "101"],
        amountPaid: 20000, // $200 total
      });

      mockModels.StripeConnectAccount.findOne
        .mockResolvedValueOnce({
          userId: 100,
          stripeAccountId: "acct_100",
        })
        .mockResolvedValueOnce({
          userId: 101,
          stripeAccountId: "acct_101",
        });

      mockModels.Payout.findOne.mockResolvedValue(null);
      mockModels.Payout.create.mockResolvedValue({
        id: 1,
        update: jest.fn().mockResolvedValue(true),
      });

      // Cleaner 100: Gold tier (5% bonus)
      // Cleaner 101: Not preferred
      PreferredCleanerPerksService.calculatePayoutBonus
        .mockResolvedValueOnce({
          isPreferredJob: true,
          bonusApplied: true,
          bonusPercent: 5,
          bonusAmountCents: 50, // 5% of $10 (per cleaner)
          tierLevel: "gold",
          adjustedPlatformFee: 950,
          adjustedNetAmount: 9050,
        })
        .mockResolvedValueOnce({
          isPreferredJob: false,
          bonusApplied: false,
          bonusPercent: 0,
          bonusAmountCents: 0,
          tierLevel: null,
          adjustedPlatformFee: 1000,
          adjustedNetAmount: 9000,
        });

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: "ch_123",
      });

      mockStripe.transfers.create.mockResolvedValue({
        id: "tr_123",
      });

      mockModels.Payment.create.mockResolvedValue({});

      const result = await BillingService.processCleanerPayout(
        appointment,
        mockModels
      );

      expect(result.payouts).toHaveLength(2);
      expect(result.payouts[0].amount).toBe(90.50); // Gold tier with bonus
      expect(result.payouts[1].amount).toBe(90.00); // No bonus
    });

    it("should handle large job amounts correctly", async () => {
      const appointment = createMockAppointment({
        amountPaid: 50000, // $500
      });

      mockModels.StripeConnectAccount.findOne.mockResolvedValue({
        userId: 100,
        stripeAccountId: "acct_123",
      });

      mockModels.Payout.findOne.mockResolvedValue(null);
      mockModels.Payout.create.mockResolvedValue({
        id: 1,
        update: jest.fn().mockResolvedValue(true),
      });

      // Gold tier: 5% of $50 platform fee = $2.50 bonus
      PreferredCleanerPerksService.calculatePayoutBonus.mockResolvedValue({
        isPreferredJob: true,
        bonusApplied: true,
        bonusPercent: 5,
        bonusAmountCents: 250, // 5% of $50
        tierLevel: "gold",
        adjustedPlatformFee: 4750, // $50 - $2.50
        adjustedNetAmount: 45250, // $500 - $47.50
      });

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: "ch_123",
      });

      mockStripe.transfers.create.mockResolvedValue({
        id: "tr_123",
      });

      mockModels.Payment.create.mockResolvedValue({});

      const result = await BillingService.processCleanerPayout(
        appointment,
        mockModels
      );

      expect(result.payouts[0].amount).toBe(452.50);

      expect(mockStripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 45250, // $452.50 in cents
        })
      );
    });

    it("should set high priority for gold tier with fasterPayouts", async () => {
      const appointment = createMockAppointment();
      const payoutUpdate = createMockPayoutUpdate();

      mockModels.StripeConnectAccount.findOne.mockResolvedValue({
        userId: 100,
        stripeAccountId: "acct_123",
      });

      mockModels.Payout.findOne.mockResolvedValue(null);
      mockModels.Payout.create.mockResolvedValue({
        id: 1,
        update: payoutUpdate,
      });

      PreferredCleanerPerksService.calculatePayoutBonus.mockResolvedValue({
        isPreferredJob: true,
        bonusApplied: true,
        bonusPercent: 5,
        bonusAmountCents: 50,
        tierLevel: "gold",
        adjustedPlatformFee: 950,
        adjustedNetAmount: 9050,
        fasterPayouts: true,
        payoutHours: 24,
      });

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: "ch_123",
      });

      mockStripe.transfers.create.mockResolvedValue({
        id: "tr_123",
      });

      mockModels.Payment.create.mockResolvedValue({});

      await BillingService.processCleanerPayout(appointment, mockModels);

      expect(mockModels.Payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payoutPriority: "high",
          expectedPayoutHours: 24,
        })
      );
    });

    it("should set normal priority for silver tier without fasterPayouts", async () => {
      const appointment = createMockAppointment();
      const payoutUpdate = createMockPayoutUpdate();

      mockModels.StripeConnectAccount.findOne.mockResolvedValue({
        userId: 100,
        stripeAccountId: "acct_123",
      });

      mockModels.Payout.findOne.mockResolvedValue(null);
      mockModels.Payout.create.mockResolvedValue({
        id: 1,
        update: payoutUpdate,
      });

      PreferredCleanerPerksService.calculatePayoutBonus.mockResolvedValue({
        isPreferredJob: true,
        bonusApplied: true,
        bonusPercent: 3,
        bonusAmountCents: 30,
        tierLevel: "silver",
        adjustedPlatformFee: 970,
        adjustedNetAmount: 9030,
        fasterPayouts: false,
        payoutHours: 48,
      });

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: "ch_123",
      });

      mockStripe.transfers.create.mockResolvedValue({
        id: "tr_123",
      });

      mockModels.Payment.create.mockResolvedValue({});

      await BillingService.processCleanerPayout(appointment, mockModels);

      expect(mockModels.Payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payoutPriority: "normal",
          expectedPayoutHours: 48,
        })
      );
    });

    it("should set normal priority when owner disables gold fasterPayouts", async () => {
      const appointment = createMockAppointment();
      const payoutUpdate = createMockPayoutUpdate();

      mockModels.StripeConnectAccount.findOne.mockResolvedValue({
        userId: 100,
        stripeAccountId: "acct_123",
      });

      mockModels.Payout.findOne.mockResolvedValue(null);
      mockModels.Payout.create.mockResolvedValue({
        id: 1,
        update: payoutUpdate,
      });

      // Owner has disabled fasterPayouts for gold tier
      PreferredCleanerPerksService.calculatePayoutBonus.mockResolvedValue({
        isPreferredJob: true,
        bonusApplied: true,
        bonusPercent: 5,
        bonusAmountCents: 50,
        tierLevel: "gold",
        adjustedPlatformFee: 950,
        adjustedNetAmount: 9050,
        fasterPayouts: false, // Owner disabled
        payoutHours: 48,
      });

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: "ch_123",
      });

      mockStripe.transfers.create.mockResolvedValue({
        id: "tr_123",
      });

      mockModels.Payment.create.mockResolvedValue({});

      await BillingService.processCleanerPayout(appointment, mockModels);

      expect(mockModels.Payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payoutPriority: "normal",
          expectedPayoutHours: 48,
          cleanerTierAtPayout: "gold",
        })
      );
    });

    it("should set high priority for platinum tier", async () => {
      const appointment = createMockAppointment();
      const payoutUpdate = createMockPayoutUpdate();

      mockModels.StripeConnectAccount.findOne.mockResolvedValue({
        userId: 100,
        stripeAccountId: "acct_123",
      });

      mockModels.Payout.findOne.mockResolvedValue(null);
      mockModels.Payout.create.mockResolvedValue({
        id: 1,
        update: payoutUpdate,
      });

      PreferredCleanerPerksService.calculatePayoutBonus.mockResolvedValue({
        isPreferredJob: true,
        bonusApplied: true,
        bonusPercent: 7,
        bonusAmountCents: 70,
        tierLevel: "platinum",
        adjustedPlatformFee: 930,
        adjustedNetAmount: 9070,
        fasterPayouts: true,
        payoutHours: 24,
      });

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: "ch_123",
      });

      mockStripe.transfers.create.mockResolvedValue({
        id: "tr_123",
      });

      mockModels.Payment.create.mockResolvedValue({});

      await BillingService.processCleanerPayout(appointment, mockModels);

      expect(mockModels.Payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payoutPriority: "high",
          expectedPayoutHours: 24,
          cleanerTierAtPayout: "platinum",
        })
      );
    });

    it("should default to normal priority when fasterPayouts undefined", async () => {
      const appointment = createMockAppointment();
      const payoutUpdate = createMockPayoutUpdate();

      mockModels.StripeConnectAccount.findOne.mockResolvedValue({
        userId: 100,
        stripeAccountId: "acct_123",
      });

      mockModels.Payout.findOne.mockResolvedValue(null);
      mockModels.Payout.create.mockResolvedValue({
        id: 1,
        update: payoutUpdate,
      });

      // fasterPayouts not included in response
      PreferredCleanerPerksService.calculatePayoutBonus.mockResolvedValue({
        isPreferredJob: false,
        bonusApplied: false,
        bonusPercent: 0,
        bonusAmountCents: 0,
        tierLevel: "bronze",
        adjustedPlatformFee: 1000,
        adjustedNetAmount: 9000,
        // fasterPayouts and payoutHours not included
      });

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        latest_charge: "ch_123",
      });

      mockStripe.transfers.create.mockResolvedValue({
        id: "tr_123",
      });

      mockModels.Payment.create.mockResolvedValue({});

      await BillingService.processCleanerPayout(appointment, mockModels);

      expect(mockModels.Payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payoutPriority: "normal",
          expectedPayoutHours: 48,
        })
      );
    });
  });
});
