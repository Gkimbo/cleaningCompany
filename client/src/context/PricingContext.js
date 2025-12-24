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
  return Object.entries(timeWindows).map(([value, config]) => ({
    value,
    label: config.label,
    description: config.description,
    surcharge: config.surcharge,
  }));
};

/**
 * Helper to get time window surcharge
 * @param {object} pricing - Pricing object from usePricing()
 * @param {string} timeWindow - Time window key (e.g., "10-3")
 * @returns {number} Surcharge amount
 */
export const getTimeWindowSurcharge = (pricing, timeWindow) => {
  const timeWindows = pricing?.timeWindows || defaultPricing.timeWindows;
  return timeWindows[timeWindow]?.surcharge || 0;
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
