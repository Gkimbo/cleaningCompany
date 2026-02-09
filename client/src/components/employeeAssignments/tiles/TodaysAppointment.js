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
import {
  formatBedSizes,
  getEffectiveSheetConfigs,
  getEffectiveTowelConfigs,
  getTowelTotals,
  calculateLinensFromRoomCounts,
} from "../../../utils/linensUtils";
import TenantPresentModal from "../modals/TenantPresentModal";

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
  const [showTenantPresentModal, setShowTenantPresentModal] = useState(false);
  const [linensExpanded, setLinensExpanded] = useState(false);

  // Collapse submitted jobs by default
  const isSubmitted = appointment.completionStatus === "submitted" && !appointment.completed;
  const [isCollapsed, setIsCollapsed] = useState(isSubmitted);

  const formatDate = (dateString) => {
    const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
    return new Date(dateString + "T00:00:00").toLocaleDateString(undefined, options);
  };

  // Use multi-cleaner fee for multi-cleaner jobs, regular fee otherwise
  const isMultiCleanerJob = appointment.isMultiCleanerJob;
  const platformFeePercent = isMultiCleanerJob
    ? (pricing?.platform?.multiCleanerPlatformFeePercent || 0.13)
    : (pricing?.platform?.feePercent || 0.1);
  const cleanerSharePercent = 1 - platformFeePercent;
  const totalPrice = Number(appointment.price);
  // For multi-cleaner jobs, divide by number of cleaners
  const numCleaners = isMultiCleanerJob
    ? (appointment.multiCleanerJob?.totalCleanersRequired || appointment.employeesAssigned?.length || 1)
    : 1;
  const correctedAmount = (totalPrice / numCleaners) * cleanerSharePercent;

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

  const isMultiCleaner = appointment.isMultiCleanerJob;
  const multiCleanerJob = appointment.multiCleanerJob;
  const cleanerRoomAssignments = appointment.cleanerRoomAssignments;

  // Get effective sheet/towel configs (filtered for multi-cleaner jobs)
  const effectiveSheetConfigs = getEffectiveSheetConfigs(
    appointment.sheetConfigurations,
    cleanerRoomAssignments,
    isMultiCleaner
  );
  const effectiveTowelConfigs = getEffectiveTowelConfigs(
    appointment.towelConfigurations,
    cleanerRoomAssignments,
    isMultiCleaner
  );
  const towelTotals = getTowelTotals(effectiveTowelConfigs || []);

  // Calculate detailed linen requirements
  const bringSheets = appointment.bringSheets === "Yes" || appointment.bringSheets === "yes";
  const bringTowels = appointment.bringTowels === "Yes" || appointment.bringTowels === "yes";
  const needsLinens = bringSheets || bringTowels;

  // Get detailed breakdown when no specific configs exist
  const linenDetails = calculateLinensFromRoomCounts({
    assignedBedrooms: effectiveSheetConfigs?.length || parseInt(home.numBeds) || 0,
    assignedBathrooms: effectiveTowelConfigs?.length || parseInt(home.numBaths) || 0,
    bringSheets,
    bringTowels,
  });

  return (
    <>
      <View style={[
        styles.tileContainer,
        isMultiCleaner && styles.tileContainerMultiCleaner,
        isSubmitted && isCollapsed && styles.tileContainerCollapsed,
      ]}>
        {/* Header with status and team badge */}
        <TouchableOpacity
          style={styles.headerRow}
          onPress={isSubmitted ? () => setIsCollapsed(!isCollapsed) : undefined}
          activeOpacity={isSubmitted ? 0.7 : 1}
        >
          <View style={[
            styles.statusBadge,
            appointment.completed && styles.statusBadgeCompleted,
            appointment.completionStatus === "submitted" && !appointment.completed && styles.statusBadgePending,
            !appointment.completed && appointment.completionStatus !== "submitted" && styles.statusBadgeActive,
          ]}>
            <View style={[
              styles.statusDot,
              appointment.completed && styles.statusDotCompleted,
              appointment.completionStatus === "submitted" && !appointment.completed && styles.statusDotPending,
              !appointment.completed && appointment.completionStatus !== "submitted" && styles.statusDotActive,
            ]} />
            <Text style={[
              styles.statusText,
              appointment.completed && styles.statusTextCompleted,
              appointment.completionStatus === "submitted" && !appointment.completed && styles.statusTextPending,
              !appointment.completed && appointment.completionStatus !== "submitted" && styles.statusTextActive,
            ]}>
              {appointment.completed ? "Completed" : appointment.completionStatus === "submitted" ? "Pending Approval" : "Today"}
            </Text>
          </View>
          <View style={styles.headerRightSection}>
            {isMultiCleaner && (
              <View style={styles.teamBadge}>
                <Icon name="users" size={11} color={colors.primary[600]} />
                <Text style={styles.teamBadgeText}>Team</Text>
              </View>
            )}
            {isSubmitted && (
              <Icon
                name={isCollapsed ? "chevron-down" : "chevron-up"}
                size={14}
                color={colors.neutral[400]}
                style={styles.collapseIcon}
              />
            )}
          </View>
        </TouchableOpacity>

        {/* Collapsed View for Submitted Jobs */}
        {isSubmitted && isCollapsed ? (
          <TouchableOpacity
            style={styles.collapsedContent}
            onPress={() => setIsCollapsed(false)}
            activeOpacity={0.7}
          >
            <View style={styles.collapsedInfo}>
              <Text style={styles.collapsedAddress} numberOfLines={1}>
                {home.address}, {home.city}
              </Text>
              <Text style={styles.collapsedPayout}>${correctedAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.collapsedMessage}>
              <Icon name="clock-o" size={12} color={colors.warning[500]} />
              <Text style={styles.collapsedMessageText}>Awaiting homeowner approval</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            {/* Date - Hero element */}
            <Text style={styles.date}>{formatDate(appointment.date)}</Text>

        {/* Payout - Prominent */}
        <View style={styles.payoutContainer}>
          <Text style={styles.payoutLabel}>Your Payout</Text>
          <Text style={styles.payoutAmount}>${correctedAmount.toFixed(2)}</Text>
        </View>

        {/* Multi-Cleaner Status */}
        {isMultiCleaner && multiCleanerJob && (
          <View style={styles.multiCleanerBanner}>
            <View style={styles.multiCleanerStats}>
              <View style={styles.multiCleanerStatItem}>
                <Text style={styles.multiCleanerStatValue}>
                  {multiCleanerJob.cleanersConfirmed}/{multiCleanerJob.totalCleanersRequired}
                </Text>
                <Text style={styles.multiCleanerStatLabel}>Team Members</Text>
              </View>
              {multiCleanerJob.cleanersConfirmed >= multiCleanerJob.totalCleanersRequired ? (
                <View style={styles.teamStatusComplete}>
                  <Icon name="check" size={10} color={colors.success[600]} />
                  <Text style={styles.teamStatusCompleteText}>Ready</Text>
                </View>
              ) : (
                <View style={styles.teamStatusPending}>
                  <Text style={styles.teamStatusPendingText}>
                    +{multiCleanerJob.totalCleanersRequired - multiCleanerJob.cleanersConfirmed} needed
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Address Card */}
        <TouchableOpacity
          style={styles.addressCard}
          onPress={handleAddressPress}
          activeOpacity={0.7}
        >
          <View style={styles.addressIconContainer}>
            <Icon name="map-marker" size={18} color={colors.primary[600]} />
          </View>
          <View style={styles.addressContent}>
            <Text style={styles.addressStreet}>{home.address}</Text>
            <Text style={styles.addressCity}>{home.city}, {home.state} {home.zipcode}</Text>
          </View>
          <View style={styles.directionsChevron}>
            <Icon name="chevron-right" size={14} color={colors.neutral[400]} />
          </View>
        </TouchableOpacity>

        {/* Access Info */}
        {(home.keyPadCode || home.keyLocation) && (
          <View style={styles.accessCard}>
            <View style={styles.accessHeader}>
              <Icon name="key" size={12} color={colors.neutral[500]} />
              <Text style={styles.accessTitle}>Access Info</Text>
            </View>
            {home.keyPadCode && (
              <View style={styles.accessRow}>
                <Text style={styles.accessLabel}>Code</Text>
                <Text style={styles.accessValue}>{home.keyPadCode}</Text>
              </View>
            )}
            {home.keyLocation && (
              <View style={styles.accessRow}>
                <Text style={styles.accessLabel}>Key</Text>
                <Text style={styles.accessValue}>{home.keyLocation}</Text>
              </View>
            )}
          </View>
        )}

        {/* Property Details */}
        <View style={styles.propertyCard}>
          <View style={styles.propertyItem}>
            <Icon name="bed" size={16} color={colors.neutral[400]} />
            <Text style={styles.propertyValue}>{home.numBeds}</Text>
            <Text style={styles.propertyLabel}>Beds</Text>
          </View>
          <View style={styles.propertyDivider} />
          <View style={styles.propertyItem}>
            <Icon name="bath" size={16} color={colors.neutral[400]} />
            <Text style={styles.propertyValue}>{home.numBaths}</Text>
            <Text style={styles.propertyLabel}>Baths</Text>
          </View>
        </View>

        {/* Contact Homeowner */}
        {!appointment.completed && (
          <View style={styles.contactCard}>
            <View style={styles.contactInfo}>
              <Icon name="comment-o" size={16} color={colors.neutral[500]} />
              <Text style={styles.contactLabel}>Contact Homeowner</Text>
            </View>
            <StartConversationButton
              appointmentId={appointment.id}
              token={token}
              style={styles.contactButton}
              textStyle={styles.contactButtonText}
            />
          </View>
        )}

        {/* Review Section */}
        {appointment.completed && !hasReviewed && (
          <TouchableOpacity
            style={styles.reviewCard}
            onPress={() => setShowReviewModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.reviewInfo}>
              <Icon name="star-o" size={16} color={colors.warning[500]} />
              <Text style={styles.reviewLabel}>Rate your experience</Text>
            </View>
            <View style={styles.reviewButton}>
              <Text style={styles.reviewButtonText}>Review</Text>
              <Icon name="chevron-right" size={12} color={colors.warning[600]} />
            </View>
          </TouchableOpacity>
        )}

        {appointment.completed && hasReviewed && (
          <View style={styles.reviewedBadge}>
            <Icon name="check-circle" size={14} color={colors.success[500]} />
            <Text style={styles.reviewedText}>Review submitted</Text>
          </View>
        )}

        {/* Linens Section - Collapsible */}
        <View style={styles.linensContainer}>
          <TouchableOpacity
            style={styles.linensHeaderTouchable}
            onPress={() => setLinensExpanded(!linensExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.linensHeaderLeft}>
              <Icon name="th-large" size={14} color={colors.primary[600]} />
              <Text style={styles.linensTitle}>Linens</Text>
              {needsLinens && (
                <View style={styles.linensBadge}>
                  <Icon name="exclamation-circle" size={10} color={colors.warning[700]} />
                  <Text style={styles.linensBadgeText}>Bring</Text>
                </View>
              )}
            </View>
            <View style={styles.linensHeaderRight}>
              {!needsLinens && (
                <Text style={styles.linensProvidedBadge}>Provided</Text>
              )}
              <Icon
                name={linensExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={colors.neutral[500]}
              />
            </View>
          </TouchableOpacity>

          {linensExpanded && (
            <>
              {needsLinens ? (
                <View style={styles.linensContent}>
                  <View style={styles.bringLinensAlert}>
                    <Icon name="exclamation-circle" size={14} color={colors.warning[600]} />
                    <Text style={styles.bringLinensText}>You need to bring:</Text>
                  </View>

                  {/* Sheet Details */}
                  {bringSheets && (
                    <View style={styles.linensSection}>
                      <Text style={styles.linensSectionTitle}>Sheets</Text>
                      {effectiveSheetConfigs && effectiveSheetConfigs.length > 0 ? (
                        <View style={styles.linensItemsRow}>
                          {effectiveSheetConfigs.map((bed, index) => (
                            <View key={index} style={styles.linensDetailItem}>
                              <Icon name="check" size={10} color={colors.warning[600]} />
                              <Text style={styles.linensDetailText}>
                                Bed {bed.bedNumber}: {(bed.size || "Standard").split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} (fitted, flat, pillowcases)
                              </Text>
                            </View>
                          ))}
                          <View style={styles.linensTotalRow}>
                            <Text style={styles.linensTotalText}>
                              Total: {formatBedSizes(effectiveSheetConfigs)}
                            </Text>
                          </View>
                          {isMultiCleaner && cleanerRoomAssignments?.length > 0 && (
                            <Text style={styles.linensAssignedNote}>
                              (Your assigned bedrooms)
                            </Text>
                          )}
                        </View>
                      ) : (
                        <View style={styles.linensItemsRow}>
                          <View style={styles.linensDetailItem}>
                            <Icon name="check" size={10} color={colors.warning[600]} />
                            <Text style={styles.linensDetailText}>
                              {linenDetails.sheetsText || `${home.numBeds || 1} sheet set${(home.numBeds || 1) !== 1 ? "s" : ""} (fitted, flat, pillowcases)`}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Towel Details */}
                  {bringTowels && (
                    <View style={styles.linensSection}>
                      <Text style={styles.linensSectionTitle}>Towels</Text>
                      {effectiveTowelConfigs && effectiveTowelConfigs.length > 0 ? (
                        <View style={styles.linensItemsRow}>
                          {effectiveTowelConfigs.map((bath, index) => (
                            <View key={index} style={styles.linensDetailItem}>
                              <Icon name="check" size={10} color={colors.warning[600]} />
                              <Text style={styles.linensDetailText}>
                                Bathroom {bath.bathroomNumber}: {bath.towels || 0} bath towel{(bath.towels || 0) !== 1 ? "s" : ""}, {bath.handTowels || 1} hand towel{(bath.handTowels || 1) !== 1 ? "s" : ""}, {bath.faceCloths || 0} washcloth{(bath.faceCloths || 0) !== 1 ? "s" : ""}
                              </Text>
                            </View>
                          ))}
                          <View style={styles.linensTotalRow}>
                            <Text style={styles.linensTotalText}>
                              Total: {towelTotals.towels} bath towels, {towelTotals.faceCloths} washcloths
                            </Text>
                          </View>
                          {isMultiCleaner && cleanerRoomAssignments?.length > 0 && (
                            <Text style={styles.linensAssignedNote}>
                              (Your assigned bathrooms)
                            </Text>
                          )}
                        </View>
                      ) : (
                        <View style={styles.linensItemsRow}>
                          <View style={styles.linensDetailItem}>
                            <Icon name="check" size={10} color={colors.warning[600]} />
                            <Text style={styles.linensDetailText}>
                              {linenDetails.towelsText || `${(parseInt(home.numBaths) || 1) * 2} bath towels, ${parseInt(home.numBaths) || 1} hand towels, ${(parseInt(home.numBaths) || 1) * 2} washcloths`}
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
            </>
          )}
        </View>

        {/* Special Notes */}
        {home.specialNotes && (
          <View style={styles.notesCard}>
            <View style={styles.notesHeader}>
              <Icon name="sticky-note-o" size={12} color={colors.neutral[500]} />
              <Text style={styles.notesTitle}>Notes</Text>
            </View>
            <Text style={styles.notesText}>{home.specialNotes}</Text>
          </View>
        )}

        {/* Action Buttons */}
        {/* Awaiting Approval State - job submitted but not yet approved */}
        {appointment.completionStatus === "submitted" && !appointment.completed && (
          <View style={styles.awaitingApprovalBadge}>
            <Icon name="clock-o" size={16} color={colors.warning[600]} />
            <View style={styles.awaitingApprovalText}>
              <Text style={styles.awaitingApprovalTitle}>Awaiting Approval</Text>
              <Text style={styles.awaitingApprovalSubtext}>Homeowner will review your work</Text>
            </View>
          </View>
        )}

        {/* Start Job - only show if not submitted and not completed */}
        {!appointment.completed && !jobStarted && appointment.completionStatus !== "submitted" && (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.reportButton}
              onPress={() => setShowTenantPresentModal(true)}
              activeOpacity={0.7}
            >
              <Icon name="exclamation-circle" size={14} color={colors.neutral[500]} />
              <Text style={styles.reportButtonText}>Report Issue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleStartJob}
              activeOpacity={0.8}
            >
              <Icon name="play" size={14} color={colors.neutral[0]} />
              <Text style={styles.primaryButtonText}>Start Job</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Continue Job - only show if job started, not submitted, not completed */}
        {jobStarted && !appointment.completed && appointment.completionStatus !== "submitted" && (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleUndoStart}
              activeOpacity={0.7}
            >
              <Icon name="undo" size={12} color={colors.neutral[600]} />
              <Text style={styles.secondaryButtonText}>Undo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowCompletionFlow(true)}
              activeOpacity={0.8}
            >
              <Icon name="arrow-right" size={14} color={colors.neutral[0]} />
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {appointment.completed && (
          <View style={styles.completedBadge}>
            <Icon name="check-circle" size={16} color={colors.success[500]} />
            <Text style={styles.completedBadgeText}>Completed</Text>
          </View>
        )}
          </>
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

      {/* Tenant Present Modal */}
      <TenantPresentModal
        visible={showTenantPresentModal}
        onClose={() => setShowTenantPresentModal(false)}
        appointment={appointment}
        home={home}
        token={token}
        onCancelled={() => {
          setShowTenantPresentModal(false);
          if (onJobCompleted) {
            onJobCompleted({ cancelled: true, reason: "tenant_present" });
          }
        }}
        onProceeding={() => {
          setShowTenantPresentModal(false);
          // Cleaner can now start the job
        }}
      />

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
  // Main Container
  tileContainer: {
    backgroundColor: colors.neutral[0],
    padding: spacing.xl,
    marginVertical: spacing.md,
    borderRadius: radius.xl,
    ...shadows.lg,
  },
  tileContainerMultiCleaner: {
    borderTopWidth: 3,
    borderTopColor: colors.primary[500],
  },
  tileContainerCollapsed: {
    paddingBottom: spacing.lg,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  headerRightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  collapseIcon: {
    marginLeft: spacing.xs,
  },

  // Collapsed Content
  collapsedContent: {
    marginTop: -spacing.sm,
  },
  collapsedInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  collapsedAddress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.md,
  },
  collapsedPayout: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  collapsedMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  collapsedMessageText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: 6,
  },
  statusBadgeActive: {
    backgroundColor: colors.primary[50],
  },
  statusBadgeCompleted: {
    backgroundColor: colors.success[50],
  },
  statusBadgePending: {
    backgroundColor: colors.warning[50],
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: colors.primary[500],
  },
  statusDotCompleted: {
    backgroundColor: colors.success[500],
  },
  statusDotPending: {
    backgroundColor: colors.warning[500],
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusTextActive: {
    color: colors.primary[700],
  },
  statusTextCompleted: {
    color: colors.success[700],
  },
  statusTextPending: {
    color: colors.warning[700],
  },
  teamBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
  },
  teamBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },

  // Date
  date: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },

  // Payout
  payoutContainer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  payoutLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  payoutAmount: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },

  // Multi-Cleaner
  multiCleanerBanner: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  multiCleanerStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  multiCleanerStatItem: {
    alignItems: "flex-start",
  },
  multiCleanerStatValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  multiCleanerStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
  teamStatusComplete: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
  },
  teamStatusCompleteText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[600],
  },
  teamStatusPending: {
    backgroundColor: colors.warning[50],
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  teamStatusPendingText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[600],
  },

  // Address Card
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  addressIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  addressContent: {
    flex: 1,
  },
  addressStreet: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  addressCity: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
  directionsChevron: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  // Access Card
  accessCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  accessHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  accessTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  accessRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  accessLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    width: 50,
  },
  accessValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },

  // Property Card
  propertyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  propertyItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  propertyValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  propertyLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
  propertyDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing.lg,
  },

  // Contact Card
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  contactInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  contactLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
  },
  contactButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 0,
  },
  contactButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  // Review Card
  reviewCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reviewInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  reviewLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
  },
  reviewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[600],
  },
  reviewedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  reviewedText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
  },

  // Linens
  linensContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  linensHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  linensHeaderTouchable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  linensHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  linensHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  linensBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  linensBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  linensProvidedBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[600],
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  linensTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[700],
  },
  linensContent: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: spacing.sm,
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
  linensAssignedNote: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
  linensProvidedContent: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: spacing.sm,
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

  // Notes Card
  notesCard: {
    backgroundColor: colors.secondary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  notesTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  // Action Buttons
  actionContainer: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  primaryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  secondaryButtonText: {
    color: colors.neutral[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  reportButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  reportButtonText: {
    color: colors.neutral[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  // Completed Badge
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success[50],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  completedBadgeText: {
    color: colors.success[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  // Awaiting Approval Badge
  awaitingApprovalBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  awaitingApprovalText: {
    flex: 1,
  },
  awaitingApprovalTitle: {
    color: colors.warning[700],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  awaitingApprovalSubtext: {
    color: colors.warning[600],
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },

  // Review Modal
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
});

export default TodaysAppointment;
