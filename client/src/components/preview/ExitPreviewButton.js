/**
 * ExitPreviewButton
 *
 * Floating button displayed when owner is in preview mode.
 * Shows the current preview role, allows switching between roles,
 * resetting demo data, and exiting back to owner mode.
 * Uses PreviewContext to get current state and control actions.
 */

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator, Alert, Modal, ScrollView, TouchableOpacity, TouchableWithoutFeedback } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
	colors,
	spacing,
	radius,
	typography,
	shadows,
} from "../../services/styles/theme";
import { usePreview } from "../../context/PreviewContext";

// Role icon mapping
const ROLE_ICONS = {
	cleaner: "magic",
	homeowner: "home",
	businessOwner: "briefcase",
	businessClient: "user-circle",
	employee: "user",
	humanResources: "gavel",
	largeBusinessOwner: "building",
	preferredCleaner: "star",
	largeHomeOwner: "home",
	it: "headphones",
};

// Role label mapping
const ROLE_LABELS = {
	cleaner: "Cleaner",
	homeowner: "Homeowner",
	businessOwner: "Business Owner",
	businessClient: "Business Client",
	employee: "Employee",
	humanResources: "HR Manager",
	largeBusinessOwner: "Elite Partner",
	preferredCleaner: "Preferred Cleaner",
	largeHomeOwner: "Large Home Owner",
	it: "IT Support",
};

// Role color mapping
const ROLE_COLORS = {
	cleaner: colors.primary[600],
	homeowner: colors.success[600],
	businessOwner: colors.secondary[600],
	businessClient: colors.success[500],
	employee: colors.warning[600],
	humanResources: colors.error[400],
	largeBusinessOwner: colors.primary[500],
	preferredCleaner: colors.warning[400],
	largeHomeOwner: colors.success[400],
	it: colors.primary[400],
};

// All available roles for switching
const ALL_ROLES = [
	"cleaner",
	"homeowner",
	"businessOwner",
	"businessClient",
	"employee",
	"humanResources",
	"largeBusinessOwner",
	"preferredCleaner",
	"largeHomeOwner",
	"it",
];

const ExitPreviewButton = () => {
	const navigate = useNavigate();
	const {
		isPreviewMode,
		previewRole,
		exitPreviewMode,
		switchPreviewRole,
		resetDemoData,
		isLoading,
		isResetting,
		isSwitching
	} = usePreview();
	const [showResetSuccess, setShowResetSuccess] = useState(false);
	const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

	if (!isPreviewMode) return null;

	const handleExit = async () => {
		const result = await exitPreviewMode();
		if (result.success) {
			navigate("/");
		}
	};

	const roleIcon = ROLE_ICONS[previewRole] || "user";
	const roleLabel = ROLE_LABELS[previewRole] || "Unknown";
	const roleColor = ROLE_COLORS[previewRole] || colors.primary[600];

	const handleResetDemoData = async () => {
		Alert.alert(
			"Reset Demo Data",
			"This will restore all demo accounts to their original state. Any changes made during this preview session will be reset.\n\nContinue?",
			[
				{
					text: "Cancel",
					style: "cancel",
				},
				{
					text: "Reset",
					style: "destructive",
					onPress: async () => {
						const result = await resetDemoData();
						if (result.success) {
							setShowResetSuccess(true);
							setTimeout(() => setShowResetSuccess(false), 3000);
							navigate("/");
							Alert.alert(
								"Demo Data Reset",
								`Successfully reset demo data.\n\nDeleted: ${result.deleted} records\nCreated: ${result.created} records`,
								[{ text: "OK" }]
							);
						} else {
							Alert.alert(
								"Reset Failed",
								result.error || "Failed to reset demo data. Please try again.",
								[{ text: "OK" }]
							);
						}
					},
				},
			]
		);
	};

	const handleSwitchRole = async (newRole) => {
		if (newRole === previewRole) {
			setShowRoleSwitcher(false);
			return;
		}

		const result = await switchPreviewRole(newRole);
		setShowRoleSwitcher(false);

		if (!result.success) {
			Alert.alert(
				"Switch Failed",
				result.error || "Failed to switch role. Please try again.",
				[{ text: "OK" }]
			);
		}
	};

	const isActionDisabled = isLoading || isResetting || isSwitching;

	return (
		<View style={styles.container}>
			{/* Main Preview Bar */}
			<View style={styles.previewBar}>
				{/* Role Badge - Clickable to open role switcher */}
				<Pressable
					style={({ pressed }) => [
						styles.roleBadge,
						pressed && styles.roleBadgePressed,
					]}
					onPress={() => setShowRoleSwitcher(true)}
					disabled={isActionDisabled}
				>
					{isSwitching ? (
						<ActivityIndicator size="small" color={colors.neutral[0]} />
					) : (
						<Icon name={roleIcon} size={14} color={colors.neutral[0]} />
					)}
					<Text style={styles.roleBadgeText}>
						{isSwitching ? "Switching..." : roleLabel}
					</Text>
					<Icon name="chevron-down" size={10} color={colors.neutral[300]} style={styles.chevronIcon} />
				</Pressable>

				{/* Divider */}
				<View style={styles.divider} />

				{/* Reset Button */}
				<Pressable
					style={({ pressed }) => [
						styles.actionButton,
						pressed && styles.actionButtonPressed,
					]}
					onPress={handleResetDemoData}
					disabled={isActionDisabled}
				>
					{isResetting ? (
						<ActivityIndicator size="small" color={colors.neutral[0]} />
					) : (
						<Icon name="refresh" size={14} color={colors.neutral[0]} />
					)}
				</Pressable>

				{/* Exit Button */}
				<Pressable
					style={({ pressed }) => [
						styles.exitButton,
						pressed && styles.exitButtonPressed,
					]}
					onPress={handleExit}
					disabled={isActionDisabled}
				>
					{isLoading ? (
						<ActivityIndicator size="small" color={colors.neutral[0]} />
					) : (
						<>
							<Icon name="sign-out" size={14} color={colors.neutral[0]} />
							<Text style={styles.exitButtonText}>Exit Preview</Text>
						</>
					)}
				</Pressable>
			</View>

			{/* Success Badge */}
			{showResetSuccess && (
				<View style={styles.successBadge}>
					<Icon name="check-circle" size={14} color={colors.success[600]} />
					<Text style={styles.successBadgeText}>Demo data reset!</Text>
				</View>
			)}

			{/* Role Switcher Modal */}
			<Modal
				visible={showRoleSwitcher}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setShowRoleSwitcher(false)}
			>
				<TouchableWithoutFeedback onPress={() => setShowRoleSwitcher(false)}>
					<View style={styles.modalOverlay}>
						<TouchableWithoutFeedback>
							<View style={styles.modalContent}>
								<View style={styles.modalHeader}>
									<Text style={styles.modalTitle}>Switch Preview Role</Text>
									<TouchableOpacity
										onPress={() => setShowRoleSwitcher(false)}
										style={styles.modalCloseButton}
									>
										<Icon name="times" size={20} color={colors.neutral[500]} />
									</TouchableOpacity>
								</View>
								<ScrollView style={styles.roleList}>
									{ALL_ROLES.map((role) => {
										const isCurrentRole = role === previewRole;
										const roleItemColor = ROLE_COLORS[role] || colors.primary[600];
										return (
											<TouchableOpacity
												key={role}
												style={[
													styles.roleItem,
													isCurrentRole && styles.roleItemActive,
													{ borderLeftColor: roleItemColor },
												]}
												onPress={() => handleSwitchRole(role)}
												disabled={isSwitching}
											>
												<View style={[styles.roleItemIcon, { backgroundColor: roleItemColor + "15" }]}>
													<Icon
														name={ROLE_ICONS[role]}
														size={16}
														color={roleItemColor}
													/>
												</View>
												<View style={styles.roleItemContent}>
													<Text style={[
														styles.roleItemLabel,
														isCurrentRole && styles.roleItemLabelActive,
													]}>
														{ROLE_LABELS[role]}
													</Text>
													{isCurrentRole && (
														<Text style={styles.roleItemCurrent}>Current</Text>
													)}
												</View>
												{isCurrentRole && (
													<Icon name="check" size={16} color={colors.success[600]} />
												)}
											</TouchableOpacity>
										);
									})}
								</ScrollView>
							</View>
						</TouchableWithoutFeedback>
					</View>
				</TouchableWithoutFeedback>
			</Modal>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		position: "absolute",
		bottom: spacing.xl,
		left: spacing.lg,
		right: spacing.lg,
		alignItems: "center",
		zIndex: 9999,
	},
	previewBar: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.neutral[800],
		borderRadius: radius.full,
		paddingLeft: spacing.sm,
		paddingRight: spacing.xs,
		paddingVertical: spacing.xs,
		...shadows.lg,
		borderWidth: 1,
		borderColor: colors.neutral[700],
	},
	roleBadge: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: radius.full,
		backgroundColor: colors.neutral[700],
	},
	roleBadgePressed: {
		backgroundColor: colors.neutral[600],
	},
	roleBadgeText: {
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.semibold,
		marginLeft: spacing.sm,
		color: colors.neutral[0],
	},
	chevronIcon: {
		marginLeft: spacing.sm,
	},
	divider: {
		width: 1,
		height: 24,
		backgroundColor: colors.neutral[600],
		marginHorizontal: spacing.sm,
	},
	actionButton: {
		width: 36,
		height: 36,
		borderRadius: radius.full,
		backgroundColor: colors.neutral[700],
		alignItems: "center",
		justifyContent: "center",
		marginRight: spacing.xs,
	},
	actionButtonPressed: {
		backgroundColor: colors.neutral[600],
	},
	exitButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.error[600],
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: radius.full,
	},
	exitButtonPressed: {
		backgroundColor: colors.error[700],
	},
	exitButtonText: {
		color: colors.neutral[0],
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.semibold,
		marginLeft: spacing.sm,
	},
	successBadge: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.success[100],
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: radius.full,
		marginTop: spacing.sm,
		...shadows.sm,
	},
	successBadgeText: {
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.medium,
		marginLeft: spacing.sm,
		color: colors.success[700],
	},
	// Modal styles
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	modalContent: {
		backgroundColor: colors.neutral[0],
		borderRadius: radius.lg,
		width: "85%",
		maxWidth: 400,
		maxHeight: "70%",
		...shadows.xl,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: colors.neutral[200],
	},
	modalTitle: {
		fontSize: typography.fontSize.lg,
		fontWeight: typography.fontWeight.semibold,
		color: colors.neutral[900],
	},
	modalCloseButton: {
		padding: spacing.xs,
	},
	roleList: {
		paddingVertical: spacing.sm,
	},
	roleItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: spacing.md,
		paddingHorizontal: spacing.lg,
		borderLeftWidth: 3,
		borderLeftColor: "transparent",
	},
	roleItemActive: {
		backgroundColor: colors.neutral[50],
	},
	roleItemIcon: {
		width: 36,
		height: 36,
		borderRadius: radius.full,
		justifyContent: "center",
		alignItems: "center",
		marginRight: spacing.md,
	},
	roleItemContent: {
		flex: 1,
	},
	roleItemLabel: {
		fontSize: typography.fontSize.base,
		fontWeight: typography.fontWeight.medium,
		color: colors.neutral[800],
	},
	roleItemLabelActive: {
		fontWeight: typography.fontWeight.semibold,
	},
	roleItemCurrent: {
		fontSize: typography.fontSize.xs,
		color: colors.success[600],
		marginTop: 2,
	},
});

export default ExitPreviewButton;
