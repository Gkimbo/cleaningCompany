// Mock the Sequelize DataTypes
const mockDefine = jest.fn((modelName, attributes) => {
  const MockModel = jest.fn();
  MockModel.modelName = modelName;
  MockModel.rawAttributes = attributes;
  MockModel.associate = null;
  MockModel.getActive = null;
  MockModel.getFormattedPricing = null;
  MockModel.updatePricing = null;
  MockModel.getHistory = null;
  return MockModel;
});

const mockSequelize = {
  define: mockDefine,
  transaction: jest.fn(() => ({
    commit: jest.fn(),
    rollback: jest.fn(),
  })),
};

const DataTypes = {
  INTEGER: "INTEGER",
  STRING: "STRING",
  TEXT: "TEXT",
  BOOLEAN: "BOOLEAN",
  DECIMAL: (precision, scale) => ({ type: "DECIMAL", precision, scale }),
};

// Import the model definition function
const pricingConfigDefiner = require("../../models/PricingConfig");

describe("PricingConfig Model", () => {
  let PricingConfig;

  beforeAll(() => {
    PricingConfig = pricingConfigDefiner(mockSequelize, DataTypes);
  });

  describe("Model Definition", () => {
    it("should define the model with correct name", () => {
      expect(mockDefine).toHaveBeenCalledWith(
        "PricingConfig",
        expect.any(Object)
      );
    });

    describe("Base Pricing Fields", () => {
      it("should have basePrice field as INTEGER with default 150", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.basePrice.type).toBe("INTEGER");
        expect(attributes.basePrice.allowNull).toBe(false);
        expect(attributes.basePrice.defaultValue).toBe(150);
      });

      it("should have extraBedBathFee field as INTEGER with default 50", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.extraBedBathFee.type).toBe("INTEGER");
        expect(attributes.extraBedBathFee.allowNull).toBe(false);
        expect(attributes.extraBedBathFee.defaultValue).toBe(50);
      });
    });

    describe("Linen Service Fields", () => {
      it("should have sheetFeePerBed field as INTEGER with default 30", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.sheetFeePerBed.type).toBe("INTEGER");
        expect(attributes.sheetFeePerBed.defaultValue).toBe(30);
      });

      it("should have towelFee field as INTEGER with default 5", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.towelFee.type).toBe("INTEGER");
        expect(attributes.towelFee.defaultValue).toBe(5);
      });

      it("should have faceClothFee field as INTEGER with default 2", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.faceClothFee.type).toBe("INTEGER");
        expect(attributes.faceClothFee.defaultValue).toBe(2);
      });
    });

    describe("Time Window Fields", () => {
      it("should have timeWindowAnytime field with default 0", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.timeWindowAnytime.type).toBe("INTEGER");
        expect(attributes.timeWindowAnytime.defaultValue).toBe(0);
      });

      it("should have timeWindow10To3 field with default 25", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.timeWindow10To3.type).toBe("INTEGER");
        expect(attributes.timeWindow10To3.defaultValue).toBe(25);
      });

      it("should have timeWindow11To4 field with default 25", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.timeWindow11To4.type).toBe("INTEGER");
        expect(attributes.timeWindow11To4.defaultValue).toBe(25);
      });

      it("should have timeWindow12To2 field with default 30", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.timeWindow12To2.type).toBe("INTEGER");
        expect(attributes.timeWindow12To2.defaultValue).toBe(30);
      });
    });

    describe("Cancellation Policy Fields", () => {
      it("should have cancellationFee field with default 25", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.cancellationFee.type).toBe("INTEGER");
        expect(attributes.cancellationFee.defaultValue).toBe(25);
      });

      it("should have cancellationWindowDays field with default 7", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.cancellationWindowDays.type).toBe("INTEGER");
        expect(attributes.cancellationWindowDays.defaultValue).toBe(7);
      });

      it("should have homeownerPenaltyDays field with default 3", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.homeownerPenaltyDays.type).toBe("INTEGER");
        expect(attributes.homeownerPenaltyDays.defaultValue).toBe(3);
      });

      it("should have cleanerPenaltyDays field with default 4", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.cleanerPenaltyDays.type).toBe("INTEGER");
        expect(attributes.cleanerPenaltyDays.defaultValue).toBe(4);
      });

      it("should have refundPercentage field as DECIMAL with default 0.50", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.refundPercentage.type.type).toBe("DECIMAL");
        expect(attributes.refundPercentage.type.precision).toBe(3);
        expect(attributes.refundPercentage.type.scale).toBe(2);
        expect(attributes.refundPercentage.defaultValue).toBe(0.50);
      });
    });

    describe("Platform Fee Fields", () => {
      it("should have platformFeePercent field as DECIMAL with default 0.10", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.platformFeePercent.type.type).toBe("DECIMAL");
        expect(attributes.platformFeePercent.defaultValue).toBe(0.10);
      });

      it("should have highVolumeFee field with default 50", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.highVolumeFee.type).toBe("INTEGER");
        expect(attributes.highVolumeFee.defaultValue).toBe(50);
      });
    });

    describe("Audit Fields", () => {
      it("should have isActive field as BOOLEAN with default true", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.isActive.type).toBe("BOOLEAN");
        expect(attributes.isActive.defaultValue).toBe(true);
      });

      it("should have updatedBy field as nullable INTEGER", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.updatedBy.type).toBe("INTEGER");
        expect(attributes.updatedBy.allowNull).toBe(true);
      });

      it("should have changeNote field as nullable TEXT", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.changeNote.type).toBe("TEXT");
        expect(attributes.changeNote.allowNull).toBe(true);
      });
    });
  });

  describe("Associations", () => {
    it("should define associate function", () => {
      expect(PricingConfig.associate).toBeDefined();
      expect(typeof PricingConfig.associate).toBe("function");
    });

    it("should set up belongsTo User association", () => {
      const mockBelongsTo = jest.fn();
      PricingConfig.belongsTo = mockBelongsTo;

      const mockModels = {
        User: { name: "User" },
      };

      PricingConfig.associate(mockModels);

      expect(mockBelongsTo).toHaveBeenCalledWith(mockModels.User, {
        foreignKey: "updatedBy",
        as: "updatedByUser",
      });
    });
  });

  describe("Static Methods", () => {
    it("should define getActive static method", () => {
      expect(PricingConfig.getActive).toBeDefined();
      expect(typeof PricingConfig.getActive).toBe("function");
    });

    it("should define getFormattedPricing static method", () => {
      expect(PricingConfig.getFormattedPricing).toBeDefined();
      expect(typeof PricingConfig.getFormattedPricing).toBe("function");
    });

    it("should define updatePricing static method", () => {
      expect(PricingConfig.updatePricing).toBeDefined();
      expect(typeof PricingConfig.updatePricing).toBe("function");
    });

    it("should define getHistory static method", () => {
      expect(PricingConfig.getHistory).toBeDefined();
      expect(typeof PricingConfig.getHistory).toBe("function");
    });
  });

  describe("Required Fields", () => {
    it("should have all pricing fields as non-null", () => {
      const attributes = mockDefine.mock.calls[0][1];
      const pricingFields = [
        "basePrice",
        "extraBedBathFee",
        "sheetFeePerBed",
        "towelFee",
        "faceClothFee",
        "timeWindowAnytime",
        "timeWindow10To3",
        "timeWindow11To4",
        "timeWindow12To2",
        "cancellationFee",
        "cancellationWindowDays",
        "homeownerPenaltyDays",
        "cleanerPenaltyDays",
        "refundPercentage",
        "platformFeePercent",
        "highVolumeFee",
        "isActive",
      ];

      pricingFields.forEach((field) => {
        expect(attributes[field].allowNull).toBe(false);
      });
    });
  });
});
