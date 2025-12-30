import React, { createContext, useState, useEffect, useCallback, useContext } from "react";
import PricingService from "../services/fetchRequests/PricingService";

/**
 * Default pricing configuration (fallback when API is unavailable)
 * These values match the database schema defaults in server/models/PricingConfig.js
 */
const defaultPricing = {
  // Base cleaning rate
  basePrice: 150,
  extraBedBathFee: 50,
  halfBathFee: 25,

  // Linen services
  linens: {
    sheetFeePerBed: 30,
    towelFee: 5,
    faceClothFee: 2,
  },

  // Time window surcharges
  timeWindows: {
    anytime: { surcharge: 0, label: "Anytime", description: "Most flexible, best pricing" },
    "10-3": { surcharge: 25, label: "10am - 3pm", description: "+$25 per cleaning" },
    "11-4": { surcharge: 25, label: "11am - 4pm", description: "+$25 per cleaning" },
    "12-2": { surcharge: 30, label: "12pm - 2pm", description: "+$30 per cleaning" },
  },

  // Cancellation policy
  cancellation: {
    fee: 25,
    windowDays: 7,
    homeownerPenaltyDays: 3,
    cleanerPenaltyDays: 4,
    refundPercentage: 0.5,
  },

  // Platform fees
  platform: {
    feePercent: 0.1,
  },

  // High volume
  highVolumeFee: 50,
  highVolumeDays: ["holiday", "holiday weekend"],
};

const PricingContext = createContext({
  pricing: defaultPricing,
  loading: true,
  error: null,
  source: "config",
  refreshPricing: () => {},
});

/**
 * PricingProvider - Provides pricing configuration to the app
 * Fetches pricing from API and falls back to static config if unavailable
 */
export const PricingProvider = ({ children }) => {
  const [pricing, setPricing] = useState(defaultPricing);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState("config");

  const fetchPricing = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await PricingService.getCurrentPricing();

      if (result && result.pricing) {
        setPricing(result.pricing);
        setSource(result.source || "database");
      } else {
        // Use static fallback
        setPricing(defaultPricing);
        setSource("config");
      }
    } catch (err) {
      console.warn("[PricingContext] Failed to fetch pricing, using fallback:", err.message);
      setError(err.message);
      setPricing(defaultPricing);
      setSource("config");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch pricing on mount
  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const value = {
    pricing,
    loading,
    error,
    source,
    refreshPricing: fetchPricing,
  };

  return (
    <PricingContext.Provider value={value}>
      {children}
    </PricingContext.Provider>
  );
};

/**
 * Hook to access pricing context
 * @returns {object} { pricing, loading, error, source, refreshPricing }
 */
export const usePricing = () => {
  const context = useContext(PricingContext);
  if (!context) {
    throw new Error("usePricing must be used within a PricingProvider");
  }
  return context;
};

export { PricingContext };

// Export default pricing for components that need fallback values
export { defaultPricing };

/**
 * Helper to get time window options for dropdowns
 * @param {object} pricing - Pricing object from usePricing()
 * @returns {Array} Array of time window options
 */
export const getTimeWindowOptions = (pricing) => {
  const timeWindows = pricing?.timeWindows || defaultPricing.timeWindows;

  // Labels for time windows (used when config only has surcharge values)
  const timeWindowLabels = {
    anytime: { label: "Anytime", description: "Most flexible, best pricing" },
    "10-3": { label: "10am - 3pm", description: "" },
    "11-4": { label: "11am - 4pm", description: "" },
    "12-2": { label: "12pm - 2pm", description: "" },
  };

  return Object.entries(timeWindows).map(([value, config]) => {
    // Handle both formats: config as object or config as number (surcharge only)
    const isObject = typeof config === "object" && config !== null;
    const surcharge = isObject ? config.surcharge : config;
    const labels = timeWindowLabels[value] || { label: value, description: "" };

    return {
      value,
      label: isObject && config.label ? config.label : labels.label,
      description: isObject && config.description
        ? config.description
        : surcharge > 0
          ? `+$${surcharge} per cleaning`
          : labels.description,
      surcharge,
    };
  });
};

/**
 * Helper to get time window surcharge
 * @param {object} pricing - Pricing object from usePricing()
 * @param {string} timeWindow - Time window key (e.g., "10-3")
 * @returns {number} Surcharge amount
 */
export const getTimeWindowSurcharge = (pricing, timeWindow) => {
  const timeWindows = pricing?.timeWindows || defaultPricing.timeWindows;
  const config = timeWindows[timeWindow];
  // Handle both formats: config as object with surcharge property, or config as number (surcharge only)
  if (typeof config === "object" && config !== null) {
    return config.surcharge || 0;
  }
  return typeof config === "number" ? config : 0;
};

/**
 * Helper to get time window label and surcharge info
 * @param {object} pricing - Pricing object from usePricing()
 * @param {string} timeWindow - Time window key (e.g., "10-3", "anytime")
 * @returns {object} { label, surcharge, shortLabel }
 */
export const getTimeWindowLabel = (pricing, timeWindow) => {
  if (!timeWindow || timeWindow === "anytime") {
    return { label: "Anytime", surcharge: 0, shortLabel: null };
  }

  // Fallback labels for time windows when config only has surcharge value
  const timeWindowLabels = {
    "10-3": "10am - 3pm",
    "11-4": "11am - 4pm",
    "12-2": "12pm - 2pm",
  };

  const timeWindows = pricing?.timeWindows || defaultPricing.timeWindows;
  const config = timeWindows[timeWindow];

  if (!config) {
    return { label: "Anytime", surcharge: 0, shortLabel: null };
  }

  const surcharge = typeof config === "object" ? (config.surcharge || 0) : (typeof config === "number" ? config : 0);
  const label = typeof config === "object" && config.label ? config.label : (timeWindowLabels[timeWindow] || timeWindow);

  // Create a short label for calendar cells (e.g., "10-3")
  const shortLabel = timeWindow;

  return { label, surcharge, shortLabel };
};

/**
 * Helper to calculate base cleaning price
 * @param {object} pricing - Pricing object from usePricing()
 * @param {number} numBeds - Number of bedrooms
 * @param {number|string} numBaths - Number of bathrooms (supports decimals like 2.5)
 * @returns {number} Base price before add-ons
 */
export const calculateBasePrice = (pricing, numBeds, numBaths) => {
  const basePrice = pricing?.basePrice || defaultPricing.basePrice;
  const extraBedBathFee = pricing?.extraBedBathFee || defaultPricing.extraBedBathFee;
  const halfBathFee = pricing?.halfBathFee || defaultPricing.halfBathFee;

  const baths = parseFloat(numBaths) || 0;
  const fullBaths = Math.floor(baths);
  const hasHalfBath = (baths % 1) >= 0.5;

  const extraBeds = Math.max(0, numBeds - 1);
  const extraFullBaths = Math.max(0, fullBaths - 1);
  const halfBathCount = hasHalfBath ? 1 : 0;

  return basePrice + (extraBeds * extraBedBathFee) + (extraFullBaths * extraBedBathFee) + (halfBathCount * halfBathFee);
};
