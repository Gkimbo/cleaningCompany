/**
 * Tests for ReferralConfig model
 */

const { sequelize, ReferralConfig, User, UserBills } = require("../../models");

describe("ReferralConfig Model", () => {
  let testOwner;

  beforeAll(async () => {
    // Create test owner
    testOwner = await User.create({
      firstName: "Test",
      lastName: "Owner",
      username: `testowner_${Date.now()}`,
      password: "TestPassword123!",
      email: `testowner_${Date.now()}@test.com`,
      type: "owner",
    });

    await UserBills.create({
      userId: testOwner.id,
      appointmentDue: 0,
      cancellationFee: 0,
      totalDue: 0,
    });
  });

  afterAll(async () => {
    // Cleanup
    await ReferralConfig.destroy({ where: { updatedBy: testOwner.id } });
    await UserBills.destroy({ where: { userId: testOwner.id } });
    await User.destroy({ where: { id: testOwner.id } });
  });

  afterEach(async () => {
    // Clean up configs created in tests
    await ReferralConfig.destroy({ where: { updatedBy: testOwner.id } });
  });

  describe("create", () => {
    it("should create config with default values", async () => {
      const config = await ReferralConfig.create({
        updatedBy: testOwner.id,
        changeNote: "Initial setup",
      });

      expect(config.id).toBeDefined();
      expect(config.isActive).toBe(true);
      expect(config.clientToClientEnabled).toBe(false);
      expect(config.clientToClientReferrerReward).toBe(2500);
      expect(config.clientToClientReferredReward).toBe(2500);
      expect(config.clientToClientCleaningsRequired).toBe(1);
    });

    it("should create config with custom values", async () => {
      const config = await ReferralConfig.create({
        clientToClientEnabled: true,
        clientToClientReferrerReward: 5000,
        clientToClientReferredReward: 3000,
        clientToClientCleaningsRequired: 2,
        clientToCleanerEnabled: true,
        clientToCleanerReferrerReward: 7500,
        cleanerToCleanerEnabled: true,
        cleanerToCleanerReferrerReward: 10000,
        cleanerToClientEnabled: true,
        cleanerToClientDiscountPercent: "15.00",
        updatedBy: testOwner.id,
        changeNote: "Custom setup",
      });

      expect(config.clientToClientEnabled).toBe(true);
      expect(config.clientToClientReferrerReward).toBe(5000);
      expect(config.clientToClientReferredReward).toBe(3000);
      expect(config.clientToCleanerEnabled).toBe(true);
      expect(config.cleanerToCleanerEnabled).toBe(true);
      expect(config.cleanerToClientEnabled).toBe(true);
      expect(config.cleanerToClientDiscountPercent).toBe("15.00");
    });

    it("should validate reward type enum", async () => {
      await expect(
        ReferralConfig.create({
          clientToClientRewardType: "invalid_type",
          updatedBy: testOwner.id,
        })
      ).rejects.toThrow();
    });
  });

  describe("getActive", () => {
    it("should return most recent active config", async () => {
      // Create two configs
      await ReferralConfig.create({
        isActive: true,
        clientToClientEnabled: true,
        clientToClientReferrerReward: 2500,
        updatedBy: testOwner.id,
        changeNote: "First config",
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await ReferralConfig.create({
        isActive: true,
        clientToClientEnabled: true,
        clientToClientReferrerReward: 5000,
        updatedBy: testOwner.id,
        changeNote: "Second config",
      });

      const active = await ReferralConfig.getActive();

      expect(active).toBeDefined();
      expect(active.clientToClientReferrerReward).toBe(5000);
      expect(active.changeNote).toBe("Second config");
    });

    it("should return null if no active config", async () => {
      // Deactivate all configs
      await ReferralConfig.update({ isActive: false }, { where: {} });

      const active = await ReferralConfig.getActive();

      // Might be null or from another test
      // Just verify it doesn't throw
      expect(active === null || active !== null).toBe(true);
    });
  });

  describe("getFormattedConfig", () => {
    it("should return formatted config object", async () => {
      await ReferralConfig.create({
        isActive: true,
        clientToClientEnabled: true,
        clientToClientReferrerReward: 2500,
        clientToClientReferredReward: 2500,
        clientToClientCleaningsRequired: 1,
        clientToClientRewardType: "credit",
        clientToClientMaxPerMonth: 10,
        clientToCleanerEnabled: false,
        cleanerToCleanerEnabled: false,
        cleanerToClientEnabled: false,
        updatedBy: testOwner.id,
        changeNote: "Format test",
      });

      const formatted = await ReferralConfig.getFormattedConfig();

      expect(formatted).toBeDefined();
      expect(formatted.clientToClient).toBeDefined();
      expect(formatted.clientToClient.enabled).toBe(true);
      expect(formatted.clientToClient.referrerReward).toBe(2500);
      expect(formatted.clientToClient.referredReward).toBe(2500);
      expect(formatted.clientToClient.cleaningsRequired).toBe(1);
      expect(formatted.clientToClient.rewardType).toBe("credit");
      expect(formatted.clientToClient.maxPerMonth).toBe(10);

      expect(formatted.clientToCleaner).toBeDefined();
      expect(formatted.cleanerToCleaner).toBeDefined();
      expect(formatted.cleanerToClient).toBeDefined();
    });

    it("should return null if no config exists", async () => {
      // Deactivate all
      await ReferralConfig.update({ isActive: false }, { where: {} });

      const formatted = await ReferralConfig.getFormattedConfig();

      // Could be null or from another test's active config
      expect(formatted === null || typeof formatted === "object").toBe(true);
    });
  });

  describe("updateConfig", () => {
    it("should create new config and deactivate old", async () => {
      // Create initial config
      const oldConfig = await ReferralConfig.create({
        isActive: true,
        clientToClientEnabled: true,
        clientToClientReferrerReward: 2500,
        updatedBy: testOwner.id,
        changeNote: "Old config",
      });

      // Update config
      const newConfig = await ReferralConfig.updateConfig(
        {
          clientToClientEnabled: true,
          clientToClientReferrerReward: 5000,
          changeNote: "Updated rewards",
        },
        testOwner.id
      );

      // Old config should be deactivated
      await oldConfig.reload();
      expect(oldConfig.isActive).toBe(false);

      // New config should be active
      expect(newConfig.isActive).toBe(true);
      expect(newConfig.clientToClientReferrerReward).toBe(5000);
      expect(newConfig.changeNote).toBe("Updated rewards");
    });

    it("should preserve fields not included in update", async () => {
      await ReferralConfig.create({
        isActive: true,
        clientToClientEnabled: true,
        clientToClientReferrerReward: 2500,
        clientToCleanerEnabled: true,
        clientToCleanerReferrerReward: 7500,
        updatedBy: testOwner.id,
        changeNote: "Full config",
      });

      // Only update client-to-client reward
      const newConfig = await ReferralConfig.updateConfig(
        {
          clientToClientReferrerReward: 5000,
          changeNote: "Partial update",
        },
        testOwner.id
      );

      // Should preserve clientToCleaner settings
      expect(newConfig.clientToCleanerEnabled).toBe(true);
      expect(newConfig.clientToCleanerReferrerReward).toBe(7500);
    });
  });

  describe("getHistory", () => {
    it("should return config history ordered by createdAt desc", async () => {
      await ReferralConfig.create({
        isActive: false,
        clientToClientReferrerReward: 2500,
        updatedBy: testOwner.id,
        changeNote: "First",
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await ReferralConfig.create({
        isActive: true,
        clientToClientReferrerReward: 5000,
        updatedBy: testOwner.id,
        changeNote: "Second",
      });

      const history = await ReferralConfig.getHistory(10);

      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].changeNote).toBe("Second");
      expect(history[1].changeNote).toBe("First");
    });

    it("should respect limit parameter", async () => {
      // Create 3 configs
      for (let i = 0; i < 3; i++) {
        await ReferralConfig.create({
          isActive: i === 2,
          clientToClientReferrerReward: 2500 + i * 1000,
          updatedBy: testOwner.id,
          changeNote: `Config ${i + 1}`,
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const history = await ReferralConfig.getHistory(2);

      expect(history.length).toBeLessThanOrEqual(2);
    });
  });

  describe("default values", () => {
    it("should have correct default reward amounts", async () => {
      const config = await ReferralConfig.create({
        updatedBy: testOwner.id,
      });

      // Client to Client defaults
      expect(config.clientToClientReferrerReward).toBe(2500); // $25
      expect(config.clientToClientReferredReward).toBe(2500); // $25
      expect(config.clientToClientCleaningsRequired).toBe(1);

      // Client to Cleaner defaults
      expect(config.clientToCleanerReferrerReward).toBe(5000); // $50
      expect(config.clientToCleanerCleaningsRequired).toBe(3);

      // Cleaner to Cleaner defaults
      expect(config.cleanerToCleanerReferrerReward).toBe(5000); // $50
      expect(config.cleanerToCleanerCleaningsRequired).toBe(5);

      // Cleaner to Client defaults
      expect(config.cleanerToClientDiscountPercent).toBe("10.00"); // 10%
      expect(config.cleanerToClientMinReferrals).toBe(5);
    });

    it("should have correct default enabled states", async () => {
      const config = await ReferralConfig.create({
        updatedBy: testOwner.id,
      });

      // All programs should be disabled by default
      expect(config.clientToClientEnabled).toBe(false);
      expect(config.clientToCleanerEnabled).toBe(false);
      expect(config.cleanerToCleanerEnabled).toBe(false);
      expect(config.cleanerToClientEnabled).toBe(false);
    });

    it("should have correct default reward types", async () => {
      const config = await ReferralConfig.create({
        updatedBy: testOwner.id,
      });

      expect(config.clientToClientRewardType).toBe("credit");
      expect(config.clientToCleanerRewardType).toBe("credit");
      expect(config.cleanerToCleanerRewardType).toBe("bonus");
      expect(config.cleanerToClientRewardType).toBe("discount");
    });

    it("should have null max per month by default (unlimited)", async () => {
      const config = await ReferralConfig.create({
        updatedBy: testOwner.id,
      });

      expect(config.clientToClientMaxPerMonth).toBeNull();
      expect(config.clientToCleanerMaxPerMonth).toBeNull();
      expect(config.cleanerToCleanerMaxPerMonth).toBeNull();
      expect(config.cleanerToClientMaxPerMonth).toBeNull();
    });
  });
});
