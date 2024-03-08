import React, { useEffect, useState } from "react";
import { Pressable, Text, View, LayoutAnimation } from "react-native";
import homePageStyles from "../../../services/styles/HomePageStyles";
import FetchData from "../../../services/fetchRequests/fetchData";

const NextAppointment = ({ appointment }) => {
	const [expandWindow, setExpandWindow] = useState(false);
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

	const expandDetails = () => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setExpandWindow(true);
	};
	const contractDetails = () => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setExpandWindow(false);
	};

	useEffect(() => {
		FetchData.getHome(appointment.homeId).then((response) => {
			setHome(response.home);
		});
	}, []);

	return (
		<View style={[homePageStyles.homeTileContainer]}>
			<Pressable onPress={expandWindow ? contractDetails : expandDetails}>
				<Text
					style={{ ...homePageStyles.appointmentDate, alignSelf: "center" }}
				>
					{formatDate(appointment.date)}
				</Text>
				<Text
					style={{ ...homePageStyles.appointmentPrice, alignSelf: "center" }}
				>
					{home.address} - {home.city}
				</Text>
				<Text
					style={{ ...homePageStyles.appointmentPrice, alignSelf: "center" }}
				>
					{home.state}, {home.zipcode}
				</Text>
				{expandWindow && (
					<>
						<Text
							style={{
								...homePageStyles.appointmentPrice,
								marginTop: 5,
								alignSelf: "center",
							}}
						>
							Number of Beds: {home.numBeds}
						</Text>
						<Text
							style={{
								...homePageStyles.appointmentPrice,
								alignSelf: "center",
							}}
						>
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
						{home.cleanersNeeded > 1 && (
							<Text
								style={{
									...homePageStyles.appointmentPrice,
									marginTop: 5,
									alignSelf: "center",
								}}
							>
								You will be working with {home.cleanersNeeded - 1} other person
								to clean this home.
							</Text>
						)}
					</>
				)}
			</Pressable>
		</View>
	);
};

export default NextAppointment;
