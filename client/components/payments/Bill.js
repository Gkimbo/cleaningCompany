import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { useNavigate } from "react-router-native";
import { useStripe } from "@stripe/stripe-react-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import UserFormStyles from "../../services/styles/UserInputFormStyle";

const Bill = ({ state, dispatch }) => {
  const [redirect, setRedirect] = useState(false);
  const [amountToPay, setAmountToPay] = useState(0);
  const [error, setError] = useState(null);
  const [appointmentId, setAppointmentId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const navigate = useNavigate();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // total overdue logic
  let appointmentOverdue = 0 + state.bill.cancellationFee;
  state.appointments.forEach((appt) => {
    const appointmentDate = new Date(appt.date);
    const today = new Date();
    if (!appt.paid && appointmentDate <= today) {
      appointmentOverdue += Number(appt.price);
    }
  });

  const handleAmountToPay = (amount) => {
    const regex = /^\d*(\.\d*)?(\s*)?$/;
    if (!regex.test(amount)) {
      setError("Amount can only be a number!");
      return;
    }
    if (amount === "") {
      setError("Amount cannot be blank!");
    } else {
      setError(null);
    }
    setAmountToPay(amount);
  };

  useEffect(() => {
    if (redirect) {
      navigate("/");
      setRedirect(false);
    }
    setAmountToPay(appointmentOverdue);
  }, [redirect, appointmentOverdue]);

  /**
   * ------------------------------------------------------
   *  Create PaymentIntent via backend (authorize only)
   * ------------------------------------------------------
   */
  const createPaymentIntent = async () => {
    try {
      const response = await fetch(
        "http://localhost:3000/api/v1/payments/create-payment-intent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: state.currentUser.token,
            homeId: state.userHomeId || state.user?.homes?.[0]?.id,
            amount: Math.round(amountToPay * 100),
          }),
        }
      );
      const data = await response.json();
      if (!data.clientSecret) throw new Error("Missing clientSecret");
      setAppointmentId(data.appointmentId);
      return data.clientSecret;
    } catch (err) {
      console.error(err);
      setError("Failed to create payment intent.");
      return null;
    }
  };

  /**
   * ------------------------------------------------------
   *  Open Stripe Payment Sheet
   * ------------------------------------------------------
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
      Alert.alert(`Error code: ${paymentError.code}`, paymentError.message);
    } else {
      Alert.alert("Success", "Payment authorized and held!");
      dispatch({
        type: "UPDATE_BILL",
        payload: { totalDue: state.bill.totalDue + Number(amountToPay) },
      });
      setRedirect(true);
    }
  };

  /**
   * ------------------------------------------------------
   *  Cleaner: Capture Payment After Job Completion
   * ------------------------------------------------------
   */
  const handleCapturePayment = async () => {
    if (!appointmentId) {
      Alert.alert("No Payment Found", "Please ensure a client has paid first.");
      return;
    }

    Alert.alert(
      "Release Payment",
      "Confirm job completion and release held funds?",
      [
        { text: "No" },
        {
          text: "Yes, release",
          onPress: async () => {
            setIsCapturing(true);
            try {
              const response = await fetch(
                "http://localhost:3000/api/v1/payments/capture-payment",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    token: state.currentUser.token,
                    appointmentId,
                  }),
                }
              );
              const data = await response.json();
              if (data.success) {
                Alert.alert("✅ Success", "Funds released to cleaner!");
                dispatch({
                  type: "UPDATE_APPOINTMENT",
                  payload: { appointmentId, status: "completed" },
                });
              } else {
                Alert.alert("Error", data.error || "Unable to capture payment.");
              }
            } catch (err) {
              console.error(err);
              Alert.alert("Error", "Payment capture failed.");
            } finally {
              setIsCapturing(false);
            }
          },
        },
      ]
    );
  };

  /**
   * ------------------------------------------------------
   *  Cancel or Refund Payment
   * ------------------------------------------------------
   */
  const handleCancelOrRefund = async () => {
    if (!appointmentId) {
      Alert.alert("No Payment Found", "Please make a payment first.");
      return;
    }

    Alert.alert("Cancel Payment", "Are you sure you want to cancel/refund?", [
      { text: "No" },
      {
        text: "Yes",
        onPress: async () => {
          try {
            const response = await fetch(
              "http://localhost:3000/api/v1/payments/cancel-or-refund",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  token: state.currentUser.token,
                  appointmentId,
                }),
              }
            );
            const data = await response.json();
            if (data.success) {
              Alert.alert("Success", "Payment canceled/refunded successfully.");
              setAppointmentId(null);
              dispatch({
                type: "UPDATE_BILL",
                payload: { totalDue: state.bill.totalDue - Number(amountToPay) },
              });
            } else {
              Alert.alert("Error", data.error || "Refund failed.");
            }
          } catch (err) {
            console.error(err);
            Alert.alert("Error", "Unable to process refund.");
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
            <Text style={homePageStyles.billLabel}>Total Due today:</Text>
            <Text style={homePageStyles.billValue}>${appointmentOverdue}</Text>
          </View>

          <View style={homePageStyles.billDivider} />
          <Text style={homePageStyles.billText}>
            Appointment Due: ${state.bill.appointmentDue}
          </Text>
          <Text style={homePageStyles.billText}>
            Cancellation Fee: ${state.bill.cancellationFee}
          </Text>
          <View style={homePageStyles.billDivider} />
          <Text style={homePageStyles.billText}>
            Total for all appointments: ${state.bill.totalDue}
          </Text>
        </View>

        <View style={{ flexDirection: "column" }}>
          <Text style={UserFormStyles.smallTitle}>How much to pay:</Text>
          <TextInput
            value={String(amountToPay)}
            onChangeText={handleAmountToPay}
            style={UserFormStyles.input}
            keyboardType="numeric"
          />

          {error && (
            <Text style={{ alignSelf: "center", color: "red", marginBottom: 20 }}>
              {error}
            </Text>
          )}

          {/* CLIENT ACTIONS */}
          {state.account === "client" && (
            <>
              <Pressable
                style={[
                  homePageStyles.button,
                  isProcessing && { backgroundColor: "#aaa" },
                ]}
                onPress={!isProcessing ? openPaymentSheet : null}
              >
                <Text style={homePageStyles.buttonText}>
                  {isProcessing ? "Processing..." : "Pay Now"}
                </Text>
              </Pressable>

              {appointmentId && (
                <Pressable
                  style={[
                    homePageStyles.button,
                    { backgroundColor: "#FF6B6B", marginTop: 10 },
                  ]}
                  onPress={handleCancelOrRefund}
                >
                  <Text style={homePageStyles.buttonText}>Cancel / Refund</Text>
                </Pressable>
              )}
            </>
          )}

          {/* CLEANER ACTION */}
          {state.account === "cleaner" && appointmentId && (
            <Pressable
              style={[
                homePageStyles.button,
                {
                  backgroundColor: "#4CAF50",
                  marginTop: 20,
                  opacity: isCapturing ? 0.7 : 1,
                },
              ]}
              onPress={!isCapturing ? handleCapturePayment : null}
            >
              <Text style={homePageStyles.buttonText}>
                {isCapturing ? "Releasing..." : "Release Payment"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default Bill;
