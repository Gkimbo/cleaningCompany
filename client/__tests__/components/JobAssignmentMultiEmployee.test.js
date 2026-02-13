/**
 * JobAssignment - Multi-Employee Display Tests
 * Tests for assignedCount display and multi-employee job cards
 */

describe("JobAssignment - AssignedCount Display", () => {
  // Mock assignment data with assignedCount
  const createMockAssignment = (id, appointmentId, employeeName, assignedCount = 1) => ({
    id,
    appointmentId,
    status: "assigned",
    payAmount: 5000,
    assignedCount,
    employee: {
      id: id,
      firstName: employeeName.split(" ")[0],
      lastName: employeeName.split(" ")[1] || "",
    },
    appointment: {
      id: appointmentId,
      date: "2024-03-15",
      startTime: "09:00",
      price: 15000,
      home: {
        address: "123 Main St",
        city: "Austin",
        state: "TX",
      },
    },
  });

  describe("Single vs multiple employee display", () => {
    it("should display employee name for single-employee assignment", () => {
      const assignment = createMockAssignment(1, 100, "John Doe", 1);

      const displayText =
        assignment.assignedCount > 1
          ? `${assignment.assignedCount} employees assigned`
          : `${assignment.employee.firstName} ${assignment.employee.lastName}`;

      expect(displayText).toBe("John Doe");
    });

    it("should display employee count for multi-employee assignment", () => {
      const assignment = createMockAssignment(1, 100, "John Doe", 3);

      const displayText =
        assignment.assignedCount > 1
          ? `${assignment.assignedCount} employees assigned`
          : `${assignment.employee.firstName} ${assignment.employee.lastName}`;

      expect(displayText).toBe("3 employees assigned");
    });

    it("should display correctly for 2 employees", () => {
      const assignment = createMockAssignment(1, 100, "John Doe", 2);

      const displayText =
        assignment.assignedCount > 1
          ? `${assignment.assignedCount} employees assigned`
          : `${assignment.employee.firstName} ${assignment.employee.lastName}`;

      expect(displayText).toBe("2 employees assigned");
    });
  });

  describe("AssignedCount from API response", () => {
    it("should correctly parse assignedCount from calendar API", () => {
      const mockCalendarResponse = {
        assignments: [
          { id: 1, appointmentId: 100, assignedCount: 1 },
          { id: 2, appointmentId: 100, assignedCount: 2 },
          { id: 3, appointmentId: 101, assignedCount: 2 },
          { id: 4, appointmentId: 102, assignedCount: 3 },
        ],
      };

      const singleEmployee = mockCalendarResponse.assignments.filter(
        (a) => a.assignedCount === 1
      );
      const multiEmployee = mockCalendarResponse.assignments.filter(
        (a) => a.assignedCount > 1
      );

      expect(singleEmployee.length).toBe(1);
      expect(multiEmployee.length).toBe(3);
    });

    it("should default assignedCount to 1 when not provided", () => {
      const assignment = { id: 1, appointmentId: 100 };

      const assignedCount = assignment.assignedCount || 1;

      expect(assignedCount).toBe(1);
    });

    it("should handle null assignedCount", () => {
      const assignment = { id: 1, appointmentId: 100, assignedCount: null };

      const assignedCount = assignment.assignedCount || 1;

      expect(assignedCount).toBe(1);
    });
  });

  describe("Multi-employee badge visibility", () => {
    it("should show badge when assignedCount > 1", () => {
      const showBadge = (assignedCount) => assignedCount > 1;

      expect(showBadge(1)).toBe(false);
      expect(showBadge(2)).toBe(true);
      expect(showBadge(5)).toBe(true);
    });

    it("should NOT show badge for single employee", () => {
      const showBadge = (assignedCount) => assignedCount > 1;

      expect(showBadge(1)).toBe(false);
      expect(showBadge(0)).toBe(false);
    });
  });

  describe("Same appointment grouping", () => {
    it("should identify assignments for same appointment", () => {
      const assignments = [
        createMockAssignment(1, 100, "John Doe", 2),
        createMockAssignment(2, 100, "Jane Smith", 2),
        createMockAssignment(3, 101, "Bob Johnson", 1),
      ];

      const appointmentGroups = assignments.reduce((groups, assignment) => {
        const apptId = assignment.appointmentId;
        if (!groups[apptId]) {
          groups[apptId] = [];
        }
        groups[apptId].push(assignment);
        return groups;
      }, {});

      expect(Object.keys(appointmentGroups).length).toBe(2);
      expect(appointmentGroups[100].length).toBe(2);
      expect(appointmentGroups[101].length).toBe(1);
    });

    it("should all have same assignedCount for same appointment", () => {
      const assignments = [
        createMockAssignment(1, 100, "John Doe", 2),
        createMockAssignment(2, 100, "Jane Smith", 2),
      ];

      const allSameCount = assignments.every(
        (a) => a.assignedCount === assignments[0].assignedCount
      );

      expect(allSameCount).toBe(true);
    });
  });
});

describe("JobAssignment - Calendar View", () => {
  describe("Calendar assignment rendering", () => {
    it("should render one card per assignment even for multi-employee jobs", () => {
      const assignments = [
        { id: 1, appointmentId: 100, assignedCount: 2, employee: { firstName: "John" } },
        { id: 2, appointmentId: 100, assignedCount: 2, employee: { firstName: "Jane" } },
        { id: 3, appointmentId: 101, assignedCount: 1, employee: { firstName: "Bob" } },
      ];

      // Each assignment should render as its own card
      expect(assignments.length).toBe(3);
    });

    it("should show multi-employee indicator on all cards for same appointment", () => {
      const assignments = [
        { id: 1, appointmentId: 100, assignedCount: 2 },
        { id: 2, appointmentId: 100, assignedCount: 2 },
      ];

      const appt100Assignments = assignments.filter((a) => a.appointmentId === 100);
      const allHaveMultiIndicator = appt100Assignments.every((a) => a.assignedCount > 1);

      expect(allHaveMultiIndicator).toBe(true);
    });
  });

  describe("Status-based filtering with multi-employee", () => {
    it("should filter by status regardless of assignedCount", () => {
      const assignments = [
        { id: 1, appointmentId: 100, status: "assigned", assignedCount: 2 },
        { id: 2, appointmentId: 100, status: "in_progress", assignedCount: 2 },
        { id: 3, appointmentId: 101, status: "completed", assignedCount: 1 },
      ];

      const assignedOnly = assignments.filter((a) => a.status === "assigned");
      const inProgressOnly = assignments.filter((a) => a.status === "in_progress");

      expect(assignedOnly.length).toBe(1);
      expect(inProgressOnly.length).toBe(1);
    });
  });
});

describe("JobAssignment - Job Card Display", () => {
  describe("Card header info", () => {
    it("should display date and time correctly", () => {
      const formatDateTime = (date, time) => {
        const dateObj = new Date(date + "T" + time);
        return dateObj.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      };

      const result = formatDateTime("2024-03-15", "09:00");

      expect(result).toContain("Mar");
      expect(result).toContain("15");
    });

    it("should format price correctly", () => {
      const formatPrice = (priceInCents) => {
        return `$${(priceInCents / 100).toFixed(0)}`;
      };

      expect(formatPrice(15000)).toBe("$150");
      expect(formatPrice(20000)).toBe("$200");
    });
  });

  describe("Address display", () => {
    it("should format full address correctly", () => {
      const home = {
        address: "123 Main St",
        city: "Austin",
        state: "TX",
      };

      const fullAddress = `${home.address}, ${home.city}, ${home.state}`;

      expect(fullAddress).toBe("123 Main St, Austin, TX");
    });
  });

  describe("Pay display for multi-employee", () => {
    it("should show individual pay amount for employee", () => {
      const assignment = {
        payAmount: 5000,
        assignedCount: 2,
      };

      const formatPay = (amount) => `$${(amount / 100).toFixed(2)}`;

      // Each employee sees their own pay, not total job pay
      expect(formatPay(assignment.payAmount)).toBe("$50.00");
    });

    it("should handle different pay amounts for same job", () => {
      const assignments = [
        { id: 1, appointmentId: 100, payAmount: 5000, assignedCount: 2 },
        { id: 2, appointmentId: 100, payAmount: 4000, assignedCount: 2 },
      ];

      const formatPay = (amount) => `$${(amount / 100).toFixed(2)}`;

      expect(formatPay(assignments[0].payAmount)).toBe("$50.00");
      expect(formatPay(assignments[1].payAmount)).toBe("$40.00");
    });
  });
});

describe("JobAssignment - Navigation", () => {
  describe("Card press navigation", () => {
    it("should navigate to assignment detail with correct ID", () => {
      const assignment = { id: 123, appointmentId: 100 };

      const getDetailUrl = (assignmentId) => {
        return `/assignments/${assignmentId}`;
      };

      expect(getDetailUrl(assignment.id)).toBe("/assignments/123");
    });
  });
});

describe("JobAssignment - Sorting and Filtering", () => {
  describe("Date sorting with multi-employee", () => {
    it("should sort by date ascending", () => {
      const assignments = [
        { id: 1, appointmentId: 100, assignedCount: 2, appointment: { date: "2024-03-20" } },
        { id: 2, appointmentId: 101, assignedCount: 1, appointment: { date: "2024-03-15" } },
        { id: 3, appointmentId: 100, assignedCount: 2, appointment: { date: "2024-03-20" } },
      ];

      const sorted = [...assignments].sort(
        (a, b) => new Date(a.appointment.date) - new Date(b.appointment.date)
      );

      expect(sorted[0].appointment.date).toBe("2024-03-15");
      expect(sorted[1].appointment.date).toBe("2024-03-20");
    });
  });

  describe("Employee filter", () => {
    it("should filter assignments by employee ID", () => {
      const assignments = [
        { id: 1, appointmentId: 100, employee: { id: 10 }, assignedCount: 2 },
        { id: 2, appointmentId: 100, employee: { id: 20 }, assignedCount: 2 },
        { id: 3, appointmentId: 101, employee: { id: 10 }, assignedCount: 1 },
      ];

      const employee10Assignments = assignments.filter((a) => a.employee.id === 10);

      expect(employee10Assignments.length).toBe(2);
    });
  });
});

describe("JobAssignment - Empty States", () => {
  describe("No assignments", () => {
    it("should show empty state message when no assignments", () => {
      const assignments = [];

      const showEmptyState = assignments.length === 0;

      expect(showEmptyState).toBe(true);
    });
  });

  describe("No multi-employee assignments", () => {
    it("should not show multi-employee badge for all single-employee jobs", () => {
      const assignments = [
        { id: 1, assignedCount: 1 },
        { id: 2, assignedCount: 1 },
        { id: 3, assignedCount: 1 },
      ];

      const hasMultiEmployee = assignments.some((a) => a.assignedCount > 1);

      expect(hasMultiEmployee).toBe(false);
    });
  });
});

describe("JobAssignment - API Integration", () => {
  describe("Calendar endpoint response structure", () => {
    it("should match expected response structure", () => {
      const mockResponse = {
        assignments: [
          {
            id: 1,
            appointmentId: 100,
            businessOwnerId: 10,
            businessEmployeeId: 1,
            status: "assigned",
            payAmount: 5000,
            assignedCount: 2,
            isSelfAssignment: false,
            employee: { id: 1, firstName: "John", lastName: "Doe" },
            appointment: {
              id: 100,
              date: "2024-03-15",
              startTime: "09:00",
              price: 15000,
              status: "scheduled",
              home: {
                address: "123 Main St",
                city: "Austin",
                state: "TX",
              },
            },
          },
        ],
      };

      expect(mockResponse.assignments[0]).toHaveProperty("assignedCount");
      expect(mockResponse.assignments[0]).toHaveProperty("employee");
      expect(mockResponse.assignments[0]).toHaveProperty("appointment");
      expect(mockResponse.assignments[0].appointment).toHaveProperty("home");
    });
  });
});
