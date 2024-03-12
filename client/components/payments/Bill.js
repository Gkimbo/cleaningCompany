import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import UserFormStyles from "../../services/styles/UserInputFormStyle";

const Bill = ({ state, dispatch }) => {
	const [redirect, setRedirect] = useState(false);
	let appointmentOverdue = 0 + state.bill.cancellationFee;
	const [amountToPay, setAmountToPay] = useState(0);
	const [error, setError] = useState(null);
	const navigate = useNavigate();

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

	const handlePress = () => {
		setRedirect(true);
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
				<form onSubmit={handlePress}>
					<View style={{ flexDirection: "column" }}>
						<Text style={UserFormStyles.smallTitle}>How much to pay:</Text>
						<TextInput
							mode="outlined"
							value={amountToPay}
							onChangeText={handleAmountToPay}
							style={UserFormStyles.input}
						/>
						{error ?? (
							<Text
								style={{ alignSelf: "center", color: "red", marginBottom: 20 }}
							>
								{error}
							</Text>
						)}
						<Pressable style={homePageStyles.button} onPress={handlePress}>
							<Text style={homePageStyles.buttonText}>Pay Now</Text>
						</Pressable>
					</View>
				</form>
			</View>
		</ScrollView>
	);
};

export default Bill;
