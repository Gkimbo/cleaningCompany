/**
 * Tests for MultiCleanerFillMonitor cron job
 *
 * Tests the isOverdueByFullDay function and the behavior of skipping
 * notifications/offers for appointments that are overdue by 24+ hours.
 */

// Mock TimezoneService before requiring modules
jest.mock("../../services/TimezoneService", () => ({
  getTodayInTimezone: jest.fn(),
  formatDateInTimezone: jest.fn((date) => date.toISOString().split("T")[0]),
  getDefaultTimezone: jest.fn(() => "America/New_York"),
}));

jest.mock("../../models", () => ({
  MultiCleanerJob: {
    findAll: jest.fn(),
  },
  UserAppointments: {},
  UserHomes: {},
  User: {
    findAll: jest.fn(),
  },
  CleanerJobCompletion: {
    findAll: jest.fn(),
  },
  CleanerJobOffer: {},
  Op: require("sequelize").Op,
}));

jest.mock("../../config/businessConfig", () => ({
  getPricingConfig: jest.fn().mockResolvedValue({
    multiCleaner: {
      urgentFillDays: 7,
      urgentNotificationIntervalHours: 6,
      finalWarningDays: 3,
      edgeCaseDecisionDays: 3,
      edgeCaseDecisionHours: 24,
    },
  }),
}));

jest.mock("../../services/NotificationService", () => ({
  createNotification: jest.fn().mockResolvedValue({}),
  findActiveNotification: jest.fn().mockResolvedValue(null),
  findExpiredNotification: jest.fn().mockResolvedValue(null),
}));

jest.mock("../../services/MultiCleanerService", () => ({
  offerSoloCompletion: jest.fn().mockResolvedValue({}),
  handleExpiredSoloOffer: jest.fn().mockResolvedValue({}),
  handleExpiredExtraWorkOffers: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../services/MultiCleanerPricingService", () => ({
  calculateTotalJobPrice: jest.fn().mockResolvedValue(10000),
  calculatePerCleanerEarnings: jest.fn().mockResolvedValue({
    cleanerEarnings: [{ netAmount: 5000 }],
  }),
}));

jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((val) => val),
}));

jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEdgeCaseDecisionRequired: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushEdgeCaseDecision: jest.fn().mockResolvedValue(true),
}));

const TimezoneService = require("../../services/TimezoneService");
const { MultiCleanerJob, User, CleanerJobCompletion } = require("../../models");
const NotificationService = require("../../services/NotificationService");
const MultiCleanerService = require("../../services/MultiCleanerService");

// Import the module after mocks are set up
const {
  processUrgentFillNotifications,
  processFinalWarnings,
  processSoloCompletionOffers,
  processEdgeCaseDecisions,
} = require("../../services/cron/MultiCleanerFillMonitor");

describe("MultiCleanerFillMonitor", () => {
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

  describe("processUrgentFillNotifications", () => {
    const createMockJob = (dateStr, options = {}) => ({
      id: options.id || 1,
      status: options.status || "open",
      totalCleanersRequired: options.totalCleanersRequired || 2,
      cleanersConfirmed: options.cleanersConfirmed || 0,
      urgentNotificationSentAt: options.urgentNotificationSentAt || null,
      getRemainingSlots: jest.fn().mockReturnValue(options.remainingSlots || 2),
      update: jest.fn().mockResolvedValue(true),
      appointment: {
        id: 10,
        date: dateStr,
        home: {
          id: 1,
          address: "123 Main St",
          city: "Boston",
        },
        ...options.appointment,
      },
      ...options,
    });

    it("should SKIP urgent notification for appointment from yesterday (1 day overdue)", async () => {
      const yesterdayStr = getDateStr(-1);
      const mockJob = createMockJob(yesterdayStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      User.findAll.mockResolvedValue([]);

      const result = await processUrgentFillNotifications();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(mockJob.update).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should SKIP urgent notification for appointment from 3 days ago", async () => {
      const threeDaysAgoStr = getDateStr(-3);
      const mockJob = createMockJob(threeDaysAgoStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processUrgentFillNotifications();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should SEND urgent notification for appointment tomorrow (not overdue)", async () => {
      const tomorrowStr = getDateStr(1);
      const mockJob = createMockJob(tomorrowStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      User.findAll.mockResolvedValue([
        { id: 200, firstName: "Cleaner1", expoPushToken: "token1" },
      ]);
      CleanerJobCompletion.findAll.mockResolvedValue([]);

      const result = await processUrgentFillNotifications();

      expect(NotificationService.createNotification).toHaveBeenCalled();
      expect(mockJob.update).toHaveBeenCalledWith({ urgentNotificationSentAt: expect.any(Date) });
      expect(result).toBe(1);
    });

    it("should SEND urgent notification for appointment today (not overdue)", async () => {
      const todayStr = getDateStr(0);
      const mockJob = createMockJob(todayStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      User.findAll.mockResolvedValue([
        { id: 200, firstName: "Cleaner1", expoPushToken: "token1" },
      ]);
      CleanerJobCompletion.findAll.mockResolvedValue([]);

      const result = await processUrgentFillNotifications();

      expect(NotificationService.createNotification).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it("should handle null appointment gracefully", async () => {
      const mockJob = {
        id: 1,
        status: "open",
        getRemainingSlots: jest.fn().mockReturnValue(2),
        update: jest.fn(),
        appointment: null,
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processUrgentFillNotifications();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should process multiple jobs and skip only overdue ones", async () => {
      const todayStr = getDateStr(0);
      const yesterdayStr = getDateStr(-1);
      const tomorrowStr = getDateStr(1);

      const jobs = [
        createMockJob(todayStr, { id: 1 }),
        createMockJob(yesterdayStr, { id: 2 }),
        createMockJob(tomorrowStr, { id: 3 }),
      ];

      MultiCleanerJob.findAll.mockResolvedValue(jobs);
      User.findAll.mockResolvedValue([
        { id: 200, firstName: "Cleaner1", expoPushToken: "token1" },
      ]);
      CleanerJobCompletion.findAll.mockResolvedValue([]);

      const result = await processUrgentFillNotifications();

      // Jobs 1 and 3 should be processed (today and tomorrow), job 2 skipped (yesterday)
      expect(result).toBe(2);
    });
  });

  describe("processFinalWarnings", () => {
    const createMockJob = (dateStr, options = {}) => ({
      id: options.id || 1,
      status: options.status || "open",
      totalCleanersRequired: options.totalCleanersRequired || 2,
      cleanersConfirmed: options.cleanersConfirmed || 0,
      finalWarningAt: options.finalWarningAt || null,
      getRemainingSlots: jest.fn().mockReturnValue(options.remainingSlots || 2),
      update: jest.fn().mockResolvedValue(true),
      appointment: {
        id: 10,
        userId: 100,
        date: dateStr,
        home: { id: 1 },
        user: { id: 100 },
        ...options.appointment,
      },
      ...options,
    });

    it("should SKIP final warning for appointment from yesterday", async () => {
      const yesterdayStr = getDateStr(-1);
      const mockJob = createMockJob(yesterdayStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processFinalWarnings();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(mockJob.update).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should SKIP final warning for appointment from 5 days ago", async () => {
      const fiveDaysAgoStr = getDateStr(-5);
      const mockJob = createMockJob(fiveDaysAgoStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processFinalWarnings();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should SEND final warning for appointment today (not overdue)", async () => {
      const todayStr = getDateStr(0);
      const mockJob = createMockJob(todayStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processFinalWarnings();

      expect(NotificationService.createNotification).toHaveBeenCalled();
      expect(mockJob.update).toHaveBeenCalledWith({ finalWarningAt: expect.any(Date) });
      expect(result).toBe(1);
    });

    it("should SEND final warning for appointment in 2 days (not overdue)", async () => {
      const twoDaysStr = getDateStr(2);
      const mockJob = createMockJob(twoDaysStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processFinalWarnings();

      expect(NotificationService.createNotification).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it("should handle null appointment gracefully", async () => {
      const mockJob = {
        id: 1,
        status: "open",
        getRemainingSlots: jest.fn().mockReturnValue(2),
        update: jest.fn(),
        appointment: null,
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processFinalWarnings();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });

  describe("processSoloCompletionOffers", () => {
    const createMockJob = (dateStr, options = {}) => ({
      id: options.id || 1,
      status: "partially_filled",
      cleanersConfirmed: 1,
      update: jest.fn().mockResolvedValue(true),
      appointment: {
        id: 10,
        date: dateStr,
        ...options.appointment,
      },
      completions: options.completions || [
        { cleanerId: 200, status: "assigned" },
      ],
      ...options,
    });

    it("should SKIP solo offer for appointment from yesterday", async () => {
      const yesterdayStr = getDateStr(-1);
      const mockJob = createMockJob(yesterdayStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processSoloCompletionOffers();

      expect(MultiCleanerService.offerSoloCompletion).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should SKIP solo offer for appointment from 2 days ago", async () => {
      const twoDaysAgoStr = getDateStr(-2);
      const mockJob = createMockJob(twoDaysAgoStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processSoloCompletionOffers();

      expect(MultiCleanerService.offerSoloCompletion).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should SEND solo offer for appointment today (not overdue)", async () => {
      const todayStr = getDateStr(0);
      const mockJob = createMockJob(todayStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processSoloCompletionOffers();

      expect(MultiCleanerService.offerSoloCompletion).toHaveBeenCalledWith(1, 200);
      expect(result).toBe(1);
    });

    it("should SEND solo offer for appointment tomorrow (not overdue)", async () => {
      const tomorrowStr = getDateStr(1);
      const mockJob = createMockJob(tomorrowStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processSoloCompletionOffers();

      expect(MultiCleanerService.offerSoloCompletion).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it("should handle null appointment gracefully", async () => {
      const mockJob = {
        id: 1,
        status: "partially_filled",
        cleanersConfirmed: 1,
        completions: [{ cleanerId: 200 }],
        appointment: null,
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processSoloCompletionOffers();

      expect(MultiCleanerService.offerSoloCompletion).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should skip if no remaining cleaner", async () => {
      const todayStr = getDateStr(0);
      const mockJob = createMockJob(todayStr, {
        completions: [], // No cleaners
      });

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processSoloCompletionOffers();

      expect(MultiCleanerService.offerSoloCompletion).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });

  describe("processEdgeCaseDecisions", () => {
    const createMockJob = (dateStr, options = {}) => ({
      id: options.id || 1,
      status: "partially_filled",
      totalCleanersRequired: options.totalCleanersRequired || 2,
      cleanersConfirmed: options.cleanersConfirmed || 1,
      edgeCaseDecisionRequired: false,
      update: jest.fn().mockResolvedValue(true),
      appointment: {
        id: 10,
        date: dateStr,
        home: {
          id: 1,
          address: "123 Main St",
          city: "Boston",
          state: "MA",
          zipcode: "02101",
        },
        user: {
          id: 100,
          firstName: "John",
          email: "john@example.com",
          expoPushToken: "token",
        },
        ...options.appointment,
      },
      ...options,
    });

    it("should SKIP edge case decision for appointment from yesterday", async () => {
      const yesterdayStr = getDateStr(-1);
      const mockJob = createMockJob(yesterdayStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      CleanerJobCompletion.findAll.mockResolvedValue([
        { cleaner: { id: 200, firstName: "Jane" } },
      ]);

      const result = await processEdgeCaseDecisions();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(mockJob.update).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should SKIP edge case decision for appointment from 10 days ago", async () => {
      const tenDaysAgoStr = getDateStr(-10);
      const mockJob = createMockJob(tenDaysAgoStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processEdgeCaseDecisions();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should SEND edge case decision for appointment today (not overdue)", async () => {
      const todayStr = getDateStr(0);
      const mockJob = createMockJob(todayStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      CleanerJobCompletion.findAll.mockResolvedValue([
        { cleaner: { id: 200, firstName: "Jane" } },
      ]);

      const result = await processEdgeCaseDecisions();

      expect(NotificationService.createNotification).toHaveBeenCalled();
      expect(mockJob.update).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it("should SEND edge case decision for appointment in 2 days (not overdue)", async () => {
      const twoDaysStr = getDateStr(2);
      const mockJob = createMockJob(twoDaysStr);

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      CleanerJobCompletion.findAll.mockResolvedValue([
        { cleaner: { id: 200, firstName: "Jane" } },
      ]);

      const result = await processEdgeCaseDecisions();

      expect(NotificationService.createNotification).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it("should handle null appointment gracefully", async () => {
      const mockJob = {
        id: 1,
        status: "partially_filled",
        totalCleanersRequired: 2,
        cleanersConfirmed: 1,
        edgeCaseDecisionRequired: false,
        update: jest.fn(),
        appointment: null,
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processEdgeCaseDecisions();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should skip if job is already filled", async () => {
      const todayStr = getDateStr(0);
      const mockJob = createMockJob(todayStr, {
        cleanersConfirmed: 2,
        totalCleanersRequired: 2,
      });

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      CleanerJobCompletion.findAll.mockResolvedValue([
        { cleaner: { id: 200, firstName: "Jane" } },
        { cleaner: { id: 201, firstName: "Bob" } },
      ]);

      const result = await processEdgeCaseDecisions();

      // Should skip because job is already filled
      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });

  describe("isOverdueByFullDay edge cases", () => {
    it("should handle null date by NOT skipping (safe default)", async () => {
      const mockJob = {
        id: 1,
        status: "open",
        getRemainingSlots: jest.fn().mockReturnValue(2),
        update: jest.fn(),
        appointment: {
          id: 10,
          date: null,
          home: { id: 1 },
        },
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      User.findAll.mockResolvedValue([]);

      // Should not throw
      await processUrgentFillNotifications();
    });

    it("should handle undefined date by NOT skipping (safe default)", async () => {
      const mockJob = {
        id: 1,
        status: "open",
        getRemainingSlots: jest.fn().mockReturnValue(2),
        update: jest.fn(),
        appointment: {
          id: 10,
          date: undefined,
          home: { id: 1 },
        },
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      // Should not throw
      await processUrgentFillNotifications();
    });

    it("should use TimezoneService for consistent timezone handling", async () => {
      const yesterdayStr = getDateStr(-1);
      const mockJob = {
        id: 1,
        status: "open",
        getRemainingSlots: jest.fn().mockReturnValue(2),
        update: jest.fn(),
        appointment: {
          id: 10,
          date: yesterdayStr,
          home: { id: 1 },
        },
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      await processUrgentFillNotifications();

      expect(TimezoneService.getTodayInTimezone).toHaveBeenCalled();
    });
  });

  describe("boundary conditions", () => {
    it("should correctly handle year boundary (Dec 31 -> Jan 1)", async () => {
      TimezoneService.getTodayInTimezone.mockReturnValue("2027-01-01");

      const mockJob = {
        id: 1,
        status: "open",
        getRemainingSlots: jest.fn().mockReturnValue(2),
        update: jest.fn(),
        appointment: {
          id: 10,
          date: "2026-12-31", // Yesterday
          home: { id: 1 },
        },
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processUrgentFillNotifications();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should correctly handle month boundary", async () => {
      TimezoneService.getTodayInTimezone.mockReturnValue("2026-05-01");

      const mockJob = {
        id: 1,
        status: "open",
        getRemainingSlots: jest.fn().mockReturnValue(2),
        update: jest.fn(),
        appointment: {
          id: 10,
          date: "2026-04-30", // Yesterday
          home: { id: 1 },
        },
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);

      const result = await processUrgentFillNotifications();

      expect(NotificationService.createNotification).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should handle same day correctly (not overdue)", async () => {
      TimezoneService.getTodayInTimezone.mockReturnValue("2026-04-06");

      const mockJob = {
        id: 1,
        status: "open",
        getRemainingSlots: jest.fn().mockReturnValue(2),
        update: jest.fn(),
        appointment: {
          id: 10,
          date: "2026-04-06", // Today
          home: { id: 1 },
        },
      };

      MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
      User.findAll.mockResolvedValue([
        { id: 200, firstName: "Cleaner1", expoPushToken: "token1" },
      ]);
      CleanerJobCompletion.findAll.mockResolvedValue([]);

      const result = await processUrgentFillNotifications();

      expect(NotificationService.createNotification).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });

  describe("string comparison correctness", () => {
    it("should correctly compare various date strings", async () => {
      TimezoneService.getTodayInTimezone.mockReturnValue("2026-04-06");

      const testCases = [
        { date: "2026-04-05", shouldSkip: true },  // Yesterday
        { date: "2026-04-06", shouldSkip: false }, // Today
        { date: "2026-04-07", shouldSkip: false }, // Tomorrow
        { date: "2026-03-06", shouldSkip: true },  // Last month
        { date: "2025-04-06", shouldSkip: true },  // Last year
        { date: "2026-01-01", shouldSkip: true },  // Earlier this year
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        const mockJob = {
          id: 1,
          status: "open",
          getRemainingSlots: jest.fn().mockReturnValue(2),
          update: jest.fn(),
          appointment: {
            id: 10,
            date: testCase.date,
            home: { id: 1 },
          },
        };

        MultiCleanerJob.findAll.mockResolvedValue([mockJob]);
        User.findAll.mockResolvedValue([
          { id: 200, firstName: "Cleaner1", expoPushToken: "token1" },
        ]);
        CleanerJobCompletion.findAll.mockResolvedValue([]);

        const result = await processUrgentFillNotifications();

        if (testCase.shouldSkip) {
          expect(result).toBe(0);
        } else {
          expect(result).toBe(1);
        }
      }
    });
  });

  describe("mixed scenarios", () => {
    it("should correctly process a mix of overdue and current appointments", async () => {
      TimezoneService.getTodayInTimezone.mockReturnValue("2026-04-06");

      const jobs = [
        {
          id: 1,
          status: "open",
          getRemainingSlots: jest.fn().mockReturnValue(2),
          update: jest.fn(),
          appointment: { id: 10, date: "2026-04-06", home: { id: 1 } }, // Today - process
        },
        {
          id: 2,
          status: "open",
          getRemainingSlots: jest.fn().mockReturnValue(2),
          update: jest.fn(),
          appointment: { id: 11, date: "2026-04-05", home: { id: 2 } }, // Yesterday - skip
        },
        {
          id: 3,
          status: "open",
          getRemainingSlots: jest.fn().mockReturnValue(2),
          update: jest.fn(),
          appointment: { id: 12, date: "2026-04-07", home: { id: 3 } }, // Tomorrow - process
        },
        {
          id: 4,
          status: "open",
          getRemainingSlots: jest.fn().mockReturnValue(2),
          update: jest.fn(),
          appointment: { id: 13, date: "2026-04-01", home: { id: 4 } }, // 5 days ago - skip
        },
        {
          id: 5,
          status: "open",
          getRemainingSlots: jest.fn().mockReturnValue(2),
          update: jest.fn(),
          appointment: { id: 14, date: "2026-04-10", home: { id: 5 } }, // 4 days from now - process
        },
      ];

      MultiCleanerJob.findAll.mockResolvedValue(jobs);
      User.findAll.mockResolvedValue([
        { id: 200, firstName: "Cleaner1", expoPushToken: "token1" },
      ]);
      CleanerJobCompletion.findAll.mockResolvedValue([]);

      const result = await processUrgentFillNotifications();

      // Jobs 1, 3, and 5 should be processed (today, tomorrow, 4 days from now)
      // Jobs 2 and 4 should be skipped (yesterday, 5 days ago)
      expect(result).toBe(3);
      expect(jobs[0].update).toHaveBeenCalled(); // Today
      expect(jobs[1].update).not.toHaveBeenCalled(); // Yesterday - skipped
      expect(jobs[2].update).toHaveBeenCalled(); // Tomorrow
      expect(jobs[3].update).not.toHaveBeenCalled(); // 5 days ago - skipped
      expect(jobs[4].update).toHaveBeenCalled(); // 4 days from now
    });
  });
});
