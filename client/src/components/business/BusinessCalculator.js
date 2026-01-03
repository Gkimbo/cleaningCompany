import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigate } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";
import { usePricing } from "../../context/PricingContext";

const BusinessCalculator = ({ state }) => {
  const navigate = useNavigate();
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

  // Parse inputs safely
  const parsedSingleJob = parseFloat(singleJobPrice) || 0;
  const parsedAvgJob = parseFloat(avgJobPrice) || 0;
  const parsedJobsPerWeek = parseFloat(jobsPerWeek) || 0;

  // Single job calculations
  const singleJobFee = parsedSingleJob * feePercent;
  const singleJobNet = parsedSingleJob * keepPercent;

  // Projection calculations
  const projections = useMemo(() => {
    const weeklyGross = parsedAvgJob * parsedJobsPerWeek;
    const weeklyFee = weeklyGross * feePercent;
    const weeklyNet = weeklyGross * keepPercent;

    const monthlyGross = weeklyGross * 4.33;
    const monthlyFee = monthlyGross * feePercent;
    const monthlyNet = monthlyGross * keepPercent;

    const yearlyGross = weeklyGross * 52;
    const yearlyFee = yearlyGross * feePercent;
    const yearlyNet = yearlyGross * keepPercent;

    return {
      weekly: { gross: weeklyGross, fee: weeklyFee, net: weeklyNet },
      monthly: { gross: monthlyGross, fee: monthlyFee, net: monthlyNet },
      yearly: { gross: yearlyGross, fee: yearlyFee, net: yearlyNet },
    };
  }, [parsedAvgJob, parsedJobsPerWeek, feePercent, keepPercent]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
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
            <View style={styles.divider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabelBold}>Your Earnings</Text>
              <Text style={styles.breakdownValueBold}>{formatCurrency(singleJobNet)}</Text>
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
                <Text style={styles.projectionAmount}>{formatCurrency(projections.weekly.gross)}</Text>
              </View>
              <View style={styles.projectionArrow}>
                <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
              </View>
              <View style={styles.projectionColumn}>
                <Text style={styles.projectionLabel}>Fee</Text>
                <Text style={styles.projectionAmountMuted}>-{formatCurrency(projections.weekly.fee)}</Text>
              </View>
              <View style={styles.projectionArrow}>
                <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
              </View>
              <View style={styles.projectionColumnHighlight}>
                <Text style={styles.projectionLabelHighlight}>Net</Text>
                <Text style={styles.projectionAmountHighlight}>{formatCurrency(projections.weekly.net)}</Text>
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
                <Text style={styles.projectionAmount}>{formatCurrency(projections.monthly.gross)}</Text>
              </View>
              <View style={styles.projectionArrow}>
                <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
              </View>
              <View style={styles.projectionColumn}>
                <Text style={styles.projectionLabel}>Fee</Text>
                <Text style={styles.projectionAmountMuted}>-{formatCurrency(projections.monthly.fee)}</Text>
              </View>
              <View style={styles.projectionArrow}>
                <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
              </View>
              <View style={[styles.projectionColumnHighlight, { backgroundColor: colors.secondary[50] }]}>
                <Text style={[styles.projectionLabelHighlight, { color: colors.secondary[600] }]}>Net</Text>
                <Text style={[styles.projectionAmountHighlight, { color: colors.secondary[700] }]}>
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
                <Text style={styles.projectionAmount}>{formatCurrency(projections.yearly.gross)}</Text>
              </View>
              <View style={styles.projectionArrow}>
                <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
              </View>
              <View style={styles.projectionColumn}>
                <Text style={styles.projectionLabel}>Fee</Text>
                <Text style={styles.projectionAmountMuted}>-{formatCurrency(projections.yearly.fee)}</Text>
              </View>
              <View style={styles.projectionArrow}>
                <Feather name="arrow-right" size={16} color={colors.text.tertiary} />
              </View>
              <View style={[styles.projectionColumnHighlight, { backgroundColor: colors.success[50] }]}>
                <Text style={[styles.projectionLabelHighlight, { color: colors.success[600] }]}>Net</Text>
                <Text style={[styles.projectionAmountHighlight, { color: colors.success[700] }]}>
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
              <Text style={styles.summaryStatValue}>{Math.round(parsedJobsPerWeek * 52)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Total Fees</Text>
              <Text style={styles.summaryStatValueMuted}>{formatCurrency(projections.yearly.fee)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Take Home</Text>
              <Text style={styles.summaryStatValueHighlight}>{formatCurrency(projections.yearly.net)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
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
  },
  projectionColumnHighlight: {
    alignItems: "center",
    flex: 1,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  projectionArrow: {
    paddingHorizontal: spacing.xs,
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

  bottomSpacer: {
    height: spacing["3xl"],
  },
});

export default BusinessCalculator;
