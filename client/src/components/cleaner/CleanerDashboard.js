import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import * as Location from "expo-location";
import FetchData from "../../services/fetchRequests/fetchData";
import PreferredCleanerService from "../../services/fetchRequests/PreferredCleanerService";
import { API_BASE } from "../../services/config";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import TaxFormsSection from "../tax/TaxFormsSection";
import ReviewsOverview from "../reviews/ReviewsOverview";
import TodaysAppointment from "../employeeAssignments/tiles/TodaysAppointment";
import NextAppointmentPreview from "../employeeAssignments/tiles/NextAppointmentPreview";
import JobCompletionFlow from "../employeeAssignments/jobPhotos/JobCompletionFlow";
import ClientAppointmentsSection from "./ClientAppointmentsSection";
import { usePricing } from "../../context/PricingContext";
import { parseLocalDate } from "../../utils/dateUtils";

// Payment Setup Banner Component
const PaymentSetupBanner = ({ onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.paymentBanner,
      pressed && styles.paymentBannerPressed,
    ]}
  >
    <View style={styles.paymentBannerIcon}>
      <Icon name="credit-card" size={20} color={colors.warning[600]} />
    </View>
    <View style={styles.paymentBannerContent}>
      <Text style={styles.paymentBannerTitle}>Complete Payment Setup</Text>
      <Text style={styles.paymentBannerSubtitle}>
        Set up your bank account to receive earnings from completed jobs
      </Text>
    </View>
    <View style={styles.paymentBannerAction}>
      <Text style={styles.paymentBannerActionText}>Set Up</Text>
      <Icon name="chevron-right" size={12} color={colors.primary[600]} />
    </View>
  </Pressable>
);

// Perk Tier Badge Component
const TIER_COLORS = {
  bronze: { bg: "#CD7F32", text: "#fff" },
  silver: { bg: "#C0C0C0", text: "#333" },
  gold: { bg: "#FFD700", text: "#333" },
  platinum: { bg: "#E5E4E2", text: "#333", border: "#8E8E8E" },
};

const PerkTierBadge = ({ perkStatus, onPress }) => {
  if (!perkStatus) return null;

  const tierColor = TIER_COLORS[perkStatus.tier] || TIER_COLORS.bronze;
  const tierName = perkStatus.tier.charAt(0).toUpperCase() + perkStatus.tier.slice(1);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.perkBadgeContainer,
        pressed && styles.perkBadgePressed,
      ]}
    >
      <View style={[
        styles.perkBadge,
        { backgroundColor: tierColor.bg },
        tierColor.border && { borderWidth: 1, borderColor: tierColor.border },
      ]}>
        <Icon
          name={perkStatus.tier === "platinum" ? "diamond" : perkStatus.tier === "gold" ? "star" : "trophy"}
          size={12}
          color={tierColor.text}
        />
        <Text style={[styles.perkBadgeText, { color: tierColor.text }]}>
          {tierName}
        </Text>
      </View>
      <View style={styles.perkBadgeInfo}>
        <Text style={styles.perkBadgeLabel}>Preferred Status</Text>
        <Text style={styles.perkBadgeValue}>
          {perkStatus.preferredHomeCount} home{perkStatus.preferredHomeCount !== 1 ? "s" : ""}
          {perkStatus.bonusPercent > 0 && ` • +${perkStatus.bonusPercent}% bonus`}
        </Text>
      </View>
      <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
    </Pressable>
  );
};

const { width } = Dimensions.get("window");

// Haversine distance calculation (returns km)
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

// Parse end time from format like "10am-3pm" → 15 (3pm in 24hr)
const parseEndTime = (timeToBeCompleted) => {
  if (!timeToBeCompleted || timeToBeCompleted === "anytime") {
    return 24; // Put "anytime" at the end
  }

  // Format: "10am-3pm" → extract "3pm"
  const match = timeToBeCompleted.match(/-(\d+)(am|pm)$/i);
  if (!match) return 24;

  let hour = parseInt(match[1], 10);
  const period = match[2].toLowerCase();

  if (period === "pm" && hour !== 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;

  return hour;
};

// Sort appointments by end time (earliest deadline first, anytime last)
const sortByEndTime = (appointments) => {
  return [...appointments].sort((a, b) => {
    const endA = parseEndTime(a.timeToBeCompleted);
    const endB = parseEndTime(b.timeToBeCompleted);
    return endA - endB;
  });
};

// Stat Card Component
const StatCard = ({
  title,
  value,
  subtitle,
  color = colors.primary[500],
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.statCard,
      { borderLeftColor: color },
      pressed && onPress && styles.statCardPressed,
    ]}
  >
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
    {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
  </Pressable>
);

// Section Header Component
const SectionHeader = ({ title, onPress, actionText }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onPress && (
      <Pressable onPress={onPress}>
        <Text style={styles.sectionAction}>{actionText || "View All"}</Text>
      </Pressable>
    )}
  </View>
);

// Quick Action Button Component
const QuickActionButton = ({ title, subtitle, onPress, icon, iconColor, bgColor, accentColor }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.quickActionButton,
      { backgroundColor: bgColor },
      pressed && styles.quickActionButtonPressed,
    ]}
  >
    <View style={[styles.quickActionIconContainer, { backgroundColor: accentColor }]}>
      <Icon name={icon} size={14} color={iconColor} />
    </View>
    <Text style={styles.quickActionText}>{title}</Text>
    {subtitle && <Text style={styles.quickActionSubtext}>{subtitle}</Text>}
  </Pressable>
);

// Upcoming Appointment Card Component
const UpcomingAppointmentCard = ({ appointment, home, onPress, cleanerSharePercent }) => {
  const appointmentDate = parseLocalDate(appointment.date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = appointmentDate.toDateString() === today.toDateString();
  const isTomorrow = appointmentDate.toDateString() === tomorrow.toDateString();

  const formatDate = (date) => {
    if (isToday) return "Today";
    if (isTomorrow) return "Tomorrow";
    const options = { weekday: "short", month: "short", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  const totalPrice = Number(appointment.price);
  const payout = totalPrice * cleanerSharePercent;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.appointmentCard,
        isToday && styles.appointmentCardToday,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.appointmentDateBadge}>
        <Text style={[styles.appointmentDateText, isToday && styles.todayText]}>
          {formatDate(appointmentDate)}
        </Text>
      </View>
      <View style={styles.appointmentDetails}>
        <Text style={styles.appointmentHome} numberOfLines={1}>
          {home?.city || "Loading..."}, {home?.state || ""}
        </Text>
        <Text style={styles.appointmentInfo}>
          {home?.numBeds || "?"} bed | {home?.numBaths || "?"} bath
        </Text>
      </View>
      <Text style={styles.appointmentPayout}>${payout.toFixed(2)}</Text>
    </Pressable>
  );
};

// Pending Request Card Component
const PendingRequestCard = ({ request, onPress, distance }) => {
  const [home, setHome] = useState(null);

  useEffect(() => {
    if (request.homeId) {
      FetchData.getHome(request.homeId).then((response) => {
        setHome(response.home);
      }).catch((err) => {
        console.error("Error fetching home for request:", err);
      });
    }
  }, [request.homeId]);

  const appointmentDate = new Date(request.date + "T00:00:00");

  const formatDate = (date) => {
    const options = { weekday: "short", month: "short", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  const formatDistance = (km) => {
    if (km === null || km === undefined) return null;
    const miles = km * 0.621371;
    return `${miles.toFixed(1)} mi`;
  };

  const distanceText = formatDistance(distance);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.requestCard,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.requestInfo}>
        <Text style={styles.requestDate}>{formatDate(appointmentDate)}</Text>
        <Text style={styles.requestLocation}>
          {home ? `${home.city}, ${home.state}` : "Loading..."}
        </Text>
        <View style={styles.requestDetailsRow}>
          <Text style={styles.requestDetails}>
            {home ? `${home.numBeds} bed | ${home.numBaths} bath` : "..."}
          </Text>
          {distanceText && (
            <View style={styles.distanceBadge}>
              <Icon name="location-arrow" size={10} color={colors.primary[600]} />
              <Text style={styles.distanceText}>{distanceText}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.requestBadge}>
        <Text style={styles.requestBadgeText}>Pending</Text>
      </View>
    </Pressable>
  );
};

const CleanerDashboard = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const { pricing } = usePricing();
  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [homeDetails, setHomeDetails] = useState({});
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState(null);
  const [showCompletionFlow, setShowCompletionFlow] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedHome, setSelectedHome] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [requestLocations, setRequestLocations] = useState({});

  // Stripe account status for payment setup banner
  const [stripeAccountStatus, setStripeAccountStatus] = useState(null);
  const [showPaymentBanner, setShowPaymentBanner] = useState(false);

  // Preferred cleaner perk status
  const [perkStatus, setPerkStatus] = useState(null);

  useEffect(() => {
    if (state.currentUser.token) {
      fetchDashboardData();
      fetchStripeAccountStatus();
      fetchPerkStatus();
    }
  }, [state.currentUser.token]);

  // Fetch preferred cleaner perk status
  const fetchPerkStatus = async () => {
    try {
      const status = await PreferredCleanerService.getMyPerkStatus(state.currentUser.token);
      setPerkStatus(status);
    } catch (err) {
      console.log("[CleanerDashboard] Error fetching perk status:", err.message);
    }
  };

  // Fetch Stripe account status to determine if banner should show
  const fetchStripeAccountStatus = async () => {
    if (!state?.currentUser?.id) return;

    try {
      const res = await fetch(
        `${API_BASE}/stripe-connect/account-status/${state.currentUser.id}`
      );
      const data = await res.json();

      if (res.ok) {
        setStripeAccountStatus(data);
        // Show banner if account doesn't exist or onboarding isn't complete
        setShowPaymentBanner(!data.hasAccount || !data.onboardingComplete);
      }
    } catch (err) {
      console.log("[CleanerDashboard] Error fetching Stripe status:", err.message);
      // If we can't fetch status, show the banner to be safe
      setShowPaymentBanner(true);
    }
  };

  // Get user's current location using expo-location
  useEffect(() => {
    let locationSubscription = null;

    const startLocationTracking = async () => {
      try {
        // Skip location tracking on web - it's often unavailable or unreliable
        if (Platform.OS === "web") {
          console.log("[CleanerDashboard] Skipping location tracking on web");
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("[CleanerDashboard] Location permission denied");
          return;
        }

        // Get initial location with a timeout fallback
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        } catch (locationError) {
          // Location unavailable - this is fine, we just won't show distances
          console.log("[CleanerDashboard] Location unavailable:", locationError.message);
          return;
        }

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
        // Don't show error for location issues - it's optional functionality
        console.log("[CleanerDashboard] Location tracking unavailable:", error.message);
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Fetch locations for pending requests
  useEffect(() => {
    const fetchRequestLocations = async () => {
      if (pendingRequests.length === 0) return;

      try {
        const uniqueHomeIds = [...new Set(pendingRequests.map(r => r.homeId))];
        const locations = await Promise.all(
          uniqueHomeIds.map(async (homeId) => {
            const loc = await FetchData.getLatAndLong(homeId);
            return { homeId, loc };
          })
        );
        const locMap = {};
        locations.forEach(({ homeId, loc }) => {
          locMap[homeId] = loc;
        });
        setRequestLocations(locMap);
      } catch (error) {
        console.log("[CleanerDashboard] Error fetching request locations:", error.message);
      }
    };

    fetchRequestLocations();
  }, [pendingRequests]);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Fetch cleaner's appointments
      const employeeResponse = await FetchData.get(
        "/api/v1/employee-info",
        state.currentUser.token
      );

      if (employeeResponse.employee) {
        setFirstName(employeeResponse.employee.firstName || "");
        const cleanerAppointments = employeeResponse.employee.cleanerAppointments || [];
        setAppointments(cleanerAppointments);

        // Dispatch to global state
        if (dispatch) {
          dispatch({
            type: "USER_APPOINTMENTS",
            payload: cleanerAppointments,
          });
        }

        // Fetch home details for each appointment
        const uniqueHomeIds = [...new Set(cleanerAppointments.map(apt => apt.homeId))];
        const homePromises = uniqueHomeIds.map(homeId =>
          FetchData.getHome(homeId).then(response => ({
            homeId,
            home: response.home,
          }))
        );
        const homeResults = await Promise.all(homePromises);
        const homeMap = {};
        homeResults.forEach(({ homeId, home }) => {
          homeMap[homeId] = home;
        });
        setHomeDetails(homeMap);
      }

      // Fetch pending requests (cleaner's own requests awaiting approval)
      const requestsResponse = await FetchData.get(
        "/api/v1/users/appointments/employee",
        state.currentUser.token
      );

      if (requestsResponse.requested !== undefined) {
        // Filter to only show upcoming requests (not past dates)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcomingRequests = (requestsResponse.requested || []).filter(
          (req) => {
            const reqDate = new Date(req.date + "T00:00:00");
            return reqDate >= today;
          }
        );
        setPendingRequests(upcomingRequests);
        if (dispatch) {
          dispatch({
            type: "CLEANING_REQUESTS",
            payload: upcomingRequests,
          });
        }
      }
    } catch (err) {
      console.error("[CleanerDashboard] Error fetching data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    fetchDashboardData(true);
    fetchStripeAccountStatus();
    fetchPerkStatus();
  }, [state.currentUser.token]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = () => {
    const options = { weekday: "long", month: "long", day: "numeric" };
    return new Date().toLocaleDateString("en-US", options);
  };

  // Sort appointments by date
  const sortedAppointments = [...appointments].sort(
    (a, b) => parseLocalDate(a.date) - parseLocalDate(b.date)
  );

  // Get today's appointments (multiple) sorted by end time
  const today = new Date();
  const todaysAppointments = sortByEndTime(
    sortedAppointments.filter(
      (apt) => parseLocalDate(apt.date).toDateString() === today.toDateString()
    )
  );

  // Get next appointment (first one after today)
  const nextAppointment = sortedAppointments.find(
    (apt) => parseLocalDate(apt.date) > today
  );

  // Get all upcoming appointments (excluding today)
  const allUpcomingAppointments = sortedAppointments
    .filter((apt) => parseLocalDate(apt.date) > today);

  // Get first 3 for display in the list
  const upcomingAppointments = allUpcomingAppointments.slice(0, 3);

  // Get completed appointments count
  const completedCount = appointments.filter((apt) => apt.completed).length;

  // Calculate expected payout (accounting for split between multiple cleaners)
  const expectedPayout = sortedAppointments
    .filter((apt) => !apt.completed && parseLocalDate(apt.date) >= today)
    .reduce((sum, apt) => {
      const numCleaners = apt.employeesAssigned?.length || 1;
      const perCleanerShare = (Number(apt.price) / numCleaners) * cleanerSharePercent;
      return sum + perCleanerShare;
    }, 0);

  const handleJobCompleted = (data) => {
    setShowCompletionFlow(false);
    setSelectedAppointment(null);
    setSelectedHome(null);
    fetchDashboardData(true);
  };

  const handleJobUnstarted = (appointmentId) => {
    // Refresh dashboard data after job is unstarted
    fetchDashboardData(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => fetchDashboardData()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </Text>
          <Text style={styles.dateText}>{formatDate()}</Text>
        </View>

        {/* Payment Setup Banner */}
        {showPaymentBanner && (
          <PaymentSetupBanner onPress={() => navigate("/earnings")} />
        )}

        {/* Perk Tier Badge - show if cleaner has preferred status at any home */}
        {perkStatus && perkStatus.preferredHomeCount > 0 && (
          <PerkTierBadge
            perkStatus={perkStatus}
            onPress={() => navigate("/preferred-perks")}
          />
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickActionButton
              title="Find Jobs"
              subtitle="Browse available"
              icon="search"
              iconColor="#fff"
              bgColor="#fff"
              accentColor="#6366f1"
              onPress={() => navigate("/new-job-choice")}
            />
            <QuickActionButton
              title="My Schedule"
              subtitle="View assignments"
              icon="calendar"
              iconColor="#fff"
              bgColor="#fff"
              accentColor="#0d9488"
              onPress={() => navigate("/employee-assignments")}
            />
            <QuickActionButton
              title="Earnings"
              subtitle="Track income"
              icon="dollar"
              iconColor="#fff"
              bgColor="#fff"
              accentColor="#10b981"
              onPress={() => navigate("/earnings")}
            />
            <QuickActionButton
              title="Get Help"
              subtitle="Contact support"
              icon="life-ring"
              iconColor="#fff"
              bgColor="#fff"
              accentColor="#3b82f6"
              onPress={() => {
                if (state.currentUser.token) {
                  import("../../services/fetchRequests/MessageClass").then(
                    (module) => {
                      const MessageService = module.default;
                      MessageService.createSupportConversation(state.currentUser.token)
                        .then((response) => {
                          if (response.conversation) {
                            navigate(`/messages/${response.conversation.id}`);
                          }
                        })
                        .catch((err) => console.error(err));
                    }
                  );
                }
              }}
            />
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <StatCard
            title="Expected"
            value={`$${expectedPayout.toFixed(0)}`}
            subtitle="payout"
            color={colors.success[500]}
            onPress={() => navigate("/earnings")}
          />
          <StatCard
            title="Upcoming"
            value={allUpcomingAppointments.length + todaysAppointments.length}
            subtitle="jobs"
            color={colors.primary[500]}
            onPress={() => navigate("/employee-assignments")}
          />
          <StatCard
            title="Pending"
            value={pendingRequests.length}
            subtitle="requests"
            color={colors.warning[500]}
            onPress={() => navigate("/my-requests")}
          />
        </View>

        {/* Client Appointments (for business owners with linked clients) */}
        <ClientAppointmentsSection
          token={state.currentUser.token}
          onRefresh={onRefresh}
        />

        {/* Today's Appointments */}
        {todaysAppointments.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title={`Today's Jobs (${todaysAppointments.length})`} />
            {todaysAppointments.map((appointment) => (
              <TodaysAppointment
                key={appointment.id}
                appointment={appointment}
                onJobCompleted={handleJobCompleted}
                onJobUnstarted={handleJobUnstarted}
                token={state.currentUser.token}
              />
            ))}
          </View>
        )}

        {/* Next Appointment Preview */}
        {nextAppointment && (
          <View style={styles.section}>
            <SectionHeader title="Next Appointment" />
            <NextAppointmentPreview
              appointment={nextAppointment}
              home={homeDetails[nextAppointment.homeId]}
              cleanerSharePercent={cleanerSharePercent}
            />
          </View>
        )}

        {/* No Jobs Today Message */}
        {todaysAppointments.length === 0 && (
          <View style={styles.section}>
            <View style={styles.noJobCard}>
              <Text style={styles.noJobTitle}>No jobs scheduled for today</Text>
              {expectedPayout > 0 && (
                <View style={styles.payoutPreview}>
                  <Text style={styles.payoutPreviewLabel}>Expected earnings:</Text>
                  <Text style={styles.payoutPreviewValue}>
                    ${expectedPayout.toFixed(2)}
                  </Text>
                  <Text style={styles.payoutPreviewSubtext}>
                    after scheduled cleanings
                  </Text>
                </View>
              )}
              <Pressable
                style={styles.findJobsButton}
                onPress={() => navigate("/new-job-choice")}
              >
                <Text style={styles.findJobsButtonText}>Find Available Jobs</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Upcoming Appointments Section */}
        {upcomingAppointments.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Upcoming Jobs"
              onPress={() => navigate("/employee-assignments")}
              actionText="View All"
            />
            <View style={styles.appointmentsList}>
              {upcomingAppointments.map((apt, index) => (
                <UpcomingAppointmentCard
                  key={apt.id || index}
                  appointment={apt}
                  home={homeDetails[apt.homeId]}
                  onPress={() => navigate("/employee-assignments")}
                  cleanerSharePercent={cleanerSharePercent}
                />
              ))}
            </View>
          </View>
        )}

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Pending Requests"
              onPress={() => navigate("/my-requests")}
              actionText="View All"
            />
            <View style={styles.requestsList}>
              {pendingRequests.slice(0, 3).map((request, index) => {
                // Calculate distance for this request
                let distance = null;
                const loc = requestLocations[request.homeId];
                if (userLocation && loc) {
                  distance = haversineDistance(
                    userLocation.latitude,
                    userLocation.longitude,
                    loc.latitude,
                    loc.longitude
                  );
                }
                return (
                  <PendingRequestCard
                    key={request.id || index}
                    request={request}
                    distance={distance}
                    onPress={() => navigate("/my-requests")}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Reviews Section */}
        <View style={styles.section}>
          <SectionHeader title="My Reviews" />
          <ReviewsOverview state={state} dispatch={dispatch} />
        </View>

        {/* Tax Forms Section */}
        <TaxFormsSection state={state} />

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Job Completion Modal */}
      <Modal
        visible={showCompletionFlow}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        {selectedAppointment && selectedHome && (
          <JobCompletionFlow
            appointment={selectedAppointment}
            home={selectedHome}
            onJobCompleted={handleJobCompleted}
            onCancel={() => {
              setShowCompletionFlow(false);
              setSelectedAppointment(null);
              setSelectedHome(null);
            }}
          />
        )}
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  contentContainer: {
    paddingTop: spacing["3xl"],
    paddingHorizontal: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error[600],
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  retryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  // Header
  header: {
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  dateText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  // Quick Actions
  quickActionsContainer: {
    marginBottom: spacing.xl,
  },
  quickActionsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  quickActionButton: {
    width: (width - spacing.lg * 2 - spacing.sm) / 2,
    borderRadius: radius.lg,
    padding: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 70,
    ...shadows.sm,
    shadowColor: "#6366f1",
    shadowOpacity: 0.06,
  },
  quickActionButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  quickActionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  quickActionText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: "center",
  },
  quickActionSubtext: {
    color: colors.text.tertiary,
    fontSize: 10,
    marginTop: 1,
    textAlign: "center",
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  statCardPressed: {
    opacity: 0.9,
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  statSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sectionAction: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },

  // No Job Card
  noJobCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    ...shadows.sm,
  },
  noJobTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  payoutPreview: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  payoutPreviewLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  payoutPreviewValue: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
    marginVertical: spacing.xs,
  },
  payoutPreviewSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  findJobsButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
  },
  findJobsButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  // Appointments
  appointmentsList: {
    gap: spacing.sm,
  },
  appointmentCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    ...shadows.sm,
  },
  appointmentCardToday: {
    borderWidth: 2,
    borderColor: colors.primary[400],
  },
  cardPressed: {
    opacity: 0.9,
  },
  appointmentDateBadge: {
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginRight: spacing.md,
    minWidth: 80,
    alignItems: "center",
  },
  appointmentDateText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  todayText: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.bold,
  },
  appointmentDetails: {
    flex: 1,
  },
  appointmentHome: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  appointmentInfo: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  appointmentPayout: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },

  // Pending Requests
  requestsList: {
    gap: spacing.sm,
  },
  requestCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadows.sm,
  },
  requestInfo: {
    flex: 1,
  },
  requestDate: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  requestLocation: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  requestDetails: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  requestDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: spacing.sm,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    gap: 4,
  },
  distanceText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  requestBadge: {
    backgroundColor: colors.warning[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  requestBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },

  bottomPadding: {
    height: spacing["4xl"],
  },

  // Payment Setup Banner
  paymentBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
    ...shadows.sm,
  },
  paymentBannerPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  paymentBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.warning[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  paymentBannerContent: {
    flex: 1,
  },
  paymentBannerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
    marginBottom: 2,
  },
  paymentBannerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    lineHeight: 18,
  },
  paymentBannerAction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  paymentBannerActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },

  // Perk Tier Badge
  perkBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  perkBadgePressed: {
    opacity: 0.9,
  },
  perkBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  perkBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  perkBadgeInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  perkBadgeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  perkBadgeValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginTop: 2,
  },
});

export default CleanerDashboard;
