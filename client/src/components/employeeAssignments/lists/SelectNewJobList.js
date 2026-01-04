import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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
import RequestedTile from "../tiles/RequestedTile";
import LargeHomeWarningModal from "../../modals/LargeHomeWarningModal";
import JobFilterModal, { defaultFilters } from "./JobFilterModal";
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
  { value: "distanceClosest", label: "Distance (Closest)", icon: "location-arrow" },
  { value: "distanceFurthest", label: "Distance (Furthest)", icon: "location-arrow" },
  { value: "priceLow", label: "Price (Low to High)", icon: "dollar" },
  { value: "priceHigh", label: "Price (High to Low)", icon: "dollar" },
  { value: "dateNewest", label: "Date (Soonest)", icon: "calendar" },
  { value: "dateOldest", label: "Date (Latest)", icon: "calendar" },
];

const SelectNewJobList = ({ state }) => {
  const { pricing } = usePricing();
  const [allAppointments, setAllAppointments] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState(null);
  const [sortOption, setSortOption] = useState("dateNewest");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);

  // Large home warning modal state
  const [showLargeHomeModal, setShowLargeHomeModal] = useState(false);
  const [bookingInfo, setBookingInfo] = useState(null);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Stripe setup required state
  const [showStripeSetupModal, setShowStripeSetupModal] = useState(false);
  const [stripeSetupMessage, setStripeSetupMessage] = useState("");

  const navigate = useNavigate();

  // Filter state
  const [filters, setFilters] = useState(defaultFilters);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [homeDetails, setHomeDetails] = useState({});
  const [availableCities, setAvailableCities] = useState([]);

  // Preferred homes state
  const [preferredHomeIds, setPreferredHomeIds] = useState([]);

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

  // Fetch preferred home IDs for this cleaner
  useEffect(() => {
    const fetchPreferredHomes = async () => {
      try {
        const response = await FetchData.get("/api/v1/users/preferred-homes", state.currentUser.token);
        if (response.preferredHomeIds) {
          setPreferredHomeIds(response.preferredHomeIds);
        }
      } catch (error) {
        console.error("Error fetching preferred homes:", error);
      }
    };

    if (state.currentUser.token) {
      fetchPreferredHomes();
    }
  }, [state.currentUser.token]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const allItems = [...allAppointments, ...allRequests];
        // Deduplicate homeIds to avoid redundant fetches
        const uniqueHomeIds = [...new Set(allItems.map((a) => a.homeId))];

        const locations = await Promise.all(
          uniqueHomeIds.map(async (homeId) => {
            const response = await FetchData.getLatAndLong(homeId);
            // Validate the response has lat/long
            if (response && typeof response.latitude === "number" && typeof response.longitude === "number") {
              return { [homeId]: response };
            }
            return { [homeId]: null };
          })
        );
        setAppointmentLocations(Object.assign({}, ...locations));
      } catch (error) {
        console.log("Error fetching locations:", error.message);
      }
    };

    if (allAppointments.length > 0 || allRequests.length > 0) {
      fetchLocations();
    }
  }, [allAppointments, allRequests]);

  useEffect(() => {
    let locationSubscription = null;

    const startLocationTracking = async () => {
      try {
        // Request permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("Location permission denied");
          return;
        }

        // Get initial location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        console.log("User location detected:", location.coords.latitude, location.coords.longitude);
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        // Watch for location updates
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 30000,
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
        console.log("Location unavailable:", error.message || error);
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Fetch home details for filtering
  useEffect(() => {
    const fetchHomeDetails = async () => {
      const allItems = [...allAppointments, ...allRequests];
      const homeIds = [...new Set(allItems.map((a) => a.homeId))];
      const details = {};

      await Promise.all(
        homeIds.map(async (homeId) => {
          try {
            const response = await FetchData.getHome(homeId);
            if (response && !response.error) {
              details[homeId] = response.home || response;
            }
          } catch (err) {
            console.error("Error fetching home:", homeId, err);
          }
        })
      );

      setHomeDetails(details);
      const cities = [...new Set(
        Object.values(details)
          .map((h) => h?.city)
          .filter(Boolean)
      )].sort();
      setAvailableCities(cities);
    };

    if (allAppointments.length > 0 || allRequests.length > 0) {
      fetchHomeDetails();
    }
  }, [allAppointments, allRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  // Handle booking request with large home check
  const handleBookingRequest = useCallback(async (employeeId, appointmentId) => {
    try {
      // First, check if this is a large home that requires acknowledgment
      const info = await FetchData.getBookingInfo(appointmentId, state.currentUser.token);

      if (info.error) {
        console.error("Error getting booking info:", info.error);
        // Proceed with booking anyway if we can't get info
        const result = await FetchData.addEmployee(employeeId, appointmentId, false);
        if (result.success) {
          setAllAppointments((prev) => {
            const assigned = prev.find((a) => a.id === appointmentId);
            if (assigned) setAllRequests((reqs) => [...reqs, assigned]);
            return prev.filter((a) => a.id !== appointmentId);
          });
        }
        return;
      }

      if (info.requiresAcknowledgment) {
        // Show warning modal for large homes
        setBookingInfo(info);
        setPendingBooking({ employeeId, appointmentId });
        setShowLargeHomeModal(true);
      } else {
        // Proceed directly for small homes
        const result = await FetchData.addEmployee(employeeId, appointmentId, false);
        if (result.success) {
          setAllAppointments((prev) => {
            const assigned = prev.find((a) => a.id === appointmentId);
            if (assigned && !result.directBooking) {
              setAllRequests((reqs) => [...reqs, assigned]);
            }
            return prev.filter((a) => a.id !== appointmentId);
          });
          // Show success message
          if (result.directBooking) {
            Alert.alert(
              "Job Booked!",
              "As a preferred cleaner, this job has been confirmed automatically. The homeowner has been notified.",
              [{ text: "OK" }]
            );
          }
        } else if (result.requiresStripeSetup) {
          // Show Stripe setup modal
          setStripeSetupMessage(result.message || "You need to set up your Stripe account to receive payments before you can request appointments.");
          setShowStripeSetupModal(true);
        } else if (result.error) {
          console.error("Error booking:", result.error);
        }
      }
    } catch (err) {
      console.error("Error handling booking request:", err);
    }
  }, [state.currentUser.token]);

  // Confirm booking after acknowledging large home warning
  const handleConfirmLargeHomeBooking = useCallback(async () => {
    if (!pendingBooking) return;

    setBookingLoading(true);
    try {
      const { employeeId, appointmentId } = pendingBooking;
      const result = await FetchData.addEmployee(employeeId, appointmentId, true);

      if (result.success) {
        setAllAppointments((prev) => {
          const assigned = prev.find((a) => a.id === appointmentId);
          if (assigned && !result.directBooking) {
            setAllRequests((reqs) => [...reqs, assigned]);
          }
          return prev.filter((a) => a.id !== appointmentId);
        });
        setShowLargeHomeModal(false);
        setBookingInfo(null);
        setPendingBooking(null);
        // Show success message for direct bookings
        if (result.directBooking) {
          Alert.alert(
            "Job Booked!",
            "As a preferred cleaner, this job has been confirmed automatically. The homeowner has been notified.",
            [{ text: "OK" }]
          );
        }
      } else if (result.requiresStripeSetup) {
        setShowLargeHomeModal(false);
        setBookingInfo(null);
        setPendingBooking(null);
        setStripeSetupMessage(result.message || "You need to set up your Stripe account to receive payments before you can request appointments.");
        setShowStripeSetupModal(true);
      } else if (result.error) {
        console.error("Error confirming booking:", result.error);
      }
    } catch (err) {
      console.error("Error confirming large home booking:", err);
    } finally {
      setBookingLoading(false);
    }
  }, [pendingBooking]);

  // Close large home modal
  const handleCloseLargeHomeModal = useCallback(() => {
    setShowLargeHomeModal(false);
    setBookingInfo(null);
    setPendingBooking(null);
  }, []);

  const sortedData = useMemo(() => {
    const processed = requestsAndAppointments.map((appointment) => {
      let distance = null;
      const loc = appointmentLocations?.[appointment.homeId];
      // Only calculate distance if we have valid user location and home location
      if (
        userLocation &&
        userLocation.latitude !== 0 &&
        userLocation.longitude !== 0 &&
        loc &&
        typeof loc.latitude === "number" &&
        typeof loc.longitude === "number"
      ) {
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

  // Filter the sorted data
  const filteredData = useMemo(() => {
    return sortedData.filter((appt) => {
      const home = homeDetails[appt.homeId];

      // Preferred homes filter
      if (filters.preferredOnly && !preferredHomeIds.includes(appt.homeId)) {
        return false;
      }

      // Distance filter (distance is in km, convert miles for comparison)
      if (filters.distance.preset !== "any" && userLocation) {
        const maxDistMiles = filters.distance.preset === "custom"
          ? filters.distance.customValue
          : parseInt(filters.distance.preset);
        const distMiles = (appt.distance ?? 999) * 0.621371;
        if (distMiles > maxDistMiles) return false;
      }

      // Sheets filter
      if (filters.sheets === "needed" && appt.bringSheets !== "yes") return false;
      if (filters.sheets === "not_needed" && appt.bringSheets === "yes") return false;

      // Towels filter
      if (filters.towels === "needed" && appt.bringTowels !== "yes") return false;
      if (filters.towels === "not_needed" && appt.bringTowels === "yes") return false;

      // Skip home-based filters if home data not loaded
      if (home) {
        // Bedrooms filter
        const beds = parseFloat(home.numBeds) || 0;
        if (filters.bedrooms !== "any") {
          if (filters.bedrooms === "5+") {
            if (beds < 5) return false;
          } else {
            if (beds !== parseInt(filters.bedrooms)) return false;
          }
        }

        // Bathrooms filter
        const baths = parseFloat(home.numBaths) || 0;
        const halfBaths = parseFloat(home.numHalfBaths) || 0;
        const totalBaths = baths + (halfBaths * 0.5);
        if (filters.bathrooms !== "any") {
          if (filters.bathrooms === "3+") {
            if (totalBaths < 3) return false;
          } else {
            if (totalBaths !== parseFloat(filters.bathrooms)) return false;
          }
        }

        // City filter
        if (filters.city !== "any" && home.city !== filters.city) return false;
      }

      // Time window filter
      if (filters.timeWindow !== "any" && appt.timeToBeCompleted !== filters.timeWindow) {
        return false;
      }

      // Min earnings filter (cleaner share based on platform fee)
      if (filters.minEarnings) {
        const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
        const earnings = Number(appt.price) * cleanerSharePercent;
        if (earnings < filters.minEarnings) return false;
      }

      return true;
    });
  }, [sortedData, homeDetails, filters, userLocation, preferredHomeIds, pricing]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.distance.preset !== "any") count++;
    if (filters.sheets !== "any") count++;
    if (filters.towels !== "any") count++;
    if (filters.bedrooms !== "any") count++;
    if (filters.bathrooms !== "any") count++;
    if (filters.timeWindow !== "any") count++;
    if (filters.city !== "any") count++;
    if (filters.minEarnings) count++;
    if (filters.preferredOnly) count++;
    return count;
  }, [filters]);

  const availableJobs = filteredData.filter((item) => !item.isRequest);
  const requestedJobs = filteredData.filter((item) => item.isRequest);

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
          <Text style={styles.statValue}>
            {activeFilterCount > 0 ? `${filteredData.length}/${sortedData.length}` : sortedData.length}
          </Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Controls Row */}
      <View style={styles.controlsRow}>
        {/* Filter Button */}
        <Pressable style={styles.filterButton} onPress={() => setShowFilterModal(true)}>
          <Icon name="filter" size={14} color={colors.primary[600]} />
          <Text style={styles.filterButtonText}>Filter</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>

        {/* Sort Button */}
        <Pressable style={styles.sortButton} onPress={() => setShowSortModal(true)}>
          <Icon name="sort" size={14} color={colors.primary[600]} />
          <Text style={styles.sortButtonText}>{currentSortLabel}</Text>
          <Icon name="angle-down" size={14} color={colors.primary[600]} />
        </Pressable>
      </View>

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
        {filteredData.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon
                name={activeFilterCount > 0 ? "filter" : "briefcase"}
                size={40}
                color={activeFilterCount > 0 ? colors.neutral[400] : colors.primary[300]}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {activeFilterCount > 0 ? "No Jobs Match Your Filters" : "No Jobs Available"}
            </Text>
            <Text style={styles.emptyText}>
              {activeFilterCount > 0
                ? "Try adjusting your filters to see more opportunities."
                : "Check back later to see new cleaning opportunities in your area."}
            </Text>
            {activeFilterCount > 0 ? (
              <Pressable
                style={styles.clearFiltersButton}
                onPress={() => setFilters(defaultFilters)}
              >
                <Icon name="times-circle" size={14} color={colors.primary[600]} />
                <Text style={styles.clearFiltersButtonText}>Clear All Filters</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.refreshButton} onPress={onRefresh}>
                <Icon name="refresh" size={14} color={colors.neutral[0]} />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </Pressable>
            )}
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
                      isPreferred={preferredHomeIds.includes(appointment.homeId)}
                      addEmployee={handleBookingRequest}
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

      {/* Large Home Warning Modal */}
      <LargeHomeWarningModal
        visible={showLargeHomeModal}
        onClose={handleCloseLargeHomeModal}
        onConfirm={handleConfirmLargeHomeBooking}
        bookingInfo={bookingInfo}
        loading={bookingLoading}
      />

      {/* Filter Modal */}
      <JobFilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={filters}
        onApply={setFilters}
        availableCities={availableCities}
        matchCount={filteredData.length}
        hasGeolocation={userLocation && userLocation.latitude !== 0}
        hasPreferredHomes={preferredHomeIds.length > 0}
      />

      {/* Stripe Setup Required Modal */}
      <Modal
        visible={showStripeSetupModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStripeSetupModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowStripeSetupModal(false)}>
          <View style={styles.stripeModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.stripeModalIcon}>
              <Icon name="credit-card" size={32} color={colors.primary[600]} />
            </View>
            <Text style={styles.stripeModalTitle}>Payment Setup Required</Text>
            <Text style={styles.stripeModalMessage}>{stripeSetupMessage}</Text>
            <View style={styles.stripeModalButtons}>
              <Pressable
                style={styles.stripeSetupButton}
                onPress={() => {
                  setShowStripeSetupModal(false);
                  navigate("/earnings");
                }}
              >
                <Icon name="credit-card" size={16} color={colors.neutral[0]} />
                <Text style={styles.stripeSetupButtonText}>Set Up Payments</Text>
              </Pressable>
              <Pressable
                style={styles.stripeCancelButton}
                onPress={() => setShowStripeSetupModal(false)}
              >
                <Text style={styles.stripeCancelButtonText}>Maybe Later</Text>
              </Pressable>
            </View>
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

  // Controls Row
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },

  // Filter Button
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  filterButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  filterBadge: {
    backgroundColor: colors.primary[600],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
  },

  // Sort Button
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

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },

  // Sections
  section: {
    marginBottom: spacing["2xl"],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
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
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.neutral[0],
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border.light,
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
  clearFiltersButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  clearFiltersButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
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

  // Stripe Setup Modal
  stripeModalContent: {
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing.lg,
    marginVertical: "auto",
    borderRadius: radius["2xl"],
    padding: spacing.xl,
    alignItems: "center",
    ...shadows.lg,
  },
  stripeModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  stripeModalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  stripeModalMessage: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  stripeModalButtons: {
    width: "100%",
    gap: spacing.sm,
  },
  stripeSetupButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  stripeSetupButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  stripeCancelButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  stripeCancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
});

export default SelectNewJobList;
