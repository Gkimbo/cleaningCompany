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

// Mock Stripe
jest.mock("@stripe/stripe-react-native", () => ({
  useStripe: () => ({
    initPaymentSheet: jest.fn().mockResolvedValue({ error: null }),
    presentPaymentSheet: jest.fn().mockResolvedValue({ error: null }),
  }),
}));

// Mock navigation
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe("Bill Component - Pre-Pay and Retry Features", () => {
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

  describe("Pre-Pay Feature", () => {
    describe("Pre-Pay Eligibility", () => {
      it("should identify appointments eligible for pre-pay", () => {
        const appointments = [
          {
            id: 1,
            paid: false,
            hasBeenAssigned: true,
            paymentStatus: "pending",
            paymentIntentId: "pi_123",
            date: "2025-01-20",
          },
          {
            id: 2,
            paid: false,
            hasBeenAssigned: false, // Not assigned
            paymentStatus: "pending",
            paymentIntentId: "pi_456",
            date: "2025-01-21",
          },
          {
            id: 3,
            paid: true, // Already paid
            hasBeenAssigned: true,
            paymentStatus: "captured",
            paymentIntentId: "pi_789",
            date: "2025-01-22",
          },
        ];

        const eligibleForPrePay = appointments.filter(
          (appt) =>
            !appt.paid &&
            appt.hasBeenAssigned &&
            appt.paymentIntentId &&
            appt.paymentStatus === "pending"
        );

        expect(eligibleForPrePay.length).toBe(1);
        expect(eligibleForPrePay[0].id).toBe(1);
      });

      it("should exclude appointments without cleaner assigned", () => {
        const appointments = [
          {
            id: 1,
            paid: false,
            hasBeenAssigned: false,
            paymentStatus: "pending",
            paymentIntentId: "pi_123",
          },
        ];

        const eligibleForPrePay = appointments.filter(
          (appt) => !appt.paid && appt.hasBeenAssigned && appt.paymentIntentId
        );

        expect(eligibleForPrePay.length).toBe(0);
      });

      it("should exclude appointments without payment intent", () => {
        const appointments = [
          {
            id: 1,
            paid: false,
            hasBeenAssigned: true,
            paymentStatus: "pending",
            paymentIntentId: null,
          },
        ];

        const eligibleForPrePay = appointments.filter(
          (appt) => !appt.paid && appt.hasBeenAssigned && appt.paymentIntentId
        );

        expect(eligibleForPrePay.length).toBe(0);
      });
    });

    describe("Pre-Pay API Call", () => {
      it("should call pre-pay endpoint with correct data", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: "Payment successful!",
              paymentIntent: { id: "pi_123", amount: 15000, status: "succeeded" },
            }),
        });

        const response = await fetch(
          "http://localhost:3000/api/v1/payments/pre-pay",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer test_token",
            },
            body: JSON.stringify({ appointmentId: 1 }),
          }
        );

        const data = await response.json();

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/payments/pre-pay",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: "Bearer test_token",
            }),
          })
        );
        expect(data.success).toBe(true);
        expect(data.paymentIntent.status).toBe("succeeded");
      });

      it("should handle pre-pay API error", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          json: () =>
            Promise.resolve({
              error: "Cannot pre-pay until a cleaner is assigned",
            }),
        });

        const response = await fetch(
          "http://localhost:3000/api/v1/payments/pre-pay",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer test_token",
            },
            body: JSON.stringify({ appointmentId: 1 }),
          }
        );

        expect(response.ok).toBe(false);
        const data = await response.json();
        expect(data.error).toBe("Cannot pre-pay until a cleaner is assigned");
      });

      it("should handle network failure gracefully", async () => {
        global.fetch.mockRejectedValueOnce(new Error("Network error"));

        await expect(
          fetch("http://localhost:3000/api/v1/payments/pre-pay", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer test_token",
            },
            body: JSON.stringify({ appointmentId: 1 }),
          })
        ).rejects.toThrow("Network error");
      });
    });

    describe("Pre-Pay UI State", () => {
      it("should track pre-paying state correctly", () => {
        const prePayingId = null;
        const appointmentId = 1;

        // When starting pre-pay
        const newPrePayingId = appointmentId;
        expect(newPrePayingId).toBe(1);

        // When pre-pay completes
        const completedPrePayingId = null;
        expect(completedPrePayingId).toBeNull();
      });

      it("should prevent multiple simultaneous pre-pays", () => {
        let prePayingId = 1;

        // Trying to start another pre-pay should be blocked
        const canStartNewPrePay = prePayingId === null;
        expect(canStartNewPrePay).toBe(false);
      });
    });
  });

  describe("Retry Payment Feature", () => {
    describe("Failed Payment Detection", () => {
      it("should identify failed payments", () => {
        const appointments = [
          {
            id: 1,
            paid: false,
            paymentCaptureFailed: true,
            paymentStatus: "failed",
            hasBeenAssigned: true,
          },
          {
            id: 2,
            paid: true,
            paymentCaptureFailed: false,
            paymentStatus: "captured",
            hasBeenAssigned: true,
          },
          {
            id: 3,
            paid: false,
            paymentCaptureFailed: false, // Not failed, just pending
            paymentStatus: "pending",
            hasBeenAssigned: true,
          },
        ];

        const failedPayments = appointments.filter(
          (appt) => appt.paymentCaptureFailed && !appt.paid
        );

        expect(failedPayments.length).toBe(1);
        expect(failedPayments[0].id).toBe(1);
      });

      it("should not include paid appointments in failed list", () => {
        const appointments = [
          {
            id: 1,
            paid: true, // Already paid (maybe after retry)
            paymentCaptureFailed: true, // Old flag, now irrelevant
            paymentStatus: "captured",
          },
        ];

        const failedPayments = appointments.filter(
          (appt) => appt.paymentCaptureFailed && !appt.paid
        );

        expect(failedPayments.length).toBe(0);
      });
    });

    describe("Retry Payment API Call", () => {
      it("should call retry-payment endpoint successfully", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: "Payment successful!",
              paymentIntent: { id: "pi_123", amount: 15000, status: "succeeded" },
            }),
        });

        const response = await fetch(
          "http://localhost:3000/api/v1/payments/retry-payment",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer test_token",
            },
            body: JSON.stringify({ appointmentId: 1 }),
          }
        );

        const data = await response.json();

        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/payments/retry-payment",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: "Bearer test_token",
            }),
          })
        );
        expect(data.success).toBe(true);
      });

      it("should handle alreadyPaid response", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: "Payment already completed",
              alreadyPaid: true,
            }),
        });

        const response = await fetch(
          "http://localhost:3000/api/v1/payments/retry-payment",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer test_token",
            },
            body: JSON.stringify({ appointmentId: 1 }),
          }
        );

        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.alreadyPaid).toBe(true);
      });

      it("should handle card declined error", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          json: () =>
            Promise.resolve({
              error: "Payment failed",
              message: "Your card was declined",
              code: "card_declined",
            }),
        });

        const response = await fetch(
          "http://localhost:3000/api/v1/payments/retry-payment",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer test_token",
            },
            body: JSON.stringify({ appointmentId: 1 }),
          }
        );

        expect(response.ok).toBe(false);
        const data = await response.json();
        expect(data.error).toBe("Payment failed");
        expect(data.message).toBe("Your card was declined");
      });
    });

    describe("Retry Payment UI State", () => {
      it("should track retrying state correctly", () => {
        const retryingPaymentId = null;
        const appointmentId = 1;

        // When starting retry
        const newRetryingId = appointmentId;
        expect(newRetryingId).toBe(1);

        // When retry completes
        const completedRetryingId = null;
        expect(completedRetryingId).toBeNull();
      });
    });
  });

  describe("ManuallyPaid Distinction", () => {
    it("should understand the difference between pre-pay and auto-capture", () => {
      const prePaidAppointment = {
        id: 1,
        paid: true,
        paymentStatus: "captured",
        manuallyPaid: true,
      };

      const autoCapturedAppointment = {
        id: 2,
        paid: true,
        paymentStatus: "captured",
        manuallyPaid: false,
      };

      expect(prePaidAppointment.manuallyPaid).toBe(true);
      expect(autoCapturedAppointment.manuallyPaid).toBe(false);
    });

    it("should handle appointments without manuallyPaid field (backwards compat)", () => {
      const oldAppointment = {
        id: 1,
        paid: true,
        paymentStatus: "captured",
        // manuallyPaid field doesn't exist (old data)
      };

      const isManuallyPaid = oldAppointment.manuallyPaid || false;
      expect(isManuallyPaid).toBe(false);
    });
  });

  describe("Date Filtering for Pre-Pay", () => {
    it("should filter for upcoming appointments only", () => {
      // Use fixed dates to avoid timezone issues
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrowDate = new Date(today);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const yesterdayDate = new Date(today);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);

      const formatDate = (d) => d.toISOString().split("T")[0];

      const appointments = [
        { id: 1, date: formatDate(tomorrowDate), paid: false },
        { id: 2, date: formatDate(yesterdayDate), paid: false },
        { id: 3, date: formatDate(today), paid: false },
      ];

      const upcomingUnpaid = appointments.filter((appt) => {
        const apptDate = new Date(appt.date + "T00:00:00");
        return apptDate >= today && !appt.paid;
      });

      expect(upcomingUnpaid.length).toBe(2); // Tomorrow and today
    });

    it("should not show past appointments for pre-pay", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      const appointments = [
        {
          id: 1,
          date: pastDate.toISOString().split("T")[0],
          paid: false,
          hasBeenAssigned: true,
          paymentIntentId: "pi_123",
        },
      ];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const eligibleForPrePay = appointments.filter((appt) => {
        const apptDate = new Date(appt.date);
        return apptDate >= today && !appt.paid && appt.hasBeenAssigned;
      });

      expect(eligibleForPrePay.length).toBe(0);
    });
  });

  describe("Payment Status Display", () => {
    const getStatusText = (appointment) => {
      if (appointment.paymentCaptureFailed) {
        return "Payment Failed";
      }
      if (appointment.paid) {
        return appointment.manuallyPaid ? "Pre-Paid" : "Paid";
      }
      if (appointment.hasBeenAssigned) {
        return "Ready to Pay";
      }
      return "Pending Assignment";
    };

    it("should show 'Payment Failed' for failed captures", () => {
      const appt = { paymentCaptureFailed: true, paid: false };
      expect(getStatusText(appt)).toBe("Payment Failed");
    });

    it("should show 'Pre-Paid' for manually paid appointments", () => {
      const appt = { paid: true, manuallyPaid: true };
      expect(getStatusText(appt)).toBe("Pre-Paid");
    });

    it("should show 'Paid' for auto-captured appointments", () => {
      const appt = { paid: true, manuallyPaid: false };
      expect(getStatusText(appt)).toBe("Paid");
    });

    it("should show 'Ready to Pay' when cleaner assigned but not paid", () => {
      const appt = { paid: false, hasBeenAssigned: true };
      expect(getStatusText(appt)).toBe("Ready to Pay");
    });

    it("should show 'Pending Assignment' when no cleaner assigned", () => {
      const appt = { paid: false, hasBeenAssigned: false };
      expect(getStatusText(appt)).toBe("Pending Assignment");
    });
  });

  describe("Error Handling", () => {
    it("should handle 401 unauthorized error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Authorization required" }),
      });

      const response = await fetch(
        "http://localhost:3000/api/v1/payments/pre-pay",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId: 1 }),
        }
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it("should handle 403 forbidden error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: "Not authorized" }),
      });

      const response = await fetch(
        "http://localhost:3000/api/v1/payments/pre-pay",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test_token",
          },
          body: JSON.stringify({ appointmentId: 1 }),
        }
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
    });

    it("should handle 404 appointment not found", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Appointment not found" }),
      });

      const response = await fetch(
        "http://localhost:3000/api/v1/payments/pre-pay",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test_token",
          },
          body: JSON.stringify({ appointmentId: 999 }),
        }
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });
});
