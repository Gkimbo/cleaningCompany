/**
 * Tests for Bi-Weekly Payout Frontend Service Methods
 * Tests the BusinessEmployeeService and BusinessOwnerService payout methods
 */

// Mock fetch globally
global.fetch = jest.fn();

// Mock the config
jest.mock("../config", () => ({
  API_BASE: "http://test-api.com/api/v1",
}));

import BusinessEmployeeService from "../fetchRequests/BusinessEmployeeService";
import BusinessOwnerService from "../fetchRequests/BusinessOwnerService";

describe("Bi-Weekly Payout Frontend Services", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  // =============================================
  // BusinessEmployeeService.getPendingEarnings
  // =============================================
  describe("BusinessEmployeeService.getPendingEarnings", () => {
    it("should fetch pending earnings successfully", async () => {
      const mockResponse = {
        pendingAmount: 7500,
        nextPayoutDate: "2024-01-19",
        payouts: [
          { id: 1, amount: 4000, earnedAt: "2024-01-15" },
          { id: 2, amount: 3500, earnedAt: "2024-01-16" },
        ],
        formatted: { pendingAmount: "$75.00" },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await BusinessEmployeeService.getPendingEarnings("test-token");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://test-api.com/api/v1/business-employee/pending-earnings",
        expect.objectContaining({
          headers: {
            Authorization: "Bearer test-token",
          },
        })
      );
      expect(result.pendingAmount).toBe(7500);
      expect(result.payouts).toHaveLength(2);
    });

    it("should return default values on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessEmployeeService.getPendingEarnings("test-token");

      expect(result.pendingAmount).toBe(0);
      expect(result.payouts).toEqual([]);
    });

    it("should handle empty response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            pendingAmount: 0,
            nextPayoutDate: "2024-01-19",
            payouts: [],
            formatted: { pendingAmount: "$0.00" },
          }),
      });

      const result = await BusinessEmployeeService.getPendingEarnings("test-token");

      expect(result.pendingAmount).toBe(0);
      expect(result.payouts).toHaveLength(0);
    });
  });

  // =============================================
  // BusinessOwnerService.getPendingPayroll
  // =============================================
  describe("BusinessOwnerService.getPendingPayroll", () => {
    it("should fetch pending payroll successfully", async () => {
      const mockResponse = {
        totalPending: 12500,
        nextPayoutDate: "2024-01-19",
        byEmployee: [
          { employeeId: 10, firstName: "John", lastName: "Doe", amount: 7500 },
          { employeeId: 11, firstName: "Jane", lastName: "Smith", amount: 5000 },
        ],
        formatted: { totalPending: "$125.00" },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await BusinessOwnerService.getPendingPayroll("owner-token");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://test-api.com/api/v1/business-owner/payroll/pending",
        expect.objectContaining({
          headers: {
            Authorization: "Bearer owner-token",
          },
        })
      );
      expect(result.totalPending).toBe(12500);
      expect(result.byEmployee).toHaveLength(2);
    });

    it("should return default values on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessOwnerService.getPendingPayroll("owner-token");

      expect(result.totalPending).toBe(0);
      expect(result.byEmployee).toEqual([]);
    });

    it("should handle response with no employees", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            totalPending: 0,
            nextPayoutDate: "2024-01-19",
            byEmployee: [],
            formatted: { totalPending: "$0.00" },
          }),
      });

      const result = await BusinessOwnerService.getPendingPayroll("owner-token");

      expect(result.totalPending).toBe(0);
      expect(result.byEmployee).toHaveLength(0);
    });
  });

  // =============================================
  // BusinessOwnerService.triggerEarlyPayout
  // =============================================
  describe("BusinessOwnerService.triggerEarlyPayout", () => {
    it("should trigger early payout successfully", async () => {
      const mockResponse = {
        success: true,
        totalAmount: 7500,
        payoutCount: 2,
        formattedAmount: "$75.00",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await BusinessOwnerService.triggerEarlyPayout("owner-token", 10);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://test-api.com/api/v1/business-owner/payroll/early-payout/10",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer owner-token",
          },
        })
      );
      expect(result.success).toBe(true);
      expect(result.totalAmount).toBe(7500);
    });

    it("should handle employee not found error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Employee not found" }),
      });

      const result = await BusinessOwnerService.triggerEarlyPayout("owner-token", 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Employee not found");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await BusinessOwnerService.triggerEarlyPayout("owner-token", 10);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("should handle zero pending payouts", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            totalAmount: 0,
            payoutCount: 0,
            formattedAmount: "$0.00",
            message: "No pending payouts",
          }),
      });

      const result = await BusinessOwnerService.triggerEarlyPayout("owner-token", 10);

      expect(result.success).toBe(true);
      expect(result.totalAmount).toBe(0);
    });

    it("should handle Stripe error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({ error: "Stripe account not connected" }),
      });

      const result = await BusinessOwnerService.triggerEarlyPayout("owner-token", 10);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Stripe");
    });
  });

  // =============================================
  // Edge Cases
  // =============================================
  describe("Edge Cases", () => {
    it("should handle malformed JSON response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      const result = await BusinessEmployeeService.getPendingEarnings("test-token");

      expect(result.pendingAmount).toBe(0);
    });

    it("should handle 401 unauthorized", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      });

      const result = await BusinessOwnerService.getPendingPayroll("invalid-token");

      // Should still return default values, not throw
      expect(result).toBeDefined();
    });

    it("should handle 500 server error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Internal server error" }),
      });

      const result = await BusinessOwnerService.triggerEarlyPayout("owner-token", 10);

      expect(result.success).toBe(false);
    });

    it("should handle timeout", async () => {
      global.fetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 100)
          )
      );

      const result = await BusinessEmployeeService.getPendingEarnings("test-token");

      expect(result.pendingAmount).toBe(0);
    });
  });

  // =============================================
  // Data Formatting
  // =============================================
  describe("Data Formatting", () => {
    it("should correctly format amounts in response", async () => {
      const mockResponse = {
        pendingAmount: 12345,
        formatted: { pendingAmount: "$123.45" },
        payouts: [],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await BusinessEmployeeService.getPendingEarnings("test-token");

      expect(result.formatted.pendingAmount).toBe("$123.45");
    });

    it("should handle date strings in response", async () => {
      const mockResponse = {
        nextPayoutDate: "2024-01-19T00:00:00.000Z",
        pendingAmount: 5000,
        payouts: [],
        formatted: { pendingAmount: "$50.00" },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await BusinessEmployeeService.getPendingEarnings("test-token");

      expect(result.nextPayoutDate).toBe("2024-01-19T00:00:00.000Z");
    });
  });
});
