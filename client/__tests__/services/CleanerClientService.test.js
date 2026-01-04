// Mock fetch
global.fetch = jest.fn();

// Mock the config
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

const CleanerClientService = require("../../src/services/fetchRequests/CleanerClientService").default;

describe("CleanerClientService", () => {
  const mockToken = "test_token_12345";
  const cleanerClientId = 1;
  const clientId = 100;
  const scheduleId = 50;
  const appointmentId = 200;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  // =====================
  // CLEANER ENDPOINTS
  // =====================

  describe("inviteClient", () => {
    const clientData = {
      email: "client@example.com",
      firstName: "John",
      lastName: "Doe",
      phone: "555-1234",
      address: "123 Main St",
      city: "Anytown",
      state: "CA",
      zip: "12345",
      numBeds: 3,
      numBaths: 2,
    };

    it("should invite client successfully", async () => {
      const mockResponse = {
        success: true,
        cleanerClient: {
          id: 1,
          clientId: 100,
          inviteStatus: "pending_invite",
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.inviteClient(mockToken, clientData);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients/invite",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify(clientData),
        })
      );
      expect(result.success).toBe(true);
      expect(result.cleanerClient).toBeDefined();
    });

    it("should return error on network failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.inviteClient(mockToken, clientData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to send invitation");
    });
  });

  describe("getClients", () => {
    it("should fetch all clients", async () => {
      const mockResponse = {
        clients: [
          { id: 1, clientName: "John Doe", inviteStatus: "active" },
          { id: 2, clientName: "Jane Smith", inviteStatus: "pending_invite" },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.getClients(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients",
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        })
      );
      expect(result.clients).toHaveLength(2);
    });

    it("should fetch clients with status filter", async () => {
      const mockResponse = {
        clients: [{ id: 1, clientName: "John Doe", inviteStatus: "active" }],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.getClients(mockToken, "active");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients?status=active",
        expect.any(Object)
      );
      expect(result.clients).toHaveLength(1);
    });

    it("should return empty list on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.getClients(mockToken);

      expect(result.clients).toEqual([]);
    });
  });

  describe("getClient", () => {
    it("should fetch a specific client", async () => {
      const mockResponse = {
        cleanerClient: {
          id: 1,
          clientId: 100,
          inviteStatus: "active",
          defaultPrice: 150,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.getClient(mockToken, cleanerClientId);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients/1",
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        })
      );
      expect(result.cleanerClient.id).toBe(1);
    });

    it("should return null on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.getClient(mockToken, cleanerClientId);

      expect(result).toBeNull();
    });
  });

  describe("getClientFull", () => {
    it("should fetch full client details", async () => {
      const mockResponse = {
        cleanerClient: { id: 1, clientId: 100 },
        client: { id: 100, firstName: "John", lastName: "Doe" },
        home: { id: 10, numBeds: 3, numBaths: 2 },
        appointments: [],
        recurringSchedules: [],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.getClientFull(mockToken, cleanerClientId);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients/1/full",
        expect.any(Object)
      );
      expect(result.cleanerClient).toBeDefined();
      expect(result.client).toBeDefined();
      expect(result.home).toBeDefined();
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.getClientFull(mockToken, cleanerClientId);

      expect(result.error).toBe("Failed to fetch client details");
    });
  });

  describe("updateClientHome", () => {
    it("should update client home details", async () => {
      const updates = { specialNotes: "Use back door", keyPadCode: "1234" };
      const mockResponse = {
        success: true,
        home: { id: 10, specialNotes: "Use back door", keyPadCode: "1234" },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.updateClientHome(mockToken, cleanerClientId, updates);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients/1/home",
        expect.objectContaining({
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify(updates),
        })
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.updateClientHome(mockToken, cleanerClientId, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update home details");
    });
  });

  describe("updateClient", () => {
    it("should update client relationship", async () => {
      const updates = { defaultPrice: 175 };
      const mockResponse = {
        success: true,
        cleanerClient: { id: 1, defaultPrice: 175 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.updateClient(mockToken, cleanerClientId, updates);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients/1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(updates),
        })
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.updateClient(mockToken, cleanerClientId, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update client");
    });
  });

  describe("deactivateClient", () => {
    it("should deactivate client relationship", async () => {
      const mockResponse = { success: true };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.deactivateClient(mockToken, cleanerClientId);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients/1",
        expect.objectContaining({
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        })
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.deactivateClient(mockToken, cleanerClientId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to deactivate client");
    });
  });

  describe("resendInvite", () => {
    it("should resend invitation successfully", async () => {
      const mockResponse = { success: true };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.resendInvite(mockToken, cleanerClientId);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients/1/resend-invite",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        })
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.resendInvite(mockToken, cleanerClientId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to resend invitation");
    });
  });

  describe("bookForClient", () => {
    const bookingData = {
      date: "2026-01-15",
      price: 175,
      timeWindow: "anytime",
      notes: "Spring cleaning",
    };

    it("should book appointment for client", async () => {
      const mockResponse = {
        success: true,
        appointment: {
          id: 200,
          date: "2026-01-15",
          price: 175,
          status: "pending_client",
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.bookForClient(mockToken, cleanerClientId, bookingData);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients/1/book-for-client",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(bookingData),
        })
      );
      expect(result.success).toBe(true);
      expect(result.appointment.id).toBe(200);
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.bookForClient(mockToken, cleanerClientId, bookingData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to book appointment");
    });
  });

  // =====================
  // PUBLIC INVITATION ENDPOINTS
  // =====================

  describe("validateInvitation", () => {
    const inviteToken = "abc123token";

    it("should validate invitation successfully", async () => {
      const mockResponse = {
        valid: true,
        invitation: {
          cleanerName: "Jane Cleaner",
          clientEmail: "client@example.com",
          address: "123 Main St",
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.validateInvitation(inviteToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients/invitations/abc123token"
      );
      expect(result.valid).toBe(true);
      expect(result.invitation.cleanerName).toBe("Jane Cleaner");
    });

    it("should return invalid on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.validateInvitation(inviteToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Failed to validate invitation");
    });
  });

  describe("acceptInvitation", () => {
    const inviteToken = "abc123token";
    const userData = {
      password: "securePassword123",
      phone: "555-1234",
    };

    it("should accept invitation successfully", async () => {
      const mockResponse = {
        success: true,
        user: { id: 100, email: "client@example.com" },
        token: "auth_token_12345",
        home: { id: 10, numBeds: 3, numBaths: 2 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.acceptInvitation(inviteToken, userData);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients/invitations/abc123token/accept",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(userData),
        })
      );
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.acceptInvitation(inviteToken, userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to accept invitation");
    });
  });

  describe("declineInvitation", () => {
    const inviteToken = "abc123token";

    it("should decline invitation successfully", async () => {
      const mockResponse = { success: true };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.declineInvitation(inviteToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients/invitations/abc123token/decline",
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.declineInvitation(inviteToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to decline invitation");
    });
  });

  // =====================
  // RECURRING SCHEDULES
  // =====================

  describe("createRecurringSchedule", () => {
    const scheduleData = {
      cleanerClientId: 1,
      frequency: "weekly",
      dayOfWeek: 3,
      timeWindow: "anytime",
      price: 175,
      startDate: "2026-01-15",
    };

    it("should create recurring schedule", async () => {
      const mockResponse = {
        success: true,
        schedule: { id: 50, frequency: "weekly" },
        appointmentsCreated: 4,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.createRecurringSchedule(mockToken, scheduleData);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/recurring-schedules",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(scheduleData),
        })
      );
      expect(result.success).toBe(true);
      expect(result.appointmentsCreated).toBe(4);
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.createRecurringSchedule(mockToken, scheduleData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to create recurring schedule");
    });
  });

  describe("getRecurringSchedules", () => {
    it("should fetch all recurring schedules", async () => {
      const mockResponse = {
        schedules: [
          { id: 50, frequency: "weekly" },
          { id: 51, frequency: "biweekly" },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.getRecurringSchedules(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/recurring-schedules?activeOnly=true",
        expect.any(Object)
      );
      expect(result.schedules).toHaveLength(2);
    });

    it("should fetch schedules filtered by client", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ schedules: [{ id: 50 }] }),
      });

      await CleanerClientService.getRecurringSchedules(mockToken, cleanerClientId);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/recurring-schedules?cleanerClientId=1&activeOnly=true",
        expect.any(Object)
      );
    });

    it("should return empty list on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.getRecurringSchedules(mockToken);

      expect(result.schedules).toEqual([]);
    });
  });

  describe("getRecurringSchedule", () => {
    it("should fetch a specific schedule", async () => {
      const mockResponse = {
        schedule: { id: 50, frequency: "weekly", dayOfWeek: 3 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.getRecurringSchedule(mockToken, scheduleId);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/recurring-schedules/50",
        expect.any(Object)
      );
      expect(result.schedule.id).toBe(50);
    });

    it("should return null on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.getRecurringSchedule(mockToken, scheduleId);

      expect(result).toBeNull();
    });
  });

  describe("updateRecurringSchedule", () => {
    it("should update schedule", async () => {
      const updates = { price: 200 };
      const mockResponse = {
        success: true,
        schedule: { id: 50, price: 200 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.updateRecurringSchedule(mockToken, scheduleId, updates);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/recurring-schedules/50",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(updates),
        })
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.updateRecurringSchedule(mockToken, scheduleId, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update recurring schedule");
    });
  });

  describe("deleteRecurringSchedule", () => {
    it("should delete schedule", async () => {
      const mockResponse = { success: true };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.deleteRecurringSchedule(mockToken, scheduleId);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/recurring-schedules/50",
        expect.objectContaining({
          method: "DELETE",
        })
      );
      expect(result.success).toBe(true);
    });

    it("should delete schedule and cancel future appointments", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await CleanerClientService.deleteRecurringSchedule(mockToken, scheduleId, true);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/recurring-schedules/50?cancelFutureAppointments=true",
        expect.any(Object)
      );
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.deleteRecurringSchedule(mockToken, scheduleId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to delete recurring schedule");
    });
  });

  describe("pauseRecurringSchedule", () => {
    it("should pause schedule", async () => {
      const mockResponse = {
        success: true,
        schedule: { id: 50, isPaused: true },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.pauseRecurringSchedule(mockToken, scheduleId, "2026-02-01", "Vacation");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/recurring-schedules/50/pause",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ until: "2026-02-01", reason: "Vacation" }),
        })
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.pauseRecurringSchedule(mockToken, scheduleId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to pause recurring schedule");
    });
  });

  describe("resumeRecurringSchedule", () => {
    it("should resume schedule", async () => {
      const mockResponse = {
        success: true,
        schedule: { id: 50, isPaused: false },
        appointmentsCreated: 4,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.resumeRecurringSchedule(mockToken, scheduleId);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/recurring-schedules/50/resume",
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(result.success).toBe(true);
      expect(result.appointmentsCreated).toBe(4);
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.resumeRecurringSchedule(mockToken, scheduleId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to resume recurring schedule");
    });
  });

  // =====================
  // PREFERRED CLEANER ENDPOINTS
  // =====================

  describe("getClientAppointments", () => {
    it("should fetch client appointments", async () => {
      const mockResponse = {
        pending: [{ id: 200 }],
        declined: [],
        upcoming: [{ id: 201 }, { id: 202 }],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.getClientAppointments(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/preferred-cleaner/my-client-appointments",
        expect.any(Object)
      );
      expect(result.pending).toHaveLength(1);
      expect(result.upcoming).toHaveLength(2);
    });

    it("should return empty lists on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.getClientAppointments(mockToken);

      expect(result.pending).toEqual([]);
      expect(result.declined).toEqual([]);
      expect(result.upcoming).toEqual([]);
    });
  });

  describe("getPendingClientResponses", () => {
    it("should fetch pending client responses", async () => {
      const mockResponse = {
        pending: [{ id: 200 }],
        declined: [],
        expired: [],
        total: 1,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.getPendingClientResponses(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients/pending-client-responses",
        expect.any(Object)
      );
      expect(result.total).toBe(1);
    });

    it("should return empty lists on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.getPendingClientResponses(mockToken);

      expect(result.pending).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("acceptClientAppointment", () => {
    it("should accept appointment", async () => {
      const mockResponse = {
        success: true,
        appointment: { id: 200, status: "confirmed" },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.acceptClientAppointment(mockToken, appointmentId);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/preferred-cleaner/appointments/200/accept",
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.acceptClientAppointment(mockToken, appointmentId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to accept appointment");
    });
  });

  describe("declineClientAppointment", () => {
    it("should decline appointment", async () => {
      const mockResponse = {
        success: true,
        appointment: { id: 200, status: "declined_by_preferred" },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.declineClientAppointment(mockToken, appointmentId);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/preferred-cleaner/appointments/200/decline",
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.declineClientAppointment(mockToken, appointmentId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to decline appointment");
    });
  });

  describe("getPendingResponses", () => {
    it("should fetch pending responses", async () => {
      const mockResponse = {
        appointments: [{ id: 200 }],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.getPendingResponses(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/preferred-cleaner/pending-responses",
        expect.any(Object)
      );
      expect(result.appointments).toHaveLength(1);
    });

    it("should return empty list on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.getPendingResponses(mockToken);

      expect(result.appointments).toEqual([]);
    });
  });

  describe("respondToDecline", () => {
    it("should respond with cancel", async () => {
      const mockResponse = {
        success: true,
        action: "cancelled",
        message: "Appointment cancelled",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.respondToDecline(mockToken, appointmentId, "cancel");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/preferred-cleaner/appointments/200/respond",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "cancel" }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.action).toBe("cancelled");
    });

    it("should respond with open_to_market", async () => {
      const mockResponse = {
        success: true,
        action: "opened",
        originalPrice: 150,
        newPrice: 175,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.respondToDecline(mockToken, appointmentId, "open_to_market");

      expect(result.success).toBe(true);
      expect(result.originalPrice).toBe(150);
      expect(result.newPrice).toBe(175);
    });

    it("should return error on failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.respondToDecline(mockToken, appointmentId, "cancel");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to respond");
    });
  });

  // =====================
  // PLATFORM PRICING ENDPOINTS
  // =====================

  describe("getPlatformPrice", () => {
    it("should fetch platform price for a client's home", async () => {
      const mockResponse = {
        platformPrice: 175,
        numBeds: 3,
        numBaths: 2,
        breakdown: {
          beds: 3,
          baths: 2,
          linens: "not included",
          timeWindow: "anytime",
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.getPlatformPrice(mockToken, cleanerClientId);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients/1/platform-price",
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        })
      );
      expect(result.platformPrice).toBe(175);
      expect(result.numBeds).toBe(3);
      expect(result.numBaths).toBe(2);
      expect(result.breakdown).toBeDefined();
    });

    it("should return platform price with half baths", async () => {
      const mockResponse = {
        platformPrice: 185,
        numBeds: 3,
        numBaths: 2.5,
        breakdown: {
          beds: 3,
          baths: 2.5,
          linens: "not included",
          timeWindow: "anytime",
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.getPlatformPrice(mockToken, cleanerClientId);

      expect(result.platformPrice).toBe(185);
      expect(result.numBaths).toBe(2.5);
    });

    it("should return error when no home associated", async () => {
      const mockResponse = {
        error: "No home associated with this client",
      };

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.getPlatformPrice(mockToken, cleanerClientId);

      expect(result.error).toBe("No home associated with this client");
    });

    it("should return error on network failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.getPlatformPrice(mockToken, cleanerClientId);

      expect(result.error).toBe("Failed to fetch platform price");
    });

    it("should return error when client not found", async () => {
      const mockResponse = {
        error: "Client not found",
      };

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.getPlatformPrice(mockToken, cleanerClientId);

      expect(result.error).toBe("Client not found");
    });
  });

  describe("updateDefaultPrice", () => {
    it("should update default price successfully", async () => {
      const mockResponse = {
        success: true,
        cleanerClient: {
          id: 1,
          defaultPrice: 175,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.updateDefaultPrice(mockToken, cleanerClientId, 175);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/cleaner-clients/1/default-price",
        expect.objectContaining({
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify({ price: 175 }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.cleanerClient.defaultPrice).toBe(175);
    });

    it("should update price to zero", async () => {
      const mockResponse = {
        success: true,
        cleanerClient: {
          id: 1,
          defaultPrice: 0,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.updateDefaultPrice(mockToken, cleanerClientId, 0);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ price: 0 }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.cleanerClient.defaultPrice).toBe(0);
    });

    it("should return error when price is negative", async () => {
      const mockResponse = {
        error: "Price must be a positive number",
      };

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.updateDefaultPrice(mockToken, cleanerClientId, -50);

      expect(result.error).toBe("Price must be a positive number");
    });

    it("should return error when price is missing", async () => {
      const mockResponse = {
        error: "Price is required",
      };

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.updateDefaultPrice(mockToken, cleanerClientId, undefined);

      expect(result.error).toBe("Price is required");
    });

    it("should return error when client not found", async () => {
      const mockResponse = {
        error: "Client not found",
      };

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.updateDefaultPrice(mockToken, 999, 175);

      expect(result.error).toBe("Client not found");
    });

    it("should return error on network failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await CleanerClientService.updateDefaultPrice(mockToken, cleanerClientId, 175);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update price");
    });

    it("should handle decimal prices", async () => {
      const mockResponse = {
        success: true,
        cleanerClient: {
          id: 1,
          defaultPrice: 175.50,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await CleanerClientService.updateDefaultPrice(mockToken, cleanerClientId, 175.50);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ price: 175.50 }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.cleanerClient.defaultPrice).toBe(175.50);
    });
  });
});
