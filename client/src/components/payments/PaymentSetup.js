import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { usePaymentSheet } from "../../services/stripe";
import { API_BASE } from "../../services/config";

const PaymentSetup = ({ state, dispatch, onSetupComplete, redirectTo }) => {
  const navigate = useNavigate();
  const { openPaymentSheet } = usePaymentSheet();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPaymentMethodStatus();
  }, []);

  const fetchPaymentMethodStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/payments/payment-method-status`, {
        headers: {
          Authorization: `Bearer ${state.currentUser.token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setPaymentMethods(data.paymentMethods || []);
        setHasPaymentMethod(data.hasPaymentMethod);
      }
    } catch (err) {
      console.error("Error fetching payment status:", err);
      setError("Failed to load payment information");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Create SetupIntent
      const setupResponse = await fetch(`${API_BASE}/payments/setup-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: state.currentUser.token }),
      });
      const setupData = await setupResponse.json();

      if (!setupResponse.ok) {
        throw new Error(setupData.error || "Failed to initialize payment setup");
      }

      // Use the platform-agnostic payment sheet
      const result = await openPaymentSheet({
        clientSecret: setupData.clientSecret,
        merchantDisplayName: "Kleanr Inc.",
        customerId: setupData.customerId,
        isSetupIntent: true,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      if (result.canceled) {
        // User canceled - just return
        setIsProcessing(false);
        return;
      }

      // Confirm the payment method was saved
      const confirmResponse = await fetch(`${API_BASE}/payments/confirm-payment-method`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: state.currentUser.token,
          setupIntentId: setupData.clientSecret.split("_secret_")[0],
        }),
      });

      const confirmData = await confirmResponse.json();

      if (confirmResponse.ok && confirmData.success) {
        setHasPaymentMethod(true);
        fetchPaymentMethodStatus();
        Alert.alert("Success", "Payment method added successfully!");

        if (onSetupComplete) {
          onSetupComplete();
        } else if (redirectTo) {
          navigate(redirectTo);
        }
      } else {
        throw new Error(confirmData.error || "Failed to save payment method");
      }
    } catch (err) {
      console.error("Payment setup error:", err);
      setError(err.message);
      Alert.alert("Error", err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePaymentMethod = async (paymentMethodId) => {
    Alert.alert(
      "Remove Card",
      "Are you sure you want to remove this payment method?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_BASE}/payments/payment-method/${paymentMethodId}`,
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${state.currentUser.token}`,
                  },
                }
              );
              const data = await response.json();

              if (response.ok) {
                setHasPaymentMethod(data.hasPaymentMethod);
                fetchPaymentMethodStatus();
                Alert.alert("Success", "Payment method removed");
              } else {
                throw new Error(data.error);
              }
            } catch (err) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  const getCardIcon = (brand) => {
    switch (brand?.toLowerCase()) {
      case "visa":
        return "cc-visa";
      case "mastercard":
        return "cc-mastercard";
      case "amex":
        return "cc-amex";
      case "discover":
        return "cc-discover";
      default:
        return "credit-card";
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading payment information...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Icon name="credit-card" size={40} color={colors.primary[500]} />
        <Text style={styles.title}>Payment Method</Text>
        <Text style={styles.subtitle}>
          Add a payment method to book cleaning appointments. Your card will be
          charged 3 days before each scheduled cleaning.
        </Text>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorBox}>
          <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Saved Payment Methods */}
      {paymentMethods.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Cards</Text>
          {paymentMethods.map((method) => (
            <View key={method.id} style={styles.cardItem}>
              <Icon
                name={getCardIcon(method.brand)}
                size={28}
                color={colors.text.primary}
              />
              <View style={styles.cardDetails}>
                <Text style={styles.cardBrand}>
                  {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)}
                </Text>
                <Text style={styles.cardNumber}>**** **** **** {method.last4}</Text>
                <Text style={styles.cardExpiry}>
                  Expires {method.expMonth}/{method.expYear}
                </Text>
              </View>
              <Pressable
                onPress={() => handleRemovePaymentMethod(method.id)}
                style={styles.removeButton}
              >
                <Icon name="trash" size={18} color={colors.error[500]} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* No Payment Method Warning */}
      {!hasPaymentMethod && (
        <View style={styles.warningBox}>
          <Icon name="exclamation-triangle" size={24} color={colors.warning[600]} />
          <Text style={styles.warningTitle}>Payment Method Required</Text>
          <Text style={styles.warningText}>
            You need to add a payment method before you can book cleaning appointments.
          </Text>
        </View>
      )}

      {/* Add Payment Method Button */}
      <Pressable
        style={[
          styles.addButton,
          isProcessing && styles.buttonDisabled,
        ]}
        onPress={handleAddPaymentMethod}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color={colors.neutral[0]} />
        ) : (
          <>
            <Icon name="plus" size={16} color={colors.neutral[0]} style={styles.buttonIcon} />
            <Text style={styles.addButtonText}>
              {paymentMethods.length > 0 ? "Add Another Card" : "Add Payment Method"}
            </Text>
          </>
        )}
      </Pressable>

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Icon name="lock" size={16} color={colors.text.tertiary} />
        <Text style={styles.infoText}>
          Your payment information is securely stored by Stripe. We never store your
          full card details on our servers.
        </Text>
      </View>

      {/* Continue Button (when coming from booking flow) */}
      {hasPaymentMethod && redirectTo && (
        <Pressable
          style={styles.continueButton}
          onPress={() => navigate(redirectTo)}
        >
          <Text style={styles.continueButtonText}>Continue to Booking</Text>
          <Icon name="arrow-right" size={16} color={colors.neutral[0]} />
        </Pressable>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing["4xl"],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
    paddingTop: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 22,
  },

  // Section
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  // Card Item
  cardItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cardBrand: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  cardNumber: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  cardExpiry: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  removeButton: {
    padding: spacing.sm,
  },

  // Warning Box
  warningBox: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  warningTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
    marginTop: spacing.sm,
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    textAlign: "center",
    marginTop: spacing.xs,
  },

  // Error Box
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
  },

  // Buttons
  addButton: {
    backgroundColor: colors.primary[600],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  buttonDisabled: {
    backgroundColor: colors.neutral[400],
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  addButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  continueButton: {
    backgroundColor: colors.success[600],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  continueButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  // Info Box
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    lineHeight: 18,
  },
});

export default PaymentSetup;
