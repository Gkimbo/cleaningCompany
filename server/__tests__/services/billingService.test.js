/**
 * Billing Service Tests
 */

// Create shared mock objects
const mockStripe = {
  customers: {
    retrieve: jest.fn(),
  },
  paymentIntents: {
    create: jest.fn(),
    capture: jest.fn(),
    retrieve: jest.fn(),
  },
  transfers: {
    create: jest.fn(),
  },
};

// Mock stripe
jest.mock("stripe", () => {
  return jest.fn(() => mockStripe);
});

// Mock models
const mockModels = {
  User: {
    findByPk: jest.fn(),
  },
  UserBills: {
    findOne: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  UserCleanerAppointments: {
    findOne: jest.fn(),
  },
  JobPhoto: {
    count: jest.fn(),
  },
  StripeConnectAccount: {
    findOne: jest.fn(),
  },
  Payout: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Payment: {
    create: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  UserHomes: {},
};

// Mock node-cron
jest.mock("node-cron", () => ({
  schedule: jest.fn(),
}));

// Mock businessConfig
jest.mock("../../config/businessConfig", () => ({
  getPricingConfig: jest.fn().mockResolvedValue({
    platform: { feePercent: 10 },
  }),
}));

const BillingService = require("../../services/billingService");
const { startBillingScheduler } = require("../../services/billingService");
const cron = require("node-cron");

describe("Billing Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("startBillingScheduler", () => {
    it("should schedule a monthly cron job", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      startBillingScheduler();

      expect(cron.schedule).toHaveBeenCalledWith(
        "0 0 1 * *",
        expect.any(Function)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[BillingScheduler] Monthly billing scheduler started"
      );

      consoleSpy.mockRestore();
    });
  });

  describe("processAutoPayment", () => {
    it("should return error for non-cleaner-booked appointment", async () => {
      const appointment = {
        bookedByCleanerId: null,
      };

      const result = await BillingService.processAutoPayment(
        appointment,
        mockModels
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not a cleaner-booked appointment");
    });

    it("should return error when auto-pay is not enabled", async () => {
      const appointment = {
        bookedByCleanerId: 1,
        autoPayEnabled: false,
      };

      const result = await BillingService.processAutoPayment(
        appointment,
        mockModels
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Auto-pay is not enabled for this appointment");
    });

    it("should return already paid if payment is complete", async () => {
      const appointment = {
        bookedByCleanerId: 1,
        autoPayEnabled: true,
        paid: true,
        paymentStatus: "captured",
      };

      const result = await BillingService.processAutoPayment(
        appointment,
        mockModels
      );

      expect(result.success).toBe(true);
      expect(result.alreadyPaid).toBe(true);
    });

    it("should return error if client not found", async () => {
      const appointment = {
        bookedByCleanerId: 1,
        autoPayEnabled: true,
        paid: false,
        userId: 999,
      };

      mockModels.User.findByPk.mockResolvedValue(null);

      const result = await BillingService.processAutoPayment(
        appointment,
        mockModels
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Client not found");
    });

    it("should return error if client has no Stripe customer ID", async () => {
      const appointment = {
        bookedByCleanerId: 1,
        autoPayEnabled: true,
        paid: false,
        userId: 1,
      };

      mockModels.User.findByPk.mockResolvedValue({
        id: 1,
        stripeCustomerId: null,
      });

      const result = await BillingService.processAutoPayment(
        appointment,
        mockModels
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Client does not have Stripe customer ID");
    });

    it("should return error if no default payment method", async () => {
      const appointment = {
        bookedByCleanerId: 1,
        autoPayEnabled: true,
        paid: false,
        userId: 1,
        update: jest.fn().mockResolvedValue(true),
      };

      mockModels.User.findByPk.mockResolvedValue({
        id: 1,
        stripeCustomerId: "cus_123",
      });

      mockStripe.customers.retrieve.mockResolvedValue({
        id: "cus_123",
        invoice_settings: {},
        default_source: null,
      });

      const result = await BillingService.processAutoPayment(
        appointment,
        mockModels
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Client does not have a default payment method");
    });

    it("should successfully process payment with existing payment intent", async () => {
      const appointment = {
        bookedByCleanerId: 1,
        autoPayEnabled: true,
        paid: false,
        paymentStatus: "requires_capture",
        userId: 1,
        price: "100.00",
        paymentIntentId: "pi_123",
        id: 1,
        homeId: 1,
        update: jest.fn().mockResolvedValue(true),
      };

      mockModels.User.findByPk.mockResolvedValue({
        id: 1,
        stripeCustomerId: "cus_123",
      });

      mockStripe.customers.retrieve.mockResolvedValue({
        id: "cus_123",
        invoice_settings: { default_payment_method: "pm_123" },
      });

      mockStripe.paymentIntents.capture.mockResolvedValue({
        id: "pi_123",
        amount_received: 10000,
        latest_charge: "ch_123",
      });

      mockModels.UserBills.findOne.mockResolvedValue({
        appointmentPaid: 0,
        totalPaid: 0,
        appointmentDue: 100,
        totalDue: 100,
        update: jest.fn().mockResolvedValue(true),
      });

      mockModels.Payment.create.mockResolvedValue({});

      const result = await BillingService.processAutoPayment(
        appointment,
        mockModels
      );

      expect(result.success).toBe(true);
      expect(result.amountCharged).toBe(100);
      expect(mockStripe.paymentIntents.capture).toHaveBeenCalledWith("pi_123");
    });
  });

  describe("processCleanerPayout", () => {
    it("should return error when no cleaners assigned", async () => {
      const appointment = {
        employeesAssigned: [],
      };

      const result = await BillingService.processCleanerPayout(
        appointment,
        mockModels
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No cleaners assigned");
    });

    it("should handle cleaner without Stripe Connect account", async () => {
      const appointment = {
        employeesAssigned: ["1"],
        amountPaid: 10000,
        id: 1,
      };

      mockModels.StripeConnectAccount.findOne.mockResolvedValue(null);

      const result = await BillingService.processCleanerPayout(
        appointment,
        mockModels
      );

      expect(result.payouts[0].success).toBe(false);
      expect(result.payouts[0].error).toBe("No Stripe Connect account");
    });
  });

  describe("completeCleanerBookedAppointment", () => {
    it("should return error if appointment not found", async () => {
      mockModels.UserAppointments.findByPk.mockResolvedValue(null);

      const result = await BillingService.completeCleanerBookedAppointment(
        999,
        1,
        mockModels
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Appointment not found");
    });

    it("should return error if cleaner not assigned", async () => {
      mockModels.UserAppointments.findByPk.mockResolvedValue({ id: 1 });
      mockModels.UserCleanerAppointments.findOne.mockResolvedValue(null);

      const result = await BillingService.completeCleanerBookedAppointment(
        1,
        999,
        mockModels
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cleaner is not assigned to this appointment");
    });

    it("should return error if photos are missing", async () => {
      mockModels.UserAppointments.findByPk.mockResolvedValue({ id: 1 });
      mockModels.UserCleanerAppointments.findOne.mockResolvedValue({
        appointmentId: 1,
        employeeId: 1,
      });
      mockModels.JobPhoto.count
        .mockResolvedValueOnce(0) // before photos
        .mockResolvedValueOnce(0); // after photos

      const result = await BillingService.completeCleanerBookedAppointment(
        1,
        1,
        mockModels
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Before and after photos are required to complete the job"
      );
      expect(result.missingPhotos).toEqual({ before: true, after: true });
    });
  });

  describe("getClientBillingHistory", () => {
    it("should return billing history for a client", async () => {
      mockModels.Payment.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [
          {
            id: 1,
            transactionId: "txn_123",
            type: "capture",
            status: "succeeded",
            amount: 10000,
            createdAt: new Date(),
            appointment: {
              id: 1,
              date: "2024-01-15",
              home: { address: "123 Main St", city: "Boston" },
            },
          },
        ],
      });

      const result = await BillingService.getClientBillingHistory(
        1,
        mockModels
      );

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(100);
      expect(result.total).toBe(1);
    });

    it("should handle errors gracefully", async () => {
      mockModels.Payment.findAndCountAll.mockRejectedValue(
        new Error("Database error")
      );

      const result = await BillingService.getClientBillingHistory(
        1,
        mockModels
      );

      expect(result.transactions).toEqual([]);
      expect(result.error).toBe("Database error");
    });
  });

  describe("getPendingPaymentReminders", () => {
    it("should return pending payment reminders", async () => {
      const mockAppointments = [
        {
          id: 1,
          date: "2024-01-10",
          homeowner: { firstName: "John", lastName: "Doe" },
          home: { address: "123 Main St" },
        },
      ];

      mockModels.UserAppointments.findAll.mockResolvedValue(mockAppointments);

      const result = await BillingService.getPendingPaymentReminders(mockModels);

      expect(result).toEqual(mockAppointments);
    });

    it("should return empty array on error", async () => {
      mockModels.UserAppointments.findAll.mockRejectedValue(
        new Error("Database error")
      );

      const result = await BillingService.getPendingPaymentReminders(mockModels);

      expect(result).toEqual([]);
    });
  });
});
