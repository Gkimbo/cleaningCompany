// Native (iOS/Android) Payment Sheet Hook
import { useStripe } from "@stripe/stripe-react-native";

export const usePaymentSheet = () => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const openPaymentSheet = async ({
    clientSecret,
    merchantDisplayName = "Kleanr Inc.",
    customerId,
    isSetupIntent = false,
  }) => {
    const initConfig = isSetupIntent
      ? {
          setupIntentClientSecret: clientSecret,
          merchantDisplayName,
          customerId,
          allowsDelayedPaymentMethods: false,
          returnURL: "kleanr://stripe-redirect",
        }
      : {
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName,
          allowsDelayedPaymentMethods: true,
          returnURL: "kleanr://stripe-redirect",
        };

    const { error: initError } = await initPaymentSheet(initConfig);

    if (initError) {
      return { error: initError };
    }

    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === "Canceled") {
        return { canceled: true };
      }
      return { error: presentError };
    }

    return { success: true };
  };

  return { openPaymentSheet };
};

export default usePaymentSheet;
