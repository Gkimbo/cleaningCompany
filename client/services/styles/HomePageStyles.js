import { Dimensions, StyleSheet } from "react-native";
const { width } = Dimensions.get("window");
const colors = ["red", "orange", "grey", "green"];
console.log(width);

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
	homeTileContainer: {
		alignSelf: "center",
		margin: 16,
		padding: 16,
		backgroundColor: "#f0f0f0",
		borderRadius: 8,
		fontSize: width > 400 ? 18 : 7,
		width:
			width > 1000 ? "48%" : width > 700 ? "78%" : width > 500 ? "88%" : "95%",
	},
	homeTileTitle: {
		alignSelf: "center",
		fontSize: width < 400 ? 15 : width < 800 ? 18 : 22,
		fontWeight: "bold",
	},
	homeTileAddress: {
		alignSelf: "center",
		fontSize: width < 400 ? 13 : width < 800 ? 16 : 20,
		marginBottom: "3%",
	},
	homeTileContent: {
		fontSize: width < 400 ? 10 : width < 800 ? 14 : 18,
	},
	AddHomeButton: {
		alignSelf: "center",
		backgroundColor: "#f9bc60",
		padding: 10,
		borderRadius: 10,
		height: "7.5%",
		width: width < 800 ? "30%" : "17%",
		alignItems: "center",
	},
	AddHomeButtonText: {
		fontSize: width < 400 ? 8 : width < 800 ? 12 : 14,
	},
	detailsContainer: {
		marginTop: width < 400 ? "20%" : width < 800 ? "15%" : "8%",
	},
	homeDetailsContainer: {
		alignSelf: "center",
		width:
			width > 1000 ? "48%" : width > 700 ? "78%" : width > 500 ? "88%" : "95%",
		margin: 16,
		padding: 16,
		backgroundColor: "#f0f0f0",
		borderRadius: 8,
		fontSize: width > 400 ? 18 : 7,
	},

	backButton: {
		backgroundColor: "#f9bc60",
		padding: 10,
		borderRadius: 10,
		height: "80%",
		justifyContent: "center",
		alignItems: "center",
	},
	backButtonContainer: {
		width: width < 400 ? "20%" : "15%",
		height: "5%",
		paddingLeft: "3%",
	},
});

export default homePageStyles;
