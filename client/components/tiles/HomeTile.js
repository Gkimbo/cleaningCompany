import React from "react";
import { Pressable, Text, View, Animated } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";

const HomeTile = ({
	id,
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
	const navigate = useNavigate();

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
				<Text
					style={homePageStyles.homeTileContent}
				>{`Beds: ${numBeds}, Baths: ${numBaths}`}</Text>
				<Text style={homePageStyles.homeTileContent}>{`Sheets provided: ${
					sheetsProvided ? "Yes" : "No"
				}`}</Text>
				<Text style={homePageStyles.homeTileContent}>{`Towels provided: ${
					towelsProvided ? "Yes" : "No"
				}`}</Text>
				{keyPadCode ? (
					<Text
						style={homePageStyles.homeTileContent}
					>{`Keypad Code: ${keyPadCode}`}</Text>
				) : null}
				{keyLocation ? (
					<Text
						style={homePageStyles.homeTileContent}
					>{`Key Location: ${keyLocation}`}</Text>
				) : null}
				{recyclingLocation ? (
					<Text
						style={homePageStyles.homeTileContent}
					>{`Recycling Location: ${recyclingLocation}`}</Text>
				) : null}
				{compostLocation ? (
					<Text
						style={homePageStyles.homeTileContent}
					>{`Compost Location: ${compostLocation}`}</Text>
				) : null}
				<Text
					style={homePageStyles.homeTileContent}
				>{`Trash Location: ${trashLocation}`}</Text>
			</View>
		</Pressable>
	);
};

export default HomeTile;
