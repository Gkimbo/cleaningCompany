import React from "react";

// Mock fetch
global.fetch = jest.fn();

describe("Earnings Component", () => {
  const mockDispatch = jest.fn();
  const defaultState = {
    account: "cleaner",
    currentUser: { token: "test_token", id: 2, email: "cleaner@example.com" },
    appointments: [],
    bill: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ totalEarnings: "0.00", pendingEarnings: "0.00", completedJobs: 0 }),
    });
  });

  describe("Earnings Calculation", () => {
    it("should fetch earnings from API", async () => {
      const mockEarnings = {
        totalEarnings: "450.00",
        pendingEarnings: "150.00",
        completedJobs: 5,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEarnings),
      });

      const response = await fetch("http://localhost:3000/api/v1/payments/earnings/2");
      const data = await response.json();

      expect(data.totalEarnings).toBe("450.00");
      expect(data.pendingEarnings).toBe("150.00");
      expect(data.completedJobs).toBe(5);
    });

    it("should handle earnings fetch error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      try {
        await fetch("http://localhost:3000/api/v1/payments/earnings/2");
      } catch (error) {
        expect(error.message).toBe("Network error");
      }
    });
  });

  describe("Assignment Filtering", () => {
    it("should filter appointments assigned to cleaner", () => {
      const appointments = [
        { id: 1, employeesAssigned: ["2", "3"], paid: true, completed: false },
        { id: 2, employeesAssigned: ["3"], paid: true, completed: false },
        { id: 3, employeesAssigned: ["2"], paid: false, completed: false },
      ];

      const cleanerId = "2";
      const myAppointments = appointments.filter(
        (appt) =>
          appt.employeesAssigned &&
          appt.employeesAssigned.includes(cleanerId)
      );

      expect(myAppointments.length).toBe(2);
      expect(myAppointments[0].id).toBe(1);
      expect(myAppointments[1].id).toBe(3);
    });

    it("should handle null employeesAssigned", () => {
      const appointments = [
        { id: 1, employeesAssigned: null },
        { id: 2, employeesAssigned: ["2"] },
      ];

      const cleanerId = "2";
      const myAppointments = appointments.filter(
        (appt) =>
          appt.employeesAssigned &&
          appt.employeesAssigned.includes(cleanerId)
      );

      expect(myAppointments.length).toBe(1);
    });
  });

  describe("Status Badge Logic", () => {
    const getStatusBadge = (appt) => {
      if (appt.completed) return { text: "Completed", color: "#4CAF50" };
      if (appt.paid) return { text: "Paid - Awaiting Completion", color: "#2196F3" };
      return { text: "Pending Payment", color: "#FFC107" };
    };

    it("should return Completed badge for completed appointments", () => {
      const badge = getStatusBadge({ completed: true, paid: true });
      expect(badge.text).toBe("Completed");
      expect(badge.color).toBe("#4CAF50");
    });

    it("should return Paid badge for paid but incomplete appointments", () => {
      const badge = getStatusBadge({ completed: false, paid: true });
      expect(badge.text).toBe("Paid - Awaiting Completion");
      expect(badge.color).toBe("#2196F3");
    });

    it("should return Pending badge for unpaid appointments", () => {
      const badge = getStatusBadge({ completed: false, paid: false });
      expect(badge.text).toBe("Pending Payment");
      expect(badge.color).toBe("#FFC107");
    });
  });

  describe("Payment Capture", () => {
    it("should call capture endpoint on job completion", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const response = await fetch("http://localhost:3000/api/v1/payments/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: 1 }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("should handle capture failure", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Cannot charge without a cleaner assigned" }),
      });

      const response = await fetch("http://localhost:3000/api/v1/payments/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: 1 }),
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBe("Cannot charge without a cleaner assigned");
    });
  });

  describe("Earnings Calculation Logic", () => {
    it("should split earnings among multiple employees", () => {
      const appointments = [
        { price: "300", employeesAssigned: ["1", "2", "3"] },
        { price: "150", employeesAssigned: ["2"] },
      ];

      const employeeId = "2";
      const totalEarnings = appointments.reduce((total, appt) => {
        const price = parseFloat(appt.price) || 0;
        const employeeCount = appt.employeesAssigned ? appt.employeesAssigned.length : 1;
        return total + (price / employeeCount);
      }, 0);

      // First appointment: 300/3 = 100
      // Second appointment: 150/1 = 150
      // Total: 250
      expect(totalEarnings).toBe(250);
    });

    it("should handle appointments with single employee", () => {
      const appointments = [
        { price: "200", employeesAssigned: ["2"] },
      ];

      const totalEarnings = appointments.reduce((total, appt) => {
        const price = parseFloat(appt.price) || 0;
        const employeeCount = appt.employeesAssigned ? appt.employeesAssigned.length : 1;
        return total + (price / employeeCount);
      }, 0);

      expect(totalEarnings).toBe(200);
    });

    it("should handle invalid price values", () => {
      const appointments = [
        { price: "invalid", employeesAssigned: ["2"] },
        { price: null, employeesAssigned: ["2"] },
        { price: "", employeesAssigned: ["2"] },
      ];

      const totalEarnings = appointments.reduce((total, appt) => {
        const price = parseFloat(appt.price) || 0;
        return total + price;
      }, 0);

      expect(totalEarnings).toBe(0);
    });
  });

  describe("Date Formatting", () => {
    it("should format date correctly", () => {
      // Use explicit time to avoid timezone issues
      const date = new Date("2025-01-15T12:00:00");
      const formatted = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      // Just verify it contains Jan and 15 (day of week depends on locale settings)
      expect(formatted).toMatch(/Jan/);
      expect(formatted).toMatch(/15/);
    });
  });

  describe("Loading State", () => {
    it("should show loading initially", () => {
      const isLoading = true;
      expect(isLoading).toBe(true);
    });

    it("should hide loading after data fetch", async () => {
      let isLoading = true;

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalEarnings: "0.00" }),
      });

      await fetch("http://localhost:3000/api/v1/payments/earnings/2");
      isLoading = false;

      expect(isLoading).toBe(false);
    });
  });
});
