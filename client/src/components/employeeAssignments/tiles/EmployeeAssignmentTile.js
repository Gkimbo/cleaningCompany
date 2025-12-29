import React, { useEffect, useState } from "react";
import { ActivityIndicator, LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import FetchData from "../../../services/fetchRequests/fetchData";
import CleanerCancellationWarningModal from "../../modals/CleanerCancellationWarningModal";
import { usePricing } from "../../../context/PricingContext";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../../services/styles/theme";

const EmployeeAssignmentTile = ({
  id,
  cleanerId,
  date,
  price,
  homeId,
  bringSheets,
  bringTowels,
  completed,
  keyPadCode,
  keyLocation,
  addEmployee,
  removeEmployee,
  assigned,
  distance,
  timeToBeCompleted,
  token,
  onCancelComplete,
}) => {
  const navigate = useNavigate();
  const { pricing } = usePricing();
  const [expandWindow, setExpandWindow] = useState(false);
  const [home, setHome] = useState({
    address: "",
    city: "",
    state: "",
    zipcode: "",
    numBaths: "",
    numBeds: "",
    cleanersNeeded: "",
  });
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationInfo, setCancellationInfo] = useState(null);
  const [loadingCancellation, setLoadingCancellation] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState(null);

  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const amount = Number(price) * cleanerSharePercent;

  const formatDate = (dateString) => {
    const dateObj = new Date(dateString + "T00:00:00");
    const options = { weekday: "short", month: "short", day: "numeric" };
    return dateObj.toLocaleDateString(undefined, options);
  };

  const getDateStatus = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(date + "T00:00:00");
    const diffTime = appointmentDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (completed) return { label: "Completed", color: colors.success[600], bgColor: colors.success[50], icon: "check-circle" };
    if (diffDays < 0) return { label: "Past Due", color: colors.error[600], bgColor: colors.error[50], icon: "exclamation-circle" };
    if (diffDays === 0) return { label: "Today", color: colors.error[500], bgColor: colors.error[50], icon: "clock-o" };
    if (diffDays === 1) return { label: "Tomorrow", color: colors.warning[600], bgColor: colors.warning[50], icon: "clock-o" };
    if (diffDays <= 7) return { label: `In ${diffDays} days`, color: colors.primary[600], bgColor: colors.primary[50], icon: "calendar" };
    return { label: "Upcoming", color: colors.text.secondary, bgColor: colors.neutral[100], icon: "calendar-o" };
  };

  const toggleDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandWindow(!expandWindow);
  };

  useEffect(() => {
    FetchData.getHome(homeId).then((response) => {
      setHome(response.home);
    });
  }, [homeId]);

  const miles = distance ? (distance * 0.621371).toFixed(1) : null;

  const isToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(date + "T00:00:00");
    return appointmentDate.getTime() === today.getTime();
  };

  const formatTimeWindow = (time) => {
    if (!time) return null;
    if (time.toLowerCase() === "anytime") {
      return isToday() ? "Complete anytime today" : null;
    }
    const parts = time.split("-");
    if (parts.length === 2) {
      const endHour = parseInt(parts[1], 10);
      // Time windows are like "10-3" (10am-3pm), "11-4" (11am-4pm), "12-2" (12pm-2pm)
      // End hours 1-6 are PM (afternoon), 7-11 are AM, 12 is PM
      const period = endHour <= 6 || endHour === 12 ? "PM" : "AM";
      const displayHour = endHour === 0 ? 12 : endHour;
      return `Complete by ${displayHour}${period}`;
    }
    return null;
  };

  const handleCancelPress = async () => {
    if (!token) {
      removeEmployee(cleanerId, id);
      return;
    }
    setLoadingCancellation(true);
    setError(null);
    try {
      const info = await FetchData.getCancellationInfo(id, token);
      if (info.error) {
        setError(info.error);
        setLoadingCancellation(false);
        return;
      }
      setCancellationInfo(info);
      setShowCancelModal(true);
    } catch (err) {
      setError("Failed to load cancellation info");
    } finally {
      setLoadingCancellation(false);
    }
  };

  const handleConfirmCancel = async () => {
    setCancelLoading(true);
    try {
      const result = await FetchData.cancelAsCleaner(id, token, true);
      if (result.error) {
        setError(result.error);
        setCancelLoading(false);
        return;
      }
      setShowCancelModal(false);

      if (result.accountFrozen) {
        setError("Your account has been frozen due to too many cancellations. Please contact support.");
      }

      if (onCancelComplete) {
        onCancelComplete(id, result);
      } else {
        removeEmployee(cleanerId, id);
      }
    } catch (err) {
      setError("Failed to cancel job");
    } finally {
      setCancelLoading(false);
    }
  };

  const timeWindowText = formatTimeWindow(timeToBeCompleted);
  const isAnytimeToday = timeToBeCompleted?.toLowerCase() === "anytime" && isToday();
  const dateStatus = getDateStatus();

  return (
    <View style={styles.card}>
      <Pressable onPress={toggleDetails} style={styles.cardContent}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>{formatDate(date)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: dateStatus.bgColor }]}>
              <Icon name={dateStatus.icon} size={10} color={dateStatus.color} />
              <Text style={[styles.statusText, { color: dateStatus.color }]}>{dateStatus.label}</Text>
            </View>
          </View>
          {assigned && !completed && (
            <View style={styles.assignedBadge}>
              <Icon name="check" size={10} color={colors.success[600]} />
              <Text style={styles.assignedText}>Assigned</Text>
            </View>
          )}
        </View>

        {/* Earnings */}
        <View style={[styles.earningsContainer, completed && styles.earningsCompleted]}>
          <Text style={[styles.earningsLabel, completed && styles.earningsLabelCompleted]}>
            {completed ? "You Earned" : "You'll Earn"}
          </Text>
          <Text style={[styles.earningsAmount, completed && styles.earningsAmountCompleted]}>
            ${amount.toFixed(2)}
          </Text>
        </View>

        {/* Location & Distance Row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Icon name="map-marker" size={14} color={colors.text.secondary} />
            <Text style={styles.infoText}>{home.city}, {home.state}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoItem}>
            <Icon name="location-arrow" size={12} color={colors.primary[500]} />
            <Text style={[styles.infoText, styles.distanceText]}>
              {miles ? `${miles} mi` : "Distance unknown"}
            </Text>
          </View>
        </View>

        {/* Time Window - Important */}
        {timeWindowText && !completed && (
          <View style={[styles.timeWindowContainer, isAnytimeToday && styles.anytimeTodayContainer]}>
            <Icon name={isAnytimeToday ? "clock-o" : "exclamation-circle"} size={14} color={isAnytimeToday ? colors.primary[600] : colors.warning[600]} />
            <Text style={[styles.timeWindowText, isAnytimeToday && styles.anytimeTodayText]}>{timeWindowText}</Text>
          </View>
        )}

        {/* Property Details */}
        <View style={styles.propertyRow}>
          <View style={styles.propertyItem}>
            <Icon name="bed" size={14} color={colors.text.secondary} />
            <Text style={styles.propertyText}>{home.numBeds || "?"} Beds</Text>
          </View>
          <View style={styles.propertyItem}>
            <Icon name="bath" size={14} color={colors.text.secondary} />
            <Text style={styles.propertyText}>{home.numBaths || "?"} Baths</Text>
          </View>
          {bringSheets === "yes" && (
            <View style={styles.propertyItem}>
              <Icon name="th-large" size={12} color={colors.primary[500]} />
              <Text style={styles.propertyText}>Sheets</Text>
            </View>
          )}
          {bringTowels === "yes" && (
            <View style={styles.propertyItem}>
              <Icon name="square" size={12} color={colors.primary[500]} />
              <Text style={styles.propertyText}>Towels</Text>
            </View>
          )}
        </View>

        {/* Expanded Details */}
        {(expandWindow || assigned) && (
          <View style={styles.expandedSection}>
            {/* Access Info for Assigned Jobs */}
            {assigned && !completed && (keyPadCode || keyLocation) && (
              <View style={styles.accessInfoContainer}>
                <Text style={styles.accessTitle}>
                  <Icon name="key" size={12} color={colors.primary[600]} /> Access Information
                </Text>
                {keyPadCode && (
                  <View style={styles.accessRow}>
                    <Text style={styles.accessLabel}>Keypad Code:</Text>
                    <Text style={styles.accessValue}>{keyPadCode}</Text>
                  </View>
                )}
                {keyLocation && (
                  <View style={styles.accessRow}>
                    <Text style={styles.accessLabel}>Key Location:</Text>
                    <Text style={styles.accessValue}>{keyLocation}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Large Home Warning */}
            {home.cleanersNeeded > 1 && (
              <View style={styles.warningBanner}>
                <Icon name="exclamation-triangle" size={14} color={colors.warning[700]} />
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>Large Home</Text>
                  <Text style={styles.warningSubtext}>May need additional cleaners</Text>
                </View>
              </View>
            )}

            {/* Address Hint */}
            {!assigned && (
              <Text style={styles.expandHint}>
                <Icon name="info-circle" size={12} color={colors.text.tertiary} /> Full address available after assignment
              </Text>
            )}

            {/* Full Address for Assigned Jobs */}
            {assigned && home.address && (
              <View style={styles.addressContainer}>
                <Icon name="home" size={14} color={colors.text.secondary} />
                <Text style={styles.addressText}>
                  {home.address}, {home.city}, {home.state} {home.zipcode}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Expand Indicator */}
        <View style={styles.expandIndicator}>
          <Icon
            name={expandWindow ? "chevron-up" : "chevron-down"}
            size={12}
            color={colors.text.tertiary}
          />
        </View>
      </Pressable>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Icon name="exclamation-circle" size={14} color={colors.error[600]} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Action Buttons */}
      {!completed && (
        <View style={styles.actionsRow}>
          {assigned ? (
            <Pressable
              style={[styles.actionButton, styles.cancelButton, loadingCancellation && styles.buttonDisabled]}
              onPress={handleCancelPress}
              disabled={loadingCancellation}
            >
              {loadingCancellation ? (
                <ActivityIndicator size="small" color={colors.error[600]} />
              ) : (
                <>
                  <Icon name="times" size={14} color={colors.error[600]} />
                  <Text style={styles.cancelButtonText}>Cancel Job</Text>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => addEmployee(cleanerId, id)}
            >
              <Icon name="check" size={14} color={colors.neutral[0]} />
              <Text style={styles.acceptButtonText}>Accept This Job</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Completed Badge */}
      {completed && (
        <View style={styles.completedFooter}>
          <Icon name="check-circle" size={16} color={colors.success[600]} />
          <Text style={styles.completedText}>Job Completed</Text>
        </View>
      )}

      {/* Cleaner Cancellation Warning Modal */}
      <CleanerCancellationWarningModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleConfirmCancel}
        cancellationInfo={cancellationInfo}
        loading={cancelLoading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadows.md,
  },
  cardContent: {
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
    flex: 1,
  },
  dateText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  assignedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  assignedText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[600],
  },
  earningsContainer: {
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  earningsCompleted: {
    backgroundColor: colors.neutral[100],
  },
  earningsLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
    marginBottom: 2,
  },
  earningsLabelCompleted: {
    color: colors.text.secondary,
  },
  earningsAmount: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  earningsAmountCompleted: {
    color: colors.text.primary,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  distanceText: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.md,
  },
  timeWindowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  timeWindowText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  anytimeTodayContainer: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  anytimeTodayText: {
    color: colors.primary[700],
  },
  propertyRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  propertyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  propertyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  expandedSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  accessInfoContainer: {
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  accessTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
    marginBottom: spacing.sm,
  },
  accessRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  accessLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  accessValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  warningSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
  },
  expandHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "center",
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.md,
  },
  addressText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  expandIndicator: {
    alignItems: "center",
    marginTop: spacing.sm,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.error[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.error[100],
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
  },
  actionsRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  cancelButton: {
    backgroundColor: colors.error[50],
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.error[600],
  },
  acceptButton: {
    backgroundColor: colors.success[500],
  },
  acceptButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  completedFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.success[50],
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.success[100],
  },
  completedText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[700],
  },
});

export default EmployeeAssignmentTile;
