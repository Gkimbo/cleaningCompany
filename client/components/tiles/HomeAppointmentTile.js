import React, { useState, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import UserFormStyles from "../../services/styles/UserInputFormStyle";
import { TextInput, RadioButton } from "react-native-paper";
import Appointment from "../../services/fetchRequests/AppointmentClass";

const HomeAppointmentTile = ({
	id,
	address,
	city,
	zipcode,
	allAppointments,
}) => {
	const [appointments, setAppointments] = useState([]);
	useEffect(() => {
		setAppointments(allAppointments);
	}, [allAppointments]);

	const handleSheetsToggle = async (value, appointmentId) => {
		try {
			const updatedAppointments = appointments.map((appointment) => {
				if (appointment.id === appointmentId) {
					const priceChange = value === "yes" ? 25 : -25;

					if (value === appointment.bringSheets) {
						return appointment;
					} else {
						return {
							...appointment,
							bringSheets: value,
							price: Number(appointment.price) + priceChange,
						};
					}
				}
				return appointment;
			});

			await Appointment.updateSheetsAppointments(value, appointmentId);
			setAppointments(updatedAppointments);
		} catch (error) {
			console.error("Error updating sheetsProvided:", error);
		}
	};

	const handleTowelToggle = async (value, appointmentId) => {
		try {
			const updatedAppointments = appointments.map((appointment) => {
				if (appointment.id === appointmentId) {
					const priceChange = value === "yes" ? 25 : -25;
					if (value === appointment.bringTowels) {
						return appointment;
					} else {
						return {
							...appointment,
							bringTowels: value,
							price: Number(appointment.price) + priceChange,
						};
					}
				}
				return appointment;
			});

			await Appointment.updateTowelsAppointments(value, appointmentId);
			setAppointments(updatedAppointments);
		} catch (error) {
			console.error("Error updating towelsProvided:", error);
		}
	};

	const navigate = useNavigate();

	const formatDate = (dateString) => {
		const options = { month: "short", day: "numeric", year: "numeric" };
		return new Date(dateString).toLocaleDateString(undefined, options);
	};

	const isWithinOneWeek = (dateString) => {
		const oneWeekInMilliseconds = 7 * 24 * 60 * 60 * 1000;
		const appointmentDate = new Date(dateString).getTime();
		const currentDate = new Date().getTime();

		return appointmentDate - currentDate < oneWeekInMilliseconds;
	};

	const filteredAppointments = appointments
		.filter((appointment) => appointment.homeId === id)
		.sort((a, b) => new Date(a.date) - new Date(b.date));

	const allAppointmentsFiltered = filteredAppointments.map(
		(appointment, index) => {
			const isDisabled = isWithinOneWeek(appointment.date);
			return (
				<View
					key={appointment.id}
					style={[
						homePageStyles.eachAppointment,
						index % 2 === 1 && homePageStyles.appointmentOdd,
					]}
				>
					<Text style={homePageStyles.appointmentDate}>
						{formatDate(appointment.date)}
					</Text>
					<Text style={homePageStyles.appointmentPrice}>
						$ {appointment.price}
					</Text>
					<Text style={UserFormStyles.smallTitle}>
						Cleaner is bringing sheets:
					</Text>
					{isDisabled ? (
						<View
							style={{
								...UserFormStyles.radioButtonContainer,
								width: "15%",
								padding: 5,
							}}
						>
							<Text>{appointment.bringSheets}</Text>
						</View>
					) : (
						<View style={UserFormStyles.radioButtonContainer}>
							<View>
								<RadioButton.Group
									onValueChange={() =>
										handleSheetsToggle("yes", appointment.id)
									}
									value={appointment.bringSheets}
								>
									<RadioButton.Item label="Yes" value="yes" />
								</RadioButton.Group>
							</View>
							<View>
								<RadioButton.Group
									onValueChange={() => handleSheetsToggle("no", appointment.id)}
									value={appointment.bringSheets}
								>
									<RadioButton.Item label="No" value="no" />
								</RadioButton.Group>
							</View>
						</View>
					)}
					<Text style={UserFormStyles.smallTitle}>
						Cleaner is bringing towels:
					</Text>
					{isDisabled ? (
						<>
							<View
								style={{
									...UserFormStyles.radioButtonContainer,
									width: "15%",
									padding: 5,
								}}
							>
								<Text>{appointment.bringTowels}</Text>
							</View>
							<Text style={{ ...homePageStyles.information }}>
								These values cannot be changed within a week of your
								appointment.
							</Text>
							<Text style={{ ...homePageStyles.information }}>
								Please contact us if you'd like to cancel or book sheets or
								towels
							</Text>
						</>
					) : (
						<View style={UserFormStyles.radioButtonContainer}>
							<View>
								<RadioButton.Group
									onValueChange={() => handleTowelToggle("yes", appointment.id)}
									value={appointment.bringTowels}
								>
									<RadioButton.Item label="Yes" value="yes" />
								</RadioButton.Group>
							</View>
							<View>
								<RadioButton.Group
									onValueChange={() => handleTowelToggle("no", appointment.id)}
									value={appointment.bringTowels}
								>
									<RadioButton.Item label="No" value="no" />
								</RadioButton.Group>
							</View>
						</View>
					)}
					{appointment.keyPadCode !== "" ? (
						<>
							<Text style={UserFormStyles.smallTitle}>
								The code to get in is
							</Text>

							<TextInput
								mode="outlined"
								value={appointment.keyPadCode}
								// onChangeText={handleKeyPadCode}
								style={UserFormStyles.codeInput}
							/>
						</>
					) : (
						<>
							<Text style={UserFormStyles.smallTitle}>
								The location of the key is
							</Text>
							<TextInput
								mode="outlined"
								value={appointment.keyLocation}
								// onChangeText={handleKeyLocation}
								style={UserFormStyles.input}
							/>
							<View style={{ textAlign: "center", marginBottom: 20 }}>
								<Text style={{ color: "grey", fontSize: 10 }}>
									Example: Under the fake rock to the right of the back door or
									to the right of the door in a lock box with code 5555#
								</Text>
							</View>
						</>
					)}
				</View>
			);
		}
	);

	const handleOnPress = () => {
		navigate(`/details/${id}`);
	};

	return (
		<View style={homePageStyles.homeTileContainer}>
			<Text style={homePageStyles.homeTileTitle}>{address}</Text>
			<Text style={homePageStyles.homeTileAddress}>
				{`${city}, ${zipcode}`}
			</Text>
			<View style={homePageStyles.appointmentListContainer}>
				<View style={homePageStyles.appointmentListRow}>
					{allAppointmentsFiltered}
				</View>
			</View>

			<Pressable onPress={handleOnPress}>
				<View style={homePageStyles.bookButton}>
					<Text style={homePageStyles.bookButtonText}>
						Book or cancel a cleaning for this home
					</Text>
				</View>
			</Pressable>
		</View>
	);
};

export default HomeAppointmentTile;
