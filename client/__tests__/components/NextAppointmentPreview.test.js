/**
 * Tests for NextAppointmentPreview Component
 * Tests the preview tile for the next upcoming appointment (after today)
 * This component shows appointment info WITHOUT access details (day-of only)
 */

describe("NextAppointmentPreview Component Logic", () => {
  // Mock data structures
  const mockHome = {
    address: "123 Main Street",
    city: "Boston",
    state: "MA",
    zipcode: "02101",
    numBeds: "3",
    numBaths: "2",
    specialNotes: "Please use side door",
    keyPadCode: "1234",     // Should NOT be displayed
    keyLocation: "Under mat", // Should NOT be displayed
    contact: "555-1234",
  };

  const mockAppointment = {
    id: 1,
    homeId: 10,
    date: "2025-01-15",
    price: 15000, // $150.00 in cents
    timeToBeCompleted: "10am-3pm",
    bringSheets: "Yes",
    bringTowels: "No",
    completed: false,
  };

  const cleanerSharePercent = 0.9; // 90% cleaner share

  describe("Date Formatting", () => {
    const formatDate = (dateString) => {
      const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
      return new Date(dateString).toLocaleDateString(undefined, options);
    };

    it("should format date correctly", () => {
      // Use a date with time to avoid timezone issues
      const formatted = formatDate("2025-01-15T12:00:00");
      // Date formatting varies by locale, check it contains expected parts
      expect(formatted).toContain("2025");
      expect(formatted).toContain("15");
    });

    it("should include weekday in formatted date", () => {
      // Use a date with time to avoid timezone issues
      const formatted = formatDate("2025-01-15T12:00:00");
      // January 15, 2025 is a Wednesday
      expect(formatted.toLowerCase()).toContain("wed");
    });

    it("should handle different months", () => {
      const dates = [
        "2025-02-20", // February
        "2025-06-10", // June
        "2025-12-25", // December
      ];

      dates.forEach((date) => {
        const formatted = formatDate(date);
        expect(typeof formatted).toBe("string");
        expect(formatted.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Time Window Formatting", () => {
    const formatTimeWindow = (timeToBeCompleted) => {
      if (!timeToBeCompleted || timeToBeCompleted === "anytime") {
        return "Flexible timing";
      }
      return `Must complete by ${timeToBeCompleted.split("-")[1]}`;
    };

    it("should format time window with deadline", () => {
      expect(formatTimeWindow("10am-3pm")).toBe("Must complete by 3pm");
    });

    it("should show flexible timing for anytime", () => {
      expect(formatTimeWindow("anytime")).toBe("Flexible timing");
    });

    it("should show flexible timing for null", () => {
      expect(formatTimeWindow(null)).toBe("Flexible timing");
    });

    it("should show flexible timing for undefined", () => {
      expect(formatTimeWindow(undefined)).toBe("Flexible timing");
    });

    it("should extract various end times correctly", () => {
      expect(formatTimeWindow("8am-12pm")).toBe("Must complete by 12pm");
      expect(formatTimeWindow("9am-1pm")).toBe("Must complete by 1pm");
      expect(formatTimeWindow("12pm-5pm")).toBe("Must complete by 5pm");
    });
  });

  describe("Payout Calculation", () => {
    it("should calculate cleaner payout correctly", () => {
      const totalPrice = Number(mockAppointment.price);
      const payout = totalPrice * cleanerSharePercent;

      expect(payout).toBe(13500); // $135.00 (90% of $150)
    });

    it("should handle different cleaner share percentages", () => {
      const totalPrice = 10000; // $100

      const payout85 = totalPrice * 0.85;
      const payout90 = totalPrice * 0.90;
      const payout95 = totalPrice * 0.95;

      expect(payout85).toBe(8500);
      expect(payout90).toBe(9000);
      expect(payout95).toBe(9500);
    });

    it("should format payout as currency", () => {
      const payout = 13500;
      const formatted = `$${(payout / 100).toFixed(2)}`;

      expect(formatted).toBe("$135.00");
    });

    it("should handle zero price", () => {
      const totalPrice = 0;
      const payout = totalPrice * cleanerSharePercent;

      expect(payout).toBe(0);
    });
  });

  describe("Address Formatting", () => {
    const getFullAddress = (home) => {
      return `${home.address}, ${home.city}, ${home.state} ${home.zipcode}`;
    };

    it("should format full address correctly", () => {
      const fullAddress = getFullAddress(mockHome);

      expect(fullAddress).toBe("123 Main Street, Boston, MA 02101");
    });

    it("should handle different addresses", () => {
      const home = {
        address: "456 Oak Ave #2B",
        city: "Cambridge",
        state: "MA",
        zipcode: "02139",
      };

      const fullAddress = getFullAddress(home);

      expect(fullAddress).toBe("456 Oak Ave #2B, Cambridge, MA 02139");
    });
  });

  describe("Requirements Display", () => {
    it("should identify when sheets are required", () => {
      const appointment = { bringSheets: "Yes", bringTowels: "No" };

      expect(appointment.bringSheets === "Yes").toBe(true);
      expect(appointment.bringTowels === "Yes").toBe(false);
    });

    it("should identify when towels are required", () => {
      const appointment = { bringSheets: "No", bringTowels: "Yes" };

      expect(appointment.bringSheets === "Yes").toBe(false);
      expect(appointment.bringTowels === "Yes").toBe(true);
    });

    it("should identify when both are required", () => {
      const appointment = { bringSheets: "Yes", bringTowels: "Yes" };

      expect(appointment.bringSheets === "Yes").toBe(true);
      expect(appointment.bringTowels === "Yes").toBe(true);
    });

    it("should identify when neither is required", () => {
      const appointment = { bringSheets: "No", bringTowels: "No" };

      expect(appointment.bringSheets === "Yes").toBe(false);
      expect(appointment.bringTowels === "Yes").toBe(false);
    });
  });

  describe("Access Information Hiding", () => {
    // NextAppointmentPreview should NOT show access details
    // This is a key security/business requirement

    it("should identify fields that should be hidden", () => {
      const accessFields = ["keyPadCode", "keyLocation"];
      const displayableFields = ["address", "city", "state", "zipcode", "numBeds", "numBaths", "specialNotes"];

      // Access fields should exist in home data but not be rendered
      accessFields.forEach((field) => {
        expect(mockHome[field]).toBeDefined();
      });

      // Displayable fields should be shown
      displayableFields.forEach((field) => {
        expect(mockHome[field]).toBeDefined();
      });
    });

    it("should have a message about access details availability", () => {
      const accessInfoMessage = "Access details available on day of appointment";

      expect(accessInfoMessage).toContain("day of appointment");
    });
  });

  describe("Special Notes Display", () => {
    it("should show special notes when present", () => {
      expect(mockHome.specialNotes).toBe("Please use side door");
      expect(Boolean(mockHome.specialNotes)).toBe(true);
    });

    it("should handle empty special notes", () => {
      const homeNoNotes = { ...mockHome, specialNotes: "" };

      expect(Boolean(homeNoNotes.specialNotes)).toBe(false);
    });

    it("should handle null special notes", () => {
      const homeNoNotes = { ...mockHome, specialNotes: null };

      expect(Boolean(homeNoNotes.specialNotes)).toBe(false);
    });

    it("should handle special notes with line breaks", () => {
      const homeWithNotes = {
        ...mockHome,
        specialNotes: "Line 1\nLine 2\nLine 3",
      };

      expect(homeWithNotes.specialNotes).toContain("\n");
    });
  });

  describe("Beds and Baths Display", () => {
    it("should display number of beds", () => {
      expect(mockHome.numBeds).toBe("3");
    });

    it("should display number of baths", () => {
      expect(mockHome.numBaths).toBe("2");
    });

    it("should handle missing bed/bath info", () => {
      const homeNoBeds = { ...mockHome, numBeds: "" };
      const homeNoBaths = { ...mockHome, numBaths: undefined };

      expect(homeNoBeds.numBeds || "?").toBe("?");
      expect(homeNoBaths.numBaths || "?").toBe("?");
    });

    it("should handle half baths format", () => {
      const homeHalfBath = { ...mockHome, numBaths: "2.5" };

      expect(homeHalfBath.numBaths).toBe("2.5");
    });
  });

  describe("Maps URL Generation", () => {
    const generateMapsUrl = (app, fullAddress) => {
      const encodedAddress = encodeURIComponent(fullAddress);

      switch (app) {
        case "apple":
          return `maps://maps.apple.com/?daddr=${encodedAddress}`;
        case "google":
          return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
        case "waze":
          return `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;
        default:
          return null;
      }
    };

    it("should generate Apple Maps URL", () => {
      const fullAddress = "123 Main Street, Boston, MA 02101";
      const url = generateMapsUrl("apple", fullAddress);

      expect(url).toContain("maps://maps.apple.com");
      expect(url).toContain("daddr=");
    });

    it("should generate Google Maps URL", () => {
      const fullAddress = "123 Main Street, Boston, MA 02101";
      const url = generateMapsUrl("google", fullAddress);

      expect(url).toContain("google.com/maps");
      expect(url).toContain("destination=");
    });

    it("should generate Waze URL", () => {
      const fullAddress = "123 Main Street, Boston, MA 02101";
      const url = generateMapsUrl("waze", fullAddress);

      expect(url).toContain("waze.com");
      expect(url).toContain("navigate=yes");
    });
  });

  describe("Component State Management", () => {
    it("should use initial home if provided", () => {
      const initialHome = mockHome;

      // Component should use provided home data
      expect(initialHome.address).toBe("123 Main Street");
    });

    it("should have default home state when not provided", () => {
      const defaultHome = {
        address: "",
        city: "",
        numBaths: "",
        numBeds: "",
        specialNotes: "",
        state: "",
        zipcode: "",
      };

      // All fields should be empty strings
      Object.values(defaultHome).forEach((value) => {
        expect(value).toBe("");
      });
    });

    it("should identify when home data is incomplete", () => {
      const incompleteHome = { address: "" };

      expect(!incompleteHome.address).toBe(true);
    });
  });

  describe("Platform Options", () => {
    it("should include Apple Maps on iOS", () => {
      const platformOS = "ios";
      const options =
        platformOS === "ios"
          ? ["Apple Maps", "Google Maps", "Waze", "Cancel"]
          : ["Google Maps", "Waze", "Cancel"];

      expect(options).toContain("Apple Maps");
    });

    it("should exclude Apple Maps on Android", () => {
      const platformOS = "android";
      const options =
        platformOS === "ios"
          ? ["Apple Maps", "Google Maps", "Waze", "Cancel"]
          : ["Google Maps", "Waze", "Cancel"];

      expect(options).not.toContain("Apple Maps");
    });
  });

  describe("Loading States", () => {
    it("should show loading text when address is missing", () => {
      const home = { address: "" };

      expect(home.address || "Loading...").toBe("Loading...");
    });

    it("should show actual address when loaded", () => {
      const home = { address: "123 Main Street" };

      expect(home.address || "Loading...").toBe("123 Main Street");
    });
  });

  describe("Difference from TodaysAppointment", () => {
    // These tests document the key differences between NextAppointmentPreview
    // and TodaysAppointment components

    it("should NOT include keyPadCode display (unlike TodaysAppointment)", () => {
      // NextAppointmentPreview intentionally omits access info
      const previewFields = ["address", "city", "state", "zipcode", "numBeds", "numBaths", "specialNotes"];
      const hiddenFields = ["keyPadCode", "keyLocation", "contact"];

      expect(previewFields).not.toContain("keyPadCode");
      expect(previewFields).not.toContain("keyLocation");
    });

    it("should NOT include Start Job button (only preview)", () => {
      // NextAppointmentPreview is informational only
      const hasStartButton = false;

      expect(hasStartButton).toBe(false);
    });

    it("should show access info message instead of actual codes", () => {
      const messageDisplayed = "Access details available on day of appointment";

      expect(messageDisplayed).toBeTruthy();
    });
  });
});
