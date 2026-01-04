const ReferralService = require("../../services/ReferralService");

// Mock models
const mockModels = {
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
  },
  ReferralConfig: {
    getActive: jest.fn(),
    getFormattedConfig: jest.fn(),
  },
  Referral: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    countMonthlyReferrals: jest.fn(),
    getStats: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
    update: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn(),
  },
  Sequelize: {
    Op: {
      between: Symbol("between"),
      gte: Symbol("gte"),
      lte: Symbol("lte"),
    },
  },
};

describe("ReferralService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateReferralCode", () => {
    it("should generate a referral code with first name prefix", async () => {
      const user = { id: 1, firstName: "John" };
      mockModels.User.findOne.mockResolvedValue(null); // No existing code
      mockModels.User.update.mockResolvedValue([1]);

      const code = await ReferralService.generateReferralCode(user, mockModels);

      // Code should start with JOHN and have some alphanumeric characters after
      // (may be 3-4 chars due to base64 encoding sometimes producing fewer valid chars)
      expect(code).toMatch(/^JOHN[A-Z0-9]{1,4}$/);
      expect(mockModels.User.update).toHaveBeenCalledWith(
        { referralCode: code },
        { where: { id: 1 } }
      );
    });

    it("should pad short names with X", async () => {
      const user = { id: 2, firstName: "Jo" };
      mockModels.User.findOne.mockResolvedValue(null);
      mockModels.User.update.mockResolvedValue([1]);

      const code = await ReferralService.generateReferralCode(user, mockModels);

      // Code should start with JOXX and have 3-4 alphanumeric characters after (due to base64 encoding)
      expect(code).toMatch(/^JOXX[A-Z0-9]{3,4}$/);
    });

    it("should use USER prefix if firstName is missing", async () => {
      const user = { id: 3, firstName: null };
      mockModels.User.findOne.mockResolvedValue(null);
      mockModels.User.update.mockResolvedValue([1]);

      const code = await ReferralService.generateReferralCode(user, mockModels);

      // Code should start with USER and have 3-4 alphanumeric characters after (due to base64 encoding)
      expect(code).toMatch(/^USER[A-Z0-9]{3,4}$/);
    });

    it("should retry if code already exists", async () => {
      const user = { id: 4, firstName: "Test" };
      // First call returns existing user, second returns null
      mockModels.User.findOne
        .mockResolvedValueOnce({ id: 99 })
        .mockResolvedValueOnce(null);
      mockModels.User.update.mockResolvedValue([1]);

      const code = await ReferralService.generateReferralCode(user, mockModels);

      expect(mockModels.User.findOne).toHaveBeenCalledTimes(2);
      // Code should start with TEST and have alphanumeric suffix (length varies)
      expect(code).toMatch(/^TEST[A-Z0-9]+$/);
      expect(code.length).toBeGreaterThanOrEqual(6);
    });

    it("should generate fallback code after max attempts", async () => {
      const user = { id: 5, firstName: "Test" };
      // Always return existing user
      mockModels.User.findOne.mockResolvedValue({ id: 99 });
      mockModels.User.update.mockResolvedValue([1]);

      const code = await ReferralService.generateReferralCode(user, mockModels);

      expect(code).toMatch(/^REF5[A-Z0-9]+$/);
      expect(mockModels.User.findOne).toHaveBeenCalledTimes(10); // max attempts
    });
  });

  describe("validateReferralCode", () => {
    const mockConfig = {
      clientToClientEnabled: true,
      clientToClientReferrerReward: 2500,
      clientToClientReferredReward: 2500,
      clientToClientCleaningsRequired: 1,
      clientToClientRewardType: "credit",
      clientToClientMaxPerMonth: 10,
      clientToCleanerEnabled: true,
      clientToCleanerReferrerReward: 5000,
      clientToCleanerCleaningsRequired: 3,
      clientToCleanerRewardType: "credit",
      clientToCleanerMaxPerMonth: 5,
      cleanerToCleanerEnabled: true,
      cleanerToCleanerReferrerReward: 5000,
      cleanerToCleanerCleaningsRequired: 5,
      cleanerToCleanerRewardType: "bonus",
      cleanerToCleanerMaxPerMonth: 3,
      cleanerToClientEnabled: false,
      cleanerToClientDiscountPercent: "10.00",
      cleanerToClientMinReferrals: 5,
      cleanerToClientRewardType: "discount",
      cleanerToClientMaxPerMonth: null,
    };

    it("should return error for empty code", async () => {
      const result = await ReferralService.validateReferralCode("", "homeowner", mockModels);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("NO_CODE");
    });

    it("should return error for null code", async () => {
      const result = await ReferralService.validateReferralCode(null, "homeowner", mockModels);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("NO_CODE");
    });

    it("should return error for invalid code format", async () => {
      const result = await ReferralService.validateReferralCode("AB!", "homeowner", mockModels);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("INVALID_FORMAT");
      expect(result.error).toContain("Invalid code format");
    });

    it("should return error for code that is too short", async () => {
      const result = await ReferralService.validateReferralCode("ABC", "homeowner", mockModels);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("INVALID_FORMAT");
    });

    it("should return error when code does not exist", async () => {
      mockModels.User.findOne.mockResolvedValue(null);

      const result = await ReferralService.validateReferralCode("JOHN1234", "homeowner", mockModels);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("CODE_NOT_FOUND");
      expect(result.error).toContain("doesn't exist");
    });

    it("should return error when referrer account is frozen", async () => {
      mockModels.User.findOne.mockResolvedValue({
        id: 1,
        firstName: "John",
        type: null,
        accountFrozen: true,
      });

      const result = await ReferralService.validateReferralCode("JOHN1234", "homeowner", mockModels);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("ACCOUNT_FROZEN");
      expect(result.error).toContain("no longer active");
    });

    it("should return error when referral program is inactive", async () => {
      mockModels.User.findOne.mockResolvedValue({
        id: 1,
        firstName: "John",
        type: null,
        accountFrozen: false,
      });
      mockModels.ReferralConfig.getActive.mockResolvedValue(null);

      const result = await ReferralService.validateReferralCode("JOHN1234", "homeowner", mockModels);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("PROGRAM_INACTIVE");
    });

    it("should validate client-to-client referral successfully", async () => {
      mockModels.User.findOne.mockResolvedValue({
        id: 1,
        firstName: "John",
        type: null, // homeowner
        accountFrozen: false,
      });
      mockModels.ReferralConfig.getActive.mockResolvedValue(mockConfig);
      mockModels.Referral.countMonthlyReferrals.mockResolvedValue(0);

      const result = await ReferralService.validateReferralCode("JOHN1234", "homeowner", mockModels);

      expect(result.valid).toBe(true);
      expect(result.programType).toBe("client_to_client");
      expect(result.referrer.firstName).toBe("John");
      expect(result.rewards.referrerReward).toBe(2500);
      expect(result.rewards.referredReward).toBe(2500);
    });

    it("should validate client-to-cleaner referral successfully", async () => {
      mockModels.User.findOne.mockResolvedValue({
        id: 1,
        firstName: "John",
        type: "homeowner",
        accountFrozen: false,
      });
      mockModels.ReferralConfig.getActive.mockResolvedValue(mockConfig);
      mockModels.Referral.countMonthlyReferrals.mockResolvedValue(0);

      const result = await ReferralService.validateReferralCode("JOHN1234", "cleaner", mockModels);

      expect(result.valid).toBe(true);
      expect(result.programType).toBe("client_to_cleaner");
      expect(result.rewards.referrerReward).toBe(5000);
    });

    it("should validate cleaner-to-cleaner referral successfully", async () => {
      mockModels.User.findOne.mockResolvedValue({
        id: 2,
        firstName: "Jane",
        type: "cleaner",
        accountFrozen: false,
      });
      mockModels.ReferralConfig.getActive.mockResolvedValue(mockConfig);
      mockModels.Referral.countMonthlyReferrals.mockResolvedValue(0);

      const result = await ReferralService.validateReferralCode("JANE1234", "cleaner", mockModels);

      expect(result.valid).toBe(true);
      expect(result.programType).toBe("cleaner_to_cleaner");
    });

    it("should return error when program type is disabled", async () => {
      mockModels.User.findOne.mockResolvedValue({
        id: 2,
        firstName: "Jane",
        type: "cleaner",
        accountFrozen: false,
      });
      mockModels.ReferralConfig.getActive.mockResolvedValue(mockConfig);

      const result = await ReferralService.validateReferralCode("JANE1234", "homeowner", mockModels);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("PROGRAM_TYPE_DISABLED");
      expect(result.error).toContain("Cleaner-to-Client");
    });

    it("should return error when monthly limit is reached", async () => {
      mockModels.User.findOne.mockResolvedValue({
        id: 1,
        firstName: "John",
        type: null,
        accountFrozen: false,
      });
      mockModels.ReferralConfig.getActive.mockResolvedValue(mockConfig);
      mockModels.Referral.countMonthlyReferrals.mockResolvedValue(10); // At limit

      const result = await ReferralService.validateReferralCode("JOHN1234", "homeowner", mockModels);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("MONTHLY_LIMIT_REACHED");
    });

    it("should convert code to uppercase", async () => {
      mockModels.User.findOne.mockResolvedValue({
        id: 1,
        firstName: "John",
        type: null,
        accountFrozen: false,
      });
      mockModels.ReferralConfig.getActive.mockResolvedValue(mockConfig);
      mockModels.Referral.countMonthlyReferrals.mockResolvedValue(0);

      await ReferralService.validateReferralCode("john1234", "homeowner", mockModels);

      expect(mockModels.User.findOne).toHaveBeenCalledWith({
        where: { referralCode: "JOHN1234" },
      });
    });
  });

  describe("createReferral", () => {
    it("should create a referral record successfully", async () => {
      const referredUser = { id: 5, firstName: "NewUser" };
      const rewards = {
        referrerReward: 2500,
        referredReward: 2500,
        cleaningsRequired: 1,
        rewardType: "credit",
      };

      mockModels.User.findOne.mockResolvedValue({ id: 1 });
      mockModels.Referral.findOne.mockResolvedValue(null);
      mockModels.Referral.create.mockResolvedValue({
        id: 1,
        referrerId: 1,
        referredId: 5,
        referralCode: "JOHN1234",
        programType: "client_to_client",
        status: "pending",
      });

      const result = await ReferralService.createReferral(
        "JOHN1234",
        referredUser,
        "client_to_client",
        rewards,
        mockModels
      );

      expect(result.referrerId).toBe(1);
      expect(result.referredId).toBe(5);
      expect(mockModels.Referral.create).toHaveBeenCalledWith(
        expect.objectContaining({
          referrerId: 1,
          referredId: 5,
          referralCode: "JOHN1234",
          programType: "client_to_client",
          status: "pending",
          cleaningsRequired: 1,
          referrerRewardAmount: 2500,
          referredRewardAmount: 2500,
        })
      );
    });

    it("should throw error for invalid referral code", async () => {
      mockModels.User.findOne.mockResolvedValue(null);

      await expect(
        ReferralService.createReferral("INVALID", { id: 5 }, "client_to_client", {}, mockModels)
      ).rejects.toThrow("Invalid referral code");
    });

    it("should throw error if user already referred", async () => {
      mockModels.User.findOne.mockResolvedValue({ id: 1 });
      mockModels.Referral.findOne.mockResolvedValue({ id: 99 }); // Already exists

      await expect(
        ReferralService.createReferral("JOHN1234", { id: 5 }, "client_to_client", {}, mockModels)
      ).rejects.toThrow("User has already been referred");
    });
  });

  describe("processCompletedAppointment", () => {
    it("should increment cleanings completed", async () => {
      const mockReferral = {
        referredId: 5,
        status: "pending",
        cleaningsCompleted: 0,
        cleaningsRequired: 3,
        save: jest.fn(),
      };
      mockModels.Referral.findOne.mockResolvedValue(mockReferral);

      const result = await ReferralService.processCompletedAppointment(1, 5, mockModels);

      expect(result.cleaningsCompleted).toBe(1);
      expect(mockReferral.save).toHaveBeenCalled();
    });

    it("should mark as qualified when requirements met", async () => {
      const mockReferral = {
        referredId: 5,
        referrerId: 1,
        status: "pending",
        cleaningsCompleted: 2,
        cleaningsRequired: 3,
        referrerRewardAmount: 2500,
        referredRewardAmount: 2500,
        referrerRewardApplied: false,
        referredRewardApplied: false,
        save: jest.fn(),
      };
      mockModels.Referral.findOne.mockResolvedValue(mockReferral);
      mockModels.User.findByPk
        .mockResolvedValueOnce({ id: 1, referralCredits: 0 })
        .mockResolvedValueOnce({ id: 5, referralCredits: 0 });
      mockModels.User.update.mockResolvedValue([1]);

      const result = await ReferralService.processCompletedAppointment(1, 5, mockModels);

      expect(result.status).toBe("rewarded");
      expect(result.cleaningsCompleted).toBe(3);
      expect(mockReferral.qualifiedAt).toBeDefined();
    });

    it("should return null if no pending referral", async () => {
      mockModels.Referral.findOne.mockResolvedValue(null);

      const result = await ReferralService.processCompletedAppointment(1, 5, mockModels);

      expect(result).toBeNull();
    });
  });

  describe("applyRewards", () => {
    it("should add credits to both referrer and referred", async () => {
      const mockReferral = {
        referrerId: 1,
        referredId: 5,
        referrerRewardAmount: 2500,
        referredRewardAmount: 2500,
        referrerRewardApplied: false,
        referredRewardApplied: false,
        status: "qualified",
        save: jest.fn(),
      };

      mockModels.User.findByPk
        .mockResolvedValueOnce({ id: 1, referralCredits: 1000 })
        .mockResolvedValueOnce({ id: 5, referralCredits: 500 });
      mockModels.User.update.mockResolvedValue([1]);

      await ReferralService.applyRewards(mockReferral, mockModels);

      expect(mockModels.User.update).toHaveBeenCalledWith(
        { referralCredits: 3500 }, // 1000 + 2500
        { where: { id: 1 } }
      );
      expect(mockModels.User.update).toHaveBeenCalledWith(
        { referralCredits: 3000 }, // 500 + 2500
        { where: { id: 5 } }
      );
      expect(mockReferral.referrerRewardApplied).toBe(true);
      expect(mockReferral.referredRewardApplied).toBe(true);
      expect(mockReferral.status).toBe("rewarded");
    });

    it("should not apply reward if amount is 0", async () => {
      const mockReferral = {
        referrerId: 1,
        referredId: 5,
        referrerRewardAmount: 2500,
        referredRewardAmount: 0,
        referrerRewardApplied: false,
        referredRewardApplied: false,
        status: "qualified",
        save: jest.fn(),
      };

      mockModels.User.findByPk.mockResolvedValue({ id: 1, referralCredits: 0 });
      mockModels.User.update.mockResolvedValue([1]);

      await ReferralService.applyRewards(mockReferral, mockModels);

      expect(mockModels.User.update).toHaveBeenCalledTimes(1);
      expect(mockReferral.referrerRewardApplied).toBe(true);
      expect(mockReferral.referredRewardApplied).toBe(false);
    });
  });

  describe("getAvailableCredits", () => {
    it("should return user credits", async () => {
      mockModels.User.findByPk.mockResolvedValue({ id: 1, referralCredits: 5000 });

      const credits = await ReferralService.getAvailableCredits(1, mockModels);

      expect(credits).toBe(5000);
    });

    it("should return 0 if user not found", async () => {
      mockModels.User.findByPk.mockResolvedValue(null);

      const credits = await ReferralService.getAvailableCredits(999, mockModels);

      expect(credits).toBe(0);
    });

    it("should return 0 if credits is null", async () => {
      mockModels.User.findByPk.mockResolvedValue({ id: 1, referralCredits: null });

      const credits = await ReferralService.getAvailableCredits(1, mockModels);

      expect(credits).toBe(0);
    });
  });

  describe("getUserReferralStats", () => {
    it("should return user referral statistics", async () => {
      mockModels.User.findByPk.mockResolvedValue({
        id: 1,
        referralCode: "JOHN1234",
        referralCredits: 5000,
      });
      mockModels.Referral.getStats.mockResolvedValue({
        totalReferrals: 5,
        pending: 2,
        qualified: 1,
        rewarded: 2,
        totalEarned: 5000,
      });

      const stats = await ReferralService.getUserReferralStats(1, mockModels);

      expect(stats.referralCode).toBe("JOHN1234");
      expect(stats.availableCredits).toBe(5000);
      expect(stats.totalReferrals).toBe(5);
    });

    it("should return null if user not found", async () => {
      mockModels.User.findByPk.mockResolvedValue(null);

      const stats = await ReferralService.getUserReferralStats(999, mockModels);

      expect(stats).toBeNull();
    });
  });

  describe("getCurrentPrograms", () => {
    it("should return active programs", async () => {
      mockModels.ReferralConfig.getFormattedConfig.mockResolvedValue({
        clientToClient: {
          enabled: true,
          referrerReward: 2500,
          referredReward: 2500,
          cleaningsRequired: 1,
        },
        clientToCleaner: { enabled: false },
        cleanerToCleaner: { enabled: false },
        cleanerToClient: { enabled: false },
      });

      const result = await ReferralService.getCurrentPrograms(mockModels);

      expect(result.active).toBe(true);
      expect(result.programs).toHaveLength(1);
      expect(result.programs[0].type).toBe("client_to_client");
      expect(result.programs[0].name).toBe("Refer a Friend");
    });

    it("should return inactive if no programs enabled", async () => {
      mockModels.ReferralConfig.getFormattedConfig.mockResolvedValue({
        clientToClient: { enabled: false },
        clientToCleaner: { enabled: false },
        cleanerToCleaner: { enabled: false },
        cleanerToClient: { enabled: false },
      });

      const result = await ReferralService.getCurrentPrograms(mockModels);

      expect(result.active).toBe(false);
      expect(result.programs).toHaveLength(0);
    });

    it("should return inactive if config is null", async () => {
      mockModels.ReferralConfig.getFormattedConfig.mockResolvedValue(null);

      const result = await ReferralService.getCurrentPrograms(mockModels);

      expect(result.active).toBe(false);
    });
  });

  describe("updateReferralStatus", () => {
    it("should update referral status", async () => {
      const mockReferral = {
        id: 1,
        status: "pending",
        qualifiedAt: null,
        save: jest.fn(),
      };
      mockModels.Referral.findByPk.mockResolvedValue(mockReferral);

      const result = await ReferralService.updateReferralStatus(1, "qualified", mockModels);

      expect(result.status).toBe("qualified");
      expect(result.qualifiedAt).toBeDefined();
      expect(mockReferral.save).toHaveBeenCalled();
    });

    it("should throw error for invalid referral ID", async () => {
      mockModels.Referral.findByPk.mockResolvedValue(null);

      await expect(
        ReferralService.updateReferralStatus(999, "qualified", mockModels)
      ).rejects.toThrow("Referral not found");
    });

    it("should throw error for invalid status", async () => {
      mockModels.Referral.findByPk.mockResolvedValue({ id: 1, status: "pending" });

      await expect(
        ReferralService.updateReferralStatus(1, "invalid_status", mockModels)
      ).rejects.toThrow("Invalid status");
    });
  });
});
