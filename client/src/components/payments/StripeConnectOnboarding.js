import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { API_BASE } from "../../services/config";

const StripeConnectOnboarding = ({ state, dispatch }) => {
  const [accountStatus, setAccountStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchAccountStatus = async () => {
    if (!state?.currentUser?.id) return;
    try {
      const res = await fetch(
        `${API_BASE}/stripe-connect/account-status/${state.currentUser.id}`
      );
      const data = await res.json();
      if (res.ok) {
        setAccountStatus(data);
      }
    } catch (err) {
      console.error("Error fetching account status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountStatus();
  }, [state?.currentUser?.id]);

  const handleCreateAccount = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/stripe-connect/create-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: state.currentUser.token }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      // Account created, now get onboarding link
      await handleStartOnboarding();
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartOnboarding = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/stripe-connect/onboarding-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: state.currentUser.token,
          returnUrl: "http://localhost:3000/earnings",
          refreshUrl: "http://localhost:3000/earnings",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate onboarding link");
      }

      // Open Stripe onboarding in browser
      await Linking.openURL(data.url);

      // Refresh status after a delay
      setTimeout(fetchAccountStatus, 3000);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenDashboard = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/stripe-connect/dashboard-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: state.currentUser.token }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate dashboard link");
      }

      await Linking.openURL(data.url);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
        <Text style={styles.loadingText}>Loading account status...</Text>
      </View>
    );
  }

  const getStatusColor = () => {
    if (!accountStatus?.hasAccount) return "#FFC107";
    if (accountStatus.onboardingComplete) return "#4CAF50";
    if (accountStatus.detailsSubmitted) return "#FF9800";
    return "#FFC107";
  };

  const getStatusText = () => {
    if (!accountStatus?.hasAccount) return "Not Set Up";
    if (accountStatus.onboardingComplete) return "Active";
    if (accountStatus.detailsSubmitted) return "Pending Verification";
    return "Onboarding Incomplete";
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Status Card */}
      <View style={styles.statusCard}>
        <Text style={styles.cardTitle}>Payment Account</Text>
        <View style={styles.statusRow}>
          <View
            style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}
          >
            <Text style={styles.statusBadgeText}>{getStatusText()}</Text>
          </View>
        </View>

        {accountStatus?.onboardingComplete ? (
          <View style={styles.successMessage}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>
              Your account is set up and ready to receive payouts!
            </Text>
          </View>
        ) : accountStatus?.hasAccount ? (
          <Text style={styles.warningText}>
            Please complete your account setup to receive payouts.
          </Text>
        ) : (
          <Text style={styles.infoText}>
            Set up your payment account to receive 90% of your earnings directly
            deposited to your bank account.
          </Text>
        )}
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How Payouts Work</Text>
        <View style={styles.infoItem}>
          <Text style={styles.infoNumber}>1</Text>
          <Text style={styles.infoItemText}>
            Homeowner books a cleaning and payment is authorized
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoNumber}>2</Text>
          <Text style={styles.infoItemText}>
            3 days before the appointment, payment is captured and held
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoNumber}>3</Text>
          <Text style={styles.infoItemText}>
            After you complete the job, 90% is automatically transferred to you
          </Text>
        </View>
        <View style={styles.splitInfo}>
          <Text style={styles.splitTitle}>Earnings Split</Text>
          <View style={styles.splitRow}>
            <Text style={styles.splitLabel}>You receive:</Text>
            <Text style={styles.splitValue}>90%</Text>
          </View>
          <View style={styles.splitRow}>
            <Text style={styles.splitLabel}>Platform fee:</Text>
            <Text style={styles.splitValue}>10%</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {!accountStatus?.hasAccount ? (
          <Pressable
            style={[styles.primaryButton, isProcessing && styles.buttonDisabled]}
            onPress={handleCreateAccount}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Set Up Payment Account</Text>
            )}
          </Pressable>
        ) : !accountStatus.onboardingComplete ? (
          <Pressable
            style={[styles.primaryButton, isProcessing && styles.buttonDisabled]}
            onPress={handleStartOnboarding}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Complete Setup</Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={[styles.secondaryButton, isProcessing && styles.buttonDisabled]}
            onPress={handleOpenDashboard}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#007BFF" />
            ) : (
              <Text style={styles.secondaryButtonText}>View Stripe Dashboard</Text>
            )}
          </Pressable>
        )}

        <Pressable style={styles.refreshButton} onPress={fetchAccountStatus}>
          <Text style={styles.refreshButtonText}>Refresh Status</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = {
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#F0F4F7",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F0F4F7",
  },
  loadingText: {
    marginTop: 10,
    color: "#757575",
  },
  statusCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 15,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  successMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    padding: 12,
    borderRadius: 10,
  },
  successIcon: {
    color: "#4CAF50",
    fontSize: 20,
    marginRight: 10,
  },
  successText: {
    color: "#2E7D32",
    flex: 1,
  },
  warningText: {
    color: "#F57C00",
    lineHeight: 20,
  },
  infoText: {
    color: "#757575",
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 15,
    color: "#333",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  infoNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#007BFF",
    color: "#fff",
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "700",
    marginRight: 12,
  },
  infoItemText: {
    flex: 1,
    color: "#555",
    lineHeight: 20,
  },
  splitInfo: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  splitTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
    color: "#333",
  },
  splitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  splitLabel: {
    color: "#555",
  },
  splitValue: {
    fontWeight: "700",
    color: "#333",
  },
  buttonContainer: {
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: "#007BFF",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: "#fff",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#007BFF",
  },
  secondaryButtonText: {
    color: "#007BFF",
    fontWeight: "700",
    fontSize: 16,
  },
  refreshButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  refreshButtonText: {
    color: "#007BFF",
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
};

export default StripeConnectOnboarding;
