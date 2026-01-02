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

const CleaningRequestList = ({ state, dispatch }) => {
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState({});
  const [sortOption, setSortOption] = useState("dateNewest");
  const [showSortModal, setShowSortModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const navigate = useNavigate();

  // Safely extract appointments
  const appointmentArray = useMemo(() => {
    return (state.requests || [])
      .map((request) => ({ ...request.appointment, requestId: request.id }))
      .filter(
        (appointment) =>
          appointment && typeof appointment === "object" && !Array.isArray(appointment)
      );
  }, [state.requests]);

  // Calculate stats
  const pendingCount = appointmentArray.filter((a) => !a.hasBeenAssigned).length;
  const upcomingCount = appointmentArray.filter(
    (a) => new Date(a.date) >= new Date(new Date().toDateString())
  ).length;

  // Fetch user ID
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await getCurrentUser();
        setUserId(response?.user?.id || null);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  // Fetch appointment locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locations = await Promise.all(
          appointmentArray.map(async (appointment) => {
            const loc = await FetchData.getLatAndLong(appointment.homeId);
            return { [appointment.homeId]: loc };
          })
        );
        setAppointmentLocations(Object.assign({}, ...locations));
      } catch (error) {
        console.log("Error fetching appointment locations:", error.message);
      }
    };
    if (appointmentArray.length > 0) fetchLocations();
  }, [appointmentArray]);

  // Get user geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }

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
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate refresh - in real app would refetch data
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Sort and calculate distances
  const sortedRequests = useMemo(() => {
    if (!appointmentArray || appointmentArray.length === 0) return [];

    const mapped = appointmentArray.map((appointment) => {
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

    return [...mapped].sort((a, b) => {
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
  }, [appointmentArray, userLocation, appointmentLocations, sortOption]);

  const currentSortLabel =
    sortOptions.find((o) => o.value === sortOption)?.label || "Sort";

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading requests...</Text>
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
        <Text style={styles.title}>Cleaner Requests</Text>
        <Pressable
          style={styles.calendarButton}
          onPress={() => navigate("/all-requests-calendar")}
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
        {appointmentArray.length > 0 ? (
          <>
            {/* Stats Summary */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{pendingCount}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{upcomingCount}</Text>
                <Text style={styles.statLabel}>Upcoming</Text>
              </View>
              <View style={[styles.statCard, styles.statCardHighlight]}>
                <Text style={[styles.statValue, styles.statValueHighlight]}>
                  {appointmentArray.length}
                </Text>
                <Text style={[styles.statLabel, styles.statLabelHighlight]}>
                  Total
                </Text>
              </View>
            </View>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <Icon name="info-circle" size={18} color={colors.primary[600]} />
              <Text style={styles.infoText}>
                Review cleaner requests and approve or deny them for your cleaning appointments.
              </Text>
            </View>

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
                    <Icon name="users" size={12} color={colors.primary[600]} />
                  </View>
                  <Text style={styles.sectionTitle}>Pending Requests</Text>
                </View>
                <Text style={styles.sectionCount}>{sortedRequests.length}</Text>
              </View>

              {sortedRequests.map((appointment) => (
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
          </>
        ) : (
          /* Empty State */
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="inbox" size={40} color={colors.primary[300]} />
            </View>
            <Text style={styles.emptyTitle}>No Cleaning Requests</Text>
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

  // Info Card
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
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

export default CleaningRequestList;
