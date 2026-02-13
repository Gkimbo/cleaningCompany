import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import FetchData from "../../../services/fetchRequests/fetchData";
import { usePricing } from "../../../context/PricingContext";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../services/styles/theme";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RequestedTile = ({
  id,
  cleanerId,
  date,
  price,
  homeId,
  bringSheets,
  bringTowels,
  removeRequest,
  distance,
  timeToBeCompleted,
}) => {
  const { pricing } = usePricing();
  const [home, setHome] = useState({});
  const [linensExpanded, setLinensExpanded] = useState(false);

  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const amount = Number(price) * cleanerSharePercent;

  const formatDate = (dateString) => {
    const dateObj = new Date(dateString + "T00:00:00");
    const options = { weekday: "short", month: "short", day: "numeric" };
    return dateObj.toLocaleDateString(undefined, options);
  };

  useEffect(() => {
    FetchData.getHome(homeId).then((response) => {
      setHome(response.home);
    });
  }, [homeId]);

  const miles = distance ? (distance * 0.621371).toFixed(1) : null;

  const formatTimeWindow = (time) => {
    if (!time) return null;
    if (time.toLowerCase() === "anytime") return "Anytime";
    // Format "10-3" → "10am - 3pm"
    const match = time.match(/^(\d+)(am|pm)?-(\d+)(am|pm)?$/i);
    if (!match) return time;
    const startHour = parseInt(match[1], 10);
    const startPeriod = match[2]?.toLowerCase() || (startHour >= 8 && startHour <= 11 ? "am" : "pm");
    const endHour = parseInt(match[3], 10);
    const endPeriod = match[4]?.toLowerCase() || (endHour >= 1 && endHour <= 6 ? "pm" : "am");
    return `${startHour}${startPeriod} - ${endHour}${endPeriod}`;
  };

  const needsLinens = bringSheets === "yes" || bringTowels === "yes";

  const toggleLinens = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLinensExpanded(!linensExpanded);
  };

  // Determine if there's a specific time constraint (not "anytime")
  const hasTimeConstraint =
    timeToBeCompleted && timeToBeCompleted.toLowerCase() !== "anytime";

  // Handle cancel request with confirmation
  const handleCancelRequest = () => {
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this cleaning request?",
      [
        { text: "No, Keep It", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () => {
            removeRequest(cleanerId, id);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.tile}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.typeBadge}>
          <Icon name="user" size={12} color={colors.warning[600]} />
          <Text style={styles.typeBadgeText}>Solo Cleaning</Text>
        </View>
        <Text style={styles.pendingBadge}>Awaiting Approval</Text>
      </View>

      {/* Location */}
      <Text style={styles.address}>
        {home.city || "Loading..."}, {home.state}
      </Text>

      {/* Date */}
      <Text style={styles.date}>{formatDate(date)}</Text>

      {/* Details Row */}
      <View style={styles.detailsRow}>
        <Text style={styles.detail}>
          {home.numBeds || "?"} bed / {home.numBaths || "?"} bath
        </Text>
        {miles && <Text style={styles.detail}>{miles} mi away</Text>}
        {!hasTimeConstraint && formatTimeWindow(timeToBeCompleted) && (
          <Text style={styles.detail}>
            {formatTimeWindow(timeToBeCompleted)}
          </Text>
        )}
      </View>

      {/* Linens Dropdown */}
      {needsLinens && (
        <View style={styles.linensContainer}>
          <Pressable style={styles.linensHeader} onPress={toggleLinens}>
            <View style={styles.linensHeaderLeft}>
              <Icon
                name="exclamation-triangle"
                size={14}
                color={colors.warning[600]}
              />
              <Text style={styles.linensHeaderText}>Linens Required</Text>
            </View>
            <Icon
              name={linensExpanded ? "chevron-up" : "chevron-down"}
              size={12}
              color={colors.warning[600]}
            />
          </Pressable>
          {linensExpanded && (
            <View style={styles.linensContent}>
              {bringSheets === "yes" && (
                <View style={styles.linenSection}>
                  <View style={styles.linenCategory}>
                    <Icon name="bed" size={14} color={colors.primary[600]} />
                    <Text style={styles.linenCategoryTitle}>Sheets</Text>
                  </View>
                  <Text style={styles.linenSummary}>
                    {home.numBeds || "?"} sheet set
                    {(home.numBeds || 0) !== 1 ? "s" : ""} (fitted, flat,
                    pillowcases)
                  </Text>
                </View>
              )}
              {bringTowels === "yes" && (
                <View
                  style={[
                    styles.linenSection,
                    bringSheets === "yes" && styles.linenSectionSpaced,
                  ]}
                >
                  <View style={styles.linenCategory}>
                    <Icon name="tint" size={14} color={colors.primary[600]} />
                    <Text style={styles.linenCategoryTitle}>Towels</Text>
                  </View>
                  <Text style={styles.linenSummary}>
                    {(home.numBaths || 1) * 2} bath towels, {home.numBaths || 1}{" "}
                    hand towels, {(home.numBaths || 1) * 2} washcloths
                  </Text>
                </View>
              )}
              <View style={styles.linenNote}>
                <Icon
                  name="info-circle"
                  size={12}
                  color={colors.text.tertiary}
                />
                <Text style={styles.linenNoteText}>
                  All linens should be freshly laundered
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Earnings */}
      <View style={styles.earningsRow}>
        <Icon name="dollar" size={12} color={colors.success[600]} />
        <Text style={styles.earningsText}>{amount.toFixed(0)} potential</Text>
      </View>

      {/* Time Constraint */}
      {hasTimeConstraint && (
        <View style={styles.timeConstraintRow}>
          <Icon name="clock-o" size={12} color={colors.warning[600]} />
          <Text style={styles.timeConstraintText}>
            Complete by {formatTimeWindow(timeToBeCompleted)}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <View style={styles.requestSentBadge}>
          <Icon name="check-circle" size={14} color={colors.success[600]} />
          <Text style={styles.requestSentText}>Request Sent</Text>
        </View>
        <Pressable style={styles.cancelButton} onPress={handleCancelRequest}>
          <Icon name="times" size={14} color={colors.error[600]} />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
  },
  typeBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[600],
  },
  pendingBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[600],
    backgroundColor: colors.warning[50],
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  address: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  date: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  detail: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  // Time Constraint
  timeConstraintRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
    alignSelf: "flex-start",
  },
  timeConstraintText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  // Linens Dropdown
  linensContainer: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  linensHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  linensHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  linensHeaderText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  linensContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.warning[200],
    paddingTop: spacing.sm,
  },
  linenSection: {
    marginBottom: spacing.sm,
  },
  linenSectionSpaced: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.warning[100],
  },
  linenCategory: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 2,
  },
  linenCategoryTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  linenSummary: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    paddingLeft: 22,
    lineHeight: 20,
  },
  linenNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.warning[100],
  },
  linenNoteText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    flex: 1,
    lineHeight: 16,
  },
  earningsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  earningsText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  requestSentBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  requestSentText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[600],
  },
});

export default RequestedTile;
