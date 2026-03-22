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
import ReferralService from "../../src/services/fetchRequests/ReferralService";

describe("ReferralService", () => {
  const mockToken = "test-token-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateCode", () => {
    it("should validate a valid referral code", async () => {
      const mockResponse = {
        valid: true,
        referrer: { firstName: "John" },
        programType: "client_to_client",
        rewards: {
          referrerReward: 2500,
          referredReward: 2500,
          cleaningsRequired: 1,
        },
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await ReferralService.validateCode("JOHN1234", "homeowner");

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/referrals/validate/JOHN1234?userType=homeowner",
        { skipAuth: true }
      );
      expect(result.valid).toBe(true);
      expect(result.referrer.firstName).toBe("John");
    });

    it("should return error for invalid code", async () => {
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        error: "This referral code doesn't exist.",
        errorCode: "CODE_NOT_FOUND",
      });

      const result = await ReferralService.validateCode("INVALID", "homeowner");

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle network errors", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await ReferralService.validateCode("JOHN1234", "homeowner");

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("getCurrentPrograms", () => {
    it("should fetch active programs", async () => {
      const mockResponse = {
        active: true,
        programs: [
          {
            type: "client_to_client",
            name: "Refer a Friend",
            description: "Give $25, Get $25",
          },
        ],
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await ReferralService.getCurrentPrograms();

      expect(HttpClient.get).toHaveBeenCalledWith("/referrals/current", { skipAuth: true });
      expect(result.active).toBe(true);
      expect(result.programs).toHaveLength(1);
    });

    it("should return empty programs on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await ReferralService.getCurrentPrograms();

      expect(result.active).toBe(false);
      expect(result.programs).toEqual([]);
    });
  });

  describe("getMyCode", () => {
    it("should fetch user referral code", async () => {
      const mockResponse = {
        referralCode: "JANE1234",
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await ReferralService.getMyCode(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/referrals/my-code", { token: mockToken });
      expect(result.referralCode).toBe("JANE1234");
    });

    it("should return null on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await ReferralService.getMyCode(mockToken);

      expect(result).toBeNull();
    });
  });

  describe("getMyReferrals", () => {
    it("should fetch user referral stats and history", async () => {
      const mockResponse = {
        referralCode: "JANE1234",
        availableCredits: 5000,
        stats: {
          totalReferrals: 3,
          pending: 1,
          qualified: 1,
          rewarded: 1,
          totalEarned: 5000,
        },
        referrals: [
          { id: 1, status: "rewarded", createdAt: "2024-01-01" },
        ],
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await ReferralService.getMyReferrals(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/referrals/my-referrals", { token: mockToken });
      expect(result.stats.totalReferrals).toBe(3);
      expect(result.referrals).toHaveLength(1);
    });

    it("should return null on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await ReferralService.getMyReferrals(mockToken);

      expect(result).toBeNull();
    });
  });

  describe("getMyCredits", () => {
    it("should fetch available credits", async () => {
      const mockResponse = {
        availableCredits: 7500,
        availableDollars: "75.00",
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await ReferralService.getMyCredits(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/referrals/my-credits", { token: mockToken });
      expect(result.availableCredits).toBe(7500);
      expect(result.availableDollars).toBe("75.00");
    });

    it("should return default values on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await ReferralService.getMyCredits(mockToken);

      expect(result.availableCredits).toBe(0);
      expect(result.availableDollars).toBe("0.00");
    });
  });

  describe("applyCredits", () => {
    it("should apply credits to appointment", async () => {
      const mockResponse = {
        success: true,
        amountApplied: 2500,
        remainingCredits: 5000,
        newPrice: 125,
      };

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await ReferralService.applyCredits(mockToken, 1, 2500);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/referrals/apply-credits",
        { appointmentId: 1, amount: 2500 },
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.amountApplied).toBe(2500);
    });

    it("should return error on failure", async () => {
      HttpClient.post.mockResolvedValueOnce({
        success: false,
        error: "No credits available",
      });

      const result = await ReferralService.applyCredits(mockToken, 1, 2500);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No credits available");
    });
  });

  describe("getFullConfig (Owner)", () => {
    it("should fetch referral config", async () => {
      const mockResponse = {
        source: "database",
        config: { id: 1 },
        formattedConfig: {
          clientToClient: { enabled: true, referrerReward: 2500 },
          clientToCleaner: { enabled: false },
          cleanerToCleaner: { enabled: false },
          cleanerToClient: { enabled: false },
        },
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await ReferralService.getFullConfig(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/referrals/config", { token: mockToken });
      expect(result.formattedConfig.clientToClient.enabled).toBe(true);
    });

    it("should return null on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await ReferralService.getFullConfig(mockToken);

      expect(result).toBeNull();
    });
  });

  describe("updateConfig (Owner)", () => {
    it("should update referral config", async () => {
      const configUpdate = {
        clientToClient: { enabled: true, referrerReward: 5000 },
        changeNote: "Updated rewards",
      };

      const mockResponse = {
        success: true,
        message: "Configuration updated",
        config: { id: 1 },
        formattedConfig: { clientToClient: { enabled: true, referrerReward: 5000 } },
      };

      HttpClient.put.mockResolvedValueOnce(mockResponse);

      const result = await ReferralService.updateConfig(mockToken, configUpdate);

      expect(HttpClient.put).toHaveBeenCalledWith(
        "/referrals/config",
        configUpdate,
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on failure", async () => {
      HttpClient.put.mockResolvedValueOnce({ success: false });

      const result = await ReferralService.updateConfig(mockToken, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update configuration");
    });
  });

  describe("getAllReferrals (Owner)", () => {
    it("should fetch all referrals with filters", async () => {
      const mockResponse = {
        count: 1,
        referrals: [
          {
            id: 1,
            referrer: { firstName: "John" },
            referred: { firstName: "Jane" },
            status: "pending",
          },
        ],
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await ReferralService.getAllReferrals(mockToken, {
        status: "pending",
      });

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/referrals/all?status=pending",
        { token: mockToken }
      );
      expect(result.referrals).toHaveLength(1);
    });

    it("should return empty object on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await ReferralService.getAllReferrals(mockToken);

      expect(result).toEqual({ count: 0, referrals: [] });
    });
  });

  describe("updateReferralStatus (Owner)", () => {
    it("should update referral status", async () => {
      const mockResponse = {
        success: true,
        referral: { id: 1, status: "cancelled" },
      };

      HttpClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await ReferralService.updateReferralStatus(mockToken, 1, "cancelled");

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/referrals/1/status",
        { status: "cancelled" },
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });
  });

  describe("logShare", () => {
    it("should log share action", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: true });

      await ReferralService.logShare(mockToken, "sms");

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/referrals/share",
        { platform: "sms" },
        { token: mockToken }
      );
    });
  });
});
