import React, { useState, useEffect } from "react";
import { Pressable, Dimensions } from "react-native";
import { useNavigate } from "react-router-native";

import Icon from "react-native-vector-icons/FontAwesome";

const HomeButton = () => {
	const [redirect, setRedirect] = useState(false);
	const navigate = useNavigate();
	const { width } = Dimensions.get("window");
	const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;

	useEffect(() => {
		if (redirect) {
			navigate("/");
			setRedirect(false);
		}
	}, [redirect]);

	const handlePress = () => {
		setRedirect(true);
	};

	return (
		<Pressable style={styles.button} onPress={handlePress}>
			<Icon name="home" size={iconSize} color="black" />
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

export default HomeButton;
