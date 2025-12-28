/**
 * Date utility functions to handle timezone issues
 *
 * Problem: When parsing a date string like "2025-01-15" with new Date(),
 * JavaScript interprets it as midnight UTC. When displayed in local timezone,
 * this can shift the date back by one day (e.g., shows Jan 14 instead of Jan 15).
 *
 * Solution: Parse date strings as local time, not UTC.
 */

/**
 * Parse a date string (YYYY-MM-DD) as local time instead of UTC
 * This prevents the off-by-one-day issue caused by timezone conversion
 *
 * @param {string} dateString - Date string in format "YYYY-MM-DD" or ISO format
 * @returns {Date} - Date object in local timezone
 */
export const parseLocalDate = (dateString) => {
  if (!dateString) return new Date();

  // If it's already a Date object, return it
  if (dateString instanceof Date) return dateString;

  // Handle ISO format with time component (already has timezone info)
  if (dateString.includes("T")) {
    return new Date(dateString);
  }

  // For date-only strings like "2025-01-15", parse as local time
  // by using the Date constructor with individual components
  const parts = dateString.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }

  // Fallback: try standard parsing
  return new Date(dateString);
};

/**
 * Format a date for display
 * @param {string|Date} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string
 */
export const formatDate = (date, options = {}) => {
  const parsedDate = parseLocalDate(date);
  const defaultOptions = { weekday: "short", month: "short", day: "numeric" };
  return parsedDate.toLocaleDateString("en-US", { ...defaultOptions, ...options });
};

/**
 * Check if a date is today
 * @param {string|Date} date - Date to check
 * @returns {boolean}
 */
export const isToday = (date) => {
  const parsedDate = parseLocalDate(date);
  const today = new Date();
  return parsedDate.toDateString() === today.toDateString();
};

/**
 * Check if a date is in the future (including today)
 * @param {string|Date} date - Date to check
 * @returns {boolean}
 */
export const isFutureOrToday = (date) => {
  const parsedDate = parseLocalDate(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsedDate.setHours(0, 0, 0, 0);
  return parsedDate >= today;
};

/**
 * Check if a date is in the past (before today)
 * @param {string|Date} date - Date to check
 * @returns {boolean}
 */
export const isPast = (date) => {
  const parsedDate = parseLocalDate(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsedDate.setHours(0, 0, 0, 0);
  return parsedDate < today;
};

/**
 * Compare two dates for sorting
 * @param {string|Date} a - First date
 * @param {string|Date} b - Second date
 * @returns {number} - Negative if a < b, positive if a > b, 0 if equal
 */
export const compareDates = (a, b) => {
  return parseLocalDate(a) - parseLocalDate(b);
};

export default {
  parseLocalDate,
  formatDate,
  isToday,
  isFutureOrToday,
  isPast,
  compareDates,
};
