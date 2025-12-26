/**
 * Tests for the supply reminder cron job logic
 * This tests the logic that runs daily at 7 AM to remind cleaners
 * to bring supplies (toilet paper, paper towels, trash bags) before appointments
 */

// Mock dependencies before requiring modules
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
  },
  UserHomes: {},
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushSupplyReminder: jest.fn().mockResolvedValue([{ status: "ok" }]),
}));

const { User, UserAppointments } = require("../../models");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");

describe("Supply Reminder Cron Job Logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to get today's date in YYYY-MM-DD format
  const getTodayString = () => {
    return new Date().toISOString().split("T")[0];
  };

  // Helper to get a date X days from now in YYYY-MM-DD format
  const daysFromNow = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  };

  // Helper to get a date X days from now as a Date object
  const daysFromNowDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  };

  // The logic extracted from the cron job for testing (with snooze check)
  const processSupplyReminders = async () => {
    const todayString = getTodayString();
    const results = { sent: 0, skipped: 0, snoozed: 0, errors: 0 };

    const todaysAppointments = await UserAppointments.findAll({
      where: {
        date: todayString,
        hasBeenAssigned: true,
        completed: false,
      },
      include: [{ model: require("../../models").UserHomes, as: "home" }],
    });

    for (const appointment of todaysAppointments) {
      const cleanerIds = appointment.employeesAssigned || [];

      for (const cleanerId of cleanerIds) {
        try {
          const cleaner = await User.findByPk(cleanerId);
          if (!cleaner || !cleaner.expoPushToken) {
            results.skipped++;
            continue;
          }

          // Check if cleaner has snoozed supply reminders
          if (cleaner.supplyReminderSnoozedUntil) {
            const snoozeEnd = new Date(cleaner.supplyReminderSnoozedUntil);
            if (snoozeEnd > new Date()) {
              results.snoozed++;
              continue;
            }
          }

          const home = appointment.home;
          if (!home) {
            results.skipped++;
            continue;
          }

          const address = {
            street: home.street,
            city: home.city,
          };

          await PushNotification.sendPushSupplyReminder(
            cleaner.expoPushToken,
            cleaner.firstName,
            appointment.date,
            address
          );

          results.sent++;
        } catch (err) {
          results.errors++;
        }
      }
    }

    return results;
  };

  describe("Query Criteria", () => {
    it("should query for today's assigned, incomplete appointments", async () => {
      UserAppointments.findAll.mockResolvedValue([]);

      await processSupplyReminders();

      expect(UserAppointments.findAll).toHaveBeenCalledWith({
        where: {
          date: getTodayString(),
          hasBeenAssigned: true,
          completed: false,
        },
        include: expect.any(Array),
      });
    });

    it("should not query for unassigned appointments", async () => {
      UserAppointments.findAll.mockResolvedValue([]);

      await processSupplyReminders();

      const queryArgs = UserAppointments.findAll.mock.calls[0][0];
      expect(queryArgs.where.hasBeenAssigned).toBe(true);
    });

    it("should not query for completed appointments", async () => {
      UserAppointments.findAll.mockResolvedValue([]);

      await processSupplyReminders();

      const queryArgs = UserAppointments.findAll.mock.calls[0][0];
      expect(queryArgs.where.completed).toBe(false);
    });
  });

  describe("Push Notification Sending", () => {
    it("should send reminder to cleaner with valid push token", async () => {
      const mockAppointment = {
        id: 1,
        date: getTodayString(),
        hasBeenAssigned: true,
        completed: false,
        employeesAssigned: ["1"],
        home: {
          street: "123 Main St",
          city: "Boston",
        },
      };

      const mockCleaner = {
        id: 1,
        firstName: "John",
        expoPushToken: "ExponentPushToken[valid-token]",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockCleaner);

      const results = await processSupplyReminders();

      expect(results.sent).toBe(1);
      expect(PushNotification.sendPushSupplyReminder).toHaveBeenCalledWith(
        "ExponentPushToken[valid-token]",
        "John",
        getTodayString(),
        { street: "123 Main St", city: "Boston" }
      );
    });

    it("should send reminders to multiple cleaners on same appointment", async () => {
      const mockAppointment = {
        id: 1,
        date: getTodayString(),
        hasBeenAssigned: true,
        completed: false,
        employeesAssigned: ["1", "2"],
        home: {
          street: "123 Main St",
          city: "Boston",
        },
      };

      User.findByPk.mockImplementation((id) => ({
        id,
        firstName: `Cleaner${id}`,
        expoPushToken: `ExponentPushToken[token-${id}]`,
      }));

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const results = await processSupplyReminders();

      expect(results.sent).toBe(2);
      expect(PushNotification.sendPushSupplyReminder).toHaveBeenCalledTimes(2);
    });

    it("should process multiple appointments", async () => {
      const mockAppointments = [
        {
          id: 1,
          date: getTodayString(),
          hasBeenAssigned: true,
          completed: false,
          employeesAssigned: ["1"],
          home: { street: "123 Main St", city: "Boston" },
        },
        {
          id: 2,
          date: getTodayString(),
          hasBeenAssigned: true,
          completed: false,
          employeesAssigned: ["2"],
          home: { street: "456 Oak Ave", city: "Cambridge" },
        },
      ];

      User.findByPk.mockImplementation((id) => ({
        id,
        firstName: `Cleaner${id}`,
        expoPushToken: `ExponentPushToken[token-${id}]`,
      }));

      UserAppointments.findAll.mockResolvedValue(mockAppointments);

      const results = await processSupplyReminders();

      expect(results.sent).toBe(2);
      expect(PushNotification.sendPushSupplyReminder).toHaveBeenCalledTimes(2);
    });
  });

  describe("Skipping Cases", () => {
    it("should skip cleaner without push token", async () => {
      const mockAppointment = {
        id: 1,
        date: getTodayString(),
        hasBeenAssigned: true,
        completed: false,
        employeesAssigned: ["1"],
        home: { street: "123 Main St", city: "Boston" },
      };

      const mockCleaner = {
        id: 1,
        firstName: "John",
        expoPushToken: null,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockCleaner);

      const results = await processSupplyReminders();

      expect(results.skipped).toBe(1);
      expect(results.sent).toBe(0);
      expect(PushNotification.sendPushSupplyReminder).not.toHaveBeenCalled();
    });

    it("should skip if cleaner not found", async () => {
      const mockAppointment = {
        id: 1,
        date: getTodayString(),
        hasBeenAssigned: true,
        completed: false,
        employeesAssigned: ["999"],
        home: { street: "123 Main St", city: "Boston" },
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(null);

      const results = await processSupplyReminders();

      expect(results.skipped).toBe(1);
      expect(PushNotification.sendPushSupplyReminder).not.toHaveBeenCalled();
    });

    it("should skip if home is missing", async () => {
      const mockAppointment = {
        id: 1,
        date: getTodayString(),
        hasBeenAssigned: true,
        completed: false,
        employeesAssigned: ["1"],
        home: null,
      };

      const mockCleaner = {
        id: 1,
        firstName: "John",
        expoPushToken: "ExponentPushToken[valid-token]",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockCleaner);

      const results = await processSupplyReminders();

      expect(results.skipped).toBe(1);
      expect(PushNotification.sendPushSupplyReminder).not.toHaveBeenCalled();
    });

    it("should skip appointments with empty employeesAssigned array", async () => {
      const mockAppointment = {
        id: 1,
        date: getTodayString(),
        hasBeenAssigned: true,
        completed: false,
        employeesAssigned: [],
        home: { street: "123 Main St", city: "Boston" },
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const results = await processSupplyReminders();

      expect(results.sent).toBe(0);
      expect(PushNotification.sendPushSupplyReminder).not.toHaveBeenCalled();
    });

    it("should handle null employeesAssigned", async () => {
      const mockAppointment = {
        id: 1,
        date: getTodayString(),
        hasBeenAssigned: true,
        completed: false,
        employeesAssigned: null,
        home: { street: "123 Main St", city: "Boston" },
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const results = await processSupplyReminders();

      expect(results.sent).toBe(0);
      expect(PushNotification.sendPushSupplyReminder).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle push notification errors gracefully", async () => {
      const mockAppointment = {
        id: 1,
        date: getTodayString(),
        hasBeenAssigned: true,
        completed: false,
        employeesAssigned: ["1"],
        home: { street: "123 Main St", city: "Boston" },
      };

      const mockCleaner = {
        id: 1,
        firstName: "John",
        expoPushToken: "ExponentPushToken[valid-token]",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockCleaner);
      PushNotification.sendPushSupplyReminder.mockRejectedValueOnce(
        new Error("Push failed")
      );

      const results = await processSupplyReminders();

      expect(results.errors).toBe(1);
      expect(results.sent).toBe(0);
    });

    it("should continue processing after one cleaner fails", async () => {
      const mockAppointment = {
        id: 1,
        date: getTodayString(),
        hasBeenAssigned: true,
        completed: false,
        employeesAssigned: ["1", "2"],
        home: { street: "123 Main St", city: "Boston" },
      };

      User.findByPk.mockImplementation((id) => ({
        id,
        firstName: `Cleaner${id}`,
        expoPushToken: `ExponentPushToken[token-${id}]`,
      }));

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      // First call fails, second succeeds
      PushNotification.sendPushSupplyReminder
        .mockRejectedValueOnce(new Error("Push failed"))
        .mockResolvedValueOnce([{ status: "ok" }]);

      const results = await processSupplyReminders();

      expect(results.errors).toBe(1);
      expect(results.sent).toBe(1);
      expect(PushNotification.sendPushSupplyReminder).toHaveBeenCalledTimes(2);
    });

    it("should continue processing after one appointment fails", async () => {
      const mockAppointments = [
        {
          id: 1,
          date: getTodayString(),
          hasBeenAssigned: true,
          completed: false,
          employeesAssigned: ["1"],
          home: { street: "123 Main St", city: "Boston" },
        },
        {
          id: 2,
          date: getTodayString(),
          hasBeenAssigned: true,
          completed: false,
          employeesAssigned: ["2"],
          home: { street: "456 Oak Ave", city: "Cambridge" },
        },
      ];

      User.findByPk.mockImplementation((id) => ({
        id,
        firstName: `Cleaner${id}`,
        expoPushToken: `ExponentPushToken[token-${id}]`,
      }));

      UserAppointments.findAll.mockResolvedValue(mockAppointments);

      PushNotification.sendPushSupplyReminder
        .mockRejectedValueOnce(new Error("Push failed"))
        .mockResolvedValueOnce([{ status: "ok" }]);

      const results = await processSupplyReminders();

      expect(results.errors).toBe(1);
      expect(results.sent).toBe(1);
    });
  });

  describe("No Appointments", () => {
    it("should handle no appointments for today", async () => {
      UserAppointments.findAll.mockResolvedValue([]);

      const results = await processSupplyReminders();

      expect(results.sent).toBe(0);
      expect(results.skipped).toBe(0);
      expect(results.errors).toBe(0);
      expect(PushNotification.sendPushSupplyReminder).not.toHaveBeenCalled();
    });
  });

  describe("Snooze Functionality", () => {
    it("should skip cleaner with active snooze", async () => {
      const mockAppointment = {
        id: 1,
        date: getTodayString(),
        hasBeenAssigned: true,
        completed: false,
        employeesAssigned: ["1"],
        home: { street: "123 Main St", city: "Boston" },
      };

      const mockCleaner = {
        id: 1,
        firstName: "John",
        expoPushToken: "ExponentPushToken[valid-token]",
        supplyReminderSnoozedUntil: daysFromNowDate(3), // Snoozed for 3 more days
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockCleaner);

      const results = await processSupplyReminders();

      expect(results.snoozed).toBe(1);
      expect(results.sent).toBe(0);
      expect(PushNotification.sendPushSupplyReminder).not.toHaveBeenCalled();
    });

    it("should send reminder if snooze has expired", async () => {
      const mockAppointment = {
        id: 1,
        date: getTodayString(),
        hasBeenAssigned: true,
        completed: false,
        employeesAssigned: ["1"],
        home: { street: "123 Main St", city: "Boston" },
      };

      const expiredSnooze = new Date();
      expiredSnooze.setDate(expiredSnooze.getDate() - 1); // Expired yesterday

      const mockCleaner = {
        id: 1,
        firstName: "John",
        expoPushToken: "ExponentPushToken[valid-token]",
        supplyReminderSnoozedUntil: expiredSnooze,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockCleaner);

      const results = await processSupplyReminders();

      expect(results.sent).toBe(1);
      expect(results.snoozed).toBe(0);
      expect(PushNotification.sendPushSupplyReminder).toHaveBeenCalled();
    });

    it("should send reminder if supplyReminderSnoozedUntil is null", async () => {
      const mockAppointment = {
        id: 1,
        date: getTodayString(),
        hasBeenAssigned: true,
        completed: false,
        employeesAssigned: ["1"],
        home: { street: "123 Main St", city: "Boston" },
      };

      const mockCleaner = {
        id: 1,
        firstName: "John",
        expoPushToken: "ExponentPushToken[valid-token]",
        supplyReminderSnoozedUntil: null,
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockCleaner);

      const results = await processSupplyReminders();

      expect(results.sent).toBe(1);
      expect(results.snoozed).toBe(0);
      expect(PushNotification.sendPushSupplyReminder).toHaveBeenCalled();
    });

    it("should handle mixed snoozed and non-snoozed cleaners", async () => {
      const mockAppointment = {
        id: 1,
        date: getTodayString(),
        hasBeenAssigned: true,
        completed: false,
        employeesAssigned: ["1", "2"],
        home: { street: "123 Main St", city: "Boston" },
      };

      User.findByPk.mockImplementation((id) => {
        if (id === "1") {
          return {
            id: 1,
            firstName: "John",
            expoPushToken: "ExponentPushToken[token-1]",
            supplyReminderSnoozedUntil: daysFromNowDate(3), // Snoozed
          };
        }
        return {
          id: 2,
          firstName: "Jane",
          expoPushToken: "ExponentPushToken[token-2]",
          supplyReminderSnoozedUntil: null, // Not snoozed
        };
      });

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const results = await processSupplyReminders();

      expect(results.snoozed).toBe(1);
      expect(results.sent).toBe(1);
      expect(PushNotification.sendPushSupplyReminder).toHaveBeenCalledTimes(1);
      expect(PushNotification.sendPushSupplyReminder).toHaveBeenCalledWith(
        "ExponentPushToken[token-2]",
        "Jane",
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe("Address Formatting", () => {
    it("should pass correct address object to push notification", async () => {
      const mockAppointment = {
        id: 1,
        date: getTodayString(),
        hasBeenAssigned: true,
        completed: false,
        employeesAssigned: ["1"],
        home: {
          street: "789 Elm Street",
          city: "Somerville",
        },
      };

      const mockCleaner = {
        id: 1,
        firstName: "Jane",
        expoPushToken: "ExponentPushToken[valid-token]",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockCleaner);

      await processSupplyReminders();

      expect(PushNotification.sendPushSupplyReminder).toHaveBeenCalledWith(
        expect.any(String),
        "Jane",
        expect.any(String),
        {
          street: "789 Elm Street",
          city: "Somerville",
        }
      );
    });
  });
});
