// Web Payment Sheet Hook
// On web, we'll use a different approach with Stripe Elements
// This provides a compatible interface for the components

import { loadStripe } from "@stripe/stripe-js";

let stripeInstance = null;

const getStripe = async (publishableKey) => {
  if (!stripeInstance && publishableKey) {
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
  }) => {
    try {
      const stripe = await getStripe(publishableKey);

      if (!stripe) {
        return { error: { message: "Stripe not initialized" } };
      }

      if (isSetupIntent) {
        // For setup intents, we use confirmCardSetup
        // Note: On web, we'd typically use Stripe Elements for card input
        // This is a simplified version - for full web support,
        // you'd want to render a card element UI
        const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
          payment_method: {
            card: {
              // On web, this would come from a CardElement
              // For now, we'll use the payment sheet redirect
            },
          },
        });

        if (error) {
          return { error };
        }

        return { success: true, setupIntent };
      } else {
        // For payment intents
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret);

        if (error) {
          if (error.code === "canceled") {
            return { canceled: true };
          }
          return { error };
        }

        return { success: true, paymentIntent };
      }
    } catch (err) {
      return { error: { message: err.message } };
    }
  };

  return { openPaymentSheet };
};

export default usePaymentSheet;
