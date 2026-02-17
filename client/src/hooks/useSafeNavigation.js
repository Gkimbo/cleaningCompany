/**
 * useSafeNavigation Hook
 *
 * Provides safe navigation methods that handle cases where
 * there's no history to go back to (prevents GO_BACK errors).
 */

import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-native";

const useSafeNavigation = (fallbackRoute = "/") => {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Safely go back in history, or navigate to fallback route if no history
   */
  const goBack = useCallback(() => {
    // location.key is "default" when there's no history
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate(fallbackRoute, { replace: true });
    }
  }, [navigate, location.key, fallbackRoute]);

  /**
   * Navigate to a route
   */
  const goTo = useCallback((path, options) => {
    navigate(path, options);
  }, [navigate]);

  /**
   * Check if we can go back
   */
  const canGoBack = location.key !== "default";

  return {
    goBack,
    goTo,
    canGoBack,
    navigate, // expose original navigate for other uses
  };
};

export default useSafeNavigation;
