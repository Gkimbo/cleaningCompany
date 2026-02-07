import React, { useState, useEffect, useContext } from "react";
import { Text, Pressable, View, StyleSheet, ActivityIndicator } from "react-native";
import { TextInput, RadioButton } from "react-native-paper";
import { useNavigate, useSearchParams } from "react-router-native";

import FetchData from "../../../services/fetchRequests/fetchData";
import formStyles from "../../../services/styles/FormStyle";
import { AuthContext } from "../../../services/AuthContext";
import { colors, spacing, radius, typography } from "../../../services/styles/theme";

const SignInForm = ({ state, dispatch }) => {
	const [userName, setUserName] = useState("");
	const [password, setPassword] = useState("");
	const [redirect, setRedirect] = useState(false);
	const [redirectToTerms, setRedirectToTerms] = useState(false);
	const [errors, setErrors] = useState([]);
	const [showPassword, setShowPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	// Multi-account state
	const [accountOptions, setAccountOptions] = useState([]);
	const [selectedAccountType, setSelectedAccountType] = useState(null);
	const [checkingAccounts, setCheckingAccounts] = useState(false);

	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const redirectTo = searchParams.get("redirect");
	const { login } = useContext(AuthContext);

	// Debounced check for multiple accounts when email is entered
	useEffect(() => {
		// Only check if it looks like an email
		if (!userName.includes("@")) {
			setAccountOptions([]);
			setSelectedAccountType(null);
			return;
		}

		const timer = setTimeout(async () => {
			setCheckingAccounts(true);
			const result = await FetchData.checkAccountsByEmail(userName);
			if (result.multipleAccounts && result.accountOptions) {
				setAccountOptions(result.accountOptions);
				// Pre-select the first option
				setSelectedAccountType(result.accountOptions[0].accountType);
			} else {
				setAccountOptions([]);
				setSelectedAccountType(null);
			}
			setCheckingAccounts(false);
		}, 500);

		return () => clearTimeout(timer);
	}, [userName]);

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
			setIsLoading(true);
			const loginData = {
				userName: userName,
				password: password,
				accountType: selectedAccountType,
			};

			const response = await FetchData.login(loginData);
			setIsLoading(false);

			if (response === "No account found with that email or username.") {
				setErrors([response]);
			}
			if (response === "Invalid password") {
				setErrors([response]);
			}
			if (typeof response === "string" && response.includes("locked")) {
				setErrors([response]);
			}
			if (response.requiresAccountSelection) {
				// Backend returned 300 - update account options
				setAccountOptions(response.accountOptions);
				if (!selectedAccountType && response.accountOptions.length > 0) {
					setSelectedAccountType(response.accountOptions[0].accountType);
				}
				setErrors(["Please select which account you want to sign into"]);
			}
			if (response.user) {
				dispatch({ type: "CURRENT_USER", payload: response.token });
				dispatch({ type: "SET_USER_ID", payload: response.user.id });
				dispatch({ type: "SET_FULL_USER", payload: response.user });
				if (response.user.email) {
					dispatch({ type: "SET_USER_EMAIL", payload: response.user.email });
				}
				if (response.user.type === "owner") {
					dispatch({ type: "USER_ACCOUNT", payload: "owner" });
				}
				if (response.user.type === "employee") {
					dispatch({ type: "USER_ACCOUNT", payload: "employee" });
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
					// Set business logo if available
					if (response.user.businessLogo) {
						dispatch({
							type: "SET_BUSINESS_LOGO",
							payload: response.user.businessLogo,
						});
					}
				}
				// Store linked accounts for account switching
				if (response.linkedAccounts && response.linkedAccounts.length > 0) {
					dispatch({ type: "SET_LINKED_ACCOUNTS", payload: response.linkedAccounts });
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

	const getAccountIcon = (accountType) => {
		switch (accountType) {
			case "employee":
				return "🏢";
			case "marketplace_cleaner":
				return "🧹";
			case "cleaner":
				return "🧹";
			case "owner":
				return "👔";
			case "hr":
				return "📋";
			case "homeowner":
				return "🏠";
			default:
				return "👤";
		}
	};

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
				autoCapitalize="none"
				autoCorrect={false}
			/>

			{/* Account Type Selection */}
			{checkingAccounts && (
				<View style={styles.checkingContainer}>
					<ActivityIndicator size="small" color={colors.primary[600]} />
					<Text style={styles.checkingText}>Checking accounts...</Text>
				</View>
			)}

			{accountOptions.length > 0 && !checkingAccounts && (
				<View style={styles.accountSelector}>
					<Text style={styles.accountSelectorLabel}>
						Multiple accounts found. Select one:
					</Text>
					<RadioButton.Group
						onValueChange={(value) => setSelectedAccountType(value)}
						value={selectedAccountType}
					>
						{accountOptions.map((option) => (
							<Pressable
								key={option.accountType}
								style={[
									styles.accountOption,
									selectedAccountType === option.accountType && styles.accountOptionSelected,
								]}
								onPress={() => setSelectedAccountType(option.accountType)}
							>
								<View style={styles.accountOptionContent}>
									<Text style={styles.accountIcon}>{getAccountIcon(option.accountType)}</Text>
									<Text style={styles.accountLabel}>{option.displayName}</Text>
								</View>
								<RadioButton
									value={option.accountType}
									color={colors.primary[600]}
								/>
							</Pressable>
						))}
					</RadioButton.Group>
				</View>
			)}

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
			<Pressable
				style={[formStyles.button, isLoading && formStyles.buttonDisabled]}
				onPress={onSubmit}
				disabled={isLoading}
			>
				{isLoading ? (
					<ActivityIndicator size="small" color={colors.neutral[0]} />
				) : (
					<Text style={formStyles.buttonText}>Sign In</Text>
				)}
			</Pressable>

			<Pressable style={formStyles.linkButton} onPress={() => navigate("/forgot-credentials")}>
				<Text style={formStyles.linkButtonText}>Forgot username or password?</Text>
			</Pressable>
		</View>
	);
};

const styles = StyleSheet.create({
	checkingContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: spacing.sm,
		gap: spacing.sm,
	},
	checkingText: {
		color: colors.text.secondary,
		fontSize: typography.fontSize.sm,
	},
	accountSelector: {
		backgroundColor: colors.primary[50],
		borderRadius: radius.lg,
		padding: spacing.md,
		marginBottom: spacing.md,
		borderWidth: 1,
		borderColor: colors.primary[200],
	},
	accountSelectorLabel: {
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.semibold,
		color: colors.primary[700],
		marginBottom: spacing.sm,
	},
	accountOption: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: colors.neutral[0],
		borderRadius: radius.md,
		padding: spacing.sm,
		marginVertical: spacing.xs,
		borderWidth: 1,
		borderColor: colors.border.light,
	},
	accountOptionSelected: {
		borderColor: colors.primary[500],
		backgroundColor: colors.primary[50],
	},
	accountOptionContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	accountIcon: {
		fontSize: 20,
	},
	accountLabel: {
		fontSize: typography.fontSize.base,
		fontWeight: typography.fontWeight.medium,
		color: colors.text.primary,
	},
});

export default SignInForm;
