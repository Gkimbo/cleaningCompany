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
      "Barnstable",
      "West Barnstable",
      "Centerville",
      "Cotuit",
      "Craigville",
      "Cummaquid",
      "Hyannis",
      "Hyannis Port",
      "Marstons Mills",
      "Osterville",
      "Santuit",
      "West Barnstable",
      "West Hyannis Port",
      "Wianno",
      // Add more cities here
    ],

    // States we service (use 2-letter abbreviations)
    states: [
      "MA",
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
    outsideAreaMessage:
      "We don't currently service this area. We're expanding soon!",
  },

  /**
   * PRICING CONFIGURATION
   * Single source of truth for all pricing in the backend
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
      anytime: 0,
      "10-3": 25,
      "11-4": 25,
      "12-2": 30,
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

/**
 * Update service area status for all homes in the database
 * Call this function after modifying service area configuration
 * @param {object} UserHomes - Sequelize model for UserHomes
 * @param {object} User - Sequelize model for User (optional, for notifications)
 * @param {object} EmailClass - Email class for sending notifications (optional)
 * @returns {object} { updated: number, results: Array }
 */
async function updateAllHomesServiceAreaStatus(
  UserHomes,
  User = null,
  EmailClass = null
) {
  try {
    // Include user association if User model is provided
    const includeOptions = User
      ? [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "email", "notifications"],
          },
        ]
      : [];

    const allHomes = await UserHomes.findAll({ include: includeOptions });
    const results = [];
    let updatedCount = 0;

    for (const home of allHomes) {
      const { city, state, zipcode, address, nickName } = home.dataValues;
      const { isServiceable } = isInServiceArea(city, state, zipcode);
      const shouldBeOutside = !isServiceable;
      const wasOutside = home.dataValues.outsideServiceArea;

      // Only update if the status has changed
      if (wasOutside !== shouldBeOutside) {
        await home.update({ outsideServiceArea: shouldBeOutside });
        updatedCount++;

        const homeAddress = `${address}, ${city}, ${state} ${zipcode}`;
        const statusChange = shouldBeOutside ? "now_outside" : "now_inside";

        results.push({
          homeId: home.dataValues.id,
          nickName,
          city,
          state,
          zipcode,
          previousStatus: wasOutside ? "outside" : "inside",
          newStatus: shouldBeOutside ? "outside" : "inside",
        });

        // Send notifications if User model and home has user association
        if (User && home.user) {
          const user = home.user;
          const userName = user.username || "Valued Customer";

          // Create in-app notification
          const notification = {
            id: Date.now().toString() + "-" + home.dataValues.id,
            type:
              statusChange === "now_inside"
                ? "service_area_expanded"
                : "service_area_reduced",
            title:
              statusChange === "now_inside"
                ? "Great News - Your Home is Now in Our Service Area!"
                : "Service Area Update for Your Home",
            message:
              statusChange === "now_inside"
                ? `Your home "${nickName}" at ${homeAddress} is now within our service area! You can now book cleaning appointments.`
                : `Your home "${nickName}" at ${homeAddress} is currently outside our service area. You won't be able to book new appointments for this property until we expand to this area.`,
            homeId: home.dataValues.id,
            homeName: nickName,
            read: false,
            createdAt: new Date().toISOString(),
          };

          // Update user's notifications array
          const currentNotifications = user.notifications || [];
          await user.update({
            notifications: [...currentNotifications, notification],
          });

          // Send email notification
          if (EmailClass && user.email) {
            try {
              if (statusChange === "now_inside") {
                await EmailClass.sendHomeNowInServiceArea(
                  user.email,
                  userName,
                  nickName,
                  homeAddress
                );
              } else {
                await EmailClass.sendHomeNowOutsideServiceArea(
                  user.email,
                  userName,
                  nickName,
                  homeAddress
                );
              }
            } catch (emailError) {
              console.error(
                "Error sending service area notification email:",
                emailError
              );
            }
          }
        }
      }
    }

    return {
      totalHomes: allHomes.length,
      updated: updatedCount,
      results,
    };
  } catch (error) {
    console.error("Error updating homes service area status:", error);
    throw error;
  }
}

module.exports = {
  businessConfig,
  isInServiceArea,
  getCleanersNeeded,
  getTimeWindowSurcharge,
  updateAllHomesServiceAreaStatus,
};
