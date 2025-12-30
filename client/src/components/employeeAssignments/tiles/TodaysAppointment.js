import React, { useEffect, useState, useContext } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Linking,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import FetchData from "../../../services/fetchRequests/fetchData";
import JobCompletionFlow from "../jobPhotos/JobCompletionFlow";
import { clearChecklistProgress } from "../jobPhotos/CleaningChecklist";
import HomeSizeConfirmationModal from "../HomeSizeConfirmationModal";
import StartConversationButton from "../../messaging/StartConversationButton";
import MultiAspectReviewForm from "../../reviews/MultiAspectReviewForm";
import { colors, spacing, radius, shadows, typography } from "../../../services/styles/theme";
import { usePricing } from "../../../context/PricingContext";
import { UserContext } from "../../../context/UserContext";
import Icon from "react-native-vector-icons/FontAwesome";

const TodaysAppointment = ({ appointment, onJobCompleted, onJobUnstarted, token }) => {
  const { state } = useContext(UserContext);
  const { pricing } = usePricing();
  const [jobStarted, setJobStarted] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(appointment.hasCleanerReview || false);
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
    cleanSheetsLocation: "",
    dirtySheetsLocation: "",
    cleanTowelsLocation: "",
    dirtyTowelsLocation: "",
  });
  const [showCompletionFlow, setShowCompletionFlow] = useState(false);
  const [showHomeSizeModal, setShowHomeSizeModal] = useState(false);

  const formatDate = (dateString) => {
    const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
    return new Date(dateString + "T00:00:00").toLocaleDateString(undefined, options);
  };

  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const totalPrice = Number(appointment.price);
  const correctedAmount = totalPrice * cleanerSharePercent;

  useEffect(() => {
    FetchData.getHome(appointment.homeId).then((response) => {
      setHome(response.home);
    });
  }, [appointment.homeId]);

  // Sync hasReviewed state with appointment prop
  useEffect(() => {
    if (appointment.hasCleanerReview) {
      setHasReviewed(true);
    }
  }, [appointment.hasCleanerReview]);

  // Check if job has been started (before photos taken but not completed)
  useEffect(() => {
    const checkStartedStatus = async () => {
      try {
        const response = await FetchData.get(
          `/api/v1/job-photos/${appointment.id}/status`,
          token
        );
        // Job is "started" if before photos exist but not completed
        setJobStarted(response.hasBeforePhotos && !appointment.completed);
      } catch (err) {
        // Assume not started if check fails
      }
    };
    if (token && appointment.id) {
      checkStartedStatus();
    }
  }, [appointment.id, appointment.completed, token]);

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

  const handleCancelCompletion = async () => {
    setShowCompletionFlow(false);
    // Re-check job status after closing the modal in case photos were taken
    try {
      const response = await FetchData.get(
        `/api/v1/job-photos/${appointment.id}/status`,
        token
      );
      setJobStarted(response.hasBeforePhotos && !appointment.completed);
    } catch (err) {
      // Keep current state if check fails
    }
  };

  const handleUndoStart = () => {
    Alert.alert(
      "Undo Start Job",
      "Are you sure you want to undo starting this job? This will delete any photos taken.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Undo Start",
          style: "destructive",
          onPress: async () => {
            try {
              await FetchData.post(
                `/api/v1/appointments/${appointment.id}/unstart`,
                {},
                token
              );
              // Clear saved checklist progress
              await clearChecklistProgress(appointment.id);
              setJobStarted(false);
              setShowCompletionFlow(false);
              if (onJobUnstarted) onJobUnstarted(appointment.id);
            } catch (err) {
              Alert.alert("Error", "Could not undo start. Please try again.");
            }
          },
        },
      ]
    );
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
            <Text style={styles.detailLabel}>Beds</Text>
            <Text style={styles.detailValue}>{home.numBeds}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Baths</Text>
            <Text style={styles.detailValue}>{home.numBaths}</Text>
          </View>
        </View>

        {/* Message Homeowner Button - only show when job not completed */}
        {!appointment.completed && (
          <View style={styles.messageHomeownerContainer}>
            <Icon name="comment" size={16} color={colors.primary[600]} />
            <Text style={styles.messageHomeownerLabel}>Contact Homeowner</Text>
            <StartConversationButton
              appointmentId={appointment.id}
              token={token}
              style={styles.messageHomeownerButton}
              textStyle={styles.messageHomeownerButtonText}
            />
          </View>
        )}

        {/* Review Homeowner Button - only show when job is completed */}
        {appointment.completed && !hasReviewed && (
          <TouchableOpacity
            style={styles.reviewHomeownerContainer}
            onPress={() => setShowReviewModal(true)}
          >
            <Icon name="star" size={16} color={colors.warning[600]} />
            <Text style={styles.reviewHomeownerLabel}>Review Homeowner</Text>
            <View style={styles.reviewHomeownerButton}>
              <Text style={styles.reviewHomeownerButtonText}>Leave Review</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Review Submitted Banner */}
        {appointment.completed && hasReviewed && (
          <View style={styles.reviewSubmittedContainer}>
            <Icon name="check-circle" size={16} color={colors.success[600]} />
            <Text style={styles.reviewSubmittedText}>Review Submitted</Text>
          </View>
        )}

        {/* Linens Section */}
        <View style={styles.linensContainer}>
          <View style={styles.linensHeader}>
            <Icon name="th-large" size={14} color={colors.primary[600]} />
            <Text style={styles.linensTitle}>Linens</Text>
          </View>
          {appointment.bringSheets === "Yes" || appointment.bringSheets === "yes" ||
           appointment.bringTowels === "Yes" || appointment.bringTowels === "yes" ? (
            <View style={styles.linensContent}>
              <View style={styles.bringLinensAlert}>
                <Icon name="exclamation-circle" size={14} color={colors.warning[600]} />
                <Text style={styles.bringLinensText}>You need to bring:</Text>
              </View>

              {/* Sheet Details */}
              {(appointment.bringSheets === "Yes" || appointment.bringSheets === "yes") && (
                <View style={styles.linensSection}>
                  <Text style={styles.linensSectionTitle}>Sheets</Text>
                  {appointment.sheetConfigurations && appointment.sheetConfigurations.length > 0 ? (
                    <View style={styles.linensItemsRow}>
                      {appointment.sheetConfigurations.filter(bed => bed.needsSheets !== false).map((bed, index) => (
                        <View key={index} style={styles.linensDetailItem}>
                          <Icon name="check" size={10} color={colors.warning[600]} />
                          <Text style={styles.linensDetailText}>
                            Bed {bed.bedNumber}: {bed.size ? bed.size.charAt(0).toUpperCase() + bed.size.slice(1) : "Standard"} sheets
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.linensItemsRow}>
                      <View style={styles.linensDetailItem}>
                        <Icon name="check" size={10} color={colors.warning[600]} />
                        <Text style={styles.linensDetailText}>
                          {home.numBeds || "All"} set{home.numBeds !== "1" ? "s" : ""} of sheets
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Towel Details */}
              {(appointment.bringTowels === "Yes" || appointment.bringTowels === "yes") && (
                <View style={styles.linensSection}>
                  <Text style={styles.linensSectionTitle}>Towels</Text>
                  {appointment.towelConfigurations && appointment.towelConfigurations.length > 0 ? (
                    <View style={styles.linensItemsRow}>
                      {appointment.towelConfigurations.map((bath, index) => (
                        <View key={index} style={styles.linensDetailItem}>
                          <Icon name="check" size={10} color={colors.warning[600]} />
                          <Text style={styles.linensDetailText}>
                            Bathroom {bath.bathroomNumber}: {bath.towels || 0} towel{(bath.towels || 0) !== 1 ? "s" : ""}, {bath.faceCloths || 0} washcloth{(bath.faceCloths || 0) !== 1 ? "s" : ""}
                          </Text>
                        </View>
                      ))}
                      <View style={styles.linensTotalRow}>
                        <Text style={styles.linensTotalText}>
                          Total: {appointment.towelConfigurations.reduce((sum, b) => sum + (b.towels || 0), 0)} towels, {appointment.towelConfigurations.reduce((sum, b) => sum + (b.faceCloths || 0), 0)} washcloths
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.linensItemsRow}>
                      <View style={styles.linensDetailItem}>
                        <Icon name="check" size={10} color={colors.warning[600]} />
                        <Text style={styles.linensDetailText}>
                          Towels for {home.numBaths || "all"} bathroom{home.numBaths !== "1" ? "s" : ""}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.linensProvidedContent}>
              <View style={styles.linensProvidedHeader}>
                <Icon name="check-circle" size={14} color={colors.success[600]} />
                <Text style={styles.linensProvidedText}>
                  Linens provided by homeowner
                </Text>
              </View>

              {/* Sheets Location Info */}
              {(home.cleanSheetsLocation || home.dirtySheetsLocation) && (
                <View style={styles.linenLocationSection}>
                  <Text style={styles.linenLocationTitle}>Sheets</Text>
                  {home.cleanSheetsLocation && (
                    <View style={styles.linenLocationRow}>
                      <Icon name="inbox" size={12} color={colors.primary[600]} />
                      <Text style={styles.linenLocationLabel}>Clean:</Text>
                      <Text style={styles.linenLocationValue}>{home.cleanSheetsLocation}</Text>
                    </View>
                  )}
                  {home.dirtySheetsLocation && (
                    <View style={styles.linenLocationRow}>
                      <Icon name="archive" size={12} color={colors.warning[600]} />
                      <Text style={styles.linenLocationLabel}>Dirty:</Text>
                      <Text style={styles.linenLocationValue}>{home.dirtySheetsLocation}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Towels Location Info */}
              {(home.cleanTowelsLocation || home.dirtyTowelsLocation) && (
                <View style={styles.linenLocationSection}>
                  <Text style={styles.linenLocationTitle}>Towels</Text>
                  {home.cleanTowelsLocation && (
                    <View style={styles.linenLocationRow}>
                      <Icon name="inbox" size={12} color={colors.primary[600]} />
                      <Text style={styles.linenLocationLabel}>Clean:</Text>
                      <Text style={styles.linenLocationValue}>{home.cleanTowelsLocation}</Text>
                    </View>
                  )}
                  {home.dirtyTowelsLocation && (
                    <View style={styles.linenLocationRow}>
                      <Icon name="archive" size={12} color={colors.warning[600]} />
                      <Text style={styles.linenLocationLabel}>Dirty:</Text>
                      <Text style={styles.linenLocationValue}>{home.dirtyTowelsLocation}</Text>
                    </View>
                  )}
                </View>
              )}
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

        {!appointment.completed && !jobStarted && (
          <TouchableOpacity style={styles.startButton} onPress={handleStartJob}>
            <Text style={styles.startButtonText}>Start Job</Text>
          </TouchableOpacity>
        )}

        {jobStarted && !appointment.completed && (
          <View style={styles.startedButtonsContainer}>
            <TouchableOpacity style={styles.continueButton} onPress={() => setShowCompletionFlow(true)}>
              <Text style={styles.continueButtonText}>Continue Job</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.undoButton} onPress={handleUndoStart}>
              <Icon name="undo" size={14} color={colors.warning[600]} />
              <Text style={styles.undoButtonText}>Undo Start</Text>
            </TouchableOpacity>
          </View>
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

      {/* Review Homeowner Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.reviewModalContainer}>
          <View style={styles.reviewModalHeader}>
            <TouchableOpacity
              onPress={() => setShowReviewModal(false)}
              style={styles.reviewModalCloseButton}
            >
              <Icon name="times" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.reviewModalTitle}>Review Homeowner</Text>
            <View style={styles.reviewModalCloseButton} />
          </View>
          <ScrollView style={styles.reviewModalContent}>
            <MultiAspectReviewForm
              state={state}
              appointmentId={appointment.id}
              userId={appointment.userId}
              reviewType="cleaner_to_homeowner"
              revieweeName={home.nickName || "Homeowner"}
              onComplete={(data) => {
                setShowReviewModal(false);
                setHasReviewed(true);
                // Use setTimeout to ensure the modal is fully closed before showing the alert
                setTimeout(() => {
                  const bothReviewed = data?.status?.bothReviewed;
                  Alert.alert(
                    "Thank you!",
                    bothReviewed
                      ? "Both reviews are now visible to each other."
                      : "Your review has been submitted. It will become visible once the homeowner submits their review."
                  );
                }, 300);
              }}
            />
          </ScrollView>
        </View>
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
  messageHomeownerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  messageHomeownerLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
    marginLeft: spacing.sm,
  },
  messageHomeownerButton: {
    backgroundColor: colors.primary[500],
    borderWidth: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  messageHomeownerButtonText: {
    color: colors.neutral[0],
  },
  reviewHomeownerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  reviewHomeownerLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
    marginLeft: spacing.sm,
  },
  reviewHomeownerButton: {
    backgroundColor: colors.warning[500],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  reviewHomeownerButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  reviewSubmittedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  reviewSubmittedText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[700],
    marginLeft: spacing.sm,
  },
  reviewModalContainer: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  reviewModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  reviewModalCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewModalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  reviewModalContent: {
    flex: 1,
  },
  linensContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    width: "100%",
  },
  linensHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  linensTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  linensContent: {
    gap: spacing.sm,
  },
  bringLinensAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  bringLinensText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  linensSection: {
    marginTop: spacing.sm,
    backgroundColor: colors.warning[50],
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  linensSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
    marginBottom: spacing.xs,
  },
  linensItemsRow: {
    gap: spacing.xs,
  },
  linensDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 2,
  },
  linensDetailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  linensTotalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.warning[200],
  },
  linensTotalText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  linensProvidedContent: {
    gap: spacing.sm,
  },
  linensProvidedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  linensProvidedText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  linenLocationSection: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  linenLocationTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  linenLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 2,
  },
  linenLocationLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    width: 40,
  },
  linenLocationValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    flex: 1,
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
  startedButtonsContainer: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  continueButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.md,
  },
  continueButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  undoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning[300],
    backgroundColor: colors.warning[50],
    gap: spacing.xs,
  },
  undoButtonText: {
    color: colors.warning[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
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
