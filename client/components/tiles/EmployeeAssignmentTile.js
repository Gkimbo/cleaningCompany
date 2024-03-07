import React, { useEffect, useState } from "react";
import { Pressable, Text, View, LayoutAnimation } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import FetchData from "../../services/fetchRequests/fetchData";

const EmployeeAssignmentTile = ({
	id,
	date,
	homeId,
	bringSheets,
	bringTowels,
	completed,
	keyPadCode,
	keyLocation,
}) => {
	const navigate = useNavigate();
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
		FetchData.getHome(homeId).then((response) => {
			setHome(response.home);
		});
	}, []);

	return (
		<View style={[homePageStyles.homeTileContainer]}>
			<Pressable onPress={expandWindow ? contractDetails : expandDetails}>
				<Text style={homePageStyles.appointmentDate}>{formatDate(date)}</Text>
				<Text style={homePageStyles.appointmentPrice}>
					{home.address} - {home.city}
				</Text>
				<Text style={homePageStyles.appointmentPrice}>
					{home.state}, {home.zipcode}
				</Text>
				{expandWindow && (
					<>
						<Text style={{ ...homePageStyles.appointmentPrice, marginTop: 5 }}>
							Number of Beds: {home.numBeds}
						</Text>
						<Text style={homePageStyles.appointmentPrice}>
							Number of Bathrooms: {home.numBaths}
						</Text>
						<Text style={{ ...homePageStyles.appointmentPrice, marginTop: 5 }}>
							Sheets are needed: {bringSheets}
						</Text>
						<Text style={{ ...homePageStyles.appointmentPrice, marginTop: 5 }}>
							Towels are needed: {bringTowels}
						</Text>
					</>
				)}
			</Pressable>
		</View>
	);
};

export default EmployeeAssignmentTile;
