import React, { useState, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import EachAppointment from "./EachAppointment";

const HomeAppointmentTile = ({
	id,
	nickName,
	address,
	city,
	state,
	zipcode,
	contact,
	allAppointments,
	setChangesSubmitted,
}) => {
	const [appointments, setAppointments] = useState([]);
	const [changeNotification, setChangeNotification] = useState({
		message: "",
		appointment: "",
	});

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
				setChangeNotification({
					message:
						"Sheets for this appointment have been updated. Price has been updated.",
					appointment: appointmentId,
				});
			} else
				setChangeNotification({
					message: "",
					appointment: "",
				});
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
				setChangeNotification({
					message:
						"Towels for this appointment have been updated. Price has been updated.",
					appointment: appointmentId,
				});
			} else {
				setChangeNotification({
					message: "",
					appointment: "",
				});
			}
			setAppointments(updatedAppointments);
		} catch (error) {
			console.error("Error updating towelsProvided:", error);
		}
	};

	const navigate = useNavigate();

	const formatDate = (dateString) => {
		const options = { month: "short", day: "numeric", year: "numeric" };
		const [year, month, day] = dateString.split("-");
		const newDate = new Date(year, month, day);
		const formattedDate = newDate.toLocaleDateString(undefined, options);
		return formattedDate;
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
					setChangesSubmitted={setChangesSubmitted}
					changeNotification={changeNotification}
					setChangeNotification={setChangeNotification}
					contact={contact}
				/>
			);
		}
	);

	const handleOnPress = () => {
		navigate(`/details/${id}`);
	};

	return (
		<View style={homePageStyles.homeTileContainer}>
			<Text style={homePageStyles.homeTileTitle}>{nickName}</Text>
			<Text style={{ ...homePageStyles.homeTileAddress, margin: 0 }}>
				{address}
			</Text>
			<Text style={{ ...homePageStyles.homeTileAddress, marginBottom: 2 }}>
				{`${city}, ${state} ${zipcode}`}
			</Text>
			<Pressable onPress={handleOnPress}>
				<View style={homePageStyles.bookButton}>
					<Text style={homePageStyles.bookButtonText}>
						{`Book or cancel a cleaning for the ${nickName}`}
					</Text>
				</View>
			</Pressable>
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
