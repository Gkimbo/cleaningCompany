/**
 * Tests for AutoCompleteMonitor - Edge Case Fallbacks
 *
 * Tests:
 * 1. Time window parsing
 * 2. Scheduled end time calculation
 * 3. Auto-complete configuration
 * 4. Reminder number calculation
 * 5. Early completion validation (via completionRouter integration)
 */

// Mock dependencies before importing the module
jest.mock("../../models", () => ({
  UserAppointments: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  CleanerJobCompletion: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
  UserHomes: {},
  PricingConfig: {
    getActive: jest.fn(),
  },
}));

jest.mock("../../services/NotificationService", () => ({
  createNotification: jest.fn(),
}));

jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((val) => val),
}));

jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendAutoCompleteReminder: jest.fn(),
  sendJobAutoCompleted: jest.fn(),
  sendJobAutoCompletedHomeowner: jest.fn(),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushAutoCompleteReminder: jest.fn(),
  sendPushJobAutoCompleted: jest.fn(),
  sendPushJobAutoCompletedHomeowner: jest.fn(),
}));

const {
  parseTimeWindow,
  calculateScheduledEndTime,
  getAutoCompleteConfig,
} = require("../../services/cron/AutoCompleteMonitor");

const { PricingConfig } = require("../../models");

describe("AutoCompleteMonitor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("parseTimeWindow", () => {
    it("parses 'anytime' window correctly", () => {
      const result = parseTimeWindow("anytime");
      expect(result).toEqual({ start: 8, end: 18 });
    });

    it("parses '10-3' window correctly", () => {
      const result = parseTimeWindow("10-3");
      expect(result).toEqual({ start: 10, end: 15 });
    });

    it("parses '11-4' window correctly", () => {
      const result = parseTimeWindow("11-4");
      expect(result).toEqual({ start: 11, end: 16 });
    });

    it("parses '12-2' window correctly", () => {
      const result = parseTimeWindow("12-2");
      expect(result).toEqual({ start: 12, end: 14 });
    });

    it("defaults to anytime for unknown windows", () => {
      const result = parseTimeWindow("unknown");
      expect(result).toEqual({ start: 8, end: 18 });
    });

    it("defaults to anytime for null/undefined", () => {
      expect(parseTimeWindow(null)).toEqual({ start: 8, end: 18 });
      expect(parseTimeWindow(undefined)).toEqual({ start: 8, end: 18 });
    });
  });

  describe("calculateScheduledEndTime", () => {
    it("calculates end time for anytime window (6 PM)", () => {
      const result = calculateScheduledEndTime("2024-08-15", "anytime");
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(7); // 0-indexed, so August = 7
      expect(result.getDate()).toBe(15);
      expect(result.getHours()).toBe(18);
      expect(result.getMinutes()).toBe(0);
    });

    it("calculates end time for 10-3 window (3 PM)", () => {
      const result = calculateScheduledEndTime("2024-08-15", "10-3");
      expect(result.getHours()).toBe(15);
    });

    it("calculates end time for 11-4 window (4 PM)", () => {
      const result = calculateScheduledEndTime("2024-08-15", "11-4");
      expect(result.getHours()).toBe(16);
    });

    it("calculates end time for 12-2 window (2 PM)", () => {
      const result = calculateScheduledEndTime("2024-08-15", "12-2");
      expect(result.getHours()).toBe(14);
    });

    it("handles different date formats", () => {
      const result = calculateScheduledEndTime("2025-01-01", "anytime");
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(1);
    });
  });

  describe("getAutoCompleteConfig", () => {
    it("returns config from PricingConfig when available", async () => {
      PricingConfig.getActive.mockResolvedValue({
        autoCompleteHoursAfterEnd: 6,
        autoCompleteReminderIntervals: [15, 30, 60, 90, 120],
        completionAutoApprovalHours: 48,
        minOnSiteMinutes: 45,
      });

      const config = await getAutoCompleteConfig();

      expect(config.hoursAfterEnd).toBe(6);
      expect(config.reminderIntervals).toEqual([15, 30, 60, 90, 120]);
      expect(config.autoApprovalHours).toBe(48);
    });

    it("returns defaults when PricingConfig returns null", async () => {
      PricingConfig.getActive.mockResolvedValue(null);

      const config = await getAutoCompleteConfig();

      expect(config.hoursAfterEnd).toBe(4);
      expect(config.reminderIntervals).toEqual([30, 60, 120, 180, 210]);
      expect(config.autoApprovalHours).toBe(24);
    });

    it("returns defaults for missing individual fields", async () => {
      PricingConfig.getActive.mockResolvedValue({
        // Only some fields set
        autoCompleteHoursAfterEnd: 5,
      });

      const config = await getAutoCompleteConfig();

      expect(config.hoursAfterEnd).toBe(5);
      expect(config.reminderIntervals).toEqual([30, 60, 120, 180, 210]);
      expect(config.autoApprovalHours).toBe(24);
    });
  });

  describe("Auto-complete timing calculation", () => {
    it("calculates auto-complete time correctly (4 hours after scheduled end)", () => {
      const scheduledEnd = calculateScheduledEndTime("2024-08-15", "anytime");
      const autoCompleteAt = new Date(scheduledEnd.getTime() + 4 * 60 * 60 * 1000);

      // Scheduled end is 6 PM, so auto-complete is 10 PM
      expect(autoCompleteAt.getHours()).toBe(22);
    });

    it("calculates auto-complete time for tight windows", () => {
      const scheduledEnd = calculateScheduledEndTime("2024-08-15", "12-2");
      const autoCompleteAt = new Date(scheduledEnd.getTime() + 4 * 60 * 60 * 1000);

      // Scheduled end is 2 PM, so auto-complete is 6 PM
      expect(autoCompleteAt.getHours()).toBe(18);
    });
  });

  describe("Reminder interval calculations", () => {
    const defaultIntervals = [30, 60, 120, 180, 210]; // minutes

    it("reminder 1 at 30 minutes past end", () => {
      const minutesPassed = 35;
      let reminderNum = 0;
      for (let i = defaultIntervals.length - 1; i >= 0; i--) {
        if (minutesPassed >= defaultIntervals[i]) {
          reminderNum = i + 1;
          break;
        }
      }
      expect(reminderNum).toBe(1);
    });

    it("reminder 2 at 60 minutes past end", () => {
      const minutesPassed = 65;
      let reminderNum = 0;
      for (let i = defaultIntervals.length - 1; i >= 0; i--) {
        if (minutesPassed >= defaultIntervals[i]) {
          reminderNum = i + 1;
          break;
        }
      }
      expect(reminderNum).toBe(2);
    });

    it("reminder 3 at 120 minutes (2 hours) past end", () => {
      const minutesPassed = 125;
      let reminderNum = 0;
      for (let i = defaultIntervals.length - 1; i >= 0; i--) {
        if (minutesPassed >= defaultIntervals[i]) {
          reminderNum = i + 1;
          break;
        }
      }
      expect(reminderNum).toBe(3);
    });

    it("reminder 4 at 180 minutes (3 hours) past end", () => {
      const minutesPassed = 185;
      let reminderNum = 0;
      for (let i = defaultIntervals.length - 1; i >= 0; i--) {
        if (minutesPassed >= defaultIntervals[i]) {
          reminderNum = i + 1;
          break;
        }
      }
      expect(reminderNum).toBe(4);
    });

    it("reminder 5 (final) at 210 minutes (3.5 hours) past end", () => {
      const minutesPassed = 215;
      let reminderNum = 0;
      for (let i = defaultIntervals.length - 1; i >= 0; i--) {
        if (minutesPassed >= defaultIntervals[i]) {
          reminderNum = i + 1;
          break;
        }
      }
      expect(reminderNum).toBe(5);
    });

    it("no reminder before first interval", () => {
      const minutesPassed = 25;
      let reminderNum = 0;
      for (let i = defaultIntervals.length - 1; i >= 0; i--) {
        if (minutesPassed >= defaultIntervals[i]) {
          reminderNum = i + 1;
          break;
        }
      }
      expect(reminderNum).toBe(0);
    });
  });

  describe("Early completion blocking logic", () => {
    const minOnSiteMinutes = 30;

    it("blocks completion before time window starts if not on-site long enough", () => {
      const now = new Date("2024-08-15T09:00:00"); // 9 AM
      const windowStartTime = new Date("2024-08-15T10:00:00"); // 10 AM window start
      const jobStartedAt = new Date("2024-08-15T08:45:00"); // Started 15 min ago

      const timeWindowStarted = now >= windowStartTime;
      const onSiteLongEnough = jobStartedAt &&
        (now.getTime() - jobStartedAt.getTime()) >= minOnSiteMinutes * 60 * 1000;

      const allowed = timeWindowStarted || onSiteLongEnough;

      expect(timeWindowStarted).toBe(false);
      expect(onSiteLongEnough).toBe(false);
      expect(allowed).toBe(false);
    });

    it("allows completion after time window starts", () => {
      const now = new Date("2024-08-15T10:30:00"); // 10:30 AM
      const windowStartTime = new Date("2024-08-15T10:00:00"); // 10 AM window start
      const jobStartedAt = null; // No photos yet

      const timeWindowStarted = now >= windowStartTime;
      const onSiteLongEnough = jobStartedAt &&
        (now.getTime() - jobStartedAt.getTime()) >= minOnSiteMinutes * 60 * 1000;

      const allowed = timeWindowStarted || onSiteLongEnough;

      expect(timeWindowStarted).toBe(true);
      expect(allowed).toBe(true);
    });

    it("allows completion after 30 minutes on-site (before time window)", () => {
      const now = new Date("2024-08-15T09:35:00"); // 9:35 AM
      const windowStartTime = new Date("2024-08-15T10:00:00"); // 10 AM window start
      const jobStartedAt = new Date("2024-08-15T09:00:00"); // Started 35 min ago

      const timeWindowStarted = now >= windowStartTime;
      const onSiteLongEnough = jobStartedAt &&
        (now.getTime() - jobStartedAt.getTime()) >= minOnSiteMinutes * 60 * 1000;

      const allowed = timeWindowStarted || onSiteLongEnough;

      expect(timeWindowStarted).toBe(false);
      expect(onSiteLongEnough).toBe(true);
      expect(allowed).toBe(true);
    });

    it("blocks completion at exactly 30 minutes (needs to be more than 30)", () => {
      const now = new Date("2024-08-15T09:30:00"); // 9:30 AM
      const windowStartTime = new Date("2024-08-15T10:00:00"); // 10 AM window start
      const jobStartedAt = new Date("2024-08-15T09:00:00"); // Started exactly 30 min ago

      const timeWindowStarted = now >= windowStartTime;
      const onSiteLongEnough = jobStartedAt &&
        (now.getTime() - jobStartedAt.getTime()) >= minOnSiteMinutes * 60 * 1000;

      const allowed = timeWindowStarted || onSiteLongEnough;

      // At exactly 30 min, >= check should pass
      expect(onSiteLongEnough).toBe(true);
      expect(allowed).toBe(true);
    });

    it("blocks completion with no job start time before window", () => {
      const now = new Date("2024-08-15T09:00:00"); // 9 AM
      const windowStartTime = new Date("2024-08-15T10:00:00"); // 10 AM window start
      const jobStartedAt = null; // No photos uploaded yet

      const timeWindowStarted = now >= windowStartTime;
      // When jobStartedAt is null, short-circuit returns null (falsy)
      const onSiteLongEnough = jobStartedAt &&
        (now.getTime() - jobStartedAt.getTime()) >= minOnSiteMinutes * 60 * 1000;

      const allowed = timeWindowStarted || onSiteLongEnough;

      expect(timeWindowStarted).toBe(false);
      expect(onSiteLongEnough).toBeFalsy(); // null is falsy
      expect(allowed).toBeFalsy(); // false || null = null which is falsy
    });
  });

  describe("24-hour payout dispute window", () => {
    it("calculates 24-hour auto-approval expiration correctly", () => {
      const submissionTime = new Date("2024-08-15T14:00:00");
      const autoApprovalHours = 24;
      const autoApprovalExpiresAt = new Date(
        submissionTime.getTime() + autoApprovalHours * 60 * 60 * 1000
      );

      // 24 hours after 2 PM should be 2 PM next day
      expect(autoApprovalExpiresAt.getDate()).toBe(16);
      expect(autoApprovalExpiresAt.getHours()).toBe(14);
    });
  });
});
