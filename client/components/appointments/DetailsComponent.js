import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-native";
import { View, Text, Pressable, Dimensions } from "react-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import topBarStyles from "../../services/styles/TopBarStyles";
import CalendarComponent from "../calender/CalendarComponent";
import Icon from "react-native-vector-icons/FontAwesome";

const DetailsComponent = ({ state }) => {
	const { id } = useParams();
	const [homeDetails, setHomeDetails] = useState(null);
	const [redirect, setRedirect] = useState(false);
	const { width } = Dimensions.get("window");
	const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
	const navigate = useNavigate();

	const handlePress = () => {
		setRedirect(true);
	};

	useEffect(() => {
		const idNeeded = Number(id);
		const foundHome = state.homes.find((home) => home.id === idNeeded);
		setHomeDetails(foundHome);
		if (redirect) {
			navigate("/list-of-homes");
			setRedirect(false);
		}
	}, [id, redirect]);

	if (!homeDetails) {
		return (
			<View style={homePageStyles.container}>
				<Text>Loading...</Text>
			</View>
		);
	}

	return (
		<View style={homePageStyles.detailsContainer}>
			<View style={homePageStyles.backButtonContainer}>
				<Pressable style={homePageStyles.backButton} onPress={handlePress}>
					<View
						style={{ flexDirection: "row", alignItems: "center", padding: 10 }}
					>
						<Icon name="angle-left" size={iconSize} color="black" />
						<View style={{ marginLeft: 15 }}>
							<Text style={topBarStyles.buttonTextSchedule}>Back</Text>
						</View>
					</View>
				</Pressable>
			</View>
			<View style={homePageStyles.homeDetailsContainer}>
				<Text style={homePageStyles.homeTileTitle}>{homeDetails.address}</Text>
				<Text
					style={homePageStyles.homeTileAddress}
				>{`${homeDetails.city}, ${homeDetails.zipcode}`}</Text>
				<Text
					style={homePageStyles.homeTileContent}
				>{`Beds: ${homeDetails.numBeds}, Baths: ${homeDetails.numBaths}`}</Text>
				<Text style={homePageStyles.homeTileContent}>{`Sheets provided: ${
					homeDetails.sheetsProvided ? "Yes" : "No"
				}`}</Text>
				<Text style={homePageStyles.homeTileContent}>{`Towels provided: ${
					homeDetails.towelsProvided ? "Yes" : "No"
				}`}</Text>
				{homeDetails.keyPadCode ? (
					<Text
						style={homePageStyles.homeTileContent}
					>{`Keypad Code: ${homeDetails.keyPadCode}`}</Text>
				) : null}
				{homeDetails.keyLocation ? (
					<Text
						style={homePageStyles.homeTileContent}
					>{`Key Location: ${homeDetails.keyLocation}`}</Text>
				) : null}
				{homeDetails.recyclingLocation ? (
					<Text
						style={homePageStyles.homeTileContent}
					>{`Recycling Location: ${homeDetails.recyclingLocation}`}</Text>
				) : null}
				{homeDetails.compostLocation ? (
					<Text
						style={homePageStyles.homeTileContent}
					>{`Compost Location: ${homeDetails.compostLocation}`}</Text>
				) : null}
				<Text
					style={homePageStyles.homeTileContent}
				>{`Trash Location: ${homeDetails.trashLocation}`}</Text>
			</View>
			<CalendarComponent />
		</View>
	);
};

export default DetailsComponent;
