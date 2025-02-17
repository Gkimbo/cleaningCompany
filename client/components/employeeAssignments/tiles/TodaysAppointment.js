import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import homePageStyles from "../../../services/styles/HomePageStyles";
import FetchData from "../../../services/fetchRequests/fetchData";

const TodaysAppointment = ({ appointment }) => {
	const [home, setHome] = useState({
		address: "",
		city: "",
		compostLocation: "",
		contact: "",
		keyLocation: "",
		keyPadCode: "",
		numBaths: "",
		numBeds: "",
		recyclingLocation: "",
		sheetsProvided: "",
		specialNotes: "",
		state: "",
		towelsProvided: "",
		trashLocation: "",
		zipcode: "",
		cleanersNeeded: "",
	});

	const formatDate = (dateString) => {
		const options = {
			weekday: "long",
			month: "short",
			day: "numeric",
			year: "numeric",
		};
		return new Date(dateString).toLocaleDateString(undefined, options);
	};

	useEffect(() => {
		FetchData.getHome(appointment.homeId).then((response) => {
			setHome(response.home);
		});
	}, []);

	return (
		<View style={[homePageStyles.homeTileContainer]}>
			<Text style={{ ...homePageStyles.appointmentDate, alignSelf: "center" }}>
				{formatDate(appointment.date)}
			</Text>
			<Text style={{ ...homePageStyles.appointmentPrice, alignSelf: "center" }}>
				{home.address} - {home.city}
			</Text>
			<Text style={{ ...homePageStyles.appointmentPrice, alignSelf: "center" }}>
				{home.state}, {home.zipcode}
			</Text>
			{home.keyPadCode && (
				<Text
					style={{
						...homePageStyles.appointmentPrice,
						marginTop: 5,
						alignSelf: "center",
					}}
				>
					Code to get in: {home.keyPadCode}
				</Text>
			)}
			{home.keyLocation && (
				<Text
					style={{
						...homePageStyles.appointmentPrice,
						marginTop: 5,
						alignSelf: "center",
					}}
				>
					Key Location: {home.keyLocation}
				</Text>
			)}
			<Text
				style={{
					...homePageStyles.appointmentPrice,
					marginTop: 5,
					alignSelf: "center",
				}}
			>
				If there are any problems, contact the home owner at: {home.contact}
			</Text>
			<Text
				style={{
					...homePageStyles.appointmentPrice,
					marginTop: 5,
					alignSelf: "center",
				}}
			>
				Number of Beds: {home.numBeds}
			</Text>
			<Text style={{ ...homePageStyles.appointmentPrice, alignSelf: "center" }}>
				Number of Bathrooms: {home.numBaths}
			</Text>
			<Text
				style={{
					...homePageStyles.appointmentPrice,
					marginTop: 5,
					alignSelf: "center",
				}}
			>
				Sheets are needed: {appointment.bringSheets}
			</Text>
			<Text
				style={{
					...homePageStyles.appointmentPrice,
					marginTop: 5,
					alignSelf: "center",
				}}
			>
				Towels are needed: {appointment.bringTowels}
			</Text>
			<Text
					style={{ ...homePageStyles.appointmentPrice, alignSelf: "center" }}
				>
					{`Payout once finished: $${appointment.price}`}
				</Text>
			{home.specialNotes && (
				<Text
					style={{
						...homePageStyles.appointmentPrice,
						marginTop: 5,
						alignSelf: "center",
					}}
				>
					Notes from the Home Owner: {home.specialNotes}
				</Text>
			)}
		</View>
	);
};

export default TodaysAppointment;
