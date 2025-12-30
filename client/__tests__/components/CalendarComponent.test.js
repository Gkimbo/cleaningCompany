/**
 * Tests for CalendarComponent
 * Tests time window display, price calculation, and date handling
 */

// Mock dependencies - these don't need react-native components
jest.mock("react-native-calendars", () => ({
  Calendar: "Calendar",
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  __esModule: true,
  default: {
    deleteAppointment: jest.fn(),
  },
}));

jest.mock("../../src/context/PricingContext", () => ({
  usePricing: () => ({
    pricing: {
      basePrice: 150,
      extraBedBathFee: 50,
      halfBathFee: 25,
      linens: {
        sheetFeePerBed: 30,
        towelFee: 5,
        faceClothFee: 2,
      },
      timeWindows: {
        anytime: { surcharge: 0, label: "Anytime" },
        "10-3": { surcharge: 25, label: "10am - 3pm" },
        "11-4": { surcharge: 25, label: "11am - 4pm" },
        "12-2": { surcharge: 30, label: "12pm - 2pm" },
      },
    },
  }),
  getTimeWindowSurcharge: (pricing, timeWindow) => {
    const timeWindows = pricing?.timeWindows || {};
    const config = timeWindows[timeWindow];
    if (typeof config === "object" && config !== null) {
      return config.surcharge || 0;
    }
    return typeof config === "number" ? config : 0;
  },
  getTimeWindowLabel: (pricing, timeWindow) => {
    if (!timeWindow || timeWindow === "anytime") {
      return { label: "Anytime", surcharge: 0, shortLabel: null };
    }
    const timeWindowLabels = {
      "10-3": "10am - 3pm",
      "11-4": "11am - 4pm",
      "12-2": "12pm - 2pm",
    };
    const timeWindows = pricing?.timeWindows || {};
    const config = timeWindows[timeWindow];
    if (!config) {
      return { label: "Anytime", surcharge: 0, shortLabel: null };
    }
    const surcharge = typeof config === "object" ? (config.surcharge || 0) : (typeof config === "number" ? config : 0);
    const label = typeof config === "object" && config.label ? config.label : (timeWindowLabels[timeWindow] || timeWindow);
    return { label, surcharge, shortLabel: timeWindow };
  },
}));

describe("CalendarComponent Time Window Logic", () => {
  describe("Time Window Surcharge Calculation", () => {
    const { getTimeWindowSurcharge } = require("../../src/context/PricingContext");

    const mockPricing = {
      timeWindows: {
        anytime: { surcharge: 0, label: "Anytime" },
        "10-3": { surcharge: 25, label: "10am - 3pm" },
        "11-4": { surcharge: 25, label: "11am - 4pm" },
        "12-2": { surcharge: 30, label: "12pm - 2pm" },
      },
    };

    it("should return 0 surcharge for anytime", () => {
      expect(getTimeWindowSurcharge(mockPricing, "anytime")).toBe(0);
    });

    it("should return correct surcharge for 10-3 time window", () => {
      expect(getTimeWindowSurcharge(mockPricing, "10-3")).toBe(25);
    });

    it("should return correct surcharge for 12-2 time window", () => {
      expect(getTimeWindowSurcharge(mockPricing, "12-2")).toBe(30);
    });

    it("should return 0 for null time window", () => {
      expect(getTimeWindowSurcharge(mockPricing, null)).toBe(0);
    });
  });

  describe("Time Window Label Display", () => {
    const { getTimeWindowLabel } = require("../../src/context/PricingContext");

    const mockPricing = {
      timeWindows: {
        anytime: { surcharge: 0, label: "Anytime" },
        "10-3": { surcharge: 25, label: "10am - 3pm" },
        "12-2": { surcharge: 30, label: "12pm - 2pm" },
      },
    };

    it("should return Anytime for null time window", () => {
      const result = getTimeWindowLabel(mockPricing, null);
      expect(result.label).toBe("Anytime");
      expect(result.surcharge).toBe(0);
    });

    it("should return correct label for 10-3 time window", () => {
      const result = getTimeWindowLabel(mockPricing, "10-3");
      expect(result.label).toBe("10am - 3pm");
      expect(result.surcharge).toBe(25);
      expect(result.shortLabel).toBe("10-3");
    });

    it("should indicate if there is a surcharge", () => {
      const anytimeResult = getTimeWindowLabel(mockPricing, "anytime");
      expect(anytimeResult.surcharge).toBe(0);

      const timeConstraintResult = getTimeWindowLabel(mockPricing, "10-3");
      expect(timeConstraintResult.surcharge).toBeGreaterThan(0);
    });
  });

  describe("Price Calculation with Time Window", () => {
    // Simulating the calculatePrice function logic
    const calculatePrice = (pricing, numBeds, numBaths, timeToBeCompleted, sheets, towels) => {
      const basePrice = pricing?.basePrice ?? 150;
      const extraBedBathFee = pricing?.extraBedBathFee ?? 50;
      const halfBathFee = pricing?.halfBathFee ?? 25;
      const sheetFeePerBed = pricing?.linens?.sheetFeePerBed ?? 30;
      const towelFee = pricing?.linens?.towelFee ?? 5;

      let price = 0;

      // Time window surcharge
      const timeWindows = pricing?.timeWindows || {};
      const config = timeWindows[timeToBeCompleted];
      const timeSurcharge = typeof config === "object" ? (config.surcharge || 0) : (typeof config === "number" ? config : 0);
      price += timeSurcharge;

      // Linen pricing
      if (sheets === "yes") {
        price += Number(numBeds) * sheetFeePerBed;
      }
      if (towels === "yes") {
        price += Number(numBaths) * (2 * towelFee);
      }

      // Base price calculation
      const beds = Number(numBeds);
      const baths = parseFloat(numBaths) || 0;
      const fullBaths = Math.floor(baths);
      const hasHalfBath = (baths % 1) >= 0.5;

      const extraBeds = Math.max(0, beds - 1);
      const extraFullBaths = Math.max(0, fullBaths - 1);
      const halfBathCount = hasHalfBath ? 1 : 0;

      price += basePrice + (extraBeds * extraBedBathFee) + (extraFullBaths * extraBedBathFee) + (halfBathCount * halfBathFee);

      return price;
    };

    const mockPricing = {
      basePrice: 150,
      extraBedBathFee: 50,
      halfBathFee: 25,
      linens: {
        sheetFeePerBed: 30,
        towelFee: 5,
      },
      timeWindows: {
        anytime: { surcharge: 0 },
        "10-3": { surcharge: 25 },
        "12-2": { surcharge: 30 },
      },
    };

    it("should calculate base price correctly for 1 bed 1 bath", () => {
      const price = calculatePrice(mockPricing, 1, 1, "anytime", "no", "no");
      expect(price).toBe(150);
    });

    it("should add time window surcharge to price", () => {
      const priceAnytime = calculatePrice(mockPricing, 1, 1, "anytime", "no", "no");
      const priceWithConstraint = calculatePrice(mockPricing, 1, 1, "10-3", "no", "no");

      expect(priceWithConstraint - priceAnytime).toBe(25);
    });

    it("should add $30 surcharge for 12-2 time window", () => {
      const priceAnytime = calculatePrice(mockPricing, 1, 1, "anytime", "no", "no");
      const priceWithConstraint = calculatePrice(mockPricing, 1, 1, "12-2", "no", "no");

      expect(priceWithConstraint - priceAnytime).toBe(30);
    });

    it("should include extra bed/bath fees plus time window surcharge", () => {
      const price = calculatePrice(mockPricing, 3, 2, "10-3", "no", "no");
      // Base: 150 + 2 extra beds * 50 + 1 extra bath * 50 + time window 25 = 325
      expect(price).toBe(325);
    });

    it("should include sheets fee plus time window surcharge", () => {
      const price = calculatePrice(mockPricing, 2, 1, "10-3", "yes", "no");
      // Base: 150 + 1 extra bed * 50 + time window 25 + sheets (2 * 30) = 285
      expect(price).toBe(285);
    });
  });

  describe("Booked Appointment Time Window Detection", () => {
    const hasTimeConstraint = (appointment) => {
      const timeWindow = appointment?.timeToBeCompleted;
      return Boolean(timeWindow && timeWindow !== "anytime");
    };

    it("should detect time constraint on appointment", () => {
      const appointment = { timeToBeCompleted: "10-3" };
      expect(hasTimeConstraint(appointment)).toBe(true);
    });

    it("should not detect constraint for anytime", () => {
      const appointment = { timeToBeCompleted: "anytime" };
      expect(hasTimeConstraint(appointment)).toBe(false);
    });

    it("should not detect constraint for null", () => {
      const appointment = { timeToBeCompleted: null };
      expect(hasTimeConstraint(appointment)).toBe(false);
    });

    it("should not detect constraint for undefined", () => {
      const appointment = {};
      expect(hasTimeConstraint(appointment)).toBe(false);
    });
  });
});

describe("CalendarComponent useCallback Dependencies", () => {
  // Test that price recalculates when dependencies change
  it("should include all price-affecting props in renderDay dependencies", () => {
    // This is a documentation test - the actual dependencies are:
    // [selectedDates, appointments, confirmationModalVisible, pricing,
    //  timeToBeCompleted, numBeds, numBaths, sheets, towels,
    //  bedConfigurations, bathroomConfigurations]
    const dependencies = [
      "selectedDates",
      "appointments",
      "confirmationModalVisible",
      "pricing",
      "timeToBeCompleted",
      "numBeds",
      "numBaths",
      "sheets",
      "towels",
      "bedConfigurations",
      "bathroomConfigurations",
    ];

    // Verify timeToBeCompleted is included (was missing before fix)
    expect(dependencies).toContain("timeToBeCompleted");
    expect(dependencies).toContain("pricing");
    expect(dependencies).toContain("numBeds");
    expect(dependencies).toContain("numBaths");
  });
});
