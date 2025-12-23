import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import FetchData from "../../services/fetchRequests/fetchData";
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
import JobCompletionFlow from "../employeeAssignments/jobPhotos/JobCompletionFlow";
import { usePricing } from "../../context/PricingContext";

const { width } = Dimensions.get("window");

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
  const appointmentDate = new Date(appointment.date);
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
const PendingRequestCard = ({ request, onPress }) => {
  const appointmentDate = new Date(request.date);

  const formatDate = (date) => {
    const options = { weekday: "short", month: "short", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

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
          {request.city}, {request.state}
        </Text>
        <Text style={styles.requestDetails}>
          {request.numBeds} bed | {request.numBaths} bath
        </Text>
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

  useEffect(() => {
    if (state.currentUser.token) {
      fetchDashboardData();
    }
  }, [state.currentUser.token]);

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

      // Fetch pending requests
      const requestsResponse = await FetchData.get(
        "/api/v1/appointments/my-requests",
        state.currentUser.token
      );

      if (requestsResponse.pendingRequestsEmployee) {
        setPendingRequests(requestsResponse.pendingRequestsEmployee);
        if (dispatch) {
          dispatch({
            type: "CLEANING_REQUESTS",
            payload: requestsResponse.pendingRequestsEmployee,
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
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  // Get today's appointment
  const today = new Date();
  const todaysAppointment = sortedAppointments.find(
    (apt) => new Date(apt.date).toDateString() === today.toDateString()
  );

  // Get upcoming appointments (excluding today)
  const upcomingAppointments = sortedAppointments
    .filter((apt) => new Date(apt.date) > today)
    .slice(0, 3);

  // Get completed appointments count
  const completedCount = appointments.filter((apt) => apt.completed).length;

  // Calculate expected payout
  const expectedPayout = sortedAppointments
    .filter((apt) => !apt.completed && new Date(apt.date) >= today)
    .reduce((sum, apt) => sum + Number(apt.price) * cleanerSharePercent, 0);

  const handleJobCompleted = (data) => {
    setShowCompletionFlow(false);
    setSelectedAppointment(null);
    setSelectedHome(null);
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
            value={upcomingAppointments.length + (todaysAppointment ? 1 : 0)}
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

        {/* Today's Appointment */}
        {todaysAppointment && (
          <View style={styles.section}>
            <SectionHeader title="Today's Job" />
            <TodaysAppointment
              appointment={todaysAppointment}
              onJobCompleted={handleJobCompleted}
            />
          </View>
        )}

        {/* No Jobs Today Message */}
        {!todaysAppointment && (
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
              {pendingRequests.slice(0, 3).map((request, index) => (
                <PendingRequestCard
                  key={request.id || index}
                  request={request}
                  onPress={() => navigate("/my-requests")}
                />
              ))}
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
    marginTop: 2,
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
});

export default CleanerDashboard;
