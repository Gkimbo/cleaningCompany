import React, { useEffect } from "react";
import { Text, View } from "react-native";
import homePageStyles from "../services/styles/HomePageStyles";
import FetchData from "../services/fetchRequests/fetchData";

const HomePage = ({ state, dispatch }) => {
	useEffect(() => {
		if (state.currentUser.token) {
			FetchData.get("/api/v1/user-info", state.currentUser.token).then(
				(response) => {
					dispatch({
						type: "USER_HOME",
						payload: response.user.homes,
					});
				}
			);
		}
	}, []);
	return (
		<View style={homePageStyles.container}>
			<Text>Open up App.js to start working on your app!</Text>
		</View>
	);
};

export default HomePage;
