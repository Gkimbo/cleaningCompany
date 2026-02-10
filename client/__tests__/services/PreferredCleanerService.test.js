// Mock fetch
global.fetch = jest.fn();

// Mock the config
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

const PreferredCleanerService = require("../../src/services/fetchRequests/PreferredCleanerService").default;

describe("PreferredCleanerService", () => {
  const mockToken = "test_token_12345";
  const homeId = 10;
  const cleanerId = 100;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  describe("getPreferredCleaners", () => {
    it("should fetch preferred cleaners successfully", async () => {
      const mockResponse = {
        preferredCleaners: [
          {
            id: 1,
            cleanerId: 100,
            cleanerName: "John Cleaner",
            setAt: "2025-01-01T00:00:00.000Z",
            setBy: "review",
          },
          {
            id: 2,
            cleanerId: 101,
            cleanerName: "Jane Smith",
            setAt: "2025-01-02T00:00:00.000Z",
            setBy: "settings",
          },
        ],
        usePreferredCleaners: true,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await PreferredCleanerService.getPreferredCleaners(mockToken, homeId);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/v1/preferred-cleaner/homes/${homeId}/preferred-cleaners`,
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        })
      );
      expect(result.preferredCleaners).toHaveLength(2);
      expect(result.preferredCleaners[0].cleanerName).toBe("John Cleaner");
      expect(result.usePreferredCleaners).toBe(true);
    });

    it("should return empty list on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await PreferredCleanerService.getPreferredCleaners(mockToken, homeId);

      expect(result.preferredCleaners).toEqual([]);
      expect(result.usePreferredCleaners).toBe(true);
    });

    it("should return empty list when response is not ok", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await PreferredCleanerService.getPreferredCleaners(mockToken, homeId);

      expect(result.preferredCleaners).toEqual([]);
      // When response is explicitly not ok, usePreferredCleaners is false
      // (different from network error which returns true as a safe default)
      expect(result.usePreferredCleaners).toBe(false);
    });

    it("should handle empty preferred cleaners list", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          preferredCleaners: [],
          usePreferredCleaners: false,
        }),
      });

      const result = await PreferredCleanerService.getPreferredCleaners(mockToken, homeId);

      expect(result.preferredCleaners).toEqual([]);
      expect(result.usePreferredCleaners).toBe(false);
    });
  });

  describe("removePreferredCleaner", () => {
    it("should remove preferred cleaner successfully", async () => {
      const mockResponse = {
        success: true,
        message: "Cleaner removed from preferred list",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await PreferredCleanerService.removePreferredCleaner(mockToken, homeId, cleanerId);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}`,
        expect.objectContaining({
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        })
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("Cleaner removed from preferred list");
    });

    it("should return error when cleaner not found", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: "Cleaner not found in preferred list",
        }),
      });

      const result = await PreferredCleanerService.removePreferredCleaner(mockToken, homeId, cleanerId);

      expect(result.error).toBe("Cleaner not found in preferred list");
    });

    it("should return error on network failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await PreferredCleanerService.removePreferredCleaner(mockToken, homeId, cleanerId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to remove cleaner");
    });
  });

  describe("updatePreferredSettings", () => {
    it("should toggle usePreferredCleaners to false", async () => {
      const mockResponse = {
        success: true,
        usePreferredCleaners: false,
        message: "All cleaners can now request jobs for this home",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await PreferredCleanerService.updatePreferredSettings(mockToken, homeId, false);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/v1/preferred-cleaner/homes/${homeId}/preferred-settings`,
        expect.objectContaining({
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify({ usePreferredCleaners: false }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.usePreferredCleaners).toBe(false);
    });

    it("should toggle usePreferredCleaners to true", async () => {
      const mockResponse = {
        success: true,
        usePreferredCleaners: true,
        message: "Only preferred cleaners can now request jobs for this home",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await PreferredCleanerService.updatePreferredSettings(mockToken, homeId, true);

      expect(result.success).toBe(true);
      expect(result.usePreferredCleaners).toBe(true);
      expect(result.message).toBe("Only preferred cleaners can now request jobs for this home");
    });

    it("should return error on failure", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: "Home not found",
        }),
      });

      const result = await PreferredCleanerService.updatePreferredSettings(mockToken, homeId, false);

      expect(result.error).toBe("Home not found");
    });

    it("should return error on network failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await PreferredCleanerService.updatePreferredSettings(mockToken, homeId, true);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update settings");
    });
  });

  describe("isCleanerPreferred", () => {
    it("should return true when cleaner is preferred", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ isPreferred: true }),
      });

      const result = await PreferredCleanerService.isCleanerPreferred(mockToken, homeId, cleanerId);

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/v1/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/is-preferred`,
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        })
      );
      expect(result.isPreferred).toBe(true);
    });

    it("should return false when cleaner is not preferred", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ isPreferred: false }),
      });

      const result = await PreferredCleanerService.isCleanerPreferred(mockToken, homeId, cleanerId);

      expect(result.isPreferred).toBe(false);
    });

    it("should return false when response is not ok", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await PreferredCleanerService.isCleanerPreferred(mockToken, homeId, cleanerId);

      expect(result.isPreferred).toBe(false);
    });

    it("should return false on network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await PreferredCleanerService.isCleanerPreferred(mockToken, homeId, cleanerId);

      expect(result.isPreferred).toBe(false);
    });
  });
});
