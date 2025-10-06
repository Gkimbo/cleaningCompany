import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Alert } from "react-native";
import { useNavigate } from "react-router-native";
// import { useStripe } from "@stripe/stripe-react-native"; // 👈 import Stripe hook
import homePageStyles from "../../services/styles/HomePageStyles";
import UserFormStyles from "../../services/styles/UserInputFormStyle";

const Bill = ({ state, dispatch }) => {
  const [redirect, setRedirect] = useState(false);
  const [amountToPay, setAmountToPay] = useState(0);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  // const { initPaymentSheet, presentPaymentSheet } = useStripe(); // 👈 useStripe hook

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

  // 👉 Call backend to create a PaymentIntent
  // const fetchPaymentSheetParams = async () => {
  //   try {
  //     const response = await fetch("http://localhost:3000/create-payment-intent", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         amount: Math.round(amountToPay * 100), // convert dollars to cents
  //         currency: "usd",
  //       }),
  //     });
  //     return await response.json();
  //   } catch (err) {
  //     console.error(err);
  //     setError("Failed to connect to payment server.");
  //   }
  // };

  // const openPaymentSheet = async () => {
  //   const { clientSecret } = await fetchPaymentSheetParams();

  //   if (!clientSecret) return;

  //   const { error: initError } = await initPaymentSheet({
  //     paymentIntentClientSecret: clientSecret,
  //     merchantDisplayName: "My Clinic",
  //   });

  //   if (initError) {
  //     Alert.alert("Error", initError.message);
  //     return;
  //   }

  //   const { error: paymentError } = await presentPaymentSheet();

  //   if (paymentError) {
  //     Alert.alert(`Error code: ${paymentError.code}`, paymentError.message);
  //   } else {
  //     Alert.alert("Success", "Your payment was successful!");
  //     setRedirect(true);
  //   }
  // };

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
          {/* <Pressable style={homePageStyles.button} onPress={openPaymentSheet}>
            <Text style={homePageStyles.buttonText}>Pay Now</Text>
          </Pressable> */}
        </View>
      </View>
    </ScrollView>
  );
};

export default Bill;
