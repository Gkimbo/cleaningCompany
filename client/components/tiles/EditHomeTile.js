import React from "react";
import { Pressable, Text, View, Animated } from "react-native";
import homePageStyles from "../../services/styles/HomePageStyles";

const EditHomeTile = ({
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
	deleteConfirmation,
	handleDeletePress,
	handleNoPress,
}) => {
	return (
		<View style={homePageStyles.homeTileContainer}>
			<View style={{ flexDirection: "row", alignItems: "center" }}>
				<Pressable
					onPress={() => handleDeletePress(id)}
					accessible={true}
					accessibilityLabel="Delete Button"
				>
					{({ pressed }) => (
						<Animated.View
							style={{
								borderRadius: 20,
								marginRight: 10,
								width: deleteConfirmation[id] ? 75 : pressed ? 40 : 30,
								height: deleteConfirmation[id] ? 25 : pressed ? 40 : 30,
								backgroundColor: deleteConfirmation[id]
									? "red"
									: pressed
										? "red"
										: "#d65d5d",
								justifyContent: "center",
								alignItems: "center",
							}}
						>
							<Text
								style={{
									color: "white",
									fontWeight: "bold",
									fontSize: deleteConfirmation[id] ? 10 : 14,
								}}
							>
								{deleteConfirmation[id] ? "Delete Home" : "X"}
							</Text>
						</Animated.View>
					)}
				</Pressable>

				{deleteConfirmation[id] && (
					<Pressable
						onPress={() => handleNoPress(id)}
						accessible={true}
						accessibilityLabel="Keep Button"
					>
						<View
							style={{
								backgroundColor: "green",
								borderRadius: 20,
								width: 65,
								height: 25,
								justifyContent: "center",
								alignItems: "center",
							}}
						>
							<Text
								style={{
									color: "white",
									fontWeight: "bold",
									fontSize: 10,
								}}
							>
								Keep Home
							</Text>
						</View>
					</Pressable>
				)}
			</View>

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
	);
};

export default EditHomeTile;
