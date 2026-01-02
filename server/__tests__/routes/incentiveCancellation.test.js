/**
 * Tests for Incentive Cancellation Feature
 *
 * When a homeowner uses an incentive discount and cancels within the penalty window:
 * - Standard cancellation (no discount): Homeowner gets 50% refund, cleaner gets 50% minus platform fee
 * - Incentive cancellation (discount applied): Homeowner gets 10% refund, cleaner gets 40% of original price
 *   Platform keeps the rest to cover Stripe fees
 */

describe("Incentive Cancellation - Refund Calculations", () => {
  const STANDARD_REFUND_PERCENT = 0.50; // 50%
  const INCENTIVE_REFUND_PERCENT = 0.10; // 10%
  const INCENTIVE_CLEANER_PERCENT = 0.40; // 40% of original price to cleaner
  const PLATFORM_FEE_PERCENT = 0.10; // 10%

  /**
   * Helper to calculate refund and payout amounts
   * Mirrors the logic in appointmentsRouter.js cancellation flow
   */
  const calculateCancellationAmounts = ({
    paidPrice,
    originalPrice,
    discountApplied,
    cleanerCount = 1,
  }) => {
    const priceInCents = Math.round(paidPrice * 100);
    const originalPriceInCents = originalPrice
      ? Math.round(originalPrice * 100)
      : priceInCents;

    // Use original price for cleaner base if discount was applied
    const cleanerBasePriceInCents = discountApplied && originalPrice
      ? originalPriceInCents
      : priceInCents;

    // Refund percentage: 10% if discount applied, 50% otherwise
    const refundPercent = discountApplied
      ? INCENTIVE_REFUND_PERCENT
      : STANDARD_REFUND_PERCENT;

    // Client refund based on what they paid
    const clientRefundAmount = Math.round(priceInCents * refundPercent);

    let cleanerPortion, platformFee, cleanerAmount;

    if (discountApplied) {
      // Incentive cancellation: Cleaner gets 40% of original price
      // Platform keeps the rest to cover Stripe fees
      cleanerAmount = Math.round(cleanerBasePriceInCents * INCENTIVE_CLEANER_PERCENT);
      cleanerPortion = cleanerAmount;
      platformFee = 0; // No separate fee - platform keeps what's left after refund and cleaner payment
    } else {
      // Standard cancellation: Cleaner gets 50% minus platform fee
      cleanerPortion = Math.round(cleanerBasePriceInCents * (1 - STANDARD_REFUND_PERCENT));
      platformFee = Math.round(cleanerPortion * PLATFORM_FEE_PERCENT);
      cleanerAmount = cleanerPortion - platformFee;
    }

    // Per cleaner amounts
    const perCleanerGross = Math.round(cleanerPortion / cleanerCount);
    const perCleanerFee = Math.round(platformFee / cleanerCount);
    const perCleanerNet = Math.round(cleanerAmount / cleanerCount);

    // Platform keeps: what homeowner paid - refund - cleaner payout
    const platformKeeps = priceInCents - clientRefundAmount - cleanerAmount;

    return {
      clientRefundAmount,
      cleanerPortion,
      platformFee,
      cleanerAmount,
      perCleanerGross,
      perCleanerFee,
      perCleanerNet,
      refundPercent,
      platformKeeps,
    };
  };

  describe("Standard cancellation (no discount)", () => {
    it("should refund 50% to homeowner", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 100,
        originalPrice: null,
        discountApplied: false,
      });

      // 50% of $100 = $50 = 5000 cents
      expect(result.clientRefundAmount).toBe(5000);
      expect(result.refundPercent).toBe(0.50);
    });

    it("should pay cleaner 50% of price minus 10% platform fee", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 100,
        originalPrice: null,
        discountApplied: false,
      });

      // Cleaner gets 50% of $100 = $50
      expect(result.cleanerPortion).toBe(5000);
      // Platform fee: 10% of $50 = $5
      expect(result.platformFee).toBe(500);
      // Net to cleaner: $45
      expect(result.cleanerAmount).toBe(4500);
    });

    it("should calculate correct per-cleaner amounts", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 100,
        originalPrice: null,
        discountApplied: false,
      });

      expect(result.perCleanerGross).toBe(5000);  // $50
      expect(result.perCleanerFee).toBe(500);     // $5
      expect(result.perCleanerNet).toBe(4500);    // $45
    });
  });

  describe("Incentive cancellation (50% discount applied)", () => {
    it("should refund only 10% to homeowner", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 50,      // Homeowner paid $50
        originalPrice: 100, // Original was $100
        discountApplied: true,
      });

      // 10% of $50 = $5 = 500 cents
      expect(result.clientRefundAmount).toBe(500);
      expect(result.refundPercent).toBe(0.10);
    });

    it("should pay cleaner 40% of ORIGINAL price", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 50,
        originalPrice: 100,
        discountApplied: true,
      });

      // Cleaner gets 40% of ORIGINAL $100 = $40
      expect(result.cleanerPortion).toBe(4000);
      expect(result.cleanerAmount).toBe(4000);
      // No separate platform fee - platform keeps the rest
      expect(result.platformFee).toBe(0);
    });

    it("should give platform the remainder for Stripe fees", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 50,
        originalPrice: 100,
        discountApplied: true,
      });

      // Homeowner paid $50, gets $5 back, cleaner gets $40
      // Platform keeps: $50 - $5 - $40 = $5 (for Stripe fees)
      expect(result.platformKeeps).toBe(500);
    });

    it("should calculate correct per-cleaner amounts", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 50,
        originalPrice: 100,
        discountApplied: true,
      });

      expect(result.perCleanerGross).toBe(4000);  // $40
      expect(result.perCleanerFee).toBe(0);       // No fee
      expect(result.perCleanerNet).toBe(4000);    // $40
    });
  });

  describe("Various discount percentages", () => {
    it("should handle 10% discount correctly", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 90,      // 10% off $100
        originalPrice: 100,
        discountApplied: true,
      });

      // Homeowner refund: 10% of $90 = $9
      expect(result.clientRefundAmount).toBe(900);
      // Cleaner gets 40% of original $100 = $40
      expect(result.cleanerAmount).toBe(4000);
      // Platform keeps: $90 - $9 - $40 = $41
      expect(result.platformKeeps).toBe(4100);
    });

    it("should handle 25% discount correctly", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 75,      // 25% off $100
        originalPrice: 100,
        discountApplied: true,
      });

      // Homeowner refund: 10% of $75 = $7.50 = 750 cents
      expect(result.clientRefundAmount).toBe(750);
      // Cleaner gets 40% of original $100 = $40
      expect(result.cleanerAmount).toBe(4000);
      // Platform keeps: $75 - $7.50 - $40 = $27.50
      expect(result.platformKeeps).toBe(2750);
    });

    it("should handle 75% discount correctly", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 25,      // 75% off $100
        originalPrice: 100,
        discountApplied: true,
      });

      // Homeowner refund: 10% of $25 = $2.50 = 250 cents
      expect(result.clientRefundAmount).toBe(250);
      // Cleaner gets 40% of original $100 = $40
      expect(result.cleanerAmount).toBe(4000);
      // Platform keeps: $25 - $2.50 - $40 = -$17.50 (platform loses money on deep discounts)
      expect(result.platformKeeps).toBe(-1750);
    });
  });

  describe("Platform financial impact", () => {
    it("should show platform keeps remainder on incentive cancellation", () => {
      // Scenario: Original $100, 50% discount, homeowner pays $50

      const result = calculateCancellationAmounts({
        paidPrice: 50,
        originalPrice: 100,
        discountApplied: true,
      });

      const homeownerPaid = 5000;  // $50 in cents
      const homeownerRefund = result.clientRefundAmount; // $5 = 500 cents
      const cleanerPayout = result.cleanerAmount; // $40 = 4000 cents

      // Platform keeps: $50 - $5 - $40 = $5 (for Stripe fees)
      const platformKeeps = homeownerPaid - homeownerRefund - cleanerPayout;
      expect(platformKeeps).toBe(500); // Platform keeps $5
      expect(result.platformKeeps).toBe(500);
    });

    it("should show platform profit on standard cancellation", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 100,
        originalPrice: null,
        discountApplied: false,
      });

      const homeownerPaid = 10000; // $100 in cents
      const homeownerRefund = result.clientRefundAmount; // $50
      const platformRetained = homeownerPaid - homeownerRefund; // $50

      const cleanerPayout = result.cleanerAmount; // $45
      const platformFee = result.platformFee; // $5

      // Platform keeps the fee
      const platformProfit = platformRetained - cleanerPayout;
      expect(platformProfit).toBe(platformFee); // $5 profit
    });
  });

  describe("Multiple cleaners", () => {
    it("should split payout correctly between 2 cleaners with discount", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 100,     // 50% off $200
        originalPrice: 200,
        discountApplied: true,
        cleanerCount: 2,
      });

      // Total cleaner portion: 40% of $200 = $80
      expect(result.cleanerPortion).toBe(8000);

      // Each cleaner gets $40
      expect(result.perCleanerGross).toBe(4000);
      expect(result.perCleanerFee).toBe(0);
      expect(result.perCleanerNet).toBe(4000);
    });

    it("should split payout correctly between 3 cleaners with discount", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 150,     // 50% off $300
        originalPrice: 300,
        discountApplied: true,
        cleanerCount: 3,
      });

      // Total cleaner portion: 40% of $300 = $120
      expect(result.cleanerPortion).toBe(12000);

      // Each cleaner gets $40
      expect(result.perCleanerGross).toBe(4000);
      expect(result.perCleanerFee).toBe(0);
      expect(result.perCleanerNet).toBe(4000);
    });

    it("should split payout correctly between 2 cleaners without discount", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 200,
        originalPrice: null,
        discountApplied: false,
        cleanerCount: 2,
      });

      // Total cleaner portion: 50% of $200 = $100
      expect(result.cleanerPortion).toBe(10000);

      // Each cleaner gets $50 gross, $5 fee, $45 net
      expect(result.perCleanerGross).toBe(5000);
      expect(result.perCleanerFee).toBe(500);
      expect(result.perCleanerNet).toBe(4500);
    });
  });

  describe("Edge cases", () => {
    it("should handle discountApplied=true but originalPrice missing", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 100,
        originalPrice: null, // Missing
        discountApplied: true,
      });

      // Should still use reduced refund (10%)
      expect(result.refundPercent).toBe(0.10);
      expect(result.clientRefundAmount).toBe(1000); // 10% of $100

      // Cleaner payout falls back to 40% of paid price
      expect(result.cleanerPortion).toBe(4000); // 40% of $100
      expect(result.cleanerAmount).toBe(4000);
    });

    it("should handle small amounts correctly", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 10,
        originalPrice: 20,
        discountApplied: true,
      });

      // Homeowner refund: 10% of $10 = $1
      expect(result.clientRefundAmount).toBe(100);
      // Cleaner: 40% of $20 = $8
      expect(result.cleanerPortion).toBe(800);
      expect(result.platformFee).toBe(0);
      expect(result.cleanerAmount).toBe(800);
    });

    it("should handle large amounts correctly", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 500,
        originalPrice: 1000,
        discountApplied: true,
      });

      // Homeowner refund: 10% of $500 = $50
      expect(result.clientRefundAmount).toBe(5000);
      // Cleaner: 40% of $1000 = $400
      expect(result.cleanerPortion).toBe(40000);
      expect(result.platformFee).toBe(0);
      expect(result.cleanerAmount).toBe(40000);
    });

    it("should handle zero price gracefully", () => {
      const result = calculateCancellationAmounts({
        paidPrice: 0,
        originalPrice: 0,
        discountApplied: true,
      });

      expect(result.clientRefundAmount).toBe(0);
      expect(result.cleanerPortion).toBe(0);
      expect(result.cleanerAmount).toBe(0);
    });
  });

  describe("Comparison: Standard vs Incentive", () => {
    it("should document the difference in homeowner refunds", () => {
      const standard = calculateCancellationAmounts({
        paidPrice: 100,
        originalPrice: null,
        discountApplied: false,
      });

      const incentive = calculateCancellationAmounts({
        paidPrice: 50,      // 50% discount
        originalPrice: 100,
        discountApplied: true,
      });

      // Standard: 50% refund = $50
      expect(standard.clientRefundAmount).toBe(5000);

      // Incentive: 10% refund of $50 = $5
      expect(incentive.clientRefundAmount).toBe(500);

      // Incentive homeowner gets much less back as penalty for canceling with discount
      expect(incentive.clientRefundAmount).toBeLessThan(standard.clientRefundAmount);
    });

    it("should document the difference in cleaner payouts", () => {
      const standard = calculateCancellationAmounts({
        paidPrice: 100,
        originalPrice: null,
        discountApplied: false,
      });

      const incentive = calculateCancellationAmounts({
        paidPrice: 50,
        originalPrice: 100,
        discountApplied: true,
      });

      // Standard: Cleaner gets 50% of $100 minus 10% fee = $45
      expect(standard.cleanerAmount).toBe(4500);

      // Incentive: Cleaner gets 40% of ORIGINAL $100 = $40
      expect(incentive.cleanerAmount).toBe(4000);

      // Cleaner gets slightly less with incentive cancellation
      // but platform keeps more to cover Stripe fees
      expect(incentive.cleanerAmount).toBeLessThan(standard.cleanerAmount);
    });

    it("should document platform keeps more on incentive cancellation", () => {
      // Standard: $100 paid, $50 refunded, $45 to cleaner, $5 to platform
      const standard = calculateCancellationAmounts({
        paidPrice: 100,
        originalPrice: null,
        discountApplied: false,
      });

      const standardPlatformKeeps =
        10000 - standard.clientRefundAmount - standard.cleanerAmount;
      expect(standardPlatformKeeps).toBe(500); // $5 profit

      // Incentive: $50 paid, $5 refunded, $40 to cleaner, $5 to platform
      const incentive = calculateCancellationAmounts({
        paidPrice: 50,
        originalPrice: 100,
        discountApplied: true,
      });

      const incentivePlatformKeeps =
        5000 - incentive.clientRefundAmount - incentive.cleanerAmount;
      expect(incentivePlatformKeeps).toBe(500); // $5 for Stripe fees

      // Platform keeps same amount in both cases to cover fees
      expect(incentivePlatformKeeps).toBe(standardPlatformKeeps);
    });
  });
});

describe("Incentive Payout on Normal Completion", () => {
  /**
   * Tests that cleaners get paid based on original price even when
   * homeowner had a discount - during normal job completion
   */

  const calculatePayoutAmounts = ({
    price,
    originalPrice,
    discountApplied,
    platformFeePercent = 0.10,
    cleanerCount = 1,
  }) => {
    // Logic mirrors appointmentsRouter.js and paymentRouter.js
    const payoutPrice = discountApplied && originalPrice
      ? originalPrice
      : price;

    const priceInCents = Math.round(payoutPrice * 100);
    const perCleanerGross = Math.round(priceInCents / cleanerCount);
    const platformFee = Math.round(perCleanerGross * platformFeePercent);
    const netAmount = perCleanerGross - platformFee;

    return {
      priceInCents,
      perCleanerGross,
      platformFee,
      netAmount,
    };
  };

  describe("Normal completion with discount", () => {
    it("should pay cleaner based on original price", () => {
      const result = calculatePayoutAmounts({
        price: 50,          // Discounted price
        originalPrice: 100, // Original price
        discountApplied: true,
      });

      // Should use original $100, not discounted $50
      expect(result.priceInCents).toBe(10000);
      expect(result.perCleanerGross).toBe(10000);
      expect(result.platformFee).toBe(1000);
      expect(result.netAmount).toBe(9000); // $90 to cleaner
    });

    it("should pay cleaner based on paid price when no discount", () => {
      const result = calculatePayoutAmounts({
        price: 100,
        originalPrice: null,
        discountApplied: false,
      });

      expect(result.priceInCents).toBe(10000);
      expect(result.netAmount).toBe(9000); // $90 to cleaner
    });
  });

  describe("Platform absorption of discount", () => {
    it("should document platform covering discount on completion", () => {
      // Homeowner pays $50, original was $100
      const homeownerPaid = 50;
      const result = calculatePayoutAmounts({
        price: 50,
        originalPrice: 100,
        discountApplied: true,
      });

      const cleanerReceives = result.netAmount / 100; // $90
      const platformReceives = result.platformFee / 100; // $10

      // Platform received $50, paid out $90 to cleaner + kept $10 fee
      // Net: $50 - $90 = -$40 loss (platform absorbs discount)
      const platformNet = homeownerPaid - cleanerReceives;
      expect(platformNet).toBe(-40);
    });
  });

  describe("Multiple cleaners on discounted job", () => {
    it("should split original price among cleaners", () => {
      const result = calculatePayoutAmounts({
        price: 100,         // 50% off $200
        originalPrice: 200,
        discountApplied: true,
        cleanerCount: 2,
      });

      // Based on original $200
      expect(result.priceInCents).toBe(20000);

      // Each cleaner: $100 gross, $10 fee, $90 net
      expect(result.perCleanerGross).toBe(10000);
      expect(result.platformFee).toBe(1000);
      expect(result.netAmount).toBe(9000);
    });
  });
});

describe("Cancellation Info Response - Discount Fields", () => {
  /**
   * Tests for the cancellation info endpoint response
   * when a discount was applied to the appointment.
   * These tests verify the response includes all fields needed
   * for the frontend modal to display the incentive penalty warning.
   */

  const STANDARD_REFUND_PERCENT = 0.50;
  const INCENTIVE_REFUND_PERCENT = 0.10;
  const INCENTIVE_CLEANER_PERCENT = 0.40;
  const PLATFORM_FEE_PERCENT = 0.10;

  /**
   * Simulates what the cancellation-info endpoint returns
   * Mirrors the logic in appointmentsRouter.js GET /cancellation-info/:id
   */
  const buildCancellationInfoResponse = ({
    price,
    originalPrice,
    discountApplied,
    isWithinPenaltyWindow,
    hasCleanerAssigned,
  }) => {
    const priceNum = parseFloat(price) || 0;
    const originalPriceNum = discountApplied && originalPrice
      ? parseFloat(originalPrice)
      : priceNum;

    const refundPercent = discountApplied
      ? INCENTIVE_REFUND_PERCENT
      : STANDARD_REFUND_PERCENT;

    const estimatedRefund = isWithinPenaltyWindow
      ? priceNum * refundPercent
      : priceNum;

    let cleanerPayout;
    if (isWithinPenaltyWindow) {
      if (discountApplied) {
        cleanerPayout = originalPriceNum * INCENTIVE_CLEANER_PERCENT;
      } else {
        cleanerPayout = priceNum * (1 - STANDARD_REFUND_PERCENT) * (1 - PLATFORM_FEE_PERCENT);
      }
    } else {
      cleanerPayout = 0;
    }

    const platformKeeps = discountApplied && isWithinPenaltyWindow
      ? priceNum - estimatedRefund - cleanerPayout
      : 0;

    return {
      price: priceNum,
      isWithinPenaltyWindow,
      hasCleanerAssigned,
      estimatedRefund: estimatedRefund.toFixed(2),
      cleanerPayout: cleanerPayout.toFixed(2),
      // Discount/incentive info
      discountApplied,
      originalPrice: originalPriceNum.toFixed(2),
      refundPercent: refundPercent * 100,
      incentiveCleanerPercent: discountApplied ? INCENTIVE_CLEANER_PERCENT * 100 : null,
      platformKeeps: platformKeeps.toFixed(2),
    };
  };

  describe("Standard appointment (no discount)", () => {
    it("should return standard refund percentage", () => {
      const response = buildCancellationInfoResponse({
        price: 100,
        originalPrice: null,
        discountApplied: false,
        isWithinPenaltyWindow: true,
        hasCleanerAssigned: true,
      });

      expect(response.discountApplied).toBe(false);
      expect(response.refundPercent).toBe(50);
      expect(response.estimatedRefund).toBe("50.00");
      expect(response.incentiveCleanerPercent).toBeNull();
    });

    it("should not include platform keeps for standard cancellation", () => {
      const response = buildCancellationInfoResponse({
        price: 100,
        originalPrice: null,
        discountApplied: false,
        isWithinPenaltyWindow: true,
        hasCleanerAssigned: true,
      });

      expect(response.platformKeeps).toBe("0.00");
    });
  });

  describe("Discounted appointment (incentive applied)", () => {
    it("should return reduced refund percentage", () => {
      const response = buildCancellationInfoResponse({
        price: 50,
        originalPrice: 100,
        discountApplied: true,
        isWithinPenaltyWindow: true,
        hasCleanerAssigned: true,
      });

      expect(response.discountApplied).toBe(true);
      expect(response.refundPercent).toBe(10);
      expect(response.estimatedRefund).toBe("5.00"); // 10% of $50
    });

    it("should include original price for display", () => {
      const response = buildCancellationInfoResponse({
        price: 75,
        originalPrice: 150,
        discountApplied: true,
        isWithinPenaltyWindow: true,
        hasCleanerAssigned: true,
      });

      expect(response.originalPrice).toBe("150.00");
      expect(response.price).toBe(75);
    });

    it("should include incentive cleaner percentage", () => {
      const response = buildCancellationInfoResponse({
        price: 50,
        originalPrice: 100,
        discountApplied: true,
        isWithinPenaltyWindow: true,
        hasCleanerAssigned: true,
      });

      expect(response.incentiveCleanerPercent).toBe(40);
    });

    it("should calculate cleaner payout based on original price", () => {
      const response = buildCancellationInfoResponse({
        price: 50,
        originalPrice: 100,
        discountApplied: true,
        isWithinPenaltyWindow: true,
        hasCleanerAssigned: true,
      });

      // Cleaner gets 40% of original $100 = $40
      expect(response.cleanerPayout).toBe("40.00");
    });

    it("should calculate what platform keeps", () => {
      const response = buildCancellationInfoResponse({
        price: 50,
        originalPrice: 100,
        discountApplied: true,
        isWithinPenaltyWindow: true,
        hasCleanerAssigned: true,
      });

      // Paid $50, refund $5, cleaner $40, platform keeps $5
      expect(response.platformKeeps).toBe("5.00");
    });
  });

  describe("Outside penalty window", () => {
    it("should return full refund regardless of discount", () => {
      const response = buildCancellationInfoResponse({
        price: 50,
        originalPrice: 100,
        discountApplied: true,
        isWithinPenaltyWindow: false,
        hasCleanerAssigned: true,
      });

      // Outside penalty window, full refund
      expect(response.estimatedRefund).toBe("50.00");
      expect(response.cleanerPayout).toBe("0.00");
    });
  });

  describe("Various discount amounts", () => {
    it("should handle 10% discount correctly", () => {
      const response = buildCancellationInfoResponse({
        price: 90,
        originalPrice: 100,
        discountApplied: true,
        isWithinPenaltyWindow: true,
        hasCleanerAssigned: true,
      });

      expect(response.estimatedRefund).toBe("9.00");  // 10% of $90
      expect(response.cleanerPayout).toBe("40.00");   // 40% of $100
      expect(response.platformKeeps).toBe("41.00");   // $90 - $9 - $40
    });

    it("should handle 25% discount correctly", () => {
      const response = buildCancellationInfoResponse({
        price: 75,
        originalPrice: 100,
        discountApplied: true,
        isWithinPenaltyWindow: true,
        hasCleanerAssigned: true,
      });

      expect(response.estimatedRefund).toBe("7.50");  // 10% of $75
      expect(response.cleanerPayout).toBe("40.00");   // 40% of $100
      expect(response.platformKeeps).toBe("27.50");   // $75 - $7.50 - $40
    });

    it("should handle deep discount (platform loss scenario)", () => {
      const response = buildCancellationInfoResponse({
        price: 25,
        originalPrice: 100,
        discountApplied: true,
        isWithinPenaltyWindow: true,
        hasCleanerAssigned: true,
      });

      expect(response.estimatedRefund).toBe("2.50");  // 10% of $25
      expect(response.cleanerPayout).toBe("40.00");   // 40% of $100
      expect(response.platformKeeps).toBe("-17.50");  // Platform loses money
    });
  });

  describe("Frontend display requirements", () => {
    it("should provide all fields needed for breakdown display", () => {
      const response = buildCancellationInfoResponse({
        price: 50,
        originalPrice: 100,
        discountApplied: true,
        isWithinPenaltyWindow: true,
        hasCleanerAssigned: true,
      });

      // All required fields for frontend modal
      expect(response).toHaveProperty("price");
      expect(response).toHaveProperty("originalPrice");
      expect(response).toHaveProperty("discountApplied");
      expect(response).toHaveProperty("estimatedRefund");
      expect(response).toHaveProperty("refundPercent");
      expect(response).toHaveProperty("cleanerPayout");
      expect(response).toHaveProperty("incentiveCleanerPercent");
      expect(response).toHaveProperty("platformKeeps");
      expect(response).toHaveProperty("isWithinPenaltyWindow");
    });

    it("should format monetary values as strings with 2 decimals", () => {
      const response = buildCancellationInfoResponse({
        price: 50,
        originalPrice: 100,
        discountApplied: true,
        isWithinPenaltyWindow: true,
        hasCleanerAssigned: true,
      });

      expect(response.estimatedRefund).toMatch(/^\d+\.\d{2}$/);
      expect(response.cleanerPayout).toMatch(/^\d+\.\d{2}$/);
      expect(response.originalPrice).toMatch(/^\d+\.\d{2}$/);
      expect(response.platformKeeps).toMatch(/^-?\d+\.\d{2}$/);
    });

    it("should format percentages as whole numbers", () => {
      const response = buildCancellationInfoResponse({
        price: 50,
        originalPrice: 100,
        discountApplied: true,
        isWithinPenaltyWindow: true,
        hasCleanerAssigned: true,
      });

      expect(response.refundPercent).toBe(10);
      expect(Number.isInteger(response.refundPercent)).toBe(true);
      expect(response.incentiveCleanerPercent).toBe(40);
      expect(Number.isInteger(response.incentiveCleanerPercent)).toBe(true);
    });
  });
});

describe("Platform Revenue Calculator", () => {
  /**
   * Tests for the Platform Revenue Calculator in PricingManagement
   * Calculates platform profit/loss after Stripe fees at various price points
   */

  const STRIPE_FEE_PERCENT = 0.029; // 2.9%
  const STRIPE_FLAT_FEE = 0.30; // $0.30

  /**
   * Simulates the revenue calculator logic from PricingManagement.js
   */
  const calculatePlatformRevenue = ({
    cleaningPrice,
    platformFeePercent,
  }) => {
    const stripeProcessingFee = (cleaningPrice * STRIPE_FEE_PERCENT) + STRIPE_FLAT_FEE;
    const platformFee = cleaningPrice * platformFeePercent;
    const cleanerReceives = cleaningPrice - platformFee;
    const platformNet = platformFee - stripeProcessingFee;
    const isProfit = platformNet > 0;
    const profitMargin = cleaningPrice > 0 ? (platformNet / cleaningPrice) * 100 : 0;

    return {
      cleaningPrice,
      platformFeePercent,
      stripeProcessingFee: parseFloat(stripeProcessingFee.toFixed(2)),
      platformFee: parseFloat(platformFee.toFixed(2)),
      cleanerReceives: parseFloat(cleanerReceives.toFixed(2)),
      platformNet: parseFloat(platformNet.toFixed(2)),
      isProfit,
      profitMargin: parseFloat(profitMargin.toFixed(2)),
    };
  };

  describe("Basic calculations at 10% platform fee", () => {
    it("should calculate correctly for $100 cleaning", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.10,
      });

      expect(result.platformFee).toBe(10.00);
      expect(result.cleanerReceives).toBe(90.00);
      // Stripe: (100 * 0.029) + 0.30 = 2.90 + 0.30 = 3.20
      expect(result.stripeProcessingFee).toBe(3.20);
      // Platform net: 10.00 - 3.20 = 6.80
      expect(result.platformNet).toBe(6.80);
      expect(result.isProfit).toBe(true);
    });

    it("should calculate correctly for $150 cleaning", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 150,
        platformFeePercent: 0.10,
      });

      expect(result.platformFee).toBe(15.00);
      expect(result.cleanerReceives).toBe(135.00);
      // Stripe: (150 * 0.029) + 0.30 = 4.35 + 0.30 = 4.65
      expect(result.stripeProcessingFee).toBe(4.65);
      // Platform net: 15.00 - 4.65 = 10.35
      expect(result.platformNet).toBe(10.35);
      expect(result.isProfit).toBe(true);
    });

    it("should calculate correctly for $200 cleaning", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 200,
        platformFeePercent: 0.10,
      });

      expect(result.platformFee).toBe(20.00);
      expect(result.cleanerReceives).toBe(180.00);
      // Stripe: (200 * 0.029) + 0.30 = 5.80 + 0.30 = 6.10
      expect(result.stripeProcessingFee).toBe(6.10);
      // Platform net: 20.00 - 6.10 = 13.90
      expect(result.platformNet).toBe(13.90);
      expect(result.isProfit).toBe(true);
    });

    it("should calculate correctly for $50 cleaning", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 50,
        platformFeePercent: 0.10,
      });

      expect(result.platformFee).toBe(5.00);
      expect(result.cleanerReceives).toBe(45.00);
      // Stripe: (50 * 0.029) + 0.30 = 1.45 + 0.30 = 1.75
      expect(result.stripeProcessingFee).toBe(1.75);
      // Platform net: 5.00 - 1.75 = 3.25
      expect(result.platformNet).toBe(3.25);
      expect(result.isProfit).toBe(true);
    });
  });

  describe("Different platform fee percentages", () => {
    it("should calculate correctly for 5% platform fee", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.05,
      });

      expect(result.platformFee).toBe(5.00);
      expect(result.cleanerReceives).toBe(95.00);
      // Stripe: 3.20
      // Platform net: 5.00 - 3.20 = 1.80
      expect(result.platformNet).toBe(1.80);
      expect(result.isProfit).toBe(true);
    });

    it("should calculate correctly for 15% platform fee", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.15,
      });

      expect(result.platformFee).toBe(15.00);
      expect(result.cleanerReceives).toBe(85.00);
      // Platform net: 15.00 - 3.20 = 11.80
      expect(result.platformNet).toBe(11.80);
      expect(result.isProfit).toBe(true);
    });

    it("should calculate correctly for 20% platform fee", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.20,
      });

      expect(result.platformFee).toBe(20.00);
      expect(result.cleanerReceives).toBe(80.00);
      // Platform net: 20.00 - 3.20 = 16.80
      expect(result.platformNet).toBe(16.80);
      expect(result.isProfit).toBe(true);
    });

    it("should calculate correctly for 25% platform fee", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.25,
      });

      expect(result.platformFee).toBe(25.00);
      expect(result.cleanerReceives).toBe(75.00);
      // Platform net: 25.00 - 3.20 = 21.80
      expect(result.platformNet).toBe(21.80);
      expect(result.isProfit).toBe(true);
    });
  });

  describe("Loss scenarios (low platform fee)", () => {
    it("should show loss at 1% platform fee on $100", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.01,
      });

      expect(result.platformFee).toBe(1.00);
      // Stripe: 3.20
      // Platform net: 1.00 - 3.20 = -2.20
      expect(result.platformNet).toBe(-2.20);
      expect(result.isProfit).toBe(false);
    });

    it("should show loss at 2% platform fee on $100", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.02,
      });

      expect(result.platformFee).toBe(2.00);
      // Platform net: 2.00 - 3.20 = -1.20
      expect(result.platformNet).toBe(-1.20);
      expect(result.isProfit).toBe(false);
    });

    it("should show loss at 3% platform fee on $100", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.03,
      });

      expect(result.platformFee).toBe(3.00);
      // Platform net: 3.00 - 3.20 = -0.20
      expect(result.platformNet).toBe(-0.20);
      expect(result.isProfit).toBe(false);
    });

    it("should show small profit at 4% platform fee on $100", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.04,
      });

      expect(result.platformFee).toBe(4.00);
      // Platform net: 4.00 - 3.20 = 0.80
      expect(result.platformNet).toBe(0.80);
      expect(result.isProfit).toBe(true);
    });
  });

  describe("Break-even analysis", () => {
    it("should find approximate break-even at ~3.2% for $100", () => {
      // At $100, Stripe takes $3.20
      // So platform fee needs to be > $3.20 to profit
      // 3.2% of $100 = $3.20, so ~3.3% is break-even

      const belowBreakeven = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.032, // 3.2%
      });
      expect(belowBreakeven.isProfit).toBe(false);

      const atBreakeven = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.033, // 3.3%
      });
      expect(atBreakeven.isProfit).toBe(true);
    });

    it("should find approximate break-even at ~3.4% for $50", () => {
      // At $50, Stripe takes (50 * 0.029) + 0.30 = $1.75
      // Need platform fee > $1.75
      // 3.5% of $50 = $1.75, so need > 3.5%

      const belowBreakeven = calculatePlatformRevenue({
        cleaningPrice: 50,
        platformFeePercent: 0.035, // 3.5%
      });
      // 3.5% of 50 = 1.75, stripe = 1.75, net = 0
      expect(belowBreakeven.platformNet).toBe(0);

      const aboveBreakeven = calculatePlatformRevenue({
        cleaningPrice: 50,
        platformFeePercent: 0.04, // 4%
      });
      expect(aboveBreakeven.isProfit).toBe(true);
    });

    it("should show higher break-even % for lower priced cleanings", () => {
      // Lower prices need higher percentage to cover Stripe's flat fee

      const cheap = calculatePlatformRevenue({
        cleaningPrice: 50,
        platformFeePercent: 0.04, // 4%
      });

      const expensive = calculatePlatformRevenue({
        cleaningPrice: 200,
        platformFeePercent: 0.04, // 4%
      });

      // Both at 4%, but expensive cleaning should have better margin
      expect(expensive.profitMargin).toBeGreaterThan(cheap.profitMargin);
    });
  });

  describe("Profit margin calculations", () => {
    it("should calculate correct profit margin for $100 at 10%", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.10,
      });

      // Platform net: $6.80 on $100 = 6.8% margin
      expect(result.profitMargin).toBe(6.80);
    });

    it("should calculate correct profit margin for $150 at 10%", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 150,
        platformFeePercent: 0.10,
      });

      // Platform net: $10.35 on $150 = 6.9% margin
      expect(result.profitMargin).toBe(6.90);
    });

    it("should show negative margin when losing money", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.02, // 2%
      });

      // Platform net: -$1.20 on $100 = -1.2% margin
      expect(result.profitMargin).toBe(-1.20);
      expect(result.profitMargin).toBeLessThan(0);
    });
  });

  describe("Cleaner payout calculations", () => {
    it("should calculate cleaner receives correctly", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.10,
      });

      expect(result.cleanerReceives).toBe(90.00);
      expect(result.cleanerReceives).toBe(result.cleaningPrice - result.platformFee);
    });

    it("should give cleaner more at lower platform fee", () => {
      const low = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.05,
      });

      const high = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.15,
      });

      expect(low.cleanerReceives).toBe(95.00);
      expect(high.cleanerReceives).toBe(85.00);
      expect(low.cleanerReceives).toBeGreaterThan(high.cleanerReceives);
    });
  });

  describe("Stripe fee calculations", () => {
    it("should calculate Stripe fee as 2.9% + $0.30", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0.10,
      });

      const expected = (100 * 0.029) + 0.30;
      expect(result.stripeProcessingFee).toBe(expected);
    });

    it("should show Stripe flat fee impact on small amounts", () => {
      const small = calculatePlatformRevenue({
        cleaningPrice: 10,
        platformFeePercent: 0.10,
      });

      // Stripe: (10 * 0.029) + 0.30 = 0.29 + 0.30 = 0.59
      // That's 5.9% of the transaction!
      expect(small.stripeProcessingFee).toBe(0.59);

      const large = calculatePlatformRevenue({
        cleaningPrice: 500,
        platformFeePercent: 0.10,
      });

      // Stripe: (500 * 0.029) + 0.30 = 14.50 + 0.30 = 14.80
      // That's only 2.96% of the transaction
      expect(large.stripeProcessingFee).toBe(14.80);

      // Stripe fees as % are higher for small transactions
      const smallStripePercent = small.stripeProcessingFee / 10 * 100;
      const largeStripePercent = large.stripeProcessingFee / 500 * 100;
      expect(smallStripePercent).toBeGreaterThan(largeStripePercent);
    });
  });

  describe("Edge cases", () => {
    it("should handle zero price", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 0,
        platformFeePercent: 0.10,
      });

      expect(result.platformFee).toBe(0);
      expect(result.cleanerReceives).toBe(0);
      expect(result.stripeProcessingFee).toBe(0.30); // Just the flat fee
      expect(result.platformNet).toBe(-0.30);
      expect(result.isProfit).toBe(false);
      expect(result.profitMargin).toBe(0); // Avoid division by zero
    });

    it("should handle very small price", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 1,
        platformFeePercent: 0.10,
      });

      expect(result.platformFee).toBe(0.10);
      // Stripe: (1 * 0.029) + 0.30 = 0.329, rounds to 0.33
      expect(result.stripeProcessingFee).toBe(0.33);
      // Platform net: 0.10 - 0.33 = -0.23
      expect(result.platformNet).toBe(-0.23);
      expect(result.isProfit).toBe(false);
    });

    it("should handle very large price", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 1000,
        platformFeePercent: 0.10,
      });

      expect(result.platformFee).toBe(100.00);
      expect(result.cleanerReceives).toBe(900.00);
      // Stripe: (1000 * 0.029) + 0.30 = 29.00 + 0.30 = 29.30
      expect(result.stripeProcessingFee).toBe(29.30);
      // Platform net: 100.00 - 29.30 = 70.70
      expect(result.platformNet).toBe(70.70);
      expect(result.isProfit).toBe(true);
    });

    it("should handle 0% platform fee", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 0,
      });

      expect(result.platformFee).toBe(0);
      expect(result.cleanerReceives).toBe(100);
      expect(result.platformNet).toBe(-3.20); // Lose Stripe fees
      expect(result.isProfit).toBe(false);
    });

    it("should handle 100% platform fee", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 100,
        platformFeePercent: 1.0,
      });

      expect(result.platformFee).toBe(100.00);
      expect(result.cleanerReceives).toBe(0);
      // Platform net: 100.00 - 3.20 = 96.80
      expect(result.platformNet).toBe(96.80);
      expect(result.isProfit).toBe(true);
    });
  });

  describe("Real-world scenarios", () => {
    it("should calculate typical 1 bed/1 bath cleaning at $150", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 150,
        platformFeePercent: 0.10,
      });

      expect(result.platformFee).toBe(15.00);
      expect(result.cleanerReceives).toBe(135.00);
      expect(result.platformNet).toBe(10.35);
      expect(result.isProfit).toBe(true);
      expect(result.profitMargin).toBe(6.90);
    });

    it("should calculate larger home at $250", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 250,
        platformFeePercent: 0.10,
      });

      expect(result.platformFee).toBe(25.00);
      expect(result.cleanerReceives).toBe(225.00);
      // Stripe: (250 * 0.029) + 0.30 = 7.25 + 0.30 = 7.55
      expect(result.stripeProcessingFee).toBe(7.55);
      // Platform net: 25.00 - 7.55 = 17.45
      expect(result.platformNet).toBe(17.45);
      expect(result.isProfit).toBe(true);
    });

    it("should calculate high-end cleaning at $400", () => {
      const result = calculatePlatformRevenue({
        cleaningPrice: 400,
        platformFeePercent: 0.10,
      });

      expect(result.platformFee).toBe(40.00);
      expect(result.cleanerReceives).toBe(360.00);
      // Stripe: (400 * 0.029) + 0.30 = 11.60 + 0.30 = 11.90
      expect(result.stripeProcessingFee).toBe(11.90);
      // Platform net: 40.00 - 11.90 = 28.10
      expect(result.platformNet).toBe(28.10);
      expect(result.isProfit).toBe(true);
    });
  });

  describe("Monthly revenue projections", () => {
    it("should calculate monthly revenue for 100 cleanings at $150", () => {
      const perCleaning = calculatePlatformRevenue({
        cleaningPrice: 150,
        platformFeePercent: 0.10,
      });

      const monthlyCleanings = 100;
      const monthlyRevenue = perCleaning.platformNet * monthlyCleanings;
      const monthlyGross = perCleaning.platformFee * monthlyCleanings;
      const monthlyStripeFees = perCleaning.stripeProcessingFee * monthlyCleanings;

      expect(monthlyGross).toBeCloseTo(1500.00, 2);
      expect(monthlyStripeFees).toBeCloseTo(465.00, 2);
      expect(monthlyRevenue).toBeCloseTo(1035.00, 2);
    });

    it("should calculate monthly revenue for 200 cleanings at mixed prices", () => {
      const small = calculatePlatformRevenue({ cleaningPrice: 100, platformFeePercent: 0.10 });
      const medium = calculatePlatformRevenue({ cleaningPrice: 150, platformFeePercent: 0.10 });
      const large = calculatePlatformRevenue({ cleaningPrice: 200, platformFeePercent: 0.10 });

      // 50 small, 100 medium, 50 large
      const monthlyRevenue =
        (small.platformNet * 50) +
        (medium.platformNet * 100) +
        (large.platformNet * 50);

      // 6.80*50 + 10.35*100 + 13.90*50 = 340 + 1035 + 695 = 2070
      expect(monthlyRevenue).toBe(2070);
    });
  });
});

describe("Cleaner Incentive (Reduced Platform Fee)", () => {
  /**
   * Tests for cleaner incentive - new cleaners get reduced platform fees
   */

  const calculateCleanerFee = ({
    grossAmount,
    standardFeePercent,
    feeReductionPercent,
    isEligible,
  }) => {
    if (!isEligible) {
      const platformFee = Math.round(grossAmount * standardFeePercent);
      return {
        platformFee,
        netAmount: grossAmount - platformFee,
        incentiveApplied: false,
        originalPlatformFee: null,
      };
    }

    const originalPlatformFee = Math.round(grossAmount * standardFeePercent);
    const reducedFeePercent = standardFeePercent * (1 - feeReductionPercent);
    const platformFee = Math.round(grossAmount * reducedFeePercent);

    return {
      platformFee,
      netAmount: grossAmount - platformFee,
      incentiveApplied: true,
      originalPlatformFee,
    };
  };

  it("should give full fee reduction (0% fee) for eligible cleaner", () => {
    const result = calculateCleanerFee({
      grossAmount: 10000, // $100
      standardFeePercent: 0.10,
      feeReductionPercent: 1.0, // 100% reduction = 0% fee
      isEligible: true,
    });

    expect(result.platformFee).toBe(0);
    expect(result.netAmount).toBe(10000); // Full $100
    expect(result.incentiveApplied).toBe(true);
    expect(result.originalPlatformFee).toBe(1000); // Would have been $10
  });

  it("should apply partial fee reduction for eligible cleaner", () => {
    const result = calculateCleanerFee({
      grossAmount: 10000,
      standardFeePercent: 0.10,
      feeReductionPercent: 0.50, // 50% reduction = 5% fee instead of 10%
      isEligible: true,
    });

    expect(result.platformFee).toBe(500); // 5% = $5
    expect(result.netAmount).toBe(9500);  // $95
    expect(result.incentiveApplied).toBe(true);
  });

  it("should apply standard fee for non-eligible cleaner", () => {
    const result = calculateCleanerFee({
      grossAmount: 10000,
      standardFeePercent: 0.10,
      feeReductionPercent: 1.0,
      isEligible: false,
    });

    expect(result.platformFee).toBe(1000); // Full 10%
    expect(result.netAmount).toBe(9000);   // $90
    expect(result.incentiveApplied).toBe(false);
  });
});
