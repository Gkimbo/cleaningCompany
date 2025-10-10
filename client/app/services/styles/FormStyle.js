import { Dimensions, StyleSheet } from "react-native";

const { height } = Dimensions.get("screen");

const widthScreen = height * 0.3;

const formStyles = StyleSheet.create({
	container: {
		marginLeft: "auto",
		marginRight: "auto",
		marginTop: 15,
	},
	formSurround: {
		paddingLeft: "40%",
		paddingRight: "40%",
	},
	header: {
		fontWeight: "bold",
		fontSize: 20,
	},
	button: {
		marginTop: 10,
		backgroundColor: "#f9bc60",
		borderRadius: 10,
		padding: 10,
		width: widthScreen,
	},
	text: {
		textAlign: "center",
	},
	input: {
		height: 40,
		width: widthScreen,
		borderColor: "#ccc",
		borderWidth: 1,
		borderRadius: 8,
		marginBottom: 12,
		paddingHorizontal: 12,
		fontSize: 16,
	},
	errorContainer: {
		backgroundColor: "#f8d7da",
		padding: 8,
		marginBottom: 16,
		borderRadius: 4,
	},
	errorText: {
		color: "#721c24",
		fontSize: 14,
	},
});

export default formStyles;
