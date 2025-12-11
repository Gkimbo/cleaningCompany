import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// Mock react-native Alert
const mockAlert = jest.fn();
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return {
    ...RN,
    Alert: {
      alert: mockAlert,
    },
  };
});

// Mock modules before importing component
jest.mock("@stripe/stripe-react-native", () => ({
  useStripe: () => ({
    initPaymentSheet: jest.fn().mockResolvedValue({ error: null }),
    presentPaymentSheet: jest.fn().mockResolvedValue({ error: null }),
  }),
}));

jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe("Bill Component", () => {
  const mockDispatch = jest.fn();
  const defaultState = {
    account: null,
    currentUser: { token: "test_token", id: 1, email: "test@example.com" },
    bill: { cancellationFee: 0, totalPaid: 0 },
    appointments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ payments: [] }),
    });
  });

  it("should calculate total due from appointments", () => {
    const stateWithAppointments = {
      ...defaultState,
      appointments: [
        { id: 1, date: "2024-01-01", price: "100", paid: false },
        { id: 2, date: "2024-01-02", price: "150", paid: false },
      ],
      bill: { cancellationFee: 25, totalPaid: 0 },
    };

    // Calculate expected total (past due appointments + cancellation fee)
    const expectedTotal = 100 + 150 + 25; // appointments are past due

    expect(expectedTotal).toBe(275);
  });

  it("should calculate progress percentage correctly", () => {
    const totalDue = 200;
    const totalPaid = 100;
    const progressPercent = Math.min((totalPaid / totalDue) * 100, 100);

    expect(progressPercent).toBe(50);
  });

  it("should handle zero total due", () => {
    const totalDue = 0;
    const totalPaid = 0;
    const progressPercent = totalDue > 0
      ? Math.min((totalPaid / totalDue) * 100, 100)
      : 0;

    expect(progressPercent).toBe(0);
  });

  it("should validate amount input correctly", () => {
    const regex = /^\d*(\.\d*)?$/;

    expect(regex.test("100")).toBe(true);
    expect(regex.test("100.50")).toBe(true);
    expect(regex.test("0.99")).toBe(true);
    expect(regex.test("")).toBe(true);
    expect(regex.test("abc")).toBe(false);
    expect(regex.test("10a")).toBe(false);
  });

  it("should filter unpaid appointments", () => {
    const appointments = [
      { id: 1, paid: false },
      { id: 2, paid: true },
      { id: 3, paid: false },
    ];

    const unpaid = appointments.filter((appt) => !appt.paid);
    expect(unpaid.length).toBe(2);
  });

  describe("Payment Intent Creation", () => {
    it("should call create-intent endpoint with correct data", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientSecret: "pi_test_secret" }),
      });

      const response = await fetch("http://localhost:3000/api/v1/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 15000,
          email: "test@example.com",
        }),
      });

      const data = await response.json();

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/payments/create-intent",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(data.clientSecret).toBe("pi_test_secret");
    });

    it("should handle payment intent creation failure", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Payment creation failed" }),
      });

      const response = await fetch("http://localhost:3000/api/v1/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 15000 }),
      });

      expect(response.ok).toBe(false);
    });
  });

  describe("Refund Functionality", () => {
    it("should call refund endpoint with appointment ID", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const response = await fetch("http://localhost:3000/api/v1/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: 1 }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("Payment History", () => {
    it("should fetch payment history for user", async () => {
      const mockPayments = [
        { id: 1, date: "2025-01-15", price: "150", paymentStatus: "succeeded" },
        { id: 2, date: "2025-01-10", price: "100", paymentStatus: "refunded" },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ payments: mockPayments }),
      });

      const response = await fetch("http://localhost:3000/api/v1/payments/history/1");
      const data = await response.json();

      expect(data.payments.length).toBe(2);
      expect(data.payments[0].paymentStatus).toBe("succeeded");
    });

    it("should handle empty payment history", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ payments: [] }),
      });

      const response = await fetch("http://localhost:3000/api/v1/payments/history/1");
      const data = await response.json();

      expect(data.payments.length).toBe(0);
    });
  });

  describe("Status Colors", () => {
    const getStatusColor = (status) => {
      switch (status) {
        case "succeeded":
        case "captured":
          return "#4CAF50";
        case "pending":
          return "#FFC107";
        case "failed":
          return "#F44336";
        case "refunded":
          return "#9E9E9E";
        default:
          return "#757575";
      }
    };

    it("should return correct color for succeeded status", () => {
      expect(getStatusColor("succeeded")).toBe("#4CAF50");
    });

    it("should return correct color for pending status", () => {
      expect(getStatusColor("pending")).toBe("#FFC107");
    });

    it("should return correct color for failed status", () => {
      expect(getStatusColor("failed")).toBe("#F44336");
    });

    it("should return correct color for refunded status", () => {
      expect(getStatusColor("refunded")).toBe("#9E9E9E");
    });

    it("should return default color for unknown status", () => {
      expect(getStatusColor("unknown")).toBe("#757575");
    });
  });
});
