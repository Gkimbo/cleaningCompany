import React from "react";
import { Pressable } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";

const SignOutButton = ({ dispatch }) => {
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
		<Pressable style={styles.button} onPress={signOut}>
			<Icon name="sign-out" size={20} color="black" />
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

export default SignOutButton;
