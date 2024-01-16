import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import topBarStyles from "../../services/styles/TopBarStyles";
import { useNavigate } from "react-router-native";
import HomeButton from "./HomeButton";
import SignOutButton from "./SignoutButton";
import ScheduleCleaningButton from "./ScheduleCleaningButton";
import EditHomeButton from "./EditHomeButton";
import AppointmentsButton from "./AppointmentsButton";
import BillButton from "./BillButton";

const TopBar = ({ dispatch, state }) => {
	const [signInRedirect, setSignInRedirect] = useState(false);
	const [signUpRedirect, setSignUpRedirect] = useState(false);
	const navigate = useNavigate();

	useEffect(() => {
		if (signInRedirect) {
			navigate("/sign-in");
			setSignInRedirect(false);
		}
		if (signUpRedirect) {
			navigate("/sign-up");
			setSignUpRedirect(false);
		}
	}, [signInRedirect, signUpRedirect]);

	const handlePressSignIn = () => {
		setSignInRedirect(true);
	};
	const handlePressSignUp = () => {
		setSignUpRedirect(true);
	};

	return (
		<View style={topBarStyles.container}>
			<View style={topBarStyles.containerTitleSection}>
				<Text style={topBarStyles.title}>Air BNB Cleaning Services</Text>
				{state.currentUser.token !== null && (
					<>
						<AppointmentsButton />
						<BillButton />
					</>
				)}
			</View>
			<View style={topBarStyles.containerButtonSection}>
				<HomeButton />
				{state.currentUser.token !== null ? (
					<>
						<ScheduleCleaningButton />
						<EditHomeButton />
						<SignOutButton dispatch={dispatch} />
					</>
				) : (
					<>
						<Pressable style={topBarStyles.button} onPress={handlePressSignIn}>
							<Text style={topBarStyles.buttonText}>Sign In</Text>
						</Pressable>
						<Pressable style={topBarStyles.button} onPress={handlePressSignUp}>
							<Text style={topBarStyles.buttonText}>Sign up</Text>
						</Pressable>
					</>
				)}
			</View>
		</View>
	);
};

export default TopBar;
