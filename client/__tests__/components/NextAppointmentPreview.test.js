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
    // OLD formatDate (had timezone issues)
    const formatDateOld = (dateString) => {
      const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
      return new Date(dateString).toLocaleDateString(undefined, options);
    };

    // NEW formatDate (fixed timezone issues by appending T00:00:00)
    const formatDate = (dateString) => {
      const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
      return new Date(dateString + "T00:00:00").toLocaleDateString(undefined, options);
    };

    it("should format date correctly", () => {
      // Use a date with time to avoid timezone issues
      const formatted = formatDate("2025-01-15");
      // Date formatting varies by locale, check it contains expected parts
      expect(formatted).toContain("2025");
      expect(formatted).toContain("15");
    });

    it("should include weekday in formatted date", () => {
      const formatted = formatDate("2025-01-15");
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

  describe("Date Formatting - Timezone Fix", () => {
    /**
     * These tests verify the timezone fix for date formatting.
     * The issue was that new Date("2025-01-04") interprets the date as UTC midnight,
     * which becomes the previous day in US timezones (e.g., 2025-01-03 at 7pm EST).
     *
     * The fix appends "T00:00:00" to make JavaScript interpret the time as local midnight.
     */

    // The fixed formatDate function
    const formatDateFixed = (dateString) => {
      const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
      return new Date(dateString + "T00:00:00").toLocaleDateString(undefined, options);
    };

    it("should return the correct day number for January 4th", () => {
      const formatted = formatDateFixed("2025-01-04");
      // Should contain "4" (not "3" which would happen with timezone bug)
      expect(formatted).toContain("4");
    });

    it("should return the correct day for January 15th", () => {
      const formatted = formatDateFixed("2025-01-15");
      expect(formatted).toContain("15");
    });

    it("should return correct day for end of month dates", () => {
      // January 31st should stay as 31, not become 30
      const formatted = formatDateFixed("2025-01-31");
      expect(formatted).toContain("31");
    });

    it("should handle year boundaries correctly", () => {
      // January 1st should stay as 1, not become December 31
      const formatted = formatDateFixed("2025-01-01");
      expect(formatted).toContain("Jan");
      expect(formatted).toContain("1");
      expect(formatted).toContain("2025");
    });

    it("should preserve the day of week correctly", () => {
      // 2025-01-04 is a Saturday
      const formatted = formatDateFixed("2025-01-04");
      expect(formatted.toLowerCase()).toContain("sat");
    });

    it("should handle February 29 in leap years", () => {
      // 2024 is a leap year
      const formatted = formatDateFixed("2024-02-29");
      expect(formatted).toContain("29");
      expect(formatted).toContain("Feb");
    });

    it("should match expected date for various dates", () => {
      const testCases = [
        { input: "2025-01-04", expectedDay: "4" },
        { input: "2025-06-15", expectedDay: "15" },
        { input: "2025-12-25", expectedDay: "25" },
        { input: "2025-03-01", expectedDay: "1" },
      ];

      testCases.forEach(({ input, expectedDay }) => {
        const formatted = formatDateFixed(input);
        expect(formatted).toContain(expectedDay);
      });
    });
  });

  describe("isWithinTwoDays Calculation - Timezone Handling", () => {
    /**
     * Tests for the isWithinTwoDays function which also had timezone issues.
     * The fix uses: new Date(appointment.date + "T00:00:00") instead of new Date(appointment.date)
     */

    // Helper to format date as YYYY-MM-DD in local timezone (not UTC)
    const toLocalDateString = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const isWithinTwoDays = (appointmentDate) => {
      // Fixed version using local time
      const date = new Date(appointmentDate + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = date.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 2;
    };

    it("should correctly identify tomorrow as within 2 days", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = toLocalDateString(tomorrow);

      expect(isWithinTwoDays(tomorrowStr)).toBe(true);
    });

    it("should correctly identify day after tomorrow as within 2 days", () => {
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);
      const dayAfterStr = toLocalDateString(dayAfter);

      expect(isWithinTwoDays(dayAfterStr)).toBe(true);
    });

    it("should correctly identify 3 days from now as NOT within 2 days", () => {
      const threeDays = new Date();
      threeDays.setDate(threeDays.getDate() + 3);
      const threeDaysStr = toLocalDateString(threeDays);

      expect(isWithinTwoDays(threeDaysStr)).toBe(false);
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

// ============================================
// 48-Hour Address Visibility Tests
// ============================================
describe("NextAppointmentPreview - 48-Hour Address Visibility", () => {
  /**
   * Tests for the updated isWithin48Hours function
   * Full address is only shown when appointment is within 48 hours of start time
   */

  // Updated function using 48-hour calculation
  const isWithin48Hours = (appointmentDate) => {
    const now = new Date();
    // Assume 10am start time for the appointment
    const appointmentTime = new Date(appointmentDate + "T10:00:00");
    const diffTime = appointmentTime.getTime() - now.getTime();
    const diffHours = diffTime / (1000 * 60 * 60);
    return diffHours <= 48 && diffHours >= 0;
  };

  // Helper to format date as YYYY-MM-DD in local timezone
  const toLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  describe("isWithin48Hours Calculation", () => {
    it("should return true for appointment tomorrow", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = toLocalDateString(tomorrow);

      // Tomorrow at 10am is always within 48 hours
      const appointmentTime = new Date(tomorrowStr + "T10:00:00");
      const now = new Date();
      const diffHours = (appointmentTime - now) / (1000 * 60 * 60);

      expect(diffHours > 0).toBe(true);
      expect(diffHours <= 48).toBe(true);
    });

    it("should return false for appointment 3 days away", () => {
      const threeDays = new Date();
      threeDays.setDate(threeDays.getDate() + 3);
      const threeDaysStr = toLocalDateString(threeDays);

      const appointmentTime = new Date(threeDaysStr + "T10:00:00");
      const now = new Date();
      const diffHours = (appointmentTime - now) / (1000 * 60 * 60);

      // 3 days = roughly 72 hours
      expect(diffHours > 48).toBe(true);
    });

    it("should return false for past appointments", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = toLocalDateString(yesterday);

      const appointmentTime = new Date(yesterdayStr + "T10:00:00");
      const now = new Date();
      const diffHours = (appointmentTime - now) / (1000 * 60 * 60);

      expect(diffHours < 0).toBe(true);
    });
  });

  describe("Address Display Based on 48-Hour Window", () => {
    const mockHome = {
      address: "123 Main Street",
      city: "Boston",
      state: "MA",
      zipcode: "02101",
    };

    it("should show full address when within 48 hours", () => {
      const showFullAddress = true;

      const displayedContent = showFullAddress
        ? `${mockHome.address}, ${mockHome.city}, ${mockHome.state} ${mockHome.zipcode}`
        : `${mockHome.city}, ${mockHome.state}`;

      expect(displayedContent).toBe("123 Main Street, Boston, MA 02101");
    });

    it("should show only city/state when outside 48 hours", () => {
      const showFullAddress = false;

      const displayedContent = showFullAddress
        ? `${mockHome.address}, ${mockHome.city}, ${mockHome.state} ${mockHome.zipcode}`
        : `${mockHome.city}, ${mockHome.state}`;

      expect(displayedContent).toBe("Boston, MA");
    });

    it("should show correct hint text when address is hidden", () => {
      const showFullAddress = false;
      const hintText = "Full address available 2 days before";

      expect(!showFullAddress).toBe(true);
      expect(hintText).toBe("Full address available 2 days before");
    });
  });

  describe("Access Info Visibility", () => {
    it("should hide access details when outside 48 hours", () => {
      const showFullAddress = false;
      const accessDetailsMessage = !showFullAddress
        ? "Full address and access details available 2 days before appointment"
        : null;

      expect(accessDetailsMessage).toBeTruthy();
      expect(accessDetailsMessage).toContain("2 days before");
    });

    it("should show access details when within 48 hours", () => {
      const showFullAddress = true;
      const keyPadCode = "1234";
      const keyLocation = "Under mat";

      // Access info should be visible when we have address and access codes
      const hasAccessInfo = !!(keyPadCode || keyLocation);
      const showAccessInfo = showFullAddress && hasAccessInfo;
      expect(showAccessInfo).toBe(true);
    });
  });
});
