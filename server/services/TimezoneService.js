/**
 * TimezoneService - Handles timezone operations for homes and appointments
 *
 * Uses geo-tz for coordinate-based timezone lookup with state fallback for US homes.
 */

const { find: findTimezone } = require("geo-tz");

// US state to timezone mappings (fallback when coordinates unavailable)
const STATE_TIMEZONE_FALLBACKS = {
	// Eastern Time
	CT: "America/New_York",
	ME: "America/New_York",
	MA: "America/New_York",
	NH: "America/New_York",
	RI: "America/New_York",
	VT: "America/New_York",
	NJ: "America/New_York",
	NY: "America/New_York",
	PA: "America/New_York",
	DE: "America/New_York",
	MD: "America/New_York",
	VA: "America/New_York",
	WV: "America/New_York",
	NC: "America/New_York",
	SC: "America/New_York",
	GA: "America/New_York",
	FL: "America/New_York",
	OH: "America/New_York",
	MI: "America/New_York",
	DC: "America/New_York",
	KY: "America/New_York",
	// Central Time
	IL: "America/Chicago",
	IN: "America/Indiana/Indianapolis",
	WI: "America/Chicago",
	MN: "America/Chicago",
	IA: "America/Chicago",
	MO: "America/Chicago",
	ND: "America/Chicago",
	SD: "America/Chicago",
	NE: "America/Chicago",
	KS: "America/Chicago",
	OK: "America/Chicago",
	TX: "America/Chicago",
	LA: "America/Chicago",
	AR: "America/Chicago",
	MS: "America/Chicago",
	AL: "America/Chicago",
	TN: "America/Chicago",
	// Mountain Time
	MT: "America/Denver",
	WY: "America/Denver",
	CO: "America/Denver",
	NM: "America/Denver",
	UT: "America/Denver",
	ID: "America/Boise",
	// Arizona (no DST)
	AZ: "America/Phoenix",
	// Pacific Time
	WA: "America/Los_Angeles",
	OR: "America/Los_Angeles",
	CA: "America/Los_Angeles",
	NV: "America/Los_Angeles",
	// Alaska
	AK: "America/Anchorage",
	// Hawaii
	HI: "Pacific/Honolulu",
};

// Default timezone when nothing else available
const DEFAULT_TIMEZONE = "America/New_York";

class TimezoneService {
	/**
	 * Get timezone from coordinates using geo-tz
	 * @param {number|string} latitude
	 * @param {number|string} longitude
	 * @returns {string|null} IANA timezone identifier
	 */
	static getTimezoneFromCoords(latitude, longitude) {
		if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
			return null;
		}

		const lat = parseFloat(latitude);
		const lng = parseFloat(longitude);

		if (isNaN(lat) || isNaN(lng)) {
			return null;
		}

		try {
			const timezones = findTimezone(lat, lng);
			return timezones.length > 0 ? timezones[0] : null;
		} catch (error) {
			console.error("[TimezoneService] Error looking up timezone from coords:", error.message);
			return null;
		}
	}

	/**
	 * Get timezone from state code as fallback
	 * @param {string} state - Two-letter state code
	 * @returns {string} IANA timezone identifier
	 */
	static getTimezoneFromState(state) {
		if (!state) return DEFAULT_TIMEZONE;
		const stateUpper = state.toUpperCase().trim();
		return STATE_TIMEZONE_FALLBACKS[stateUpper] || DEFAULT_TIMEZONE;
	}

	/**
	 * Get timezone for a home (primary method)
	 * Tries coordinates first, falls back to state
	 * @param {object} home - Home object with latitude, longitude, state
	 * @returns {string} IANA timezone identifier
	 */
	static getTimezoneForHome(home) {
		if (!home) return DEFAULT_TIMEZONE;

		// Try coordinates first (most accurate)
		const fromCoords = this.getTimezoneFromCoords(home.latitude, home.longitude);
		if (fromCoords) {
			return fromCoords;
		}

		// Fallback to state
		return this.getTimezoneFromState(home.state);
	}

	/**
	 * Get today's date in YYYY-MM-DD format for a specific timezone
	 * @param {string} timezone - IANA timezone identifier (optional, defaults to DEFAULT_TIMEZONE)
	 * @returns {string} Date in YYYY-MM-DD format
	 */
	static getTodayInTimezone(timezone = DEFAULT_TIMEZONE) {
		const date = new Date();
		return this.formatDateInTimezone(date, timezone);
	}

	/**
	 * Format a Date object as YYYY-MM-DD in a specific timezone
	 * @param {Date} date - Date object
	 * @param {string} timezone - IANA timezone identifier
	 * @returns {string} Date in YYYY-MM-DD format
	 */
	static formatDateInTimezone(date, timezone = DEFAULT_TIMEZONE) {
		try {
			// en-CA locale returns YYYY-MM-DD format
			return date.toLocaleDateString("en-CA", { timeZone: timezone });
		} catch (error) {
			// Fallback if timezone is invalid
			console.error(`[TimezoneService] Invalid timezone: ${timezone}`, error.message);
			return date.toLocaleDateString("en-CA");
		}
	}

	/**
	 * Parse a YYYY-MM-DD date string as noon in local time
	 * This avoids timezone edge cases that can shift the day
	 * @param {string} dateString - Date in YYYY-MM-DD format
	 * @returns {Date} Date object set to noon
	 */
	static parseDateString(dateString) {
		if (!dateString) return new Date();
		// Parse as noon to avoid timezone boundary issues
		return new Date(dateString + "T12:00:00");
	}

	/**
	 * Check if a date string (YYYY-MM-DD) is today in a specific timezone
	 * @param {string} dateString - Date in YYYY-MM-DD format
	 * @param {string} timezone - IANA timezone identifier
	 * @returns {boolean}
	 */
	static isDateToday(dateString, timezone = DEFAULT_TIMEZONE) {
		return dateString === this.getTodayInTimezone(timezone);
	}

	/**
	 * Check if a date string is in the future for a specific timezone
	 * @param {string} dateString - Date in YYYY-MM-DD format
	 * @param {string} timezone - IANA timezone identifier
	 * @returns {boolean}
	 */
	static isDateFuture(dateString, timezone = DEFAULT_TIMEZONE) {
		return dateString > this.getTodayInTimezone(timezone);
	}

	/**
	 * Check if a date string is in the past for a specific timezone
	 * @param {string} dateString - Date in YYYY-MM-DD format
	 * @param {string} timezone - IANA timezone identifier
	 * @returns {boolean}
	 */
	static isDatePast(dateString, timezone = DEFAULT_TIMEZONE) {
		return dateString < this.getTodayInTimezone(timezone);
	}

	/**
	 * Check if a date string is today or in the future for a specific timezone
	 * @param {string} dateString - Date in YYYY-MM-DD format
	 * @param {string} timezone - IANA timezone identifier
	 * @returns {boolean}
	 */
	static isDateTodayOrFuture(dateString, timezone = DEFAULT_TIMEZONE) {
		return dateString >= this.getTodayInTimezone(timezone);
	}

	/**
	 * Get the default timezone
	 * @returns {string} Default IANA timezone identifier
	 */
	static getDefaultTimezone() {
		return DEFAULT_TIMEZONE;
	}

	/**
	 * Validate a timezone string
	 * @param {string} timezone - IANA timezone identifier to validate
	 * @returns {boolean} True if valid
	 */
	static isValidTimezone(timezone) {
		try {
			new Date().toLocaleDateString("en-CA", { timeZone: timezone });
			return true;
		} catch {
			return false;
		}
	}
}

module.exports = TimezoneService;
