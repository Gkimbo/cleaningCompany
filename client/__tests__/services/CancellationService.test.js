// Mock fetch globally
global.fetch = jest.fn();

// Mock config
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:5000/api/v1",
}));

import FetchData from "../../src/services/fetchRequests/fetchData";

describe("Cancellation Service Methods", () => {
  const mockToken = "test_token_123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getCancellationInfo", () => {
    it("should fetch cancellation info successfully", async () => {
      const mockResponse = {
        daysUntilAppointment: 3,
        isWithinPenaltyWindow: true,
        estimatedRefund: "100.00",
        cleanerPayout: "90.00",
        warningMessage: "Test warning",
        isHomeowner: true,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await FetchData.getCancellationInfo(1, mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/cancellation-info/1"),
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it("should return error on failed response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Appointment not found" }),
      });

      const result = await FetchData.getCancellationInfo(999, mockToken);

      expect(result).toEqual({ error: "Appointment not found" });
    });

    it("should return error on network failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await FetchData.getCancellationInfo(1, mockToken);

      expect(result).toEqual({ error: "Failed to get cancellation info" });
    });
  });

  describe("cancelAsHomeowner", () => {
    it("should cancel appointment successfully", async () => {
      const mockResponse = {
        success: true,
        message: "Appointment cancelled successfully.",
        wasWithinPenaltyWindow: false,
        refund: { amount: 200 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await FetchData.cancelAsHomeowner(1, mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/1/cancel-homeowner"),
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it("should return partial refund info when within penalty window", async () => {
      const mockResponse = {
        success: true,
        message: "Appointment cancelled. Cleaner will receive partial payment.",
        wasWithinPenaltyWindow: true,
        refund: { amount: 100 },
        cleanerPayout: {
          totalAmount: 90,
          perCleaner: 90,
          cleanerCount: 1,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await FetchData.cancelAsHomeowner(1, mockToken);

      expect(result.wasWithinPenaltyWindow).toBe(true);
      expect(result.cleanerPayout).toBeDefined();
      expect(result.refund.amount).toBe(100);
    });

    it("should return error on failed response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Cannot cancel a completed appointment" }),
      });

      const result = await FetchData.cancelAsHomeowner(1, mockToken);

      expect(result).toEqual({ error: "Cannot cancel a completed appointment" });
    });

    it("should return error on network failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await FetchData.cancelAsHomeowner(1, mockToken);

      expect(result).toEqual({ error: "Failed to cancel appointment" });
    });
  });

  describe("cancelAsCleaner", () => {
    it("should cancel job successfully without penalty", async () => {
      const mockResponse = {
        success: true,
        message: "You have been removed from this appointment.",
        wasWithinPenaltyWindow: false,
        penaltyApplied: false,
        accountFrozen: false,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await FetchData.cancelAsCleaner(1, mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/1/cancel-cleaner"),
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
        })
      );

      expect(result.success).toBe(true);
      expect(result.penaltyApplied).toBe(false);
    });

    it("should return penalty info when within penalty window", async () => {
      const mockResponse = {
        success: true,
        message:
          "You have been removed from this appointment. A 1-star cancellation penalty has been applied.",
        wasWithinPenaltyWindow: true,
        penaltyApplied: true,
        accountFrozen: false,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await FetchData.cancelAsCleaner(1, mockToken);

      expect(result.wasWithinPenaltyWindow).toBe(true);
      expect(result.penaltyApplied).toBe(true);
      expect(result.accountFrozen).toBe(false);
    });

    it("should indicate account frozen when reaching 3 penalties", async () => {
      const mockResponse = {
        success: true,
        message:
          "You have been removed from this appointment. A 1-star cancellation penalty has been applied.",
        wasWithinPenaltyWindow: true,
        penaltyApplied: true,
        accountFrozen: true,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await FetchData.cancelAsCleaner(1, mockToken);

      expect(result.accountFrozen).toBe(true);
    });

    it("should return error when not assigned to appointment", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "You are not assigned to this appointment" }),
      });

      const result = await FetchData.cancelAsCleaner(1, mockToken);

      expect(result).toEqual({ error: "You are not assigned to this appointment" });
    });

    it("should return error when account is frozen", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({ error: "Your account is frozen. Please contact support." }),
      });

      const result = await FetchData.cancelAsCleaner(1, mockToken);

      expect(result).toEqual({ error: "Your account is frozen. Please contact support." });
    });

    it("should return error on network failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await FetchData.cancelAsCleaner(1, mockToken);

      expect(result).toEqual({ error: "Failed to cancel job" });
    });
  });
});
