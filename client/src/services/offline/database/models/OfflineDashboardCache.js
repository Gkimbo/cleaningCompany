import { Model } from "@nozbe/watermelondb";
import { field, date, json } from "@nozbe/watermelondb/decorators";

// Cache expiration times (in milliseconds)
const CACHE_DURATIONS = {
  dashboard: 15 * 60 * 1000, // 15 minutes
  calendar: 30 * 60 * 1000, // 30 minutes
  financials: 60 * 60 * 1000, // 1 hour
  payroll: 60 * 60 * 1000, // 1 hour
};

/**
 * OfflineDashboardCache - WatermelonDB model for cached dashboard/report data
 *
 * General-purpose cache for business owner dashboard, calendar, and reports.
 * Uses cache_key to identify different types of cached data.
 */
export default class OfflineDashboardCache extends Model {
  static table = "offline_dashboard_cache";

  @field("cache_key") cacheKey;
  @json("data", (raw) => raw || {}) data;
  @date("cached_at") cachedAt;
  @date("expires_at") expiresAt;

  // Check if cache is still valid
  get isValid() {
    if (!this.expiresAt) return false;
    return new Date(this.expiresAt) > new Date();
  }

  get isExpired() {
    return !this.isValid;
  }

  // Get age of cache in milliseconds
  get ageMs() {
    if (!this.cachedAt) return Infinity;
    return Date.now() - new Date(this.cachedAt).getTime();
  }

  // Get formatted age for display
  get formattedAge() {
    const ms = this.ageMs;
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // Static helper to get cache duration for a key type
  static getCacheDuration(keyType) {
    // Extract type from key (e.g., "calendar_2024_01" -> "calendar")
    const type = keyType.split("_")[0];
    return CACHE_DURATIONS[type] || CACHE_DURATIONS.dashboard;
  }

  // Static helper to generate cache key
  static generateKey(type, ...params) {
    if (params.length === 0) return type;
    return `${type}_${params.join("_")}`;
  }
}

// Export cache key generators
export const CACHE_KEYS = {
  dashboard: () => "dashboard",
  calendar: (month, year) => `calendar_${year}_${String(month).padStart(2, "0")}`,
  financials: (startDate, endDate) => `financials_${startDate}_${endDate}`,
  payroll: (period) => `payroll_${period}`,
  employees: () => "employees",
};
