const LastMinuteNotificationService = require("../../services/LastMinuteNotificationService");
const { User, Notification } = require("../../models");
const { calculateDistance } = require("../../utils/geoUtils");
const { getPricingConfig } = require("../../config/businessConfig");
const EncryptionService = require("../../services/EncryptionService");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");
const Email = require("../../services/sendNotifications/EmailClass");

// Mock all dependencies
jest.mock("../../models", () => ({
  User: {
    findAll: jest.fn(),
  },
  Notification: {
    create: jest.fn(),
    getUnreadCount: jest.fn(),
  },
}));

jest.mock("../../utils/geoUtils", () => ({
  calculateDistance: jest.fn(),
}));

jest.mock("../../config/businessConfig", () => ({
  getPricingConfig: jest.fn(),
}));

jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => value.replace("iv:", "decrypted_")),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNotification: jest.fn(),
}));

jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendLastMinuteUrgentEmail: jest.fn(),
}));

describe("LastMinuteNotificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("findNearbyCleaners", () => {
    it("should find cleaners within the specified radius", async () => {
      const mockCleaners = [
        {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          email: "john@test.com",
          expoPushToken: "ExponentPushToken[xxx]",
          serviceAreaLatitude: "42.3601",
          serviceAreaLongitude: "-71.0589",
          serviceAreaRadiusMiles: 30,
          notifications: ["email", "phone"],
        },
        {
          id: 2,
          firstName: "Jane",
          lastName: "Smith",
          email: "jane@test.com",
          expoPushToken: "ExponentPushToken[yyy]",
          serviceAreaLatitude: "42.3700",
          serviceAreaLongitude: "-71.0600",
          serviceAreaRadiusMiles: 25,
          notifications: ["email"],
        },
      ];

      User.findAll.mockResolvedValue(mockCleaners);
      // 5 miles = 8046.7 meters
      calculateDistance.mockReturnValue(8046.7);

      const result = await LastMinuteNotificationService.findNearbyCleaners(
        42.36,
        -71.06,
        25
      );

      expect(User.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: "cleaner",
            accountFrozen: false,
          }),
        })
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].distanceMiles).toBe("5.0");
    });

    it("should exclude cleaners outside the notification radius", async () => {
      const mockCleaners = [
        {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          email: "john@test.com",
          serviceAreaLatitude: "42.3601",
          serviceAreaLongitude: "-71.0589",
          serviceAreaRadiusMiles: 30,
          notifications: ["email"],
        },
      ];

      User.findAll.mockResolvedValue(mockCleaners);
      // 50 miles = 80467 meters (outside 25 mile radius)
      calculateDistance.mockReturnValue(80467);

      const result = await LastMinuteNotificationService.findNearbyCleaners(
        42.36,
        -71.06,
        25
      );

      expect(result).toHaveLength(0);
    });

    it("should exclude cleaners when home is outside their service area", async () => {
      const mockCleaners = [
        {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          email: "john@test.com",
          serviceAreaLatitude: "42.3601",
          serviceAreaLongitude: "-71.0589",
          serviceAreaRadiusMiles: 10, // Small service area
          notifications: ["email"],
        },
      ];

      User.findAll.mockResolvedValue(mockCleaners);
      // 20 miles = 32186.8 meters (within notification radius but outside cleaner's service area)
      calculateDistance.mockReturnValue(32186.8);

      const result = await LastMinuteNotificationService.findNearbyCleaners(
        42.36,
        -71.06,
        25
      );

      expect(result).toHaveLength(0);
    });

    it("should skip cleaners with invalid coordinates", async () => {
      const mockCleaners = [
        {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          serviceAreaLatitude: "invalid",
          serviceAreaLongitude: "-71.0589",
          serviceAreaRadiusMiles: 30,
        },
      ];

      User.findAll.mockResolvedValue(mockCleaners);

      const result = await LastMinuteNotificationService.findNearbyCleaners(
        42.36,
        -71.06,
        25
      );

      expect(result).toHaveLength(0);
    });

    it("should skip cleaners when calculateDistance returns null", async () => {
      const mockCleaners = [
        {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          serviceAreaLatitude: "42.3601",
          serviceAreaLongitude: "-71.0589",
          serviceAreaRadiusMiles: 30,
        },
      ];

      User.findAll.mockResolvedValue(mockCleaners);
      calculateDistance.mockReturnValue(null);

      const result = await LastMinuteNotificationService.findNearbyCleaners(
        42.36,
        -71.06,
        25
      );

      expect(result).toHaveLength(0);
    });

    it("should sort cleaners by distance (closest first)", async () => {
      const mockCleaners = [
        {
          id: 1,
          firstName: "Far",
          lastName: "Cleaner",
          serviceAreaLatitude: "42.3601",
          serviceAreaLongitude: "-71.0589",
          serviceAreaRadiusMiles: 30,
        },
        {
          id: 2,
          firstName: "Close",
          lastName: "Cleaner",
          serviceAreaLatitude: "42.3602",
          serviceAreaLongitude: "-71.0590",
          serviceAreaRadiusMiles: 30,
        },
      ];

      User.findAll.mockResolvedValue(mockCleaners);
      calculateDistance
        .mockReturnValueOnce(16093.4) // 10 miles for cleaner 1
        .mockReturnValueOnce(4828); // 3 miles for cleaner 2

      const result = await LastMinuteNotificationService.findNearbyCleaners(
        42.36,
        -71.06,
        25
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(2); // Closer cleaner first
      expect(result[1].id).toBe(1);
    });

    it("should use default service area radius when not specified", async () => {
      const mockCleaners = [
        {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          serviceAreaLatitude: "42.3601",
          serviceAreaLongitude: "-71.0589",
          serviceAreaRadiusMiles: null, // Not set, should default to 30
          notifications: ["email"],
        },
      ];

      User.findAll.mockResolvedValue(mockCleaners);
      // 25 miles = 40233.5 meters (within default 30 mile service area)
      calculateDistance.mockReturnValue(40233.5);

      const result = await LastMinuteNotificationService.findNearbyCleaners(
        42.36,
        -71.06,
        30
      );

      expect(result).toHaveLength(1);
    });
  });

  describe("notifyNearbyCleaners", () => {
    const mockAppointment = {
      id: 100,
      price: "250.00",
      date: "2026-01-15",
      lastMinuteFeeApplied: 50,
      update: jest.fn(),
    };

    const mockHome = {
      id: 50,
      latitude: "iv:42.3601",
      longitude: "iv:-71.0589",
      city: "Boston",
    };

    beforeEach(() => {
      getPricingConfig.mockResolvedValue({
        lastMinute: {
          notificationRadiusMiles: 25,
        },
      });
    });

    it("should notify nearby cleaners via all channels", async () => {
      const mockCleaners = [
        {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          email: "john@test.com",
          expoPushToken: "ExponentPushToken[xxx]",
          serviceAreaLatitude: "42.3601",
          serviceAreaLongitude: "-71.0589",
          serviceAreaRadiusMiles: 30,
          notifications: ["email", "phone"],
        },
      ];

      User.findAll.mockResolvedValue(mockCleaners);
      calculateDistance.mockReturnValue(8046.7); // 5 miles
      Notification.create.mockResolvedValue({});
      PushNotification.sendPushNotification.mockResolvedValue({});
      Email.sendLastMinuteUrgentEmail.mockResolvedValue({});
      Notification.getUnreadCount.mockResolvedValue(5);

      const result = await LastMinuteNotificationService.notifyNearbyCleaners(
        mockAppointment,
        mockHome
      );

      expect(result.notifiedCount).toBe(1);
      expect(result.cleanerIds).toContain(1);

      // Check in-app notification
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          type: "last_minute_urgent",
          actionRequired: true,
        })
      );

      // Check push notification
      expect(PushNotification.sendPushNotification).toHaveBeenCalledWith(
        "ExponentPushToken[xxx]",
        expect.stringContaining("Urgent"),
        expect.any(String),
        expect.objectContaining({
          type: "last_minute_urgent",
          appointmentId: 100,
        })
      );

      // Check email
      expect(Email.sendLastMinuteUrgentEmail).toHaveBeenCalledWith(
        "john@test.com",
        "John",
        "2026-01-15",
        "$250.00",
        "Boston",
        "5.0"
      );

      // Check appointment update
      expect(mockAppointment.update).toHaveBeenCalledWith({
        lastMinuteNotificationsSentAt: expect.any(Date),
      });
    });

    it("should return zero count when no cleaners found", async () => {
      User.findAll.mockResolvedValue([]);

      const result = await LastMinuteNotificationService.notifyNearbyCleaners(
        mockAppointment,
        mockHome
      );

      expect(result.notifiedCount).toBe(0);
      expect(result.cleanerIds).toEqual([]);
    });

    it("should return zero count when home has invalid coordinates", async () => {
      EncryptionService.decrypt.mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      const result = await LastMinuteNotificationService.notifyNearbyCleaners(
        mockAppointment,
        mockHome
      );

      expect(result.notifiedCount).toBe(0);
      expect(result.cleanerIds).toEqual([]);
    });

    it("should skip email for cleaners without email notifications enabled", async () => {
      const mockCleaners = [
        {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          email: "john@test.com",
          expoPushToken: "ExponentPushToken[xxx]",
          serviceAreaLatitude: "42.3601",
          serviceAreaLongitude: "-71.0589",
          serviceAreaRadiusMiles: 30,
          notifications: ["phone"], // No email
        },
      ];

      EncryptionService.decrypt.mockImplementation((value) =>
        value.replace("iv:", "")
      );
      User.findAll.mockResolvedValue(mockCleaners);
      calculateDistance.mockReturnValue(8046.7);

      await LastMinuteNotificationService.notifyNearbyCleaners(
        mockAppointment,
        mockHome
      );

      expect(Email.sendLastMinuteUrgentEmail).not.toHaveBeenCalled();
    });

    it("should skip push notification for cleaners without expoPushToken", async () => {
      const mockCleaners = [
        {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          email: "john@test.com",
          expoPushToken: null,
          serviceAreaLatitude: "42.3601",
          serviceAreaLongitude: "-71.0589",
          serviceAreaRadiusMiles: 30,
          notifications: ["email"],
        },
      ];

      EncryptionService.decrypt.mockImplementation((value) =>
        value.replace("iv:", "")
      );
      User.findAll.mockResolvedValue(mockCleaners);
      calculateDistance.mockReturnValue(8046.7);

      await LastMinuteNotificationService.notifyNearbyCleaners(
        mockAppointment,
        mockHome
      );

      expect(PushNotification.sendPushNotification).not.toHaveBeenCalled();
    });

    it("should emit socket events when io is provided", async () => {
      const mockCleaners = [
        {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          email: "john@test.com",
          serviceAreaLatitude: "42.3601",
          serviceAreaLongitude: "-71.0589",
          serviceAreaRadiusMiles: 30,
          notifications: [],
        },
      ];

      const mockIo = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      EncryptionService.decrypt.mockImplementation((value) =>
        value.replace("iv:", "")
      );
      User.findAll.mockResolvedValue(mockCleaners);
      calculateDistance.mockReturnValue(8046.7);
      Notification.getUnreadCount.mockResolvedValue(3);

      await LastMinuteNotificationService.notifyNearbyCleaners(
        mockAppointment,
        mockHome,
        mockIo
      );

      expect(mockIo.to).toHaveBeenCalledWith("user_1");
      expect(mockIo.emit).toHaveBeenCalledWith(
        "last_minute_job",
        expect.objectContaining({
          appointmentId: 100,
        })
      );
      expect(mockIo.emit).toHaveBeenCalledWith(
        "notification_count_update",
        expect.objectContaining({
          unreadCount: 3,
        })
      );
    });

    it("should continue notifying other cleaners if one fails", async () => {
      const mockCleaners = [
        {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          email: "john@test.com",
          serviceAreaLatitude: "42.3601",
          serviceAreaLongitude: "-71.0589",
          serviceAreaRadiusMiles: 30,
          notifications: [],
        },
        {
          id: 2,
          firstName: "Jane",
          lastName: "Smith",
          email: "jane@test.com",
          serviceAreaLatitude: "42.3602",
          serviceAreaLongitude: "-71.0590",
          serviceAreaRadiusMiles: 30,
          notifications: [],
        },
      ];

      EncryptionService.decrypt.mockImplementation((value) =>
        value.replace("iv:", "")
      );
      User.findAll.mockResolvedValue(mockCleaners);
      calculateDistance.mockReturnValue(8046.7);

      // First notification fails
      Notification.create
        .mockRejectedValueOnce(new Error("DB error"))
        .mockResolvedValueOnce({});

      const result = await LastMinuteNotificationService.notifyNearbyCleaners(
        mockAppointment,
        mockHome
      );

      expect(result.notifiedCount).toBe(1);
      expect(result.cleanerIds).toContain(2);
    });

    it("should use default radius when pricing config is missing", async () => {
      getPricingConfig.mockResolvedValue({});

      const mockCleaners = [
        {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          serviceAreaLatitude: "42.3601",
          serviceAreaLongitude: "-71.0589",
          serviceAreaRadiusMiles: 30,
          notifications: [],
        },
      ];

      EncryptionService.decrypt.mockImplementation((value) =>
        value.replace("iv:", "")
      );
      User.findAll.mockResolvedValue(mockCleaners);
      calculateDistance.mockReturnValue(8046.7);

      await LastMinuteNotificationService.notifyNearbyCleaners(
        mockAppointment,
        mockHome
      );

      // Should still work with default 25 mile radius
      expect(User.findAll).toHaveBeenCalled();
    });

    it("should handle NaN coordinates after parsing", async () => {
      EncryptionService.decrypt.mockImplementation(() => "not_a_number");

      const result = await LastMinuteNotificationService.notifyNearbyCleaners(
        mockAppointment,
        mockHome
      );

      expect(result.notifiedCount).toBe(0);
      expect(result.cleanerIds).toEqual([]);
    });
  });
});
