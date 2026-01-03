import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import StripeConnectOnboarding from "./StripeConnectOnboarding";
import PayoutHistory from "./PayoutHistory";
import EarningsChart from "./EarningsChart";
import JobCompletionFlow from "../employeeAssignments/jobPhotos/JobCompletionFlow";
import HomeSizeConfirmationModal from "../employeeAssignments/HomeSizeConfirmationModal";
import FetchData from "../../services/fetchRequests/fetchData";
import { API_BASE } from "../../services/config";
import { usePricing } from "../../context/PricingContext";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";

const Earnings = ({ state, dispatch }) => {
  const { pricing } = usePricing();
  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const [activeTab, setActiveTab] = useState("overview");
  const [earnings, setEarnings] = useState({
    totalEarnings: "0.00",
    pendingEarnings: "0.00",
    completedJobs: 0,
    platformFeePercent: 10,
    cleanerPercent: 90,
  });
  const [accountStatus, setAccountStatus] = useState(null);
  const [assignedAppointments, setAssignedAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedHome, setSelectedHome] = useState(null);
  const [showCompletionFlow, setShowCompletionFlow] = useState(false);
  const [showHomeSizeModal, setShowHomeSizeModal] = useState(false);
  const [jobStatuses, setJobStatuses] = useState({});

  const fetchEarnings = async () => {
    if (!state?.currentUser?.id) return;
    try {
      const res = await fetch(
        `${API_BASE}/payments/earnings/${state.currentUser.id}`
      );
      const data = await res.json();
      if (res.ok) {
        setEarnings(data);
      }
    } catch (err) {
      console.error("Error fetching earnings:", err);
    }
  };

  const fetchAccountStatus = async () => {
    if (!state?.currentUser?.id) return;
    try {
      const res = await fetch(
        `${API_BASE}/stripe-connect/account-status/${state.currentUser.id}`
      );
      const data = await res.json();
      if (res.ok) {
        setAccountStatus(data);
      }
    } catch (err) {
      console.error("Error fetching account status:", err);
    }
  };

  const fetchAssignedAppointments = async () => {
    if (!state?.currentUser?.id) return;
    try {
      const myAppointments = (state?.appointments || [])
        .filter(
          (appt) =>
            appt.employeesAssigned &&
            appt.employeesAssigned.includes(String(state.currentUser.id)) &&
            !appt.completed
        )
        .sort((a, b) => {
          const dateA = new Date(a.date + "T00:00:00");
          const dateB = new Date(b.date + "T00:00:00");
          return dateA - dateB;
        });
      setAssignedAppointments(myAppointments);
    } catch (err) {
      console.error("Error fetching appointments:", err);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([fetchEarnings(), fetchAccountStatus(), fetchAssignedAppointments()]);
    setIsLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [state?.currentUser?.id, state?.appointments]);

  const isAppointmentToday = (appt) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const apptDate = new Date(appt.date + "T00:00:00");
    return apptDate.getTime() === today.getTime();
  };

  const checkJobStatuses = async () => {
    if (!state?.currentUser?.token) return;
    const statuses = {};
    for (const appt of assignedAppointments) {
      if (!appt.completed && isAppointmentToday(appt)) {
        try {
          const response = await FetchData.get(
            `/api/v1/job-photos/${appt.id}/status`,
            state.currentUser.token
          );
          statuses[appt.id] = {
            hasBeforePhotos: response.hasBeforePhotos,
            started: response.hasBeforePhotos && !appt.completed,
          };
        } catch (err) {
          statuses[appt.id] = { hasBeforePhotos: false, started: false };
        }
      }
    }
    setJobStatuses(statuses);
  };

  useEffect(() => {
    if (assignedAppointments.length > 0) {
      checkJobStatuses();
    }
  }, [assignedAppointments]);

  const handleStartCleaning = async (appt) => {
    try {
      const response = await FetchData.getHome(appt.homeId);
      setSelectedHome(response.home);
      setSelectedAppointment(appt);
      setShowHomeSizeModal(true);
    } catch (err) {
      Alert.alert("Error", "Could not load home details. Please try again.");
    }
  };

  const handleHomeSizeConfirmed = () => {
    setShowHomeSizeModal(false);
    setShowCompletionFlow(true);
  };

  const handleHomeSizeModalClose = () => {
    setShowHomeSizeModal(false);
    setSelectedAppointment(null);
    setSelectedHome(null);
  };

  const handleJobCompleted = (data) => {
    setShowCompletionFlow(false);
    setSelectedAppointment(null);
    setSelectedHome(null);
    loadData();
  };

  const handleCancelCompletion = () => {
    setShowCompletionFlow(false);
  };

  const handleContinueCleaning = async (appt) => {
    try {
      const response = await FetchData.getHome(appt.homeId);
      setSelectedHome(response.home);
      setSelectedAppointment(appt);
      setShowCompletionFlow(true);
    } catch (err) {
      Alert.alert("Error", "Could not load home details. Please try again.");
    }
  };

  const getStatusBadge = (appt) => {
    if (appt.completed) return { text: "Completed", type: "success" };
    if (appt.paid) return { text: "Ready to Start", type: "primary" };
    return { text: "Pending Payment", type: "warning" };
  };

  const calculateCleanerShare = (price, numCleaners = 1) => {
    const gross = parseFloat(price) || 0;
    const perCleaner = gross / numCleaners;
    const cleanerShare = perCleaner * cleanerSharePercent;
    return cleanerShare.toFixed(2);
  };

  const calculatePotentialEarnings = () => {
    return assignedAppointments
      .filter((appt) => !appt.completed)
      .reduce((total, appt) => {
        const numCleaners = appt.employeesAssigned?.length || 1;
        const share = parseFloat(calculateCleanerShare(appt.price, numCleaners));
        return total + share;
      }, 0)
      .toFixed(2);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading earnings...</Text>
      </View>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "account":
        return <StripeConnectOnboarding state={state} dispatch={dispatch} />;
      case "history":
        return <PayoutHistory state={state} dispatch={dispatch} />;
      default:
        return renderOverview();
    }
  };

  const renderOverview = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary[500]}
        />
      }
    >
      {/* Account Status Banner */}
      {accountStatus && !accountStatus.onboardingComplete && (
        <Pressable
          onPress={() => setActiveTab("account")}
          style={styles.warningBanner}
        >
          <View style={styles.warningBannerContent}>
            <Feather name="alert-circle" size={20} color={colors.warning[600]} />
            <Text style={styles.warningBannerText}>
              {accountStatus.hasAccount
                ? "Complete your account setup to receive payouts"
                : "Set up your payment account to receive earnings"}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.warning[600]} />
        </Pressable>
      )}

      {/* Stats Cards Row */}
      <View style={styles.statsRow}>
        {/* Total Earnings Card */}
        <View style={[styles.statCard, styles.totalEarningsCard]}>
          <View style={styles.statCardHeader}>
            <View style={styles.statIconContainer}>
              <Feather name="trending-up" size={20} color={colors.neutral[0]} />
            </View>
          </View>
          <Text style={styles.statLabel}>Total Earnings</Text>
          <Text style={styles.statValue}>${earnings.totalEarnings}</Text>
          <Text style={styles.statSubtext}>
            {earnings.completedJobs} jobs completed
          </Text>
        </View>

        {/* Potential Earnings Card */}
        <View style={[styles.statCard, styles.potentialEarningsCard]}>
          <View style={styles.statCardHeader}>
            <View style={[styles.statIconContainer, styles.potentialIcon]}>
              <Feather name="clock" size={20} color={colors.neutral[0]} />
            </View>
          </View>
          <Text style={styles.statLabel}>Upcoming</Text>
          <Text style={styles.statValue}>${calculatePotentialEarnings()}</Text>
          <Text style={styles.statSubtext}>
            {assignedAppointments.filter((a) => !a.completed).length} pending{" "}
            {assignedAppointments.filter((a) => !a.completed).length === 1 ? "job" : "jobs"}
          </Text>
        </View>
      </View>

      {/* Earnings Chart */}
      <View style={styles.chartContainer}>
        <EarningsChart
          appointments={state?.appointments || []}
          currentUserId={state?.currentUser?.id}
        />
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Feather name="info" size={16} color={colors.primary[600]} />
        <Text style={styles.infoBannerText}>
          Payouts are processed automatically when you complete jobs.
        </Text>
      </View>

      {/* Assigned Appointments */}
      <View style={styles.assignmentsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Assignments</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>
              {assignedAppointments.length}
            </Text>
          </View>
        </View>

        {assignedAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={48} color={colors.neutral[300]} />
            <Text style={styles.emptyStateText}>No assignments yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Check back later for new jobs
            </Text>
          </View>
        ) : (
          assignedAppointments.map((appt) => {
            const status = getStatusBadge(appt);
            const numCleaners = appt.employeesAssigned?.length || 1;
            const yourShare = calculateCleanerShare(appt.price, numCleaners);
            const isToday = isAppointmentToday(appt);

            return (
              <View
                key={appt.id}
                style={[styles.appointmentCard, isToday && styles.appointmentCardToday]}
              >
                {isToday && (
                  <View style={styles.todayBadge}>
                    <Text style={styles.todayBadgeText}>TODAY</Text>
                  </View>
                )}

                <View style={styles.appointmentContent}>
                  <View style={styles.appointmentLeft}>
                    <Text style={styles.appointmentDate}>
                      {new Date(appt.date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <View style={[styles.statusBadge, styles[`statusBadge_${status.type}`]]}>
                      <Text style={[styles.statusBadgeText, styles[`statusBadgeText_${status.type}`]]}>
                        {status.text}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.appointmentRight}>
                    <Text style={styles.appointmentEarnings}>${yourShare}</Text>
                    <Text style={styles.appointmentEarningsLabel}>your share</Text>
                  </View>
                </View>

                {numCleaners > 1 && (
                  <Text style={styles.splitInfo}>
                    Split between {numCleaners} cleaners (Total: ${appt.price})
                  </Text>
                )}

                {/* Action Buttons */}
                {appt.paid && !appt.completed && isToday && (
                  <View style={styles.actionButtonContainer}>
                    {jobStatuses[appt.id]?.started ? (
                      <Pressable
                        onPress={() => handleContinueCleaning(appt)}
                        disabled={!accountStatus?.onboardingComplete}
                        style={({ pressed }) => [
                          styles.actionButton,
                          styles.continueButton,
                          !accountStatus?.onboardingComplete && styles.actionButtonDisabled,
                          pressed && styles.actionButtonPressed,
                        ]}
                      >
                        <Feather name="play" size={18} color={colors.neutral[0]} />
                        <Text style={styles.actionButtonText}>Continue Cleaning</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => handleStartCleaning(appt)}
                        disabled={!accountStatus?.onboardingComplete}
                        style={({ pressed }) => [
                          styles.actionButton,
                          styles.startButton,
                          !accountStatus?.onboardingComplete && styles.actionButtonDisabled,
                          pressed && styles.actionButtonPressed,
                        ]}
                      >
                        <Feather name="play-circle" size={18} color={colors.neutral[0]} />
                        <Text style={styles.actionButtonText}>Start Cleaning</Text>
                      </Pressable>
                    )}

                    {!accountStatus?.onboardingComplete && (
                      <Pressable onPress={() => setActiveTab("account")}>
                        <Text style={styles.setupAccountLink}>
                          Set up payment account first
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        {[
          { key: "overview", label: "Overview", icon: "bar-chart-2" },
          { key: "history", label: "Payouts", icon: "list" },
          { key: "account", label: "Account", icon: "user" },
        ].map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Feather
              name={tab.icon}
              size={18}
              color={activeTab === tab.key ? colors.primary[600] : colors.neutral[400]}
            />
            <Text
              style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Modals */}
      {selectedAppointment && selectedHome && (
        <HomeSizeConfirmationModal
          visible={showHomeSizeModal}
          onClose={handleHomeSizeModalClose}
          onConfirm={handleHomeSizeConfirmed}
          home={selectedHome}
          appointment={selectedAppointment}
          token={state?.currentUser?.token}
        />
      )}

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
            onCancel={handleCancelCompletion}
          />
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.neutral[500],
    fontSize: typography.fontSize.sm,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },

  // Tab Bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.neutral[0],
    paddingTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.primary[600],
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[400],
  },
  tabTextActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },

  // Warning Banner
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  warningBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
  },
  warningBannerText: {
    flex: 1,
    color: colors.warning[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  totalEarningsCard: {
    backgroundColor: colors.success[600],
  },
  potentialEarningsCard: {
    backgroundColor: colors.primary[600],
  },
  statCardHeader: {
    marginBottom: spacing.sm,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  potentialIcon: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  statLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  statValue: {
    color: colors.neutral[0],
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
  },
  statSubtext: {
    color: "rgba(255,255,255,0.7)",
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },

  // Chart
  chartContainer: {
    marginBottom: spacing.lg,
  },

  // Info Banner
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoBannerText: {
    flex: 1,
    color: colors.primary[700],
    fontSize: typography.fontSize.sm,
  },

  // Assignments Section
  assignmentsSection: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  sectionBadgeText: {
    color: colors.primary[700],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    padding: spacing["3xl"],
  },
  emptyStateText: {
    color: colors.neutral[500],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.md,
  },
  emptyStateSubtext: {
    color: colors.neutral[400],
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },

  // Appointment Card
  appointmentCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  appointmentCardToday: {
    borderColor: colors.primary[300],
    backgroundColor: colors.primary[50],
  },
  todayBadge: {
    position: "absolute",
    top: -spacing.sm,
    right: spacing.md,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  todayBadgeText: {
    color: colors.neutral[0],
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  appointmentContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  appointmentLeft: {
    flex: 1,
  },
  appointmentDate: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  appointmentRight: {
    alignItems: "flex-end",
  },
  appointmentEarnings: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  appointmentEarningsLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },

  // Status Badges
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusBadge_success: {
    backgroundColor: colors.success[100],
  },
  statusBadge_primary: {
    backgroundColor: colors.primary[100],
  },
  statusBadge_warning: {
    backgroundColor: colors.warning[100],
  },
  statusBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  statusBadgeText_success: {
    color: colors.success[700],
  },
  statusBadgeText_primary: {
    color: colors.primary[700],
  },
  statusBadgeText_warning: {
    color: colors.warning[700],
  },

  // Split Info
  splitInfo: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
    marginTop: spacing.sm,
  },

  // Action Buttons
  actionButtonContainer: {
    marginTop: spacing.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  startButton: {
    backgroundColor: colors.success[600],
  },
  continueButton: {
    backgroundColor: colors.primary[600],
  },
  actionButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  actionButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  actionButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  setupAccountLink: {
    color: colors.warning[600],
    fontSize: typography.fontSize.xs,
    textAlign: "center",
    marginTop: spacing.sm,
    textDecorationLine: "underline",
  },
});

export default Earnings;
