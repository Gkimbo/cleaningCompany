import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Calendar } from "react-native-calendars";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import * as Location from "expo-location";
import FetchData from "../../../services/fetchRequests/fetchData";
import getCurrentUser from "../../../services/fetchRequests/getCurrentUser";
import RequestedTile from "../tiles/RequestedTile";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../../services/styles/theme";
import { usePricing } from "../../../context/PricingContext";
import { calculateLinensFromRoomCounts } from "../../../utils/linensUtils";

import useSafeNavigation from "../../../hooks/useSafeNavigation";
// Format time constraint for display: "10-3" → "10am - 3pm"
const formatTimeConstraint = (time) => {
  if (!time || time.toLowerCase() === "anytime") return "Anytime";
  const match = time.match(/^(\d+)(am|pm)?-(\d+)(am|pm)?$/i);
  if (!match) return time;
  const startHour = parseInt(match[1], 10);
  const startPeriod = match[2]?.toLowerCase() || (startHour >= 8 && startHour <= 11 ? "am" : "pm");
  const endHour = parseInt(match[3], 10);
  const endPeriod = match[4]?.toLowerCase() || (endHour >= 1 && endHour <= 6 ? "pm" : "am");
  return `${startHour}${startPeriod} - ${endHour}${endPeriod}`;
};

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const sortOptions = [
  {
    value: "distanceClosest",
    label: "Distance (Closest)",
    icon: "location-arrow",
  },
  {
    value: "distanceFurthest",
    label: "Distance (Furthest)",
    icon: "location-arrow",
  },
  { value: "priceLow", label: "Price (Low to High)", icon: "dollar" },
  { value: "priceHigh", label: "Price (High to Low)", icon: "dollar" },
];

const MyRequestsCalendar = ({ state }) => {
  const { pricing } = usePricing();
  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const [requests, setRequests] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState({});
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [sortOption, setSortOption] = useState("distanceClosest");
  const [showSortModal, setShowSortModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Multi-cleaner requests
  const [multiCleanerRequests, setMultiCleanerRequests] = useState([]);

  // Track which request linens dropdowns are expanded
  const [expandedLinens, setExpandedLinens] = useState({});

  const { goBack, navigate } = useSafeNavigation();

  const toggleLinens = useCallback((requestId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedLinens((prev) => ({
      ...prev,
      [requestId]: !prev[requestId],
    }));
  }, []);

  // Fetch requests
  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);

      try {
        const [res, user, multiCleanerRes] = await Promise.all([
          FetchData.get(
            "/api/v1/users/appointments/employee",
            state.currentUser.token
          ),
          getCurrentUser(state.currentUser.token),
          FetchData.getMyMultiCleanerRequests(state.currentUser.token),
        ]);

        const now = new Date();
        const isUpcoming = (item) =>
          new Date(item.date + "T00:00:00") >= new Date(now.toDateString());

        setRequests((res.requested || []).filter(isUpcoming));
        setUserId(user.user.id);
        setMultiCleanerRequests(multiCleanerRes.requests || []);
      } catch (error) {
        console.error("Error fetching requests:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [state.currentUser?.token]
  );

  useEffect(() => {
    if (state.currentUser?.token) fetchData();
  }, [state.currentUser?.token, fetchData]);

  // Get location using expo-location
  useEffect(() => {
    let locationSubscription = null;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("[MyRequestsCalendar] Location permission denied");
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 100,
          },
          (location) => {
            setUserLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
          }
        );
      } catch (error) {
        console.log(
          "[MyRequestsCalendar] Location unavailable:",
          error.message
        );
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Fetch distances for all requests (solo + team)
  useEffect(() => {
    const fetchDistances = async () => {
      if (!userLocation) return;

      // Collect all unique home IDs from solo and team requests
      const soloHomeIds = (requests || []).map((r) => r.homeId).filter(Boolean);
      const teamHomeIds = (multiCleanerRequests || [])
        .map((r) => r.homeId || r.appointment?.home?.id)
        .filter(Boolean);

      const allHomeIds = [...new Set([...soloHomeIds, ...teamHomeIds])];

      if (allHomeIds.length === 0) return;

      const locations = await Promise.all(
        allHomeIds.map(async (homeId) => {
          const loc = await FetchData.getLatAndLong(homeId);
          if (!loc) return null;
          const distance = haversineDistance(
            userLocation.latitude,
            userLocation.longitude,
            loc.latitude,
            loc.longitude
          );
          return { [homeId]: { location: loc, distance } };
        })
      );
      setAppointmentLocations(Object.assign({}, ...locations.filter(Boolean)));
    };

    fetchDistances();
  }, [userLocation, requests, multiCleanerRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  // Handle cancelling a team request
  const handleCancelTeamRequest = useCallback(
    (request) => {
      Alert.alert(
        "Cancel Request",
        "Are you sure you want to cancel this team cleaning request?",
        [
          { text: "No, Keep It", style: "cancel" },
          {
            text: "Yes, Cancel",
            style: "destructive",
            onPress: async () => {
              try {
                const result = await FetchData.cancelMultiCleanerRequest(
                  request.id,
                  state.currentUser.token
                );
                if (result.error) {
                  Alert.alert("Error", result.error);
                } else {
                  Alert.alert(
                    "Request Cancelled",
                    "Your request has been cancelled."
                  );
                  // Remove from state
                  setMultiCleanerRequests((prev) =>
                    prev.filter((r) => r.id !== request.id)
                  );
                  setFilteredRequests((prev) =>
                    prev.filter(
                      (r) => !(r.type === "team" && r.id === request.id)
                    )
                  );
                }
              } catch (error) {
                Alert.alert(
                  "Error",
                  "Failed to cancel request. Please try again."
                );
              }
            },
          },
        ]
      );
    },
    [state.currentUser.token]
  );

  // Sort helper
  const sortRequests = useCallback(
    (list) => {
      return [...list].sort((a, b) => {
        const getDistance = (r) =>
          appointmentLocations[r.homeId]?.distance || Infinity;
        const getPrice = (r) => Number(r.price) || 0;

        switch (sortOption) {
          case "distanceClosest":
            return getDistance(a) - getDistance(b);
          case "distanceFurthest":
            return getDistance(b) - getDistance(a);
          case "priceLow":
            return getPrice(a) - getPrice(b);
          case "priceHigh":
            return getPrice(b) - getPrice(a);
          default:
            return 0;
        }
      });
    },
    [appointmentLocations, sortOption]
  );

  const handleDateSelect = useCallback(
    (date) => {
      const dateString = date.dateString || date;
      setSelectedDate(dateString);

      // Filter solo requests
      const filteredSolo = requests
        .filter((r) => r.date === dateString)
        .map((r) => ({
          ...r,
          type: "solo",
          distance: appointmentLocations[r.homeId]?.distance || null,
        }));

      // Filter team requests
      const filteredTeam = multiCleanerRequests
        .filter((r) => r.appointment?.date === dateString)
        .map((r) => ({
          ...r,
          type: "team",
          date: r.appointment?.date,
        }));

      // Combine and sort
      const combined = [...filteredSolo, ...filteredTeam];
      setFilteredRequests(sortRequests(combined));
    },
    [requests, multiCleanerRequests, appointmentLocations, sortRequests]
  );

  useEffect(() => {
    if (selectedDate) handleDateSelect(selectedDate);
  }, [sortOption]);

  const formatSelectedDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString + "T00:00:00");
    const options = { weekday: "long", month: "long", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  // Calculate stats (cleaners receive 90% of appointment price)
  const totalRequests = requests.length + multiCleanerRequests.length;
  const soloEarnings = requests.reduce(
    (sum, r) => sum + (Number(r.price) || 0) * cleanerSharePercent,
    0
  );
  const teamEarnings = multiCleanerRequests.reduce((sum, r) => {
    const totalCleaners = r.multiCleanerJob?.totalCleanersRequired || 2;
    return (
      sum +
      ((Number(r.appointment?.price) || 0) * cleanerSharePercent) /
        totalCleaners
    );
  }, 0);
  const totalEarnings = soloEarnings + teamEarnings;

  const currentSortLabel =
    sortOptions.find((o) => o.value === sortOption)?.label || "Sort";

  // Calendar day render
  const renderDay = useCallback(
    ({ date }) => {
      const today = new Date();
      const dayDate = new Date(date.dateString);
      const isPast = dayDate < new Date(today.toDateString());

      const soloCount = requests.filter(
        (r) => r.date === date.dateString
      ).length;
      const teamCount = multiCleanerRequests.filter(
        (r) => r.appointment?.date === date.dateString
      ).length;
      const requestCount = soloCount + teamCount;
      const hasData = requestCount > 0;
      const isSelected = selectedDate === date.dateString;

      return (
        <Pressable
          disabled={isPast && !hasData}
          style={[
            styles.dayContainer,
            isSelected && styles.dayContainerSelected,
            hasData && !isPast && !isSelected && styles.dayContainerHasData,
            isPast && styles.dayContainerPast,
          ]}
          onPress={() => hasData && handleDateSelect(date)}
        >
          <Text
            style={[
              styles.dayText,
              isSelected && styles.dayTextSelected,
              isPast && !hasData && styles.dayTextPast,
            ]}
          >
            {date.day}
          </Text>
          {hasData && (
            <View
              style={[styles.dayBadge, isSelected && styles.dayBadgeSelected]}
            >
              <Text
                style={[
                  styles.dayBadgeText,
                  isSelected && styles.dayBadgeTextSelected,
                ]}
              >
                {requestCount}
              </Text>
            </View>
          )}
        </Pressable>
      );
    },
    [requests, multiCleanerRequests, selectedDate, handleDateSelect]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading your requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goBack()}>
          <Icon name="angle-left" size={20} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Requests Calendar</Text>
        <Pressable
          style={styles.listButton}
          onPress={() => navigate("/my-requests")}
        >
          <Icon name="list" size={18} color={colors.primary[600]} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* Stats Summary */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardHighlight]}>
            <Text style={[styles.statValue, styles.statValueHighlight]}>
              {totalRequests}
            </Text>
            <Text style={[styles.statLabel, styles.statLabelHighlight]}>
              Pending
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalEarnings.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Potential</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{filteredRequests.length}</Text>
            <Text style={styles.statLabel}>Selected</Text>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionCard}>
          <Icon name="hand-pointer-o" size={18} color={colors.warning[600]} />
          <Text style={styles.instructionText}>
            Tap a highlighted date to see your pending requests for that day
          </Text>
        </View>

        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <Calendar
            current={new Date().toISOString().split("T")[0]}
            onDayPress={handleDateSelect}
            dayComponent={renderDay}
            renderArrow={(direction) => (
              <View style={styles.arrowContainer}>
                <Icon
                  name={direction === "left" ? "chevron-left" : "chevron-right"}
                  size={14}
                  color={colors.primary[600]}
                />
              </View>
            )}
            theme={{
              backgroundColor: colors.neutral[0],
              calendarBackground: colors.neutral[0],
              textSectionTitleColor: colors.text.secondary,
              monthTextColor: colors.text.primary,
              textMonthFontWeight: typography.fontWeight.semibold,
              textMonthFontSize: typography.fontSize.lg,
            }}
          />
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: colors.warning[100] },
              ]}
            />
            <Text style={styles.legendText}>Has Requests</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: colors.primary[500] },
              ]}
            />
            <Text style={styles.legendText}>Selected</Text>
          </View>
        </View>

        {/* Selected Date Section */}
        {selectedDate && (
          <View style={styles.selectedDateSection}>
            <View style={styles.selectedDateHeader}>
              <View>
                <Text style={styles.selectedDateLabel}>Requests for</Text>
                <Text style={styles.selectedDateText}>
                  {formatSelectedDate(selectedDate)}
                </Text>
              </View>
              {filteredRequests.length > 0 && (
                <Pressable
                  style={styles.sortButton}
                  onPress={() => setShowSortModal(true)}
                >
                  <Icon name="sort" size={14} color={colors.primary[600]} />
                  <Text style={styles.sortButtonText}>{currentSortLabel}</Text>
                </Pressable>
              )}
            </View>

            {filteredRequests.length === 0 ? (
              <View style={styles.noRequestsCard}>
                <Icon
                  name="calendar-times-o"
                  size={32}
                  color={colors.text.tertiary}
                />
                <Text style={styles.noRequestsTitle}>No Requests</Text>
                <Text style={styles.noRequestsText}>
                  You don't have any pending requests for this date.
                </Text>
              </View>
            ) : (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionBadge}>
                      <Icon
                        name="clock-o"
                        size={12}
                        color={colors.warning[600]}
                      />
                    </View>
                    <Text style={styles.sectionTitle}>Pending Approval</Text>
                  </View>
                  <Text style={styles.sectionCount}>
                    {filteredRequests.length}
                  </Text>
                </View>
                {filteredRequests.map((req) => {
                  if (req.type === "team") {
                    const hasTimeConstraint =
                      req.appointment?.timeToBeCompleted &&
                      req.appointment.timeToBeCompleted.toLowerCase() !==
                        "anytime";

                    // Calculate distance for this team request
                    const teamHomeId = req.homeId || req.appointment?.home?.id;
                    const teamDistance =
                      appointmentLocations[teamHomeId]?.distance;

                    // Calculate per-cleaner linens based on assigned rooms
                    // If no rooms assigned yet (pending), estimate based on total/cleaners
                    const totalCleaners =
                      req.multiCleanerJob?.totalCleanersRequired || 2;
                    const totalBeds = req.appointment?.home?.numBeds || 0;
                    const totalBaths = req.appointment?.home?.numBaths || 0;
                    const hasAssignedRooms =
                      (req.assignedBedrooms || 0) > 0 ||
                      (req.assignedBathrooms || 0) > 0;

                    const estimatedBedrooms = hasAssignedRooms
                      ? req.assignedBedrooms
                      : Math.ceil(totalBeds / totalCleaners);
                    const estimatedBathrooms = hasAssignedRooms
                      ? req.assignedBathrooms
                      : Math.ceil(totalBaths / totalCleaners);

                    const linensCalc = calculateLinensFromRoomCounts({
                      assignedBedrooms: estimatedBedrooms,
                      assignedBathrooms: estimatedBathrooms,
                      bringSheets:
                        req.appointment?.bringSheets?.toLowerCase() === "yes",
                      bringTowels:
                        req.appointment?.bringTowels?.toLowerCase() === "yes",
                    });
                    const isLinensEstimated = !hasAssignedRooms;
                    const linensKey = `mc-${req.id}`;

                    return (
                      <View key={`mc-${req.id}`} style={styles.tileWrapper}>
                        <View style={styles.teamRequestTile}>
                          <View style={styles.teamRequestHeader}>
                            <View style={styles.teamBadge}>
                              <Icon
                                name="users"
                                size={12}
                                color={colors.primary[600]}
                              />
                              <Text style={styles.teamBadgeText}>
                                Team Cleaning
                              </Text>
                            </View>
                            <Text style={styles.pendingBadge}>
                              Awaiting Approval
                            </Text>
                          </View>

                          <Text style={styles.teamRequestAddress}>
                            {req.appointment?.home?.city},{" "}
                            {req.appointment?.home?.state}
                          </Text>
                          <Text style={styles.teamRequestDate}>
                            {new Date(req.appointment?.date + "T00:00:00").toLocaleDateString(
                              "en-US",
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </Text>
                          <View style={styles.teamRequestDetails}>
                            <Text style={styles.teamRequestDetail}>
                              {req.appointment?.home?.numBeds} bed /{" "}
                              {req.appointment?.home?.numBaths} bath
                            </Text>
                            <Text style={styles.teamRequestDetail}>
                              {req.multiCleanerJob?.cleanersConfirmed || 0}/
                              {req.multiCleanerJob?.totalCleanersRequired || 2}{" "}
                              cleaners
                            </Text>
                            {teamDistance != null && (
                              <Text style={styles.teamRequestDetail}>
                                {(teamDistance * 0.621371).toFixed(1)} mi away
                              </Text>
                            )}
                          </View>

                          {/* Linens Dropdown - Per-cleaner linens based on assigned rooms */}
                          {linensCalc.needsLinens && (
                            <View style={styles.linensContainer}>
                              <Pressable
                                style={styles.linensHeader}
                                onPress={() => toggleLinens(linensKey)}
                              >
                                <View style={styles.linensHeaderLeft}>
                                  <Icon
                                    name="exclamation-triangle"
                                    size={14}
                                    color={colors.warning[600]}
                                  />
                                  <Text style={styles.linensHeaderText}>
                                    Your Linens
                                  </Text>
                                </View>
                                <Icon
                                  name={
                                    expandedLinens[linensKey]
                                      ? "chevron-up"
                                      : "chevron-down"
                                  }
                                  size={12}
                                  color={colors.warning[600]}
                                />
                              </Pressable>
                              {expandedLinens[linensKey] && (
                                <View style={styles.linensContent}>
                                  {linensCalc.needsSheets &&
                                    linensCalc.sheetsText && (
                                      <View style={styles.linenSection}>
                                        <View style={styles.linenCategory}>
                                          <Icon
                                            name="bed"
                                            size={14}
                                            color={colors.primary[600]}
                                          />
                                          <Text
                                            style={styles.linenCategoryTitle}
                                          >
                                            Sheets
                                          </Text>
                                        </View>
                                        <Text style={styles.linenSummary}>
                                          {linensCalc.sheetsText}
                                        </Text>
                                      </View>
                                    )}
                                  {linensCalc.needsTowels &&
                                    linensCalc.towelsText && (
                                      <View
                                        style={[
                                          styles.linenSection,
                                          linensCalc.needsSheets &&
                                            styles.linenSectionSpaced,
                                        ]}
                                      >
                                        <View style={styles.linenCategory}>
                                          <Icon
                                            name="tint"
                                            size={14}
                                            color={colors.primary[600]}
                                          />
                                          <Text
                                            style={styles.linenCategoryTitle}
                                          >
                                            Towels
                                          </Text>
                                        </View>
                                        <Text style={styles.linenSummary}>
                                          {linensCalc.towelsText}
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
                                      {isLinensEstimated
                                        ? `Estimated for your share (~${estimatedBedrooms} bed, ${estimatedBathrooms} bath)`
                                        : `Based on your assigned rooms (${linensCalc.assignedBedrooms} bed, ${linensCalc.assignedBathrooms} bath)`}
                                    </Text>
                                  </View>
                                </View>
                              )}
                            </View>
                          )}

                          <View style={styles.teamRequestEarnings}>
                            <Icon
                              name="dollar"
                              size={12}
                              color={colors.success[600]}
                            />
                            <Text style={styles.teamRequestEarningsText}>
                              {(
                                ((Number(req.appointment?.price) || 0) *
                                  cleanerSharePercent) /
                                (req.multiCleanerJob?.totalCleanersRequired ||
                                  2)
                              ).toFixed(0)}{" "}
                              your share
                            </Text>
                          </View>

                          {/* Time Constraint */}
                          {hasTimeConstraint && (
                            <View style={styles.timeConstraintRow}>
                              <Icon
                                name="clock-o"
                                size={12}
                                color={colors.warning[600]}
                              />
                              <Text style={styles.timeConstraintText}>
                                Complete by {formatTimeConstraint(req.appointment.timeToBeCompleted)}
                              </Text>
                            </View>
                          )}

                          <View style={styles.teamRequestActions}>
                            <View style={styles.requestSentBadge}>
                              <Icon
                                name="check-circle"
                                size={14}
                                color={colors.success[600]}
                              />
                              <Text style={styles.requestSentText}>
                                Request Sent
                              </Text>
                            </View>
                            <Pressable
                              style={styles.cancelRequestButton}
                              onPress={() => handleCancelTeamRequest(req)}
                            >
                              <Icon
                                name="times"
                                size={14}
                                color={colors.error[600]}
                              />
                              <Text style={styles.cancelRequestText}>
                                Cancel
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  } else {
                    return (
                      <View key={req.id} style={styles.tileWrapper}>
                        <RequestedTile
                          {...req}
                          cleanerId={userId}
                          removeRequest={async (employeeId, appointmentId) => {
                            try {
                              await FetchData.removeRequest(
                                employeeId,
                                appointmentId
                              );
                              setRequests((prev) =>
                                prev.filter((r) => r.id !== appointmentId)
                              );
                              setFilteredRequests((prev) =>
                                prev.filter((r) => r.id !== appointmentId)
                              );
                            } catch (err) {
                              console.error("Error removing request:", err);
                            }
                          }}
                        />
                      </View>
                    );
                  }
                })}
              </View>
            )}
          </View>
        )}

        {/* Empty State when no date selected */}
        {!selectedDate &&
          (requests.length > 0 || multiCleanerRequests.length > 0) && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Icon name="calendar" size={40} color={colors.warning[300]} />
              </View>
              <Text style={styles.emptyTitle}>Select a Date</Text>
              <Text style={styles.emptyText}>
                Tap on a highlighted date in the calendar above to view your
                pending requests for that day.
              </Text>
            </View>
          )}

        {/* No Requests at all */}
        {requests.length === 0 && multiCleanerRequests.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="clock-o" size={40} color={colors.primary[300]} />
            </View>
            <Text style={styles.emptyTitle}>No Pending Requests</Text>
            <Text style={styles.emptyText}>
              You haven't requested any jobs yet. Browse available jobs and
              request the ones you'd like to work on!
            </Text>
            <Pressable
              style={styles.findJobsButton}
              onPress={() => navigate("/new-job-choice")}
            >
              <Icon name="search" size={14} color={colors.neutral[0]} />
              <Text style={styles.findJobsButtonText}>Find Jobs</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort Requests By</Text>
              <Pressable onPress={() => setShowSortModal(false)}>
                <Icon name="times" size={20} color={colors.text.secondary} />
              </Pressable>
            </View>
            {sortOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.sortOption,
                  sortOption === option.value && styles.sortOptionActive,
                ]}
                onPress={() => {
                  setSortOption(option.value);
                  setShowSortModal(false);
                }}
              >
                <Icon
                  name={option.icon}
                  size={16}
                  color={
                    sortOption === option.value
                      ? colors.primary[600]
                      : colors.text.secondary
                  }
                />
                <Text
                  style={[
                    styles.sortOptionText,
                    sortOption === option.value && styles.sortOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {sortOption === option.value && (
                  <Icon name="check" size={16} color={colors.primary[600]} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing["3xl"],
    paddingBottom: spacing.md,
    backgroundColor: colors.background.secondary,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  listButton: {
    padding: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    ...shadows.sm,
  },
  statCardHighlight: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statValueHighlight: {
    color: colors.warning[700],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statLabelHighlight: {
    color: colors.warning[600],
  },

  // Instruction Card
  instructionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  instructionText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
  },

  // Calendar
  calendarContainer: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadows.md,
  },
  arrowContainer: {
    padding: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
  },

  // Day Styles
  dayContainer: {
    width: 36,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  dayContainerSelected: {
    backgroundColor: colors.primary[500],
  },
  dayContainerHasData: {
    backgroundColor: colors.warning[100],
  },
  dayContainerPast: {
    opacity: 0.4,
  },
  dayText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  dayTextSelected: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
  },
  dayTextPast: {
    color: colors.text.tertiary,
  },
  dayBadge: {
    marginTop: 2,
    backgroundColor: colors.warning[500],
    borderRadius: radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: "center",
  },
  dayBadgeSelected: {
    backgroundColor: colors.neutral[0],
  },
  dayBadgeText: {
    fontSize: 9,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  dayBadgeTextSelected: {
    color: colors.primary[600],
  },

  // Legend
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },

  // Selected Date Section
  selectedDateSection: {
    paddingHorizontal: spacing.lg,
  },
  selectedDateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  selectedDateLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  selectedDateText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  sortButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },

  // No Requests Card
  noRequestsCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    ...shadows.sm,
  },
  noRequestsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  noRequestsText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.warning[100],
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sectionCount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },

  // Tile Wrapper
  tileWrapper: {
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.neutral[0],
    ...shadows.sm,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["4xl"],
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.warning[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  findJobsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  findJobsButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.glass.overlay,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    paddingBottom: spacing["3xl"],
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  sortOptionActive: {
    backgroundColor: colors.primary[50],
  },
  sortOptionText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  sortOptionTextActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },

  bottomSpacer: {
    height: spacing["4xl"],
  },

  // Team Request Tile Styles
  teamRequestTile: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },
  teamRequestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  teamBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
  },
  teamBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
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
  teamRequestAddress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  teamRequestDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  teamRequestDetails: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  teamRequestDetail: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  teamRequestEarnings: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  teamRequestEarningsText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
  },
  teamRequestActions: {
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
  cancelRequestButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  cancelRequestText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[600],
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
});

export default MyRequestsCalendar;
