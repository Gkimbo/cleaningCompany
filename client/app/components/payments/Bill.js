import { useStripe } from "@stripe/stripe-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
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
  const [appointmentId, setAppointmentId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const navigate = useNavigate();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const appointmentOverdue = state.appointments.reduce((total, appt) => {
    const apptDate = new Date(appt.date);
    const today = new Date();
    if (!appt.paid && apptDate <= today) return total + Number(appt.price);
    return total;
  }, state.bill.cancellationFee);

  const totalPaid = state.bill.totalPaid || 0;
  const progressPercent = Math.min((totalPaid / appointmentOverdue) * 100, 100);

  useEffect(() => {
    setAmountToPay(appointmentOverdue - totalPaid);
  }, [appointmentOverdue, totalPaid]);

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
          token: state.currentUser.token,
          homeId: state.userHomeId || state.user?.homes?.[0]?.id,
          amount: Math.round(amountToPay * 100),
          userEmail: state.currentUser.email,
          userName: state.currentUser.userName,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to create payment intent");
      setAppointmentId(data.appointmentId);
      return data.clientSecret;
    } catch (err) {
      Alert.alert("Error", err.message || "Could not start payment");
      return null;
    }
  };

  const openPaymentSheet = async () => {
    setIsProcessing(true);
    const clientSecret = await createPaymentIntent();
    if (!clientSecret) {
      setIsProcessing(false);
      return;
    }
    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: clientSecret,
      merchantDisplayName: "Kleanr Inc.",
    });
    if (initError) {
      Alert.alert("Error", initError.message);
      setIsProcessing(false);
      return;
    }
    const { error: paymentError } = await presentPaymentSheet();
    setIsProcessing(false);
    if (paymentError) {
      Alert.alert("Error", paymentError.message);
    } else {
      Alert.alert("Success", "Payment authorized!");
      dispatch({
        type: "UPDATE_BILL",
        payload: { totalPaid: totalPaid + Number(amountToPay) },
      });
      await syncAirbnbBooking();
      navigate("/");
    }
  };

  const syncAirbnbBooking = async () => {
    try {
      await fetch(`${API_BASE}/airbnb/sync-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: state.currentUser.token,
          userEmail: state.currentUser.email,
          homeId: state.userHomeId,
        }),
      });
    } catch (err) {
      console.error("Airbnb Sync Error:", err);
    }
  };

  const handleCapturePayment = async () => {
    if (!appointmentId) {
      Alert.alert(
        "No Payment",
        "Please wait until client payment is confirmed."
      );
      return;
    }
    Alert.alert("Release Payment", "Confirm job completion?", [
      { text: "Cancel" },
      {
        text: "Yes",
        onPress: async () => {
          setIsCapturing(true);
          try {
            const res = await fetch(`${API_BASE}/payments/capture`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: state.currentUser.token,
                appointmentId,
              }),
            });
            const data = await res.json();
            if (!res.ok)
              throw new Error(data.error || "Failed to capture payment");
            Alert.alert("Success", "Funds released to cleaner!");
          } catch (err) {
            Alert.alert("Error", err.message);
          } finally {
            setIsCapturing(false);
          }
        },
      },
    ]);
  };

  const handleCancelOrRefund = async () => {
    if (!appointmentId) {
      Alert.alert("Error", "No active payment to cancel.");
      return;
    }
    Alert.alert("Cancel Payment", "Are you sure?", [
      { text: "No" },
      {
        text: "Yes",
        onPress: async () => {
          try {
            const res = await fetch(`${API_BASE}/payments/refund`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: state.currentUser.token,
                appointmentId,
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Refund failed");
            Alert.alert("Success", "Payment refunded successfully");
            setAppointmentId(null);
          } catch (err) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
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

      {/* Cleaner Actions */}
      {state.account === "cleaner" && appointmentId && (
        <Pressable
          onPress={!isCapturing ? handleCapturePayment : null}
          style={{
            backgroundColor: "#4CAF50",
            paddingVertical: 15,
            borderRadius: 15,
            alignItems: "center",
            opacity: isCapturing ? 0.6 : 1,
            marginTop: 20,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
            {isCapturing ? "Releasing..." : "Release Payment"}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
};

export default Bill;
