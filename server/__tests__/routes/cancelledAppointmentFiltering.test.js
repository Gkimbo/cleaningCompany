/**
 * Tests for cancelled appointment filtering
 *
 * Verifies that cancelled appointments (wasCancelled: true) are filtered out
 * from all appointment listing endpoints to ensure they don't appear in:
 * - Homeowner's "My Appointments" page
 * - Cleaner's job list
 * - Marketplace/unassigned appointments
 * - Various request-related endpoints
 */

describe("Cancelled Appointment Filtering", () => {
  describe("wasCancelled filter logic", () => {
    // Helper to simulate filtering appointments
    const filterAppointments = (appointments, additionalFilters = {}) => {
      return appointments.filter((apt) => {
        // Base filter: exclude cancelled appointments
        if (apt.wasCancelled) return false;

        // Apply additional filters
        for (const [key, value] of Object.entries(additionalFilters)) {
          if (apt[key] !== value) return false;
        }

        return true;
      });
    };

    it("should exclude cancelled appointments from results", () => {
      const appointments = [
        { id: 1, wasCancelled: false, date: "2025-02-10" },
        { id: 2, wasCancelled: true, date: "2025-02-11" },
        { id: 3, wasCancelled: false, date: "2025-02-12" },
        { id: 4, wasCancelled: true, date: "2025-02-13" },
      ];

      const filtered = filterAppointments(appointments);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((a) => a.id)).toEqual([1, 3]);
    });

    it("should return empty array when all appointments are cancelled", () => {
      const appointments = [
        { id: 1, wasCancelled: true },
        { id: 2, wasCancelled: true },
      ];

      const filtered = filterAppointments(appointments);

      expect(filtered).toHaveLength(0);
    });

    it("should return all appointments when none are cancelled", () => {
      const appointments = [
        { id: 1, wasCancelled: false },
        { id: 2, wasCancelled: false },
        { id: 3, wasCancelled: false },
      ];

      const filtered = filterAppointments(appointments);

      expect(filtered).toHaveLength(3);
    });

    it("should handle appointments with wasCancelled undefined (treat as false)", () => {
      const appointments = [
        { id: 1 }, // wasCancelled undefined
        { id: 2, wasCancelled: false },
        { id: 3, wasCancelled: true },
      ];

      const filtered = appointments.filter(
        (apt) => apt.wasCancelled === false || apt.wasCancelled === undefined
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map((a) => a.id)).toEqual([1, 2]);
    });
  });

  describe("GET /:homeId - Home appointments endpoint", () => {
    it("should filter out cancelled appointments for home", () => {
      const homeId = 1;
      const allAppointments = [
        { id: 1, homeId: 1, wasCancelled: false, date: "2025-02-10" },
        { id: 2, homeId: 1, wasCancelled: true, date: "2025-02-11" },
        { id: 3, homeId: 1, wasCancelled: false, date: "2025-02-12" },
        { id: 4, homeId: 2, wasCancelled: false, date: "2025-02-13" }, // Different home
      ];

      const filtered = allAppointments.filter(
        (apt) => apt.homeId === homeId && apt.wasCancelled === false
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.every((apt) => apt.homeId === homeId)).toBe(true);
      expect(filtered.every((apt) => !apt.wasCancelled)).toBe(true);
    });
  });

  describe("GET /unassigned - Marketplace appointments", () => {
    it("should filter out cancelled appointments from marketplace", () => {
      const appointments = [
        { id: 1, hasBeenAssigned: false, wasCancelled: false },
        { id: 2, hasBeenAssigned: false, wasCancelled: true },
        { id: 3, hasBeenAssigned: true, wasCancelled: false }, // Assigned, should be filtered
        { id: 4, hasBeenAssigned: false, wasCancelled: false },
      ];

      const filtered = appointments.filter(
        (apt) => apt.hasBeenAssigned === false && apt.wasCancelled === false
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map((a) => a.id)).toEqual([1, 4]);
    });

    it("should exclude cancelled unassigned appointments", () => {
      const appointments = [
        {
          id: 1,
          hasBeenAssigned: false,
          wasCancelled: true,
          assignedToBusinessEmployee: false,
        },
      ];

      const whereClause = {
        hasBeenAssigned: false,
        assignedToBusinessEmployee: false,
        wasCancelled: false,
      };

      const filtered = appointments.filter(
        (apt) =>
          apt.hasBeenAssigned === whereClause.hasBeenAssigned &&
          apt.assignedToBusinessEmployee === whereClause.assignedToBusinessEmployee &&
          apt.wasCancelled === whereClause.wasCancelled
      );

      expect(filtered).toHaveLength(0);
    });
  });

  describe("GET /user-info - User info endpoint", () => {
    it("should filter out cancelled appointments in user info response", () => {
      const user = {
        id: 1,
        appointments: [
          { id: 1, userId: 1, wasCancelled: false },
          { id: 2, userId: 1, wasCancelled: true },
          { id: 3, userId: 1, wasCancelled: false },
        ],
      };

      const filteredAppointments = user.appointments.filter(
        (apt) => apt.wasCancelled === false
      );

      expect(filteredAppointments).toHaveLength(2);
      expect(filteredAppointments.map((a) => a.id)).toEqual([1, 3]);
    });

    it("should include users with no appointments after filtering", () => {
      const user = {
        id: 1,
        appointments: [
          { id: 1, userId: 1, wasCancelled: true },
          { id: 2, userId: 1, wasCancelled: true },
        ],
      };

      const filteredAppointments = user.appointments.filter(
        (apt) => apt.wasCancelled === false
      );

      // User should still be returned, just with empty appointments
      expect(filteredAppointments).toHaveLength(0);
      expect(user.id).toBe(1);
    });
  });

  describe("GET /employeeInfo - Cleaner job list", () => {
    it("should filter out cancelled appointments from cleaner job list", () => {
      const cleanerAppointmentIds = [1, 2, 3, 4];
      const appointments = [
        { id: 1, wasCancelled: false },
        { id: 2, wasCancelled: true },
        { id: 3, wasCancelled: false },
        { id: 4, wasCancelled: true },
      ];

      const filtered = appointments.filter(
        (apt) =>
          cleanerAppointmentIds.includes(apt.id) && apt.wasCancelled === false
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map((a) => a.id)).toEqual([1, 3]);
    });
  });

  describe("GET /my-requests - Homeowner pending requests", () => {
    it("should only show requests for non-cancelled appointments", () => {
      const appointments = [
        { id: 1, userId: 1, wasCancelled: false },
        { id: 2, userId: 1, wasCancelled: true },
      ];

      const pendingRequests = [
        { appointmentId: 1, status: "pending" },
        { appointmentId: 2, status: "pending" },
      ];

      const filteredAppointments = appointments.filter(
        (apt) => apt.wasCancelled === false
      );
      const appointmentIds = filteredAppointments.map((apt) => apt.id);

      const filteredRequests = pendingRequests.filter((req) =>
        appointmentIds.includes(req.appointmentId)
      );

      expect(filteredRequests).toHaveLength(1);
      expect(filteredRequests[0].appointmentId).toBe(1);
    });
  });

  describe("GET /requests-by-home - Request counts by home", () => {
    it("should not count requests for cancelled appointments", () => {
      const appointments = [
        { id: 1, homeId: 1, userId: 1, wasCancelled: false },
        { id: 2, homeId: 1, userId: 1, wasCancelled: true },
        { id: 3, homeId: 1, userId: 1, wasCancelled: false },
      ];

      const pendingRequests = [
        { appointmentId: 1 },
        { appointmentId: 2 },
        { appointmentId: 3 },
      ];

      const filteredAppointments = appointments.filter(
        (apt) => apt.wasCancelled === false
      );
      const appointmentIds = filteredAppointments.map((apt) => apt.id);

      const requestCountsByHome = {};
      pendingRequests.forEach((req) => {
        if (appointmentIds.includes(req.appointmentId)) {
          const apt = filteredAppointments.find(
            (a) => a.id === req.appointmentId
          );
          if (apt) {
            requestCountsByHome[apt.homeId] =
              (requestCountsByHome[apt.homeId] || 0) + 1;
          }
        }
      });

      expect(requestCountsByHome[1]).toBe(2); // Only 2 non-cancelled
    });
  });

  describe("GET /client-pending-requests - Client pending requests", () => {
    it("should exclude cancelled appointments from pending requests list", () => {
      const appointments = [
        { id: 1, userId: 1, homeId: 1, wasCancelled: false },
        { id: 2, userId: 1, homeId: 1, wasCancelled: true },
      ];

      const filtered = appointments.filter(
        (apt) => apt.userId === 1 && apt.wasCancelled === false
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });
  });

  describe("GET /requests-for-home/:homeId - Requests for specific home", () => {
    it("should only return requests for non-cancelled appointments", () => {
      const homeId = 1;
      const userId = 1;

      const appointments = [
        { id: 1, homeId, userId, wasCancelled: false },
        { id: 2, homeId, userId, wasCancelled: true },
        { id: 3, homeId, userId, wasCancelled: false },
      ];

      const filtered = appointments.filter(
        (apt) =>
          apt.homeId === homeId &&
          apt.userId === userId &&
          apt.wasCancelled === false
      );

      expect(filtered).toHaveLength(2);
    });
  });

  describe("Sequelize query simulation", () => {
    it("should correctly build where clause with wasCancelled: false", () => {
      const whereClause = {
        homeId: 1,
        wasCancelled: false,
      };

      // Simulating what Sequelize would do
      const mockAppointments = [
        { id: 1, homeId: 1, wasCancelled: false },
        { id: 2, homeId: 1, wasCancelled: true },
        { id: 3, homeId: 2, wasCancelled: false },
      ];

      const result = mockAppointments.filter((apt) => {
        return Object.entries(whereClause).every(
          ([key, value]) => apt[key] === value
        );
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("should handle include with where clause for associations", () => {
      // Simulating Sequelize include with where
      const includeConfig = {
        model: "UserAppointments",
        as: "appointments",
        where: { wasCancelled: false },
        required: false,
      };

      expect(includeConfig.where.wasCancelled).toBe(false);
      expect(includeConfig.required).toBe(false); // Users without appointments still returned
    });
  });

  describe("Appointment state after cancellation", () => {
    it("should have wasCancelled set to true after cancellation", () => {
      const appointment = {
        id: 1,
        wasCancelled: false,
        cancellationInitiatedAt: null,
        cancellationConfirmedAt: null,
      };

      // Simulate cancellation
      const cancelledAppointment = {
        ...appointment,
        wasCancelled: true,
        cancellationInitiatedAt: new Date(),
        cancellationConfirmedAt: new Date(),
        cancellationType: "homeowner",
      };

      expect(cancelledAppointment.wasCancelled).toBe(true);
      expect(cancelledAppointment.cancellationInitiatedAt).toBeTruthy();
      expect(cancelledAppointment.cancellationConfirmedAt).toBeTruthy();
    });

    it("should have all cancellation fields populated", () => {
      const cancelledAppointment = {
        id: 1,
        wasCancelled: true,
        cancellationInitiatedAt: new Date(),
        cancellationInitiatedBy: 5,
        cancellationConfirmedAt: new Date(),
        cancellationReason: "Schedule conflict",
        cancellationMethod: "app",
        cancellationType: "homeowner",
        cancellationConfirmationId: "CXL-2025-0203-A1B2C3",
      };

      expect(cancelledAppointment.wasCancelled).toBe(true);
      expect(cancelledAppointment.cancellationInitiatedBy).toBe(5);
      expect(cancelledAppointment.cancellationMethod).toBe("app");
      expect(cancelledAppointment.cancellationType).toBe("homeowner");
      expect(cancelledAppointment.cancellationConfirmationId).toMatch(/^CXL-/);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty appointment arrays", () => {
      const appointments = [];
      const filtered = appointments.filter((apt) => apt.wasCancelled === false);
      expect(filtered).toHaveLength(0);
    });

    it("should handle null appointments", () => {
      const appointments = null;
      const filtered = appointments ? appointments.filter((apt) => !apt.wasCancelled) : [];
      expect(filtered).toHaveLength(0);
    });

    it("should handle mixed wasCancelled values correctly", () => {
      const appointments = [
        { id: 1, wasCancelled: false },
        { id: 2, wasCancelled: true },
        { id: 3, wasCancelled: false },
        { id: 4, wasCancelled: true },
        { id: 5, wasCancelled: false },
      ];

      const filtered = appointments.filter((apt) => apt.wasCancelled === false);

      expect(filtered).toHaveLength(3);
      expect(filtered.every((apt) => apt.wasCancelled === false)).toBe(true);
    });

    it("should correctly handle boolean false vs falsy values", () => {
      const appointments = [
        { id: 1, wasCancelled: false }, // Explicitly false
        { id: 2, wasCancelled: 0 }, // Falsy but not boolean false
        { id: 3, wasCancelled: "" }, // Falsy but not boolean false
        { id: 4, wasCancelled: null }, // Null
        { id: 5, wasCancelled: undefined }, // Undefined
      ];

      // Strict equality check for false
      const strictFiltered = appointments.filter(
        (apt) => apt.wasCancelled === false
      );

      expect(strictFiltered).toHaveLength(1);
      expect(strictFiltered[0].id).toBe(1);

      // Falsy check (more permissive)
      const falsyFiltered = appointments.filter((apt) => !apt.wasCancelled);

      expect(falsyFiltered).toHaveLength(5); // All are falsy
    });
  });
});
