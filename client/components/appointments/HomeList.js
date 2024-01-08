import React, { useState, useEffect } from "react";
import { Pressable, View, Text } from "react-native";
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
			<HomeTile
				key={home.id}
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
		);
	});

	return (
		<View style={homePageStyles.container}>
			{state.homes.length > 0 ? (
				<>
					{usersHomes}
					<Pressable style={styles.button} onPress={handlePress}>
						<Text>Add another Home</Text>
					</Pressable>
				</>
			) : (
				<Pressable style={styles.button} onPress={handlePress}>
					<Text>Add a Home</Text>
				</Pressable>
			)}
		</View>
	);
};

const styles = {
	button: {
		backgroundColor: "#f9bc60",
		padding: 10,
		borderRadius: 10,
		height: "5%",
	},
};

export default HomeList;
