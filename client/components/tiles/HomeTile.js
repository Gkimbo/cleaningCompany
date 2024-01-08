import React from "react";
import { Text, View } from "react-native";
import homePageStyles from "../../services/styles/HomePageStyles";

const HomeTile = ({
	address,
	city,
	zipcode,
	numBeds,
	numBaths,
	sheetsProvided,
	towelsProvided,
	keyPadCode,
	keyLocation,
	recyclingLocation,
	compostLocation,
	trashLocation,
}) => {
	return (
		<View style={homePageStyles.homeTileContainer}>
			<Text style={homePageStyles.homeTileTitle}>{address}</Text>
			<Text>{`${city}, ${zipcode}`}</Text>
			<Text>{`Beds: ${numBeds}, Baths: ${numBaths}`}</Text>
			<Text>{`Sheets provided: ${sheetsProvided ? "Yes" : "No"}`}</Text>
			<Text>{`Towels provided: ${towelsProvided ? "Yes" : "No"}`}</Text>
			<Text>{`Keypad Code: ${keyPadCode}`}</Text>
			<Text>{`Key Location: ${keyLocation}`}</Text>
			<Text>{`Recycling Location: ${recyclingLocation}`}</Text>
			<Text>{`Compost Location: ${compostLocation}`}</Text>
			<Text>{`Trash Location: ${trashLocation}`}</Text>
		</View>
	);
};

export default HomeTile;
