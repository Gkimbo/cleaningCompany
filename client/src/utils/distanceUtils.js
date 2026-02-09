/**
 * Distance and travel time calculation utilities
 * Used for navigation between cleaning jobs
 */

/**
 * Transport mode definitions with average speeds
 */
export const TRANSPORT_MODES = {
  driving: {
    id: "driving",
    label: "Drive",
    icon: "car",
    speedMph: 25, // Urban driving average
  },
  walking: {
    id: "walking",
    label: "Walk",
    icon: "male",
    speedMph: 3, // Average walking speed
  },
  transit: {
    id: "transit",
    label: "Transit",
    icon: "subway",
    speedMph: 12, // Includes wait times and stops
  },
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;

  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Convert kilometers to miles
 * @param {number} km - Distance in kilometers
 * @returns {number} Distance in miles
 */
export const kmToMiles = (km) => km * 0.621371;

/**
 * Estimate travel time based on distance and transport mode
 * @param {number} distanceMiles - Distance in miles
 * @param {string} mode - Transport mode (driving, walking, transit)
 * @returns {number} Estimated time in minutes
 */
export const estimateTravelTime = (distanceMiles, mode = "driving") => {
  if (!distanceMiles || distanceMiles <= 0) return 0;
  const speedMph = TRANSPORT_MODES[mode]?.speedMph || 25;
  const hours = distanceMiles / speedMph;
  return Math.round(hours * 60);
};

/**
 * Estimate drive time based on distance (legacy function for compatibility)
 * @param {number} distanceMiles - Distance in miles
 * @returns {number} Estimated time in minutes
 */
export const estimateDriveTime = (distanceMiles) => {
  return estimateTravelTime(distanceMiles, "driving");
};

/**
 * Format distance for display
 * @param {number} km - Distance in kilometers
 * @returns {string} Formatted distance string (e.g., "3.2 mi")
 */
export const formatDistance = (km) => {
  if (km === null || km === undefined) return null;
  const miles = kmToMiles(km);
  if (miles < 0.1) return "< 0.1 mi";
  return `${miles.toFixed(1)} mi`;
};

/**
 * Format travel time for display
 * @param {number} minutes - Time in minutes
 * @returns {string} Formatted time string (e.g., "~20 min")
 */
export const formatTravelTime = (minutes) => {
  if (!minutes || minutes < 1) return "< 1 min";
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `~${hours}h ${mins}m` : `~${hours}h`;
};

/**
 * Format drive time for display (legacy function for compatibility)
 */
export const formatDriveTime = formatTravelTime;

/**
 * Calculate navigation info between two locations
 * @param {Object} from - { latitude, longitude }
 * @param {Object} to - { latitude, longitude }
 * @param {string} mode - Transport mode (driving, walking, transit)
 * @returns {Object} Navigation info with times for specified mode
 */
export const calculateNavigation = (from, to, mode = "driving") => {
  if (!from?.latitude || !from?.longitude || !to?.latitude || !to?.longitude) {
    return {
      distanceKm: null,
      distanceMiles: null,
      travelTimeMinutes: null,
      driveTimeMinutes: null,
      formattedDistance: null,
      formattedTime: null,
      available: false,
      mode,
    };
  }

  const distanceKm = calculateDistance(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude
  );
  const distanceMiles = kmToMiles(distanceKm);
  const travelTimeMinutes = estimateTravelTime(distanceMiles, mode);

  return {
    distanceKm,
    distanceMiles,
    travelTimeMinutes,
    driveTimeMinutes: travelTimeMinutes, // Legacy compatibility
    formattedDistance: formatDistance(distanceKm),
    formattedTime: formatTravelTime(travelTimeMinutes),
    available: true,
    mode,
  };
};

/**
 * Calculate total navigation for a route (array of locations)
 * @param {Array} locations - Array of { latitude, longitude } objects
 * @returns {Object} { totalDistanceMiles, totalDriveTimeMinutes, formattedDistance, formattedTime, segments }
 */
export const calculateRouteTotal = (locations) => {
  if (!locations || locations.length < 2) {
    return {
      totalDistanceMiles: 0,
      totalDriveTimeMinutes: 0,
      formattedDistance: "0 mi",
      formattedTime: "0 min",
      segments: [],
    };
  }

  let totalDistanceKm = 0;
  const segments = [];

  for (let i = 0; i < locations.length - 1; i++) {
    const nav = calculateNavigation(locations[i], locations[i + 1]);
    segments.push(nav);
    if (nav.distanceKm) {
      totalDistanceKm += nav.distanceKm;
    }
  }

  const totalDistanceMiles = kmToMiles(totalDistanceKm);
  const totalDriveTimeMinutes = estimateDriveTime(totalDistanceMiles);

  return {
    totalDistanceMiles,
    totalDriveTimeMinutes,
    formattedDistance: formatDistance(totalDistanceKm),
    formattedTime: formatDriveTime(totalDriveTimeMinutes),
    segments,
  };
};
