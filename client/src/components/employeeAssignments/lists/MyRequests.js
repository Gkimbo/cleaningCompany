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
  { value: "dateOldest", label: "Date (Latest)", icon: "calendar-o" },
  { value: "distanceClosest", label: "Distance (Closest)", icon: "location-arrow" },
  { value: "distanceFurthest", label: "Distance (Furthest)", icon: "location-arrow" },
  { value: "priceLow", label: "Price (Low to High)", icon: "dollar" },
  { value: "priceHigh", label: "Price (High to Low)", icon: "dollar" },
];

const MyRequests = ({ state }) => {
  const { pricing } = usePricing();
  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const [allRequests, setAllRequests] = useState([]);
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState({});
  const [sortOption, setSortOption] = useState("dateNewest");
  const [showSortModal, setShowSortModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const navigate = useNavigate();

  // Fetch requests and user info
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);

    try {
      const [response, userResponse] = await Promise.all([
        FetchData.get("/api/v1/users/appointments/employee", state?.currentUser?.token),
        getCurrentUser(state?.currentUser?.token),
      ]);

      const now = new Date();
      const isUpcoming = (item) => new Date(item.date) >= new Date(now.toDateString());

      setAllRequests((response?.requested || []).filter(isUpcoming));
      setUserId(userResponse?.user?.id || null);
    } catch (error) {
      console.error("Error fetching requests:", error);
      setAllRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state?.currentUser?.token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch locations for appointments
  useEffect(() => {
    const fetchLocations = async () => {
      if (allRequests.length === 0) return;

      try {
        const locations = await Promise.all(
          allRequests.map(async (appointment) => {
            const loc = await FetchData.getLatAndLong(appointment.homeId);
            return { [appointment.homeId]: loc };
          })
        );
        setAppointmentLocations(Object.assign({}, ...locations));
      } catch (error) {
        console.log("Error fetching appointment locations:", error.message);
      }
    };

    fetchLocations();
  }, [allRequests]);

  // Get user location using expo-location
  useEffect(() => {
    let locationSubscription = null;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("[MyRequests] Location permission denied");
          return;
        }

        // Get initial location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        // Watch for location updates
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
        console.log("[MyRequests] Location unavailable:", error.message);
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  // Sort requests
  const sortedRequests = useMemo(() => {
    const processed = (allRequests || []).map((appointment) => {
      let distance = null;
      const loc = appointmentLocations[appointment.homeId];
      if (userLocation && loc) {
        distance = haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          loc.latitude,
          loc.longitude
        );
      }
      return { ...appointment, distance };
    });

    return [...processed].sort((a, b) => {
      switch (sortOption) {
        case "dateNewest":
          return new Date(a.date) - new Date(b.date);
        case "dateOldest":
          return new Date(b.date) - new Date(a.date);
        case "distanceClosest":
          return (a.distance ?? Infinity) - (b.distance ?? Infinity);
        case "distanceFurthest":
          return (b.distance ?? 0) - (a.distance ?? 0);
        case "priceLow":
          return (Number(a.price) || 0) - (Number(b.price) || 0);
        case "priceHigh":
          return (Number(b.price) || 0) - (Number(a.price) || 0);
        default:
          return 0;
      }
    });
  }, [allRequests, userLocation, appointmentLocations, sortOption]);

  // Calculate stats (cleaners receive 90% of appointment price)
  const totalEarnings = sortedRequests.reduce(
    (sum, r) => sum + (Number(r.price) || 0) * cleanerSharePercent,
    0
  );

  const currentSortLabel =
    sortOptions.find((o) => o.value === sortOption)?.label || "Sort";

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
        <Pressable style={styles.backButton} onPress={() => navigate("/")}>
          <Icon name="angle-left" size={20} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>My Requests</Text>
        <Pressable
          style={styles.calendarButton}
          onPress={() => navigate("/my-requests-calendar")}
        >
          <Icon name="calendar" size={18} color={colors.primary[600]} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
              {sortedRequests.length}
            </Text>
            <Text style={[styles.statLabel, styles.statLabelHighlight]}>
              Pending
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>${totalEarnings.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Potential</Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Icon name="clock-o" size={18} color={colors.warning[600]} />
          <Text style={styles.infoText}>
            These are jobs you've requested. Once approved by the homeowner, they'll
            move to your "My Jobs" page.
          </Text>
        </View>

        {sortedRequests.length > 0 ? (
          <>
            {/* Sort Button */}
            <Pressable
              style={styles.sortButton}
              onPress={() => setShowSortModal(true)}
            >
              <Icon name="sort" size={14} color={colors.primary[600]} />
              <Text style={styles.sortButtonText}>{currentSortLabel}</Text>
              <Icon name="chevron-down" size={12} color={colors.primary[600]} />
            </Pressable>

            {/* Requests Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionBadge}>
                    <Icon name="clock-o" size={12} color={colors.warning[600]} />
                  </View>
                  <Text style={styles.sectionTitle}>Pending Approval</Text>
                </View>
                <Text style={styles.sectionCount}>{sortedRequests.length}</Text>
              </View>

              {sortedRequests.map((appointment) => (
                <View key={appointment.id} style={styles.tileWrapper}>
                  <RequestedTile
                    {...appointment}
                    cleanerId={userId}
                    distance={appointment.distance}
                    removeRequest={async (employeeId, appointmentId) => {
                      try {
                        await FetchData.removeRequest(employeeId, appointmentId);
                        setAllRequests((prev) =>
                          prev.filter((a) => a.id !== appointmentId)
                        );
                      } catch (error) {
                        console.error("Error removing request:", error);
                      }
                    }}
                  />
                </View>
              ))}
            </View>
          </>
        ) : (
          /* Empty State */
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="clock-o" size={40} color={colors.primary[300]} />
            </View>
            <Text style={styles.emptyTitle}>No Pending Requests</Text>
            <Text style={styles.emptyText}>
              You haven't requested any jobs yet. Browse available jobs and request
              the ones you'd like to work on!
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
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

  // Info Card
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    lineHeight: 20,
  },

  // Sort Button
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  sortButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },

  // Section
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
});

export default MyRequests;
