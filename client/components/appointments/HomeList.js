import React, { useState, useEffect } from "react";
import { Pressable, View, Text, ScrollView, Dimensions } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import HomeTile from "../tiles/HomeTile";
import Icon from "react-native-vector-icons/FontAwesome";
import topBarStyles from "../../services/styles/TopBarStyles";

const HomeList = ({ state, dispatch }) => {
	const [redirect, setRedirect] = useState(false);
	const [backRedirect, setBackRedirect] = useState(false);
	const { width } = Dimensions.get("window");
	const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
	const navigate = useNavigate();

	useEffect(() => {
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
				<HomeTile
					id={home.id}
					nickName={home.nickName}
					state={home.state}
					address={home.address}
					city={home.city}
					zipcode={home.zipcode}
					numBeds={home.numBeds}
					numBaths={home.numBaths}
					sheetsProvided={home.sheetsProvided}
					towelsProvided={home.towelsProvided}
					keyPadCode={home.keyPadCode}
					keyLocation={home.keyLocation}
					recyclingLocation={home.recyclingLocation}
					compostLocation={home.compostLocation}
					trashLocation={home.trashLocation}
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
			<ScrollView>
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
			</ScrollView>
		</View>
	);
};

export default HomeList;
