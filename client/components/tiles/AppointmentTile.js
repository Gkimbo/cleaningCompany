import React from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";

const AppointmentTile = ({ id, date, price, homeId }) => {
	const navigate = useNavigate();

	const formatDate = (dateString) => {
		const options = { month: "short", day: "numeric", year: "numeric" };
		return new Date(dateString).toLocaleDateString(undefined, options);
	};

	const handleOnPress = () => {
		navigate(`/details/${id}`);
	};

	return (
		<View style={[homePageStyles.eachAppointment]}>
			<Text style={homePageStyles.appointmentDate}>{formatDate(date)}</Text>
			<Text style={homePageStyles.appointmentPrice}>$ {price}</Text>
		</View>
	);
};

export default AppointmentTile;
