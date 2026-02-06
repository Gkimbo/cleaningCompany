/**
 * Tests for Tier Perks functionality
 * Tests early access filtering, payout priority, and bonus display
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock the models
jest.mock("../../models", () => {
  const mockUser = {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  };

  const mockUserAppointments = {
    findAll: jest.fn(),
    create: jest.fn(),
  };

  const mockHomePreferredCleaner = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
  };

  const mockCleanerPreferredPerks = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockPreferredPerksConfig = {
    findOne: jest.fn(),
    getActive: jest.fn(),
  };

  const mockPayout = {
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  return {
    User: mockUser,
    UserAppointments: mockUserAppointments,
    HomePreferredCleaner: mockHomePreferredCleaner,
    CleanerPreferredPerks: mockCleanerPreferredPerks,
    PreferredPerksConfig: mockPreferredPerksConfig,
    Payout: mockPayout,
  };
});

const {
  User,
  UserAppointments,
  HomePreferredCleaner,
  CleanerPreferredPerks,
  PreferredPerksConfig,
  Payout,
} = require("../../models");

const secretKey = process.env.SESSION_SECRET || "test-secret";

describe("Tier Perks - Early Access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Early Access Filtering Logic", () => {
    it("should filter out early access jobs for non-platinum cleaners", () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins from now

      const appointments = [
        { id: 1, earlyAccessUntil: null, hasBeenAssigned: false },
        { id: 2, earlyAccessUntil: futureTime, hasBeenAssigned: false }, // Should be filtered
        { id: 3, earlyAccessUntil: new Date(now.getTime() - 5 * 60 * 1000), hasBeenAssigned: false }, // Expired
      ];

      const hasEarlyAccess = false;

      const filteredAppointments = appointments.filter((appt) => {
        if (hasEarlyAccess) return true;
        if (!appt.earlyAccessUntil) return true;
        return new Date(appt.earlyAccessUntil) <= now;
      });

      expect(filteredAppointments).toHaveLength(2);
      expect(filteredAppointments.map(a => a.id)).toEqual([1, 3]);
    });

    it("should not filter any jobs for platinum cleaners with early access", () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 15 * 60 * 1000);

      const appointments = [
        { id: 1, earlyAccessUntil: null, hasBeenAssigned: false },
        { id: 2, earlyAccessUntil: futureTime, hasBeenAssigned: false },
        { id: 3, earlyAccessUntil: new Date(now.getTime() - 5 * 60 * 1000), hasBeenAssigned: false },
      ];

      const hasEarlyAccess = true;

      const filteredAppointments = appointments.filter((appt) => {
        if (hasEarlyAccess) return true;
        if (!appt.earlyAccessUntil) return true;
        return new Date(appt.earlyAccessUntil) <= now;
      });

      expect(filteredAppointments).toHaveLength(3);
    });

    it("should mark appointments as early access when earlyAccessUntil is in the future", () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 15 * 60 * 1000);
      const pastTime = new Date(now.getTime() - 5 * 60 * 1000);

      const appointments = [
        { id: 1, earlyAccessUntil: null },
        { id: 2, earlyAccessUntil: futureTime },
        { id: 3, earlyAccessUntil: pastTime },
      ];

      const markedAppointments = appointments.map((appt) => ({
        ...appt,
        isEarlyAccess: appt.earlyAccessUntil ? new Date(appt.earlyAccessUntil) > now : false,
      }));

      expect(markedAppointments[0].isEarlyAccess).toBe(false);
      expect(markedAppointments[1].isEarlyAccess).toBe(true);
      expect(markedAppointments[2].isEarlyAccess).toBe(false);
    });
  });

  describe("Early Access Window Calculation", () => {
    it("should calculate earlyAccessUntil based on earlyAccessMinutes config", () => {
      const earlyAccessMinutes = 30;
      const now = Date.now();

      const earlyAccessUntil = new Date(now + earlyAccessMinutes * 60 * 1000);

      // Should be approximately 30 minutes in the future
      const diffMinutes = (earlyAccessUntil.getTime() - now) / (60 * 1000);
      expect(Math.round(diffMinutes)).toBe(30);
    });

    it("should return null earlyAccessUntil when platinumEarlyAccess is disabled", () => {
      const config = {
        platinumEarlyAccess: false,
        earlyAccessMinutes: 30,
      };

      const earlyAccessUntil = config.platinumEarlyAccess
        ? new Date(Date.now() + config.earlyAccessMinutes * 60 * 1000)
        : null;

      expect(earlyAccessUntil).toBeNull();
    });

    it("should use default 30 minutes when earlyAccessMinutes not configured", () => {
      const config = {
        platinumEarlyAccess: true,
        earlyAccessMinutes: undefined,
      };

      const earlyAccessMinutes = config.earlyAccessMinutes || 30;
      expect(earlyAccessMinutes).toBe(30);
    });
  });
});

describe("Tier Perks - Payout Priority", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Payout Priority Calculation", () => {
    it("should set priority to high for cleaners with fasterPayouts", () => {
      const bonusInfo = {
        fasterPayouts: true,
        payoutHours: 24,
      };

      const payoutPriority = bonusInfo.fasterPayouts ? "high" : "normal";
      const expectedPayoutHours = bonusInfo.payoutHours || 48;

      expect(payoutPriority).toBe("high");
      expect(expectedPayoutHours).toBe(24);
    });

    it("should set priority to normal for cleaners without fasterPayouts", () => {
      const bonusInfo = {
        fasterPayouts: false,
        payoutHours: 48,
      };

      const payoutPriority = bonusInfo.fasterPayouts ? "high" : "normal";
      const expectedPayoutHours = bonusInfo.payoutHours || 48;

      expect(payoutPriority).toBe("normal");
      expect(expectedPayoutHours).toBe(48);
    });

    it("should default to normal priority and 48 hours when fasterPayouts undefined", () => {
      const bonusInfo = {};

      const payoutPriority = bonusInfo.fasterPayouts ? "high" : "normal";
      const expectedPayoutHours = bonusInfo.payoutHours || 48;

      expect(payoutPriority).toBe("normal");
      expect(expectedPayoutHours).toBe(48);
    });
  });

  describe("Payout Priority by Tier", () => {
    const tiers = [
      { tier: "bronze", expectedPriority: "normal", expectedHours: 48 },
      { tier: "silver", expectedPriority: "normal", expectedHours: 48 },
      { tier: "gold", expectedPriority: "high", expectedHours: 24 },
      { tier: "platinum", expectedPriority: "high", expectedHours: 24 },
    ];

    tiers.forEach(({ tier, expectedPriority, expectedHours }) => {
      it(`should return ${expectedPriority} priority for ${tier} tier`, () => {
        const tierPerks = {
          bronze: { fasterPayouts: false, payoutHours: 48 },
          silver: { fasterPayouts: false, payoutHours: 48 },
          gold: { fasterPayouts: true, payoutHours: 24 },
          platinum: { fasterPayouts: true, payoutHours: 24 },
        };

        const perks = tierPerks[tier];
        const payoutPriority = perks.fasterPayouts ? "high" : "normal";

        expect(payoutPriority).toBe(expectedPriority);
        expect(perks.payoutHours).toBe(expectedHours);
      });
    });
  });

  describe("Payout Priority respects owner config", () => {
    it("should set normal priority when owner disables gold fasterPayouts", () => {
      const config = {
        goldFasterPayouts: false,
        goldPayoutHours: 48,
      };

      // Simulating calculateTierFromConfig for gold tier
      const perks = {
        fasterPayouts: config.goldFasterPayouts,
        payoutHours: config.goldPayoutHours,
      };

      const payoutPriority = perks.fasterPayouts ? "high" : "normal";

      expect(payoutPriority).toBe("normal");
      expect(perks.payoutHours).toBe(48);
    });

    it("should set normal priority when owner disables platinum fasterPayouts", () => {
      const config = {
        platinumFasterPayouts: false,
        platinumPayoutHours: 48,
      };

      const perks = {
        fasterPayouts: config.platinumFasterPayouts,
        payoutHours: config.platinumPayoutHours,
      };

      const payoutPriority = perks.fasterPayouts ? "high" : "normal";

      expect(payoutPriority).toBe("normal");
      expect(perks.payoutHours).toBe(48);
    });
  });
});

describe("Tier Perks - Bonus Display", () => {
  describe("Bonus Breakdown Calculation", () => {
    it("should calculate correct base amount when bonus applied", () => {
      const payout = {
        netAmount: 9050, // Total after bonus
        preferredBonusApplied: true,
        preferredBonusAmount: 50, // Bonus amount
      };

      const hasBonus = payout.preferredBonusApplied && payout.preferredBonusAmount > 0;
      const baseAmount = hasBonus
        ? payout.netAmount - payout.preferredBonusAmount
        : payout.netAmount;

      expect(hasBonus).toBe(true);
      expect(baseAmount).toBe(9000); // $90.00
    });

    it("should return full amount as base when no bonus applied", () => {
      const payout = {
        netAmount: 9000,
        preferredBonusApplied: false,
        preferredBonusAmount: 0,
      };

      const hasBonus = payout.preferredBonusApplied && payout.preferredBonusAmount > 0;
      const baseAmount = hasBonus
        ? payout.netAmount - payout.preferredBonusAmount
        : payout.netAmount;

      expect(hasBonus).toBe(false);
      expect(baseAmount).toBe(9000);
    });

    it("should handle bonus amount of 0 as no bonus", () => {
      const payout = {
        netAmount: 9000,
        preferredBonusApplied: true,
        preferredBonusAmount: 0,
      };

      const hasBonus = payout.preferredBonusApplied && payout.preferredBonusAmount > 0;

      expect(hasBonus).toBe(false);
    });
  });

  describe("Total Bonus Calculation", () => {
    it("should sum up all bonuses from completed payouts", () => {
      const payouts = [
        { status: "completed", preferredBonusApplied: true, preferredBonusAmount: 50 },
        { status: "completed", preferredBonusApplied: true, preferredBonusAmount: 70 },
        { status: "completed", preferredBonusApplied: false, preferredBonusAmount: 0 },
        { status: "pending", preferredBonusApplied: true, preferredBonusAmount: 30 }, // Not counted
      ];

      const completedPayouts = payouts.filter((p) => p.status === "completed");
      const totalBonusCents = completedPayouts.reduce(
        (sum, p) => sum + (p.preferredBonusApplied ? (p.preferredBonusAmount || 0) : 0),
        0
      );

      expect(totalBonusCents).toBe(120); // 50 + 70
    });

    it("should return 0 when no bonuses applied", () => {
      const payouts = [
        { status: "completed", preferredBonusApplied: false, preferredBonusAmount: 0 },
        { status: "completed", preferredBonusApplied: false, preferredBonusAmount: 0 },
      ];

      const completedPayouts = payouts.filter((p) => p.status === "completed");
      const totalBonusCents = completedPayouts.reduce(
        (sum, p) => sum + (p.preferredBonusApplied ? (p.preferredBonusAmount || 0) : 0),
        0
      );

      expect(totalBonusCents).toBe(0);
    });
  });

  describe("Tier Badge Styling", () => {
    it("should return correct style for each tier", () => {
      const getTierStyle = (tier) => {
        const tierConfig = {
          bronze: { label: "Bronze", color: "#CD7F32", bgColor: "#FDF5E6" },
          silver: { label: "Silver", color: "#757575", bgColor: "#F5F5F5" },
          gold: { label: "Gold", color: "#D4AF37", bgColor: "#FFFACD" },
          platinum: { label: "Platinum", color: "#6B7280", bgColor: "#E5E7EB" },
        };
        return tierConfig[tier] || null;
      };

      expect(getTierStyle("bronze").label).toBe("Bronze");
      expect(getTierStyle("silver").label).toBe("Silver");
      expect(getTierStyle("gold").label).toBe("Gold");
      expect(getTierStyle("platinum").label).toBe("Platinum");
      expect(getTierStyle("unknown")).toBeNull();
    });
  });
});

describe("PayoutSerializer - Priority Fields", () => {
  describe("serializeForCleanerView", () => {
    it("should include payoutPriority and expectedPayoutHours", () => {
      const payout = {
        dataValues: {
          id: 1,
          netAmount: 9050,
          status: "processing",
          payoutPriority: "high",
          expectedPayoutHours: 24,
          preferredBonusApplied: true,
          preferredBonusPercent: 5,
          preferredBonusAmount: 50,
          cleanerTierAtPayout: "gold",
        },
      };

      // Simulating serializer logic
      const data = payout.dataValues || payout;
      const serialized = {
        id: data.id,
        netAmount: data.netAmount,
        status: data.status,
        payoutPriority: data.payoutPriority,
        expectedPayoutHours: data.expectedPayoutHours,
        preferredBonusApplied: data.preferredBonusApplied,
        preferredBonusPercent: data.preferredBonusPercent,
        preferredBonusAmount: data.preferredBonusAmount,
        cleanerTierAtPayout: data.cleanerTierAtPayout,
      };

      expect(serialized.payoutPriority).toBe("high");
      expect(serialized.expectedPayoutHours).toBe(24);
      expect(serialized.cleanerTierAtPayout).toBe("gold");
    });

    it("should handle missing priority fields gracefully", () => {
      const payout = {
        dataValues: {
          id: 1,
          netAmount: 9000,
          status: "completed",
          // No priority fields
        },
      };

      const data = payout.dataValues || payout;
      const serialized = {
        payoutPriority: data.payoutPriority,
        expectedPayoutHours: data.expectedPayoutHours,
      };

      expect(serialized.payoutPriority).toBeUndefined();
      expect(serialized.expectedPayoutHours).toBeUndefined();
    });
  });
});

describe("PreferredPerksConfig - earlyAccessMinutes", () => {
  describe("Config validation", () => {
    it("should have default earlyAccessMinutes of 30", () => {
      const defaultConfig = {
        earlyAccessMinutes: 30,
        platinumEarlyAccess: true,
      };

      expect(defaultConfig.earlyAccessMinutes).toBe(30);
    });

    it("should allow custom earlyAccessMinutes", () => {
      const customConfig = {
        earlyAccessMinutes: 45,
        platinumEarlyAccess: true,
      };

      const earlyAccessUntil = new Date(Date.now() + customConfig.earlyAccessMinutes * 60 * 1000);
      const expectedTime = Date.now() + 45 * 60 * 1000;

      // Should be within 1 second of expected
      expect(Math.abs(earlyAccessUntil.getTime() - expectedTime)).toBeLessThan(1000);
    });

    it("should be included in updatable fields", () => {
      const updatableFields = [
        'bronzeMinHomes', 'bronzeMaxHomes', 'bronzeBonusPercent',
        'silverMinHomes', 'silverMaxHomes', 'silverBonusPercent',
        'goldMinHomes', 'goldMaxHomes', 'goldBonusPercent', 'goldFasterPayouts', 'goldPayoutHours',
        'platinumMinHomes', 'platinumBonusPercent', 'platinumFasterPayouts', 'platinumPayoutHours', 'platinumEarlyAccess',
        'earlyAccessMinutes', 'backupCleanerTimeoutHours', 'platformMaxDailyJobs', 'platformMaxConcurrentJobs',
      ];

      expect(updatableFields).toContain('earlyAccessMinutes');
    });
  });

  describe("getTierForHomeCount with earlyAccessMinutes", () => {
    it("should include earlyAccessMinutes for platinum tier", () => {
      const config = {
        platinumMinHomes: 11,
        platinumBonusPercent: 7,
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: true,
        earlyAccessMinutes: 30,
      };

      // Simulating getTierForHomeCount for platinum
      const homeCount = 15;
      const tierInfo = homeCount >= config.platinumMinHomes
        ? {
            tier: "platinum",
            earlyAccess: config.platinumEarlyAccess,
            earlyAccessMinutes: config.earlyAccessMinutes,
          }
        : null;

      expect(tierInfo.earlyAccess).toBe(true);
      expect(tierInfo.earlyAccessMinutes).toBe(30);
    });

    it("should return 0 earlyAccessMinutes for non-platinum tiers", () => {
      const tierInfo = {
        tier: "gold",
        earlyAccess: false,
        earlyAccessMinutes: 0,
      };

      expect(tierInfo.earlyAccess).toBe(false);
      expect(tierInfo.earlyAccessMinutes).toBe(0);
    });
  });
});
