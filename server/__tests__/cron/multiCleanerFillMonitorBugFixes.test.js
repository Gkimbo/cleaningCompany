/**
 * Tests for the three bug fixes applied to MultiCleanerFillMonitor:
 *
 *  1. Location filtering — only nearby cleaners are notified, not all 50 globally
 *  2. Notification count cap — urgent notifications stop after maxUrgentNotifications
 *  3. Race condition — processExpiredEdgeCaseDecisions uses a transaction + LOCK.UPDATE
 */

jest.mock("../../services/TimezoneService", () => ({
  getTodayInTimezone: jest.fn().mockReturnValue("2026-04-24"),
  formatDateInTimezone: jest.fn((date) => date.toISOString().split("T")[0]),
  getDefaultTimezone: jest.fn(() => "America/New_York"),
}));

// NOTE: jest.mock factories are hoisted before any variable declarations.
// Variables referenced inside must be defined inside the factory itself.
jest.mock("../../models", () => ({
  sequelize: {
    // transaction mock is defined inline; tests access it via require("../../models").sequelize.transaction
    transaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: "UPDATE" } })),
  },
  MultiCleanerJob: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  UserAppointments: {},
  UserHomes: {},
  User: { findAll: jest.fn() },
  CleanerJobCompletion: { findAll: jest.fn() },
  CleanerJobOffer: {},
  Op: require("sequelize").Op,
}));

jest.mock("../../config/businessConfig", () => ({
  getPricingConfig: jest.fn().mockResolvedValue({
    multiCleaner: {
      urgentFillDays: 7,
      urgentNotificationIntervalHours: 6,
      maxUrgentNotifications: 4,
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
  sendEdgeCaseAutoProceeded: jest.fn().mockResolvedValue(true),
  sendEdgeCaseCleanerConfirmed: jest.fn().mockResolvedValue(true),
  sendEdgeCaseCancelled: jest.fn().mockResolvedValue(true),
  sendEdgeCaseCleanerCancelled: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushEdgeCaseDecision: jest.fn().mockResolvedValue(true),
  sendPushEdgeCaseCleanerConfirmed: jest.fn().mockResolvedValue(true),
  sendPushEdgeCaseCleanerCancelled: jest.fn().mockResolvedValue(true),
}));

// Mock geoUtils so distance checks are controllable per test
jest.mock("../../utils/geoUtils", () => ({
  checkBookingDistance: jest.fn(),
  MAX_BOOKING_DISTANCE_MILES: 30,
}));

// ─── Require after all mocks are declared ────────────────────────────────────
const { MultiCleanerJob, User, CleanerJobCompletion, sequelize } = require("../../models");
const NotificationService = require("../../services/NotificationService");
const { checkBookingDistance } = require("../../utils/geoUtils");

const {
  processUrgentFillNotifications,
  processExpiredEdgeCaseDecisions,
} = require("../../services/cron/MultiCleanerFillMonitor");

// ─── Shared constants ─────────────────────────────────────────────────────────
const TODAY = "2026-04-24";
const TOMORROW = "2026-04-25";
const IN_3_DAYS = "2026-04-27";

// ─── Factories ───────────────────────────────────────────────────────────────

function makeJob(overrides = {}) {
  return {
    id: 1,
    status: "open",
    totalCleanersRequired: 2,
    cleanersConfirmed: 0,
    urgentNotificationSentAt: null,
    urgentNotificationCount: 0,
    getRemainingSlots: jest.fn().mockReturnValue(2),
    update: jest.fn().mockResolvedValue(true),
    appointment: {
      id: 10,
      date: TOMORROW,
      userId: 100,
      home: {
        id: 1,
        latitude: "42.3601",
        longitude: "-71.0589",
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      },
      user: { id: 100, firstName: "HomeOwner", email: "owner@test.com", expoPushToken: null },
    },
    ...overrides,
  };
}

function makeCleaner(overrides = {}) {
  return {
    id: 200,
    firstName: "Jane",
    expoPushToken: "ExponentPushToken[xxx]",
    serviceAreaLatitude: "42.3601",
    serviceAreaLongitude: "-71.0589",
    serviceAreaRadiusMiles: 30,
    ...overrides,
  };
}

function makeLockedJob(homeownerDecision = "pending") {
  return {
    homeownerDecision,
    update: jest.fn().mockResolvedValue(true),
  };
}

function makeExpiredJob(overrides = {}) {
  return {
    id: 5,
    totalCleanersRequired: 2,
    homeownerDecision: "pending",
    edgeCaseDecisionRequired: true,
    edgeCaseDecisionExpiresAt: new Date(Date.now() - 1000),
    appointment: {
      id: 10,
      completed: false,
      date: IN_3_DAYS,
      home: {
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      },
      user: {
        id: 100,
        firstName: "Owner",
        email: "owner@test.com",
        expoPushToken: null,
      },
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bug Fix 1: Location Filtering
// ─────────────────────────────────────────────────────────────────────────────

describe("Bug Fix 1 — Location filtering in processUrgentFillNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    CleanerJobCompletion.findAll.mockResolvedValue([]);
  });

  it("notifies cleaners whose checkBookingDistance returns canBook: true", async () => {
    MultiCleanerJob.findAll.mockResolvedValue([makeJob()]);
    User.findAll.mockResolvedValue([makeCleaner({ id: 201 }), makeCleaner({ id: 202 })]);
    checkBookingDistance.mockReturnValue({ canBook: true });

    const count = await processUrgentFillNotifications();

    expect(count).toBe(1);
    expect(NotificationService.createNotification).toHaveBeenCalledTimes(2);
  });

  it("does NOT notify cleaners whose checkBookingDistance returns canBook: false", async () => {
    MultiCleanerJob.findAll.mockResolvedValue([makeJob()]);
    User.findAll.mockResolvedValue([makeCleaner({ id: 201 }), makeCleaner({ id: 202 })]);
    checkBookingDistance.mockReturnValue({ canBook: false });

    const count = await processUrgentFillNotifications();

    expect(count).toBe(1); // job is still processed (timestamp updated)
    expect(NotificationService.createNotification).not.toHaveBeenCalled();
  });

  it("filters a mix of nearby and far cleaners correctly", async () => {
    MultiCleanerJob.findAll.mockResolvedValue([makeJob()]);
    User.findAll.mockResolvedValue([makeCleaner({ id: 201 }), makeCleaner({ id: 202 })]);
    // First cleaner nearby, second too far
    checkBookingDistance
      .mockReturnValueOnce({ canBook: true })
      .mockReturnValueOnce({ canBook: false });

    await processUrgentFillNotifications();

    expect(NotificationService.createNotification).toHaveBeenCalledTimes(1);
    expect(NotificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 201 })
    );
  });

  it("includes cleaners with no service area coordinates (safe fallback — no silent drops)", async () => {
    MultiCleanerJob.findAll.mockResolvedValue([makeJob()]);
    User.findAll.mockResolvedValue([
      makeCleaner({ id: 201, serviceAreaLatitude: null, serviceAreaLongitude: null }),
    ]);

    await processUrgentFillNotifications();

    // No distance check when coords are missing — cleaner is included by default
    expect(checkBookingDistance).not.toHaveBeenCalled();
    expect(NotificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 201 })
    );
  });

  it("includes cleaners when home has no coordinates (safe fallback)", async () => {
    const job = makeJob();
    job.appointment.home.latitude = null;
    job.appointment.home.longitude = null;
    MultiCleanerJob.findAll.mockResolvedValue([job]);
    User.findAll.mockResolvedValue([makeCleaner({ id: 201 })]);

    await processUrgentFillNotifications();

    expect(checkBookingDistance).not.toHaveBeenCalled();
    expect(NotificationService.createNotification).toHaveBeenCalled();
  });

  it("does NOT notify cleaners already assigned to the job", async () => {
    MultiCleanerJob.findAll.mockResolvedValue([makeJob()]);
    User.findAll.mockResolvedValue([makeCleaner({ id: 201 }), makeCleaner({ id: 202 })]);
    checkBookingDistance.mockReturnValue({ canBook: true });
    CleanerJobCompletion.findAll.mockResolvedValue([{ cleanerId: 201 }]);

    await processUrgentFillNotifications();

    expect(NotificationService.createNotification).toHaveBeenCalledTimes(1);
    expect(NotificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 202 })
    );
  });

  it("fetches all non-frozen cleaners — no global limit:50 cap", async () => {
    MultiCleanerJob.findAll.mockResolvedValue([makeJob()]);
    const cleaners = Array.from({ length: 75 }, (_, i) => makeCleaner({ id: 300 + i }));
    User.findAll.mockResolvedValue(cleaners);
    checkBookingDistance.mockReturnValue({ canBook: true });

    await processUrgentFillNotifications();

    expect(NotificationService.createNotification).toHaveBeenCalledTimes(75);
    const findAllCall = User.findAll.mock.calls[0][0];
    expect(findAllCall).not.toHaveProperty("limit");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug Fix 2: Notification Count Cap
// ─────────────────────────────────────────────────────────────────────────────

describe("Bug Fix 2 — Notification count cap in processUrgentFillNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    CleanerJobCompletion.findAll.mockResolvedValue([]);
    checkBookingDistance.mockReturnValue({ canBook: true });
  });

  it("increments urgentNotificationCount on each successful send", async () => {
    const job = makeJob({ urgentNotificationCount: 0 });
    MultiCleanerJob.findAll.mockResolvedValue([job]);
    User.findAll.mockResolvedValue([makeCleaner()]);

    await processUrgentFillNotifications();

    expect(job.update).toHaveBeenCalledWith(
      expect.objectContaining({ urgentNotificationCount: 1 })
    );
  });

  it("increments from existing count rather than always from zero", async () => {
    const job = makeJob({ urgentNotificationCount: 2 });
    MultiCleanerJob.findAll.mockResolvedValue([job]);
    User.findAll.mockResolvedValue([makeCleaner()]);

    await processUrgentFillNotifications();

    expect(job.update).toHaveBeenCalledWith(
      expect.objectContaining({ urgentNotificationCount: 3 })
    );
  });

  it("updates urgentNotificationSentAt alongside the count in a single call", async () => {
    const job = makeJob({ urgentNotificationCount: 1 });
    MultiCleanerJob.findAll.mockResolvedValue([job]);
    User.findAll.mockResolvedValue([makeCleaner()]);

    await processUrgentFillNotifications();

    expect(job.update).toHaveBeenCalledWith({
      urgentNotificationSentAt: expect.any(Date),
      urgentNotificationCount: 2,
    });
  });

  it("DB query includes urgentNotificationCount < maxUrgentNotifications filter", async () => {
    MultiCleanerJob.findAll.mockResolvedValue([]);

    await processUrgentFillNotifications();

    const where = MultiCleanerJob.findAll.mock.calls[0][0].where;
    const Op = require("sequelize").Op;
    expect(where).toHaveProperty("urgentNotificationCount");
    expect(where.urgentNotificationCount).toEqual({ [Op.lt]: 4 });
  });

  it("DB query uses Op.between to exclude past appointments at the DB level", async () => {
    MultiCleanerJob.findAll.mockResolvedValue([]);

    await processUrgentFillNotifications();

    const include = MultiCleanerJob.findAll.mock.calls[0][0].include;
    const apptInclude = include.find((i) => i.as === "appointment");
    const Op = require("sequelize").Op;

    // Op.between is a Symbol so we use bracket access, not toHaveProperty
    const range = apptInclude.where.date[Op.between];
    expect(Array.isArray(range)).toBe(true);
    const [start, end] = range;
    expect(start).toBe(TODAY);
    expect(new Date(end) > new Date(TODAY)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug Fix 3: Race Condition in processExpiredEdgeCaseDecisions
// ─────────────────────────────────────────────────────────────────────────────

describe("Bug Fix 3 — Race condition fix in processExpiredEdgeCaseDecisions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset transaction mock to its default implementation
    sequelize.transaction.mockImplementation(async (cb) =>
      cb({ LOCK: { UPDATE: "UPDATE" } })
    );
  });

  const confirmedCleaner = {
    cleanerId: 201,
    cleaner: { id: 201, firstName: "Jane", email: "jane@test.com", expoPushToken: null },
  };

  it("wraps per-job processing in a sequelize transaction", async () => {
    MultiCleanerJob.findAll.mockResolvedValue([makeExpiredJob()]);
    MultiCleanerJob.findByPk.mockResolvedValue(makeLockedJob("pending"));
    CleanerJobCompletion.findAll.mockResolvedValue([confirmedCleaner]);

    await processExpiredEdgeCaseDecisions();

    expect(sequelize.transaction).toHaveBeenCalled();
  });

  it("re-reads the job with LOCK.UPDATE inside the transaction", async () => {
    MultiCleanerJob.findAll.mockResolvedValue([makeExpiredJob({ id: 5 })]);
    MultiCleanerJob.findByPk.mockResolvedValue(makeLockedJob("pending"));
    CleanerJobCompletion.findAll.mockResolvedValue([confirmedCleaner]);

    await processExpiredEdgeCaseDecisions();

    expect(MultiCleanerJob.findByPk).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ lock: "UPDATE" })
    );
  });

  it("skips the job if homeownerDecision already changed to non-pending inside the transaction", async () => {
    MultiCleanerJob.findAll.mockResolvedValue([makeExpiredJob()]);
    MultiCleanerJob.findByPk.mockResolvedValue(makeLockedJob("auto_proceeded"));

    const result = await processExpiredEdgeCaseDecisions();

    expect(NotificationService.createNotification).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });

  it("skips the job if findByPk returns null inside the transaction", async () => {
    MultiCleanerJob.findAll.mockResolvedValue([makeExpiredJob()]);
    MultiCleanerJob.findByPk.mockResolvedValue(null);

    const result = await processExpiredEdgeCaseDecisions();

    expect(NotificationService.createNotification).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });

  it("processes the job and sends notifications when state is still pending", async () => {
    MultiCleanerJob.findAll.mockResolvedValue([makeExpiredJob()]);
    const lockedJob = makeLockedJob("pending");
    MultiCleanerJob.findByPk.mockResolvedValue(lockedJob);
    CleanerJobCompletion.findAll.mockResolvedValue([confirmedCleaner]);

    const result = await processExpiredEdgeCaseDecisions();

    expect(result).toBe(1);
    expect(NotificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "edge_case_auto_proceeded", userId: 100 })
    );
    expect(NotificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "edge_case_cleaner_confirmed", userId: 201 })
    );
    expect(lockedJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ homeownerDecision: "auto_proceeded" }),
      expect.objectContaining({ transaction: expect.any(Object) })
    );
  });

  it("processes one job and skips another that a concurrent instance already handled", async () => {
    MultiCleanerJob.findAll.mockResolvedValue([
      makeExpiredJob({ id: 5 }),
      makeExpiredJob({ id: 6 }),
    ]);

    const pendingLocked = makeLockedJob("pending");
    const alreadyHandled = makeLockedJob("cancel");

    MultiCleanerJob.findByPk
      .mockResolvedValueOnce(pendingLocked)
      .mockResolvedValueOnce(alreadyHandled);

    CleanerJobCompletion.findAll.mockResolvedValue([confirmedCleaner]);

    const result = await processExpiredEdgeCaseDecisions();

    expect(result).toBe(1);
    expect(pendingLocked.update).toHaveBeenCalled();
    expect(alreadyHandled.update).not.toHaveBeenCalled();
  });
});
