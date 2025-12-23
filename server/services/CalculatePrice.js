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
  const { basePrice, extraBedBathFee } = pricing;
  const { sheetFeePerBed, towelFee, faceClothFee } = pricing.linens;

  // Time window surcharge
  const timeSurcharge = pricing.timeWindows[timeToBeCompleted] || 0;
  price += timeSurcharge;

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
  const baths = Number(numBaths);
  const extraBeds = Math.max(0, beds - 1);
  const extraBaths = Math.max(0, baths - 1);

  price += basePrice + (extraBeds + extraBaths) * extraBedBathFee;

  return price;
};

module.exports = calculatePrice;
module.exports.calculateLinenPrice = calculateLinenPrice;
