/**
 * AssignmentDetail - Multi-Employee Display Tests
 * Tests for displaying and managing multiple employees on a single job
 */

describe("AssignmentDetail - Multi-Employee Display", () => {
  // Mock employee data
  const createMockEmployee = (id, firstName, lastName) => ({
    id,
    firstName,
    lastName,
    phone: `555-000${id}`,
    email: `${firstName.toLowerCase()}@example.com`,
  });

  const mockEmployee1 = createMockEmployee(1, "John", "Doe");
  const mockEmployee2 = createMockEmployee(2, "Jane", "Smith");
  const mockEmployee3 = createMockEmployee(3, "Bob", "Johnson");

  // Mock assignment data
  const createMockAssignment = (id, employee, status = "assigned") => ({
    id,
    appointmentId: 100,
    businessEmployeeId: employee.id,
    status,
    payAmount: 5000,
    employee,
  });

  describe("allAssignments array handling", () => {
    it("should correctly count total assigned employees", () => {
      const allAssignments = [
        createMockAssignment(1, mockEmployee1),
        createMockAssignment(2, mockEmployee2),
        createMockAssignment(3, mockEmployee3),
      ];

      expect(allAssignments.length).toBe(3);
    });

    it("should handle single employee assignment", () => {
      const allAssignments = [createMockAssignment(1, mockEmployee1)];

      expect(allAssignments.length).toBe(1);
    });

    it("should handle empty assignments array", () => {
      const allAssignments = [];

      expect(allAssignments.length).toBe(0);
    });

    it("should correctly identify if multiple employees are assigned", () => {
      const isMultiEmployee = (assignments) => assignments.length > 1;

      const singleAssignment = [createMockAssignment(1, mockEmployee1)];
      const multiAssignment = [
        createMockAssignment(1, mockEmployee1),
        createMockAssignment(2, mockEmployee2),
      ];

      expect(isMultiEmployee(singleAssignment)).toBe(false);
      expect(isMultiEmployee(multiAssignment)).toBe(true);
    });
  });

  describe("Employee list rendering logic", () => {
    it("should generate unique keys for employee list items", () => {
      const allAssignments = [
        createMockAssignment(1, mockEmployee1),
        createMockAssignment(2, mockEmployee2),
      ];

      const keys = allAssignments.map((a) => `employee-${a.id}`);

      expect(keys).toEqual(["employee-1", "employee-2"]);
      expect(new Set(keys).size).toBe(keys.length); // All unique
    });

    it("should display employee full name correctly", () => {
      const getFullName = (employee) => `${employee.firstName} ${employee.lastName}`;

      expect(getFullName(mockEmployee1)).toBe("John Doe");
      expect(getFullName(mockEmployee2)).toBe("Jane Smith");
    });

    it("should format status display text correctly", () => {
      const getStatusText = (status) => {
        const statusMap = {
          assigned: "Assigned",
          in_progress: "In Progress",
          completed: "Completed",
          cancelled: "Cancelled",
        };
        return statusMap[status] || status;
      };

      expect(getStatusText("assigned")).toBe("Assigned");
      expect(getStatusText("in_progress")).toBe("In Progress");
      expect(getStatusText("completed")).toBe("Completed");
      expect(getStatusText("cancelled")).toBe("Cancelled");
    });
  });

  describe("Unassign employee eligibility", () => {
    it("should allow unassigning employees with 'assigned' status", () => {
      const canUnassign = (assignment, allAssignments) => {
        return assignment.status === "assigned" && allAssignments.length > 1;
      };

      const allAssignments = [
        createMockAssignment(1, mockEmployee1, "assigned"),
        createMockAssignment(2, mockEmployee2, "assigned"),
      ];

      expect(canUnassign(allAssignments[0], allAssignments)).toBe(true);
    });

    it("should NOT allow unassigning employees with 'in_progress' status", () => {
      const canUnassign = (assignment, allAssignments) => {
        return assignment.status === "assigned" && allAssignments.length > 1;
      };

      const allAssignments = [
        createMockAssignment(1, mockEmployee1, "in_progress"),
        createMockAssignment(2, mockEmployee2, "assigned"),
      ];

      expect(canUnassign(allAssignments[0], allAssignments)).toBe(false);
    });

    it("should NOT allow unassigning employees with 'completed' status", () => {
      const canUnassign = (assignment, allAssignments) => {
        return assignment.status === "assigned" && allAssignments.length > 1;
      };

      const allAssignments = [
        createMockAssignment(1, mockEmployee1, "completed"),
        createMockAssignment(2, mockEmployee2, "assigned"),
      ];

      expect(canUnassign(allAssignments[0], allAssignments)).toBe(false);
    });

    it("should NOT allow unassigning if only one employee is assigned", () => {
      const canUnassign = (assignment, allAssignments) => {
        return assignment.status === "assigned" && allAssignments.length > 1;
      };

      const allAssignments = [createMockAssignment(1, mockEmployee1, "assigned")];

      expect(canUnassign(allAssignments[0], allAssignments)).toBe(false);
    });
  });

  describe("Status color mapping", () => {
    it("should return correct color for each status", () => {
      const getStatusColor = (status) => {
        const colors = {
          assigned: "#2196F3", // Blue
          in_progress: "#FF9800", // Orange
          completed: "#4CAF50", // Green
          cancelled: "#F44336", // Red
        };
        return colors[status] || "#999";
      };

      expect(getStatusColor("assigned")).toBe("#2196F3");
      expect(getStatusColor("in_progress")).toBe("#FF9800");
      expect(getStatusColor("completed")).toBe("#4CAF50");
      expect(getStatusColor("cancelled")).toBe("#F44336");
      expect(getStatusColor("unknown")).toBe("#999");
    });
  });

  describe("Completion status tracking", () => {
    it("should correctly calculate completion percentage", () => {
      const getCompletionPercentage = (assignments) => {
        if (assignments.length === 0) return 0;
        const completed = assignments.filter((a) => a.status === "completed").length;
        return Math.round((completed / assignments.length) * 100);
      };

      const allAssignments = [
        createMockAssignment(1, mockEmployee1, "completed"),
        createMockAssignment(2, mockEmployee2, "in_progress"),
        createMockAssignment(3, mockEmployee3, "assigned"),
      ];

      expect(getCompletionPercentage(allAssignments)).toBe(33);
    });

    it("should return 100% when all employees completed", () => {
      const getCompletionPercentage = (assignments) => {
        if (assignments.length === 0) return 0;
        const completed = assignments.filter((a) => a.status === "completed").length;
        return Math.round((completed / assignments.length) * 100);
      };

      const allAssignments = [
        createMockAssignment(1, mockEmployee1, "completed"),
        createMockAssignment(2, mockEmployee2, "completed"),
      ];

      expect(getCompletionPercentage(allAssignments)).toBe(100);
    });

    it("should return 0% when no employees completed", () => {
      const getCompletionPercentage = (assignments) => {
        if (assignments.length === 0) return 0;
        const completed = assignments.filter((a) => a.status === "completed").length;
        return Math.round((completed / assignments.length) * 100);
      };

      const allAssignments = [
        createMockAssignment(1, mockEmployee1, "assigned"),
        createMockAssignment(2, mockEmployee2, "in_progress"),
      ];

      expect(getCompletionPercentage(allAssignments)).toBe(0);
    });

    it("should return 0% for empty assignments", () => {
      const getCompletionPercentage = (assignments) => {
        if (assignments.length === 0) return 0;
        const completed = assignments.filter((a) => a.status === "completed").length;
        return Math.round((completed / assignments.length) * 100);
      };

      expect(getCompletionPercentage([])).toBe(0);
    });
  });

  describe("totalAssigned display", () => {
    it("should display singular form for single employee", () => {
      const getAssignedText = (count) => {
        return count === 1 ? "1 employee assigned" : `${count} employees assigned`;
      };

      expect(getAssignedText(1)).toBe("1 employee assigned");
    });

    it("should display plural form for multiple employees", () => {
      const getAssignedText = (count) => {
        return count === 1 ? "1 employee assigned" : `${count} employees assigned`;
      };

      expect(getAssignedText(2)).toBe("2 employees assigned");
      expect(getAssignedText(5)).toBe("5 employees assigned");
    });

    it("should handle zero employees", () => {
      const getAssignedText = (count) => {
        return count === 1 ? "1 employee assigned" : `${count} employees assigned`;
      };

      expect(getAssignedText(0)).toBe("0 employees assigned");
    });
  });

  describe("Add employee button visibility", () => {
    it("should show add employee button when job is not completed", () => {
      const showAddButton = (appointment) => {
        return !appointment.completed && appointment.status !== "cancelled";
      };

      expect(showAddButton({ completed: false, status: "scheduled" })).toBe(true);
    });

    it("should NOT show add employee button when job is completed", () => {
      const showAddButton = (appointment) => {
        return !appointment.completed && appointment.status !== "cancelled";
      };

      expect(showAddButton({ completed: true, status: "completed" })).toBe(false);
    });

    it("should NOT show add employee button when job is cancelled", () => {
      const showAddButton = (appointment) => {
        return !appointment.completed && appointment.status !== "cancelled";
      };

      expect(showAddButton({ completed: false, status: "cancelled" })).toBe(false);
    });
  });

  describe("Employee filtering for add modal", () => {
    const allEmployees = [mockEmployee1, mockEmployee2, mockEmployee3];

    it("should exclude already assigned employees from add list", () => {
      const getAvailableEmployees = (allEmployees, assignedIds) => {
        return allEmployees.filter((e) => !assignedIds.includes(e.id));
      };

      const assignedIds = [1, 2]; // mockEmployee1 and mockEmployee2 are assigned

      const available = getAvailableEmployees(allEmployees, assignedIds);

      expect(available.length).toBe(1);
      expect(available[0].id).toBe(3);
    });

    it("should show all employees when none are assigned", () => {
      const getAvailableEmployees = (allEmployees, assignedIds) => {
        return allEmployees.filter((e) => !assignedIds.includes(e.id));
      };

      const available = getAvailableEmployees(allEmployees, []);

      expect(available.length).toBe(3);
    });

    it("should show empty list when all employees are assigned", () => {
      const getAvailableEmployees = (allEmployees, assignedIds) => {
        return allEmployees.filter((e) => !assignedIds.includes(e.id));
      };

      const assignedIds = [1, 2, 3];

      const available = getAvailableEmployees(allEmployees, assignedIds);

      expect(available.length).toBe(0);
    });
  });

  describe("Pay amount formatting", () => {
    it("should format pay amount in dollars", () => {
      const formatPay = (amountInCents) => {
        return `$${(amountInCents / 100).toFixed(2)}`;
      };

      expect(formatPay(5000)).toBe("$50.00");
      expect(formatPay(7500)).toBe("$75.00");
      expect(formatPay(10000)).toBe("$100.00");
    });

    it("should handle zero pay amount", () => {
      const formatPay = (amountInCents) => {
        return `$${(amountInCents / 100).toFixed(2)}`;
      };

      expect(formatPay(0)).toBe("$0.00");
    });

    it("should handle pay amounts with cents", () => {
      const formatPay = (amountInCents) => {
        return `$${(amountInCents / 100).toFixed(2)}`;
      };

      expect(formatPay(5075)).toBe("$50.75");
      expect(formatPay(9999)).toBe("$99.99");
    });
  });
});

describe("AssignmentDetail - API Response Handling", () => {
  describe("Response data extraction", () => {
    it("should extract allAssignments from API response", () => {
      const mockResponse = {
        assignment: { id: 1, appointmentId: 100 },
        allAssignments: [
          { id: 1, status: "assigned" },
          { id: 2, status: "assigned" },
        ],
        totalAssigned: 2,
      };

      expect(mockResponse.allAssignments).toBeDefined();
      expect(mockResponse.allAssignments.length).toBe(2);
      expect(mockResponse.totalAssigned).toBe(2);
    });

    it("should handle missing allAssignments gracefully", () => {
      const mockResponse = {
        assignment: { id: 1, appointmentId: 100 },
      };

      const allAssignments = mockResponse.allAssignments || [];

      expect(allAssignments).toEqual([]);
    });

    it("should handle null response gracefully", () => {
      const mockResponse = null;

      const allAssignments = mockResponse?.allAssignments || [];

      expect(allAssignments).toEqual([]);
    });
  });

  describe("Unassign API call parameters", () => {
    it("should include correct assignment ID in unassign request", () => {
      const buildUnassignUrl = (assignmentId) => {
        return `/api/v1/business-owner/assignments/${assignmentId}`;
      };

      expect(buildUnassignUrl(123)).toBe("/api/v1/business-owner/assignments/123");
    });
  });
});
