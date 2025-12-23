const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock models
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

jest.mock("../../config/businessConfig", () => {
  const mockPricing = {
    basePrice: 150,
    extraBedBathFee: 50,
    linens: {
      sheetFeePerBed: 30,
      towelFee: 5,
      faceClothFee: 2,
    },
    timeWindows: {
      anytime: 0,
      "10-3": 25,
      "11-4": 25,
      "12-2": 30,
    },
    cancellation: {
      fee: 25,
      windowDays: 7,
      homeownerPenaltyDays: 3,
      cleanerPenaltyDays: 4,
      refundPercentage: 0.5,
    },
    platform: {
      feePercent: 0.1,
    },
    highVolumeFee: 50,
  };
  const mockStaffing = {
    minCleanersForAssignment: 1,
  };
  return {
    businessConfig: {
      pricing: mockPricing,
      staffing: mockStaffing,
    },
    getPricingConfig: jest.fn().mockResolvedValue(mockPricing),
  };
});

const { User, PricingConfig } = require("../../models");

const pricingRouter = require("../../routes/api/v1/pricingRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/pricing", pricingRouter);

describe("Pricing Router", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";
  const managerToken = jwt.sign({ userId: 1 }, secretKey);
  const cleanerToken = jwt.sign({ userId: 2 }, secretKey);
  const homeownerToken = jwt.sign({ userId: 3 }, secretKey);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /current (Public)", () => {
    it("should return pricing from database when available", async () => {
      const mockDbPricing = {
        basePrice: 175,
        extraBedBathFee: 60,
        linens: {
          sheetFeePerBed: 35,
          towelFee: 6,
          faceClothFee: 3,
        },
        timeWindows: {
          anytime: 0,
          "10-3": 30,
          "11-4": 30,
          "12-2": 35,
        },
        cancellation: {
          fee: 30,
          windowDays: 7,
          homeownerPenaltyDays: 3,
          cleanerPenaltyDays: 4,
          refundPercentage: 0.5,
        },
        platform: {
          feePercent: 0.12,
        },
        highVolumeFee: 60,
      };

      PricingConfig.getFormattedPricing.mockResolvedValue(mockDbPricing);

      const res = await request(app).get("/api/v1/pricing/current");

      expect(res.status).toBe(200);
      expect(res.body.source).toBe("database");
      expect(res.body.pricing).toEqual(mockDbPricing);
    });

    it("should fall back to static config when database is empty", async () => {
      PricingConfig.getFormattedPricing.mockResolvedValue(null);

      const res = await request(app).get("/api/v1/pricing/current");

      expect(res.status).toBe(200);
      expect(res.body.source).toBe("config");
      expect(res.body.pricing.basePrice).toBe(150);
    });

    it("should fall back to static config on database error", async () => {
      PricingConfig.getFormattedPricing.mockRejectedValue(new Error("DB Error"));

      const res = await request(app).get("/api/v1/pricing/current");

      expect(res.status).toBe(200);
      expect(res.body.source).toBe("config");
      expect(res.body.pricing.basePrice).toBe(150);
    });

    it("should not require authentication", async () => {
      PricingConfig.getFormattedPricing.mockResolvedValue(null);

      const res = await request(app).get("/api/v1/pricing/current");

      expect(res.status).toBe(200);
    });

    it("should include staffing config with minCleanersForAssignment", async () => {
      PricingConfig.getFormattedPricing.mockResolvedValue(null);

      const res = await request(app).get("/api/v1/pricing/current");

      expect(res.status).toBe(200);
      expect(res.body.staffing).toBeDefined();
      expect(res.body.staffing.minCleanersForAssignment).toBe(1);
    });

    it("should include staffing config when returning database pricing", async () => {
      const mockDbPricing = {
        basePrice: 175,
        extraBedBathFee: 60,
      };

      PricingConfig.getFormattedPricing.mockResolvedValue(mockDbPricing);

      const res = await request(app).get("/api/v1/pricing/current");

      expect(res.status).toBe(200);
      expect(res.body.source).toBe("database");
      expect(res.body.pricing).toEqual(mockDbPricing);
      expect(res.body.staffing).toBeDefined();
      expect(res.body.staffing.minCleanersForAssignment).toBe(1);
    });

    it("should include staffing config even on database error", async () => {
      PricingConfig.getFormattedPricing.mockRejectedValue(new Error("DB Error"));

      const res = await request(app).get("/api/v1/pricing/current");

      expect(res.status).toBe(200);
      expect(res.body.staffing).toBeDefined();
      expect(res.body.staffing.minCleanersForAssignment).toBe(1);
    });
  });

  describe("GET /config (Manager Only)", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app).get("/api/v1/pricing/config");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return 403 for non-manager user", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const res = await request(app)
        .get("/api/v1/pricing/config")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Manager access required");
    });

    it("should return 403 for homeowner user", async () => {
      User.findByPk.mockResolvedValue({ id: 3, type: "homeowner" });

      const res = await request(app)
        .get("/api/v1/pricing/config")
        .set("Authorization", `Bearer ${homeownerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Manager access required");
    });

    it("should return 401 for invalid token", async () => {
      const res = await request(app)
        .get("/api/v1/pricing/config")
        .set("Authorization", "Bearer invalid_token");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid token");
    });

    it("should return full config for manager when database config exists", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager" });

      const mockActiveConfig = {
        id: 1,
        basePrice: 175,
        extraBedBathFee: 60,
        isActive: true,
        createdAt: new Date(),
      };

      const mockFormattedPricing = {
        basePrice: 175,
        extraBedBathFee: 60,
        linens: { sheetFeePerBed: 30, towelFee: 5, faceClothFee: 2 },
        timeWindows: { anytime: 0, "10-3": 25, "11-4": 25, "12-2": 30 },
        cancellation: { fee: 25, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.1 },
        highVolumeFee: 50,
      };

      PricingConfig.getActive.mockResolvedValue(mockActiveConfig);
      PricingConfig.getFormattedPricing.mockResolvedValue(mockFormattedPricing);

      const res = await request(app)
        .get("/api/v1/pricing/config")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.source).toBe("database");
      expect(res.body.config.id).toBe(mockActiveConfig.id);
      expect(res.body.config.basePrice).toBe(mockActiveConfig.basePrice);
      expect(res.body.formattedPricing.basePrice).toBe(mockFormattedPricing.basePrice);
    });

    it("should return static defaults when no database config exists", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager" });
      PricingConfig.getActive.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/pricing/config")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.source).toBe("config");
      expect(res.body.config).toBeNull();
      expect(res.body.staticDefaults).toBeDefined();
      expect(res.body.staticDefaults.basePrice).toBe(150);
      expect(res.body.staticDefaults.cancellationFee).toBe(25);
    });
  });

  describe("PUT /config (Manager Only)", () => {
    const validPricingData = {
      basePrice: 175,
      extraBedBathFee: 60,
      sheetFeePerBed: 35,
      towelFee: 6,
      faceClothFee: 3,
      timeWindowAnytime: 0,
      timeWindow10To3: 30,
      timeWindow11To4: 30,
      timeWindow12To2: 40,
      cancellationFee: 30,
      cancellationWindowDays: 7,
      homeownerPenaltyDays: 3,
      cleanerPenaltyDays: 4,
      refundPercentage: 0.5,
      platformFeePercent: 0.12,
      highVolumeFee: 60,
      changeNote: "Annual price update",
    };

    it("should return 401 without authorization", async () => {
      const res = await request(app)
        .put("/api/v1/pricing/config")
        .send(validPricingData);

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-manager user", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const res = await request(app)
        .put("/api/v1/pricing/config")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send(validPricingData);

      expect(res.status).toBe(403);
    });

    it("should return 400 for missing required fields", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager" });

      const res = await request(app)
        .put("/api/v1/pricing/config")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ basePrice: 175 }); // Missing other fields

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Missing required fields");
      expect(res.body.missingFields).toContain("extraBedBathFee");
    });

    it("should return 400 for negative numeric values", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager" });

      const res = await request(app)
        .put("/api/v1/pricing/config")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ ...validPricingData, basePrice: -50 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid value for basePrice");
    });

    it("should return 400 for refundPercentage greater than 1", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager" });

      const res = await request(app)
        .put("/api/v1/pricing/config")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ ...validPricingData, refundPercentage: 1.5 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("refundPercentage must be between 0 and 1");
    });

    it("should return 400 for platformFeePercent greater than 1", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager" });

      const res = await request(app)
        .put("/api/v1/pricing/config")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ ...validPricingData, platformFeePercent: 1.2 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("platformFeePercent must be between 0 and 1");
    });

    it("should successfully update pricing with valid data", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager", username: "manager1" });

      const mockNewConfig = {
        id: 2,
        ...validPricingData,
        isActive: true,
        updatedBy: 1,
        createdAt: new Date(),
      };

      PricingConfig.updatePricing.mockResolvedValue(mockNewConfig);
      PricingConfig.getFormattedPricing.mockResolvedValue({
        basePrice: 175,
        extraBedBathFee: 60,
        linens: { sheetFeePerBed: 35, towelFee: 6, faceClothFee: 3 },
        timeWindows: { anytime: 0, "10-3": 30, "11-4": 30, "12-2": 40 },
        cancellation: { fee: 30, windowDays: 7, homeownerPenaltyDays: 3, cleanerPenaltyDays: 4, refundPercentage: 0.5 },
        platform: { feePercent: 0.12 },
        highVolumeFee: 60,
      });

      const res = await request(app)
        .put("/api/v1/pricing/config")
        .set("Authorization", `Bearer ${managerToken}`)
        .send(validPricingData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Pricing configuration updated successfully");
      expect(res.body.config.basePrice).toBe(175);
      expect(PricingConfig.updatePricing).toHaveBeenCalledWith(
        expect.objectContaining({
          basePrice: 175,
          extraBedBathFee: 60,
        }),
        1,
        "Annual price update"
      );
    });

    it("should allow zero values for surcharges", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager", username: "manager1" });
      PricingConfig.updatePricing.mockResolvedValue({ id: 2, ...validPricingData });
      PricingConfig.getFormattedPricing.mockResolvedValue({});

      const res = await request(app)
        .put("/api/v1/pricing/config")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ ...validPricingData, timeWindowAnytime: 0, cancellationFee: 0 });

      expect(res.status).toBe(200);
    });

    it("should handle update without changeNote", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager", username: "manager1" });
      PricingConfig.updatePricing.mockResolvedValue({ id: 2 });
      PricingConfig.getFormattedPricing.mockResolvedValue({});

      const { changeNote, ...dataWithoutNote } = validPricingData;

      const res = await request(app)
        .put("/api/v1/pricing/config")
        .set("Authorization", `Bearer ${managerToken}`)
        .send(dataWithoutNote);

      expect(res.status).toBe(200);
      expect(PricingConfig.updatePricing).toHaveBeenCalledWith(
        expect.any(Object),
        1,
        null
      );
    });
  });

  describe("GET /history (Manager Only)", () => {
    it("should return 401 without authorization", async () => {
      const res = await request(app).get("/api/v1/pricing/history");

      expect(res.status).toBe(401);
    });

    it("should return 403 for non-manager user", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const res = await request(app)
        .get("/api/v1/pricing/history")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(res.status).toBe(403);
    });

    it("should return pricing history for manager", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager" });

      const mockHistory = [
        {
          id: 2,
          isActive: true,
          createdAt: new Date("2024-01-15"),
          basePrice: 175,
          extraBedBathFee: 60,
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
          highVolumeFee: 50,
          changeNote: "Updated base price",
          updatedByUser: { id: 1, username: "manager1", email: "manager@test.com" },
        },
        {
          id: 1,
          isActive: false,
          createdAt: new Date("2024-01-01"),
          basePrice: 150,
          extraBedBathFee: 50,
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
          highVolumeFee: 50,
          changeNote: null,
          updatedByUser: null,
        },
      ];

      PricingConfig.getHistory.mockResolvedValue(mockHistory);

      const res = await request(app)
        .get("/api/v1/pricing/history")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.history).toHaveLength(2);
      expect(res.body.history[0].isActive).toBe(true);
      expect(res.body.history[0].updatedBy.username).toBe("manager1");
      expect(res.body.history[1].updatedBy).toBeNull();
    });

    it("should accept limit parameter", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager" });
      PricingConfig.getHistory.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/pricing/history?limit=5")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(PricingConfig.getHistory).toHaveBeenCalledWith(5);
    });

    it("should use default limit of 20", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager" });
      PricingConfig.getHistory.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/pricing/history")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(PricingConfig.getHistory).toHaveBeenCalledWith(20);
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully in GET /config", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager" });
      PricingConfig.getActive.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .get("/api/v1/pricing/config")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch pricing configuration");
    });

    it("should handle database errors gracefully in PUT /config", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager" });
      PricingConfig.updatePricing.mockRejectedValue(new Error("Transaction failed"));

      const validPricingData = {
        basePrice: 175,
        extraBedBathFee: 60,
        sheetFeePerBed: 35,
        towelFee: 6,
        faceClothFee: 3,
        timeWindowAnytime: 0,
        timeWindow10To3: 30,
        timeWindow11To4: 30,
        timeWindow12To2: 40,
        cancellationFee: 30,
        cancellationWindowDays: 7,
        homeownerPenaltyDays: 3,
        cleanerPenaltyDays: 4,
        refundPercentage: 0.5,
        platformFeePercent: 0.12,
        highVolumeFee: 60,
      };

      const res = await request(app)
        .put("/api/v1/pricing/config")
        .set("Authorization", `Bearer ${managerToken}`)
        .send(validPricingData);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to update pricing configuration");
    });

    it("should handle database errors gracefully in GET /history", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "manager" });
      PricingConfig.getHistory.mockRejectedValue(new Error("Database error"));

      const res = await request(app)
        .get("/api/v1/pricing/history")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch pricing history");
    });
  });
});
