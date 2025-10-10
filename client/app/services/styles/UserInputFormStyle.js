import { Dimensions, StyleSheet } from "react-native";

const { height } = Dimensions.get("screen");
const { width } = Dimensions.get("window");

const widthScreen = height * 0.3;

const UserFormStyles = StyleSheet.create({
	container: {
		marginTop: 140,
		marginLeft: 15,
		marginRight: 15,
	},
	formSurround: {
		paddingLeft: "20%",
		paddingRight: "20%",
	},
	inputSurround: {
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#000",
		borderRadius: 5,
		backgroundColor: "#fff",
		padding: 5,
		marginBottom: 20,
		marginLeft:
			width > 1000 ? "25%" : width > 700 ? "20%" : width > 500 ? "10%" : "0.5%",
		marginRight:
			width > 1000 ? "25%" : width > 700 ? "20%" : width > 500 ? "10%" : "0.5%",
	},
	title: {
		fontSize: width > 1000 ? 23 : width > 700 ? 22 : width > 500 ? 20 : 16,
		fontWeight: "bold",
		marginBottom: 16,
		textAlign: "center",
	},
	input: {
		marginBottom: 16,
		borderWidth: 0,
		backgroundColor: "#fff",
		marginLeft:
			width > 1000 ? "20%" : width > 700 ? "15%" : width > 500 ? "10%" : "0.5%",
		marginRight:
			width > 1000 ? "20%" : width > 700 ? "15%" : width > 500 ? "10%" : "0.5%",
	},

	codeInput: {
		alignSelf: "center",
		marginBottom: 16,
		borderWidth: 0,
		backgroundColor: "#fff",
		marginLeft: "19%",
		marginRight: "19%",
		width:
			width > 1000 ? "20%" : width > 700 ? "30%" : width > 500 ? "40%" : "80%",
	},
	modeInput: {
		marginBottom: 30,
	},
	checkbox: {
		marginBottom: 16,
	},
	commuteContainer: {
		marginTop: 16,
	},
	subtitle: {
		fontSize: 16,
		fontWeight: "bold",
		marginBottom: 8,
		textAlign: "center",
	},
	smallTitle: {
		marginBottom: 4,
		textAlign: "center",
		fontSize: width > 1000 ? 20 : width > 700 ? 20 : width > 500 ? 15 : 10,
	},

	milesContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 16,
	},
	unitInput: {
		flex: 1,
		marginLeft: 8,
	},

	button: {
		alignSelf: "center",
		textAlign: "center",
		marginTop: 10,
		backgroundColor: "#f9bc60",
		borderRadius: 10,
		padding: 10,
		backgroundColor: "#f9bc60",
		width:
			width > 1000 ? "20%" : width > 700 ? "20%" : width > 500 ? "40%" : "80%",
	},
	error: {
		color: "red",
		fontSize: width > 500 ? 15 : 10,
		fontWeight: "bold",
		marginTop: 10,
		marginBottom: 10,
		textAlign: "center",
	},

	changeNotification: {
		color: "#28A745",
		fontSize: width > 500 ? 15 : 10,
		fontWeight: "bold",
		marginTop: 10,
		marginBottom: 10,
		textAlign: "center",
	},
	radioButtonContainer: {
		alignSelf: "center",
		flexDirection: "row",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "#000",
		borderRadius: 5,
		marginBottom: 20,
		marginLeft: "19%",
		marginRight: "19%",
		backgroundColor: "#fff",
		width:
			width > 1000 ? "25%" : width > 700 ? "30%" : width > 500 ? "40%" : "80%",
	},
	pickerContainer: {
		marginBottom: 20,
	},
});

export default UserFormStyles;
