const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Set SESSION_SECRET before requiring the router (router captures it at module load time)
process.env.SESSION_SECRET = "test-secret";

// Mock dependencies before requiring the router
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  PricingConfig: {
    getActive: jest.fn(),
    getFormattedPricing: jest.fn(),
    updatePricing: jest.fn(),
    getHistory: jest.fn(),
  },
}));

jest.mock("../../config/businessConfig", () => ({
  getPricingConfig: jest.fn(),
  businessConfig: {
    staffing: {
      minCleanersPerJob: 1,
      maxCleanersPerJob: 3,
    },
  },
}));

jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => `decrypted_${value}`),
}));

const { User, PricingConfig } = require("../../models");
const { getPricingConfig, businessConfig } = require("../../config/businessConfig");
const pricingRouter = require("../../routes/api/v1/pricingRouter");

describe("pricingRouter - Last-Minute Booking Configuration", () => {
  let app;
  const secretKey = "test-secret";

  beforeAll(() => {
    process.env.SESSION_SECRET = secretKey;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up express app with router
    app = express();
    app.use(express.json());
    app.use("/pricing", pricingRouter);
  });

  const generateOwnerToken = (userId = 1) => {
    return jwt.sign({ userId }, secretKey);
  };

  describe("GET /pricing/config", () => {
    beforeEach(() => {
      User.findByPk.mockResolvedValue({
        id: 1,
        type: "owner",
        username: "testowner",
      });
    });

    it("should include last-minute booking fields in config response", async () => {
      const mockConfig = {
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
        multiCleanerPlatformFeePercent: "0.13",
        incentiveRefundPercent: "0.10",
        incentiveCleanerPercent: "0.40",
        largeBusinessFeePercent: "0.07",
        largeBusinessMonthlyThreshold: 50,
        largeBusinessLookbackMonths: 1,
        highVolumeFee: 50,
        lastMinuteFee: 50,
        lastMinuteThresholdHours: 48,
        lastMinuteNotificationRadiusMiles: "25.00",
        isActive: true,
      };

      PricingConfig.getActive.mockResolvedValue(mockConfig);
      PricingConfig.getFormattedPricing.mockResolvedValue({});

      const response = await request(app)
        .get("/pricing/config")
        .set("Authorization", `Bearer ${generateOwnerToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.config.lastMinuteFee).toBe(50);
      expect(response.body.config.lastMinuteThresholdHours).toBe(48);
      expect(response.body.config.lastMinuteNotificationRadiusMiles).toBe(25);
      expect(typeof response.body.config.lastMinuteNotificationRadiusMiles).toBe("number");
    });

    it("should use default values for missing last-minute fields", async () => {
      const mockConfig = {
        id: 1,
        basePrice: 150,
        refundPercentage: "0.50",
        platformFeePercent: "0.10",
        // last-minute fields are undefined
      };

      PricingConfig.getActive.mockResolvedValue(mockConfig);
      PricingConfig.getFormattedPricing.mockResolvedValue({});

      const response = await request(app)
        .get("/pricing/config")
        .set("Authorization", `Bearer ${generateOwnerToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.config.lastMinuteFee).toBe(50);
      expect(response.body.config.lastMinuteThresholdHours).toBe(48);
      expect(response.body.config.lastMinuteNotificationRadiusMiles).toBe(25);
    });

    it("should parse lastMinuteNotificationRadiusMiles as float", async () => {
      const mockConfig = {
        id: 1,
        basePrice: 150,
        refundPercentage: "0.50",
        platformFeePercent: "0.10",
        lastMinuteNotificationRadiusMiles: "30.5",
      };

      PricingConfig.getActive.mockResolvedValue(mockConfig);
      PricingConfig.getFormattedPricing.mockResolvedValue({});

      const response = await request(app)
        .get("/pricing/config")
        .set("Authorization", `Bearer ${generateOwnerToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.config.lastMinuteNotificationRadiusMiles).toBe(30.5);
      expect(typeof response.body.config.lastMinuteNotificationRadiusMiles).toBe("number");
    });

    it("should require owner authentication", async () => {
      User.findByPk.mockResolvedValue({
        id: 1,
        type: "cleaner", // Not an owner
      });

      const response = await request(app)
        .get("/pricing/config")
        .set("Authorization", `Bearer ${generateOwnerToken()}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Owner access required");
    });
  });

  describe("PUT /pricing/config", () => {
    beforeEach(() => {
      User.findByPk.mockResolvedValue({
        id: 1,
        type: "owner",
        username: "testowner",
      });
    });

    const validConfigBody = {
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
      refundPercentage: 0.5,
      platformFeePercent: 0.1,
      businessOwnerFeePercent: 0.1,
      highVolumeFee: 50,
    };

    it("should accept last-minute booking configuration fields", async () => {
      const configWithLastMinute = {
        ...validConfigBody,
        lastMinuteFee: 75,
        lastMinuteThresholdHours: 72,
        lastMinuteNotificationRadiusMiles: 30,
      };

      PricingConfig.updatePricing.mockResolvedValue({
        id: 1,
        ...configWithLastMinute,
      });
      PricingConfig.getFormattedPricing.mockResolvedValue({});

      const response = await request(app)
        .put("/pricing/config")
        .set("Authorization", `Bearer ${generateOwnerToken()}`)
        .send(configWithLastMinute);

      expect(response.status).toBe(200);
      expect(PricingConfig.updatePricing).toHaveBeenCalledWith(
        expect.objectContaining({
          lastMinuteFee: 75,
          lastMinuteThresholdHours: 72,
          lastMinuteNotificationRadiusMiles: 30,
        }),
        1,
        null
      );
    });

    it("should work without optional last-minute fields", async () => {
      PricingConfig.updatePricing.mockResolvedValue({
        id: 1,
        ...validConfigBody,
      });
      PricingConfig.getFormattedPricing.mockResolvedValue({});

      const response = await request(app)
        .put("/pricing/config")
        .set("Authorization", `Bearer ${generateOwnerToken()}`)
        .send(validConfigBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should include change note with last-minute updates", async () => {
      const configWithNote = {
        ...validConfigBody,
        lastMinuteFee: 60,
        changeNote: "Updated last-minute fee",
      };

      PricingConfig.updatePricing.mockResolvedValue({
        id: 1,
        ...configWithNote,
      });
      PricingConfig.getFormattedPricing.mockResolvedValue({});

      const response = await request(app)
        .put("/pricing/config")
        .set("Authorization", `Bearer ${generateOwnerToken()}`)
        .send(configWithNote);

      expect(response.status).toBe(200);
      expect(PricingConfig.updatePricing).toHaveBeenCalledWith(
        expect.any(Object),
        1,
        "Updated last-minute fee"
      );
    });
  });

  describe("GET /pricing/history", () => {
    beforeEach(() => {
      User.findByPk.mockResolvedValue({
        id: 1,
        type: "owner",
        username: "testowner",
      });
    });

    it("should include last-minute fields in history", async () => {
      const mockHistory = [
        {
          id: 1,
          basePrice: 150,
          refundPercentage: "0.50",
          platformFeePercent: "0.10",
          lastMinuteFee: 50,
          lastMinuteThresholdHours: 48,
          lastMinuteNotificationRadiusMiles: "25.00",
          isActive: true,
          createdAt: new Date("2026-01-01"),
          changeNote: "Initial config",
          updatedByUser: {
            id: 1,
            username: "admin",
            email: "iv:admin@test.com",
          },
        },
      ];

      PricingConfig.getHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get("/pricing/history")
        .set("Authorization", `Bearer ${generateOwnerToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.history).toHaveLength(1);
      expect(response.body.history[0].pricing.lastMinuteFee).toBe(50);
      expect(response.body.history[0].pricing.lastMinuteThresholdHours).toBe(48);
      expect(response.body.history[0].pricing.lastMinuteNotificationRadiusMiles).toBe(25);
    });

    it("should use default values for missing last-minute fields in history", async () => {
      const mockHistory = [
        {
          id: 1,
          basePrice: 150,
          refundPercentage: "0.50",
          platformFeePercent: "0.10",
          // No last-minute fields
          isActive: true,
          createdAt: new Date("2026-01-01"),
        },
      ];

      PricingConfig.getHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get("/pricing/history")
        .set("Authorization", `Bearer ${generateOwnerToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.history[0].pricing.lastMinuteFee).toBe(50);
      expect(response.body.history[0].pricing.lastMinuteThresholdHours).toBe(48);
      expect(response.body.history[0].pricing.lastMinuteNotificationRadiusMiles).toBe(25);
    });
  });

  describe("GET /pricing/current (public endpoint)", () => {
    it("should return pricing from database when available", async () => {
      const mockPricing = {
        basePrice: 150,
        lastMinute: {
          fee: 50,
          thresholdHours: 48,
          notificationRadiusMiles: 25,
        },
      };

      PricingConfig.getFormattedPricing.mockResolvedValue(mockPricing);

      const response = await request(app).get("/pricing/current");

      expect(response.status).toBe(200);
      expect(response.body.source).toBe("database");
      expect(response.body.pricing.lastMinute.fee).toBe(50);
    });

    it("should fall back to static config when database is empty", async () => {
      PricingConfig.getFormattedPricing.mockResolvedValue(null);
      getPricingConfig.mockResolvedValue({
        basePrice: 150,
        lastMinute: {
          fee: 50,
          thresholdHours: 48,
        },
      });

      const response = await request(app).get("/pricing/current");

      expect(response.status).toBe(200);
      expect(response.body.source).toBe("config");
    });

    it("should include staffing config from static config", async () => {
      PricingConfig.getFormattedPricing.mockResolvedValue({ basePrice: 150 });

      const response = await request(app).get("/pricing/current");

      expect(response.status).toBe(200);
      expect(response.body.staffing).toEqual(businessConfig.staffing);
    });
  });
});

describe("pricingRouter - Large Business Fee Configuration", () => {
  let app;
  const secretKey = "test-secret";

  beforeAll(() => {
    process.env.SESSION_SECRET = secretKey;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use("/pricing", pricingRouter);

    User.findByPk.mockResolvedValue({
      id: 1,
      type: "owner",
      username: "testowner",
    });
  });

  const generateOwnerToken = () => {
    return jwt.sign({ userId: 1 }, secretKey);
  };

  describe("GET /pricing/config", () => {
    it("should include large business fee fields in config response", async () => {
      const mockConfig = {
        id: 1,
        basePrice: 150,
        refundPercentage: "0.50",
        platformFeePercent: "0.10",
        largeBusinessFeePercent: "0.07",
        largeBusinessMonthlyThreshold: 75,
        largeBusinessLookbackMonths: 2,
      };

      PricingConfig.getActive.mockResolvedValue(mockConfig);
      PricingConfig.getFormattedPricing.mockResolvedValue({});

      const response = await request(app)
        .get("/pricing/config")
        .set("Authorization", `Bearer ${generateOwnerToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.config.largeBusinessFeePercent).toBe(0.07);
      expect(typeof response.body.config.largeBusinessFeePercent).toBe("number");
      expect(response.body.config.largeBusinessMonthlyThreshold).toBe(75);
      expect(response.body.config.largeBusinessLookbackMonths).toBe(2);
    });

    it("should use default values for missing large business fields", async () => {
      const mockConfig = {
        id: 1,
        basePrice: 150,
        refundPercentage: "0.50",
        platformFeePercent: "0.10",
      };

      PricingConfig.getActive.mockResolvedValue(mockConfig);
      PricingConfig.getFormattedPricing.mockResolvedValue({});

      const response = await request(app)
        .get("/pricing/config")
        .set("Authorization", `Bearer ${generateOwnerToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.config.largeBusinessFeePercent).toBe(0.07);
      expect(response.body.config.largeBusinessMonthlyThreshold).toBe(50);
      expect(response.body.config.largeBusinessLookbackMonths).toBe(1);
    });
  });

  describe("PUT /pricing/config", () => {
    const validConfigBody = {
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
      refundPercentage: 0.5,
      platformFeePercent: 0.1,
      businessOwnerFeePercent: 0.1,
      highVolumeFee: 50,
    };

    it("should validate largeBusinessFeePercent is between 0 and 1", async () => {
      const invalidConfig = {
        ...validConfigBody,
        largeBusinessFeePercent: 1.5, // Invalid - over 1
      };

      const response = await request(app)
        .put("/pricing/config")
        .set("Authorization", `Bearer ${generateOwnerToken()}`)
        .send(invalidConfig);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("largeBusinessFeePercent");
    });

    it("should validate largeBusinessMonthlyThreshold is positive", async () => {
      const invalidConfig = {
        ...validConfigBody,
        largeBusinessMonthlyThreshold: 0, // Invalid - not positive
      };

      const response = await request(app)
        .put("/pricing/config")
        .set("Authorization", `Bearer ${generateOwnerToken()}`)
        .send(invalidConfig);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("largeBusinessMonthlyThreshold");
    });

    it("should validate largeBusinessLookbackMonths is between 1 and 12", async () => {
      const invalidConfig = {
        ...validConfigBody,
        largeBusinessLookbackMonths: 15, // Invalid - over 12
      };

      const response = await request(app)
        .put("/pricing/config")
        .set("Authorization", `Bearer ${generateOwnerToken()}`)
        .send(invalidConfig);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("largeBusinessLookbackMonths");
    });

    it("should accept valid large business configuration", async () => {
      const validLargeBusinessConfig = {
        ...validConfigBody,
        largeBusinessFeePercent: 0.08,
        largeBusinessMonthlyThreshold: 100,
        largeBusinessLookbackMonths: 3,
      };

      PricingConfig.updatePricing.mockResolvedValue({
        id: 1,
        ...validLargeBusinessConfig,
      });
      PricingConfig.getFormattedPricing.mockResolvedValue({});

      const response = await request(app)
        .put("/pricing/config")
        .set("Authorization", `Bearer ${generateOwnerToken()}`)
        .send(validLargeBusinessConfig);

      expect(response.status).toBe(200);
      expect(PricingConfig.updatePricing).toHaveBeenCalledWith(
        expect.objectContaining({
          largeBusinessFeePercent: 0.08,
          largeBusinessMonthlyThreshold: 100,
          largeBusinessLookbackMonths: 3,
        }),
        1,
        null
      );
    });
  });
});
