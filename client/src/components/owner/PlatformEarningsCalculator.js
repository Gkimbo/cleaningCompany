import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";
import { usePricing } from "../../context/PricingContext";
import useSafeNavigation from "../../hooks/useSafeNavigation";
import { API_BASE } from "../../services/config";

const PlatformEarningsCalculator = ({ state }) => {
  const { goBack } = useSafeNavigation();
  const { pricing } = usePricing();

  // Platform fee percentages
  const cleanerFeePercent = pricing?.platform?.feePercent || 0.10;
  const businessOwnerFeePercent = pricing?.platform?.businessOwnerFeePercent || 0.10;

  // Real platform stats (fetched from API)
  const [loading, setLoading] = useState(true);
  const [platformStats, setPlatformStats] = useState(null);

  // Calculator inputs with defaults
  const [avgJobPrice, setAvgJobPrice] = useState("150");
  const [jobsPerDay, setJobsPerDay] = useState("20");
  const [cleanerSplit, setCleanerSplit] = useState("70"); // % of jobs from regular cleaners
  const [growthRate, setGrowthRate] = useState("10"); // % monthly growth

  // Fetch real platform stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE}/owner-dashboard/quick-stats`, {
          headers: {
            Authorization: `Bearer ${state?.currentUser?.token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setPlatformStats(data);
          // Update inputs with real data if available
          if (data.avgJobPrice) {
            setAvgJobPrice(Math.round(data.avgJobPrice).toString());
          }
        }
      } catch (err) {
        console.error("Failed to fetch platform stats:", err);
      } finally {
        setLoading(false);
      }
    };

    if (state?.currentUser?.token) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [state?.currentUser?.token]);

  // Parse inputs safely
  const parsedAvgJob = parseFloat(avgJobPrice) || 0;
  const parsedJobsPerDay = parseFloat(jobsPerDay) || 0;
  const parsedCleanerSplit = parseFloat(cleanerSplit) || 70;
  const parsedGrowthRate = parseFloat(growthRate) || 0;

  // Calculate weighted average fee based on cleaner mix
  const cleanerPortion = parsedCleanerSplit / 100;
  const businessPortion = 1 - cleanerPortion;
  const weightedFeePercent = (cleanerFeePercent * cleanerPortion) + (businessOwnerFeePercent * businessPortion);

  // Revenue calculations
  const calculations = useMemo(() => {
    // Per-job platform revenue
    const revenuePerJob = parsedAvgJob * weightedFeePercent;

    // Daily
    const dailyJobs = parsedJobsPerDay;
    const dailyGross = parsedAvgJob * dailyJobs;
    const dailyRevenue = revenuePerJob * dailyJobs;

    // Weekly (7 days, but realistic is 5-6 working days)
    const workingDaysPerWeek = 6;
    const weeklyJobs = dailyJobs * workingDaysPerWeek;
    const weeklyGross = dailyGross * workingDaysPerWeek;
    const weeklyRevenue = dailyRevenue * workingDaysPerWeek;

    // Monthly (4.33 weeks)
    const monthlyJobs = weeklyJobs * 4.33;
    const monthlyGross = weeklyGross * 4.33;
    const monthlyRevenue = weeklyRevenue * 4.33;

    // Yearly (52 weeks)
    const yearlyJobs = weeklyJobs * 52;
    const yearlyGross = weeklyGross * 52;
    const yearlyRevenue = weeklyRevenue * 52;

    // Growth projections (monthly compounding)
    const monthlyGrowthMultiplier = 1 + (parsedGrowthRate / 100);
    const year1Revenue = monthlyRevenue * 12; // First year without growth
    const year2Revenue = year1Revenue * Math.pow(monthlyGrowthMultiplier, 12);
    const year3Revenue = year2Revenue * Math.pow(monthlyGrowthMultiplier, 12);

    return {
      perJob: { gross: parsedAvgJob, revenue: revenuePerJob },
      daily: { jobs: dailyJobs, gross: dailyGross, revenue: dailyRevenue },
      weekly: { jobs: weeklyJobs, gross: weeklyGross, revenue: weeklyRevenue },
      monthly: { jobs: monthlyJobs, gross: monthlyGross, revenue: monthlyRevenue },
      yearly: { jobs: yearlyJobs, gross: yearlyGross, revenue: yearlyRevenue },
      growth: {
        year1: year1Revenue,
        year2: year2Revenue,
        year3: year3Revenue,
      },
    };
  }, [parsedAvgJob, parsedJobsPerDay, weightedFeePercent, parsedGrowthRate]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading platform data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goBack()}>
          <Feather name="arrow-left" size={20} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Platform Revenue Calculator</Text>
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
            <Feather name="trending-up" size={24} color={colors.success[600]} />
            <View style={styles.feeBannerText}>
              <Text style={styles.feeBannerTitle}>Platform Fee Structure</Text>
              <Text style={styles.feeBannerSubtitle}>
                Cleaners: {Math.round(cleanerFeePercent * 100)}% | Business Owners: {Math.round(businessOwnerFeePercent * 100)}%
              </Text>
              <Text style={styles.feeBannerNote}>
                Weighted Avg: {(weightedFeePercent * 100).toFixed(1)}% (based on your cleaner mix)
              </Text>
            </View>
          </View>
        </View>

        {/* Input Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Parameters</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputGroupHalf}>
              <Text style={styles.inputLabel}>Avg Job Price ($)</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputPrefix}>$</Text>
                <TextInput
                  style={styles.input}
                  value={avgJobPrice}
                  onChangeText={setAvgJobPrice}
                  keyboardType="numeric"
                  placeholder="150"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
            </View>

            <View style={styles.inputGroupHalf}>
              <Text style={styles.inputLabel}>Jobs Per Day</Text>
              <View style={styles.inputWrapper}>
                <Feather name="briefcase" size={16} color={colors.text.tertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={jobsPerDay}
                  onChangeText={setJobsPerDay}
                  keyboardType="numeric"
                  placeholder="20"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputGroupHalf}>
              <Text style={styles.inputLabel}>Regular Cleaners (%)</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={cleanerSplit}
                  onChangeText={setCleanerSplit}
                  keyboardType="numeric"
                  placeholder="70"
                  placeholderTextColor={colors.text.tertiary}
                />
                <Text style={styles.inputSuffix}>%</Text>
              </View>
            </View>

            <View style={styles.inputGroupHalf}>
              <Text style={styles.inputLabel}>Monthly Growth</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={growthRate}
                  onChangeText={setGrowthRate}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor={colors.text.tertiary}
                />
                <Text style={styles.inputSuffix}>%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Per-Job Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Per-Job Revenue</Text>
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Job Price</Text>
              <Text style={styles.breakdownValue}>{formatCurrency(calculations.perJob.gross)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabelMuted}>
                Platform Fee ({(weightedFeePercent * 100).toFixed(1)}%)
              </Text>
              <Text style={styles.breakdownValueHighlight}>+{formatCurrency(calculations.perJob.revenue)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabelBold}>Your Revenue</Text>
              <Text style={styles.breakdownValueBold}>
                {formatCurrency(calculations.perJob.revenue)}
              </Text>
            </View>
          </View>
        </View>

        {/* Revenue Projections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenue Projections</Text>

          {/* Daily */}
          <View style={styles.projectionCard}>
            <View style={styles.projectionHeader}>
              <Feather name="sun" size={18} color={colors.warning[600]} />
              <Text style={[styles.projectionTitle, { color: colors.warning[700] }]}>Daily</Text>
              <Text style={styles.projectionBadge}>{formatNumber(calculations.daily.jobs)} jobs</Text>
            </View>
            <View style={styles.projectionStats}>
              <View style={styles.projectionStat}>
                <Text style={styles.projectionStatLabel}>Total Bookings</Text>
                <Text style={styles.projectionStatValue}>{formatCurrency(calculations.daily.gross)}</Text>
              </View>
              <View style={styles.projectionStatDivider} />
              <View style={styles.projectionStat}>
                <Text style={styles.projectionStatLabel}>Platform Revenue</Text>
                <Text style={styles.projectionStatValueHighlight}>{formatCurrency(calculations.daily.revenue)}</Text>
              </View>
            </View>
          </View>

          {/* Weekly */}
          <View style={styles.projectionCard}>
            <View style={styles.projectionHeader}>
              <Feather name="calendar" size={18} color={colors.primary[600]} />
              <Text style={styles.projectionTitle}>Weekly</Text>
              <Text style={styles.projectionBadge}>{formatNumber(calculations.weekly.jobs)} jobs</Text>
            </View>
            <View style={styles.projectionStats}>
              <View style={styles.projectionStat}>
                <Text style={styles.projectionStatLabel}>Total Bookings</Text>
                <Text style={styles.projectionStatValue}>{formatCurrency(calculations.weekly.gross)}</Text>
              </View>
              <View style={styles.projectionStatDivider} />
              <View style={styles.projectionStat}>
                <Text style={styles.projectionStatLabel}>Platform Revenue</Text>
                <Text style={styles.projectionStatValueHighlight}>{formatCurrency(calculations.weekly.revenue)}</Text>
              </View>
            </View>
          </View>

          {/* Monthly */}
          <View style={styles.projectionCard}>
            <View style={styles.projectionHeader}>
              <Feather name="calendar" size={18} color={colors.secondary[600]} />
              <Text style={[styles.projectionTitle, { color: colors.secondary[700] }]}>Monthly</Text>
              <Text style={styles.projectionBadge}>{formatNumber(calculations.monthly.jobs)} jobs</Text>
            </View>
            <View style={styles.projectionStats}>
              <View style={styles.projectionStat}>
                <Text style={styles.projectionStatLabel}>Total Bookings</Text>
                <Text style={styles.projectionStatValue}>{formatCurrency(calculations.monthly.gross)}</Text>
              </View>
              <View style={styles.projectionStatDivider} />
              <View style={styles.projectionStat}>
                <Text style={styles.projectionStatLabel}>Platform Revenue</Text>
                <Text style={styles.projectionStatValueHighlight}>{formatCurrency(calculations.monthly.revenue)}</Text>
              </View>
            </View>
          </View>

          {/* Yearly */}
          <View style={[styles.projectionCard, styles.projectionCardYearly]}>
            <View style={styles.projectionHeader}>
              <Feather name="trending-up" size={18} color={colors.success[600]} />
              <Text style={[styles.projectionTitle, { color: colors.success[700] }]}>Yearly</Text>
              <Text style={styles.projectionBadge}>{formatNumber(calculations.yearly.jobs)} jobs</Text>
            </View>
            <View style={styles.projectionStats}>
              <View style={styles.projectionStat}>
                <Text style={styles.projectionStatLabel}>Total Bookings</Text>
                <Text style={styles.projectionStatValue}>{formatCurrency(calculations.yearly.gross)}</Text>
              </View>
              <View style={styles.projectionStatDivider} />
              <View style={styles.projectionStat}>
                <Text style={styles.projectionStatLabel}>Platform Revenue</Text>
                <Text style={[styles.projectionStatValueHighlight, { color: colors.success[600] }]}>
                  {formatCurrency(calculations.yearly.revenue)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Growth Projections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Growth Projections</Text>
          <Text style={styles.sectionSubtitle}>
            Based on {parsedGrowthRate}% monthly growth rate
          </Text>

          <View style={styles.growthCard}>
            <View style={styles.growthRow}>
              <View style={styles.growthItem}>
                <Text style={styles.growthLabel}>Year 1</Text>
                <Text style={styles.growthValue}>{formatCurrency(calculations.growth.year1)}</Text>
                <Text style={styles.growthNote}>Current rate</Text>
              </View>
              <View style={styles.growthArrow}>
                <Feather name="chevron-right" size={20} color={colors.text.tertiary} />
              </View>
              <View style={styles.growthItem}>
                <Text style={styles.growthLabel}>Year 2</Text>
                <Text style={[styles.growthValue, { color: colors.secondary[600] }]}>
                  {formatCurrency(calculations.growth.year2)}
                </Text>
                <Text style={styles.growthNote}>
                  +{Math.round((calculations.growth.year2 / calculations.growth.year1 - 1) * 100)}%
                </Text>
              </View>
              <View style={styles.growthArrow}>
                <Feather name="chevron-right" size={20} color={colors.text.tertiary} />
              </View>
              <View style={styles.growthItem}>
                <Text style={styles.growthLabel}>Year 3</Text>
                <Text style={[styles.growthValue, { color: colors.success[600] }]}>
                  {formatCurrency(calculations.growth.year3)}
                </Text>
                <Text style={styles.growthNote}>
                  +{Math.round((calculations.growth.year3 / calculations.growth.year1 - 1) * 100)}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Feather name="bar-chart-2" size={24} color={colors.primary[600]} />
            <Text style={styles.summaryTitle}>Revenue Summary</Text>
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Daily</Text>
              <Text style={styles.summaryStatValue}>{formatCurrency(calculations.daily.revenue)}</Text>
            </View>
            <View style={styles.summaryStatDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Monthly</Text>
              <Text style={[styles.summaryStatValue, { color: colors.secondary[600] }]}>
                {formatCurrency(calculations.monthly.revenue)}
              </Text>
            </View>
            <View style={styles.summaryStatDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Yearly</Text>
              <Text style={[styles.summaryStatValue, { color: colors.success[600] }]}>
                {formatCurrency(calculations.yearly.revenue)}
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
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
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
    backgroundColor: colors.success[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  feeBannerContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  feeBannerText: {
    flex: 1,
  },
  feeBannerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  feeBannerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    marginTop: 2,
  },
  feeBannerNote: {
    fontSize: typography.fontSize.xs,
    color: colors.success[500],
    marginTop: 4,
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
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },

  // Inputs
  inputRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  inputGroupHalf: {
    flex: 1,
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
  inputSuffix: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
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
  breakdownValueHighlight: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
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
    flex: 1,
  },
  projectionBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  projectionStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  projectionStat: {
    flex: 1,
    alignItems: "center",
  },
  projectionStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.md,
  },
  projectionStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  projectionStatValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  projectionStatValueHighlight: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },

  // Growth Card
  growthCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  growthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  growthItem: {
    flex: 1,
    alignItems: "center",
  },
  growthArrow: {
    paddingHorizontal: spacing.xs,
  },
  growthLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  growthValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  growthNote: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
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
  summaryStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
  },
  summaryStatLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  summaryStatValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },

  bottomSpacer: {
    height: spacing["3xl"],
  },
});

export default PlatformEarningsCalculator;
