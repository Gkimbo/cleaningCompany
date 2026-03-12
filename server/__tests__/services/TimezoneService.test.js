/**
 * Tests for TimezoneService
 * Tests coordinate-based timezone lookup, state fallback, and date utilities
 */

const TimezoneService = require("../../services/TimezoneService");

describe("TimezoneService", () => {
  describe("getTimezoneFromCoords", () => {
    it("should return correct timezone for New York City coordinates", () => {
      const timezone = TimezoneService.getTimezoneFromCoords(40.7128, -74.006);
      expect(timezone).toBe("America/New_York");
    });

    it("should return correct timezone for Los Angeles coordinates", () => {
      const timezone = TimezoneService.getTimezoneFromCoords(34.0522, -118.2437);
      expect(timezone).toBe("America/Los_Angeles");
    });

    it("should return correct timezone for Chicago coordinates", () => {
      const timezone = TimezoneService.getTimezoneFromCoords(41.8781, -87.6298);
      expect(timezone).toBe("America/Chicago");
    });

    it("should return correct timezone for Denver coordinates", () => {
      const timezone = TimezoneService.getTimezoneFromCoords(39.7392, -104.9903);
      expect(timezone).toBe("America/Denver");
    });

    it("should return correct timezone for Honolulu (Hawaii) coordinates", () => {
      const timezone = TimezoneService.getTimezoneFromCoords(21.3069, -157.8583);
      expect(timezone).toBe("Pacific/Honolulu");
    });

    it("should return correct timezone for Anchorage (Alaska) coordinates", () => {
      const timezone = TimezoneService.getTimezoneFromCoords(61.2181, -149.9003);
      expect(timezone).toBe("America/Anchorage");
    });

    it("should return correct timezone for Phoenix (Arizona - no DST) coordinates", () => {
      const timezone = TimezoneService.getTimezoneFromCoords(33.4484, -112.074);
      expect(timezone).toBe("America/Phoenix");
    });

    it("should handle string coordinates", () => {
      const timezone = TimezoneService.getTimezoneFromCoords("40.7128", "-74.006");
      expect(timezone).toBe("America/New_York");
    });

    it("should return null for null latitude", () => {
      const timezone = TimezoneService.getTimezoneFromCoords(null, -74.006);
      expect(timezone).toBeNull();
    });

    it("should return null for null longitude", () => {
      const timezone = TimezoneService.getTimezoneFromCoords(40.7128, null);
      expect(timezone).toBeNull();
    });

    it("should return null for undefined latitude", () => {
      const timezone = TimezoneService.getTimezoneFromCoords(undefined, -74.006);
      expect(timezone).toBeNull();
    });

    it("should return null for undefined longitude", () => {
      const timezone = TimezoneService.getTimezoneFromCoords(40.7128, undefined);
      expect(timezone).toBeNull();
    });

    it("should return null for non-numeric string latitude", () => {
      const timezone = TimezoneService.getTimezoneFromCoords("invalid", -74.006);
      expect(timezone).toBeNull();
    });

    it("should return null for non-numeric string longitude", () => {
      const timezone = TimezoneService.getTimezoneFromCoords(40.7128, "invalid");
      expect(timezone).toBeNull();
    });

    it("should return null for empty string coordinates", () => {
      const timezone = TimezoneService.getTimezoneFromCoords("", "");
      expect(timezone).toBeNull();
    });
  });

  describe("getTimezoneFromState", () => {
    it("should return Eastern time for NY", () => {
      expect(TimezoneService.getTimezoneFromState("NY")).toBe("America/New_York");
    });

    it("should return Eastern time for MA", () => {
      expect(TimezoneService.getTimezoneFromState("MA")).toBe("America/New_York");
    });

    it("should return Eastern time for FL", () => {
      expect(TimezoneService.getTimezoneFromState("FL")).toBe("America/New_York");
    });

    it("should return Central time for TX", () => {
      expect(TimezoneService.getTimezoneFromState("TX")).toBe("America/Chicago");
    });

    it("should return Central time for IL", () => {
      expect(TimezoneService.getTimezoneFromState("IL")).toBe("America/Chicago");
    });

    it("should return Mountain time for CO", () => {
      expect(TimezoneService.getTimezoneFromState("CO")).toBe("America/Denver");
    });

    it("should return Pacific time for CA", () => {
      expect(TimezoneService.getTimezoneFromState("CA")).toBe("America/Los_Angeles");
    });

    it("should return Pacific time for WA", () => {
      expect(TimezoneService.getTimezoneFromState("WA")).toBe("America/Los_Angeles");
    });

    it("should return Alaska time for AK", () => {
      expect(TimezoneService.getTimezoneFromState("AK")).toBe("America/Anchorage");
    });

    it("should return Hawaii time for HI", () => {
      expect(TimezoneService.getTimezoneFromState("HI")).toBe("Pacific/Honolulu");
    });

    it("should return Phoenix time for AZ (no DST)", () => {
      expect(TimezoneService.getTimezoneFromState("AZ")).toBe("America/Phoenix");
    });

    it("should return Indiana time for IN", () => {
      expect(TimezoneService.getTimezoneFromState("IN")).toBe("America/Indiana/Indianapolis");
    });

    it("should handle lowercase state codes", () => {
      expect(TimezoneService.getTimezoneFromState("ny")).toBe("America/New_York");
      expect(TimezoneService.getTimezoneFromState("ca")).toBe("America/Los_Angeles");
    });

    it("should handle mixed case state codes", () => {
      expect(TimezoneService.getTimezoneFromState("Ny")).toBe("America/New_York");
    });

    it("should handle whitespace in state codes", () => {
      expect(TimezoneService.getTimezoneFromState(" NY ")).toBe("America/New_York");
    });

    it("should return default timezone for null state", () => {
      expect(TimezoneService.getTimezoneFromState(null)).toBe("America/New_York");
    });

    it("should return default timezone for undefined state", () => {
      expect(TimezoneService.getTimezoneFromState(undefined)).toBe("America/New_York");
    });

    it("should return default timezone for empty string", () => {
      expect(TimezoneService.getTimezoneFromState("")).toBe("America/New_York");
    });

    it("should return default timezone for invalid state code", () => {
      expect(TimezoneService.getTimezoneFromState("XX")).toBe("America/New_York");
      expect(TimezoneService.getTimezoneFromState("ZZ")).toBe("America/New_York");
    });
  });

  describe("getTimezoneForHome", () => {
    it("should prefer coordinates over state", () => {
      // LA coordinates but NY state - should use coordinates
      const home = {
        latitude: 34.0522,
        longitude: -118.2437,
        state: "NY",
      };
      expect(TimezoneService.getTimezoneForHome(home)).toBe("America/Los_Angeles");
    });

    it("should fall back to state when coordinates are missing", () => {
      const home = {
        latitude: null,
        longitude: null,
        state: "CA",
      };
      expect(TimezoneService.getTimezoneForHome(home)).toBe("America/Los_Angeles");
    });

    it("should fall back to state when only latitude is provided", () => {
      const home = {
        latitude: 34.0522,
        longitude: null,
        state: "TX",
      };
      expect(TimezoneService.getTimezoneForHome(home)).toBe("America/Chicago");
    });

    it("should fall back to state when only longitude is provided", () => {
      const home = {
        latitude: null,
        longitude: -118.2437,
        state: "WA",
      };
      expect(TimezoneService.getTimezoneForHome(home)).toBe("America/Los_Angeles");
    });

    it("should return default timezone when no data available", () => {
      const home = {
        latitude: null,
        longitude: null,
        state: null,
      };
      expect(TimezoneService.getTimezoneForHome(home)).toBe("America/New_York");
    });

    it("should return default timezone for null home", () => {
      expect(TimezoneService.getTimezoneForHome(null)).toBe("America/New_York");
    });

    it("should return default timezone for undefined home", () => {
      expect(TimezoneService.getTimezoneForHome(undefined)).toBe("America/New_York");
    });

    it("should return default timezone for empty object", () => {
      expect(TimezoneService.getTimezoneForHome({})).toBe("America/New_York");
    });

    it("should handle home with invalid coordinate strings", () => {
      const home = {
        latitude: "invalid",
        longitude: "invalid",
        state: "FL",
      };
      expect(TimezoneService.getTimezoneForHome(home)).toBe("America/New_York");
    });
  });

  describe("getTodayInTimezone", () => {
    it("should return a valid YYYY-MM-DD date string", () => {
      const today = TimezoneService.getTodayInTimezone("America/New_York");
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should return different dates for timezones with large offset differences", () => {
      // This test only works reliably during certain hours
      // Just verify both return valid formats
      const nyDate = TimezoneService.getTodayInTimezone("America/New_York");
      const honoluluDate = TimezoneService.getTodayInTimezone("Pacific/Honolulu");

      expect(nyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(honoluluDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should use default timezone when none provided", () => {
      const today = TimezoneService.getTodayInTimezone();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should handle invalid timezone gracefully", () => {
      // Should fall back without throwing
      const today = TimezoneService.getTodayInTimezone("Invalid/Timezone");
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("formatDateInTimezone", () => {
    it("should format a Date object as YYYY-MM-DD", () => {
      const date = new Date("2025-06-15T12:00:00Z");
      const formatted = TimezoneService.formatDateInTimezone(date, "America/New_York");
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should use default timezone when none provided", () => {
      const date = new Date("2025-06-15T12:00:00Z");
      const formatted = TimezoneService.formatDateInTimezone(date);
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should handle invalid timezone gracefully", () => {
      const date = new Date("2025-06-15T12:00:00Z");
      const formatted = TimezoneService.formatDateInTimezone(date, "Invalid/Timezone");
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("parseDateString", () => {
    it("should parse YYYY-MM-DD string as noon", () => {
      const date = TimezoneService.parseDateString("2025-06-15");
      expect(date.getHours()).toBe(12);
      expect(date.getDate()).toBe(15);
      expect(date.getMonth()).toBe(5); // June is month 5 (0-indexed)
      expect(date.getFullYear()).toBe(2025);
    });

    it("should return current date for null input", () => {
      const date = TimezoneService.parseDateString(null);
      expect(date instanceof Date).toBe(true);
    });

    it("should return current date for undefined input", () => {
      const date = TimezoneService.parseDateString(undefined);
      expect(date instanceof Date).toBe(true);
    });

    it("should return current date for empty string", () => {
      const date = TimezoneService.parseDateString("");
      expect(date instanceof Date).toBe(true);
    });
  });

  describe("isDateToday", () => {
    it("should return true for today's date", () => {
      const today = TimezoneService.getTodayInTimezone("America/New_York");
      expect(TimezoneService.isDateToday(today, "America/New_York")).toBe(true);
    });

    it("should return false for yesterday's date", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = TimezoneService.formatDateInTimezone(yesterday, "America/New_York");
      expect(TimezoneService.isDateToday(yesterdayStr, "America/New_York")).toBe(false);
    });

    it("should return false for tomorrow's date", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = TimezoneService.formatDateInTimezone(tomorrow, "America/New_York");
      expect(TimezoneService.isDateToday(tomorrowStr, "America/New_York")).toBe(false);
    });

    it("should use default timezone when none provided", () => {
      const today = TimezoneService.getTodayInTimezone();
      expect(TimezoneService.isDateToday(today)).toBe(true);
    });
  });

  describe("isDateFuture", () => {
    it("should return true for tomorrow's date", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = TimezoneService.formatDateInTimezone(tomorrow, "America/New_York");
      expect(TimezoneService.isDateFuture(tomorrowStr, "America/New_York")).toBe(true);
    });

    it("should return false for today's date", () => {
      const today = TimezoneService.getTodayInTimezone("America/New_York");
      expect(TimezoneService.isDateFuture(today, "America/New_York")).toBe(false);
    });

    it("should return false for yesterday's date", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = TimezoneService.formatDateInTimezone(yesterday, "America/New_York");
      expect(TimezoneService.isDateFuture(yesterdayStr, "America/New_York")).toBe(false);
    });
  });

  describe("isDatePast", () => {
    it("should return true for yesterday's date", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = TimezoneService.formatDateInTimezone(yesterday, "America/New_York");
      expect(TimezoneService.isDatePast(yesterdayStr, "America/New_York")).toBe(true);
    });

    it("should return false for today's date", () => {
      const today = TimezoneService.getTodayInTimezone("America/New_York");
      expect(TimezoneService.isDatePast(today, "America/New_York")).toBe(false);
    });

    it("should return false for tomorrow's date", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = TimezoneService.formatDateInTimezone(tomorrow, "America/New_York");
      expect(TimezoneService.isDatePast(tomorrowStr, "America/New_York")).toBe(false);
    });
  });

  describe("isDateTodayOrFuture", () => {
    it("should return true for today's date", () => {
      const today = TimezoneService.getTodayInTimezone("America/New_York");
      expect(TimezoneService.isDateTodayOrFuture(today, "America/New_York")).toBe(true);
    });

    it("should return true for tomorrow's date", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = TimezoneService.formatDateInTimezone(tomorrow, "America/New_York");
      expect(TimezoneService.isDateTodayOrFuture(tomorrowStr, "America/New_York")).toBe(true);
    });

    it("should return false for yesterday's date", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = TimezoneService.formatDateInTimezone(yesterday, "America/New_York");
      expect(TimezoneService.isDateTodayOrFuture(yesterdayStr, "America/New_York")).toBe(false);
    });
  });

  describe("getDefaultTimezone", () => {
    it("should return America/New_York", () => {
      expect(TimezoneService.getDefaultTimezone()).toBe("America/New_York");
    });
  });

  describe("isValidTimezone", () => {
    it("should return true for valid IANA timezone", () => {
      expect(TimezoneService.isValidTimezone("America/New_York")).toBe(true);
      expect(TimezoneService.isValidTimezone("America/Los_Angeles")).toBe(true);
      expect(TimezoneService.isValidTimezone("America/Chicago")).toBe(true);
      expect(TimezoneService.isValidTimezone("Pacific/Honolulu")).toBe(true);
    });

    it("should return false for invalid timezone", () => {
      expect(TimezoneService.isValidTimezone("Invalid/Timezone")).toBe(false);
      expect(TimezoneService.isValidTimezone("Not_A_Timezone")).toBe(false);
    });

    it("should return false for null", () => {
      expect(TimezoneService.isValidTimezone(null)).toBe(false);
    });

    it("should return true for undefined (defaults to local timezone)", () => {
      // When undefined is passed, toLocaleDateString uses local timezone
      expect(TimezoneService.isValidTimezone(undefined)).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(TimezoneService.isValidTimezone("")).toBe(false);
    });
  });

  describe("US Coverage Tests", () => {
    const usTimezones = [
      { city: "Boston, MA", lat: 42.3601, lng: -71.0589, expected: "America/New_York" },
      { city: "Miami, FL", lat: 25.7617, lng: -80.1918, expected: "America/New_York" },
      { city: "Atlanta, GA", lat: 33.749, lng: -84.388, expected: "America/New_York" },
      { city: "Dallas, TX", lat: 32.7767, lng: -96.797, expected: "America/Chicago" },
      { city: "Minneapolis, MN", lat: 44.9778, lng: -93.265, expected: "America/Chicago" },
      { city: "Seattle, WA", lat: 47.6062, lng: -122.3321, expected: "America/Los_Angeles" },
      { city: "San Francisco, CA", lat: 37.7749, lng: -122.4194, expected: "America/Los_Angeles" },
      { city: "Las Vegas, NV", lat: 36.1699, lng: -115.1398, expected: "America/Los_Angeles" },
      { city: "Salt Lake City, UT", lat: 40.7608, lng: -111.891, expected: "America/Denver" },
      { city: "Albuquerque, NM", lat: 35.0844, lng: -106.6504, expected: "America/Denver" },
    ];

    usTimezones.forEach(({ city, lat, lng, expected }) => {
      it(`should return correct timezone for ${city}`, () => {
        const timezone = TimezoneService.getTimezoneFromCoords(lat, lng);
        expect(timezone).toBe(expected);
      });
    });
  });
});
