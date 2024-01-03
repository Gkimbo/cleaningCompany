import { Dimensions, StyleSheet } from "react-native";
const { width } = Dimensions.get("window");
const colors = ["red", "orange", "grey", "green"];

const calenderStyles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 16,
		width: width,
	},
	datesContainer: {
		width: width,
		marginTop: "30%",
		marginBottom: "3%",
		justifyContent: "center",
		alignItems: "center",
	},
	title: {
		fontSize: 18,
		fontWeight: "bold",
		marginBottom: 10,
	},
	selectedDatesContainer: {
		flexWrap: "wrap",
		marginTop: 20,
		padding: 10,
		backgroundColor: "lightgray",
		borderRadius: 5,
		marginLeft: "3%",
		marginRight: "3%",
	},
	selectedDatesText: {
		fontSize: 16,
	},
});

export default calenderStyles;
