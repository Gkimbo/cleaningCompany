import { Dimensions, StyleSheet } from "react-native";
const { width } = Dimensions.get("window");
const colors = ["red", "orange", "grey", "green"];

const homePageStyles = StyleSheet.create({
	container: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
		// alignItems: "center",
		marginTop: 90,
	},

	buttonText: {
		color: "white",
		fontSize: 18,
		textAlign: "center",
	},

	topBarContainer: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginRight: 1,
		marginLeft: 1,
		marginBottom: "10%",
	},

	logoutButton: {
		backgroundColor: "red",
		padding: 10,
		borderRadius: 5,
	},

	logoutButtonText: {
		color: "white",
		fontSize: 16,
	},
});

export default homePageStyles;
