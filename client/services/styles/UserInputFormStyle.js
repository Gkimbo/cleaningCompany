import { Dimensions, StyleSheet } from "react-native";

const { height } = Dimensions.get("screen");

const widthScreen = height * 0.3;

const UserFormStyles = StyleSheet.create({
	container: {
		marginTop: 85,
		marginLeft: 15,
		marginRight: 15,
	},
	title: {
		fontSize: 18,
		fontWeight: "bold",
		marginBottom: 16,
		textAlign: "center",
	},
	input: {
		marginBottom: 16,
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
		fontSize: 10,
		fontWeight: "bold",
		marginBottom: 4,
		textAlign: "center",
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
		marginTop: 10,
		backgroundColor: "#f9bc60",
		borderRadius: 10,
		padding: 10,
	},
	error: {
		color: "red",
		fontSize: 15,
		fontWeight: "bold",
		marginTop: 5,
		marginBottom: 4,
		textAlign: "center",
	},
	radioButtonContainer: {
		flexDirection: "row",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "#000",
		borderRadius: 5,
		marginBottom: 20,
	},
	pickerContainer: {
		marginBottom: 20,
	},
});

export default UserFormStyles;
