/**
 * Utility functions for handling sheets and towels display,
 * especially for multi-cleaner jobs where each cleaner only
 * brings linens for their assigned rooms.
 */

/**
 * Safely parses a config that might be a JSON string or already an array
 * @param {Array|string|null} config - Config that might be JSON string
 * @returns {Array} - Parsed array or empty array
 */
const parseConfig = (config) => {
  if (!config) return [];
  if (Array.isArray(config)) return config;
  if (typeof config === 'string') {
    try {
      const parsed = JSON.parse(config);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

/**
 * Groups bed configurations by size and returns formatted string
 * @param {Array|string} beds - Array of { bedNumber, size, needsSheets } or JSON string
 * @returns {string} - e.g., "2 Queen, 1 Full, 1 King"
 */
export const formatBedSizes = (beds) => {
  const parsedBeds = parseConfig(beds);
  if (parsedBeds.length === 0) return "";

  const sizeCounts = {};
  parsedBeds.filter(b => b.needsSheets !== false).forEach(bed => {
    const size = bed.size || "Standard";
    // Capitalize and format size (e.g., "california_king" -> "California King")
    const displaySize = size
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    sizeCounts[displaySize] = (sizeCounts[displaySize] || 0) + 1;
  });

  return Object.entries(sizeCounts)
    .map(([size, count]) => `${count} ${size}`)
    .join(", ");
};

/**
 * Filters bed configurations to only include beds in assigned rooms
 * @param {Array|string} bedConfigs - All bed configurations (array or JSON string)
 * @param {Array} roomAssignments - Cleaner's assigned rooms
 * @returns {Array} - Filtered bed configurations
 */
export const filterBedsForCleaner = (bedConfigs, roomAssignments) => {
  const parsedConfigs = parseConfig(bedConfigs);
  if (parsedConfigs.length === 0) return parsedConfigs;
  if (!roomAssignments || roomAssignments.length === 0) return parsedConfigs;

  const assignedBedrooms = roomAssignments
    .filter(r => r.roomType === "bedroom")
    .map(r => r.roomNumber);

  // If no bedrooms assigned, return all (fallback for edge cases)
  if (assignedBedrooms.length === 0) return parsedConfigs;

  return parsedConfigs.filter(bed => assignedBedrooms.includes(bed.bedNumber));
};

/**
 * Filters bathroom configurations to only include assigned bathrooms
 * @param {Array|string} bathroomConfigs - All bathroom configurations (array or JSON string)
 * @param {Array} roomAssignments - Cleaner's assigned rooms
 * @returns {Array} - Filtered bathroom configurations
 */
export const filterBathroomsForCleaner = (bathroomConfigs, roomAssignments) => {
  const parsedConfigs = parseConfig(bathroomConfigs);
  if (parsedConfigs.length === 0) return parsedConfigs;
  if (!roomAssignments || roomAssignments.length === 0) return parsedConfigs;

  const assignedBathrooms = roomAssignments
    .filter(r => r.roomType === "bathroom")
    .map(r => r.roomNumber);

  // If no bathrooms assigned, return all (fallback for edge cases)
  if (assignedBathrooms.length === 0) return parsedConfigs;

  return parsedConfigs.filter(bath => assignedBathrooms.includes(bath.bathroomNumber));
};

/**
 * Calculates total towels and facecloths for given bathroom configs
 * @param {Array|string} bathroomConfigs - Bathroom configs (array or JSON string)
 * @returns {{ towels: number, faceCloths: number }}
 */
export const getTowelTotals = (bathroomConfigs) => {
  const parsedConfigs = parseConfig(bathroomConfigs);
  if (parsedConfigs.length === 0) {
    return { towels: 0, faceCloths: 0 };
  }

  return parsedConfigs.reduce((acc, bath) => ({
    towels: acc.towels + (bath.towels || 0),
    faceCloths: acc.faceCloths + (bath.faceCloths || 0)
  }), { towels: 0, faceCloths: 0 });
};

/**
 * Gets effective sheet configurations for a cleaner
 * For multi-cleaner jobs, filters to only assigned bedrooms
 * @param {Array|string} sheetConfigs - All sheet configurations (array or JSON string)
 * @param {Array} roomAssignments - Cleaner's assigned rooms (null for solo jobs)
 * @param {boolean} isMultiCleanerJob - Whether this is a multi-cleaner job
 * @returns {Array} - Effective sheet configurations
 */
export const getEffectiveSheetConfigs = (sheetConfigs, roomAssignments, isMultiCleanerJob) => {
  const parsedConfigs = parseConfig(sheetConfigs);
  if (!isMultiCleanerJob || !roomAssignments || roomAssignments.length === 0) {
    return parsedConfigs;
  }
  return filterBedsForCleaner(parsedConfigs, roomAssignments);
};

/**
 * Gets effective towel configurations for a cleaner
 * For multi-cleaner jobs, filters to only assigned bathrooms
 * @param {Array|string} towelConfigs - All towel configurations (array or JSON string)
 * @param {Array} roomAssignments - Cleaner's assigned rooms (null for solo jobs)
 * @param {boolean} isMultiCleanerJob - Whether this is a multi-cleaner job
 * @returns {Array} - Effective towel configurations
 */
export const getEffectiveTowelConfigs = (towelConfigs, roomAssignments, isMultiCleanerJob) => {
  const parsedConfigs = parseConfig(towelConfigs);
  if (!isMultiCleanerJob || !roomAssignments || roomAssignments.length === 0) {
    return parsedConfigs;
  }
  return filterBathroomsForCleaner(parsedConfigs, roomAssignments);
};
