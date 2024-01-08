import { Dimensions, StyleSheet } from "react-native";

const { width } = Dimensions.get("window");

const calenderStyles = StyleSheet.create({
	container: {
		flex: 1,
		alignSelf: "center",
		padding: 16,
		width:
			width > 1000 ? "50%" : width > 700 ? "80%" : width > 500 ? "90%" : "100%",
	},
	datesContainer: {
		width: width,
		marginTop: width > 700 ? "0.5%" : "-10%",
		marginBottom: "3%",
		justifyContent: "center",
		alignItems: "center",
	},
	title: {
		fontSize: width > 400 ? 18 : 14,
		fontWeight: "bold",
		marginBottom: 10,
	},
	selectedDatesContainer: {
		flexWrap: "wrap",
		marginTop: 20,
		padding: 10,
		backgroundColor: "lightgray",
		borderRadius: 5,
		marginLeft: width > 400 ? "3%" : "1%",
		marginRight: width > 400 ? "3%" : "1%",
	},
	selectedDatesText: {
		fontSize: width > 400 ? 16 : 12,
	},
});

export default calenderStyles;
