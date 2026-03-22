/**
 * Tests for ITDashboardService
 * Tests all API methods for IT dashboard operations and support tools.
 */

import ITDashboardService from "../../src/services/fetchRequests/ITDashboardService";

// Mock HttpClient
jest.mock("../../src/services/HttpClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));
import HttpClient from "../../src/services/HttpClient";

describe("ITDashboardService", () => {
  const mockToken = "test-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchWithFallback", () => {
    it("should return data on successful fetch", async () => {
      const mockData = { openDisputes: 5 };
      HttpClient.get.mockResolvedValueOnce(mockData);

      const result = await ITDashboardService.getQuickStats(mockToken);

      expect(result).toEqual(mockData);
    });

    it("should return fallback on non-ok response", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Server error" });

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
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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
      HttpClient.get.mockResolvedValueOnce(mockStats);

      const result = await ITDashboardService.getQuickStats(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/it-dashboard/quick-stats",
        { token: "test-token", useBaseUrl: true }
      );
      expect(result).toEqual(mockStats);
    });
  });

  describe("getDisputes", () => {
    it("should call correct endpoint with filters", async () => {
      const mockDisputes = { disputes: [], total: 0 };
      HttpClient.get.mockResolvedValueOnce(mockDisputes);

      const filters = { status: "submitted", priority: "high" };
      const result = await ITDashboardService.getDisputes(mockToken, filters);

      expect(HttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining("status=submitted"),
        { token: "test-token", useBaseUrl: true }
      );
      expect(HttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining("priority=high"),
        { token: "test-token", useBaseUrl: true }
      );
    });

    it("should return fallback for disputes", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Server error" });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const result = await ITDashboardService.getDisputes(mockToken);

      expect(result).toEqual({ disputes: [], total: 0 });
      consoleSpy.mockRestore();
    });
  });

  describe("getDispute", () => {
    it("should fetch single dispute by id", async () => {
      const mockDispute = { dispute: { id: 1, category: "app_crash" } };
      HttpClient.get.mockResolvedValueOnce(mockDispute);

      const result = await ITDashboardService.getDispute(mockToken, 1);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/it-dashboard/disputes/1",
        { token: "test-token", useBaseUrl: true }
      );
      expect(result).toEqual(mockDispute);
    });
  });

  describe("getMyAssigned", () => {
    it("should fetch assigned disputes", async () => {
      const mockDisputes = { disputes: [{ id: 1 }] };
      HttpClient.get.mockResolvedValueOnce(mockDisputes);

      const result = await ITDashboardService.getMyAssigned(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/it-dashboard/my-assigned",
        { token: "test-token", useBaseUrl: true }
      );
      expect(result).toEqual(mockDisputes);
    });

    it("should return fallback on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Server error" });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const result = await ITDashboardService.getMyAssigned(mockToken);

      expect(result).toEqual({ disputes: [] });
      consoleSpy.mockRestore();
    });
  });

  describe("getITStaff", () => {
    it("should fetch IT staff list", async () => {
      const mockStaff = { itStaff: [{ id: 1, username: "alex_it" }] };
      HttpClient.get.mockResolvedValueOnce(mockStaff);

      const result = await ITDashboardService.getITStaff(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/it-dashboard/it-staff",
        { token: "test-token", useBaseUrl: true }
      );
      expect(result).toEqual(mockStaff);
    });
  });

  describe("assignDispute", () => {
    it("should assign dispute successfully", async () => {
      HttpClient.post.mockResolvedValueOnce({ message: "Assigned" });

      const result = await ITDashboardService.assignDispute(mockToken, 1, 5);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/api/v1/it-dashboard/disputes/1/assign",
        { assigneeId: 5 },
        { token: "test-token", useBaseUrl: true }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failed assignment", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Cannot assign to this user" });

      const result = await ITDashboardService.assignDispute(mockToken, 1, 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot assign to this user");
    });

    it("should handle network error", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const result = await ITDashboardService.assignDispute(mockToken, 1, 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
      consoleSpy.mockRestore();
    });
  });

  describe("updateStatus", () => {
    it("should update dispute status successfully", async () => {
      HttpClient.post.mockResolvedValueOnce({ message: "Status updated" });

      const result = await ITDashboardService.updateStatus(mockToken, 1, "in_progress");

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/api/v1/it-dashboard/disputes/1/status",
        { status: "in_progress" },
        { token: "test-token", useBaseUrl: true }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failed status update", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Invalid status" });

      const result = await ITDashboardService.updateStatus(mockToken, 1, "invalid");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid status");
    });
  });

  describe("resolveDispute", () => {
    it("should resolve dispute successfully", async () => {
      HttpClient.post.mockResolvedValueOnce({ message: "Resolved" });

      const resolution = { resolutionNotes: "Fixed the issue" };
      const result = await ITDashboardService.resolveDispute(mockToken, 1, resolution);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/api/v1/it-dashboard/disputes/1/resolve",
        resolution,
        { token: "test-token", useBaseUrl: true }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failed resolution", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Already resolved" });

      const result = await ITDashboardService.resolveDispute(mockToken, 1, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Already resolved");
    });
  });

  describe("IT Support Tools", () => {
    describe("searchUsers", () => {
      it("should search users by query", async () => {
        const mockUsers = { users: [{ id: 1, email: "test@example.com" }] };
        HttpClient.get.mockResolvedValueOnce(mockUsers);

        const result = await ITDashboardService.searchUsers(mockToken, "test@example.com");

        expect(HttpClient.get).toHaveBeenCalledWith(
          expect.stringContaining("query=test%40example.com"),
          { token: "test-token", useBaseUrl: true }
        );
        expect(result).toEqual(mockUsers);
      });

      it("should search users with type filter", async () => {
        HttpClient.get.mockResolvedValueOnce({ users: [] });

        await ITDashboardService.searchUsers(mockToken, "test", "homeowner");

        expect(HttpClient.get).toHaveBeenCalledWith(
          expect.stringContaining("type=homeowner"),
          { token: "test-token", useBaseUrl: true }
        );
      });
    });

    describe("getUserDetails", () => {
      it("should fetch user details", async () => {
        const mockUser = { user: { id: 1, email: "test@example.com" } };
        HttpClient.get.mockResolvedValueOnce(mockUser);

        const result = await ITDashboardService.getUserDetails(mockToken, 1);

        expect(HttpClient.get).toHaveBeenCalledWith(
          "/api/v1/it-support/user/1",
          { token: "test-token", useBaseUrl: true }
        );
        expect(result).toEqual(mockUser);
      });
    });

    describe("sendPasswordReset", () => {
      it("should send password reset successfully", async () => {
        HttpClient.post.mockResolvedValueOnce({ message: "Email sent" });

        const result = await ITDashboardService.sendPasswordReset(mockToken, 1);

        expect(HttpClient.post).toHaveBeenCalledWith(
          "/api/v1/it-support/user/1/send-password-reset",
          {},
          { token: "test-token", useBaseUrl: true }
        );
        expect(result.success).toBe(true);
      });

      it("should handle password reset failure", async () => {
        HttpClient.post.mockResolvedValueOnce({ success: false, error: "User not found" });

        const result = await ITDashboardService.sendPasswordReset(mockToken, 999);

        expect(result.success).toBe(false);
        expect(result.error).toBe("User not found");
      });
    });

    describe("unlockAccount", () => {
      it("should unlock account successfully", async () => {
        HttpClient.post.mockResolvedValueOnce({ message: "Account unlocked" });

        const result = await ITDashboardService.unlockAccount(mockToken, 1);

        expect(HttpClient.post).toHaveBeenCalledWith(
          "/api/v1/it-support/user/1/unlock",
          {},
          { token: "test-token", useBaseUrl: true }
        );
        expect(result.success).toBe(true);
      });
    });

    describe("getUserProfile", () => {
      it("should fetch user profile", async () => {
        const mockProfile = { profile: { firstName: "John", lastName: "Doe" } };
        HttpClient.get.mockResolvedValueOnce(mockProfile);

        const result = await ITDashboardService.getUserProfile(mockToken, 1);

        expect(HttpClient.get).toHaveBeenCalledWith(
          "/api/v1/it-support/user/1/profile",
          { token: "test-token", useBaseUrl: true }
        );
        expect(result).toEqual(mockProfile);
      });
    });

    describe("updateUserContact", () => {
      it("should update user contact info successfully", async () => {
        HttpClient.patch.mockResolvedValueOnce({ message: "Updated" });

        const result = await ITDashboardService.updateUserContact(mockToken, 1, {
          email: "new@example.com",
          phone: "1234567890",
        });

        expect(HttpClient.patch).toHaveBeenCalledWith(
          "/api/v1/it-support/user/1/contact",
          { email: "new@example.com", phone: "1234567890" },
          { token: "test-token", useBaseUrl: true }
        );
        expect(result.success).toBe(true);
      });

      it("should handle duplicate email error", async () => {
        HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Email already in use" });

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
        HttpClient.get.mockResolvedValueOnce(mockBilling);

        const result = await ITDashboardService.getUserBilling(mockToken, 1);

        expect(HttpClient.get).toHaveBeenCalledWith(
          "/api/v1/it-support/user/1/billing",
          { token: "test-token", useBaseUrl: true }
        );
        expect(result).toEqual(mockBilling);
      });
    });

    describe("getUserSecurity", () => {
      it("should fetch user security info", async () => {
        const mockSecurity = { security: { failedAttempts: 0 } };
        HttpClient.get.mockResolvedValueOnce(mockSecurity);

        const result = await ITDashboardService.getUserSecurity(mockToken, 1);

        expect(HttpClient.get).toHaveBeenCalledWith(
          "/api/v1/it-support/user/1/security",
          { token: "test-token", useBaseUrl: true }
        );
        expect(result).toEqual(mockSecurity);
      });
    });

    describe("forceLogout", () => {
      it("should force logout user successfully", async () => {
        HttpClient.post.mockResolvedValueOnce({ message: "Logged out" });

        const result = await ITDashboardService.forceLogout(mockToken, 1);

        expect(HttpClient.post).toHaveBeenCalledWith(
          "/api/v1/it-support/user/1/force-logout",
          {},
          { token: "test-token", useBaseUrl: true }
        );
        expect(result.success).toBe(true);
      });
    });

    describe("suspendAccount", () => {
      it("should suspend account successfully", async () => {
        HttpClient.post.mockResolvedValueOnce({ message: "Account suspended" });

        const result = await ITDashboardService.suspendAccount(mockToken, 1, {
          reason: "Suspicious activity",
          hours: 24,
        });

        expect(HttpClient.post).toHaveBeenCalledWith(
          "/api/v1/it-support/user/1/suspend",
          { reason: "Suspicious activity", hours: 24 },
          { token: "test-token", useBaseUrl: true }
        );
        expect(result.success).toBe(true);
      });

      it("should handle cannot suspend owner error", async () => {
        HttpClient.post.mockResolvedValueOnce({ success: false, error: "Cannot suspend owner account" });

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
        HttpClient.get.mockResolvedValueOnce(mockSummary);

        const result = await ITDashboardService.getUserDataSummary(mockToken, 1);

        expect(HttpClient.get).toHaveBeenCalledWith(
          "/api/v1/it-support/user/1/data-summary",
          { token: "test-token", useBaseUrl: true }
        );
        expect(result).toEqual(mockSummary);
      });
    });

    describe("getUserAppInfo", () => {
      it("should fetch user app info", async () => {
        const mockAppInfo = { appInfo: { deviceType: "ios" } };
        HttpClient.get.mockResolvedValueOnce(mockAppInfo);

        const result = await ITDashboardService.getUserAppInfo(mockToken, 1);

        expect(HttpClient.get).toHaveBeenCalledWith(
          "/api/v1/it-support/user/1/app-info",
          { token: "test-token", useBaseUrl: true }
        );
        expect(result).toEqual(mockAppInfo);
      });
    });

    describe("clearAppState", () => {
      it("should clear app state successfully", async () => {
        HttpClient.post.mockResolvedValueOnce({ message: "App state cleared" });

        const result = await ITDashboardService.clearAppState(mockToken, 1);

        expect(HttpClient.post).toHaveBeenCalledWith(
          "/api/v1/it-support/user/1/clear-app-state",
          {},
          { token: "test-token", useBaseUrl: true }
        );
        expect(result.success).toBe(true);
      });
    });
  });
});
