import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Image,
} from "react-native";
import { useNavigate } from "react-router-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";
import BusinessOwnerService from "../../services/fetchRequests/BusinessOwnerService";
import BusinessOwnerModeToggle from "./BusinessOwnerModeToggle";
import PaymentSetupBanner from "./PaymentSetupBanner";
import DashboardOverview from "./profile/DashboardOverview";
import MyTeamSection from "./profile/MyTeamSection";
import MyClientsSection from "./profile/MyClientsSection";
import PayrollSection from "./profile/PayrollSection";
import ClientPaymentsSection from "./profile/ClientPaymentsSection";
import MarketplaceCleanerView from "./profile/MarketplaceCleanerView";
import JobFlowsSection from "./profile/JobFlowsSection";

const MODE_STORAGE_KEY = "@business_owner_mode";

const BusinessOwnerProfile = ({ state }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("business");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [error, setError] = useState(null);

  // Load saved mode preference
  useEffect(() => {
    const loadMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(MODE_STORAGE_KEY);
        if (savedMode) {
          setMode(savedMode);
        }
      } catch (err) {
        console.log("Error loading mode preference:", err);
      }
    };
    loadMode();
  }, []);

  // Save mode preference when changed
  const handleModeChange = async (newMode) => {
    setMode(newMode);
    try {
      await AsyncStorage.setItem(MODE_STORAGE_KEY, newMode);
    } catch (err) {
      console.log("Error saving mode preference:", err);
    }
  };

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!state?.currentUser?.token) return;

    try {
      setError(null);

      // Fetch dashboard, employees, and pending payouts in parallel
      const [dashboardResult, employeesResult, payoutsResult] = await Promise.all([
        BusinessOwnerService.getDashboard(state.currentUser.token),
        BusinessOwnerService.getEmployees(state.currentUser.token, "active"),
        BusinessOwnerService.getPendingPayouts(state.currentUser.token),
      ]);

      setDashboardData(dashboardResult);
      setEmployees(employeesResult.employees || []);
      // Server returns 'payouts', but we store as 'pendingPayouts' locally
      setPendingPayouts(payoutsResult.payouts || payoutsResult.pendingPayouts || []);
    } catch (err) {
      console.error("Error fetching profile data:", err);
      setError("Failed to load data. Pull to refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state?.currentUser?.token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading your business...</Text>
      </View>
    );
  }

  const businessName = state?.businessName || "Your Business";
  const businessLogo = state?.businessLogo;
  const totalPayrollOwed = pendingPayouts.reduce((sum, p) => sum + (p.payAmount || 0), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.businessInfo}>
            {businessLogo ? (
              <Image source={{ uri: businessLogo }} style={styles.businessLogoImage} />
            ) : (
              <View style={styles.businessAvatar}>
                <Icon name="building" size={20} color={colors.primary[600]} />
              </View>
            )}
            <View>
              <Text style={styles.businessName}>{businessName}</Text>
              <Text style={styles.businessSubtitle}>Business Owner</Text>
            </View>
          </View>
          <Pressable
            style={styles.settingsButton}
            onPress={() => navigate("/account-settings")}
          >
            <Icon name="cog" size={20} color={colors.text.secondary} />
          </Pressable>
        </View>
      </View>

      {/* Mode Toggle */}
      <BusinessOwnerModeToggle mode={mode} onModeChange={handleModeChange} />

      {/* Content based on mode */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[600]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Payment Setup Banner */}
        <PaymentSetupBanner state={state} />

        {mode === "business" ? (
          <>
            {/* Dashboard Overview */}
            <DashboardOverview
              data={dashboardData}
              payrollOwed={totalPayrollOwed}
              pendingPayoutsCount={pendingPayouts.length}
              state={state}
            />

            {/* My Team Section */}
            <MyTeamSection
              employees={employees}
              pendingPayouts={pendingPayouts}
              state={state}
              onRefresh={fetchData}
            />

            {/* My Clients Section */}
            <MyClientsSection state={state} />

            {/* Job Flows Section */}
            <JobFlowsSection state={state} />

            {/* Payroll Section */}
            <PayrollSection
              pendingPayouts={pendingPayouts}
              totalOwed={totalPayrollOwed}
              state={state}
              onRefresh={fetchData}
            />

            {/* Client Payments Section */}
            <ClientPaymentsSection
              state={state}
              onRefresh={fetchData}
            />
          </>
        ) : (
          <MarketplaceCleanerView state={state} />
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  header: {
    backgroundColor: colors.background.primary,
    paddingTop: spacing["4xl"],
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  businessInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  businessAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  businessLogoImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.neutral[100],
  },
  businessName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  businessSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.md,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
  },
  bottomPadding: {
    height: 100,
  },
});

export default BusinessOwnerProfile;
