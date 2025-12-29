/**
 * Tests for the auto-capture payment intent creation logic
 * This tests the logic that runs as part of the daily cron job
 * to capture payments 3 days before appointments, including
 * creating payment intents when missing
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
    findAll: jest.fn(),
  },
  UserHomes: {
    findByPk: jest.fn(),
  },
  Payout: {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue([1]),
  },
  Payment: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    generateTransactionId: jest.fn(() => `txn_test_${Date.now()}`),
  },
}));

const { User, UserAppointments, UserHomes, Payout } = require("../../models");

describe("Auto-Capture Payment Intent Creation Logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStripePaymentIntentsCreate.mockResolvedValue({
      id: "pi_new_123",
      status: "succeeded",
      amount: 15000,
      amount_received: 15000,
      latest_charge: "ch_test_123",
    });
    mockStripePaymentIntentsCapture.mockResolvedValue({
      id: "pi_test_123",
      status: "succeeded",
      amount: 15000,
      amount_received: 15000,
      latest_charge: "ch_test_123",
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

  // The auto-capture logic extracted for testing
  const processAutoCapture = async () => {
    const now = new Date();
    const results = { captured: 0, created: 0, failed: 0, skipped: 0 };

    const appointments = await UserAppointments.findAll({
      where: {
        paymentStatus: "pending",
        paid: false,
      },
    });

    for (const appointment of appointments) {
      const appointmentDate = new Date(appointment.date);
      const diffInDays = Math.floor(
        (appointmentDate - now) / (1000 * 60 * 60 * 24)
      );

      // Only act 3 days before the appointment
      if (diffInDays <= 3 && diffInDays >= 0) {
        const user = await User.findByPk(appointment.userId);
        const home = await UserHomes.findByPk(appointment.homeId);
        if (!user || !home) {
          results.skipped++;
          continue;
        }

        if (appointment.hasBeenAssigned) {
          try {
            let paymentIntent;

            if (!appointment.paymentIntentId) {
              // No payment intent exists - create and capture a new one
              const stripe = require("stripe")();
              const customer = await stripe.customers.retrieve(user.stripeCustomerId);
              const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

              if (!defaultPaymentMethod) {
                await appointment.update({ paymentCaptureFailed: true });
                results.failed++;
                continue;
              }

              const priceInCents = Math.round(parseFloat(appointment.price) * 100);

              paymentIntent = await stripe.paymentIntents.create({
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

              await appointment.update({ paymentIntentId: paymentIntent.id });
              results.created++;
            } else {
              // Existing payment intent - capture it
              const stripe = require("stripe")();
              paymentIntent = await stripe.paymentIntents.capture(appointment.paymentIntentId);
            }

            await appointment.update({
              paymentStatus: "captured",
              paid: true,
              amountPaid: paymentIntent.amount_received || paymentIntent.amount,
            });
            results.captured++;

            // Update payout records
            const cleanerIds = appointment.employeesAssigned || [];
            for (const cleanerId of cleanerIds) {
              const payout = await Payout.findOne({
                where: { appointmentId: appointment.id, cleanerId },
              });
              if (payout) {
                await payout.update({
                  status: "held",
                  paymentCapturedAt: new Date(),
                });
              }
            }
          } catch (err) {
            await appointment.update({ paymentCaptureFailed: true });
            results.failed++;
          }
        } else {
          results.skipped++;
        }
      } else {
        results.skipped++;
      }
    }

    return results;
  };

  describe("Payment Intent Creation When Missing", () => {
    it("should create payment intent when cleaner is assigned but no paymentIntentId exists", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        hasBeenAssigned: true,
        paymentIntentId: null, // No payment intent
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: ["5"],
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = {
        id: 1,
        stripeCustomerId: "cus_test_123",
      };

      const mockHome = { id: 1 };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      Payout.findOne.mockResolvedValue({
        update: jest.fn().mockResolvedValue(true),
      });

      const results = await processAutoCapture();

      expect(results.created).toBe(1);
      expect(results.captured).toBe(1);
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
      expect(mockAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({ paymentIntentId: "pi_new_123" })
      );
    });

    it("should capture existing payment intent when paymentIntentId exists", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        hasBeenAssigned: true,
        paymentIntentId: "pi_existing_123",
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: ["5"],
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = { id: 1, stripeCustomerId: "cus_test_123" };
      const mockHome = { id: 1 };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);
      Payout.findOne.mockResolvedValue({
        update: jest.fn().mockResolvedValue(true),
      });

      const results = await processAutoCapture();

      expect(results.created).toBe(0);
      expect(results.captured).toBe(1);
      expect(mockStripePaymentIntentsCreate).not.toHaveBeenCalled();
      expect(mockStripePaymentIntentsCapture).toHaveBeenCalledWith("pi_existing_123");
    });

    it("should mark appointment as failed when no payment method on file", async () => {
      mockStripeCustomersRetrieve.mockResolvedValue({
        id: "cus_test_123",
        invoice_settings: {
          default_payment_method: null, // No payment method
        },
      });

      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        hasBeenAssigned: true,
        paymentIntentId: null,
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: ["5"],
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUser = { id: 1, stripeCustomerId: "cus_test_123" };
      const mockHome = { id: 1 };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(mockUser);
      UserHomes.findByPk.mockResolvedValue(mockHome);

      const results = await processAutoCapture();

      expect(results.failed).toBe(1);
      expect(mockAppointment.update).toHaveBeenCalledWith({ paymentCaptureFailed: true });
    });
  });

  describe("Date Filtering", () => {
    it("should capture payment for appointment 3 days away", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(3),
        hasBeenAssigned: true,
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: ["5"],
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({ id: 1, stripeCustomerId: "cus_123" });
      UserHomes.findByPk.mockResolvedValue({ id: 1 });
      Payout.findOne.mockResolvedValue({ update: jest.fn() });

      const results = await processAutoCapture();

      expect(results.captured).toBe(1);
    });

    it("should capture payment for appointment 2 days away", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        hasBeenAssigned: true,
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: ["5"],
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({ id: 1, stripeCustomerId: "cus_123" });
      UserHomes.findByPk.mockResolvedValue({ id: 1 });
      Payout.findOne.mockResolvedValue({ update: jest.fn() });

      const results = await processAutoCapture();

      expect(results.captured).toBe(1);
    });

    it("should capture payment for appointment 1 day away", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(1),
        hasBeenAssigned: true,
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: ["5"],
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({ id: 1, stripeCustomerId: "cus_123" });
      UserHomes.findByPk.mockResolvedValue({ id: 1 });
      Payout.findOne.mockResolvedValue({ update: jest.fn() });

      const results = await processAutoCapture();

      expect(results.captured).toBe(1);
    });

    it("should skip appointment more than 3 days away", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(5),
        hasBeenAssigned: true,
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: ["5"],
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const results = await processAutoCapture();

      expect(results.skipped).toBe(1);
      expect(results.captured).toBe(0);
    });

    it("should skip past appointments", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(-1),
        hasBeenAssigned: true,
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: ["5"],
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);

      const results = await processAutoCapture();

      expect(results.skipped).toBe(1);
      expect(results.captured).toBe(0);
    });
  });

  describe("Cleaner Assignment Check", () => {
    it("should skip appointments without cleaner assigned", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        hasBeenAssigned: false, // No cleaner assigned
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: [],
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({ id: 1, stripeCustomerId: "cus_123" });
      UserHomes.findByPk.mockResolvedValue({ id: 1 });

      const results = await processAutoCapture();

      expect(results.skipped).toBe(1);
      expect(results.captured).toBe(0);
      expect(mockStripePaymentIntentsCapture).not.toHaveBeenCalled();
    });
  });

  describe("Payout Status Update", () => {
    it("should update payout records to held status after capture", async () => {
      const mockPayoutUpdate = jest.fn().mockResolvedValue(true);
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        hasBeenAssigned: true,
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: ["5", "6"],
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({ id: 1, stripeCustomerId: "cus_123" });
      UserHomes.findByPk.mockResolvedValue({ id: 1 });
      Payout.findOne.mockResolvedValue({ update: mockPayoutUpdate });

      await processAutoCapture();

      // Should be called for each cleaner
      expect(Payout.findOne).toHaveBeenCalledTimes(2);
      expect(mockPayoutUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "held",
          paymentCapturedAt: expect.any(Date),
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should mark appointment as failed when stripe capture fails", async () => {
      mockStripePaymentIntentsCapture.mockRejectedValue(new Error("Stripe error"));

      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        hasBeenAssigned: true,
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: ["5"],
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({ id: 1, stripeCustomerId: "cus_123" });
      UserHomes.findByPk.mockResolvedValue({ id: 1 });

      const results = await processAutoCapture();

      expect(results.failed).toBe(1);
      expect(mockAppointment.update).toHaveBeenCalledWith({ paymentCaptureFailed: true });
    });

    it("should mark appointment as failed when payment intent creation fails", async () => {
      mockStripePaymentIntentsCreate.mockRejectedValue(new Error("Card declined"));

      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        hasBeenAssigned: true,
        paymentIntentId: null, // Will try to create
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: ["5"],
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({ id: 1, stripeCustomerId: "cus_123" });
      UserHomes.findByPk.mockResolvedValue({ id: 1 });

      const results = await processAutoCapture();

      expect(results.failed).toBe(1);
      expect(mockAppointment.update).toHaveBeenCalledWith({ paymentCaptureFailed: true });
    });

    it("should skip appointment if user not found", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        hasBeenAssigned: true,
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: ["5"],
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue(null);
      UserHomes.findByPk.mockResolvedValue({ id: 1 });

      const results = await processAutoCapture();

      expect(results.skipped).toBe(1);
    });

    it("should skip appointment if home not found", async () => {
      const mockAppointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        hasBeenAssigned: true,
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: ["5"],
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.findByPk.mockResolvedValue({ id: 1, stripeCustomerId: "cus_123" });
      UserHomes.findByPk.mockResolvedValue(null);

      const results = await processAutoCapture();

      expect(results.skipped).toBe(1);
    });

    it("should continue processing after one appointment fails", async () => {
      mockStripePaymentIntentsCapture
        .mockRejectedValueOnce(new Error("First failed"))
        .mockResolvedValueOnce({
          id: "pi_test_456",
          amount: 15000,
          amount_received: 15000,
        });

      const mockAppointment1 = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: daysFromNow(2),
        hasBeenAssigned: true,
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
        paid: false,
        price: "150.00",
        employeesAssigned: ["5"],
        update: jest.fn().mockResolvedValue(true),
      };

      const mockAppointment2 = {
        id: 2,
        userId: 2,
        homeId: 2,
        date: daysFromNow(2),
        hasBeenAssigned: true,
        paymentIntentId: "pi_test_456",
        paymentStatus: "pending",
        paid: false,
        price: "200.00",
        employeesAssigned: ["6"],
        update: jest.fn().mockResolvedValue(true),
      };

      UserAppointments.findAll.mockResolvedValue([mockAppointment1, mockAppointment2]);
      User.findByPk.mockResolvedValue({ id: 1, stripeCustomerId: "cus_123" });
      UserHomes.findByPk.mockResolvedValue({ id: 1 });
      Payout.findOne.mockResolvedValue({ update: jest.fn() });

      const results = await processAutoCapture();

      expect(results.failed).toBe(1);
      expect(results.captured).toBe(1);
    });
  });

  describe("Multiple Appointments", () => {
    it("should process multiple appointments correctly", async () => {
      const mockAppointments = [
        {
          id: 1,
          userId: 1,
          homeId: 1,
          date: daysFromNow(2),
          hasBeenAssigned: true,
          paymentIntentId: "pi_test_1",
          paymentStatus: "pending",
          paid: false,
          price: "100.00",
          employeesAssigned: ["5"],
          update: jest.fn().mockResolvedValue(true),
        },
        {
          id: 2,
          userId: 2,
          homeId: 2,
          date: daysFromNow(3),
          hasBeenAssigned: true,
          paymentIntentId: null, // Will create new
          paymentStatus: "pending",
          paid: false,
          price: "150.00",
          employeesAssigned: ["6"],
          update: jest.fn().mockResolvedValue(true),
        },
        {
          id: 3,
          userId: 3,
          homeId: 3,
          date: daysFromNow(1),
          hasBeenAssigned: true,
          paymentIntentId: "pi_test_3",
          paymentStatus: "pending",
          paid: false,
          price: "200.00",
          employeesAssigned: ["7"],
          update: jest.fn().mockResolvedValue(true),
        },
      ];

      UserAppointments.findAll.mockResolvedValue(mockAppointments);
      User.findByPk.mockResolvedValue({ id: 1, stripeCustomerId: "cus_123" });
      UserHomes.findByPk.mockResolvedValue({ id: 1 });
      Payout.findOne.mockResolvedValue({ update: jest.fn() });

      const results = await processAutoCapture();

      expect(results.captured).toBe(3);
      expect(results.created).toBe(1); // Only second appointment creates new PI
      expect(mockStripePaymentIntentsCreate).toHaveBeenCalledTimes(1);
      expect(mockStripePaymentIntentsCapture).toHaveBeenCalledTimes(2);
    });
  });
});
