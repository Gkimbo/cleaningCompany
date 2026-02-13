import React, { useEffect, useState, useContext } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
} from "react-native";
import FetchData from "../../../services/fetchRequests/fetchData";
import { colors, spacing, radius, shadows, typography } from "../../../services/styles/theme";
import Icon from "react-native-vector-icons/FontAwesome";
import { PricingContext } from "../../../context/PricingContext";

const NextAppointmentPreview = ({ appointment, home: initialHome }) => {
  const { pricing } = useContext(PricingContext);
  // For team jobs, use inline data from appointment; otherwise use initialHome
  const [home, setHome] = useState(initialHome || {
    address: appointment.address || "",
    city: appointment.city || "",
    numBaths: appointment.numBaths || "",
    numBeds: appointment.numBeds || "",
    specialNotes: "",
    state: appointment.state || "",
    zipcode: "",
  });

  const formatDate = (dateString) => {
    const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
    return new Date(dateString + "T00:00:00").toLocaleDateString(undefined, options);
  };

  // Calculate estimated cleaning time based on home size and number of cleaners
  const calculateCleaningTime = () => {
    const beds = parseFloat(home.numBeds) || parseFloat(appointment.numBeds) || 2;
    const baths = parseFloat(home.numBaths) || parseFloat(appointment.numBaths) || 1;
    const numCleaners = multiCleanerJob?.totalCleanersRequired || appointment.totalCleanersRequired || 1;

    // Base time: 1 hour for 2 bed 1 bath
    const baseMinutes = 60;
    const baseBeds = 2;
    const baseBaths = 1;

    // Extra time: ~20 minutes per extra bed, ~25 minutes per extra bath
    const extraBeds = Math.max(0, beds - baseBeds);
    const extraBaths = Math.max(0, baths - baseBaths);
    const extraMinutes = (extraBeds * 20) + (extraBaths * 25);

    // Total time split by number of cleaners
    const totalMinutes = baseMinutes + extraMinutes;
    const perCleanerMinutes = Math.round(totalMinutes / numCleaners);

    // Format the time
    if (perCleanerMinutes < 60) {
      return `Est. ${perCleanerMinutes} min`;
    } else {
      const hours = Math.floor(perCleanerMinutes / 60);
      const mins = perCleanerMinutes % 60;
      if (mins === 0) {
        return `Est. ${hours} hr${hours !== 1 ? "s" : ""}`;
      }
      return `Est. ${hours} hr ${mins} min`;
    }
  };

  // Check if appointment is within 48 hours
  const isWithin48Hours = () => {
    const now = new Date();
    // Assume 10am start time for the appointment
    const appointmentDate = new Date(appointment.date + "T10:00:00");
    const diffTime = appointmentDate.getTime() - now.getTime();
    const diffHours = diffTime / (1000 * 60 * 60);
    return diffHours <= 48 && diffHours >= 0;
  };

  const showFullAddress = isWithin48Hours();

  // Handle both solo multi-cleaner jobs and team jobs from confirmed jobs endpoint
  const isMultiCleaner = appointment.isMultiCleanerJob || appointment.jobType === "team";
  const multiCleanerJob = appointment.multiCleanerJob;

  // Use multi-cleaner fee for multi-cleaner jobs, regular fee otherwise
  const platformFeePercent = isMultiCleaner
    ? (pricing?.platform?.multiCleanerPlatformFeePercent || 0.13)
    : (pricing?.platform?.feePercent || 0.1);
  const cleanerSharePercent = 1 - platformFeePercent;

  const totalPrice = Number(appointment.price);
  // For multi-cleaner jobs, calculate payout based on number of cleaners
  // Check both multiCleanerJob and direct appointment properties for team jobs
  const numCleaners = multiCleanerJob?.totalCleanersRequired || appointment.totalCleanersRequired || appointment.employeesAssigned?.length || 1;
  const payout = (totalPrice / numCleaners) * cleanerSharePercent;

  useEffect(() => {
    // Fetch home if not provided or incomplete, and we don't have inline data
    const hasInlineData = appointment.city && appointment.state;
    if (!initialHome && !hasInlineData && appointment.homeId) {
      FetchData.getHome(appointment.homeId).then((response) => {
        if (response.home) {
          setHome(response.home);
        }
      });
    }
  }, [appointment.homeId, appointment.city, appointment.state, initialHome]);

  const getFullAddress = () => {
    return `${home.address}, ${home.city}, ${home.state} ${home.zipcode}`;
  };

  const openMapsApp = (app) => {
    const fullAddress = getFullAddress();
    const encodedAddress = encodeURIComponent(fullAddress);

    let url;
    switch (app) {
      case "apple":
        url = `maps://maps.apple.com/?daddr=${encodedAddress}`;
        break;
      case "google":
        url = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
        break;
      case "waze":
        url = `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;
        break;
      default:
        return;
    }

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`
          );
        }
      })
      .catch((err) => {
        console.error("Error opening maps:", err);
        Alert.alert("Error", "Could not open maps application");
      });
  };

  const handleAddressPress = () => {
    // On web, directly open Google Maps (Alert.alert with buttons doesn't work on web)
    if (Platform.OS === "web") {
      openMapsApp("google");
      return;
    }

    const options = Platform.OS === "ios"
      ? ["Apple Maps", "Google Maps", "Waze", "Cancel"]
      : ["Google Maps", "Waze", "Cancel"];

    const cancelIndex = options.length - 1;

    Alert.alert(
      "Get Directions",
      getFullAddress(),
      options.map((option, index) => {
        if (index === cancelIndex) {
          return { text: option, style: "cancel" };
        }
        return {
          text: option,
          onPress: () => {
            if (option === "Apple Maps") openMapsApp("apple");
            else if (option === "Google Maps") openMapsApp("google");
            else if (option === "Waze") openMapsApp("waze");
          },
        };
      })
    );
  };

  return (
    <View style={[styles.tileContainer, isMultiCleaner && styles.tileContainerMultiCleaner]}>
      {/* Header with Team badge */}
      <View style={styles.headerRow}>
        <Text style={styles.date}>{formatDate(appointment.date)}</Text>
        {isMultiCleaner && (
          <View style={styles.teamBadge}>
            <Icon name="users" size={12} color={colors.primary[700]} />
            <Text style={styles.teamBadgeText}>Team Clean</Text>
          </View>
        )}
      </View>

      {/* Multi-Cleaner Status Banner */}
      {isMultiCleaner && (multiCleanerJob || appointment.totalCleanersRequired) && (
        <View style={styles.multiCleanerBanner}>
          <View style={styles.multiCleanerStats}>
            <View style={styles.multiCleanerStat}>
              <Icon name="users" size={14} color={colors.primary[600]} />
              <Text style={styles.multiCleanerStatValue}>
                {multiCleanerJob?.cleanersConfirmed ?? appointment.cleanersConfirmed}/{multiCleanerJob?.totalCleanersRequired ?? appointment.totalCleanersRequired}
              </Text>
              <Text style={styles.multiCleanerStatLabel}>cleaners</Text>
            </View>
            {(multiCleanerJob?.cleanersConfirmed ?? appointment.cleanersConfirmed) >= (multiCleanerJob?.totalCleanersRequired ?? appointment.totalCleanersRequired) ? (
              <View style={[styles.multiCleanerStatusBadge, styles.multiCleanerStatusFilled]}>
                <Icon name="check-circle" size={12} color={colors.success[600]} />
                <Text style={styles.multiCleanerStatusFilledText}>Team Ready</Text>
              </View>
            ) : (
              <View style={[styles.multiCleanerStatusBadge, styles.multiCleanerStatusFilling]}>
                <Icon name="clock-o" size={12} color={colors.warning[600]} />
                <Text style={styles.multiCleanerStatusFillingText}>
                  Waiting for {(multiCleanerJob?.totalCleanersRequired ?? appointment.totalCleanersRequired) - (multiCleanerJob?.cleanersConfirmed ?? appointment.cleanersConfirmed)} more
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {home.numBeds && (
        <View style={styles.timeWindowBadge}>
          <Icon name="clock-o" size={12} color={colors.primary[600]} />
          <Text style={styles.timeWindowText}>
            {calculateCleaningTime()}
            {isMultiCleaner && " per cleaner"}
          </Text>
        </View>
      )}

      {showFullAddress ? (
        <TouchableOpacity
          style={styles.addressContainer}
          onPress={handleAddressPress}
          activeOpacity={0.7}
        >
          <View style={styles.addressTextContainer}>
            <Text style={styles.addressText}>{home.address || "Loading..."}</Text>
            <Text style={styles.addressText}>{home.city}, {home.state} {home.zipcode}</Text>
          </View>
          <View style={styles.directionsButton}>
            <Icon name="map-marker" size={16} color={colors.neutral[0]} />
            <Text style={styles.directionsText}>Directions</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.addressContainer}>
          <View style={styles.addressTextContainer}>
            <Text style={styles.addressText}>{home.city}, {home.state} {home.zipcode}</Text>
          </View>
          <View style={styles.addressHiddenNote}>
            <Icon name="lock" size={12} color={colors.text.tertiary} />
            <Text style={styles.addressHiddenText}>Full address available 2 days before</Text>
          </View>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Beds</Text>
          <Text style={styles.detailValue}>{home.numBeds || appointment.numBeds || "?"}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Baths</Text>
          <Text style={styles.detailValue}>{home.numBaths || appointment.numBaths || "?"}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Payout</Text>
          <Text style={[styles.detailValue, styles.payoutValue]}>${payout.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.requirementsRow}>
        {appointment.bringSheets === "Yes" && (
          <View style={styles.requirementBadge}>
            <Text style={styles.requirementText}>Bring Sheets</Text>
          </View>
        )}
        {appointment.bringTowels === "Yes" && (
          <View style={styles.requirementBadge}>
            <Text style={styles.requirementText}>Bring Towels</Text>
          </View>
        )}
      </View>

      {showFullAddress && home.specialNotes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Special Notes:</Text>
          <Text style={styles.notes} numberOfLines={2}>{home.specialNotes}</Text>
        </View>
      )}

      <View style={styles.accessInfoBanner}>
        <Icon name="lock" size={14} color={colors.text.tertiary} />
        <Text style={styles.accessInfoText}>
          {showFullAddress
            ? "Access details (key code, etc.) available on day of appointment"
            : "Full address and access details available 2 days before appointment"
          }
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tileContainer: {
    backgroundColor: colors.neutral[0],
    padding: spacing.lg,
    marginVertical: spacing.sm,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  tileContainerMultiCleaner: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  teamBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  teamBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  multiCleanerBanner: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  multiCleanerStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  multiCleanerStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  multiCleanerStatValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  multiCleanerStatLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
  },
  multiCleanerStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  multiCleanerStatusFilled: {
    backgroundColor: colors.success[100],
  },
  multiCleanerStatusFilledText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[700],
  },
  multiCleanerStatusFilling: {
    backgroundColor: colors.warning[100],
  },
  multiCleanerStatusFillingText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  date: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  timeWindowBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  timeWindowText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  addressContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  addressTextContainer: {
    marginBottom: spacing.sm,
  },
  addressText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 2,
  },
  addressHiddenNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  addressHiddenText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  directionsText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.md,
  },
  detailsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: spacing.md,
  },
  detailItem: {
    alignItems: "center",
  },
  detailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  detailValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  payoutValue: {
    color: colors.success[600],
  },
  requirementsRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  requirementBadge: {
    backgroundColor: colors.warning[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  requirementText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[800],
  },
  notesContainer: {
    backgroundColor: colors.secondary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  notesLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.secondary[700],
    marginBottom: spacing.xs,
  },
  notes: {
    fontSize: typography.fontSize.sm,
    color: colors.secondary[800],
    lineHeight: 20,
  },
  accessInfoBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  accessInfoText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
});

export default NextAppointmentPreview;
