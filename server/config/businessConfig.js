/**
 * Business Configuration
 *
 * This file contains all configurable business settings.
 * Modify the values here to change service areas, pricing, and other business rules.
 */

const businessConfig = {
  /**
   * SERVICE AREAS
   *
   * Define which cities/areas you service.
   * Set enabled: true to restrict to specific areas, false to service all valid US zipcodes.
   *
   * You can define areas by:
   * - cities: Array of city names (case-insensitive)
   * - states: Array of state abbreviations (e.g., "CA", "NY")
   * - zipcodes: Array of specific zipcodes or zipcode prefixes (e.g., "902" matches 90210, 90211, etc.)
   */
  serviceAreas: {
    enabled: true, // Set to false to disable area restrictions

    // Cities we service (case-insensitive matching)
    cities: [
      "Los Angeles",
      "Santa Monica",
      "Beverly Hills",
      "West Hollywood",
      "Culver City",
      // Add more cities here
    ],

    // States we service (use 2-letter abbreviations)
    states: [
      "CA",
      // Add more states here
    ],

    // Specific zipcodes or prefixes we service
    // Use full zipcode (e.g., "90210") or prefix (e.g., "902" matches all 902xx)
    zipcodes: [
      // "90210",
      // "902", // Matches all zipcodes starting with 902
      // Add more zipcodes here
    ],

    // Error message shown when address is outside service area
    outsideAreaMessage: "We don't currently service this area. We're expanding soon!",
  },

  /**
   * PRICING CONFIGURATION
   */
  pricing: {
    // Time window surcharges
    timeWindows: {
      "anytime": 0,
      "10-3": 30,
      "11-4": 30,
      "12-2": 50,
    },

    // Add-on services
    addOns: {
      freshSheets: 25,
      freshTowels: 25,
    },

    // Cancellation fee per appointment (within cancellation window)
    cancellationFee: 25,

    // Days before appointment when cancellation fee applies
    cancellationWindowDays: 7,
  },

  /**
   * CLEANER REQUIREMENTS
   * Based on number of bedrooms and bathrooms
   */
  cleanerRequirements: [
    { maxBeds: 2, maxBaths: 1, cleanersNeeded: 1 },
    { maxBeds: 2, maxBaths: 4, cleanersNeeded: 2 },
    { maxBeds: 4, maxBaths: 2, cleanersNeeded: 2 },
    { maxBeds: 3, maxBaths: 3, cleanersNeeded: 2 },
    { maxBeds: 6, maxBaths: 3, cleanersNeeded: 3 },
    { maxBeds: 8, maxBaths: 4, cleanersNeeded: 4 },
    { maxBeds: 10, maxBaths: 5, cleanersNeeded: 5 },
    { maxBeds: 12, maxBaths: 6, cleanersNeeded: 6 },
  ],
};

/**
 * Helper function to check if an address is within the service area
 * @param {string} city - City name
 * @param {string} state - State abbreviation
 * @param {string} zipcode - 5-digit zipcode
 * @returns {object} { isServiceable: boolean, message: string }
 */
function isInServiceArea(city, state, zipcode) {
  const { serviceAreas } = businessConfig;

  // If service area restriction is disabled, allow all valid addresses
  if (!serviceAreas.enabled) {
    return { isServiceable: true, message: "" };
  }

  const normalizedCity = city?.toLowerCase().trim();
  const normalizedState = state?.toUpperCase().trim();
  const normalizedZipcode = zipcode?.trim();

  // Check if city is in service area
  const cityMatch = serviceAreas.cities.some(
    (serviceCity) => serviceCity.toLowerCase() === normalizedCity
  );

  // Check if state is in service area
  const stateMatch = serviceAreas.states.some(
    (serviceState) => serviceState.toUpperCase() === normalizedState
  );

  // Check if zipcode matches (exact or prefix)
  const zipcodeMatch = serviceAreas.zipcodes.some((serviceZip) =>
    normalizedZipcode.startsWith(serviceZip)
  );

  // Address is serviceable if city matches AND state matches, OR if zipcode matches
  const isServiceable = (cityMatch && stateMatch) || zipcodeMatch;

  return {
    isServiceable,
    message: isServiceable ? "" : serviceAreas.outsideAreaMessage,
  };
}

/**
 * Helper function to get number of cleaners needed
 * @param {number} numBeds - Number of bedrooms
 * @param {number} numBaths - Number of bathrooms
 * @returns {number} Number of cleaners needed
 */
function getCleanersNeeded(numBeds, numBaths) {
  const beds = parseInt(numBeds) || 0;
  const baths = parseInt(numBaths) || 0;

  for (const rule of businessConfig.cleanerRequirements) {
    if (beds <= rule.maxBeds && baths <= rule.maxBaths) {
      return rule.cleanersNeeded;
    }
  }

  // Default to max if no rule matches
  return 6;
}

/**
 * Helper function to calculate time window surcharge
 * @param {string} timeWindow - Time window selection
 * @returns {number} Surcharge amount
 */
function getTimeWindowSurcharge(timeWindow) {
  return businessConfig.pricing.timeWindows[timeWindow] || 0;
}

module.exports = {
  businessConfig,
  isInServiceArea,
  getCleanersNeeded,
  getTimeWindowSurcharge,
};
