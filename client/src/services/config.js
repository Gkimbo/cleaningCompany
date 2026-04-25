// Centralized configuration for cross-platform support
// ============================================================
// TO SWITCH TO PRODUCTION: Change ENVIRONMENT to "production"
// ============================================================
import { Platform } from "react-native";

// Environment configuration — automatically "production" in production builds, "development" otherwise
// __DEV__ is set by Expo/Metro: true during `expo start`, false in standalone/production builds
const ENVIRONMENT = typeof __DEV__ !== "undefined" && __DEV__ ? "development" : "production";

// Production URLs
const PRODUCTION_API_HOST = "https://api.kleanr.app";
const PRODUCTION_SOCKET_HOST = "https://api.kleanr.app";
const PRODUCTION_WEB_HOST = "https://kleanr.app";

// Development URLs (localhost)
const DEV_PORT = "3000";
const DEV_LOCALHOST = "localhost";
const DEV_ANDROID_HOST = "10.0.2.2"; // Android emulator uses this to access host machine

// Get the appropriate host based on environment and platform
const getDevHost = () => {
  if (Platform.OS === "android") {
    return DEV_ANDROID_HOST;
  }
  return DEV_LOCALHOST;
};

// API Base URL (includes /api/v1)
const getApiBase = () => {
  if (ENVIRONMENT === "production") {
    return `${PRODUCTION_API_HOST}/api/v1`;
  }
  return `http://${getDevHost()}:${DEV_PORT}/api/v1`;
};

// Socket URL (base URL without path)
const getSocketUrl = () => {
  if (ENVIRONMENT === "production") {
    return PRODUCTION_SOCKET_HOST;
  }
  return `http://${getDevHost()}:${DEV_PORT}`;
};

// Base URL without /api/v1 (for payments, webhooks, etc.)
const getBaseUrl = () => {
  if (ENVIRONMENT === "production") {
    return PRODUCTION_API_HOST;
  }
  return `http://${getDevHost()}:${DEV_PORT}`;
};

// Web host (for redirects, OAuth callbacks, etc.)
const getWebHost = () => {
  if (ENVIRONMENT === "production") {
    return PRODUCTION_WEB_HOST;
  }
  return `http://${DEV_LOCALHOST}:${DEV_PORT}`;
};

// Check if a URL is from our server (for Stripe return URL detection, etc.)
const isOurServerUrl = (url) => {
  if (!url) return false;

  if (ENVIRONMENT === "production") {
    return url.includes("kleanr.app");
  }

  // In development, check for localhost variants
  return (
    url.includes(`${DEV_LOCALHOST}:${DEV_PORT}`) ||
    url.includes(`127.0.0.1:${DEV_PORT}`) ||
    url.includes(`${DEV_ANDROID_HOST}:${DEV_PORT}`)
  );
};

// Export configuration
export const API_BASE = getApiBase();
export const SOCKET_URL = getSocketUrl();
export const BASE_URL = getBaseUrl();
export const WEB_HOST = getWebHost();
export const IS_PRODUCTION = ENVIRONMENT === "production";
export const IS_DEVELOPMENT = ENVIRONMENT === "development";

// Export helper functions
export { isOurServerUrl };

export default {
  API_BASE,
  SOCKET_URL,
  BASE_URL,
  WEB_HOST,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  isOurServerUrl,
  ENVIRONMENT,
};
