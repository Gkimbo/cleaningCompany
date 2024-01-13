import React, { useState, useEffect } from "react";
import { Pressable, View, Text, ScrollView, Dimensions } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import HomeAppointmentTile from "../tiles/HomeAppointmentTile";
import Icon from "react-native-vector-icons/FontAwesome";
import topBarStyles from "../../services/styles/TopBarStyles";

const AppointmentList = ({ state, dispatch }) => {
	const [allHomes, setAllHomes] = useState([]);
	const [allAppointments, setAllAppointments] = useState([]);
	const [redirect, setRedirect] = useState(false);
	const [backRedirect, setBackRedirect] = useState(false);
	const { width } = Dimensions.get("window");
	const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
	const navigate = useNavigate();

	useEffect(() => {
		setAllAppointments(state.appointments);
		setAllHomes(state.homes);
		if (redirect) {
			navigate("/add-home");
			setRedirect(false);
		}
		if (backRedirect) {
			navigate("/");
			setBackRedirect(false);
		}
	}, [redirect, backRedirect]);

	const handlePress = () => {
		setRedirect(true);
	};

	const handleBackPress = () => {
		setBackRedirect(true);
	};

	const usersHomes = state.homes.map((home) => {
		return (
			<View key={home.id}>
				<HomeAppointmentTile
					id={home.id}
					address={home.address}
					city={home.city}
					zipcode={home.zipcode}
					allAppointments={allAppointments}
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
			<View style={homePageStyles.backButtonContainerList}>
				<Pressable
					style={homePageStyles.backButtonForm}
					onPress={handleBackPress}
				>
					<View
						style={{ flexDirection: "row", alignItems: "center", padding: 10 }}
					>
						<Icon name="angle-left" size={iconSize} color="black" />
						<View style={{ marginLeft: 15 }}>
							<Text style={topBarStyles.buttonTextSchedule}>Back</Text>
						</View>
					</View>
				</Pressable>
			</View>
			<View>
				{state.homes.length > 0 ? (
					<>
						{usersHomes}
						<Pressable
							style={homePageStyles.AddHomeButton}
							onPress={handlePress}
						>
							<Text style={homePageStyles.AddHomeButtonText}>
								Add another Home
							</Text>
						</Pressable>
					</>
				) : (
					<Pressable style={homePageStyles.AddHomeButton} onPress={handlePress}>
						<Text style={homePageStyles.AddHomeButtonText}>Add a Home</Text>
					</Pressable>
				)}
			</View>
		</View>
	);
};

export default AppointmentList;
