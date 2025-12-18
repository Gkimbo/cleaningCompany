import React, { useCallback, useEffect, useState, useMemo } from "react";
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
import FetchData from "../../../services/fetchRequests/fetchData";
import getCurrentUser from "../../../services/fetchRequests/getCurrentUser";
import EmployeeAssignmentTile from "../tiles/EmployeeAssignmentTile";
import RequestedTile from "../tiles/RequestedTile";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../../services/styles/theme";

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
  { value: "distanceClosest", label: "Distance (Closest)", icon: "location-arrow" },
  { value: "distanceFurthest", label: "Distance (Furthest)", icon: "location-arrow" },
  { value: "priceLow", label: "Price (Low to High)", icon: "dollar" },
  { value: "priceHigh", label: "Price (High to Low)", icon: "dollar" },
];

const AppointmentCalendar = ({ state }) => {
  const [appointments, setAppointments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState({});
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [sortOption, setSortOption] = useState("distanceClosest");
  const [showSortModal, setShowSortModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const navigate = useNavigate();

  // Calculate marked dates for calendar
  const markedDates = useMemo(() => {
    const marks = {};
    const allDates = [...appointments, ...requests].map((a) => a.date);
    const uniqueDates = [...new Set(allDates)];

    uniqueDates.forEach((date) => {
      const isSelected = selectedDate === date;
      const appointmentCount = appointments.filter((a) => a.date === date).length;
      const requestCount = requests.filter((r) => r.date === date).length;

      marks[date] = {
        marked: true,
        dotColor: requestCount > 0 ? colors.warning[500] : colors.success[500],
        selected: isSelected,
        selectedColor: colors.primary[500],
        customStyles: {
          container: {
            backgroundColor: isSelected ? colors.primary[500] : "transparent",
          },
          text: {
            color: isSelected ? colors.neutral[0] : colors.text.primary,
          },
        },
      };
    });

    return marks;
  }, [appointments, requests, selectedDate]);

  // Fetch data
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);

    try {
      const [appointmentData, userData] = await Promise.all([
        FetchData.get("/api/v1/users/appointments/employee", state.currentUser.token),
        getCurrentUser(),
      ]);

      const now = new Date();
      const isUpcoming = (item) => new Date(item.date) >= new Date(now.toDateString());

      // Filter out jobs that have already been assigned to anyone (including yourself)
      // Those should only show on the "My Jobs" page
      const availableAppointments = (appointmentData.appointments || [])
        .filter(isUpcoming)
        .filter((appt) => !appt.hasBeenAssigned);

      setAppointments(availableAppointments);
      setRequests((appointmentData.requested || []).filter(isUpcoming));
      setUserId(userData.user.id);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.currentUser?.token]);

  useEffect(() => {
    if (state.currentUser?.token) fetchData();
  }, [state.currentUser?.token, fetchData]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      const watcher = navigator.geolocation.watchPosition(
        (pos) =>
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        (err) => {
          console.error("Geolocation error:", err);
          setUserLocation({ latitude: 0, longitude: 0 });
        },
        { enableHighAccuracy: true, timeout: 30000 }
      );

      return () => navigator.geolocation.clearWatch(watcher);
    }
  }, []);

  // Fetch distances
  useEffect(() => {
    const fetchDistances = async () => {
      if (!userLocation || (appointments.length === 0 && requests.length === 0)) {
        return;
      }

      const all = [...appointments, ...requests];
      const locations = await Promise.all(
        all.map(async (appt) => {
          const loc = await FetchData.getLatAndLong(appt.homeId);
          if (!loc) return null;
          const distance = haversineDistance(
            userLocation.latitude,
            userLocation.longitude,
            loc.latitude,
            loc.longitude
          );
          return { [appt.homeId]: { location: loc, distance } };
        })
      );
      setAppointmentLocations(Object.assign({}, ...locations.filter(Boolean)));
    };

    fetchDistances();
  }, [userLocation, appointments, requests]);

  // Sorting helper
  const sortAppointments = useCallback(
    (list) => {
      return [...list].sort((a, b) => {
        const getDistance = (appt) =>
          appointmentLocations[appt.homeId]?.distance || Infinity;
        const getPrice = (appt) => Number(appt.price) || 0;

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

  // Filter by date
  const handleDateSelect = useCallback(
    (date) => {
      const dateString = date.dateString || date;
      setSelectedDate(dateString);

      const sameDay = (appt) => appt.date === dateString;

      const updatedAppointments = appointments.filter(sameDay).map((a) => ({
        ...a,
        distance: appointmentLocations[a.homeId]?.distance || null,
      }));

      const updatedRequests = requests.filter(sameDay).map((r) => ({
        ...r,
        distance: appointmentLocations[r.homeId]?.distance || null,
      }));

      setFilteredAppointments(sortAppointments(updatedAppointments));
      setFilteredRequests(sortAppointments(updatedRequests));
    },
    [appointments, requests, appointmentLocations, sortAppointments]
  );

  // Update filtering when sort changes
  useEffect(() => {
    if (selectedDate) {
      handleDateSelect(selectedDate);
    }
  }, [sortOption]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  const formatSelectedDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString + "T00:00:00");
    const options = { weekday: "long", month: "long", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  const currentSortLabel = sortOptions.find((o) => o.value === sortOption)?.label || "Sort";

  // Calendar day render
  const renderDay = useCallback(
    ({ date }) => {
      const today = new Date();
      const dayDate = new Date(date.dateString);
      const isPast = dayDate < new Date(today.toDateString());

      const appointmentCount = appointments.filter((a) => a.date === date.dateString).length;
      const requestCount = requests.filter((r) => r.date === date.dateString).length;
      const totalCount = appointmentCount + requestCount;
      const hasData = totalCount > 0;
      const isSelected = selectedDate === date.dateString;

      return (
        <Pressable
          disabled={isPast}
          style={[
            styles.dayContainer,
            isSelected && styles.dayContainerSelected,
            hasData && !isPast && !isSelected && styles.dayContainerHasData,
            isPast && styles.dayContainerPast,
          ]}
          onPress={() => !isPast && handleDateSelect(date)}
        >
          <Text
            style={[
              styles.dayText,
              isSelected && styles.dayTextSelected,
              isPast && styles.dayTextPast,
            ]}
          >
            {date.day}
          </Text>
          {hasData && !isPast && (
            <View style={[styles.dayBadge, isSelected && styles.dayBadgeSelected]}>
              <Text style={[styles.dayBadgeText, isSelected && styles.dayBadgeTextSelected]}>
                {totalCount}
              </Text>
            </View>
          )}
        </Pressable>
      );
    },
    [appointments, requests, selectedDate, handleDateSelect]
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
        <Text style={styles.title}>Job Calendar</Text>
        <Pressable style={styles.listButton} onPress={() => navigate("/new-job-choice")}>
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
        {/* Instructions */}
        <View style={styles.instructionCard}>
          <Icon name="hand-pointer-o" size={18} color={colors.primary[600]} />
          <Text style={styles.instructionText}>
            Tap a highlighted date to see available jobs
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
            <Text style={styles.legendText}>Available</Text>
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
                <Text style={styles.selectedDateLabel}>Jobs for</Text>
                <Text style={styles.selectedDateText}>{formatSelectedDate(selectedDate)}</Text>
              </View>
              <Pressable style={styles.sortButton} onPress={() => setShowSortModal(true)}>
                <Icon name="sort" size={14} color={colors.primary[600]} />
                <Text style={styles.sortButtonText}>{currentSortLabel}</Text>
              </Pressable>
            </View>

            {filteredRequests.length === 0 && filteredAppointments.length === 0 ? (
              <View style={styles.noJobsCard}>
                <Icon name="calendar-times-o" size={32} color={colors.text.tertiary} />
                <Text style={styles.noJobsTitle}>No Jobs Available</Text>
                <Text style={styles.noJobsText}>
                  There are no available jobs for this date. Try selecting a different date.
                </Text>
              </View>
            ) : (
              <>
                {/* Requested Jobs */}
                {filteredRequests.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <View style={styles.sectionTitleRow}>
                        <View style={styles.sectionBadge}>
                          <Icon name="clock-o" size={12} color={colors.warning[600]} />
                        </View>
                        <Text style={styles.sectionTitle}>Pending Requests</Text>
                      </View>
                      <Text style={styles.sectionCount}>{filteredRequests.length}</Text>
                    </View>
                    {filteredRequests.map((appt) => (
                      <View key={appt.id} style={styles.tileWrapper}>
                        <RequestedTile
                          {...appt}
                          cleanerId={userId}
                          removeRequest={async (employeeId, appointmentId) => {
                            try {
                              await FetchData.removeRequest(employeeId, appointmentId);
                              setRequests((prev) => {
                                const removed = prev.find((r) => r.id === appointmentId);
                                if (removed) {
                                  setAppointments((apps) => [...apps, removed]);
                                  setFilteredAppointments((apps) => [...apps, removed]);
                                }
                                return prev.filter((r) => r.id !== appointmentId);
                              });
                              setFilteredRequests((prev) =>
                                prev.filter((r) => r.id !== appointmentId)
                              );
                            } catch (err) {
                              console.error("Error removing request:", err);
                            }
                          }}
                        />
                      </View>
                    ))}
                  </View>
                )}

                {/* Available Jobs */}
                {filteredAppointments.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <View style={styles.sectionTitleRow}>
                        <View style={[styles.sectionBadge, styles.sectionBadgeAvailable]}>
                          <Icon name="check" size={12} color={colors.success[600]} />
                        </View>
                        <Text style={styles.sectionTitle}>Available Jobs</Text>
                      </View>
                      <Text style={styles.sectionCount}>{filteredAppointments.length}</Text>
                    </View>
                    {filteredAppointments.map((appt) => (
                      <View key={appt.id} style={styles.tileWrapper}>
                        <EmployeeAssignmentTile
                          {...appt}
                          cleanerId={userId}
                          assigned={appt.employeesAssigned?.includes(String(userId))}
                          addEmployee={async (employeeId, appointmentId) => {
                            try {
                              await FetchData.addEmployee(employeeId, appointmentId);
                              setAppointments((prev) => {
                                const appointment = prev.find((r) => r.id === appointmentId);
                                if (appointment) {
                                  setRequests((reqs) => [...reqs, appointment]);
                                  setFilteredRequests((reqs) => [...reqs, appointment]);
                                }
                                return prev.filter((r) => r.id !== appointmentId);
                              });
                              setFilteredAppointments((prev) =>
                                prev.filter((r) => r.id !== appointmentId)
                              );
                            } catch (err) {
                              console.error("Error sending request:", err);
                            }
                          }}
                          removeEmployee={async () => {}}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </>
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
              Tap on a highlighted date in the calendar above to view available cleaning jobs.
            </Text>
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
        <Pressable style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort Jobs By</Text>
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
                  color={sortOption === option.value ? colors.primary[600] : colors.text.secondary}
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

  // No Jobs Card
  noJobsCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    ...shadows.sm,
  },
  noJobsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  noJobsText: {
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
  sectionBadgeAvailable: {
    backgroundColor: colors.success[100],
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

export default AppointmentCalendar;
