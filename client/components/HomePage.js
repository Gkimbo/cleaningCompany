import React, { useEffect } from "react";
import { Text, View, Image, ScrollView } from "react-native";
import homePageStyles from "../services/styles/HomePageStyles";
import FetchData from "../services/fetchRequests/fetchData";
import image1 from "../services/photos/Best-Cleaning-Service.jpeg";
import image2 from "../services/photos/clean-laptop.jpg";
import image3 from "../services/photos/cleaning-tech.png";
import image4 from "../services/photos/cleaning_supplies_on_floor.jpg";
import { cleaningCompany } from "../services/data/companyInfo";
import { FadeInSection } from "../services/FadeInSection";
import Animated, {
	interpolate,
	useAnimatedRef,
	useAnimatedStyle,
	useScrollViewOffset,
} from "react-native-reanimated";

const HomePage = ({ state, dispatch }) => {
	const scrollRef = useAnimatedRef();
	const scrollOffSet = useScrollViewOffset(scrollRef);

	const imageAnimatedStyles = useAnimatedStyle(() => {
		return {
			transform: [
				{
					translateY: interpolate(
						scrollOffSet.value,
						[-300, 0, 300],
						[-300 / 2, 0, 300 * 0.75]
					),
				},
				{
					scale: interpolate(scrollOffSet.value, [-300, 0, 300], [2, 1, 1]),
				},
			],
		};
	});

	useEffect(() => {
		if (state.currentUser.token) {
			FetchData.get("/api/v1/user-info", state.currentUser.token).then(
				(response) => {
					dispatch({
						type: "USER_HOME",
						payload: response.user.homes,
					});
					dispatch({
						type: "USER_APPOINTMENTS",
						payload: response.user.appointments,
					});
				}
			);
		}
	}, []);

	return (
		<View
			style={{
				...homePageStyles.container,
				flexDirection: "column",
				marginTop: 105,
			}}
		>
			<View
				style={{
					...homePageStyles.container,
					flexDirection: "column",
					justifyContent: "flex-start",
					paddingLeft: "10%",
					paddingRight: "10%",
					marginTop: 20,
				}}
			>
				{/* <Animated.ScrollView ref={scrollRef} scrollEventThrottle={16}>
					<Animated.Image
						source={image3}
						style={[homePageStyles.parallaxImage, imageAnimatedStyles]}
					/>
				</Animated.ScrollView> */}
				<Text style={homePageStyles.title}>Welcome to Cleaning Services!</Text>
				<View style={homePageStyles.homePageParagraphSurround}>
					<View style={homePageStyles.homePageParagraphText}>
						<Text style={homePageStyles.smallTitle}>About Our Service: </Text>
						<Text style={homePageStyles.information}>
							{cleaningCompany.aboutService.description}
						</Text>
					</View>
					<Image source={image3} style={homePageStyles.image} />
				</View>
				<View style={homePageStyles.homePageParagraphSurround}>
					<View style={homePageStyles.reverseImage}>
						<Image source={image2} style={homePageStyles.image} />
						<View style={homePageStyles.homePageParagraphText}>
							<Text style={homePageStyles.smallTitle}>
								Booking Information:{" "}
							</Text>
							<Text style={homePageStyles.information}>
								{cleaningCompany.bookingInfo.description}
							</Text>
						</View>
					</View>
				</View>
				<View style={homePageStyles.homePageParagraphSurround}>
					<View style={homePageStyles.homePageParagraphText}>
						<Text style={homePageStyles.smallTitle}>
							Special Considerations:
						</Text>
						<Text style={homePageStyles.information}>
							{cleaningCompany.specialConsiderations.description}
						</Text>
					</View>
					<Image source={image4} style={homePageStyles.image} />
				</View>
				<View style={homePageStyles.homePageParagraphSurround}>
					<View style={homePageStyles.reverseImage}>
						<Image source={image1} style={homePageStyles.imageGuarantee} />
						<View style={homePageStyles.homePageParagraphText}>
							<Text style={homePageStyles.smallTitle}>
								Our Worry-Free Guarantee:{" "}
							</Text>
							<Text style={homePageStyles.information}>
								{cleaningCompany.ourWorryFreeGuarantee.description}
							</Text>
						</View>
					</View>
				</View>
				<Text style={homePageStyles.smallTitle}>Cancellation Policy: </Text>
				<Text style={homePageStyles.information}>
					{cleaningCompany.cancellationPolicy.description}
				</Text>
			</View>
		</View>
	);
};

export default HomePage;
