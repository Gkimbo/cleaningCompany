import React, { useState, useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, Pressable, View } from "react-native";
import { TextInput } from "react-native-paper";
import Icon from "react-native-vector-icons/FontAwesome";

import Application from "../../../services/fetchRequests/ApplicationClass";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";

// Generate a strong random password
const generateStrongPassword = (length = 16) => {
	const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Removed I, O to avoid confusion
	const lowercase = "abcdefghjkmnpqrstuvwxyz"; // Removed i, l, o to avoid confusion
	const numbers = "23456789"; // Removed 0, 1 to avoid confusion
	const special = "!@#$%&*?";

	// Ensure at least one of each type
	let password = "";
	password += uppercase[Math.floor(Math.random() * uppercase.length)];
	password += uppercase[Math.floor(Math.random() * uppercase.length)];
	password += lowercase[Math.floor(Math.random() * lowercase.length)];
	password += lowercase[Math.floor(Math.random() * lowercase.length)];
	password += numbers[Math.floor(Math.random() * numbers.length)];
	password += numbers[Math.floor(Math.random() * numbers.length)];
	password += special[Math.floor(Math.random() * special.length)];
	password += special[Math.floor(Math.random() * special.length)];

	// Fill remaining length with random characters from all sets
	const allChars = uppercase + lowercase + numbers + special;
	for (let i = password.length; i < length; i++) {
		password += allChars[Math.floor(Math.random() * allChars.length)];
	}

	// Shuffle the password
	return password
		.split("")
		.sort(() => Math.random() - 0.5)
		.join("");
};

// Format phone number as 555-555-5555
const formatPhoneNumber = (text) => {
	const cleaned = text.replace(/\D/g, "");
	if (cleaned.length <= 3) return cleaned;
	if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
	return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
};

// Generate a username from first and last name that fits 4-12 character limit
const generateUsername = (first, last) => {
	const cleanFirst = (first || "").toLowerCase().replace(/[^a-z]/g, "");
	const cleanLast = (last || "").toLowerCase().replace(/[^a-z]/g, "");

	// Try: firstname + last initial (e.g., "john" + "d" = "johnd")
	let username = cleanFirst + cleanLast.charAt(0);

	// If too short, add more of the last name
	if (username.length < 4 && cleanLast.length > 1) {
		username = cleanFirst + cleanLast.substring(0, Math.min(4 - cleanFirst.length, cleanLast.length));
	}

	// If still too short, pad with numbers
	if (username.length < 4) {
		username = username + "123".substring(0, 4 - username.length);
	}

	// If too long, truncate
	if (username.length > 12) {
		username = username.substring(0, 12);
	}

	return username;
};

const CreateNewEmployeeForm = ({id, firstName: initialFirstName, lastName: initialLastName, email, phone: initialPhone, setApplicationsList, token}) => {
	const [firstNameInput, setFirstNameInput] = useState(initialFirstName || "");
	const [lastNameInput, setLastNameInput] = useState(initialLastName || "");
	const [userName, setUserName] = useState(generateUsername(initialFirstName, initialLastName));
	const [password, setPassword] = useState(generateStrongPassword());
	const [emailInput, setEmail] = useState(email);
	const [phoneInput, setPhone] = useState(initialPhone ? formatPhoneNumber(initialPhone) : "");
	const [showPassword, setShowPassword] = useState(false);
	const [errors, setErrors] = useState([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");

	// Update username when first or last name changes
	useEffect(() => {
		setUserName(generateUsername(firstNameInput, lastNameInput));
	}, [firstNameInput, lastNameInput]);

	const validate = () => {
		const validationErrors = [];

		if (!firstNameInput.trim()) {
			validationErrors.push("First name is required.");
		}

		if (!lastNameInput.trim()) {
			validationErrors.push("Last name is required.");
		}

		if (userName.length < 4 || userName.length > 12) {
			validationErrors.push("Username must be between 4 and 12 characters.");
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(emailInput)) {
			validationErrors.push("Please enter a valid email address.");
		}

		if (password.length < 6) {
			validationErrors.push("Password must be at least 6 characters.");
		}

		setErrors(validationErrors);
		return validationErrors.length === 0;
	};

	const onSubmit = async () => {
		if (!validate()) {
			return;
		}

		setIsSubmitting(true);
		setErrors([]);
		setSuccessMessage("");

		try {
			const employeeData = {
				username: userName,
				password,
				email: emailInput,
				firstName: firstNameInput,
				lastName: lastNameInput,
				phone: phoneInput || null,
			};
			const response = await Application.hireApplicant(id, employeeData, token);
			if (response.error) {
				setErrors([response.error]);
			} else {
				setSuccessMessage(`Successfully hired ${firstNameInput} ${lastNameInput}! Account created and welcome email sent.`);
				setTimeout(() => {
					setApplicationsList();
				}, 1500);
			}
		} catch (error) {
			setErrors([error.message || "Failed to hire employee. Please try again."]);
		} finally {
			setIsSubmitting(false);
		}
	};

	// Theme for react-native-paper TextInput
	const inputTheme = {
		colors: {
			primary: colors.primary[600],
			outline: colors.border.default,
			background: colors.neutral[0],
		},
		roundness: radius.lg,
	};

	return (
		<View style={styles.container}>
			{/* Success Message */}
			{successMessage !== "" && (
				<View style={styles.successContainer}>
					<Icon name="check-circle" size={18} color={colors.success[600]} />
					<Text style={styles.successText}>{successMessage}</Text>
				</View>
			)}

			{/* Error Messages */}
			{errors.length > 0 && (
				<View style={styles.errorContainer}>
					<Icon name="exclamation-circle" size={16} color={colors.error[600]} />
					<View style={styles.errorTextContainer}>
						{errors.map((error, index) => (
							<Text key={index} style={styles.errorText}>
								{error}
							</Text>
						))}
					</View>
				</View>
			)}

			{/* Name Row */}
			<View style={styles.row}>
				<View style={styles.halfWidth}>
					<TextInput
						mode="outlined"
						label="First Name"
						placeholder="First Name"
						style={styles.input}
						value={firstNameInput}
						onChangeText={setFirstNameInput}
						theme={inputTheme}
						left={<TextInput.Icon icon="account" color={colors.text.tertiary} />}
					/>
				</View>
				<View style={styles.halfWidth}>
					<TextInput
						mode="outlined"
						label="Last Name"
						placeholder="Last Name"
						style={styles.input}
						value={lastNameInput}
						onChangeText={setLastNameInput}
						theme={inputTheme}
					/>
				</View>
			</View>

			{/* Username with helper text */}
			<TextInput
				mode="outlined"
				label="Username"
				placeholder="Username (auto-generated)"
				style={styles.input}
				value={userName}
				onChangeText={setUserName}
				theme={inputTheme}
				left={<TextInput.Icon icon="at" color={colors.text.tertiary} />}
			/>
			<Text style={styles.helperText}>
				Auto-generated from name. Must be 4-12 characters.
			</Text>

			{/* Password */}
			<TextInput
				mode="outlined"
				label="Password"
				secureTextEntry={!showPassword}
				value={password}
				onChangeText={setPassword}
				placeholder="Password"
				theme={inputTheme}
				left={<TextInput.Icon icon="lock" color={colors.text.tertiary} />}
				right={
					<TextInput.Icon
						icon={showPassword ? "eye-off" : "eye"}
						onPress={() => setShowPassword(!showPassword)}
						color={colors.text.tertiary}
					/>
				}
				style={styles.input}
			/>
			<View style={styles.passwordHelperRow}>
				<Text style={styles.passwordHelperText}>
					Strong password (auto-generated)
				</Text>
				<Pressable onPress={() => setPassword(generateStrongPassword())} style={styles.regenerateButton}>
					<Icon name="refresh" size={14} color={colors.primary[600]} />
				</Pressable>
			</View>

			{/* Email */}
			<TextInput
				mode="outlined"
				label="Email"
				placeholder="Email"
				style={styles.input}
				value={emailInput}
				onChangeText={setEmail}
				keyboardType="email-address"
				autoCapitalize="none"
				theme={inputTheme}
				left={<TextInput.Icon icon="email" color={colors.text.tertiary} />}
			/>

			{/* Phone */}
			<TextInput
				mode="outlined"
				label="Phone Number"
				placeholder="555-555-5555 (optional)"
				style={styles.input}
				value={phoneInput}
				onChangeText={(text) => setPhone(formatPhoneNumber(text))}
				keyboardType="phone-pad"
				maxLength={12}
				theme={inputTheme}
				left={<TextInput.Icon icon="phone" color={colors.text.tertiary} />}
			/>

			{/* Submit Button */}
			<Pressable
				onPress={onSubmit}
				disabled={isSubmitting}
				style={({ pressed }) => [
					styles.submitButton,
					pressed && styles.submitButtonPressed,
					isSubmitting && styles.submitButtonDisabled,
				]}
			>
				{isSubmitting ? (
					<ActivityIndicator size="small" color={colors.neutral[0]} />
				) : (
					<>
						<Icon name="user-plus" size={18} color={colors.neutral[0]} />
						<Text style={styles.submitButtonText}>Create Employee Account</Text>
					</>
				)}
			</Pressable>

			{/* Info text */}
			<View style={styles.infoContainer}>
				<Icon name="info-circle" size={14} color={colors.text.tertiary} />
				<Text style={styles.infoText}>
					A welcome email with login credentials will be sent to the employee.
				</Text>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		backgroundColor: colors.neutral[0],
		borderRadius: radius.xl,
		padding: spacing.lg,
	},
	row: {
		flexDirection: "row",
		gap: spacing.md,
	},
	halfWidth: {
		flex: 1,
	},
	input: {
		backgroundColor: colors.neutral[0],
		marginBottom: spacing.sm,
	},
	helperText: {
		fontSize: typography.fontSize.xs,
		color: colors.text.tertiary,
		marginBottom: spacing.md,
		marginLeft: spacing.xs,
	},
	passwordHelperRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: spacing.lg,
		paddingHorizontal: spacing.sm,
	},
	passwordHelperText: {
		fontSize: typography.fontSize.xs,
		color: colors.text.tertiary,
	},
	regenerateButton: {
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.primary[50],
		width: 32,
		height: 32,
		borderRadius: radius.full,
		borderWidth: 1,
		borderColor: colors.primary[200],
	},
	errorContainer: {
		flexDirection: "row",
		alignItems: "flex-start",
		backgroundColor: colors.error[50],
		borderWidth: 1,
		borderColor: colors.error[200],
		borderRadius: radius.lg,
		padding: spacing.md,
		marginBottom: spacing.lg,
		gap: spacing.sm,
	},
	errorTextContainer: {
		flex: 1,
	},
	errorText: {
		color: colors.error[700],
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.medium,
	},
	successContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.success[50],
		borderWidth: 1,
		borderColor: colors.success[200],
		borderRadius: radius.lg,
		padding: spacing.md,
		marginBottom: spacing.lg,
		gap: spacing.sm,
	},
	successText: {
		color: colors.success[700],
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.semibold,
		flex: 1,
	},
	submitButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.success[600],
		paddingVertical: spacing.lg,
		paddingHorizontal: spacing.xl,
		borderRadius: radius.lg,
		marginTop: spacing.lg,
		gap: spacing.sm,
		...shadows.md,
	},
	submitButtonPressed: {
		backgroundColor: colors.success[700],
		transform: [{ scale: 0.98 }],
	},
	submitButtonDisabled: {
		backgroundColor: colors.neutral[400],
	},
	submitButtonText: {
		color: colors.neutral[0],
		fontSize: typography.fontSize.base,
		fontWeight: typography.fontWeight.bold,
	},
	infoContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		marginTop: spacing.lg,
		paddingTop: spacing.md,
		borderTopWidth: 1,
		borderTopColor: colors.border.light,
	},
	infoText: {
		flex: 1,
		fontSize: typography.fontSize.xs,
		color: colors.text.tertiary,
		fontStyle: "italic",
	},
});

export default CreateNewEmployeeForm;