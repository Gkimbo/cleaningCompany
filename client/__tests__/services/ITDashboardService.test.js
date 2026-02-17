/**
 * Tests for ITDashboardService
 * Tests all API methods for IT dashboard operations and support tools.
 */

import ITDashboardService from "../../src/services/fetchRequests/ITDashboardService";

// Mock fetch globally
global.fetch = jest.fn();

// Mock config
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

describe("ITDashboardService", () => {
  const mockToken = "test-token";

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe("fetchWithFallback", () => {
    it("should return data on successful fetch", async () => {
      const mockData = { openDisputes: 5 };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await ITDashboardService.getQuickStats(mockToken);

      expect(result).toEqual(mockData);
    });

    it("should return fallback on non-ok response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const result = await ITDashboardService.getQuickStats(mockToken);

      expect(result).toEqual({
        openDisputes: 0,
        criticalHighPriority: 0,
        resolvedThisWeek: 0,
        slaBreaches: 0,
        disputesByGroup: {},
        myAssigned: 0,
      });
      consoleSpy.mockRestore();
    });

    it("should return fallback on network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const result = await ITDashboardService.getQuickStats(mockToken);

      expect(result).toEqual({
        openDisputes: 0,
        criticalHighPriority: 0,
        resolvedThisWeek: 0,
        slaBreaches: 0,
        disputesByGroup: {},
        myAssigned: 0,
      });
      consoleSpy.mockRestore();
    });
  });

  describe("getQuickStats", () => {
    it("should call correct endpoint with auth header", async () => {
      const mockStats = {
        openDisputes: 5,
        criticalHighPriority: 2,
        resolvedThisWeek: 10,
        slaBreaches: 1,
      };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      });

      const result = await ITDashboardService.getQuickStats(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/it-dashboard/quick-stats",
        { headers: { Authorization: "Bearer test-token" } }
      );
      expect(result).toEqual(mockStats);
    });
  });

  describe("getDisputes", () => {
    it("should call correct endpoint with filters", async () => {
      const mockDisputes = { disputes: [], total: 0 };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDisputes,
      });

      const filters = { status: "submitted", priority: "high" };
      const result = await ITDashboardService.getDisputes(mockToken, filters);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("status=submitted"),
        { headers: { Authorization: "Bearer test-token" } }
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("priority=high"),
        { headers: { Authorization: "Bearer test-token" } }
      );
    });

    it("should return fallback for disputes", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const result = await ITDashboardService.getDisputes(mockToken);

      expect(result).toEqual({ disputes: [], total: 0 });
      consoleSpy.mockRestore();
    });
  });

  describe("getDispute", () => {
    it("should fetch single dispute by id", async () => {
      const mockDispute = { dispute: { id: 1, category: "app_crash" } };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDispute,
      });

      const result = await ITDashboardService.getDispute(mockToken, 1);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/it-dashboard/disputes/1",
        { headers: { Authorization: "Bearer test-token" } }
      );
      expect(result).toEqual(mockDispute);
    });
  });

  describe("getMyAssigned", () => {
    it("should fetch assigned disputes", async () => {
      const mockDisputes = { disputes: [{ id: 1 }] };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDisputes,
      });

      const result = await ITDashboardService.getMyAssigned(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/it-dashboard/my-assigned",
        { headers: { Authorization: "Bearer test-token" } }
      );
      expect(result).toEqual(mockDisputes);
    });

    it("should return fallback on error", async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const result = await ITDashboardService.getMyAssigned(mockToken);

      expect(result).toEqual({ disputes: [] });
      consoleSpy.mockRestore();
    });
  });

  describe("getITStaff", () => {
    it("should fetch IT staff list", async () => {
      const mockStaff = { itStaff: [{ id: 1, username: "alex_it" }] };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStaff,
      });

      const result = await ITDashboardService.getITStaff(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/it-dashboard/it-staff",
        { headers: { Authorization: "Bearer test-token" } }
      );
      expect(result).toEqual(mockStaff);
    });
  });

  describe("assignDispute", () => {
    it("should assign dispute successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Assigned" }),
      });

      const result = await ITDashboardService.assignDispute(mockToken, 1, 5);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/it-dashboard/disputes/1/assign",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ assigneeId: 5 }),
        }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failed assignment", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Cannot assign to this user" }),
      });

      const result = await ITDashboardService.assignDispute(mockToken, 1, 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot assign to this user");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const result = await ITDashboardService.assignDispute(mockToken, 1, 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error. Please try again.");
      consoleSpy.mockRestore();
    });
  });

  describe("updateStatus", () => {
    it("should update dispute status successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Status updated" }),
      });

      const result = await ITDashboardService.updateStatus(mockToken, 1, "in_progress");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/it-dashboard/disputes/1/status",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "in_progress" }),
        }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failed status update", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Invalid status" }),
      });

      const result = await ITDashboardService.updateStatus(mockToken, 1, "invalid");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid status");
    });
  });

  describe("resolveDispute", () => {
    it("should resolve dispute successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Resolved" }),
      });

      const resolution = { resolutionNotes: "Fixed the issue" };
      const result = await ITDashboardService.resolveDispute(mockToken, 1, resolution);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/it-dashboard/disputes/1/resolve",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(resolution),
        }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failed resolution", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Already resolved" }),
      });

      const result = await ITDashboardService.resolveDispute(mockToken, 1, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Already resolved");
    });
  });

  describe("IT Support Tools", () => {
    describe("searchUsers", () => {
      it("should search users by query", async () => {
        const mockUsers = { users: [{ id: 1, email: "test@example.com" }] };
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockUsers,
        });

        const result = await ITDashboardService.searchUsers(mockToken, "test@example.com");

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("query=test%40example.com"),
          { headers: { Authorization: "Bearer test-token" } }
        );
        expect(result).toEqual(mockUsers);
      });

      it("should search users with type filter", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ users: [] }),
        });

        await ITDashboardService.searchUsers(mockToken, "test", "homeowner");

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("type=homeowner"),
          { headers: { Authorization: "Bearer test-token" } }
        );
      });
    });

    describe("getUserDetails", () => {
      it("should fetch user details", async () => {
        const mockUser = { user: { id: 1, email: "test@example.com" } };
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        });

        const result = await ITDashboardService.getUserDetails(mockToken, 1);

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/it-support/user/1",
          { headers: { Authorization: "Bearer test-token" } }
        );
        expect(result).toEqual(mockUser);
      });
    });

    describe("sendPasswordReset", () => {
      it("should send password reset successfully", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: "Email sent" }),
        });

        const result = await ITDashboardService.sendPasswordReset(mockToken, 1);

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/it-support/user/1/send-password-reset",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer test-token",
              "Content-Type": "application/json",
            },
          }
        );
        expect(result.success).toBe(true);
      });

      it("should handle password reset failure", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: "User not found" }),
        });

        const result = await ITDashboardService.sendPasswordReset(mockToken, 999);

        expect(result.success).toBe(false);
        expect(result.error).toBe("User not found");
      });
    });

    describe("unlockAccount", () => {
      it("should unlock account successfully", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: "Account unlocked" }),
        });

        const result = await ITDashboardService.unlockAccount(mockToken, 1);

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/it-support/user/1/unlock",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer test-token",
              "Content-Type": "application/json",
            },
          }
        );
        expect(result.success).toBe(true);
      });
    });

    describe("getUserProfile", () => {
      it("should fetch user profile", async () => {
        const mockProfile = { profile: { firstName: "John", lastName: "Doe" } };
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockProfile,
        });

        const result = await ITDashboardService.getUserProfile(mockToken, 1);

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/it-support/user/1/profile",
          { headers: { Authorization: "Bearer test-token" } }
        );
        expect(result).toEqual(mockProfile);
      });
    });

    describe("updateUserContact", () => {
      it("should update user contact info successfully", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: "Updated" }),
        });

        const result = await ITDashboardService.updateUserContact(mockToken, 1, {
          email: "new@example.com",
          phone: "1234567890",
        });

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/it-support/user/1/contact",
          {
            method: "PATCH",
            headers: {
              Authorization: "Bearer test-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: "new@example.com", phone: "1234567890" }),
          }
        );
        expect(result.success).toBe(true);
      });

      it("should handle duplicate email error", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: "Email already in use" }),
        });

        const result = await ITDashboardService.updateUserContact(mockToken, 1, {
          email: "existing@example.com",
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe("Email already in use");
      });
    });

    describe("getUserBilling", () => {
      it("should fetch user billing info", async () => {
        const mockBilling = { billing: { totalSpent: 1000 } };
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockBilling,
        });

        const result = await ITDashboardService.getUserBilling(mockToken, 1);

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/it-support/user/1/billing",
          { headers: { Authorization: "Bearer test-token" } }
        );
        expect(result).toEqual(mockBilling);
      });
    });

    describe("getUserSecurity", () => {
      it("should fetch user security info", async () => {
        const mockSecurity = { security: { failedAttempts: 0 } };
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockSecurity,
        });

        const result = await ITDashboardService.getUserSecurity(mockToken, 1);

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/it-support/user/1/security",
          { headers: { Authorization: "Bearer test-token" } }
        );
        expect(result).toEqual(mockSecurity);
      });
    });

    describe("forceLogout", () => {
      it("should force logout user successfully", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: "Logged out" }),
        });

        const result = await ITDashboardService.forceLogout(mockToken, 1);

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/it-support/user/1/force-logout",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer test-token",
              "Content-Type": "application/json",
            },
          }
        );
        expect(result.success).toBe(true);
      });
    });

    describe("suspendAccount", () => {
      it("should suspend account successfully", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: "Account suspended" }),
        });

        const result = await ITDashboardService.suspendAccount(mockToken, 1, {
          reason: "Suspicious activity",
          hours: 24,
        });

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/it-support/user/1/suspend",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer test-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ reason: "Suspicious activity", hours: 24 }),
          }
        );
        expect(result.success).toBe(true);
      });

      it("should handle cannot suspend owner error", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: "Cannot suspend owner account" }),
        });

        const result = await ITDashboardService.suspendAccount(mockToken, 1, {
          reason: "Test",
          hours: 1,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe("Cannot suspend owner account");
      });
    });

    describe("getUserDataSummary", () => {
      it("should fetch user data summary", async () => {
        const mockSummary = { dataSummary: { appointments: 10, reviews: 5 } };
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockSummary,
        });

        const result = await ITDashboardService.getUserDataSummary(mockToken, 1);

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/it-support/user/1/data-summary",
          { headers: { Authorization: "Bearer test-token" } }
        );
        expect(result).toEqual(mockSummary);
      });
    });

    describe("getUserAppInfo", () => {
      it("should fetch user app info", async () => {
        const mockAppInfo = { appInfo: { deviceType: "ios" } };
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockAppInfo,
        });

        const result = await ITDashboardService.getUserAppInfo(mockToken, 1);

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/it-support/user/1/app-info",
          { headers: { Authorization: "Bearer test-token" } }
        );
        expect(result).toEqual(mockAppInfo);
      });
    });

    describe("clearAppState", () => {
      it("should clear app state successfully", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: "App state cleared" }),
        });

        const result = await ITDashboardService.clearAppState(mockToken, 1);

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/it-support/user/1/clear-app-state",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer test-token",
              "Content-Type": "application/json",
            },
          }
        );
        expect(result.success).toBe(true);
      });
    });
  });
});
