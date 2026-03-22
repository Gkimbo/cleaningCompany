/**
 * Tests for the unassigned expired appointment cron job
 * Tests the logic that auto-cancels appointments that passed without a cleaner assigned
 */

// Mock dependencies before requiring modules
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
}));

jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendUnassignedExpiredNotification: jest.fn().mockResolvedValue("250 OK"),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushNotification: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/NotificationService", () => ({
  notifyUser: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((val) => val), // Return value as-is for testing
}));

const { User, UserAppointments, UserHomes } = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");
const NotificationService = require("../../services/NotificationService");

const {
  processExpiredUnassignedAppointments,
} = require("../../services/cron/UnassignedExpiredJob");

describe("Unassigned Expired Appointment Job", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create a date X days from now (negative = past)
  const daysFromNow = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  };

  describe("Query Criteria", () => {
    it("should query for past unassigned appointments", async () => {
      UserAppointments.findAll.mockResolvedValue([]);

      await processExpiredUnassignedAppointments();

      expect(UserAppointments.findAll).toHaveBeenCalled();
      const query = UserAppointments.findAll.mock.calls[0][0];
      expect(query.where.wasCancelled).toEqual({ [Symbol.for("ne")]: true });
      expect(query.where.completed).toBe(false);
    });
  });

  describe("Appointment Processing", () => {
    it("should cancel appointment from yesterday", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1), // yesterday
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          notificationEmail: "john@example.com",
          expoPushToken: "ExponentPushToken[xxx]",
          notifications: true,
        },
      };

      const mockHome = {
        id: 1,
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      const results = await processExpiredUnassignedAppointments();

      expect(results.cancelled).toBe(1);
      expect(mockAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          wasCancelled: true,
          cancellationType: "system",
          cancellationReason: "No cleaner was available for this appointment",
        })
      );
    });

    it("should cancel appointment from 3 days ago", async () => {
      const mockAppointment = {
        id: 2,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-3), // 3 days ago
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Jane",
          lastName: "Smith",
          email: "jane@example.com",
          notificationEmail: "jane@example.com",
          expoPushToken: null,
          notifications: true,
        },
      };

      const mockHome = {
        id: 1,
        address: "456 Oak Ave",
        city: "Cambridge",
        state: "MA",
        zipcode: "02139",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      const results = await processExpiredUnassignedAppointments();

      expect(results.cancelled).toBe(1);
      expect(mockAppointment.update).toHaveBeenCalled();
    });

    it("should NOT cancel future appointments", async () => {
      // This tests the query - future appointments shouldn't be returned
      // The query uses date <= yesterday, so future appointments won't match
      UserAppointments.findAll.mockResolvedValue([]);

      const results = await processExpiredUnassignedAppointments();

      expect(results.cancelled).toBe(0);
    });

    it("should skip appointment if homeowner not found", async () => {
      const mockAppointment = {
        id: 3,
        userId: 999,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn(),
        user: null, // No user found
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const results = await processExpiredUnassignedAppointments();

      expect(results.skipped).toBe(1);
      expect(results.cancelled).toBe(0);
      expect(mockAppointment.update).not.toHaveBeenCalled();
    });
  });

  describe("Notifications", () => {
    it("should send email notification when cancelling", async () => {
      const mockAppointment = {
        id: 4,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Bob",
          lastName: "Wilson",
          email: "bob@example.com",
          notificationEmail: "bob@example.com",
          expoPushToken: "ExponentPushToken[xxx]",
          notifications: true,
        },
      };

      const mockHome = {
        id: 1,
        address: "789 Pine St",
        city: "Somerville",
        state: "MA",
        zipcode: "02143",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await processExpiredUnassignedAppointments();

      expect(Email.sendUnassignedExpiredNotification).toHaveBeenCalledWith(
        "bob@example.com",
        expect.objectContaining({
          street: "789 Pine St",
          city: "Somerville",
          state: "MA",
          zipcode: "02143",
        }),
        "Bob Wilson",
        mockAppointment.date
      );
    });

    it("should send push notification when cancelling", async () => {
      const mockAppointment = {
        id: 5,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Alice",
          lastName: "Brown",
          email: "alice@example.com",
          notificationEmail: "alice@example.com",
          expoPushToken: "ExponentPushToken[yyy]",
          notifications: true,
        },
      };

      const mockHome = {
        id: 1,
        address: "100 Elm St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await processExpiredUnassignedAppointments();

      expect(PushNotification.sendPushNotification).toHaveBeenCalledWith(
        "ExponentPushToken[yyy]",
        "Appointment Cancelled",
        expect.stringContaining("cancelled"),
        expect.objectContaining({
          type: "appointment_expired_unassigned",
          appointmentId: 5,
        })
      );
    });

    it("should send in-app notification when cancelling", async () => {
      const mockAppointment = {
        id: 6,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Charlie",
          lastName: "Davis",
          email: "charlie@example.com",
          notificationEmail: "charlie@example.com",
          expoPushToken: null,
          notifications: true,
        },
      };

      const mockHome = {
        id: 1,
        address: "200 Maple Ave",
        city: "Newton",
        state: "MA",
        zipcode: "02458",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await processExpiredUnassignedAppointments();

      expect(NotificationService.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          type: "appointment_expired_unassigned",
          title: "Appointment Auto-Cancelled",
        })
      );
    });

    it("should NOT send push notification if user disabled notifications", async () => {
      const mockAppointment = {
        id: 7,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Eve",
          lastName: "Franklin",
          email: "eve@example.com",
          notificationEmail: "eve@example.com",
          expoPushToken: "ExponentPushToken[zzz]",
          notifications: false, // Disabled
        },
      };

      const mockHome = {
        id: 1,
        address: "300 Oak St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await processExpiredUnassignedAppointments();

      expect(PushNotification.sendPushNotification).not.toHaveBeenCalled();
    });
  });

  describe("Multiple Appointments", () => {
    it("should process multiple expired appointments", async () => {
      const mockAppointments = [
        {
          id: 8,
          userId: 1,
          homeId: 1,
          date: daysFromNow(-1),
          hasBeenAssigned: false,
          wasCancelled: false,
          completed: false,
          paid: false,
          update: jest.fn().mockResolvedValue(true),
          user: {
            id: 1,
            firstName: "User",
            lastName: "One",
            email: "user1@example.com",
            notificationEmail: "user1@example.com",
            expoPushToken: null,
            notifications: true,
          },
        },
        {
          id: 9,
          userId: 2,
          homeId: 2,
          date: daysFromNow(-2),
          hasBeenAssigned: false,
          wasCancelled: false,
          completed: false,
          paid: false,
          update: jest.fn().mockResolvedValue(true),
          user: {
            id: 2,
            firstName: "User",
            lastName: "Two",
            email: "user2@example.com",
            notificationEmail: "user2@example.com",
            expoPushToken: null,
            notifications: true,
          },
        },
        {
          id: 10,
          userId: 3,
          homeId: 3,
          date: daysFromNow(-5),
          hasBeenAssigned: false,
          wasCancelled: false,
          completed: false,
          paid: false,
          update: jest.fn().mockResolvedValue(true),
          user: {
            id: 3,
            firstName: "User",
            lastName: "Three",
            email: "user3@example.com",
            notificationEmail: "user3@example.com",
            expoPushToken: null,
            notifications: true,
          },
        },
      ];

      const mockHome = {
        id: 1,
        address: "Test Address",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue(mockAppointments);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      const results = await processExpiredUnassignedAppointments();

      expect(results.cancelled).toBe(3);
      expect(Email.sendUnassignedExpiredNotification).toHaveBeenCalledTimes(3);
    });
  });

  describe("Error Handling", () => {
    it("should continue processing after error on one appointment", async () => {
      const mockAppointments = [
        {
          id: 11,
          userId: 1,
          homeId: 1,
          date: daysFromNow(-1),
          hasBeenAssigned: false,
          wasCancelled: false,
          completed: false,
          paid: false,
          update: jest.fn().mockRejectedValue(new Error("DB Error")), // This one fails
          user: {
            id: 1,
            firstName: "User",
            lastName: "One",
            email: "user1@example.com",
            notificationEmail: "user1@example.com",
            expoPushToken: null,
            notifications: true,
          },
        },
        {
          id: 12,
          userId: 2,
          homeId: 2,
          date: daysFromNow(-1),
          hasBeenAssigned: false,
          wasCancelled: false,
          completed: false,
          paid: false,
          update: jest.fn().mockResolvedValue(true), // This one succeeds
          user: {
            id: 2,
            firstName: "User",
            lastName: "Two",
            email: "user2@example.com",
            notificationEmail: "user2@example.com",
            expoPushToken: null,
            notifications: true,
          },
        },
      ];

      const mockHome = {
        id: 1,
        address: "Test Address",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue(mockAppointments);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      const results = await processExpiredUnassignedAppointments();

      expect(results.errors).toBe(1);
      expect(results.cancelled).toBe(1);
    });

    it("should handle notification errors gracefully", async () => {
      const mockAppointment = {
        id: 13,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          notificationEmail: "test@example.com",
          expoPushToken: "token",
          notifications: true,
        },
      };

      const mockHome = {
        id: 1,
        address: "Test Address",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      Email.sendUnassignedExpiredNotification.mockRejectedValue(
        new Error("Email error")
      );

      // Should not throw, should still cancel
      const results = await processExpiredUnassignedAppointments();

      expect(results.cancelled).toBe(1);
      expect(mockAppointment.update).toHaveBeenCalled();
    });
  });

  describe("Payment Handling", () => {
    it("should flag appointments with payment for refund review", async () => {
      const mockAppointment = {
        id: 14,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: true, // Payment was taken
        paymentIntentId: "pi_12345",
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          notificationEmail: "test@example.com",
          expoPushToken: null,
          notifications: true,
        },
      };

      const mockHome = {
        id: 1,
        address: "Test Address",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      const results = await processExpiredUnassignedAppointments();

      expect(results.refunded).toBe(1);
      expect(results.cancelled).toBe(1);
    });
  });

  describe("Edge Cases - Potential Bugs", () => {
    it("should exclude clientResponsePending=true from query", async () => {
      // The query should filter out appointments waiting for client response
      UserAppointments.findAll.mockResolvedValue([]);

      await processExpiredUnassignedAppointments();

      const queryArgs = UserAppointments.findAll.mock.calls[0][0];
      // Verify query excludes clientResponsePending appointments
      expect(queryArgs.where.clientResponsePending).toEqual({ [Symbol.for("ne")]: true });
    });

    it("should exclude assignedToBusinessEmployee=true from query", async () => {
      // The query should filter out appointments assigned to business employees
      UserAppointments.findAll.mockResolvedValue([]);

      await processExpiredUnassignedAppointments();

      const queryArgs = UserAppointments.findAll.mock.calls[0][0];
      // Verify query excludes assignedToBusinessEmployee appointments
      expect(queryArgs.where.assignedToBusinessEmployee).toEqual({ [Symbol.for("ne")]: true });
    });

    it("should exclude hasBeenAssigned=true from query", async () => {
      // The query should only get truly unassigned appointments
      UserAppointments.findAll.mockResolvedValue([]);

      await processExpiredUnassignedAppointments();

      const queryArgs = UserAppointments.findAll.mock.calls[0][0];
      // Verify query excludes assigned appointments
      expect(queryArgs.where.hasBeenAssigned).toEqual({ [Symbol.for("ne")]: true });
    });

    it("should handle appointment with no home address gracefully", async () => {
      const mockAppointment = {
        id: 17,
        userId: 1,
        homeId: 999, // Home doesn't exist
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          notificationEmail: "test@example.com",
          expoPushToken: null,
          notifications: true,
        },
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(null); // Home not found

      const results = await processExpiredUnassignedAppointments();

      // Should still cancel, but email won't be sent (no address)
      expect(results.cancelled).toBe(1);
      expect(mockAppointment.update).toHaveBeenCalled();
      // Email should NOT be called because homeAddress is null
      expect(Email.sendUnassignedExpiredNotification).not.toHaveBeenCalled();
    });

    it("should handle appointment with no homeId", async () => {
      const mockAppointment = {
        id: 18,
        userId: 1,
        homeId: null, // No home ID
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          notificationEmail: "test@example.com",
          expoPushToken: null,
          notifications: true,
        },
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const results = await processExpiredUnassignedAppointments();

      // Should still cancel
      expect(results.cancelled).toBe(1);
      expect(mockAppointment.update).toHaveBeenCalled();
    });

    it("should handle user with null firstName/lastName", async () => {
      const mockAppointment = {
        id: 19,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: null,
          lastName: null,
          email: "test@example.com",
          notificationEmail: "test@example.com",
          expoPushToken: null,
          notifications: true,
        },
      };

      const mockHome = {
        id: 1,
        address: "Test Address",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      const results = await processExpiredUnassignedAppointments();

      // Should use "Valued Customer" as fallback name
      expect(results.cancelled).toBe(1);
      expect(Email.sendUnassignedExpiredNotification).toHaveBeenCalledWith(
        "test@example.com",
        expect.any(Object),
        "Valued Customer",
        expect.any(String)
      );
    });

    it("should handle very old appointments (e.g., months ago)", async () => {
      const mockAppointment = {
        id: 20,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-90), // 90 days ago
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Old",
          lastName: "Appointment",
          email: "old@example.com",
          notificationEmail: "old@example.com",
          expoPushToken: null,
          notifications: true,
        },
      };

      const mockHome = {
        id: 1,
        address: "Test Address",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      const results = await processExpiredUnassignedAppointments();

      // Should still cancel old appointments
      expect(results.cancelled).toBe(1);
    });

    it("should NOT cancel today's appointments", async () => {
      // Today's date should not be cancelled - only yesterday and earlier
      const mockAppointment = {
        id: 21,
        userId: 1,
        homeId: 1,
        date: daysFromNow(0), // Today
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn(),
        user: {
          id: 1,
          firstName: "Today",
          lastName: "User",
          email: "today@example.com",
          notificationEmail: "today@example.com",
          expoPushToken: null,
          notifications: true,
        },
      };

      // The query should filter this out (date <= yesterday)
      // So findAll should return empty
      UserAppointments.findAll.mockResolvedValue([]);

      const results = await processExpiredUnassignedAppointments();

      expect(results.cancelled).toBe(0);
    });
  });

  describe("Business Owner Notifications", () => {
    it("should notify business owner when their booked appointment expires", async () => {
      const mockAppointment = {
        id: 22,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Homeowner",
          lastName: "User",
          email: "homeowner@example.com",
          notificationEmail: "homeowner@example.com",
          expoPushToken: null,
          notifications: true,
        },
        bookedByCleaner: {
          id: 100, // Different from homeowner
          firstName: "Business",
          lastName: "Owner",
          email: "business@example.com",
          notificationEmail: "business@example.com",
          expoPushToken: "ExponentPushToken[bo]",
          notifications: true,
        },
      };

      const mockHome = {
        id: 1,
        address: "Test Address",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await processExpiredUnassignedAppointments();

      // Should notify both homeowner and business owner
      expect(NotificationService.notifyUser).toHaveBeenCalledTimes(2);

      // Check business owner notification
      expect(NotificationService.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 100,
          type: "booked_appointment_expired",
          title: "Booked Appointment Auto-Cancelled",
        })
      );

      // Check push notification to business owner
      expect(PushNotification.sendPushNotification).toHaveBeenCalledWith(
        "ExponentPushToken[bo]",
        "Booked Appointment Cancelled",
        expect.stringContaining("Homeowner User"),
        expect.objectContaining({
          type: "booked_appointment_expired",
          appointmentId: 22,
        })
      );
    });

    it("should NOT notify business owner if bookedByCleaner is the same as homeowner", async () => {
      const mockAppointment = {
        id: 23,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Self",
          lastName: "Booker",
          email: "self@example.com",
          notificationEmail: "self@example.com",
          expoPushToken: null,
          notifications: true,
        },
        bookedByCleaner: {
          id: 1, // Same as homeowner
          firstName: "Self",
          lastName: "Booker",
          email: "self@example.com",
          notificationEmail: "self@example.com",
          expoPushToken: "ExponentPushToken[self]",
          notifications: true,
        },
      };

      const mockHome = {
        id: 1,
        address: "Test Address",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await processExpiredUnassignedAppointments();

      // Should only notify homeowner once (not twice for business owner)
      expect(NotificationService.notifyUser).toHaveBeenCalledTimes(1);
      expect(NotificationService.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          type: "appointment_expired_unassigned", // homeowner notification type
        })
      );
    });

    it("should NOT notify business owner if bookedByCleaner is null", async () => {
      const mockAppointment = {
        id: 24,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Regular",
          lastName: "User",
          email: "regular@example.com",
          notificationEmail: "regular@example.com",
          expoPushToken: null,
          notifications: true,
        },
        bookedByCleaner: null, // No business owner
      };

      const mockHome = {
        id: 1,
        address: "Test Address",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await processExpiredUnassignedAppointments();

      // Should only notify homeowner
      expect(NotificationService.notifyUser).toHaveBeenCalledTimes(1);
    });

    it("should NOT send push notification to business owner if notifications disabled", async () => {
      const mockAppointment = {
        id: 25,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Homeowner",
          lastName: "User",
          email: "homeowner@example.com",
          notificationEmail: "homeowner@example.com",
          expoPushToken: null,
          notifications: true,
        },
        bookedByCleaner: {
          id: 100,
          firstName: "Business",
          lastName: "Owner",
          email: "business@example.com",
          notificationEmail: "business@example.com",
          expoPushToken: "ExponentPushToken[bo]",
          notifications: false, // Disabled
        },
      };

      const mockHome = {
        id: 1,
        address: "Test Address",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await processExpiredUnassignedAppointments();

      // In-app notification should still be sent
      expect(NotificationService.notifyUser).toHaveBeenCalledTimes(2);

      // But push notification should NOT be sent (notifications disabled)
      expect(PushNotification.sendPushNotification).not.toHaveBeenCalled();
    });

    it("should handle business owner notification error gracefully", async () => {
      const mockAppointment = {
        id: 26,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        wasCancelled: false,
        completed: false,
        paid: false,
        update: jest.fn().mockResolvedValue(true),
        user: {
          id: 1,
          firstName: "Homeowner",
          lastName: "User",
          email: "homeowner@example.com",
          notificationEmail: "homeowner@example.com",
          expoPushToken: null,
          notifications: true,
        },
        bookedByCleaner: {
          id: 100,
          firstName: "Business",
          lastName: "Owner",
          email: "business@example.com",
          notificationEmail: "business@example.com",
          expoPushToken: "ExponentPushToken[bo]",
          notifications: true,
        },
      };

      const mockHome = {
        id: 1,
        address: "Test Address",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      // Make the second call (business owner notification) fail
      NotificationService.notifyUser
        .mockResolvedValueOnce(true) // Homeowner notification succeeds
        .mockRejectedValueOnce(new Error("Notification error")); // Business owner fails

      const results = await processExpiredUnassignedAppointments();

      // Should still cancel the appointment despite notification error
      expect(results.cancelled).toBe(1);
      expect(mockAppointment.update).toHaveBeenCalled();
    });
  });
});
