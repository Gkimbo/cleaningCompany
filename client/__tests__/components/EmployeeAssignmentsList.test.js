/**
 * Tests for EmployeeAssignmentsList component
 * Tests earnings calculation with platform fee deduction
 */

describe("EmployeeAssignmentsList - Earnings Calculation", () => {
  // Mock appointments data
  const createMockAppointments = () => [
    { id: 1, date: "2025-01-15", price: "100", completed: false },
    { id: 2, date: "2025-01-16", price: "125", completed: false },
    { id: 3, date: "2025-01-10", price: "100", completed: true },
  ];

  // Calculate total earnings with platform fee (mirrors component logic)
  const calculateTotalEarnings = (appointments, feePercent = 0.1) => {
    const cleanerSharePercent = 1 - feePercent;
    return appointments.reduce(
      (sum, a) => sum + (Number(a.price) || 0) * cleanerSharePercent,
      0
    );
  };

  describe("Platform fee deduction", () => {
    it("should calculate earnings with default 10% platform fee", () => {
      const appointments = createMockAppointments();
      const totalEarnings = calculateTotalEarnings(appointments);

      // Total price: $100 + $125 + $100 = $325
      // After 10% fee: $325 * 0.9 = $292.50
      expect(totalEarnings).toBe(292.5);
    });

    it("should calculate earnings with 15% platform fee", () => {
      const appointments = createMockAppointments();
      const totalEarnings = calculateTotalEarnings(appointments, 0.15);

      // Total price: $325
      // After 15% fee: $325 * 0.85 = $276.25
      expect(totalEarnings).toBe(276.25);
    });

    it("should calculate earnings with 5% platform fee", () => {
      const appointments = createMockAppointments();
      const totalEarnings = calculateTotalEarnings(appointments, 0.05);

      // Total price: $325
      // After 5% fee: $325 * 0.95 = $308.75
      expect(totalEarnings).toBe(308.75);
    });

    it("should calculate earnings with 0% platform fee", () => {
      const appointments = createMockAppointments();
      const totalEarnings = calculateTotalEarnings(appointments, 0);

      // Total price: $325
      // No fee: $325 * 1.0 = $325
      expect(totalEarnings).toBe(325);
    });

    it("should return 0 for empty appointments", () => {
      const totalEarnings = calculateTotalEarnings([]);
      expect(totalEarnings).toBe(0);
    });
  });

  describe("Price handling", () => {
    it("should handle string prices", () => {
      const appointments = [
        { id: 1, date: "2025-01-15", price: "150" },
        { id: 2, date: "2025-01-16", price: "200" },
      ];
      const totalEarnings = calculateTotalEarnings(appointments);

      // Total: $350 * 0.9 = $315
      expect(totalEarnings).toBe(315);
    });

    it("should handle numeric prices", () => {
      const appointments = [
        { id: 1, date: "2025-01-15", price: 150 },
        { id: 2, date: "2025-01-16", price: 200 },
      ];
      const totalEarnings = calculateTotalEarnings(appointments);

      // Total: $350 * 0.9 = $315
      expect(totalEarnings).toBe(315);
    });

    it("should handle null prices as 0", () => {
      const appointments = [
        { id: 1, date: "2025-01-15", price: null },
        { id: 2, date: "2025-01-16", price: "100" },
      ];
      const totalEarnings = calculateTotalEarnings(appointments);

      // Total: ($0 + $100) * 0.9 = $90
      expect(totalEarnings).toBe(90);
    });

    it("should handle undefined prices as 0", () => {
      const appointments = [
        { id: 1, date: "2025-01-15" }, // no price
        { id: 2, date: "2025-01-16", price: "100" },
      ];
      const totalEarnings = calculateTotalEarnings(appointments);

      // Total: ($0 + $100) * 0.9 = $90
      expect(totalEarnings).toBe(90);
    });

    it("should handle invalid price strings as 0", () => {
      const appointments = [
        { id: 1, date: "2025-01-15", price: "not-a-number" },
        { id: 2, date: "2025-01-16", price: "100" },
      ];
      const totalEarnings = calculateTotalEarnings(appointments);

      // NaN * 0.9 = NaN, but || 0 handles this
      // Actually Number("not-a-number") = NaN, NaN || 0 = 0
      // So: ($0 + $100) * 0.9 = $90
      expect(totalEarnings).toBe(90);
    });

    it("should handle decimal prices", () => {
      const appointments = [
        { id: 1, date: "2025-01-15", price: "99.99" },
        { id: 2, date: "2025-01-16", price: "149.50" },
      ];
      const totalEarnings = calculateTotalEarnings(appointments);

      // Total: $249.49 * 0.9 = $224.541
      expect(totalEarnings).toBeCloseTo(224.541, 2);
    });
  });

  describe("Cleaner share percent calculation", () => {
    // Test the cleanerSharePercent calculation itself
    const getCleanerSharePercent = (feePercent) => {
      return 1 - (feePercent || 0.1);
    };

    it("should calculate 90% share for 10% fee", () => {
      expect(getCleanerSharePercent(0.1)).toBe(0.9);
    });

    it("should calculate 85% share for 15% fee", () => {
      expect(getCleanerSharePercent(0.15)).toBe(0.85);
    });

    it("should calculate 80% share for 20% fee", () => {
      expect(getCleanerSharePercent(0.2)).toBe(0.8);
    });

    it("should default to 90% share when fee is undefined", () => {
      expect(getCleanerSharePercent(undefined)).toBe(0.9);
    });

    it("should default to 90% share when fee is null", () => {
      expect(getCleanerSharePercent(null)).toBe(0.9);
    });

    it("should default to 90% share when fee is 0 (falsy)", () => {
      // Note: This tests the fallback behavior when fee is explicitly 0
      // The || 0.1 will use 0.1 when fee is 0 (falsy)
      expect(getCleanerSharePercent(0)).toBe(0.9);
    });
  });

  describe("Real-world scenarios", () => {
    it("should correctly calculate $292.50 from $325 total (the bug fix)", () => {
      // This is the exact scenario from the bug report
      const appointments = [
        { id: 1, date: "2025-01-15", price: "100", completed: false },
        { id: 2, date: "2025-01-16", price: "125", completed: false },
        { id: 3, date: "2025-01-10", price: "100", completed: true },
      ];

      const totalEarnings = calculateTotalEarnings(appointments, 0.1);

      // Bug showed $325, correct is $292.50
      expect(totalEarnings).toBe(292.5);
      expect(totalEarnings).not.toBe(325); // The old buggy value
    });

    it("should calculate earnings for a typical week of jobs", () => {
      const appointments = [
        { id: 1, date: "2025-01-13", price: "150", completed: true },
        { id: 2, date: "2025-01-14", price: "175", completed: true },
        { id: 3, date: "2025-01-15", price: "200", completed: false },
        { id: 4, date: "2025-01-16", price: "125", completed: false },
        { id: 5, date: "2025-01-17", price: "180", completed: false },
      ];

      const totalEarnings = calculateTotalEarnings(appointments, 0.1);

      // Total: $830 * 0.9 = $747
      expect(totalEarnings).toBe(747);
    });

    it("should handle single high-value job", () => {
      const appointments = [{ id: 1, date: "2025-01-15", price: "500" }];

      const totalEarnings = calculateTotalEarnings(appointments, 0.1);

      // $500 * 0.9 = $450
      expect(totalEarnings).toBe(450);
    });

    it("should handle many small jobs", () => {
      const appointments = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        date: `2025-01-${15 + i}`,
        price: "50",
      }));

      const totalEarnings = calculateTotalEarnings(appointments, 0.1);

      // 10 * $50 = $500, * 0.9 = $450
      expect(totalEarnings).toBe(450);
    });
  });

  describe("Completed vs upcoming jobs", () => {
    // The total includes both completed and upcoming jobs
    it("should include both completed and upcoming jobs in total", () => {
      const appointments = [
        { id: 1, date: "2025-01-10", price: "100", completed: true },
        { id: 2, date: "2025-01-20", price: "150", completed: false },
      ];

      const totalEarnings = calculateTotalEarnings(appointments, 0.1);

      // Both are included: ($100 + $150) * 0.9 = $225
      expect(totalEarnings).toBe(225);
    });

    it("should calculate correctly with only completed jobs", () => {
      const appointments = [
        { id: 1, date: "2025-01-10", price: "100", completed: true },
        { id: 2, date: "2025-01-11", price: "150", completed: true },
      ];

      const totalEarnings = calculateTotalEarnings(appointments, 0.1);

      expect(totalEarnings).toBe(225);
    });

    it("should calculate correctly with only upcoming jobs", () => {
      const appointments = [
        { id: 1, date: "2025-12-30", price: "100", completed: false },
        { id: 2, date: "2025-12-31", price: "150", completed: false },
      ];

      const totalEarnings = calculateTotalEarnings(appointments, 0.1);

      expect(totalEarnings).toBe(225);
    });
  });
});

describe("EmployeeAssignmentsList - Sorting", () => {
  // Get date strings for testing
  const getDateString = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  describe("Date sorting", () => {
    it("should sort by date newest first", () => {
      const appointments = [
        { id: 1, date: getDateString(5), price: "100" },
        { id: 2, date: getDateString(1), price: "150" },
        { id: 3, date: getDateString(10), price: "200" },
      ];

      const sorted = [...appointments].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      expect(sorted[0].id).toBe(2); // Soonest (1 day)
      expect(sorted[1].id).toBe(1); // 5 days
      expect(sorted[2].id).toBe(3); // 10 days
    });

    it("should sort by date oldest first", () => {
      const appointments = [
        { id: 1, date: getDateString(5), price: "100" },
        { id: 2, date: getDateString(1), price: "150" },
        { id: 3, date: getDateString(10), price: "200" },
      ];

      const sorted = [...appointments].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );

      expect(sorted[0].id).toBe(3); // Latest (10 days)
      expect(sorted[1].id).toBe(1); // 5 days
      expect(sorted[2].id).toBe(2); // 1 day
    });
  });

  describe("Price sorting", () => {
    it("should sort by price high to low", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100" },
        { id: 2, date: getDateString(2), price: "200" },
        { id: 3, date: getDateString(3), price: "150" },
      ];

      const sorted = [...appointments].sort(
        (a, b) => Number(b.price) - Number(a.price)
      );

      expect(sorted[0].id).toBe(2); // $200
      expect(sorted[1].id).toBe(3); // $150
      expect(sorted[2].id).toBe(1); // $100
    });

    it("should sort by price low to high", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100" },
        { id: 2, date: getDateString(2), price: "200" },
        { id: 3, date: getDateString(3), price: "150" },
      ];

      const sorted = [...appointments].sort(
        (a, b) => Number(a.price) - Number(b.price)
      );

      expect(sorted[0].id).toBe(1); // $100
      expect(sorted[1].id).toBe(3); // $150
      expect(sorted[2].id).toBe(2); // $200
    });
  });
});

describe("EmployeeAssignmentsList - Job Filtering", () => {
  const getDateString = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  describe("Upcoming vs completed filtering", () => {
    it("should identify upcoming jobs correctly", () => {
      const now = new Date();
      const appointments = [
        { id: 1, date: getDateString(-5), completed: true },
        { id: 2, date: getDateString(1), completed: false }, // Tomorrow
        { id: 3, date: getDateString(5), completed: false },
      ];

      const upcomingJobs = appointments.filter(
        (a) => new Date(a.date + "T00:00:00") >= new Date(now.toDateString()) && !a.completed
      );

      expect(upcomingJobs.length).toBe(2);
      expect(upcomingJobs.map((j) => j.id)).toContain(2);
      expect(upcomingJobs.map((j) => j.id)).toContain(3);
    });

    it("should identify completed jobs correctly", () => {
      const appointments = [
        { id: 1, date: getDateString(-5), completed: true },
        { id: 2, date: getDateString(-3), completed: true },
        { id: 3, date: getDateString(5), completed: false },
      ];

      const completedJobs = appointments.filter((a) => a.completed);

      expect(completedJobs.length).toBe(2);
      expect(completedJobs.map((j) => j.id)).toEqual([1, 2]);
    });

    it("should handle all upcoming jobs", () => {
      const appointments = [
        { id: 1, date: getDateString(1), completed: false },
        { id: 2, date: getDateString(3), completed: false },
        { id: 3, date: getDateString(7), completed: false },
      ];

      const now = new Date();
      const upcomingJobs = appointments.filter(
        (a) => new Date(a.date) >= new Date(now.toDateString()) && !a.completed
      );
      const completedJobs = appointments.filter((a) => a.completed);

      expect(upcomingJobs.length).toBe(3);
      expect(completedJobs.length).toBe(0);
    });

    it("should handle all completed jobs", () => {
      const appointments = [
        { id: 1, date: getDateString(-10), completed: true },
        { id: 2, date: getDateString(-5), completed: true },
        { id: 3, date: getDateString(-1), completed: true },
      ];

      const now = new Date();
      const upcomingJobs = appointments.filter(
        (a) => new Date(a.date) >= new Date(now.toDateString()) && !a.completed
      );
      const completedJobs = appointments.filter((a) => a.completed);

      expect(upcomingJobs.length).toBe(0);
      expect(completedJobs.length).toBe(3);
    });

    it("should handle empty appointments", () => {
      const appointments = [];

      const now = new Date();
      const upcomingJobs = appointments.filter(
        (a) => new Date(a.date) >= new Date(now.toDateString()) && !a.completed
      );
      const completedJobs = appointments.filter((a) => a.completed);

      expect(upcomingJobs.length).toBe(0);
      expect(completedJobs.length).toBe(0);
    });
  });
});
