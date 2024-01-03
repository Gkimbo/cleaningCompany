import { Dimensions, StyleSheet } from "react-native";
const { width } = Dimensions.get("window");
const colors = ["red", "orange", "grey", "green"];

const topBarStyles = StyleSheet.create({
	container: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 60,
		width: width,
		backgroundColor: "#3498db",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 10,
	},
	title: {
		color: "#fff",
		fontSize: 20,
		fontWeight: "bold",
	},
	button: {
		padding: 10,
		borderRadius: 5,
		backgroundColor: "#2ecc71",
		marginLeft: 10,
	},
	buttonText: {
		color: "#fff",
		fontSize: 16,
	},
});

export default topBarStyles;
