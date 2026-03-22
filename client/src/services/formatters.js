/**
 * Formatters utility service
 * Provides formatting functions for currency, dates, and other values
 */

/**
 * Format cents to currency string
 * @param {number} cents - Amount in cents
 * @param {boolean} showDecimals - Whether to show decimal places (default: true)
 * @returns {string} Formatted currency string (e.g., "$12.50")
 */
export const formatCurrency = (cents, showDecimals = true) => {
  const dollars = (cents || 0) / 100;
  if (showDecimals) {
    return `$${dollars.toFixed(2)}`;
  }
  return `$${Math.round(dollars)}`;
};

/**
 * Format a number with commas for thousands
 * @param {number} num - Number to format
 * @returns {string} Formatted number string (e.g., "1,234")
 */
export const formatNumber = (num) => {
  return (num || 0).toLocaleString();
};

/**
 * Format a percentage value
 * @param {number} value - Decimal value (e.g., 0.15 for 15%)
 * @param {number} decimals - Number of decimal places (default: 0)
 * @returns {string} Formatted percentage string (e.g., "15%")
 */
export const formatPercent = (value, decimals = 0) => {
  return `${((value || 0) * 100).toFixed(decimals)}%`;
};

/**
 * Parse a date string safely without timezone shifts.
 * Uses noon (T12:00:00) to avoid off-by-one day errors at timezone boundaries.
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Date} Date object set to noon local time
 */
export const parseDateString = (dateString) => {
  if (!dateString) return new Date();
  // Use noon to avoid timezone edge cases that could shift the day
  return new Date(dateString + "T12:00:00");
};

/**
 * Format a YYYY-MM-DD date string for display (timezone-safe)
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDateString = (dateString, options = {}) => {
  if (!dateString) return "";
  const defaultOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  };
  const date = parseDateString(dateString);
  return date.toLocaleDateString("en-US", { ...defaultOptions, ...options });
};

/**
 * Format a date for full display (e.g., "Monday, January 15, 2025")
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Formatted full date string
 */
export const formatFullDate = (dateString) => {
  return formatDateString(dateString, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

/**
 * Format a date for short display (e.g., "Jan 15")
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Formatted short date string
 */
export const formatShortDate = (dateString) => {
  return formatDateString(dateString, {
    month: "short",
    day: "numeric",
  });
};

/**
 * Get the day of month from a date string (timezone-safe)
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {number} Day of month (1-31)
 */
export const getDateDay = (dateString) => {
  return parseDateString(dateString).getDate();
};

/**
 * Get the month name from a date string (timezone-safe)
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @param {string} format - "short" or "long" (default: "short")
 * @returns {string} Month name (e.g., "Jan" or "January")
 */
export const getDateMonth = (dateString, format = "short") => {
  return parseDateString(dateString).toLocaleDateString("en-US", { month: format });
};

/**
 * Check if a date string is today (timezone-safe)
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {boolean} True if the date is today
 */
export const isToday = (dateString) => {
  const date = parseDateString(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

/**
 * Get today's date as a YYYY-MM-DD string (timezone-safe for local time)
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Compare two date strings (timezone-safe)
 * @param {string} dateA - First date string in YYYY-MM-DD format
 * @param {string} dateB - Second date string in YYYY-MM-DD format
 * @returns {number} Negative if A < B, 0 if equal, positive if A > B
 */
export const compareDateStrings = (dateA, dateB) => {
  // Direct string comparison works for YYYY-MM-DD format
  if (dateA < dateB) return -1;
  if (dateA > dateB) return 1;
  return 0;
};

/**
 * Convert a Date object to YYYY-MM-DD string using local time (NOT UTC).
 * This avoids the timezone shift issue with toISOString().
 * @param {Date} date - Date object to convert
 * @returns {string} Date in YYYY-MM-DD format (local time)
 */
export const toLocalDateString = (date) => {
  if (!date || !(date instanceof Date)) {
    date = new Date();
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Get today's date as a YYYY-MM-DD string for a specific timezone
 * @param {string} timezone - IANA timezone identifier (e.g., "America/New_York")
 * @returns {string} Today's date in YYYY-MM-DD format for that timezone
 */
export const getTodayStringForTimezone = (timezone) => {
  if (!timezone) {
    return getTodayString();
  }
  try {
    // en-CA locale returns YYYY-MM-DD format
    return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  } catch (error) {
    // Fallback to local time if timezone is invalid
    return getTodayString();
  }
};

/**
 * Format a date string for display in a specific timezone
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @param {string} timezone - IANA timezone identifier (e.g., "America/New_York")
 * @param {object} options - Additional Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDateInTimezone = (dateString, timezone, options = {}) => {
  if (!dateString) return "";
  const date = parseDateString(dateString);
  const defaultOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  };
  const formatOptions = { ...defaultOptions, ...options };
  if (timezone) {
    formatOptions.timeZone = timezone;
  }
  try {
    return date.toLocaleDateString("en-US", formatOptions);
  } catch (error) {
    // Fallback without timezone if invalid
    return date.toLocaleDateString("en-US", { ...defaultOptions, ...options });
  }
};

/**
 * Check if a date string is today in a specific timezone
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @param {string} timezone - IANA timezone identifier
 * @returns {boolean} True if the date is today in that timezone
 */
export const isTodayInTimezone = (dateString, timezone) => {
  if (!timezone) {
    return isToday(dateString);
  }
  return dateString === getTodayStringForTimezone(timezone);
};
