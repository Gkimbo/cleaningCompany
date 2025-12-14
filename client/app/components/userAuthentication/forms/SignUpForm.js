import React, { useState, useEffect, useContext } from "react";
import { Text, Pressable, View } from "react-native";
import { useNavigate } from "react-router-native";
import { TextInput } from "react-native-paper";

import FetchData from "../../../services/fetchRequests/fetchData";
import formStyles from "../../../services/styles/FormStyle";
import { AuthContext } from "../../../services/AuthContext";

const SignUpForm = ({ state, dispatch }) => {
	const [userName, setUserName] = useState("");
	const [password, setPassword] = useState("");
	const [email, setEmail] = useState("");
	const [redirect, setRedirect] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [errors, setErrors] = useState([]);
	const navigate = useNavigate();
	const { login } = useContext(AuthContext);

	const validate = () => {
		const validationErrors = [];

		if (userName.length < 4 || userName.length > 12) {
			validationErrors.push("Username must be between 4 and 12 characters.");
		}

		const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
		const lowercaseCount = (password.match(/[a-z]/g) || []).length;
		const specialCharCount = (
			password.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []
		).length;

		if (
			password.length < 8 ||
			uppercaseCount < 2 ||
			lowercaseCount < 2 ||
			specialCharCount < 2
		) {
			validationErrors.push(
				"Password must be at least 8 characters long with 2 uppercase letters, 2 lowercase letters, and 2 special characters."
			);
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			validationErrors.push("Please enter a valid email address.");
		}

		setErrors(validationErrors);
		return validationErrors.length === 0;
	};

	const onSubmit = async () => {
		if (!validate()) {
			return;
		} else {
			const data = {
				userName,
				password,
				email,
			};
			const response = await FetchData.makeNewUser(data);
			console.log("response")
			if (
				response === "An account already has this email" ||
				response === "Username already exists"
			) {
				setErrors([response]);
			} else {
				dispatch({ type: "CURRENT_USER", payload: response.token });
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
				label="Username"
				placeholder="Enter your username"
				style={formStyles.input}
				value={userName}
				onChangeText={setUserName}
			/>
			<TextInput
				mode="outlined"
				label="Password"
				secureTextEntry={!showPassword}
				value={password}
				onChangeText={setPassword}
				placeholder="Enter your password"
				right={
					<TextInput.Icon
						icon={showPassword ? "eye-off" : "eye"}
						onPress={() => setShowPassword(!showPassword)}
					/>
				}
				style={formStyles.input}
			/>
			<TextInput
				mode="outlined"
				label="Email"
				placeholder="Enter your email"
				style={formStyles.input}
				value={email}
				onChangeText={setEmail}
				keyboardType="email-address"
				autoCapitalize="none"
			/>

			<Pressable style={formStyles.button} onPress={onSubmit}>
				<Text style={formStyles.buttonText}>Create Account</Text>
			</Pressable>
		</View>
	);
};

export default SignUpForm;
