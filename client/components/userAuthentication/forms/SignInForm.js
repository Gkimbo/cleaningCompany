import React, { useState, useEffect, useContext } from "react";
import { Text, Pressable, View } from "react-native";
import { TextInput } from "react-native-paper";
import { useNavigate } from "react-router-native";

import FetchData from "../../../services/fetchRequests/fetchData";
import formStyles from "../../../services/styles/FormStyle";
import { AuthContext } from "../../../services/AuthContext";

const SignInForm = ({ state, dispatch }) => {
	const [userName, setUserName] = useState("");
	const [password, setPassword] = useState("");
	const [redirect, setRedirect] = useState(false);
	const [errors, setErrors] = useState([]);
	const [showPassword, setShowPassword] = useState(false);
	const navigate = useNavigate();
	const { login } = useContext(AuthContext);

	const validateForm = () => {
		const validationErrors = [];
		if (userName.length === 0) {
			validationErrors.push("Please type in your User Name");
		}
		if (password.length === 0) {
			validationErrors.push("Please type your password");
		}
		setErrors(validationErrors);
		return validationErrors.length === 0;
	};

	const onSubmit = async () => {
		const isValid = validateForm();
		if (isValid) {
			const loginData = {
				userName: userName,
				password: password,
			};

			const response = await FetchData.login(loginData);
			if (response === "That User Name does not exist, please sign up.") {
				setErrors([response]);
			}
			if (response === "Invalid password") {
				setErrors([response]);
			}
			if (response.user) {
				dispatch({ type: "CURRENT_USER", payload: response.token });
				if (response.user.username === "manager1") {
					dispatch({ type: "USER_ACCOUNT", payload: response.user.username });
				}
				if (response.user.type === "cleaner") {
					dispatch({ type: "USER_ACCOUNT", payload: response.user.type });
				}
				login(response.token);
				setRedirect(true);
			}
		}
	};

	useEffect(() => {
		if (redirect) {
			navigate("/");
		}
	}, [redirect]);

	return (
		<View>
			{errors.length > 0 && (
				<View style={formStyles.errorContainer}>
					{errors.map((error, index) => (
						<Text key={index} style={formStyles.errorText}>
							{error}
						</Text>
					))}
				</View>
			)}
			<TextInput
				mode="outlined"
				value={userName}
				onChangeText={setUserName}
				placeholder="User Name"
				style={formStyles.input}
			/>
			<TextInput
				mode="outlined"
				secureTextEntry={!showPassword}
				value={password}
				onChangeText={setPassword}
				placeholder="Password"
				right={
					<TextInput.Icon
						icon={showPassword ? "eye-off" : "eye"}
						onPress={() => setShowPassword(!showPassword)}
					/>
				}
				style={formStyles.input}
			/>
			<Pressable onPress={onSubmit}>
				<Text style={formStyles.button}>Sign In</Text>
			</Pressable>
		</View>
	);
};

export default SignInForm;
