import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import BusinessOwnerService from "../../services/fetchRequests/BusinessOwnerService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Date range presets
const DATE_PRESETS = [
  { key: "week", label: "This Week" },
  { key: "lastWeek", label: "Last Week" },
  { key: "month", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
];

// Get date range for preset
const getDateRange = (preset) => {
  const now = new Date();
  const dayOfWeek = now.getDay();

  switch (preset) {
    case "week": {
      const start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      };
    }
    case "lastWeek": {
      const start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek - 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      };
    }
    case "lastMonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      };
    }
    default:
      return getDateRange("week");
  }
};

// Format date for display
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// Employee Hours Card
const EmployeeHoursCard = ({ employee, summary, onViewDetails }) => {
  const formattedPay = ((summary.totalPay || 0) / 100).toFixed(2);

  return (
    <Pressable style={styles.employeeCard} onPress={onViewDetails}>
      <View style={styles.employeeAvatar}>
        <Text style={styles.employeeAvatarText}>
          {(employee.firstName?.[0] || "E").toUpperCase()}
        </Text>
      </View>
      <View style={styles.employeeInfo}>
        <Text style={styles.employeeName}>
          {employee.firstName} {employee.lastName}
        </Text>
        <Text style={styles.employeeStats}>
          {summary.jobCount} job{summary.jobCount !== 1 ? "s" : ""} completed
        </Text>
      </View>
      <View style={styles.employeeHours}>
        <Text style={styles.hoursValue}>{summary.totalHours.toFixed(1)}</Text>
        <Text style={styles.hoursLabel}>hours</Text>
      </View>
      <View style={styles.employeePay}>
        <Text style={styles.payValue}>${formattedPay}</Text>
        <Text style={styles.payLabel}>earned</Text>
      </View>
      <Icon name="chevron-right" size={14} color={colors.neutral[400]} />
    </Pressable>
  );
};

// Job Row (for expanded view)
const JobRow = ({ job }) => {
  const formatTime = (dateStr) => {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <View style={styles.jobRow}>
      <View style={styles.jobDate}>
        <Text style={styles.jobDateText}>{formatDate(job.date)}</Text>
      </View>
      <View style={styles.jobTimes}>
        <Text style={styles.jobTimeText}>
          {formatTime(job.startedAt)} - {formatTime(job.completedAt)}
        </Text>
      </View>
      <View style={styles.jobHours}>
        <Text style={styles.jobHoursText}>
          {job.hoursWorked ? `${job.hoursWorked} hrs` : "--"}
        </Text>
      </View>
      <View style={styles.jobPay}>
        <Text style={styles.jobPayText}>
          ${((job.payAmount || 0) / 100).toFixed(2)}
        </Text>
      </View>
    </View>
  );
};

// Main Component
const TimesheetScreen = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timesheetData, setTimesheetData] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState("week");
  const [dateRange, setDateRange] = useState(getDateRange("week"));
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await BusinessOwnerService.getTimesheetData(
        state.currentUser.token,
        dateRange.startDate,
        dateRange.endDate
      );
      setTimesheetData(data);
    } catch (err) {
      console.error("Error fetching timesheet:", err);
      setError("Failed to load timesheet data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const onRefresh = useCallback(() => {
    fetchData(true);
  }, [state.currentUser.token, dateRange]);

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    setDateRange(getDateRange(preset));
    setExpandedEmployee(null);
  };

  const toggleEmployeeExpand = (employeeId) => {
    setExpandedEmployee(expandedEmployee === employeeId ? null : employeeId);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading timesheet...</Text>
      </View>
    );
  }

  const { employees = [], totalHours = 0, totalPay = 0, jobCount = 0 } = timesheetData || {};

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Timesheet</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Date Range Picker */}
      <View style={styles.datePickerContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.datePresets}
        >
          {DATE_PRESETS.map((preset) => (
            <Pressable
              key={preset.key}
              style={[
                styles.presetButton,
                selectedPreset === preset.key && styles.presetButtonActive,
              ]}
              onPress={() => handlePresetChange(preset.key)}
            >
              <Text
                style={[
                  styles.presetButtonText,
                  selectedPreset === preset.key && styles.presetButtonTextActive,
                ]}
              >
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.dateRangeText}>
          {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
        </Text>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Icon name="clock-o" size={20} color={colors.primary[100]} />
          <Text style={styles.summaryValue}>{totalHours.toFixed(1)}</Text>
          <Text style={styles.summaryLabel}>Total Hours</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Icon name="briefcase" size={20} color={colors.primary[100]} />
          <Text style={styles.summaryValue}>{jobCount}</Text>
          <Text style={styles.summaryLabel}>Jobs</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Icon name="dollar" size={20} color={colors.primary[100]} />
          <Text style={styles.summaryValue}>${(totalPay / 100).toFixed(0)}</Text>
          <Text style={styles.summaryLabel}>Total Pay</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {error && (
          <View style={styles.errorMessage}>
            <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
            <Text style={styles.errorMessageText}>{error}</Text>
          </View>
        )}

        {/* Employee List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By Employee</Text>
          {employees.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="clock-o" size={48} color={colors.neutral[300]} />
              <Text style={styles.emptyTitle}>No Hours Recorded</Text>
              <Text style={styles.emptyText}>
                No employee hours found for this period.
              </Text>
            </View>
          ) : (
            <View style={styles.employeeList}>
              {employees.map((item) => (
                <View key={item.employee.id}>
                  <EmployeeHoursCard
                    employee={item.employee}
                    summary={item}
                    onViewDetails={() =>
                      navigate(`/business-owner/employees/${item.employee.id}/hours`)
                    }
                  />
                  {/* Expanded job list */}
                  {expandedEmployee === item.employee.id && item.jobs.length > 0 && (
                    <View style={styles.jobList}>
                      <View style={styles.jobListHeader}>
                        <Text style={styles.jobListHeaderText}>Date</Text>
                        <Text style={styles.jobListHeaderText}>Time</Text>
                        <Text style={styles.jobListHeaderText}>Hours</Text>
                        <Text style={styles.jobListHeaderText}>Pay</Text>
                      </View>
                      {item.jobs.map((job) => (
                        <JobRow key={job.id} job={job} />
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Icon name="info-circle" size={20} color={colors.primary[600]} />
          <Text style={styles.infoText}>
            Hours are automatically calculated when employees complete jobs.
            Tap on an employee to view their detailed hours breakdown.
          </Text>
        </View>

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
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  datePickerContainer: {
    backgroundColor: colors.background.primary,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  datePresets: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  presetButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
  },
  presetButtonActive: {
    backgroundColor: colors.primary[600],
  },
  presetButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  presetButtonTextActive: {
    color: "#fff",
  },
  dateRangeText: {
    textAlign: "center",
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: colors.primary[600],
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    ...shadows.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
    marginTop: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[200],
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  employeeList: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    ...shadows.sm,
    overflow: "hidden",
  },
  employeeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  employeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  employeeAvatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  employeeInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  employeeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  employeeStats: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  employeeHours: {
    alignItems: "center",
    marginRight: spacing.lg,
  },
  hoursValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  hoursLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  employeePay: {
    alignItems: "center",
    marginRight: spacing.md,
  },
  payValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
  },
  payLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  jobList: {
    backgroundColor: colors.neutral[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  jobListHeader: {
    flexDirection: "row",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  jobListHeaderText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
    textTransform: "uppercase",
  },
  jobRow: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  jobDate: {
    flex: 1,
  },
  jobDateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  jobTimes: {
    flex: 1,
  },
  jobTimeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  jobHours: {
    flex: 1,
  },
  jobHoursText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  jobPay: {
    flex: 1,
  },
  jobPayText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[600],
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.error[600],
  },
  errorMessageText: {
    marginLeft: spacing.sm,
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[800],
    lineHeight: 20,
  },
  bottomPadding: {
    height: spacing["4xl"],
  },
});

export default TimesheetScreen;
