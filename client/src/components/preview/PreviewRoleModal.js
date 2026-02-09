/**
 * PreviewRoleModal
 *
 * Modal for selecting which role to preview.
 * Displays role cards with icons and descriptions.
 */

import React, { useState } from "react";
import {
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
	ActivityIndicator,
	ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
	colors,
	spacing,
	radius,
	typography,
	shadows,
} from "../../services/styles/theme";

// Available roles with their configuration
const PREVIEW_ROLES = [
	{
		role: "cleaner",
		label: "Cleaner",
		description: "See the marketplace, jobs, and earnings",
		icon: "magic",
		color: colors.primary[600],
	},
	{
		role: "homeowner",
		label: "Homeowner",
		description: "See booking, homes, and bills",
		icon: "home",
		color: colors.success[600],
	},
	{
		role: "businessOwner",
		label: "Business Owner",
		description: "See employees, clients, and analytics",
		icon: "briefcase",
		color: colors.secondary[600],
	},
	{
		role: "employee",
		label: "Employee",
		description: "See assigned jobs and schedule",
		icon: "user",
		color: colors.warning[600],
	},
	{
		role: "humanResources",
		label: "HR Manager",
		description: "See conflict resolution and appeals",
		icon: "gavel",
		color: colors.error[400],
	},
	{
		role: "largeBusinessOwner",
		label: "Elite Partner",
		description: "Business with 70+ monthly cleanings",
		icon: "building",
		color: colors.primary[500],
	},
	{
		role: "preferredCleaner",
		label: "Preferred Cleaner",
		description: "Cleaner with platinum tier perks",
		icon: "star",
		color: colors.warning[400],
	},
	{
		role: "largeHomeOwner",
		label: "Large Home Owner",
		description: "Homeowner with large home for team jobs",
		icon: "home",
		color: colors.success[400],
	},
];

const RoleCard = ({ role, isSelected, onSelect, disabled }) => {
	return (
		<Pressable
			style={({ pressed }) => [
				styles.roleCard,
				isSelected && styles.roleCardSelected,
				pressed && styles.roleCardPressed,
				disabled && styles.roleCardDisabled,
			]}
			onPress={() => onSelect(role.role)}
			disabled={disabled}
		>
			<View style={[styles.roleIcon, { backgroundColor: role.color + "15" }]}>
				<Icon name={role.icon} size={24} color={role.color} />
			</View>
			<View style={styles.roleInfo}>
				<Text style={styles.roleLabel}>{role.label}</Text>
				<Text style={styles.roleDescription}>{role.description}</Text>
			</View>
			{isSelected && (
				<View style={styles.checkmark}>
					<Icon name="check-circle" size={20} color={colors.success[600]} />
				</View>
			)}
		</Pressable>
	);
};

const PreviewRoleModal = ({
	visible,
	onClose,
	onSelectRole,
	isLoading = false,
	error = null,
}) => {
	const [selectedRole, setSelectedRole] = useState(null);

	const handleClose = () => {
		setSelectedRole(null);
		onClose();
	};

	const handleConfirm = () => {
		if (selectedRole) {
			onSelectRole(selectedRole);
		}
	};

	const handleRoleSelect = (role) => {
		setSelectedRole(role);
	};

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent={true}
			onRequestClose={handleClose}
		>
			<View style={styles.overlay}>
				<View style={styles.modalContent}>
					{/* Header */}
					<View style={styles.header}>
						<View style={styles.headerTitleRow}>
							<Icon name="eye" size={20} color={colors.primary[600]} />
							<Text style={styles.headerTitle}>Preview as Role</Text>
						</View>
						<Pressable
							style={styles.closeButton}
							onPress={handleClose}
							disabled={isLoading}
						>
							<Icon name="times" size={20} color={colors.text.secondary} />
						</Pressable>
					</View>

					{/* Description */}
					<Text style={styles.description}>
						Preview the app as a different user type. You'll be able to perform
						real actions on demo data.
					</Text>

					{/* Warning */}
					<View style={styles.warningBanner}>
						<Icon name="info-circle" size={16} color={colors.primary[600]} />
						<Text style={styles.warningText}>
							All actions during preview affect demo accounts only. Your owner
							data remains unchanged.
						</Text>
					</View>

					{/* Role Cards */}
					<ScrollView style={styles.rolesList} showsVerticalScrollIndicator={false}>
						{PREVIEW_ROLES.map((role) => (
							<RoleCard
								key={role.role}
								role={role}
								isSelected={selectedRole === role.role}
								onSelect={handleRoleSelect}
								disabled={isLoading}
							/>
						))}
					</ScrollView>

					{/* Error Message */}
					{error && (
						<View style={styles.errorBanner}>
							<Icon name="exclamation-circle" size={16} color={colors.error[600]} />
							<Text style={styles.errorText}>{error}</Text>
						</View>
					)}

					{/* Actions */}
					<View style={styles.actions}>
						<Pressable
							style={styles.cancelButton}
							onPress={handleClose}
							disabled={isLoading}
						>
							<Text style={styles.cancelButtonText}>Cancel</Text>
						</Pressable>
						<Pressable
							style={[
								styles.confirmButton,
								!selectedRole && styles.confirmButtonDisabled,
							]}
							onPress={handleConfirm}
							disabled={!selectedRole || isLoading}
						>
							{isLoading ? (
								<ActivityIndicator size="small" color={colors.white} />
							) : (
								<>
									<Icon name="play" size={14} color={colors.white} />
									<Text style={styles.confirmButtonText}>Start Preview</Text>
								</>
							)}
						</Pressable>
					</View>
				</View>
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "flex-end",
	},
	modalContent: {
		backgroundColor: colors.background.primary,
		borderTopLeftRadius: radius["2xl"],
		borderTopRightRadius: radius["2xl"],
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.lg,
		paddingBottom: spacing["2xl"],
		maxHeight: "85%",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: spacing.md,
	},
	headerTitleRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	headerTitle: {
		fontSize: typography.fontSize.xl,
		fontWeight: typography.fontWeight.bold,
		color: colors.text.primary,
		marginLeft: spacing.sm,
	},
	closeButton: {
		width: 40,
		height: 40,
		borderRadius: radius.full,
		backgroundColor: colors.neutral[100],
		justifyContent: "center",
		alignItems: "center",
	},
	description: {
		fontSize: typography.fontSize.base,
		color: colors.text.secondary,
		marginBottom: spacing.md,
		lineHeight: 22,
	},
	warningBanner: {
		flexDirection: "row",
		alignItems: "flex-start",
		backgroundColor: colors.primary[50],
		padding: spacing.md,
		borderRadius: radius.lg,
		marginBottom: spacing.lg,
	},
	warningText: {
		flex: 1,
		fontSize: typography.fontSize.sm,
		color: colors.primary[700],
		marginLeft: spacing.sm,
		lineHeight: 20,
	},
	rolesList: {
		maxHeight: 400,
	},
	roleCard: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.background.primary,
		borderWidth: 2,
		borderColor: colors.neutral[200],
		borderRadius: radius.xl,
		padding: spacing.md,
		marginBottom: spacing.md,
	},
	roleCardSelected: {
		borderColor: colors.primary[500],
		backgroundColor: colors.primary[50],
	},
	roleCardPressed: {
		opacity: 0.8,
	},
	roleCardDisabled: {
		opacity: 0.5,
	},
	roleIcon: {
		width: 48,
		height: 48,
		borderRadius: radius.lg,
		justifyContent: "center",
		alignItems: "center",
	},
	roleInfo: {
		flex: 1,
		marginLeft: spacing.md,
	},
	roleLabel: {
		fontSize: typography.fontSize.lg,
		fontWeight: typography.fontWeight.semibold,
		color: colors.text.primary,
	},
	roleDescription: {
		fontSize: typography.fontSize.sm,
		color: colors.text.secondary,
		marginTop: 2,
	},
	checkmark: {
		marginLeft: spacing.sm,
	},
	errorBanner: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.error[50],
		padding: spacing.md,
		borderRadius: radius.lg,
		marginTop: spacing.md,
	},
	errorText: {
		flex: 1,
		fontSize: typography.fontSize.sm,
		color: colors.error[700],
		marginLeft: spacing.sm,
	},
	actions: {
		flexDirection: "row",
		marginTop: spacing.lg,
		gap: spacing.md,
	},
	cancelButton: {
		flex: 1,
		paddingVertical: spacing.md,
		borderRadius: radius.lg,
		backgroundColor: colors.neutral[100],
		alignItems: "center",
	},
	cancelButtonText: {
		fontSize: typography.fontSize.base,
		fontWeight: typography.fontWeight.semibold,
		color: colors.text.secondary,
	},
	confirmButton: {
		flex: 2,
		flexDirection: "row",
		paddingVertical: spacing.md,
		borderRadius: radius.lg,
		backgroundColor: colors.primary[600],
		alignItems: "center",
		justifyContent: "center",
	},
	confirmButtonDisabled: {
		backgroundColor: colors.neutral[300],
	},
	confirmButtonText: {
		fontSize: typography.fontSize.base,
		fontWeight: typography.fontWeight.semibold,
		color: colors.white,
		marginLeft: spacing.sm,
	},
});

export default PreviewRoleModal;
