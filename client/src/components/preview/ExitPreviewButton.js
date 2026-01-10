/**
 * ExitPreviewButton
 *
 * Floating button displayed when owner is in preview mode.
 * Shows the current preview role and allows exiting back to owner mode.
 * Uses PreviewContext to get current state and control exit.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
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
	employee: "user",
};

// Role label mapping
const ROLE_LABELS = {
	cleaner: "Cleaner",
	homeowner: "Homeowner",
	businessOwner: "Business Owner",
	employee: "Employee",
};

// Role color mapping
const ROLE_COLORS = {
	cleaner: colors.primary[600],
	homeowner: colors.success[600],
	businessOwner: colors.secondary[600],
	employee: colors.warning[600],
};

const ExitPreviewButton = () => {
	const { isPreviewMode, previewRole, exitPreviewMode, isLoading } = usePreview();

	if (!isPreviewMode) return null;

	const roleIcon = ROLE_ICONS[previewRole] || "user";
	const roleLabel = ROLE_LABELS[previewRole] || "Unknown";
	const roleColor = ROLE_COLORS[previewRole] || colors.primary[600];

	return (
		<View style={styles.container}>
			{/* Role Badge */}
			<View style={[styles.roleBadge, { backgroundColor: roleColor + "15" }]}>
				<Icon name={roleIcon} size={14} color={roleColor} />
				<Text style={[styles.roleBadgeText, { color: roleColor }]}>
					Viewing as {roleLabel}
				</Text>
			</View>

			{/* Exit Button */}
			<Pressable
				style={({ pressed }) => [
					styles.exitButton,
					pressed && styles.exitButtonPressed,
				]}
				onPress={exitPreviewMode}
				disabled={isLoading}
			>
				{isLoading ? (
					<ActivityIndicator size="small" color={colors.white} />
				) : (
					<>
						<Icon name="sign-out" size={16} color={colors.white} />
						<Text style={styles.exitButtonText}>Exit Preview</Text>
					</>
				)}
			</Pressable>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		position: "absolute",
		bottom: spacing.xl,
		right: spacing.lg,
		alignItems: "flex-end",
		zIndex: 9999,
	},
	roleBadge: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: radius.full,
		marginBottom: spacing.sm,
		...shadows.md,
	},
	roleBadgeText: {
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.medium,
		marginLeft: spacing.sm,
	},
	exitButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.error[600],
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderRadius: radius.full,
		...shadows.lg,
	},
	exitButtonPressed: {
		backgroundColor: colors.error[700],
		transform: [{ scale: 0.98 }],
	},
	exitButtonText: {
		color: colors.white,
		fontSize: typography.fontSize.base,
		fontWeight: typography.fontWeight.semibold,
		marginLeft: spacing.sm,
	},
});

export default ExitPreviewButton;
