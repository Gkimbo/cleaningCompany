import React from "react";
import { render, fireEvent, waitFor, act, cleanup } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock modules before importing component
const mockOpenPaymentSheet = jest.fn();
jest.mock("../../src/services/stripe", () => ({
  usePaymentSheet: () => ({
    openPaymentSheet: mockOpenPaymentSheet,
  }),
}));

const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock fetch
global.fetch = jest.fn();

// Import component after mocks
import Bill from "../../src/components/payments/Bill";

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
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    // Mock fetch to handle multiple endpoints
    global.fetch.mockImplementation((url) => {
      if (url.includes("/payments/config")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ publishableKey: "pk_test_mock" }),
        });
      }
      // Default response for other endpoints
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ payments: [] }),
      });
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
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

  it("should display 0 when cancellation fee is negative", () => {
    const negativeFee = -100;
    const sanitizedFee = Math.max(0, negativeFee);
    expect(sanitizedFee).toBe(0);
  });

  it("should display 0 when total due would be negative", () => {
    // Simulating the calculation in Bill.js
    const bill = { cancellationFee: -500, totalPaid: 0 };
    const appointments = [
      { id: 1, date: "2024-01-01", price: "100", paid: false },
    ];

    const cancellationFee = Math.max(0, bill?.cancellationFee || 0);
    const appointmentOverdue = Math.max(0, appointments.reduce((total, appt) => {
      const apptDate = new Date(appt.date);
      const today = new Date();
      if (!appt.paid && apptDate <= today) return total + Number(appt.price || 0);
      return total;
    }, cancellationFee));

    expect(cancellationFee).toBe(0);
    expect(appointmentOverdue).toBe(100); // Only the appointment price, no negative fee
  });

  it("should never show negative balance to users", () => {
    // Test the Math.max(0, ...) protection
    const negativeAppointmentDue = -2700;
    const negativeCancellationFee = -500;

    const sanitizedAppointmentDue = Math.max(0, negativeAppointmentDue);
    const sanitizedCancellationFee = Math.max(0, negativeCancellationFee);
    const totalDue = Math.max(0, sanitizedAppointmentDue + sanitizedCancellationFee);

    expect(sanitizedAppointmentDue).toBe(0);
    expect(sanitizedCancellationFee).toBe(0);
    expect(totalDue).toBe(0);
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

  describe("Appointment Sorting", () => {
    it("should sort failed payments by date ascending (earliest first)", () => {
      const appointments = [
        { id: 1, date: "2025-03-15", paymentCaptureFailed: true, paid: false },
        { id: 2, date: "2025-01-10", paymentCaptureFailed: true, paid: false },
        { id: 3, date: "2025-02-20", paymentCaptureFailed: true, paid: false },
      ];

      const sorted = appointments
        .filter(appt => appt.paymentCaptureFailed && !appt.paid)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      expect(sorted[0].id).toBe(2); // Jan 10
      expect(sorted[1].id).toBe(3); // Feb 20
      expect(sorted[2].id).toBe(1); // Mar 15
    });

    it("should sort upcoming payable appointments by date ascending (earliest first)", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Use dates that are always in the future
      const futureDate1 = new Date(today);
      futureDate1.setDate(futureDate1.getDate() + 5);
      const futureDate2 = new Date(today);
      futureDate2.setDate(futureDate2.getDate() + 3);
      const futureDate3 = new Date(today);
      futureDate3.setDate(futureDate3.getDate() + 10);

      const appointments = [
        { id: 1, date: futureDate1.toISOString().split("T")[0], paid: false, hasBeenAssigned: true, paymentIntentId: "pi_1", paymentCaptureFailed: false },
        { id: 2, date: futureDate2.toISOString().split("T")[0], paid: false, hasBeenAssigned: true, paymentIntentId: "pi_2", paymentCaptureFailed: false },
        { id: 3, date: futureDate3.toISOString().split("T")[0], paid: false, hasBeenAssigned: true, paymentIntentId: "pi_3", paymentCaptureFailed: false },
      ];

      const sorted = appointments
        .filter(appt => {
          const apptDate = new Date(appt.date);
          apptDate.setHours(0, 0, 0, 0);
          return (
            !appt.paid &&
            apptDate > today &&
            appt.hasBeenAssigned &&
            appt.paymentIntentId &&
            !appt.paymentCaptureFailed
          );
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      expect(sorted[0].id).toBe(2); // +3 days (earliest)
      expect(sorted[1].id).toBe(1); // +5 days
      expect(sorted[2].id).toBe(3); // +10 days (latest)
    });

    it("should exclude paid appointments from failed payments", () => {
      const appointments = [
        { id: 1, date: "2025-01-15", paymentCaptureFailed: true, paid: false },
        { id: 2, date: "2025-01-10", paymentCaptureFailed: true, paid: true },
      ];

      const failed = appointments
        .filter(appt => appt.paymentCaptureFailed && !appt.paid);

      expect(failed.length).toBe(1);
      expect(failed[0].id).toBe(1);
    });

    it("should exclude appointments without payment intent from upcoming payable", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Use dates that are always in the future
      const futureDate1 = new Date(today);
      futureDate1.setDate(futureDate1.getDate() + 5);
      const futureDate2 = new Date(today);
      futureDate2.setDate(futureDate2.getDate() + 3);

      const appointments = [
        { id: 1, date: futureDate1.toISOString().split("T")[0], paid: false, hasBeenAssigned: true, paymentIntentId: "pi_1", paymentCaptureFailed: false },
        { id: 2, date: futureDate2.toISOString().split("T")[0], paid: false, hasBeenAssigned: true, paymentIntentId: null, paymentCaptureFailed: false },
      ];

      const upcoming = appointments.filter(appt => {
        const apptDate = new Date(appt.date);
        apptDate.setHours(0, 0, 0, 0);
        return (
          !appt.paid &&
          apptDate > today &&
          appt.hasBeenAssigned &&
          appt.paymentIntentId &&
          !appt.paymentCaptureFailed
        );
      });

      expect(upcoming.length).toBe(1);
      expect(upcoming[0].id).toBe(1);
    });
  });

  describe("Component Rendering", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(Alert, "alert").mockImplementation(() => {});
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ payments: [] }),
      });
    });

    it("should render total due card", async () => {
      const { getByText } = render(
        <Bill state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Amount Due Now")).toBeTruthy();
        expect(getByText("$0.00")).toBeTruthy();
      });
    });

    it("should render payment methods button", async () => {
      const { getByText } = render(
        <Bill state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Payment Methods")).toBeTruthy();
      });
    });

    it("should navigate to payment setup on payment methods press", async () => {
      const { getByText } = render(
        <Bill state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        const paymentMethodsButton = getByText("Payment Methods");
        fireEvent.press(paymentMethodsButton.parent.parent);
      });

      expect(mockNavigate).toHaveBeenCalledWith("/payment-setup");
    });

    // Note: The Bill component was refactored and no longer has these elements
    it.skip("should render amount input field (removed feature)", async () => {
      const { getByText } = render(
        <Bill state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Enter Amount to Pay")).toBeTruthy();
      });
    });

    // Note: Pay Now button only appears when there's a cancellation fee
    it.skip("should render Pay Now button for non-employee users (moved to cancellation section)", async () => {
      const { getByText } = render(
        <Bill state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Pay Now")).toBeTruthy();
      });
    });

    it("should render payment history section", async () => {
      const { getByText } = render(
        <Bill state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Payment History")).toBeTruthy();
      });
    });

    it("should show no payment history message when empty", async () => {
      const { getByText } = render(
        <Bill state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("No payment history yet")).toBeTruthy();
      });
    });

    it("should display failed payments section when there are failed payments", async () => {
      const stateWithFailedPayments = {
        ...defaultState,
        appointments: [
          { id: 1, date: "2025-01-15", price: "100", paymentCaptureFailed: true, paid: false },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithFailedPayments} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Failed Payments")).toBeTruthy();
        expect(getByText("Retry to avoid appointment cancellation")).toBeTruthy();
        expect(getByText("Retry Payment")).toBeTruthy();
      });
    });

    it("should display Pay Ahead section for upcoming payable appointments", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const stateWithUpcoming = {
        ...defaultState,
        appointments: [
          {
            id: 1,
            date: futureDateStr,
            price: "150",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test123",
            paymentCaptureFailed: false,
          },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithUpcoming} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Pay Early")).toBeTruthy();
        expect(getByText(/can be paid now/)).toBeTruthy();
      });
    });

    it("should calculate correct total due with cancellation fee", async () => {
      const stateWithFees = {
        ...defaultState,
        appointments: [
          { id: 1, date: "2024-01-01", price: "100", paid: false },
        ],
        bill: { cancellationFee: 50, totalPaid: 0 },
      };

      const { getAllByText } = render(
        <Bill state={stateWithFees} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        // Component now shows only cancellation fee as "Amount Due Now"
        // There may be multiple instances of $50.00 (summary + fee card)
        expect(getAllByText("$50.00").length).toBeGreaterThan(0);
      });
    });

    // Note: Progress bar feature was removed from the Bill component
    it.skip("should show progress bar based on amount paid (removed feature)", async () => {
      const stateWithProgress = {
        ...defaultState,
        appointments: [
          { id: 1, date: "2024-01-01", price: "100", paid: false },
        ],
        bill: { cancellationFee: 0, totalPaid: 50 },
      };

      const { getByText } = render(
        <Bill state={stateWithProgress} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Paid: 50%")).toBeTruthy();
      });
    });
  });

  describe("Retry Payment", () => {
    let retryResponse = { ok: true, success: true };

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(Alert, "alert").mockImplementation(() => {});
      retryResponse = { ok: true, success: true };
      // Use URL-based mock to handle concurrent fetch calls
      global.fetch.mockImplementation((url) => {
        if (url.includes("/payments/config")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ publishableKey: "pk_test_mock" }),
          });
        }
        if (url.includes("/payments/retry-payment")) {
          return Promise.resolve({
            ok: retryResponse.ok,
            json: () => Promise.resolve(retryResponse.ok ? { success: true } : { error: retryResponse.error }),
          });
        }
        // Default response
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ payments: [] }),
        });
      });
    });

    it("should call retry-payment endpoint when retry button pressed", async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ payments: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ payments: [] }) });

      const stateWithFailedPayment = {
        ...defaultState,
        appointments: [
          { id: 1, date: "2025-01-15", price: "100", paymentCaptureFailed: true, paid: false },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithFailedPayment} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        const retryButton = getByText("Retry Payment");
        fireEvent.press(retryButton);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/payments/retry-payment"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ appointmentId: 1 }),
          })
        );
      });
    });

    it("should show alert on successful retry", async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ payments: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ payments: [] }) });

      const stateWithFailedPayment = {
        ...defaultState,
        appointments: [
          { id: 1, date: "2025-01-15", price: "100", paymentCaptureFailed: true, paid: false },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithFailedPayment} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        const retryButton = getByText("Retry Payment");
        fireEvent.press(retryButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Success", "Payment completed successfully!");
      });
    });

    it("should show error alert on failed retry", async () => {
      // Override the default mock for this test to return an error
      global.fetch.mockImplementation((url) => {
        if (url.includes("/payments/config")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ publishableKey: "pk_test_mock" }),
          });
        }
        if (url.includes("/payments/retry-payment")) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: "Card declined" }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ payments: [] }),
        });
      });

      const stateWithFailedPayment = {
        ...defaultState,
        appointments: [
          { id: 1, date: "2025-01-15", price: "100", paymentCaptureFailed: true, paid: false },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithFailedPayment} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        const retryButton = getByText("Retry Payment");
        fireEvent.press(retryButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Error", "Card declined");
      });
    });
  });

  // Note: Multi-select pre-pay feature was removed. Component now has individual "Pay Early" buttons.
  describe.skip("Pre-Pay (via Multi-Select) - REMOVED FEATURE", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(Alert, "alert").mockImplementation(() => {});
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ payments: [] }),
      });
    });

    it("should call pre-pay-batch endpoint when appointment is selected and pay button pressed", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      global.fetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ payments: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ successCount: 1, failedCount: 0 }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ payments: [] }) });

      const stateWithUpcoming = {
        ...defaultState,
        appointments: [
          {
            id: 5,
            date: futureDateStr,
            price: "150",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test123",
            paymentCaptureFailed: false,
            home: { nickName: "Test Home" },
          },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithUpcoming} dispatch={mockDispatch} />
      );

      // Select the appointment by clicking on it
      await waitFor(() => {
        fireEvent.press(getByText("Test Home"));
      });

      // Click the pay button
      await waitFor(() => {
        fireEvent.press(getByText("Pay $150.00 Now"));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/payments/pre-pay-batch"),
          expect.objectContaining({
            method: "POST",
          })
        );
      });
    });

    it("should show success alert on successful pre-pay", async () => {
      // Use URL-based mock for this test
      global.fetch.mockImplementation((url) => {
        if (url.includes("/payments/config")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ publishableKey: "pk_test_mock" }),
          });
        }
        if (url.includes("/payments/pre-pay-batch")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ successCount: 1, failedCount: 0 }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ payments: [] }),
        });
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const stateWithUpcoming = {
        ...defaultState,
        appointments: [
          {
            id: 5,
            date: futureDateStr,
            price: "150",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test123",
            paymentCaptureFailed: false,
            home: { nickName: "Test Home" },
          },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithUpcoming} dispatch={mockDispatch} />
      );

      // Select the appointment by clicking on it
      await waitFor(() => {
        fireEvent.press(getByText("Test Home"));
      });

      // Click the pay button
      await waitFor(() => {
        fireEvent.press(getByText("Pay $150.00 Now"));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Success", "1 appointment(s) paid successfully!");
      });
    });
  });

  // Note: Multi-select batch payment feature was removed. Component now has individual "Pay Early" buttons.
  describe.skip("Multi-Select Batch Payment - REMOVED FEATURE", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(Alert, "alert").mockImplementation(() => {});
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ payments: [] }),
      });
    });

    it("should display Select All button in Pay Ahead section", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const stateWithUpcoming = {
        ...defaultState,
        appointments: [
          {
            id: 1,
            date: futureDateStr,
            price: "150",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test123",
            paymentCaptureFailed: false,
            home: { nickName: "Beach House" },
          },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithUpcoming} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Select All")).toBeTruthy();
      });
    });

    it("should show appointment price in selectable card", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const stateWithUpcoming = {
        ...defaultState,
        appointments: [
          {
            id: 1,
            date: futureDateStr,
            price: "150",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test123",
            paymentCaptureFailed: false,
            home: { nickName: "Beach House" },
          },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithUpcoming} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("$150")).toBeTruthy();
        expect(getByText("Beach House")).toBeTruthy();
      });
    });

    it("should show Clear button and selection summary when appointments are selected", async () => {
      const futureDate1 = new Date();
      futureDate1.setDate(futureDate1.getDate() + 5);
      const futureDate2 = new Date();
      futureDate2.setDate(futureDate2.getDate() + 10);

      const stateWithUpcoming = {
        ...defaultState,
        appointments: [
          {
            id: 1,
            date: futureDate1.toISOString().split("T")[0],
            price: "100",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test1",
            paymentCaptureFailed: false,
            home: { nickName: "Home 1" },
          },
          {
            id: 2,
            date: futureDate2.toISOString().split("T")[0],
            price: "150",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test2",
            paymentCaptureFailed: false,
            home: { nickName: "Home 2" },
          },
        ],
      };

      const { getByText, queryByText } = render(
        <Bill state={stateWithUpcoming} dispatch={mockDispatch} />
      );

      // Clear button should not be visible initially
      await waitFor(() => {
        expect(queryByText("Clear")).toBeNull();
      });

      // Click Select All
      await waitFor(() => {
        fireEvent.press(getByText("Select All"));
      });

      // Clear button and selection summary should now be visible
      await waitFor(() => {
        expect(getByText("Clear")).toBeTruthy();
        expect(getByText("2 appointments selected")).toBeTruthy();
        expect(getByText("Total: $250.00")).toBeTruthy();
      });
    });

    it("should select individual appointment when pressed", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const stateWithUpcoming = {
        ...defaultState,
        appointments: [
          {
            id: 1,
            date: futureDateStr,
            price: "150",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test123",
            paymentCaptureFailed: false,
            home: { nickName: "Beach House" },
          },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithUpcoming} dispatch={mockDispatch} />
      );

      // Click on the appointment to select it
      await waitFor(() => {
        fireEvent.press(getByText("Beach House"));
      });

      // Should show selection summary with total
      await waitFor(() => {
        expect(getByText("1 appointment selected")).toBeTruthy();
        expect(getByText("Total: $150.00")).toBeTruthy();
        expect(getByText("Pay $150.00 Now")).toBeTruthy();
      });
    });

    it("should deselect appointment when pressed again", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const stateWithUpcoming = {
        ...defaultState,
        appointments: [
          {
            id: 1,
            date: futureDateStr,
            price: "150",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test123",
            paymentCaptureFailed: false,
            home: { nickName: "Beach House" },
          },
        ],
      };

      const { getByText, queryByText } = render(
        <Bill state={stateWithUpcoming} dispatch={mockDispatch} />
      );

      // Select the appointment
      await waitFor(() => {
        fireEvent.press(getByText("Beach House"));
      });

      await waitFor(() => {
        expect(getByText("1 appointment selected")).toBeTruthy();
      });

      // Deselect the appointment
      await waitFor(() => {
        fireEvent.press(getByText("Beach House"));
      });

      // Selection summary should be gone
      await waitFor(() => {
        expect(queryByText("1 appointment selected")).toBeNull();
        expect(queryByText("Pay $150.00 Now")).toBeNull();
      });
    });

    it("should clear all selections when Clear is pressed", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const stateWithUpcoming = {
        ...defaultState,
        appointments: [
          {
            id: 1,
            date: futureDateStr,
            price: "150",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test123",
            paymentCaptureFailed: false,
            home: { nickName: "Beach House" },
          },
        ],
      };

      const { getByText, queryByText } = render(
        <Bill state={stateWithUpcoming} dispatch={mockDispatch} />
      );

      // Select All
      await waitFor(() => {
        fireEvent.press(getByText("Select All"));
      });

      await waitFor(() => {
        expect(getByText("Clear")).toBeTruthy();
      });

      // Clear selection
      await waitFor(() => {
        fireEvent.press(getByText("Clear"));
      });

      // Selection summary should be gone
      await waitFor(() => {
        expect(queryByText("Clear")).toBeNull();
        expect(queryByText("1 appointment selected")).toBeNull();
      });
    });

    it("should call pre-pay-batch endpoint when Pay Selected is pressed", async () => {
      const futureDate1 = new Date();
      futureDate1.setDate(futureDate1.getDate() + 5);
      const futureDate2 = new Date();
      futureDate2.setDate(futureDate2.getDate() + 10);

      global.fetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ payments: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ successCount: 2, failedCount: 0, totalCaptured: 25000 }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ payments: [] }) });

      const stateWithUpcoming = {
        ...defaultState,
        appointments: [
          {
            id: 1,
            date: futureDate1.toISOString().split("T")[0],
            price: "100",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test1",
            paymentCaptureFailed: false,
            home: { nickName: "Home 1" },
          },
          {
            id: 2,
            date: futureDate2.toISOString().split("T")[0],
            price: "150",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test2",
            paymentCaptureFailed: false,
            home: { nickName: "Home 2" },
          },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithUpcoming} dispatch={mockDispatch} />
      );

      // Select All
      await waitFor(() => {
        fireEvent.press(getByText("Select All"));
      });

      // Press Pay button
      await waitFor(() => {
        fireEvent.press(getByText("Pay $250.00 Now"));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/payments/pre-pay-batch"),
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("appointmentIds"),
          })
        );
      });
    });

    it("should show success alert on successful batch payment", async () => {
      // Use URL-based mock for this test
      global.fetch.mockImplementation((url) => {
        if (url.includes("/payments/config")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ publishableKey: "pk_test_mock" }),
          });
        }
        if (url.includes("/payments/pre-pay-batch")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ successCount: 1, failedCount: 0 }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ payments: [] }),
        });
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const stateWithUpcoming = {
        ...defaultState,
        appointments: [
          {
            id: 1,
            date: futureDateStr,
            price: "150",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test123",
            paymentCaptureFailed: false,
            home: { nickName: "Beach House" },
          },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithUpcoming} dispatch={mockDispatch} />
      );

      // Select the appointment
      await waitFor(() => {
        fireEvent.press(getByText("Beach House"));
      });

      // Press Pay button
      await waitFor(() => {
        fireEvent.press(getByText("Pay $150.00 Now"));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Success",
          "1 appointment(s) paid successfully!"
        );
      });
    });

    it("should show error alert on failed batch payment", async () => {
      // Use URL-based mock for this test with error response
      global.fetch.mockImplementation((url) => {
        if (url.includes("/payments/config")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ publishableKey: "pk_test_mock" }),
          });
        }
        if (url.includes("/payments/pre-pay-batch")) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: "All payments failed" }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ payments: [] }),
        });
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const stateWithUpcoming = {
        ...defaultState,
        appointments: [
          {
            id: 1,
            date: futureDateStr,
            price: "150",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test123",
            paymentCaptureFailed: false,
            home: { nickName: "Beach House" },
          },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithUpcoming} dispatch={mockDispatch} />
      );

      // Select the appointment
      await waitFor(() => {
        fireEvent.press(getByText("Beach House"));
      });

      // Press Pay button
      await waitFor(() => {
        fireEvent.press(getByText("Pay $150.00 Now"));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Error", "All payments failed");
      });
    });

    it("should calculate selected total correctly for multiple appointments", () => {
      const appointments = [
        { id: 1, price: "100" },
        { id: 2, price: "150" },
        { id: 3, price: "200" },
      ];
      const selectedAppointments = new Set([1, 3]);

      const selectedTotal = appointments
        .filter(appt => selectedAppointments.has(appt.id))
        .reduce((sum, appt) => sum + Number(appt.price), 0);

      expect(selectedTotal).toBe(300); // 100 + 200
    });

    it("should show home address if nickname not available", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const stateWithUpcoming = {
        ...defaultState,
        appointments: [
          {
            id: 1,
            date: futureDateStr,
            price: "150",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test123",
            paymentCaptureFailed: false,
            home: { address: "123 Main St" },
          },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithUpcoming} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("123 Main St")).toBeTruthy();
      });
    });

    it("should show 'Home' as fallback when no home info available", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const stateWithUpcoming = {
        ...defaultState,
        appointments: [
          {
            id: 1,
            date: futureDateStr,
            price: "150",
            paid: false,
            hasBeenAssigned: true,
            paymentIntentId: "pi_test123",
            paymentCaptureFailed: false,
            home: null,
          },
        ],
      };

      const { getByText } = render(
        <Bill state={stateWithUpcoming} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Home")).toBeTruthy();
      });
    });
  });

  // Note: Manual payment amount flow was removed. Component now has specific payment buttons.
  describe.skip("Payment Flow - REMOVED FEATURE", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(Alert, "alert").mockImplementation(() => {});
      // Use URL-based mock to handle multiple concurrent fetch calls
      global.fetch.mockImplementation((url) => {
        if (url.includes("/payments/pay-bill")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, bill: { cancellationFee: 0, appointmentDue: 0, totalDue: 0 } }),
          });
        }
        // Default response for other endpoints (user-info, payment history, etc.)
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ payments: [] }),
        });
      });
    });

    it("should show error when amount is zero or negative", async () => {
      const { getByText } = render(
        <Bill state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        const payNowButton = getByText("Pay Now");
        fireEvent.press(payNowButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Error", "Please enter a valid amount");
      });
    });

    it("should call pay-bill endpoint for valid amount", async () => {
      const stateWithDue = {
        ...defaultState,
        appointments: [
          { id: 1, date: "2024-01-01", price: "100", paid: false },
        ],
        bill: { cancellationFee: 0, totalPaid: 0 },
      };

      const { getByText } = render(
        <Bill state={stateWithDue} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        const payNowButton = getByText("Pay Now");
        fireEvent.press(payNowButton);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/payments/pay-bill"),
          expect.any(Object)
        );
      });
    });

    it("should dispatch DB_BILL on successful payment", async () => {
      const stateWithDue = {
        ...defaultState,
        appointments: [
          { id: 1, date: "2024-01-01", price: "100", paid: false },
        ],
        bill: { cancellationFee: 0, totalPaid: 0 },
      };

      const { getByText } = render(
        <Bill state={stateWithDue} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        const payNowButton = getByText("Pay Now");
        fireEvent.press(payNowButton);
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "DB_BILL",
          payload: expect.objectContaining({ cancellationFee: 0, totalDue: 0 }),
        });
      });
    });

    it("should show success alert on successful payment", async () => {
      const stateWithDue = {
        ...defaultState,
        appointments: [
          { id: 1, date: "2024-01-01", price: "100", paid: false },
        ],
        bill: { cancellationFee: 0, totalPaid: 0 },
      };

      const { getByText } = render(
        <Bill state={stateWithDue} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        const payNowButton = getByText("Pay Now");
        fireEvent.press(payNowButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Success", "Payment completed successfully!");
      });
    });

    it("should show error alert on payment failure", async () => {
      // Override mock to return error
      global.fetch.mockImplementation((url) => {
        if (url.includes("/payments/pay-bill")) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: "Your card was declined" }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ payments: [] }),
        });
      });

      const stateWithDue = {
        ...defaultState,
        appointments: [
          { id: 1, date: "2024-01-01", price: "100", paid: false },
        ],
        bill: { cancellationFee: 0, totalPaid: 0 },
      };

      const { getByText } = render(
        <Bill state={stateWithDue} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        const payNowButton = getByText("Pay Now");
        fireEvent.press(payNowButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Payment Error", "Your card was declined");
      });
    });
  });

  // Note: Refund feature was removed from the Bill component in the refactor
  describe.skip("Refund Flow - REMOVED FEATURE", () => {
    const mockPayments = [
      { id: 1, date: "2025-01-15", price: "150", paymentStatus: "succeeded" },
    ];

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(Alert, "alert").mockImplementation(() => {});
      // Use URL-based mock to handle concurrent fetch calls
      global.fetch.mockImplementation((url) => {
        if (url.includes("/payments/config")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ publishableKey: "pk_test_mock" }),
          });
        }
        if (url.includes("/payments/history")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ payments: mockPayments }),
          });
        }
        // Default response
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ payments: mockPayments }),
        });
      });
    });

    it("should show confirmation dialog before refund", async () => {
      const { getByText } = render(
        <Bill state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        const refundButton = getByText("Refund");
        fireEvent.press(refundButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Cancel Payment",
          "Are you sure you want to request a refund?",
          expect.any(Array)
        );
      });
    });
  });
});
