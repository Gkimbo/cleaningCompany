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
import homePageStyles from "../../services/styles/HomePageStyles";
import UserFormStyles from "../../services/styles/UserInputFormStyle";

const API_BASE = "https://your-backend-url.com/api/v1"; // 🔹 Update to your backend URL

const Bill = ({ state, dispatch }) => {
  const [amountToPay, setAmountToPay] = useState(0);
  const [error, setError] = useState(null);
  const [appointmentId, setAppointmentId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const navigate = useNavigate();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Compute total due
  let appointmentOverdue = 0 + state.bill.cancellationFee;
  state.appointments.forEach((appt) => {
    const appointmentDate = new Date(appt.date);
    const today = new Date();
    if (!appt.paid && appointmentDate <= today) {
      appointmentOverdue += Number(appt.price);
    }
  });

  useEffect(() => {
    setAmountToPay(appointmentOverdue);
  }, [appointmentOverdue]);

  const handleAmountToPay = (amount) => {
    const regex = /^\d*(\.\d*)?$/;
    if (!regex.test(amount)) {
      setError("Amount must be a number");
      return;
    }
    setError(null);
    setAmountToPay(amount);
  };

  /**
   * 🔹 Step 1: Create Payment Intent (Backend Handles Airbnb + Email)
   */
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
      if (!response.ok) throw new Error(data.error || "Failed to create payment intent");

      setAppointmentId(data.appointmentId);
      return data.clientSecret;
    } catch (err) {
      console.error("❌ PaymentIntent Error:", err);
      Alert.alert("Error", err.message || "Could not start payment");
      return null;
    }
  };

  /**
   * 🔹 Step 2: Present Stripe Payment Sheet
   */
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
        payload: { totalDue: state.bill.totalDue + Number(amountToPay) },
      });

      // 🔹 Notify backend to sync with Airbnb and create cleaner job
      await syncAirbnbBooking();
      navigate("/");
    }
  };

  /**
   * 🔹 Step 3: Notify backend to sync Airbnb + Create Job for Cleaners
   */
  const syncAirbnbBooking = async () => {
    try {
      const res = await fetch(`${API_BASE}/airbnb/sync-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: state.currentUser.token,
          userEmail: state.currentUser.email,
          homeId: state.userHomeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Airbnb sync failed");
      console.log("✅ Airbnb Booking Synced:", data);
    } catch (err) {
      console.error("❌ Airbnb Sync Error:", err);
    }
  };

  /**
   * 🔹 Step 4: Cleaner Captures Payment after Job Completion
   */
  const handleCapturePayment = async () => {
    if (!appointmentId) {
      Alert.alert("No Payment", "Please wait until client payment is confirmed.");
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
            if (!res.ok) throw new Error(data.error || "Failed to capture payment");

            Alert.alert("✅ Success", "Funds released to cleaner!");
            dispatch({
              type: "UPDATE_APPOINTMENT",
              payload: { appointmentId, status: "completed" },
            });
          } catch (err) {
            Alert.alert("Error", err.message);
          } finally {
            setIsCapturing(false);
          }
        },
      },
    ]);
  };

  /**
   * 🔹 Step 5: Refund / Cancel Payment
   */
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

            Alert.alert("✅ Success", "Payment refunded successfully");
            setAppointmentId(null);
          } catch (err) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={homePageStyles.container}>
      <View style={homePageStyles.billContainer}>
        <Text style={homePageStyles.sectionTitle}>Your Bill</Text>

        <View style={homePageStyles.billDetails}>
          <View style={homePageStyles.billRow}>
            <Text style={homePageStyles.billLabel}>Total Due:</Text>
            <Text style={homePageStyles.billValue}>${appointmentOverdue}</Text>
          </View>
        </View>

        <Text style={UserFormStyles.smallTitle}>How much to pay:</Text>
        <TextInput
          value={String(amountToPay)}
          onChangeText={handleAmountToPay}
          style={UserFormStyles.input}
          keyboardType="numeric"
        />

        {error && (
          <Text style={{ color: "red", textAlign: "center" }}>{error}</Text>
        )}

        {/* CLIENT ACTIONS */}
        {state.account === "client" && (
          <>
            <Pressable
              style={[homePageStyles.button, isProcessing && { backgroundColor: "#aaa" }]}
              onPress={!isProcessing ? openPaymentSheet : null}
            >
              <Text style={homePageStyles.buttonText}>
                {isProcessing ? "Processing..." : "Pay Now"}
              </Text>
            </Pressable>

            {appointmentId && (
              <Pressable
                style={[homePageStyles.button, { backgroundColor: "#FF6B6B", marginTop: 10 }]}
                onPress={handleCancelOrRefund}
              >
                <Text style={homePageStyles.buttonText}>Cancel / Refund</Text>
              </Pressable>
            )}
          </>
        )}

        {/* CLEANER ACTIONS */}
        {state.account === "cleaner" && appointmentId && (
          <Pressable
            style={[
              homePageStyles.button,
              { backgroundColor: "#4CAF50", marginTop: 20 },
              isCapturing && { opacity: 0.6 },
            ]}
            onPress={!isCapturing ? handleCapturePayment : null}
          >
            <Text style={homePageStyles.buttonText}>
              {isCapturing ? "Releasing..." : "Release Payment"}
            </Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
};

export default Bill;
