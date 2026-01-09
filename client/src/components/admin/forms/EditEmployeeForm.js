import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TextInput } from "react-native-paper";
import { useNavigate, useParams } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";

import FetchData from "../../../services/fetchRequests/fetchData";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";

const EditEmployeeForm = ({ setEmployeeList, employeeList }) => {
	const { id } = useParams();
	const navigate = useNavigate();
	const type = "cleaner";

	const [employee, setEmployee] = useState({
		id: id,
		firstName: "",
		lastName: "",
		username: "",
		email: "",
		phone: "",
		password: "",
	});
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [errors, setErrors] = useState([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");

	// Theme for react-native-paper TextInput
	const inputTheme = {
		colors: {
			primary: colors.primary[600],
			outline: colors.border.default,
			background: colors.neutral[0],
		},
		roundness: radius.lg,
	};

	// Validate user input before submitting
	const validate = () => {
		const validationErrors = [];

		if (!employee.firstName.trim()) {
			validationErrors.push("First name is required.");
		}

		if (!employee.lastName.trim()) {
			validationErrors.push("Last name is required.");
		}

		if (employee.username.trim().length < 4 || employee.username.trim().length > 12) {
			validationErrors.push("Username must be between 4 and 12 characters.");
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(employee.email.trim())) {
			validationErrors.push("Please enter a valid email address.");
		}

		// Password is optional for editing, but if provided must be at least 6 chars
		if (employee.password && employee.password.length > 0 && employee.password.length < 6) {
			validationErrors.push("Password must be at least 6 characters.");
		}

		// If password is provided, confirm password must match
		if (employee.password && employee.password.length > 0 && employee.password !== confirmPassword) {
			validationErrors.push("Passwords do not match.");
		}

		setErrors(validationErrors);
		return validationErrors.length === 0;
	};

	// Submit handler
	const onSubmit = async () => {
		if (!validate()) return;

		setIsSubmitting(true);
		setErrors([]);
		setSuccessMessage("");

		const data = {
			id,
			userName: employee.username,
			password: employee.password,
			email: employee.email,
			type,
			firstName: employee.firstName,
			lastName: employee.lastName,
			phone: employee.phone || null,
		};

		try {
			const response = await FetchData.editEmployee(data);

			if (
				response === "An account already has this email" ||
				response === "Username already exists"
			) {
				setErrors([response]);
			} else if (response && response.user) {
				const updatedEmployeeList = employeeList
					? employeeList.filter((existingEmployee) => existingEmployee.id !== Number(id))
					: [];
				updatedEmployeeList.push(response.user);
				setEmployeeList(updatedEmployeeList);
				setSuccessMessage(`Successfully updated ${employee.firstName} ${employee.lastName}!`);

				// Navigate back after a short delay
				setTimeout(() => {
					navigate("/employees");
				}, 1500);
			}
		} catch (err) {
			console.error("Edit employee failed:", err);
			setErrors(["An unexpected error occurred. Please try again."]);
		} finally {
			setIsSubmitting(false);
		}
	};

	// Load employee info safely
	useEffect(() => {
		if (!employeeList || employeeList.length === 0) return;

		const idNeeded = Number(id);
		const foundEmployee = employeeList.find(
			(emp) => Number(emp.id) === idNeeded
		);

		if (foundEmployee) {
			setEmployee({
				id: foundEmployee.id,
				firstName: foundEmployee.firstName || "",
				lastName: foundEmployee.lastName || "",
				username: foundEmployee.username || "",
				email: foundEmployee.email || "",
				phone: foundEmployee.phone || "",
				password: "",
			});
		}
	}, [id, employeeList]);

	// Handle when no employee found yet
	if (!employee || !employee.username) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" color={colors.primary[600]} />
				<Text style={styles.loadingText}>Loading employee data...</Text>
			</View>
		);
	}

	return (
		<ScrollView contentContainerStyle={styles.scrollContent}>
			<View style={styles.container}>
				{/* Header */}
				<View style={styles.header}>
					<Pressable onPress={() => navigate("/employees")} style={styles.backButton}>
						<Icon name="arrow-left" size={16} color={colors.primary[600]} />
					</Pressable>
					<Text style={styles.title}>Edit Employee</Text>
				</View>

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
							value={employee.firstName}
							onChangeText={(text) => setEmployee({ ...employee, firstName: text })}
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
							value={employee.lastName}
							onChangeText={(text) => setEmployee({ ...employee, lastName: text })}
							theme={inputTheme}
						/>
					</View>
				</View>

				{/* Username */}
				<TextInput
					mode="outlined"
					label="Username"
					placeholder="Username"
					style={styles.input}
					value={employee.username}
					onChangeText={(text) => setEmployee({ ...employee, username: text })}
					theme={inputTheme}
					left={<TextInput.Icon icon="at" color={colors.text.tertiary} />}
				/>
				<Text style={styles.helperText}>
					Must be 4-12 characters.
				</Text>

				{/* Password */}
				<TextInput
					mode="outlined"
					label="New Password"
					secureTextEntry={!showPassword}
					value={employee.password}
					onChangeText={(text) => setEmployee({ ...employee, password: text })}
					placeholder="Leave blank to keep current password"
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
					autoCorrect={false}
					autoCapitalize="none"
					spellCheck={false}
					textContentType="oneTimeCode"
				/>
				<Text style={styles.helperText}>
					Leave blank to keep current password. New password must be at least 6 characters.
				</Text>

				{/* Confirm Password - only show when password is being changed */}
				{employee.password.length > 0 && (
					<>
						<TextInput
							mode="outlined"
							label="Confirm Password"
							secureTextEntry={!showConfirmPassword}
							value={confirmPassword}
							onChangeText={setConfirmPassword}
							placeholder="Re-enter new password"
							theme={inputTheme}
							left={<TextInput.Icon icon="lock-check" color={colors.text.tertiary} />}
							right={
								<TextInput.Icon
									icon={showConfirmPassword ? "eye-off" : "eye"}
									onPress={() => setShowConfirmPassword(!showConfirmPassword)}
									color={colors.text.tertiary}
								/>
							}
							style={styles.input}
							autoCorrect={false}
							autoCapitalize="none"
							spellCheck={false}
							textContentType="oneTimeCode"
						/>
						<Text style={styles.helperText}>
							Please confirm your new password.
						</Text>
					</>
				)}

				{/* Email */}
				<TextInput
					mode="outlined"
					label="Email"
					placeholder="Email"
					style={styles.input}
					value={employee.email}
					onChangeText={(text) => setEmployee({ ...employee, email: text })}
					keyboardType="email-address"
					autoCapitalize="none"
					theme={inputTheme}
					left={<TextInput.Icon icon="email" color={colors.text.tertiary} />}
				/>

				{/* Phone */}
				<TextInput
					mode="outlined"
					label="Phone Number"
					placeholder="Phone Number (optional)"
					style={styles.input}
					value={employee.phone}
					onChangeText={(text) => setEmployee({ ...employee, phone: text })}
					keyboardType="phone-pad"
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
							<Icon name="save" size={18} color={colors.neutral[0]} />
							<Text style={styles.submitButtonText}>Save Changes</Text>
						</>
					)}
				</Pressable>

				{/* Info text */}
				<View style={styles.infoContainer}>
					<Icon name="info-circle" size={14} color={colors.text.tertiary} />
					<Text style={styles.infoText}>
						Changes will take effect immediately. The employee may need to log out and log back in to see updated information.
					</Text>
				</View>
			</View>
		</ScrollView>
	);
};

const styles = StyleSheet.create({
	scrollContent: {
		flexGrow: 1,
		padding: spacing.lg,
	},
	container: {
		backgroundColor: colors.neutral[0],
		borderRadius: radius.xl,
		padding: spacing.lg,
		...shadows.md,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: spacing.xl,
	},
	loadingText: {
		marginTop: spacing.md,
		color: colors.text.secondary,
		fontSize: typography.fontSize.base,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: spacing.xl,
		gap: spacing.md,
	},
	backButton: {
		width: 40,
		height: 40,
		borderRadius: radius.full,
		backgroundColor: colors.primary[50],
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: colors.primary[200],
	},
	title: {
		fontSize: typography.fontSize.xl,
		fontWeight: typography.fontWeight.bold,
		color: colors.text.primary,
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
		backgroundColor: colors.primary[600],
		paddingVertical: spacing.lg,
		paddingHorizontal: spacing.xl,
		borderRadius: radius.lg,
		marginTop: spacing.lg,
		gap: spacing.sm,
		...shadows.md,
	},
	submitButtonPressed: {
		backgroundColor: colors.primary[700],
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

export default EditEmployeeForm;
