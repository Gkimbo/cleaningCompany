import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import BusinessEmployeeService from "../../services/fetchRequests/BusinessEmployeeService";
import TaxFormsSection from "../tax/TaxFormsSection";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Stats Card Component
const StatsCard = ({ icon, label, value, subLabel, color, onPress }) => (
  <Pressable
    style={[styles.statsCard, onPress && styles.statsCardPressable]}
    onPress={onPress}
  >
    <View style={[styles.statsIcon, { backgroundColor: color + "20" }]}>
      <Icon name={icon} size={20} color={color} />
    </View>
    <Text style={styles.statsValue}>{value}</Text>
    <Text style={styles.statsLabel}>{label}</Text>
    {subLabel && <Text style={styles.statsSubLabel}>{subLabel}</Text>}
  </Pressable>
);

// Today's Job Card Component
const TodayJobCard = ({ job, onStart, onComplete, onView, isStarting, isCompleting }) => {
  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours);
    return `${h > 12 ? h - 12 : h}:${minutes} ${h >= 12 ? "PM" : "AM"}`;
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case "started":
        return { color: colors.warning[600], label: "In Progress", icon: "clock-o" };
      case "completed":
        return { color: colors.success[600], label: "Completed", icon: "check-circle" };
      default:
        return { color: colors.primary[600], label: "Scheduled", icon: "calendar" };
    }
  };

  const statusInfo = getStatusInfo(job.status);

  return (
    <View style={styles.todayJobCard}>
      <View style={styles.todayJobHeader}>
        <View style={[styles.statusIndicator, { backgroundColor: statusInfo.color }]}>
          <Icon name={statusInfo.icon} size={14} color="#fff" />
        </View>
        <View style={styles.todayJobInfo}>
          <Text style={styles.todayJobAddress}>
            {job.appointment?.home?.address || "Address not available"}
          </Text>
          <Text style={styles.todayJobTime}>
            {formatTime(job.appointment?.startTime)} - {job.appointment?.duration || 2} hours
          </Text>
        </View>
        <Text style={styles.todayJobPay}>
          ${((job.payAmount || 0) / 100).toFixed(0)}
        </Text>
      </View>

      {/* Client Info */}
      {job.appointment?.user && (
        <View style={styles.todayJobClient}>
          <Icon name="user" size={12} color={colors.neutral[400]} />
          <Text style={styles.todayJobClientName}>
            {job.appointment.user.firstName}
          </Text>
          {job.appointment?.home?.numBeds && (
            <Text style={styles.todayJobDetails}>
              {job.appointment.home.numBeds} bed, {job.appointment.home.numBaths} bath
            </Text>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.todayJobActions}>
        {job.status === "assigned" && (
          <Pressable
            style={[styles.startJobButton, isStarting && styles.buttonDisabled]}
            onPress={() => onStart(job)}
            disabled={isStarting}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="play" size={14} color="#fff" />
                <Text style={styles.startJobButtonText}>Start Job</Text>
              </>
            )}
          </Pressable>
        )}
        {job.status === "started" && (
          <Pressable
            style={[styles.completeJobButton, isCompleting && styles.buttonDisabled]}
            onPress={() => onComplete(job)}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="check" size={14} color="#fff" />
                <Text style={styles.completeJobButtonText}>Complete</Text>
              </>
            )}
          </Pressable>
        )}
        <Pressable style={styles.viewDetailsButton} onPress={() => onView(job)}>
          <Text style={styles.viewDetailsButtonText}>Details</Text>
          <Icon name="chevron-right" size={12} color={colors.primary[600]} />
        </Pressable>
      </View>
    </View>
  );
};

// Upcoming Job Row Component
const UpcomingJobRow = ({ job, onPress }) => {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    }
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours);
    return `${h > 12 ? h - 12 : h}:${minutes} ${h >= 12 ? "PM" : "AM"}`;
  };

  return (
    <Pressable style={styles.upcomingJobRow} onPress={onPress}>
      <View style={styles.upcomingJobDate}>
        <Text style={styles.upcomingJobDateText}>{formatDate(job.appointment?.date)}</Text>
      </View>
      <View style={styles.upcomingJobInfo}>
        <Text style={styles.upcomingJobAddress} numberOfLines={1}>
          {job.appointment?.home?.address || "Address TBD"}
        </Text>
        <Text style={styles.upcomingJobTime}>
          {formatTime(job.appointment?.startTime)}
        </Text>
      </View>
      <Text style={styles.upcomingJobPay}>
        ${((job.payAmount || 0) / 100).toFixed(0)}
      </Text>
      <Icon name="chevron-right" size={14} color={colors.neutral[400]} />
    </Pressable>
  );
};

// Quick Action Button
const QuickAction = ({ icon, label, onPress, color = colors.primary[600] }) => (
  <Pressable style={styles.quickAction} onPress={onPress}>
    <View style={[styles.quickActionIcon, { backgroundColor: color + "15" }]}>
      <Icon name={icon} size={22} color={color} />
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </Pressable>
);

// Main Dashboard Component
const EmployeeDashboard = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [earnings, setEarnings] = useState({
    summary: { totalEarnings: 0, pendingAmount: 0, jobCount: 0 },
    formatted: { totalEarnings: "$0.00", pendingAmount: "$0.00" },
  });
  const [error, setError] = useState(null);
  const [startingJobId, setStartingJobId] = useState(null);
  const [completingJobId, setCompletingJobId] = useState(null);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [startingStripeOnboarding, setStartingStripeOnboarding] = useState(false);
  const [pendingEarnings, setPendingEarnings] = useState({
    pendingAmount: 0,
    nextPayoutDate: null,
    payoutCount: 0,
    formatted: { pendingAmount: "$0.00" },
  });

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [profileResult, jobsResult, earningsResult, stripeResult, pendingResult] = await Promise.all([
        BusinessEmployeeService.getProfile(state.currentUser.token),
        BusinessEmployeeService.getMyJobs(state.currentUser.token, { upcoming: true }),
        BusinessEmployeeService.getEarnings(state.currentUser.token),
        BusinessEmployeeService.getStripeStatus(state.currentUser.token),
        BusinessEmployeeService.getPendingEarnings(state.currentUser.token),
      ]);

      setProfile(profileResult?.profile || null);
      setJobs(jobsResult?.jobs || []);
      setEarnings({
        summary: earningsResult?.summary || { totalEarnings: 0, pendingAmount: 0, jobCount: 0 },
        formatted: earningsResult?.formatted || { totalEarnings: "$0.00", pendingAmount: "$0.00" },
      });
      setStripeStatus(stripeResult || null);
      setPendingEarnings({
        pendingAmount: pendingResult?.pendingAmount || 0,
        nextPayoutDate: pendingResult?.nextPayoutDate || null,
        payoutCount: pendingResult?.payouts?.length || 0,
        formatted: pendingResult?.formatted || { pendingAmount: "$0.00" },
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = useCallback(() => {
    fetchDashboardData(true);
  }, [state.currentUser.token]);

  const handleStartJob = async (job) => {
    setStartingJobId(job.id);

    try {
      const result = await BusinessEmployeeService.startJob(state.currentUser.token, job.id);

      if (result.success) {
        fetchDashboardData();
      } else {
        Alert.alert("Error", result.error || "Failed to start job");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to start job. Please try again.");
    } finally {
      setStartingJobId(null);
    }
  };

  const handleCompleteJob = async (job) => {
    Alert.alert(
      "Complete Job",
      "Are you sure you want to mark this job as complete?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            setCompletingJobId(job.id);

            try {
              const result = await BusinessEmployeeService.completeJob(
                state.currentUser.token,
                job.id
              );

              if (result.success) {
                Alert.alert("Success", "Job completed! Great work!");
                fetchDashboardData();
              } else {
                Alert.alert("Error", result.error || "Failed to complete job");
              }
            } catch (err) {
              Alert.alert("Error", "Failed to complete job. Please try again.");
            } finally {
              setCompletingJobId(null);
            }
          },
        },
      ]
    );
  };

  const handleViewJob = (job) => {
    navigate(`/employee/jobs/${job.id}`);
  };

  const handleStartStripeOnboarding = async () => {
    setStartingStripeOnboarding(true);
    try {
      const result = await BusinessEmployeeService.startStripeOnboarding(state.currentUser.token);
      if (result.success && result.onboardingUrl) {
        await Linking.openURL(result.onboardingUrl);
      } else {
        Alert.alert("Error", result.error || "Failed to start setup. Please try again.");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to start setup. Please try again.");
    } finally {
      setStartingStripeOnboarding(false);
    }
  };

  // Check if employee needs to set up Stripe for direct payouts
  const needsStripeSetup = stripeStatus?.paymentMethod === "stripe_connect" && !stripeStatus?.onboarded;

  // Get today's jobs
  const today = new Date().toDateString();
  const todaysJobs = jobs.filter(
    (job) => new Date(job.appointment?.date + "T00:00:00").toDateString() === today
  );
  const upcomingJobs = jobs.filter(
    (job) => new Date(job.appointment?.date + "T00:00:00").toDateString() !== today
  );

  // Count in-progress jobs
  const inProgressCount = jobs.filter((j) => j.status === "started").length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {profile?.businessLogo ? (
            <Image source={{ uri: profile.businessLogo }} style={styles.businessLogoImage} />
          ) : (
            <View style={styles.businessLogoPlaceholder}>
              <Icon name="building" size={20} color={colors.primary[600]} />
            </View>
          )}
          <View>
            <Text style={styles.greeting}>
              {getGreeting()}, {profile?.firstName || "there"}!
            </Text>
            <Text style={styles.businessName}>
              {profile?.businessOwner?.businessName || profile?.businessName || "Your Business"}
            </Text>
          </View>
        </View>
        <View style={styles.profileButton}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {(profile?.firstName?.[0] || "E").toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Stripe Setup Banner */}
      {needsStripeSetup && (
        <Pressable
          style={styles.stripeSetupBanner}
          onPress={handleStartStripeOnboarding}
          disabled={startingStripeOnboarding}
        >
          <View style={styles.stripeSetupIcon}>
            <Icon name="credit-card" size={24} color={colors.primary[600]} />
          </View>
          <View style={styles.stripeSetupContent}>
            <Text style={styles.stripeSetupTitle}>Set Up Direct Payments</Text>
            <Text style={styles.stripeSetupText}>
              Connect your bank account to receive your pay directly
            </Text>
          </View>
          {startingStripeOnboarding ? (
            <ActivityIndicator size="small" color={colors.primary[600]} />
          ) : (
            <View style={styles.stripeSetupArrow}>
              <Icon name="chevron-right" size={16} color={colors.primary[600]} />
            </View>
          )}
        </Pressable>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => fetchDashboardData()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* In Progress Alert */}
      {inProgressCount > 0 && (
        <View style={styles.inProgressAlert}>
          <Icon name="clock-o" size={18} color={colors.warning[700]} />
          <Text style={styles.inProgressAlertText}>
            {inProgressCount} job{inProgressCount > 1 ? "s" : ""} in progress
          </Text>
        </View>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatsCard
          icon="calendar-check-o"
          label="This Week"
          value={jobs.length}
          subLabel="jobs"
          color={colors.primary[600]}
          onPress={() => navigate("/employee/jobs")}
        />
        <StatsCard
          icon="dollar"
          label="This Month"
          value={earnings.formatted.totalEarnings}
          subLabel="earned"
          color={colors.success[600]}
          onPress={() => navigate("/employee/earnings")}
        />
      </View>

      {/* Pending Bi-Weekly Earnings */}
      {pendingEarnings.pendingAmount > 0 && (
        <View style={styles.pendingEarningsCard}>
          <View style={styles.pendingEarningsIcon}>
            <Icon name="calendar-check-o" size={18} color={colors.success[700]} />
          </View>
          <View style={styles.pendingEarningsInfo}>
            <Text style={styles.pendingEarningsLabel}>
              Upcoming Payout ({pendingEarnings.payoutCount} job{pendingEarnings.payoutCount !== 1 ? "s" : ""})
            </Text>
            <Text style={styles.pendingEarningsAmount}>
              {pendingEarnings.formatted.pendingAmount}
            </Text>
            {pendingEarnings.nextPayoutDate && (
              <Text style={styles.pendingEarningsDate}>
                Scheduled for {formatPayoutDate(pendingEarnings.nextPayoutDate)}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <QuickAction
            icon="calendar"
            label="My Calendar"
            onPress={() => navigate("/employee/profile")}
            color={colors.primary[600]}
          />
          <QuickAction
            icon="dollar"
            label="Earnings"
            onPress={() => navigate("/employee/earnings")}
            color={colors.success[600]}
          />
          <QuickAction
            icon="comments"
            label="Team Chat"
            onPress={() => navigate("/employee/messages")}
            color={colors.secondary[600]}
          />
          <QuickAction
            icon="cog"
            label="Settings"
            onPress={() => navigate("/account-settings")}
            color={colors.neutral[600]}
          />
        </View>
      </View>

      {/* Today's Jobs */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Jobs</Text>
          {todaysJobs.length > 0 && (
            <Text style={styles.sectionCount}>{todaysJobs.length}</Text>
          )}
        </View>
        {todaysJobs.length === 0 ? (
          <View style={styles.emptyToday}>
            <Icon name="coffee" size={32} color={colors.neutral[300]} />
            <Text style={styles.emptyTodayText}>No jobs scheduled for today</Text>
          </View>
        ) : (
          todaysJobs.map((job) => (
            <TodayJobCard
              key={job.id}
              job={job}
              onStart={handleStartJob}
              onComplete={handleCompleteJob}
              onView={handleViewJob}
              isStarting={startingJobId === job.id}
              isCompleting={completingJobId === job.id}
            />
          ))
        )}
      </View>

      {/* Upcoming Jobs */}
      {upcomingJobs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Coming Up</Text>
            <Pressable onPress={() => navigate("/employee/jobs")}>
              <Text style={styles.seeAllLink}>See All</Text>
            </Pressable>
          </View>
          <View style={styles.upcomingJobsList}>
            {upcomingJobs.slice(0, 5).map((job) => (
              <UpcomingJobRow
                key={job.id}
                job={job}
                onPress={() => handleViewJob(job)}
              />
            ))}
          </View>
        </View>
      )}

      {/* No Upcoming Jobs */}
      {jobs.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="calendar-o" size={48} color={colors.neutral[300]} />
          <Text style={styles.emptyStateTitle}>No Upcoming Jobs</Text>
          <Text style={styles.emptyStateText}>
            Your assigned jobs will appear here
          </Text>
        </View>
      )}

      {/* Tax Documents Section */}
      <View style={styles.section}>
        <TaxFormsSection state={state} />
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

// Helper function for greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

// Helper function for payout date
const formatPayoutDate = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Tomorrow";
  } else if (diffDays <= 7) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.primary[600],
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  businessLogoImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  businessLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    fontSize: typography.fontSize.lg,
    color: colors.primary[100],
  },
  businessName: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
    marginTop: spacing.xs,
  },
  profileButton: {
    padding: spacing.xs,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  profileAvatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },
  errorBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.error[50],
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.error[600],
  },
  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },
  retryText: {
    color: colors.error[600],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  inProgressAlert: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warning[100],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  inProgressAlertText: {
    marginLeft: spacing.sm,
    color: colors.warning[800],
    fontWeight: typography.fontWeight.medium,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  statsCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
    borderRadius: radius.xl,
    alignItems: "center",
    ...shadows.sm,
  },
  statsCardPressable: {
    opacity: 1,
  },
  statsIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statsValue: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statsLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statsSubLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  pendingEarningsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  pendingEarningsIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.success[100],
    justifyContent: "center",
    alignItems: "center",
  },
  pendingEarningsInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  pendingEarningsLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  pendingEarningsAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[800],
  },
  pendingEarningsDate: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    marginTop: 2,
  },
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
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
  sectionCount: {
    backgroundColor: colors.primary[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
    overflow: "hidden",
  },
  seeAllLink: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickAction: {
    alignItems: "center",
    width: "23%",
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  quickActionLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textAlign: "center",
  },
  emptyToday: {
    backgroundColor: colors.background.primary,
    padding: spacing.xl,
    borderRadius: radius.xl,
    alignItems: "center",
    ...shadows.sm,
  },
  emptyTodayText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  todayJobCard: {
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  todayJobHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  todayJobInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  todayJobAddress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  todayJobTime: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  todayJobPay: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  todayJobClient: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  todayJobClientName: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  todayJobDetails: {
    marginLeft: spacing.md,
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  todayJobActions: {
    flexDirection: "row",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  startJobButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  startJobButtonText: {
    marginLeft: spacing.sm,
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
  },
  completeJobButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  completeJobButtonText: {
    marginLeft: spacing.sm,
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
  },
  viewDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  viewDetailsButtonText: {
    marginRight: spacing.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  upcomingJobsList: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadows.sm,
  },
  upcomingJobRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  upcomingJobDate: {
    width: 80,
  },
  upcomingJobDateText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  upcomingJobInfo: {
    flex: 1,
  },
  upcomingJobAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  upcomingJobTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  upcomingJobPay: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
    marginRight: spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["4xl"],
    paddingHorizontal: spacing.lg,
  },
  emptyStateTitle: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  emptyStateText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
  bottomPadding: {
    height: spacing["4xl"],
  },
  // Stripe Setup Banner
  stripeSetupBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primary[200],
    borderStyle: "dashed",
  },
  stripeSetupIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  stripeSetupContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  stripeSetupTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  stripeSetupText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    marginTop: 2,
  },
  stripeSetupArrow: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
});

export default EmployeeDashboard;
