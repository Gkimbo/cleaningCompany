import React from "react";
import { Navigate, useLocation } from "react-router-native";

/**
 * Route access configuration by user type
 * Each key is a user account type, and the value is an array of allowed route patterns
 * Patterns can use wildcards: "/owner/*" matches "/owner/pricing", "/owner/terms", etc.
 */
const ROUTE_ACCESS = {
  // Public routes accessible to everyone (including unauthenticated users)
  public: [
    "/",
    "/sign-in",
    "/sign-up",
    "/forgot-credentials",
    "/welcome",
    "/get-started",
    "/apply",
    "/import-business",
    "/business-signup",
    "/business-signup-check",
    "/accept-invite/*",
    "/accept-employee-invite/*",
  ],

  // Routes accessible to any authenticated user
  authenticated: [
    "/account-settings",
    "/messages",
    "/messages/*",
    "/notifications",
    "/notifications/*",
    "/terms-acceptance",
  ],

  // Owner-only routes
  owner: [
    "/owner/*",
    "/employees",
    "/employee-edit/*",
    "/view-all-applications",
    "/list-of-applications",
    "/all-appointments",
    "/unassigned-appointments",
    "/assign-cleaner/*",
    "/suspicious-reports",
    "/conflicts",
    "/conflicts/*",
    "/messages/broadcast",
    "/platform-earnings-calculator",
  ],

  // HR staff routes (humanResources)
  humanResources: [
    "/view-all-applications",
    "/list-of-applications",
    "/employees",
    "/employee-edit/*",
    "/suspicious-reports",
    "/conflicts",
    "/conflicts/*",
  ],

  // IT staff routes
  it: [
    // IT staff have limited access - mostly just their dashboard and settings
  ],

  // Cleaner routes (marketplace cleaners)
  cleaner: [
    "/my-requests",
    "/my-requests-calendar",
    "/employee-assignments",
    "/appointment-calender",
    "/my-appointment-calender",
    "/new-job-choice",
    "/employee-shifts",
    "/earnings",
    "/payout-setup",
    "/recommended-supplies",
    "/preferred-perks",
    "/all-reviews",
    "/all-cleaner-reviews/*",
    "/cleaner-profile",
    "/upgrade-to-business",
    "/upgrade-form",
    // Business owner cleaners get additional routes
    "/my-clients",
    "/my-clients/*",
    "/client-detail/*",
    "/earnings-calculator",
    "/business-owner/*",
  ],

  // Business employee routes
  employee: [
    "/employee/*",
    "/earnings",
    "/payout-setup",
    "/employee-shifts",
  ],

  // Client/Homeowner routes (default account type)
  client: [
    "/appointments",
    "/appointments-calendar",
    "/schedule-cleaning",
    "/list-of-homes",
    "/add-home",
    "/edit-home",
    "/edit-home/*",
    "/details/*",
    "/complete-home-setup/*",
    "/calendar-sync/*",
    "/quick-book/*",
    "/setup-home",
    "/bill",
    "/payment-setup",
    "/pending-reviews",
    "/client-requests",
    "/cleaner-requests",
    "/archived-cleanings",
    "/client-reviews",
    "/cleaner-approvals",
    "/all-reviews",
    "/my-referrals",
  ],
};

/**
 * Check if a path matches a pattern (supports wildcards)
 * @param {string} path - The current route path
 * @param {string} pattern - The pattern to match against
 * @returns {boolean}
 */
const matchesPattern = (path, pattern) => {
  if (pattern.endsWith("/*")) {
    const basePattern = pattern.slice(0, -2);
    return path === basePattern || path.startsWith(basePattern + "/");
  }
  return path === pattern;
};

/**
 * Check if a user has access to a specific route
 * @param {string} path - The current route path
 * @param {object} state - The application state containing user info
 * @returns {boolean}
 */
const hasRouteAccess = (path, state) => {
  // Check public routes first
  if (ROUTE_ACCESS.public.some((pattern) => matchesPattern(path, pattern))) {
    return true;
  }

  // If not authenticated, deny access to all other routes
  if (!state?.currentUser?.token) {
    return false;
  }

  // Check authenticated routes (available to all logged-in users)
  if (ROUTE_ACCESS.authenticated.some((pattern) => matchesPattern(path, pattern))) {
    return true;
  }

  const accountType = state.account;
  const isBusinessOwner = state.isBusinessOwner;

  // Owner has access to everything
  if (accountType === "owner") {
    return true;
  }

  // HR staff
  if (accountType === "humanResources") {
    if (ROUTE_ACCESS.humanResources.some((pattern) => matchesPattern(path, pattern))) {
      return true;
    }
  }

  // IT staff
  if (accountType === "it") {
    if (ROUTE_ACCESS.it.some((pattern) => matchesPattern(path, pattern))) {
      return true;
    }
    // IT staff only get authenticated routes
    return false;
  }

  // Cleaner (marketplace)
  if (accountType === "cleaner") {
    // Dual-role: non-business-owner cleaner viewing as homeowner gets client route access
    if (!isBusinessOwner && state.activeRole === "homeowner" && state.homes && state.homes.length > 0) {
      if (ROUTE_ACCESS.client.some((pattern) => matchesPattern(path, pattern))) {
        return true;
      }
    }
    // Business owner cleaners get additional access
    if (isBusinessOwner) {
      if (ROUTE_ACCESS.cleaner.some((pattern) => matchesPattern(path, pattern))) {
        return true;
      }
    } else {
      // Regular cleaners - filter out business owner routes
      const cleanerRoutes = ROUTE_ACCESS.cleaner.filter(
        (route) => !route.startsWith("/business-owner") &&
                   !route.startsWith("/my-clients") &&
                   !route.startsWith("/client-detail") &&
                   !route.startsWith("/earnings-calculator")
      );
      if (cleanerRoutes.some((pattern) => matchesPattern(path, pattern))) {
        return true;
      }
    }
  }

  // Business employee
  if (accountType === "employee") {
    if (ROUTE_ACCESS.employee.some((pattern) => matchesPattern(path, pattern))) {
      return true;
    }
  }

  // Client/Homeowner (default or null account type)
  if (!accountType || accountType === "client") {
    if (ROUTE_ACCESS.client.some((pattern) => matchesPattern(path, pattern))) {
      return true;
    }
  }

  return false;
};

/**
 * Get the home route for a user based on their account type
 * @param {object} state - The application state
 * @returns {string}
 */
const getHomeRoute = (state) => {
  if (!state?.currentUser?.token) {
    return "/sign-in";
  }
  // All authenticated users go to "/" which renders their appropriate dashboard
  return "/";
};

/**
 * ProtectedRoute component that wraps routes and enforces access control
 *
 * Usage:
 * <ProtectedRoute state={state}>
 *   <YourComponent />
 * </ProtectedRoute>
 */
const ProtectedRoute = ({ children, state }) => {
  const location = useLocation();
  const path = location.pathname;

  // Check if user has access to this route
  if (!hasRouteAccess(path, state)) {
    // Redirect to appropriate home page
    const homeRoute = getHomeRoute(state);

    // Avoid redirect loop
    if (path !== homeRoute) {
      return <Navigate to={homeRoute} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
export { hasRouteAccess, getHomeRoute, ROUTE_ACCESS };
