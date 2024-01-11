import { Dimensions, StyleSheet } from "react-native";
const { width } = Dimensions.get("window");
const colors = ["red", "orange", "grey", "green"];

const topBarStyles = StyleSheet.create({
	container: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: "10%",
		width: "100%",
	},
	containerTitleSection: {
		backgroundColor: "grey",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 10,
		paddingLeft: "10%",
	},
	containerButtonSection: {
		width: "100%",
		backgroundColor: "#3498db",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingTop: 10,
		paddingBottom: 10,
		paddingLeft: "10%",
		paddingRight: "10%",
	},
	title: {
		color: "#fff",
		fontWeight: "bold",
		fontSize: width < 400 ? 10 : width < 800 ? 15 : 20,
	},
	button: {
		padding: 10,
		borderRadius: 5,
		backgroundColor: "#2ecc71",
		marginLeft: 10,
	},
	buttonText: {
		color: "#fff",
		fontSize: width < 400 ? 10 : width < 800 ? 13 : 16,
	},
	buttonTextSchedule: {
		fontSize: width < 400 ? 10 : width < 800 ? 12 : 14,
	},
	signOutButton: {
		backgroundColor: "#f9bc60",
		padding: 10,
		borderRadius: 50,
	},
});

export default topBarStyles;
