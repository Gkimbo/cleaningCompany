import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	Modal,
	Pressable,
	TextInput,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

const QUICK_AMOUNTS = [2500, 5000, 10000, 20000]; // In cents

const GiveBonusModal = ({
	visible,
	onClose,
	employee,
	onSubmit,
}) => {
	const [amount, setAmount] = useState("");
	const [reason, setReason] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	// Reset form when modal opens
	useEffect(() => {
		if (visible) {
			setAmount("");
			setReason("");
			setError(null);
		}
	}, [visible]);

	const handleAmountChange = (text) => {
		// Only allow numbers and decimal point
		const cleaned = text.replace(/[^0-9.]/g, "");
		// Prevent multiple decimal points
		const parts = cleaned.split(".");
		if (parts.length > 2) return;
		// Limit to 2 decimal places
		if (parts[1] && parts[1].length > 2) return;
		setAmount(cleaned);
	};

	const handleQuickAmount = (cents) => {
		setAmount((cents / 100).toFixed(2));
	};

	const getAmountInCents = () => {
		const parsed = parseFloat(amount);
		if (isNaN(parsed) || parsed <= 0) return 0;
		return Math.round(parsed * 100);
	};

	const handleSubmit = async () => {
		const amountInCents = getAmountInCents();

		if (amountInCents <= 0) {
			setError("Please enter a valid amount");
			return;
		}

		setLoading(true);
		setError(null);

		try {
			await onSubmit({
				employeeId: employee.employeeId,
				amount: amountInCents,
				reason: reason.trim() || null,
			});
			onClose();
		} catch (err) {
			setError(err.message || "Failed to create bonus");
		} finally {
			setLoading(false);
		}
	};

	const handleClose = () => {
		if (!loading) {
			setError(null);
			onClose();
		}
	};

	const amountInCents = getAmountInCents();
	const isValid = amountInCents > 0;

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={handleClose}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={styles.overlay}
			>
				<View style={styles.modal}>
					{/* Header */}
					<View style={styles.header}>
						<View style={styles.headerTop}>
							<View style={styles.iconContainer}>
								<Icon name="gift" size={20} color={colors.warning[600]} />
							</View>
							<Pressable style={styles.closeButton} onPress={handleClose}>
								<Icon name="times" size={20} color={colors.neutral[400]} />
							</Pressable>
						</View>
						<Text style={styles.title}>Give Bonus</Text>
						{employee && (
							<Text style={styles.employeeName}>
								to {employee.name}
							</Text>
						)}
					</View>

					{/* Amount Input */}
					<View style={styles.section}>
						<Text style={styles.sectionLabel}>Amount</Text>
						<View style={styles.amountInputContainer}>
							<Text style={styles.currencySymbol}>$</Text>
							<TextInput
								style={styles.amountInput}
								value={amount}
								onChangeText={handleAmountChange}
								placeholder="0.00"
								placeholderTextColor={colors.neutral[400]}
								keyboardType="decimal-pad"
								autoFocus
							/>
						</View>
					</View>

					{/* Quick Amounts */}
					<View style={styles.quickAmounts}>
						{QUICK_AMOUNTS.map((cents) => (
							<Pressable
								key={cents}
								style={[
									styles.quickAmountButton,
									amountInCents === cents && styles.quickAmountButtonSelected,
								]}
								onPress={() => handleQuickAmount(cents)}
							>
								<Text
									style={[
										styles.quickAmountText,
										amountInCents === cents && styles.quickAmountTextSelected,
									]}
								>
									${cents / 100}
								</Text>
							</Pressable>
						))}
					</View>

					{/* Reason Input */}
					<View style={styles.section}>
						<Text style={styles.sectionLabel}>Reason (optional)</Text>
						<TextInput
							style={styles.reasonInput}
							value={reason}
							onChangeText={setReason}
							placeholder="e.g., Top performer this month"
							placeholderTextColor={colors.neutral[400]}
							multiline
							numberOfLines={2}
							maxLength={200}
						/>
					</View>

					{/* Info Note */}
					<View style={styles.infoNote}>
						<Icon name="info-circle" size={14} color={colors.primary[500]} />
						<Text style={styles.infoNoteText}>
							This bonus will be added to your pending payroll
						</Text>
					</View>

					{/* Error */}
					{error && (
						<View style={styles.errorContainer}>
							<Icon name="exclamation-circle" size={14} color={colors.error[600]} />
							<Text style={styles.errorText}>{error}</Text>
						</View>
					)}

					{/* Actions */}
					<View style={styles.actions}>
						<Pressable
							style={styles.cancelButton}
							onPress={handleClose}
							disabled={loading}
						>
							<Text style={styles.cancelButtonText}>Cancel</Text>
						</Pressable>
						<Pressable
							style={[
								styles.submitButton,
								(!isValid || loading) && styles.submitButtonDisabled,
							]}
							onPress={handleSubmit}
							disabled={!isValid || loading}
						>
							{loading ? (
								<ActivityIndicator size="small" color={colors.neutral[0]} />
							) : (
								<>
									<Icon name="gift" size={14} color={colors.neutral[0]} />
									<Text style={styles.submitButtonText}>
										Give Bonus{isValid ? ` ($${(amountInCents / 100).toFixed(2)})` : ""}
									</Text>
								</>
							)}
						</Pressable>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
};

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "flex-end",
	},
	modal: {
		backgroundColor: colors.background.primary,
		borderTopLeftRadius: radius["2xl"],
		borderTopRightRadius: radius["2xl"],
		padding: spacing.lg,
		...shadows.lg,
	},
	header: {
		marginBottom: spacing.lg,
	},
	headerTop: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: spacing.sm,
	},
	iconContainer: {
		width: 40,
		height: 40,
		borderRadius: radius.lg,
		backgroundColor: colors.warning[100],
		justifyContent: "center",
		alignItems: "center",
	},
	closeButton: {
		width: 32,
		height: 32,
		borderRadius: radius.full,
		backgroundColor: colors.neutral[100],
		justifyContent: "center",
		alignItems: "center",
	},
	title: {
		fontSize: typography.fontSize.xl,
		fontWeight: typography.fontWeight.bold,
		color: colors.text.primary,
	},
	employeeName: {
		fontSize: typography.fontSize.base,
		color: colors.text.secondary,
		marginTop: spacing.xxs,
	},
	section: {
		marginBottom: spacing.md,
	},
	sectionLabel: {
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.medium,
		color: colors.text.secondary,
		marginBottom: spacing.xs,
	},
	amountInputContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.neutral[50],
		borderRadius: radius.lg,
		borderWidth: 1,
		borderColor: colors.neutral[200],
		paddingHorizontal: spacing.md,
	},
	currencySymbol: {
		fontSize: typography.fontSize["2xl"],
		fontWeight: typography.fontWeight.semibold,
		color: colors.text.secondary,
		marginRight: spacing.xs,
	},
	amountInput: {
		flex: 1,
		fontSize: typography.fontSize["2xl"],
		fontWeight: typography.fontWeight.bold,
		color: colors.text.primary,
		paddingVertical: spacing.md,
	},
	quickAmounts: {
		flexDirection: "row",
		gap: spacing.sm,
		marginBottom: spacing.lg,
	},
	quickAmountButton: {
		flex: 1,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.sm,
		borderRadius: radius.lg,
		backgroundColor: colors.neutral[100],
		alignItems: "center",
	},
	quickAmountButtonSelected: {
		backgroundColor: colors.warning[100],
		borderWidth: 1,
		borderColor: colors.warning[400],
	},
	quickAmountText: {
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.semibold,
		color: colors.text.secondary,
	},
	quickAmountTextSelected: {
		color: colors.warning[700],
	},
	reasonInput: {
		backgroundColor: colors.neutral[50],
		borderRadius: radius.lg,
		borderWidth: 1,
		borderColor: colors.neutral[200],
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		fontSize: typography.fontSize.base,
		color: colors.text.primary,
		minHeight: 60,
		textAlignVertical: "top",
	},
	infoNote: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.primary[50],
		padding: spacing.sm,
		borderRadius: radius.md,
		marginBottom: spacing.md,
		gap: spacing.xs,
	},
	infoNoteText: {
		fontSize: typography.fontSize.sm,
		color: colors.primary[700],
		flex: 1,
	},
	errorContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.error[50],
		padding: spacing.sm,
		borderRadius: radius.md,
		marginBottom: spacing.md,
		gap: spacing.xs,
	},
	errorText: {
		fontSize: typography.fontSize.sm,
		color: colors.error[700],
		flex: 1,
	},
	actions: {
		flexDirection: "row",
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
	submitButton: {
		flex: 2,
		flexDirection: "row",
		paddingVertical: spacing.md,
		borderRadius: radius.lg,
		backgroundColor: colors.warning[500],
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.xs,
	},
	submitButtonDisabled: {
		backgroundColor: colors.neutral[300],
	},
	submitButtonText: {
		fontSize: typography.fontSize.base,
		fontWeight: typography.fontWeight.semibold,
		color: colors.neutral[0],
	},
});

export default GiveBonusModal;
