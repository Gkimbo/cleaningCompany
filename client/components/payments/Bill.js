import React, { useState, useEffect } from "react";
import { Pressable, View, Text, ScrollView } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import HomeTile from "../tiles/HomeTile";

const Bill = ({ state, dispatch }) => {
	const [redirect, setRedirect] = useState(false);
	const navigate = useNavigate();
	let appointmentPrice = 0;
	console.log(appointmentPrice);

	console.log(state.appointments);
	state.appointments.forEach((appt) => {
		if (!appt.paid) {
			appointmentPrice += Number(appt.price);
		}
	});

	useEffect(() => {
		if (redirect) {
			navigate("/");
			setRedirect(false);
		}
	}, [redirect]);

	const handlePress = () => {
		setRedirect(true);
	};

	return <View style={homePageStyles.container}>{appointmentPrice}</View>;
};

export default Bill;
