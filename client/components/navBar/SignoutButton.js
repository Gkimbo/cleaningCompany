import React from "react";
import { Pressable, Dimensions } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import topBarStyles from "../../services/styles/TopBarStyles";

const SignOutButton = ({ dispatch }) => {
	const { width } = Dimensions.get("window");
	const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
	const navigate = useNavigate();

	const signOut = () => {
		fetch("http://localhost:3000/api/v1/user-sessions/logout", {
			method: "POST",
			credentials: "include",
		})
			.then((response) => {
				if (response.ok) {
					localStorage.removeItem("token");
					dispatch({ type: "CURRENT_USER", payload: null });
					navigate("/");
				} else {
					console.error("Failed to log out");
				}
			})
			.catch((error) => {
				console.error("An error occurred while logging out:", error);
			});
	};

	return (
		<Pressable style={topBarStyles.signOutButton} onPress={signOut}>
			<Icon name="sign-out" size={iconSize} color="black" />
		</Pressable>
	);
};

export default SignOutButton;
