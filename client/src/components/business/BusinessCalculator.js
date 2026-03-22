import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";
import { usePricing } from "../../context/PricingContext";

import useSafeNavigation from "../../hooks/useSafeNavigation";
const BusinessCalculator = ({ state }) => {
  const { goBack } = useSafeNavigation();
  const { pricing } = usePricing();

  // Determine fee based on user type
  const isOwner = state?.account === "owner";
  const isBusinessOwner = state?.isBusinessOwner;

  // Business owners and platform owners use the businessOwnerFeePercent
  const feePercent = (isOwner || isBusinessOwner)
    ? (pricing?.platform?.businessOwnerFeePercent || 0.10)
    : (pricing?.platform?.feePercent || 0.10);

  const keepPercent = 1 - feePercent;

  // Calculator inputs
  const [singleJobPrice, setSingleJobPrice] = useState("150");
  const [avgJobPrice, setAvgJobPrice] = useState("150");
  const [jobsPerWeek, setJobsPerWeek] = useState("10");

  // Employee pay settings
  const [employeePayEnabled, setEmployeePayEnabled] = useState(false);
  const [employeePayType, setEmployeePayType] = useState("hourly"); // "hourly", "perJob", "percentage"
  const [hourlyRate, setHourlyRate] = useState("25");
  const [hoursPerJob, setHoursPerJob] = useState("1.5");
  const [amountPerJob, setAmountPerJob] = useState("50");
  const [percentageOfJob, setPercentageOfJob] = useState("50");

  // Parse inputs safely
  const parsedSingleJob = parseFloat(singleJobPrice) || 0;
  const parsedAvgJob = parseFloat(avgJobPrice) || 0;
  const parsedJobsPerWeek = parseFloat(jobsPerWeek) || 0;
  const parsedHourlyRate = parseFloat(hourlyRate) || 0;
  const parsedHoursPerJob = parseFloat(hoursPerJob) || 0;
  const parsedAmountPerJob = parseFloat(amountPerJob) || 0;
  const parsedPercentageOfJob = parseFloat(percentageOfJob) || 0;

  // Calculate employee pay per job based on pay type
  const calculateEmployeePay = useCallback((jobPrice) => {
    if (!employeePayEnabled) return 0;
    switch (employeePayType) {
      case "hourly":
        return parsedHourlyRate * parsedHoursPerJob;
      case "perJob":
        return parsedAmountPerJob;
      case "percentage":
        return jobPrice * (parsedPercentageOfJob / 100);
      default:
        return 0;
    }
  }, [employeePayEnabled, employeePayType, parsedHourlyRate, parsedHoursPerJob, parsedAmountPerJob, parsedPercentageOfJob]);

  // Single job calculations
  const singleJobFee = parsedSingleJob * feePercent;
  const singleJobEmployeePay = calculateEmployeePay(parsedSingleJob);
  const singleJobNet = parsedSingleJob * keepPercent - singleJobEmployeePay;

  // Projection calculations
  const projections = useMemo(() => {
    const employeePayPerJob = calculateEmployeePay(parsedAvgJob);

    const weeklyGross = parsedAvgJob * parsedJobsPerWeek;
    const weeklyFee = weeklyGross * feePercent;
    const weeklyEmployeePay = employeePayPerJob * parsedJobsPerWeek;
    const weeklyNet = weeklyGross * keepPercent - weeklyEmployeePay;

    const monthlyGross = weeklyGross * 4.33;
    const monthlyFee = monthlyGross * feePercent;
    const monthlyEmployeePay = weeklyEmployeePay * 4.33;
    const monthlyNet = monthlyGross * keepPercent - monthlyEmployeePay;

    const yearlyGross = weeklyGross * 52;
    const yearlyFee = yearlyGross * feePercent;
    const yearlyEmployeePay = weeklyEmployeePay * 52;
    const yearlyNet = yearlyGross * keepPercent - yearlyEmployeePay;

    return {
      weekly: { gross: weeklyGross, fee: weeklyFee, employeePay: weeklyEmployeePay, net: weeklyNet },
      monthly: { gross: monthlyGross, fee: monthlyFee, employeePay: monthlyEmployeePay, net: monthlyNet },
      yearly: { gross: yearlyGross, fee: yearlyFee, employeePay: yearlyEmployeePay, net: yearlyNet },
    };
  }, [parsedAvgJob, parsedJobsPerWeek, feePercent, keepPercent, calculateEmployeePay]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goBack()}>
          <Feather name="arrow-left" size={20} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Earnings Calculator</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Fee Info Banner */}
        <View style={styles.feeBanner}>
          <View style={styles.feeBannerContent}>
            <Feather name="percent" size={20} color={colors.primary[600]} />
            <View style={styles.feeBannerText}>
              <Text style={styles.feeBannerTitle}>
                Your Platform Fee: {Math.round(feePercent * 100)}%
              </Text>
              <Text style={styles.feeBannerSubtitle}>
                You keep {Math.round(keepPercent * 100)}% of every job
              </Text>
            </View>
          </View>
        </View>

        {/* Employee Pay Section */}
        <View style={styles.section}>
          <View style={styles.employeePayHeader}>
            <View style={styles.employeePayTitleRow}>
              <Feather name="users" size={20} color={colors.secondary[600]} />
              <Text style={styles.sectionTitle}>Employee Pay</Text>
            </View>
            <Switch
              value={employeePayEnabled}
              onValueChange={setEmployeePayEnabled}
              trackColor={{ false: colors.neutral[300], true: colors.secondary[400] }}
              thumbColor={employeePayEnabled ? colors.secondary[600] : colors.neutral[100]}
            />
          </View>

          {employeePayEnabled && (
            <View style={styles.employeePayContent}>
              {/* Pay Type Selector */}
              <Text style={styles.inputLabel}>Pay Type</Text>
              <View style={styles.payTypeSelector}>
                <Pressable
                  style={[
                    styles.payTypeOption,
                    employeePayType === "hourly" && styles.payTypeOptionActive,
                  ]}
                  onPress={() => setEmployeePayType("hourly")}
                >
                  <Feather
                    name="clock"
                    size={16}
                    color={employeePayType === "hourly" ? colors.neutral[0] : colors.text.secondary}
                  />
                  <Text
                    style={[
                      styles.payTypeText,
                      employeePayType === "hourly" && styles.payTypeTextActive,
                    ]}
                  >
                    Per Hour
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.payTypeOption,
                    employeePayType === "perJob" && styles.payTypeOptionActive,
                  ]}
                  onPress={() => setEmployeePayType("perJob")}
                >
                  <Feather
                    name="briefcase"
                    size={16}
                    color={employeePayType === "perJob" ? colors.neutral[0] : colors.text.secondary}
                  />
                  <Text
                    style={[
                      styles.payTypeText,
                      employeePayType === "perJob" && styles.payTypeTextActive,
                    ]}
                  >
                    Per Job
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.payTypeOption,
                    employeePayType === "percentage" && styles.payTypeOptionActive,
                  ]}
                  onPress={() => setEmployeePayType("percentage")}
                >
                  <Feather
                    name="percent"
                    size={16}
                    color={employeePayType === "percentage" ? colors.neutral[0] : colors.text.secondary}
                  />
                  <Text
                    style={[
                      styles.payTypeText,
                      employeePayType === "percentage" && styles.payTypeTextActive,
                    ]}
                  >
                    % of Job
                  </Text>
                </Pressable>
              </View>

              {/* Hourly Rate Inputs */}
              {employeePayType === "hourly" && (
                <View style={styles.inputRow}>
                  <View style={styles.inputGroupHalf}>
                    <Text style={styles.inputLabel}>Hourly Rate ($)</Text>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputPrefix}>$</Text>
                      <TextInput
                        style={styles.input}
                        value={hourlyRate}
                        onChangeText={setHourlyRate}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.text.tertiary}
                      />
                    </View>
                  </View>
                  <View style={styles.inputGroupHalf}>
                    <Text style={styles.inputLabel}>Hours/Job</Text>
                    <View style={styles.inputWrapper}>
                      <Feather name="clock" size={16} color={colors.text.tertiary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        value={hoursPerJob}
                        onChangeText={setHoursPerJob}
                        keyboardType="numeric"
                        placeholder="1.5"
                        placeholderTextColor={colors.text.tertiary}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Per Job Amount Input */}
              {employeePayType === "perJob" && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount Per Job ($)</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputPrefix}>$</Text>
                    <TextInput
                      style={styles.input}
                      value={amountPerJob}
                      onChangeText={setAmountPerJob}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>
                </View>
              )}

              {/* Percentage Input */}
              {employeePayType === "percentage" && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Percentage of Job (%)</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      value={percentageOfJob}
                      onChangeText={setPercentageOfJob}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.text.tertiary}
                    />
                    <Text style={styles.inputSuffix}>%</Text>
                  </View>
                </View>
              )}

              {/* Employee Pay Summary */}
              <View style={styles.employeePaySummary}>
                <Feather name="info" size={14} color={colors.secondary[600]} />
                <Text style={styles.employeePaySummaryText}>
                  {employeePayType === "hourly" && `$${parsedHourlyRate}/hr × ${parsedHoursPerJob} hrs = `}
                  {employeePayType === "perJob" && "Fixed amount: "}
                  {employeePayType === "percentage" && `${parsedPercentageOfJob}% of job = `}
                  <Text style={styles.employeePaySummaryAmount}>
                    {formatCurrency(calculateEmployeePay(parsedAvgJob))}/job
                  </Text>
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Single Job Calculator */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Single Job Breakdown</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Job Price ($)</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputPrefix}>$</Text>
              <TextInput
                style={styles.input}
                value={singleJobPrice}
                onChangeText={setSingleJobPrice}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.text.tertiary}
              />
            </View>
          </View>

          <View style={styles.breakdownCard}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Gross Amount</Text>
              <Text style={styles.breakdownValue}>{formatCurrency(parsedSingleJob)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabelMuted}>
                Platform Fee ({Math.round(feePercent * 100)}%)
              </Text>
              <Text style={styles.breakdownValueMuted}>-{formatCurrency(singleJobFee)}</Text>
            </View>
            {employeePayEnabled && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelMuted}>
                  Employee Pay
                </Text>
                <Text style={styles.breakdownValueMuted}>-{formatCurrency(singleJobEmployeePay)}</Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabelBold}>Your Earnings</Text>
              <Text style={[styles.breakdownValueBold, singleJobNet < 0 && styles.breakdownValueNegative]}>
                {formatCurrency(singleJobNet)}
              </Text>
            </View>
          </View>
        </View>

        {/* Projections Calculator */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings Projections</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputGroupHalf}>
              <Text style={styles.inputLabel}>Avg. Job Price ($)</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputPrefix}>$</Text>
                <TextInput
                  style={styles.input}
                  value={avgJobPrice}
                  onChangeText={setAvgJobPrice}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
            </View>

            <View style={styles.inputGroupHalf}>
              <Text style={styles.inputLabel}>Jobs Per Week</Text>
              <View style={styles.inputWrapper}>
                <Feather name="briefcase" size={16} color={colors.text.tertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={jobsPerWeek}
                  onChangeText={setJobsPerWeek}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
            </View>
          </View>

          {/* Weekly Card */}
          <View style={styles.projectionCard}>
            <View style={styles.projectionHeader}>
              <Feather name="calendar" size={18} color={colors.primary[600]} />
              <Text style={styles.projectionTitle}>Weekly</Text>
            </View>
            <View style={styles.projectionContent}>
              <View style={styles.projectionColumn}>
                <Text style={styles.projectionLabel}>Gross</Text>
                <Text style={styles.projectionAmount} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(projections.weekly.gross)}
                </Text>
              </View>
              <View style={styles.projectionArrow}>
                <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
              </View>
              <View style={styles.projectionColumn}>
                <Text style={styles.projectionLabel}>Fee</Text>
                <Text style={styles.projectionAmountMuted} numberOfLines={1} adjustsFontSizeToFit>
                  -{formatCurrency(projections.weekly.fee)}
                </Text>
              </View>
              {employeePayEnabled && (
                <>
                  <View style={styles.projectionArrow}>
                    <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
                  </View>
                  <View style={styles.projectionColumn}>
                    <Text style={styles.projectionLabel}>Payroll</Text>
                    <Text style={styles.projectionAmountMuted} numberOfLines={1} adjustsFontSizeToFit>
                      -{formatCurrency(projections.weekly.employeePay)}
                    </Text>
                  </View>
                </>
              )}
              <View style={styles.projectionArrow}>
                <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
              </View>
              <View style={styles.projectionColumnHighlight}>
                <Text style={styles.projectionLabelHighlight}>Net</Text>
                <Text
                  style={[styles.projectionAmountHighlight, projections.weekly.net < 0 && styles.projectionAmountNegative]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatCurrency(projections.weekly.net)}
                </Text>
              </View>
            </View>
          </View>

          {/* Monthly Card */}
          <View style={styles.projectionCard}>
            <View style={styles.projectionHeader}>
              <Feather name="calendar" size={18} color={colors.secondary[600]} />
              <Text style={[styles.projectionTitle, { color: colors.secondary[700] }]}>Monthly</Text>
              <Text style={styles.projectionNote}>(4.33 weeks)</Text>
            </View>
            <View style={styles.projectionContent}>
              <View style={styles.projectionColumn}>
                <Text style={styles.projectionLabel}>Gross</Text>
                <Text style={styles.projectionAmount} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(projections.monthly.gross)}
                </Text>
              </View>
              <View style={styles.projectionArrow}>
                <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
              </View>
              <View style={styles.projectionColumn}>
                <Text style={styles.projectionLabel}>Fee</Text>
                <Text style={styles.projectionAmountMuted} numberOfLines={1} adjustsFontSizeToFit>
                  -{formatCurrency(projections.monthly.fee)}
                </Text>
              </View>
              {employeePayEnabled && (
                <>
                  <View style={styles.projectionArrow}>
                    <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
                  </View>
                  <View style={styles.projectionColumn}>
                    <Text style={styles.projectionLabel}>Payroll</Text>
                    <Text style={styles.projectionAmountMuted} numberOfLines={1} adjustsFontSizeToFit>
                      -{formatCurrency(projections.monthly.employeePay)}
                    </Text>
                  </View>
                </>
              )}
              <View style={styles.projectionArrow}>
                <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
              </View>
              <View style={[styles.projectionColumnHighlight, { backgroundColor: colors.secondary[50] }]}>
                <Text style={[styles.projectionLabelHighlight, { color: colors.secondary[600] }]}>Net</Text>
                <Text
                  style={[styles.projectionAmountHighlight, { color: colors.secondary[700] }, projections.monthly.net < 0 && styles.projectionAmountNegative]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatCurrency(projections.monthly.net)}
                </Text>
              </View>
            </View>
          </View>

          {/* Yearly Card */}
          <View style={[styles.projectionCard, styles.projectionCardYearly]}>
            <View style={styles.projectionHeader}>
              <Feather name="trending-up" size={18} color={colors.success[600]} />
              <Text style={[styles.projectionTitle, { color: colors.success[700] }]}>Yearly</Text>
              <Text style={styles.projectionNote}>(52 weeks)</Text>
            </View>
            <View style={styles.projectionContent}>
              <View style={styles.projectionColumn}>
                <Text style={styles.projectionLabel}>Gross</Text>
                <Text style={styles.projectionAmount} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(projections.yearly.gross)}
                </Text>
              </View>
              <View style={styles.projectionArrow}>
                <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
              </View>
              <View style={styles.projectionColumn}>
                <Text style={styles.projectionLabel}>Fee</Text>
                <Text style={styles.projectionAmountMuted} numberOfLines={1} adjustsFontSizeToFit>
                  -{formatCurrency(projections.yearly.fee)}
                </Text>
              </View>
              {employeePayEnabled && (
                <>
                  <View style={styles.projectionArrow}>
                    <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
                  </View>
                  <View style={styles.projectionColumn}>
                    <Text style={styles.projectionLabel}>Payroll</Text>
                    <Text style={styles.projectionAmountMuted} numberOfLines={1} adjustsFontSizeToFit>
                      -{formatCurrency(projections.yearly.employeePay)}
                    </Text>
                  </View>
                </>
              )}
              <View style={styles.projectionArrow}>
                <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
              </View>
              <View style={[styles.projectionColumnHighlight, { backgroundColor: colors.success[50] }]}>
                <Text style={[styles.projectionLabelHighlight, { color: colors.success[600] }]}>Net</Text>
                <Text
                  style={[styles.projectionAmountHighlight, { color: colors.success[700] }, projections.yearly.net < 0 && styles.projectionAmountNegative]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatCurrency(projections.yearly.net)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Feather name="award" size={24} color={colors.primary[600]} />
            <Text style={styles.summaryTitle}>Annual Summary</Text>
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Total Jobs</Text>
              <Text style={styles.summaryStatValue} numberOfLines={1} adjustsFontSizeToFit>
                {Math.round(parsedJobsPerWeek * 52)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Platform Fees</Text>
              <Text style={styles.summaryStatValueMuted} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrency(projections.yearly.fee)}
              </Text>
            </View>
            {employeePayEnabled && (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatLabel}>Payroll</Text>
                  <Text style={styles.summaryStatValueMuted} numberOfLines={1} adjustsFontSizeToFit>
                    {formatCurrency(projections.yearly.employeePay)}
                  </Text>
                </View>
              </>
            )}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Take Home</Text>
              <Text
                style={[styles.summaryStatValueHighlight, projections.yearly.net < 0 && styles.summaryStatValueNegative]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatCurrency(projections.yearly.net)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  placeholder: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },

  // Fee Banner
  feeBanner: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  feeBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  feeBannerText: {
    flex: 1,
  },
  feeBannerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  feeBannerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    marginTop: 2,
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  // Employee Pay Section
  employeePayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  employeePayTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  employeePayContent: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  payTypeSelector: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  payTypeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  payTypeOptionActive: {
    backgroundColor: colors.secondary[600],
    borderColor: colors.secondary[600],
  },
  payTypeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  payTypeTextActive: {
    color: colors.neutral[0],
  },
  employeePaySummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.secondary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  employeePaySummaryText: {
    fontSize: typography.fontSize.sm,
    color: colors.secondary[700],
  },
  employeePaySummaryAmount: {
    fontWeight: typography.fontWeight.bold,
    color: colors.secondary[700],
  },
  inputSuffix: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },

  // Input Groups
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputGroupHalf: {
    flex: 1,
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.medium,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  inputPrefix: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  inputIcon: {
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },

  // Breakdown Card
  breakdownCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  breakdownLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  breakdownLabelMuted: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  breakdownLabelBold: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  breakdownValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  breakdownValueMuted: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
  },
  breakdownValueBold: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  breakdownValueNegative: {
    color: colors.error[600],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.sm,
  },

  // Projection Cards
  projectionCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  projectionCardYearly: {
    borderWidth: 2,
    borderColor: colors.success[200],
    ...shadows.md,
  },
  projectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  projectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  projectionNote: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  projectionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  projectionColumn: {
    alignItems: "center",
    flex: 1,
    minWidth: 50,
  },
  projectionColumnHighlight: {
    alignItems: "center",
    flex: 1.5,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minWidth: 70,
  },
  projectionArrow: {
    paddingHorizontal: 2,
  },
  projectionLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  projectionLabelHighlight: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
    marginBottom: 2,
  },
  projectionAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  projectionAmountMuted: {
    fontSize: typography.fontSize.sm,
    color: colors.error[500],
  },
  projectionAmountHighlight: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  projectionAmountNegative: {
    color: colors.error[600],
  },

  // Summary Card
  summaryCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadows.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  summaryStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryStat: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
  },
  summaryStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  summaryStatValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  summaryStatValueMuted: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.error[600],
  },
  summaryStatValueHighlight: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  summaryStatValueNegative: {
    color: colors.error[600],
  },

  bottomSpacer: {
    height: spacing["3xl"],
  },
});

export default BusinessCalculator;
