import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";
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

// Status colors for job indicators
const STATUS_COLORS = {
  unassigned: colors.warning[500],
  assigned: colors.primary[500],
  started: colors.secondary[500],
  completed: colors.success[500],
  cancelled: colors.neutral[400],
};

// Days of week header
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Calendar Day Component
const CalendarDay = ({ date, isCurrentMonth, isToday, isSelected, jobs, onPress }) => {
  const hasJobs = jobs && jobs.length > 0;
  const unassignedCount = jobs?.filter((j) => !j.isAssigned).length || 0;
  const assignedCount = jobs?.filter((j) => j.isAssigned).length || 0;

  return (
    <Pressable
      style={[
        styles.calendarDay,
        !isCurrentMonth && styles.calendarDayOtherMonth,
        isToday && styles.calendarDayToday,
        isSelected && styles.calendarDaySelected,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.calendarDayText,
          !isCurrentMonth && styles.calendarDayTextOtherMonth,
          isToday && styles.calendarDayTextToday,
          isSelected && styles.calendarDayTextSelected,
        ]}
      >
        {date.getDate()}
      </Text>
      {hasJobs && (
        <View style={styles.jobIndicators}>
          {unassignedCount > 0 && (
            <View style={[styles.jobDot, { backgroundColor: STATUS_COLORS.unassigned }]}>
              {unassignedCount > 1 && (
                <Text style={styles.jobDotText}>{unassignedCount}</Text>
              )}
            </View>
          )}
          {assignedCount > 0 && (
            <View style={[styles.jobDot, { backgroundColor: STATUS_COLORS.assigned }]}>
              {assignedCount > 1 && (
                <Text style={styles.jobDotText}>{assignedCount}</Text>
              )}
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
};

// Job Card in day detail view
const JobCard = ({ job, onAssign, onViewDetails }) => {
  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours);
    return `${h > 12 ? h - 12 : h}:${minutes} ${h >= 12 ? "PM" : "AM"}`;
  };

  // Round to nearest 0.5 hour increment
  const roundToHalfHour = (hours) => Math.ceil(hours * 2) / 2;

  const isAssigned = job.isAssigned;
  const statusColor = isAssigned
    ? STATUS_COLORS[job.status] || STATUS_COLORS.assigned
    : STATUS_COLORS.unassigned;

  // Multi-cleaner info - only trust allAssignments array for accurate cleaner count
  const allAssignments = job.allAssignments || [];
  const ownerAssignment = allAssignments.find(a => a.isSelfAssignment);
  const employeeAssignments = allAssignments.filter(a => !a.isSelfAssignment);
  const ownerIsAssigned = ownerAssignment || job.isSelfAssignment;

  // Calculate total cleaners - only use allAssignments.length for accurate count
  // Don't rely on assignedCount alone as it may be stale
  const totalCleaners = allAssignments.length > 0
    ? allAssignments.length
    : (isAssigned ? 1 : 0);
  const isMultiCleaner = totalCleaners > 1 && allAssignments.length > 1;

  // Calculate adjusted duration for multi-cleaner jobs
  const baseDuration = job.duration || 2;
  const adjustedDuration = isMultiCleaner ? roundToHalfHour(baseDuration / totalCleaners) : baseDuration;

  // Build cleaner display
  const getCleanerDisplay = () => {
    if (!isAssigned) return null;
    if (ownerIsAssigned && employeeAssignments.length > 0) {
      if (employeeAssignments.length === 1) {
        return `You + ${employeeAssignments[0].employee?.firstName || "1 employee"}`;
      }
      return `You + ${employeeAssignments.length} employees`;
    }
    if (ownerIsAssigned) {
      return "You (Self)";
    }
    if (totalCleaners > 1 && allAssignments.length > 0) {
      return `${totalCleaners} cleaners`;
    }
    return job.employeeName || "Assigned";
  };

  return (
    <Pressable
      style={[
        styles.jobCard,
        ownerIsAssigned && styles.jobCardSelfAssigned,
      ]}
      onPress={onViewDetails}
    >
      <View style={[
        styles.jobStatusBar,
        { backgroundColor: ownerIsAssigned ? colors.warning[500] : statusColor },
      ]} />
      <View style={styles.jobCardContent}>
        <View style={styles.jobCardHeader}>
          <Text style={styles.jobCardTime}>{formatTime(job.startTime)}</Text>
          <View style={styles.jobCardHeaderRight}>
            {isMultiCleaner && (
              <View style={styles.durationBadge}>
                <Icon name="clock-o" size={10} color={colors.success[600]} />
                <Text style={styles.durationBadgeText}>{adjustedDuration}hr each</Text>
              </View>
            )}
            <View style={[styles.jobStatusBadge, { backgroundColor: statusColor + "20" }]}>
              <Text style={[styles.jobStatusText, { color: statusColor }]}>
                {isAssigned ? job.status : "Unassigned"}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.jobCardClient}>{job.clientName || "Client"}</Text>
        <Text style={styles.jobCardAddress} numberOfLines={1}>
          {job.address || "No address"}
        </Text>
        {isAssigned && (
          <View style={styles.jobCardAssigneeSection}>
            {/* Show all cleaners for multi-cleaner jobs */}
            {isMultiCleaner && allAssignments.length > 0 ? (
              <View style={styles.cleanersList}>
                {ownerIsAssigned && (
                  <View style={styles.cleanerChip}>
                    <View style={styles.cleanerChipAvatarOwner}>
                      <Icon name="star" size={8} color={colors.warning[600]} />
                    </View>
                    <Text style={styles.cleanerChipTextOwner}>You</Text>
                  </View>
                )}
                {employeeAssignments.slice(0, 3).map((a, idx) => (
                  <View key={a.id || idx} style={styles.cleanerChip}>
                    <View style={styles.cleanerChipAvatar}>
                      <Text style={styles.cleanerChipAvatarText}>
                        {(a.employee?.firstName?.[0] || "E").toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.cleanerChipText}>
                      {a.employee?.firstName || "Employee"}
                    </Text>
                    {a.payAmount > 0 && (
                      <Text style={styles.cleanerChipPay}>
                        ${(a.payAmount / 100).toFixed(0)}
                      </Text>
                    )}
                  </View>
                ))}
                {employeeAssignments.length > 3 && (
                  <Text style={styles.moreCleanersText}>
                    +{employeeAssignments.length - 3} more
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.jobCardAssignee}>
                {ownerIsAssigned && (
                  <Icon name="star" size={12} color={colors.warning[600]} style={{ marginRight: 4 }} />
                )}
                <Icon name="user" size={12} color={ownerIsAssigned ? colors.warning[600] : colors.primary[600]} />
                <Text style={[
                  styles.jobCardAssigneeText,
                  ownerIsAssigned && styles.jobCardAssigneeTextOwner,
                ]}>
                  {getCleanerDisplay()}
                </Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.jobCardFooter}>
          <Text style={styles.jobCardPrice}>
            ${((job.totalPrice || 0) / 100).toFixed(0)}
          </Text>
          {!isAssigned && (
            <Pressable style={styles.assignQuickButton} onPress={onAssign}>
              <Icon name="user-plus" size={14} color={colors.primary[600]} />
              <Text style={styles.assignQuickButtonText}>Assign</Text>
            </Pressable>
          )}
          {isMultiCleaner && (
            <View style={styles.cleanerCountBadge}>
              <Icon name="users" size={10} color={colors.neutral[500]} />
              <Text style={styles.cleanerCountText}>{totalCleaners}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
};

// Filter Dropdown
const FilterDropdown = ({ value, options, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.filterContainer}>
      <Text style={styles.filterLabel}>{label}</Text>
      <Pressable style={styles.filterButton} onPress={() => setIsOpen(!isOpen)}>
        <Text style={styles.filterButtonText}>
          {options.find((o) => o.value === value)?.label || "All"}
        </Text>
        <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={12} color={colors.neutral[600]} />
      </Pressable>
      {isOpen && (
        <View style={styles.filterDropdown}>
          {options.map((option) => (
            <Pressable
              key={option.value || "all"}
              style={[
                styles.filterOption,
                value === option.value && styles.filterOptionSelected,
              ]}
              onPress={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <Text
                style={[
                  styles.filterOptionText,
                  value === option.value && styles.filterOptionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

// Main Calendar Component
const BusinessOwnerCalendar = ({ state }) => {
  const { goBack, navigate } = useSafeNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [jobs, setJobs] = useState({});
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState(null);
  const [employeeFilter, setEmployeeFilter] = useState(null);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const [calendarResult, employeesResult] = await Promise.all([
        BusinessOwnerService.getCalendar(state.currentUser.token, month, year),
        BusinessOwnerService.getEmployees(state.currentUser.token, "active"),
      ]);

      // Process jobs into a date-keyed object
      const jobsByDate = {};

      // Add unassigned jobs
      (calendarResult.unassignedJobs || []).forEach((job) => {
        const dateKey = job.date.split("T")[0];
        if (!jobsByDate[dateKey]) jobsByDate[dateKey] = [];
        jobsByDate[dateKey].push({ ...job, isAssigned: false });
      });

      // Deduplicate assignments by appointmentId (for multi-cleaner jobs)
      const assignmentsByAppointment = {};
      (calendarResult.assignments || []).forEach((assignment) => {
        const apptId = assignment.appointmentId;
        if (!assignmentsByAppointment[apptId]) {
          assignmentsByAppointment[apptId] = assignment;
        }
      });

      // Add assigned jobs (deduplicated)
      Object.values(assignmentsByAppointment).forEach((assignment) => {
        const dateKey = assignment.appointment?.date?.split("T")[0];
        if (!dateKey) return;
        if (!jobsByDate[dateKey]) jobsByDate[dateKey] = [];

        // Get all cleaners info
        const allAssignments = assignment.allAssignments || [];
        const ownerAssignment = allAssignments.find(a => a.isSelfAssignment);
        const employeeAssignments = allAssignments.filter(a => !a.isSelfAssignment);

        // Build employee name display
        let employeeName = "";
        if (ownerAssignment && employeeAssignments.length > 0) {
          employeeName = employeeAssignments.length === 1
            ? `You + ${employeeAssignments[0].employee?.firstName || "1 employee"}`
            : `You + ${employeeAssignments.length} employees`;
        } else if (assignment.isSelfAssignment || ownerAssignment) {
          employeeName = "You (Self)";
        } else if (allAssignments.length > 1) {
          employeeName = `${allAssignments.length} cleaners`;
        } else {
          employeeName = `${assignment.employee?.firstName || ""} ${assignment.employee?.lastName || ""}`.trim();
        }

        jobsByDate[dateKey].push({
          ...assignment.appointment,
          id: assignment.appointment?.id,
          appointmentId: assignment.appointmentId,
          assignmentId: assignment.id,
          isAssigned: true,
          status: assignment.status,
          employeeId: assignment.businessEmployeeId,
          employeeName,
          payAmount: assignment.payAmount,
          isSelfAssignment: assignment.isSelfAssignment,
          // Multi-cleaner data
          allAssignments,
          assignedCount: assignment.assignedCount || allAssignments.length || 1,
        });
      });

      setJobs(jobsByDate);
      setEmployees(employeesResult.employees || []);
    } catch (err) {
      console.error("Error fetching calendar:", err);
      setError("Failed to load calendar");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentDate.getMonth(), currentDate.getFullYear()]);

  const onRefresh = useCallback(() => {
    fetchData(true);
  }, [state.currentUser.token, currentDate]);

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];

    // Add days from previous month
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Add days from current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Add days from next month
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const navigateMonth = (direction) => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1)
    );
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const formatDateKey = (date) => {
    return date.toISOString().split("T")[0];
  };

  const getJobsForDate = (date) => {
    const dateKey = formatDateKey(date);
    let dateJobs = jobs[dateKey] || [];

    // Apply filters
    if (statusFilter === "unassigned") {
      dateJobs = dateJobs.filter((j) => !j.isAssigned);
    } else if (statusFilter === "assigned") {
      dateJobs = dateJobs.filter((j) => j.isAssigned);
    }

    if (employeeFilter) {
      dateJobs = dateJobs.filter(
        (j) => j.employeeId === employeeFilter || (!j.isAssigned && employeeFilter === "unassigned")
      );
    }

    return dateJobs;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const calendarDays = generateCalendarDays();
  const selectedDateJobs = selectedDate ? getJobsForDate(selectedDate) : [];

  const statusOptions = [
    { value: null, label: "All Jobs" },
    { value: "unassigned", label: "Unassigned" },
    { value: "assigned", label: "Assigned" },
  ];

  const employeeOptions = [
    { value: null, label: "All Employees" },
    { value: "unassigned", label: "Unassigned Only" },
    ...employees.map((e) => ({
      value: e.id,
      label: `${e.firstName} ${e.lastName}`,
    })),
  ];

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
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => goBack()}>
            <Icon name="arrow-left" size={18} color={colors.text.primary} />
          </Pressable>
          <View>
            <Text style={styles.title}>Calendar</Text>
            <Text style={styles.subtitle}>
              {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.todayButton} onPress={goToToday}>
            <Text style={styles.todayButtonText}>Today</Text>
          </Pressable>
        </View>
      </View>

      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <Pressable style={styles.monthNavButton} onPress={() => navigateMonth(-1)}>
          <Icon name="chevron-left" size={16} color={colors.primary[600]} />
        </Pressable>
        <Text style={styles.monthNavText}>
          {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </Text>
        <Pressable style={styles.monthNavButton} onPress={() => navigateMonth(1)}>
          <Icon name="chevron-right" size={16} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        <FilterDropdown
          label="Status"
          value={statusFilter}
          options={statusOptions}
          onChange={setStatusFilter}
        />
        <FilterDropdown
          label="Employee"
          value={employeeFilter}
          options={employeeOptions}
          onChange={setEmployeeFilter}
        />
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.unassigned }]} />
          <Text style={styles.legendText}>Unassigned</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.assigned }]} />
          <Text style={styles.legendText}>Assigned</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.completed }]} />
          <Text style={styles.legendText}>Completed</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => fetchData()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Calendar Grid */}
        <View style={styles.calendarContainer}>
          {/* Days of week header */}
          <View style={styles.weekHeader}>
            {DAYS_OF_WEEK.map((day) => (
              <View key={day} style={styles.weekHeaderDay}>
                <Text style={styles.weekHeaderText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar days */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((dayInfo, index) => {
              const dateJobs = getJobsForDate(dayInfo.date);
              const isToday = dayInfo.date.toDateString() === today.toDateString();
              const isSelected =
                selectedDate && dayInfo.date.toDateString() === selectedDate.toDateString();

              return (
                <CalendarDay
                  key={index}
                  date={dayInfo.date}
                  isCurrentMonth={dayInfo.isCurrentMonth}
                  isToday={isToday}
                  isSelected={isSelected}
                  jobs={dateJobs}
                  onPress={() => setSelectedDate(dayInfo.date)}
                />
              );
            })}
          </View>
        </View>

        {/* Selected Day Detail */}
        {selectedDate && (
          <View style={styles.dayDetail}>
            <Text style={styles.dayDetailTitle}>
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
            {selectedDateJobs.length === 0 ? (
              <View style={styles.noJobsMessage}>
                <Icon name="calendar-o" size={24} color={colors.neutral[300]} />
                <Text style={styles.noJobsText}>No jobs scheduled</Text>
              </View>
            ) : (
              selectedDateJobs.map((job, index) => (
                <JobCard
                  key={job.assignmentId || job.id || index}
                  job={job}
                  onAssign={() => navigate(`/business-owner/assign?jobId=${job.id}`)}
                  onViewDetails={() =>
                    job.isAssigned
                      ? navigate(`/business-owner/assignments/${job.assignmentId}`)
                      : navigate(`/business-owner/assign?jobId=${job.id}`)
                  }
                />
              ))
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
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
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  todayButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
  },
  todayButtonText: {
    color: "#fff",
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  monthNavText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  filtersRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    gap: spacing.md,
  },
  filterContainer: {
    flex: 1,
    position: "relative",
    zIndex: 10,
  },
  filterLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  filterButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  filterButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  filterDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: colors.background.primary,
    borderRadius: radius.md,
    ...shadows.lg,
    marginTop: spacing.xs,
    zIndex: 100,
  },
  filterOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  filterOptionSelected: {
    backgroundColor: colors.primary[50],
  },
  filterOptionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  filterOptionTextSelected: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
    gap: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
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
  calendarContainer: {
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.xl,
    ...shadows.sm,
    overflow: "hidden",
  },
  weekHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  weekHeaderDay: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  weekHeaderText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    textTransform: "uppercase",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDay: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.xs,
  },
  calendarDayOtherMonth: {
    opacity: 0.4,
  },
  calendarDayToday: {
    backgroundColor: colors.primary[50],
  },
  calendarDaySelected: {
    backgroundColor: colors.primary[600],
  },
  calendarDayText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  calendarDayTextOtherMonth: {
    color: colors.text.tertiary,
  },
  calendarDayTextToday: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.bold,
  },
  calendarDayTextSelected: {
    color: "#fff",
    fontWeight: typography.fontWeight.bold,
  },
  jobIndicators: {
    flexDirection: "row",
    marginTop: 2,
    gap: 2,
  },
  jobDot: {
    minWidth: 14,
    height: 14,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  jobDotText: {
    fontSize: 8,
    color: "#fff",
    fontWeight: typography.fontWeight.bold,
  },
  dayDetail: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  dayDetailTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  noJobsMessage: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  noJobsText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  jobCard: {
    flexDirection: "row",
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
    overflow: "hidden",
  },
  jobStatusBar: {
    width: 4,
  },
  jobCardContent: {
    flex: 1,
    padding: spacing.md,
  },
  jobCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  jobCardTime: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  jobStatusBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  jobStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: "capitalize",
  },
  jobCardClient: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  jobCardAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  jobCardSelfAssigned: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning[400],
  },
  jobCardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    gap: 3,
  },
  durationBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  jobCardAssigneeSection: {
    marginTop: spacing.xs,
  },
  jobCardAssignee: {
    flexDirection: "row",
    alignItems: "center",
  },
  jobCardAssigneeText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
  },
  jobCardAssigneeTextOwner: {
    color: colors.warning[700],
  },
  cleanersList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  cleanerChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
  },
  cleanerChipAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  cleanerChipAvatarOwner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.warning[100],
    justifyContent: "center",
    alignItems: "center",
  },
  cleanerChipAvatarText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  cleanerChipText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.primary,
  },
  cleanerChipTextOwner: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  cleanerChipPay: {
    fontSize: 10,
    color: colors.warning[600],
    fontWeight: typography.fontWeight.medium,
  },
  moreCleanersText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    alignSelf: "center",
  },
  cleanerCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    gap: 4,
  },
  cleanerCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[600],
  },
  jobCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  jobCardPrice: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  assignQuickButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  assignQuickButtonText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  bottomPadding: {
    height: spacing["4xl"],
  },
});

export default BusinessOwnerCalendar;
