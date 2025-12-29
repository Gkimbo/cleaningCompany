/**
 * Tests for PayoutHistory component
 * Tests filtering of payouts, calculation of totals, and proper display of upcoming vs past payouts
 */

describe("PayoutHistory - Payout Filtering", () => {
  // Helper to get today's date at midnight
  const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  // Helper to create a date string (using local time)
  const getDateString = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Mock payout data
  const createMockPayouts = () => [
    // Past payouts
    { id: 1, appointmentDate: getDateString(-5), netAmount: 10000, status: "completed" },
    { id: 2, appointmentDate: getDateString(-3), netAmount: 15000, status: "completed" },
    { id: 3, appointmentDate: getDateString(-1), netAmount: 8000, status: "pending" },
    { id: 4, appointmentDate: getDateString(0), netAmount: 12000, status: "held" }, // Today
    // Future payouts
    { id: 5, appointmentDate: getDateString(1), netAmount: 9000, status: "pending" },
    { id: 6, appointmentDate: getDateString(3), netAmount: 11000, status: "pending" },
    { id: 7, appointmentDate: getDateString(7), netAmount: 13000, status: "pending" },
  ];

  // Filter function from component (using consistent date parsing)
  const filterPayouts = (allPayouts) => {
    const today = getToday();

    const pastPayouts = allPayouts.filter((payout) => {
      const appointmentDate = new Date(payout.appointmentDate + "T00:00:00");
      appointmentDate.setHours(0, 0, 0, 0);
      return appointmentDate <= today;
    });

    const upcomingPayouts = allPayouts.filter((payout) => {
      const appointmentDate = new Date(payout.appointmentDate + "T00:00:00");
      appointmentDate.setHours(0, 0, 0, 0);
      return appointmentDate > today;
    });

    return { pastPayouts, upcomingPayouts };
  };

  describe("Filtering past vs upcoming payouts", () => {
    it("should correctly identify past payouts (including today)", () => {
      const payouts = createMockPayouts();
      const { pastPayouts } = filterPayouts(payouts);

      // Past payouts include: -5 days, -3 days, -1 day, and today (0)
      expect(pastPayouts.length).toBe(4);
      expect(pastPayouts.map((p) => p.id)).toEqual([1, 2, 3, 4]);
    });

    it("should correctly identify upcoming payouts", () => {
      const payouts = createMockPayouts();
      const { upcomingPayouts } = filterPayouts(payouts);

      // Upcoming payouts: +1 day, +3 days, +7 days
      expect(upcomingPayouts.length).toBe(3);
      expect(upcomingPayouts.map((p) => p.id)).toEqual([5, 6, 7]);
    });

    it("should handle empty payouts array", () => {
      const { pastPayouts, upcomingPayouts } = filterPayouts([]);
      expect(pastPayouts).toEqual([]);
      expect(upcomingPayouts).toEqual([]);
    });

    it("should handle all past payouts", () => {
      const pastOnlyPayouts = [
        { id: 1, appointmentDate: getDateString(-5), netAmount: 10000 },
        { id: 2, appointmentDate: getDateString(-3), netAmount: 15000 },
      ];
      const { pastPayouts, upcomingPayouts } = filterPayouts(pastOnlyPayouts);
      expect(pastPayouts.length).toBe(2);
      expect(upcomingPayouts.length).toBe(0);
    });

    it("should handle all upcoming payouts", () => {
      const upcomingOnlyPayouts = [
        { id: 1, appointmentDate: getDateString(1), netAmount: 10000 },
        { id: 2, appointmentDate: getDateString(5), netAmount: 15000 },
      ];
      const { pastPayouts, upcomingPayouts } = filterPayouts(upcomingOnlyPayouts);
      expect(pastPayouts.length).toBe(0);
      expect(upcomingPayouts.length).toBe(2);
    });
  });
});

describe("PayoutHistory - Totals Calculation", () => {
  // Helper to get date string (using local time)
  const getDateString = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Calculate totals function from component (using consistent date parsing)
  const calculateTotals = (allPayouts) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pastPayouts = allPayouts.filter((payout) => {
      const appointmentDate = new Date(payout.appointmentDate + "T00:00:00");
      appointmentDate.setHours(0, 0, 0, 0);
      return appointmentDate <= today;
    });

    const upcomingPayouts = allPayouts.filter((payout) => {
      const appointmentDate = new Date(payout.appointmentDate + "T00:00:00");
      appointmentDate.setHours(0, 0, 0, 0);
      return appointmentDate > today;
    });

    const completedPayouts = pastPayouts.filter((p) => p.status === "completed");
    const totalPaidCents = completedPayouts.reduce((sum, p) => sum + (p.netAmount || 0), 0);
    const pendingCents = upcomingPayouts.reduce((sum, p) => sum + (p.netAmount || 0), 0);

    return {
      totalPaidDollars: (totalPaidCents / 100).toFixed(2),
      pendingAmountDollars: (pendingCents / 100).toFixed(2),
      completedCount: completedPayouts.length,
      pendingCount: upcomingPayouts.length,
    };
  };

  it("should calculate total paid from completed past payouts only", () => {
    const payouts = [
      { id: 1, appointmentDate: getDateString(-5), netAmount: 10000, status: "completed" },
      { id: 2, appointmentDate: getDateString(-3), netAmount: 15000, status: "completed" },
      { id: 3, appointmentDate: getDateString(-1), netAmount: 8000, status: "pending" }, // Not counted
      { id: 4, appointmentDate: getDateString(1), netAmount: 9000, status: "pending" }, // Upcoming
    ];

    const totals = calculateTotals(payouts);

    // Only completed past payouts: $100 + $150 = $250
    expect(totals.totalPaidDollars).toBe("250.00");
    expect(totals.completedCount).toBe(2);
  });

  it("should calculate pending amount from upcoming payouts only", () => {
    const payouts = [
      { id: 1, appointmentDate: getDateString(-3), netAmount: 10000, status: "completed" },
      { id: 2, appointmentDate: getDateString(1), netAmount: 9000, status: "pending" },
      { id: 3, appointmentDate: getDateString(3), netAmount: 11000, status: "pending" },
      { id: 4, appointmentDate: getDateString(7), netAmount: 13000, status: "pending" },
    ];

    const totals = calculateTotals(payouts);

    // Upcoming payouts: $90 + $110 + $130 = $330
    expect(totals.pendingAmountDollars).toBe("330.00");
    expect(totals.pendingCount).toBe(3);
  });

  it("should not include past pending/held payouts in upcoming calculation", () => {
    const payouts = [
      { id: 1, appointmentDate: getDateString(-2), netAmount: 10000, status: "pending" }, // Past - not counted
      { id: 2, appointmentDate: getDateString(-1), netAmount: 15000, status: "held" }, // Past - not counted
      { id: 3, appointmentDate: getDateString(1), netAmount: 8000, status: "pending" }, // Upcoming
    ];

    const totals = calculateTotals(payouts);

    // Only upcoming payout: $80
    expect(totals.pendingAmountDollars).toBe("80.00");
    expect(totals.pendingCount).toBe(1);
  });

  it("should handle zero amounts", () => {
    const payouts = [];
    const totals = calculateTotals(payouts);

    expect(totals.totalPaidDollars).toBe("0.00");
    expect(totals.pendingAmountDollars).toBe("0.00");
    expect(totals.completedCount).toBe(0);
    expect(totals.pendingCount).toBe(0);
  });

  it("should handle payouts with null netAmount", () => {
    const payouts = [
      { id: 1, appointmentDate: getDateString(-3), netAmount: null, status: "completed" },
      { id: 2, appointmentDate: getDateString(1), netAmount: null, status: "pending" },
    ];

    const totals = calculateTotals(payouts);

    expect(totals.totalPaidDollars).toBe("0.00");
    expect(totals.pendingAmountDollars).toBe("0.00");
  });
});

describe("PayoutHistory - Status Badge", () => {
  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { text: "Pending", color: "#FFC107" },
      held: { text: "Held", color: "#2196F3" },
      processing: { text: "Processing", color: "#9C27B0" },
      completed: { text: "Paid", color: "#4CAF50" },
      failed: { text: "Failed", color: "#F44336" },
    };
    return statusConfig[status] || { text: status, color: "#757575" };
  };

  it("should return correct badge for pending status", () => {
    const badge = getStatusBadge("pending");
    expect(badge.text).toBe("Pending");
    expect(badge.color).toBe("#FFC107");
  });

  it("should return correct badge for held status", () => {
    const badge = getStatusBadge("held");
    expect(badge.text).toBe("Held");
    expect(badge.color).toBe("#2196F3");
  });

  it("should return correct badge for processing status", () => {
    const badge = getStatusBadge("processing");
    expect(badge.text).toBe("Processing");
    expect(badge.color).toBe("#9C27B0");
  });

  it("should return correct badge for completed status", () => {
    const badge = getStatusBadge("completed");
    expect(badge.text).toBe("Paid");
    expect(badge.color).toBe("#4CAF50");
  });

  it("should return correct badge for failed status", () => {
    const badge = getStatusBadge("failed");
    expect(badge.text).toBe("Failed");
    expect(badge.color).toBe("#F44336");
  });

  it("should handle unknown status gracefully", () => {
    const badge = getStatusBadge("unknown");
    expect(badge.text).toBe("unknown");
    expect(badge.color).toBe("#757575");
  });
});

describe("PayoutHistory - Date Formatting", () => {
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  it("should format date correctly", () => {
    const result = formatDate("2025-12-25");
    expect(result).toMatch(/Dec/);
    expect(result).toMatch(/25/);
    expect(result).toMatch(/2025/);
  });

  it("should return N/A for null date", () => {
    expect(formatDate(null)).toBe("N/A");
    expect(formatDate(undefined)).toBe("N/A");
    expect(formatDate("")).toBe("N/A");
  });
});

describe("PayoutHistory - Currency Formatting", () => {
  const formatCurrency = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  it("should format cents to dollars correctly", () => {
    expect(formatCurrency(10000)).toBe("$100.00");
    expect(formatCurrency(9999)).toBe("$99.99");
    expect(formatCurrency(50)).toBe("$0.50");
    expect(formatCurrency(1)).toBe("$0.01");
  });

  it("should handle zero cents", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("should handle large amounts", () => {
    expect(formatCurrency(1000000)).toBe("$10000.00");
  });
});
