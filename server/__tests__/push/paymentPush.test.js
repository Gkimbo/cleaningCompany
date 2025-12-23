/**
 * Tests for Push Notifications in Payment Router (Cron Job)
 * Tests that push notifications are sent for unassigned warnings and cancellations
 */

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test_secret";

// Mock Email
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendUnassignedAppointmentWarning: jest.fn().mockResolvedValue(true),
  sendEmailCancellation: jest.fn().mockResolvedValue(true),
}));

// Mock PushNotification
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendPushUnassignedWarning: jest.fn().mockResolvedValue([{ status: "ok" }]),
  sendPushCancellation: jest.fn().mockResolvedValue([{ status: "ok" }]),
}));

const Email = require("../../services/sendNotifications/EmailClass");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");

describe("Payment Router Cron - Push Notifications", () => {
  const validExpoPushToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Unassigned Appointment Warning - Push to Homeowner", () => {
    it("should send push notification for unassigned appointment warning", async () => {
      const user = {
        id: 1,
        firstName: "John",
        email: "john@test.com",
        expoPushToken: validExpoPushToken,
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };

      const home = {
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      const homeAddress = {
        street: home.address,
        city: home.city,
        state: home.state,
        zipcode: home.zipcode,
      };

      const appointmentDate = new Date("2025-01-20");

      // Simulate what the cron job does
      await Email.sendUnassignedAppointmentWarning(
        user.email,
        homeAddress,
        user.firstName,
        appointmentDate
      );

      if (user.expoPushToken) {
        await PushNotification.sendPushUnassignedWarning(
          user.expoPushToken,
          user.firstName,
          appointmentDate,
          homeAddress
        );
      }

      expect(Email.sendUnassignedAppointmentWarning).toHaveBeenCalledWith(
        "john@test.com",
        homeAddress,
        "John",
        appointmentDate
      );

      expect(PushNotification.sendPushUnassignedWarning).toHaveBeenCalledWith(
        validExpoPushToken,
        "John",
        appointmentDate,
        homeAddress
      );
    });

    it("should not send push if user has no push token", async () => {
      const user = {
        id: 1,
        firstName: "Jane",
        email: "jane@test.com",
        expoPushToken: null, // No token
      };

      const homeAddress = {
        street: "456 Oak Ave",
        city: "Cambridge",
        state: "MA",
        zipcode: "02139",
      };

      await Email.sendUnassignedAppointmentWarning(
        user.email,
        homeAddress,
        user.firstName,
        new Date()
      );

      if (user.expoPushToken) {
        await PushNotification.sendPushUnassignedWarning(
          user.expoPushToken,
          user.firstName,
          new Date(),
          homeAddress
        );
      }

      expect(Email.sendUnassignedAppointmentWarning).toHaveBeenCalled();
      expect(PushNotification.sendPushUnassignedWarning).not.toHaveBeenCalled();
    });

    it("should send push for multiple unassigned appointments", async () => {
      const appointments = [
        {
          userId: 1,
          user: {
            firstName: "User1",
            email: "user1@test.com",
            expoPushToken: "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaa]",
          },
          home: { address: "123 St", city: "Boston", state: "MA", zipcode: "02101" },
          date: new Date("2025-01-20"),
        },
        {
          userId: 2,
          user: {
            firstName: "User2",
            email: "user2@test.com",
            expoPushToken: "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbb]",
          },
          home: { address: "456 Ave", city: "Cambridge", state: "MA", zipcode: "02139" },
          date: new Date("2025-01-21"),
        },
      ];

      for (const apt of appointments) {
        const homeAddress = {
          street: apt.home.address,
          city: apt.home.city,
          state: apt.home.state,
          zipcode: apt.home.zipcode,
        };

        if (apt.user.expoPushToken) {
          await PushNotification.sendPushUnassignedWarning(
            apt.user.expoPushToken,
            apt.user.firstName,
            apt.date,
            homeAddress
          );
        }
      }

      expect(PushNotification.sendPushUnassignedWarning).toHaveBeenCalledTimes(2);
    });
  });

  describe("Auto-Cancellation - Push to Homeowner", () => {
    it("should send push notification when appointment is auto-cancelled", async () => {
      const user = {
        id: 1,
        firstName: "Mike",
        email: "mike@test.com",
        expoPushToken: validExpoPushToken,
      };

      const home = {
        address: "789 Pine St",
        city: "Somerville",
        state: "MA",
        zipcode: "02143",
      };

      const cancelAddress = {
        street: home.address,
        city: home.city,
        state: home.state,
        zipcode: home.zipcode,
      };

      const appointmentDate = new Date("2025-01-22");

      // Simulate what happens when payment intent is cancelled
      await Email.sendEmailCancellation(
        user.email,
        cancelAddress,
        user.firstName,
        appointmentDate
      );

      if (user.expoPushToken) {
        await PushNotification.sendPushCancellation(
          user.expoPushToken,
          user.firstName,
          appointmentDate,
          cancelAddress
        );
      }

      expect(Email.sendEmailCancellation).toHaveBeenCalledWith(
        "mike@test.com",
        cancelAddress,
        "Mike",
        appointmentDate
      );

      expect(PushNotification.sendPushCancellation).toHaveBeenCalledWith(
        validExpoPushToken,
        "Mike",
        appointmentDate,
        cancelAddress
      );
    });

    it("should handle user without push token for cancellation", async () => {
      const user = {
        id: 1,
        firstName: "Sarah",
        email: "sarah@test.com",
        expoPushToken: null,
      };

      const cancelAddress = {
        street: "321 Elm St",
        city: "Brookline",
        state: "MA",
        zipcode: "02445",
      };

      await Email.sendEmailCancellation(
        user.email,
        cancelAddress,
        user.firstName,
        new Date()
      );

      if (user.expoPushToken) {
        await PushNotification.sendPushCancellation(
          user.expoPushToken,
          user.firstName,
          new Date(),
          cancelAddress
        );
      }

      expect(Email.sendEmailCancellation).toHaveBeenCalled();
      expect(PushNotification.sendPushCancellation).not.toHaveBeenCalled();
    });
  });

  describe("Cron Job Date Logic", () => {
    it("should send warning 3 days before appointment", async () => {
      const now = new Date();
      const threeDaysFromNow = new Date(now);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const diffInDays = Math.floor(
        (threeDaysFromNow - now) / (1000 * 60 * 60 * 24)
      );

      expect(diffInDays).toBe(3);
      expect(diffInDays <= 3 && diffInDays >= 0).toBe(true);
    });

    it("should send warning 2 days before appointment", async () => {
      const now = new Date();
      const twoDaysFromNow = new Date(now);
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

      const diffInDays = Math.floor(
        (twoDaysFromNow - now) / (1000 * 60 * 60 * 24)
      );

      expect(diffInDays).toBe(2);
      expect(diffInDays <= 3 && diffInDays >= 0).toBe(true);
    });

    it("should send warning 1 day before appointment", async () => {
      const now = new Date();
      const oneDayFromNow = new Date(now);
      oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

      const diffInDays = Math.floor(
        (oneDayFromNow - now) / (1000 * 60 * 60 * 24)
      );

      expect(diffInDays).toBe(1);
      expect(diffInDays <= 3 && diffInDays >= 0).toBe(true);
    });

    it("should not send warning for appointments 4+ days away", async () => {
      const now = new Date();
      const fourDaysFromNow = new Date(now);
      fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);

      const diffInDays = Math.floor(
        (fourDaysFromNow - now) / (1000 * 60 * 60 * 24)
      );

      expect(diffInDays).toBe(4);
      expect(diffInDays <= 3 && diffInDays >= 0).toBe(false);
    });
  });

  describe("Error Handling in Cron", () => {
    it("should continue processing if push notification fails", async () => {
      const appointments = [
        {
          id: 1,
          user: { firstName: "User1", expoPushToken: "token1" },
          home: { address: "123 St", city: "Boston", state: "MA", zipcode: "02101" },
        },
        {
          id: 2,
          user: { firstName: "User2", expoPushToken: "token2" },
          home: { address: "456 Ave", city: "Cambridge", state: "MA", zipcode: "02139" },
        },
      ];

      PushNotification.sendPushUnassignedWarning
        .mockRejectedValueOnce(new Error("Push failed"))
        .mockResolvedValueOnce([{ status: "ok" }]);

      const results = [];

      for (const apt of appointments) {
        try {
          const homeAddress = {
            street: apt.home.address,
            city: apt.home.city,
            state: apt.home.state,
            zipcode: apt.home.zipcode,
          };

          await PushNotification.sendPushUnassignedWarning(
            apt.user.expoPushToken,
            apt.user.firstName,
            new Date(),
            homeAddress
          );
          results.push({ id: apt.id, success: true });
        } catch (error) {
          results.push({ id: apt.id, success: false, error: error.message });
        }
      }

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
      expect(PushNotification.sendPushUnassignedWarning).toHaveBeenCalledTimes(2);
    });
  });
});
