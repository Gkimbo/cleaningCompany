import React from "react";
import { Pressable, Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";

const HomeTile = ({
	id,
	nickName,
	state,
	address,
	city,
	zipcode,
	numBeds,
	numBaths,
	sheetsProvided,
	towelsProvided,
	keyPadCode,
	keyLocation,
	recyclingLocation,
	compostLocation,
	trashLocation,
	pendingRequestCount = 0,
	onRequestsPress,
	outsideServiceArea = false,
	isSetupComplete = true,
	cleanerRate = null,
	cleanerName = null,
}) => {
	const navigate = useNavigate();
	const isIncomplete = isSetupComplete === false;
	const isBookingDisabled = outsideServiceArea || isIncomplete;

	const handleViewDetails = () => {
		navigate(`/details/${id}`);
	};

	const handleQuickBook = (e) => {
		e.stopPropagation();
		if (isBookingDisabled) return; // Don't allow booking if outside service area or setup incomplete
		navigate(`/quick-book/${id}`);
	};

	const handleCompleteSetup = (e) => {
		e.stopPropagation();
		navigate(`/complete-home-setup/${id}`);
	};

	const handleRequestsPress = (e) => {
		e.stopPropagation();
		if (onRequestsPress) {
			onRequestsPress(id);
		}
	};

	return (
		<View style={[styles.container, (outsideServiceArea || isIncomplete) && styles.containerOutsideArea]}>
			{pendingRequestCount > 0 && (
				<TouchableOpacity
					style={styles.notificationBubble}
					onPress={handleRequestsPress}
					activeOpacity={0.8}
				>
					<Text style={styles.notificationText}>
						{pendingRequestCount > 99 ? "99+" : pendingRequestCount}
					</Text>
				</TouchableOpacity>
			)}
			{isIncomplete && (
				<TouchableOpacity style={styles.serviceAreaWarning} onPress={handleCompleteSetup}>
					<Text style={styles.serviceAreaWarningText}>
						Setup Required - Tap to complete setup
					</Text>
				</TouchableOpacity>
			)}
			{outsideServiceArea && !isIncomplete && (
				<View style={styles.serviceAreaWarning}>
					<Text style={styles.serviceAreaWarningText}>
						Outside Service Area - Booking unavailable
					</Text>
				</View>
			)}
			<Pressable onPress={pendingRequestCount > 0 ? handleRequestsPress : handleViewDetails}>
				<View style={styles.header}>
					<Text style={styles.title}>{nickName}</Text>
					<View style={styles.badge}>
						<Text style={styles.badgeText}>{numBeds} bed, {numBaths} bath</Text>
					</View>
				</View>

				<Text style={styles.address}>{address}</Text>
				<Text style={styles.cityState}>{city}, {state} {zipcode}</Text>

				{/* Cleaner Rate Display */}
				{cleanerRate && (
					<View style={styles.cleanerRateContainer}>
						<View style={styles.cleanerRateIcon}>
							<Text style={styles.cleanerRateIconText}>$</Text>
						</View>
						<View style={styles.cleanerRateInfo}>
							<Text style={styles.cleanerRateLabel}>
								{cleanerName ? `${cleanerName}'s rate` : "Your cleaner's rate"}
							</Text>
							<Text style={styles.cleanerRateValue}>
								${parseFloat(cleanerRate).toFixed(0)}/cleaning
							</Text>
						</View>
					</View>
				)}

				<View style={styles.divider} />

				<View style={styles.detailsRow}>
					<View style={styles.detailItem}>
						<Text style={styles.detailLabel}>Sheets</Text>
						<Text style={styles.detailValue}>
							{sheetsProvided === "yes" ? "Included" : "Not included"}
						</Text>
					</View>
					<View style={styles.detailItem}>
						<Text style={styles.detailLabel}>Towels</Text>
						<Text style={styles.detailValue}>
							{towelsProvided === "yes" ? "Included" : "Not included"}
						</Text>
					</View>
				</View>

				{(keyPadCode || keyLocation) && (
					<View style={styles.accessInfo}>
						<Text style={styles.accessLabel}>
							{keyPadCode ? "Door Code" : "Key Location"}
						</Text>
						<Text style={styles.accessValue}>
							{keyPadCode || keyLocation}
						</Text>
					</View>
				)}
			</Pressable>

			<View style={styles.buttonRow}>
				<TouchableOpacity
					style={styles.detailsButton}
					onPress={handleViewDetails}
				>
					<Text style={styles.detailsButtonText}>View Details</Text>
				</TouchableOpacity>

				{isIncomplete ? (
					<TouchableOpacity
						style={styles.setupButton}
						onPress={handleCompleteSetup}
					>
						<Text style={styles.setupButtonText}>Complete Setup</Text>
					</TouchableOpacity>
				) : (
					<TouchableOpacity
						style={[styles.bookButton, outsideServiceArea && styles.bookButtonDisabled]}
						onPress={handleQuickBook}
						disabled={outsideServiceArea}
					>
						<Text style={[styles.bookButtonText, outsideServiceArea && styles.bookButtonTextDisabled]}>
							{outsideServiceArea ? "Unavailable" : "Book Cleaning"}
						</Text>
					</TouchableOpacity>
				)}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		backgroundColor: colors.neutral[0],
		borderRadius: radius.xl,
		padding: spacing.lg,
		marginBottom: spacing.lg,
		...shadows.md,
		borderLeftWidth: 4,
		borderLeftColor: colors.primary[500],
		position: "relative",
	},
	containerOutsideArea: {
		borderLeftColor: colors.warning[500],
		opacity: 0.9,
	},
	serviceAreaWarning: {
		backgroundColor: colors.warning[50],
		borderRadius: radius.md,
		padding: spacing.sm,
		marginBottom: spacing.md,
		borderWidth: 1,
		borderColor: colors.warning[200],
	},
	serviceAreaWarningText: {
		fontSize: typography.fontSize.xs,
		fontWeight: typography.fontWeight.medium,
		color: colors.warning[700],
		textAlign: "center",
	},
	notificationBubble: {
		position: "absolute",
		top: -8,
		right: -8,
		backgroundColor: colors.error[500],
		borderRadius: radius.full,
		minWidth: 24,
		height: 24,
		paddingHorizontal: 6,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 10,
		...shadows.md,
		borderWidth: 2,
		borderColor: colors.neutral[0],
	},
	notificationText: {
		color: colors.neutral[0],
		fontSize: typography.fontSize.xs,
		fontWeight: typography.fontWeight.bold,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: spacing.sm,
	},
	title: {
		fontSize: typography.fontSize.lg,
		fontWeight: typography.fontWeight.bold,
		color: colors.text.primary,
		flex: 1,
	},
	badge: {
		backgroundColor: colors.primary[100],
		paddingVertical: spacing.xs,
		paddingHorizontal: spacing.sm,
		borderRadius: radius.full,
	},
	badgeText: {
		fontSize: typography.fontSize.xs,
		fontWeight: typography.fontWeight.medium,
		color: colors.primary[700],
	},
	address: {
		fontSize: typography.fontSize.base,
		color: colors.text.secondary,
		marginBottom: 2,
	},
	cityState: {
		fontSize: typography.fontSize.sm,
		color: colors.text.tertiary,
	},
	cleanerRateContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.success[50],
		borderWidth: 1,
		borderColor: colors.success[200],
		borderRadius: radius.lg,
		padding: spacing.md,
		marginTop: spacing.md,
	},
	cleanerRateIcon: {
		width: 36,
		height: 36,
		borderRadius: radius.full,
		backgroundColor: colors.success[100],
		alignItems: "center",
		justifyContent: "center",
		marginRight: spacing.md,
	},
	cleanerRateIconText: {
		fontSize: typography.fontSize.lg,
		fontWeight: typography.fontWeight.bold,
		color: colors.success[600],
	},
	cleanerRateInfo: {
		flex: 1,
	},
	cleanerRateLabel: {
		fontSize: typography.fontSize.xs,
		color: colors.success[700],
		marginBottom: 2,
	},
	cleanerRateValue: {
		fontSize: typography.fontSize.lg,
		fontWeight: typography.fontWeight.bold,
		color: colors.success[700],
	},
	divider: {
		height: 1,
		backgroundColor: colors.border.light,
		marginVertical: spacing.md,
	},
	detailsRow: {
		flexDirection: "row",
		gap: spacing.xl,
		marginBottom: spacing.md,
	},
	detailItem: {},
	detailLabel: {
		fontSize: typography.fontSize.xs,
		color: colors.text.tertiary,
		marginBottom: 2,
	},
	detailValue: {
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.medium,
		color: colors.text.primary,
	},
	accessInfo: {
		backgroundColor: colors.neutral[50],
		padding: spacing.sm,
		borderRadius: radius.md,
		marginBottom: spacing.md,
	},
	accessLabel: {
		fontSize: typography.fontSize.xs,
		color: colors.text.tertiary,
		marginBottom: 2,
	},
	accessValue: {
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.medium,
		color: colors.primary[700],
	},
	buttonRow: {
		flexDirection: "row",
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	detailsButton: {
		flex: 1,
		backgroundColor: colors.neutral[100],
		paddingVertical: spacing.md,
		borderRadius: radius.lg,
		alignItems: "center",
		borderWidth: 1,
		borderColor: colors.border.default,
	},
	detailsButtonText: {
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.semibold,
		color: colors.text.secondary,
	},
	bookButton: {
		flex: 1,
		backgroundColor: colors.secondary[500],
		paddingVertical: spacing.md,
		borderRadius: radius.lg,
		alignItems: "center",
		...shadows.sm,
	},
	bookButtonDisabled: {
		backgroundColor: colors.neutral[200],
		...shadows.none,
	},
	bookButtonText: {
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.bold,
		color: colors.neutral[0],
	},
	bookButtonTextDisabled: {
		color: colors.text.tertiary,
	},
	setupButton: {
		flex: 1,
		backgroundColor: colors.warning[500],
		paddingVertical: spacing.sm,
		borderRadius: radius.lg,
		alignItems: "center",
		...shadows.sm,
	},
	setupButtonText: {
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.bold,
		color: colors.neutral[0],
	},
});

export default HomeTile;
