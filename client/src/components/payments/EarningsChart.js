import React, { useState, useEffect } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";
import { usePricing } from "../../context/PricingContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TIME_RANGES = [
  { key: "1W", label: "1W", days: 7 },
  { key: "1M", label: "1M", days: 30 },
  { key: "6M", label: "6M", days: 180 },
  { key: "1Y", label: "1Y", days: 365 },
  { key: "2Y", label: "2Y", days: 730 },
  { key: "5Y", label: "5Y", days: 1825 },
  { key: "ALL", label: "All", days: null },
];

// Custom Bar Chart Component
const BarChart = ({ data, labels, height = 180 }) => {
  const maxValue = Math.max(...data, 1);
  const chartWidth = SCREEN_WIDTH - spacing.lg * 4;
  const barWidth = Math.max((chartWidth - (data.length - 1) * 4) / data.length, 20);

  return (
    <View style={barChartStyles.container}>
      {/* Y-axis labels */}
      <View style={barChartStyles.yAxis}>
        <Text style={barChartStyles.yLabel}>${maxValue.toFixed(0)}</Text>
        <Text style={barChartStyles.yLabel}>${(maxValue / 2).toFixed(0)}</Text>
        <Text style={barChartStyles.yLabel}>$0</Text>
      </View>

      {/* Chart area */}
      <View style={barChartStyles.chartArea}>
        {/* Grid lines */}
        <View style={[barChartStyles.gridLine, { top: 0 }]} />
        <View style={[barChartStyles.gridLine, { top: height / 2 }]} />
        <View style={[barChartStyles.gridLine, { top: height }]} />

        {/* Bars */}
        <View style={[barChartStyles.barsContainer, { height }]}>
          {data.map((value, index) => {
            const barHeight = maxValue > 0 ? (value / maxValue) * height : 0;
            return (
              <View key={index} style={barChartStyles.barWrapper}>
                <View
                  style={[
                    barChartStyles.bar,
                    {
                      height: Math.max(barHeight, 2),
                      width: Math.min(barWidth, 40),
                      backgroundColor: value > 0 ? colors.success[500] : colors.neutral[200],
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* X-axis labels */}
        <View style={barChartStyles.xAxis}>
          {labels.map((label, index) => (
            <View key={index} style={barChartStyles.xLabelWrapper}>
              <Text style={barChartStyles.xLabel} numberOfLines={1}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const barChartStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingTop: spacing.sm,
  },
  yAxis: {
    width: 45,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingRight: spacing.sm,
    height: 180,
  },
  yLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
  },
  chartArea: {
    flex: 1,
    position: "relative",
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border.light,
  },
  barsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
  },
  barWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  xAxis: {
    flexDirection: "row",
    marginTop: spacing.sm,
  },
  xLabelWrapper: {
    flex: 1,
    alignItems: "center",
  },
  xLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    textAlign: "center",
  },
});

const EarningsChart = ({ appointments = [], currentUserId }) => {
  const { pricing } = usePricing();
  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const [selectedRange, setSelectedRange] = useState("1M");
  const [chartData, setChartData] = useState({ data: [], labels: [] });
  const [stats, setStats] = useState({ total: 0, average: 0, change: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    processEarningsData();
  }, [appointments, selectedRange, currentUserId]);

  const processEarningsData = () => {
    setIsLoading(true);

    // Filter appointments for this cleaner that are completed
    const cleanerAppointments = (appointments || []).filter(
      (appt) =>
        appt.completed &&
        appt.employeesAssigned &&
        appt.employeesAssigned.includes(String(currentUserId))
    );

    // Get the selected time range
    const range = TIME_RANGES.find((r) => r.key === selectedRange);
    const now = new Date();
    let startDate;

    if (range.days === null) {
      // All time - find earliest appointment
      if (cleanerAppointments.length > 0) {
        startDate = new Date(
          Math.min(...cleanerAppointments.map((a) => new Date(a.date).getTime()))
        );
      } else {
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
      }
    } else {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - range.days);
    }

    // Filter appointments within range
    const filteredAppointments = cleanerAppointments.filter((appt) => {
      const apptDate = new Date(appt.date);
      return apptDate >= startDate && apptDate <= now;
    });

    // Calculate cleaner earnings (share of price, split among cleaners)
    const calculateEarnings = (appt) => {
      const numCleaners = appt.employeesAssigned?.length || 1;
      const price = parseFloat(appt.price) || 0;
      return (price / numCleaners) * cleanerSharePercent;
    };

    // Group earnings by period
    const earnings = {};
    let labels = [];

    if (range.days <= 7) {
      // Daily for 1 week
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split("T")[0];
        earnings[key] = 0;
      }
      filteredAppointments.forEach((appt) => {
        const key = appt.date.split("T")[0];
        if (earnings.hasOwnProperty(key)) {
          earnings[key] += calculateEarnings(appt);
        }
      });
      labels = Object.keys(earnings).map((d) => {
        const date = new Date(d);
        return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
      });
    } else if (range.days <= 30) {
      // Weekly for 1 month
      for (let i = 3; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i * 7);
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const key = weekStart.toISOString().split("T")[0];
        earnings[key] = 0;
      }
      filteredAppointments.forEach((appt) => {
        const apptDate = new Date(appt.date);
        const weekStart = new Date(apptDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const key = weekStart.toISOString().split("T")[0];
        if (earnings.hasOwnProperty(key)) {
          earnings[key] += calculateEarnings(appt);
        }
      });
      labels = Object.keys(earnings).map((d, i) => `Wk ${i + 1}`);
    } else if (range.days <= 365) {
      // Monthly for 6M-1Y
      const months = range.days <= 180 ? 6 : 12;
      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        earnings[key] = 0;
      }
      filteredAppointments.forEach((appt) => {
        const apptDate = new Date(appt.date);
        const key = `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, "0")}`;
        if (earnings.hasOwnProperty(key)) {
          earnings[key] += calculateEarnings(appt);
        }
      });
      labels = Object.keys(earnings).map((d) => {
        const [year, month] = d.split("-");
        const date = new Date(year, month - 1);
        return date.toLocaleDateString("en-US", { month: "short" }).slice(0, 3);
      });
    } else {
      // Quarterly for 2Y-5Y-All
      const quarters = range.days ? Math.min(Math.ceil(range.days / 90), 12) : 12;
      for (let i = quarters - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i * 3);
        const quarter = Math.floor(date.getMonth() / 3);
        const key = `${date.getFullYear()}-Q${quarter + 1}`;
        earnings[key] = 0;
      }
      filteredAppointments.forEach((appt) => {
        const apptDate = new Date(appt.date);
        const quarter = Math.floor(apptDate.getMonth() / 3);
        const key = `${apptDate.getFullYear()}-Q${quarter + 1}`;
        if (earnings.hasOwnProperty(key)) {
          earnings[key] += calculateEarnings(appt);
        }
      });
      labels = Object.keys(earnings).map((d) => {
        const [year, q] = d.split("-");
        return `${q}`;
      });
    }

    const dataPoints = Object.values(earnings);

    // Calculate stats
    const totalEarnings = dataPoints.reduce((sum, val) => sum + val, 0);
    const averageEarnings = dataPoints.length > 0 ? totalEarnings / dataPoints.length : 0;

    // Calculate change percentage
    let changePercent = 0;
    if (dataPoints.length >= 2) {
      const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
      const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));
      const firstSum = firstHalf.reduce((a, b) => a + b, 0);
      const secondSum = secondHalf.reduce((a, b) => a + b, 0);
      if (firstSum > 0) {
        changePercent = ((secondSum - firstSum) / firstSum) * 100;
      } else if (secondSum > 0) {
        changePercent = 100;
      }
    }

    setChartData({
      data: dataPoints,
      labels: labels,
    });

    setStats({
      total: totalEarnings,
      average: averageEarnings,
      change: changePercent,
    });

    setIsLoading(false);
  };

  const getRangeLabel = () => {
    const range = TIME_RANGES.find((r) => r.key === selectedRange);
    switch (range.key) {
      case "1W":
        return "Past Week";
      case "1M":
        return "Past Month";
      case "6M":
        return "Past 6 Months";
      case "1Y":
        return "Past Year";
      case "2Y":
        return "Past 2 Years";
      case "5Y":
        return "Past 5 Years";
      case "ALL":
        return "All Time";
      default:
        return "";
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Earnings Over Time</Text>
        <Text style={styles.subtitle}>{getRangeLabel()}</Text>
      </View>

      {/* Time Range Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rangeSelector}
      >
        {TIME_RANGES.map((range) => (
          <Pressable
            key={range.key}
            onPress={() => setSelectedRange(range.key)}
            style={[
              styles.rangeButton,
              selectedRange === range.key && styles.rangeButtonActive,
            ]}
          >
            <Text
              style={[
                styles.rangeButtonText,
                selectedRange === range.key && styles.rangeButtonTextActive,
              ]}
            >
              {range.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardPrimary]}>
          <Text style={styles.statLabel}>Total Earned</Text>
          <Text style={[styles.statValue, styles.statValuePrimary]}>
            ${stats.total.toFixed(2)}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Avg / Period</Text>
          <Text style={styles.statValue}>${stats.average.toFixed(2)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Trend</Text>
          <Text
            style={[
              styles.statValue,
              stats.change >= 0 ? styles.statValuePositive : styles.statValueNegative,
            ]}
          >
            {stats.change >= 0 ? "+" : ""}
            {stats.change.toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
          </View>
        ) : chartData.data.length > 0 ? (
          <BarChart data={chartData.data} labels={chartData.labels} />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No earnings data yet</Text>
            <Text style={styles.emptySubtext}>
              Complete jobs to see your earnings chart
            </Text>
          </View>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success[500] }]} />
          <Text style={styles.legendText}>Earnings per Period</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  rangeSelector: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  rangeButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    marginRight: spacing.xs,
  },
  rangeButtonActive: {
    backgroundColor: colors.primary[500],
  },
  rangeButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  rangeButtonTextActive: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  statCardPrimary: {
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statValuePrimary: {
    color: colors.success[600],
  },
  statValuePositive: {
    color: colors.success[600],
  },
  statValueNegative: {
    color: colors.error[600],
  },
  chartContainer: {
    marginVertical: spacing.md,
    minHeight: 220,
  },
  loadingContainer: {
    height: 220,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    height: 220,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
});

export default EarningsChart;
