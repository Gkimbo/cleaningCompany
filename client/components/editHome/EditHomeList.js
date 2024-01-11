import React, { useState, useEffect } from "react";
import {
	Pressable,
	View,
	Text,
	ScrollView,
	Animated,
	Easing,
} from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import EditHomeTile from "../tiles/EditHomeTile";
import FetchData from "../../services/fetchRequests/fetchData";

const EditHomeList = ({ state, dispatch }) => {
	const [redirect, setRedirect] = useState(false);
	const [deleteAnimation] = useState(new Animated.Value(0));
	const [deleteConfirmation, setDeleteConfirmation] = useState({});
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

	const handleNoPress = (homeId) => {
		setDeleteConfirmation((prevConfirmations) => ({
			[homeId]: !prevConfirmations[homeId],
		}));
	};

	const onDeleteHome = async (id) => {
		try {
			const deleteHome = await FetchData.deleteHome(id);
			if (deleteHome) {
				dispatch({ type: "DELETE_HOME", payload: id });
			}
		} catch (error) {
			console.error("Error deleting car:", error);
		}
	};

	const handleDeletePress = (homeId) => {
		setDeleteConfirmation((prevConfirmations) => ({
			[homeId]: !prevConfirmations[homeId],
		}));
		if (deleteConfirmation[homeId]) {
			Animated.timing(deleteAnimation, {
				toValue: 0,
				duration: 300,
				easing: Easing.linear,
				useNativeDriver: false,
			}).start(() => {
				onDeleteHome(homeId);
				setDeleteConfirmation((prevConfirmations) => ({
					...prevConfirmations,
					[homeId]: false,
				}));
			});
		} else {
			Animated.timing(deleteAnimation, {
				toValue: 1,
				duration: 300,
				easing: Easing.linear,
				useNativeDriver: false,
			}).start();
		}
	};

	const usersHomes = state.homes.map((home) => {
		return (
			<View key={home.id}>
				<EditHomeTile
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
					handleDeletePress={handleDeletePress}
					deleteAnimation={deleteAnimation}
					deleteConfirmation={deleteConfirmation}
					setDeleteConfirmation={setDeleteConfirmation}
					handleNoPress={handleNoPress}
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

export default EditHomeList;
