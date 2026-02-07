import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import { formatCurrency } from "../../../services/formatters";
import { API_BASE } from "../../../services/config";

const EmployeeCard = ({ employee, pendingPayout, onMessage, isMessaging }) => {
  const navigate = useNavigate();
  const payoutAmount = pendingPayout?.payAmount || 0;
  const jobsToday = employee.todaysJobs || 0;

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.split(" ");
    return parts.length > 1
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  return (
    <View style={styles.employeeCard}>
      <View style={styles.employeeMain}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {getInitials(`${employee.firstName} ${employee.lastName}`)}
          </Text>
        </View>
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>
            {employee.firstName} {employee.lastName}
          </Text>
          <View style={styles.employeeStats}>
            {jobsToday > 0 ? (
              <View style={styles.statBadge}>
                <Icon name="calendar-check-o" size={12} color={colors.primary[600]} />
                <Text style={styles.statText}>{jobsToday} job{jobsToday > 1 ? "s" : ""} today</Text>
              </View>
            ) : (
              <View style={[styles.statBadge, styles.statBadgeIdle]}>
                <Icon name="clock-o" size={12} color={colors.neutral[500]} />
                <Text style={[styles.statText, { color: colors.neutral[500] }]}>No jobs today</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.employeeActions}>
        {payoutAmount > 0 && (
          <View style={styles.payoutBadge}>
            <Text style={styles.payoutText}>Owed {formatCurrency(payoutAmount)}</Text>
          </View>
        )}
        {employee.userId ? (
          <Pressable
            style={[styles.actionButton, isMessaging && styles.actionButtonDisabled]}
            onPress={() => onMessage(employee)}
            disabled={isMessaging}
          >
            <Icon name={isMessaging ? "spinner" : "comment"} size={14} color={colors.neutral[500]} />
          </Pressable>
        ) : (
          <View style={[styles.actionButton, styles.actionButtonDisabled]}>
            <Icon name="envelope-o" size={14} color={colors.neutral[300]} />
          </View>
        )}
      </View>
    </View>
  );
};

const MyTeamSection = ({ employees, pendingPayouts, state, onRefresh }) => {
  const navigate = useNavigate();
  const [messagingEmployee, setMessagingEmployee] = useState(null);

  // Create a map of employee ID to pending payout
  const payoutsByEmployee = {};
  pendingPayouts.forEach(payout => {
    const empId = payout.businessEmployeeId;
    if (!payoutsByEmployee[empId]) {
      payoutsByEmployee[empId] = { payAmount: 0 };
    }
    payoutsByEmployee[empId].payAmount += payout.payAmount || 0;
  });

  // Show only first 3 employees in the summary
  const displayedEmployees = employees.slice(0, 3);
  const remainingCount = Math.max(0, employees.length - 3);

  const handleMessage = async (employee) => {
    if (messagingEmployee) return; // Prevent double-tap

    setMessagingEmployee(employee.id);
    try {
      const response = await fetch(`${API_BASE}/messages/employee-conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.currentUser.token}`,
        },
        body: JSON.stringify({ employeeId: employee.id }),
      });

      const data = await response.json();
      if (response.ok && data.conversation) {
        navigate(`/messages/${data.conversation.id}`);
      } else {
        Alert.alert("Error", data.error || "Failed to start conversation");
      }
    } catch (err) {
      console.error("Error starting conversation:", err);
      Alert.alert("Error", "Failed to start conversation");
    } finally {
      setMessagingEmployee(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Icon name="users" size={16} color={colors.primary[600]} />
          <Text style={styles.sectionTitle}>My Team</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{employees.length}</Text>
          </View>
        </View>
        <Pressable
          style={styles.viewAllButton}
          onPress={() => navigate("/business-owner/employees")}
        >
          <Text style={styles.viewAllText}>Manage</Text>
          <Icon name="chevron-right" size={12} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Team Card */}
      <View style={styles.teamCard}>
        {employees.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="user-plus" size={28} color={colors.neutral[300]} />
            <Text style={styles.emptyStateText}>No team members yet</Text>
            <Pressable
              style={styles.inviteButton}
              onPress={() => navigate("/business-owner/employees")}
            >
              <Icon name="plus" size={12} color={colors.neutral[0]} />
              <Text style={styles.inviteButtonText}>Invite Employee</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Employee List */}
            {displayedEmployees.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                pendingPayout={payoutsByEmployee[employee.id]}
                onMessage={handleMessage}
                isMessaging={messagingEmployee === employee.id}
              />
            ))}

            {/* Show More */}
            {remainingCount > 0 && (
              <Pressable
                style={styles.showMoreButton}
                onPress={() => navigate("/business-owner/employees")}
              >
                <Text style={styles.showMoreText}>
                  +{remainingCount} more employee{remainingCount > 1 ? "s" : ""}
                </Text>
              </Pressable>
            )}

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <Pressable
                style={styles.quickActionButton}
                onPress={() => navigate("/business-owner/employees")}
              >
                <Icon name="user-plus" size={14} color={colors.primary[600]} />
                <Text style={styles.quickActionText}>Invite</Text>
              </Pressable>
              <View style={styles.actionDivider} />
              <Pressable
                style={styles.quickActionButton}
                onPress={() => navigate("/business-owner/assign")}
              >
                <Icon name="calendar-plus-o" size={14} color={colors.primary[600]} />
                <Text style={styles.quickActionText}>Assign Jobs</Text>
              </Pressable>
              <View style={styles.actionDivider} />
              <Pressable
                style={styles.quickActionButton}
                onPress={() => navigate("/business-owner/payroll")}
              >
                <Icon name="money" size={14} color={colors.primary[600]} />
                <Text style={styles.quickActionText}>Payroll</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
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
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  countBadge: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  countText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  viewAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  teamCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    ...shadows.sm,
    overflow: "hidden",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    gap: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  inviteButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  employeeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  employeeMain: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  employeeStats: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statBadgeIdle: {
    opacity: 0.7,
  },
  statText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
  },
  employeeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  payoutBadge: {
    backgroundColor: colors.warning[50],
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  payoutText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  showMoreButton: {
    padding: spacing.md,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  showMoreText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  quickActions: {
    flexDirection: "row",
    padding: spacing.md,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  quickActionText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  actionDivider: {
    width: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.xs,
  },
});

export default MyTeamSection;
