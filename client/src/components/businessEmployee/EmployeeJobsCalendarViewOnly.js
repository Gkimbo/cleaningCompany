import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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

// View-Only Job Card - No navigation, no action buttons
const ViewOnlyJobCard = ({ job, isPast }) => {
  const statusColor = STATUS_COLORS[job.status] || STATUS_COLORS.assigned;

  const formatTime = (timeStr) => {
    if (!timeStr) return "TBD";
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

  const home = job.appointment?.home;
  const numBeds = home?.numBeds || home?.bedrooms;
  const numBaths = home?.numBaths || home?.bathrooms;

  return (
    <View style={[styles.jobCard, isPast && styles.jobCardPast]}>
      <View style={[styles.jobStatusBar, { backgroundColor: statusColor }]} />
      <View style={styles.jobContent}>
        {/* Header with duration and status */}
        <View style={styles.jobHeader}>
          {job.appointment?.timeToBeCompleted && (
            <View style={styles.jobTimeContainer}>
              <Icon name="clock-o" size={12} color={colors.text.tertiary} />
              <Text style={[styles.jobTime, isPast && styles.jobTimePast]}>
                Completed by {job.appointment.timeToBeCompleted}h
              </Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {getStatusLabel(job.status)}
            </Text>
          </View>
        </View>

        {/* Address */}
        <View style={styles.addressRow}>
          <Icon name="map-marker" size={14} color={colors.primary[500]} style={styles.addressIcon} />
          <Text style={[styles.jobAddress, isPast && styles.jobAddressPast]} numberOfLines={2}>
            {home?.address || home?.generalArea || "Address pending"}
            {home?.addressRestricted && (
              <Text style={styles.restrictedLabel}> (Full address day-of)</Text>
            )}
          </Text>
        </View>

        {/* Details row */}
        <View style={styles.jobDetailsRow}>
          {/* Home stats */}
          {(numBeds || numBaths) && (
            <View style={styles.homeStatsRow}>
              {numBeds && (
                <View style={styles.homeStat}>
                  <Icon name="bed" size={10} color={colors.neutral[400]} />
                  <Text style={styles.homeStatText}>{numBeds}</Text>
                </View>
              )}
              {numBaths && (
                <View style={styles.homeStat}>
                  <Icon name="bath" size={10} color={colors.neutral[400]} />
                  <Text style={styles.homeStatText}>{numBaths}</Text>
                </View>
              )}
            </View>
          )}

          {/* Client name chip */}
          {job.appointment?.user?.firstName && (
            <View style={styles.clientChip}>
              <Icon name="user" size={10} color={colors.neutral[500]} />
              <Text style={styles.clientChipText}>
                {job.appointment.user.firstName}
              </Text>
            </View>
          )}

          {/* Pay amount */}
          {job.payAmount !== undefined && job.payAmount > 0 && (
            <View style={styles.payChip}>
              <Text style={styles.payChipText}>
                ${(job.payAmount / 100).toFixed(0)}
              </Text>
            </View>
          )}
        </View>

        {/* Co-workers */}
        {job.coWorkers && job.coWorkers.length > 0 && (
          <View style={styles.coWorkersPreview}>
            <Icon name="users" size={10} color={colors.neutral[400]} />
            <Text style={styles.coWorkersText}>
              +{job.coWorkers.length} team member{job.coWorkers.length > 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>
    </View>
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
const EmployeeJobsCalendarViewOnly = ({ state }) => {
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
      const jobDate = new Date(job.appointment?.date + "T00:00:00");
      return jobDate.toDateString() === date.toDateString();
    });
  }, [jobs]);

  // Update selected jobs when jobs array or selectedDate changes
  useEffect(() => {
    setSelectedJobs(getJobsForDate(selectedDate));
  }, [jobs, selectedDate, getJobsForDate]);

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

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

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

  // Check if selected date is in the past
  const isSelectedDatePast = selectedDate < new Date(today.toDateString());

  // Get all jobs for current month for stats
  const monthJobs = jobs.filter(job => {
    const jobDate = new Date(job.appointment?.date + "T00:00:00");
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

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-circle" size={32} color={colors.error[500]} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchJobs}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        <Pressable style={styles.todayButton} onPress={goToToday}>
          <Text style={styles.todayButtonText}>Today</Text>
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
            <Text style={styles.noJobsText}>No jobs on this date</Text>
          </View>
        ) : (
          <ScrollView style={styles.jobsList} showsVerticalScrollIndicator={false}>
            {selectedJobs.map(job => (
              <ViewOnlyJobCard
                key={job.id}
                job={job}
                isPast={isSelectedDatePast}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* No jobs at all message */}
      {jobs.length === 0 && !loading && (
        <View style={styles.noJobsAssigned}>
          <Icon name="briefcase" size={40} color={colors.neutral[300]} />
          <Text style={styles.noJobsAssignedText}>No jobs assigned yet</Text>
          <Text style={styles.noJobsAssignedSubtext}>
            Jobs assigned by your business owner will appear here
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  errorText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary[600],
    borderRadius: radius.md,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.medium,
  },
  monthNavigator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  monthNavButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  monthTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textAlign: "center",
  },
  todayButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    marginLeft: spacing.sm,
  },
  todayButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  monthStats: {
    flexDirection: "row",
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.md,
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
    marginHorizontal: spacing.md,
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
    paddingHorizontal: spacing.md,
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
  jobsList: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  jobCard: {
    flexDirection: "row",
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: "hidden",
    ...shadows.sm,
  },
  jobCardPast: {
    opacity: 0.6,
    backgroundColor: colors.neutral[50],
  },
  jobStatusBar: {
    width: 4,
  },
  jobContent: {
    flex: 1,
    padding: spacing.sm,
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  jobTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  jobTime: {
    marginLeft: 4,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  jobTimePast: {
    color: colors.text.secondary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
  },
  addressRow: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  addressIcon: {
    marginRight: spacing.xs,
    marginTop: 2,
  },
  jobAddress: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 18,
  },
  jobAddressPast: {
    color: colors.text.secondary,
  },
  restrictedLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  jobDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  homeStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  homeStat: {
    flexDirection: "row",
    alignItems: "center",
  },
  homeStatText: {
    marginLeft: 3,
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  clientChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.full,
  },
  clientChipText: {
    marginLeft: 3,
    fontSize: 10,
    color: colors.text.secondary,
  },
  payChip: {
    backgroundColor: colors.success[50],
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  payChipText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
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
    marginLeft: 4,
    fontSize: 10,
    color: colors.neutral[500],
  },
  noJobsAssigned: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  noJobsAssignedText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  noJobsAssignedSubtext: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: "center",
  },
});

export default EmployeeJobsCalendarViewOnly;
