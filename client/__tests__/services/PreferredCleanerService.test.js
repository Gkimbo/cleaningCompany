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
import PreferredCleanerService from "../../src/services/fetchRequests/PreferredCleanerService";

describe("PreferredCleanerService", () => {
  const mockToken = "test_token_12345";
  const homeId = 10;
  const cleanerId = 100;

  beforeEach(() => {
    jest.clearAllMocks();
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

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await PreferredCleanerService.getPreferredCleaners(mockToken, homeId);

      expect(HttpClient.get).toHaveBeenCalledWith(
        `/preferred-cleaner/homes/${homeId}/preferred-cleaners`,
        { token: mockToken }
      );
      expect(result.preferredCleaners).toHaveLength(2);
      expect(result.preferredCleaners[0].cleanerName).toBe("John Cleaner");
      expect(result.usePreferredCleaners).toBe(true);
    });

    it("should return empty list on error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await PreferredCleanerService.getPreferredCleaners(mockToken, homeId);

      expect(result.preferredCleaners).toEqual([]);
      expect(result.usePreferredCleaners).toBe(false);
    });

    it("should return empty list when response indicates failure", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Not found" });

      const result = await PreferredCleanerService.getPreferredCleaners(mockToken, homeId);

      expect(result.preferredCleaners).toEqual([]);
      expect(result.usePreferredCleaners).toBe(false);
    });

    it("should handle empty preferred cleaners list", async () => {
      HttpClient.get.mockResolvedValueOnce({
        preferredCleaners: [],
        usePreferredCleaners: false,
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

      HttpClient.delete.mockResolvedValueOnce(mockResponse);

      const result = await PreferredCleanerService.removePreferredCleaner(mockToken, homeId, cleanerId);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        `/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}`,
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("Cleaner removed from preferred list");
    });

    it("should return error when cleaner not found", async () => {
      HttpClient.delete.mockResolvedValueOnce({
        success: false,
        error: "Cleaner not found in preferred list",
      });

      const result = await PreferredCleanerService.removePreferredCleaner(mockToken, homeId, cleanerId);

      expect(result.error).toBe("Cleaner not found in preferred list");
    });

    it("should return error on network failure", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await PreferredCleanerService.removePreferredCleaner(mockToken, homeId, cleanerId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });
  });

  describe("updatePreferredSettings", () => {
    it("should toggle usePreferredCleaners to false", async () => {
      const mockResponse = {
        success: true,
        usePreferredCleaners: false,
        message: "All cleaners can now request jobs for this home",
      };

      HttpClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await PreferredCleanerService.updatePreferredSettings(mockToken, homeId, false);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        `/preferred-cleaner/homes/${homeId}/preferred-settings`,
        { usePreferredCleaners: false },
        { token: mockToken }
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

      HttpClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await PreferredCleanerService.updatePreferredSettings(mockToken, homeId, true);

      expect(result.success).toBe(true);
      expect(result.usePreferredCleaners).toBe(true);
      expect(result.message).toBe("Only preferred cleaners can now request jobs for this home");
    });

    it("should return error on failure", async () => {
      HttpClient.patch.mockResolvedValueOnce({
        success: false,
        error: "Home not found",
      });

      const result = await PreferredCleanerService.updatePreferredSettings(mockToken, homeId, false);

      expect(result.error).toBe("Home not found");
    });

    it("should return error on network failure", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await PreferredCleanerService.updatePreferredSettings(mockToken, homeId, true);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });
  });

  describe("isCleanerPreferred", () => {
    it("should return true when cleaner is preferred", async () => {
      HttpClient.get.mockResolvedValueOnce({ isPreferred: true });

      const result = await PreferredCleanerService.isCleanerPreferred(mockToken, homeId, cleanerId);

      expect(HttpClient.get).toHaveBeenCalledWith(
        `/preferred-cleaner/homes/${homeId}/cleaners/${cleanerId}/is-preferred`,
        { token: mockToken }
      );
      expect(result.isPreferred).toBe(true);
    });

    it("should return false when cleaner is not preferred", async () => {
      HttpClient.get.mockResolvedValueOnce({ isPreferred: false });

      const result = await PreferredCleanerService.isCleanerPreferred(mockToken, homeId, cleanerId);

      expect(result.isPreferred).toBe(false);
    });

    it("should return false when response indicates failure", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Not found" });

      const result = await PreferredCleanerService.isCleanerPreferred(mockToken, homeId, cleanerId);

      expect(result.isPreferred).toBe(false);
    });

    it("should return false on network error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await PreferredCleanerService.isCleanerPreferred(mockToken, homeId, cleanerId);

      expect(result.isPreferred).toBe(false);
    });
  });
});
