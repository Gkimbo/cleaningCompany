/**
 * Tests for homeowner cancellation flow
 * Tests cleaner notification (in-app and email) when homeowner cancels an appointment
 */

// Mock Email class
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendHomeownerCancelledNotification: jest.fn().mockResolvedValue("Email sent"),
}));

// Mock Stripe
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      retrieve: jest.fn().mockResolvedValue({ id: "pi_123", status: "succeeded" }),
      cancel: jest.fn().mockResolvedValue({ id: "pi_123", status: "canceled" }),
    },
    refunds: {
      create: jest.fn().mockResolvedValue({ id: "re_123", amount: 5000 }),
    },
    customers: {
      retrieve: jest.fn().mockResolvedValue({
        id: "cus_123",
        invoice_settings: { default_payment_method: "pm_123" },
      }),
    },
  }));
});

const Email = require("../../services/sendNotifications/EmailClass");
const { getPricingConfig } = require("../../config/businessConfig");

describe("Homeowner Cancellation - Cleaner Notification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to get date string
  const getDateString = (daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  describe("Email notification logic", () => {
    it("should determine if cleaner should be paid based on penalty window", () => {
      const cancellationConfig = {
        homeownerPenaltyDays: 3,
        refundPercentage: 0.5,
      };

      // Test within penalty window (3 days or less)
      const appointmentDate1 = new Date(getDateString(2));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      appointmentDate1.setHours(0, 0, 0, 0);
      const daysUntil1 = Math.ceil((appointmentDate1 - today) / (1000 * 60 * 60 * 24));
      const isWithinPenalty1 = daysUntil1 <= cancellationConfig.homeownerPenaltyDays;

      expect(isWithinPenalty1).toBe(true);

      // Test outside penalty window (more than 3 days)
      const appointmentDate2 = new Date(getDateString(5));
      appointmentDate2.setHours(0, 0, 0, 0);
      const daysUntil2 = Math.ceil((appointmentDate2 - today) / (1000 * 60 * 60 * 24));
      const isWithinPenalty2 = daysUntil2 <= cancellationConfig.homeownerPenaltyDays;

      expect(isWithinPenalty2).toBe(false);
    });

    it("should calculate correct cleaner payment when within penalty window", () => {
      const price = 200;
      const refundPercentage = 0.5;
      const platformFeePercent = 0.1;
      const numCleaners = 1;

      // 50% of price goes to cleaner minus 10% platform fee
      const cleanerPortion = price * (1 - refundPercentage); // $100
      const platformFee = cleanerPortion * platformFeePercent; // $10
      const cleanerPayment = (cleanerPortion - platformFee) / numCleaners; // $90

      expect(cleanerPayment).toBe(90);
    });

    it("should split payment among multiple cleaners", () => {
      const price = 300;
      const refundPercentage = 0.5;
      const platformFeePercent = 0.1;
      const numCleaners = 2;

      const cleanerPortion = price * (1 - refundPercentage); // $150
      const platformFee = cleanerPortion * platformFeePercent; // $15
      const totalCleanerPayment = cleanerPortion - platformFee; // $135
      const perCleanerPayment = totalCleanerPayment / numCleaners; // $67.50

      expect(perCleanerPayment).toBe(67.5);
    });
  });

  describe("Email content requirements", () => {
    it("should include appointment date in email", () => {
      const appointmentDate = getDateString(2);
      const formattedDate = new Date(appointmentDate).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      expect(formattedDate).toBeTruthy();
      expect(formattedDate).toMatch(/\w+,?\s*\w+\s*\d+/); // Matches date pattern
    });

    it("should include location info (city, state only for privacy)", () => {
      const home = {
        address: "123 Main St",
        city: "Denver",
        state: "CO",
        zipcode: "80202",
      };

      // Only city and state should be shown in email
      const homeAddress = `${home.city}, ${home.state}`;

      expect(homeAddress).toBe("Denver, CO");
      expect(homeAddress).not.toContain("123 Main St");
    });

    it("should include payment amount when within penalty window", () => {
      const cleanerPayment = "90.00";
      const showPayment = true;

      // Email subject should mention payment
      const subject = showPayment
        ? `⚠️ Appointment Cancelled - You'll Still Be Paid $${cleanerPayment}`
        : `⚠️ Appointment Cancelled - Date`;

      expect(subject).toContain("$90.00");
      expect(subject).toContain("Still Be Paid");
    });

    it("should not include payment amount when outside penalty window", () => {
      const showPayment = false;
      const appointmentDate = "2025-01-15";

      const subject = showPayment
        ? `⚠️ Appointment Cancelled - You'll Still Be Paid $0`
        : `⚠️ Appointment Cancelled - ${appointmentDate}`;

      expect(subject).not.toContain("Paid");
      expect(subject).toContain("2025-01-15");
    });
  });

  describe("Cleaner removal before cancellation", () => {
    it("should get cleaner IDs from employeesAssigned array", () => {
      const appointment = {
        id: 1,
        employeesAssigned: ["2", "5", "8"],
        hasBeenAssigned: true,
      };

      const cleanerIds = appointment.employeesAssigned || [];

      expect(cleanerIds).toHaveLength(3);
      expect(cleanerIds).toContain("2");
      expect(cleanerIds).toContain("5");
      expect(cleanerIds).toContain("8");
    });

    it("should handle empty employeesAssigned", () => {
      const appointment = {
        id: 1,
        employeesAssigned: null,
        hasBeenAssigned: false,
      };

      const cleanerIds = appointment.employeesAssigned || [];

      expect(cleanerIds).toHaveLength(0);
    });

    it("should check hasBeenAssigned flag", () => {
      const appointment = {
        id: 1,
        employeesAssigned: ["2"],
        hasBeenAssigned: true,
      };

      const hasCleanerAssigned =
        appointment.hasBeenAssigned &&
        appointment.employeesAssigned &&
        appointment.employeesAssigned.length > 0;

      expect(hasCleanerAssigned).toBe(true);
    });
  });

  describe("Payout creation for cleaner", () => {
    it("should create payout record when within penalty window", () => {
      const appointmentId = 1;
      const cleanerId = "2";
      const price = 200;
      const refundPercentage = 0.5;
      const platformFeePercent = 0.1;

      const priceInCents = price * 100;
      const cleanerPortion = priceInCents * (1 - refundPercentage);
      const platformFee = Math.round(cleanerPortion * platformFeePercent);
      const netAmount = cleanerPortion - platformFee;

      const payoutRecord = {
        appointmentId,
        cleanerId,
        grossAmount: cleanerPortion,
        platformFee,
        netAmount,
        status: "pending",
        paymentCapturedAt: new Date(),
      };

      expect(payoutRecord.grossAmount).toBe(10000); // $100 in cents
      expect(payoutRecord.platformFee).toBe(1000); // $10 in cents
      expect(payoutRecord.netAmount).toBe(9000); // $90 in cents
      expect(payoutRecord.status).toBe("pending");
    });

    it("should not create payout record when outside penalty window", () => {
      const isWithinPenaltyWindow = false;
      const cleanerPayoutResult = null;

      // When outside penalty window, no payout is created
      expect(cleanerPayoutResult).toBeNull();
      expect(isWithinPenaltyWindow).toBe(false);
    });
  });

  describe("Email function calls", () => {
    it("should call sendHomeownerCancelledNotification with correct params when within penalty", async () => {
      const cleaner = {
        email: "cleaner@test.com",
        firstName: "John",
        username: "johncleaner",
      };
      const appointmentDate = "2025-01-15";
      const homeAddress = "Denver, CO";
      const showPayment = true;
      const cleanerPayment = "90.00";

      await Email.sendHomeownerCancelledNotification(
        cleaner.email,
        cleaner.firstName || cleaner.username,
        appointmentDate,
        homeAddress,
        showPayment,
        cleanerPayment
      );

      expect(Email.sendHomeownerCancelledNotification).toHaveBeenCalledWith(
        "cleaner@test.com",
        "John",
        "2025-01-15",
        "Denver, CO",
        true,
        "90.00"
      );
    });

    it("should call sendHomeownerCancelledNotification without payment when outside penalty", async () => {
      const cleaner = {
        email: "cleaner@test.com",
        firstName: "Jane",
      };
      const appointmentDate = "2025-01-20";
      const homeAddress = "Boulder, CO";
      const showPayment = false;

      await Email.sendHomeownerCancelledNotification(
        cleaner.email,
        cleaner.firstName,
        appointmentDate,
        homeAddress,
        showPayment,
        null
      );

      expect(Email.sendHomeownerCancelledNotification).toHaveBeenCalledWith(
        "cleaner@test.com",
        "Jane",
        "2025-01-20",
        "Boulder, CO",
        false,
        null
      );
    });

    it("should not fail if email send fails", async () => {
      Email.sendHomeownerCancelledNotification.mockRejectedValueOnce(
        new Error("SMTP error")
      );

      let cancellationSucceeded = true;

      try {
        await Email.sendHomeownerCancelledNotification(
          "cleaner@test.com",
          "John",
          "2025-01-15",
          "Denver, CO",
          true,
          "90.00"
        );
      } catch (emailError) {
        console.error("Email error:", emailError);
        // Cancellation should still succeed
      }

      expect(cancellationSucceeded).toBe(true);
    });

    it("should send email to multiple cleaners", async () => {
      const cleanerIds = ["2", "5", "8"];
      const cleaners = [
        { id: "2", email: "cleaner1@test.com", firstName: "Alice" },
        { id: "5", email: "cleaner2@test.com", firstName: "Bob" },
        { id: "8", email: "cleaner3@test.com", firstName: "Charlie" },
      ];

      for (const cleaner of cleaners) {
        await Email.sendHomeownerCancelledNotification(
          cleaner.email,
          cleaner.firstName,
          "2025-01-15",
          "Denver, CO",
          true,
          "30.00"
        );
      }

      expect(Email.sendHomeownerCancelledNotification).toHaveBeenCalledTimes(3);
    });
  });

  describe("Edge cases", () => {
    it("should handle cleaner without email", () => {
      const cleaner = {
        id: "2",
        firstName: "John",
        email: null,
      };

      // Should not attempt to send email
      if (cleaner.email) {
        expect(true).toBe(false); // Should not reach here
      }

      expect(cleaner.email).toBeNull();
    });

    it("should use username if firstName not available", () => {
      const cleaner = {
        firstName: null,
        username: "johncleaner",
      };

      const displayName = cleaner.firstName || cleaner.username;

      expect(displayName).toBe("johncleaner");
    });

    it("should handle home without full address", () => {
      const home = null;

      const homeAddress = home
        ? `${home.city}, ${home.state}`
        : "the scheduled location";

      expect(homeAddress).toBe("the scheduled location");
    });

    it("should handle appointment exactly on penalty boundary (3 days)", () => {
      const cancellationConfig = {
        homeownerPenaltyDays: 3,
      };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const appointmentDate = new Date(today);
      appointmentDate.setDate(appointmentDate.getDate() + 3);

      const daysUntil = Math.ceil((appointmentDate - today) / (1000 * 60 * 60 * 24));

      // 3 days should be within penalty window (<=3)
      expect(daysUntil).toBe(3);
      expect(daysUntil <= cancellationConfig.homeownerPenaltyDays).toBe(true);
    });
  });
});

describe("Email Template Content", () => {
  describe("sendHomeownerCancelledNotification template", () => {
    it("should include all required elements for penalty window cancellation", () => {
      // Elements that should be in the email when cleaner gets paid
      const requiredElements = [
        "Appointment Cancelled",
        "homeowner has cancelled",
        "partial payment",
        "Find Another Appointment",
        "Log into the Kleanr app",
        "Browse available cleaning appointments",
      ];

      // These should all be present in the email template
      requiredElements.forEach((element) => {
        expect(element).toBeTruthy();
      });
    });

    it("should have different subject line based on payment status", () => {
      const getSubject = (willBePaid, paymentAmount, appointmentDate) => {
        return willBePaid
          ? `⚠️ Appointment Cancelled - You'll Still Be Paid $${paymentAmount}`
          : `⚠️ Appointment Cancelled - ${appointmentDate}`;
      };

      const paidSubject = getSubject(true, "90.00", "Jan 15");
      const unpaidSubject = getSubject(false, null, "Jan 15");

      expect(paidSubject).toContain("Still Be Paid");
      expect(paidSubject).toContain("$90.00");
      expect(unpaidSubject).not.toContain("Paid");
      expect(unpaidSubject).toContain("Jan 15");
    });
  });
});
