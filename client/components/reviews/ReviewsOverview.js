import React, { useState, useEffect } from "react";
import { Pressable, View, Text, ScrollView, Dimensions } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import Icon from "react-native-vector-icons/FontAwesome";
import topBarStyles from "../../services/styles/TopBarStyles";
import Review from "../../services/fetchRequests/ReviewClass";

const ReviewsOverview = ({ state, dispatch }) => {
	const [allReviews, setAllReviews] = useState([]);
	const [redirect, setRedirect] = useState(false);
	const { width } = Dimensions.get("window");
	const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
	const navigate = useNavigate();

	useEffect(() => {
		if (state.currentUser.token) {
			Review.getReviews(state.currentUser.token).then(
				(response) => {
					console.log(response)
				}
			);
		}
		if (redirect) {
			navigate("/add-home");
			setRedirect(false);
		}

	}, [redirect]);

	const handlePress = () => {
		setRedirect(true);
	};

	return (
		<View
			style={{
				...homePageStyles.container,
				flexDirection: "column",
			}}
		>
			<Text>

			REVIEWS!!!!
			</Text>
		</View>
	);
};

export default ReviewsOverview;