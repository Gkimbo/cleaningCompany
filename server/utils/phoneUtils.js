/**
 * Phone number utility functions
 * Supports both US and international phone numbers
 */

/**
 * Normalize a phone number for storage
 * - US numbers (10 digits): stored as digits only "5555555555"
 * - US numbers with country code (11 digits starting with 1): stored as "+15555555555"
 * - International numbers (with + prefix): stored with + and digits "+442071234567"
 *
 * @param {string} phone - Phone number in any format
 * @returns {string|null} - Normalized phone number or null if invalid
 */
const normalizePhone = (phone) => {
  if (!phone || typeof phone !== "string") {
    return null;
  }

  const trimmed = phone.trim();

  // Check if it's an international number (starts with +)
  const isInternational = trimmed.startsWith("+");

  // Remove all non-digit characters (except we'll add + back for international)
  const digits = trimmed.replace(/\D/g, "");

  // Return null if no digits
  if (digits.length === 0) {
    return null;
  }

  // International number - preserve the + prefix
  if (isInternational) {
    return "+" + digits;
  }

  // US number with country code (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith("1")) {
    return "+" + digits; // Store as +1XXXXXXXXXX for consistency
  }

  // Standard US number (10 digits) - store as digits only
  if (digits.length === 10) {
    return digits;
  }

  // For other lengths, store with + if it looks like international (more than 10 digits)
  if (digits.length > 10) {
    return "+" + digits;
  }

  // Return digits for shorter numbers (could be local/extension)
  return digits;
};

/**
 * Format a phone number for display
 * - US numbers (10 digits): "555-555-5555"
 * - US numbers with +1: "+1 555-555-5555"
 * - International numbers: "+XX XXX XXX XXXX" (grouped)
 *
 * @param {string} phone - Phone number (can be normalized or with formatting)
 * @returns {string} - Formatted phone number or original if can't format
 */
const formatPhoneForDisplay = (phone) => {
  if (!phone) {
    return "";
  }

  const trimmed = phone.trim();
  const isInternational = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  // US number without country code (10 digits)
  if (!isInternational && digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // US number with +1 country code (11 digits starting with 1)
  if (isInternational && digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Other international numbers - format with spaces for readability
  if (isInternational && digits.length > 0) {
    // Format: +XX XXX XXX XXXX (country code + groups of 3-4)
    const countryCode = digits.slice(0, 2);
    const rest = digits.slice(2);

    // Group remaining digits in chunks of 3-4
    const groups = [];
    for (let i = 0; i < rest.length; i += 3) {
      groups.push(rest.slice(i, i + 3));
    }

    return `+${countryCode} ${groups.join(" ")}`;
  }

  // Return original if we can't format
  return phone;
};

/**
 * Check if a phone number appears to be international
 * @param {string} phone - Phone number
 * @returns {boolean} - True if international
 */
const isInternationalPhone = (phone) => {
  if (!phone) return false;
  const trimmed = phone.trim();
  return trimmed.startsWith("+") || trimmed.replace(/\D/g, "").length > 10;
};

module.exports = {
  normalizePhone,
  formatPhoneForDisplay,
  isInternationalPhone,
};
