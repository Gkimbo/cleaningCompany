// Mock the Sequelize DataTypes
const mockDefine = jest.fn((modelName, attributes) => {
  const MockModel = jest.fn();
  MockModel.modelName = modelName;
  MockModel.rawAttributes = attributes;
  MockModel.associate = null;
  return MockModel;
});

const mockSequelize = {
  define: mockDefine,
};

const DataTypes = {
  INTEGER: "INTEGER",
  STRING: "STRING",
  TEXT: "TEXT",
  DATE: "DATE",
  NOW: "NOW",
};

// Import the model definition function
const acceptanceModelDefiner = require("../../models/UserTermsAcceptance");

describe("UserTermsAcceptance Model", () => {
  let UserTermsAcceptance;

  beforeAll(() => {
    UserTermsAcceptance = acceptanceModelDefiner(mockSequelize, DataTypes);
  });

  describe("Model Definition", () => {
    it("should define the model with correct name", () => {
      expect(mockDefine).toHaveBeenCalledWith(
        "UserTermsAcceptance",
        expect.any(Object)
      );
    });

    it("should have userId field as required INTEGER", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.userId.type).toBe("INTEGER");
      expect(attributes.userId.allowNull).toBe(false);
    });

    it("should have termsId field as required INTEGER", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.termsId.type).toBe("INTEGER");
      expect(attributes.termsId.allowNull).toBe(false);
    });

    it("should have acceptedAt field as DATE with default NOW", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.acceptedAt.type).toBe("DATE");
      expect(attributes.acceptedAt.allowNull).toBe(false);
      expect(attributes.acceptedAt.defaultValue).toBe("NOW");
    });

    it("should have ipAddress field as optional STRING", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.ipAddress.type).toBe("STRING");
      expect(attributes.ipAddress.allowNull).toBe(true);
    });

    it("should have termsContentSnapshot field as optional TEXT", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.termsContentSnapshot.type).toBe("TEXT");
      expect(attributes.termsContentSnapshot.allowNull).toBe(true);
    });

    it("should have pdfSnapshotPath field as optional STRING", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.pdfSnapshotPath.type).toBe("STRING");
      expect(attributes.pdfSnapshotPath.allowNull).toBe(true);
    });
  });

  describe("Associations", () => {
    it("should define associate function", () => {
      expect(UserTermsAcceptance.associate).toBeDefined();
      expect(typeof UserTermsAcceptance.associate).toBe("function");
    });

    it("should set up belongsTo User association", () => {
      const mockBelongsTo = jest.fn();
      UserTermsAcceptance.belongsTo = mockBelongsTo;

      const mockModels = {
        User: { name: "User" },
        TermsAndConditions: { name: "TermsAndConditions" },
      };

      UserTermsAcceptance.associate(mockModels);

      expect(mockBelongsTo).toHaveBeenCalledWith(mockModels.User, {
        foreignKey: "userId",
        as: "user",
      });
    });

    it("should set up belongsTo TermsAndConditions association", () => {
      const mockBelongsTo = jest.fn();
      UserTermsAcceptance.belongsTo = mockBelongsTo;

      const mockModels = {
        User: { name: "User" },
        TermsAndConditions: { name: "TermsAndConditions" },
      };

      UserTermsAcceptance.associate(mockModels);

      expect(mockBelongsTo).toHaveBeenCalledWith(mockModels.TermsAndConditions, {
        foreignKey: "termsId",
        as: "terms",
      });
    });
  });

  describe("Field Constraints", () => {
    it("should require userId for creating acceptance record", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.userId.allowNull).toBe(false);
    });

    it("should require termsId for creating acceptance record", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.termsId.allowNull).toBe(false);
    });

    it("should allow null for optional audit fields", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.ipAddress.allowNull).toBe(true);
    });
  });

  describe("Snapshot Fields", () => {
    it("should have termsContentSnapshot for storing text content at acceptance time", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.termsContentSnapshot).toBeDefined();
      expect(attributes.termsContentSnapshot.type).toBe("TEXT");
    });

    it("should have pdfSnapshotPath for storing PDF file path at acceptance time", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.pdfSnapshotPath).toBeDefined();
      expect(attributes.pdfSnapshotPath.type).toBe("STRING");
    });

    it("should allow both snapshot fields to be null", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.termsContentSnapshot.allowNull).toBe(true);
      expect(attributes.pdfSnapshotPath.allowNull).toBe(true);
    });
  });

  describe("Required vs Optional Fields", () => {
    it("should have correct required fields", () => {
      const attributes = mockDefine.mock.calls[0][1];
      const requiredFields = ["userId", "termsId", "acceptedAt"];

      requiredFields.forEach((field) => {
        expect(attributes[field].allowNull).toBe(false);
      });
    });

    it("should have correct optional fields", () => {
      const attributes = mockDefine.mock.calls[0][1];
      const optionalFields = ["ipAddress", "termsContentSnapshot", "pdfSnapshotPath"];

      optionalFields.forEach((field) => {
        expect(attributes[field].allowNull).toBe(true);
      });
    });
  });
});
