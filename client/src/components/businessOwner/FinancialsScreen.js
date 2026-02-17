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
import { usePricing } from "../../context/PricingContext";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import ExportModal from "./ExportModal";
import TaxFormsSection from "../tax/TaxFormsSection";
import useSafeNavigation from "../../hooks/useSafeNavigation";
import {
  generateCSV,
  generatePDF,
  generateFinancialSummaryHTML,
  generatePayrollByEmployeeHTML,
  generateEmployeeEarningsHTML,
  generatePayrollSummaryHTML,
  prepareFinancialSummaryCSV,
  preparePayrollByEmployeeCSV,
  prepareEmployeeEarningsCSV,
} from "../../services/exportService";

// Period Selector Component
const PeriodSelector = ({ value, onChange }) => {
  const periods = [
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "quarter", label: "This Quarter" },
    { key: "year", label: "This Year" },
  ];

  return (
    <View style={styles.periodSelector}>
      {periods.map((period) => (
        <Pressable
          key={period.key}
          style={[styles.periodOption, value === period.key && styles.periodOptionSelected]}
          onPress={() => onChange(period.key)}
        >
          <Text
            style={[
              styles.periodOptionText,
              value === period.key && styles.periodOptionTextSelected,
            ]}
          >
            {period.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

// Summary Card Component
const SummaryCard = ({ icon, label, value, subValue, color, trend }) => (
  <View style={styles.summaryCard}>
    <View style={[styles.summaryIcon, { backgroundColor: color + "20" }]}>
      <Icon name={icon} size={18} color={color} />
    </View>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
    {subValue && <Text style={styles.summarySubValue}>{subValue}</Text>}
    {trend !== undefined && (
      <View style={styles.trendBadge}>
        <Icon
          name={trend >= 0 ? "arrow-up" : "arrow-down"}
          size={10}
          color={trend >= 0 ? colors.success[600] : colors.error[600]}
        />
        <Text
          style={[
            styles.trendText,
            { color: trend >= 0 ? colors.success[600] : colors.error[600] },
          ]}
        >
          {Math.abs(trend)}%
        </Text>
      </View>
    )}
  </View>
);

// Financial Breakdown Row
const BreakdownRow = ({ label, value, color, isTotal, isLocked }) => (
  <View style={[styles.breakdownRow, isTotal && styles.breakdownRowTotal]}>
    <View style={styles.breakdownLabel}>
      <Text style={[styles.breakdownLabelText, isTotal && styles.breakdownLabelTextTotal]}>
        {label}
      </Text>
      {isLocked && (
        <View style={styles.lockedBadge}>
          <Icon name="lock" size={10} color={colors.neutral[500]} />
          <Text style={styles.lockedText}>Fixed</Text>
        </View>
      )}
    </View>
    <Text
      style={[
        styles.breakdownValue,
        color && { color },
        isTotal && styles.breakdownValueTotal,
      ]}
    >
      {value}
    </Text>
  </View>
);

// Employee Earnings Row
const EmployeeEarningsRow = ({ employee, earnings, onPress }) => (
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
      <Text style={styles.employeeJobs}>{earnings.jobCount} jobs completed</Text>
    </View>
    <View style={styles.employeeEarnings}>
      <Text style={styles.employeeEarningsAmount}>
        ${(earnings.totalPaid / 100).toFixed(2)}
      </Text>
      {earnings.pending > 0 && (
        <Text style={styles.employeePending}>
          ${(earnings.pending / 100).toFixed(2)} pending
        </Text>
      )}
    </View>
  </Pressable>
);

// Main Component
const FinancialsScreen = ({ state }) => {
  const { goBack, navigate } = useSafeNavigation();
  const { pricing } = usePricing();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("month");
  const [financials, setFinancials] = useState(null);
  const [employeeEarnings, setEmployeeEarnings] = useState([]);
  const [error, setError] = useState(null);

  // Export modal state
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportType, setExportType] = useState(null);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Calculate date range based on period
      const now = new Date();
      let startDate, endDate;

      switch (period) {
        case "week":
          const dayOfWeek = now.getDay();
          startDate = new Date(now);
          startDate.setDate(now.getDate() - dayOfWeek);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case "quarter":
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
          break;
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = now;
      }

      const result = await BusinessOwnerService.getFinancials(
        state.currentUser.token,
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0]
      );

      setFinancials(result.financials || {});
      setEmployeeEarnings(result.employeeBreakdown || []);
    } catch (err) {
      console.error("Error fetching financials:", err);
      setError("Failed to load financial data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const onRefresh = useCallback(() => {
    fetchData(true);
  }, [state.currentUser.token, period]);

  const formatCurrency = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Get period label for exports
  const getPeriodLabel = () => {
    const periodLabels = {
      week: "This Week",
      month: "This Month",
      quarter: "This Quarter",
      year: "This Year",
    };
    return periodLabels[period] || period;
  };

  const handleExport = (type) => {
    setExportType(type);
    setExportModalVisible(true);
  };

  const performExport = async (format, year = null) => {
    try {
      const token = state.currentUser?.token;

      // Handle tax document exports (annual data)
      if (exportType === "employee-earnings" || exportType === "payroll-summary") {
        if (!year) {
          return { success: false, error: "Please select a year" };
        }

        const taxData = await BusinessOwnerService.getTaxExport(token, year);
        if (taxData.error) {
          return { success: false, error: taxData.error };
        }

        if (exportType === "employee-earnings") {
          if (format === "csv") {
            const csvData = prepareEmployeeEarningsCSV(taxData.employeeBreakdown || [], year);
            return await generateCSV(csvData, `employee-earnings-${year}`);
          } else {
            const html = generateEmployeeEarningsHTML(
              taxData.employeeBreakdown || [],
              year,
              "Your Business"
            );
            return await generatePDF(html, `employee-earnings-${year}`);
          }
        } else {
          // payroll-summary
          if (format === "csv") {
            const csvData = prepareFinancialSummaryCSV(taxData.financials || {});
            return await generateCSV(csvData, `payroll-summary-${year}`);
          } else {
            const html = generatePayrollSummaryHTML(
              {
                ...taxData.financials,
                employeeCount: taxData.summary?.totalEmployees || 0,
              },
              year,
              "Your Business"
            );
            return await generatePDF(html, `payroll-summary-${year}`);
          }
        }
      }

      // Handle period-based exports
      if (exportType === "summary") {
        if (format === "csv") {
          const csvData = prepareFinancialSummaryCSV(financials || {});
          return await generateCSV(csvData, `financial-summary-${period}`);
        } else {
          const html = generateFinancialSummaryHTML(
            financials || {},
            getPeriodLabel(),
            "Your Business"
          );
          return await generatePDF(html, `financial-summary-${period}`);
        }
      }

      if (exportType === "payroll") {
        if (format === "csv") {
          const csvData = preparePayrollByEmployeeCSV(employeeEarnings || []);
          return await generateCSV(csvData, `payroll-by-employee-${period}`);
        } else {
          const html = generatePayrollByEmployeeHTML(
            employeeEarnings || [],
            getPeriodLabel(),
            "Your Business"
          );
          return await generatePDF(html, `payroll-by-employee-${period}`);
        }
      }

      return { success: false, error: "Unknown export type" };
    } catch (err) {
      console.error("Export error:", err);
      return { success: false, error: err.message || "Export failed" };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading financials...</Text>
      </View>
    );
  }

  const {
    totalRevenue = 0,
    platformFees = 0,
    totalPayroll = 0,
    stripeFees = 0,
    netProfit = 0,
    jobCount: _jobCount = 0,
    completedJobs = 0,
    pendingPayroll = 0,
  } = financials || {};

  // Calculate percentages for breakdown - get from pricing config
  const platformFeePercent = (pricing?.platform?.businessOwnerFeePercent || 0.10) * 100;
  const payrollPercent = totalRevenue > 0 ? ((totalPayroll / totalRevenue) * 100).toFixed(1) : 0;
  const profitPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goBack()}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Financials</Text>
        <Pressable style={styles.exportButton} onPress={() => handleExport("summary")}>
          <Icon name="download" size={18} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Period Selector */}
      <PeriodSelector value={period} onChange={setPeriod} />

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

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <SummaryCard
            icon="dollar"
            label="Total Revenue"
            value={formatCurrency(totalRevenue)}
            subValue={`${completedJobs} jobs`}
            color={colors.success[600]}
          />
          <SummaryCard
            icon="line-chart"
            label="Net Profit"
            value={formatCurrency(netProfit)}
            subValue={`${profitPercent}% margin`}
            color={netProfit >= 0 ? colors.primary[600] : colors.error[600]}
          />
          <SummaryCard
            icon="users"
            label="Payroll"
            value={formatCurrency(totalPayroll)}
            subValue={`${payrollPercent}% of revenue`}
            color={colors.warning[600]}
          />
          <SummaryCard
            icon="clock-o"
            label="Pending Payroll"
            value={formatCurrency(pendingPayroll)}
            color={colors.secondary[600]}
          />
        </View>

        {/* Financial Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Breakdown</Text>
          <View style={styles.breakdownCard}>
            <BreakdownRow
              label="Gross Revenue"
              value={formatCurrency(totalRevenue)}
            />
            <BreakdownRow
              label={`Platform Fee (${platformFeePercent}%)`}
              value={`-${formatCurrency(platformFees)}`}
              color={colors.error[600]}
              isLocked
            />
            <BreakdownRow
              label="Employee Payroll"
              value={`-${formatCurrency(totalPayroll)}`}
              color={colors.error[600]}
            />
            {stripeFees > 0 && (
              <BreakdownRow
                label="Stripe Fees"
                value={`-${formatCurrency(stripeFees)}`}
                color={colors.error[600]}
              />
            )}
            <BreakdownRow
              label="Net Profit"
              value={formatCurrency(netProfit)}
              color={netProfit >= 0 ? colors.success[600] : colors.error[600]}
              isTotal
            />
          </View>
        </View>

        {/* Employee Breakdown */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payroll by Employee</Text>
            <Pressable onPress={() => handleExport("payroll")}>
              <Text style={styles.exportLink}>Export</Text>
            </Pressable>
          </View>
          <View style={styles.employeeList}>
            {employeeEarnings.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="users" size={32} color={colors.neutral[300]} />
                <Text style={styles.emptyText}>No employee payments this period</Text>
              </View>
            ) : (
              employeeEarnings.map((item) => (
                <EmployeeEarningsRow
                  key={item.employee.id}
                  employee={item.employee}
                  earnings={item}
                  onPress={() =>
                    navigate(`/business-owner/employees/${item.employee.id}`)
                  }
                />
              ))
            )}
          </View>
        </View>

        {/* Tax Documents Section */}
        <View style={styles.section}>
          <TaxFormsSection state={state} />
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Icon name="info-circle" size={20} color={colors.primary[600]} />
          <Text style={styles.infoText}>
            Platform fees are currently {platformFeePercent}%. You will receive a 1099-K
            from Stripe at year end based on your total earnings.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Export Modal */}
      <ExportModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        exportType={exportType}
        onExport={performExport}
        showYearSelector={exportType === "employee-earnings" || exportType === "payroll-summary"}
        periodLabel={getPeriodLabel()}
      />
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  exportButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  periodSelector: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.sm,
  },
  periodOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
  },
  periodOptionSelected: {
    backgroundColor: colors.primary[600],
  },
  periodOptionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  periodOptionTextSelected: {
    color: "#fff",
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
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  summaryCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  summarySubValue: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  trendText: {
    fontSize: typography.fontSize.xs,
    marginLeft: spacing.xs,
    fontWeight: typography.fontWeight.medium,
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
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  exportLink: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  breakdownCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  breakdownRowTotal: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: colors.border.default,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  breakdownLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  breakdownLabelText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  breakdownLabelTextTotal: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  lockedText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
    marginLeft: 2,
  },
  breakdownValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  breakdownValueTotal: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  employeeList: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    ...shadows.sm,
    overflow: "hidden",
  },
  employeeRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
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
  employeeJobs: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  employeeEarnings: {
    alignItems: "flex-end",
  },
  employeeEarningsAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  employeePending: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[800],
    lineHeight: 20,
  },
  bottomPadding: {
    height: spacing["4xl"],
  },
});

export default FinancialsScreen;
