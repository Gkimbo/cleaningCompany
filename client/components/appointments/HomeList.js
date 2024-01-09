import React, { useState, useEffect } from "react";
import { Pressable, View, Text, ScrollView } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import HomeTile from "../tiles/HomeTile";

const HomeList = ({ state }) => {
	const [redirect, setRedirect] = useState(false);
	const navigate = useNavigate();

	useEffect(() => {
		if (redirect) {
			navigate("/add-home");
			setRedirect(false);
		}
	}, [redirect]);

	const handlePress = () => {
		setRedirect(true);
	};

	const usersHomes = state.homes.map((home) => {
		return (
			<View key={home.id}>
				<HomeTile
					id={home.id}
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
		<View style={homePageStyles.container}>
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
