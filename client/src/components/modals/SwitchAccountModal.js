import React, { useState, useEffect } from "react";
import {
	Modal,
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	ActivityIndicator,
} from "react-native";
import { TextInput } from "react-native-paper";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";
import FetchData from "../../services/fetchRequests/fetchData";

const SwitchAccountModal = ({
	visible,
	onClose,
	linkedAccounts,
	currentAccountType,
	userEmail,
	onSwitch,
}) => {
	const [password, setPassword] = useState("");
	const [selectedAccount, setSelectedAccount] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [showPassword, setShowPassword] = useState(false);

	// Reset state when modal opens
	useEffect(() => {
		if (visible) {
			setPassword("");
			setError("");
			setLoading(false);
			// Pre-select the first available account
			const otherAccounts = linkedAccounts.filter(
				(a) => a.accountType !== currentAccountType
			);
			if (otherAccounts.length > 0) {
				setSelectedAccount(otherAccounts[0].accountType);
			}
		}
	}, [visible, linkedAccounts, currentAccountType]);

	const handleSwitch = async () => {
		if (!selectedAccount || !password) {
			setError("Please select an account and enter your password");
			return;
		}

		setLoading(true);
		setError("");

		const response = await FetchData.login({
			userName: userEmail,
			password: password,
			accountType: selectedAccount,
		});

		setLoading(false);

		if (response.user) {
			onSwitch(response);
			onClose();
		} else if (response === "Invalid password") {
			setError("Incorrect password. Please try again.");
		} else if (typeof response === "string") {
			setError(response);
		} else {
			setError("Failed to switch account. Please try again.");
		}
	};

	const handleClose = () => {
		setPassword("");
		setError("");
		setSelectedAccount(null);
		onClose();
	};

	const getAccountIcon = (accountType) => {
		switch (accountType) {
			case "employee":
				return "building";
			case "marketplace_cleaner":
				return "leaf";
			case "cleaner":
				return "leaf";
			case "owner":
				return "briefcase";
			case "hr":
				return "users";
			case "homeowner":
				return "home";
			default:
				return "user";
		}
	};

	const otherAccounts = linkedAccounts.filter(
		(a) => a.accountType !== currentAccountType
	);

	if (otherAccounts.length === 0) {
		return null;
	}

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent={true}
			onRequestClose={handleClose}
		>
			<View style={styles.overlay}>
				<View style={styles.modalContainer}>
					{/* Header */}
					<View style={styles.header}>
						<View style={styles.iconContainer}>
							<Icon name="exchange" size={28} color={colors.primary[600]} />
						</View>
						<Text style={styles.headerTitle}>Switch Account</Text>
						<Text style={styles.headerSubtitle}>
							Select which account you want to switch to
						</Text>
					</View>

					{/* Content */}
					<View style={styles.content}>
						{/* Account Options */}
						<Text style={styles.sectionLabel}>Available Accounts</Text>
						{otherAccounts.map((account) => (
							<TouchableOpacity
								key={account.accountType}
								style={[
									styles.accountOption,
									selectedAccount === account.accountType &&
										styles.accountOptionSelected,
								]}
								onPress={() => setSelectedAccount(account.accountType)}
								activeOpacity={0.7}
							>
								<View style={styles.accountIconContainer}>
									<Icon
										name={getAccountIcon(account.accountType)}
										size={20}
										color={
											selectedAccount === account.accountType
												? colors.primary[600]
												: colors.text.secondary
										}
									/>
								</View>
								<View style={styles.accountInfo}>
									<Text
										style={[
											styles.accountName,
											selectedAccount === account.accountType &&
												styles.accountNameSelected,
										]}
									>
										{account.displayName}
									</Text>
									<Text style={styles.accountEmail}>{userEmail}</Text>
								</View>
								{selectedAccount === account.accountType && (
									<Icon
										name="check-circle"
										size={20}
										color={colors.primary[600]}
									/>
								)}
							</TouchableOpacity>
						))}

						{/* Password Input */}
						<Text style={styles.sectionLabel}>Enter Your Password</Text>
						<TextInput
							mode="outlined"
							label="Password"
							value={password}
							onChangeText={setPassword}
							secureTextEntry={!showPassword}
							placeholder="Enter password to confirm"
							style={styles.passwordInput}
							right={
								<TextInput.Icon
									icon={showPassword ? "eye-off" : "eye"}
									onPress={() => setShowPassword(!showPassword)}
								/>
							}
							autoCorrect={false}
							autoCapitalize="none"
							spellCheck={false}
							textContentType="oneTimeCode"
						/>

						{/* Error Message */}
						{error ? (
							<View style={styles.errorContainer}>
								<Icon name="exclamation-circle" size={14} color={colors.error[600]} />
								<Text style={styles.errorText}>{error}</Text>
							</View>
						) : null}
					</View>

					{/* Actions */}
					<View style={styles.actions}>
						<TouchableOpacity
							style={[styles.button, styles.cancelButton]}
							onPress={handleClose}
							disabled={loading}
						>
							<Text style={styles.cancelButtonText}>Cancel</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[
								styles.button,
								styles.switchButton,
								(!selectedAccount || !password || loading) &&
									styles.buttonDisabled,
							]}
							onPress={handleSwitch}
							disabled={!selectedAccount || !password || loading}
						>
							{loading ? (
								<ActivityIndicator size="small" color={colors.neutral[0]} />
							) : (
								<>
									<Icon name="exchange" size={16} color={colors.neutral[0]} />
									<Text style={styles.switchButtonText}>Switch</Text>
								</>
							)}
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: colors.glass.overlay,
		justifyContent: "center",
		alignItems: "center",
		padding: spacing.lg,
	},
	modalContainer: {
		backgroundColor: colors.neutral[0],
		borderRadius: radius["2xl"],
		width: "100%",
		maxWidth: 400,
		overflow: "hidden",
		...shadows.xl,
	},
	header: {
		backgroundColor: colors.primary[50],
		padding: spacing.xl,
		alignItems: "center",
	},
	iconContainer: {
		marginBottom: spacing.md,
	},
	headerTitle: {
		fontSize: typography.fontSize.xl,
		fontWeight: typography.fontWeight.bold,
		color: colors.text.primary,
		textAlign: "center",
	},
	headerSubtitle: {
		fontSize: typography.fontSize.sm,
		color: colors.text.secondary,
		textAlign: "center",
		marginTop: spacing.xs,
	},
	content: {
		padding: spacing.xl,
	},
	sectionLabel: {
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.semibold,
		color: colors.text.secondary,
		marginBottom: spacing.sm,
		marginTop: spacing.md,
	},
	accountOption: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.neutral[50],
		borderRadius: radius.lg,
		padding: spacing.md,
		marginBottom: spacing.sm,
		borderWidth: 2,
		borderColor: "transparent",
	},
	accountOptionSelected: {
		borderColor: colors.primary[500],
		backgroundColor: colors.primary[50],
	},
	accountIconContainer: {
		width: 40,
		height: 40,
		borderRadius: radius.full,
		backgroundColor: colors.neutral[100],
		justifyContent: "center",
		alignItems: "center",
		marginRight: spacing.md,
	},
	accountInfo: {
		flex: 1,
	},
	accountName: {
		fontSize: typography.fontSize.base,
		fontWeight: typography.fontWeight.semibold,
		color: colors.text.primary,
	},
	accountNameSelected: {
		color: colors.primary[700],
	},
	accountEmail: {
		fontSize: typography.fontSize.sm,
		color: colors.text.tertiary,
		marginTop: 2,
	},
	passwordInput: {
		backgroundColor: colors.neutral[0],
	},
	errorContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.error[50],
		padding: spacing.sm,
		borderRadius: radius.md,
		marginTop: spacing.md,
		gap: spacing.xs,
	},
	errorText: {
		fontSize: typography.fontSize.sm,
		color: colors.error[700],
		flex: 1,
	},
	actions: {
		flexDirection: "row",
		padding: spacing.lg,
		gap: spacing.md,
		borderTopWidth: 1,
		borderTopColor: colors.border.light,
	},
	button: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: spacing.md,
		borderRadius: radius.lg,
		gap: spacing.sm,
	},
	cancelButton: {
		backgroundColor: colors.neutral[100],
	},
	cancelButtonText: {
		fontSize: typography.fontSize.base,
		fontWeight: typography.fontWeight.semibold,
		color: colors.text.secondary,
	},
	switchButton: {
		backgroundColor: colors.primary[600],
	},
	switchButtonText: {
		fontSize: typography.fontSize.base,
		fontWeight: typography.fontWeight.semibold,
		color: colors.neutral[0],
	},
	buttonDisabled: {
		opacity: 0.5,
	},
});

export default SwitchAccountModal;
