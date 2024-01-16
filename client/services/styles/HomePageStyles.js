import { Dimensions, StyleSheet } from "react-native";
const { width } = Dimensions.get("window");
const colors = ["red", "orange", "grey", "green"];

const homePageStyles = StyleSheet.create({
	container: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
		marginTop: 120,
	},
	title: {
		alignSelf: "center",
		fontSize: width < 400 ? 15 : width < 800 ? 18 : 22,
		fontWeight: "bold",
		marginBottom: "5%",
	},
	smallTitle: {
		alignSelf: "center",
		fontSize: width < 400 ? 13 : width < 800 ? 16 : 19,
		fontWeight: "bold",
		marginBottom: "3%",
	},
	information: {
		alignSelf: "center",
		fontSize: width < 400 ? 12 : width < 800 ? 15 : 18,
		marginBottom: "5%",
	},
	image: {
		width: width > 600 ? "35%" : "100%",
		height: width > 600 ? "80%" : "100%",
		borderRadius: 10,
		marginTop: 20,
	},
	imageGuarantee: {
		width: width > 600 ? "40%" : "100%",
		height: width > 600 ? "80%" : "100%",
		borderRadius: 10,
		marginTop: 20,
	},
	parallaxImage: {
		height: 600,
		width: width,
	},
	backgroundImage: {
		flex: 1,
		resizeMode: "contain",
		height: "100%",
		width: "100%",
	},
	homePageParagraphSurround: {
		flexDirection: width > 600 ? "row" : "column",
		justifyContent: "space-between",
		marginBottom: width > 600 ? "7%" : "7%",
	},
	reverseImage: {
		width: "100%",
		justifyContent: "space-between",
		flexDirection: width > 600 ? "row" : "column-reverse",
		marginTop:
			width > 600
				? 0
				: width > 540
					? "100%"
					: width > 440
						? "135%"
						: width > 340
							? "145%"
							: "160%",
	},
	homePageParagraphText: {
		flexDirection: "column",
		width: width > 600 ? "45%" : "100%",
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
		elevation: 5,
		borderRadius: 8,
		fontSize: width > 400 ? 18 : 7,
		width:
			width > 1000 ? "48%" : width > 700 ? "78%" : width > 500 ? "88%" : "95%",
		shadowColor: "#000", // You can set the shadow color
		shadowOffset: {
			width: 3,
			height: 3,
		},
		shadowOpacity: 0.2,
		shadowRadius: 3, // You can adjust the shadow radius as needed
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
		marginTop: "1%",
	},
	AddHomeButton: {
		alignSelf: "center",
		backgroundColor: "#f9bc60",
		padding: "1%",
		borderRadius: 10,
		width: width < 850 ? "40%" : "17%",
		alignItems: "center",
	},
	AddHomeButtonText: {
		fontSize: width < 400 ? 8 : width < 800 ? 12 : 14,
	},
	detailsContainer: {
		marginTop: 120,
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
		width: width < 450 ? "20%" : "15%",
		height: "5%",
		paddingLeft: "3%",
	},

	backButtonForm: {
		backgroundColor: "#f9bc60",
		padding: 10,
		borderRadius: 10,
		height: "50%",
		justifyContent: "center",
		alignItems: "center",
	},
	backButtonContainerForm: {
		width: width > 500 ? "15%" : "25%",
		height: width > 600 ? "5%" : "7%",
		marginLeft: "10%",
	},
	backButtonContainerList: {
		width: width > 800 ? "10%" : width > 600 ? "15%" : "25%",
		height: "7%",
		marginLeft: "10%",
	},
	backButtonAppointmentList: {
		width: width > 800 ? "10%" : width > 600 ? "15%" : "25%",
		height: 20,
		marginLeft: "10%",
	},
	bookButton: {
		alignSelf: "center",
		borderRadius: 10,
		backgroundColor: "#3da9fc",
		padding: "2%",
		marginTop: "7%",
		marginBottom: "3%",
	},
	appointmentListContainer: {
		marginTop: 12,
	},
	eachAppointment: {
		marginRight: 16,
		marginTop: 10,
		padding: 12,
		backgroundColor: "white",
		borderRadius: 8,
		alignItems: "center",
	},
	appointmentDate: {
		fontSize: 14,
		fontWeight: "bold",
		marginBottom: 4,
	},
	appointmentPrice: {
		fontSize: 14,
		color: "#555",
	},
});

export default homePageStyles;
