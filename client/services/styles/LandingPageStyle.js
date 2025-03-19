import { Dimensions, StyleSheet } from "react-native";
// import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { height, width } = Dimensions.get("screen");
const heightLogo = height * 0.28;
const widthScreen = height * 0.45;

const LandingPageStyles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#009387",
	},
	header: {
		flex: 2,
		justifyContent: "center",
		alignItems: "center",
		marginTop: width > 600
			? "10%"
			: width > 540
				? "15%"
				: width > 440
					? "20%"
					: width > 340
						? "25%"
						: "30%",
	},
	footer: {
		flex: 1,
		backgroundColor: "#fff",
		borderTopLeftRadius: 30,
		borderTopRightRadius: 30,
		paddingVertical: 50,
		paddingHorizontal: 30,
		width: widthScreen,
	},
	logo: {
		width: heightLogo,
		height: heightLogo,
		borderRadius: 80,
		marginTop: 25,
		marginBottom: 25,
		marginLeft: "auto",
		marginRight: "auto",
	},
	logoReg: {
		width: heightLogo * 0.3,
		height: heightLogo * 0.3,
		borderRadius: 20,
		marginTop: 25,
		marginBottom: 25,
		marginLeft: "auto",
		marginRight: "auto",
	},
	title: {
		color: "#05375a",
		fontSize: 30,
		fontWeight: "bold",
		marginBottom: 5,
		alignSelf: "center",
	},
	text: {
		color: "grey",
		marginTop: 5,
		alignSelf: "center",
	},
	button: {
		alignItems: "flex-end",
		marginTop: 30,
	},

	paragraph: {
		marginTop: 40,
		marginBottom: 40,
		textAlign: "justify",
		color: "black",
		alignSelf: "center",
	},

	buttonContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},

	signIn: {
		width: 150,
		height: 40,
		justifyContent: "center",
		alignItems: "center",
		borderRadius: 50,
		flexDirection: "row",
	},
	textSign: {
		color: "black",
		fontWeight: "bold",
	},
});

export default LandingPageStyles;
