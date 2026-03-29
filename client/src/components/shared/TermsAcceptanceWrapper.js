import React, { useState, useEffect, useRef } from "react";
import { ActivityIndicator, View, Text, Pressable, StyleSheet } from "react-native";
import { useLocation } from "react-router-native";
import { API_BASE } from "../../services/config";
import TermsAcceptanceScreen from "../terms/TermsAcceptanceScreen";
import { colors, spacing, radius, typography } from "../../services/styles/theme";

// Public routes that don't require terms check
// These should match ProtectedRoute.ROUTE_ACCESS.public
const PUBLIC_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/forgot-credentials",
  "/welcome",
  "/get-started",
  "/apply",
  "/import-business",
  "/business-signup",
  "/business-signup-check",
  "/accept-invite",      // Matches /accept-invite/:token
  "/accept-employee-invite", // Matches /accept-employee-invite/:token
];

/**
 * TermsAcceptanceWrapper
 *
 * Blocks all navigation until required legal documents are accepted.
 * This is a FULLY BLOCKING wrapper - it renders TermsAcceptanceScreen
 * directly instead of the route content, preventing any navigation.
 *
 * - Checks /terms/check on mount and when auth changes
 * - If acceptance required → renders TermsAcceptanceScreen (blocking)
 * - If no acceptance needed → renders children normally
 * - Public routes (sign-in, sign-up, etc.) bypass the check
 * - On errors, retries with exponential backoff before allowing through
 */
const TermsAcceptanceWrapper = ({ children, state, dispatch }) => {
  const location = useLocation();
  const [requiresAcceptance, setRequiresAcceptance] = useState(null); // null = not yet checked
  const [isChecking, setIsChecking] = useState(true);
  const [checkError, setCheckError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const retryTimeoutRef = useRef(null);

  // Helper to check if current path is a public route
  const isPublicRoute = () => {
    return PUBLIC_ROUTES.some(
      (route) => location.pathname === route || location.pathname.startsWith(route + "/")
    );
  };

  // Check terms acceptance status when user logs in or on mount
  useEffect(() => {
    // Skip check for public routes
    if (isPublicRoute()) {
      setRequiresAcceptance(false);
      setIsChecking(false);
      return;
    }
    checkTermsStatus();
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [state.currentUser?.token, location.pathname]);

  const checkTermsStatus = async (isRetry = false) => {
    // Not logged in - no check needed
    if (!state.currentUser?.token) {
      setRequiresAcceptance(false);
      setIsChecking(false);
      setCheckError(null);
      return;
    }

    // Skip check for public routes
    if (isPublicRoute()) {
      setRequiresAcceptance(false);
      setIsChecking(false);
      setCheckError(null);
      return;
    }

    if (!isRetry) {
      setIsChecking(true);
      setCheckError(null);
      setRetryCount(0);
    }

    try {
      const response = await fetch(`${API_BASE}/terms/check`, {
        headers: { Authorization: `Bearer ${state.currentUser.token}` },
      });

      if (!response.ok) {
        // 401 means token is invalid - allow through (will be logged out by auth)
        if (response.status === 401) {
          setRequiresAcceptance(false);
          setIsChecking(false);
          return;
        }

        // Other errors - retry with backoff
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      setRequiresAcceptance(data.requiresAcceptance);
      setCheckError(null);
      setRetryCount(0);
    } catch (err) {
      console.error("Error checking terms status:", err);

      if (retryCount < maxRetries) {
        // Retry with exponential backoff (1s, 2s, 4s)
        const delay = Math.pow(2, retryCount) * 1000;
        setRetryCount((prev) => prev + 1);
        retryTimeoutRef.current = setTimeout(() => {
          checkTermsStatus(true);
        }, delay);
        return; // Don't set isChecking to false yet
      }

      // Max retries exceeded - show error with manual retry option
      setCheckError("Unable to verify terms status. Please check your connection.");
    } finally {
      if (retryCount >= maxRetries || !checkError) {
        setIsChecking(false);
      }
    }
  };

  const handleAccepted = () => {
    // All terms accepted - allow through
    setRequiresAcceptance(false);
  };

  const handleManualRetry = () => {
    setRetryCount(0);
    setCheckError(null);
    setIsChecking(true);
    checkTermsStatus();
  };

  const handleSkipOnError = () => {
    // Allow through after max retries if user chooses to continue
    // This is a conscious user decision, not an automatic fail-open
    setRequiresAcceptance(false);
    setCheckError(null);
  };

  // Public routes bypass terms check entirely
  if (isPublicRoute()) {
    return children;
  }

  // Not logged in - render children (ProtectedRoute will handle redirect to sign-in)
  if (!state.currentUser?.token) {
    return children;
  }

  // Still checking - show loading indicator
  if (isChecking) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} testID="activity-indicator" />
        {retryCount > 0 && (
          <Text style={styles.retryingText}>
            Retrying... ({retryCount}/{maxRetries})
          </Text>
        )}
      </View>
    );
  }

  // Error state - show error with retry options
  if (checkError) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{checkError}</Text>
        <Pressable style={styles.retryButton} onPress={handleManualRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
        <Pressable style={styles.skipButton} onPress={handleSkipOnError}>
          <Text style={styles.skipButtonText}>Continue Anyway</Text>
        </Pressable>
        <Text style={styles.warningText}>
          Note: You may be prompted to accept terms later.
        </Text>
      </View>
    );
  }

  // Requires acceptance - render TermsAcceptanceScreen directly (BLOCKING)
  if (requiresAcceptance) {
    return (
      <TermsAcceptanceScreen
        state={state}
        dispatch={dispatch}
        onAccepted={handleAccepted}
      />
    );
  }

  // All terms accepted - render children normally
  return children;
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    padding: spacing.xl,
  },
  retryingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  errorText: {
    color: colors.error[600],
    fontSize: typography.fontSize.base,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  retryButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  skipButtonText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  warningText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.xs,
    textAlign: "center",
    fontStyle: "italic",
  },
});

export default TermsAcceptanceWrapper;
