const {
  parseIcalEvents,
  validateIcalUrl,
  detectPlatform,
  formatDateString,
  getCheckoutDates,
  fetchIcalData,
} = require("../../services/icalParser");

// Mock http/https modules
jest.mock("https", () => ({
  get: jest.fn(),
}));

jest.mock("http", () => ({
  get: jest.fn(),
}));

describe("iCal Parser Service", () => {
  describe("validateIcalUrl", () => {
    it("should return true for valid Airbnb calendar URL", () => {
      const url = "https://www.airbnb.com/calendar/ical/12345.ics?s=abc123";
      expect(validateIcalUrl(url)).toBe(true);
    });

    it("should return true for valid VRBO calendar URL", () => {
      const url = "https://www.vrbo.com/icalendar/abc123.ics";
      expect(validateIcalUrl(url)).toBe(true);
    });

    it("should return true for HomeAway URL (owned by VRBO)", () => {
      const url = "https://www.homeaway.com/calendar/ical/12345.ics";
      expect(validateIcalUrl(url)).toBe(true);
    });

    it("should return true for generic iCal URL with .ics extension", () => {
      const url = "https://example.com/calendar/export.ics";
      expect(validateIcalUrl(url)).toBe(true);
    });

    it("should return true for URL with ical in path", () => {
      const url = "https://example.com/icalendar/feed";
      expect(validateIcalUrl(url)).toBe(true);
    });

    it("should return false for invalid URL", () => {
      expect(validateIcalUrl("not-a-url")).toBe(false);
    });

    it("should return false for null input", () => {
      expect(validateIcalUrl(null)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(validateIcalUrl("")).toBe(false);
    });

    it("should return false for non-http protocol", () => {
      expect(validateIcalUrl("ftp://example.com/calendar.ics")).toBe(false);
    });

    it("should return false for regular webpage URL without calendar indicators", () => {
      expect(validateIcalUrl("https://google.com")).toBe(false);
    });
  });

  describe("detectPlatform", () => {
    it("should detect Airbnb from URL", () => {
      expect(detectPlatform("https://www.airbnb.com/calendar/ical/123.ics")).toBe("airbnb");
    });

    it("should detect VRBO from URL", () => {
      expect(detectPlatform("https://www.vrbo.com/icalendar/123.ics")).toBe("vrbo");
    });

    it("should detect HomeAway as VRBO", () => {
      expect(detectPlatform("https://www.homeaway.com/calendar/123.ics")).toBe("vrbo");
    });

    it("should detect Booking.com", () => {
      expect(detectPlatform("https://admin.booking.com/calendar/123.ics")).toBe("booking");
    });

    it("should return 'other' for unknown platforms", () => {
      expect(detectPlatform("https://example.com/calendar.ics")).toBe("other");
    });

    it("should return 'other' for null input", () => {
      expect(detectPlatform(null)).toBe("other");
    });

    it("should be case-insensitive", () => {
      expect(detectPlatform("https://WWW.AIRBNB.COM/calendar/123.ics")).toBe("airbnb");
    });
  });

  describe("formatDateString", () => {
    it("should format date to YYYY-MM-DD", () => {
      const date = new Date(2025, 0, 15); // January 15, 2025
      expect(formatDateString(date)).toBe("2025-01-15");
    });

    it("should pad single digit months", () => {
      const date = new Date(2025, 4, 5); // May 5, 2025
      expect(formatDateString(date)).toBe("2025-05-05");
    });

    it("should handle end of year dates", () => {
      const date = new Date(2025, 11, 31); // December 31, 2025
      expect(formatDateString(date)).toBe("2025-12-31");
    });
  });

  describe("parseIcalEvents", () => {
    it("should parse a simple VEVENT", () => {
      const icalData = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:123@airbnb.com
DTSTART:20250120
DTEND:20250125
SUMMARY:Reserved
END:VEVENT
END:VCALENDAR`;

      const events = parseIcalEvents(icalData);

      expect(events).toHaveLength(1);
      expect(events[0].uid).toBe("123@airbnb.com");
      expect(events[0].summary).toBe("Reserved");
      expect(events[0].isBooking).toBe(true);
      expect(events[0].isBlocked).toBe(false);
    });

    it("should parse multiple events", () => {
      const icalData = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:123@airbnb.com
DTSTART:20250120
DTEND:20250125
SUMMARY:Reserved
END:VEVENT
BEGIN:VEVENT
UID:456@airbnb.com
DTSTART:20250201
DTEND:20250205
SUMMARY:John Smith
END:VEVENT
END:VCALENDAR`;

      const events = parseIcalEvents(icalData);

      expect(events).toHaveLength(2);
    });

    it("should identify blocked dates", () => {
      const icalData = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:789@airbnb.com
DTSTART:20250115
DTEND:20250117
SUMMARY:Not available
END:VEVENT
END:VCALENDAR`;

      const events = parseIcalEvents(icalData);

      expect(events[0].isBlocked).toBe(true);
      expect(events[0].isBooking).toBe(false);
    });

    it("should handle datetime format with time", () => {
      const icalData = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:123@test.com
DTSTART:20250120T150000Z
DTEND:20250125T110000Z
SUMMARY:Reservation
END:VEVENT
END:VCALENDAR`;

      const events = parseIcalEvents(icalData);

      expect(events).toHaveLength(1);
      expect(events[0].startDate).toBeInstanceOf(Date);
      expect(events[0].endDate).toBeInstanceOf(Date);
    });

    it("should handle date format with VALUE=DATE parameter", () => {
      const icalData = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:123@test.com
DTSTART;VALUE=DATE:20250120
DTEND;VALUE=DATE:20250125
SUMMARY:Guest booking
END:VEVENT
END:VCALENDAR`;

      const events = parseIcalEvents(icalData);

      expect(events).toHaveLength(1);
      expect(events[0].startDate.getFullYear()).toBe(2025);
      expect(events[0].startDate.getMonth()).toBe(0); // January
      expect(events[0].startDate.getDate()).toBe(20);
    });

    it("should handle line folding (continuation)", () => {
      const icalData = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:123@test.com
DTSTART:20250120
DTEND:20250125
SUMMARY:This is a very long summary that continues
 on the next line
END:VEVENT
END:VCALENDAR`;

      const events = parseIcalEvents(icalData);

      expect(events).toHaveLength(1);
      expect(events[0].summary).toContain("This is a very long summary");
    });

    it("should ignore events without dates", () => {
      const icalData = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:123@test.com
SUMMARY:No dates
END:VEVENT
END:VCALENDAR`;

      const events = parseIcalEvents(icalData);

      expect(events).toHaveLength(0);
    });

    it("should parse description field", () => {
      const icalData = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:123@test.com
DTSTART:20250120
DTEND:20250125
SUMMARY:Reserved
DESCRIPTION:Reservation confirmation for guest John
END:VEVENT
END:VCALENDAR`;

      const events = parseIcalEvents(icalData);

      expect(events[0].description).toContain("Reservation confirmation");
    });

    it("should handle empty calendar", () => {
      const icalData = `BEGIN:VCALENDAR
VERSION:2.0
END:VCALENDAR`;

      const events = parseIcalEvents(icalData);

      expect(events).toHaveLength(0);
    });

    it("should handle Windows-style line endings", () => {
      const icalData = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:123\r\nDTSTART:20250120\r\nDTEND:20250125\r\nSUMMARY:Test\r\nEND:VEVENT\r\nEND:VCALENDAR";

      const events = parseIcalEvents(icalData);

      expect(events).toHaveLength(1);
    });
  });

  describe("fetchIcalData", () => {
    const https = require("https");

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should fetch data from HTTPS URL", async () => {
      const mockResponse = {
        statusCode: 200,
        headers: {},
        on: jest.fn((event, callback) => {
          if (event === "data") {
            callback("BEGIN:VCALENDAR\nEND:VCALENDAR");
          }
          if (event === "end") {
            callback();
          }
          return mockResponse;
        }),
      };

      https.get.mockImplementation((url, callback) => {
        callback(mockResponse);
        return { on: jest.fn(), setTimeout: jest.fn(), destroy: jest.fn() };
      });

      const data = await fetchIcalData("https://example.com/calendar.ics");

      expect(data).toContain("BEGIN:VCALENDAR");
    });

    it("should reject on non-200 status code", async () => {
      const mockResponse = {
        statusCode: 404,
        headers: {},
        on: jest.fn(),
      };

      https.get.mockImplementation((url, callback) => {
        callback(mockResponse);
        return { on: jest.fn(), setTimeout: jest.fn(), destroy: jest.fn() };
      });

      await expect(fetchIcalData("https://example.com/notfound.ics")).rejects.toThrow("HTTP 404");
    });

    it("should handle redirects", async () => {
      const mockRedirectResponse = {
        statusCode: 302,
        headers: { location: "https://example.com/new-location.ics" },
        on: jest.fn(),
      };

      const mockFinalResponse = {
        statusCode: 200,
        headers: {},
        on: jest.fn((event, callback) => {
          if (event === "data") {
            callback("BEGIN:VCALENDAR\nEND:VCALENDAR");
          }
          if (event === "end") {
            callback();
          }
          return mockFinalResponse;
        }),
      };

      let callCount = 0;
      https.get.mockImplementation((url, callback) => {
        callCount++;
        if (callCount === 1) {
          callback(mockRedirectResponse);
        } else {
          callback(mockFinalResponse);
        }
        return { on: jest.fn(), setTimeout: jest.fn(), destroy: jest.fn() };
      });

      const data = await fetchIcalData("https://example.com/redirect.ics");

      expect(data).toContain("BEGIN:VCALENDAR");
      expect(callCount).toBe(2);
    });
  });

  describe("getCheckoutDates", () => {
    const https = require("https");

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should return checkout dates from iCal feed", async () => {
      // Create a date in the future (30 days from now)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const endDate = new Date(futureDate);
      endDate.setDate(endDate.getDate() + 5);

      const startStr = futureDate.toISOString().slice(0, 10).replace(/-/g, "");
      const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, "");

      const icalData = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:123@test.com
DTSTART:${startStr}
DTEND:${endStr}
SUMMARY:Reserved
END:VEVENT
END:VCALENDAR`;

      const mockResponse = {
        statusCode: 200,
        headers: {},
        on: jest.fn((event, callback) => {
          if (event === "data") {
            callback(icalData);
          }
          if (event === "end") {
            callback();
          }
          return mockResponse;
        }),
      };

      https.get.mockImplementation((url, callback) => {
        callback(mockResponse);
        return { on: jest.fn(), setTimeout: jest.fn(), destroy: jest.fn() };
      });

      const checkouts = await getCheckoutDates("https://example.com/calendar.ics");

      expect(checkouts).toHaveLength(1);
      expect(checkouts[0]).toHaveProperty("checkoutDate");
      expect(checkouts[0]).toHaveProperty("checkinDate");
      expect(checkouts[0]).toHaveProperty("uid");
    });

    it("should filter out past checkout dates", async () => {
      // Create a date in the past
      const icalData = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:123@test.com
DTSTART:20200101
DTEND:20200105
SUMMARY:Past reservation
END:VEVENT
END:VCALENDAR`;

      const mockResponse = {
        statusCode: 200,
        headers: {},
        on: jest.fn((event, callback) => {
          if (event === "data") {
            callback(icalData);
          }
          if (event === "end") {
            callback();
          }
          return mockResponse;
        }),
      };

      https.get.mockImplementation((url, callback) => {
        callback(mockResponse);
        return { on: jest.fn(), setTimeout: jest.fn(), destroy: jest.fn() };
      });

      const checkouts = await getCheckoutDates("https://example.com/calendar.ics");

      expect(checkouts).toHaveLength(0);
    });

    it("should filter out blocked dates (not actual bookings)", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const endDate = new Date(futureDate);
      endDate.setDate(endDate.getDate() + 5);

      const startStr = futureDate.toISOString().slice(0, 10).replace(/-/g, "");
      const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, "");

      const icalData = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:123@test.com
DTSTART:${startStr}
DTEND:${endStr}
SUMMARY:Not available
END:VEVENT
END:VCALENDAR`;

      const mockResponse = {
        statusCode: 200,
        headers: {},
        on: jest.fn((event, callback) => {
          if (event === "data") {
            callback(icalData);
          }
          if (event === "end") {
            callback();
          }
          return mockResponse;
        }),
      };

      https.get.mockImplementation((url, callback) => {
        callback(mockResponse);
        return { on: jest.fn(), setTimeout: jest.fn(), destroy: jest.fn() };
      });

      const checkouts = await getCheckoutDates("https://example.com/calendar.ics");

      expect(checkouts).toHaveLength(0);
    });
  });
});
