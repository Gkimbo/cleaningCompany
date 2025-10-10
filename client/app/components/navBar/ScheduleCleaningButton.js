import React, { useState, useEffect } from "react";
import { Pressable, Text } from "react-native";
import { useNavigate } from "react-router-native";
import topBarStyles from "../../services/styles/TopBarStyles";

const ScheduleCleaningButton = ({ closeModal }) => {
	const [redirect, setRedirect] = useState(false);
	const navigate = useNavigate();

	useEffect(() => {
		if (redirect) {
			navigate("/list-of-homes");
			setRedirect(false);
		}
	}, [redirect]);

	const handlePress = () => {
		closeModal();
		setRedirect(true);
	};

	return (
		<Pressable style={styles.button} onPress={handlePress}>
			<Text style={topBarStyles.buttonTextSchedule}>
				Book or cancel a Cleaning
			</Text>
		</Pressable>
	);
};

const styles = {
	button: {
		backgroundColor: "#f9bc60",
		padding: 10,
		borderRadius: 50,
	},
};

export default ScheduleCleaningButton;
