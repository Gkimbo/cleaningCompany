// Web Stripe Provider
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import React, { useEffect, useState } from "react";

let stripePromise = null;

export const StripeProvider = ({ publishableKey, children }) => {
  const [stripe, setStripe] = useState(null);

  useEffect(() => {
    if (publishableKey && !stripePromise) {
      stripePromise = loadStripe(publishableKey);
      stripePromise.then(setStripe);
    }
  }, [publishableKey]);

  if (!publishableKey) {
    return children;
  }

  // For web, Elements provider is only needed when actually using Stripe components
  // We'll wrap at the payment component level instead
  return children;
};

// Export loadStripe for components that need it
export { loadStripe };

export default StripeProvider;
