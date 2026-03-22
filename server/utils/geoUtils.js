/**
 * GPS/Geographic Utility Functions
 */

// Default radius for verifying cleaner is at property (in meters)
const GPS_VERIFICATION_RADIUS_METERS = 200;

// Conversion factor
const MILES_TO_METERS = 1609.34;

// Cleaner radius restrictions
const MIN_SERVICE_RADIUS_MILES = 1;
const MAX_SERVICE_RADIUS_MILES = 30;
const MAX_BOOKING_DISTANCE_MILES = 30;
const MAX_BOOKING_DISTANCE_METERS = MAX_BOOKING_DISTANCE_MILES * MILES_TO_METERS;

/**
 * Calculate the distance between two GPS coordinates using the Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  // Handle null/undefined values
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return null;
  }

  // Convert to numbers if they're strings
  lat1 = parseFloat(lat1);
  lon1 = parseFloat(lon1);
  lat2 = parseFloat(lat2);
  lon2 = parseFloat(lon2);

  // Check for valid numbers
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return null;
  }

  const R = 6371000; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Return distance in meters, rounded to nearest meter
}

/**
 * Check if a cleaner is within acceptable distance of a property
 * @param {number} cleanerLat - Cleaner's latitude
 * @param {number} cleanerLon - Cleaner's longitude
 * @param {number} homeLat - Property's latitude
 * @param {number} homeLon - Property's longitude
 * @param {number} [radiusMeters] - Optional custom radius (default: GPS_VERIFICATION_RADIUS_METERS)
 * @returns {{ isWithinRadius: boolean, distance: number|null }} Result with distance info
 */
function isWithinRadius(cleanerLat, cleanerLon, homeLat, homeLon, radiusMeters = GPS_VERIFICATION_RADIUS_METERS) {
  const distance = calculateDistance(cleanerLat, cleanerLon, homeLat, homeLon);

  if (distance === null) {
    return {
      isWithinRadius: null, // Can't determine
      distance: null,
    };
  }

  return {
    isWithinRadius: distance <= radiusMeters,
    distance,
  };
}

/**
 * Validate service area radius value
 * @param {number} radiusMiles - Radius in miles to validate
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
function validateServiceRadius(radiusMiles) {
  const radius = parseFloat(radiusMiles);

  if (isNaN(radius)) {
    return { valid: false, value: null, error: "Service radius must be a number" };
  }

  if (radius < MIN_SERVICE_RADIUS_MILES) {
    return { valid: false, value: radius, error: `Service radius must be at least ${MIN_SERVICE_RADIUS_MILES} mile` };
  }

  if (radius > MAX_SERVICE_RADIUS_MILES) {
    return { valid: false, value: radius, error: `Service radius cannot exceed ${MAX_SERVICE_RADIUS_MILES} miles` };
  }

  return { valid: true, value: radius, error: null };
}

/**
 * Check if a cleaner is within booking distance of a home
 * @param {number} cleanerLat - Cleaner's service area latitude
 * @param {number} cleanerLon - Cleaner's service area longitude
 * @param {number} homeLat - Home's latitude
 * @param {number} homeLon - Home's longitude
 * @returns {{ canBook: boolean|null, distanceMeters: number|null, distanceMiles: number|null, error: string|null }}
 */
function checkBookingDistance(cleanerLat, cleanerLon, homeLat, homeLon) {
  const distanceMeters = calculateDistance(cleanerLat, cleanerLon, homeLat, homeLon);

  if (distanceMeters === null) {
    return {
      canBook: null,
      distanceMeters: null,
      distanceMiles: null,
      error: "Unable to calculate distance - missing coordinates",
    };
  }

  const distanceMilesRaw = distanceMeters / MILES_TO_METERS;
  const distanceMiles = Math.round(distanceMilesRaw * 10) / 10;
  const canBook = distanceMeters <= MAX_BOOKING_DISTANCE_METERS;

  return {
    canBook,
    distanceMeters,
    distanceMiles,
    error: canBook ? null : `This job is ${distanceMiles} miles away, which exceeds the maximum booking distance of ${MAX_BOOKING_DISTANCE_MILES} miles`,
  };
}

module.exports = {
  GPS_VERIFICATION_RADIUS_METERS,
  MILES_TO_METERS,
  MIN_SERVICE_RADIUS_MILES,
  MAX_SERVICE_RADIUS_MILES,
  MAX_BOOKING_DISTANCE_MILES,
  MAX_BOOKING_DISTANCE_METERS,
  calculateDistance,
  isWithinRadius,
  validateServiceRadius,
  checkBookingDistance,
};
