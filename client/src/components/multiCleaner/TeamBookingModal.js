/**
 * TeamBookingModal
 * Modal for business owners to book a multi-cleaner job with their team
 * Allows selecting themselves and/or employees to fill all slots
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import FetchData from "../../services/fetchRequests/fetchData";

const TeamBookingModal = ({
  visible,
  job,
  onBook,
  onClose,
  state,
}) => {
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [includeSelf, setIncludeSelf] = useState(true);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [teamData, setTeamData] = useState(null);
  const [error, setError] = useState(null);

  const slotsToFill = job?.remainingSlots || job?.totalCleanersRequired || 2;

  // Fetch available team members when modal opens
  const fetchTeam = useCallback(async () => {
    if (!visible || !job) return;

    setLoading(true);
    setError(null);

    try {
      const response = await FetchData.get(
        `/api/v1/business-owner/team-for-job?jobDate=${job.appointmentDate}`,
        state.currentUser.token
      );

      if (response.error) {
        setError(response.error);
      } else {
        setTeamData(response);
        // Auto-select self if Stripe is set up
        setIncludeSelf(response.selfHasStripeConnect);
      }
    } catch (err) {
      console.error("Error fetching team:", err);
      setError("Failed to load team members");
    } finally {
      setLoading(false);
    }
  }, [visible, job, state.currentUser.token]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedEmployees([]);
      setIncludeSelf(true);
      setError(null);
    }
  }, [visible]);

  const formatDate = (dateString) => {
    if (!dateString) return "TBD";
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const formatPrice = (amount) => {
    if (!amount) return "TBD";
    // Prices are stored in dollars
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const toggleEmployee = (employeeId) => {
    setSelectedEmployees((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      }
      return [...prev, employeeId];
    });
  };

  const selectedCount = (includeSelf ? 1 : 0) + selectedEmployees.length;
  const canBook = selectedCount === slotsToFill;

  const handleBook = async () => {
    if (!canBook) return;

    setBooking(true);
    setError(null);

    try {
      // Build team members array
      const teamMembers = [];

      if (includeSelf) {
        teamMembers.push({ type: "self" });
      }

      for (const empId of selectedEmployees) {
        teamMembers.push({
          type: "employee",
          businessEmployeeId: empId,
        });
      }

      const response = await FetchData.post(
        "/api/v1/multi-cleaner/book-as-team",
        {
          multiCleanerJobId: job.multiCleanerJobId || job.id,
          teamMembers,
        },
        state.currentUser.token
      );

      if (response.error) {
        setError(response.error);
        Alert.alert("Booking Failed", response.error);
      } else {
        Alert.alert(
          "Team Booked!",
          `Successfully booked ${teamMembers.length} team member${teamMembers.length > 1 ? "s" : ""} for this job.`,
          [
            {
              text: "OK",
              onPress: () => {
                if (onBook) onBook(response);
                onClose();
              },
            },
          ]
        );
      }
    } catch (err) {
      console.error("Error booking team:", err);
      setError("Failed to book team. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  if (!job) return null;

  const perCleanerEarnings = job.perCleanerEarnings || job.earningsPerCleaner || job.estimatedEarnings || 0;
  const totalJobPrice = job.totalJobPrice || 0;
  const estimatedHours = job.estimatedMinutes ? job.estimatedMinutes / 60 : null;

  // Calculate employee costs based on selected employees and their hourly rates
  const calculateProfitBreakdown = () => {
    let totalEmployeeCost = 0;
    const employeeBreakdown = [];

    // Calculate cost for selected employees
    for (const empId of selectedEmployees) {
      const emp = teamData?.employees?.find((e) => e.id === empId);
      if (emp && emp.hourlyRate && estimatedHours) {
        const cost = emp.hourlyRate * estimatedHours;
        totalEmployeeCost += cost;
        employeeBreakdown.push({
          name: `${emp.firstName} ${emp.lastName}`,
          hourlyRate: emp.hourlyRate,
          hours: estimatedHours,
          cost,
        });
      }
    }

    const businessOwnerProfit = totalJobPrice - totalEmployeeCost;

    // Only show breakdown if we have valid calculation data
    const hasEmployeesWithRates = employeeBreakdown.length > 0;

    return {
      totalJobPrice,
      totalEmployeeCost,
      businessOwnerProfit,
      employeeBreakdown,
      hasValidCalculation: estimatedHours && hasEmployeesWithRates,
      missingRates: selectedEmployees.length > 0 && !hasEmployeesWithRates,
    };
  };

  const profitBreakdown = calculateProfitBreakdown();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Book with Your Team</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color={colors.neutral[600]} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Loading team...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Job Summary */}
            <View style={styles.section}>
              <View style={styles.jobSummary}>
                <View style={styles.teamBadge}>
                  <Feather name="users" size={18} color={colors.primary[600]} />
                  <Text style={styles.teamBadgeText}>Team Clean</Text>
                </View>

                <View style={styles.jobDetails}>
                  <View style={styles.jobDetailRow}>
                    <Feather name="calendar" size={16} color={colors.text.secondary} />
                    <Text style={styles.jobDetailText}>{formatDate(job.appointmentDate)}</Text>
                  </View>
                  <View style={styles.jobDetailRow}>
                    <Feather name="map-pin" size={16} color={colors.text.secondary} />
                    <Text style={styles.jobDetailText} numberOfLines={1}>
                      {job.location || job.address || "Location TBD"}
                    </Text>
                  </View>
                </View>

                {/* Total Job Price */}
                <View style={styles.totalPriceBox}>
                  <Text style={styles.totalPriceLabel}>Total Job Price</Text>
                  <Text style={styles.totalPriceAmount}>{formatPrice(job.totalJobPrice)}</Text>
                </View>

                {/* Per Cleaner Breakdown */}
                <View style={styles.earningsBox}>
                  <Text style={styles.earningsLabel}>Your payout per cleaner</Text>
                  <Text style={styles.earningsAmount}>{formatPrice(perCleanerEarnings)}</Text>
                  {slotsToFill > 1 && (
                    <Text style={styles.totalPayoutHint}>
                      Total team payout: {formatPrice(perCleanerEarnings * slotsToFill)}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Slots Indicator */}
            <View style={styles.slotsSection}>
              <Text style={styles.slotsTitle}>
                Select {slotsToFill} Team Member{slotsToFill > 1 ? "s" : ""}
              </Text>
              <View style={styles.slotsIndicator}>
                <Text
                  style={[
                    styles.slotsCount,
                    canBook && styles.slotsCountComplete,
                  ]}
                >
                  {selectedCount} of {slotsToFill}
                </Text>
                <Text style={styles.slotsLabel}>selected</Text>
              </View>
            </View>

            {/* Include Myself Toggle */}
            <View style={styles.selfSection}>
              <View style={styles.selfRow}>
                <View style={styles.selfInfo}>
                  <View style={styles.selfAvatar}>
                    <Feather name="user" size={20} color={colors.primary[600]} />
                  </View>
                  <View>
                    <Text style={styles.selfName}>Include Myself</Text>
                    <Text style={styles.selfHint}>
                      {teamData?.selfHasStripeConnect
                        ? "You'll receive your share of the payout"
                        : "Set up Stripe to receive payouts"}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={includeSelf}
                  onValueChange={setIncludeSelf}
                  trackColor={{
                    false: colors.neutral[300],
                    true: colors.primary[400],
                  }}
                  thumbColor={includeSelf ? colors.primary[600] : colors.neutral[100]}
                />
              </View>
            </View>

            {/* Employees List */}
            <View style={styles.employeesSection}>
              <Text style={styles.employeesSectionTitle}>Your Team</Text>

              {teamData?.employees?.length === 0 ? (
                <View style={styles.noEmployees}>
                  <Feather name="users" size={32} color={colors.neutral[300]} />
                  <Text style={styles.noEmployeesText}>
                    No employees added yet
                  </Text>
                  <Text style={styles.noEmployeesHint}>
                    You can still book by including yourself
                  </Text>
                </View>
              ) : (
                teamData?.employees?.map((emp) => {
                  const isSelected = selectedEmployees.includes(emp.id);
                  const isDisabled = !emp.userId;

                  return (
                    <Pressable
                      key={emp.id}
                      style={[
                        styles.employeeRow,
                        isSelected && styles.employeeRowSelected,
                        isDisabled && styles.employeeRowDisabled,
                      ]}
                      onPress={() => !isDisabled && toggleEmployee(emp.id)}
                      disabled={isDisabled}
                    >
                      <View style={styles.employeeInfo}>
                        <View
                          style={[
                            styles.employeeAvatar,
                            isSelected && styles.employeeAvatarSelected,
                          ]}
                        >
                          <Text style={styles.employeeInitial}>
                            {emp.firstName?.charAt(0)?.toUpperCase() || "?"}
                          </Text>
                        </View>
                        <View style={styles.employeeDetails}>
                          <Text
                            style={[
                              styles.employeeName,
                              isDisabled && styles.employeeNameDisabled,
                            ]}
                          >
                            {emp.firstName} {emp.lastName}
                          </Text>
                          <View style={styles.employeeMetaRow}>
                            {emp.hourlyRate ? (
                              <View style={styles.hourlyRateBadge}>
                                <Feather name="dollar-sign" size={10} color={colors.primary[600]} />
                                <Text style={styles.hourlyRateText}>{emp.hourlyRate}/hr</Text>
                              </View>
                            ) : null}
                            {!emp.isAvailable && emp.unavailableReason ? (
                              <View style={styles.unavailableBadge}>
                                <Feather
                                  name="alert-circle"
                                  size={12}
                                  color={colors.warning[600]}
                                />
                                <Text style={styles.unavailableText}>
                                  {emp.unavailableReason}
                                </Text>
                              </View>
                            ) : emp.isAvailable ? (
                              <View style={styles.availableBadge}>
                                <Feather
                                  name="check-circle"
                                  size={12}
                                  color={colors.success[600]}
                                />
                                <Text style={styles.availableText}>Available</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxSelected,
                        ]}
                      >
                        {isSelected && (
                          <Feather name="check" size={16} color={colors.neutral[0]} />
                        )}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>

            {/* Profit Breakdown - shows when employees are selected */}
            {profitBreakdown.hasValidCalculation && (
              <View style={styles.profitSection}>
                <Text style={styles.profitSectionTitle}>Your Profit Breakdown</Text>

                <View style={styles.profitCard}>
                  {/* Total Job Earnings */}
                  <View style={styles.profitRow}>
                    <View style={styles.profitLabelRow}>
                      <Feather name="dollar-sign" size={14} color={colors.success[600]} />
                      <Text style={styles.profitLabel}>Total Job Earnings</Text>
                    </View>
                    <Text style={styles.profitValue}>{formatPrice(profitBreakdown.totalJobPrice)}</Text>
                  </View>

                  {/* Employee Costs */}
                  <View style={styles.profitDivider} />
                  <View style={styles.profitRow}>
                    <View style={styles.profitLabelRow}>
                      <Feather name="users" size={14} color={colors.warning[600]} />
                      <Text style={styles.profitLabel}>Employee Costs</Text>
                    </View>
                    <Text style={[styles.profitValue, styles.profitValueNegative]}>
                      -{formatPrice(profitBreakdown.totalEmployeeCost)}
                    </Text>
                  </View>

                  {/* Employee breakdown details */}
                  {profitBreakdown.employeeBreakdown.map((emp, index) => (
                    <View key={index} style={styles.employeeCostRow}>
                      <Text style={styles.employeeCostName}>{emp.name}</Text>
                      <Text style={styles.employeeCostCalc}>
                        ${emp.hourlyRate}/hr × {emp.hours.toFixed(1)}hrs = {formatPrice(emp.cost)}
                      </Text>
                    </View>
                  ))}

                  {/* Your Profit */}
                  <View style={styles.profitDivider} />
                  <View style={styles.profitRowTotal}>
                    <View style={styles.profitLabelRow}>
                      <Feather name="trending-up" size={16} color={colors.primary[600]} />
                      <Text style={styles.profitLabelTotal}>Your Profit</Text>
                    </View>
                    <Text style={[
                      styles.profitValueTotal,
                      profitBreakdown.businessOwnerProfit < 0 && styles.profitValueNegative
                    ]}>
                      {formatPrice(profitBreakdown.businessOwnerProfit)}
                    </Text>
                  </View>
                </View>

                {/* Estimated time note */}
                {estimatedHours && (
                  <Text style={styles.estimatedTimeNote}>
                    Based on estimated job time of {estimatedHours.toFixed(1)} hours
                  </Text>
                )}
              </View>
            )}

            {/* No hourly rate warning */}
            {profitBreakdown.missingRates && (
              <View style={styles.noRateWarning}>
                <Feather name="info" size={14} color={colors.neutral[500]} />
                <Text style={styles.noRateWarningText}>
                  Set hourly rates for your employees to see profit breakdown
                </Text>
              </View>
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color={colors.error[600]} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Spacer for bottom button */}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* Bottom Action */}
        {!loading && (
          <View style={styles.bottomAction}>
            <Pressable
              style={[
                styles.bookButton,
                !canBook && styles.bookButtonDisabled,
              ]}
              onPress={handleBook}
              disabled={!canBook || booking}
            >
              {booking ? (
                <ActivityIndicator size="small" color={colors.neutral[0]} />
              ) : (
                <>
                  <Feather name="check-circle" size={20} color={colors.neutral[0]} />
                  <Text style={styles.bookButtonText}>
                    {canBook
                      ? `Book Team (${selectedCount} member${selectedCount > 1 ? "s" : ""})`
                      : `Select ${slotsToFill - selectedCount} more`}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing["2xl"],
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginTop: spacing.lg,
  },
  jobSummary: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  teamBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  teamBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  jobDetails: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  jobDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  jobDetailText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    flex: 1,
  },
  totalPriceBox: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  totalPriceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },
  totalPriceAmount: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  earningsBox: {
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  earningsLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    marginBottom: spacing.xs,
  },
  earningsAmount: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  totalPayoutHint: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    marginTop: spacing.xs,
  },
  slotsSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  slotsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  slotsIndicator: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
  },
  slotsCount: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[600],
  },
  slotsCountComplete: {
    color: colors.success[600],
  },
  slotsLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  selfSection: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  selfRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selfInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  selfAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  selfName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  selfHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  employeesSection: {
    marginTop: spacing.md,
  },
  employeesSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  noEmployees: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  noEmployeesText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  noEmployeesHint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  employeeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  employeeRowSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  employeeRowDisabled: {
    opacity: 0.5,
  },
  employeeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  employeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral[200],
    justifyContent: "center",
    alignItems: "center",
  },
  employeeAvatarSelected: {
    backgroundColor: colors.primary[500],
  },
  employeeInitial: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[600],
  },
  employeeDetails: {
    flex: 1,
  },
  employeeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  employeeNameDisabled: {
    color: colors.text.tertiary,
  },
  availableBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  availableText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
  },
  unavailableBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  unavailableText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
  },
  employeeMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: 4,
  },
  hourlyRateBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    gap: 2,
  },
  hourlyRateText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.error[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
  },
  bottomAction: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    ...shadows.lg,
  },
  bookButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
  },
  bookButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  bookButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  // Profit breakdown styles
  profitSection: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  profitSectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  profitCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  profitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  profitRowTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  profitLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  profitLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  profitLabelTotal: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  profitValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  profitValueTotal: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  profitValueNegative: {
    color: colors.error[600],
  },
  profitDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.sm,
  },
  employeeCostRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xl,
  },
  employeeCostName: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  employeeCostCalc: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  estimatedTimeNote: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing.sm,
    fontStyle: "italic",
  },
  noRateWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  noRateWarningText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
});

export default TeamBookingModal;
