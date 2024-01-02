import { StyleSheet, Text, View } from "react-native";
import HomePage from "./components/HomePage";
import TopBar from "./components/navBar/TopBar";

export default function App() {
	return (
		<View>
			<TopBar />
			<HomePage />
		</View>
	);
}
