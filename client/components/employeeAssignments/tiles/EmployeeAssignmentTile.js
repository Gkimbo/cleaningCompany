import React, { useEffect, useState } from "react";
import { Pressable, Text, View, LayoutAnimation } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../../services/styles/HomePageStyles";
import FetchData from "../../../services/fetchRequests/fetchData";

const EmployeeAssignmentTile = ({
	id,
	cleanerId,
	date,
	price,
	homeId,
	bringSheets,
	bringTowels,
	completed,
	keyPadCode,
	keyLocation,
	addEmployee,
	removeEmployee,
	assigned,
}) => {
	const navigate = useNavigate();
	const [expandWindow, setExpandWindow] = useState(false);
	const [home, setHome] = useState({
		address: "",
		city: "",
		compostLocation: "",
		contact: "",
		keyLocation: "",
		keyPadCode: "",
		numBaths: "",
		numBeds: "",
		recyclingLocation: "",
		sheetsProvided: "",
		specialNotes: "",
		state: "",
		towelsProvided: "",
		trashLocation: "",
		zipcode: "",
		cleanersNeeded: "",
	});

	const amount = (Number(price)* 0.9)
	const formatDate = (dateString) => {
		const options = {
			weekday: "long",
			month: "short",
			day: "numeric",
			year: "numeric",
		};
		return new Date(dateString).toLocaleDateString(undefined, options);
	};

	const expandDetails = () => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setExpandWindow(true);
	};
	const contractDetails = () => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setExpandWindow(false);
	};

	useEffect(() => {
		FetchData.getHome(homeId).then((response) => {
			setHome(response.home);
		});
	}, []);

	return (
		<View style={[homePageStyles.homeTileContainer]}>
			<Pressable onPress={expandWindow ? contractDetails : expandDetails}>
				<Text style={homePageStyles.appointmentDate}>{formatDate(date)}</Text>
				<Text style={{...homePageStyles.appointmentDate, fontSize: 15}}>{`You could make $${amount} cleaning this home`}</Text>
				<Text style={homePageStyles.appointmentPrice}>
					{home.city}
				</Text>
				<Text style={homePageStyles.appointmentPrice}>
					{home.state}, {home.zipcode}
				</Text>
				{(expandWindow || assigned) && (
					<>
						<Text style={{ ...homePageStyles.appointmentPrice, marginTop: 5 }}>
							Number of Beds: {home.numBeds}
						</Text>
						<Text style={homePageStyles.appointmentPrice}>
							Number of Bathrooms: {home.numBaths}
						</Text>
						<Text style={{ ...homePageStyles.appointmentPrice, marginTop: 5 }}>
							Sheets are needed: {bringSheets}
						</Text>
						<Text style={{ ...homePageStyles.appointmentPrice, marginTop: 5 }}>
							Towels are needed: {bringTowels}
						</Text>
						{home.cleanersNeeded > 1 && (
							<>
							<Text
								style={{ ...homePageStyles.appointmentPrice, marginTop: 10, fontWeight: "bold"}}
							>
								This is a larger home. You may need more people to clean it in a timely manor. 
							</Text>
							<Text
							style={{ ...homePageStyles.appointmentPrice }}
						>
							If you dont think you can complete it, please choose a smaller home!
						</Text>
						</>
						)}
					</>
				)}
			</Pressable>
			{assigned ? (
        <Pressable
          style={{
            ...homePageStyles.button,
            backgroundColor: "red",
            marginTop: 15,
          }}
          onPress={() => removeEmployee(cleanerId, id)}
        >
          <Text>I no longer want to clean this home!</Text>
        </Pressable>
      ) : (
        <Pressable
          style={{
            ...homePageStyles.button,
            backgroundColor: "green",
            marginTop: 15,
          }}
          onPress={() => addEmployee(cleanerId, id)}
        >
          <Text>I want to clean this home!</Text>
        </Pressable>
      )}
		</View>
	);
};

export default EmployeeAssignmentTile;
