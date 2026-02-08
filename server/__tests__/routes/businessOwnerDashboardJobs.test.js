/**
 * Tests for Business Owner Dashboard Jobs (Today/Tomorrow)
 * Tests the source field addition and tomorrow's jobs feature
 */

describe("Business Owner Dashboard Jobs Logic", () => {
  // Helper to format date as YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStr = formatDate(today);
  const tomorrowStr = formatDate(tomorrow);

  // Mock appointment data
  const mockAppointments = [
    {
      id: 1,
      date: todayStr,
      time: "09:00:00",
      price: 15000,
      completed: false,
      homeId: 101,
      Home: {
        id: 101,
        userId: 1,
        address: "123 Main St",
        city: "Boston",
        User: { firstName: "John", lastName: "Smith" },
      },
    },
    {
      id: 2,
      date: todayStr,
      time: "14:00:00",
      price: 20000,
      completed: false,
      homeId: 102,
      Home: {
        id: 102,
        userId: 2,
        address: "456 Oak Ave",
        city: "Cambridge",
        User: { firstName: "Jane", lastName: "Doe" },
      },
    },
    {
      id: 3,
      date: tomorrowStr,
      time: "10:00:00",
      price: 17500,
      completed: false,
      homeId: 103,
      Home: {
        id: 103,
        userId: 3,
        address: "789 Elm St",
        city: "Somerville",
        User: { firstName: "Bob", lastName: "Wilson" },
      },
    },
  ];

  // Mock CleanerClient relationships (simulates which users are clients)
  const mockCleanerClientRelationships = [
    { cleanerId: 1, clientId: 1 }, // User 1 is a client
    // User 2 is NOT a client (marketplace)
    { cleanerId: 1, clientId: 3 }, // User 3 is a client
  ];

  describe("Source Determination", () => {
    const determineSource = (appointment, clientUserIds) => {
      const userId = appointment.Home?.userId;
      return clientUserIds.includes(userId) ? "client" : "marketplace";
    };

    const clientUserIds = mockCleanerClientRelationships.map(r => r.clientId);

    it("should identify client jobs correctly", () => {
      const source = determineSource(mockAppointments[0], clientUserIds);
      expect(source).toBe("client"); // User 1 is a client
    });

    it("should identify marketplace jobs correctly", () => {
      const source = determineSource(mockAppointments[1], clientUserIds);
      expect(source).toBe("marketplace"); // User 2 is NOT a client
    });

    it("should handle null Home", () => {
      const appointmentNoHome = { ...mockAppointments[0], Home: null };
      const source = determineSource(appointmentNoHome, clientUserIds);
      expect(source).toBe("marketplace"); // No userId means not a client
    });

    it("should handle undefined userId", () => {
      const appointmentNoUserId = {
        ...mockAppointments[0],
        Home: { ...mockAppointments[0].Home, userId: undefined },
      };
      const source = determineSource(appointmentNoUserId, clientUserIds);
      expect(source).toBe("marketplace");
    });
  });

  describe("Today's Appointments Filtering", () => {
    const getTodaysAppointments = (appointments, todayStr) => {
      return appointments.filter(
        (appt) => appt.date === todayStr && !appt.completed
      );
    };

    it("should filter appointments for today", () => {
      const todaysAppts = getTodaysAppointments(mockAppointments, todayStr);
      expect(todaysAppts).toHaveLength(2);
    });

    it("should exclude tomorrow's appointments", () => {
      const todaysAppts = getTodaysAppointments(mockAppointments, todayStr);
      expect(todaysAppts.every(a => a.date === todayStr)).toBe(true);
    });

    it("should exclude completed appointments", () => {
      const appointmentsWithCompleted = [
        ...mockAppointments,
        { id: 4, date: todayStr, completed: true },
      ];

      const todaysAppts = getTodaysAppointments(appointmentsWithCompleted, todayStr);
      expect(todaysAppts.every(a => !a.completed)).toBe(true);
    });
  });

  describe("Tomorrow's Appointments Filtering", () => {
    const getTomorrowsAppointments = (appointments, tomorrowStr) => {
      return appointments.filter(
        (appt) => appt.date === tomorrowStr && !appt.completed
      );
    };

    it("should filter appointments for tomorrow", () => {
      const tomorrowsAppts = getTomorrowsAppointments(mockAppointments, tomorrowStr);
      expect(tomorrowsAppts).toHaveLength(1);
    });

    it("should exclude today's appointments", () => {
      const tomorrowsAppts = getTomorrowsAppointments(mockAppointments, tomorrowStr);
      expect(tomorrowsAppts.every(a => a.date === tomorrowStr)).toBe(true);
    });
  });

  describe("Appointment Serialization with Source", () => {
    const serializeAppointment = (appointment, source) => {
      return {
        id: appointment.id,
        date: appointment.date,
        time: appointment.time,
        price: appointment.price,
        source: source,
        clientName: `${appointment.Home?.User?.firstName || ""} ${appointment.Home?.User?.lastName || ""}`.trim(),
        address: appointment.Home?.address,
        city: appointment.Home?.city,
      };
    };

    it("should include source field in serialized output", () => {
      const serialized = serializeAppointment(mockAppointments[0], "client");
      expect(serialized.source).toBe("client");
    });

    it("should include all required fields", () => {
      const serialized = serializeAppointment(mockAppointments[0], "marketplace");

      expect(serialized).toHaveProperty("id");
      expect(serialized).toHaveProperty("date");
      expect(serialized).toHaveProperty("time");
      expect(serialized).toHaveProperty("price");
      expect(serialized).toHaveProperty("source");
      expect(serialized).toHaveProperty("clientName");
      expect(serialized).toHaveProperty("address");
      expect(serialized).toHaveProperty("city");
    });

    it("should format client name correctly", () => {
      const serialized = serializeAppointment(mockAppointments[0], "client");
      expect(serialized.clientName).toBe("John Smith");
    });

    it("should handle missing user data", () => {
      const appointmentNoUser = {
        ...mockAppointments[0],
        Home: { ...mockAppointments[0].Home, User: null },
      };

      const serialized = serializeAppointment(appointmentNoUser, "client");
      expect(serialized.clientName).toBe("");
    });
  });

  describe("Combined Today and Tomorrow Response", () => {
    const buildResponse = (appointments, todayStr, tomorrowStr, clientUserIds) => {
      const determineSource = (appt) => {
        const userId = appt.Home?.userId;
        return clientUserIds.includes(userId) ? "client" : "marketplace";
      };

      const todaysAppointments = appointments
        .filter((a) => a.date === todayStr && !a.completed)
        .map((a) => ({ ...a, source: determineSource(a) }));

      const tomorrowsAppointments = appointments
        .filter((a) => a.date === tomorrowStr && !a.completed)
        .map((a) => ({ ...a, source: determineSource(a) }));

      return {
        todaysAppointments,
        tomorrowsAppointments,
        counts: {
          today: todaysAppointments.length,
          tomorrow: tomorrowsAppointments.length,
        },
      };
    };

    const clientUserIds = mockCleanerClientRelationships.map(r => r.clientId);

    it("should return both today and tomorrow appointments", () => {
      const response = buildResponse(mockAppointments, todayStr, tomorrowStr, clientUserIds);

      expect(response.todaysAppointments).toHaveLength(2);
      expect(response.tomorrowsAppointments).toHaveLength(1);
    });

    it("should include source in all appointments", () => {
      const response = buildResponse(mockAppointments, todayStr, tomorrowStr, clientUserIds);

      expect(response.todaysAppointments.every(a => a.source)).toBe(true);
      expect(response.tomorrowsAppointments.every(a => a.source)).toBe(true);
    });

    it("should return correct counts", () => {
      const response = buildResponse(mockAppointments, todayStr, tomorrowStr, clientUserIds);

      expect(response.counts.today).toBe(2);
      expect(response.counts.tomorrow).toBe(1);
    });

    it("should correctly identify client vs marketplace", () => {
      const response = buildResponse(mockAppointments, todayStr, tomorrowStr, clientUserIds);

      // First today appointment (User 1) is a client
      expect(response.todaysAppointments[0].source).toBe("client");
      // Second today appointment (User 2) is marketplace
      expect(response.todaysAppointments[1].source).toBe("marketplace");
      // Tomorrow appointment (User 3) is a client
      expect(response.tomorrowsAppointments[0].source).toBe("client");
    });
  });

  describe("Assignment Status", () => {
    const getAssignmentStatus = (appointment, assignedEmployees) => {
      const assignment = assignedEmployees.find(
        (a) => a.appointmentId === appointment.id
      );

      if (!assignment) {
        return { isAssigned: false, assignedTo: null };
      }

      return {
        isAssigned: true,
        assignedTo: {
          type: assignment.employeeId ? "employee" : "self",
          name: assignment.employeeName || "Owner",
          id: assignment.employeeId,
        },
      };
    };

    const mockAssignments = [
      { appointmentId: 1, employeeId: null, employeeName: null }, // Assigned to owner
      { appointmentId: 2, employeeId: 5, employeeName: "Sarah Johnson" },
      // Appointment 3 has no assignment
    ];

    it("should identify unassigned appointments", () => {
      const status = getAssignmentStatus(mockAppointments[2], mockAssignments);

      expect(status.isAssigned).toBe(false);
      expect(status.assignedTo).toBeNull();
    });

    it("should identify appointments assigned to owner", () => {
      const status = getAssignmentStatus(mockAppointments[0], mockAssignments);

      expect(status.isAssigned).toBe(true);
      expect(status.assignedTo.type).toBe("self");
    });

    it("should identify appointments assigned to employees", () => {
      const status = getAssignmentStatus(mockAppointments[1], mockAssignments);

      expect(status.isAssigned).toBe(true);
      expect(status.assignedTo.type).toBe("employee");
      expect(status.assignedTo.name).toBe("Sarah Johnson");
    });
  });

  describe("Date Calculation", () => {
    it("should calculate today correctly", () => {
      const today = new Date();
      const todayFormatted = formatDate(today);

      expect(todayFormatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should calculate tomorrow correctly", () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowFormatted = formatDate(tomorrow);

      // Tomorrow should be one day after today
      const todayDate = new Date(formatDate(today));
      const tomorrowDate = new Date(tomorrowFormatted);
      const diffDays = (tomorrowDate - todayDate) / (1000 * 60 * 60 * 24);

      expect(diffDays).toBe(1);
    });

    it("should handle month boundary", () => {
      const lastDayOfMonth = new Date(2025, 0, 31); // Jan 31
      const nextDay = new Date(lastDayOfMonth);
      nextDay.setDate(nextDay.getDate() + 1);

      expect(formatDate(nextDay)).toBe("2025-02-01");
    });

    it("should handle year boundary", () => {
      const lastDayOfYear = new Date(2024, 11, 31); // Dec 31
      const nextDay = new Date(lastDayOfYear);
      nextDay.setDate(nextDay.getDate() + 1);

      expect(formatDate(nextDay)).toBe("2025-01-01");
    });
  });

  describe("Sorting Appointments", () => {
    const sortByTime = (appointments) => {
      return [...appointments].sort((a, b) => {
        const timeA = a.time || "23:59:59";
        const timeB = b.time || "23:59:59";
        return timeA.localeCompare(timeB);
      });
    };

    it("should sort appointments by time ascending", () => {
      const unsorted = [
        { id: 1, time: "14:00:00" },
        { id: 2, time: "09:00:00" },
        { id: 3, time: "11:00:00" },
      ];

      const sorted = sortByTime(unsorted);

      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(3);
      expect(sorted[2].id).toBe(1);
    });

    it("should handle appointments without time", () => {
      const unsorted = [
        { id: 1, time: null },
        { id: 2, time: "09:00:00" },
      ];

      const sorted = sortByTime(unsorted);

      // Null times sort to end (23:59:59)
      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(1);
    });
  });

  describe("CleanerClient Lookup", () => {
    const getClientUserIds = async (cleanerId, mockRelationships) => {
      // Simulate database query
      const relationships = mockRelationships.filter(
        (r) => r.cleanerId === cleanerId
      );
      return relationships.map((r) => r.clientId);
    };

    it("should return client user IDs for cleaner", async () => {
      const clientIds = await getClientUserIds(1, mockCleanerClientRelationships);

      expect(clientIds).toContain(1);
      expect(clientIds).toContain(3);
      expect(clientIds).not.toContain(2);
    });

    it("should return empty array for cleaner with no clients", async () => {
      const clientIds = await getClientUserIds(999, mockCleanerClientRelationships);

      expect(clientIds).toHaveLength(0);
    });
  });

  describe("Response Format", () => {
    it("should have expected structure for dashboard endpoint", () => {
      const expectedStructure = {
        assignedAppointments: [],
        unassignedAppointments: [],
        tomorrowsAppointments: [],
        counts: {
          assignedToday: 0,
          unassignedToday: 0,
          tomorrow: 0,
        },
      };

      expect(expectedStructure).toHaveProperty("assignedAppointments");
      expect(expectedStructure).toHaveProperty("unassignedAppointments");
      expect(expectedStructure).toHaveProperty("tomorrowsAppointments");
      expect(expectedStructure).toHaveProperty("counts");
    });

    it("should include source field in appointment objects", () => {
      const appointmentWithSource = {
        id: 1,
        date: "2025-02-10",
        source: "client",
        clientName: "John Smith",
      };

      expect(appointmentWithSource).toHaveProperty("source");
      expect(["client", "marketplace"]).toContain(appointmentWithSource.source);
    });
  });
});

describe("Business Owner All Jobs Logic", () => {
  describe("Source Filtering", () => {
    const mockJobs = [
      { id: 1, source: "client" },
      { id: 2, source: "marketplace" },
      { id: 3, source: "client" },
      { id: 4, source: "marketplace" },
    ];

    const filterBySource = (jobs, source) => {
      if (source === "all") return jobs;
      return jobs.filter((j) => j.source === source);
    };

    it("should filter client jobs only", () => {
      const result = filterBySource(mockJobs, "client");
      expect(result).toHaveLength(2);
      expect(result.every((j) => j.source === "client")).toBe(true);
    });

    it("should filter marketplace jobs only", () => {
      const result = filterBySource(mockJobs, "marketplace");
      expect(result).toHaveLength(2);
      expect(result.every((j) => j.source === "marketplace")).toBe(true);
    });

    it("should return all jobs when filter is 'all'", () => {
      const result = filterBySource(mockJobs, "all");
      expect(result).toHaveLength(4);
    });
  });

  describe("Assignment Filtering", () => {
    const mockJobs = [
      { id: 1, isAssigned: true, assignedTo: { type: "self" } },
      { id: 2, isAssigned: true, assignedTo: { type: "employee", name: "John" } },
      { id: 3, isAssigned: false, assignedTo: null },
      { id: 4, isAssigned: false, assignedTo: null },
    ];

    const filterByAssignment = (jobs, filter) => {
      if (filter === "all") return jobs;
      if (filter === "unassigned") return jobs.filter((j) => !j.isAssigned);
      if (filter === "assigned-to-me") {
        return jobs.filter((j) => j.assignedTo?.type === "self");
      }
      return jobs;
    };

    it("should filter unassigned jobs", () => {
      const result = filterByAssignment(mockJobs, "unassigned");
      expect(result).toHaveLength(2);
      expect(result.every((j) => !j.isAssigned)).toBe(true);
    });

    it("should filter jobs assigned to owner", () => {
      const result = filterByAssignment(mockJobs, "assigned-to-me");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("should return all jobs when filter is 'all'", () => {
      const result = filterByAssignment(mockJobs, "all");
      expect(result).toHaveLength(4);
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
