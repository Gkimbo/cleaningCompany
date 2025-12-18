// Native (iOS/Android) Stripe Provider
import { StripeProvider as NativeStripeProvider } from "@stripe/stripe-react-native";
import React from "react";

export const StripeProvider = ({ publishableKey, children }) => {
  if (!publishableKey) {
    return children;
  }

  return (
    <NativeStripeProvider
      publishableKey={publishableKey}
      urlScheme="kleanr"
      merchantIdentifier="merchant.com.kleanr"
    >
      {children}
    </NativeStripeProvider>
  );
};

export default StripeProvider;
