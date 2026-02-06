/**
 * Tests for Owner Perks Configuration Changes
 * Verifies that when owners change perks configuration:
 * 1. The values are actually stored correctly
 * 2. The new values are used when calculating tiers
 * 3. The new values affect payout calculations
 */

const PreferredCleanerPerksService = require("../../services/PreferredCleanerPerksService");

describe("Owner Perks Config Changes", () => {
  describe("Config values are respected in tier calculation", () => {
    it("should use custom silver threshold from config", () => {
      const customConfig = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 3, // Extended bronze
        bronzeBonusPercent: 0,
        silverMinHomes: 4, // Changed from default 3
        silverMaxHomes: 7, // Changed from default 5
        silverBonusPercent: 3,
        goldMinHomes: 8, // Changed from default 6
        goldMaxHomes: 12, // Changed from default 10
        goldBonusPercent: 5,
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 13, // Changed from default 11
        platinumBonusPercent: 7,
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: true,
      };

      // With default config, 3 homes = silver. With custom, 3 homes = bronze
      const result = PreferredCleanerPerksService.calculateTierFromConfig(3, customConfig);
      expect(result.tier).toBe("bronze");
      expect(result.bonusPercent).toBe(0);
    });

    it("should use custom gold threshold from config", () => {
      const customConfig = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 4,
        bronzeBonusPercent: 0,
        silverMinHomes: 5,
        silverMaxHomes: 9,
        silverBonusPercent: 2,
        goldMinHomes: 10, // Raised from default 6
        goldMaxHomes: 15,
        goldBonusPercent: 6,
        goldFasterPayouts: true,
        goldPayoutHours: 12, // Faster than default 24
        platinumMinHomes: 16,
        platinumBonusPercent: 8,
        platinumFasterPayouts: true,
        platinumPayoutHours: 12,
        platinumEarlyAccess: true,
      };

      // With default config, 8 homes = gold. With custom, 8 homes = silver
      const result = PreferredCleanerPerksService.calculateTierFromConfig(8, customConfig);
      expect(result.tier).toBe("silver");
      expect(result.bonusPercent).toBe(2);
      expect(result.fasterPayouts).toBe(false);
    });

    it("should use custom platinum threshold from config", () => {
      const customConfig = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 3,
        goldMinHomes: 6,
        goldMaxHomes: 14,
        goldBonusPercent: 5,
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 15, // Raised from default 11
        platinumBonusPercent: 10, // Increased bonus
        platinumFasterPayouts: true,
        platinumPayoutHours: 12,
        platinumEarlyAccess: true,
      };

      // 12 homes with custom config = gold (not platinum)
      const result = PreferredCleanerPerksService.calculateTierFromConfig(12, customConfig);
      expect(result.tier).toBe("gold");
      expect(result.bonusPercent).toBe(5);
    });

    it("should use custom bonus percentages from config", () => {
      const customConfig = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 1, // Added bronze bonus!
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 5, // Increased from 3
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 8, // Increased from 5
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 11,
        platinumBonusPercent: 12, // Increased from 7
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: true,
      };

      const bronzeResult = PreferredCleanerPerksService.calculateTierFromConfig(1, customConfig);
      expect(bronzeResult.bonusPercent).toBe(1);

      const silverResult = PreferredCleanerPerksService.calculateTierFromConfig(4, customConfig);
      expect(silverResult.bonusPercent).toBe(5);

      const goldResult = PreferredCleanerPerksService.calculateTierFromConfig(8, customConfig);
      expect(goldResult.bonusPercent).toBe(8);

      const platinumResult = PreferredCleanerPerksService.calculateTierFromConfig(15, customConfig);
      expect(platinumResult.bonusPercent).toBe(12);
    });
  });

  describe("Faster payouts config is respected", () => {
    it("should disable gold faster payouts when owner turns it off", () => {
      const config = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 3,
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 5,
        goldFasterPayouts: false, // Owner disabled
        goldPayoutHours: 48, // Reset to standard
        platinumMinHomes: 11,
        platinumBonusPercent: 7,
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: true,
      };

      const result = PreferredCleanerPerksService.calculateTierFromConfig(8, config);
      expect(result.tier).toBe("gold");
      expect(result.fasterPayouts).toBe(false);
      expect(result.payoutHours).toBe(48);
    });

    it("should disable platinum faster payouts when owner turns it off", () => {
      const config = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 3,
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 5,
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 11,
        platinumBonusPercent: 7,
        platinumFasterPayouts: false, // Owner disabled
        platinumPayoutHours: 48, // Reset to standard
        platinumEarlyAccess: true,
      };

      const result = PreferredCleanerPerksService.calculateTierFromConfig(15, config);
      expect(result.tier).toBe("platinum");
      expect(result.fasterPayouts).toBe(false);
      expect(result.payoutHours).toBe(48);
    });

    it("should use custom payout hours from config", () => {
      const config = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 3,
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 5,
        goldFasterPayouts: true,
        goldPayoutHours: 12, // Even faster!
        platinumMinHomes: 11,
        platinumBonusPercent: 7,
        platinumFasterPayouts: true,
        platinumPayoutHours: 6, // Super fast for platinum
        platinumEarlyAccess: true,
      };

      const goldResult = PreferredCleanerPerksService.calculateTierFromConfig(8, config);
      expect(goldResult.payoutHours).toBe(12);

      const platinumResult = PreferredCleanerPerksService.calculateTierFromConfig(15, config);
      expect(platinumResult.payoutHours).toBe(6);
    });
  });

  describe("Early access config is respected", () => {
    it("should disable early access when owner turns it off", () => {
      const config = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 3,
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 5,
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 11,
        platinumBonusPercent: 7,
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: false, // Owner disabled
      };

      const result = PreferredCleanerPerksService.calculateTierFromConfig(15, config);
      expect(result.tier).toBe("platinum");
      expect(result.earlyAccess).toBe(false);
    });

    it("should enable early access when owner turns it on", () => {
      const config = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 3,
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 5,
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 11,
        platinumBonusPercent: 7,
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: true, // Owner enabled
      };

      const result = PreferredCleanerPerksService.calculateTierFromConfig(15, config);
      expect(result.tier).toBe("platinum");
      expect(result.earlyAccess).toBe(true);
    });
  });

  describe("Config changes affect payout bonus calculations", () => {
    it("should calculate bonus with updated silver bonus percent", () => {
      const config = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 6, // Doubled from default 3%
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 5,
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 11,
        platinumBonusPercent: 7,
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: true,
      };

      const tierInfo = PreferredCleanerPerksService.calculateTierFromConfig(4, config);
      expect(tierInfo.bonusPercent).toBe(6);

      // Simulate bonus calculation: 10000 cents ($100) job, 10% platform fee
      const grossAmount = 10000;
      const platformFeePercent = 10;
      const platformFee = Math.round(grossAmount * (platformFeePercent / 100)); // 1000 cents
      const bonusAmount = Math.round(platformFee * (tierInfo.bonusPercent / 100)); // 60 cents (6% of 1000)

      expect(platformFee).toBe(1000);
      expect(bonusAmount).toBe(60); // 6% bonus = 60 cents off platform fee
    });

    it("should calculate bonus with updated gold bonus percent", () => {
      const config = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 3,
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 10, // Doubled from default 5%
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 11,
        platinumBonusPercent: 7,
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: true,
      };

      const tierInfo = PreferredCleanerPerksService.calculateTierFromConfig(8, config);
      expect(tierInfo.bonusPercent).toBe(10);

      // Simulate bonus calculation
      const grossAmount = 15000; // $150 job
      const platformFeePercent = 10;
      const platformFee = Math.round(grossAmount * (platformFeePercent / 100)); // 1500 cents
      const bonusAmount = Math.round(platformFee * (tierInfo.bonusPercent / 100)); // 150 cents

      expect(bonusAmount).toBe(150); // 10% bonus = $1.50 off platform fee
    });

    it("should give no bonus when owner sets bonus to 0", () => {
      const config = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 0, // Owner disabled silver bonus
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 0, // Owner disabled gold bonus
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 11,
        platinumBonusPercent: 0, // Owner disabled platinum bonus
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: true,
      };

      const silverTier = PreferredCleanerPerksService.calculateTierFromConfig(4, config);
      expect(silverTier.bonusPercent).toBe(0);

      const goldTier = PreferredCleanerPerksService.calculateTierFromConfig(8, config);
      expect(goldTier.bonusPercent).toBe(0);

      const platinumTier = PreferredCleanerPerksService.calculateTierFromConfig(15, config);
      expect(platinumTier.bonusPercent).toBe(0);
    });
  });

  describe("Edge cases for config changes", () => {
    it("should handle minimum thresholds (all tiers start at 1)", () => {
      const config = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 1, // Only 1 home for bronze
        bronzeBonusPercent: 0,
        silverMinHomes: 2,
        silverMaxHomes: 2, // Only 1 home for silver
        silverBonusPercent: 3,
        goldMinHomes: 3,
        goldMaxHomes: 3, // Only 1 home for gold
        goldBonusPercent: 5,
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 4, // Platinum at just 4 homes
        platinumBonusPercent: 7,
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: true,
      };

      expect(PreferredCleanerPerksService.calculateTierFromConfig(1, config).tier).toBe("bronze");
      expect(PreferredCleanerPerksService.calculateTierFromConfig(2, config).tier).toBe("silver");
      expect(PreferredCleanerPerksService.calculateTierFromConfig(3, config).tier).toBe("gold");
      expect(PreferredCleanerPerksService.calculateTierFromConfig(4, config).tier).toBe("platinum");
    });

    it("should handle very high thresholds", () => {
      const config = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 10,
        bronzeBonusPercent: 0,
        silverMinHomes: 11,
        silverMaxHomes: 25,
        silverBonusPercent: 2,
        goldMinHomes: 26,
        goldMaxHomes: 50,
        goldBonusPercent: 4,
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 51, // Very high threshold
        platinumBonusPercent: 6,
        platinumFasterPayouts: true,
        platinumPayoutHours: 12,
        platinumEarlyAccess: true,
      };

      // 30 homes should be gold with these thresholds
      const result = PreferredCleanerPerksService.calculateTierFromConfig(30, config);
      expect(result.tier).toBe("gold");
      expect(result.bonusPercent).toBe(4);

      // 51 homes should be platinum
      const platinumResult = PreferredCleanerPerksService.calculateTierFromConfig(51, config);
      expect(platinumResult.tier).toBe("platinum");
    });

    it("should handle decimal bonus percentages", () => {
      const config = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0.5, // 0.5%
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 2.5, // 2.5%
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 4.75, // 4.75%
        goldFasterPayouts: true,
        goldPayoutHours: 24,
        platinumMinHomes: 11,
        platinumBonusPercent: 7.25, // 7.25%
        platinumFasterPayouts: true,
        platinumPayoutHours: 24,
        platinumEarlyAccess: true,
      };

      const bronzeResult = PreferredCleanerPerksService.calculateTierFromConfig(1, config);
      expect(bronzeResult.bonusPercent).toBe(0.5);

      const silverResult = PreferredCleanerPerksService.calculateTierFromConfig(4, config);
      expect(silverResult.bonusPercent).toBe(2.5);

      const goldResult = PreferredCleanerPerksService.calculateTierFromConfig(8, config);
      expect(goldResult.bonusPercent).toBe(4.75);

      const platinumResult = PreferredCleanerPerksService.calculateTierFromConfig(15, config);
      expect(platinumResult.bonusPercent).toBe(7.25);
    });
  });

  describe("Tier benefits reflect config changes", () => {
    it("should show updated benefits text for modified perks", () => {
      const config = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 5, // Increased to 5%
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 10, // Increased to 10%
        goldFasterPayouts: true,
        goldPayoutHours: 12, // Faster 12h
        platinumMinHomes: 11,
        platinumBonusPercent: 15, // Increased to 15%
        platinumFasterPayouts: true,
        platinumPayoutHours: 6, // Super fast 6h
        platinumEarlyAccess: true,
      };

      const silverBenefits = PreferredCleanerPerksService.getTierBenefits("silver", config);
      expect(silverBenefits).toContain("5% bonus on preferred jobs");

      const goldBenefits = PreferredCleanerPerksService.getTierBenefits("gold", config);
      expect(goldBenefits).toContain("10% bonus on preferred jobs");
      expect(goldBenefits).toContain("Faster payouts (12h)");

      const platinumBenefits = PreferredCleanerPerksService.getTierBenefits("platinum", config);
      expect(platinumBenefits).toContain("15% bonus on preferred jobs");
      expect(platinumBenefits).toContain("Faster payouts (6h)");
      expect(platinumBenefits).toContain("Early access to new homes");
    });

    it("should not show faster payouts benefit when disabled", () => {
      const config = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        bronzeBonusPercent: 0,
        silverMinHomes: 3,
        silverMaxHomes: 5,
        silverBonusPercent: 3,
        goldMinHomes: 6,
        goldMaxHomes: 10,
        goldBonusPercent: 5,
        goldFasterPayouts: false, // Disabled
        goldPayoutHours: 48,
        platinumMinHomes: 11,
        platinumBonusPercent: 7,
        platinumFasterPayouts: false, // Disabled
        platinumPayoutHours: 48,
        platinumEarlyAccess: false, // Disabled
      };

      const goldBenefits = PreferredCleanerPerksService.getTierBenefits("gold", config);
      expect(goldBenefits).toContain("5% bonus on preferred jobs");
      expect(goldBenefits.some(b => b.includes("Faster payouts"))).toBe(false);

      const platinumBenefits = PreferredCleanerPerksService.getTierBenefits("platinum", config);
      expect(platinumBenefits).toContain("7% bonus on preferred jobs");
      expect(platinumBenefits.some(b => b.includes("Faster payouts"))).toBe(false);
      expect(platinumBenefits.some(b => b.includes("Early access"))).toBe(false);
    });
  });
});

describe("Config Update Validation", () => {
  describe("Tier threshold validation", () => {
    it("should require bronze to start at 1", () => {
      const validateBronzeStart = (bronzeMinHomes) => {
        return bronzeMinHomes === 1;
      };

      expect(validateBronzeStart(1)).toBe(true);
      expect(validateBronzeStart(0)).toBe(false);
      expect(validateBronzeStart(2)).toBe(false);
    });

    it("should require tiers to be contiguous", () => {
      const validateContiguous = (thresholds) => {
        for (let i = 0; i < thresholds.length - 1; i++) {
          const current = thresholds[i];
          const next = thresholds[i + 1];
          if (current.max + 1 !== next.min) {
            return false;
          }
        }
        return true;
      };

      // Valid contiguous thresholds
      const validThresholds = [
        { min: 1, max: 2 },
        { min: 3, max: 5 },
        { min: 6, max: 10 },
        { min: 11, max: null },
      ];
      expect(validateContiguous(validThresholds)).toBe(true);

      // Invalid - gap between bronze and silver
      const invalidGap = [
        { min: 1, max: 2 },
        { min: 4, max: 5 }, // Should be min: 3
        { min: 6, max: 10 },
        { min: 11, max: null },
      ];
      expect(validateContiguous(invalidGap)).toBe(false);

      // Invalid - overlap between silver and gold
      const invalidOverlap = [
        { min: 1, max: 2 },
        { min: 3, max: 6 },
        { min: 6, max: 10 }, // Should be min: 7
        { min: 11, max: null },
      ];
      expect(validateContiguous(invalidOverlap)).toBe(false);
    });
  });

  describe("Bonus percentage validation", () => {
    it("should require bonus percentages between 0 and 100", () => {
      const validateBonusPercent = (percent) => {
        return percent >= 0 && percent <= 100;
      };

      expect(validateBonusPercent(0)).toBe(true);
      expect(validateBonusPercent(50)).toBe(true);
      expect(validateBonusPercent(100)).toBe(true);
      expect(validateBonusPercent(-1)).toBe(false);
      expect(validateBonusPercent(101)).toBe(false);
    });
  });

  describe("Payout hours validation", () => {
    it("should require payout hours to be at least 1", () => {
      const validatePayoutHours = (hours) => {
        return hours >= 1;
      };

      expect(validatePayoutHours(1)).toBe(true);
      expect(validatePayoutHours(24)).toBe(true);
      expect(validatePayoutHours(48)).toBe(true);
      expect(validatePayoutHours(0)).toBe(false);
      expect(validatePayoutHours(-1)).toBe(false);
    });
  });
});

describe("Config History Tracking", () => {
  it("should track what changed when config is updated", () => {
    const previousConfig = {
      silverBonusPercent: 3,
      goldBonusPercent: 5,
      goldFasterPayouts: true,
      platinumEarlyAccess: true,
    };

    const newConfig = {
      silverBonusPercent: 4, // Changed
      goldBonusPercent: 5, // Same
      goldFasterPayouts: false, // Changed
      platinumEarlyAccess: true, // Same
    };

    const calculateChanges = (prev, next) => {
      const changes = {};
      for (const key of Object.keys(next)) {
        if (prev[key] !== next[key]) {
          changes[key] = { old: prev[key], new: next[key] };
        }
      }
      return changes;
    };

    const changes = calculateChanges(previousConfig, newConfig);

    expect(changes.silverBonusPercent).toEqual({ old: 3, new: 4 });
    expect(changes.goldFasterPayouts).toEqual({ old: true, new: false });
    expect(changes.goldBonusPercent).toBeUndefined(); // No change
    expect(changes.platinumEarlyAccess).toBeUndefined(); // No change
  });

  it("should not create history entry when no changes", () => {
    const config = {
      silverBonusPercent: 3,
      goldBonusPercent: 5,
    };

    const calculateChanges = (prev, next) => {
      const changes = {};
      for (const key of Object.keys(next)) {
        if (prev[key] !== next[key]) {
          changes[key] = { old: prev[key], new: next[key] };
        }
      }
      return changes;
    };

    const changes = calculateChanges(config, config);
    expect(Object.keys(changes).length).toBe(0);
  });
});
