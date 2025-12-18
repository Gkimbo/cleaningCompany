import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  { value: "dateNewest", label: "Date (Soonest)", icon: "calendar" },
  { value: "dateOldest", label: "Date (Latest)", icon: "calendar" },
];

const SelectNewJobList = ({ state }) => {
  const [allAppointments, setAllAppointments] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState(null);
  const [sortOption, setSortOption] = useState("dateNewest");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);

  const navigate = useNavigate();

  const requestsAndAppointments = useMemo(() => {
    const requestsWithFlag = allRequests.map((item) => ({
      ...item,
      isRequest: true,
    }));
    const appointmentsWithFlag = allAppointments.map((item) => ({
      ...item,
      isRequest: false,
    }));
    return [...requestsWithFlag, ...appointmentsWithFlag];
  }, [allRequests, allAppointments]);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);

    try {
      const [appointmentResponse, userResponse] = await Promise.all([
        FetchData.get("/api/v1/users/appointments/employee", state.currentUser.token),
        getCurrentUser(),
      ]);

      const now = new Date();
      const isUpcoming = (item) => new Date(item.date) >= now;

      // Filter out jobs that have already been assigned to anyone (including yourself)
      // Those should only show on the "My Jobs" page
      const availableAppointments = (appointmentResponse.appointments || [])
        .filter(isUpcoming)
        .filter((appt) => !appt.hasBeenAssigned);

      setAllAppointments(availableAppointments);
      setAllRequests((appointmentResponse.requested || []).filter(isUpcoming));
      setUserId(userResponse.user.id);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.currentUser.token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locations = await Promise.all(
          [...allAppointments, ...allRequests].map(async (appointment) => {
            const response = await FetchData.getLatAndLong(appointment.homeId);
            return { [appointment.homeId]: response };
          })
        );
        setAppointmentLocations(Object.assign({}, ...locations));
      } catch (error) {
        console.error("Error fetching locations:", error);
      }
    };

    if (allAppointments.length > 0 || allRequests.length > 0) {
      fetchLocations();
    }
  }, [allAppointments, allRequests]);

  useEffect(() => {
    if (navigator.geolocation) {
      const watcher = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          setUserLocation({ latitude: 0, longitude: 0 });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      return () => navigator.geolocation.clearWatch(watcher);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  const sortedData = useMemo(() => {
    const processed = requestsAndAppointments.map((appointment) => {
      let distance = null;
      if (userLocation && appointmentLocations?.[appointment.homeId]) {
        const loc = appointmentLocations[appointment.homeId];
        distance = haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          loc.latitude,
          loc.longitude
        );
      }
      return { ...appointment, distance };
    });

    const sortFn = {
      distanceClosest: (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity),
      distanceFurthest: (a, b) => (b.distance ?? 0) - (a.distance ?? 0),
      priceLow: (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0),
      priceHigh: (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0),
      dateNewest: (a, b) => new Date(a.date) - new Date(b.date),
      dateOldest: (a, b) => new Date(b.date) - new Date(a.date),
    };

    return [...processed].sort((a, b) => {
      const primary = sortFn[sortOption]?.(a, b) ?? 0;
      if (primary === 0) return a.id > b.id ? 1 : -1;
      return primary;
    });
  }, [requestsAndAppointments, userLocation, appointmentLocations, sortOption]);

  const availableJobs = sortedData.filter((item) => !item.isRequest);
  const requestedJobs = sortedData.filter((item) => item.isRequest);

  const currentSortLabel = sortOptions.find((o) => o.value === sortOption)?.label || "Sort";

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Finding available jobs...</Text>
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
        <Text style={styles.title}>Find Jobs</Text>
        <Pressable style={styles.calendarButton} onPress={() => navigate("/appointment-calender")}>
          <Icon name="calendar" size={18} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{availableJobs.length}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={[styles.statCard, styles.statCardHighlight]}>
          <Text style={[styles.statValue, styles.statValueHighlight]}>{requestedJobs.length}</Text>
          <Text style={[styles.statLabel, styles.statLabelHighlight]}>Requested</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{sortedData.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Sort Button */}
      <Pressable style={styles.sortButton} onPress={() => setShowSortModal(true)}>
        <Icon name="sort" size={14} color={colors.primary[600]} />
        <Text style={styles.sortButtonText}>{currentSortLabel}</Text>
        <Icon name="angle-down" size={14} color={colors.primary[600]} />
      </Pressable>

      {/* Job List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
          />
        }
      >
        {sortedData.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="briefcase" size={40} color={colors.primary[300]} />
            </View>
            <Text style={styles.emptyTitle}>No Jobs Available</Text>
            <Text style={styles.emptyText}>
              Check back later to see new cleaning opportunities in your area.
            </Text>
            <Pressable style={styles.refreshButton} onPress={onRefresh}>
              <Icon name="refresh" size={14} color={colors.neutral[0]} />
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Requested Jobs Section */}
            {requestedJobs.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionBadge}>
                      <Icon name="clock-o" size={12} color={colors.warning[600]} />
                    </View>
                    <Text style={styles.sectionTitle}>Pending Requests</Text>
                  </View>
                  <Text style={styles.sectionCount}>{requestedJobs.length}</Text>
                </View>
                {requestedJobs.map((appointment) => (
                  <View key={appointment.id} style={styles.tileWrapper}>
                    <RequestedTile
                      {...appointment}
                      cleanerId={userId}
                      removeRequest={async (employeeId, appointmentId) => {
                        try {
                          await FetchData.removeRequest(employeeId, appointmentId);
                          setAllRequests((prev) => {
                            const removed = prev.find((a) => a.id === appointmentId);
                            if (removed) setAllAppointments((apps) => [...apps, removed]);
                            return prev.filter((a) => a.id !== appointmentId);
                          });
                        } catch (err) {
                          console.error("Error removing request:", err);
                        }
                      }}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* Available Jobs Section */}
            {availableJobs.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <View style={[styles.sectionBadge, styles.sectionBadgeAvailable]}>
                      <Icon name="check" size={12} color={colors.success[600]} />
                    </View>
                    <Text style={styles.sectionTitle}>Available Jobs</Text>
                  </View>
                  <Text style={styles.sectionCount}>{availableJobs.length}</Text>
                </View>
                {availableJobs.map((appointment) => (
                  <View key={appointment.id} style={styles.tileWrapper}>
                    <EmployeeAssignmentTile
                      {...appointment}
                      cleanerId={userId}
                      assigned={appointment.employeesAssigned?.includes(String(userId)) || false}
                      addEmployee={async (employeeId, appointmentId) => {
                        try {
                          await FetchData.addEmployee(employeeId, appointmentId);
                          setAllAppointments((prev) => {
                            const assigned = prev.find((a) => a.id === appointmentId);
                            if (assigned) setAllRequests((reqs) => [...reqs, assigned]);
                            return prev.filter((a) => a.id !== appointmentId);
                          });
                        } catch (err) {
                          console.error("Error adding employee:", err);
                        }
                      }}
                      removeEmployee={async (employeeId, appointmentId) => {
                        try {
                          await FetchData.removeEmployee(employeeId, appointmentId);
                          setAllAppointments((prev) =>
                            prev.map((a) =>
                              a.id === appointmentId
                                ? {
                                    ...a,
                                    employeesAssigned: a.employeesAssigned?.filter(
                                      (id) => id !== String(employeeId)
                                    ),
                                  }
                                : a
                            )
                          );
                        } catch (err) {
                          console.error("Error removing employee:", err);
                        }
                      }}
                    />
                  </View>
                ))}
              </View>
            )}
          </>
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
  calendarButton: {
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

  // Sort Button
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginRight: spacing.lg,
    marginBottom: spacing.md,
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

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
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
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  refreshButtonText: {
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

export default SelectNewJobList;
