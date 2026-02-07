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
