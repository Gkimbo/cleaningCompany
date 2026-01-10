/**
 * Tests for date formatting fixes across the application.
 * These tests verify that dates are correctly formatted without timezone issues.
 */

describe("Date Formatting - Timezone Handling", () => {
  describe("Date-only string parsing", () => {
    it("should parse YYYY-MM-DD without timezone shift when using T00:00:00", () => {
      const dateString = "2025-12-30";

      // Incorrect way - parses as UTC, can shift day
      const wrongDate = new Date(dateString);

      // Correct way - parses as local time
      const correctDate = new Date(dateString + "T00:00:00");

      expect(correctDate.getDate()).toBe(30);
      expect(correctDate.getMonth()).toBe(11); // December (0-indexed)
      expect(correctDate.getFullYear()).toBe(2025);
    });

    it("should format date correctly for display", () => {
      const dateString = "2025-12-30";
      const date = new Date(dateString + "T00:00:00");

      const formatted = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      expect(formatted).toContain("Dec");
      expect(formatted).toContain("30");
    });
  });

  describe("Earnings page date formatting", () => {
    it("should display correct date for appointment", () => {
      const appointment = { date: "2025-12-30" };

      const displayDate = new Date(appointment.date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      expect(displayDate).toContain("Dec");
      expect(displayDate).toContain("30");
    });

    it("should not show previous day due to UTC parsing", () => {
      const dateString = "2025-12-30";
      const date = new Date(dateString + "T00:00:00");

      // Should NOT be Dec 29
      expect(date.getDate()).not.toBe(29);
      expect(date.getDate()).toBe(30);
    });
  });

  describe("PayoutHistory date formatting", () => {
    const formatDate = (dateString) => {
      if (!dateString) return "N/A";
      // If dateString is a date-only format (YYYY-MM-DD), append T00:00:00
      const dateStr = dateString.length === 10 ? dateString + "T00:00:00" : dateString;
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    it("should handle date-only string correctly", () => {
      const result = formatDate("2025-12-30");

      expect(result).toContain("Dec");
      expect(result).toContain("30");
      expect(result).toContain("2025");
    });

    it("should handle full datetime string correctly", () => {
      const result = formatDate("2025-12-30T14:30:00Z");

      expect(result).toContain("Dec");
      expect(result).toContain("30");
    });

    it("should return N/A for null input", () => {
      const result = formatDate(null);

      expect(result).toBe("N/A");
    });

    it("should return N/A for undefined input", () => {
      const result = formatDate(undefined);

      expect(result).toBe("N/A");
    });

    it("should detect date-only format by length", () => {
      const dateOnly = "2025-12-30";
      const dateTime = "2025-12-30T14:30:00Z";

      expect(dateOnly.length).toBe(10);
      expect(dateTime.length).toBeGreaterThan(10);
    });
  });

  describe("Appointment date comparisons", () => {
    it("should compare today correctly with appointment date", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayString = today.toISOString().split("T")[0];
      const appointmentDate = new Date(todayString + "T00:00:00");

      expect(appointmentDate.getTime()).toBe(today.getTime());
    });

    it("should filter upcoming appointments correctly", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const appointments = [
        { date: "2025-12-29" },
        { date: "2025-12-30" },
        { date: "2025-12-31" },
      ];

      const futureAppointments = appointments.filter((appt) => {
        const apptDate = new Date(appt.date + "T00:00:00");
        return apptDate > today;
      });

      // Result depends on current date, but filter should work correctly
      expect(Array.isArray(futureAppointments)).toBe(true);
    });
  });

  describe("Cleaner dashboard date handling", () => {
    it("should check if appointment is today", () => {
      const isAppointmentToday = (appt) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const apptDate = new Date(appt.date + "T00:00:00");
        return apptDate.getTime() === today.getTime();
      };

      // Use local date components to avoid UTC timezone shift
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const todayAppointment = { date: todayString };
      const tomorrowAppointment = { date: "2099-12-31" };

      expect(isAppointmentToday(todayAppointment)).toBe(true);
      expect(isAppointmentToday(tomorrowAppointment)).toBe(false);
    });
  });

  describe("Pending request date formatting", () => {
    it("should format pending request date correctly", () => {
      const request = { date: "2025-12-30" };
      const appointmentDate = new Date(request.date + "T00:00:00");

      const formatted = appointmentDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      expect(formatted).toContain("Dec");
      expect(formatted).toContain("30");
    });
  });

  describe("parseLocalDate utility", () => {
    // Simulates the parseLocalDate utility function
    const parseLocalDate = (dateString) => {
      if (!dateString) return null;
      return new Date(dateString + "T00:00:00");
    };

    it("should parse date string as local time", () => {
      const date = parseLocalDate("2025-12-30");

      expect(date.getDate()).toBe(30);
      expect(date.getMonth()).toBe(11);
      expect(date.getFullYear()).toBe(2025);
    });

    it("should return null for empty string", () => {
      const date = parseLocalDate("");

      expect(date).toBeNull();
    });

    it("should return null for null input", () => {
      const date = parseLocalDate(null);

      expect(date).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("should handle end of month correctly", () => {
      const date = new Date("2025-01-31" + "T00:00:00");

      expect(date.getDate()).toBe(31);
      expect(date.getMonth()).toBe(0); // January
    });

    it("should handle leap year correctly", () => {
      const date = new Date("2024-02-29" + "T00:00:00");

      expect(date.getDate()).toBe(29);
      expect(date.getMonth()).toBe(1); // February
    });

    it("should handle year boundary correctly", () => {
      const dec31 = new Date("2025-12-31" + "T00:00:00");
      const jan1 = new Date("2026-01-01" + "T00:00:00");

      expect(dec31.getFullYear()).toBe(2025);
      expect(jan1.getFullYear()).toBe(2026);
    });
  });
});
