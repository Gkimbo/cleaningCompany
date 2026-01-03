/**
 * SuspiciousContentDetector
 *
 * Detects suspicious content in messages that may indicate
 * attempts to communicate or transact off the platform.
 *
 * Used for appointment conversations to warn recipients about
 * potential off-platform deals or contact sharing.
 */
class SuspiciousContentDetector {
  // Patterns for detecting suspicious content
  static patterns = {
    // US phone number formats: 123-456-7890, (123) 456-7890, 123.456.7890, 1234567890, +1 123-456-7890
    phoneNumber: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,

    // Standard email format
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i,

    // Keywords indicating off-platform payment or communication attempts
    offPlatformKeywords:
      /\b(venmo|cash\s*app|cashapp|paypal|zelle|text\s*me|call\s*me|my\s*(phone\s*)?number\s*(is)?|my\s*email\s*(is)?|off\s*(the\s*)?app|outside\s*(the\s*)?app|pay\s*(me\s*)?(in\s*)?cash|pay\s*(me\s*)?directly|whatsapp|telegram|signal)\b/i,
  };

  /**
   * Detect suspicious content in a message
   * @param {string} content - The message content to analyze
   * @returns {Object} - Detection result with isSuspicious flag and types array
   */
  static detect(content) {
    if (!content || typeof content !== "string") {
      return {
        isSuspicious: false,
        types: [],
      };
    }

    const types = [];

    // Check for phone numbers
    if (this.patterns.phoneNumber.test(content)) {
      types.push("phone_number");
    }

    // Check for email addresses
    if (this.patterns.email.test(content)) {
      types.push("email");
    }

    // Check for off-platform keywords
    if (this.patterns.offPlatformKeywords.test(content)) {
      types.push("off_platform");
    }

    return {
      isSuspicious: types.length > 0,
      types,
    };
  }

  /**
   * Get a human-readable description of the suspicious content types
   * @param {Array} types - Array of suspicious content types
   * @returns {string} - Human-readable description
   */
  static getDescription(types) {
    if (!types || types.length === 0) {
      return "";
    }

    const descriptions = {
      phone_number: "phone number",
      email: "email address",
      off_platform: "off-platform communication attempt",
    };

    const readableTypes = types.map((type) => descriptions[type] || type);

    if (readableTypes.length === 1) {
      return readableTypes[0];
    }

    if (readableTypes.length === 2) {
      return `${readableTypes[0]} and ${readableTypes[1]}`;
    }

    const last = readableTypes.pop();
    return `${readableTypes.join(", ")}, and ${last}`;
  }
}

module.exports = SuspiciousContentDetector;
