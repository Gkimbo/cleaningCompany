import React, { useEffect, useState } from "react";
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import FetchData from "../../../services/fetchRequests/fetchData";
import { usePricing } from "../../../context/PricingContext";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../../services/styles/theme";

const RequestedTile = ({
  id,
  cleanerId,
  date,
  price,
  homeId,
  bringSheets,
  bringTowels,
  removeRequest,
  assigned,
  distance,
  timeToBeCompleted,
}) => {
  const navigate = useNavigate();
  const { pricing } = usePricing();
  const [expandWindow, setExpandWindow] = useState(false);
  const [home, setHome] = useState({});

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

    if (diffDays === 0) return { label: "Today", color: colors.error[500], bgColor: colors.error[50] };
    if (diffDays === 1) return { label: "Tomorrow", color: colors.warning[600], bgColor: colors.warning[50] };
    if (diffDays <= 7) return { label: `In ${diffDays} days`, color: colors.primary[600], bgColor: colors.primary[50] };
    return null;
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
            {dateStatus && (
              <View style={[styles.dateBadge, { backgroundColor: dateStatus.bgColor }]}>
                <Text style={[styles.dateBadgeText, { color: dateStatus.color }]}>{dateStatus.label}</Text>
              </View>
            )}
          </View>
          <View style={styles.statusBadge}>
            <Icon name="clock-o" size={12} color={colors.warning[600]} />
            <Text style={styles.statusText}>Pending</Text>
          </View>
        </View>

        {/* Earnings */}
        <View style={styles.earningsContainer}>
          <Text style={styles.earningsLabel}>Potential Earnings</Text>
          <Text style={styles.earningsAmount}>${amount.toFixed(2)}</Text>
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
        {timeWindowText && (
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
            {home.cleanersNeeded > 1 && (
              <View style={styles.warningBanner}>
                <Icon name="exclamation-triangle" size={14} color={colors.warning[700]} />
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>Large Home</Text>
                  <Text style={styles.warningSubtext}>May need additional cleaners</Text>
                </View>
              </View>
            )}
            <Text style={styles.expandHint}>
              <Icon name="info-circle" size={12} color={colors.text.tertiary} /> Full address available on day of appointment
            </Text>
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

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <View style={styles.sentButton}>
          <Icon name="check" size={12} color={colors.primary[600]} />
          <Text style={styles.sentButtonText}>Request Sent</Text>
        </View>
        <Pressable
          style={styles.cancelButton}
          onPress={() => removeRequest(cleanerId, id)}
        >
          <Icon name="times" size={12} color={colors.error[600]} />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
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
  },
  dateText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  dateBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  dateBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.warning[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  earningsContainer: {
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  earningsLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
    marginBottom: 2,
  },
  earningsAmount: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
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
  expandIndicator: {
    alignItems: "center",
    marginTop: spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  sentButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary[50],
  },
  sentButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  cancelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.error[50],
  },
  cancelButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.error[600],
  },
});

export default RequestedTile;
