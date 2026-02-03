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
import {
  formatBedSizes,
  getEffectiveSheetConfigs,
  getEffectiveTowelConfigs,
  getTowelTotals,
} from "../../../utils/linensUtils";

const EmployeeAssignmentTile = ({
  id,
  cleanerId,
  date,
  price,
  homeId,
  bringSheets,
  bringTowels,
  sheetConfigurations,
  towelConfigurations,
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
  isPreferred = false,
  isRequesting = false,
  isMultiCleanerJob = false,
  multiCleanerJob = null,
  employeesAssigned = [],
  cleanerRoomAssignments = null,
}) => {
  const navigate = useNavigate();
  const { pricing } = usePricing();
  const [expandWindow, setExpandWindow] = useState(false);

  // Normalize linen values to handle case-insensitivity ("yes", "Yes", "YES")
  const needsSheets = bringSheets?.toLowerCase() === "yes";
  const needsTowels = bringTowels?.toLowerCase() === "yes";
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
  const [showLinensDetails, setShowLinensDetails] = useState(false);

  // Use multi-cleaner fee for multi-cleaner jobs, regular fee otherwise
  const platformFeePercent = isMultiCleanerJob
    ? (pricing?.platform?.multiCleanerPlatformFeePercent || 0.13)
    : (pricing?.platform?.feePercent || 0.1);
  const cleanerSharePercent = 1 - platformFeePercent;
  // For multi-cleaner jobs, split by number of cleaners
  const numCleaners = isMultiCleanerJob
    ? (multiCleanerJob?.totalCleanersRequired || employeesAssigned?.length || 1)
    : 1;
  // Price is stored in dollars
  const amount = (Number(price) / numCleaners) * cleanerSharePercent;

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
    // Within a week - green
    if (diffDays <= 7) return { label: `In ${diffDays} days`, color: colors.success[600], bgColor: colors.success[50], icon: "calendar" };
    // Within a month - yellow
    if (diffDays <= 30) return { label: `In ${diffDays} days`, color: colors.warning[600], bgColor: colors.warning[50], icon: "calendar" };
    // Further than a month - grey
    return { label: `In ${diffDays} days`, color: colors.text.secondary, bgColor: colors.neutral[100], icon: "calendar-o" };
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

  const isWithinOneDay = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(date + "T00:00:00");
    const diffTime = appointmentDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 1; // Today or tomorrow
  };

  const formatTimeWindow = (time) => {
    if (!time) return null;
    if (time.toLowerCase() === "anytime") {
      return isToday() ? "Complete anytime today" : "Anytime";
    }

    // Helper to format hour to time string
    const formatHour = (hour) => {
      const h = Math.floor(hour);
      const minutes = Math.round((hour - h) * 60);
      const period = h >= 12 ? "pm" : "am";
      const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      if (minutes > 0) {
        return `${displayHour}:${minutes.toString().padStart(2, '0')}${period}`;
      }
      return `${displayHour}${period}`;
    };

    // Check if it's already a time range like "10-3" or "10am-3pm"
    if (time.includes("-")) {
      return time; // Already formatted as a range
    }

    // Check if it's a number of hours (e.g., "3", "2.5")
    const hours = parseFloat(time);
    if (!isNaN(hours)) {
      // Convert hours to a time window assuming 10am start
      const startHour = 10;
      const endHour = startHour + hours;
      return `${formatHour(startHour)} - ${formatHour(endHour)}`;
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

  // Get accent color based on status for left border
  const getAccentColor = () => {
    // Multi-cleaner jobs always use primary color
    if (isMultiCleanerJob && !completed) return colors.primary[600];
    if (completed) return colors.success[500];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(date + "T00:00:00");
    const diffTime = appointmentDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return colors.error[500];
    if (diffDays === 0) return colors.error[500];
    if (diffDays === 1) return colors.warning[500];
    if (diffDays <= 3) return colors.primary[500];
    return colors.primary[300];
  };

  return (
    <View style={[styles.card, { borderLeftColor: getAccentColor() }]}>
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
          <View style={styles.headerBadges}>
            {isMultiCleanerJob && !completed && (
              <View style={styles.teamBadge}>
                <Icon name="users" size={10} color={colors.primary[700]} />
                <Text style={styles.teamBadgeText}>Team</Text>
              </View>
            )}
            {isPreferred && !completed && (
              <View style={styles.preferredBadge}>
                <Icon name="star" size={10} color={colors.success[600]} />
                <Text style={styles.preferredText}>Preferred</Text>
              </View>
            )}
            {assigned && !completed && (
              <View style={styles.assignedBadge}>
                <Icon name="check" size={10} color={colors.success[600]} />
                <Text style={styles.assignedText}>Assigned</Text>
              </View>
            )}
          </View>
        </View>

        {/* Multi-Cleaner Status Banner */}
        {isMultiCleanerJob && multiCleanerJob && !completed && (
          <View style={styles.multiCleanerBanner}>
            <View style={styles.multiCleanerStats}>
              <View style={styles.multiCleanerStat}>
                <Icon name="users" size={14} color={colors.primary[600]} />
                <Text style={styles.multiCleanerStatValue}>
                  {multiCleanerJob.cleanersConfirmed}/{multiCleanerJob.totalCleanersRequired}
                </Text>
                <Text style={styles.multiCleanerStatLabel}>cleaners</Text>
              </View>
              {multiCleanerJob.cleanersConfirmed >= multiCleanerJob.totalCleanersRequired ? (
                <View style={[styles.multiCleanerStatusBadge, styles.multiCleanerStatusFilled]}>
                  <Icon name="check-circle" size={12} color={colors.success[600]} />
                  <Text style={styles.multiCleanerStatusFilledText}>Team Ready</Text>
                </View>
              ) : (
                <View style={[styles.multiCleanerStatusBadge, styles.multiCleanerStatusFilling]}>
                  <Icon name="clock-o" size={12} color={colors.warning[600]} />
                  <Text style={styles.multiCleanerStatusFillingText}>
                    Waiting for {multiCleanerJob.totalCleanersRequired - multiCleanerJob.cleanersConfirmed} more
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

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
          {needsSheets && (
            <View style={styles.propertyItem}>
              <Icon name="th-large" size={12} color={colors.primary[500]} />
              <Text style={styles.propertyText}>Sheets</Text>
            </View>
          )}
          {needsTowels && (
            <View style={styles.propertyItem}>
              <Icon name="square" size={12} color={colors.primary[500]} />
              <Text style={styles.propertyText}>Towels</Text>
            </View>
          )}
        </View>

        {/* Prominent Linens Section - Collapsible when cleaner needs to bring linens */}
        {assigned && (needsSheets || needsTowels) && (
          <View style={styles.linensCollapsibleContainer}>
            <Pressable
              style={styles.linensCollapsibleHeader}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setShowLinensDetails(!showLinensDetails);
              }}
            >
              <View style={styles.linensCollapsibleHeaderLeft}>
                <Icon name="exclamation-circle" size={16} color={colors.warning[600]} />
                <Text style={styles.linensCollapsibleTitle}>
                  What to Bring
                </Text>
                <View style={styles.linensQuickBadges}>
                  {needsSheets && (
                    <View style={styles.linensQuickBadge}>
                      <Text style={styles.linensQuickBadgeText}>Sheets</Text>
                    </View>
                  )}
                  {needsTowels && (
                    <View style={styles.linensQuickBadge}>
                      <Text style={styles.linensQuickBadgeText}>Towels</Text>
                    </View>
                  )}
                </View>
              </View>
              <Icon
                name={showLinensDetails ? "chevron-up" : "chevron-down"}
                size={14}
                color={colors.warning[600]}
              />
            </Pressable>

            {showLinensDetails && (
              <View style={styles.linensCollapsibleContent}>
                {/* Sheet Details */}
                {needsSheets && (() => {
                  const effectiveSheets = getEffectiveSheetConfigs(sheetConfigurations, cleanerRoomAssignments, isMultiCleanerJob);
                  return (
                    <View style={styles.linensDetailSection}>
                      <View style={styles.linensDetailHeader}>
                        <Icon name="th-large" size={14} color={colors.warning[700]} />
                        <Text style={styles.linensDetailTitle}>Sheets to Bring</Text>
                      </View>
                      {effectiveSheets && effectiveSheets.length > 0 ? (
                        <View style={styles.linensDetailList}>
                          {effectiveSheets.filter(bed => bed.needsSheets !== false).map((bed, index) => {
                            const size = bed.size ? bed.size.charAt(0).toUpperCase() + bed.size.slice(1).replace(/_/g, ' ') : "Standard";
                            return (
                              <View key={index} style={styles.linensDetailRow}>
                                <Icon name="check" size={12} color={colors.warning[600]} />
                                <Text style={styles.linensDetailRowText}>
                                  Bed {bed.bedNumber}: {size} sheets
                                </Text>
                              </View>
                            );
                          })}
                          {isMultiCleanerJob && cleanerRoomAssignments?.length > 0 && (
                            <Text style={styles.linensAssignmentNote}>
                              (Your assigned bedrooms only)
                            </Text>
                          )}
                        </View>
                      ) : (
                        <View style={styles.linensDetailList}>
                          {Array.from({ length: parseInt(home.numBeds) || 1 }, (_, i) => (
                            <View key={i} style={styles.linensDetailRow}>
                              <Icon name="check" size={12} color={colors.warning[600]} />
                              <Text style={styles.linensDetailRowText}>
                                Bed {i + 1}: Queen sheets
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })()}

                {/* Towel Details */}
                {needsTowels && (() => {
                  const effectiveTowels = getEffectiveTowelConfigs(towelConfigurations, cleanerRoomAssignments, isMultiCleanerJob);
                  const totals = getTowelTotals(effectiveTowels);
                  return (
                    <View style={styles.linensDetailSection}>
                      <View style={styles.linensDetailHeader}>
                        <Icon name="square" size={14} color={colors.warning[700]} />
                        <Text style={styles.linensDetailTitle}>Towels to Bring</Text>
                      </View>
                      {effectiveTowels && effectiveTowels.length > 0 ? (
                        <View style={styles.linensDetailList}>
                          {effectiveTowels.map((bath, index) => (
                            <View key={index} style={styles.linensDetailRow}>
                              <Icon name="check" size={12} color={colors.warning[600]} />
                              <Text style={styles.linensDetailRowText}>
                                Bathroom {bath.bathroomNumber}: {bath.towels || 0} towel{(bath.towels || 0) !== 1 ? "s" : ""}, {bath.faceCloths || 0} washcloth{(bath.faceCloths || 0) !== 1 ? "s" : ""}
                              </Text>
                            </View>
                          ))}
                          <View style={styles.linensTotalContainer}>
                            <Text style={styles.linensTotalLabel}>Total:</Text>
                            <Text style={styles.linensTotalValue}>
                              {totals.towels} towel{totals.towels !== 1 ? "s" : ""}, {totals.faceCloths} washcloth{totals.faceCloths !== 1 ? "s" : ""}
                            </Text>
                          </View>
                          {isMultiCleanerJob && cleanerRoomAssignments?.length > 0 && (
                            <Text style={styles.linensAssignmentNote}>
                              (Your assigned bathrooms only)
                            </Text>
                          )}
                        </View>
                      ) : (
                        <View style={styles.linensDetailList}>
                          {Array.from({ length: Math.floor(parseFloat(home.numBaths) || 1) }, (_, i) => (
                            <View key={i} style={styles.linensDetailRow}>
                              <Icon name="check" size={12} color={colors.warning[600]} />
                              <Text style={styles.linensDetailRowText}>
                                Bathroom {i + 1}: 2 towels, 1 washcloth
                              </Text>
                            </View>
                          ))}
                          <View style={styles.linensTotalContainer}>
                            <Text style={styles.linensTotalLabel}>Total:</Text>
                            <Text style={styles.linensTotalValue}>
                              {Math.floor(parseFloat(home.numBaths) || 1) * 2} towel{Math.floor(parseFloat(home.numBaths) || 1) * 2 !== 1 ? "s" : ""}, {Math.floor(parseFloat(home.numBaths) || 1)} washcloth{Math.floor(parseFloat(home.numBaths) || 1) !== 1 ? "s" : ""}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })()}

                <View style={styles.linensReminderBox}>
                  <Icon name="lightbulb-o" size={14} color={colors.primary[600]} />
                  <Text style={styles.linensReminderText}>
                    Prepare these items before your appointment to ensure a smooth cleaning experience
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Expanded Details */}
        {(expandWindow || assigned) && (
          <View style={styles.expandedSection}>
            {/* Sheets & Towels Info */}
            <View style={styles.linensContainer}>
              <View style={styles.linensHeader}>
                <Icon name="th-large" size={14} color={colors.primary[600]} />
                <Text style={styles.linensTitle}>Linens</Text>
              </View>
              {needsSheets || needsTowels ? (
                <View style={styles.linensContent}>
                  <View style={styles.bringLinensAlert}>
                    <Icon name="exclamation-circle" size={14} color={colors.warning[600]} />
                    <Text style={styles.bringLinensText}>You need to bring:</Text>
                  </View>

                  {/* Sheet Details */}
                  {needsSheets && (() => {
                    const effectiveSheets = getEffectiveSheetConfigs(sheetConfigurations, cleanerRoomAssignments, isMultiCleanerJob);
                    return (
                      <View style={styles.linensSection}>
                        <Text style={styles.linensSectionTitle}>Sheets</Text>
                        {effectiveSheets && effectiveSheets.length > 0 ? (
                          <View style={styles.linensItemsRow}>
                            <View style={styles.linensDetailItem}>
                              <Icon name="check" size={10} color={colors.warning[600]} />
                              <Text style={styles.linensDetailText}>
                                {formatBedSizes(effectiveSheets)}
                              </Text>
                            </View>
                            {isMultiCleanerJob && cleanerRoomAssignments?.length > 0 && (
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
                                {home.numBeds || "All"} set{home.numBeds !== "1" ? "s" : ""} of sheets
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })()}

                  {/* Towel Details */}
                  {needsTowels && (() => {
                    const effectiveTowels = getEffectiveTowelConfigs(towelConfigurations, cleanerRoomAssignments, isMultiCleanerJob);
                    const totals = getTowelTotals(effectiveTowels);
                    return (
                      <View style={styles.linensSection}>
                        <Text style={styles.linensSectionTitle}>Towels</Text>
                        {effectiveTowels && effectiveTowels.length > 0 ? (
                          <View style={styles.linensItemsRow}>
                            {effectiveTowels.map((bath, index) => (
                              <View key={index} style={styles.linensDetailItem}>
                                <Icon name="check" size={10} color={colors.warning[600]} />
                                <Text style={styles.linensDetailText}>
                                  Bathroom {bath.bathroomNumber}: {bath.towels || 0} towel{(bath.towels || 0) !== 1 ? "s" : ""}, {bath.faceCloths || 0} washcloth{(bath.faceCloths || 0) !== 1 ? "s" : ""}
                                </Text>
                              </View>
                            ))}
                            <View style={styles.linensTotalRow}>
                              <Text style={styles.linensTotalText}>
                                Total: {totals.towels} towels, {totals.faceCloths} washcloths
                              </Text>
                            </View>
                            {isMultiCleanerJob && cleanerRoomAssignments?.length > 0 && (
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
                                Towels for {home.numBaths || "all"} bathroom{home.numBaths !== "1" ? "s" : ""}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
              ) : (
                <View style={styles.linensProvidedContent}>
                  <Icon name="check-circle" size={14} color={colors.success[600]} />
                  <Text style={styles.linensProvidedText}>
                    Sheets and towels will be provided for {home.numBeds || "each"} bed{home.numBeds !== "1" ? "s" : ""} and {home.numBaths || "each"} bathroom{home.numBaths !== "1" ? "s" : ""}
                  </Text>
                </View>
              )}
            </View>

            {/* Access Info for Assigned Jobs - Only show day before or day of */}
            {assigned && !completed && (keyPadCode || keyLocation) && (
              isWithinOneDay() ? (
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
              ) : (
                <View style={styles.accessInfoHiddenContainer}>
                  <Icon name="lock" size={14} color={colors.text.tertiary} />
                  <Text style={styles.accessInfoHiddenText}>
                    Access information will be available the day before your job
                  </Text>
                </View>
              )
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

            {/* Address for Assigned Jobs - Full address only day before or day of */}
            {assigned && (
              isWithinOneDay() ? (
                <View style={styles.addressContainer}>
                  <Icon name="home" size={14} color={colors.text.secondary} />
                  <Text style={styles.addressText}>
                    {home.address}, {home.city}, {home.state} {home.zipcode}
                  </Text>
                </View>
              ) : (
                <View style={styles.addressContainer}>
                  <Icon name="map-marker" size={14} color={colors.text.secondary} />
                  <View style={styles.addressTextContainer}>
                    <Text style={styles.addressText}>
                      {home.city}, {home.state} {home.zipcode}
                    </Text>
                    <Text style={styles.addressHintText}>
                      Full address available the day before your job
                    </Text>
                  </View>
                </View>
              )
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
              style={[styles.actionButton, styles.acceptButton, isPreferred && styles.preferredAcceptButton, isRequesting && styles.buttonDisabled]}
              onPress={() => addEmployee(cleanerId, id)}
              disabled={isRequesting}
            >
              {isRequesting ? (
                <ActivityIndicator size="small" color={colors.neutral[0]} />
              ) : (
                <Icon name={isPreferred ? "star" : "check"} size={14} color={colors.neutral[0]} />
              )}
              <Text style={styles.acceptButtonText}>
                {isRequesting ? "Requesting..." : isPreferred ? "Book Directly" : "Request This Job"}
              </Text>
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
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
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
  headerBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  preferredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.success[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.success[300],
  },
  preferredText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
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
  teamBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
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
  linensCollapsibleContainer: {
    marginTop: spacing.md,
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
    overflow: "hidden",
  },
  linensCollapsibleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.warning[100],
  },
  linensCollapsibleHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  linensCollapsibleTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
  },
  linensQuickBadges: {
    flexDirection: "row",
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  linensQuickBadge: {
    backgroundColor: colors.warning[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  linensQuickBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[800],
  },
  linensCollapsibleContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  linensDetailSection: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    padding: spacing.md,
  },
  linensDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning[200],
  },
  linensDetailTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  linensDetailList: {
    gap: spacing.xs,
  },
  linensDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  linensDetailRowText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    flex: 1,
  },
  linensTotalContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  linensTotalLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  linensTotalValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[700],
  },
  linensAssignmentNote: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
  linensReminderBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  linensReminderText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.primary[700],
    lineHeight: 18,
  },
  expandedSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
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
  linensItemsRow: {
    gap: spacing.xs,
    paddingLeft: spacing.sm,
  },
  linensItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  linensItemText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  linensProvidedContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  linensProvidedText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    lineHeight: 20,
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
  accessInfoHiddenContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.neutral[100],
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  accessInfoHiddenText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: "italic",
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
  addressTextContainer: {
    flex: 1,
  },
  addressHintText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontStyle: "italic",
    marginTop: 2,
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
  preferredAcceptButton: {
    backgroundColor: colors.success[600],
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
