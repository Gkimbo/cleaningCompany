import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { usePaymentSheet } from "../../services/stripe";
import { API_BASE } from "../../services/config";

const Bill = ({ state, dispatch }) => {
  const [amountToPay, setAmountToPay] = useState(0);
  const [error, setError] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [unpaidAppointments, setUnpaidAppointments] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [failedPayments, setFailedPayments] = useState([]);
  const [upcomingPayable, setUpcomingPayable] = useState([]);
  const [retryingPaymentId, setRetryingPaymentId] = useState(null);
  const [prePayingId, setPrePayingId] = useState(null);
  const navigate = useNavigate();
  const { openPaymentSheet } = usePaymentSheet();

  const cancellationFee = state?.bill?.cancellationFee || 0;
  const appointmentOverdue = (state?.appointments || []).reduce((total, appt) => {
    const apptDate = new Date(appt.date);
    const today = new Date();
    if (!appt.paid && apptDate <= today) return total + Number(appt.price || 0);
    return total;
  }, cancellationFee);

  const totalPaid = state?.bill?.totalPaid || 0;
  const progressPercent = appointmentOverdue > 0
    ? Math.min((totalPaid / appointmentOverdue) * 100, 100)
    : 0;

  useEffect(() => {
    const appointments = state?.appointments || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get unpaid appointments
    const unpaid = appointments.filter((appt) => !appt.paid);
    setUnpaidAppointments(unpaid);

    // Failed payments - need retry
    const failed = appointments.filter(
      appt => appt.paymentCaptureFailed && !appt.paid
    );
    setFailedPayments(failed);

    // Upcoming payable - can pre-pay (has cleaner, has payment intent, not paid, future date)
    const upcoming = appointments.filter(appt => {
      const apptDate = new Date(appt.date);
      apptDate.setHours(0, 0, 0, 0);
      return (
        !appt.paid &&
        apptDate > today &&
        appt.hasBeenAssigned &&
        appt.paymentIntentId &&
        !appt.paymentCaptureFailed
      );
    });
    setUpcomingPayable(upcoming);

    // Calculate default amount
    const defaultAmount = appointmentOverdue - totalPaid;
    setAmountToPay(defaultAmount > 0 ? defaultAmount : 0);

    // Fetch payment history
    fetchPaymentHistory();
  }, [state?.appointments, appointmentOverdue, totalPaid]);

  const fetchPaymentHistory = async () => {
    if (!state?.currentUser?.id) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/payments/history/${state.currentUser.id}`);
      const data = await res.json();
      if (res.ok) {
        setPaymentHistory(data.payments || []);
      }
    } catch (err) {
      console.error("Error fetching payment history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleAmountToPay = (amount) => {
    const regex = /^\d*(\.\d*)?$/;
    if (!regex.test(amount)) {
      setError("Amount must be a valid number");
      return;
    }
    setError(null);
    setAmountToPay(amount);
  };

  const createPaymentIntent = async () => {
    try {
      const response = await fetch(`${API_BASE}/payments/create-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(Number(amountToPay) * 100),
          email: state?.currentUser?.email,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to create payment intent");
      return data.clientSecret;
    } catch (err) {
      Alert.alert("Error", err.message || "Could not start payment");
      return null;
    }
  };

  const handlePayment = async () => {
    if (Number(amountToPay) <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    setIsProcessing(true);
    const clientSecret = await createPaymentIntent();
    if (!clientSecret) {
      setIsProcessing(false);
      return;
    }

    const result = await openPaymentSheet({
      clientSecret,
      merchantDisplayName: "Kleanr Inc.",
      isSetupIntent: false,
    });

    setIsProcessing(false);

    if (result.error) {
      Alert.alert("Payment Error", result.error.message);
    } else if (result.canceled) {
      // User canceled - do nothing
    } else if (result.success) {
      Alert.alert("Success", "Payment completed successfully!");
      dispatch({
        type: "UPDATE_BILL",
        payload: { totalPaid: totalPaid + Number(amountToPay) },
      });
      fetchPaymentHistory();
    }
  };

  const handleCancelOrRefund = async (appointmentId) => {
    if (!appointmentId) {
      Alert.alert("Error", "No payment selected to cancel.");
      return;
    }
    Alert.alert("Cancel Payment", "Are you sure you want to request a refund?", [
      { text: "No" },
      {
        text: "Yes",
        onPress: async () => {
          try {
            const res = await fetch(`${API_BASE}/payments/refund`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ appointmentId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Refund failed");
            Alert.alert("Success", "Refund processed successfully");
            fetchPaymentHistory();
          } catch (err) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "succeeded":
      case "captured":
        return "#4CAF50";
      case "pending":
        return "#FFC107";
      case "failed":
        return "#F44336";
      case "refunded":
        return "#9E9E9E";
      default:
        return "#757575";
    }
  };

  const handleRetryPayment = async (appointmentId) => {
    setRetryingPaymentId(appointmentId);
    try {
      const response = await fetch(`${API_BASE}/payments/retry-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state?.token}`,
        },
        body: JSON.stringify({ appointmentId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      Alert.alert("Success", "Payment completed successfully!");
      fetchPaymentHistory();
    } catch (err) {
      Alert.alert("Error", err.message || "Payment failed. Please try again.");
    } finally {
      setRetryingPaymentId(null);
    }
  };

  const handlePrePay = async (appointmentId) => {
    setPrePayingId(appointmentId);
    try {
      const response = await fetch(`${API_BASE}/payments/pre-pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state?.token}`,
        },
        body: JSON.stringify({ appointmentId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      Alert.alert("Success", "Payment completed! You're all set for this appointment.");
      fetchPaymentHistory();
    } catch (err) {
      Alert.alert("Error", err.message || "Payment failed. Please try again.");
    } finally {
      setPrePayingId(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: 20,
        backgroundColor: "#F0F4F7",
      }}
    >
      {/* Total Due Card */}
      <View
        style={{
          backgroundColor: "#007BFF",
          borderRadius: 20,
          padding: 25,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 6,
          marginBottom: 15,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 20,
            fontWeight: "600",
            marginBottom: 5,
          }}
        >
          Total Due
        </Text>
        <Text style={{ color: "#fff", fontSize: 36, fontWeight: "700" }}>
          ${appointmentOverdue.toFixed(2)}
        </Text>

        {/* Progress Bar */}
        <View
          style={{
            marginTop: 20,
            height: 15,
            width: "100%",
            backgroundColor: "#E0E0E0",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              backgroundColor: "#4CAF50",
            }}
          />
        </View>
        
        {typeof progressPercent === "number" &&
          !Number.isNaN(progressPercent) && (
            <Text style={{ color: "#fff", marginTop: 5, fontWeight: "600" }}>
              Paid: {progressPercent.toFixed(0)}%
            </Text>
          )}
      </View>

      {/* Payment Methods Section */}
      <Pressable
        onPress={() => navigate("/payment-setup")}
        style={{
          backgroundColor: "#fff",
          borderRadius: 15,
          padding: 18,
          marginBottom: 15,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: "#eff6ff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="credit-card" size={20} color="#2563eb" />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#1f2937" }}>
              Payment Methods
            </Text>
            <Text style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
              Add or manage your cards
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={16} color="#9ca3af" />
      </Pressable>

      {/* Failed Payments Section */}
      {failedPayments.length > 0 && (
        <View
          style={{
            backgroundColor: "#fef2f2",
            borderRadius: 15,
            padding: 20,
            marginBottom: 15,
            borderWidth: 1,
            borderColor: "#fecaca",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icon name="exclamation-triangle" size={16} color="#dc2626" />
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#1f2937" }}>
              Payment Failed
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: "#6b7280", marginBottom: 15 }}>
            Retry to avoid appointment cancellation
          </Text>
          {failedPayments.map(appt => (
            <View
              key={appt.id}
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: 15,
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#1f2937" }}>
                  {new Date(appt.date).toLocaleDateString()}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#dc2626" }}>
                  ${appt.price}
                </Text>
              </View>
              <Pressable
                onPress={() => handleRetryPayment(appt.id)}
                disabled={retryingPaymentId === appt.id}
                style={{
                  backgroundColor: retryingPaymentId === appt.id ? "#f87171" : "#dc2626",
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: "center",
                }}
              >
                {retryingPaymentId === appt.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                    Retry Payment
                  </Text>
                )}
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Amount Input Card */}
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 15,
          padding: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.1,
          shadowRadius: 5,
          elevation: 4,
          marginBottom: 25,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 10 }}>
          Enter Amount to Pay
        </Text>
        <TextInput
          value={String(amountToPay)}
          onChangeText={handleAmountToPay}
          keyboardType="numeric"
          style={{
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 12,
            paddingHorizontal: 15,
            paddingVertical: 12,
            fontSize: 16,
            backgroundColor: "#f9f9f9",
          }}
        />
        {error && (
          <Text
            style={{ color: "#FF4D4F", textAlign: "center", marginTop: 10 }}
          >
            {error}
          </Text>
        )}
      </View>

      {/* Customer Actions */}
      {state.account === null && (
        <>
          <Pressable
            onPress={!isProcessing ? handlePayment : null}
            style={{
              backgroundColor: isProcessing ? "#aaa" : "#007BFF",
              paddingVertical: 15,
              borderRadius: 15,
              alignItems: "center",
              marginBottom: selectedAppointment ? 15 : 0,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              {isProcessing ? "Processing..." : "Pay Now"}
            </Text>
          </Pressable>

          {selectedAppointment && (
            <Pressable
              onPress={() => handleCancelOrRefund(selectedAppointment)}
              style={{
                backgroundColor: "#FF6B6B",
                paddingVertical: 15,
                borderRadius: 15,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                Cancel / Refund
              </Text>
            </Pressable>
          )}
        </>
      )}

      {/* Pre-Pay Section */}
      {upcomingPayable.length > 0 && (
        <View
          style={{
            backgroundColor: "#eff6ff",
            borderRadius: 15,
            padding: 20,
            marginTop: 20,
            borderWidth: 1,
            borderColor: "#bfdbfe",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icon name="calendar-check-o" size={16} color="#2563eb" />
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#1f2937" }}>
              Pay Ahead
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: "#6b7280", marginBottom: 15 }}>
            Pre-pay for upcoming appointments
          </Text>
          {upcomingPayable.map(appt => (
            <View
              key={appt.id}
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: 15,
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#1f2937" }}>
                  {new Date(appt.date).toLocaleDateString()}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#1f2937" }}>
                  ${appt.price}
                </Text>
              </View>
              <Pressable
                onPress={() => handlePrePay(appt.id)}
                disabled={prePayingId === appt.id}
                style={{
                  backgroundColor: prePayingId === appt.id ? "#60a5fa" : "#2563eb",
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: "center",
                }}
              >
                {prePayingId === appt.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                    Pay Now
                  </Text>
                )}
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Payment History Section */}
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 15,
          padding: 20,
          marginTop: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.1,
          shadowRadius: 5,
          elevation: 4,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 15 }}>
          Payment History
        </Text>

        {isLoadingHistory ? (
          <ActivityIndicator size="small" color="#007BFF" />
        ) : paymentHistory.length === 0 ? (
          <Text style={{ color: "#757575", textAlign: "center" }}>
            No payment history yet
          </Text>
        ) : (
          paymentHistory.slice(0, 5).map((payment) => (
            <View
              key={payment.id}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: "#E0E0E0",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600" }}>
                  {new Date(payment.date).toLocaleDateString()}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: getStatusColor(payment.paymentStatus),
                      marginRight: 6,
                    }}
                  />
                  <Text style={{ color: "#757575", fontSize: 12 }}>
                    {payment.paymentStatus || "pending"}
                  </Text>
                </View>
              </View>
              <Text style={{ fontWeight: "700", fontSize: 16 }}>
                ${payment.price}
              </Text>
              {payment.paymentStatus === "succeeded" && (
                <Pressable
                  onPress={() => handleCancelOrRefund(payment.id)}
                  style={{ marginLeft: 10 }}
                >
                  <Text style={{ color: "#FF6B6B", fontSize: 12 }}>Refund</Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

export default Bill;
