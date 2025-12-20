/**
 * Calculate the price for linen services
 * @param {Array} sheetConfigs - Array of bed configurations with needsSheets flag
 * @param {Array} towelConfigs - Array of bathroom configurations with towel/facecloth counts
 * @returns {number} Total linen price
 */
const calculateLinenPrice = (sheetConfigs, towelConfigs) => {
  let price = 0;

  // Sheets: $30 per bed needing sheets
  if (sheetConfigs && Array.isArray(sheetConfigs)) {
    const bedsNeedingSheets = sheetConfigs.filter((b) => b.needsSheets).length;
    price += bedsNeedingSheets * 30;
  }

  // Towels: $10 each, Face cloths: $5 each
  if (towelConfigs && Array.isArray(towelConfigs)) {
    towelConfigs.forEach((bathroom) => {
      price += (bathroom.towels || 0) * 10;
      price += (bathroom.faceCloths || 0) * 5;
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
 * @returns {number} Total appointment price
 */
const calculatePrice = (
  sheets,
  towels,
  numBeds,
  numBaths,
  timeToBeCompleted,
  sheetConfigs = null,
  towelConfigs = null
) => {
  let price = 0;

  // Time window surcharge
  if (timeToBeCompleted === "anytime") {
    price += 0;
  } else if (timeToBeCompleted === "10-3") {
    price += 30;
  } else if (timeToBeCompleted === "11-4") {
    price += 30;
  } else if (timeToBeCompleted === "12-2") {
    price += 50;
  }

  // Linen pricing
  if (sheets === "yes") {
    if (sheetConfigs && Array.isArray(sheetConfigs)) {
      // Use specific configurations
      const bedsNeedingSheets = sheetConfigs.filter((b) => b.needsSheets).length;
      price += bedsNeedingSheets * 30;
    } else {
      // Fallback: charge for all beds if no specific config
      price += Number(numBeds) * 30;
    }
  }

  if (towels === "yes") {
    if (towelConfigs && Array.isArray(towelConfigs)) {
      // Use specific configurations
      towelConfigs.forEach((bathroom) => {
        price += (bathroom.towels || 0) * 10;
        price += (bathroom.faceCloths || 0) * 5;
      });
    } else {
      // Fallback: default 2 towels + 1 face cloth per bathroom if no specific config
      const defaultTowelPrice = Number(numBaths) * (2 * 10 + 1 * 5);
      price += defaultTowelPrice;
    }
  }

  // Base price calculation
  if (Number(numBeds) === 1 && Number(numBaths) === 1) {
    price = price + 100;
    return price;
  } else if (Number(numBeds) === 1) {
    const baths = (Number(numBaths) - 1) * 50;
    price += baths + 100;
    return price;
  } else if (Number(numBaths) === 1) {
    const beds = (Number(numBeds) - 1) * 50;
    price += beds + 100;
    return price;
  } else {
    const beds = (Number(numBeds) - 1) * 50;
    const baths = (Number(numBaths) - 1) * 50;
    price += beds + baths + 100;
    return price;
  }
};

module.exports = calculatePrice;
module.exports.calculateLinenPrice = calculateLinenPrice;
