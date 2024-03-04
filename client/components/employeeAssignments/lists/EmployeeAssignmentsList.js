import React, { useState, useEffect } from "react";
import { Pressable, View, Text, ScrollView, Dimensions } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../../services/styles/HomePageStyles";
// import HomeAppointmentTile from "../tiles/HomeAppointmentTile";
import Icon from "react-native-vector-icons/FontAwesome";
import topBarStyles from "../../../services/styles/TopBarStyles";
import FetchData from "../../../services/fetchRequests/fetchData";

const EmployeeAssignmentsList = ({ state, dispatch }) => {
	const [allHomes, setAllHomes] = useState([]);
	const [allAppointments, setAllAppointments] = useState([]);
	const [changesSubmitted, setChangesSubmitted] = useState(false);
	const [redirect, setRedirect] = useState(false);
	const [backRedirect, setBackRedirect] = useState(false);
	const { width } = Dimensions.get("window");
	const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
	const navigate = useNavigate();

	useEffect(() => {
		if (state.currentUser.token) {
			FetchData.get("/api/v1/employee-info", state.currentUser.token).then(
				(response) => {
					console.log(response);
					dispatch({
						type: "USER_APPOINTMENTS",
						payload: response.user.assignedAppointments,
					});
					setAllAppointments(response.user.assignedAppointments);
				}
			);
		}
		setChangesSubmitted(false);
		if (redirect) {
			navigate("/add-home");
			setRedirect(false);
		}
		if (backRedirect) {
			navigate("/");
			setBackRedirect(false);
		}
	}, [redirect, backRedirect, changesSubmitted]);

	const handlePress = () => {
		setRedirect(true);
	};

	const handleBackPress = () => {
		setBackRedirect(true);
	};

	// const usersHomes = state.homes.map((home) => {
	// 	return (
	// <View key={home.id}>
	// 	<HomeAppointmentTile
	// 		id={home.id}
	// 		nickName={home.nickName}
	// 		address={home.address}
	// 		city={home.city}
	// 		state={home.state}
	// 		zipcode={home.zipcode}
	// 		contact={home.contact}
	// 		allAppointments={allAppointments}
	// 		setChangesSubmitted={setChangesSubmitted}
	// 	/>
	// </View>
	// 	);
	// });

	return (
		<View
			style={{
				...homePageStyles.container,
				flexDirection: "column",
			}}
		>
			<View style={homePageStyles.backButtonEmployeeAssignmentsList}>
				<Pressable
					style={homePageStyles.backButtonForm}
					onPress={handleBackPress}
				>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							padding: 10,
						}}
					>
						<Icon name="angle-left" size={iconSize} color="black" />
						<View style={{ marginLeft: 15 }}>
							<Text style={topBarStyles.buttonTextSchedule}>Back</Text>
						</View>
					</View>
				</Pressable>
			</View>
		</View>
	);
};

export default EmployeeAssignmentsList;
