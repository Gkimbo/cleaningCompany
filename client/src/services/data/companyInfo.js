/**
 * Company Information and Pricing Configuration
 * Single source of truth for all pricing in the frontend
 */

export const cleaningCompany = {
  location: "Barnstable, MA",
  maxDistance: 10,
  maxBookingDays: 14,
  cleaningHours: { start: 10, end: 16 },

  /**
   * PRICING CONFIGURATION
   * Must be kept in sync with server/config/businessConfig.js
   */
  pricing: {
    // Base cleaning rate
    basePrice: 150, // 1 bed/1 bath starting price
    extraBedBathFee: 50, // Per additional bedroom or bathroom

    // Linen services
    linens: {
      sheetFeePerBed: 30, // Per bed needing fresh sheets
      towelFee: 5, // Per towel
      faceClothFee: 2, // Per face cloth
    },

    // Time window surcharges
    timeWindows: {
      anytime: { surcharge: 0, label: "Anytime", description: "Most flexible, best pricing" },
      "10-3": { surcharge: 25, label: "10am - 3pm", description: "+$25 per cleaning" },
      "11-4": { surcharge: 25, label: "11am - 4pm", description: "+$25 per cleaning" },
      "12-2": { surcharge: 30, label: "12pm - 2pm", description: "+$30 per cleaning" },
    },

    // Cancellation policy
    cancellation: {
      fee: 25, // Flat cancellation fee
      windowDays: 7, // Days before appointment when fee applies
      homeownerPenaltyDays: 3, // Days before when homeowner gets partial refund
      cleanerPenaltyDays: 4, // Days before when cleaner gets penalty
      refundPercentage: 0.5, // Percentage refunded within penalty window (50%)
    },

    // Platform fees
    platform: {
      feePercent: 0.1, // 10% platform fee on cleaner payouts
    },

    // High volume day surcharge
    highVolumeFee: 50,
    highVolumeDays: ["holiday", "holiday weekend"],
  },

  // Backward-compatible flat accessors (for components not yet updated)
  get basePrice() { return this.pricing.basePrice; },
  get extraBedBathFee() { return this.pricing.extraBedBathFee; },
  get sheetFeePerBed() { return this.pricing.linens.sheetFeePerBed; },
  get towelFee() { return this.pricing.linens.towelFee; },
  get faceClothFee() { return this.pricing.linens.faceClothFee; },
  get cancellationFee() { return this.pricing.cancellation.fee; },
  get cancellationWindowDays() { return this.pricing.cancellation.windowDays; },
  get highVolumeFee() { return this.pricing.highVolumeFee; },
  get highVolumeDays() { return this.pricing.highVolumeDays; },

  // Marketing content
  bookingInfo: {
    description:
      "Clients can easily schedule cleaning appointments up to two weeks in advance. We offer flexible options for one-bedroom, one-bathroom, and studio rentals at a base price of $150. Additional charges of $50 per bed and bath apply, accommodating various property sizes. Clients can opt to provide their own clean sheets and pillowcases or request our cleaning service to handle this for an additional $30 per bed. Appointments are available daily between 10 am and 4 pm.",
  },

  specialConsiderations: {
    description:
      "On high-volume days, such as holidays or holiday weekends, an extra $50 fee will be applied to ensure availability and accommodate increased demand. This additional charge helps us manage the increased workload on these specific days.",
  },

  cancellationPolicy: {
    description:
      "We understand that plans can change. Clients can cancel appointments up to one week prior to the scheduled cleaning without incurring any fees. However, cancellations within one week of the cleaning date will result in a cancellation fee of $25. This policy is in place to account for the planning and resources allocated to each appointment.",
  },

  aboutService: {
    description:
      "Our goal is to deliver exceptional cleaning services that meet the unique needs of short-term rental properties. By maintaining transparency in our pricing, offering flexible booking options, and accommodating special requests, we aim to provide a seamless experience for both property owners and guests. Our dedicated team ensures that each property is thoroughly cleaned and prepared for the next set of visitors.",
  },

  ourWorryFreeGuarantee: {
    description:
      "When you trust your property to our team, you can rest easy knowing every turnover is handled with care and precision. We understand how important five-star reviews, on-time check-ins, and consistent cleanliness are to your success. You deserve the confidence that each guest will walk into a spotless, guest-ready space—every single time. We provide the peace of mind you're looking for with reliable, detail-driven turnover cleanings performed by friendly, trustworthy professionals. Our Worry-Free Guarantee reflects our commitment to going the extra mile so your rental always feels welcoming and professionally maintained.",
  },
};

/**
 * Time window options for form dropdowns
 * Pre-formatted for use in Select/Picker components
 */
export const TIME_WINDOW_OPTIONS = Object.entries(cleaningCompany.pricing.timeWindows).map(
  ([value, config]) => ({
    value,
    label: config.label,
    description: config.description,
    surcharge: config.surcharge,
  })
);

/**
 * Helper to get time window surcharge
 * @param {string} timeWindow - Time window key (e.g., "10-3")
 * @returns {number} Surcharge amount
 */
export const getTimeWindowSurcharge = (timeWindow) => {
  return cleaningCompany.pricing.timeWindows[timeWindow]?.surcharge || 0;
};

/**
 * Helper to calculate base cleaning price
 * @param {number} numBeds - Number of bedrooms
 * @param {number} numBaths - Number of bathrooms
 * @returns {number} Base price before add-ons
 */
export const calculateBasePrice = (numBeds, numBaths) => {
  const { basePrice, extraBedBathFee } = cleaningCompany.pricing;
  const extraBeds = Math.max(0, numBeds - 1);
  const extraBaths = Math.max(0, numBaths - 1);
  return basePrice + (extraBeds + extraBaths) * extraBedBathFee;
};
