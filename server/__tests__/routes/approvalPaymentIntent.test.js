/**
 * Tests for payment intent creation and capture during approval flow
 * This tests the logic that creates payment intents when missing during approval
 * and captures payments when the appointment is within 3 days
 */

// Mock Stripe before requiring modules
const mockStripePaymentIntentsCreate = jest.fn();
const mockStripePaymentIntentsCapture = jest.fn();
const mockStripeCustomersRetrieve = jest.fn();

jest.mock("stripe", () => {
  return jest.fn(() => ({
    paymentIntents: {
      create: mockStripePaymentIntentsCreate,
      capture: mockStripePaymentIntentsCapture,
    },
    customers: {
      retrieve: mockStripeCustomersRetrieve,
    },
  }));
});

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
  },
  UserPendingRequests: {
    findByPk: jest.fn(),
    destroy: jest.fn().mockResolvedValue(1),
  },
  UserCleanerAppointments: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
  },
  Payout: {
    findOne: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue([1]),
  },
  Payment: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    generateTransactionId: jest.fn(() => `txn_test_${Date.now()}`),
  },
}));

// Mock pricing config
jest.mock("../../config/businessConfig", () => ({
  getPricingConfig: jest.fn().mockResolvedValue({
    platform: { feePercent: 0.1 },
  }),
  businessConfig: {},
}));

const { User, UserAppointments, Payout } = require("../../models");
const { getPricingConfig } = require("../../config/businessConfig");

describe("Approval Flow - Payment Intent Creation and Capture", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStripePaymentIntentsCreate.mockResolvedValue({
      id: "pi_new_123",
      status: "succeeded",
      amount: 15000,
      amount_received: 15000,
      latest_charge: "ch_test_123",
      currency: "usd",
    });
    mockStripePaymentIntentsCapture.mockResolvedValue({
      id: "pi_existing_123",
      status: "succeeded",
      amount: 15000,
      amount_received: 15000,
      latest_charge: "ch_test_123",
      currency: "usd",
    });
    mockStripeCustomersRetrieve.mockResolvedValue({
      id: "cus_test_123",
      invoice_settings: {
        default_payment_method: "pm_test_123",
      },
    });
  });

  // Helper to create a date X days from now
  const daysFromNow = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  };

  // Simulate the approval flow logic for creating and capturing payment intents
  const processApprovalPayment = async (appointment, user) => {
    const stripe = require("stripe")();
    const pricing = await getPricingConfig();
    const platformConfig = pricing.platform;
    const result = { created: false, captured: false, error: null };

    const appointmentDate = new Date(appointment.date);
    const now = new Date();
    const diffInDays = (appointmentDate - now) / (1000 * 60 * 60 * 24);

    // Only process if within 3 days
    if (diffInDays > 3 || diffInDays < 0) {
      return result;
    }

    if (appointment.paymentStatus === "captured") {
      return result;
    }

    try {
      let capturedIntent;

      if (appointment.paymentIntentId) {
        // Existing payment intent - capture it
        capturedIntent = await stripe.paymentIntents.capture(appointment.paymentIntentId);
      } else {
        // No payment intent exists - create and capture in one step
        if (!user || !user.stripeCustomerId) {
          await appointment.update({ paymentCaptureFailed: true });
          result.error = "No Stripe customer";
          return result;
        }

        const customer = await stripe.customers.retrieve(user.stripeCustomerId);
        const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

        if (!defaultPaymentMethod) {
          await appointment.update({ paymentCaptureFailed: true });
          result.error = "No payment method";
          return result;
        }

        const priceInCents = Math.round(parseFloat(appointment.price) * 100);

        capturedIntent = await stripe.paymentIntents.create({
          amount: priceInCents,
          currency: "usd",
          customer: user.stripeCustomerId,
          payment_method: defaultPaymentMethod,
          confirm: true,
          off_session: true,
          metadata: {
            userId: appointment.userId,
            homeId: appointment.homeId,
            appointmentId: appointment.id,
          },
        });

        await appointment.update({ paymentIntentId: capturedIntent.id });
        result.created = true;
      }

      await appointment.update({
        paymentStatus: "captured",
        paid: true,
        amountPaid: capturedIntent.amount_received || capturedIntent.amount,
      });

      // Update payout records
      await Payout.update(
        { status: "held", paymentCapturedAt: new Date() },
        { where: { appointmentId: appointment.id } }
      );

      result.captured = true;
    } catch (err) {
      await appointment.update({ paymentCaptureFailed: true });
      result.error = err.message;
    }

    return result;
  };

  describe("Payment Intent Creation When Missing", () => {
    it("should create payment intent when approved within 3 days and no paymentIntentId exists", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        paymentIntentId: null,
        paymentStatus: "pending",
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = {
        id: 1,
        stripeCustomerId: "cus_test_123",
      };

      const result = await processApprovalPayment(mockAppointment, mockUser);

      expect(result.created).toBe(true);
      expect(result.captured).toBe(true);
      expect(mockStripeCustomersRetrieve).toHaveBeenCalledWith("cus_test_123");
      expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 15000,
          currency: "usd",
          customer: "cus_test_123",
          payment_method: "pm_test_123",
          confirm: true,
          off_session: true,
        })
      );
    });

    it("should capture existing payment intent when paymentIntentId exists", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        paymentIntentId: "pi_existing_123",
        paymentStatus: "pending",
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = { id: 1, stripeCustomerId: "cus_test_123" };

      const result = await processApprovalPayment(mockAppointment, mockUser);

      expect(result.created).toBe(false);
      expect(result.captured).toBe(true);
      expect(mockStripePaymentIntentsCreate).not.toHaveBeenCalled();
      expect(mockStripePaymentIntentsCapture).toHaveBeenCalledWith("pi_existing_123");
    });

    it("should save new payment intent ID to appointment", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        paymentIntentId: null,
        paymentStatus: "pending",
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = { id: 1, stripeCustomerId: "cus_test_123" };

      await processApprovalPayment(mockAppointment, mockUser);

      expect(mockAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({ paymentIntentId: "pi_new_123" })
      );
    });
  });

  describe("Date Filtering", () => {
    it("should capture payment for appointment 1 day away", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(1),
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const result = await processApprovalPayment(mockAppointment, {
        id: 1,
        stripeCustomerId: "cus_123",
      });

      expect(result.captured).toBe(true);
    });

    it("should capture payment for appointment 2 days away", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const result = await processApprovalPayment(mockAppointment, {
        id: 1,
        stripeCustomerId: "cus_123",
      });

      expect(result.captured).toBe(true);
    });

    it("should NOT capture payment for appointment more than 3 days away", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(5),
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const result = await processApprovalPayment(mockAppointment, {
        id: 1,
        stripeCustomerId: "cus_123",
      });

      expect(result.captured).toBe(false);
      expect(mockStripePaymentIntentsCapture).not.toHaveBeenCalled();
    });

    it("should NOT process past appointments", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const result = await processApprovalPayment(mockAppointment, {
        id: 1,
        stripeCustomerId: "cus_123",
      });

      expect(result.captured).toBe(false);
    });
  });

  describe("Skip Already Captured", () => {
    it("should skip if payment already captured", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        paymentIntentId: "pi_test_123",
        paymentStatus: "captured", // Already captured
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const result = await processApprovalPayment(mockAppointment, {
        id: 1,
        stripeCustomerId: "cus_123",
      });

      expect(result.captured).toBe(false);
      expect(mockStripePaymentIntentsCapture).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should mark as failed when no Stripe customer", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        paymentIntentId: null,
        paymentStatus: "pending",
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = { id: 1, stripeCustomerId: null };

      const result = await processApprovalPayment(mockAppointment, mockUser);

      expect(result.error).toBe("No Stripe customer");
      expect(mockAppointment.update).toHaveBeenCalledWith({ paymentCaptureFailed: true });
    });

    it("should mark as failed when no payment method on file", async () => {
      mockStripeCustomersRetrieve.mockResolvedValue({
        id: "cus_test_123",
        invoice_settings: {
          default_payment_method: null,
        },
      });

      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        paymentIntentId: null,
        paymentStatus: "pending",
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = { id: 1, stripeCustomerId: "cus_test_123" };

      const result = await processApprovalPayment(mockAppointment, mockUser);

      expect(result.error).toBe("No payment method");
      expect(mockAppointment.update).toHaveBeenCalledWith({ paymentCaptureFailed: true });
    });

    it("should mark as failed when Stripe capture fails", async () => {
      mockStripePaymentIntentsCapture.mockRejectedValue(new Error("Card declined"));

      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = { id: 1, stripeCustomerId: "cus_test_123" };

      const result = await processApprovalPayment(mockAppointment, mockUser);

      expect(result.error).toBe("Card declined");
      expect(result.captured).toBe(false);
      expect(mockAppointment.update).toHaveBeenCalledWith({ paymentCaptureFailed: true });
    });

    it("should mark as failed when payment intent creation fails", async () => {
      mockStripePaymentIntentsCreate.mockRejectedValue(new Error("Insufficient funds"));

      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        paymentIntentId: null,
        paymentStatus: "pending",
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = { id: 1, stripeCustomerId: "cus_test_123" };

      const result = await processApprovalPayment(mockAppointment, mockUser);

      expect(result.error).toBe("Insufficient funds");
      expect(result.captured).toBe(false);
      expect(mockAppointment.update).toHaveBeenCalledWith({ paymentCaptureFailed: true });
    });
  });

  describe("Payout Status Update", () => {
    it("should update payout records to held status after capture", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = { id: 1, stripeCustomerId: "cus_test_123" };

      await processApprovalPayment(mockAppointment, mockUser);

      expect(Payout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "held",
          paymentCapturedAt: expect.any(Date),
        }),
        { where: { appointmentId: 1 } }
      );
    });
  });

  describe("Amount Calculation", () => {
    it("should correctly calculate amount in cents", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        paymentIntentId: null,
        paymentStatus: "pending",
        price: "175.50", // Tests decimal handling
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = { id: 1, stripeCustomerId: "cus_test_123" };

      await processApprovalPayment(mockAppointment, mockUser);

      expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 17550, // $175.50 = 17550 cents
        })
      );
    });

    it("should handle string price values", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        paymentIntentId: null,
        paymentStatus: "pending",
        price: "200",
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = { id: 1, stripeCustomerId: "cus_test_123" };

      await processApprovalPayment(mockAppointment, mockUser);

      expect(mockStripePaymentIntentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 20000,
        })
      );
    });
  });

  describe("Appointment Update After Capture", () => {
    it("should update appointment with captured status and amount", async () => {
      mockStripePaymentIntentsCapture.mockResolvedValue({
        id: "pi_test_123",
        amount: 15000,
        amount_received: 15000,
      });

      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = { id: 1, stripeCustomerId: "cus_test_123" };

      await processApprovalPayment(mockAppointment, mockUser);

      expect(mockAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentStatus: "captured",
          paid: true,
          amountPaid: 15000,
        })
      );
    });

    it("should use amount_received when available", async () => {
      mockStripePaymentIntentsCreate.mockResolvedValue({
        id: "pi_new_123",
        amount: 15000,
        amount_received: 14500, // Different from amount (e.g., partial payment)
      });

      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        paymentIntentId: null,
        paymentStatus: "pending",
        price: "150.00",
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = { id: 1, stripeCustomerId: "cus_test_123" };

      await processApprovalPayment(mockAppointment, mockUser);

      expect(mockAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          amountPaid: 14500,
        })
      );
    });
  });
});
