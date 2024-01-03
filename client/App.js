import { StyleSheet, Text, View } from "react-native";
import HomePage from "./components/HomePage";
import TopBar from "./components/navBar/TopBar";
import CalendarComponent from "./components/calender/CalendarComponent";

export default function App() {
	const onDatesSelected = (event) => {
		event.preventDefault();
		console.log(event);
	};
	return (
		<View>
			<TopBar />
			<HomePage />
			<CalendarComponent onDatesSelected={onDatesSelected} />
		</View>
	);
}
