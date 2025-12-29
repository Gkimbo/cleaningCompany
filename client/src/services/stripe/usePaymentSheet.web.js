// Web Payment Sheet Hook
// On web, we use Stripe Checkout for a hosted payment page experience
// This provides a compatible interface for the components

import { loadStripe } from "@stripe/stripe-js";

let stripeInstance = null;
let currentKey = null;

const getStripe = async (publishableKey) => {
  if (!publishableKey) {
    return null;
  }
  // Reinitialize if key changed or not yet initialized
  if (!stripeInstance || currentKey !== publishableKey) {
    currentKey = publishableKey;
    stripeInstance = await loadStripe(publishableKey);
  }
  return stripeInstance;
};

export const usePaymentSheet = () => {
  const openPaymentSheet = async ({
    clientSecret,
    merchantDisplayName = "Kleanr Inc.",
    customerId,
    isSetupIntent = false,
    publishableKey,
    returnUrlParams = "",
  }) => {
    try {
      const stripe = await getStripe(publishableKey);

      if (!stripe) {
        return { error: { message: "Stripe not initialized. Please refresh and try again." } };
      }

      if (isSetupIntent) {
        // For setup intents on web, use confirmSetup with redirect
        // This opens Stripe's hosted page for card entry
        const returnUrl = `${window.location.origin}/payment-setup?setup_complete=true`;

        const { error } = await stripe.confirmSetup({
          clientSecret,
          confirmParams: {
            return_url: returnUrl,
          },
        });

        // If we get here without redirect, there was an error
        if (error) {
          return { error };
        }

        // This typically won't be reached as confirmSetup redirects
        return { success: true };
      } else {
        // For payment intents, use confirmPayment with redirect
        // Include custom params (like amount) for recording the payment after redirect
        const baseUrl = `${window.location.origin}${window.location.pathname}`;
        const returnUrl = returnUrlParams
          ? `${baseUrl}?${returnUrlParams}`
          : `${baseUrl}?payment_complete=true`;

        const { error } = await stripe.confirmPayment({
          clientSecret,
          confirmParams: {
            return_url: returnUrl,
          },
        });

        if (error) {
          if (error.code === "canceled") {
            return { canceled: true };
          }
          return { error };
        }

        return { success: true };
      }
    } catch (err) {
      return { error: { message: err.message } };
    }
  };

  return { openPaymentSheet };
};

export default usePaymentSheet;
