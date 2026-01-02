import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import FetchData from "../../services/fetchRequests/fetchData";
import getCurrentUser from "../../services/fetchRequests/getCurrentUser";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import RequestResponseTile from "./tiles/RequestResponseTile";

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
  { value: "dateNewest", label: "Upcoming First", icon: "calendar" },
  { value: "dateOldest", label: "Furthest Out", icon: "calendar-o" },
  { value: "priceLow", label: "Price (Low to High)", icon: "dollar" },
  { value: "priceHigh", label: "Price (High to Low)", icon: "dollar" },
];

const AllRequestsCalendar = ({ state, dispatch }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState({});
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [sortOption, setSortOption] = useState("dateNewest");
  const [showSortModal, setShowSortModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const navigate = useNavigate();

  // Extract appointments from state
  const appointmentArray = useMemo(
    () =>
      (state.requests || [])
        .map((request) => ({ ...request.appointment, requestId: request.id }))
        .filter((a) => a && typeof a === "object" && !Array.isArray(a)),
    [state.requests]
  );

  // Calculate stats
  const totalRequests = appointmentArray.length;
  const upcomingCount = appointmentArray.filter(
    (a) => new Date(a.date) >= new Date(new Date().toDateString())
  ).length;

  // Fetch user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await getCurrentUser();
        setUserId(response.user.id);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };

    if (state.currentUser?.token) {
      fetchUser();
    }
  }, [state.currentUser?.token]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      const watcher = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLoading(false);
        },
        (error) => {
          console.log("Location unavailable:", error.message || error);
          setUserLocation({ latitude: 0, longitude: 0 });
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );

      return () => navigator.geolocation.clearWatch(watcher);
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch distances
  useEffect(() => {
    const fetchLocations = async () => {
      if (!userLocation || appointmentArray.length === 0) return;

      try {
        const locationsWithDistances = await Promise.all(
          appointmentArray.map(async (appointment) => {
            const loc = await FetchData.getLatAndLong(appointment.homeId);
            if (!loc) return null;

            const distance = haversineDistance(
              userLocation.latitude,
              userLocation.longitude,
              loc.latitude,
              loc.longitude
            );

            return {
              [appointment.homeId]: {
                location: loc,
                distance: distance,
              },
            };
          })
        );
        setAppointmentLocations(
          Object.assign({}, ...locationsWithDistances.filter(Boolean))
        );
      } catch (error) {
        console.log("Error fetching appointment locations:", error.message);
      }
    };

    fetchLocations();
  }, [appointmentArray, userLocation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Sort helper
  const sortRequests = useCallback(
    (list) => {
      return [...list].sort((a, b) => {
        switch (sortOption) {
          case "dateNewest":
            return new Date(a.date) - new Date(b.date);
          case "dateOldest":
            return new Date(b.date) - new Date(a.date);
          case "priceLow":
            return (Number(a.price) || 0) - (Number(b.price) || 0);
          case "priceHigh":
            return (Number(b.price) || 0) - (Number(a.price) || 0);
          default:
            return 0;
        }
      });
    },
    [sortOption]
  );

  // Handle date selection
  const handleDateSelect = useCallback(
    (date) => {
      const dateString = date.dateString || date;
      setSelectedDate(dateString);

      const filtered = appointmentArray
        .filter((appointment) => appointment.date === dateString)
        .map((appointment) => ({
          ...appointment,
          distance: appointmentLocations[appointment.homeId]?.distance || null,
        }));

      setFilteredRequests(sortRequests(filtered));
    },
    [appointmentArray, appointmentLocations, sortRequests]
  );

  // Update filtering when sort changes
  useEffect(() => {
    if (selectedDate) {
      handleDateSelect(selectedDate);
    }
  }, [sortOption]);

  const formatSelectedDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString + "T00:00:00");
    const options = { weekday: "long", month: "long", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  const currentSortLabel =
    sortOptions.find((o) => o.value === sortOption)?.label || "Sort";

  // Calendar day render
  const renderDay = useCallback(
    ({ date }) => {
      const today = new Date();
      const dayDate = new Date(date.dateString);
      const isPast = dayDate < new Date(today.toDateString());

      const requestCount = appointmentArray.filter(
        (a) => a.date === date.dateString
      ).length;
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
            <View style={[styles.dayBadge, isSelected && styles.dayBadgeSelected]}>
              <Text
                style={[styles.dayBadgeText, isSelected && styles.dayBadgeTextSelected]}
              >
                {requestCount}
              </Text>
            </View>
          )}
        </Pressable>
      );
    },
    [appointmentArray, selectedDate, handleDateSelect]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading calendar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate("/")}>
          <Icon name="angle-left" size={20} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Requests Calendar</Text>
        <Pressable
          style={styles.listButton}
          onPress={() => navigate("/cleaner-requests")}
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
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{upcomingCount}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalRequests}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, styles.statCardHighlight]}>
            <Text style={[styles.statValue, styles.statValueHighlight]}>
              {filteredRequests.length}
            </Text>
            <Text style={[styles.statLabel, styles.statLabelHighlight]}>
              Selected
            </Text>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionCard}>
          <Icon name="hand-pointer-o" size={18} color={colors.primary[600]} />
          <Text style={styles.instructionText}>
            Tap a highlighted date to view cleaner requests for that day
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
            <View style={[styles.legendDot, { backgroundColor: colors.primary[100] }]} />
            <Text style={styles.legendText}>Has Requests</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary[500] }]} />
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
                <Icon name="calendar-times-o" size={32} color={colors.text.tertiary} />
                <Text style={styles.noRequestsTitle}>No Requests</Text>
                <Text style={styles.noRequestsText}>
                  There are no cleaner requests for this date.
                </Text>
              </View>
            ) : (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionBadge}>
                      <Icon name="users" size={12} color={colors.primary[600]} />
                    </View>
                    <Text style={styles.sectionTitle}>Cleaner Requests</Text>
                  </View>
                  <Text style={styles.sectionCount}>{filteredRequests.length}</Text>
                </View>
                {filteredRequests.map((appointment) => (
                  <View key={appointment.id} style={styles.tileWrapper}>
                    <RequestResponseTile
                      id={appointment.id}
                      state={state}
                      cleanerId={userId}
                      date={appointment.date}
                      price={appointment.price}
                      homeId={appointment.homeId}
                      hasBeenAssigned={appointment.hasBeenAssigned}
                      bringSheets={appointment.bringSheets}
                      bringTowels={appointment.bringTowels}
                      completed={appointment.completed}
                      keyPadCode={appointment.keyPadCode}
                      keyLocation={appointment.keyLocation}
                      distance={appointment.distance}
                      approveRequest={async (employeeId, appointmentId, requestId) => {
                        try {
                          dispatch({
                            type: "UPDATE_REQUEST_STATUS",
                            payload: {
                              employeeId,
                              appointmentId,
                              status: "approved",
                            },
                          });
                          await FetchData.approveRequest(requestId, true);
                        } catch (error) {
                          console.error("Error approving request:", error);
                        }
                      }}
                      denyRequest={async (employeeId, appointmentId) => {
                        try {
                          dispatch({
                            type: "UPDATE_REQUEST_STATUS",
                            payload: {
                              employeeId,
                              appointmentId,
                              status: "denied",
                            },
                          });
                          await FetchData.denyRequest(employeeId, appointmentId);
                        } catch (error) {
                          console.error("Error denying request:", error);
                        }
                      }}
                      undoRequest={async (employeeId, appointmentId) => {
                        try {
                          dispatch({
                            type: "UPDATE_REQUEST_STATUS",
                            payload: {
                              employeeId,
                              appointmentId,
                              status: "pending",
                            },
                          });
                          await FetchData.undoRequest(employeeId, appointmentId);
                        } catch (error) {
                          console.error("Error undoing request:", error);
                        }
                      }}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Empty State when no date selected */}
        {!selectedDate && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="calendar" size={40} color={colors.primary[300]} />
            </View>
            <Text style={styles.emptyTitle}>Select a Date</Text>
            <Text style={styles.emptyText}>
              Tap on a highlighted date in the calendar above to view cleaner requests for that day.
            </Text>
          </View>
        )}

        {/* No Requests at all */}
        {appointmentArray.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="inbox" size={40} color={colors.primary[300]} />
            </View>
            <Text style={styles.emptyTitle}>No Requests Yet</Text>
            <Text style={styles.emptyText}>
              You don't have any cleaner requests at the moment. When cleaners request to work on your appointments, they'll appear here.
            </Text>
            <Pressable style={styles.homeButton} onPress={() => navigate("/")}>
              <Icon name="home" size={14} color={colors.neutral[0]} />
              <Text style={styles.homeButtonText}>Back to Dashboard</Text>
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
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statValueHighlight: {
    color: colors.primary[700],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statLabelHighlight: {
    color: colors.primary[600],
  },

  // Instruction Card
  instructionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  instructionText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
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
    backgroundColor: colors.primary[50],
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
    backgroundColor: colors.primary[500],
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
    backgroundColor: colors.primary[100],
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
    backgroundColor: colors.primary[100],
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
  homeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  homeButtonText: {
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
});

export default AllRequestsCalendar;
