// Mock fetch globally
global.fetch = jest.fn();

// Mock console methods
const originalWarn = console.warn;
const originalError = console.error;

beforeEach(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.warn = originalWarn;
  console.error = originalError;
});

// Mock config
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:5000/api/v1",
}));

import IncentivesService from "../../src/services/fetchRequests/IncentivesService";

describe("IncentivesService", () => {
  const mockToken = "test_token_123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getCurrentIncentives", () => {
    it("should fetch current incentives successfully", async () => {
      const mockResponse = {
        cleaner: {
          enabled: true,
          feeReductionPercent: 1.0,
          eligibilityDays: 30,
          maxCleanings: 5,
        },
        homeowner: {
          enabled: true,
          discountPercent: 0.1,
          maxCleanings: 4,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await IncentivesService.getCurrentIncentives();

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/v1/incentives/current"
      );
      expect(result).toEqual(mockResponse);
    });

    it("should return null on failed response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await IncentivesService.getCurrentIncentives();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });

    it("should return null on network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await IncentivesService.getCurrentIncentives();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe("getFullConfig", () => {
    it("should fetch full config successfully", async () => {
      const mockResponse = {
        source: "database",
        config: {
          id: 1,
          cleanerIncentiveEnabled: true,
          cleanerFeeReductionPercent: 1.0,
          cleanerEligibilityDays: 30,
          cleanerMaxCleanings: 5,
          homeownerIncentiveEnabled: true,
          homeownerDiscountPercent: 0.1,
          homeownerMaxCleanings: 4,
        },
        formattedConfig: {
          cleaner: { enabled: true },
          homeowner: { enabled: true },
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await IncentivesService.getFullConfig(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/v1/incentives/config",
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it("should return null on unauthorized response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const result = await IncentivesService.getFullConfig(mockToken);

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });

    it("should return null on network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await IncentivesService.getFullConfig(mockToken);

      expect(result).toBeNull();
    });
  });

  describe("updateIncentives", () => {
    const validIncentiveData = {
      cleanerIncentiveEnabled: true,
      cleanerFeeReductionPercent: 1.0,
      cleanerEligibilityDays: 30,
      cleanerMaxCleanings: 5,
      homeownerIncentiveEnabled: true,
      homeownerDiscountPercent: 0.1,
      homeownerMaxCleanings: 4,
      changeNote: "Enable incentives",
    };

    it("should update incentives successfully", async () => {
      const mockResponse = {
        success: true,
        message: "Incentive configuration updated successfully",
        config: { id: 2, ...validIncentiveData },
        formattedConfig: {
          cleaner: { enabled: true },
          homeowner: { enabled: true },
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await IncentivesService.updateIncentives(
        mockToken,
        validIncentiveData
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/v1/incentives/config",
        expect.objectContaining({
          method: "PUT",
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(validIncentiveData),
        })
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("Incentive configuration updated successfully");
    });

    it("should return error on validation failure", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            error: "cleanerFeeReductionPercent must be a number between 0 and 1",
          }),
      });

      const result = await IncentivesService.updateIncentives(mockToken, {
        ...validIncentiveData,
        cleanerFeeReductionPercent: 1.5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "cleanerFeeReductionPercent must be a number between 0 and 1"
      );
    });

    it("should return error on network failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await IncentivesService.updateIncentives(
        mockToken,
        validIncentiveData
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error. Please try again.");
    });

    it("should return generic error when error field missing", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await IncentivesService.updateIncentives(
        mockToken,
        validIncentiveData
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update incentives");
    });
  });

  describe("getIncentiveHistory", () => {
    it("should fetch history successfully", async () => {
      const mockResponse = {
        count: 2,
        history: [
          {
            id: 2,
            isActive: true,
            cleaner: { enabled: true },
            homeowner: { enabled: true },
          },
          {
            id: 1,
            isActive: false,
            cleaner: { enabled: false },
            homeowner: { enabled: false },
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await IncentivesService.getIncentiveHistory(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/v1/incentives/history?limit=20",
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.count).toBe(2);
      expect(result.history).toHaveLength(2);
    });

    it("should accept custom limit parameter", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 0, history: [] }),
      });

      await IncentivesService.getIncentiveHistory(mockToken, 5);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/v1/incentives/history?limit=5",
        expect.any(Object)
      );
    });

    it("should return empty history on failed response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const result = await IncentivesService.getIncentiveHistory(mockToken);

      expect(result).toEqual({ count: 0, history: [] });
    });

    it("should return empty history on network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await IncentivesService.getIncentiveHistory(mockToken);

      expect(result).toEqual({ count: 0, history: [] });
    });
  });

  describe("checkCleanerEligibility", () => {
    it("should check cleaner eligibility successfully", async () => {
      const mockResponse = {
        eligible: true,
        remainingCleanings: 3,
        completedCleanings: 2,
        feeReductionPercent: 1.0,
        config: {
          maxCleanings: 5,
          eligibilityDays: 30,
          feeReductionPercent: 1.0,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await IncentivesService.checkCleanerEligibility(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/v1/incentives/cleaner-eligibility",
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.eligible).toBe(true);
      expect(result.remainingCleanings).toBe(3);
    });

    it("should return not eligible on failed response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await IncentivesService.checkCleanerEligibility(mockToken);

      expect(result).toEqual({ eligible: false, remainingCleanings: 0 });
    });

    it("should return not eligible on network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await IncentivesService.checkCleanerEligibility(mockToken);

      expect(result).toEqual({ eligible: false, remainingCleanings: 0 });
    });
  });

  describe("checkHomeownerEligibility", () => {
    it("should check homeowner eligibility successfully", async () => {
      const mockResponse = {
        eligible: true,
        remainingCleanings: 2,
        completedAppointments: 2,
        discountPercent: 0.1,
        config: {
          maxCleanings: 4,
          discountPercent: 0.1,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await IncentivesService.checkHomeownerEligibility(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:5000/api/v1/incentives/homeowner-eligibility",
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.eligible).toBe(true);
      expect(result.remainingCleanings).toBe(2);
      expect(result.discountPercent).toBe(0.1);
    });

    it("should return not eligible on failed response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await IncentivesService.checkHomeownerEligibility(mockToken);

      expect(result).toEqual({ eligible: false, remainingCleanings: 0 });
    });

    it("should return not eligible on network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await IncentivesService.checkHomeownerEligibility(mockToken);

      expect(result).toEqual({ eligible: false, remainingCleanings: 0 });
    });
  });
});
