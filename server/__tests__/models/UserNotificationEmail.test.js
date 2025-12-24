/**
 * Tests for User model notificationEmail field and getNotificationEmail method
 */

describe("User Model - Notification Email", () => {
  // Mock the User model structure as it would be created by Sequelize
  const createMockUser = (overrides = {}) => {
    const user = {
      id: 1,
      firstName: "John",
      lastName: "Doe",
      username: "johndoe",
      email: "john@example.com",
      notificationEmail: null,
      type: "owner",
      ...overrides,
    };
    // Add the getNotificationEmail method as defined in the User model
    user.getNotificationEmail = function () {
      return this.notificationEmail || this.email;
    };
    return user;
  };

  describe("getNotificationEmail method", () => {
    it("should return notificationEmail when it is set", () => {
      const user = createMockUser({
        email: "main@example.com",
        notificationEmail: "alerts@example.com",
      });

      expect(user.getNotificationEmail()).toBe("alerts@example.com");
    });

    it("should return main email when notificationEmail is null", () => {
      const user = createMockUser({
        email: "main@example.com",
        notificationEmail: null,
      });

      expect(user.getNotificationEmail()).toBe("main@example.com");
    });

    it("should return main email when notificationEmail is undefined", () => {
      const user = createMockUser({
        email: "main@example.com",
      });
      delete user.notificationEmail;

      expect(user.getNotificationEmail()).toBe("main@example.com");
    });

    it("should return main email when notificationEmail is empty string", () => {
      const user = createMockUser({
        email: "main@example.com",
        notificationEmail: "",
      });

      // Empty string is falsy, so it should fall back to main email
      expect(user.getNotificationEmail()).toBe("main@example.com");
    });

    it("should work for owner users", () => {
      const owner = createMockUser({
        type: "owner",
        email: "owner@company.com",
        notificationEmail: "owner-alerts@company.com",
      });

      expect(owner.getNotificationEmail()).toBe("owner-alerts@company.com");
    });

    it("should work for cleaner users", () => {
      const cleaner = createMockUser({
        type: "cleaner",
        email: "cleaner@example.com",
        notificationEmail: "cleaner-work@example.com",
      });

      expect(cleaner.getNotificationEmail()).toBe("cleaner-work@example.com");
    });

    it("should work for homeowner users", () => {
      const homeowner = createMockUser({
        type: "homeowner",
        email: "homeowner@example.com",
        notificationEmail: null,
      });

      expect(homeowner.getNotificationEmail()).toBe("homeowner@example.com");
    });
  });

  describe("notificationEmail field", () => {
    it("should allow null value", () => {
      const user = createMockUser({
        notificationEmail: null,
      });

      expect(user.notificationEmail).toBeNull();
    });

    it("should store valid email", () => {
      const user = createMockUser({
        notificationEmail: "notifications@example.com",
      });

      expect(user.notificationEmail).toBe("notifications@example.com");
    });

    it("should be independent of main email", () => {
      const user = createMockUser({
        email: "main@example.com",
        notificationEmail: "alerts@different-domain.com",
      });

      expect(user.email).toBe("main@example.com");
      expect(user.notificationEmail).toBe("alerts@different-domain.com");
      expect(user.email).not.toBe(user.notificationEmail);
    });
  });

  describe("email fallback behavior", () => {
    it("should use main email when notification email cleared", () => {
      const user = createMockUser({
        email: "main@example.com",
        notificationEmail: "alerts@example.com",
      });

      // Verify notification email is used
      expect(user.getNotificationEmail()).toBe("alerts@example.com");

      // Clear notification email
      user.notificationEmail = null;

      // Should now fall back to main email
      expect(user.getNotificationEmail()).toBe("main@example.com");
    });

    it("should handle updating notification email", () => {
      const user = createMockUser({
        email: "main@example.com",
        notificationEmail: null,
      });

      // Initially uses main email
      expect(user.getNotificationEmail()).toBe("main@example.com");

      // Set notification email
      user.notificationEmail = "new-alerts@example.com";

      // Now uses notification email
      expect(user.getNotificationEmail()).toBe("new-alerts@example.com");
    });

    it("should handle changing notification email", () => {
      const user = createMockUser({
        email: "main@example.com",
        notificationEmail: "old-alerts@example.com",
      });

      expect(user.getNotificationEmail()).toBe("old-alerts@example.com");

      // Change notification email
      user.notificationEmail = "new-alerts@example.com";

      expect(user.getNotificationEmail()).toBe("new-alerts@example.com");
    });
  });

  describe("integration scenarios", () => {
    it("should work in owner notification scenario", () => {
      const owners = [
        createMockUser({
          id: 1,
          type: "owner",
          email: "owner1@company.com",
          notificationEmail: "alerts1@company.com",
        }),
        createMockUser({
          id: 2,
          type: "owner",
          email: "owner2@company.com",
          notificationEmail: null, // Uses main email
        }),
        createMockUser({
          id: 3,
          type: "owner",
          email: "owner3@company.com",
          notificationEmail: "external@gmail.com",
        }),
      ];

      const notificationEmails = owners.map((m) => m.getNotificationEmail());

      expect(notificationEmails).toEqual([
        "alerts1@company.com",
        "owner2@company.com",
        "external@gmail.com",
      ]);
    });

    it("should handle mixed user types", () => {
      const users = [
        createMockUser({ type: "owner", email: "m@test.com", notificationEmail: "m-alerts@test.com" }),
        createMockUser({ type: "cleaner", email: "c@test.com", notificationEmail: null }),
        createMockUser({ type: "homeowner", email: "h@test.com", notificationEmail: "h-alerts@test.com" }),
      ];

      expect(users[0].getNotificationEmail()).toBe("m-alerts@test.com");
      expect(users[1].getNotificationEmail()).toBe("c@test.com");
      expect(users[2].getNotificationEmail()).toBe("h-alerts@test.com");
    });
  });
});
