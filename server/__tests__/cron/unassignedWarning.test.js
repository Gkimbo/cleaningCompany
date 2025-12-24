/**
 * Tests for the unassigned appointment warning cron job logic
 * This tests the logic that runs as part of the daily 7 AM cron job
 * to warn homeowners about unassigned appointments 3 days before
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
  sendUnassignedAppointmentWarning: jest.fn().mockResolvedValue("250 OK"),
}));

const { User, UserAppointments, UserHomes } = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");

describe("Unassigned Appointment Warning Logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create a date X days from now
  const daysFromNow = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  };

  // The logic extracted from the cron job for testing
  const processUnassignedWarnings = async () => {
    const now = new Date();
    const results = { sent: 0, skipped: 0, errors: 0 };

    const unassignedAppointments = await UserAppointments.findAll({
      where: {
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
      },
    });

    for (const appointment of unassignedAppointments) {
      const appointmentDate = new Date(appointment.date);
      const diffInDays = Math.floor(
        (appointmentDate - now) / (1000 * 60 * 60 * 24)
      );

      if (diffInDays <= 3 && diffInDays >= 0) {
        try {
          const user = await User.findByPk(appointment.userId);
          const home = await UserHomes.findByPk(appointment.homeId);
          if (!user || !home) {
            results.skipped++;
            continue;
          }

          await Email.sendUnassignedAppointmentWarning(
            user.email,
            {
              street: home.address,
              city: home.city,
              state: home.state,
              zipcode: home.zipcode,
            },
            user.firstName,
            appointmentDate
          );

          const notifications = user.notifications || [];
          const formattedDate = appointmentDate.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          notifications.unshift(
            `Heads up! Your cleaning on ${formattedDate} at ${home.address} doesn't have a cleaner assigned yet. There's still time for one to pick it up, but you may want to have a backup plan.`
          );
          await user.update({ notifications: notifications.slice(0, 50) });

          await appointment.update({ unassignedWarningSent: true });

          results.sent++;
        } catch (err) {
          results.errors++;
        }
      } else {
        results.skipped++;
      }
    }

    return results;
  };

  describe("Query Criteria", () => {
    it("should query for unassigned, not-warned, incomplete appointments", async () => {
      UserAppointments.findAll.mockResolvedValue([]);

      await processUnassignedWarnings();

      expect(UserAppointments.findAll).toHaveBeenCalledWith({
        where: {
          hasBeenAssigned: false,
          unassignedWarningSent: false,
          completed: false,
        },
      });
    });

    it("should not query for assigned appointments", async () => {
      UserAppointments.findAll.mockResolvedValue([]);

      await processUnassignedWarnings();

      const queryArgs = UserAppointments.findAll.mock.calls[0][0];
      expect(queryArgs.where.hasBeenAssigned).toBe(false);
    });

    it("should not query for already-warned appointments", async () => {
      UserAppointments.findAll.mockResolvedValue([]);

      await processUnassignedWarnings();

      const queryArgs = UserAppointments.findAll.mock.calls[0][0];
      expect(queryArgs.where.unassignedWarningSent).toBe(false);
    });
  });

  describe("Date Filtering", () => {
    it("should send warning for appointment 3 days from now", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(3),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = {
        id: 1,
        email: "user@example.com",
        firstName: "John",
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };

      const mockHome = {
        id: 1,
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      const results = await processUnassignedWarnings();

      expect(results.sent).toBe(1);
      expect(Email.sendUnassignedAppointmentWarning).toHaveBeenCalled();
    });

    it("should send warning for appointment 2 days from now", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = {
        id: 1,
        email: "user@example.com",
        firstName: "John",
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };

      const mockHome = {
        id: 1,
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      const results = await processUnassignedWarnings();

      expect(results.sent).toBe(1);
    });

    it("should send warning for appointment 1 day from now", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(1),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = {
        id: 1,
        email: "user@example.com",
        firstName: "John",
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };

      const mockHome = {
        id: 1,
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      const results = await processUnassignedWarnings();

      expect(results.sent).toBe(1);
    });

    it("should NOT send warning for appointment more than 3 days away", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(5),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const results = await processUnassignedWarnings();

      expect(results.skipped).toBe(1);
      expect(Email.sendUnassignedAppointmentWarning).not.toHaveBeenCalled();
    });

    it("should NOT send warning for past appointments", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const results = await processUnassignedWarnings();

      expect(results.skipped).toBe(1);
      expect(Email.sendUnassignedAppointmentWarning).not.toHaveBeenCalled();
    });
  });

  describe("Email Notification", () => {
    it("should send email with correct parameters", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(3),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = {
        id: 1,
        email: "homeowner@example.com",
        firstName: "Jane",
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };

      const mockHome = {
        id: 1,
        address: "456 Oak Ave",
        city: "Cambridge",
        state: "MA",
        zipcode: "02139",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await processUnassignedWarnings();

      expect(Email.sendUnassignedAppointmentWarning).toHaveBeenCalledWith(
        "homeowner@example.com",
        {
          street: "456 Oak Ave",
          city: "Cambridge",
          state: "MA",
          zipcode: "02139",
        },
        "Jane",
        expect.any(Date)
      );
    });
  });

  describe("In-App Notification", () => {
    it("should add notification to user notifications array", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(3),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = {
        id: 1,
        email: "user@example.com",
        firstName: "John",
        notifications: ["Old notification"],
        update: jest.fn().mockResolvedValue(true),
      };

      const mockHome = {
        id: 1,
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await processUnassignedWarnings();

      expect(mockUser.update).toHaveBeenCalled();
      const updateCall = mockUser.update.mock.calls[0][0];
      expect(updateCall.notifications).toBeDefined();
      expect(updateCall.notifications[0]).toContain("Heads up!");
      expect(updateCall.notifications[0]).toContain("123 Main St");
      expect(updateCall.notifications[0]).toContain("backup plan");
    });

    it("should prepend new notification (unshift behavior)", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(3),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = {
        id: 1,
        email: "user@example.com",
        firstName: "John",
        notifications: ["Existing notification 1", "Existing notification 2"],
        update: jest.fn().mockResolvedValue(true),
      };

      const mockHome = {
        id: 1,
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await processUnassignedWarnings();

      const updateCall = mockUser.update.mock.calls[0][0];
      expect(updateCall.notifications.length).toBe(3);
      expect(updateCall.notifications[0]).toContain("Heads up!");
      expect(updateCall.notifications[1]).toBe("Existing notification 1");
    });

    it("should limit notifications to 50", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(3),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      // Create 50 existing notifications
      const existingNotifications = Array(50).fill("Existing notification");

      const mockUser = {
        id: 1,
        email: "user@example.com",
        firstName: "John",
        notifications: existingNotifications,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockHome = {
        id: 1,
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await processUnassignedWarnings();

      const updateCall = mockUser.update.mock.calls[0][0];
      expect(updateCall.notifications.length).toBe(50);
      expect(updateCall.notifications[0]).toContain("Heads up!");
    });

    it("should handle null notifications array", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(3),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = {
        id: 1,
        email: "user@example.com",
        firstName: "John",
        notifications: null,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockHome = {
        id: 1,
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await processUnassignedWarnings();

      const updateCall = mockUser.update.mock.calls[0][0];
      expect(updateCall.notifications.length).toBe(1);
      expect(updateCall.notifications[0]).toContain("Heads up!");
    });
  });

  describe("Warning Flag Update", () => {
    it("should mark appointment as warned after sending notification", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(3),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = {
        id: 1,
        email: "user@example.com",
        firstName: "John",
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };

      const mockHome = {
        id: 1,
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      await processUnassignedWarnings();

      expect(mockAppointment.update).toHaveBeenCalledWith({
        unassignedWarningSent: true,
      });
    });

    it("should prevent duplicate warnings by setting flag", async () => {
      // This test verifies the query filters out already-warned appointments
      UserAppointments.findAll.mockResolvedValue([]);

      await processUnassignedWarnings();

      const queryArgs = UserAppointments.findAll.mock.calls[0][0];
      expect(queryArgs.where.unassignedWarningSent).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should skip appointment if user not found", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(3),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(null);
      UserHomes.findByPk.mockResolvedValue({ id: 1 });

      const results = await processUnassignedWarnings();

      expect(results.skipped).toBe(1);
      expect(Email.sendUnassignedAppointmentWarning).not.toHaveBeenCalled();
    });

    it("should skip appointment if home not found", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(3),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({ id: 1 });
      UserHomes.findByPk.mockResolvedValue(null);

      const results = await processUnassignedWarnings();

      expect(results.skipped).toBe(1);
      expect(Email.sendUnassignedAppointmentWarning).not.toHaveBeenCalled();
    });

    it("should handle email sending errors gracefully", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(3),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = {
        id: 1,
        email: "user@example.com",
        firstName: "John",
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };

      const mockHome = {
        id: 1,
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      Email.sendUnassignedAppointmentWarning.mockRejectedValueOnce(
        new Error("SMTP error")
      );

      const results = await processUnassignedWarnings();

      expect(results.errors).toBe(1);
      // Should not mark as sent if email failed
      expect(mockAppointment.update).not.toHaveBeenCalled();
    });

    it("should continue processing other appointments after one fails", async () => {
      const mockAppointment1 = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(3),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockAppointment2 = {
        id: 2,
        userId: 2,
        homeId: 2,
        date: daysFromNow(2),
        hasBeenAssigned: false,
        unassignedWarningSent: false,
        completed: false,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser1 = {
        id: 1,
        email: "user1@example.com",
        firstName: "John",
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser2 = {
        id: 2,
        email: "user2@example.com",
        firstName: "Jane",
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      };

      const mockHome1 = {
        id: 1,
        address: "123 Main St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      };

      const mockHome2 = {
        id: 2,
        address: "456 Oak Ave",
        city: "Cambridge",
        state: "MA",
        zipcode: "02139",
      };

      UserAppointments.findAll.mockResolvedValue([
        mockAppointment1,
        mockAppointment2,
      ]);
      User.findByPk
        .mockResolvedValueOnce(mockUser1)
        .mockResolvedValueOnce(mockUser2);
      UserHomes.findByPk
        .mockResolvedValueOnce(mockHome1)
        .mockResolvedValueOnce(mockHome2);

      // First email fails, second succeeds
      Email.sendUnassignedAppointmentWarning
        .mockRejectedValueOnce(new Error("SMTP error"))
        .mockResolvedValueOnce("250 OK");

      const results = await processUnassignedWarnings();

      expect(results.errors).toBe(1);
      expect(results.sent).toBe(1);
      expect(mockAppointment2.update).toHaveBeenCalledWith({
        unassignedWarningSent: true,
      });
    });
  });

  describe("Multiple Appointments", () => {
    it("should process multiple unassigned appointments", async () => {
      const mockAppointments = [
        {
          id: 1,
          userId: 1,
          homeId: 1,
          date: daysFromNow(3),
          hasBeenAssigned: false,
          unassignedWarningSent: false,
          completed: false,
          update: jest.fn().mockResolvedValue(true),
        },
        {
          id: 2,
          userId: 2,
          homeId: 2,
          date: daysFromNow(2),
          hasBeenAssigned: false,
          unassignedWarningSent: false,
          completed: false,
          update: jest.fn().mockResolvedValue(true),
        },
        {
          id: 3,
          userId: 3,
          homeId: 3,
          date: daysFromNow(1),
          hasBeenAssigned: false,
          unassignedWarningSent: false,
          completed: false,
          update: jest.fn().mockResolvedValue(true),
        },
      ];

      User.findByPk.mockImplementation((id) => ({
        id,
        email: `user${id}@example.com`,
        firstName: `User${id}`,
        notifications: [],
        update: jest.fn().mockResolvedValue(true),
      }));

      UserHomes.findByPk.mockImplementation((id) => ({
        id,
        address: `${id}00 Main St`,
        city: "Boston",
        state: "MA",
        zipcode: "02101",
      }));

      UserAppointments.findAll.mockResolvedValue(mockAppointments);

      const results = await processUnassignedWarnings();

      expect(results.sent).toBe(3);
      expect(Email.sendUnassignedAppointmentWarning).toHaveBeenCalledTimes(3);
    });
  });
});
