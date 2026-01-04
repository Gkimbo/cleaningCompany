import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import BusinessEmployeeService from "../../services/fetchRequests/BusinessEmployeeService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Days of the week
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Status Colors
const STATUS_COLORS = {
  assigned: colors.primary[500],
  started: colors.warning[500],
  completed: colors.success[500],
  cancelled: colors.neutral[400],
  no_show: colors.error[500],
};

// Calendar Day Component
const CalendarDay = ({ date, isCurrentMonth, isToday, isSelected, jobs, onPress }) => {
  const hasJobs = jobs && jobs.length > 0;
  const jobCount = jobs?.length || 0;

  // Get the most important status to show
  const getIndicatorColor = () => {
    if (!hasJobs) return null;
    // Priority: started > assigned > completed
    if (jobs.some(j => j.status === "started")) return STATUS_COLORS.started;
    if (jobs.some(j => j.status === "assigned")) return STATUS_COLORS.assigned;
    if (jobs.some(j => j.status === "completed")) return STATUS_COLORS.completed;
    return STATUS_COLORS.assigned;
  };

  const indicatorColor = getIndicatorColor();

  return (
    <Pressable
      style={[
        styles.dayCell,
        !isCurrentMonth && styles.dayCellOtherMonth,
        isToday && styles.dayCellToday,
        isSelected && styles.dayCellSelected,
      ]}
      onPress={() => onPress(date, jobs)}
    >
      <Text
        style={[
          styles.dayText,
          !isCurrentMonth && styles.dayTextOtherMonth,
          isToday && styles.dayTextToday,
          isSelected && styles.dayTextSelected,
        ]}
      >
        {date.getDate()}
      </Text>
      {hasJobs && (
        <View style={styles.jobIndicators}>
          <View style={[styles.jobDot, { backgroundColor: indicatorColor }]} />
          {jobCount > 1 && (
            <Text style={styles.jobCount}>+{jobCount - 1}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
};

// Job Card for Selected Day
const SelectedDayJobCard = ({ job, onPress }) => {
  const statusColor = STATUS_COLORS[job.status] || STATUS_COLORS.assigned;

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours);
    return `${h > 12 ? h - 12 : h}:${minutes} ${h >= 12 ? "PM" : "AM"}`;
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "started": return "In Progress";
      case "completed": return "Completed";
      case "cancelled": return "Cancelled";
      case "no_show": return "No Show";
      default: return "Scheduled";
    }
  };

  return (
    <Pressable style={styles.selectedJobCard} onPress={onPress}>
      <View style={[styles.jobStatusBar, { backgroundColor: statusColor }]} />
      <View style={styles.selectedJobContent}>
        <View style={styles.selectedJobHeader}>
          <Text style={styles.selectedJobTime}>
            {formatTime(job.appointment?.startTime)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {getStatusLabel(job.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.selectedJobAddress} numberOfLines={1}>
          {job.appointment?.home?.address || "Address TBD"}
        </Text>
        <View style={styles.selectedJobDetails}>
          {job.appointment?.user?.firstName && (
            <Text style={styles.selectedJobClient}>
              {job.appointment.user.firstName}
            </Text>
          )}
          {job.payAmount !== undefined && (
            <Text style={styles.selectedJobPay}>
              ${(job.payAmount / 100).toFixed(0)}
            </Text>
          )}
        </View>
        {job.coWorkers && job.coWorkers.length > 0 && (
          <View style={styles.coWorkersPreview}>
            <Icon name="users" size={12} color={colors.neutral[400]} />
            <Text style={styles.coWorkersText}>
              +{job.coWorkers.length} team member{job.coWorkers.length > 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>
      <Icon name="chevron-right" size={16} color={colors.neutral[400]} />
    </Pressable>
  );
};

// Month Stats Component
const MonthStats = ({ jobs }) => {
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(j => j.status === "completed").length;
  const upcomingJobs = jobs.filter(j => j.status === "assigned" || j.status === "started").length;
  const totalEarnings = jobs
    .filter(j => j.status === "completed")
    .reduce((sum, j) => sum + (j.payAmount || 0), 0);

  return (
    <View style={styles.monthStats}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{totalJobs}</Text>
        <Text style={styles.statLabel}>Total</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{upcomingJobs}</Text>
        <Text style={styles.statLabel}>Upcoming</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{completedJobs}</Text>
        <Text style={styles.statLabel}>Done</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: colors.success[600] }]}>
          ${(totalEarnings / 100).toFixed(0)}
        </Text>
        <Text style={styles.statLabel}>Earned</Text>
      </View>
    </View>
  );
};

// Main Component
const EmployeeCalendar = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [jobs, setJobs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [error, setError] = useState(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all jobs (not just upcoming) to show on calendar
      const result = await BusinessEmployeeService.getMyJobs(state.currentUser.token, {});
      setJobs(result?.jobs || []);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      setError("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Get jobs for a specific date
  const getJobsForDate = useCallback((date) => {
    return jobs.filter(job => {
      const jobDate = new Date(job.appointment?.date);
      return jobDate.toDateString() === date.toDateString();
    });
  }, [jobs]);

  // Handle date selection
  const handleDatePress = (date, dateJobs) => {
    setSelectedDate(date);
    setSelectedJobs(dateJobs || getJobsForDate(date));
  };

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
    setSelectedJobs(getJobsForDate(today));
  };

  // Generate calendar grid
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Start from the Sunday of the first week
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // End on the Saturday of the last week
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    const days = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const calendarDays = generateCalendarDays();
  const today = new Date();

  // Get all jobs for current month for stats
  const monthJobs = jobs.filter(job => {
    const jobDate = new Date(job.appointment?.date);
    return jobDate.getMonth() === currentMonth.getMonth() &&
           jobDate.getFullYear() === currentMonth.getFullYear();
  });

  // Format selected date for display
  const formatSelectedDate = (date) => {
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    const monthDay = date.toLocaleDateString("en-US", { month: "long", day: "numeric" });

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${monthDay}`;
    }
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow, ${monthDay}`;
    }
    return `${dayName}, ${monthDay}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading calendar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Calendar</Text>
        <Pressable style={styles.todayButton} onPress={goToToday}>
          <Text style={styles.todayButtonText}>Today</Text>
        </Pressable>
      </View>

      {/* Month Navigator */}
      <View style={styles.monthNavigator}>
        <Pressable style={styles.monthNavButton} onPress={goToPreviousMonth}>
          <Icon name="chevron-left" size={16} color={colors.primary[600]} />
        </Pressable>
        <Text style={styles.monthTitle}>
          {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Text>
        <Pressable style={styles.monthNavButton} onPress={goToNextMonth}>
          <Icon name="chevron-right" size={16} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Month Stats */}
      <MonthStats jobs={monthJobs} />

      {/* Calendar Grid */}
      <View style={styles.calendarContainer}>
        {/* Day Headers */}
        <View style={styles.dayHeaders}>
          {DAYS.map(day => (
            <Text key={day} style={styles.dayHeader}>{day}</Text>
          ))}
        </View>

        {/* Calendar Days */}
        <View style={styles.calendarGrid}>
          {calendarDays.map((date, index) => (
            <CalendarDay
              key={index}
              date={date}
              isCurrentMonth={date.getMonth() === currentMonth.getMonth()}
              isToday={date.toDateString() === today.toDateString()}
              isSelected={date.toDateString() === selectedDate.toDateString()}
              jobs={getJobsForDate(date)}
              onPress={handleDatePress}
            />
          ))}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.assigned }]} />
          <Text style={styles.legendText}>Scheduled</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.started }]} />
          <Text style={styles.legendText}>In Progress</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.completed }]} />
          <Text style={styles.legendText}>Completed</Text>
        </View>
      </View>

      {/* Selected Date Jobs */}
      <View style={styles.selectedDateSection}>
        <Text style={styles.selectedDateTitle}>
          {formatSelectedDate(selectedDate)}
        </Text>
        {selectedJobs.length === 0 ? (
          <View style={styles.noJobsMessage}>
            <Icon name="calendar-o" size={24} color={colors.neutral[300]} />
            <Text style={styles.noJobsText}>No jobs scheduled</Text>
          </View>
        ) : (
          <ScrollView style={styles.selectedJobsList}>
            {selectedJobs.map(job => (
              <SelectedDayJobCard
                key={job.id}
                job={job}
                onPress={() => navigate(`/employee/jobs/${job.id}`)}
              />
            ))}
          </ScrollView>
        )}
      </View>
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
  todayButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
  },
  todayButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  monthNavigator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
  },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  monthTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  monthStats: {
    flexDirection: "row",
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: "100%",
    backgroundColor: colors.border.light,
  },
  calendarContainer: {
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.sm,
    ...shadows.sm,
  },
  dayHeaders: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  dayHeader: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
    paddingVertical: spacing.xs,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.md,
  },
  dayCellOtherMonth: {
    opacity: 0.3,
  },
  dayCellToday: {
    backgroundColor: colors.primary[50],
  },
  dayCellSelected: {
    backgroundColor: colors.primary[600],
  },
  dayText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  dayTextOtherMonth: {
    color: colors.text.tertiary,
  },
  dayTextToday: {
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  dayTextSelected: {
    color: "#fff",
    fontWeight: typography.fontWeight.bold,
  },
  jobIndicators: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  jobDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  jobCount: {
    fontSize: 8,
    color: colors.text.tertiary,
    marginLeft: 2,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  selectedDateSection: {
    flex: 1,
    marginTop: spacing.sm,
  },
  selectedDateTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  noJobsMessage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  noJobsText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  selectedJobsList: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  selectedJobCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: "hidden",
    ...shadows.sm,
  },
  jobStatusBar: {
    width: 4,
    height: "100%",
  },
  selectedJobContent: {
    flex: 1,
    padding: spacing.md,
  },
  selectedJobHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  selectedJobTime: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  statusBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  selectedJobAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  selectedJobDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  selectedJobClient: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  selectedJobPay: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
    marginLeft: spacing.md,
  },
  coWorkersPreview: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  coWorkersText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
});

export default EmployeeCalendar;
