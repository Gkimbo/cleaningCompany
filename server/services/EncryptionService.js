/**
 * EncryptionService - Handles encryption/decryption of PII data
 * Uses AES-256-CBC for encryption
 */

const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

class EncryptionService {
  /**
   * Get the encryption key from environment
   * @returns {Buffer} 32-byte encryption key
   * @throws {Error} If key is not set or invalid
   */
  static getKey() {
    const key = process.env.PII_ENCRYPTION_KEY;
    if (!key || key.length < 32) {
      // In development, warn but don't crash
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "WARNING: PII_ENCRYPTION_KEY not set or too short. PII encryption disabled in development."
        );
        return null;
      }
      throw new Error(
        "PII_ENCRYPTION_KEY must be set and at least 32 characters"
      );
    }
    return Buffer.from(key.slice(0, 32));
  }

  /**
   * Check if encryption is available
   * @returns {boolean} True if encryption key is configured
   */
  static isEnabled() {
    const key = process.env.PII_ENCRYPTION_KEY;
    return key && key.length >= 32;
  }

  /**
   * Encrypt a string value
   * @param {string} text - Plain text to encrypt
   * @returns {string|null} Encrypted string (iv:ciphertext) or null if input is empty
   */
  static encrypt(text) {
    if (!text) return null;

    const key = this.getKey();
    if (!key) {
      // Encryption disabled in development
      return text;
    }

    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");
      return iv.toString("hex") + ":" + encrypted;
    } catch (error) {
      console.error("Encryption error:", error.message);
      throw new Error("Failed to encrypt data");
    }
  }

  /**
   * Decrypt an encrypted string
   * @param {string} encryptedText - Encrypted string (iv:ciphertext format)
   * @returns {string|null} Decrypted plain text or null if input is empty
   */
  static decrypt(encryptedText) {
    if (!encryptedText) return null;

    const key = this.getKey();
    if (!key) {
      // Encryption disabled in development
      return encryptedText;
    }

    // Check if this looks like encrypted data (has iv:ciphertext format)
    if (!encryptedText.includes(":")) {
      // Data is not encrypted, return as-is (for backwards compatibility)
      return encryptedText;
    }

    try {
      const [ivHex, encrypted] = encryptedText.split(":");
      if (!ivHex || !encrypted) {
        return encryptedText; // Not properly formatted, return as-is
      }

      const iv = Buffer.from(ivHex, "hex");
      if (iv.length !== IV_LENGTH) {
        return encryptedText; // Invalid IV, return as-is
      }

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (error) {
      // If decryption fails, data might not be encrypted
      console.warn("Decryption warning - data may not be encrypted:", error.message);
      return encryptedText;
    }
  }

  /**
   * Create a deterministic hash for searching
   * This allows searching for encrypted values without decrypting all records
   * @param {string} text - Plain text to hash
   * @returns {string|null} Hash string or null if input is empty
   */
  static hash(text) {
    if (!text) return null;

    const key = this.getKey();
    if (!key) {
      // In development without key, use simple lowercase
      return text.toLowerCase();
    }

    try {
      return crypto
        .createHmac("sha256", key)
        .update(text.toLowerCase().trim())
        .digest("hex");
    } catch (error) {
      console.error("Hash error:", error.message);
      throw new Error("Failed to hash data");
    }
  }

  /**
   * Encrypt an email address
   * @param {string} email - Email to encrypt
   * @returns {object} Object with encrypted email and hash for searching
   */
  static encryptEmail(email) {
    if (!email) return { encrypted: null, hash: null };

    return {
      encrypted: this.encrypt(email),
      hash: this.hash(email),
    };
  }

  /**
   * Encrypt a phone number
   * @param {string} phone - Phone to encrypt
   * @returns {string|null} Encrypted phone or null
   */
  static encryptPhone(phone) {
    return this.encrypt(phone);
  }

  /**
   * Encrypt an address
   * @param {string} address - Address to encrypt
   * @returns {string|null} Encrypted address or null
   */
  static encryptAddress(address) {
    return this.encrypt(address);
  }
}

module.exports = EncryptionService;
