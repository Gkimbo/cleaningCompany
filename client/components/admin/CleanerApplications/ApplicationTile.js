import React from "react";
import { Pressable, Text, View, Animated } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import homePageStyles from "../../../services/styles/HomePageStyles";

const ApplicationTile = ({
	id,
	firstName,
    lastName,
    email,
    phone,
    availability,
    experience,
    message,
    deleteConfirmation,
	handleDeletePress,
	handleNoPress,
	handleAccept,
}) => {
	return (
		<View style={homePageStyles.homeTileContainer}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: deleteConfirmation[id]
						? "flex-start"
						: "space-between",
				}}
			>
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
				{!deleteConfirmation[id] ? (
					<Pressable
						onPress={() => handleAccept(id)}
						accessible={true}
						accessibilityLabel="Edit Button"
					>
						<View
							style={{
								backgroundColor: "#3da9fc",
								borderRadius: 20,
								width: 30,
								height: 30,
								justifyContent: "center",
								alignItems: "center",
							}}
						>
							<Icon name="edit" size={20} color="white" />
						</View>
					</Pressable>
				) : null}
			</View>

			<Text style={homePageStyles.homeTileTitle}>{`${firstName} ${lastName}`}</Text>
			<Text
				style={homePageStyles.homeTileAddress}
			>{`Email: ${email}`}</Text>
			<Text
				style={homePageStyles.homeTileContent}
			>{`Phone Number: ${phone}`}</Text>
			<Text
				style={homePageStyles.homeTileContent}
			>{`Availability: ${availability}`}</Text>
			<Text
				style={homePageStyles.homeTileContent}
			>{`Expirience: ${
				experience
			}`}</Text>
			{message ? (
				<Text
					style={homePageStyles.homeTileContent}
				>{`Message: ${message}`}</Text>
			) : null}
		</View>
	);
};

export default ApplicationTile;
