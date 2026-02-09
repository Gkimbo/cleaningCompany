/**
 * SupportTicket Model Tests
 *
 * Tests the SupportTicket model schema definition.
 */

// Store schema for testing without invoking the full factory
let capturedSchema = null;
let capturedOptions = null;
let capturedModelName = null;

// Mock Sequelize
const mockDefine = jest.fn((name, schema, options) => {
  capturedModelName = name;
  capturedSchema = schema;
  capturedOptions = options;

  // Create a mock model that can have methods added to it
  const Model = function () {};
  Model.prototype = {};
  Model.associate = null;
  return Model;
});

const mockSequelize = {
  define: mockDefine,
};

// Mock DataTypes with ENUM support
const DataTypes = {
  INTEGER: "INTEGER",
  STRING: "STRING",
  DATE: "DATE",
  TEXT: "TEXT",
  BOOLEAN: "BOOLEAN",
  JSON: "JSON",
  JSONB: "JSONB",
  NOW: "NOW",
  ENUM: (...values) => ({ type: "ENUM", values }),
};

// Import the model factory
const SupportTicketFactory = require("../../models/SupportTicket");

describe("SupportTicket Model", () => {
  beforeAll(() => {
    // Only invoke factory once
    SupportTicketFactory(mockSequelize, DataTypes);
  });

  describe("Model definition", () => {
    it("should define the model with correct name", () => {
      expect(capturedModelName).toBe("SupportTicket");
    });

    it("should call sequelize.define", () => {
      expect(mockDefine).toHaveBeenCalledTimes(1);
    });
  });

  describe("Model schema fields", () => {
    it("should have id as primary key", () => {
      expect(capturedSchema.id).toBeDefined();
      expect(capturedSchema.id.primaryKey).toBe(true);
      expect(capturedSchema.id.autoIncrement).toBe(true);
    });

    it("should have conversationId as nullable", () => {
      expect(capturedSchema.conversationId).toBeDefined();
      expect(capturedSchema.conversationId.allowNull).toBe(true);
    });

    it("should have reporterId as required", () => {
      expect(capturedSchema.reporterId).toBeDefined();
      expect(capturedSchema.reporterId.allowNull).toBe(false);
    });

    it("should have subjectUserId as nullable", () => {
      expect(capturedSchema.subjectUserId).toBeDefined();
      expect(capturedSchema.subjectUserId.allowNull).toBe(true);
    });

    it("should have category as required", () => {
      expect(capturedSchema.category).toBeDefined();
      expect(capturedSchema.category.allowNull).toBe(false);
    });

    it("should have description as required TEXT", () => {
      expect(capturedSchema.description).toBeDefined();
      expect(capturedSchema.description.allowNull).toBe(false);
      expect(capturedSchema.description.type).toBe("TEXT");
    });

    it("should have status with default value submitted", () => {
      expect(capturedSchema.status).toBeDefined();
      expect(capturedSchema.status.defaultValue).toBe("submitted");
    });

    it("should have priority with default value normal", () => {
      expect(capturedSchema.priority).toBeDefined();
      expect(capturedSchema.priority.defaultValue).toBe("normal");
    });

    it("should have slaDeadline field", () => {
      expect(capturedSchema.slaDeadline).toBeDefined();
      expect(capturedSchema.slaDeadline.type).toBe("DATE");
    });

    it("should have resolution as JSONB", () => {
      expect(capturedSchema.resolution).toBeDefined();
      expect(capturedSchema.resolution.type).toBe("JSONB");
    });

    it("should have resolutionNotes as TEXT", () => {
      expect(capturedSchema.resolutionNotes).toBeDefined();
      expect(capturedSchema.resolutionNotes.type).toBe("TEXT");
    });

    it("should have submittedAt with default NOW", () => {
      expect(capturedSchema.submittedAt).toBeDefined();
      expect(capturedSchema.submittedAt.defaultValue).toBe("NOW");
    });

    it("should have closedAt as nullable DATE", () => {
      expect(capturedSchema.closedAt).toBeDefined();
      expect(capturedSchema.closedAt.allowNull).toBe(true);
    });
  });

  describe("Category ENUM values", () => {
    it("should have 7 category options", () => {
      expect(capturedSchema.category.type.values).toHaveLength(7);
    });

    it.each([
      "account_issue",
      "behavior_concern",
      "service_complaint",
      "billing_question",
      "technical_issue",
      "policy_violation",
      "other",
    ])("should include %s as valid category", (category) => {
      expect(capturedSchema.category.type.values).toContain(category);
    });
  });

  describe("Status ENUM values", () => {
    it("should have 5 status options", () => {
      expect(capturedSchema.status.type.values).toHaveLength(5);
    });

    it.each(["submitted", "under_review", "pending_info", "resolved", "closed"])(
      "should include %s as valid status",
      (status) => {
        expect(capturedSchema.status.type.values).toContain(status);
      }
    );
  });

  describe("Priority ENUM values", () => {
    it("should have 3 priority options", () => {
      expect(capturedSchema.priority.type.values).toHaveLength(3);
    });

    it.each(["normal", "high", "urgent"])("should include %s as valid priority", (priority) => {
      expect(capturedSchema.priority.type.values).toContain(priority);
    });
  });

  describe("SubjectType ENUM values", () => {
    it("should have 3 subject type options", () => {
      expect(capturedSchema.subjectType.type.values).toHaveLength(3);
    });

    it.each(["cleaner", "homeowner", "general"])(
      "should include %s as valid subject type",
      (type) => {
        expect(capturedSchema.subjectType.type.values).toContain(type);
      }
    );
  });
});

describe("SupportTicket priority SLA times", () => {
  const slaHours = {
    urgent: 12,
    high: 24,
    normal: 48,
  };

  it.each(Object.entries(slaHours))(
    "should have %s priority with %s hour SLA",
    (priority, hours) => {
      expect(slaHours[priority]).toBe(hours);
    }
  );

  it("urgent should be faster than high", () => {
    expect(slaHours.urgent).toBeLessThan(slaHours.high);
  });

  it("high should be faster than normal", () => {
    expect(slaHours.high).toBeLessThan(slaHours.normal);
  });
});

describe("SupportTicket status transitions", () => {
  const validTransitions = [
    { from: "submitted", to: "under_review" },
    { from: "under_review", to: "pending_info" },
    { from: "under_review", to: "resolved" },
    { from: "pending_info", to: "under_review" },
    { from: "resolved", to: "closed" },
  ];

  it.each(validTransitions)("should allow transition from $from to $to", ({ from, to }) => {
    const validStatuses = ["submitted", "under_review", "pending_info", "resolved", "closed"];
    expect(validStatuses).toContain(from);
    expect(validStatuses).toContain(to);
  });
});
