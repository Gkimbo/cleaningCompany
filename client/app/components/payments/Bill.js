import { useStripe } from "@stripe/stripe-react-native";
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

const API_BASE = "http://localhost:3000/api/v1";

const Bill = ({ state, dispatch }) => {
  const [amountToPay, setAmountToPay] = useState(0);
  const [error, setError] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [unpaidAppointments, setUnpaidAppointments] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const navigate = useNavigate();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

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
    // Get unpaid appointments
    const unpaid = (state?.appointments || []).filter((appt) => !appt.paid);
    setUnpaidAppointments(unpaid);

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

  const openPaymentSheet = async () => {
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
    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: clientSecret,
      merchantDisplayName: "Kleanr Inc.",
      allowsDelayedPaymentMethods: true,
    });
    if (initError) {
      Alert.alert("Error", initError.message);
      setIsProcessing(false);
      return;
    }
    const { error: paymentError } = await presentPaymentSheet();
    setIsProcessing(false);
    if (paymentError) {
      if (paymentError.code !== "Canceled") {
        Alert.alert("Payment Error", paymentError.message);
      }
    } else {
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
            onPress={!isProcessing ? openPaymentSheet : null}
            style={{
              backgroundColor: isProcessing ? "#aaa" : "#007BFF",
              paddingVertical: 15,
              borderRadius: 15,
              alignItems: "center",
              marginBottom: appointmentId ? 15 : 0,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              {isProcessing ? "Processing..." : "Pay Now"}
            </Text>
          </Pressable>

          {appointmentId && (
            <Pressable
              onPress={handleCancelOrRefund}
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
