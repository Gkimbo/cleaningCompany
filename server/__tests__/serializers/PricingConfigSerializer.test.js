const PricingConfigSerializer = require("../../serializers/PricingConfigSerializer");

describe("PricingConfigSerializer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("serializeOne", () => {
    it("should serialize basic pricing config fields", () => {
      const mockConfig = {
        dataValues: {
          id: 1,
          basePrice: 150,
          extraBedBathFee: 50,
          halfBathFee: 25,
          sheetFeePerBed: 30,
          towelFee: 5,
          faceClothFee: 2,
          timeWindowAnytime: 0,
          timeWindow10To3: 25,
          timeWindow11To4: 25,
          timeWindow12To2: 30,
          cancellationFee: 25,
          cancellationWindowDays: 7,
          homeownerPenaltyDays: 3,
          cleanerPenaltyDays: 4,
          highVolumeFee: 50,
          isActive: true,
        },
      };

      const result = PricingConfigSerializer.serializeOne(mockConfig);

      expect(result.id).toBe(1);
      expect(result.basePrice).toBe(150);
      expect(result.extraBedBathFee).toBe(50);
      expect(result.halfBathFee).toBe(25);
      expect(result.sheetFeePerBed).toBe(30);
      expect(result.towelFee).toBe(5);
      expect(result.faceClothFee).toBe(2);
      expect(result.timeWindowAnytime).toBe(0);
      expect(result.timeWindow10To3).toBe(25);
      expect(result.timeWindow11To4).toBe(25);
      expect(result.timeWindow12To2).toBe(30);
      expect(result.cancellationFee).toBe(25);
      expect(result.cancellationWindowDays).toBe(7);
      expect(result.homeownerPenaltyDays).toBe(3);
      expect(result.cleanerPenaltyDays).toBe(4);
      expect(result.highVolumeFee).toBe(50);
      expect(result.isActive).toBe(true);
    });

    it("should parse decimal percentage fields as numbers", () => {
      const mockConfig = {
        dataValues: {
          id: 1,
          refundPercentage: "0.50",
          platformFeePercent: "0.10",
          businessOwnerFeePercent: "0.10",
          multiCleanerPlatformFeePercent: "0.13",
          incentiveRefundPercent: "0.10",
          incentiveCleanerPercent: "0.40",
          largeBusinessFeePercent: "0.07",
        },
      };

      const result = PricingConfigSerializer.serializeOne(mockConfig);

      expect(result.refundPercentage).toBe(0.5);
      expect(typeof result.refundPercentage).toBe("number");
      expect(result.platformFeePercent).toBe(0.1);
      expect(typeof result.platformFeePercent).toBe("number");
      expect(result.businessOwnerFeePercent).toBe(0.1);
      expect(typeof result.businessOwnerFeePercent).toBe("number");
      expect(result.multiCleanerPlatformFeePercent).toBe(0.13);
      expect(typeof result.multiCleanerPlatformFeePercent).toBe("number");
      expect(result.incentiveRefundPercent).toBe(0.1);
      expect(typeof result.incentiveRefundPercent).toBe("number");
      expect(result.incentiveCleanerPercent).toBe(0.4);
      expect(typeof result.incentiveCleanerPercent).toBe("number");
      expect(result.largeBusinessFeePercent).toBe(0.07);
      expect(typeof result.largeBusinessFeePercent).toBe("number");
    });

    it("should use default values for missing optional fields", () => {
      const mockConfig = {
        dataValues: {
          id: 1,
          refundPercentage: "0.50",
          platformFeePercent: "0.10",
        },
      };

      const result = PricingConfigSerializer.serializeOne(mockConfig);

      expect(result.businessOwnerFeePercent).toBe(0.1); // fallback to platformFeePercent
      expect(result.multiCleanerPlatformFeePercent).toBe(0.13);
      expect(result.incentiveRefundPercent).toBe(0.1);
      expect(result.incentiveCleanerPercent).toBe(0.4);
      expect(result.largeBusinessFeePercent).toBe(0.07);
    });

    it("should include large business fee configuration fields", () => {
      const mockConfig = {
        dataValues: {
          id: 1,
          largeBusinessFeePercent: "0.07",
          largeBusinessMonthlyThreshold: 50,
          largeBusinessLookbackMonths: 1,
          refundPercentage: "0.50",
          platformFeePercent: "0.10",
        },
      };

      const result = PricingConfigSerializer.serializeOne(mockConfig);

      expect(result.largeBusinessFeePercent).toBe(0.07);
      expect(result.largeBusinessMonthlyThreshold).toBe(50);
      expect(result.largeBusinessLookbackMonths).toBe(1);
    });

    it("should use default values for missing large business fields", () => {
      const mockConfig = {
        dataValues: {
          id: 1,
          refundPercentage: "0.50",
          platformFeePercent: "0.10",
        },
      };

      const result = PricingConfigSerializer.serializeOne(mockConfig);

      expect(result.largeBusinessMonthlyThreshold).toBe(50);
      expect(result.largeBusinessLookbackMonths).toBe(1);
    });

    it("should include last-minute booking configuration fields", () => {
      const mockConfig = {
        dataValues: {
          id: 1,
          lastMinuteFee: 50,
          lastMinuteThresholdHours: 48,
          lastMinuteNotificationRadiusMiles: "25.00",
          refundPercentage: "0.50",
          platformFeePercent: "0.10",
        },
      };

      const result = PricingConfigSerializer.serializeOne(mockConfig);

      expect(result.lastMinuteFee).toBe(50);
      expect(result.lastMinuteThresholdHours).toBe(48);
      expect(result.lastMinuteNotificationRadiusMiles).toBe(25);
      expect(typeof result.lastMinuteNotificationRadiusMiles).toBe("number");
    });

    it("should use default values for missing last-minute fields", () => {
      const mockConfig = {
        dataValues: {
          id: 1,
          refundPercentage: "0.50",
          platformFeePercent: "0.10",
        },
      };

      const result = PricingConfigSerializer.serializeOne(mockConfig);

      expect(result.lastMinuteFee).toBe(50);
      expect(result.lastMinuteThresholdHours).toBe(48);
      expect(result.lastMinuteNotificationRadiusMiles).toBe(25);
    });

    it("should include multi-cleaner configuration fields", () => {
      const mockConfig = {
        dataValues: {
          id: 1,
          soloLargeHomeBonus: 20,
          largeHomeBedsThreshold: 4,
          largeHomeBathsThreshold: 3,
          multiCleanerOfferExpirationHours: 72,
          urgentFillDays: 5,
          finalWarningDays: 2,
          refundPercentage: "0.50",
          platformFeePercent: "0.10",
        },
      };

      const result = PricingConfigSerializer.serializeOne(mockConfig);

      expect(result.soloLargeHomeBonus).toBe(20);
      expect(result.largeHomeBedsThreshold).toBe(4);
      expect(result.largeHomeBathsThreshold).toBe(3);
      expect(result.multiCleanerOfferExpirationHours).toBe(72);
      expect(result.urgentFillDays).toBe(5);
      expect(result.finalWarningDays).toBe(2);
    });

    it("should access values directly if dataValues not present", () => {
      const mockConfig = {
        id: 1,
        basePrice: 150,
        refundPercentage: "0.50",
        platformFeePercent: "0.10",
      };

      const result = PricingConfigSerializer.serializeOne(mockConfig);

      expect(result.id).toBe(1);
      expect(result.basePrice).toBe(150);
    });
  });

  describe("serializeArray", () => {
    it("should serialize an array of configs", () => {
      const mockConfigs = [
        {
          dataValues: {
            id: 1,
            basePrice: 150,
            refundPercentage: "0.50",
            platformFeePercent: "0.10",
          },
        },
        {
          dataValues: {
            id: 2,
            basePrice: 175,
            refundPercentage: "0.60",
            platformFeePercent: "0.12",
          },
        },
      ];

      const result = PricingConfigSerializer.serializeArray(mockConfigs);

      expect(result).toHaveLength(2);
      expect(result[0].basePrice).toBe(150);
      expect(result[1].basePrice).toBe(175);
      expect(result[0].refundPercentage).toBe(0.5);
      expect(result[1].refundPercentage).toBe(0.6);
    });

    it("should handle empty array", () => {
      const result = PricingConfigSerializer.serializeArray([]);
      expect(result).toEqual([]);
    });
  });

  describe("serializeFormatted", () => {
    it("should return null for null input", () => {
      const result = PricingConfigSerializer.serializeFormatted(null);
      expect(result).toBeNull();
    });

    it("should return formatted pricing with nested structure", () => {
      const mockConfig = {
        dataValues: {
          id: 1,
          basePrice: 150,
          extraBedBathFee: 50,
          halfBathFee: 25,
          sheetFeePerBed: 30,
          towelFee: 5,
          faceClothFee: 2,
          timeWindowAnytime: 0,
          timeWindow10To3: 25,
          timeWindow11To4: 25,
          timeWindow12To2: 30,
          cancellationFee: 25,
          cancellationWindowDays: 7,
          homeownerPenaltyDays: 3,
          cleanerPenaltyDays: 4,
          refundPercentage: "0.50",
          platformFeePercent: "0.10",
          businessOwnerFeePercent: "0.10",
          highVolumeFee: 50,
          multiCleanerPlatformFeePercent: "0.13",
          soloLargeHomeBonus: 0,
          largeHomeBedsThreshold: 3,
          largeHomeBathsThreshold: 3,
          multiCleanerOfferExpirationHours: 48,
          urgentFillDays: 7,
          finalWarningDays: 3,
          largeBusinessFeePercent: "0.07",
          largeBusinessMonthlyThreshold: 50,
          largeBusinessLookbackMonths: 1,
          lastMinuteFee: 50,
          lastMinuteThresholdHours: 48,
          lastMinuteNotificationRadiusMiles: "25.00",
        },
      };

      const result = PricingConfigSerializer.serializeFormatted(mockConfig);

      // Base pricing
      expect(result.basePrice).toBe(150);
      expect(result.extraBedBathFee).toBe(50);
      expect(result.halfBathFee).toBe(25);

      // Linens
      expect(result.linens).toBeDefined();
      expect(result.linens.sheetFeePerBed).toBe(30);
      expect(result.linens.towelFee).toBe(5);
      expect(result.linens.faceClothFee).toBe(2);

      // Time windows
      expect(result.timeWindows).toBeDefined();
      expect(result.timeWindows.anytime.surcharge).toBe(0);
      expect(result.timeWindows["10-3"].surcharge).toBe(25);
      expect(result.timeWindows["11-4"].surcharge).toBe(25);
      expect(result.timeWindows["12-2"].surcharge).toBe(30);

      // Cancellation
      expect(result.cancellation).toBeDefined();
      expect(result.cancellation.fee).toBe(25);
      expect(result.cancellation.windowDays).toBe(7);
      expect(result.cancellation.refundPercentage).toBe(0.5);

      // Platform
      expect(result.platform).toBeDefined();
      expect(result.platform.feePercent).toBe(0.1);
      expect(result.platform.businessOwnerFeePercent).toBe(0.1);
      expect(result.platform.largeBusinessFeePercent).toBe(0.07);

      // Multi-cleaner
      expect(result.multiCleaner).toBeDefined();
      expect(result.multiCleaner.platformFeePercent).toBe(0.13);
      expect(result.multiCleaner.offerExpirationHours).toBe(48);

      // Last-minute
      expect(result.lastMinute).toBeDefined();
      expect(result.lastMinute.fee).toBe(50);
      expect(result.lastMinute.thresholdHours).toBe(48);
      expect(result.lastMinute.notificationRadiusMiles).toBe(25);
    });

    it("should include time window labels and descriptions", () => {
      const mockConfig = {
        dataValues: {
          timeWindowAnytime: 0,
          timeWindow10To3: 25,
          refundPercentage: "0.50",
          platformFeePercent: "0.10",
        },
      };

      const result = PricingConfigSerializer.serializeFormatted(mockConfig);

      expect(result.timeWindows.anytime.label).toBe("Anytime");
      expect(result.timeWindows["10-3"].label).toBe("10am - 3pm");
    });
  });

  describe("serializeForPublic", () => {
    it("should return null for null input", () => {
      const result = PricingConfigSerializer.serializeForPublic(null);
      expect(result).toBeNull();
    });

    it("should only include public-safe fields", () => {
      const mockConfig = {
        dataValues: {
          id: 1,
          basePrice: 150,
          extraBedBathFee: 50,
          halfBathFee: 25,
          sheetFeePerBed: 30,
          towelFee: 5,
          faceClothFee: 2,
          timeWindowAnytime: 0,
          timeWindow10To3: 25,
          timeWindow11To4: 25,
          timeWindow12To2: 30,
          cancellationFee: 25,
          cancellationWindowDays: 7,
          highVolumeFee: 50,
          // Private fields that should NOT be included
          platformFeePercent: "0.10",
          businessOwnerFeePercent: "0.10",
          refundPercentage: "0.50",
          updatedBy: 1,
          changeNote: "Internal update",
        },
      };

      const result = PricingConfigSerializer.serializeForPublic(mockConfig);

      // Should include public fields
      expect(result.basePrice).toBe(150);
      expect(result.extraBedBathFee).toBe(50);
      expect(result.sheetFeePerBed).toBe(30);
      expect(result.towelFee).toBe(5);
      expect(result.faceClothFee).toBe(2);
      expect(result.cancellationFee).toBe(25);
      expect(result.highVolumeFee).toBe(50);

      // Should NOT include private fields
      expect(result.platformFeePercent).toBeUndefined();
      expect(result.businessOwnerFeePercent).toBeUndefined();
      expect(result.refundPercentage).toBeUndefined();
      expect(result.updatedBy).toBeUndefined();
      expect(result.changeNote).toBeUndefined();
    });
  });

  describe("serializeHistory", () => {
    it("should serialize history with updater info", () => {
      const mockConfigs = [
        {
          dataValues: {
            id: 1,
            basePrice: 150,
            refundPercentage: "0.50",
            platformFeePercent: "0.10",
            createdAt: new Date("2026-01-01"),
          },
          updatedByUser: {
            id: 1,
            username: "admin",
            email: "admin@example.com",
          },
        },
      ];

      const result = PricingConfigSerializer.serializeHistory(mockConfigs);

      expect(result).toHaveLength(1);
      expect(result[0].updatedByUser).toBeDefined();
      expect(result[0].updatedByUser.id).toBe(1);
      expect(result[0].updatedByUser.username).toBe("admin");
    });

    it("should handle missing updatedByUser", () => {
      const mockConfigs = [
        {
          dataValues: {
            id: 1,
            basePrice: 150,
            refundPercentage: "0.50",
            platformFeePercent: "0.10",
          },
        },
      ];

      const result = PricingConfigSerializer.serializeHistory(mockConfigs);

      expect(result[0].updatedByUser).toBeUndefined();
    });
  });
});
