import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Linking,
  Alert,
  Platform,
} from "react-native";
import FetchData from "../../../services/fetchRequests/fetchData";
import JobCompletionFlow from "../jobPhotos/JobCompletionFlow";
import HomeSizeConfirmationModal from "../HomeSizeConfirmationModal";
import { colors, spacing, radius, shadows, typography } from "../../../services/styles/theme";
import { usePricing } from "../../../context/PricingContext";
import Icon from "react-native-vector-icons/FontAwesome";

const TodaysAppointment = ({ appointment, onJobCompleted, token }) => {
  const { pricing } = usePricing();
  const [home, setHome] = useState({
    address: "",
    city: "",
    compostLocation: "",
    contact: "",
    keyLocation: "",
    keyPadCode: "",
    numBaths: "",
    numBeds: "",
    recyclingLocation: "",
    sheetsProvided: "",
    specialNotes: "",
    state: "",
    towelsProvided: "",
    trashLocation: "",
    zipcode: "",
    cleanersNeeded: "",
    timeToBeCompleted: "",
  });
  const [showCompletionFlow, setShowCompletionFlow] = useState(false);
  const [showHomeSizeModal, setShowHomeSizeModal] = useState(false);

  const formatDate = (dateString) => {
    const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const totalPrice = Number(appointment.price);
  const correctedAmount = totalPrice * cleanerSharePercent;

  useEffect(() => {
    FetchData.getHome(appointment.homeId).then((response) => {
      setHome(response.home);
    });
  }, [appointment.homeId]);

  const handleStartJob = () => {
    // Show home size confirmation modal before starting job
    setShowHomeSizeModal(true);
  };

  const handleHomeSizeConfirmed = () => {
    // Close confirmation modal and proceed to job completion flow
    setShowHomeSizeModal(false);
    setShowCompletionFlow(true);
  };

  const handleHomeSizeModalClose = () => {
    setShowHomeSizeModal(false);
  };

  const handleAdjustmentReportSubmitted = (result) => {
    // Adjustment request was submitted - can show a toast or log
    console.log("[TodaysAppointment] Home size adjustment submitted:", result);
  };

  const handleJobCompleted = (data) => {
    setShowCompletionFlow(false);
    if (onJobCompleted) {
      onJobCompleted(data);
    }
  };

  const handleCancelCompletion = () => {
    setShowCompletionFlow(false);
  };

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
          // Fallback to Google Maps web if app not available
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
    <>
      <View style={styles.tileContainer}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {appointment.completed ? "Completed" : "In Progress"}
          </Text>
        </View>

        <Text style={styles.date}>{formatDate(appointment.date)}</Text>

        <TouchableOpacity
          style={styles.addressContainer}
          onPress={handleAddressPress}
          activeOpacity={0.7}
        >
          <View style={styles.addressTextContainer}>
            <Text style={styles.addressText}>{home.address}</Text>
            <Text style={styles.addressText}>{home.city}, {home.state} {home.zipcode}</Text>
          </View>
          <View style={styles.directionsButton}>
            <Icon name="map-marker" size={16} color={colors.neutral[0]} />
            <Text style={styles.directionsText}>Directions</Text>
          </View>
        </TouchableOpacity>

        {home.keyPadCode && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Code:</Text>
            <Text style={styles.infoValue}>{home.keyPadCode}</Text>
          </View>
        )}
        {home.keyLocation && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Key Location:</Text>
            <Text style={styles.infoValue}>{home.keyLocation}</Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Contact</Text>
            <Text style={styles.detailValue}>{home.contact}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Beds</Text>
            <Text style={styles.detailValue}>{home.numBeds}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Baths</Text>
            <Text style={styles.detailValue}>{home.numBaths}</Text>
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

        <Text style={styles.amount}>Payout: ${correctedAmount.toFixed(2)}</Text>

        {home.specialNotes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Special Notes:</Text>
            <Text style={styles.notes}>{home.specialNotes}</Text>
          </View>
        )}

        {!appointment.completed && (
          <TouchableOpacity style={styles.startButton} onPress={handleStartJob}>
            <Text style={styles.startButtonText}>Start Job</Text>
          </TouchableOpacity>
        )}

        {appointment.completed && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedText}>Job Completed</Text>
          </View>
        )}
      </View>

      <HomeSizeConfirmationModal
        visible={showHomeSizeModal}
        onClose={handleHomeSizeModalClose}
        onConfirm={handleHomeSizeConfirmed}
        onReportSubmitted={handleAdjustmentReportSubmitted}
        home={home}
        appointment={appointment}
        token={token}
      />

      <Modal
        visible={showCompletionFlow}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <JobCompletionFlow
          appointment={appointment}
          home={home}
          onJobCompleted={handleJobCompleted}
          onCancel={handleCancelCompletion}
        />
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  tileContainer: {
    backgroundColor: colors.neutral[0],
    padding: spacing.lg,
    marginVertical: spacing.md,
    borderRadius: radius.xl,
    ...shadows.md,
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  date: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  addressContainer: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[200],
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
  location: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginRight: spacing.xs,
  },
  infoValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.lg,
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
  amount: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
    marginTop: spacing.sm,
    textAlign: "center",
  },
  notesContainer: {
    backgroundColor: colors.secondary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
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
  startButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.lg,
    ...shadows.md,
  },
  startButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  completedBanner: {
    backgroundColor: colors.success[100],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  completedText: {
    color: colors.success[700],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});

export default TodaysAppointment;
