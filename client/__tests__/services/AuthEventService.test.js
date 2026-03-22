// Reset module state between tests
let AuthEventService;

describe("AuthEventService", () => {
  beforeEach(() => {
    // Reset the module to get a fresh instance
    jest.resetModules();
    AuthEventService = require("../../src/services/AuthEventService").default;
  });

  describe("setLogoutCallback", () => {
    it("should store the logout callback", () => {
      const mockLogout = jest.fn();

      AuthEventService.setLogoutCallback(mockLogout);

      // Verify callback is stored by triggering it
      AuthEventService.handleTokenExpired();
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    it("should replace existing callback with new one", () => {
      const mockLogout1 = jest.fn();
      const mockLogout2 = jest.fn();

      AuthEventService.setLogoutCallback(mockLogout1);
      AuthEventService.setLogoutCallback(mockLogout2);

      AuthEventService.handleTokenExpired();

      expect(mockLogout1).not.toHaveBeenCalled();
      expect(mockLogout2).toHaveBeenCalledTimes(1);
    });

    it("should reset isLoggingOut flag when new callback is set", () => {
      const mockLogout1 = jest.fn();
      const mockLogout2 = jest.fn();

      AuthEventService.setLogoutCallback(mockLogout1);
      AuthEventService.handleTokenExpired(); // Sets isLoggingOut = true

      // Simulates user logging back in - should reset the flag
      AuthEventService.setLogoutCallback(mockLogout2);
      AuthEventService.handleTokenExpired();

      expect(mockLogout2).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleTokenExpired", () => {
    it("should call the logout callback when set", () => {
      const mockLogout = jest.fn();
      AuthEventService.setLogoutCallback(mockLogout);

      AuthEventService.handleTokenExpired();

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    it("should not throw when no callback is set", () => {
      // No callback set, should not throw
      expect(() => {
        AuthEventService.handleTokenExpired();
      }).not.toThrow();
    });

    it("should log when token expires", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const mockLogout = jest.fn();
      AuthEventService.setLogoutCallback(mockLogout);

      AuthEventService.handleTokenExpired();

      expect(consoleSpy).toHaveBeenCalledWith("Token expired - logging out user");
      consoleSpy.mockRestore();
    });

    it("should not log when no callback is set", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      AuthEventService.handleTokenExpired();

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should only trigger logout once for multiple concurrent 401s", () => {
      const mockLogout = jest.fn();
      AuthEventService.setLogoutCallback(mockLogout);

      // Simulate multiple concurrent 401 responses
      AuthEventService.handleTokenExpired();
      AuthEventService.handleTokenExpired();
      AuthEventService.handleTokenExpired();

      // Should only call logout once
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    it("should not call logout if already logging out", () => {
      const mockLogout = jest.fn();
      AuthEventService.setLogoutCallback(mockLogout);

      AuthEventService.handleTokenExpired();

      // Second call should be ignored
      const secondResult = AuthEventService.handleTokenExpired();

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe("clearLogoutCallback", () => {
    it("should remove the stored callback", () => {
      const mockLogout = jest.fn();
      AuthEventService.setLogoutCallback(mockLogout);

      AuthEventService.clearLogoutCallback();
      AuthEventService.handleTokenExpired();

      expect(mockLogout).not.toHaveBeenCalled();
    });

    it("should not throw when clearing non-existent callback", () => {
      expect(() => {
        AuthEventService.clearLogoutCallback();
      }).not.toThrow();
    });

    it("should reset isLoggingOut flag", () => {
      const mockLogout = jest.fn();
      AuthEventService.setLogoutCallback(mockLogout);
      AuthEventService.handleTokenExpired(); // Sets isLoggingOut = true

      AuthEventService.clearLogoutCallback();

      // Set new callback and try again
      AuthEventService.setLogoutCallback(mockLogout);
      AuthEventService.handleTokenExpired();

      expect(mockLogout).toHaveBeenCalledTimes(2);
    });
  });

  describe("singleton behavior", () => {
    it("should maintain state across imports", () => {
      const mockLogout = jest.fn();
      AuthEventService.setLogoutCallback(mockLogout);

      // Re-require to simulate another import
      const AuthEventService2 = require("../../src/services/AuthEventService").default;
      AuthEventService2.handleTokenExpired();

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });
});
