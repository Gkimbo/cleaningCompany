import React, { useState, useEffect } from "react";
import { Pressable, View, Text, ScrollView, Dimensions } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../../services/styles/HomePageStyles";
import Icon from "react-native-vector-icons/FontAwesome";
import topBarStyles from "../../../services/styles/TopBarStyles";
import FetchData from "../../../services/fetchRequests/fetchData";
import EmployeeAssignmentTile from "../tiles/EmployeeAssignmentTile";

const EmployeeAssignmentsList = ({ state, dispatch }) => {
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
					dispatch({
						type: "USER_APPOINTMENTS",
						payload: response.employee.cleanerAppointments,
					});
					setAllAppointments(response.employee.cleanerAppointments);
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

	const sortedAppointments = allAppointments.sort((a, b) => {
		return new Date(a.date) - new Date(b.date);
	});

	const assignedAppointments = sortedAppointments.map((appointment) => {
		return (
			<View key={appointment.id}>
				<EmployeeAssignmentTile
					id={appointment.id}
					date={appointment.date}
					homeId={appointment.homeId}
					bringSheets={appointment.bringSheets}
					bringTowels={appointment.bringTowels}
					completed={appointment.completed}
					keyPadCode={appointment.keyPadCode}
					keyLocation={appointment.keyLocation}
				/>
			</View>
		);
	});

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
			{assignedAppointments}
		</View>
	);
};

export default EmployeeAssignmentsList;
