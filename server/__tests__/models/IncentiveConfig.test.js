// Mock the Sequelize DataTypes
const mockDefine = jest.fn((modelName, attributes) => {
  const MockModel = jest.fn();
  MockModel.modelName = modelName;
  MockModel.rawAttributes = attributes;
  MockModel.associate = null;
  MockModel.getActive = null;
  MockModel.getFormattedConfig = null;
  MockModel.updateIncentives = null;
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
const incentiveConfigDefiner = require("../../models/IncentiveConfig");

describe("IncentiveConfig Model", () => {
  let IncentiveConfig;

  beforeAll(() => {
    IncentiveConfig = incentiveConfigDefiner(mockSequelize, DataTypes);
  });

  describe("Model Definition", () => {
    it("should define the model with correct name", () => {
      expect(mockDefine).toHaveBeenCalledWith(
        "IncentiveConfig",
        expect.any(Object)
      );
    });

    describe("Cleaner Incentive Fields", () => {
      it("should have cleanerIncentiveEnabled field as BOOLEAN with default false", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.cleanerIncentiveEnabled.type).toBe("BOOLEAN");
        expect(attributes.cleanerIncentiveEnabled.allowNull).toBe(false);
        expect(attributes.cleanerIncentiveEnabled.defaultValue).toBe(false);
      });

      it("should have cleanerFeeReductionPercent field as DECIMAL with default 1.0", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.cleanerFeeReductionPercent.type.type).toBe("DECIMAL");
        expect(attributes.cleanerFeeReductionPercent.type.precision).toBe(3);
        expect(attributes.cleanerFeeReductionPercent.type.scale).toBe(2);
        expect(attributes.cleanerFeeReductionPercent.defaultValue).toBe(1.0);
      });

      it("should have cleanerEligibilityDays field as INTEGER with default 30", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.cleanerEligibilityDays.type).toBe("INTEGER");
        expect(attributes.cleanerEligibilityDays.allowNull).toBe(false);
        expect(attributes.cleanerEligibilityDays.defaultValue).toBe(30);
      });

      it("should have cleanerMaxCleanings field as INTEGER with default 5", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.cleanerMaxCleanings.type).toBe("INTEGER");
        expect(attributes.cleanerMaxCleanings.allowNull).toBe(false);
        expect(attributes.cleanerMaxCleanings.defaultValue).toBe(5);
      });
    });

    describe("Homeowner Incentive Fields", () => {
      it("should have homeownerIncentiveEnabled field as BOOLEAN with default false", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.homeownerIncentiveEnabled.type).toBe("BOOLEAN");
        expect(attributes.homeownerIncentiveEnabled.allowNull).toBe(false);
        expect(attributes.homeownerIncentiveEnabled.defaultValue).toBe(false);
      });

      it("should have homeownerDiscountPercent field as DECIMAL with default 0.1", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.homeownerDiscountPercent.type.type).toBe("DECIMAL");
        expect(attributes.homeownerDiscountPercent.type.precision).toBe(3);
        expect(attributes.homeownerDiscountPercent.type.scale).toBe(2);
        expect(attributes.homeownerDiscountPercent.defaultValue).toBe(0.1);
      });

      it("should have homeownerMaxCleanings field as INTEGER with default 4", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.homeownerMaxCleanings.type).toBe("INTEGER");
        expect(attributes.homeownerMaxCleanings.allowNull).toBe(false);
        expect(attributes.homeownerMaxCleanings.defaultValue).toBe(4);
      });
    });

    describe("Audit Fields", () => {
      it("should have isActive field as BOOLEAN with default true", () => {
        const attributes = mockDefine.mock.calls[0][1];
        expect(attributes.isActive.type).toBe("BOOLEAN");
        expect(attributes.isActive.allowNull).toBe(false);
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
      expect(IncentiveConfig.associate).toBeDefined();
      expect(typeof IncentiveConfig.associate).toBe("function");
    });

    it("should set up belongsTo User association", () => {
      const mockBelongsTo = jest.fn();
      IncentiveConfig.belongsTo = mockBelongsTo;

      const mockModels = {
        User: { name: "User" },
      };

      IncentiveConfig.associate(mockModels);

      expect(mockBelongsTo).toHaveBeenCalledWith(mockModels.User, {
        foreignKey: "updatedBy",
        as: "updatedByUser",
      });
    });
  });

  describe("Static Methods", () => {
    it("should define getActive static method", () => {
      expect(IncentiveConfig.getActive).toBeDefined();
      expect(typeof IncentiveConfig.getActive).toBe("function");
    });

    it("should define getFormattedConfig static method", () => {
      expect(IncentiveConfig.getFormattedConfig).toBeDefined();
      expect(typeof IncentiveConfig.getFormattedConfig).toBe("function");
    });

    it("should define updateIncentives static method", () => {
      expect(IncentiveConfig.updateIncentives).toBeDefined();
      expect(typeof IncentiveConfig.updateIncentives).toBe("function");
    });

    it("should define getHistory static method", () => {
      expect(IncentiveConfig.getHistory).toBeDefined();
      expect(typeof IncentiveConfig.getHistory).toBe("function");
    });
  });

  describe("Required Fields", () => {
    it("should have all incentive fields as non-null", () => {
      const attributes = mockDefine.mock.calls[0][1];
      const requiredFields = [
        "cleanerIncentiveEnabled",
        "cleanerFeeReductionPercent",
        "cleanerEligibilityDays",
        "cleanerMaxCleanings",
        "homeownerIncentiveEnabled",
        "homeownerDiscountPercent",
        "homeownerMaxCleanings",
        "isActive",
      ];

      requiredFields.forEach((field) => {
        expect(attributes[field].allowNull).toBe(false);
      });
    });
  });

  describe("Field Comments", () => {
    it("should have comments on cleaner incentive fields", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.cleanerIncentiveEnabled.comment).toBeDefined();
      expect(attributes.cleanerFeeReductionPercent.comment).toBeDefined();
      expect(attributes.cleanerEligibilityDays.comment).toBeDefined();
      expect(attributes.cleanerMaxCleanings.comment).toBeDefined();
    });

    it("should have comments on homeowner incentive fields", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.homeownerIncentiveEnabled.comment).toBeDefined();
      expect(attributes.homeownerDiscountPercent.comment).toBeDefined();
      expect(attributes.homeownerMaxCleanings.comment).toBeDefined();
    });

    it("should have comments on audit fields", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.isActive.comment).toBeDefined();
      expect(attributes.updatedBy.comment).toBeDefined();
      expect(attributes.changeNote.comment).toBeDefined();
    });
  });
});
