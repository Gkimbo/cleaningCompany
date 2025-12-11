/**
 * Stripe Integration Tests
 *
 * These tests verify the Stripe payment flow works correctly.
 * They use the actual Stripe test API to ensure real integration works.
 *
 * Prerequisites:
 * - STRIPE_SECRET_KEY must be set to a test key (sk_test_...)
 * - Run with: npm test -- __tests__/integration/stripe.test.js
 */

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Skip these tests if no Stripe key is configured
const describeIfStripe =
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith("sk_test")
    ? describe
    : describe.skip;

describeIfStripe("Stripe Integration Tests", () => {
  describe("Payment Intent Creation", () => {
    it("should create a payment intent", async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 15000, // $150.00
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          testId: `test_${Date.now()}`,
        },
      });

      expect(paymentIntent.id).toMatch(/^pi_/);
      expect(paymentIntent.amount).toBe(15000);
      expect(paymentIntent.currency).toBe("usd");
      expect(paymentIntent.status).toBe("requires_payment_method");
    });

    it("should create a payment intent with manual capture", async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 10000,
        currency: "usd",
        capture_method: "manual",
        metadata: {
          userId: "1",
          homeId: "1",
        },
      });

      expect(paymentIntent.id).toMatch(/^pi_/);
      expect(paymentIntent.capture_method).toBe("manual");
    });

    it("should create a payment intent with receipt email", async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 5000,
        currency: "usd",
        receipt_email: "test@example.com",
        automatic_payment_methods: { enabled: true },
      });

      expect(paymentIntent.receipt_email).toBe("test@example.com");
    });
  });

  describe("Payment Intent Retrieval", () => {
    let testPaymentIntent;

    beforeAll(async () => {
      testPaymentIntent = await stripe.paymentIntents.create({
        amount: 7500,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
      });
    });

    it("should retrieve a payment intent by ID", async () => {
      const retrieved = await stripe.paymentIntents.retrieve(testPaymentIntent.id);

      expect(retrieved.id).toBe(testPaymentIntent.id);
      expect(retrieved.amount).toBe(7500);
    });
  });

  describe("Payment Intent Cancellation", () => {
    it("should cancel a payment intent", async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 3000,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
      });

      const canceled = await stripe.paymentIntents.cancel(paymentIntent.id);

      expect(canceled.status).toBe("canceled");
    });
  });

  describe("Refunds", () => {
    // Note: Can only refund succeeded payments
    // This test verifies the refund API works
    it("should handle refund API structure", async () => {
      // We can't actually create a refund without a real payment
      // But we can verify the API is accessible
      expect(stripe.refunds).toBeDefined();
      expect(typeof stripe.refunds.create).toBe("function");
    });
  });

  describe("Webhook Signature Verification", () => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test";

    it("should throw error for invalid signature", () => {
      const payload = JSON.stringify({
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_test" } },
      });
      const invalidSignature = "invalid_signature";

      expect(() => {
        stripe.webhooks.constructEvent(payload, invalidSignature, webhookSecret);
      }).toThrow();
    });
  });

  describe("Payment Method Types", () => {
    it("should support card payments", async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 2000,
        currency: "usd",
        payment_method_types: ["card"],
      });

      expect(paymentIntent.payment_method_types).toContain("card");
    });
  });

  describe("Metadata", () => {
    it("should store custom metadata", async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 1500,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          appointmentId: "123",
          userId: "456",
          homeId: "789",
          customField: "test_value",
        },
      });

      expect(paymentIntent.metadata.appointmentId).toBe("123");
      expect(paymentIntent.metadata.userId).toBe("456");
      expect(paymentIntent.metadata.homeId).toBe("789");
      expect(paymentIntent.metadata.customField).toBe("test_value");
    });
  });

  describe("Amount Handling", () => {
    it("should handle minimum amount ($0.50 for USD)", async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 50, // $0.50 - minimum for USD
        currency: "usd",
        automatic_payment_methods: { enabled: true },
      });

      expect(paymentIntent.amount).toBe(50);
    });

    it("should reject amount below minimum", async () => {
      await expect(
        stripe.paymentIntents.create({
          amount: 10, // $0.10 - below minimum
          currency: "usd",
          automatic_payment_methods: { enabled: true },
        })
      ).rejects.toThrow();
    });

    it("should handle large amounts", async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 99999900, // $999,999.00
        currency: "usd",
        automatic_payment_methods: { enabled: true },
      });

      expect(paymentIntent.amount).toBe(99999900);
    });
  });
});

describe("Stripe Config Validation", () => {
  it("should have Stripe secret key configured", () => {
    expect(process.env.STRIPE_SECRET_KEY).toBeDefined();
  });

  it("should have Stripe publishable key configured", () => {
    expect(process.env.STRIPE_PUBLISHABLE_KEY).toBeDefined();
  });

  it("should use test keys in development", () => {
    if (process.env.NODE_ENV !== "production") {
      expect(process.env.STRIPE_SECRET_KEY).toMatch(/^sk_test_/);
    }
  });
});

afterAll(async () => {
  // Clear any pending timers
  jest.useRealTimers();
});
