import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook for countdown timer functionality
 * Used for 48-hour booking expiration countdowns
 *
 * @param {string|Date} expiresAt - The expiration date/time
 * @param {number} updateInterval - Update interval in ms (default: 60000 = 1 minute)
 * @returns {Object} { timeRemaining, isExpired, hoursLeft, minutesLeft, isUrgent, isWarning }
 */
const useCountdown = (expiresAt, updateInterval = 60000) => {
  const calculateTimeLeft = useCallback(() => {
    if (!expiresAt) {
      return {
        timeRemaining: "",
        isExpired: false,
        hoursLeft: 0,
        minutesLeft: 0,
        isUrgent: false,
        isWarning: false,
        totalMinutesLeft: 0,
      };
    }

    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires - now;

    if (diffMs <= 0) {
      return {
        timeRemaining: "Expired",
        isExpired: true,
        hoursLeft: 0,
        minutesLeft: 0,
        isUrgent: false,
        isWarning: false,
        totalMinutesLeft: 0,
      };
    }

    const totalMinutesLeft = Math.floor(diffMs / (1000 * 60));
    const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
    const minutesLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    // Determine urgency levels
    const isUrgent = hoursLeft < 1; // Less than 1 hour
    const isWarning = hoursLeft < 6 && !isUrgent; // Less than 6 hours but more than 1

    // Format time remaining string
    let timeRemaining;
    if (hoursLeft > 0) {
      timeRemaining = `${hoursLeft}h ${minutesLeft}m left`;
    } else {
      timeRemaining = `${minutesLeft}m left`;
    }

    return {
      timeRemaining,
      isExpired: false,
      hoursLeft,
      minutesLeft,
      isUrgent,
      isWarning,
      totalMinutesLeft,
    };
  }, [expiresAt]);

  const [countdown, setCountdown] = useState(calculateTimeLeft);

  useEffect(() => {
    // Initial calculation
    setCountdown(calculateTimeLeft());

    // Set up interval for updates
    const interval = setInterval(() => {
      setCountdown(calculateTimeLeft());
    }, updateInterval);

    // Cleanup on unmount or when expiresAt changes
    return () => clearInterval(interval);
  }, [calculateTimeLeft, updateInterval]);

  return countdown;
};

export default useCountdown;
