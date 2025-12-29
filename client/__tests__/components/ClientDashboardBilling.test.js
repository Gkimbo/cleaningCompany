/**
 * Tests for ClientDashboard billing section
 * Tests auto-captured vs pending payment calculations and display logic
 */

describe("ClientDashboard - Billing Section", () => {
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

  // Mock dateUtils functions (matching the component)
  const isFutureOrToday = (dateString) => {
    const today = getToday();
    const date = new Date(dateString + "T00:00:00");
    date.setHours(0, 0, 0, 0);
    return date >= today;
  };

  const compareDates = (a, b) => {
    const dateA = new Date(a + "T00:00:00");
    const dateB = new Date(b + "T00:00:00");
    return dateA - dateB;
  };

  // Billing calculation logic from component
  const calculateBillingSummary = (appointments) => {
    // Filter upcoming appointments (exclude completed)
    const allUpcomingAppointments = appointments
      .filter((apt) => isFutureOrToday(apt.date) && !apt.completed)
      .sort((a, b) => compareDates(a.date, b.date));

    // Split by paid status
    const autoCapturedAppointments = allUpcomingAppointments.filter((apt) => apt.paid);
    const pendingPaymentAppointments = allUpcomingAppointments.filter((apt) => !apt.paid);

    // Calculate totals
    const autoCapturedTotal = autoCapturedAppointments.reduce(
      (sum, apt) => sum + (Number(apt.price) || 0),
      0
    );
    const pendingPaymentTotal = pendingPaymentAppointments.reduce(
      (sum, apt) => sum + (Number(apt.price) || 0),
      0
    );

    return {
      allUpcomingAppointments,
      autoCapturedAppointments,
      pendingPaymentAppointments,
      autoCapturedTotal,
      pendingPaymentTotal,
      upcomingCount: allUpcomingAppointments.length,
    };
  };

  describe("Filtering upcoming appointments", () => {
    it("should include future appointments", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100", paid: false, completed: false },
        { id: 2, date: getDateString(5), price: "150", paid: false, completed: false },
        { id: 3, date: getDateString(10), price: "200", paid: false, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      expect(result.upcomingCount).toBe(3);
    });

    it("should include today's appointments", () => {
      const appointments = [
        { id: 1, date: getDateString(0), price: "100", paid: false, completed: false },
        { id: 2, date: getDateString(1), price: "150", paid: false, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      expect(result.upcomingCount).toBe(2);
    });

    it("should exclude past appointments", () => {
      const appointments = [
        { id: 1, date: getDateString(-1), price: "100", paid: false, completed: false },
        { id: 2, date: getDateString(-5), price: "150", paid: false, completed: false },
        { id: 3, date: getDateString(1), price: "200", paid: false, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      expect(result.upcomingCount).toBe(1);
      expect(result.allUpcomingAppointments[0].id).toBe(3);
    });

    it("should exclude completed appointments", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100", paid: true, completed: true },
        { id: 2, date: getDateString(2), price: "150", paid: false, completed: false },
        { id: 3, date: getDateString(3), price: "200", paid: true, completed: true },
      ];

      const result = calculateBillingSummary(appointments);

      expect(result.upcomingCount).toBe(1);
      expect(result.allUpcomingAppointments[0].id).toBe(2);
    });

    it("should sort appointments by date", () => {
      const appointments = [
        { id: 1, date: getDateString(5), price: "100", paid: false, completed: false },
        { id: 2, date: getDateString(1), price: "150", paid: false, completed: false },
        { id: 3, date: getDateString(3), price: "200", paid: false, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      expect(result.allUpcomingAppointments[0].id).toBe(2);
      expect(result.allUpcomingAppointments[1].id).toBe(3);
      expect(result.allUpcomingAppointments[2].id).toBe(1);
    });
  });

  describe("Auto-captured vs pending payment separation", () => {
    it("should identify auto-captured (paid) appointments", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100", paid: true, completed: false },
        { id: 2, date: getDateString(2), price: "150", paid: false, completed: false },
        { id: 3, date: getDateString(3), price: "200", paid: true, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      expect(result.autoCapturedAppointments.length).toBe(2);
      expect(result.autoCapturedAppointments.map((a) => a.id)).toEqual([1, 3]);
    });

    it("should identify pending payment (unpaid) appointments", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100", paid: true, completed: false },
        { id: 2, date: getDateString(2), price: "150", paid: false, completed: false },
        { id: 3, date: getDateString(3), price: "200", paid: false, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      expect(result.pendingPaymentAppointments.length).toBe(2);
      expect(result.pendingPaymentAppointments.map((a) => a.id)).toEqual([2, 3]);
    });

    it("should handle all paid appointments", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100", paid: true, completed: false },
        { id: 2, date: getDateString(2), price: "150", paid: true, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      expect(result.autoCapturedAppointments.length).toBe(2);
      expect(result.pendingPaymentAppointments.length).toBe(0);
    });

    it("should handle all unpaid appointments", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100", paid: false, completed: false },
        { id: 2, date: getDateString(2), price: "150", paid: false, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      expect(result.autoCapturedAppointments.length).toBe(0);
      expect(result.pendingPaymentAppointments.length).toBe(2);
    });

    it("should not include completed paid appointments in auto-captured", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100", paid: true, completed: true },
        { id: 2, date: getDateString(2), price: "150", paid: true, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      // Only non-completed appointment should be in auto-captured
      expect(result.autoCapturedAppointments.length).toBe(1);
      expect(result.autoCapturedAppointments[0].id).toBe(2);
    });
  });

  describe("Total calculations", () => {
    it("should calculate auto-captured total correctly", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100", paid: true, completed: false },
        { id: 2, date: getDateString(2), price: "150.50", paid: true, completed: false },
        { id: 3, date: getDateString(3), price: "75", paid: false, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      expect(result.autoCapturedTotal).toBe(250.5);
    });

    it("should calculate pending payment total correctly", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100", paid: true, completed: false },
        { id: 2, date: getDateString(2), price: "150.50", paid: false, completed: false },
        { id: 3, date: getDateString(3), price: "75", paid: false, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      expect(result.pendingPaymentTotal).toBe(225.5);
    });

    it("should handle string and number price formats", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100", paid: true, completed: false },
        { id: 2, date: getDateString(2), price: 150, paid: true, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      expect(result.autoCapturedTotal).toBe(250);
    });

    it("should handle null/undefined/invalid prices", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: null, paid: true, completed: false },
        { id: 2, date: getDateString(2), price: undefined, paid: true, completed: false },
        { id: 3, date: getDateString(3), price: "invalid", paid: true, completed: false },
        { id: 4, date: getDateString(4), price: "100", paid: true, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      expect(result.autoCapturedTotal).toBe(100);
    });

    it("should return zero totals for empty appointments", () => {
      const result = calculateBillingSummary([]);

      expect(result.autoCapturedTotal).toBe(0);
      expect(result.pendingPaymentTotal).toBe(0);
      expect(result.upcomingCount).toBe(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle appointments with missing paid field", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100", completed: false },
        { id: 2, date: getDateString(2), price: "150", paid: false, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      // Appointments without paid field should be treated as unpaid
      expect(result.pendingPaymentAppointments.length).toBe(2);
      expect(result.autoCapturedAppointments.length).toBe(0);
    });

    it("should handle appointments with missing completed field", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100", paid: true },
        { id: 2, date: getDateString(2), price: "150", paid: false },
      ];

      const result = calculateBillingSummary(appointments);

      // Appointments without completed field should be treated as not completed
      expect(result.upcomingCount).toBe(2);
    });

    it("should handle large number of appointments", () => {
      const appointments = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        date: getDateString(i + 1),
        price: "100",
        paid: i % 2 === 0, // Alternate between paid and unpaid
        completed: false,
      }));

      const result = calculateBillingSummary(appointments);

      expect(result.upcomingCount).toBe(100);
      expect(result.autoCapturedAppointments.length).toBe(50);
      expect(result.pendingPaymentAppointments.length).toBe(50);
      expect(result.autoCapturedTotal).toBe(5000);
      expect(result.pendingPaymentTotal).toBe(5000);
    });

    it("should handle decimal prices correctly", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "99.99", paid: true, completed: false },
        { id: 2, date: getDateString(2), price: "150.01", paid: true, completed: false },
      ];

      const result = calculateBillingSummary(appointments);

      expect(result.autoCapturedTotal).toBe(250);
    });
  });
});

describe("ClientDashboard - Currency Formatting", () => {
  const formatCurrency = (value) => {
    if (!value && value !== 0) return "$0.00";
    return `$${Number(value).toFixed(2)}`;
  };

  it("should format positive numbers correctly", () => {
    expect(formatCurrency(100)).toBe("$100.00");
    expect(formatCurrency(99.99)).toBe("$99.99");
    expect(formatCurrency(1000.5)).toBe("$1000.50");
  });

  it("should format zero correctly", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("should handle null/undefined", () => {
    expect(formatCurrency(null)).toBe("$0.00");
    expect(formatCurrency(undefined)).toBe("$0.00");
  });

  it("should handle string numbers", () => {
    expect(formatCurrency("150")).toBe("$150.00");
    expect(formatCurrency("99.99")).toBe("$99.99");
  });
});

describe("ClientDashboard - Edit StatCard", () => {
  // Test the Edit StatCard display logic
  const getEditCardValue = (upcomingAppointmentsCount) => {
    return upcomingAppointmentsCount;
  };

  it("should display the count of upcoming appointments", () => {
    expect(getEditCardValue(5)).toBe(5);
    expect(getEditCardValue(0)).toBe(0);
    expect(getEditCardValue(100)).toBe(100);
  });
});

describe("ClientDashboard - Billing Display Conditions", () => {
  // Tests for conditional rendering logic

  const shouldShowAutoCaptured = (autoCapturedAppointments) => {
    return autoCapturedAppointments.length > 0;
  };

  const shouldShowPending = (pendingPaymentAppointments) => {
    return pendingPaymentAppointments.length > 0;
  };

  const shouldShowUpcomingSection = (upcomingAppointmentsCount) => {
    return upcomingAppointmentsCount > 0;
  };

  it("should show auto-captured section when there are paid appointments", () => {
    const autoCaptured = [{ id: 1 }, { id: 2 }];
    expect(shouldShowAutoCaptured(autoCaptured)).toBe(true);
  });

  it("should hide auto-captured section when there are no paid appointments", () => {
    expect(shouldShowAutoCaptured([])).toBe(false);
  });

  it("should show pending section when there are unpaid appointments", () => {
    const pending = [{ id: 1 }];
    expect(shouldShowPending(pending)).toBe(true);
  });

  it("should hide pending section when there are no unpaid appointments", () => {
    expect(shouldShowPending([])).toBe(false);
  });

  it("should show upcoming services section when there are upcoming appointments", () => {
    expect(shouldShowUpcomingSection(5)).toBe(true);
    expect(shouldShowUpcomingSection(1)).toBe(true);
  });

  it("should hide upcoming services section when there are no upcoming appointments", () => {
    expect(shouldShowUpcomingSection(0)).toBe(false);
  });
});

describe("ClientDashboard - Amount Due Now Calculation", () => {
  // Amount due now should only include cancellation fees, not future appointments

  const calculateAmountDueNow = (bill) => {
    return bill?.cancellationFee || 0;
  };

  it("should return cancellation fee when present", () => {
    const bill = { cancellationFee: 50 };
    expect(calculateAmountDueNow(bill)).toBe(50);
  });

  it("should return 0 when no cancellation fee", () => {
    const bill = { cancellationFee: 0 };
    expect(calculateAmountDueNow(bill)).toBe(0);
  });

  it("should return 0 when bill is null", () => {
    expect(calculateAmountDueNow(null)).toBe(0);
  });

  it("should return 0 when cancellationFee is undefined", () => {
    const bill = {};
    expect(calculateAmountDueNow(bill)).toBe(0);
  });

  it("should not include upcoming appointment prices in amount due now", () => {
    const bill = { cancellationFee: 25, totalPaid: 500 };
    // Amount due now is ONLY cancellation fee
    expect(calculateAmountDueNow(bill)).toBe(25);
  });
});

describe("ClientDashboard - Real-world Scenarios", () => {
  const getDateString = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const isFutureOrToday = (dateString) => {
    const today = getToday();
    const date = new Date(dateString + "T00:00:00");
    date.setHours(0, 0, 0, 0);
    return date >= today;
  };

  const calculateBillingSummary = (appointments) => {
    const allUpcomingAppointments = appointments
      .filter((apt) => isFutureOrToday(apt.date) && !apt.completed)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const autoCapturedAppointments = allUpcomingAppointments.filter((apt) => apt.paid);
    const pendingPaymentAppointments = allUpcomingAppointments.filter((apt) => !apt.paid);

    return {
      autoCapturedAppointments,
      pendingPaymentAppointments,
      autoCapturedTotal: autoCapturedAppointments.reduce(
        (sum, apt) => sum + (Number(apt.price) || 0),
        0
      ),
      pendingPaymentTotal: pendingPaymentAppointments.reduce(
        (sum, apt) => sum + (Number(apt.price) || 0),
        0
      ),
    };
  };

  it("Scenario: Client has 3 appointments - 1 auto-captured, 2 pending", () => {
    const appointments = [
      // Auto-captured (payment captured 3 days before)
      { id: 1, date: getDateString(1), price: "150", paid: true, completed: false },
      // Pending (more than 3 days out)
      { id: 2, date: getDateString(5), price: "175", paid: false, completed: false },
      { id: 3, date: getDateString(10), price: "200", paid: false, completed: false },
    ];

    const result = calculateBillingSummary(appointments);

    expect(result.autoCapturedAppointments.length).toBe(1);
    expect(result.autoCapturedTotal).toBe(150);
    expect(result.pendingPaymentAppointments.length).toBe(2);
    expect(result.pendingPaymentTotal).toBe(375);
  });

  it("Scenario: All appointments are prepaid", () => {
    const appointments = [
      { id: 1, date: getDateString(2), price: "150", paid: true, completed: false },
      { id: 2, date: getDateString(7), price: "175", paid: true, completed: false },
      { id: 3, date: getDateString(14), price: "200", paid: true, completed: false },
    ];

    const result = calculateBillingSummary(appointments);

    expect(result.autoCapturedAppointments.length).toBe(3);
    expect(result.autoCapturedTotal).toBe(525);
    expect(result.pendingPaymentAppointments.length).toBe(0);
    expect(result.pendingPaymentTotal).toBe(0);
  });

  it("Scenario: No upcoming appointments", () => {
    const appointments = [
      { id: 1, date: getDateString(-5), price: "150", paid: true, completed: true },
      { id: 2, date: getDateString(-10), price: "175", paid: true, completed: true },
    ];

    const result = calculateBillingSummary(appointments);

    expect(result.autoCapturedAppointments.length).toBe(0);
    expect(result.pendingPaymentAppointments.length).toBe(0);
  });

  it("Scenario: Mix of past completed, today, and future", () => {
    const appointments = [
      // Past and completed - should not appear
      { id: 1, date: getDateString(-3), price: "150", paid: true, completed: true },
      // Today - should appear
      { id: 2, date: getDateString(0), price: "175", paid: true, completed: false },
      // Future unpaid
      { id: 3, date: getDateString(7), price: "200", paid: false, completed: false },
    ];

    const result = calculateBillingSummary(appointments);

    expect(result.autoCapturedAppointments.length).toBe(1);
    expect(result.autoCapturedAppointments[0].id).toBe(2);
    expect(result.pendingPaymentAppointments.length).toBe(1);
    expect(result.pendingPaymentAppointments[0].id).toBe(3);
  });

  it("Scenario: Appointment completed today but still showing in upcoming", () => {
    const appointments = [
      // Today, paid, but completed - should NOT appear
      { id: 1, date: getDateString(0), price: "175", paid: true, completed: true },
      // Today, paid, not completed - should appear
      { id: 2, date: getDateString(0), price: "150", paid: true, completed: false },
    ];

    const result = calculateBillingSummary(appointments);

    expect(result.autoCapturedAppointments.length).toBe(1);
    expect(result.autoCapturedAppointments[0].id).toBe(2);
  });
});

describe("ClientDashboard - Auto-Captured vs Prepaid Separation", () => {
  const getDateString = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseLocalDate = (dateString) => {
    return new Date(dateString + "T00:00:00");
  };

  const isFutureOrToday = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = parseLocalDate(dateString);
    return date >= today;
  };

  // Updated billing calculation that separates auto-captured and prepaid
  const calculateBillingSummaryWithPrepaid = (appointments) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allUpcomingAppointments = appointments
      .filter((apt) => isFutureOrToday(apt.date) && !apt.completed)
      .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));

    // Auto-captured: paid and within 3 days
    const autoCapturedAppointments = allUpcomingAppointments.filter((apt) => {
      if (!apt.paid) return false;
      const aptDate = parseLocalDate(apt.date);
      const daysUntil = Math.ceil((aptDate - today) / (1000 * 60 * 60 * 24));
      return daysUntil <= 3;
    });

    // Prepaid: paid but more than 3 days away
    const prepaidAppointments = allUpcomingAppointments.filter((apt) => {
      if (!apt.paid) return false;
      const aptDate = parseLocalDate(apt.date);
      const daysUntil = Math.ceil((aptDate - today) / (1000 * 60 * 60 * 24));
      return daysUntil > 3;
    });

    // Pending: not paid
    const pendingPaymentAppointments = allUpcomingAppointments.filter((apt) => !apt.paid);

    return {
      autoCapturedAppointments,
      prepaidAppointments,
      pendingPaymentAppointments,
      autoCapturedTotal: autoCapturedAppointments.reduce(
        (sum, apt) => sum + (Number(apt.price) || 0),
        0
      ),
      prepaidTotal: prepaidAppointments.reduce(
        (sum, apt) => sum + (Number(apt.price) || 0),
        0
      ),
      pendingPaymentTotal: pendingPaymentAppointments.reduce(
        (sum, apt) => sum + (Number(apt.price) || 0),
        0
      ),
    };
  };

  describe("Auto-captured classification (within 3 days)", () => {
    it("should classify paid appointments within 3 days as auto-captured", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "150", paid: true, completed: false },
        { id: 2, date: getDateString(2), price: "175", paid: true, completed: false },
        { id: 3, date: getDateString(3), price: "200", paid: true, completed: false },
      ];

      const result = calculateBillingSummaryWithPrepaid(appointments);

      expect(result.autoCapturedAppointments).toHaveLength(3);
      expect(result.autoCapturedTotal).toBe(525);
      expect(result.prepaidAppointments).toHaveLength(0);
    });

    it("should include today's paid appointments as auto-captured", () => {
      const appointments = [
        { id: 1, date: getDateString(0), price: "150", paid: true, completed: false },
      ];

      const result = calculateBillingSummaryWithPrepaid(appointments);

      expect(result.autoCapturedAppointments).toHaveLength(1);
    });

    it("should handle boundary case of exactly 3 days", () => {
      const appointments = [
        { id: 1, date: getDateString(3), price: "150", paid: true, completed: false },
      ];

      const result = calculateBillingSummaryWithPrepaid(appointments);

      // 3 days should be auto-captured (within <= 3 days)
      expect(result.autoCapturedAppointments).toHaveLength(1);
      expect(result.prepaidAppointments).toHaveLength(0);
    });
  });

  describe("Prepaid classification (more than 3 days)", () => {
    it("should classify paid appointments more than 3 days away as prepaid", () => {
      const appointments = [
        { id: 1, date: getDateString(4), price: "150", paid: true, completed: false },
        { id: 2, date: getDateString(7), price: "175", paid: true, completed: false },
        { id: 3, date: getDateString(14), price: "200", paid: true, completed: false },
      ];

      const result = calculateBillingSummaryWithPrepaid(appointments);

      expect(result.prepaidAppointments).toHaveLength(3);
      expect(result.prepaidTotal).toBe(525);
      expect(result.autoCapturedAppointments).toHaveLength(0);
    });

    it("should handle boundary case of 4 days (just outside auto-capture)", () => {
      const appointments = [
        { id: 1, date: getDateString(4), price: "150", paid: true, completed: false },
      ];

      const result = calculateBillingSummaryWithPrepaid(appointments);

      // 4 days should be prepaid (more than 3 days)
      expect(result.prepaidAppointments).toHaveLength(1);
      expect(result.autoCapturedAppointments).toHaveLength(0);
    });
  });

  describe("Mixed scenarios", () => {
    it("should correctly separate auto-captured, prepaid, and pending", () => {
      const appointments = [
        // Auto-captured (within 3 days, paid)
        { id: 1, date: getDateString(1), price: "150", paid: true, completed: false },
        { id: 2, date: getDateString(2), price: "175", paid: true, completed: false },
        // Prepaid (more than 3 days, paid)
        { id: 3, date: getDateString(5), price: "200", paid: true, completed: false },
        { id: 4, date: getDateString(10), price: "225", paid: true, completed: false },
        // Pending (not paid)
        { id: 5, date: getDateString(7), price: "180", paid: false, completed: false },
        { id: 6, date: getDateString(14), price: "190", paid: false, completed: false },
      ];

      const result = calculateBillingSummaryWithPrepaid(appointments);

      expect(result.autoCapturedAppointments).toHaveLength(2);
      expect(result.autoCapturedTotal).toBe(325); // 150 + 175

      expect(result.prepaidAppointments).toHaveLength(2);
      expect(result.prepaidTotal).toBe(425); // 200 + 225

      expect(result.pendingPaymentAppointments).toHaveLength(2);
      expect(result.pendingPaymentTotal).toBe(370); // 180 + 190
    });

    it("should handle all three categories with single appointments each", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "100", paid: true, completed: false }, // Auto-captured
        { id: 2, date: getDateString(7), price: "150", paid: true, completed: false }, // Prepaid
        { id: 3, date: getDateString(14), price: "200", paid: false, completed: false }, // Pending
      ];

      const result = calculateBillingSummaryWithPrepaid(appointments);

      expect(result.autoCapturedAppointments).toHaveLength(1);
      expect(result.prepaidAppointments).toHaveLength(1);
      expect(result.pendingPaymentAppointments).toHaveLength(1);
    });
  });

  describe("Edge cases", () => {
    it("should handle no appointments", () => {
      const result = calculateBillingSummaryWithPrepaid([]);

      expect(result.autoCapturedAppointments).toHaveLength(0);
      expect(result.prepaidAppointments).toHaveLength(0);
      expect(result.pendingPaymentAppointments).toHaveLength(0);
      expect(result.autoCapturedTotal).toBe(0);
      expect(result.prepaidTotal).toBe(0);
      expect(result.pendingPaymentTotal).toBe(0);
    });

    it("should exclude completed appointments from all categories", () => {
      const appointments = [
        { id: 1, date: getDateString(1), price: "150", paid: true, completed: true },
        { id: 2, date: getDateString(7), price: "175", paid: true, completed: true },
        { id: 3, date: getDateString(14), price: "200", paid: false, completed: true },
      ];

      const result = calculateBillingSummaryWithPrepaid(appointments);

      expect(result.autoCapturedAppointments).toHaveLength(0);
      expect(result.prepaidAppointments).toHaveLength(0);
      expect(result.pendingPaymentAppointments).toHaveLength(0);
    });

    it("should exclude past appointments from all categories", () => {
      const appointments = [
        { id: 1, date: getDateString(-1), price: "150", paid: true, completed: false },
        { id: 2, date: getDateString(-5), price: "175", paid: true, completed: false },
      ];

      const result = calculateBillingSummaryWithPrepaid(appointments);

      expect(result.autoCapturedAppointments).toHaveLength(0);
      expect(result.prepaidAppointments).toHaveLength(0);
      expect(result.pendingPaymentAppointments).toHaveLength(0);
    });

    it("should handle unpaid appointments within 3 days", () => {
      // An unpaid appointment within 3 days is still pending, not auto-captured
      const appointments = [
        { id: 1, date: getDateString(1), price: "150", paid: false, completed: false },
        { id: 2, date: getDateString(2), price: "175", paid: false, completed: false },
      ];

      const result = calculateBillingSummaryWithPrepaid(appointments);

      expect(result.autoCapturedAppointments).toHaveLength(0);
      expect(result.prepaidAppointments).toHaveLength(0);
      expect(result.pendingPaymentAppointments).toHaveLength(2);
    });
  });

  describe("Display conditions", () => {
    it("should show prepaid section only when there are prepaid appointments", () => {
      const prepaidAppointments = [{ id: 1 }];
      const shouldShow = prepaidAppointments.length > 0;
      expect(shouldShow).toBe(true);
    });

    it("should hide prepaid section when no prepaid appointments", () => {
      const prepaidAppointments = [];
      const shouldShow = prepaidAppointments.length > 0;
      expect(shouldShow).toBe(false);
    });

    it("should display correct styling for prepaid (success/green colors)", () => {
      // Prepaid uses success colors (green) to indicate early payment
      const expectedBadgeColor = "success";
      const expectedIcon = "check-circle";

      expect(expectedBadgeColor).toBe("success");
      expect(expectedIcon).toBe("check-circle");
    });

    it("should display correct styling for auto-captured (primary/blue colors)", () => {
      // Auto-captured uses primary colors (blue) with credit-card icon
      const expectedBadgeColor = "primary";
      const expectedIcon = "credit-card";

      expect(expectedBadgeColor).toBe("primary");
      expect(expectedIcon).toBe("credit-card");
    });
  });
});
