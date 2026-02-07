/**
 * Tests for PayoutSerializer
 * Tests serialization of payout data including tier perks fields
 */

const PayoutSerializer = require("../../serializers/PayoutSerializer");

describe("PayoutSerializer", () => {
  describe("serializeForCleanerView", () => {
    it("should serialize basic payout fields", () => {
      const payout = {
        dataValues: {
          id: 1,
          appointmentId: 100,
          netAmount: 9000,
          status: "completed",
          completedAt: new Date("2024-01-15"),
          createdAt: new Date("2024-01-14"),
        },
      };

      const result = PayoutSerializer.serializeForCleanerView(payout);

      expect(result.id).toBe(1);
      expect(result.appointmentId).toBe(100);
      expect(result.netAmount).toBe(9000);
      expect(result.status).toBe("completed");
    });

    it("should include preferred bonus fields", () => {
      const payout = {
        dataValues: {
          id: 1,
          netAmount: 9050,
          preferredBonusApplied: true,
          preferredBonusPercent: 5,
          preferredBonusAmount: 50,
          cleanerTierAtPayout: "gold",
          isPreferredHomeJob: true,
        },
      };

      const result = PayoutSerializer.serializeForCleanerView(payout);

      expect(result.preferredBonusApplied).toBe(true);
      expect(result.preferredBonusPercent).toBe(5);
      expect(result.preferredBonusAmount).toBe(50);
      expect(result.cleanerTierAtPayout).toBe("gold");
      expect(result.isPreferredHomeJob).toBe(true);
    });

    it("should include payout priority fields", () => {
      const payout = {
        dataValues: {
          id: 1,
          netAmount: 9050,
          status: "processing",
          payoutPriority: "high",
          expectedPayoutHours: 24,
          cleanerTierAtPayout: "gold",
        },
      };

      const result = PayoutSerializer.serializeForCleanerView(payout);

      expect(result.payoutPriority).toBe("high");
      expect(result.expectedPayoutHours).toBe(24);
    });

    it("should return normal priority for non-gold/platinum tiers", () => {
      const payout = {
        dataValues: {
          id: 1,
          netAmount: 9000,
          status: "processing",
          payoutPriority: "normal",
          expectedPayoutHours: 48,
          cleanerTierAtPayout: "silver",
        },
      };

      const result = PayoutSerializer.serializeForCleanerView(payout);

      expect(result.payoutPriority).toBe("normal");
      expect(result.expectedPayoutHours).toBe(48);
      expect(result.cleanerTierAtPayout).toBe("silver");
    });

    it("should calculate bonus amount in dollars", () => {
      const payout = {
        dataValues: {
          id: 1,
          netAmount: 9070,
          preferredBonusApplied: true,
          preferredBonusAmount: 70, // 70 cents
        },
      };

      const result = PayoutSerializer.serializeForCleanerView(payout);

      expect(result.preferredBonusAmountDollars).toBe("0.70");
    });

    it("should not include bonus dollars when no bonus", () => {
      const payout = {
        dataValues: {
          id: 1,
          netAmount: 9000,
          preferredBonusApplied: false,
          preferredBonusAmount: null,
        },
      };

      const result = PayoutSerializer.serializeForCleanerView(payout);

      expect(result.preferredBonusAmountDollars).toBeUndefined();
    });

    it("should handle payout without dataValues wrapper", () => {
      const payout = {
        id: 1,
        netAmount: 9050,
        payoutPriority: "high",
        expectedPayoutHours: 24,
      };

      const result = PayoutSerializer.serializeForCleanerView(payout);

      expect(result.id).toBe(1);
      expect(result.payoutPriority).toBe("high");
      expect(result.expectedPayoutHours).toBe(24);
    });

    it("should include payment timeline fields", () => {
      const payout = {
        dataValues: {
          id: 1,
          netAmount: 9000,
          paymentCapturedAt: new Date("2024-01-14T10:00:00Z"),
          transferInitiatedAt: new Date("2024-01-14T12:00:00Z"),
        },
      };

      const result = PayoutSerializer.serializeForCleanerView(payout);

      expect(result.paymentCapturedAt).toBeDefined();
      expect(result.transferInitiatedAt).toBeDefined();
    });

    it("should serialize all tier-related fields for platinum payout", () => {
      const payout = {
        dataValues: {
          id: 1,
          appointmentId: 100,
          netAmount: 9070,
          status: "processing",
          preferredBonusApplied: true,
          preferredBonusPercent: 7,
          preferredBonusAmount: 70,
          cleanerTierAtPayout: "platinum",
          isPreferredHomeJob: true,
          payoutPriority: "high",
          expectedPayoutHours: 24,
          createdAt: new Date(),
        },
      };

      const result = PayoutSerializer.serializeForCleanerView(payout);

      // Bonus fields
      expect(result.preferredBonusApplied).toBe(true);
      expect(result.preferredBonusPercent).toBe(7);
      expect(result.preferredBonusAmount).toBe(70);
      expect(result.preferredBonusAmountDollars).toBe("0.70");
      expect(result.cleanerTierAtPayout).toBe("platinum");

      // Priority fields
      expect(result.payoutPriority).toBe("high");
      expect(result.expectedPayoutHours).toBe(24);
    });
  });

  describe("serializeForOwnerView", () => {
    it("should include all fields for owner view", () => {
      const payout = {
        dataValues: {
          id: 1,
          cleanerId: 50,
          appointmentId: 100,
          amount: 100,
          netAmount: 9070,
          platformFee: 930,
          status: "completed",
          preferredBonusApplied: true,
          preferredBonusPercent: 7,
          preferredBonusAmount: 70,
          cleanerTierAtPayout: "platinum",
          payoutPriority: "high",
          expectedPayoutHours: 24,
        },
      };

      const result = PayoutSerializer.serializeForOwnerView(payout);

      expect(result.cleanerId).toBe(50);
      expect(result.platformFee).toBe(930);
      expect(result.preferredBonusApplied).toBe(true);
      expect(result.cleanerTierAtPayout).toBe("platinum");
    });
  });

  describe("Edge cases", () => {
    it("should handle null bonus percent gracefully", () => {
      const payout = {
        dataValues: {
          id: 1,
          netAmount: 9000,
          preferredBonusApplied: false,
          preferredBonusPercent: null,
          preferredBonusAmount: null,
        },
      };

      const result = PayoutSerializer.serializeForCleanerView(payout);

      expect(result.preferredBonusPercent).toBeNull();
    });

    it("should parse string bonus percent to float", () => {
      const payout = {
        dataValues: {
          id: 1,
          netAmount: 9050,
          preferredBonusApplied: true,
          preferredBonusPercent: "5.00", // Stored as string/decimal
          preferredBonusAmount: 50,
        },
      };

      const result = PayoutSerializer.serializeForCleanerView(payout);

      expect(result.preferredBonusPercent).toBe(5);
      expect(typeof result.preferredBonusPercent).toBe("number");
    });

    it("should handle missing optional fields", () => {
      const payout = {
        dataValues: {
          id: 1,
          netAmount: 9000,
          status: "completed",
        },
      };

      const result = PayoutSerializer.serializeForCleanerView(payout);

      expect(result.id).toBe(1);
      expect(result.preferredBonusApplied).toBeUndefined();
      expect(result.payoutPriority).toBeUndefined();
    });
  });
});
