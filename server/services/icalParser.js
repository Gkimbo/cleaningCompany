/**
 * iCal Parser Service
 * Fetches and parses iCal feeds from Airbnb, VRBO, and other vacation rental platforms
 */

const https = require("https");
const http = require("http");

/**
 * Fetches iCal data from a URL
 * @param {string} url - The iCal feed URL
 * @returns {Promise<string>} - Raw iCal data
 */
const fetchIcalData = (url) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return fetchIcalData(response.headers.location).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch iCal: HTTP ${response.statusCode}`));
        return;
      }

      let data = "";
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => {
        resolve(data);
      });
    });

    request.on("error", (err) => {
      reject(new Error(`Failed to fetch iCal: ${err.message}`));
    });

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error("Request timeout"));
    });
  });
};

/**
 * Parses a date string from iCal format (YYYYMMDD or YYYYMMDDTHHMMSSZ)
 * @param {string} dateStr - iCal date string
 * @returns {Date} - JavaScript Date object
 */
const parseIcalDate = (dateStr) => {
  if (!dateStr) return null;

  // Remove any VALUE=DATE: prefix
  dateStr = dateStr.replace(/^VALUE=DATE:/i, "").replace(/^DATE:/i, "");

  // Handle YYYYMMDD format (all-day events)
  if (dateStr.length === 8) {
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
    const day = parseInt(dateStr.substring(6, 8), 10);
    return new Date(year, month, day);
  }

  // Handle YYYYMMDDTHHMMSSZ format
  if (dateStr.includes("T")) {
    const cleanDate = dateStr.replace(/[TZ]/g, "");
    const year = parseInt(cleanDate.substring(0, 4), 10);
    const month = parseInt(cleanDate.substring(4, 6), 10) - 1;
    const day = parseInt(cleanDate.substring(6, 8), 10);
    const hour = parseInt(cleanDate.substring(8, 10), 10) || 0;
    const minute = parseInt(cleanDate.substring(10, 12), 10) || 0;

    if (dateStr.endsWith("Z")) {
      return new Date(Date.UTC(year, month, day, hour, minute));
    }
    return new Date(year, month, day, hour, minute);
  }

  return null;
};

/**
 * Unfolds iCal lines (handles line continuations)
 * @param {string} icalData - Raw iCal data
 * @returns {string} - Unfolded iCal data
 */
const unfoldIcalLines = (icalData) => {
  // iCal spec says lines can be folded with CRLF followed by space or tab
  return icalData.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
};

/**
 * Parses iCal data and extracts booking events
 * @param {string} icalData - Raw iCal data
 * @returns {Array} - Array of booking objects
 */
const parseIcalEvents = (icalData) => {
  const bookings = [];
  const unfolded = unfoldIcalLines(icalData);
  const lines = unfolded.split(/\r\n|\n/);

  let currentEvent = null;
  let inEvent = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === "BEGIN:VEVENT") {
      inEvent = true;
      currentEvent = {
        uid: null,
        summary: null,
        description: null,
        startDate: null,
        endDate: null,
        isBlocked: false,
      };
    } else if (trimmedLine === "END:VEVENT" && inEvent) {
      if (currentEvent.startDate && currentEvent.endDate) {
        // Determine if this is an actual booking vs just blocked time
        const summary = (currentEvent.summary || "").toLowerCase();
        const description = (currentEvent.description || "").toLowerCase();

        // Airbnb uses "Reserved" or "Airbnb (Not available)"
        // VRBO uses "Reserved" or the guest name
        currentEvent.isBlocked =
          summary.includes("not available") ||
          summary.includes("blocked") ||
          summary === "unavailable";

        currentEvent.isBooking =
          summary.includes("reserved") ||
          summary.includes("booked") ||
          description.includes("reservation") ||
          description.includes("guest") ||
          (!currentEvent.isBlocked && currentEvent.summary);

        bookings.push(currentEvent);
      }
      inEvent = false;
      currentEvent = null;
    } else if (inEvent && currentEvent) {
      // Parse the property
      const colonIndex = trimmedLine.indexOf(":");
      if (colonIndex > -1) {
        let key = trimmedLine.substring(0, colonIndex).toUpperCase();
        const value = trimmedLine.substring(colonIndex + 1);

        // Handle parameters in key (e.g., DTSTART;VALUE=DATE:20240115)
        const semicolonIndex = key.indexOf(";");
        if (semicolonIndex > -1) {
          key = key.substring(0, semicolonIndex);
        }

        switch (key) {
          case "UID":
            currentEvent.uid = value;
            break;
          case "SUMMARY":
            currentEvent.summary = value;
            break;
          case "DESCRIPTION":
            currentEvent.description = value;
            break;
          case "DTSTART":
            currentEvent.startDate = parseIcalDate(value);
            break;
          case "DTEND":
            currentEvent.endDate = parseIcalDate(value);
            break;
        }
      }
    }
  }

  return bookings;
};

/**
 * Formats a date to YYYY-MM-DD string
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
const formatDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Fetches and parses an iCal feed, returning checkout dates for cleaning
 * @param {string} url - The iCal feed URL
 * @returns {Promise<Array>} - Array of checkout dates with booking info
 */
const getCheckoutDates = async (url) => {
  try {
    const icalData = await fetchIcalData(url);
    const events = parseIcalEvents(icalData);

    // Filter to actual bookings (not just blocked dates) and extract checkout dates
    const checkoutDates = events
      .filter((event) => event.isBooking && !event.isBlocked)
      .map((event) => ({
        checkoutDate: formatDateString(event.endDate),
        checkinDate: formatDateString(event.startDate),
        summary: event.summary,
        uid: event.uid,
      }))
      .filter((booking) => {
        // Only include future checkouts
        const checkoutDate = new Date(booking.checkoutDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return checkoutDate >= today;
      });

    return checkoutDates;
  } catch (error) {
    throw new Error(`Failed to process iCal feed: ${error.message}`);
  }
};

/**
 * Validates an iCal URL format
 * @param {string} url - URL to validate
 * @returns {boolean} - Whether the URL appears to be a valid iCal feed
 */
const validateIcalUrl = (url) => {
  if (!url || typeof url !== "string") return false;

  try {
    const parsed = new URL(url);

    // Must be http or https
    if (!["http:", "https:"].includes(parsed.protocol)) return false;

    // Common iCal URL patterns
    const isAirbnb = url.includes("airbnb.com") && url.includes("calendar");
    const isVrbo = url.includes("vrbo.com") || url.includes("homeaway.com");
    const isIcalFormat = url.includes(".ics") || url.includes("ical") || url.includes("calendar");

    return isAirbnb || isVrbo || isIcalFormat;
  } catch {
    return false;
  }
};

/**
 * Detects the platform from an iCal URL
 * @param {string} url - iCal URL
 * @returns {string} - Platform name (airbnb, vrbo, other)
 */
const detectPlatform = (url) => {
  if (!url) return "other";
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes("airbnb.com")) return "airbnb";
  if (lowerUrl.includes("vrbo.com") || lowerUrl.includes("homeaway.com")) return "vrbo";
  if (lowerUrl.includes("booking.com")) return "booking";

  return "other";
};

module.exports = {
  fetchIcalData,
  parseIcalEvents,
  getCheckoutDates,
  validateIcalUrl,
  detectPlatform,
  formatDateString,
};
