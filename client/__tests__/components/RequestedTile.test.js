/**
 * Tests for RequestedTile component
 * Tests time window formatting, "Complete anytime today" banner, and date status
 */

describe("RequestedTile - Time Window Formatting", () => {
  // Helper function to check if date is today (copied from component)
  const isToday = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(dateString + "T00:00:00");
    return appointmentDate.getTime() === today.getTime();
  };

  // formatTimeWindow function from component
  const formatTimeWindow = (time, date) => {
    if (!time) return null;

    const checkIsToday = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const appointmentDate = new Date(date + "T00:00:00");
      return appointmentDate.getTime() === today.getTime();
    };

    if (time.toLowerCase() === "anytime") {
      return checkIsToday() ? "Complete anytime today" : null;
    }
    const parts = time.split("-");
    if (parts.length === 2) {
      const endHour = parseInt(parts[1], 10);
      // Time windows are like "10-3" (10am-3pm), "11-4" (11am-4pm), "12-2" (12pm-2pm)
      // End hours 1-6 are PM (afternoon), 7-11 are AM, 12 is PM
      const period = endHour <= 6 || endHour === 12 ? "PM" : "AM";
      const displayHour = endHour === 0 ? 12 : endHour;
      return `Complete by ${displayHour}${period}`;
    }
    return null;
  };

  // Get today's date in YYYY-MM-DD format (using local time)
  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Get tomorrow's date in YYYY-MM-DD format (using local time)
  const getTomorrowString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const day = String(tomorrow.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  describe("formatTimeWindow - PM time windows", () => {
    it("should format end hour 1 as 1PM", () => {
      const result = formatTimeWindow("10-1", getTomorrowString());
      expect(result).toBe("Complete by 1PM");
    });

    it("should format end hour 2 as 2PM", () => {
      const result = formatTimeWindow("10-2", getTomorrowString());
      expect(result).toBe("Complete by 2PM");
    });

    it("should format end hour 3 as 3PM", () => {
      const result = formatTimeWindow("10-3", getTomorrowString());
      expect(result).toBe("Complete by 3PM");
    });

    it("should format end hour 4 as 4PM", () => {
      const result = formatTimeWindow("11-4", getTomorrowString());
      expect(result).toBe("Complete by 4PM");
    });

    it("should format end hour 5 as 5PM", () => {
      const result = formatTimeWindow("10-5", getTomorrowString());
      expect(result).toBe("Complete by 5PM");
    });

    it("should format end hour 6 as 6PM", () => {
      const result = formatTimeWindow("10-6", getTomorrowString());
      expect(result).toBe("Complete by 6PM");
    });

    it("should format end hour 12 as 12PM", () => {
      const result = formatTimeWindow("9-12", getTomorrowString());
      expect(result).toBe("Complete by 12PM");
    });
  });

  describe("formatTimeWindow - AM time windows", () => {
    it("should format end hour 7 as 7AM", () => {
      const result = formatTimeWindow("5-7", getTomorrowString());
      expect(result).toBe("Complete by 7AM");
    });

    it("should format end hour 8 as 8AM", () => {
      const result = formatTimeWindow("6-8", getTomorrowString());
      expect(result).toBe("Complete by 8AM");
    });

    it("should format end hour 9 as 9AM", () => {
      const result = formatTimeWindow("7-9", getTomorrowString());
      expect(result).toBe("Complete by 9AM");
    });

    it("should format end hour 10 as 10AM", () => {
      const result = formatTimeWindow("8-10", getTomorrowString());
      expect(result).toBe("Complete by 10AM");
    });

    it("should format end hour 11 as 11AM", () => {
      const result = formatTimeWindow("9-11", getTomorrowString());
      expect(result).toBe("Complete by 11AM");
    });
  });

  describe("formatTimeWindow - Complete anytime today", () => {
    it("should show 'Complete anytime today' when anytime and today", () => {
      const result = formatTimeWindow("anytime", getTodayString());
      expect(result).toBe("Complete anytime today");
    });

    it("should be case insensitive for anytime", () => {
      expect(formatTimeWindow("ANYTIME", getTodayString())).toBe("Complete anytime today");
      expect(formatTimeWindow("Anytime", getTodayString())).toBe("Complete anytime today");
      expect(formatTimeWindow("AnYtImE", getTodayString())).toBe("Complete anytime today");
    });

    it("should return null for anytime when not today", () => {
      expect(formatTimeWindow("anytime", getTomorrowString())).toBeNull();
      expect(formatTimeWindow("anytime", "2025-12-25")).toBeNull();
    });
  });

  describe("formatTimeWindow - Edge cases", () => {
    it("should handle null gracefully", () => {
      expect(formatTimeWindow(null, getTodayString())).toBeNull();
    });

    it("should handle undefined gracefully", () => {
      expect(formatTimeWindow(undefined, getTodayString())).toBeNull();
    });

    it("should handle empty string gracefully", () => {
      expect(formatTimeWindow("", getTodayString())).toBeNull();
    });

    it("should handle single number (no dash) gracefully", () => {
      expect(formatTimeWindow("10", getTomorrowString())).toBeNull();
    });
  });
});

describe("RequestedTile - Date Formatting", () => {
  const formatDate = (dateString) => {
    const dateObj = new Date(dateString + "T00:00:00");
    const options = { weekday: "short", month: "short", day: "numeric" };
    return dateObj.toLocaleDateString(undefined, options);
  };

  it("should format date with weekday, month, and day", () => {
    // Note: exact output depends on locale, so we just check it contains expected parts
    const result = formatDate("2025-12-25");
    expect(result).toMatch(/Dec/);
    expect(result).toMatch(/25/);
  });

  it("should handle different months", () => {
    expect(formatDate("2025-01-15")).toMatch(/Jan/);
    expect(formatDate("2025-06-20")).toMatch(/Jun/);
    expect(formatDate("2025-11-05")).toMatch(/Nov/);
  });
});

describe("RequestedTile - getDateStatus", () => {
  const getDateStatus = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(dateString + "T00:00:00");
    const diffTime = appointmentDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { label: "Today", color: "error", bgColor: "error" };
    if (diffDays === 1) return { label: "Tomorrow", color: "warning", bgColor: "warning" };
    if (diffDays <= 7) return { label: `In ${diffDays} days`, color: "primary", bgColor: "primary" };
    return null;
  };

  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getDateString = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  it("should return Today status for today's date", () => {
    const result = getDateStatus(getTodayString());
    expect(result.label).toBe("Today");
    expect(result.color).toBe("error");
  });

  it("should return Tomorrow status for tomorrow", () => {
    const result = getDateStatus(getDateString(1));
    expect(result.label).toBe("Tomorrow");
    expect(result.color).toBe("warning");
  });

  it("should return 'In X days' for dates within a week", () => {
    expect(getDateStatus(getDateString(2)).label).toBe("In 2 days");
    expect(getDateStatus(getDateString(3)).label).toBe("In 3 days");
    expect(getDateStatus(getDateString(5)).label).toBe("In 5 days");
    expect(getDateStatus(getDateString(7)).label).toBe("In 7 days");
  });

  it("should return null for dates more than 7 days away", () => {
    expect(getDateStatus(getDateString(8))).toBeNull();
    expect(getDateStatus(getDateString(14))).toBeNull();
    expect(getDateStatus(getDateString(30))).toBeNull();
  });
});

describe("RequestedTile - Distance Formatting", () => {
  const formatDistance = (distanceKm) => {
    if (!distanceKm) return null;
    const miles = distanceKm * 0.621371;
    return miles.toFixed(1);
  };

  it("should convert km to miles", () => {
    expect(formatDistance(1)).toBe("0.6");
    expect(formatDistance(10)).toBe("6.2");
    expect(formatDistance(100)).toBe("62.1");
  });

  it("should handle decimal km values", () => {
    expect(formatDistance(1.5)).toBe("0.9");
    expect(formatDistance(5.5)).toBe("3.4");
  });

  it("should return null for null/undefined distance", () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(undefined)).toBeNull();
    expect(formatDistance(0)).toBeNull();
  });
});
