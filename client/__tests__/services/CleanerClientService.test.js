// Mock HttpClient
jest.mock("../../src/services/HttpClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import HttpClient from "../../src/services/HttpClient";

const CleanerClientService = require("../../src/services/fetchRequests/CleanerClientService").default;

describe("CleanerClientService", () => {
  const mockToken = "test_token_12345";
  const cleanerClientId = 1;
  const clientId = 100;
  const scheduleId = 50;
  const appointmentId = 200;

  beforeEach(() => {
    jest.clearAllMocks();
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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.inviteClient(mockToken, clientData);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/cleaner-clients/invite",
        clientData,
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.cleanerClient).toBeDefined();
    });

    it("should return error on network failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.inviteClient(mockToken, clientData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
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

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.getClients(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/cleaner-clients",
        { token: mockToken }
      );
      expect(result.clients).toHaveLength(2);
    });

    it("should fetch clients with status filter", async () => {
      const mockResponse = {
        clients: [{ id: 1, clientName: "John Doe", inviteStatus: "active" }],
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.getClients(mockToken, "active");

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/cleaner-clients?status=active",
        { token: mockToken }
      );
      expect(result.clients).toHaveLength(1);
    });

    it("should return empty list on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.getClient(mockToken, cleanerClientId);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/cleaner-clients/1",
        { token: mockToken }
      );
      expect(result.cleanerClient.id).toBe(1);
    });

    it("should return null on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.getClientFull(mockToken, cleanerClientId);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/cleaner-clients/1/full",
        { token: mockToken }
      );
      expect(result.cleanerClient).toBeDefined();
      expect(result.client).toBeDefined();
      expect(result.home).toBeDefined();
    });

    it("should return error on failure", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.getClientFull(mockToken, cleanerClientId);

      expect(result.error).toBe("Network request failed");
    });
  });

  describe("updateClientHome", () => {
    it("should update client home details", async () => {
      const updates = { specialNotes: "Use back door", keyPadCode: "1234" };
      const mockResponse = {
        success: true,
        home: { id: 10, specialNotes: "Use back door", keyPadCode: "1234" },
      };

      HttpClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.updateClientHome(mockToken, cleanerClientId, updates);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/cleaner-clients/1/home",
        updates,
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.updateClientHome(mockToken, cleanerClientId, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });
  });

  describe("updateClient", () => {
    it("should update client relationship", async () => {
      const updates = { defaultPrice: 175 };
      const mockResponse = {
        success: true,
        cleanerClient: { id: 1, defaultPrice: 175 },
      };

      HttpClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.updateClient(mockToken, cleanerClientId, updates);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/cleaner-clients/1",
        updates,
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.updateClient(mockToken, cleanerClientId, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });
  });

  describe("deactivateClient", () => {
    it("should deactivate client relationship", async () => {
      const mockResponse = { success: true };

      HttpClient.delete.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.deactivateClient(mockToken, cleanerClientId);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/cleaner-clients/1",
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.deactivateClient(mockToken, cleanerClientId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });
  });

  describe("resendInvite", () => {
    it("should resend invitation successfully", async () => {
      const mockResponse = { success: true };

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.resendInvite(mockToken, cleanerClientId);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/cleaner-clients/1/resend-invite",
        {},
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.resendInvite(mockToken, cleanerClientId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.bookForClient(mockToken, cleanerClientId, bookingData);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/cleaner-clients/1/book-for-client",
        bookingData,
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.appointment.id).toBe(200);
    });

    it("should return error on failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.bookForClient(mockToken, cleanerClientId, bookingData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
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

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.validateInvitation(inviteToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/cleaner-clients/invitations/abc123token",
        { skipAuth: true }
      );
      expect(result.valid).toBe(true);
      expect(result.invitation.cleanerName).toBe("Jane Cleaner");
    });

    it("should return invalid on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.validateInvitation(inviteToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Network request failed");
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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.acceptInvitation(inviteToken, userData);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/cleaner-clients/invitations/abc123token/accept",
        userData,
        { skipAuth: true }
      );
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });

    it("should return error on failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.acceptInvitation(inviteToken, userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });
  });

  describe("declineInvitation", () => {
    const inviteToken = "abc123token";

    it("should decline invitation successfully", async () => {
      const mockResponse = { success: true };

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.declineInvitation(inviteToken);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/cleaner-clients/invitations/abc123token/decline",
        {},
        { skipAuth: true }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.declineInvitation(inviteToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.createRecurringSchedule(mockToken, scheduleData);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/recurring-schedules",
        scheduleData,
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.appointmentsCreated).toBe(4);
    });

    it("should return error on failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.createRecurringSchedule(mockToken, scheduleData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
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

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.getRecurringSchedules(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/recurring-schedules?activeOnly=true",
        { token: mockToken }
      );
      expect(result.schedules).toHaveLength(2);
    });

    it("should fetch schedules filtered by client", async () => {
      HttpClient.get.mockResolvedValueOnce({ schedules: [{ id: 50 }] });

      await CleanerClientService.getRecurringSchedules(mockToken, cleanerClientId);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/recurring-schedules?cleanerClientId=1&activeOnly=true",
        { token: mockToken }
      );
    });

    it("should return empty list on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.getRecurringSchedules(mockToken);

      expect(result.schedules).toEqual([]);
    });
  });

  describe("getRecurringSchedule", () => {
    it("should fetch a specific schedule", async () => {
      const mockResponse = {
        schedule: { id: 50, frequency: "weekly", dayOfWeek: 3 },
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.getRecurringSchedule(mockToken, scheduleId);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/recurring-schedules/50",
        { token: mockToken }
      );
      expect(result.schedule.id).toBe(50);
    });

    it("should return null on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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

      HttpClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.updateRecurringSchedule(mockToken, scheduleId, updates);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/recurring-schedules/50",
        updates,
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.updateRecurringSchedule(mockToken, scheduleId, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });
  });

  describe("deleteRecurringSchedule", () => {
    it("should delete schedule", async () => {
      const mockResponse = { success: true };

      HttpClient.delete.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.deleteRecurringSchedule(mockToken, scheduleId);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/recurring-schedules/50",
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should delete schedule and cancel future appointments", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: true });

      await CleanerClientService.deleteRecurringSchedule(mockToken, scheduleId, true);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/recurring-schedules/50?cancelFutureAppointments=true",
        { token: mockToken }
      );
    });

    it("should return error on failure", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.deleteRecurringSchedule(mockToken, scheduleId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });
  });

  describe("pauseRecurringSchedule", () => {
    it("should pause schedule", async () => {
      const mockResponse = {
        success: true,
        schedule: { id: 50, isPaused: true },
      };

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.pauseRecurringSchedule(mockToken, scheduleId, "2026-02-01", "Vacation");

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/recurring-schedules/50/pause",
        { until: "2026-02-01", reason: "Vacation" },
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.pauseRecurringSchedule(mockToken, scheduleId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });
  });

  describe("resumeRecurringSchedule", () => {
    it("should resume schedule", async () => {
      const mockResponse = {
        success: true,
        schedule: { id: 50, isPaused: false },
        appointmentsCreated: 4,
      };

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.resumeRecurringSchedule(mockToken, scheduleId);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/recurring-schedules/50/resume",
        {},
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.appointmentsCreated).toBe(4);
    });

    it("should return error on failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.resumeRecurringSchedule(mockToken, scheduleId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
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

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.getClientAppointments(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/preferred-cleaner/my-client-appointments",
        { token: mockToken }
      );
      expect(result.pending).toHaveLength(1);
      expect(result.upcoming).toHaveLength(2);
    });

    it("should return empty lists on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.getPendingClientResponses(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/cleaner-clients/pending-client-responses",
        { token: mockToken }
      );
      expect(result.total).toBe(1);
    });

    it("should return empty lists on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.acceptClientAppointment(mockToken, appointmentId);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/preferred-cleaner/appointments/200/accept",
        {},
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.acceptClientAppointment(mockToken, appointmentId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });
  });

  describe("declineClientAppointment", () => {
    it("should decline appointment", async () => {
      const mockResponse = {
        success: true,
        appointment: { id: 200, status: "declined_by_preferred" },
      };

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.declineClientAppointment(mockToken, appointmentId);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/preferred-cleaner/appointments/200/decline",
        {},
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.declineClientAppointment(mockToken, appointmentId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });
  });

  describe("getPendingResponses", () => {
    it("should fetch pending responses", async () => {
      const mockResponse = {
        appointments: [{ id: 200 }],
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.getPendingResponses(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/preferred-cleaner/pending-responses",
        { token: mockToken }
      );
      expect(result.appointments).toHaveLength(1);
    });

    it("should return empty list on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.respondToDecline(mockToken, appointmentId, "cancel");

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/preferred-cleaner/appointments/200/respond",
        { action: "cancel" },
        { token: mockToken }
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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.respondToDecline(mockToken, appointmentId, "open_to_market");

      expect(result.success).toBe(true);
      expect(result.originalPrice).toBe(150);
      expect(result.newPrice).toBe(175);
    });

    it("should return error on failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.respondToDecline(mockToken, appointmentId, "cancel");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
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

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.getPlatformPrice(mockToken, cleanerClientId);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/cleaner-clients/1/platform-price",
        { token: mockToken }
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

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.getPlatformPrice(mockToken, cleanerClientId);

      expect(result.platformPrice).toBe(185);
      expect(result.numBaths).toBe(2.5);
    });

    it("should return error when no home associated", async () => {
      const mockResponse = {
        success: false,
        error: "No home associated with this client",
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.getPlatformPrice(mockToken, cleanerClientId);

      expect(result.error).toBe("No home associated with this client");
    });

    it("should return error on network failure", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.getPlatformPrice(mockToken, cleanerClientId);

      expect(result.error).toBe("Network request failed");
    });

    it("should return error when client not found", async () => {
      const mockResponse = {
        success: false,
        error: "Client not found",
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

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

      HttpClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.updateDefaultPrice(mockToken, cleanerClientId, 175);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/cleaner-clients/1/default-price",
        { price: 175 },
        { token: mockToken }
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

      HttpClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.updateDefaultPrice(mockToken, cleanerClientId, 0);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/cleaner-clients/1/default-price",
        { price: 0 },
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.cleanerClient.defaultPrice).toBe(0);
    });

    it("should return error when price is negative", async () => {
      const mockResponse = {
        success: false,
        error: "Price must be a positive number",
      };

      HttpClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.updateDefaultPrice(mockToken, cleanerClientId, -50);

      expect(result.error).toBe("Price must be a positive number");
    });

    it("should return error when price is missing", async () => {
      const mockResponse = {
        success: false,
        error: "Price is required",
      };

      HttpClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.updateDefaultPrice(mockToken, cleanerClientId, undefined);

      expect(result.error).toBe("Price is required");
    });

    it("should return error when client not found", async () => {
      const mockResponse = {
        success: false,
        error: "Client not found",
      };

      HttpClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.updateDefaultPrice(mockToken, 999, 175);

      expect(result.error).toBe("Client not found");
    });

    it("should return error on network failure", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await CleanerClientService.updateDefaultPrice(mockToken, cleanerClientId, 175);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });

    it("should handle decimal prices", async () => {
      const mockResponse = {
        success: true,
        cleanerClient: {
          id: 1,
          defaultPrice: 175.50,
        },
      };

      HttpClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await CleanerClientService.updateDefaultPrice(mockToken, cleanerClientId, 175.50);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/cleaner-clients/1/default-price",
        { price: 175.50 },
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.cleanerClient.defaultPrice).toBe(175.50);
    });
  });
});
