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
import * as Location from "expo-location";
import FetchData from "../../../services/fetchRequests/fetchData";
import getCurrentUser from "../../../services/fetchRequests/getCurrentUser";
import EmployeeAssignmentTile from "../tiles/EmployeeAssignmentTile";
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
  { value: "dateNewest", label: "Date (Soonest)", icon: "calendar" },
  { value: "dateOldest", label: "Date (Latest)", icon: "calendar" },
  { value: "distanceClosest", label: "Distance (Closest)", icon: "location-arrow" },
  { value: "distanceFurthest", label: "Distance (Furthest)", icon: "location-arrow" },
  { value: "priceLow", label: "Price (Low to High)", icon: "dollar" },
  { value: "priceHigh", label: "Price (High to Low)", icon: "dollar" },
];

const EmployeeAssignmentsList = ({ state, dispatch }) => {
  const [allAppointments, setAllAppointments] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState(null);
  const [sortOption, setSortOption] = useState("dateNewest");
  const [showSortModal, setShowSortModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);

  const navigate = useNavigate();

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);

    try {
      const [appointmentResponse, userResponse] = await Promise.all([
        FetchData.get("/api/v1/employee-info", state.currentUser.token),
        getCurrentUser(),
      ]);

      const appointments = appointmentResponse.employee?.cleanerAppointments || [];
      dispatch({ type: "USER_APPOINTMENTS", payload: appointments });
      setAllAppointments(appointments);
      setUserId(userResponse.user.id);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.currentUser.token, dispatch]);

  useEffect(() => {
    if (state.currentUser.token) {
      fetchData();
    }
  }, [state.currentUser.token, fetchData]);

  // Get user location using expo-location
  useEffect(() => {
    let locationSubscription = null;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("[EmployeeAssignmentsList] Location permission denied");
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
        console.error("[EmployeeAssignmentsList] Error getting location:", error);
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locations = await Promise.all(
          allAppointments.map(async (appointment) => {
            const response = await FetchData.getLatAndLong(appointment.homeId);
            return { [appointment.homeId]: response };
          })
        );
        setAppointmentLocations(Object.assign({}, ...locations));
      } catch (error) {
        console.error("Error fetching appointment locations:", error);
      }
    };
    if (allAppointments.length > 0) fetchLocations();
  }, [allAppointments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  const removeEmployee = async (employeeId, appointmentId) => {
    await FetchData.removeEmployee(employeeId, appointmentId);
    setAllAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
  };

  const addEmployee = async (employeeId, appointmentId) => {
    await FetchData.addEmployee(employeeId, appointmentId);
    fetchData(true);
  };

  // Filter to only show assigned appointments
  const assignedAppointments = useMemo(() => {
    if (!userId) return [];
    return allAppointments.filter((appointment) =>
      appointment.employeesAssigned?.includes(String(userId))
    );
  }, [allAppointments, userId]);

  // Sort appointments
  const sortedAppointments = useMemo(() => {
    let sorted = assignedAppointments.map((appointment) => {
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
      dateNewest: (a, b) => new Date(a.date) - new Date(b.date),
      dateOldest: (a, b) => new Date(b.date) - new Date(a.date),
      distanceClosest: (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity),
      distanceFurthest: (a, b) => (b.distance ?? 0) - (a.distance ?? 0),
      priceLow: (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0),
      priceHigh: (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0),
    };

    return sorted.sort((a, b) => {
      const primary = sortFn[sortOption]?.(a, b) ?? 0;
      if (primary === 0) return a.id > b.id ? 1 : -1;
      return primary;
    });
  }, [assignedAppointments, userLocation, appointmentLocations, sortOption]);

  // Separate upcoming and completed
  const now = new Date();
  const upcomingJobs = sortedAppointments.filter(
    (a) => new Date(a.date) >= new Date(now.toDateString()) && !a.completed
  );
  const completedJobs = sortedAppointments.filter((a) => a.completed);

  const totalEarnings = sortedAppointments.reduce(
    (sum, a) => sum + (Number(a.price) || 0),
    0
  );

  const currentSortLabel = sortOptions.find((o) => o.value === sortOption)?.label || "Sort";

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading your jobs...</Text>
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
        <Text style={styles.title}>My Jobs</Text>
        <Pressable
          style={styles.calendarButton}
          onPress={() => navigate("/my-appointment-calender")}
        >
          <Icon name="calendar" size={18} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{upcomingJobs.length}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </View>
        <View style={[styles.statCard, styles.statCardHighlight]}>
          <Text style={[styles.statValue, styles.statValueHighlight]}>
            ${totalEarnings.toFixed(0)}
          </Text>
          <Text style={[styles.statLabel, styles.statLabelHighlight]}>Earnings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{completedJobs.length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Sort Button */}
      {sortedAppointments.length > 0 && (
        <Pressable style={styles.sortButton} onPress={() => setShowSortModal(true)}>
          <Icon name="sort" size={14} color={colors.primary[600]} />
          <Text style={styles.sortButtonText}>{currentSortLabel}</Text>
          <Icon name="angle-down" size={14} color={colors.primary[600]} />
        </Pressable>
      )}

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
        {sortedAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="clipboard" size={40} color={colors.primary[300]} />
            </View>
            <Text style={styles.emptyTitle}>No Jobs Yet</Text>
            <Text style={styles.emptyText}>
              You haven't been assigned to any cleaning jobs yet. Browse available jobs to get started!
            </Text>
            <Pressable
              style={styles.findJobsButton}
              onPress={() => navigate("/new-job-choice")}
            >
              <Icon name="search" size={14} color={colors.neutral[0]} />
              <Text style={styles.findJobsButtonText}>Find Jobs</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Upcoming Jobs */}
            {upcomingJobs.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionBadge}>
                      <Icon name="clock-o" size={12} color={colors.primary[600]} />
                    </View>
                    <Text style={styles.sectionTitle}>Upcoming Jobs</Text>
                  </View>
                  <Text style={styles.sectionCount}>{upcomingJobs.length}</Text>
                </View>
                {upcomingJobs.map((appointment) => (
                  <View key={appointment.id} style={styles.tileWrapper}>
                    <EmployeeAssignmentTile
                      id={appointment.id}
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
                      addEmployee={addEmployee}
                      removeEmployee={removeEmployee}
                      assigned={true}
                      distance={appointment.distance}
                      timeToBeCompleted={appointment.timeToBeCompleted}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* Completed Jobs */}
            {completedJobs.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <View style={[styles.sectionBadge, styles.sectionBadgeCompleted]}>
                      <Icon name="check" size={12} color={colors.success[600]} />
                    </View>
                    <Text style={styles.sectionTitle}>Completed</Text>
                  </View>
                  <Text style={styles.sectionCount}>{completedJobs.length}</Text>
                </View>
                {completedJobs.map((appointment) => (
                  <View key={appointment.id} style={styles.tileWrapper}>
                    <EmployeeAssignmentTile
                      id={appointment.id}
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
                      addEmployee={addEmployee}
                      removeEmployee={removeEmployee}
                      assigned={true}
                      distance={appointment.distance}
                      timeToBeCompleted={appointment.timeToBeCompleted}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* Find More Jobs Card */}
            <Pressable
              style={styles.findMoreCard}
              onPress={() => navigate("/new-job-choice")}
            >
              <View style={styles.findMoreContent}>
                <Icon name="plus-circle" size={24} color={colors.primary[600]} />
                <View style={styles.findMoreTextContainer}>
                  <Text style={styles.findMoreTitle}>Find More Jobs</Text>
                  <Text style={styles.findMoreSubtitle}>
                    Browse available cleaning opportunities
                  </Text>
                </View>
              </View>
              <Icon name="chevron-right" size={16} color={colors.primary[600]} />
            </Pressable>
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
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statValueHighlight: {
    color: colors.success[700],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statLabelHighlight: {
    color: colors.success[600],
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
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  sectionBadgeCompleted: {
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

  // Find More Card
  findMoreCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary[200],
    borderStyle: "dashed",
    marginBottom: spacing.lg,
  },
  findMoreContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  findMoreTextContainer: {
    flex: 1,
  },
  findMoreTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  findMoreSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
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

export default EmployeeAssignmentsList;
