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
import { useParams } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import BusinessOwnerService from "../../services/fetchRequests/BusinessOwnerService";
import useSafeNavigation from "../../hooks/useSafeNavigation";
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
  { key: "all", label: "Last 30 Days" },
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
    case "all":
    default: {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: now.toISOString().split("T")[0],
      };
    }
  }
};

// Format date for display
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// Weekly Summary Card
const WeeklySummaryCard = ({ week }) => (
  <View style={styles.weekCard}>
    <View style={styles.weekHeader}>
      <Text style={styles.weekDateRange}>
        {formatShortDate(week.weekStart)} - {formatShortDate(week.weekEnd)}
      </Text>
    </View>
    <View style={styles.weekStats}>
      <View style={styles.weekStat}>
        <Text style={styles.weekStatValue}>{week.hours.toFixed(1)}</Text>
        <Text style={styles.weekStatLabel}>hours</Text>
      </View>
      <View style={styles.weekStatDivider} />
      <View style={styles.weekStat}>
        <Text style={styles.weekStatValue}>{week.jobCount}</Text>
        <Text style={styles.weekStatLabel}>jobs</Text>
      </View>
      <View style={styles.weekStatDivider} />
      <View style={styles.weekStat}>
        <Text style={[styles.weekStatValue, styles.payValue]}>
          ${(week.pay / 100).toFixed(2)}
        </Text>
        <Text style={styles.weekStatLabel}>earned</Text>
      </View>
    </View>
  </View>
);

// Day Card
const DayCard = ({ day, expanded, onToggle }) => {
  const formatTime = (dateStr) => {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <View style={styles.dayCard}>
      <Pressable style={styles.dayHeader} onPress={onToggle}>
        <View style={styles.dayDateContainer}>
          <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
          <Text style={styles.dayJobCount}>
            {day.jobs.length} job{day.jobs.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.dayStats}>
          <Text style={styles.dayHours}>{day.hours.toFixed(1)} hrs</Text>
          <Text style={styles.dayPay}>${(day.pay / 100).toFixed(2)}</Text>
        </View>
        <Icon
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={colors.neutral[400]}
        />
      </Pressable>

      {expanded && (
        <View style={styles.jobsList}>
          {day.jobs.map((job) => (
            <View key={job.id} style={styles.jobItem}>
              <View style={styles.jobInfo}>
                <View style={styles.jobStatusBadge}>
                  <View
                    style={[
                      styles.statusDot,
                      job.status === "completed"
                        ? styles.statusDotCompleted
                        : styles.statusDotPending,
                    ]}
                  />
                  <Text style={styles.jobStatus}>
                    {job.status === "completed" ? "Completed" : job.status}
                  </Text>
                </View>
                {job.client && (
                  <Text style={styles.jobClient}>{job.client}</Text>
                )}
                {job.address && (
                  <Text style={styles.jobAddress} numberOfLines={1}>
                    {job.address}
                  </Text>
                )}
              </View>
              <View style={styles.jobTimes}>
                <Text style={styles.jobTimeLabel}>
                  {formatTime(job.startedAt)} - {formatTime(job.completedAt)}
                </Text>
              </View>
              <View style={styles.jobHoursColumn}>
                <Text style={styles.jobHoursValue}>
                  {job.hoursWorked ? `${job.hoursWorked} hrs` : "--"}
                </Text>
              </View>
              <View style={styles.jobPayColumn}>
                <Text style={styles.jobPayValue}>
                  ${((job.payAmount || 0) / 100).toFixed(2)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// Main Component
const EmployeeHoursScreen = ({ state }) => {
  const { goBack } = useSafeNavigation();
  const { employeeId } = useParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hoursData, setHoursData] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState("all");
  const [dateRange, setDateRange] = useState(getDateRange("all"));
  const [expandedDay, setExpandedDay] = useState(null);
  const [viewMode, setViewMode] = useState("daily"); // "daily" | "weekly"
  const [error, setError] = useState(null);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await BusinessOwnerService.getEmployeeHours(
        state.currentUser.token,
        parseInt(employeeId),
        dateRange.startDate,
        dateRange.endDate
      );

      if (data.error) {
        setError(data.error);
        setHoursData(null);
      } else {
        setHoursData(data);
      }
    } catch (err) {
      console.error("Error fetching employee hours:", err);
      setError("Failed to load hours data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, employeeId]);

  const onRefresh = useCallback(() => {
    fetchData(true);
  }, [state.currentUser.token, dateRange, employeeId]);

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    setDateRange(getDateRange(preset));
    setExpandedDay(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading hours...</Text>
      </View>
    );
  }

  const {
    employee,
    totalHours = 0,
    totalPay = 0,
    completedJobs = 0,
    pendingJobs = 0,
    dailyBreakdown = [],
    weeklyTotals = [],
  } = hoursData || {};

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goBack()}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Hours</Text>
          {employee && (
            <Text style={styles.subtitle}>
              {employee.firstName} {employee.lastName}
            </Text>
          )}
        </View>
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
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Icon name="clock-o" size={18} color={colors.primary[100]} />
            <Text style={styles.summaryValue}>{totalHours.toFixed(1)}</Text>
            <Text style={styles.summaryLabel}>Hours</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Icon name="check-circle" size={18} color={colors.primary[100]} />
            <Text style={styles.summaryValue}>{completedJobs}</Text>
            <Text style={styles.summaryLabel}>Completed</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Icon name="dollar" size={18} color={colors.primary[100]} />
            <Text style={styles.summaryValue}>${(totalPay / 100).toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Earned</Text>
          </View>
        </View>
        {employee?.payType === "hourly" && employee?.hourlyRate && (
          <View style={styles.rateInfo}>
            <Text style={styles.rateText}>
              Rate: ${(employee.hourlyRate / 100).toFixed(2)}/hr
            </Text>
          </View>
        )}
      </View>

      {/* View Mode Toggle */}
      <View style={styles.viewToggle}>
        <Pressable
          style={[styles.toggleButton, viewMode === "daily" && styles.toggleButtonActive]}
          onPress={() => setViewMode("daily")}
        >
          <Icon
            name="calendar"
            size={14}
            color={viewMode === "daily" ? colors.primary[600] : colors.text.tertiary}
          />
          <Text
            style={[
              styles.toggleButtonText,
              viewMode === "daily" && styles.toggleButtonTextActive,
            ]}
          >
            Daily
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, viewMode === "weekly" && styles.toggleButtonActive]}
          onPress={() => setViewMode("weekly")}
        >
          <Icon
            name="bar-chart"
            size={14}
            color={viewMode === "weekly" ? colors.primary[600] : colors.text.tertiary}
          />
          <Text
            style={[
              styles.toggleButtonText,
              viewMode === "weekly" && styles.toggleButtonTextActive,
            ]}
          >
            Weekly
          </Text>
        </Pressable>
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

        {/* Weekly View */}
        {viewMode === "weekly" && (
          <View style={styles.section}>
            {weeklyTotals.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="clock-o" size={48} color={colors.neutral[300]} />
                <Text style={styles.emptyTitle}>No Hours</Text>
                <Text style={styles.emptyText}>
                  No hours recorded for this period.
                </Text>
              </View>
            ) : (
              <View style={styles.weekList}>
                {weeklyTotals.map((week, index) => (
                  <WeeklySummaryCard key={week.weekStart || index} week={week} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Daily View */}
        {viewMode === "daily" && (
          <View style={styles.section}>
            {dailyBreakdown.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="clock-o" size={48} color={colors.neutral[300]} />
                <Text style={styles.emptyTitle}>No Hours</Text>
                <Text style={styles.emptyText}>
                  No hours recorded for this period.
                </Text>
              </View>
            ) : (
              <View style={styles.dayList}>
                {dailyBreakdown.map((day) => (
                  <DayCard
                    key={day.date}
                    day={day}
                    expanded={expandedDay === day.date}
                    onToggle={() =>
                      setExpandedDay(expandedDay === day.date ? null : day.date)
                    }
                  />
                ))}
              </View>
            )}
          </View>
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
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  header: {
    flexDirection: "row",
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
  headerTitle: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
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
  summaryCard: {
    backgroundColor: colors.primary[600],
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    ...shadows.md,
  },
  summaryRow: {
    flexDirection: "row",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: typography.fontSize.xl,
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
  rateInfo: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  rateText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[100],
  },
  viewToggle: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  toggleButtonActive: {
    backgroundColor: colors.background.primary,
    ...shadows.sm,
  },
  toggleButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },
  toggleButtonTextActive: {
    color: colors.primary[600],
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  weekList: {
    gap: spacing.md,
  },
  weekCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  weekHeader: {
    marginBottom: spacing.md,
  },
  weekDateRange: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  weekStats: {
    flexDirection: "row",
  },
  weekStat: {
    flex: 1,
    alignItems: "center",
  },
  weekStatValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  weekStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  weekStatDivider: {
    width: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.xs,
  },
  payValue: {
    color: colors.success[600],
  },
  dayList: {
    gap: spacing.sm,
  },
  dayCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    ...shadows.sm,
    overflow: "hidden",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  dayDateContainer: {
    flex: 1,
  },
  dayDate: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  dayJobCount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  dayStats: {
    alignItems: "flex-end",
    marginRight: spacing.md,
  },
  dayHours: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  dayPay: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    marginTop: 2,
  },
  jobsList: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.neutral[50],
  },
  jobItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  jobInfo: {
    flex: 2,
  },
  jobStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  statusDotCompleted: {
    backgroundColor: colors.success[500],
  },
  statusDotPending: {
    backgroundColor: colors.warning[500],
  },
  jobStatus: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  jobClient: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    marginTop: 2,
  },
  jobAddress: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  jobTimes: {
    flex: 1,
  },
  jobTimeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  jobHoursColumn: {
    width: 60,
    alignItems: "center",
  },
  jobHoursValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  jobPayColumn: {
    width: 60,
    alignItems: "flex-end",
  },
  jobPayValue: {
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
  bottomPadding: {
    height: spacing["4xl"],
  },
});

export default EmployeeHoursScreen;
