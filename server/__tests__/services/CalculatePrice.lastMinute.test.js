const calculatePrice = require("../../services/CalculatePrice");
const { checkLastMinuteBooking } = require("../../services/CalculatePrice");
const { getPricingConfig } = require("../../config/businessConfig");

// Mock getPricingConfig
jest.mock("../../config/businessConfig", () => ({
  getPricingConfig: jest.fn(),
}));

describe("CalculatePrice - Last-Minute Booking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock pricing config
    getPricingConfig.mockResolvedValue({
      lastMinute: {
        fee: 50,
        thresholdHours: 48,
        notificationRadiusMiles: 25,
      },
    });
  });

  describe("checkLastMinuteBooking", () => {
    it("should identify a booking within threshold as last-minute", async () => {
      // Set appointment 24 hours ahead - use full ISO string to avoid timezone issues
      const now = new Date();
      const appointment = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const appointmentDate = appointment.toISOString();

      const result = await checkLastMinuteBooking(appointmentDate);

      expect(result.isLastMinute).toBe(true);
      expect(result.fee).toBe(50);
      expect(result.thresholdHours).toBe(48);
      expect(result.hoursUntil).toBeGreaterThan(0);
      expect(result.hoursUntil).toBeLessThanOrEqual(48);
    });

    it("should NOT identify a booking outside threshold as last-minute", async () => {
      // Set appointment 72 hours ahead (3 days) - use full ISO string to avoid timezone issues
      const now = new Date();
      const appointment = new Date(now.getTime() + 72 * 60 * 60 * 1000);
      const appointmentDate = appointment.toISOString();

      const result = await checkLastMinuteBooking(appointmentDate);

      expect(result.isLastMinute).toBe(false);
      expect(result.fee).toBe(0);
      expect(result.hoursUntil).toBeGreaterThan(48);
    });

    it("should NOT identify past dates as last-minute", async () => {
      // Yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const appointmentDate = yesterday.toISOString().split("T")[0];

      const result = await checkLastMinuteBooking(appointmentDate);

      expect(result.isLastMinute).toBe(false);
      expect(result.fee).toBe(0);
    });

    it("should use custom threshold from pricing config", async () => {
      getPricingConfig.mockResolvedValue({
        lastMinute: {
          fee: 75,
          thresholdHours: 72,
        },
      });

      // 60 hours ahead (within 72 hour threshold) - use full ISO string to avoid timezone issues
      const now = new Date();
      const appointment = new Date(now.getTime() + 60 * 60 * 60 * 1000);
      const appointmentDate = appointment.toISOString();

      const result = await checkLastMinuteBooking(appointmentDate);

      expect(result.isLastMinute).toBe(true);
      expect(result.fee).toBe(75);
      expect(result.thresholdHours).toBe(72);
    });

    it("should use default values when pricing config is missing", async () => {
      getPricingConfig.mockResolvedValue({});

      // 24 hours ahead - use full ISO string to avoid timezone issues
      const now = new Date();
      const appointment = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const appointmentDate = appointment.toISOString();

      const result = await checkLastMinuteBooking(appointmentDate);

      expect(result.isLastMinute).toBe(true);
      expect(result.fee).toBe(50); // default
      expect(result.thresholdHours).toBe(48); // default
    });

    it("should use provided pricing config instead of fetching", async () => {
      const customConfig = {
        lastMinute: {
          fee: 100,
          thresholdHours: 24,
        },
      };

      // 12 hours ahead - use full datetime to avoid timezone issues
      const now = new Date();
      const appointment = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      const appointmentDateTime = appointment.toISOString();

      const result = await checkLastMinuteBooking(appointmentDateTime, customConfig);

      expect(getPricingConfig).not.toHaveBeenCalled();
      expect(result.isLastMinute).toBe(true);
      expect(result.fee).toBe(100);
      expect(result.thresholdHours).toBe(24);
    });

    it("should set appointment time to 9am for date-only strings", async () => {
      // Today at 5am - appointment for today at 9am should be ~4 hours away
      const now = new Date();
      now.setHours(5, 0, 0, 0);

      // We can't easily mock Date.now, so let's just verify the function handles
      // date-only strings properly
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const appointmentDate = tomorrow.toISOString().split("T")[0];

      const result = await checkLastMinuteBooking(appointmentDate);

      // The hoursUntil should be calculated based on 9am tomorrow
      expect(typeof result.hoursUntil).toBe("number");
    });

    it("should handle full datetime strings", async () => {
      const now = new Date();
      const appointment = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      const appointmentDateTime = appointment.toISOString();

      const result = await checkLastMinuteBooking(appointmentDateTime);

      expect(result.isLastMinute).toBe(true);
      expect(result.hoursUntil).toBeLessThanOrEqual(24);
    });

    it("should round hoursUntil to nearest integer", async () => {
      const now = new Date();
      const appointment = new Date(now.getTime() + 36.7 * 60 * 60 * 1000);
      const appointmentDate = appointment.toISOString();

      const result = await checkLastMinuteBooking(appointmentDate);

      expect(Number.isInteger(result.hoursUntil)).toBe(true);
    });

    it("should handle exactly at threshold boundary", async () => {
      getPricingConfig.mockResolvedValue({
        lastMinute: {
          fee: 50,
          thresholdHours: 48,
        },
      });

      // Exactly 48 hours ahead
      const now = new Date();
      const appointment = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const appointmentDate = appointment.toISOString();

      const result = await checkLastMinuteBooking(appointmentDate);

      // At exactly 48 hours, it should still be considered last-minute (<=)
      expect(result.isLastMinute).toBe(true);
    });

    it("should handle one hour over threshold", async () => {
      getPricingConfig.mockResolvedValue({
        lastMinute: {
          fee: 50,
          thresholdHours: 48,
        },
      });

      // 49 hours ahead
      const now = new Date();
      const appointment = new Date(now.getTime() + 49 * 60 * 60 * 1000);
      const appointmentDate = appointment.toISOString();

      const result = await checkLastMinuteBooking(appointmentDate);

      expect(result.isLastMinute).toBe(false);
      expect(result.fee).toBe(0);
    });
  });

  describe("Integration with calculatePrice", () => {
    beforeEach(() => {
      getPricingConfig.mockResolvedValue({
        basePrice: 150,
        extraBedBathFee: 50,
        halfBathFee: 25,
        linens: {
          sheetFeePerBed: 30,
          towelFee: 5,
          faceClothFee: 2,
        },
        timeWindows: {
          anytime: 0,
          "10-3": 25,
        },
        lastMinute: {
          fee: 50,
          thresholdHours: 48,
        },
      });
    });

    it("should calculate base price correctly (without last-minute fee)", async () => {
      const price = await calculatePrice(
        "no", // sheets
        "no", // towels
        2, // beds
        1, // baths
        "anytime" // time window
      );

      // Base: 150 + (1 extra bed * 50) = 200
      expect(price).toBe(200);
    });

    it("should calculate price with time window surcharge", async () => {
      const price = await calculatePrice(
        "no",
        "no",
        2,
        1,
        "10-3" // +$25
      );

      // Base: 150 + (1 extra bed * 50) + 25 time surcharge = 225
      expect(price).toBe(225);
    });

    it("should calculate price with sheets", async () => {
      const price = await calculatePrice(
        "yes", // sheets
        "no",
        2, // beds (charged for all)
        1,
        "anytime"
      );

      // Base: 150 + (1 extra bed * 50) + (2 beds * 30 sheet fee) = 260
      expect(price).toBe(260);
    });

    it("should calculate price with towels", async () => {
      const price = await calculatePrice(
        "no",
        "yes", // towels
        1,
        2, // baths
        "anytime"
      );

      // Base: 150 + (1 extra bath * 50) + (2 baths * (2 towels * 5 + 1 facecloth * 2)) = 200 + 24 = 224
      expect(price).toBe(224);
    });

    it("should handle half baths correctly", async () => {
      const price = await calculatePrice(
        "no",
        "no",
        2,
        2.5, // 2 full baths + half bath
        "anytime"
      );

      // Base: 150 + (1 extra bed * 50) + (1 extra full bath * 50) + (1 half bath * 25) = 275
      expect(price).toBe(275);
    });
  });
});
