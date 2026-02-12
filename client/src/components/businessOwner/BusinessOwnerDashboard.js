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
import NotificationsService from "../../services/fetchRequests/NotificationsService";
import PaymentSetupBanner from "./PaymentSetupBanner";
import { useSocket } from "../../services/SocketContext";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Stats Card Component
const StatsCard = ({ icon, label, value, subValue, color, onPress }) => (
  <Pressable
    style={[styles.statsCard, onPress && styles.statsCardPressable]}
    onPress={onPress}
  >
    <View style={[styles.statsIcon, { backgroundColor: color + "20" }]}>
      <Icon name={icon} size={20} color={color} />
    </View>
    <Text style={styles.statsValue}>{value}</Text>
    <Text style={styles.statsLabel}>{label}</Text>
    {subValue && <Text style={styles.statsSubValue}>{subValue}</Text>}
  </Pressable>
);

// Quick Action Button Component
const QuickAction = ({ icon, label, onPress, color = colors.primary[600], badge }) => (
  <Pressable style={styles.quickAction} onPress={onPress}>
    <View style={[styles.quickActionIcon, { backgroundColor: color + "15" }]}>
      <Icon name={icon} size={24} color={color} />
      {badge > 0 && (
        <View style={styles.quickActionBadge}>
          <Text style={styles.quickActionBadgeText}>{badge}</Text>
        </View>
      )}
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </Pressable>
);

// Employee Row Component
const EmployeeRow = ({ employee, onPress }) => {
  const statusColors = {
    active: colors.success[500],
    pending_invite: colors.warning[500],
    inactive: colors.neutral[400],
  };

  return (
    <Pressable style={styles.employeeRow} onPress={onPress}>
      <View style={styles.employeeAvatar}>
        <Text style={styles.employeeAvatarText}>
          {(employee.firstName?.[0] || "E").toUpperCase()}
        </Text>
      </View>
      <View style={styles.employeeInfo}>
        <Text style={styles.employeeName}>
          {employee.firstName} {employee.lastName}
        </Text>
        <Text style={styles.employeeStatus}>
          {employee.jobsThisMonth || 0} jobs this month
        </Text>
      </View>
      <View
        style={[
          styles.statusDot,
          { backgroundColor: statusColors[employee.status] || colors.neutral[400] },
        ]}
      />
    </Pressable>
  );
};

// Job Card Component - used for Today/Tomorrow sections
const JobCard = ({ job, onPress, isUnassigned }) => {
  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours);
    return `${h > 12 ? h - 12 : h}:${minutes} ${h >= 12 ? "PM" : "AM"}`;
  };

  const isSelfAssigned = job.isSelfAssignment;

  return (
    <Pressable
      style={[
        styles.jobCard,
        isUnassigned && styles.jobCardUnassigned,
        isSelfAssigned && styles.jobCardSelfAssigned,
      ]}
      onPress={onPress}
    >
      <View style={styles.jobCardLeft}>
        <Text style={styles.jobCardTime}>{formatTime(job.startTime) || "TBD"}</Text>
        {isUnassigned && (
          <View style={styles.unassignedBadge}>
            <Text style={styles.unassignedBadgeText}>!</Text>
          </View>
        )}
        {isSelfAssigned && (
          <View style={styles.selfAssignedBadge}>
            <Icon name="star" size={10} color={colors.warning[600]} />
          </View>
        )}
      </View>
      <View style={styles.jobCardContent}>
        <Text style={styles.jobCardClient}>{job.clientName || "Client"}</Text>
        <Text style={styles.jobCardAddress} numberOfLines={1}>
          {job.address || "No address"}
        </Text>
        {isSelfAssigned ? (
          <View style={styles.selfAssignedTag}>
            <Icon name="star" size={10} color={colors.warning[600]} />
            <Text style={styles.selfAssignedTagText}>You're cleaning this</Text>
          </View>
        ) : job.employeeName ? (
          <View style={styles.assignedTag}>
            <Icon name="user" size={10} color={colors.primary[600]} />
            <Text style={styles.assignedTagText}>{job.employeeName}</Text>
          </View>
        ) : (
          <Text style={styles.unassignedText}>Needs assignment</Text>
        )}
      </View>
      <Text style={styles.jobCardPrice}>${((job.totalPrice || 0) / 100).toFixed(0)}</Text>
    </Pressable>
  );
};

// Section Header Component
const SectionHeader = ({ title, actionLabel, onAction, count }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count !== undefined && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
      )}
    </View>
    {actionLabel && (
      <Pressable onPress={onAction}>
        <Text style={styles.seeAllLink}>{actionLabel}</Text>
      </Pressable>
    )}
  </View>
);

// Pending Payroll Card Component
const PendingPayrollCard = ({ pendingPayroll, onPress, formatCurrency }) => {
  if (!pendingPayroll || pendingPayroll.totalPending <= 0) return null;

  const formatPayoutDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays <= 7) {
      return date.toLocaleDateString("en-US", { weekday: "long" });
    }
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const employeeCount = pendingPayroll.byEmployee?.length || 0;

  return (
    <Pressable style={styles.pendingPayrollCard} onPress={onPress}>
      <View style={styles.pendingPayrollHeader}>
        <View style={styles.pendingPayrollIconContainer}>
          <Icon name="calendar-check-o" size={22} color={colors.success[600]} />
        </View>
        <View style={styles.pendingPayrollInfo}>
          <Text style={styles.pendingPayrollTitle}>Upcoming Bi-Weekly Payroll</Text>
          <Text style={styles.pendingPayrollSubtitle}>
            {employeeCount} employee{employeeCount !== 1 ? "s" : ""} scheduled
          </Text>
        </View>
        <View style={styles.pendingPayrollAmount}>
          <Text style={styles.pendingPayrollAmountText}>
            {pendingPayroll.formatted?.totalPending || formatCurrency(pendingPayroll.totalPending)}
          </Text>
        </View>
      </View>

      {pendingPayroll.nextPayoutDate && (
        <View style={styles.pendingPayrollSchedule}>
          <Icon name="clock-o" size={14} color={colors.success[600]} />
          <Text style={styles.pendingPayrollScheduleText}>
            Scheduled for {formatPayoutDate(pendingPayroll.nextPayoutDate)}
          </Text>
        </View>
      )}

      {/* Employee breakdown preview */}
      {pendingPayroll.byEmployee && pendingPayroll.byEmployee.length > 0 && (
        <View style={styles.pendingPayrollEmployees}>
          {pendingPayroll.byEmployee.slice(0, 3).map((emp, idx) => (
            <View key={emp.employeeId || idx} style={styles.pendingPayrollEmployee}>
              <View style={styles.pendingPayrollEmployeeAvatar}>
                <Text style={styles.pendingPayrollEmployeeAvatarText}>
                  {(emp.firstName?.[0] || "E").toUpperCase()}
                </Text>
              </View>
              <Text style={styles.pendingPayrollEmployeeName} numberOfLines={1}>
                {emp.firstName} {emp.lastName?.[0]}.
              </Text>
              <Text style={styles.pendingPayrollEmployeeAmount}>
                {emp.formatted?.amount || formatCurrency(emp.amount || 0)}
              </Text>
            </View>
          ))}
          {pendingPayroll.byEmployee.length > 3 && (
            <Text style={styles.pendingPayrollMore}>
              +{pendingPayroll.byEmployee.length - 3} more
            </Text>
          )}
        </View>
      )}

      <View style={styles.pendingPayrollAction}>
        <Text style={styles.pendingPayrollActionText}>View Details</Text>
        <Icon name="chevron-right" size={14} color={colors.success[600]} />
      </View>
    </Pressable>
  );
};

// Elite Partner Status Card Component
const ElitePartnerStatusCard = ({ qualification, onPress }) => {
  if (!qualification) return null;

  const { currentCleanings, threshold, cleaningsNeeded, qualifies } = qualification;
  const progress = Math.min(100, Math.round((currentCleanings / threshold) * 100));

  if (qualifies) {
    // Qualified - Celebratory Card
    return (
      <Pressable style={styles.largeBusinessCard} onPress={onPress}>
        <View style={styles.largeBusinessHeader}>
          <View style={styles.largeBusinessIconContainer}>
            <Icon name="trophy" size={24} color={colors.warning[500]} />
          </View>
          <View style={styles.largeBusinessBadge}>
            <Text style={styles.largeBusinessBadgeText}>ELITE PARTNER</Text>
          </View>
        </View>
        <Text style={styles.largeBusinessTitle}>You're crushing it!</Text>
        <Text style={styles.largeBusinessSubtitle}>
          {currentCleanings} cleanings this month
        </Text>
        <View style={styles.largeBusinessPerks}>
          <View style={styles.perkItem}>
            <Icon name="star" size={12} color={colors.warning[500]} />
            <Text style={styles.perkText}>7% Platform Fee</Text>
          </View>
          <View style={styles.perkItem}>
            <Icon name="star" size={12} color={colors.warning[500]} />
            <Text style={styles.perkText}>Premium Analytics</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  // Not yet qualified - Progress Card
  const isHalfway = currentCleanings >= threshold / 2;

  return (
    <Pressable style={styles.elitePartnerCard} onPress={onPress}>
      <View style={styles.elitePartnerHeader}>
        <View style={styles.elitePartnerIconContainer}>
          <Icon name="diamond" size={18} color={colors.primary[600]} />
        </View>
        <View style={styles.elitePartnerTitleContainer}>
          <Text style={styles.elitePartnerTitle}>Become an Elite Partner</Text>
          <Text style={styles.elitePartnerSubtitle}>Unlock premium features & lower fees</Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.neutral[400]} />
      </View>

      <View style={styles.elitePartnerProgressSection}>
        <View style={styles.elitePartnerProgressHeader}>
          <Text style={styles.elitePartnerProgressLabel}>
            {currentCleanings} of {threshold} cleanings
          </Text>
          <Text style={styles.elitePartnerProgressPercent}>{progress}%</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
        {isHalfway ? (
          <Text style={styles.elitePartnerProgressHint}>
            You're making great progress! {cleaningsNeeded} more to go
          </Text>
        ) : (
          <Text style={styles.elitePartnerProgressHintSubtle}>
            {cleaningsNeeded} more cleanings needed this month
          </Text>
        )}
      </View>
    </Pressable>
  );
};

// Main Dashboard Component
const BusinessOwnerDashboard = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    overview: {},
    employees: [],
    todayJobs: [],
    tomorrowJobs: [],
    unassignedJobs: [],
    pendingPayouts: { count: 0, amount: 0 },
  });
  const [analyticsAccess, setAnalyticsAccess] = useState(null);
  const [pendingPayroll, setPendingPayroll] = useState({
    totalPending: 0,
    nextPayoutDate: null,
    byEmployee: [],
    formatted: { totalPending: "$0.00" },
  });
  const [error, setError] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [actionRequiredCount, setActionRequiredCount] = useState(0);

  // Socket hooks for real-time notification updates
  const { onNotification, onNotificationCountUpdate } = useSocket();

  // Fetch notification counts (unread + action-required)
  useEffect(() => {
    const fetchNotificationCounts = async () => {
      if (state.currentUser?.token) {
        try {
          const data = await NotificationsService.getUnreadCount(state.currentUser.token);
          setUnreadNotifications(data.unreadCount || 0);
          setActionRequiredCount(data.actionRequiredCount || 0);
        } catch (err) {
          console.error("Error fetching notification counts:", err);
        }
      }
    };
    fetchNotificationCounts();
  }, [state.currentUser?.token]);

  // Listen for real-time notification updates
  useEffect(() => {
    const unsubNotification = onNotification((data) => {
      setUnreadNotifications((prev) => prev + 1);
      // If the notification requires action, increment that count too
      if (data?.notification?.actionRequired) {
        setActionRequiredCount((prev) => prev + 1);
      }
    });

    const unsubCountUpdate = onNotificationCountUpdate((data) => {
      if (typeof data.unreadCount === "number") {
        setUnreadNotifications(data.unreadCount);
      }
      if (typeof data.actionRequiredCount === "number") {
        setActionRequiredCount(data.actionRequiredCount);
      }
    });

    return () => {
      unsubNotification();
      unsubCountUpdate();
    };
  }, [onNotification, onNotificationCountUpdate]);

  // Badge shows max of unread and action-required (action-required persists until resolved)
  const notificationBadgeCount = Math.max(unreadNotifications, actionRequiredCount);

  const fetchDashboard = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [dashboardResult, payoutsResult, calendarResult, accessResult, payrollResult] = await Promise.all([
        BusinessOwnerService.getDashboard(state.currentUser.token),
        BusinessOwnerService.getPendingPayouts(state.currentUser.token),
        BusinessOwnerService.getCalendar(
          state.currentUser.token,
          new Date().getMonth() + 1,
          new Date().getFullYear()
        ),
        BusinessOwnerService.getAnalyticsAccess(state.currentUser.token),
        BusinessOwnerService.getPendingPayroll(state.currentUser.token),
      ]);

      // Set analytics access for Elite Partner status
      if (accessResult && !accessResult.error) {
        setAnalyticsAccess(accessResult);
      }

      // Set pending payroll data
      if (payrollResult && !payrollResult.error) {
        setPendingPayroll({
          totalPending: payrollResult.totalPending || 0,
          nextPayoutDate: payrollResult.nextPayoutDate || null,
          byEmployee: payrollResult.byEmployee || [],
          formatted: payrollResult.formatted || { totalPending: "$0.00" },
        });
      }

      // Process jobs for today and tomorrow
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const formatDateKey = (date) => date.toISOString().split("T")[0];
      const todayKey = formatDateKey(today);
      const tomorrowKey = formatDateKey(tomorrow);

      // Combine unassigned and assigned jobs
      const allJobs = [
        ...(calendarResult.unassignedJobs || []).map((j) => ({ ...j, isAssigned: false })),
        ...(calendarResult.assignments || []).map((a) => ({
          ...a.appointment,
          isAssigned: true,
          isSelfAssignment: a.isSelfAssignment,
          employeeName: a.isSelfAssignment
            ? "You"
            : `${a.employee?.firstName || ""} ${a.employee?.lastName || ""}`.trim(),
        })),
      ];

      // Filter for today and tomorrow
      const todayJobs = allJobs.filter((j) => j.date?.split("T")[0] === todayKey);
      const tomorrowJobs = allJobs.filter((j) => j.date?.split("T")[0] === tomorrowKey);
      const unassignedJobs = (calendarResult.unassignedJobs || []).filter((j) => {
        const jobDate = new Date(j.date);
        return jobDate >= today;
      });

      setDashboardData({
        overview: dashboardResult.overview || {},
        employees: dashboardResult.employees || [],
        todayJobs,
        tomorrowJobs,
        unassignedJobs: unassignedJobs.slice(0, 5),
        pendingPayouts: {
          count: payoutsResult.pendingPayouts?.length || 0,
          amount: payoutsResult.totalAmount || 0,
        },
      });
    } catch (err) {
      console.error("Error fetching dashboard:", err);
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const onRefresh = useCallback(() => {
    fetchDashboard(true);
  }, [state.currentUser.token]);

  const formatCurrency = (cents) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  const {
    overview,
    employees,
    todayJobs,
    tomorrowJobs,
    unassignedJobs,
    pendingPayouts,
  } = dashboardData;

  // Calculate net profit
  const netProfit = (overview.revenueThisMonth || 0) -
    (overview.platformFeesThisMonth || 0) -
    (overview.payrollThisMonth || 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back!</Text>
          <Text style={styles.title}>Business Dashboard</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerButton}
            onPress={() => navigate("/messages")}
          >
            <Icon name="envelope" size={18} color={colors.neutral[600]} />
          </Pressable>
          <Pressable
            style={styles.headerButton}
            onPress={() => navigate("/notifications")}
          >
            <Icon name="bell" size={18} color={colors.neutral[600]} />
            {notificationBadgeCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => fetchDashboard()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Payment Setup Banner */}
      <PaymentSetupBanner state={state} />

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatsCard
          icon="calendar"
          label="Jobs This Month"
          value={overview.jobsThisMonth || 0}
          color={colors.primary[600]}
          onPress={() => navigate("/business-owner/calendar")}
        />
        <StatsCard
          icon="dollar"
          label="Revenue"
          value={formatCurrency(overview.revenueThisMonth || 0)}
          color={colors.success[600]}
          onPress={() => navigate("/business-owner/financials")}
        />
        <StatsCard
          icon="line-chart"
          label="Net Profit"
          value={formatCurrency(netProfit)}
          subValue={`After fees & payroll`}
          color={netProfit >= 0 ? colors.primary[600] : colors.error[600]}
          onPress={() => navigate("/business-owner/financials")}
        />
        <StatsCard
          icon="money"
          label="Payroll Owed"
          value={formatCurrency(pendingPayouts.amount)}
          subValue={`${pendingPayouts.count} pending`}
          color={colors.warning[600]}
          onPress={() => navigate("/business-owner/payroll")}
        />
      </View>

      {/* Elite Partner Status Card */}
      <ElitePartnerStatusCard
        qualification={analyticsAccess?.qualification}
        onPress={() => navigate("/business-owner/analytics")}
      />

      {/* Analytics Banner */}
      <Pressable
        style={styles.analyticsBanner}
        onPress={() => navigate("/business-owner/analytics")}
      >
        <View style={styles.analyticsBannerIcon}>
          <Icon name="line-chart" size={20} color={colors.primary[600]} />
        </View>
        <View style={styles.analyticsBannerContent}>
          <Text style={styles.analyticsBannerTitle}>Business Analytics</Text>
          <Text style={styles.analyticsBannerText}>
            View performance, trends & insights
          </Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.primary[600]} />
      </Pressable>

      {/* Pending Bi-Weekly Payroll */}
      <PendingPayrollCard
        pendingPayroll={pendingPayroll}
        onPress={() => navigate("/business-owner/payroll")}
        formatCurrency={formatCurrency}
      />

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <QuickAction
            icon="user-plus"
            label="Invite Employee"
            onPress={() => navigate("/business-owner/employees")}
            color={colors.primary[600]}
          />
          <QuickAction
            icon="calendar-plus-o"
            label="Assign Jobs"
            onPress={() => navigate("/business-owner/assign")}
            color={colors.secondary[600]}
            badge={unassignedJobs.length}
          />
          <QuickAction
            icon="comments"
            label="Team Chat"
            onPress={() => navigate("/business-owner/messages")}
            color={colors.success[600]}
          />
          <QuickAction
            icon="credit-card"
            label="Payroll"
            onPress={() => navigate("/business-owner/payroll")}
            color={colors.warning[600]}
            badge={pendingPayouts.count}
          />
        </View>
      </View>

      {/* Today's Jobs */}
      <View style={styles.section}>
        <SectionHeader
          title="Today's Jobs"
          count={todayJobs.length}
          actionLabel="View All"
          onAction={() => navigate("/business-owner/calendar")}
        />
        {todayJobs.length === 0 ? (
          <View style={styles.emptySection}>
            <Icon name="calendar-check-o" size={24} color={colors.neutral[300]} />
            <Text style={styles.emptySectionText}>No jobs scheduled for today</Text>
          </View>
        ) : (
          todayJobs.slice(0, 3).map((job, index) => (
            <JobCard
              key={job.id || index}
              job={job}
              isUnassigned={!job.isAssigned}
              onPress={() =>
                job.isAssigned
                  ? navigate(`/business-owner/calendar`)
                  : navigate(`/business-owner/assign?jobId=${job.id}`)
              }
            />
          ))
        )}
      </View>

      {/* Tomorrow's Jobs */}
      <View style={styles.section}>
        <SectionHeader
          title="Tomorrow's Jobs"
          count={tomorrowJobs.length}
          actionLabel="View All"
          onAction={() => navigate("/business-owner/calendar")}
        />
        {tomorrowJobs.length === 0 ? (
          <View style={styles.emptySection}>
            <Icon name="calendar-o" size={24} color={colors.neutral[300]} />
            <Text style={styles.emptySectionText}>No jobs scheduled for tomorrow</Text>
          </View>
        ) : (
          tomorrowJobs.slice(0, 3).map((job, index) => (
            <JobCard
              key={job.id || index}
              job={job}
              isUnassigned={!job.isAssigned}
              onPress={() =>
                job.isAssigned
                  ? navigate(`/business-owner/calendar`)
                  : navigate(`/business-owner/assign?jobId=${job.id}`)
              }
            />
          ))
        )}
      </View>

      {/* Unassigned Jobs Alert */}
      {unassignedJobs.length > 0 && (
        <Pressable
          style={styles.alertCard}
          onPress={() => navigate("/business-owner/assign")}
        >
          <View style={styles.alertIcon}>
            <Icon name="exclamation" size={16} color={colors.warning[700]} />
          </View>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>
              {unassignedJobs.length} Unassigned Job{unassignedJobs.length > 1 ? "s" : ""}
            </Text>
            <Text style={styles.alertText}>
              Tap to assign employees to upcoming jobs
            </Text>
          </View>
          <Icon name="chevron-right" size={16} color={colors.warning[600]} />
        </Pressable>
      )}

      {/* My Team */}
      <View style={styles.section}>
        <SectionHeader
          title="My Team"
          actionLabel="Manage"
          onAction={() => navigate("/business-owner/employees")}
        />
        {employees.length === 0 ? (
          <View style={styles.emptySection}>
            <Icon name="users" size={32} color={colors.neutral[300]} />
            <Text style={styles.emptySectionText}>No employees yet</Text>
            <Pressable
              style={styles.emptySectionButton}
              onPress={() => navigate("/business-owner/employees")}
            >
              <Text style={styles.emptySectionButtonText}>Invite First Employee</Text>
            </Pressable>
          </View>
        ) : (
          employees.slice(0, 4).map((employee) => (
            <EmployeeRow
              key={employee.id}
              employee={employee}
              onPress={() => navigate(`/business-owner/employees/${employee.id}/edit`)}
            />
          ))
        )}
      </View>

      {/* Pending Payouts Alert */}
      {pendingPayouts.count > 0 && (
        <Pressable
          style={styles.payoutAlert}
          onPress={() => navigate("/business-owner/payroll")}
        >
          <View style={styles.payoutAlertIcon}>
            <Icon name="credit-card" size={16} color={colors.primary[700]} />
          </View>
          <View style={styles.payoutAlertContent}>
            <Text style={styles.payoutAlertTitle}>
              {pendingPayouts.count} Pending Payout{pendingPayouts.count > 1 ? "s" : ""}
            </Text>
            <Text style={styles.payoutAlertText}>
              {formatCurrency(pendingPayouts.amount)} ready to process
            </Text>
          </View>
          <Icon name="chevron-right" size={16} color={colors.primary[600]} />
        </Pressable>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  greeting: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.background.primary,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.error[500],
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  notificationBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  errorBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.error[50],
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  analyticsBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  analyticsBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.background.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  analyticsBannerContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  analyticsBannerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[800],
  },
  analyticsBannerText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    marginTop: 2,
  },
  statsCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  statsCardPressable: {
    opacity: 1,
  },
  statsIcon: {
    width: 40,
    height: 40,
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
  statsSubValue: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
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
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  countBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  countBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  seeAllLink: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  quickAction: {
    alignItems: "center",
    width: "18%",
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
    position: "relative",
  },
  quickActionBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.error[500],
    minWidth: 18,
    height: 18,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },
  quickActionLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textAlign: "center",
  },
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  jobCardUnassigned: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning[500],
  },
  jobCardLeft: {
    alignItems: "center",
    marginRight: spacing.md,
    position: "relative",
  },
  jobCardTime: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
    minWidth: 60,
    textAlign: "center",
  },
  unassignedBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: colors.warning[500],
    justifyContent: "center",
    alignItems: "center",
  },
  unassignedBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },
  jobCardContent: {
    flex: 1,
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
  assignedTag: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  assignedTagText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginLeft: 4,
  },
  unassignedText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  jobCardSelfAssigned: {
    borderWidth: 2,
    borderColor: colors.warning[400],
    backgroundColor: colors.warning[50],
  },
  selfAssignedBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.warning[100],
    borderWidth: 2,
    borderColor: colors.warning[400],
    justifyContent: "center",
    alignItems: "center",
  },
  selfAssignedTag: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
  },
  selfAssignedTagText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    marginLeft: 4,
    fontWeight: typography.fontWeight.semibold,
  },
  jobCardPrice: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginLeft: spacing.md,
  },
  emptySection: {
    backgroundColor: colors.background.primary,
    padding: spacing.xl,
    borderRadius: radius.xl,
    alignItems: "center",
    ...shadows.sm,
  },
  emptySectionText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  emptySectionButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  emptySectionButtonText: {
    color: "#fff",
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  employeeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  employeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  employeeAvatarText: {
    fontSize: typography.fontSize.base,
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
  employeeStatus: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.warning[100],
    justifyContent: "center",
    alignItems: "center",
  },
  alertContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  alertTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
  },
  alertText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    marginTop: 2,
  },
  payoutAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  payoutAlertIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  payoutAlertContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  payoutAlertTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[800],
  },
  payoutAlertText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    marginTop: 2,
  },
  bottomPadding: {
    height: spacing["4xl"],
  },
  // Pending Payroll Card Styles
  pendingPayrollCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  pendingPayrollHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  pendingPayrollIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.success[100],
    justifyContent: "center",
    alignItems: "center",
  },
  pendingPayrollInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  pendingPayrollTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[800],
  },
  pendingPayrollSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    marginTop: 2,
  },
  pendingPayrollAmount: {
    backgroundColor: colors.success[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  pendingPayrollAmountText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },
  pendingPayrollSchedule: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.success[200],
  },
  pendingPayrollScheduleText: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },
  pendingPayrollEmployees: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  pendingPayrollEmployee: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  pendingPayrollEmployeeAvatar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.success[100],
    justifyContent: "center",
    alignItems: "center",
  },
  pendingPayrollEmployeeAvatarText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  pendingPayrollEmployeeName: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  pendingPayrollEmployeeAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  pendingPayrollMore: {
    textAlign: "center",
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    marginTop: spacing.xs,
  },
  pendingPayrollAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.success[200],
  },
  pendingPayrollActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[600],
    marginRight: spacing.xs,
  },
  // Elite Partner Status Card Styles
  largeBusinessCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.success[600],
    ...shadows.md,
  },
  largeBusinessHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  largeBusinessIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  largeBusinessBadge: {
    marginLeft: spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  largeBusinessBadgeText: {
    color: "#fff",
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1,
  },
  largeBusinessTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
    marginTop: spacing.sm,
  },
  largeBusinessSubtitle: {
    fontSize: typography.fontSize.base,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: spacing.xs,
  },
  largeBusinessPerks: {
    flexDirection: "row",
    marginTop: spacing.md,
    gap: spacing.lg,
  },
  perkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  perkText: {
    color: "#fff",
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  // Elite Partner Progress Card Styles (not yet qualified)
  elitePartnerCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.primary[100],
    ...shadows.sm,
  },
  elitePartnerHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  elitePartnerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  elitePartnerTitleContainer: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  elitePartnerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  elitePartnerSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  elitePartnerProgressSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  elitePartnerProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  elitePartnerProgressLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  elitePartnerProgressPercent: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.full,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: colors.primary[500],
    borderRadius: radius.full,
  },
  elitePartnerProgressHint: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    marginTop: spacing.sm,
    fontWeight: typography.fontWeight.medium,
  },
  elitePartnerProgressHintSubtle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
});

export default BusinessOwnerDashboard;
