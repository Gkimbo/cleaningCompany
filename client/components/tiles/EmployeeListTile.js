import React from "react";
import { Pressable, Text, View, Animated } from "react-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import Icon from "react-native-vector-icons/FontAwesome";

const EmployeeListTile = ({
	id,
	username,
	email,
	lastLogin,
	type,
	deleteConfirmation,
	handleDeletePress,
	handleNoPress,
	handleEdit,
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
								{deleteConfirmation[id] ? "Delete Employee" : "X"}
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
								Keep Employee
							</Text>
						</View>
					</Pressable>
				)}
				{!deleteConfirmation[id] ? (
					<Pressable
						onPress={() => handleEdit(id)}
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

			<Text style={homePageStyles.homeTileTitle}>{username}</Text>
			<Text style={homePageStyles.homeTileAddress}>{`Email: ${email}`}</Text>
			<Text
				style={homePageStyles.homeTileContent}
			>{`Last Login: ${lastLogin}`}</Text>
			<Text style={homePageStyles.homeTileContent}>{type}</Text>
		</View>
	);
};

export default EmployeeListTile;
