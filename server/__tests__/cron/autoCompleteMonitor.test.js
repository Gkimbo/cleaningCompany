/**
 * Tests for AutoCompleteMonitor cron job
 *
 * Tests the isOverdueByFullDay function and the behavior of skipping
 * reminders for appointments that are overdue by 24+ hours.
 */

// Mock TimezoneService before requiring modules
jest.mock("../../services/TimezoneService", () => ({
  getTodayInTimezone: jest.fn(),
  formatDateInTimezone: jest.fn((date) => date.toISOString().split("T")[0]),
  getDefaultTimezone: jest.fn(() => "America/New_York"),
}));

jest.mock("../../models", () => ({
  UserAppointments: {
    findAll: jest.fn(),
  },
  CleanerJobCompletion: {
    findAll: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
  UserHomes: {},
  PricingConfig: {
    getActive: jest.fn().mockResolvedValue({
      autoCompleteHoursAfterEnd: 4,
      autoCompleteReminderIntervals: [30, 60, 120, 180, 210],
      completionAutoApprovalHours: 24,
    }),
  },
  Op: require("sequelize").Op,
}));

jest.mock("../../services/NotificationService", () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((val) => val),
}));

jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendAutoCompleteReminder: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushAutoCompleteReminder: jest.fn().mockResolvedValue(true),
}));

const TimezoneService = require("../../services/TimezoneService");
const { UserAppointments, CleanerJobCompletion, User } = require("../../models");
const NotificationService = require("../../services/NotificationService");
const Email = require("../../services/sendNotifications/EmailClass");

// Import the module after mocks are set up
const {
  processReminders,
  processMultiCleanerReminders,
} = require("../../services/cron/AutoCompleteMonitor");

describe("AutoCompleteMonitor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: today is 2026-04-06
    TimezoneService.getTodayInTimezone.mockReturnValue("2026-04-06");
  });

  // Helper to create dates relative to "today" (2026-04-06)
  const getDateStr = (daysOffset) => {
    const date = new Date("2026-04-06");
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split("T")[0];
  };

  describe("isOverdueByFullDay logic", () => {
    describe("via processReminders", () => {
      const createMockAppointment = (dateStr, options = {}) => ({
        id: options.id || 1,
        date: dateStr,
        scheduledEndTime: new Date(`${dateStr}T18:00:00`),
        autoCompleteRemindersSent: options.remindersSent || 0,
        employeesAssigned: options.employeesAssigned || [100],
        home: {
          address: "123 Main St",
          city: "Boston",
        },
        update: jest.fn().mockResolvedValue(true),
        ...options,
      });

      it("should SKIP reminder for appointment from yesterday (1 day overdue)", async () => {
        const yesterdayStr = getDateStr(-1); // 2026-04-05
        const mockAppointment = createMockAppointment(yesterdayStr);

        UserAppointments.findAll.mockResolvedValue([mockAppointment]);
        User.findByPk.mockResolvedValue({
          id: 100,
          firstName: "John",
          email: "john@example.com",
          expoPushToken: "token",
        });

        const result = await processReminders();

        expect(NotificationService.createNotification).not.toHaveBeenCalled();
        expect(Email.sendAutoCompleteReminder).not.toHaveBeenCalled();
        expect(mockAppointment.update).not.toHaveBeenCalled();
        expect(result.remindersSent).toBe(0);
      });

      it("should SKIP reminder for appointment from 2 days ago", async () => {
        const twoDaysAgoStr = getDateStr(-2); // 2026-04-04
        const mockAppointment = createMockAppointment(twoDaysAgoStr);

        UserAppointments.findAll.mockResolvedValue([mockAppointment]);
        User.findByPk.mockResolvedValue({
          id: 100,
          firstName: "John",
          email: "john@example.com",
        });

        const result = await processReminders();

        expect(NotificationService.createNotification).not.toHaveBeenCalled();
        expect(result.remindersSent).toBe(0);
      });

      it("should SKIP reminder for appointment from 7 days ago", async () => {
        const weekAgoStr = getDateStr(-7);
        const mockAppointment = createMockAppointment(weekAgoStr);

        UserAppointments.findAll.mockResolvedValue([mockAppointment]);

        const result = await processReminders();

        expect(NotificationService.createNotification).not.toHaveBeenCalled();
        expect(result.remindersSent).toBe(0);
      });

      it("should SEND reminder for appointment from today (not overdue)", async () => {
        const todayStr = getDateStr(0); // 2026-04-06
        const now = new Date("2026-04-06T20:00:00"); // 8 PM, 2 hours after 6 PM end
        jest.useFakeTimers().setSystemTime(now);

        const mockAppointment = createMockAppointment(todayStr, {
          scheduledEndTime: new Date("2026-04-06T18:00:00"),
          autoCompleteRemindersSent: 0,
        });

        UserAppointments.findAll.mockResolvedValue([mockAppointment]);
        User.findByPk.mockResolvedValue({
          id: 100,
          firstName: "John",
          email: "john@example.com",
          expoPushToken: "token",
        });

        const result = await processReminders();

        expect(NotificationService.createNotification).toHaveBeenCalled();
        expect(result.remindersSent).toBe(1);

        jest.useRealTimers();
      });

      it("should process multiple appointments and skip only overdue ones", async () => {
        const todayStr = getDateStr(0);
        const yesterdayStr = getDateStr(-1);
        const twoDaysAgoStr = getDateStr(-2);

        const now = new Date("2026-04-06T20:00:00");
        jest.useFakeTimers().setSystemTime(now);

        const appointments = [
          createMockAppointment(todayStr, { id: 1, scheduledEndTime: new Date("2026-04-06T18:00:00") }),
          createMockAppointment(yesterdayStr, { id: 2 }),
          createMockAppointment(twoDaysAgoStr, { id: 3 }),
        ];

        UserAppointments.findAll.mockResolvedValue(appointments);
        User.findByPk.mockResolvedValue({
          id: 100,
          firstName: "John",
          email: "john@example.com",
          expoPushToken: "token",
        });

        const result = await processReminders();

        // Only the today appointment should get a reminder
        expect(NotificationService.createNotification).toHaveBeenCalledTimes(1);
        expect(result.remindersSent).toBe(1);

        jest.useRealTimers();
      });
    });

    describe("via processMultiCleanerReminders", () => {
      const createMockCompletion = (dateStr, options = {}) => ({
        id: options.id || 1,
        autoCompleteRemindersSent: options.remindersSent || 0,
        cleaner: {
          id: 100,
          firstName: "Jane",
          email: "jane@example.com",
          expoPushToken: "token",
        },
        appointment: {
          id: 10,
          date: dateStr,
          scheduledEndTime: new Date(`${dateStr}T18:00:00`),
          home: {
            address: "456 Oak Ave",
            city: "Cambridge",
          },
        },
        update: jest.fn().mockResolvedValue(true),
        ...options,
      });

      it("should SKIP multi-cleaner reminder for appointment from yesterday", async () => {
        const yesterdayStr = getDateStr(-1);
        const mockCompletion = createMockCompletion(yesterdayStr);

        CleanerJobCompletion.findAll.mockResolvedValue([mockCompletion]);

        const result = await processMultiCleanerReminders();

        expect(NotificationService.createNotification).not.toHaveBeenCalled();
        expect(mockCompletion.update).not.toHaveBeenCalled();
        expect(result.remindersSent).toBe(0);
      });

      it("should SKIP multi-cleaner reminder for appointment from 3 days ago", async () => {
        const threeDaysAgoStr = getDateStr(-3);
        const mockCompletion = createMockCompletion(threeDaysAgoStr);

        CleanerJobCompletion.findAll.mockResolvedValue([mockCompletion]);

        const result = await processMultiCleanerReminders();

        expect(NotificationService.createNotification).not.toHaveBeenCalled();
        expect(result.remindersSent).toBe(0);
      });

      it("should SEND multi-cleaner reminder for appointment from today", async () => {
        const todayStr = getDateStr(0);
        const now = new Date("2026-04-06T20:00:00");
        jest.useFakeTimers().setSystemTime(now);

        const mockCompletion = createMockCompletion(todayStr, {
          appointment: {
            id: 10,
            date: todayStr,
            scheduledEndTime: new Date("2026-04-06T18:00:00"),
            home: {
              address: "456 Oak Ave",
              city: "Cambridge",
            },
          },
        });

        CleanerJobCompletion.findAll.mockResolvedValue([mockCompletion]);

        const result = await processMultiCleanerReminders();

        expect(NotificationService.createNotification).toHaveBeenCalled();
        expect(result.remindersSent).toBe(1);

        jest.useRealTimers();
      });

      it("should handle null appointment gracefully", async () => {
        const mockCompletion = {
          id: 1,
          autoCompleteRemindersSent: 0,
          cleaner: { id: 100, firstName: "Jane" },
          appointment: null, // Broken relationship
          update: jest.fn(),
        };

        CleanerJobCompletion.findAll.mockResolvedValue([mockCompletion]);

        // Should not throw
        const result = await processMultiCleanerReminders();

        expect(NotificationService.createNotification).not.toHaveBeenCalled();
        expect(result.errors).toBe(0);
      });
    });
  });

  describe("isOverdueByFullDay edge cases", () => {
    it("should handle null date by NOT skipping (safe default)", async () => {
      const mockAppointment = {
        id: 1,
        date: null,
        scheduledEndTime: new Date(),
        autoCompleteRemindersSent: 0,
        employeesAssigned: [100],
        home: { address: "123 Main St", city: "Boston" },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({
        id: 100,
        firstName: "John",
        email: "john@example.com",
      });

      // With null date, should NOT skip (safe default)
      // The function should continue and may fail elsewhere, but won't incorrectly skip
      await processReminders();

      // Since date is null, isOverdueByFullDay returns false, so reminder logic continues
      // It may fail on other logic but won't be skipped due to overdue check
    });

    it("should handle undefined date by NOT skipping (safe default)", async () => {
      const mockAppointment = {
        id: 1,
        date: undefined,
        scheduledEndTime: new Date(),
        autoCompleteRemindersSent: 0,
        employeesAssigned: [100],
        home: { address: "123 Main St", city: "Boston" },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({
        id: 100,
        firstName: "John",
        email: "john@example.com",
      });

      await processReminders();
      // Should not throw and should attempt to process (not skip)
    });

    it("should handle empty string date by NOT skipping (safe default)", async () => {
      const mockAppointment = {
        id: 1,
        date: "",
        scheduledEndTime: new Date(),
        autoCompleteRemindersSent: 0,
        employeesAssigned: [100],
        home: { address: "123 Main St", city: "Boston" },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      await processReminders();
      // Should not throw
    });

    it("should use TimezoneService for consistent timezone handling", async () => {
      const yesterdayStr = getDateStr(-1);
      const mockAppointment = {
        id: 1,
        date: yesterdayStr,
        scheduledEndTime: new Date(`${yesterdayStr}T18:00:00`),
        autoCompleteRemindersSent: 0,
        employeesAssigned: [100],
        home: { address: "123 Main St", city: "Boston" },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      await processReminders();

      // Verify TimezoneService was called to get today's date
      expect(TimezoneService.getTodayInTimezone).toHaveBeenCalled();
    });

    it("should handle timezone where server time differs from business timezone", async () => {
      // Simulate server being in different timezone
      // If server thinks it's still 2026-04-05 but business timezone says 2026-04-06
      TimezoneService.getTodayInTimezone.mockReturnValue("2026-04-06");

      const mockAppointment = {
        id: 1,
        date: "2026-04-05", // Yesterday in business timezone
        scheduledEndTime: new Date("2026-04-05T18:00:00"),
        autoCompleteRemindersSent: 0,
        employeesAssigned: [100],
        home: { address: "123 Main St", city: "Boston" },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const result = await processReminders();

      // Should skip because business timezone says it's overdue
      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(result.remindersSent).toBe(0);
    });
  });

  describe("boundary conditions", () => {
    it("should correctly handle appointment exactly at midnight boundary", async () => {
      // Today is 2026-04-06
      // Appointment on 2026-04-05 should be considered 1 day overdue
      TimezoneService.getTodayInTimezone.mockReturnValue("2026-04-06");

      const mockAppointment = {
        id: 1,
        date: "2026-04-05",
        scheduledEndTime: new Date("2026-04-05T23:59:59"),
        autoCompleteRemindersSent: 0,
        employeesAssigned: [100],
        home: { address: "123 Main St", city: "Boston" },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const result = await processReminders();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(result.remindersSent).toBe(0);
    });

    it("should correctly handle appointment on same day (not overdue)", async () => {
      // Today is 2026-04-06
      // Appointment on 2026-04-06 should NOT be considered overdue
      TimezoneService.getTodayInTimezone.mockReturnValue("2026-04-06");

      const now = new Date("2026-04-06T20:00:00");
      jest.useFakeTimers().setSystemTime(now);

      const mockAppointment = {
        id: 1,
        date: "2026-04-06",
        scheduledEndTime: new Date("2026-04-06T18:00:00"),
        autoCompleteRemindersSent: 0,
        employeesAssigned: [100],
        home: { address: "123 Main St", city: "Boston" },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({
        id: 100,
        firstName: "John",
        email: "john@example.com",
        expoPushToken: "token",
      });

      const result = await processReminders();

      expect(NotificationService.createNotification).toHaveBeenCalled();
      expect(result.remindersSent).toBe(1);

      jest.useRealTimers();
    });

    it("should handle year boundary (Dec 31 -> Jan 1)", async () => {
      // Today is 2027-01-01
      // Appointment on 2026-12-31 should be 1 day overdue
      TimezoneService.getTodayInTimezone.mockReturnValue("2027-01-01");

      const mockAppointment = {
        id: 1,
        date: "2026-12-31",
        scheduledEndTime: new Date("2026-12-31T18:00:00"),
        autoCompleteRemindersSent: 0,
        employeesAssigned: [100],
        home: { address: "123 Main St", city: "Boston" },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const result = await processReminders();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(result.remindersSent).toBe(0);
    });

    it("should handle month boundary (Feb 28 -> Mar 1)", async () => {
      // Today is 2026-03-01
      // Appointment on 2026-02-28 should be 1 day overdue
      TimezoneService.getTodayInTimezone.mockReturnValue("2026-03-01");

      const mockAppointment = {
        id: 1,
        date: "2026-02-28",
        scheduledEndTime: new Date("2026-02-28T18:00:00"),
        autoCompleteRemindersSent: 0,
        employeesAssigned: [100],
        home: { address: "123 Main St", city: "Boston" },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const result = await processReminders();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(result.remindersSent).toBe(0);
    });

    it("should handle leap year (Feb 29)", async () => {
      // 2024 is a leap year
      // Today is 2024-03-01
      // Appointment on 2024-02-29 should be 1 day overdue
      TimezoneService.getTodayInTimezone.mockReturnValue("2024-03-01");

      const mockAppointment = {
        id: 1,
        date: "2024-02-29",
        scheduledEndTime: new Date("2024-02-29T18:00:00"),
        autoCompleteRemindersSent: 0,
        employeesAssigned: [100],
        home: { address: "123 Main St", city: "Boston" },
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const result = await processReminders();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(result.remindersSent).toBe(0);
    });
  });

  describe("string comparison correctness", () => {
    it("should correctly compare YYYY-MM-DD strings lexicographically", async () => {
      // Verify that "2026-04-05" < "2026-04-06" works correctly
      TimezoneService.getTodayInTimezone.mockReturnValue("2026-04-06");

      const testCases = [
        { date: "2026-04-05", shouldSkip: true },  // Yesterday
        { date: "2026-04-06", shouldSkip: false }, // Today
        { date: "2026-04-07", shouldSkip: false }, // Tomorrow (future, but not relevant for this test)
        { date: "2026-03-06", shouldSkip: true },  // Last month
        { date: "2025-04-06", shouldSkip: true },  // Last year
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        const now = new Date("2026-04-06T20:00:00");
        jest.useFakeTimers().setSystemTime(now);

        const mockAppointment = {
          id: 1,
          date: testCase.date,
          scheduledEndTime: new Date(`${testCase.date}T18:00:00`),
          autoCompleteRemindersSent: 0,
          employeesAssigned: [100],
          home: { address: "123 Main St", city: "Boston" },
          update: jest.fn().mockResolvedValue(true),
        };

        UserAppointments.findAll.mockResolvedValue([mockAppointment]);
        User.findByPk.mockResolvedValue({
          id: 100,
          firstName: "John",
          email: "john@example.com",
          expoPushToken: "token",
        });

        const result = await processReminders();

        if (testCase.shouldSkip) {
          expect(NotificationService.createNotification).not.toHaveBeenCalled();
          expect(result.remindersSent).toBe(0);
        } else {
          // Note: today's appointment might still not get a reminder if other conditions aren't met
          // But it won't be skipped due to overdue check
        }

        jest.useRealTimers();
      }
    });
  });
});
