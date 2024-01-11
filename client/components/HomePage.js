import React, { useEffect } from "react";
import { Text, View, ImageBackground } from "react-native";
import homePageStyles from "../services/styles/HomePageStyles";
import FetchData from "../services/fetchRequests/fetchData";
import image1 from "../services/photos/Best-Cleaning-Service.jpeg";

const HomePage = ({ state, dispatch }) => {
	const cleaningCompany = {
		location: "Barnstable, MA",
		maxDistance: 10,
		basePrice: 100,
		extraBedBathFee: 50,
		sheetCleaningFee: 25,
		highVolumeFee: 50,
		cancellationFee: 50,
		maxBookingDays: 14,
		cleaningHours: { start: 10, end: 16 },
		highVolumeDays: ["holiday", "holiday weekend"],

		bookingInfo: {
			description:
				"Clients can easily schedule cleaning appointments up to one weeks in advance. We offer flexible options for one-bedroom, one-bathroom, and studio rentals at a base price of $100. Additional charges of $50 per bed and bath apply, accommodating various property sizes. Clients can opt to provide their own clean sheets and pillowcases or request our cleaning service to handle this for an additional $25 per cleaning. Appointments are available daily between 10 am and 4 pm.",
		},

		specialConsiderations: {
			description:
				"On high-volume days, such as holidays or holiday weekends, an extra $50 fee will be applied to ensure availability and accommodate increased demand. This additional charge helps us manage the increased workload on these specific days.",
		},

		cancellationPolicy: {
			description:
				"We understand that plans can change. Clients can cancel appointments up to one week prior to the scheduled cleaning without incurring any fees. However, cancellations within one week of the cleaning date will result in a cancellation fee of $50. This policy is in place to account for the planning and resources allocated to each appointment.",
		},

		aboutService: {
			description:
				"Our goal is to deliver exceptional cleaning services that meet the unique needs of short-term rental properties. By maintaining transparency in our pricing, offering flexible booking options, and accommodating special requests, we aim to provide a seamless experience for both property owners and guests. Our dedicated team ensures that each property is thoroughly cleaned and prepared for the next set of visitors.",
		},
	};

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
			<ImageBackground source={image1} style={homePageStyles.backgroundImage}>
				<Text style={{ ...homePageStyles.title, marginTop: 20 }}>
					Welcome to Cleaning Services!
				</Text>
			</ImageBackground>
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
				<Text style={homePageStyles.smallTitle}>About Our Service: </Text>
				<Text style={homePageStyles.information}>
					{cleaningCompany.aboutService.description}
				</Text>
				<Text style={homePageStyles.smallTitle}>Booking Information: </Text>
				<Text style={homePageStyles.information}>
					{cleaningCompany.bookingInfo.description}
				</Text>
				<Text style={homePageStyles.smallTitle}>Special Considerations:</Text>
				<Text style={homePageStyles.information}>
					{cleaningCompany.specialConsiderations.description}
				</Text>
				<Text style={homePageStyles.smallTitle}>Cancellation Policy: </Text>
				<Text style={homePageStyles.information}>
					{cleaningCompany.cancellationPolicy.description}
				</Text>
			</View>
		</View>
	);
};

export default HomePage;
