import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import homePageStyles from "../services/styles/HomePageStyles";

const HomePage = () => {
	return (
		<View style={homePageStyles.container}>
			<Text>Open up App.js to start working on your app!</Text>
			<StatusBar style="auto" />
		</View>
	);
};

export default HomePage;
