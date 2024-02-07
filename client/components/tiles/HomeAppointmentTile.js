import React, { useState, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import UserFormStyles from "../../services/styles/UserInputFormStyle";
import { TextInput, RadioButton } from "react-native-paper";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import EachAppointment from "./EachAppointment";

const HomeAppointmentTile = ({
	id,
	address,
	city,
	zipcode,
	keyLocation,
	keyPadCode,
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

			const appointmentToUpdate = appointments.find(
				(appointment) => appointment.id === appointmentId
			);

			if (value !== appointmentToUpdate.bringSheets) {
				await Appointment.updateSheetsAppointments(value, appointmentId);
			}
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

			const appointmentToUpdate = appointments.find(
				(appointment) => appointment.id === appointmentId
			);
			if (value !== appointmentToUpdate.bringTowels) {
				await Appointment.updateTowelsAppointments(value, appointmentId);
			}
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
				<EachAppointment
					key={appointment.id ? appointment.id : appointment.date}
					id={appointment.id}
					index={index}
					date={appointment.date}
					price={appointment.price}
					bringSheets={appointment.bringSheets}
					bringTowels={appointment.bringTowels}
					keyPadCode={appointment.keyPadCode}
					keyLocation={appointment.keyLocation}
					isDisabled={isDisabled}
					isWithinOneWeek={isWithinOneWeek}
					formatDate={formatDate}
					handleTowelToggle={handleTowelToggle}
					handleSheetsToggle={handleSheetsToggle}
				/>
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
