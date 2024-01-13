import React from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";

const HomeAppointmentTile = ({
	id,
	address,
	city,
	zipcode,
	allAppointments,
}) => {
	const navigate = useNavigate();

	const filteredAppointments = allAppointments
		.filter((appointment) => appointment.homeId === id)
		.sort((a, b) => new Date(a.date) - new Date(b.date));

	const formatDate = (dateString) => {
		const options = { month: "short", day: "numeric", year: "numeric" };
		return new Date(dateString).toLocaleDateString(undefined, options);
	};

	const appointments = filteredAppointments.map((appointment, index) => (
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
			<Text style={homePageStyles.appointmentPrice}>$ {appointment.price}</Text>
		</View>
	));

	const handleOnPress = () => {
		navigate(`/details/${id}`);
	};

	return (
		<Pressable onPress={handleOnPress}>
			<View style={homePageStyles.homeTileContainer}>
				<Text style={homePageStyles.homeTileTitle}>{address}</Text>
				<Text
					style={homePageStyles.homeTileAddress}
				>{`${city}, ${zipcode}`}</Text>

				<View style={homePageStyles.appointmentListContainer}>
					<View style={homePageStyles.appointmentListRow}>{appointments}</View>
				</View>

				<View style={homePageStyles.bookButton}>
					<Text style={homePageStyles.bookButtonText}>
						Book a cleaning for this home
					</Text>
				</View>
			</View>
		</Pressable>
	);
};

export default HomeAppointmentTile;
