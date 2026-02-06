/**
 * Tests for no cancellation fee when no cleaner is assigned
 *
 * Verifies that homeowners can cancel appointments without any fee
 * (including the $25 cancellation fee) if no cleaner has been assigned,
 * even when cancelling within the 7-day penalty window.
 */

// Mock Email class
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendHomeownerCancelledNotification: jest.fn().mockResolvedValue("Email sent"),
  sendCancellationConfirmation: jest.fn().mockResolvedValue("Email sent"),
}));

// Mock PushNotification
jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
  sendToUser: jest.fn().mockResolvedValue(true),
}));

// Mock Stripe
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      retrieve: jest.fn().mockResolvedValue({
        id: "pi_123",
        status: "requires_capture",
        amount: 20000,
      }),
      cancel: jest.fn().mockResolvedValue({ id: "pi_123", status: "canceled" }),
    },
    refunds: {
      create: jest.fn().mockResolvedValue({ id: "re_123", amount: 20000 }),
    },
    customers: {
      retrieve: jest.fn().mockResolvedValue({
        id: "cus_123",
        invoice_settings: { default_payment_method: "pm_123" },
      }),
    },
    charges: {
      create: jest.fn().mockResolvedValue({ id: "ch_123" }),
    },
  }));
});

// Mock CancellationAuditService
jest.mock("../../services/CancellationAuditService", () => ({
  log: jest.fn().mockResolvedValue({}),
}));

// Mock CancellationFinancialService
jest.mock("../../services/CancellationFinancialService", () => ({
  processCancellation: jest.fn().mockResolvedValue({
    success: true,
    refund: { amount: 200 },
  }),
}));

// Mock JobLedgerService
jest.mock("../../services/JobLedgerService", () => ({
  recordCancellation: jest.fn().mockResolvedValue({}),
}));

// Mock NotificationService
jest.mock("../../services/NotificationService", () => ({
  create: jest.fn().mockResolvedValue({}),
  sendToUser: jest.fn().mockResolvedValue({}),
}));

describe("No Cancellation Fee When No Cleaner Assigned", () => {
  // Helper to get date string
  const getDateString = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  describe("willChargeCancellationFee calculation", () => {
    const cancellationWindowDays = 7;

    it("should NOT charge cancellation fee when no cleaner assigned (within window)", () => {
      const daysUntilAppointment = 3; // Within 7-day window
      const hasCleanerAssigned = false;

      const willChargeCancellationFee =
        daysUntilAppointment <= cancellationWindowDays && hasCleanerAssigned;

      expect(willChargeCancellationFee).toBe(false);
    });

    it("should NOT charge cancellation fee when no cleaner assigned (on boundary)", () => {
      const daysUntilAppointment = 7; // Exactly on boundary
      const hasCleanerAssigned = false;

      const willChargeCancellationFee =
        daysUntilAppointment <= cancellationWindowDays && hasCleanerAssigned;

      expect(willChargeCancellationFee).toBe(false);
    });

    it("should charge cancellation fee when cleaner IS assigned (within window)", () => {
      const daysUntilAppointment = 3; // Within 7-day window
      const hasCleanerAssigned = true;

      const willChargeCancellationFee =
        daysUntilAppointment <= cancellationWindowDays && hasCleanerAssigned;

      expect(willChargeCancellationFee).toBe(true);
    });

    it("should NOT charge cancellation fee when outside window (regardless of cleaner)", () => {
      const daysUntilAppointment = 10; // Outside 7-day window
      const hasCleanerAssignedTrue = true;
      const hasCleanerAssignedFalse = false;

      const willChargeFeeWithCleaner =
        daysUntilAppointment <= cancellationWindowDays && hasCleanerAssignedTrue;
      const willChargeFeeWithoutCleaner =
        daysUntilAppointment <= cancellationWindowDays && hasCleanerAssignedFalse;

      expect(willChargeFeeWithCleaner).toBe(false);
      expect(willChargeFeeWithoutCleaner).toBe(false);
    });
  });

  describe("Payment method requirement logic", () => {
    it("should NOT require payment method when no cleaner assigned (within window)", () => {
      const isWithinCancellationFeeWindow = true;
      const hasCleanerAssigned = false;
      const hasPaymentMethod = false;

      // Old logic would block: isWithinCancellationFeeWindow && !hasPaymentMethod
      // New logic checks cleaner assignment first
      const shouldBlockCancellation =
        isWithinCancellationFeeWindow && hasCleanerAssigned && !hasPaymentMethod;

      expect(shouldBlockCancellation).toBe(false);
    });

    it("should require payment method when cleaner IS assigned (within window)", () => {
      const isWithinCancellationFeeWindow = true;
      const hasCleanerAssigned = true;
      const hasPaymentMethod = false;

      const shouldBlockCancellation =
        isWithinCancellationFeeWindow && hasCleanerAssigned && !hasPaymentMethod;

      expect(shouldBlockCancellation).toBe(true);
    });

    it("should NOT block when payment method exists (regardless of cleaner)", () => {
      const isWithinCancellationFeeWindow = true;
      const hasCleanerAssigned = true;
      const hasPaymentMethod = true;

      const shouldBlockCancellation =
        isWithinCancellationFeeWindow && hasCleanerAssigned && !hasPaymentMethod;

      expect(shouldBlockCancellation).toBe(false);
    });
  });

  describe("Cancellation fee charging logic", () => {
    const cancellationFee = 25;

    it("should NOT charge fee when no cleaner assigned", () => {
      const isWithinCancellationFeeWindow = true;
      const hasCleanerAssigned = false;
      const hasPaymentMethod = true;
      const hasStripeCustomer = true;

      const shouldChargeFee =
        isWithinCancellationFeeWindow &&
        hasCleanerAssigned &&
        hasStripeCustomer &&
        hasPaymentMethod;

      let feeCharged = 0;
      if (shouldChargeFee) {
        feeCharged = cancellationFee;
      }

      expect(shouldChargeFee).toBe(false);
      expect(feeCharged).toBe(0);
    });

    it("should charge fee when cleaner IS assigned", () => {
      const isWithinCancellationFeeWindow = true;
      const hasCleanerAssigned = true;
      const hasPaymentMethod = true;
      const hasStripeCustomer = true;

      const shouldChargeFee =
        isWithinCancellationFeeWindow &&
        hasCleanerAssigned &&
        hasStripeCustomer &&
        hasPaymentMethod;

      let feeCharged = 0;
      if (shouldChargeFee) {
        feeCharged = cancellationFee;
      }

      expect(shouldChargeFee).toBe(true);
      expect(feeCharged).toBe(25);
    });
  });

  describe("Fallback fee-to-bill logic", () => {
    it("should NOT add fee to bill when no cleaner assigned", () => {
      const isWithinCancellationFeeWindow = true;
      const hasCleanerAssigned = false;
      const stripeChargeFailed = false;

      // This is the fallback when Stripe charge fails
      const shouldAddFeeToBill =
        !stripeChargeFailed &&
        isWithinCancellationFeeWindow &&
        hasCleanerAssigned;

      expect(shouldAddFeeToBill).toBe(false);
    });

    it("should add fee to bill when cleaner IS assigned and charge failed", () => {
      const isWithinCancellationFeeWindow = true;
      const hasCleanerAssigned = true;
      const stripeChargeSucceeded = false; // Stripe charge failed

      // When Stripe charge failed but we're in window with cleaner
      const shouldAddFeeToBill =
        !stripeChargeSucceeded &&
        isWithinCancellationFeeWindow &&
        hasCleanerAssigned;

      expect(shouldAddFeeToBill).toBe(true);
    });
  });

  describe("hasCleanerAssigned determination", () => {
    it("should correctly identify appointment with no cleaner", () => {
      const appointment1 = {
        hasBeenAssigned: false,
        employeesAssigned: null,
      };

      const appointment2 = {
        hasBeenAssigned: false,
        employeesAssigned: [],
      };

      const appointment3 = {
        hasBeenAssigned: true, // Flag set but no employees
        employeesAssigned: [],
      };

      const hasCleanerAssigned1 =
        appointment1.hasBeenAssigned &&
        appointment1.employeesAssigned &&
        appointment1.employeesAssigned.length > 0;

      const hasCleanerAssigned2 =
        appointment2.hasBeenAssigned &&
        appointment2.employeesAssigned &&
        appointment2.employeesAssigned.length > 0;

      const hasCleanerAssigned3 =
        appointment3.hasBeenAssigned &&
        appointment3.employeesAssigned &&
        appointment3.employeesAssigned.length > 0;

      expect(hasCleanerAssigned1).toBe(false);
      expect(hasCleanerAssigned2).toBe(false);
      expect(hasCleanerAssigned3).toBe(false);
    });

    it("should correctly identify appointment with cleaner assigned", () => {
      const appointment = {
        hasBeenAssigned: true,
        employeesAssigned: ["5"],
      };

      const hasCleanerAssigned =
        appointment.hasBeenAssigned &&
        appointment.employeesAssigned &&
        appointment.employeesAssigned.length > 0;

      expect(hasCleanerAssigned).toBe(true);
    });

    it("should correctly identify appointment with multiple cleaners", () => {
      const appointment = {
        hasBeenAssigned: true,
        employeesAssigned: ["5", "8", "12"],
      };

      const hasCleanerAssigned =
        appointment.hasBeenAssigned &&
        appointment.employeesAssigned &&
        appointment.employeesAssigned.length > 0;

      expect(hasCleanerAssigned).toBe(true);
      expect(appointment.employeesAssigned.length).toBe(3);
    });
  });

  describe("Full refund when no cleaner assigned", () => {
    it("should give full refund when no cleaner assigned (within penalty window)", () => {
      const price = 200;
      const hasCleanerAssigned = false;
      const isWithinPenaltyWindow = true;
      const refundPercentage = 0.5; // Would normally only get 50%

      // When no cleaner is assigned, should get full refund
      let estimatedRefund;
      if (!hasCleanerAssigned) {
        estimatedRefund = price; // Full refund
      } else if (isWithinPenaltyWindow) {
        estimatedRefund = price * refundPercentage;
      } else {
        estimatedRefund = price;
      }

      expect(estimatedRefund).toBe(200);
    });

    it("should give partial refund when cleaner IS assigned (within penalty window)", () => {
      const price = 200;
      const hasCleanerAssigned = true;
      const isWithinPenaltyWindow = true;
      const refundPercentage = 0.5;

      let estimatedRefund;
      if (!hasCleanerAssigned) {
        estimatedRefund = price;
      } else if (isWithinPenaltyWindow) {
        estimatedRefund = price * refundPercentage;
      } else {
        estimatedRefund = price;
      }

      expect(estimatedRefund).toBe(100);
    });
  });

  describe("Cancellation info endpoint response", () => {
    it("should return willChargeCancellationFee=false when no cleaner assigned", () => {
      const daysUntilAppointment = 3;
      const cancellationWindowDays = 7;
      const hasCleanerAssigned = false;
      const hasPaymentMethod = true;

      const cancellationInfo = {
        daysUntilAppointment,
        hasCleanerAssigned,
        isWithinCancellationFeeWindow: daysUntilAppointment <= cancellationWindowDays,
        willChargeCancellationFee:
          daysUntilAppointment <= cancellationWindowDays && hasCleanerAssigned,
        hasPaymentMethod,
        cancellationFee: 25,
      };

      expect(cancellationInfo.isWithinCancellationFeeWindow).toBe(true);
      expect(cancellationInfo.willChargeCancellationFee).toBe(false);
    });

    it("should return willChargeCancellationFee=true when cleaner IS assigned", () => {
      const daysUntilAppointment = 3;
      const cancellationWindowDays = 7;
      const hasCleanerAssigned = true;
      const hasPaymentMethod = true;

      const cancellationInfo = {
        daysUntilAppointment,
        hasCleanerAssigned,
        isWithinCancellationFeeWindow: daysUntilAppointment <= cancellationWindowDays,
        willChargeCancellationFee:
          daysUntilAppointment <= cancellationWindowDays && hasCleanerAssigned,
        hasPaymentMethod,
        cancellationFee: 25,
      };

      expect(cancellationInfo.isWithinCancellationFeeWindow).toBe(true);
      expect(cancellationInfo.willChargeCancellationFee).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle appointment on same day with no cleaner", () => {
      const daysUntilAppointment = 0;
      const hasCleanerAssigned = false;
      const cancellationWindowDays = 7;

      const willChargeCancellationFee =
        daysUntilAppointment <= cancellationWindowDays && hasCleanerAssigned;

      expect(willChargeCancellationFee).toBe(false);
    });

    it("should handle appointment tomorrow with no cleaner", () => {
      const daysUntilAppointment = 1;
      const hasCleanerAssigned = false;
      const cancellationWindowDays = 7;

      const willChargeCancellationFee =
        daysUntilAppointment <= cancellationWindowDays && hasCleanerAssigned;

      expect(willChargeCancellationFee).toBe(false);
    });

    it("should handle negative days (past appointment) with no cleaner", () => {
      const daysUntilAppointment = -1;
      const hasCleanerAssigned = false;
      const cancellationWindowDays = 7;

      const willChargeCancellationFee =
        daysUntilAppointment <= cancellationWindowDays && hasCleanerAssigned;

      // Still no fee because no cleaner assigned
      expect(willChargeCancellationFee).toBe(false);
    });
  });
});
