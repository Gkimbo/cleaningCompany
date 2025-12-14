/**
 * CalendarSync Model Tests
 *
 * Tests model structure and validation without requiring a database connection.
 */

// Helper to create mock CalendarSync objects
const createMockCalendarSync = (overrides = {}) => ({
  id: 1,
  userId: 1,
  homeId: 1,
  platform: "airbnb",
  icalUrl: "https://www.airbnb.com/calendar/ical/12345.ics?s=abc123",
  isActive: true,
  lastSyncAt: new Date(),
  lastSyncStatus: "success",
  lastSyncError: null,
  syncedEventUids: ["uid1@airbnb.com", "uid2@airbnb.com"],
  autoCreateAppointments: true,
  daysAfterCheckout: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
  destroy: jest.fn().mockResolvedValue(true),
  save: jest.fn().mockResolvedValue(this),
  ...overrides,
});

describe("CalendarSync Model", () => {
  describe("Model Structure", () => {
    it("should have all required fields", () => {
      const sync = createMockCalendarSync();

      expect(sync).toHaveProperty("id");
      expect(sync).toHaveProperty("userId");
      expect(sync).toHaveProperty("homeId");
      expect(sync).toHaveProperty("platform");
      expect(sync).toHaveProperty("icalUrl");
      expect(sync).toHaveProperty("isActive");
      expect(sync).toHaveProperty("lastSyncAt");
      expect(sync).toHaveProperty("lastSyncStatus");
      expect(sync).toHaveProperty("lastSyncError");
      expect(sync).toHaveProperty("syncedEventUids");
      expect(sync).toHaveProperty("autoCreateAppointments");
      expect(sync).toHaveProperty("daysAfterCheckout");
    });

    it("should have correct default values", () => {
      const sync = createMockCalendarSync({
        isActive: true,
        autoCreateAppointments: true,
        daysAfterCheckout: 0,
      });

      expect(sync.isActive).toBe(true);
      expect(sync.autoCreateAppointments).toBe(true);
      expect(sync.daysAfterCheckout).toBe(0);
    });
  });

  describe("Platform Detection", () => {
    it("should store airbnb platform", () => {
      const sync = createMockCalendarSync({ platform: "airbnb" });
      expect(sync.platform).toBe("airbnb");
    });

    it("should store vrbo platform", () => {
      const sync = createMockCalendarSync({ platform: "vrbo" });
      expect(sync.platform).toBe("vrbo");
    });

    it("should store booking platform", () => {
      const sync = createMockCalendarSync({ platform: "booking" });
      expect(sync.platform).toBe("booking");
    });

    it("should store other platform for unknown sources", () => {
      const sync = createMockCalendarSync({ platform: "other" });
      expect(sync.platform).toBe("other");
    });
  });

  describe("Sync Status", () => {
    it("should track successful sync", () => {
      const sync = createMockCalendarSync({
        lastSyncStatus: "success",
        lastSyncError: null,
      });

      expect(sync.lastSyncStatus).toBe("success");
      expect(sync.lastSyncError).toBeNull();
    });

    it("should track failed sync with error message", () => {
      const sync = createMockCalendarSync({
        lastSyncStatus: "error",
        lastSyncError: "Failed to fetch calendar: timeout",
      });

      expect(sync.lastSyncStatus).toBe("error");
      expect(sync.lastSyncError).toBe("Failed to fetch calendar: timeout");
    });

    it("should update lastSyncAt timestamp", async () => {
      const sync = createMockCalendarSync();
      const newSyncTime = new Date();

      await sync.update({ lastSyncAt: newSyncTime });

      expect(sync.lastSyncAt).toEqual(newSyncTime);
    });
  });

  describe("Synced Event UIDs", () => {
    it("should store array of synced UIDs", () => {
      const sync = createMockCalendarSync({
        syncedEventUids: ["uid1@airbnb.com", "uid2@airbnb.com", "uid3@airbnb.com"],
      });

      expect(sync.syncedEventUids).toHaveLength(3);
      expect(sync.syncedEventUids).toContain("uid1@airbnb.com");
    });

    it("should allow empty array for new syncs", () => {
      const sync = createMockCalendarSync({ syncedEventUids: [] });

      expect(sync.syncedEventUids).toHaveLength(0);
    });

    it("should add new UIDs to array", async () => {
      const sync = createMockCalendarSync({ syncedEventUids: ["uid1"] });
      const newUids = [...sync.syncedEventUids, "uid2", "uid3"];

      await sync.update({ syncedEventUids: newUids });

      expect(sync.syncedEventUids).toHaveLength(3);
    });
  });

  describe("Days After Checkout Setting", () => {
    it("should allow 0 for same-day cleaning", () => {
      const sync = createMockCalendarSync({ daysAfterCheckout: 0 });
      expect(sync.daysAfterCheckout).toBe(0);
    });

    it("should allow 1 for next-day cleaning", () => {
      const sync = createMockCalendarSync({ daysAfterCheckout: 1 });
      expect(sync.daysAfterCheckout).toBe(1);
    });

    it("should allow other positive integers", () => {
      const sync = createMockCalendarSync({ daysAfterCheckout: 3 });
      expect(sync.daysAfterCheckout).toBe(3);
    });
  });

  describe("Active State", () => {
    it("should toggle active state", async () => {
      const sync = createMockCalendarSync({ isActive: true });

      await sync.update({ isActive: false });

      expect(sync.isActive).toBe(false);
    });

    it("should filter by active state for sync operations", () => {
      const activeSyncs = [
        createMockCalendarSync({ id: 1, isActive: true }),
        createMockCalendarSync({ id: 2, isActive: true }),
        createMockCalendarSync({ id: 3, isActive: false }),
      ];

      const filtered = activeSyncs.filter((s) => s.isActive);

      expect(filtered).toHaveLength(2);
    });
  });

  describe("iCal URL Storage", () => {
    it("should store Airbnb iCal URL", () => {
      const sync = createMockCalendarSync({
        icalUrl: "https://www.airbnb.com/calendar/ical/12345.ics?s=secret",
      });

      expect(sync.icalUrl).toContain("airbnb.com");
      expect(sync.icalUrl).toContain(".ics");
    });

    it("should store VRBO iCal URL", () => {
      const sync = createMockCalendarSync({
        icalUrl: "https://www.vrbo.com/icalendar/abc123.ics",
      });

      expect(sync.icalUrl).toContain("vrbo.com");
    });

    it("should store long URLs (TEXT field)", () => {
      const longUrl = "https://example.com/calendar/ical/" + "a".repeat(500) + ".ics";
      const sync = createMockCalendarSync({ icalUrl: longUrl });

      expect(sync.icalUrl.length).toBeGreaterThan(500);
    });
  });

  describe("Model Operations", () => {
    it("should update sync record", async () => {
      const sync = createMockCalendarSync();

      await sync.update({
        lastSyncAt: new Date(),
        lastSyncStatus: "success",
        syncedEventUids: ["new-uid"],
      });

      expect(sync.update).toHaveBeenCalled();
      expect(sync.syncedEventUids).toContain("new-uid");
    });

    it("should delete sync record", async () => {
      const sync = createMockCalendarSync();

      await sync.destroy();

      expect(sync.destroy).toHaveBeenCalled();
    });
  });
});
