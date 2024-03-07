import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
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
	console.log(home);
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
		FetchData.getHome(homeId).then((response) => {
			setHome(response.home);
		});
	}, []);

	return (
		<View style={[homePageStyles.homeTileContainer]}>
			<Text style={homePageStyles.appointmentDate}>{formatDate(date)}</Text>
			<Text style={homePageStyles.appointmentPrice}>
				{home.address} - {home.city}
			</Text>
			<Text style={homePageStyles.appointmentPrice}>
				{home.state}, {home.zipcode}
			</Text>
		</View>
	);
};

export default EmployeeAssignmentTile;
