/**
 * Price Calculation Service
 * Uses pricing values from database via getPricingConfig()
 */
const { getPricingConfig } = require("../config/businessConfig");

/**
 * Calculate the price for linen services
 * @param {Array} sheetConfigs - Array of bed configurations with needsSheets flag
 * @param {Array} towelConfigs - Array of bathroom configurations with towel/facecloth counts
 * @param {Object} pricingConfig - Optional: pricing config (fetched if not provided)
 * @returns {Promise<number>} Total linen price
 */
const calculateLinenPrice = async (sheetConfigs, towelConfigs, pricingConfig = null) => {
  const pricing = pricingConfig || await getPricingConfig();
  let price = 0;
  const { sheetFeePerBed, towelFee, faceClothFee } = pricing.linens;

  // Sheets: per bed needing sheets
  if (sheetConfigs && Array.isArray(sheetConfigs)) {
    const bedsNeedingSheets = sheetConfigs.filter((b) => b.needsSheets).length;
    price += bedsNeedingSheets * sheetFeePerBed;
  }

  // Towels and face cloths
  if (towelConfigs && Array.isArray(towelConfigs)) {
    towelConfigs.forEach((bathroom) => {
      price += (bathroom.towels || 0) * towelFee;
      price += (bathroom.faceCloths || 0) * faceClothFee;
    });
  }

  return price;
};

/**
 * Calculate appointment price
 * @param {string} sheets - "yes" or "no" - whether company brings sheets
 * @param {string} towels - "yes" or "no" - whether company brings towels
 * @param {string|number} numBeds - Number of bedrooms
 * @param {string|number} numBaths - Number of bathrooms
 * @param {string} timeToBeCompleted - Time window preference
 * @param {Array} sheetConfigs - Optional: specific bed configurations
 * @param {Array} towelConfigs - Optional: specific bathroom configurations
 * @param {Object} pricingConfig - Optional: pricing config (fetched if not provided)
 * @returns {Promise<number>} Total appointment price
 */
const calculatePrice = async (
  sheets,
  towels,
  numBeds,
  numBaths,
  timeToBeCompleted,
  sheetConfigs = null,
  towelConfigs = null,
  pricingConfig = null
) => {
  const pricing = pricingConfig || await getPricingConfig();
  let price = 0;
  // Fallbacks match database defaults in case pricing config is incomplete
  const basePrice = pricing?.basePrice ?? 150;
  const extraBedBathFee = pricing?.extraBedBathFee ?? 50;
  const halfBathFee = pricing?.halfBathFee ?? 25;
  const sheetFeePerBed = pricing?.linens?.sheetFeePerBed ?? 30;
  const towelFee = pricing?.linens?.towelFee ?? 5;
  const faceClothFee = pricing?.linens?.faceClothFee ?? 2;

  // Time window surcharge (timeWindows values can be objects with surcharge property or plain numbers)
  const timeWindowValue = pricing.timeWindows?.[timeToBeCompleted];
  const timeSurcharge = typeof timeWindowValue === 'object'
    ? (timeWindowValue?.surcharge || 0)
    : (timeWindowValue || 0);
  price += Number(timeSurcharge) || 0;

  // Linen pricing
  if (sheets === "yes") {
    if (sheetConfigs && Array.isArray(sheetConfigs)) {
      // Use specific configurations
      const bedsNeedingSheets = sheetConfigs.filter((b) => b.needsSheets).length;
      price += bedsNeedingSheets * sheetFeePerBed;
    } else {
      // Fallback: charge for all beds if no specific config
      price += Number(numBeds) * sheetFeePerBed;
    }
  }

  if (towels === "yes") {
    if (towelConfigs && Array.isArray(towelConfigs)) {
      // Use specific configurations
      towelConfigs.forEach((bathroom) => {
        price += (bathroom.towels || 0) * towelFee;
        price += (bathroom.faceCloths || 0) * faceClothFee;
      });
    } else {
      // Fallback: default 2 towels + 1 face cloth per bathroom if no specific config
      const defaultTowelPrice = Number(numBaths) * (2 * towelFee + 1 * faceClothFee);
      price += defaultTowelPrice;
    }
  }

  // Base price calculation
  const beds = Number(numBeds);
  const baths = parseFloat(numBaths) || 0;
  const fullBaths = Math.floor(baths);
  const hasHalfBath = (baths % 1) >= 0.5;

  const extraBeds = Math.max(0, beds - 1);
  const extraFullBaths = Math.max(0, fullBaths - 1);
  const halfBathCount = hasHalfBath ? 1 : 0;

  price += basePrice + (extraBeds * extraBedBathFee) + (extraFullBaths * extraBedBathFee) + (halfBathCount * halfBathFee);

  return price;
};

/**
 * Check if an appointment date qualifies as last-minute booking
 * @param {string} appointmentDate - The appointment date (YYYY-MM-DD format)
 * @param {Object} pricingConfig - Optional pricing config
 * @returns {Promise<{isLastMinute: boolean, fee: number, hoursUntil: number, thresholdHours: number}>}
 */
const checkLastMinuteBooking = async (appointmentDate, pricingConfig = null) => {
  const pricing = pricingConfig || (await getPricingConfig());
  const thresholdHours = pricing?.lastMinute?.thresholdHours ?? 48;
  const fee = pricing?.lastMinute?.fee ?? 50;

  const now = new Date();
  const appointmentDateTime = new Date(appointmentDate);

  // If date is just YYYY-MM-DD, set to 9am (typical start time)
  if (appointmentDate.length === 10) {
    appointmentDateTime.setHours(9, 0, 0, 0);
  }

  const hoursUntil = (appointmentDateTime - now) / (1000 * 60 * 60);

  // Last-minute if: future date AND within threshold hours
  const isLastMinute = hoursUntil > 0 && hoursUntil <= thresholdHours;

  return {
    isLastMinute,
    fee: isLastMinute ? fee : 0,
    hoursUntil: Math.round(hoursUntil),
    thresholdHours,
  };
};

module.exports = calculatePrice;
module.exports.calculateLinenPrice = calculateLinenPrice;
module.exports.checkLastMinuteBooking = checkLastMinuteBooking;
