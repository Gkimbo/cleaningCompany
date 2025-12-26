const crypto = require("crypto");
const { User } = require("../models");

/**
 * Generates a secure random password that meets validation requirements:
 * - At least 12 characters
 * - Contains uppercase letter
 * - Contains lowercase letter
 * - Contains number
 * - Contains special character
 */
function generateSecurePassword(length = 12) {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%&*";
  const allChars = uppercase + lowercase + numbers + special;

  // Ensure at least one of each required character type
  let password = "";
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];

  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Shuffle the password to avoid predictable pattern
  const passwordArray = password.split("");
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }

  return passwordArray.join("");
}

/**
 * Generates a unique username from first and last name.
 * Format: firstname_lastname (lowercase, no spaces)
 * If taken, appends random 3-digit number.
 */
async function generateUniqueUsername(firstName, lastName) {
  // Clean and format the base username
  const cleanFirst = (firstName || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);
  const cleanLast = (lastName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);

  let baseUsername = cleanFirst;
  if (cleanLast) {
    baseUsername += "_" + cleanLast;
  }

  // Ensure minimum length of 4 characters
  if (baseUsername.length < 4) {
    baseUsername = baseUsername.padEnd(4, "0");
  }

  // Check if base username is available
  let username = baseUsername;
  let existingUser = await User.findOne({ where: { username } });

  // If taken, try with random suffix
  let attempts = 0;
  while (existingUser && attempts < 100) {
    const suffix = crypto.randomInt(100, 999);
    username = `${baseUsername}${suffix}`;
    existingUser = await User.findOne({ where: { username } });
    attempts++;
  }

  if (existingUser) {
    // Fallback: use timestamp-based suffix
    const timestamp = Date.now().toString().slice(-6);
    username = `${cleanFirst}${timestamp}`;
  }

  return username;
}

module.exports = {
  generateSecurePassword,
  generateUniqueUsername,
};
