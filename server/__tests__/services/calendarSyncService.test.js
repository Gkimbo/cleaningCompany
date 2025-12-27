/**
 * Calendar Sync Service Tests
 */

// Mock the icalParser module
jest.mock("../../services/icalParser", () => ({
  getCheckoutDates: jest.fn(),
}));

// Mock calculatePrice
jest.mock("../../services/CalculatePrice", () => jest.fn(() => 150));

// Mock Email class
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendAutoSyncAppointmentsCreated: jest.fn().mockResolvedValue(true),
}));

// Mock models
jest.mock("../../models", () => ({
  CalendarSync: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  UserAppointments: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
  UserBills: {
    findOne: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
}));

const { CalendarSync, UserAppointments, UserHomes, UserBills, User } = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");
const { getCheckoutDates } = require("../../services/icalParser");
const {
  syncSingleCalendar,
  syncAllCalendars,
  startPeriodicSync,
  stopPeriodicSync,
} = require("../../services/calendarSyncService");

describe("Calendar Sync Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    stopPeriodicSync();
    jest.useRealTimers();
  });

  describe("syncSingleCalendar", () => {
    const createMockSync = (overrides = {}) => ({
      id: 1,
      userId: 1,
      homeId: 1,
      platform: "airbnb",
      icalUrl: "https://airbnb.com/calendar/123.ics",
      isActive: true,
      autoCreateAppointments: true,
      daysAfterCheckout: 0,
      syncedEventUids: [],
      update: jest.fn().mockResolvedValue(true),
      ...overrides,
    });

    const createMockHome = () => ({
      id: 1,
      numBeds: 3,
      numBaths: 2,
      sheetsProvided: "yes",
      towelsProvided: "no",
      timeToBeCompleted: "anytime",
      keyPadCode: "1234",
      keyLocation: null,
      cleanersNeeded: 1,
    });

    const createMockBill = () => ({
      dataValues: {
        cancellationFee: 0,
        appointmentDue: 100,
      },
      update: jest.fn().mockResolvedValue(true),
    });

    it("should successfully sync calendar and create appointments", async () => {
      const mockSync = createMockSync();
      const mockHome = createMockHome();
      const mockBill = createMockBill();

      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserBills.findOne.mockResolvedValue(mockBill);
      UserAppointments.findOne.mockResolvedValue(null);
      UserAppointments.create.mockResolvedValue({ id: 1 });
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Reserved" },
        { checkoutDate: "2025-03-15", uid: "uid2", summary: "Guest B" },
      ]);

      const result = await syncSingleCalendar(mockSync);

      expect(result.success).toBe(true);
      expect(result.checkoutsFound).toBe(2);
      expect(result.appointmentsCreated).toBe(2);
      expect(result.error).toBeNull();
      expect(mockSync.update).toHaveBeenCalledWith(
        expect.objectContaining({
          lastSyncStatus: "success",
          lastSyncError: null,
        })
      );
    });

    it("should skip already synced events", async () => {
      const mockSync = createMockSync({
        syncedEventUids: ["uid1"],
      });
      const mockHome = createMockHome();
      const mockBill = createMockBill();

      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserBills.findOne.mockResolvedValue(mockBill);
      UserAppointments.findOne.mockResolvedValue(null);
      UserAppointments.create.mockResolvedValue({ id: 1 });
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Reserved" },
        { checkoutDate: "2025-03-15", uid: "uid2", summary: "Guest B" },
      ]);

      const result = await syncSingleCalendar(mockSync);

      expect(result.success).toBe(true);
      expect(result.appointmentsCreated).toBe(1); // Only uid2 created
    });

    it("should skip dates with existing appointments", async () => {
      const mockSync = createMockSync();
      const mockHome = createMockHome();

      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserAppointments.findOne.mockResolvedValue({ id: 1, date: "2025-03-01" });
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Reserved" },
      ]);

      const result = await syncSingleCalendar(mockSync);

      expect(result.success).toBe(true);
      expect(result.appointmentsCreated).toBe(0);
      expect(UserAppointments.create).not.toHaveBeenCalled();
    });

    it("should respect daysAfterCheckout setting", async () => {
      const mockSync = createMockSync({ daysAfterCheckout: 1 });
      const mockHome = createMockHome();
      const mockBill = createMockBill();

      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserBills.findOne.mockResolvedValue(mockBill);
      UserAppointments.findOne.mockResolvedValue(null);
      UserAppointments.create.mockResolvedValue({ id: 1 });
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Reserved" },
      ]);

      await syncSingleCalendar(mockSync);

      expect(UserAppointments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          date: "2025-03-02", // Day after checkout
        })
      );
    });

    it("should not create appointments when autoCreateAppointments is false", async () => {
      const mockSync = createMockSync({ autoCreateAppointments: false });
      const mockHome = createMockHome();

      UserHomes.findByPk.mockResolvedValue(mockHome);
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Reserved" },
      ]);

      const result = await syncSingleCalendar(mockSync);

      expect(result.success).toBe(true);
      expect(result.appointmentsCreated).toBe(0);
      expect(UserAppointments.create).not.toHaveBeenCalled();
    });

    it("should handle fetch error and update sync status", async () => {
      const mockSync = createMockSync();

      UserHomes.findByPk.mockResolvedValue(createMockHome());
      getCheckoutDates.mockRejectedValue(new Error("Network timeout"));

      const result = await syncSingleCalendar(mockSync);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network timeout");
      expect(mockSync.update).toHaveBeenCalledWith(
        expect.objectContaining({
          lastSyncStatus: "error",
          lastSyncError: "Network timeout",
        })
      );
    });

    it("should handle missing home", async () => {
      const mockSync = createMockSync();

      UserHomes.findByPk.mockResolvedValue(null);
      getCheckoutDates.mockResolvedValue([]);

      const result = await syncSingleCalendar(mockSync);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Home not found");
    });

    it("should update user bill when creating appointments", async () => {
      const mockSync = createMockSync();
      const mockHome = createMockHome();
      const mockBill = createMockBill();

      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserBills.findOne.mockResolvedValue(mockBill);
      UserAppointments.findOne.mockResolvedValue(null);
      UserAppointments.create.mockResolvedValue({ id: 1 });
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Reserved" },
      ]);

      await syncSingleCalendar(mockSync);

      expect(mockBill.update).toHaveBeenCalled();
    });

    it("should track created appointment details in result", async () => {
      const mockSync = createMockSync();
      const mockHome = createMockHome();
      const mockBill = createMockBill();

      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserBills.findOne.mockResolvedValue(mockBill);
      UserAppointments.findOne.mockResolvedValue(null);
      UserAppointments.create.mockResolvedValue({ id: 123 });
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Airbnb Guest" },
      ]);

      const result = await syncSingleCalendar(mockSync);

      expect(result.createdAppointments).toHaveLength(1);
      expect(result.createdAppointments[0]).toEqual({
        id: 123,
        date: "2025-03-01",
        price: 150,
        source: "Airbnb Guest",
      });
    });

    it("should send email notification when sendEmail is true and appointments created", async () => {
      const mockSync = createMockSync();
      const mockHome = createMockHome();
      const mockBill = createMockBill();
      const mockUser = { id: 1, email: "test@example.com", firstName: "John" };

      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserBills.findOne.mockResolvedValue(mockBill);
      UserAppointments.findOne.mockResolvedValue(null);
      UserAppointments.create.mockResolvedValue({ id: 1 });
      User.findByPk.mockResolvedValue(mockUser);
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Reserved" },
      ]);

      await syncSingleCalendar(mockSync, true);

      expect(Email.sendAutoSyncAppointmentsCreated).toHaveBeenCalledWith(
        "test@example.com",
        "John",
        mockHome,
        expect.arrayContaining([
          expect.objectContaining({ date: "2025-03-01", price: 150 }),
        ]),
        "airbnb"
      );
    });

    it("should not send email when sendEmail is false", async () => {
      const mockSync = createMockSync();
      const mockHome = createMockHome();
      const mockBill = createMockBill();

      UserHomes.findByPk.mockResolvedValue(mockHome);
      UserBills.findOne.mockResolvedValue(mockBill);
      UserAppointments.findOne.mockResolvedValue(null);
      UserAppointments.create.mockResolvedValue({ id: 1 });
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Reserved" },
      ]);

      await syncSingleCalendar(mockSync, false);

      expect(Email.sendAutoSyncAppointmentsCreated).not.toHaveBeenCalled();
    });

    it("should not send email when no appointments created", async () => {
      const mockSync = createMockSync({ syncedEventUids: ["uid1"] });
      const mockHome = createMockHome();

      UserHomes.findByPk.mockResolvedValue(mockHome);
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Reserved" },
      ]);

      await syncSingleCalendar(mockSync, true);

      expect(Email.sendAutoSyncAppointmentsCreated).not.toHaveBeenCalled();
    });
  });

  describe("syncAllCalendars", () => {
    it("should sync all active calendars", async () => {
      const mockSyncs = [
        {
          id: 1,
          userId: 1,
          homeId: 1,
          platform: "airbnb",
          icalUrl: "https://airbnb.com/1.ics",
          isActive: true,
          autoSync: true,
          autoCreateAppointments: true,
          daysAfterCheckout: 0,
          syncedEventUids: [],
          update: jest.fn().mockResolvedValue(true),
        },
        {
          id: 2,
          userId: 2,
          homeId: 2,
          platform: "vrbo",
          icalUrl: "https://vrbo.com/2.ics",
          isActive: true,
          autoSync: true,
          autoCreateAppointments: true,
          daysAfterCheckout: 0,
          syncedEventUids: [],
          update: jest.fn().mockResolvedValue(true),
        },
      ];

      CalendarSync.findAll.mockResolvedValue(mockSyncs);
      UserHomes.findByPk.mockResolvedValue({
        id: 1,
        numBeds: 2,
        numBaths: 1,
        sheetsProvided: "no",
        towelsProvided: "no",
        timeToBeCompleted: "anytime",
        cleanersNeeded: 1,
      });
      getCheckoutDates.mockResolvedValue([]);

      const resultPromise = syncAllCalendars();

      // Advance timers to handle the delay between syncs
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.totalSyncs).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(CalendarSync.findAll).toHaveBeenCalledWith({ where: { isActive: true, autoSync: true } });
    });

    it("should handle mixed success and failure", async () => {
      const mockSyncs = [
        {
          id: 1,
          userId: 1,
          homeId: 1,
          icalUrl: "https://airbnb.com/1.ics",
          isActive: true,
          autoSync: true,
          autoCreateAppointments: true,
          daysAfterCheckout: 0,
          syncedEventUids: [],
          update: jest.fn().mockResolvedValue(true),
        },
        {
          id: 2,
          userId: 2,
          homeId: 2,
          icalUrl: "https://vrbo.com/2.ics",
          isActive: true,
          autoSync: true,
          autoCreateAppointments: true,
          daysAfterCheckout: 0,
          syncedEventUids: [],
          update: jest.fn().mockResolvedValue(true),
        },
      ];

      CalendarSync.findAll.mockResolvedValue(mockSyncs);

      let callCount = 0;
      UserHomes.findByPk.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            id: 1,
            numBeds: 2,
            numBaths: 1,
            sheetsProvided: "no",
            towelsProvided: "no",
            timeToBeCompleted: "anytime",
            cleanersNeeded: 1,
          });
        }
        return Promise.resolve(null); // Second sync fails with missing home
      });
      getCheckoutDates.mockResolvedValue([]);

      const resultPromise = syncAllCalendars();

      // Advance timers to handle the delay between syncs
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });

    it("should return summary with timing info", async () => {
      CalendarSync.findAll.mockResolvedValue([]);

      const result = await syncAllCalendars();

      expect(result).toHaveProperty("startedAt");
      expect(result).toHaveProperty("completedAt");
      expect(result).toHaveProperty("duration");
      expect(result.totalSyncs).toBe(0);
    });

    it("should track total appointments created", async () => {
      const mockSync = {
        id: 1,
        userId: 1,
        homeId: 1,
        icalUrl: "https://airbnb.com/1.ics",
        isActive: true,
        autoSync: true,
        autoCreateAppointments: true,
        daysAfterCheckout: 0,
        syncedEventUids: [],
        update: jest.fn().mockResolvedValue(true),
      };

      CalendarSync.findAll.mockResolvedValue([mockSync]);
      UserHomes.findByPk.mockResolvedValue({
        id: 1,
        numBeds: 2,
        numBaths: 1,
        sheetsProvided: "no",
        towelsProvided: "no",
        timeToBeCompleted: "anytime",
        cleanersNeeded: 1,
      });
      UserBills.findOne.mockResolvedValue({
        dataValues: { cancellationFee: 0, appointmentDue: 0 },
        update: jest.fn(),
      });
      UserAppointments.findOne.mockResolvedValue(null);
      UserAppointments.create.mockResolvedValue({ id: 1 });
      getCheckoutDates.mockResolvedValue([
        { checkoutDate: "2025-03-01", uid: "uid1", summary: "Reserved" },
        { checkoutDate: "2025-03-15", uid: "uid2", summary: "Reserved" },
      ]);

      const resultPromise = syncAllCalendars();

      // Advance timers to handle the delay between syncs
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.totalAppointmentsCreated).toBe(2);
    });
  });

  describe("startPeriodicSync / stopPeriodicSync", () => {
    it("should start periodic sync and log scheduler info", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      startPeriodicSync();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[CalendarSync] Scheduler initialized:")
      );

      consoleSpy.mockRestore();
    });

    it("should not start multiple periodic syncs", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      startPeriodicSync();
      startPeriodicSync();

      expect(consoleSpy).toHaveBeenCalledWith("[CalendarSync] Scheduler already running");

      consoleSpy.mockRestore();
    });

    it("should stop periodic sync", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      startPeriodicSync();
      stopPeriodicSync();

      expect(consoleSpy).toHaveBeenCalledWith("[CalendarSync] Scheduler stopped (new jobs won't be scheduled)");

      consoleSpy.mockRestore();
    });

    it("should run initial sync after delay", async () => {
      CalendarSync.findAll.mockResolvedValue([]);

      startPeriodicSync();

      // Fast-forward past the initial sync delay (10 seconds)
      jest.advanceTimersByTime(11000);

      // Wait for promises to resolve
      await Promise.resolve();

      expect(CalendarSync.findAll).toHaveBeenCalled();
    });
  });
});
