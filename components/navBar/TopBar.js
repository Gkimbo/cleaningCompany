import React from "react";
import { View, Text, Pressable } from "react-native";
import topBarStyles from "../../services/styles/TopBarStyles";

const TopBar = () => {
	return (
		<View style={topBarStyles.container}>
			<Text style={topBarStyles.title}>My App</Text>
			<Pressable
				style={topBarStyles.button}
				onPress={() => console.log("Button 1 pressed")}
			>
				<Text style={topBarStyles.buttonText}>Button 1</Text>
			</Pressable>
			<Pressable
				style={topBarStyles.button}
				onPress={() => console.log("Button 2 pressed")}
			>
				<Text style={topBarStyles.buttonText}>Button 2</Text>
			</Pressable>
		</View>
	);
};

export default TopBar;
