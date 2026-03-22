import React from "react";
import { View } from "react-native";
import { Navigate, useLocation } from "react-router-native";
import FrozenAccountBanner from "./FrozenAccountBanner";

// Routes that frozen users can still access
const ALLOWED_FROZEN_ROUTES = [
  "/",
  "/sign-in",
  "/sign-out",
  "/account-settings",
  "/messages",
  "/notifications",
  "/cleaner-profile",
];

const FrozenAccountWrapper = ({ children, state }) => {
  const location = useLocation();

  // If not frozen or not logged in, render children normally
  if (!state?.accountFrozen || !state?.currentUser) {
    return children;
  }

  // Check if current route is allowed
  const isAllowedRoute = ALLOWED_FROZEN_ROUTES.some(
    (route) =>
      location.pathname === route || location.pathname.startsWith(route + "/")
  );

  // If on allowed route, show banner + content
  if (isAllowedRoute) {
    return (
      <View style={{ flex: 1 }}>
        <FrozenAccountBanner reason={state.accountFrozenReason} />
        {children}
      </View>
    );
  }

  // Redirect to home with frozen message
  return <Navigate to="/" replace />;
};

export default FrozenAccountWrapper;
