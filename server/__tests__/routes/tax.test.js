// Set required environment variables before importing modules
process.env.TAX_ENCRYPTION_KEY = "test-encryption-key-at-least-32-chars-long!!";

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock crypto for encryption
jest.mock("crypto", () => {
  const actual = jest.requireActual("crypto");
  return {
    ...actual,
    randomBytes: jest.fn((size) => {
      if (size === 32) return Buffer.alloc(32, "a"); // Encryption key
      if (size === 16) return Buffer.alloc(16, "b"); // IV
      return actual.randomBytes(size);
    }),
    createCipheriv: jest.fn(() => ({
      update: jest.fn(() => Buffer.from("encrypted")),
      final: jest.fn(() => Buffer.alloc(0)),
    })),
    createDecipheriv: jest.fn(() => ({
      update: jest.fn(() => Buffer.from("123456789")),
      final: jest.fn(() => Buffer.alloc(0)),
    })),
  };
});

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  TaxInfo: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  TaxDocument: {
    findAll: jest.fn(),
    existsForUserYear: jest.fn(),
  },
  Payment: {
    findAll: jest.fn(),
    getTotalReportableAmount: jest.fn(),
    update: jest.fn(),
  },
  Payout: {},
  sequelize: {
    query: jest.fn().mockResolvedValue([[]]),
    QueryTypes: { SELECT: "SELECT" },
  },
}));

// Mock TaxDocumentService
jest.mock("../../services/TaxDocumentService", () => ({
  getTaxDeadlines: jest.fn((taxYear) => ({
    taxYear,
    form1099NECRecipientDeadline: new Date(taxYear + 1, 0, 31),
    form1099NECIRSDeadline: new Date(taxYear + 1, 0, 31),
    form1099NECIRSMailDeadline: new Date(taxYear + 1, 1, 28),
  })),
  validateTaxInfoComplete: jest.fn(),
  generate1099NECData: jest.fn(),
  createTaxDocumentRecord: jest.fn(),
  generateAll1099NECsForYear: jest.fn(),
  getTaxYearSummary: jest.fn(),
}));

const { User, TaxInfo, TaxDocument, Payment } = require("../../models");
const TaxDocumentService = require("../../services/TaxDocumentService");

describe("Tax Routes", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Import router after mocks are set up
    const taxRouter = require("../../routes/api/v1/taxRouter");
    app.use("/api/v1/tax", taxRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /submit-w9", () => {
    const validW9Data = {
      legalName: "John Doe",
      addressLine1: "123 Main St",
      city: "Boston",
      state: "MA",
      zipCode: "02101",
      tin: "123-45-6789",
      tinType: "ssn",
      certificationSignature: "John Doe",
    };

    it("should submit W-9 successfully for a cleaner", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 1, type: "cleaner" });
      TaxInfo.findOne.mockResolvedValue(null);
      TaxInfo.create.mockResolvedValue({
        id: 1,
        userId: 1,
        legalName: "John Doe",
        tinType: "ssn",
        tinLast4: "6789",
        status: "pending",
        certificationDate: new Date(),
      });

      const res = await request(app)
        .post("/api/v1/tax/submit-w9")
        .send({ token, ...validW9Data });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.taxInfo).toHaveProperty("legalName", "John Doe");
      expect(res.body.taxInfo).toHaveProperty("tinLast4", "6789");
    });

    it("should return 401 for invalid token", async () => {
      const res = await request(app)
        .post("/api/v1/tax/submit-w9")
        .send({ token: "invalid", ...validW9Data });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_TOKEN");
    });

    it("should return 400 for missing required fields", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .post("/api/v1/tax/submit-w9")
        .send({ token, legalName: "John" }); // Missing other fields

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("MISSING_FIELDS");
    });

    it("should return 400 for invalid state abbreviation", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .post("/api/v1/tax/submit-w9")
        .send({ token, ...validW9Data, state: "XX" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_STATE");
    });

    it("should return 400 for invalid SSN format", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .post("/api/v1/tax/submit-w9")
        .send({ token, ...validW9Data, tin: "000-00-0000" }); // Invalid SSN

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_TIN");
    });

    it("should return 400 for invalid EIN format", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      const res = await request(app)
        .post("/api/v1/tax/submit-w9")
        .send({ token, ...validW9Data, tinType: "ein", tin: "00-0000000" }); // Invalid prefix

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_TIN");
    });

    it("should return 404 if user not found", async () => {
      const token = jwt.sign({ userId: 999 }, secretKey);
      User.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/tax/submit-w9")
        .send({ token, ...validW9Data });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("USER_NOT_FOUND");
    });

    it("should return 403 if user is not a cleaner", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);
      User.findByPk.mockResolvedValue({ id: 1, type: "customer" });

      const res = await request(app)
        .post("/api/v1/tax/submit-w9")
        .send({ token, ...validW9Data });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("NOT_A_CLEANER");
    });

    it("should update existing tax info", async () => {
      const token = jwt.sign({ userId: 1 }, secretKey);

      User.findByPk.mockResolvedValue({ id: 1, type: "cleaner" });
      const existingTaxInfo = {
        id: 1,
        userId: 1,
        update: jest.fn().mockResolvedValue(true),
      };
      TaxInfo.findOne.mockResolvedValue(existingTaxInfo);

      const res = await request(app)
        .post("/api/v1/tax/submit-w9")
        .send({ token, ...validW9Data });

      expect(res.status).toBe(201);
      expect(existingTaxInfo.update).toHaveBeenCalled();
    });
  });

  describe("GET /tax-info/:userId", () => {
    it("should return tax info for a user", async () => {
      TaxInfo.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        legalName: "John Doe",
        businessName: null,
        taxClassification: "individual",
        addressLine1: "123 Main St",
        city: "Boston",
        state: "MA",
        zipCode: "02101",
        tinType: "ssn",
        tinLast4: "6789",
        certificationDate: new Date(),
        status: "verified",
        tinVerified: true,
        form1099Required: false,
      });

      const res = await request(app).get("/api/v1/tax/tax-info/1");

      expect(res.status).toBe(200);
      expect(res.body.hasTaxInfo).toBe(true);
      expect(res.body.taxInfo.tinMasked).toBe("XXX-XX-6789");
      expect(res.body.taxInfo.legalName).toBe("John Doe");
    });

    it("should return 404 if tax info not found", async () => {
      TaxInfo.findOne.mockResolvedValue(null);

      const res = await request(app).get("/api/v1/tax/tax-info/999");

      expect(res.status).toBe(404);
      expect(res.body.hasTaxInfo).toBe(false);
      expect(res.body.code).toBe("TAX_INFO_NOT_FOUND");
    });

    it("should format EIN correctly", async () => {
      TaxInfo.findOne.mockResolvedValue({
        id: 1,
        userId: 1,
        legalName: "Business LLC",
        tinType: "ein",
        tinLast4: "5678",
        status: "verified",
      });

      const res = await request(app).get("/api/v1/tax/tax-info/1");

      expect(res.status).toBe(200);
      expect(res.body.taxInfo.tinMasked).toBe("XX-XXX5678");
    });
  });

  describe("GET /earnings-summary/:userId/:year", () => {
    it("should return earnings summary for a year", async () => {
      Payment.findAll.mockResolvedValue([
        { amount: 50000, processedAt: new Date("2024-03-15") },
        { amount: 75000, processedAt: new Date("2024-06-20") },
      ]);
      TaxInfo.findOne.mockResolvedValue({
        form1099Required: false,
        update: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app).get("/api/v1/tax/earnings-summary/1/2024");

      expect(res.status).toBe(200);
      expect(res.body.totalAmountCents).toBe(125000);
      expect(res.body.totalAmountDollars).toBe("1250.00");
      expect(res.body.requires1099).toBe(true);
      expect(res.body.transactionCount).toBe(2);
    });

    it("should return 400 for invalid year", async () => {
      const res = await request(app).get("/api/v1/tax/earnings-summary/1/2015");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_YEAR");
    });

    it("should show requires1099 false when below threshold", async () => {
      Payment.findAll.mockResolvedValue([
        { amount: 30000, processedAt: new Date("2024-03-15") },
      ]);
      TaxInfo.findOne.mockResolvedValue(null);

      const res = await request(app).get("/api/v1/tax/earnings-summary/1/2024");

      expect(res.status).toBe(200);
      expect(res.body.totalAmountCents).toBe(30000);
      expect(res.body.requires1099).toBe(false);
    });
  });

  describe("GET /1099/:userId/:year", () => {
    it("should generate 1099 data when above threshold", async () => {
      TaxInfo.findOne.mockResolvedValue({
        userId: 1,
        legalName: "John Doe",
        addressLine1: "123 Main St",
        addressLine2: null,
        city: "Boston",
        state: "MA",
        zipCode: "02101",
        tinLast4: "6789",
      });
      Payment.getTotalReportableAmount.mockResolvedValue({
        totalAmountCents: 100000,
        totalAmountDollars: "1000.00",
        transactionCount: 10,
      });
      User.findByPk.mockResolvedValue({ id: 1, email: "john@example.com" });

      const res = await request(app).get("/api/v1/tax/1099/1/2024");

      expect(res.status).toBe(200);
      expect(res.body.requires1099).toBe(true);
      expect(res.body.form1099.box1.amountDollars).toBe("1000.00");
      expect(res.body.form1099.recipient.name).toBe("John Doe");
    });

    it("should return no 1099 required when below threshold", async () => {
      TaxInfo.findOne.mockResolvedValue({ userId: 1 });
      Payment.getTotalReportableAmount.mockResolvedValue({
        totalAmountCents: 50000,
        totalAmountDollars: "500.00",
        transactionCount: 5,
      });

      const res = await request(app).get("/api/v1/tax/1099/1/2024");

      expect(res.status).toBe(200);
      expect(res.body.requires1099).toBe(false);
      expect(res.body.message).toContain("below $600 threshold");
    });

    it("should return 400 if no W-9 on file", async () => {
      TaxInfo.findOne.mockResolvedValue(null);

      const res = await request(app).get("/api/v1/tax/1099/1/2024");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("NO_TAX_INFO");
    });
  });

  describe("GET /tax-documents/:userId", () => {
    it("should return all tax documents for a user", async () => {
      TaxDocument.findAll.mockResolvedValue([
        {
          id: 1,
          documentId: "1099-NEC-2024-1-ABC123",
          documentType: "1099-NEC",
          taxYear: 2024,
          status: "generated",
          box1NonemployeeCompensation: 100000,
          generatedAt: new Date(),
          sentToRecipientAt: null,
        },
      ]);

      const res = await request(app).get("/api/v1/tax/tax-documents/1");

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.documents[0].documentType).toBe("1099-NEC");
      expect(res.body.documents[0].box1Amount).toBe("1000.00");
    });

    it("should return empty array if no documents", async () => {
      TaxDocument.findAll.mockResolvedValue([]);

      const res = await request(app).get("/api/v1/tax/tax-documents/999");

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(0);
    });
  });

  describe("POST /generate-1099/:userId/:year", () => {
    it("should generate 1099 for eligible cleaner", async () => {
      TaxDocument.existsForUserYear.mockResolvedValue(false);
      TaxDocumentService.validateTaxInfoComplete.mockResolvedValue({
        valid: true,
        missing: [],
      });
      TaxDocumentService.generate1099NECData.mockResolvedValue({
        requires1099: true,
        boxes: {
          box1: { amountCents: 100000, amountDollars: "1000.00" },
        },
      });
      TaxDocumentService.createTaxDocumentRecord.mockResolvedValue({
        documentId: "1099-NEC-2024-1-ABC123",
        taxYear: 2024,
        status: "generated",
      });
      Payment.update.mockResolvedValue([1]);

      const res = await request(app).post("/api/v1/tax/generate-1099/1/2024");

      expect(res.status).toBe(201);
      expect(res.body.generated).toBe(true);
      expect(res.body.document.documentId).toBe("1099-NEC-2024-1-ABC123");
    });

    it("should return 409 if already generated", async () => {
      TaxDocument.existsForUserYear.mockResolvedValue(true);

      const res = await request(app).post("/api/v1/tax/generate-1099/1/2024");

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("ALREADY_GENERATED");
    });

    it("should return 400 if tax info incomplete", async () => {
      TaxDocument.existsForUserYear.mockResolvedValue(false);
      TaxDocumentService.validateTaxInfoComplete.mockResolvedValue({
        valid: false,
        missing: ["Legal name", "TIN"],
      });

      const res = await request(app).post("/api/v1/tax/generate-1099/1/2024");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INCOMPLETE_TAX_INFO");
      expect(res.body.missing).toContain("Legal name");
    });
  });

  describe("POST /generate-all-1099s/:year", () => {
    it("should generate 1099s for all eligible cleaners", async () => {
      TaxDocumentService.generateAll1099NECsForYear.mockResolvedValue({
        taxYear: 2024,
        total: 3,
        generated: [
          { userId: 1, documentId: "1099-NEC-2024-1-A", amountDollars: "1000.00" },
          { userId: 2, documentId: "1099-NEC-2024-2-B", amountDollars: "800.00" },
        ],
        skipped: [{ userId: 3, reason: "Already generated" }],
        errors: [],
      });

      const res = await request(app).post("/api/v1/tax/generate-all-1099s/2024");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary.generated).toBe(2);
      expect(res.body.summary.skipped).toBe(1);
    });
  });

  describe("GET /tax-year-summary/:year", () => {
    it("should return tax year summary", async () => {
      TaxDocumentService.getTaxYearSummary.mockResolvedValue({
        taxYear: 2024,
        cleanersRequiring1099: 5,
        totalPaymentsCents: 500000,
        totalPaymentsDollars: "5000.00",
        documentsGenerated: 3,
        documentsFiledWithIrs: 0,
      });

      const res = await request(app).get("/api/v1/tax/tax-year-summary/2024");

      expect(res.status).toBe(200);
      expect(res.body.taxYear).toBe(2024);
      expect(res.body.cleanersRequiring1099).toBe(5);
    });
  });

  describe("GET /deadlines/:year", () => {
    it("should return tax filing deadlines", async () => {
      const res = await request(app).get("/api/v1/tax/deadlines/2024");

      expect(res.status).toBe(200);
      expect(res.body.taxYear).toBe(2024);
      expect(res.body).toHaveProperty("form1099NECRecipientDeadline");
      expect(res.body).toHaveProperty("form1099NECIRSDeadline");
    });

    it("should return 400 for invalid year", async () => {
      const res = await request(app).get("/api/v1/tax/deadlines/2015");

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_YEAR");
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
