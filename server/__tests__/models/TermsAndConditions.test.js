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
  ENUM: (...values) => ({ type: "ENUM", values }),
  INTEGER: "INTEGER",
  STRING: "STRING",
  TEXT: "TEXT",
  DATEONLY: "DATEONLY",
  NOW: "NOW",
};

// Import the model definition function
const termsModelDefiner = require("../../models/TermsAndConditions");

describe("TermsAndConditions Model", () => {
  let TermsAndConditions;

  beforeAll(() => {
    TermsAndConditions = termsModelDefiner(mockSequelize, DataTypes);
  });

  describe("Model Definition", () => {
    it("should define the model with correct name", () => {
      expect(mockDefine).toHaveBeenCalledWith(
        "TermsAndConditions",
        expect.any(Object)
      );
    });

    it("should have type field as ENUM with homeowner and cleaner", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.type.type.type).toBe("ENUM");
      expect(attributes.type.type.values).toEqual(["homeowner", "cleaner"]);
      expect(attributes.type.allowNull).toBe(false);
    });

    it("should have version field as INTEGER", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.version.type).toBe("INTEGER");
      expect(attributes.version.allowNull).toBe(false);
    });

    it("should have title field as STRING", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.title.type).toBe("STRING");
      expect(attributes.title.allowNull).toBe(false);
    });

    it("should have content field as TEXT that allows null", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.content.type).toBe("TEXT");
      expect(attributes.content.allowNull).toBe(true);
    });

    it("should have contentType field as ENUM with text and pdf", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.contentType.type.type).toBe("ENUM");
      expect(attributes.contentType.type.values).toEqual(["text", "pdf"]);
      expect(attributes.contentType.allowNull).toBe(false);
      expect(attributes.contentType.defaultValue).toBe("text");
    });

    it("should have pdfFileName field as optional STRING", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.pdfFileName.type).toBe("STRING");
      expect(attributes.pdfFileName.allowNull).toBe(true);
    });

    it("should have pdfFilePath field as optional STRING", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.pdfFilePath.type).toBe("STRING");
      expect(attributes.pdfFilePath.allowNull).toBe(true);
    });

    it("should have pdfFileSize field as optional INTEGER", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.pdfFileSize.type).toBe("INTEGER");
      expect(attributes.pdfFileSize.allowNull).toBe(true);
    });

    it("should have effectiveDate field as required DATEONLY", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.effectiveDate.type).toBe("DATEONLY");
      expect(attributes.effectiveDate.allowNull).toBe(false);
    });

    it("should have createdBy field as optional INTEGER", () => {
      const attributes = mockDefine.mock.calls[0][1];
      expect(attributes.createdBy.type).toBe("INTEGER");
      expect(attributes.createdBy.allowNull).toBe(true);
    });
  });

  describe("Associations", () => {
    it("should define associate function", () => {
      expect(TermsAndConditions.associate).toBeDefined();
      expect(typeof TermsAndConditions.associate).toBe("function");
    });

    it("should set up belongsTo User association", () => {
      const mockBelongsTo = jest.fn();
      const mockHasMany = jest.fn();
      TermsAndConditions.belongsTo = mockBelongsTo;
      TermsAndConditions.hasMany = mockHasMany;

      const mockModels = {
        User: { name: "User" },
        UserTermsAcceptance: { name: "UserTermsAcceptance" },
      };

      TermsAndConditions.associate(mockModels);

      expect(mockBelongsTo).toHaveBeenCalledWith(mockModels.User, {
        foreignKey: "createdBy",
        as: "creator",
      });
    });

    it("should set up hasMany UserTermsAcceptance association", () => {
      const mockBelongsTo = jest.fn();
      const mockHasMany = jest.fn();
      TermsAndConditions.belongsTo = mockBelongsTo;
      TermsAndConditions.hasMany = mockHasMany;

      const mockModels = {
        User: { name: "User" },
        UserTermsAcceptance: { name: "UserTermsAcceptance" },
      };

      TermsAndConditions.associate(mockModels);

      expect(mockHasMany).toHaveBeenCalledWith(mockModels.UserTermsAcceptance, {
        foreignKey: "termsId",
        as: "acceptances",
      });
    });
  });

  describe("Field Validations", () => {
    it("should not allow invalid type enum values", () => {
      const attributes = mockDefine.mock.calls[0][1];
      const validTypes = attributes.type.type.values;
      expect(validTypes).toContain("homeowner");
      expect(validTypes).toContain("cleaner");
      expect(validTypes).not.toContain("admin");
      expect(validTypes).not.toContain("owner");
    });

    it("should not allow invalid contentType enum values", () => {
      const attributes = mockDefine.mock.calls[0][1];
      const validContentTypes = attributes.contentType.type.values;
      expect(validContentTypes).toContain("text");
      expect(validContentTypes).toContain("pdf");
      expect(validContentTypes).not.toContain("html");
      expect(validContentTypes).not.toContain("markdown");
    });

    it("should have correct required fields", () => {
      const attributes = mockDefine.mock.calls[0][1];
      const requiredFields = ["type", "version", "title", "contentType", "effectiveDate"];
      const optionalFields = ["content", "pdfFileName", "pdfFilePath", "pdfFileSize", "createdBy"];

      requiredFields.forEach((field) => {
        expect(attributes[field].allowNull).toBe(false);
      });

      optionalFields.forEach((field) => {
        expect(attributes[field].allowNull).toBe(true);
      });
    });
  });
});
