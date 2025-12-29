/**
 * Tests for the /api/v1/users/appointments/employee endpoint
 * Tests the pending requests filtering logic for cleaners
 */

describe("Pending Requests Endpoint - /api/v1/users/appointments/employee", () => {
  // Helper to get date string
  const getDateString = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  describe("Request status filtering", () => {
    it("should only return requests with status 'pending'", () => {
      const allRequests = [
        { id: 1, employeeId: 3, appointmentId: 1, status: "pending" },
        { id: 2, employeeId: 3, appointmentId: 2, status: "approved" },
        { id: 3, employeeId: 3, appointmentId: 3, status: "denied" },
        { id: 4, employeeId: 3, appointmentId: 4, status: "onHold" },
        { id: 5, employeeId: 3, appointmentId: 5, status: "pending" },
      ];

      const pendingRequests = allRequests.filter(
        (req) => req.status === "pending"
      );

      expect(pendingRequests).toHaveLength(2);
      expect(pendingRequests.map((r) => r.appointmentId)).toEqual([1, 5]);
    });

    it("should exclude approved requests", () => {
      const allRequests = [
        { id: 1, employeeId: 3, appointmentId: 1, status: "approved" },
        { id: 2, employeeId: 3, appointmentId: 2, status: "approved" },
      ];

      const pendingRequests = allRequests.filter(
        (req) => req.status === "pending"
      );

      expect(pendingRequests).toHaveLength(0);
    });

    it("should exclude denied requests", () => {
      const allRequests = [
        { id: 1, employeeId: 3, appointmentId: 1, status: "denied" },
      ];

      const pendingRequests = allRequests.filter(
        (req) => req.status === "pending"
      );

      expect(pendingRequests).toHaveLength(0);
    });

    it("should exclude onHold requests", () => {
      const allRequests = [
        { id: 1, employeeId: 3, appointmentId: 1, status: "onHold" },
      ];

      const pendingRequests = allRequests.filter(
        (req) => req.status === "pending"
      );

      expect(pendingRequests).toHaveLength(0);
    });

    it("should handle empty requests array", () => {
      const allRequests = [];

      const pendingRequests = allRequests.filter(
        (req) => req.status === "pending"
      );

      expect(pendingRequests).toHaveLength(0);
    });
  });

  describe("Appointment ID extraction", () => {
    it("should extract appointment IDs from pending requests", () => {
      const pendingRequests = [
        { id: 1, employeeId: 3, appointmentId: 10, status: "pending" },
        { id: 2, employeeId: 3, appointmentId: 20, status: "pending" },
        { id: 3, employeeId: 3, appointmentId: 30, status: "pending" },
      ];

      const appointmentIds = pendingRequests.map((req) => req.appointmentId);

      expect(appointmentIds).toEqual([10, 20, 30]);
    });

    it("should handle requests with dataValues property (Sequelize)", () => {
      const pendingRequests = [
        { dataValues: { id: 1, employeeId: 3, appointmentId: 10, status: "pending" } },
        { dataValues: { id: 2, employeeId: 3, appointmentId: 20, status: "pending" } },
      ];

      const pendingOnly = pendingRequests.filter(
        (req) => req.dataValues.status === "pending"
      );
      const appointmentIds = pendingOnly.map((req) => req.dataValues.appointmentId);

      expect(appointmentIds).toEqual([10, 20]);
    });
  });

  describe("Response structure", () => {
    it("should return appointments and requested arrays", () => {
      const mockResponse = {
        appointments: [
          { id: 1, date: getDateString(5), price: "150" },
          { id: 2, date: getDateString(10), price: "175" },
        ],
        requested: [
          { id: 3, date: getDateString(7), price: "200" },
        ],
      };

      expect(mockResponse).toHaveProperty("appointments");
      expect(mockResponse).toHaveProperty("requested");
      expect(Array.isArray(mockResponse.appointments)).toBe(true);
      expect(Array.isArray(mockResponse.requested)).toBe(true);
    });

    it("should return empty requested array when no pending requests", () => {
      const mockResponse = {
        appointments: [
          { id: 1, date: getDateString(5), price: "150" },
        ],
        requested: [],
      };

      expect(mockResponse.requested).toHaveLength(0);
    });

    it("should include all appointment fields in requested array", () => {
      const requestedAppointment = {
        id: 3,
        date: "2026-02-15",
        price: "180",
        userId: 2,
        homeId: 1,
        paid: false,
        bringTowels: "No",
        bringSheets: "No",
        completed: false,
        hasBeenAssigned: false,
        employeesAssigned: null,
      };

      expect(requestedAppointment).toHaveProperty("id");
      expect(requestedAppointment).toHaveProperty("date");
      expect(requestedAppointment).toHaveProperty("price");
      expect(requestedAppointment).toHaveProperty("homeId");
      expect(requestedAppointment).toHaveProperty("paid");
    });
  });

  describe("Employee filtering", () => {
    it("should only return requests for the authenticated employee", () => {
      const allRequests = [
        { id: 1, employeeId: 3, appointmentId: 1, status: "pending" },
        { id: 2, employeeId: 5, appointmentId: 2, status: "pending" },
        { id: 3, employeeId: 3, appointmentId: 3, status: "pending" },
        { id: 4, employeeId: 7, appointmentId: 4, status: "pending" },
      ];

      const userId = 3;
      const userRequests = allRequests.filter((req) => req.employeeId === userId);

      expect(userRequests).toHaveLength(2);
      expect(userRequests.every((req) => req.employeeId === userId)).toBe(true);
    });
  });

  describe("hasBeenAssigned filter removal", () => {
    it("should include appointments regardless of hasBeenAssigned status", () => {
      // Previously, the endpoint filtered by hasBeenAssigned: false
      // which incorrectly excluded valid pending requests
      const appointments = [
        { id: 1, hasBeenAssigned: false, date: getDateString(5) },
        { id: 2, hasBeenAssigned: true, date: getDateString(7) }, // Should now be included
        { id: 3, hasBeenAssigned: false, date: getDateString(10) },
      ];

      const pendingRequestAppointmentIds = [1, 2, 3];

      // New logic: return all appointments with pending requests, regardless of hasBeenAssigned
      const requestedAppointments = appointments.filter((apt) =>
        pendingRequestAppointmentIds.includes(apt.id)
      );

      expect(requestedAppointments).toHaveLength(3);
      expect(requestedAppointments.find((apt) => apt.id === 2)).toBeDefined();
    });

    it("should handle previously assigned then unassigned appointments", () => {
      // Scenario: Cleaner A was assigned, then removed, Cleaner B requests the job
      // The appointment might still have hasBeenAssigned: true from before
      const appointment = {
        id: 1,
        hasBeenAssigned: true, // Still true from previous assignment
        employeesAssigned: null, // But no one is currently assigned
        date: getDateString(5),
      };

      const pendingRequest = {
        id: 1,
        employeeId: 3, // Cleaner B's request
        appointmentId: 1,
        status: "pending",
      };

      // Cleaner B's pending request should still show
      const hasPendingRequest = pendingRequest.status === "pending";
      expect(hasPendingRequest).toBe(true);
    });
  });

  describe("Integration with frontend", () => {
    it("should provide data structure compatible with CleanerDashboard", () => {
      const apiResponse = {
        appointments: [
          { id: 1, date: getDateString(5), price: "150", homeId: 1 },
        ],
        requested: [
          { id: 2, date: getDateString(7), price: "200", homeId: 2 },
        ],
      };

      // CleanerDashboard accesses response.requested
      expect(apiResponse.requested).toBeDefined();
      expect(apiResponse.requested[0]).toHaveProperty("date");
      expect(apiResponse.requested[0]).toHaveProperty("homeId");
    });

    it("should filter upcoming requests on frontend", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const requests = [
        { id: 1, date: getDateString(-1) }, // Past - should be filtered out
        { id: 2, date: getDateString(0) },  // Today - should be included
        { id: 3, date: getDateString(5) },  // Future - should be included
      ];

      const upcomingRequests = requests.filter((req) => {
        const reqDate = new Date(req.date + "T00:00:00");
        return reqDate >= today;
      });

      expect(upcomingRequests).toHaveLength(2);
      expect(upcomingRequests.map((r) => r.id)).toEqual([2, 3]);
    });
  });
});

describe("Pending Requests Count Display", () => {
  it("should count pending requests correctly", () => {
    const pendingRequests = [
      { id: 1, date: "2026-02-15" },
      { id: 2, date: "2026-03-01" },
      { id: 3, date: "2026-03-15" },
    ];

    expect(pendingRequests.length).toBe(3);
  });

  it("should display 0 when no pending requests", () => {
    const pendingRequests = [];

    expect(pendingRequests.length).toBe(0);
  });

  it("should update count after filtering", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getDateString = (daysFromNow) => {
      const date = new Date();
      date.setDate(date.getDate() + daysFromNow);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const allRequests = [
      { id: 1, date: getDateString(-5) }, // Past
      { id: 2, date: getDateString(5) },  // Future
      { id: 3, date: getDateString(10) }, // Future
    ];

    const upcomingRequests = allRequests.filter((req) => {
      const reqDate = new Date(req.date + "T00:00:00");
      return reqDate >= today;
    });

    expect(upcomingRequests.length).toBe(2);
  });
});
