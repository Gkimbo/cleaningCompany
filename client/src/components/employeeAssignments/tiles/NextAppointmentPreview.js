import React, { useEffect, useState } from "react";
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

const NextAppointmentPreview = ({ appointment, home: initialHome, cleanerSharePercent }) => {
  const [home, setHome] = useState(initialHome || {
    address: "",
    city: "",
    numBaths: "",
    numBeds: "",
    specialNotes: "",
    state: "",
    zipcode: "",
  });

  const formatDate = (dateString) => {
    const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
    return new Date(dateString + "T00:00:00").toLocaleDateString(undefined, options);
  };

  const formatTimeWindow = (timeToBeCompleted) => {
    if (!timeToBeCompleted || timeToBeCompleted === "anytime") {
      return "Anytime today";
    }
    // timeToBeCompleted format is "10-3", "11-4", "12-2"
    const endHour = parseInt(timeToBeCompleted.split("-")[1], 10);
    const period = endHour >= 12 ? "PM" : "AM";
    const displayHour = endHour > 12 ? endHour : endHour;
    return `Must complete by ${displayHour}${period}`;
  };

  // Check if appointment is within 2 days
  const isWithinTwoDays = () => {
    const appointmentDate = new Date(appointment.date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = appointmentDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  };

  const showFullAddress = isWithinTwoDays();

  const totalPrice = Number(appointment.price);
  const payout = totalPrice * cleanerSharePercent;

  useEffect(() => {
    // Fetch home if not provided or incomplete
    if (!initialHome || !initialHome.address) {
      FetchData.getHome(appointment.homeId).then((response) => {
        if (response.home) {
          setHome(response.home);
        }
      });
    }
  }, [appointment.homeId, initialHome]);

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
    <View style={styles.tileContainer}>
      <Text style={styles.date}>{formatDate(appointment.date)}</Text>

      {appointment.timeToBeCompleted && (
        <View style={styles.timeWindowBadge}>
          <Icon name="clock-o" size={12} color={colors.primary[600]} />
          <Text style={styles.timeWindowText}>
            {formatTimeWindow(appointment.timeToBeCompleted)}
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
          <Text style={styles.detailValue}>{home.numBeds || "?"}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Baths</Text>
          <Text style={styles.detailValue}>{home.numBaths || "?"}</Text>
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
  date: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: "center",
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
