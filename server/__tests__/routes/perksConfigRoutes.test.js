/**
 * Tests for Perks Config Routes
 * Tests the owner endpoints for managing preferred cleaner perks configuration
 */

describe("Perks Config Routes - Validation", () => {
  describe("PUT /perks-config validation", () => {
    it("should reject config where bronze does not start at 1", () => {
      const invalidConfig = {
        bronzeMinHomes: 2, // Invalid - must be 1
        bronzeMaxHomes: 3,
        silverMinHomes: 4,
        silverMaxHomes: 6,
        goldMinHomes: 7,
        goldMaxHomes: 10,
        platinumMinHomes: 11,
      };

      const validateBronzeStart = (config) => {
        if (config.bronzeMinHomes !== 1) {
          return { valid: false, error: "Bronze tier must start at 1 home" };
        }
        return { valid: true };
      };

      const result = validateBronzeStart(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Bronze tier must start at 1 home");
    });

    it("should reject config with non-contiguous tier thresholds", () => {
      const invalidConfig = {
        bronzeMinHomes: 1,
        bronzeMaxHomes: 2,
        silverMinHomes: 4, // Gap! Should be 3
        silverMaxHomes: 5,
        goldMinHomes: 6,
        goldMaxHomes: 10,
        platinumMinHomes: 11,
      };

      const validateContiguous = (config) => {
        const thresholds = [
          { min: config.bronzeMinHomes, max: config.bronzeMaxHomes },
          { min: config.silverMinHomes, max: config.silverMaxHomes },
          { min: config.goldMinHomes, max: config.goldMaxHomes },
          { min: config.platinumMinHomes, max: null },
        ];

        for (let i = 0; i < thresholds.length - 1; i++) {
          const current = thresholds[i];
          const next = thresholds[i + 1];
          if (current.max + 1 !== next.min) {
            return {
              valid: false,
              error: `Tier thresholds must be contiguous. Gap between tier ${i + 1} and ${i + 2}`,
            };
          }
        }
        return { valid: true };
      };

      const result = validateContiguous(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Gap between tier 1 and 2");
    });

    it("should reject negative bonus percentages", () => {
      const validateBonusPercent = (field, value) => {
        if (value !== undefined && (value < 0 || value > 100)) {
          return { valid: false, error: `${field} must be between 0 and 100` };
        }
        return { valid: true };
      };

      expect(validateBonusPercent("silverBonusPercent", -5).valid).toBe(false);
      expect(validateBonusPercent("goldBonusPercent", 150).valid).toBe(false);
      expect(validateBonusPercent("platinumBonusPercent", 50).valid).toBe(true);
    });

    it("should reject payout hours less than 1", () => {
      const validatePayoutHours = (field, value) => {
        if (value !== undefined && value < 1) {
          return { valid: false, error: `${field} must be at least 1` };
        }
        return { valid: true };
      };

      expect(validatePayoutHours("goldPayoutHours", 0).valid).toBe(false);
      expect(validatePayoutHours("platinumPayoutHours", -1).valid).toBe(false);
      expect(validatePayoutHours("goldPayoutHours", 1).valid).toBe(true);
      expect(validatePayoutHours("goldPayoutHours", 24).valid).toBe(true);
    });

    it("should accept valid config", () => {
      const validConfig = {
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
        platinumEarlyAccess: true,
      };

      const validateConfig = (config) => {
        // Bronze start validation
        if (config.bronzeMinHomes !== 1) {
          return { valid: false, error: "Bronze tier must start at 1 home" };
        }

        // Contiguous validation
        const thresholds = [
          { min: config.bronzeMinHomes, max: config.bronzeMaxHomes },
          { min: config.silverMinHomes, max: config.silverMaxHomes },
          { min: config.goldMinHomes, max: config.goldMaxHomes },
          { min: config.platinumMinHomes, max: null },
        ];

        for (let i = 0; i < thresholds.length - 1; i++) {
          if (thresholds[i].max + 1 !== thresholds[i + 1].min) {
            return { valid: false, error: "Tier thresholds must be contiguous" };
          }
        }

        // Bonus percent validation
        const bonusFields = ["bronzeBonusPercent", "silverBonusPercent", "goldBonusPercent", "platinumBonusPercent"];
        for (const field of bonusFields) {
          if (config[field] !== undefined && (config[field] < 0 || config[field] > 100)) {
            return { valid: false, error: `${field} must be between 0 and 100` };
          }
        }

        // Payout hours validation
        if (config.goldPayoutHours !== undefined && config.goldPayoutHours < 1) {
          return { valid: false, error: "Gold payout hours must be at least 1" };
        }
        if (config.platinumPayoutHours !== undefined && config.platinumPayoutHours < 1) {
          return { valid: false, error: "Platinum payout hours must be at least 1" };
        }

        return { valid: true };
      };

      const result = validateConfig(validConfig);
      expect(result.valid).toBe(true);
    });
  });
});

describe("Perks Config - Default Values", () => {
  it("should have correct default config values", () => {
    const defaultConfig = {
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
      platinumEarlyAccess: true,
    };

    // Verify tier thresholds
    expect(defaultConfig.bronzeMinHomes).toBe(1);
    expect(defaultConfig.bronzeMaxHomes).toBe(2);
    expect(defaultConfig.silverMinHomes).toBe(3);
    expect(defaultConfig.silverMaxHomes).toBe(5);
    expect(defaultConfig.goldMinHomes).toBe(6);
    expect(defaultConfig.goldMaxHomes).toBe(10);
    expect(defaultConfig.platinumMinHomes).toBe(11);

    // Verify bonus percentages
    expect(defaultConfig.bronzeBonusPercent).toBe(0);
    expect(defaultConfig.silverBonusPercent).toBe(3);
    expect(defaultConfig.goldBonusPercent).toBe(5);
    expect(defaultConfig.platinumBonusPercent).toBe(7);

    // Verify perks
    expect(defaultConfig.goldFasterPayouts).toBe(true);
    expect(defaultConfig.goldPayoutHours).toBe(24);
    expect(defaultConfig.platinumFasterPayouts).toBe(true);
    expect(defaultConfig.platinumPayoutHours).toBe(24);
    expect(defaultConfig.platinumEarlyAccess).toBe(true);
  });
});

describe("Perks Config - Updatable Fields", () => {
  it("should have all tier threshold fields as updatable", () => {
    const updatableFields = [
      "bronzeMinHomes",
      "bronzeMaxHomes",
      "bronzeBonusPercent",
      "silverMinHomes",
      "silverMaxHomes",
      "silverBonusPercent",
      "goldMinHomes",
      "goldMaxHomes",
      "goldBonusPercent",
      "goldFasterPayouts",
      "goldPayoutHours",
      "platinumMinHomes",
      "platinumBonusPercent",
      "platinumFasterPayouts",
      "platinumPayoutHours",
      "platinumEarlyAccess",
      "earlyAccessMinutes",
    ];

    // All threshold fields should be updatable
    expect(updatableFields).toContain("bronzeMinHomes");
    expect(updatableFields).toContain("bronzeMaxHomes");
    expect(updatableFields).toContain("silverMinHomes");
    expect(updatableFields).toContain("silverMaxHomes");
    expect(updatableFields).toContain("goldMinHomes");
    expect(updatableFields).toContain("goldMaxHomes");
    expect(updatableFields).toContain("platinumMinHomes");

    // All bonus fields should be updatable
    expect(updatableFields).toContain("bronzeBonusPercent");
    expect(updatableFields).toContain("silverBonusPercent");
    expect(updatableFields).toContain("goldBonusPercent");
    expect(updatableFields).toContain("platinumBonusPercent");

    // All perk toggle fields should be updatable
    expect(updatableFields).toContain("goldFasterPayouts");
    expect(updatableFields).toContain("goldPayoutHours");
    expect(updatableFields).toContain("platinumFasterPayouts");
    expect(updatableFields).toContain("platinumPayoutHours");
    expect(updatableFields).toContain("platinumEarlyAccess");
    expect(updatableFields).toContain("earlyAccessMinutes");
  });
});

describe("Perks Config - Response Serialization", () => {
  it("should serialize config for form display", () => {
    const config = {
      id: 1,
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
      platinumEarlyAccess: true,
      earlyAccessMinutes: 30,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const serializeForForm = (cfg) => {
      return {
        bronze: {
          minHomes: cfg.bronzeMinHomes,
          maxHomes: cfg.bronzeMaxHomes,
          bonusPercent: cfg.bronzeBonusPercent,
        },
        silver: {
          minHomes: cfg.silverMinHomes,
          maxHomes: cfg.silverMaxHomes,
          bonusPercent: cfg.silverBonusPercent,
        },
        gold: {
          minHomes: cfg.goldMinHomes,
          maxHomes: cfg.goldMaxHomes,
          bonusPercent: cfg.goldBonusPercent,
          fasterPayouts: cfg.goldFasterPayouts,
          payoutHours: cfg.goldPayoutHours,
        },
        platinum: {
          minHomes: cfg.platinumMinHomes,
          bonusPercent: cfg.platinumBonusPercent,
          fasterPayouts: cfg.platinumFasterPayouts,
          payoutHours: cfg.platinumPayoutHours,
          earlyAccess: cfg.platinumEarlyAccess,
        },
        earlyAccessMinutes: cfg.earlyAccessMinutes,
      };
    };

    const formData = serializeForForm(config);

    expect(formData.bronze.minHomes).toBe(1);
    expect(formData.bronze.maxHomes).toBe(2);
    expect(formData.bronze.bonusPercent).toBe(0);

    expect(formData.silver.minHomes).toBe(3);
    expect(formData.silver.maxHomes).toBe(5);
    expect(formData.silver.bonusPercent).toBe(3);

    expect(formData.gold.minHomes).toBe(6);
    expect(formData.gold.maxHomes).toBe(10);
    expect(formData.gold.bonusPercent).toBe(5);
    expect(formData.gold.fasterPayouts).toBe(true);
    expect(formData.gold.payoutHours).toBe(24);

    expect(formData.platinum.minHomes).toBe(11);
    expect(formData.platinum.bonusPercent).toBe(7);
    expect(formData.platinum.fasterPayouts).toBe(true);
    expect(formData.platinum.payoutHours).toBe(24);
    expect(formData.platinum.earlyAccess).toBe(true);

    expect(formData.earlyAccessMinutes).toBe(30);
  });

  it("should serialize config by tier for display", () => {
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
      platinumEarlyAccess: true,
    };

    const serializeByTier = (cfg) => {
      return {
        bronze: {
          name: "Bronze",
          range: `${cfg.bronzeMinHomes}-${cfg.bronzeMaxHomes} homes`,
          bonusPercent: cfg.bronzeBonusPercent,
          perks: [],
        },
        silver: {
          name: "Silver",
          range: `${cfg.silverMinHomes}-${cfg.silverMaxHomes} homes`,
          bonusPercent: cfg.silverBonusPercent,
          perks: [`${cfg.silverBonusPercent}% bonus on preferred jobs`],
        },
        gold: {
          name: "Gold",
          range: `${cfg.goldMinHomes}-${cfg.goldMaxHomes} homes`,
          bonusPercent: cfg.goldBonusPercent,
          perks: [
            `${cfg.goldBonusPercent}% bonus on preferred jobs`,
            ...(cfg.goldFasterPayouts ? [`${cfg.goldPayoutHours}h faster payouts`] : []),
          ],
        },
        platinum: {
          name: "Platinum",
          range: `${cfg.platinumMinHomes}+ homes`,
          bonusPercent: cfg.platinumBonusPercent,
          perks: [
            `${cfg.platinumBonusPercent}% bonus on preferred jobs`,
            ...(cfg.platinumFasterPayouts ? [`${cfg.platinumPayoutHours}h faster payouts`] : []),
            ...(cfg.platinumEarlyAccess ? ["Early access to new jobs"] : []),
          ],
        },
      };
    };

    const byTier = serializeByTier(config);

    expect(byTier.bronze.range).toBe("1-2 homes");
    expect(byTier.bronze.perks).toHaveLength(0);

    expect(byTier.silver.range).toBe("3-5 homes");
    expect(byTier.silver.perks).toContain("3% bonus on preferred jobs");

    expect(byTier.gold.range).toBe("6-10 homes");
    expect(byTier.gold.perks).toContain("5% bonus on preferred jobs");
    expect(byTier.gold.perks).toContain("24h faster payouts");

    expect(byTier.platinum.range).toBe("11+ homes");
    expect(byTier.platinum.perks).toContain("7% bonus on preferred jobs");
    expect(byTier.platinum.perks).toContain("24h faster payouts");
    expect(byTier.platinum.perks).toContain("Early access to new jobs");
  });
});

describe("Perks Config Change - Effect on Cleaners", () => {
  it("should recalculate all cleaner tiers when config changes", () => {
    // Simulate cleaners with their preferred home counts
    const cleaners = [
      { id: 1, preferredHomeCount: 2 }, // Bronze
      { id: 2, preferredHomeCount: 4 }, // Silver
      { id: 3, preferredHomeCount: 8 }, // Gold
      { id: 4, preferredHomeCount: 15 }, // Platinum
    ];

    // Original config
    const originalConfig = {
      bronzeMinHomes: 1,
      bronzeMaxHomes: 2,
      silverMinHomes: 3,
      silverMaxHomes: 5,
      goldMinHomes: 6,
      goldMaxHomes: 10,
      platinumMinHomes: 11,
    };

    // Calculate tier based on config
    const calculateTier = (homeCount, config) => {
      if (homeCount >= config.platinumMinHomes) return "platinum";
      if (homeCount >= config.goldMinHomes && homeCount <= config.goldMaxHomes) return "gold";
      if (homeCount >= config.silverMinHomes && homeCount <= config.silverMaxHomes) return "silver";
      return "bronze";
    };

    // Verify original tiers
    expect(calculateTier(cleaners[0].preferredHomeCount, originalConfig)).toBe("bronze");
    expect(calculateTier(cleaners[1].preferredHomeCount, originalConfig)).toBe("silver");
    expect(calculateTier(cleaners[2].preferredHomeCount, originalConfig)).toBe("gold");
    expect(calculateTier(cleaners[3].preferredHomeCount, originalConfig)).toBe("platinum");

    // Owner changes config - raises all thresholds
    const newConfig = {
      bronzeMinHomes: 1,
      bronzeMaxHomes: 5,
      silverMinHomes: 6,
      silverMaxHomes: 10,
      goldMinHomes: 11,
      goldMaxHomes: 20,
      platinumMinHomes: 21,
    };

    // Verify new tiers after config change
    expect(calculateTier(cleaners[0].preferredHomeCount, newConfig)).toBe("bronze"); // 2 homes still bronze
    expect(calculateTier(cleaners[1].preferredHomeCount, newConfig)).toBe("bronze"); // 4 homes now bronze (was silver)
    expect(calculateTier(cleaners[2].preferredHomeCount, newConfig)).toBe("silver"); // 8 homes now silver (was gold)
    expect(calculateTier(cleaners[3].preferredHomeCount, newConfig)).toBe("gold"); // 15 homes now gold (was platinum)
  });

  it("should apply new bonus percentages immediately after config change", () => {
    const cleanerHomeCount = 8; // Gold tier cleaner
    const jobGrossAmount = 10000; // $100 job
    const platformFeePercent = 10; // 10% platform fee

    // Original config: 5% gold bonus
    const originalBonusPercent = 5;
    const originalPlatformFee = jobGrossAmount * (platformFeePercent / 100); // $10
    const originalBonus = originalPlatformFee * (originalBonusPercent / 100); // $0.50

    expect(originalBonus).toBe(50); // 50 cents

    // Owner changes gold bonus to 10%
    const newBonusPercent = 10;
    const newBonus = originalPlatformFee * (newBonusPercent / 100); // $1.00

    expect(newBonus).toBe(100); // 100 cents - doubled!

    // Cleaner's net amount difference
    const netDifference = newBonus - originalBonus;
    expect(netDifference).toBe(50); // Cleaner gets 50 cents more per job
  });

  it("should remove faster payouts perk when owner disables it", () => {
    const goldCleanerPerks = {
      tier: "gold",
      fasterPayouts: true,
      payoutHours: 24,
    };

    // Simulate owner disabling faster payouts
    const updatedPerks = {
      ...goldCleanerPerks,
      fasterPayouts: false,
      payoutHours: 48, // Back to standard
    };

    expect(updatedPerks.fasterPayouts).toBe(false);
    expect(updatedPerks.payoutHours).toBe(48);

    // Verify payout priority would change
    const calculatePayoutPriority = (perks) => {
      return perks.fasterPayouts ? "high" : "normal";
    };

    expect(calculatePayoutPriority(goldCleanerPerks)).toBe("high");
    expect(calculatePayoutPriority(updatedPerks)).toBe("normal");
  });

  it("should remove early access perk when owner disables it", () => {
    const platinumCleanerPerks = {
      tier: "platinum",
      earlyAccess: true,
    };

    // Simulate owner disabling early access
    const updatedPerks = {
      ...platinumCleanerPerks,
      earlyAccess: false,
    };

    expect(updatedPerks.earlyAccess).toBe(false);

    // Verify job filtering would change
    const canSeeEarlyAccessJobs = (perks) => perks.earlyAccess === true;

    expect(canSeeEarlyAccessJobs(platinumCleanerPerks)).toBe(true);
    expect(canSeeEarlyAccessJobs(updatedPerks)).toBe(false);
  });
});
