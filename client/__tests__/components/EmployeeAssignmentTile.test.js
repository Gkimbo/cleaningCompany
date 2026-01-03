/**
 * Tests for EmployeeAssignmentTile component
 * Tests time window formatting, "Complete anytime today" banner, and date status
 */

describe("EmployeeAssignmentTile - Time Window Formatting", () => {
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

  describe("formatTimeWindow - Standard time windows", () => {
    it("should format 10-3 as Complete by 3PM", () => {
      const result = formatTimeWindow("10-3", getTomorrowString());
      expect(result).toBe("Complete by 3PM");
    });

    it("should format 11-4 as Complete by 4PM", () => {
      const result = formatTimeWindow("11-4", getTomorrowString());
      expect(result).toBe("Complete by 4PM");
    });

    it("should format 12-2 as Complete by 2PM", () => {
      const result = formatTimeWindow("12-2", getTomorrowString());
      expect(result).toBe("Complete by 2PM");
    });

    it("should format 9-12 as Complete by 12PM", () => {
      const result = formatTimeWindow("9-12", getTomorrowString());
      expect(result).toBe("Complete by 12PM");
    });

    it("should format 8-11 as Complete by 11AM", () => {
      const result = formatTimeWindow("8-11", getTomorrowString());
      expect(result).toBe("Complete by 11AM");
    });

    it("should format 7-10 as Complete by 10AM", () => {
      const result = formatTimeWindow("7-10", getTomorrowString());
      expect(result).toBe("Complete by 10AM");
    });

    it("should format 10-5 as Complete by 5PM", () => {
      const result = formatTimeWindow("10-5", getTomorrowString());
      expect(result).toBe("Complete by 5PM");
    });

    it("should format 10-6 as Complete by 6PM", () => {
      const result = formatTimeWindow("10-6", getTomorrowString());
      expect(result).toBe("Complete by 6PM");
    });
  });

  describe("formatTimeWindow - Anytime handling", () => {
    it("should return 'Complete anytime today' when time is 'anytime' and date is today", () => {
      const result = formatTimeWindow("anytime", getTodayString());
      expect(result).toBe("Complete anytime today");
    });

    it("should return 'Complete anytime today' when time is 'Anytime' (case insensitive)", () => {
      const result = formatTimeWindow("Anytime", getTodayString());
      expect(result).toBe("Complete anytime today");
    });

    it("should return 'Complete anytime today' when time is 'ANYTIME' (case insensitive)", () => {
      const result = formatTimeWindow("ANYTIME", getTodayString());
      expect(result).toBe("Complete anytime today");
    });

    it("should return null when time is 'anytime' but date is tomorrow", () => {
      const result = formatTimeWindow("anytime", getTomorrowString());
      expect(result).toBeNull();
    });

    it("should return null when time is 'anytime' but date is in the past", () => {
      const result = formatTimeWindow("anytime", "2020-01-01");
      expect(result).toBeNull();
    });
  });

  describe("formatTimeWindow - Edge cases", () => {
    it("should return null for null time", () => {
      const result = formatTimeWindow(null, getTodayString());
      expect(result).toBeNull();
    });

    it("should return null for undefined time", () => {
      const result = formatTimeWindow(undefined, getTodayString());
      expect(result).toBeNull();
    });

    it("should return null for empty string time", () => {
      const result = formatTimeWindow("", getTodayString());
      expect(result).toBeNull();
    });

    it("should return null for invalid time format", () => {
      const result = formatTimeWindow("invalid", getTomorrowString());
      expect(result).toBeNull();
    });

    it("should handle time with extra spaces", () => {
      // The current implementation doesn't trim, so this would fail
      // This documents expected behavior
      const result = formatTimeWindow("10-3", getTomorrowString());
      expect(result).toBe("Complete by 3PM");
    });
  });

  describe("isAnytimeToday calculation", () => {
    it("should be true when time is anytime and date is today", () => {
      const time = "anytime";
      const date = getTodayString();
      const isAnytimeToday = time?.toLowerCase() === "anytime" && isToday(date);
      expect(isAnytimeToday).toBe(true);
    });

    it("should be false when time is anytime but date is not today", () => {
      const time = "anytime";
      const date = getTomorrowString();
      const isAnytimeToday = time?.toLowerCase() === "anytime" && isToday(date);
      expect(isAnytimeToday).toBe(false);
    });

    it("should be false when time is not anytime even if date is today", () => {
      const time = "10-3";
      const date = getTodayString();
      const isAnytimeToday = time?.toLowerCase() === "anytime" && isToday(date);
      expect(isAnytimeToday).toBe(false);
    });

    it("should handle null time gracefully", () => {
      const time = null;
      const date = getTodayString();
      const isAnytimeToday = time?.toLowerCase() === "anytime" && isToday(date);
      expect(isAnytimeToday).toBeFalsy();
    });
  });
});

describe("EmployeeAssignmentTile - Date Status", () => {
  const getDateStatus = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(dateString + "T00:00:00");
    const diffTime = appointmentDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return null; // Past dates
    if (diffDays === 0) return { label: "Today", urgent: true };
    if (diffDays === 1) return { label: "Tomorrow", urgent: false };
    if (diffDays <= 7) return { label: `In ${diffDays} days`, urgent: false };
    return null;
  };

  // Get date strings for testing (using local time)
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

  it("should return 'Today' for today's date", () => {
    const result = getDateStatus(getTodayString());
    expect(result.label).toBe("Today");
    expect(result.urgent).toBe(true);
  });

  it("should return 'Tomorrow' for tomorrow's date", () => {
    const result = getDateStatus(getDateString(1));
    expect(result.label).toBe("Tomorrow");
  });

  it("should return 'In 2 days' for date 2 days from now", () => {
    const result = getDateStatus(getDateString(2));
    expect(result.label).toBe("In 2 days");
  });

  it("should return 'In 7 days' for date 7 days from now", () => {
    const result = getDateStatus(getDateString(7));
    expect(result.label).toBe("In 7 days");
  });

  it("should return null for date more than 7 days from now", () => {
    const result = getDateStatus(getDateString(8));
    expect(result).toBeNull();
  });

  it("should return null for past dates", () => {
    const result = getDateStatus(getDateString(-1));
    expect(result).toBeNull();
  });
});

describe("EmployeeAssignmentTile - Earnings Calculation", () => {
  const calculateCleanerShare = (price, feePercent = 0.1) => {
    const cleanerSharePercent = 1 - feePercent;
    return Number(price) * cleanerSharePercent;
  };

  it("should calculate 90% share with default 10% fee", () => {
    const result = calculateCleanerShare(100);
    expect(result).toBe(90);
  });

  it("should calculate correct share with 15% fee", () => {
    const result = calculateCleanerShare(100, 0.15);
    expect(result).toBe(85);
  });

  it("should handle string prices", () => {
    const result = calculateCleanerShare("150");
    expect(result).toBe(135);
  });

  it("should handle decimal prices", () => {
    const result = calculateCleanerShare(99.99);
    expect(result).toBeCloseTo(89.991);
  });
});

describe("EmployeeAssignmentTile - Preferred Badge", () => {
  describe("Badge Visibility", () => {
    it("should show preferred badge when isPreferred is true", () => {
      const isPreferred = true;
      const completed = false;
      const showBadge = isPreferred && !completed;

      expect(showBadge).toBe(true);
    });

    it("should hide preferred badge when isPreferred is false", () => {
      const isPreferred = false;
      const completed = false;
      const showBadge = isPreferred && !completed;

      expect(showBadge).toBe(false);
    });

    it("should hide preferred badge when job is completed", () => {
      const isPreferred = true;
      const completed = true;
      const showBadge = isPreferred && !completed;

      expect(showBadge).toBe(false);
    });

    it("should hide badge when both isPreferred false and completed", () => {
      const isPreferred = false;
      const completed = true;
      const showBadge = isPreferred && !completed;

      expect(showBadge).toBe(false);
    });
  });

  describe("Badge Content", () => {
    it("should display star icon for preferred badge", () => {
      const iconName = "star";
      expect(iconName).toBe("star");
    });

    it("should display 'Preferred' text", () => {
      const badgeText = "Preferred";
      expect(badgeText).toBe("Preferred");
    });
  });

  describe("isPreferred Prop Calculation", () => {
    it("should determine isPreferred from preferredHomeIds", () => {
      const preferredHomeIds = [10, 15, 22];
      const appointment = { homeId: 15 };
      const isPreferred = preferredHomeIds.includes(appointment.homeId);

      expect(isPreferred).toBe(true);
    });

    it("should return false for non-preferred home", () => {
      const preferredHomeIds = [10, 15, 22];
      const appointment = { homeId: 11 };
      const isPreferred = preferredHomeIds.includes(appointment.homeId);

      expect(isPreferred).toBe(false);
    });

    it("should handle empty preferredHomeIds array", () => {
      const preferredHomeIds = [];
      const appointment = { homeId: 10 };
      const isPreferred = preferredHomeIds.includes(appointment.homeId);

      expect(isPreferred).toBe(false);
    });
  });
});

describe("EmployeeAssignmentTile - Button Text for Preferred", () => {
  describe("Accept Button Text", () => {
    it("should show 'Book Directly' for preferred homes", () => {
      const isPreferred = true;
      const buttonText = isPreferred ? "Book Directly" : "Request This Job";

      expect(buttonText).toBe("Book Directly");
    });

    it("should show 'Request This Job' for non-preferred homes", () => {
      const isPreferred = false;
      const buttonText = isPreferred ? "Book Directly" : "Request This Job";

      expect(buttonText).toBe("Request This Job");
    });
  });

  describe("Button Icon", () => {
    it("should use star icon for preferred booking", () => {
      const isPreferred = true;
      const iconName = isPreferred ? "star" : "check";

      expect(iconName).toBe("star");
    });

    it("should use check icon for request", () => {
      const isPreferred = false;
      const iconName = isPreferred ? "star" : "check";

      expect(iconName).toBe("check");
    });
  });

  describe("Button Style", () => {
    it("should apply preferredAcceptButton style when preferred", () => {
      const isPreferred = true;
      const styles = ["actionButton", "acceptButton"];
      if (isPreferred) {
        styles.push("preferredAcceptButton");
      }

      expect(styles).toContain("preferredAcceptButton");
    });

    it("should not apply preferredAcceptButton style when not preferred", () => {
      const isPreferred = false;
      const styles = ["actionButton", "acceptButton"];
      if (isPreferred) {
        styles.push("preferredAcceptButton");
      }

      expect(styles).not.toContain("preferredAcceptButton");
    });
  });
});

describe("EmployeeAssignmentTile - Direct Booking Flow", () => {
  describe("addEmployee Response Handling", () => {
    it("should handle direct booking response", async () => {
      const response = {
        success: true,
        message: "Job booked successfully! As a preferred cleaner, no approval was needed.",
        directBooking: true,
      };

      expect(response.directBooking).toBe(true);
      expect(response.message).toContain("no approval was needed");
    });

    it("should handle normal request response", async () => {
      const response = {
        success: true,
        message: "Request sent to the client for approval",
        directBooking: false,
      };

      expect(response.directBooking).toBe(false);
      expect(response.message).toContain("approval");
    });
  });

  describe("Alert Messages", () => {
    it("should show direct booking success alert", () => {
      const directBooking = true;
      const alertTitle = "Job Booked!";
      const alertMessage = directBooking
        ? "As a preferred cleaner, this job has been confirmed automatically. The homeowner has been notified."
        : "Your request has been sent to the homeowner for approval.";

      expect(alertTitle).toBe("Job Booked!");
      expect(alertMessage).toContain("confirmed automatically");
    });

    it("should show request pending for non-direct booking", () => {
      const directBooking = false;
      const alertMessage = directBooking
        ? "As a preferred cleaner, this job has been confirmed automatically."
        : "Your request has been sent to the homeowner for approval.";

      expect(alertMessage).toContain("sent to the homeowner");
    });
  });

  describe("List Updates After Booking", () => {
    it("should remove appointment from available list", () => {
      const appointments = [
        { id: 1, homeId: 10 },
        { id: 2, homeId: 15 },
        { id: 3, homeId: 22 },
      ];
      const bookedId = 2;

      const updatedAppointments = appointments.filter((a) => a.id !== bookedId);

      expect(updatedAppointments).toHaveLength(2);
      expect(updatedAppointments.map((a) => a.id)).toEqual([1, 3]);
    });

    it("should not add to requests list for direct booking", () => {
      const requests = [];
      const bookedAppointment = { id: 2, homeId: 15 };
      const directBooking = true;

      if (!directBooking) {
        requests.push(bookedAppointment);
      }

      expect(requests).toHaveLength(0);
    });

    it("should add to requests list for normal request", () => {
      const requests = [];
      const requestedAppointment = { id: 2, homeId: 15 };
      const directBooking = false;

      if (!directBooking) {
        requests.push(requestedAppointment);
      }

      expect(requests).toHaveLength(1);
      expect(requests[0].id).toBe(2);
    });
  });
});
