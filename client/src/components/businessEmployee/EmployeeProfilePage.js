import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate, useLocation } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import BusinessEmployeeService from "../../services/fetchRequests/BusinessEmployeeService";
import EmployeeJobsCalendarViewOnly from "./EmployeeJobsCalendarViewOnly";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const EmployeeProfilePage = ({ state }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromJobs = location.state?.from === "jobs";

  const handleBack = () => {
    if (cameFromJobs) {
      navigate("/employee/jobs");
    } else {
      navigate(-1);
    }
  };
  const [loading, setLoading] = useState(true);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [error, setError] = useState(null);

  const fetchEmployeeInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await BusinessEmployeeService.getProfile(state.currentUser.token);
      setEmployeeInfo(result);
    } catch (err) {
      console.error("Error fetching employee profile:", err);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeInfo();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Icon name="arrow-left" size={18} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="exclamation-circle" size={40} color={colors.error[500]} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchEmployeeInfo}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const profile = employeeInfo?.profile || employeeInfo;
  const employeeName = profile?.firstName
    ? `${profile.firstName} ${profile.lastName || ""}`.trim()
    : "Employee";
  const businessName = profile?.businessOwner?.businessName || "Your Business";
  const role = profile?.role;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Info Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {employeeName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.employeeName}>{employeeName}</Text>
          <View style={styles.businessInfo}>
            <Icon name="building" size={14} color={colors.text.tertiary} />
            <Text style={styles.businessName}>Working for: {businessName}</Text>
          </View>
          {role && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Icon name="calendar" size={16} color={colors.text.secondary} />
          <Text style={styles.sectionTitle}>Your Jobs Calendar</Text>
        </View>

        {/* View-Only Calendar */}
        <View style={styles.calendarWrapper}>
          <EmployeeJobsCalendarViewOnly state={state} />
        </View>
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
    color: colors.text.secondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary[600],
    borderRadius: radius.md,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
  },
  profileCard: {
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.xl,
    alignItems: "center",
    ...shadows.md,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  employeeName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  businessInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  businessName: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  roleBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: radius.full,
  },
  roleText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  calendarWrapper: {
    flex: 1,
    minHeight: 500,
  },
});

export default EmployeeProfilePage;
