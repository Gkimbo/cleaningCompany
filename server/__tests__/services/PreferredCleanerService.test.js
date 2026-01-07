/**
 * Tests for PreferredCleanerService
 * Handles the preferred cleaner decline flow for business owner clients
 */

// Mock dependencies before requiring the service
jest.mock("../../services/sendNotifications/EmailClass");
jest.mock("../../services/sendNotifications/PushNotificationClass");
jest.mock("../../services/EncryptionService");

const Email = require("../../services/sendNotifications/EmailClass");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");
const EncryptionService = require("../../services/EncryptionService");

// Mock EncryptionService.decrypt to return decrypted values
EncryptionService.decrypt = jest.fn((value) => {
  if (!value) return value;
  return value.replace("encrypted_", "");
});

// Import the service after mocks
const PreferredCleanerService = require("../../services/PreferredCleanerService");

describe("PreferredCleanerService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("declineAppointment", () => {
    const cleanerId = 100;
    const clientId = 200;
    const appointmentId = 300;

    const createMockModels = (overrides = {}) => {
      const mockAppointmentUpdate = jest.fn().mockResolvedValue(true);
      const mockAppointment = {
        id: appointmentId,
        userId: clientId,
        date: "2025-01-15",
        preferredCleanerDeclined: false,
        hasBeenAssigned: false,
        employeesAssigned: [],
        home: {
          id: 1,
          preferredCleanerId: cleanerId,
          address: "encrypted_123 Main St",
          city: "encrypted_Boston",
        },
        user: {
          id: clientId,
          email: "client@test.com",
          firstName: "Jane",
          expoPushToken: "ExponentPushToken[xxx]",
        },
        update: mockAppointmentUpdate,
        ...overrides,
      };

      return {
        UserAppointments: {
          findByPk: jest.fn().mockResolvedValue(mockAppointment),
        },
        UserHomes: {},
        User: {
          findByPk: jest.fn().mockResolvedValue({
            id: cleanerId,
            firstName: "John",
            lastName: "Cleaner",
          }),
        },
        CleanerClient: {},
        // Added for backup cleaner notification flow
        HomePreferredCleaner: {
          findAll: jest.fn().mockResolvedValue([]),
        },
        PreferredPerksConfig: {
          findOne: jest.fn().mockResolvedValue({
            backupCleanerTimeoutHours: 24,
          }),
        },
        mockAppointment,
        mockAppointmentUpdate,
      };
    };

    it("should decline appointment and notify client", async () => {
      const models = createMockModels();

      Email.prototype = {};
      PushNotification.sendPushNotification = jest.fn().mockResolvedValue(true);

      const result = await PreferredCleanerService.declineAppointment(
        appointmentId,
        cleanerId,
        models
      );

      expect(result.success).toBe(true);
      expect(result.appointment.clientResponsePending).toBe(true);
      // When no backup cleaners, should escalate to client immediately
      expect(models.mockAppointmentUpdate).toHaveBeenCalledWith({
        preferredCleanerDeclined: true,
        declinedAt: expect.any(Date),
        clientResponsePending: true, // No backup cleaners = escalate to client
        backupCleanersNotified: false,
        backupNotificationSentAt: null,
        backupNotificationExpiresAt: null,
      });
    });

    it("should throw error if appointment not found", async () => {
      const models = {
        UserAppointments: {
          findByPk: jest.fn().mockResolvedValue(null),
        },
        User: { findByPk: jest.fn() },
      };

      await expect(
        PreferredCleanerService.declineAppointment(999, cleanerId, models)
      ).rejects.toThrow("Appointment not found");
    });

    it("should throw error if cleaner is not preferred cleaner for home", async () => {
      const models = createMockModels();
      models.UserAppointments.findByPk.mockResolvedValue({
        id: appointmentId,
        home: {
          preferredCleanerId: 999, // Different cleaner
        },
      });

      await expect(
        PreferredCleanerService.declineAppointment(appointmentId, cleanerId, models)
      ).rejects.toThrow("You are not the preferred cleaner for this home");
    });

    it("should throw error if appointment already declined", async () => {
      const models = createMockModels({
        preferredCleanerDeclined: true,
      });

      await expect(
        PreferredCleanerService.declineAppointment(appointmentId, cleanerId, models)
      ).rejects.toThrow("This appointment has already been declined");
    });

    it("should throw error if appointment already assigned", async () => {
      const models = createMockModels({
        hasBeenAssigned: true,
        employeesAssigned: ["500"],
      });

      await expect(
        PreferredCleanerService.declineAppointment(appointmentId, cleanerId, models)
      ).rejects.toThrow("This appointment is already assigned to cleaners");
    });

    it("should decrypt home address for notifications", async () => {
      const models = createMockModels();
      PushNotification.sendPushNotification = jest.fn().mockResolvedValue(true);

      await PreferredCleanerService.declineAppointment(
        appointmentId,
        cleanerId,
        models
      );

      // Verify EncryptionService.decrypt was called for address fields
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_123 Main St");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_Boston");
    });

    it("should send push notification to client", async () => {
      const models = createMockModels();
      PushNotification.sendPushNotification = jest.fn().mockResolvedValue(true);

      await PreferredCleanerService.declineAppointment(
        appointmentId,
        cleanerId,
        models
      );

      expect(PushNotification.sendPushNotification).toHaveBeenCalledWith(
        "ExponentPushToken[xxx]",
        "Cleaner Unavailable",
        expect.stringContaining("John Cleaner"),
        expect.objectContaining({
          type: "preferred_cleaner_declined",
          appointmentId,
        })
      );
    });
  });

  describe("acceptAppointment", () => {
    const cleanerId = 100;
    const clientId = 200;
    const appointmentId = 300;

    const createMockModels = (overrides = {}) => {
      const mockAppointmentUpdate = jest.fn().mockResolvedValue(true);
      const mockAppointment = {
        id: appointmentId,
        userId: clientId,
        date: "2025-01-15",
        preferredCleanerDeclined: false,
        hasBeenAssigned: false,
        home: {
          id: 1,
          preferredCleanerId: cleanerId,
          address: "encrypted_123 Main St",
          city: "encrypted_Boston",
        },
        user: {
          id: clientId,
          email: "client@test.com",
          firstName: "Jane",
          expoPushToken: "ExponentPushToken[xxx]",
        },
        update: mockAppointmentUpdate,
        ...overrides,
      };

      return {
        UserAppointments: {
          findByPk: jest.fn().mockResolvedValue(mockAppointment),
        },
        UserHomes: {},
        User: {
          findByPk: jest.fn().mockResolvedValue({
            id: cleanerId,
            firstName: "John",
            lastName: "Cleaner",
          }),
        },
        UserCleanerAppointments: {
          create: jest.fn().mockResolvedValue({ id: 1 }),
        },
        mockAppointment,
        mockAppointmentUpdate,
      };
    };

    it("should accept appointment and assign cleaner", async () => {
      const models = createMockModels();
      PushNotification.sendPushConfirmation = jest.fn().mockResolvedValue(true);

      const result = await PreferredCleanerService.acceptAppointment(
        appointmentId,
        cleanerId,
        models
      );

      expect(result.success).toBe(true);
      expect(result.appointment.assigned).toBe(true);
      expect(models.mockAppointmentUpdate).toHaveBeenCalledWith({
        hasBeenAssigned: true,
        employeesAssigned: [cleanerId.toString()],
      });
      expect(models.UserCleanerAppointments.create).toHaveBeenCalledWith({
        appointmentId,
        employeeId: cleanerId,
      });
    });

    it("should throw error if appointment not found", async () => {
      const models = {
        UserAppointments: {
          findByPk: jest.fn().mockResolvedValue(null),
        },
        User: { findByPk: jest.fn() },
      };

      await expect(
        PreferredCleanerService.acceptAppointment(999, cleanerId, models)
      ).rejects.toThrow("Appointment not found");
    });

    it("should throw error if cleaner is not preferred cleaner for home", async () => {
      const models = createMockModels();
      models.UserAppointments.findByPk.mockResolvedValue({
        id: appointmentId,
        home: {
          preferredCleanerId: 999,
        },
      });

      await expect(
        PreferredCleanerService.acceptAppointment(appointmentId, cleanerId, models)
      ).rejects.toThrow("You are not the preferred cleaner for this home");
    });

    it("should throw error if appointment was declined", async () => {
      const models = createMockModels({
        preferredCleanerDeclined: true,
      });

      await expect(
        PreferredCleanerService.acceptAppointment(appointmentId, cleanerId, models)
      ).rejects.toThrow("This appointment has been declined");
    });

    it("should throw error if appointment already assigned", async () => {
      const models = createMockModels({
        hasBeenAssigned: true,
      });

      await expect(
        PreferredCleanerService.acceptAppointment(appointmentId, cleanerId, models)
      ).rejects.toThrow("This appointment is already assigned");
    });

    it("should decrypt home address for push notification", async () => {
      const models = createMockModels();
      PushNotification.sendPushConfirmation = jest.fn().mockResolvedValue(true);

      await PreferredCleanerService.acceptAppointment(
        appointmentId,
        cleanerId,
        models
      );

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_123 Main St");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_Boston");
    });
  });

  describe("clientRespond", () => {
    const cleanerId = 100;
    const clientId = 200;
    const appointmentId = 300;

    const createMockModels = (overrides = {}) => {
      const mockAppointmentUpdate = jest.fn().mockResolvedValue(true);
      const mockAppointmentDestroy = jest.fn().mockResolvedValue(true);
      const mockAppointment = {
        id: appointmentId,
        userId: clientId,
        date: "2025-01-15",
        price: "150",
        clientResponsePending: true,
        bringSheets: "false",
        bringTowels: "false",
        home: {
          id: 1,
          numBeds: 3,
          numBaths: 2,
          bedConfigurations: [],
          bathroomConfigurations: [],
        },
        user: {
          id: clientId,
        },
        update: mockAppointmentUpdate,
        destroy: mockAppointmentDestroy,
        ...overrides,
      };

      return {
        UserAppointments: {
          findByPk: jest.fn().mockResolvedValue(mockAppointment),
        },
        UserHomes: {},
        User: { findByPk: jest.fn() },
        mockAppointment,
        mockAppointmentUpdate,
        mockAppointmentDestroy,
      };
    };

    it("should cancel appointment when action is cancel", async () => {
      const models = createMockModels();

      const result = await PreferredCleanerService.clientRespond(
        appointmentId,
        clientId,
        "cancel",
        models
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe("cancelled");
      expect(models.mockAppointmentDestroy).toHaveBeenCalled();
    });

    it("should open to market when action is open_to_market", async () => {
      const models = createMockModels();

      // Mock CalculatePrice
      jest.mock("../../services/CalculatePrice", () => jest.fn().mockResolvedValue(175));

      const result = await PreferredCleanerService.clientRespond(
        appointmentId,
        clientId,
        "open_to_market",
        models
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe("opened_to_market");
      expect(models.mockAppointmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          clientResponsePending: false,
          openToMarket: true,
          openedToMarketAt: expect.any(Date),
          hasBeenAssigned: false,
          employeesAssigned: [],
        })
      );
    });

    it("should throw error if appointment not found", async () => {
      const models = {
        UserAppointments: {
          findByPk: jest.fn().mockResolvedValue(null),
        },
      };

      await expect(
        PreferredCleanerService.clientRespond(999, clientId, "cancel", models)
      ).rejects.toThrow("Appointment not found");
    });

    it("should throw error if user is not the appointment owner", async () => {
      const models = createMockModels({
        userId: 999, // Different user
      });

      await expect(
        PreferredCleanerService.clientRespond(appointmentId, clientId, "cancel", models)
      ).rejects.toThrow("This is not your appointment");
    });

    it("should throw error if no response is pending", async () => {
      const models = createMockModels({
        clientResponsePending: false,
      });

      await expect(
        PreferredCleanerService.clientRespond(appointmentId, clientId, "cancel", models)
      ).rejects.toThrow("No response is pending for this appointment");
    });

    it("should throw error for invalid action", async () => {
      const models = createMockModels();

      await expect(
        PreferredCleanerService.clientRespond(appointmentId, clientId, "invalid", models)
      ).rejects.toThrow("Invalid action. Must be 'cancel' or 'open_to_market'");
    });
  });

  describe("getClientAppointments", () => {
    const cleanerId = 100;

    it("should return empty arrays if cleaner has no homes", async () => {
      const models = {
        UserAppointments: { findAll: jest.fn() },
        UserHomes: {
          findAll: jest.fn().mockResolvedValue([]),
        },
        User: { findByPk: jest.fn() },
        CleanerClient: {},
      };

      const result = await PreferredCleanerService.getClientAppointments(
        cleanerId,
        models
      );

      expect(result).toEqual({ pending: [], declined: [], upcoming: [] });
    });

    it("should categorize appointments correctly", async () => {
      const models = {
        UserHomes: {
          findAll: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
        },
        UserAppointments: {
          findAll: jest.fn().mockResolvedValue([
            // Pending - not yet accepted or declined
            {
              id: 1,
              date: "2025-02-01",
              price: "100",
              timeToBeCompleted: "10-3",
              preferredCleanerDeclined: false,
              hasBeenAssigned: false,
              employeesAssigned: [],
              user: { id: 200, firstName: "Jane", lastName: "Doe" },
              home: {
                id: 1,
                nickName: "Beach House",
                address: "encrypted_123 Main",
                city: "encrypted_Boston",
                numBeds: 3,
                numBaths: 2,
              },
            },
            // Declined - waiting for client
            {
              id: 2,
              date: "2025-02-02",
              price: "150",
              timeToBeCompleted: "11-4",
              preferredCleanerDeclined: true,
              clientResponsePending: true,
              hasBeenAssigned: false,
              user: { id: 201, firstName: "John", lastName: "Smith" },
              home: {
                id: 2,
                nickName: "City Apt",
                address: "encrypted_456 Oak",
                city: "encrypted_NYC",
                numBeds: 2,
                numBaths: 1,
              },
            },
            // Upcoming - accepted
            {
              id: 3,
              date: "2025-02-03",
              price: "200",
              timeToBeCompleted: "anytime",
              preferredCleanerDeclined: false,
              hasBeenAssigned: true,
              employeesAssigned: [cleanerId.toString()],
              user: { id: 202, firstName: "Alice", lastName: "Brown" },
              home: {
                id: 1,
                nickName: "Beach House",
                address: "encrypted_123 Main",
                city: "encrypted_Boston",
                numBeds: 3,
                numBaths: 2,
              },
            },
          ]),
        },
        User: { findByPk: jest.fn() },
        CleanerClient: {},
      };

      const result = await PreferredCleanerService.getClientAppointments(
        cleanerId,
        models
      );

      expect(result.pending).toHaveLength(1);
      expect(result.pending[0].id).toBe(1);

      expect(result.declined).toHaveLength(1);
      expect(result.declined[0].id).toBe(2);
      expect(result.declined[0].awaitingClientResponse).toBe(true);

      expect(result.upcoming).toHaveLength(1);
      expect(result.upcoming[0].id).toBe(3);
    });

    it("should decrypt home addresses in results", async () => {
      const models = {
        UserHomes: {
          findAll: jest.fn().mockResolvedValue([{ id: 1 }]),
        },
        UserAppointments: {
          findAll: jest.fn().mockResolvedValue([
            {
              id: 1,
              date: "2025-02-01",
              price: "100",
              timeToBeCompleted: "10-3",
              preferredCleanerDeclined: false,
              hasBeenAssigned: false,
              employeesAssigned: [],
              user: { id: 200, firstName: "Jane", lastName: "Doe" },
              home: {
                id: 1,
                nickName: "Beach House",
                address: "encrypted_123 Main St",
                city: "encrypted_Boston",
                numBeds: 3,
                numBaths: 2,
              },
            },
          ]),
        },
        User: { findByPk: jest.fn() },
        CleanerClient: {},
      };

      await PreferredCleanerService.getClientAppointments(cleanerId, models);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_123 Main St");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_Boston");
    });
  });

  describe("formatDate", () => {
    it("should format date correctly", () => {
      const result = PreferredCleanerService.formatDate("2025-01-15");
      expect(result).toContain("Jan");
      // The result should contain either 14, 15, or 16 depending on timezone
      expect(result).toMatch(/1[456]/);
    });

    it("should return formatted date string", () => {
      const result = PreferredCleanerService.formatDate("2025-06-20");
      expect(result).toContain("Jun");
      expect(typeof result).toBe("string");
    });
  });
});
