import React, { useState, useEffect, useContext } from "react";
import { Text, Pressable, View } from "react-native";
import { useNavigate } from "react-router-native";
import { TextInput } from "react-native-paper";

import FetchData from "../../../services/fetchRequests/fetchData";
import formStyles from "../../../services/styles/FormStyle";
import { AuthContext } from "../../../services/AuthContext";

const SignUpForm = ({ state, dispatch }) => {
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [userName, setUserName] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [email, setEmail] = useState("");
	const [redirect, setRedirect] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [errors, setErrors] = useState([]);
	const navigate = useNavigate();
	const { login } = useContext(AuthContext);

	const validate = () => {
		const validationErrors = [];

		if (!firstName.trim()) {
			validationErrors.push("First name is required.");
		}

		if (!lastName.trim()) {
			validationErrors.push("Last name is required.");
		}

		if (userName.length < 4 || userName.length > 12) {
			validationErrors.push("Username must be between 4 and 12 characters.");
		}

		if (userName.toLowerCase().includes("manager")) {
			validationErrors.push("Username cannot contain the word 'manager'.");
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

		if (password !== confirmPassword) {
			validationErrors.push("Passwords do not match.");
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
				firstName,
				lastName,
				userName,
				password,
				email,
			};
			const response = await FetchData.makeNewUser(data);
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

			<View style={{ flexDirection: "row", gap: 8 }}>
				<TextInput
					mode="outlined"
					label="First Name *"
					placeholder="First name"
					style={[formStyles.input, { flex: 1 }]}
					value={firstName}
					onChangeText={setFirstName}
				/>
				<TextInput
					mode="outlined"
					label="Last Name *"
					placeholder="Last name"
					style={[formStyles.input, { flex: 1 }]}
					value={lastName}
					onChangeText={setLastName}
				/>
			</View>

			<TextInput
				mode="outlined"
				label="Username *"
				placeholder="Choose a username (4-12 characters)"
				style={formStyles.input}
				value={userName}
				onChangeText={setUserName}
				autoCapitalize="none"
			/>

			<TextInput
				mode="outlined"
				label="Email *"
				placeholder="Enter your email"
				style={formStyles.input}
				value={email}
				onChangeText={setEmail}
				keyboardType="email-address"
				autoCapitalize="none"
			/>

			<TextInput
				mode="outlined"
				label="Password *"
				secureTextEntry={!showPassword}
				value={password}
				onChangeText={setPassword}
				placeholder="Create a password"
				autoComplete="off"
				textContentType="none"
				autoCorrect={false}
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
				label="Confirm Password *"
				secureTextEntry={!showConfirmPassword}
				value={confirmPassword}
				onChangeText={setConfirmPassword}
				placeholder="Confirm your password"
				autoComplete="off"
				textContentType="none"
				autoCorrect={false}
				right={
					<TextInput.Icon
						icon={showConfirmPassword ? "eye-off" : "eye"}
						onPress={() => setShowConfirmPassword(!showConfirmPassword)}
					/>
				}
				style={formStyles.input}
			/>

			<Text style={{ fontSize: 12, color: "#64748b", marginBottom: 16, marginTop: -8 }}>
				Password must be at least 8 characters with 2 uppercase, 2 lowercase, and 2 special characters.
			</Text>

			<Pressable style={formStyles.button} onPress={onSubmit}>
				<Text style={formStyles.buttonText}>Create Account</Text>
			</Pressable>
		</View>
	);
};

export default SignUpForm;
