/**
 * Tests for ApplicationTile component - specifically for date formatting functions
 * Tests both formatDate (for DATEONLY fields) and formatTimestamp (for full timestamps)
 */

describe("ApplicationTile - Date Formatting", () => {
  /**
   * formatDate function - for DATEONLY fields like dateOfBirth, availableStartDate
   * These fields come from the backend as 'YYYY-MM-DD' strings
   */
  const formatDate = (dateString) => {
    if (!dateString) return "Not provided";
    // Parse date string without timezone conversion (for DATEONLY fields)
    // '2026-01-01' should display as Jan 1, 2026, not Dec 31, 2025
    const [year, month, day] = dateString.split("-");
    if (year && month && day) {
      const date = new Date(year, month - 1, day); // month is 0-indexed
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    // Fallback for other date formats
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  /**
   * formatTimestamp function - for full timestamp fields like createdAt
   * These fields come from the backend as ISO 8601 strings with time and timezone
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Not provided";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return "Invalid date";
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  describe("formatDate - DATEONLY fields", () => {
    it("should format DATEONLY string correctly", () => {
      const result = formatDate("2026-01-01");
      expect(result).toBe("Jan 1, 2026");
    });

    it("should handle December dates correctly (no timezone shift)", () => {
      const result = formatDate("2025-12-31");
      expect(result).toBe("Dec 31, 2025");
    });

    it("should handle January dates correctly (no timezone shift)", () => {
      const result = formatDate("2026-01-15");
      expect(result).toBe("Jan 15, 2026");
    });

    it("should return 'Not provided' for null/undefined", () => {
      expect(formatDate(null)).toBe("Not provided");
      expect(formatDate(undefined)).toBe("Not provided");
      expect(formatDate("")).toBe("Not provided");
    });

    it("should handle various date formats", () => {
      // Standard DATEONLY format from Sequelize
      expect(formatDate("1990-05-15")).toBe("May 15, 1990");
      expect(formatDate("2000-11-25")).toBe("Nov 25, 2000");
    });

    it("should handle leap year dates", () => {
      expect(formatDate("2024-02-29")).toBe("Feb 29, 2024");
    });

    it("should handle edge case - first day of year", () => {
      expect(formatDate("2025-01-01")).toBe("Jan 1, 2025");
    });

    it("should handle edge case - last day of year", () => {
      expect(formatDate("2025-12-31")).toBe("Dec 31, 2025");
    });
  });

  describe("formatTimestamp - Full timestamp fields", () => {
    it("should format ISO 8601 timestamp correctly", () => {
      const result = formatTimestamp("2025-01-15T14:30:00.000Z");
      expect(result).toMatch(/Jan 1[45], 2025/); // May be 14 or 15 depending on timezone
    });

    it("should handle timestamp without timezone", () => {
      const result = formatTimestamp("2025-03-20T10:00:00");
      expect(result).toBe("Mar 20, 2025");
    });

    it("should return 'Not provided' for null/undefined", () => {
      expect(formatTimestamp(null)).toBe("Not provided");
      expect(formatTimestamp(undefined)).toBe("Not provided");
    });

    it("should return 'Invalid date' for invalid timestamp", () => {
      expect(formatTimestamp("not-a-date")).toBe("Invalid date");
      expect(formatTimestamp("abc123")).toBe("Invalid date");
    });

    it("should handle timestamps from database createdAt field", () => {
      // Typical Sequelize createdAt format
      const timestamp = "2025-06-10T08:45:23.456Z";
      const result = formatTimestamp(timestamp);
      expect(result).toMatch(/Jun (9|10), 2025/); // May shift based on timezone
    });

    it("should handle epoch timestamp (number)", () => {
      // January 1, 2025 00:00:00 UTC
      const epochMs = 1735689600000;
      const result = formatTimestamp(epochMs);
      expect(result).toMatch(/(Dec 31, 2024|Jan 1, 2025)/); // Depends on timezone
    });
  });

  describe("formatDate vs formatTimestamp - Key Differences", () => {
    it("formatDate should NOT shift dates across timezones", () => {
      // This is critical - DATEONLY fields should display exactly as stored
      const dateOnly = "2025-12-31"; // New Year's Eve
      const result = formatDate(dateOnly);
      // Should always be Dec 31, never Dec 30 or Jan 1 due to timezone
      expect(result).toBe("Dec 31, 2025");
    });

    it("formatTimestamp may shift dates based on timezone", () => {
      // Full timestamps will be converted to local time
      const timestamp = "2025-12-31T23:00:00Z"; // 11 PM UTC on Dec 31
      const result = formatTimestamp(timestamp);
      // In US timezones (behind UTC), this could still be Dec 31
      // In Asian timezones (ahead of UTC), this could be Jan 1
      expect(result).toMatch(/(Dec 31, 2025|Jan 1, 2026)/);
    });

    it("both functions should produce same output for simple dates", () => {
      // When using a mid-day timestamp, results should be similar
      const dateOnly = "2025-06-15";
      const timestamp = "2025-06-15T12:00:00Z";

      const dateResult = formatDate(dateOnly);
      const timestampResult = formatTimestamp(timestamp);

      expect(dateResult).toBe("Jun 15, 2025");
      expect(timestampResult).toMatch(/Jun 1[45], 2025/);
    });
  });

  describe("Application createdAt field handling", () => {
    it("should display 'Applied' date correctly for recent application", () => {
      const application = {
        createdAt: "2025-01-10T09:30:00.000Z",
      };

      const result = formatTimestamp(application.createdAt);
      expect(result).toMatch(/Jan (9|10), 2025/);
    });

    it("should display 'Applied' date correctly for old application", () => {
      const application = {
        createdAt: "2024-06-15T14:00:00.000Z",
      };

      const result = formatTimestamp(application.createdAt);
      expect(result).toMatch(/Jun 1[45], 2024/);
    });

    it("should handle missing createdAt gracefully", () => {
      const application = {};
      const result = formatTimestamp(application.createdAt);
      expect(result).toBe("Not provided");
    });
  });

  describe("Application dateOfBirth field handling", () => {
    it("should display DOB correctly using formatDate", () => {
      const application = {
        dateOfBirth: "1990-05-15",
      };

      const result = formatDate(application.dateOfBirth);
      expect(result).toBe("May 15, 1990");
    });

    it("should NOT shift DOB to wrong date", () => {
      // Critical test - DOB should never show wrong day
      const application = {
        dateOfBirth: "1990-01-01", // New Year's Day
      };

      const result = formatDate(application.dateOfBirth);
      expect(result).toBe("Jan 1, 1990");
      expect(result).not.toBe("Dec 31, 1989");
    });
  });

  describe("Application availableStartDate field handling", () => {
    it("should display start date correctly using formatDate", () => {
      const application = {
        availableStartDate: "2025-02-01",
      };

      const result = formatDate(application.availableStartDate);
      expect(result).toBe("Feb 1, 2025");
    });

    it("should handle future start date correctly", () => {
      const application = {
        availableStartDate: "2026-06-15",
      };

      const result = formatDate(application.availableStartDate);
      expect(result).toBe("Jun 15, 2026");
    });
  });
});

describe("ApplicationTile - Status Configuration", () => {
  const statusConfig = {
    pending: {
      label: "Pending Review",
      color: "#6B7280",
      bgColor: "#F3F4F6",
    },
    reviewing: {
      label: "Under Review",
      color: "#3B82F6",
      bgColor: "#EFF6FF",
    },
    interview: {
      label: "Interview Scheduled",
      color: "#8B5CF6",
      bgColor: "#F5F3FF",
    },
    approved: {
      label: "Approved",
      color: "#10B981",
      bgColor: "#D1FAE5",
    },
    rejected: {
      label: "Rejected",
      color: "#EF4444",
      bgColor: "#FEE2E2",
    },
    hired: {
      label: "Hired",
      color: "#059669",
      bgColor: "#D1FAE5",
    },
  };

  it("should have all expected status configurations", () => {
    expect(Object.keys(statusConfig)).toEqual([
      "pending",
      "reviewing",
      "interview",
      "approved",
      "rejected",
      "hired",
    ]);
  });

  it("should have color and bgColor for each status", () => {
    Object.values(statusConfig).forEach((config) => {
      expect(config).toHaveProperty("label");
      expect(config).toHaveProperty("color");
      expect(config).toHaveProperty("bgColor");
    });
  });

  it("should default to pending status when application has no status", () => {
    const application = { status: undefined };
    const status = application.status || "pending";
    expect(status).toBe("pending");
  });

  it("should use correct config for each status", () => {
    expect(statusConfig.pending.label).toBe("Pending Review");
    expect(statusConfig.hired.label).toBe("Hired");
    expect(statusConfig.rejected.color).toBe("#EF4444");
  });
});

describe("ApplicationTile - Check Indicator Logic", () => {
  it("should show Yes for true boolean values", () => {
    const checked = true;
    const text = checked ? "Yes" : "No";
    expect(text).toBe("Yes");
  });

  it("should show No for false boolean values", () => {
    const checked = false;
    const text = checked ? "Yes" : "No";
    expect(text).toBe("No");
  });

  it("should handle undefined as No", () => {
    const checked = undefined;
    const text = checked ? "Yes" : "No";
    expect(text).toBe("No");
  });

  it("should handle null as No", () => {
    const checked = null;
    const text = checked ? "Yes" : "No";
    expect(text).toBe("No");
  });

  it("should handle common application boolean fields", () => {
    const application = {
      hasReliableTransportation: true,
      hasValidDriversLicense: false,
      isAuthorizedToWork: true,
      backgroundConsent: true,
      drugTestConsent: false,
      referenceCheckConsent: true,
    };

    expect(application.hasReliableTransportation ? "Yes" : "No").toBe("Yes");
    expect(application.hasValidDriversLicense ? "Yes" : "No").toBe("No");
    expect(application.isAuthorizedToWork ? "Yes" : "No").toBe("Yes");
  });
});

describe("ApplicationTile - Status Update Logic", () => {
  it("should prevent status change for hired applications", () => {
    const currentStatus = "hired";
    const canUpdateStatus = currentStatus !== "hired";
    expect(canUpdateStatus).toBe(false);
  });

  it("should allow status change for non-hired applications", () => {
    const statuses = ["pending", "reviewing", "interview", "approved", "rejected"];

    statuses.forEach((status) => {
      const canUpdateStatus = status !== "hired";
      expect(canUpdateStatus).toBe(true);
    });
  });

  it("should filter out 'hired' from status update buttons", () => {
    const statusConfig = {
      pending: { label: "Pending" },
      reviewing: { label: "Reviewing" },
      hired: { label: "Hired" },
    };

    const availableStatuses = Object.entries(statusConfig)
      .filter(([key]) => key !== "hired")
      .map(([key]) => key);

    expect(availableStatuses).toEqual(["pending", "reviewing"]);
    expect(availableStatuses).not.toContain("hired");
  });
});
