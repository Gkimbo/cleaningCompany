import React, { useState, useEffect, useContext } from "react";
import { Text, Pressable, View } from "react-native";
import { TextInput } from "react-native-paper";
import { useNavigate, useSearchParams } from "react-router-native";

import FetchData from "../../../services/fetchRequests/fetchData";
import formStyles from "../../../services/styles/FormStyle";
import { AuthContext } from "../../../services/AuthContext";

const SignInForm = ({ state, dispatch }) => {
	const [userName, setUserName] = useState("");
	const [password, setPassword] = useState("");
	const [redirect, setRedirect] = useState(false);
	const [redirectToTerms, setRedirectToTerms] = useState(false);
	const [errors, setErrors] = useState([]);
	const [showPassword, setShowPassword] = useState(false);
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const redirectTo = searchParams.get("redirect");
	const { login } = useContext(AuthContext);

	const validateForm = () => {
		const validationErrors = [];
		if (userName.length === 0) {
			validationErrors.push("Please enter your email or username");
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
			if (response === "No account found with that email or username.") {
				setErrors([response]);
			}
			if (response === "Invalid password") {
				setErrors([response]);
			}
			if (response.user) {
				dispatch({ type: "CURRENT_USER", payload: response.token });
				dispatch({ type: "SET_USER_ID", payload: response.user.id });
				if (response.user.email) {
					dispatch({ type: "SET_USER_EMAIL", payload: response.user.email });
				}
				if (response.user.type === "owner") {
					dispatch({ type: "USER_ACCOUNT", payload: "owner" });
				}
				if (response.user.type === "cleaner") {
					dispatch({ type: "USER_ACCOUNT", payload: response.user.type });
				}
				if (response.user.type === "humanResources") {
					dispatch({ type: "USER_ACCOUNT", payload: response.user.type });
				}
				// Set business owner info for cleaners who own a business
				if (response.user.isBusinessOwner) {
					dispatch({
						type: "SET_BUSINESS_OWNER_INFO",
						payload: {
							isBusinessOwner: response.user.isBusinessOwner,
							businessName: response.user.businessName,
							yearsInBusiness: response.user.yearsInBusiness,
						},
					});
				}
				login(response.token);

				// Check if user needs to accept updated terms
				if (response.requiresTermsAcceptance) {
					setRedirectToTerms(true);
				} else {
					setRedirect(true);
				}
			}
		}
	};

	useEffect(() => {
		if (redirect) {
			// If there's a redirect parameter, navigate there instead of home
			if (redirectTo) {
				navigate(redirectTo);
			} else {
				navigate("/");
			}
		}
	}, [redirect, redirectTo]);

	useEffect(() => {
		if (redirectToTerms) {
			navigate("/terms-acceptance");
		}
	}, [redirectToTerms]);

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
				label="Email or Username"
				value={userName}
				onChangeText={setUserName}
				placeholder="Enter your email or username"
				style={formStyles.input}
			/>
			<TextInput
				mode="outlined"
				label="Password"
				secureTextEntry={!showPassword}
				value={password}
				onChangeText={setPassword}
				placeholder="Enter your password"
				autoComplete="password"
				textContentType="oneTimeCode"
				autoCorrect={false}
				spellCheck={false}
				right={
					<TextInput.Icon
						icon={showPassword ? "eye-off" : "eye"}
						onPress={() => setShowPassword(!showPassword)}
					/>
				}
				style={formStyles.input}
			/>
			<Pressable style={formStyles.button} onPress={onSubmit}>
				<Text style={formStyles.buttonText}>Sign In</Text>
			</Pressable>

			<Pressable style={formStyles.linkButton} onPress={() => navigate("/forgot-credentials")}>
				<Text style={formStyles.linkButtonText}>Forgot username or password?</Text>
			</Pressable>
		</View>
	);
};

export default SignInForm;
