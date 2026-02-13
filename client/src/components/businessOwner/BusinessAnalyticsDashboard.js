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
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import BusinessOwnerService from "../../services/fetchRequests/BusinessOwnerService";
import GiveBonusModal from "./GiveBonusModal";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Metric Card Component
const MetricCard = ({ icon, label, value, subValue, change, color = colors.primary[600] }) => (
  <View style={styles.metricCard}>
    <View style={[styles.metricIcon, { backgroundColor: color + "15" }]}>
      <Icon name={icon} size={18} color={color} />
    </View>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
    {subValue && <Text style={styles.metricSubValue}>{subValue}</Text>}
    {change !== undefined && (
      <View style={[styles.changeTag, change >= 0 ? styles.changePositive : styles.changeNegative]}>
        <Icon name={change >= 0 ? "arrow-up" : "arrow-down"} size={10} color={change >= 0 ? colors.success[700] : colors.error[700]} />
        <Text style={[styles.changeText, change >= 0 ? styles.changeTextPositive : styles.changeTextNegative]}>
          {Math.abs(change)}%
        </Text>
      </View>
    )}
  </View>
);

// Premium Lock Overlay
const PremiumLock = ({ onPress, cleaningsNeeded }) => (
  <Pressable style={styles.premiumLock} onPress={onPress}>
    <View style={styles.premiumLockContent}>
      <Icon name="lock" size={24} color={colors.neutral[400]} />
      <Text style={styles.premiumLockTitle}>Premium Feature</Text>
      <Text style={styles.premiumLockText}>
        {cleaningsNeeded > 0
          ? `Complete ${cleaningsNeeded} more jobs this month to unlock`
          : "Available for high-volume businesses (50+ jobs/month)"}
      </Text>
    </View>
  </Pressable>
);

// Enhanced Employee Performance Card
const EmployeePerformanceCard = ({ employee, rank, isTopPerformer, onBonusPress }) => {
  const getRankStyle = () => {
    if (rank === 1) return { bg: colors.warning[100], color: colors.warning[600], icon: "trophy" };
    if (rank === 2) return { bg: colors.neutral[200], color: colors.neutral[600], icon: "star" };
    if (rank === 3) return { bg: colors.warning[50], color: colors.warning[500], icon: "certificate" };
    return { bg: colors.primary[100], color: colors.primary[600], icon: null };
  };

  const rankStyle = getRankStyle();
  const completionRate = employee.completionRate || 0;

  return (
    <View style={[
      styles.performerCard,
      isTopPerformer && styles.topPerformerCard
    ]}>
      {isTopPerformer && (
        <View style={styles.topPerformerBadge}>
          <Icon name="star" size={10} color={colors.neutral[0]} />
          <Text style={styles.topPerformerBadgeText}>TOP PERFORMER</Text>
        </View>
      )}
      <View style={styles.performerHeader}>
        <View style={[styles.performerRank, { backgroundColor: rankStyle.bg }]}>
          {rankStyle.icon ? (
            <Icon name={rankStyle.icon} size={16} color={rankStyle.color} />
          ) : (
            <Text style={[styles.performerRankText, { color: rankStyle.color }]}>{rank}</Text>
          )}
        </View>
        <View style={styles.performerInfo}>
          <Text style={styles.performerName}>{employee.name}</Text>
          <Text style={styles.performerRole}>
            {employee.jobsCompleted} jobs completed
          </Text>
        </View>
        {employee.avgRating > 0 && (
          <View style={styles.performerRating}>
            <Icon name="star" size={14} color={colors.warning[500]} />
            <Text style={styles.performerRatingText}>{employee.avgRating.toFixed(1)}</Text>
          </View>
        )}
        {onBonusPress && (
          <Pressable
            style={styles.bonusButton}
            onPress={() => onBonusPress(employee)}
          >
            <Icon name="gift" size={14} color={colors.warning[600]} />
          </Pressable>
        )}
      </View>

      <View style={styles.performerStats}>
        <View style={styles.performerStatItem}>
          <Text style={styles.performerStatLabel}>Revenue</Text>
          <Text style={styles.performerStatValue}>{employee.totalRevenueFormatted}</Text>
        </View>
        <View style={styles.performerStatDivider} />
        <View style={styles.performerStatItem}>
          <Text style={styles.performerStatLabel}>Completion</Text>
          <View style={styles.completionBarContainer}>
            <View style={styles.completionBarBg}>
              <View style={[
                styles.completionBarFill,
                { width: `${completionRate}%` },
                completionRate >= 95 && styles.completionBarExcellent,
                completionRate >= 80 && completionRate < 95 && styles.completionBarGood,
                completionRate < 80 && styles.completionBarNeedsWork,
              ]} />
            </View>
            <Text style={styles.completionBarText}>{completionRate}%</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// Team Stats Summary
const TeamStatsSummary = ({ employees }) => {
  if (!employees || employees.length === 0) return null;

  const totalRevenue = employees.reduce((sum, emp) => {
    const revenue = parseFloat(emp.totalRevenueFormatted?.replace(/[$,]/g, '') || 0);
    return sum + revenue;
  }, 0);

  const avgRating = employees.reduce((sum, emp) => sum + (emp.avgRating || 0), 0) / employees.length;
  const totalJobs = employees.reduce((sum, emp) => sum + (emp.jobsCompleted || 0), 0);
  const avgCompletion = employees.reduce((sum, emp) => sum + (emp.completionRate || 0), 0) / employees.length;

  return (
    <View style={styles.teamStatsSummary}>
      <View style={styles.teamStatItem}>
        <Icon name="users" size={16} color={colors.primary[500]} />
        <Text style={styles.teamStatValue}>{employees.length}</Text>
        <Text style={styles.teamStatLabel}>Team Size</Text>
      </View>
      <View style={styles.teamStatItem}>
        <Icon name="check-circle" size={16} color={colors.success[500]} />
        <Text style={styles.teamStatValue}>{totalJobs}</Text>
        <Text style={styles.teamStatLabel}>Total Jobs</Text>
      </View>
      <View style={styles.teamStatItem}>
        <Icon name="star" size={16} color={colors.warning[500]} />
        <Text style={styles.teamStatValue}>{avgRating.toFixed(1)}</Text>
        <Text style={styles.teamStatLabel}>Avg Rating</Text>
      </View>
      <View style={styles.teamStatItem}>
        <Icon name="dollar" size={16} color={colors.success[500]} />
        <Text style={styles.teamStatValue}>${totalRevenue.toLocaleString()}</Text>
        <Text style={styles.teamStatLabel}>Revenue</Text>
      </View>
    </View>
  );
};

// Client Stats Summary
const ClientStatsSummary = ({ clients }) => {
  if (!clients) return null;

  const totalRevenue = clients.topClients?.reduce((sum, c) => {
    const revenue = parseFloat(c.totalRevenueFormatted?.replace(/[$,]/g, '') || 0);
    return sum + revenue;
  }, 0) || 0;

  const avgBookings = clients.topClients?.length > 0
    ? Math.round(clients.topClients.reduce((sum, c) => sum + (c.bookingCount || 0), 0) / clients.topClients.length)
    : 0;

  return (
    <View style={styles.clientStatsSummary}>
      <View style={styles.clientStatItem}>
        <Icon name="users" size={16} color={colors.primary[500]} />
        <Text style={styles.clientStatValue}>{clients.totalClients || 0}</Text>
        <Text style={styles.clientStatLabel}>Clients</Text>
      </View>
      <View style={styles.clientStatItem}>
        <Icon name="user-plus" size={16} color={colors.success[500]} />
        <Text style={styles.clientStatValue}>{clients.newClientsThisMonth || 0}</Text>
        <Text style={styles.clientStatLabel}>New</Text>
      </View>
      <View style={styles.clientStatItem}>
        <Icon name="refresh" size={16} color={colors.secondary[500]} />
        <Text style={styles.clientStatValue}>{clients.metrics?.retentionRate || 0}%</Text>
        <Text style={styles.clientStatLabel}>Retention</Text>
      </View>
      <View style={styles.clientStatItem}>
        <Icon name="dollar" size={16} color={colors.warning[500]} />
        <Text style={styles.clientStatValue}>${totalRevenue.toLocaleString()}</Text>
        <Text style={styles.clientStatLabel}>Revenue</Text>
      </View>
    </View>
  );
};

// Enhanced Client Card
const ClientInsightCard = ({ client, rank, isTopClient, isAtRisk }) => {
  const getRankStyle = () => {
    if (rank === 1) return { bg: colors.warning[100], color: colors.warning[600], icon: "star" };
    if (rank === 2) return { bg: colors.neutral[200], color: colors.neutral[600], icon: "star-o" };
    if (rank === 3) return { bg: colors.warning[50], color: colors.warning[500], icon: "star-o" };
    return { bg: colors.primary[100], color: colors.primary[600], icon: null };
  };

  const rankStyle = getRankStyle();
  const bookingCount = client.bookingCount || 0;

  // Calculate loyalty tier based on bookings
  const getLoyaltyTier = () => {
    if (bookingCount >= 20) return { label: "VIP", color: colors.warning[600], bg: colors.warning[100] };
    if (bookingCount >= 10) return { label: "Loyal", color: colors.success[600], bg: colors.success[100] };
    if (bookingCount >= 5) return { label: "Regular", color: colors.primary[600], bg: colors.primary[100] };
    return null;
  };

  const loyaltyTier = getLoyaltyTier();

  return (
    <View style={[
      styles.clientInsightCard,
      isTopClient && styles.topClientCard,
      isAtRisk && styles.atRiskClientCard
    ]}>
      {isTopClient && rank === 1 && (
        <View style={styles.topClientBadge}>
          <Icon name="star" size={10} color={colors.neutral[0]} />
          <Text style={styles.topClientBadgeText}>TOP CLIENT</Text>
        </View>
      )}
      {isAtRisk && (
        <View style={styles.atRiskClientBadge}>
          <Icon name="exclamation-triangle" size={10} color={colors.neutral[0]} />
          <Text style={styles.atRiskClientBadgeText}>AT RISK</Text>
        </View>
      )}
      <View style={styles.clientInsightHeader}>
        {rank && !isAtRisk && (
          <View style={[styles.clientRank, { backgroundColor: rankStyle.bg }]}>
            {rankStyle.icon ? (
              <Icon name={rankStyle.icon} size={14} color={rankStyle.color} />
            ) : (
              <Text style={[styles.clientRankText, { color: rankStyle.color }]}>{rank}</Text>
            )}
          </View>
        )}
        {isAtRisk && (
          <View style={[styles.clientRank, { backgroundColor: colors.warning[100] }]}>
            <Icon name="exclamation" size={14} color={colors.warning[600]} />
          </View>
        )}
        <View style={styles.clientInsightInfo}>
          <Text style={styles.clientInsightName}>{client.name}</Text>
          <Text style={styles.clientInsightSubtext}>
            {bookingCount} booking{bookingCount !== 1 ? 's' : ''} total
          </Text>
        </View>
        {loyaltyTier && !isAtRisk && (
          <View style={[styles.loyaltyBadge, { backgroundColor: loyaltyTier.bg }]}>
            <Text style={[styles.loyaltyBadgeText, { color: loyaltyTier.color }]}>
              {loyaltyTier.label}
            </Text>
          </View>
        )}
        {isAtRisk && client.daysSinceLastBooking && (
          <View style={styles.daysBadge}>
            <Text style={styles.daysBadgeText}>{client.daysSinceLastBooking}d ago</Text>
          </View>
        )}
      </View>

      <View style={styles.clientInsightStats}>
        <View style={styles.clientInsightStatItem}>
          <Text style={styles.clientInsightStatLabel}>Revenue</Text>
          <Text style={[
            styles.clientInsightStatValue,
            isAtRisk && styles.clientInsightStatValueMuted
          ]}>
            {client.totalRevenueFormatted || '$0'}
          </Text>
        </View>
        <View style={styles.clientInsightStatDivider} />
        <View style={styles.clientInsightStatItem}>
          <Text style={styles.clientInsightStatLabel}>Avg Value</Text>
          <Text style={[
            styles.clientInsightStatValue,
            isAtRisk && styles.clientInsightStatValueMuted
          ]}>
            {client.avgBookingValueFormatted || (client.totalRevenueFormatted && client.bookingCount > 0
              ? `$${Math.round(parseFloat(client.totalRevenueFormatted.replace(/[$,]/g, '')) / client.bookingCount)}`
              : '$0'
            )}
          </Text>
        </View>
        {!isAtRisk && client.bookingCount > 0 && (
          <>
            <View style={styles.clientInsightStatDivider} />
            <View style={styles.clientInsightStatItem}>
              <Text style={styles.clientInsightStatLabel}>Frequency</Text>
              <View style={styles.frequencyIndicator}>
                {[...Array(Math.min(bookingCount >= 10 ? 5 : Math.ceil(bookingCount / 2), 5))].map((_, i) => (
                  <View key={i} style={[
                    styles.frequencyDot,
                    i < Math.min(Math.ceil(bookingCount / 4), 5) && styles.frequencyDotFilled
                  ]} />
                ))}
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

// Simple Client Row (for compact lists)
const ClientRow = ({ client, isAtRisk }) => (
  <View style={[styles.clientRow, isAtRisk && styles.clientRowAtRisk]}>
    <View style={styles.clientInfo}>
      <Text style={styles.clientName}>{client.name}</Text>
      <Text style={styles.clientStats}>
        {client.bookingCount} bookings | {client.totalRevenueFormatted}
      </Text>
    </View>
    {isAtRisk && (
      <View style={styles.atRiskBadge}>
        <Icon name="exclamation-triangle" size={12} color={colors.warning[600]} />
        <Text style={styles.atRiskText}>At Risk</Text>
      </View>
    )}
  </View>
);

// Enhanced Revenue Chart Component
const RevenueChart = ({ data, maxBars = 6 }) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Icon name="bar-chart" size={32} color={colors.neutral[300]} />
        <Text style={styles.emptyChartText}>No revenue data yet</Text>
      </View>
    );
  }

  const displayData = data.slice(-maxBars);
  const maxValue = Math.max(...displayData.map((d) => d.revenue || 0));
  const totalRevenue = displayData.reduce((sum, d) => sum + (d.revenue || 0), 0);
  const avgRevenue = displayData.length > 0 ? totalRevenue / displayData.length : 0;

  // Find highest and lowest months
  const sortedByRevenue = [...displayData].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  const highestMonth = sortedByRevenue[0];
  const lowestMonth = sortedByRevenue[sortedByRevenue.length - 1];

  return (
    <View style={styles.revenueChartContainer}>
      {/* Summary Stats */}
      <View style={styles.chartSummary}>
        <View style={styles.chartSummaryItem}>
          <Text style={styles.chartSummaryLabel}>Total</Text>
          <Text style={styles.chartSummaryValue}>${(totalRevenue / 100).toLocaleString()}</Text>
        </View>
        <View style={styles.chartSummaryDivider} />
        <View style={styles.chartSummaryItem}>
          <Text style={styles.chartSummaryLabel}>Average</Text>
          <Text style={styles.chartSummaryValue}>${(avgRevenue / 100).toLocaleString()}</Text>
        </View>
        <View style={styles.chartSummaryDivider} />
        <View style={styles.chartSummaryItem}>
          <Text style={styles.chartSummaryLabel}>Peak</Text>
          <Text style={[styles.chartSummaryValue, styles.chartSummaryPeak]}>
            ${((highestMonth?.revenue || 0) / 100).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Bar Chart */}
      <View style={styles.chartBarsContainer}>
        {displayData.map((item, index) => {
          const barHeight = maxValue > 0 ? ((item.revenue || 0) / maxValue) * 100 : 0;
          const isHighest = item === highestMonth && displayData.length > 1;
          const isLowest = item === lowestMonth && displayData.length > 1 && lowestMonth !== highestMonth;
          const isCurrentMonth = index === displayData.length - 1;

          return (
            <View key={index} style={styles.chartBarWrapper}>
              <View style={styles.chartBarValue}>
                <Text style={[styles.chartBarValueText, isHighest && styles.chartBarValueHighlight]}>
                  ${((item.revenue || 0) / 100).toLocaleString()}
                </Text>
              </View>
              <View style={styles.chartBarTrack}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: `${barHeight}%`,
                    },
                    isHighest && styles.chartBarHighest,
                    isLowest && styles.chartBarLowest,
                    isCurrentMonth && !isHighest && !isLowest && styles.chartBarCurrent,
                  ]}
                />
              </View>
              <Text style={[styles.chartLabel, isCurrentMonth && styles.chartLabelCurrent]} numberOfLines={1}>
                {item.period?.split(" ")[0] || ""}
              </Text>
              {item.bookings > 0 && (
                <Text style={styles.chartBookings}>{item.bookings} jobs</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.chartLegendRow}>
        <View style={styles.chartLegendItem}>
          <View style={[styles.chartLegendDot, styles.chartLegendDotHighest]} />
          <Text style={styles.chartLegendText}>Best month</Text>
        </View>
        <View style={styles.chartLegendItem}>
          <View style={[styles.chartLegendDot, styles.chartLegendDotCurrent]} />
          <Text style={styles.chartLegendText}>Current</Text>
        </View>
      </View>
    </View>
  );
};

// Section Header
const SectionHeader = ({ title, icon, isPremium, isLocked }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTitleRow}>
      <Icon name={icon} size={16} color={colors.primary[600]} style={styles.sectionIcon} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {isPremium && (
        <View style={[styles.premiumBadge, isLocked && styles.premiumBadgeLocked]}>
          <Icon name={isLocked ? "lock" : "star"} size={10} color={isLocked ? colors.neutral[500] : colors.warning[500]} />
          <Text style={[styles.premiumBadgeText, isLocked && styles.premiumBadgeTextLocked]}>
            {isLocked ? "Locked" : "Premium"}
          </Text>
        </View>
      )}
    </View>
  </View>
);

// Main Analytics Dashboard Component
const BusinessAnalyticsDashboard = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("thisMonth");
  const [bonusModalVisible, setBonusModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const handleBonusPress = (employee) => {
    setSelectedEmployee(employee);
    setBonusModalVisible(true);
  };

  const handleBonusSubmit = async (bonusData) => {
    const result = await BusinessOwnerService.createBonus(
      state.currentUser.token,
      bonusData
    );
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  };

  const fetchAnalytics = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await BusinessOwnerService.getAllAnalytics(state.currentUser.token, {
        months: 6,
      });
      setAnalytics(result);
    } catch (err) {
      console.error("Error fetching analytics:", err);
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const onRefresh = useCallback(() => {
    fetchAnalytics(true);
  }, [state.currentUser.token]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  const { access, overview, employees, clients, financials, trends } = analytics || {};
  const isPremium = access?.tier === "premium";
  const cleaningsNeeded = access?.qualification?.cleaningsNeeded || 0;

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Analytics</Text>
        <View style={[styles.tierBadge, isPremium ? styles.tierPremium : styles.tierStandard]}>
          <Icon name={isPremium ? "diamond" : "bar-chart"} size={12} color={isPremium ? colors.warning[600] : colors.neutral[600]} />
          <Text style={[styles.tierText, isPremium ? styles.tierTextPremium : styles.tierTextStandard]}>
            {isPremium ? "Premium" : "Standard"}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

      {/* Elite Partner Status Section */}
      {isPremium ? (
        <View style={styles.largeBusinessBanner}>
          <View style={styles.largeBusinessBannerHeader}>
            <View style={styles.largeBusinessTrophyContainer}>
              <Icon name="trophy" size={28} color={colors.warning[500]} />
            </View>
            <View style={styles.largeBusinessBannerTitleContainer}>
              <Text style={styles.largeBusinessBannerTitle}>You're an Elite Partner!</Text>
              <Text style={styles.largeBusinessBannerSubtitle}>
                {access?.qualification?.currentCleanings || 0} cleanings this month
              </Text>
            </View>
          </View>
          <Text style={styles.largeBusinessBannerMessage}>
            Amazing work! You've unlocked our best rates and premium features.
          </Text>
          <View style={styles.largeBusinessPerksRow}>
            <View style={styles.largeBizPerkCard}>
              <Icon name="percent" size={16} color={colors.success[600]} />
              <Text style={styles.largeBizPerkValue}>7%</Text>
              <Text style={styles.largeBizPerkLabel}>Platform Fee</Text>
            </View>
            <View style={styles.largeBizPerkCard}>
              <Icon name="line-chart" size={16} color={colors.primary[600]} />
              <Text style={styles.largeBizPerkValue}>Premium</Text>
              <Text style={styles.largeBizPerkLabel}>Analytics</Text>
            </View>
            <View style={styles.largeBizPerkCard}>
              <Icon name="headphones" size={16} color={colors.secondary[600]} />
              <Text style={styles.largeBizPerkValue}>Priority</Text>
              <Text style={styles.largeBizPerkLabel}>Support</Text>
            </View>
          </View>
        </View>
      ) : (
        (() => {
          const currentCleanings = access?.qualification?.currentCleanings || 0;
          const threshold = access?.qualification?.threshold || 70;
          const progressPercent = Math.min((currentCleanings / threshold) * 100, 100);
          const isHalfway = currentCleanings >= threshold / 2;

          return (
            <View style={styles.elitePartnerPromo}>
              <View style={styles.elitePartnerPromoHeader}>
                <View style={styles.elitePartnerPromoIconWrapper}>
                  <Icon name="rocket" size={24} color={colors.warning[600]} />
                </View>
                <View style={styles.elitePartnerPromoTitleSection}>
                  <Text style={styles.elitePartnerPromoTitle}>Become an Elite Partner</Text>
                  {isHalfway && (
                    <Text style={styles.elitePartnerPromoSubtitle}>
                      You&apos;re making great progress!
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.elitePartnerPromoProgress}>
                <View style={styles.elitePartnerPromoProgressBar}>
                  <View
                    style={[
                      styles.elitePartnerPromoProgressFill,
                      { width: `${progressPercent}%` },
                    ]}
                  />
                </View>
                <Text style={styles.elitePartnerPromoProgressText}>
                  {currentCleanings} / {threshold} cleanings this month
                </Text>
              </View>

              <Text style={styles.elitePartnerPromoUnlock}>
                Complete {cleaningsNeeded} more to unlock:
              </Text>

              <View style={styles.elitePartnerPromoBenefits}>
                <View style={styles.elitePartnerPromoBenefitRow}>
                  <Icon name="percent" size={12} color={colors.success[600]} />
                  <Text style={styles.elitePartnerPromoBenefitText}>Reduced 7% platform fee</Text>
                </View>
                <View style={styles.elitePartnerPromoBenefitRow}>
                  <Icon name="line-chart" size={12} color={colors.primary[600]} />
                  <Text style={styles.elitePartnerPromoBenefitText}>Premium analytics</Text>
                </View>
                <View style={styles.elitePartnerPromoBenefitRow}>
                  <Icon name="headphones" size={12} color={colors.secondary[600]} />
                  <Text style={styles.elitePartnerPromoBenefitText}>Priority support</Text>
                </View>
              </View>
            </View>
          );
        })()
      )}

      {/* Monthly Performance Tracker */}
      {access?.monthlyHistory && access.monthlyHistory.length > 0 && (
        <View style={styles.monthlyTrackerSection}>
          <SectionHeader title="Monthly Performance" icon="calendar" />
          <View style={styles.monthlyTrackerCard}>
            {access.monthlyHistory.slice(0, 4).map((month, index) => (
              <View key={`${month.year}-${month.month}`} style={styles.monthlyTrackerRow}>
                <Text style={styles.monthlyTrackerMonth}>
                  {month.monthName} {month.year}
                </Text>
                <View style={styles.monthlyTrackerBarContainer}>
                  {month.qualified ? (
                    <View style={styles.monthlyTrackerBarQualified}>
                      <Text style={styles.monthlyTrackerBarQualifiedText}>QUALIFIED</Text>
                    </View>
                  ) : (
                    <View style={styles.monthlyTrackerBarProgress}>
                      <View
                        style={[
                          styles.monthlyTrackerBarFill,
                          { width: `${month.progress}%` },
                        ]}
                      />
                    </View>
                  )}
                </View>
                <View style={styles.monthlyTrackerStats}>
                  {month.qualified && (
                    <Icon name="check-circle" size={14} color={colors.success[500]} style={{ marginRight: 4 }} />
                  )}
                  <Text style={[
                    styles.monthlyTrackerCleanings,
                    month.qualified && styles.monthlyTrackerCleaningsQualified
                  ]}>
                    {month.cleanings}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => fetchAnalytics()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Overview Metrics */}
      <View style={styles.section}>
        <SectionHeader title="Overview" icon="dashboard" />
        <View style={styles.metricsGrid}>
          <MetricCard
            icon="calendar-check-o"
            label="Bookings This Month"
            value={overview?.bookings?.thisMonth || 0}
            change={overview?.bookings?.changePercent}
            color={colors.primary[600]}
          />
          <MetricCard
            icon="dollar"
            label="Revenue This Month"
            value={overview?.revenue?.thisMonthFormatted || "$0"}
            change={overview?.revenue?.changePercent}
            color={colors.success[600]}
          />
          <MetricCard
            icon="bar-chart"
            label="Avg Job Value"
            value={overview?.averageJobValueFormatted || "$0"}
            color={colors.secondary[600]}
          />
          <MetricCard
            icon="users"
            label="Active Employees"
            value={overview?.activeEmployees || 0}
            subValue={`${overview?.activeClients || 0} clients`}
            color={colors.primary[600]}
          />
        </View>
      </View>

      {/* Financial Summary */}
      <View style={styles.section}>
        <SectionHeader title="Financial Summary" icon="pie-chart" />

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {[
            { key: "thisWeek", label: "Week" },
            { key: "thisMonth", label: "Month" },
            { key: "lastMonth", label: "Last Mo" },
            { key: "allTime", label: "All" },
          ].map((period) => (
            <Pressable
              key={period.key}
              style={[
                styles.periodOption,
                selectedPeriod === period.key && styles.periodOptionSelected,
              ]}
              onPress={() => setSelectedPeriod(period.key)}
            >
              <Text
                style={[
                  styles.periodOptionText,
                  selectedPeriod === period.key && styles.periodOptionTextSelected,
                ]}
              >
                {period.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Quick Stats Row */}
        <View style={styles.quickStatsRow}>
          <View style={[styles.quickStatCard, styles.quickStatProfit]}>
            <Icon name="line-chart" size={16} color={colors.success[600]} />
            <Text style={styles.quickStatValue}>
              {financials?.periods?.[selectedPeriod]?.netProfitFormatted || "$0"}
            </Text>
            <Text style={styles.quickStatLabel}>Net Profit</Text>
          </View>
          <View style={[styles.quickStatCard, styles.quickStatJobs]}>
            <Icon name="check-circle" size={16} color={colors.primary[600]} />
            <Text style={styles.quickStatValue}>
              {financials?.periods?.[selectedPeriod]?.jobCount || 0}
            </Text>
            <Text style={styles.quickStatLabel}>Jobs Done</Text>
          </View>
          <View style={[styles.quickStatCard, styles.quickStatMargin]}>
            <Icon name="percent" size={16} color={colors.warning[600]} />
            <Text style={styles.quickStatValue}>
              {financials?.periods?.[selectedPeriod]?.profitMargin || 0}%
            </Text>
            <Text style={styles.quickStatLabel}>Margin</Text>
          </View>
        </View>

        {/* Completed Revenue Breakdown */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.cardIconBadge, styles.cardIconSuccess]}>
                <Icon name="check" size={12} color={colors.success[600]} />
              </View>
              <Text style={styles.cardTitle}>Completed</Text>
            </View>
            <View style={styles.jobCountBadge}>
              <Text style={styles.jobCountText}>{financials?.periods?.[selectedPeriod]?.jobCount || 0} jobs</Text>
            </View>
          </View>

          <View style={styles.breakdownContainer}>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabelRow}>
                <Icon name="dollar" size={12} color={colors.text.tertiary} />
                <Text style={styles.breakdownLabel}>Gross Revenue</Text>
              </View>
              <Text style={styles.breakdownValue}>
                {financials?.periods?.[selectedPeriod]?.grossRevenueFormatted || "$0.00"}
              </Text>
            </View>

            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabelRow}>
                <Icon name="minus-circle" size={12} color={colors.error[400]} />
                <Text style={styles.breakdownLabel}>Platform Fee ({Math.round(financials?.feeTier?.feePercent || 0)}%)</Text>
              </View>
              <Text style={[styles.breakdownValue, styles.breakdownNegative]}>
                -{financials?.periods?.[selectedPeriod]?.platformFeesFormatted || "$0.00"}
              </Text>
            </View>

            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabelRow}>
                <Icon name="users" size={12} color={colors.error[400]} />
                <Text style={styles.breakdownLabel}>Employee Payroll</Text>
              </View>
              <Text style={[styles.breakdownValue, styles.breakdownNegative]}>
                -{financials?.periods?.[selectedPeriod]?.totalPayrollFormatted || "$0.00"}
              </Text>
            </View>
          </View>

          <View style={styles.profitResultContainer}>
            <View style={styles.profitResultRow}>
              <Text style={styles.profitResultLabel}>Your Profit</Text>
              <Text
                style={[
                  styles.profitResultValue,
                  (financials?.periods?.[selectedPeriod]?.netProfit || 0) >= 0
                    ? styles.profitPositive
                    : styles.profitNegative,
                ]}
              >
                {financials?.periods?.[selectedPeriod]?.netProfitFormatted || "$0.00"}
              </Text>
            </View>
            {(financials?.periods?.[selectedPeriod]?.profitMargin || 0) > 0 && (
              <View style={styles.marginIndicator}>
                <View
                  style={[
                    styles.marginBar,
                    { width: `${Math.min(financials?.periods?.[selectedPeriod]?.profitMargin || 0, 100)}%` }
                  ]}
                />
                <Text style={styles.marginText}>
                  {financials?.periods?.[selectedPeriod]?.profitMargin}% margin
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Upcoming Jobs */}
        <View style={[styles.sectionCard, styles.upcomingCard]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.cardIconBadge, styles.cardIconPending]}>
                <Icon name="clock-o" size={12} color={colors.primary[600]} />
              </View>
              <Text style={styles.cardTitle}>Upcoming</Text>
            </View>
            <View style={[styles.jobCountBadge, styles.jobCountPending]}>
              <Text style={[styles.jobCountText, styles.jobCountTextPending]}>
                {financials?.pending?.jobCount || 0} scheduled
              </Text>
            </View>
          </View>

          {(financials?.pending?.jobCount || 0) > 0 ? (
            <>
              <View style={styles.breakdownContainer}>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLabelRow}>
                    <Icon name="dollar" size={12} color={colors.text.tertiary} />
                    <Text style={styles.breakdownLabel}>Expected Revenue</Text>
                  </View>
                  <Text style={[styles.breakdownValue, styles.breakdownPending]}>
                    {financials?.pending?.grossRevenueFormatted || "$0.00"}
                  </Text>
                </View>

                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLabelRow}>
                    <Icon name="minus-circle" size={12} color={colors.primary[400]} />
                    <Text style={styles.breakdownLabel}>Est. Platform Fee</Text>
                  </View>
                  <Text style={[styles.breakdownValue, styles.breakdownPendingNeg]}>
                    -{financials?.pending?.platformFeesFormatted || "$0.00"}
                  </Text>
                </View>

                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLabelRow}>
                    <Icon name="users" size={12} color={colors.primary[400]} />
                    <Text style={styles.breakdownLabel}>Est. Payroll</Text>
                  </View>
                  <Text style={[styles.breakdownValue, styles.breakdownPendingNeg]}>
                    -{financials?.pending?.totalPayrollFormatted || "$0.00"}
                  </Text>
                </View>
              </View>

              <View style={[styles.profitResultContainer, styles.profitResultPending]}>
                <View style={styles.profitResultRow}>
                  <Text style={styles.profitResultLabel}>Expected Profit</Text>
                  <Text style={[styles.profitResultValue, styles.profitPending]}>
                    {financials?.pending?.netProfitFormatted || "$0.00"}
                  </Text>
                </View>
                {(financials?.pending?.profitMargin || 0) > 0 && (
                  <Text style={styles.expectedMarginText}>
                    Est. {financials?.pending?.profitMargin}% margin
                  </Text>
                )}
              </View>
            </>
          ) : (
            <View style={styles.emptyUpcoming}>
              <Icon name="calendar-o" size={24} color={colors.neutral[300]} />
              <Text style={styles.emptyUpcomingText}>No upcoming jobs scheduled</Text>
            </View>
          )}
        </View>

        {/* Payment Status Grid */}
        <View style={styles.paymentStatusGrid}>
          {/* Payroll Status */}
          <View style={[styles.statusCard, styles.statusCardLeft]}>
            <View style={styles.statusCardHeader}>
              <Icon name="users" size={14} color={colors.primary[600]} />
              <Text style={styles.statusCardTitle}>Payroll</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, styles.statusDotSuccess]} />
              <Text style={styles.statusLabel}>Paid</Text>
              <Text style={[styles.statusValue, styles.statusValueSuccess]}>
                {financials?.payrollStatus?.paidFormatted || "$0"}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, styles.statusDotWarning]} />
              <Text style={styles.statusLabel}>Pending</Text>
              <Text style={[styles.statusValue, styles.statusValueWarning]}>
                {financials?.payrollStatus?.pendingFormatted || "$0"}
              </Text>
            </View>
          </View>

          {/* Client Payments */}
          <View style={[styles.statusCard, styles.statusCardRight]}>
            <View style={styles.statusCardHeader}>
              <Icon name="credit-card" size={14} color={colors.success[600]} />
              <Text style={styles.statusCardTitle}>Payments</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, styles.statusDotSuccess]} />
              <Text style={styles.statusLabel}>Collected</Text>
              <Text style={[styles.statusValue, styles.statusValueSuccess]}>
                {financials?.clientPayments?.collectedFormatted || "$0"}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, styles.statusDotWarning]} />
              <Text style={styles.statusLabel}>Outstanding</Text>
              <Text style={[styles.statusValue, styles.statusValueWarning]}>
                {financials?.clientPayments?.outstandingFormatted || "$0"}
              </Text>
            </View>
          </View>
        </View>

        {/* Fee Tier Card */}
        <View style={styles.feeTierCard}>
          <View style={styles.feeTierContent}>
            <View style={styles.feeTierMain}>
              <View style={[
                styles.tierBadgeSmall,
                financials?.feeTier?.current === "large_business" ? styles.tierBadgePremium : styles.tierBadgeStandard
              ]}>
                <Icon
                  name={financials?.feeTier?.current === "large_business" ? "star" : "briefcase"}
                  size={10}
                  color={financials?.feeTier?.current === "large_business" ? colors.warning[600] : colors.primary[600]}
                />
                <Text style={[
                  styles.tierBadgeText,
                  financials?.feeTier?.current === "large_business" ? styles.tierBadgeTextPremium : styles.tierBadgeTextStandard
                ]}>
                  {financials?.feeTier?.current === "large_business" ? "Elite Partner" : "Business Owner"}
                </Text>
              </View>
              <Text style={styles.feeRateText}>{Math.round(financials?.feeTier?.feePercent || 0)}% platform fee</Text>
            </View>
            {financials?.feeTier?.cleaningsToQualify > 0 && (
              <View style={styles.feeTierProgressContainer}>
                <View style={styles.tierProgressBar}>
                  <View
                    style={[
                      styles.tierProgressFill,
                      {
                        width: `${Math.min(
                          ((50 - (financials?.feeTier?.cleaningsToQualify || 0)) / 50) * 100,
                          100
                        )}%`
                      }
                    ]}
                  />
                </View>
                <Text style={styles.tierProgressText}>
                  {financials?.feeTier?.cleaningsToQualify} more jobs to unlock 7% rate
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Revenue Trend */}
      <View style={styles.section}>
        <SectionHeader title="Revenue Trend" icon="line-chart" />
        <View style={styles.revenueChartCard}>
          <RevenueChart data={trends?.data || []} maxBars={6} />
        </View>
      </View>

      {/* Employee Performance (Premium) */}
      <View style={styles.section}>
        <SectionHeader title="Team Performance" icon="trophy" isPremium isLocked={!isPremium} />
        {!isPremium ? (
          <View style={styles.sectionCard}>
            <PremiumLock cleaningsNeeded={cleaningsNeeded} />
          </View>
        ) : employees?.employees?.length > 0 ? (
          <>
            <TeamStatsSummary employees={employees.employees} />
            <View style={styles.topPerformersHeader}>
              <Text style={styles.topPerformersTitle}>Top Performers</Text>
              <Text style={styles.topPerformersSubtitle}>This month's leaders</Text>
            </View>
            {employees.employees.slice(0, 5).map((emp, index) => (
              <EmployeePerformanceCard
                key={emp.businessEmployeeId}
                employee={emp}
                rank={index + 1}
                isTopPerformer={index === 0}
                onBonusPress={emp.employeeId ? handleBonusPress : null}
              />
            ))}
          </>
        ) : (
          <View style={styles.sectionCard}>
            <View style={styles.emptyState}>
              <Icon name="users" size={32} color={colors.neutral[300]} />
              <Text style={styles.emptyStateText}>No employee data available</Text>
            </View>
          </View>
        )}
      </View>

      {/* Client Insights (Premium) */}
      <View style={styles.section}>
        <SectionHeader title="Client Insights" icon="heart" isPremium isLocked={!isPremium} />
        {!isPremium ? (
          <View style={styles.sectionCard}>
            <PremiumLock cleaningsNeeded={cleaningsNeeded} />
          </View>
        ) : (
          <>
            <ClientStatsSummary clients={clients} />

            {/* At-Risk Clients Section */}
            {clients?.atRiskClients?.length > 0 && (
              <View style={styles.clientInsightSection}>
                <View style={styles.clientInsightSectionHeader}>
                  <View style={styles.clientInsightSectionTitleRow}>
                    <Icon name="exclamation-triangle" size={14} color={colors.warning[600]} />
                    <Text style={styles.clientInsightSectionTitle}>Needs Attention</Text>
                  </View>
                  <View style={styles.atRiskCountBadge}>
                    <Text style={styles.atRiskCountText}>{clients.atRiskCount || clients.atRiskClients.length}</Text>
                  </View>
                </View>
                <Text style={styles.clientInsightSectionSubtitle}>
                  Clients who haven't booked recently
                </Text>
                {clients.atRiskClients.slice(0, 3).map((client, index) => (
                  <ClientInsightCard
                    key={client.clientId}
                    client={client}
                    isAtRisk
                  />
                ))}
              </View>
            )}

            {/* Top Clients Section */}
            {clients?.topClients?.length > 0 && (
              <View style={styles.clientInsightSection}>
                <View style={styles.clientInsightSectionHeader}>
                  <View style={styles.clientInsightSectionTitleRow}>
                    <Icon name="diamond" size={14} color={colors.primary[600]} />
                    <Text style={styles.clientInsightSectionTitle}>Top Clients</Text>
                  </View>
                </View>
                <Text style={styles.clientInsightSectionSubtitle}>
                  Your most valuable clients by revenue
                </Text>
                {clients.topClients.slice(0, 5).map((client, index) => (
                  <ClientInsightCard
                    key={client.clientId}
                    client={client}
                    rank={index + 1}
                    isTopClient={index === 0}
                  />
                ))}
              </View>
            )}

            {/* Empty State */}
            {(!clients?.topClients?.length && !clients?.atRiskClients?.length) && (
              <View style={styles.sectionCard}>
                <View style={styles.emptyState}>
                  <Icon name="users" size={32} color={colors.neutral[300]} />
                  <Text style={styles.emptyStateText}>No client data available yet</Text>
                </View>
              </View>
            )}
          </>
        )}
      </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Give Bonus Modal */}
      <GiveBonusModal
        visible={bonusModalVisible}
        onClose={() => {
          setBonusModalVisible(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        onSubmit={handleBonusSubmit}
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
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
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  scrollView: {
    flex: 1,
  },
  tierPremium: {
    backgroundColor: colors.warning[100],
  },
  tierStandard: {
    backgroundColor: colors.neutral[100],
  },
  tierText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  tierTextPremium: {
    color: colors.warning[700],
  },
  tierTextStandard: {
    color: colors.neutral[600],
  },
  tierProgress: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  tierProgressText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.neutral[200],
    borderRadius: radius.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary[500],
    borderRadius: radius.full,
  },
  tierProgressHint: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginTop: spacing.xs,
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
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    marginRight: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  premiumBadgeLocked: {
    backgroundColor: colors.neutral[100],
  },
  premiumBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
    marginLeft: 4,
  },
  premiumBadgeTextLocked: {
    color: colors.neutral[500],
  },
  sectionCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  metricValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  metricLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  metricSubValue: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  changeTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },
  changePositive: {
    backgroundColor: colors.success[100],
  },
  changeNegative: {
    backgroundColor: colors.error[100],
  },
  changeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginLeft: 2,
  },
  changeTextPositive: {
    color: colors.success[700],
  },
  changeTextNegative: {
    color: colors.error[700],
  },
  premiumLock: {
    padding: spacing.xl,
    alignItems: "center",
  },
  premiumLockContent: {
    alignItems: "center",
  },
  premiumLockTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[600],
    marginTop: spacing.md,
  },
  premiumLockText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    textAlign: "center",
    marginTop: spacing.xs,
    maxWidth: 250,
  },
  chartContainer: {
    height: 120,
    marginTop: spacing.sm,
  },
  chartBars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
  },
  chartBarWrapper: {
    flex: 1,
    alignItems: "center",
  },
  chartBar: {
    width: "100%",
    backgroundColor: colors.primary[400],
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 10,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  chartCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  chartLegend: {
    alignItems: "center",
    marginTop: spacing.sm,
  },
  chartLegendText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  // Enhanced Revenue Chart Styles
  revenueChartCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  revenueChartContainer: {
    gap: spacing.lg,
  },
  emptyChart: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["2xl"],
    gap: spacing.sm,
  },
  emptyChartText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  chartSummary: {
    flexDirection: "row",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  chartSummaryItem: {
    flex: 1,
    alignItems: "center",
  },
  chartSummaryDivider: {
    width: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: spacing.xs,
  },
  chartSummaryLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xxs,
  },
  chartSummaryValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  chartSummaryPeak: {
    color: colors.success[600],
  },
  chartBarsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 140,
    gap: spacing.xs,
  },
  chartBarTrack: {
    flex: 1,
    height: 100,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.sm,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  chartBarValue: {
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  chartBarValueText: {
    fontSize: 9,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  chartBarValueHighlight: {
    color: colors.success[600],
    fontWeight: typography.fontWeight.bold,
  },
  chartBarHighest: {
    backgroundColor: colors.success[500],
  },
  chartBarLowest: {
    backgroundColor: colors.neutral[300],
  },
  chartBarCurrent: {
    backgroundColor: colors.primary[500],
  },
  chartLabelCurrent: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  chartBookings: {
    fontSize: 8,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  chartLegendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  chartLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  chartLegendDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  chartLegendDotHighest: {
    backgroundColor: colors.success[500],
  },
  chartLegendDotCurrent: {
    backgroundColor: colors.primary[500],
  },
  employeeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  employeeRank: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  employeeRankText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
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
  employeeStats: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  employeeMetrics: {
    alignItems: "flex-end",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  ratingText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.semibold,
    marginLeft: 2,
  },
  completionRate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  // Enhanced Team Performance Styles
  teamStatsSummary: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    justifyContent: "space-around",
  },
  teamStatItem: {
    alignItems: "center",
    gap: spacing.xxs,
  },
  teamStatValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  teamStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  topPerformersHeader: {
    marginBottom: spacing.md,
  },
  topPerformersTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  topPerformersSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  performerCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  topPerformerCard: {
    borderWidth: 2,
    borderColor: colors.warning[300],
    backgroundColor: colors.warning[50],
  },
  topPerformerBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.warning[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
    gap: 4,
  },
  topPerformerBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    letterSpacing: 0.5,
  },
  performerHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  performerRank: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  performerRankText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  performerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  performerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  performerRole: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  performerRating: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: 4,
  },
  performerRatingText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[700],
  },
  performerStats: {
    flexDirection: "row",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  performerStatItem: {
    flex: 1,
  },
  performerStatDivider: {
    width: 1,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing.md,
  },
  performerStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xxs,
  },
  performerStatValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  completionBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  completionBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: colors.neutral[200],
    borderRadius: radius.full,
    overflow: "hidden",
  },
  completionBarFill: {
    height: "100%",
    borderRadius: radius.full,
  },
  completionBarExcellent: {
    backgroundColor: colors.success[500],
  },
  completionBarGood: {
    backgroundColor: colors.primary[500],
  },
  completionBarNeedsWork: {
    backgroundColor: colors.warning[500],
  },
  completionBarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    minWidth: 36,
  },
  bonusButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.warning[50],
    justifyContent: "center",
    alignItems: "center",
    marginLeft: spacing.sm,
  },
  clientMetrics: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: spacing.lg,
  },
  clientMetric: {
    alignItems: "center",
  },
  clientMetricValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  clientMetricLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  atRiskSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  atRiskTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
    marginBottom: spacing.sm,
  },
  topClientsSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  topClientsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  clientRowAtRisk: {
    backgroundColor: colors.warning[50],
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  clientStats: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  atRiskBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  atRiskText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
    marginLeft: 4,
  },
  financialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  financialLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  financialValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  financialLabelBold: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  financialValueBold: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  financialPositive: {
    color: colors.success[600],
  },
  financialNegative: {
    color: colors.error[600],
  },
  financialDivider: {
    height: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: spacing.sm,
  },
  profitMargin: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    alignItems: "center",
  },
  profitMarginText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  periodSelector: {
    flexDirection: "row",
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  periodOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    alignItems: "center",
  },
  periodOptionSelected: {
    backgroundColor: colors.primary[600],
  },
  periodOptionText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  periodOptionTextSelected: {
    color: colors.neutral[0],
  },
  financialSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pendingCard: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  financialPending: {
    color: colors.primary[600],
  },
  financialWarning: {
    color: colors.warning[600],
  },
  countText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.normal,
  },
  // Quick Stats Row
  quickStatsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.sm,
  },
  quickStatProfit: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success[500],
  },
  quickStatJobs: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },
  quickStatMargin: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning[500],
  },
  quickStatValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  quickStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  // Card Header
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardIconBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  cardIconSuccess: {
    backgroundColor: colors.success[100],
  },
  cardIconPending: {
    backgroundColor: colors.primary[100],
  },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  jobCountBadge: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  jobCountPending: {
    backgroundColor: colors.primary[100],
  },
  jobCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  jobCountTextPending: {
    color: colors.primary[700],
  },
  // Breakdown
  breakdownContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  breakdownLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  breakdownLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  breakdownValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  breakdownNegative: {
    color: colors.error[600],
  },
  breakdownPending: {
    color: colors.primary[600],
  },
  breakdownPendingNeg: {
    color: colors.primary[400],
  },
  // Profit Result
  profitResultContainer: {
    backgroundColor: colors.success[50],
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  profitResultPending: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  profitResultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profitResultLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  profitResultValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  profitPositive: {
    color: colors.success[600],
  },
  profitNegative: {
    color: colors.error[600],
  },
  profitPending: {
    color: colors.primary[600],
  },
  marginIndicator: {
    marginTop: spacing.sm,
  },
  marginBar: {
    height: 4,
    backgroundColor: colors.success[400],
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
  marginText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
  },
  expectedMarginText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginTop: spacing.xs,
    textAlign: "right",
  },
  // Upcoming Card
  upcomingCard: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderStyle: "dashed",
  },
  emptyUpcoming: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyUpcomingText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  // Payment Status Grid
  paymentStatusGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statusCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  statusCardLeft: {
    marginRight: spacing.xs,
  },
  statusCardRight: {
    marginLeft: spacing.xs,
  },
  statusCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  statusCardTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginRight: spacing.sm,
  },
  statusDotSuccess: {
    backgroundColor: colors.success[500],
  },
  statusDotWarning: {
    backgroundColor: colors.warning[500],
  },
  statusLabel: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  statusValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  statusValueSuccess: {
    color: colors.success[600],
  },
  statusValueWarning: {
    color: colors.warning[600],
  },
  // Fee Tier Card
  feeTierCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  feeTierContent: {
    gap: spacing.sm,
  },
  feeTierMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tierBadgeSmall: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  tierBadgeStandard: {
    backgroundColor: colors.primary[100],
  },
  tierBadgePremium: {
    backgroundColor: colors.warning[100],
  },
  tierBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  tierBadgeTextStandard: {
    color: colors.primary[700],
  },
  tierBadgeTextPremium: {
    color: colors.warning[700],
  },
  feeRateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  feeTierProgressContainer: {
    gap: spacing.xs,
  },
  tierProgressBar: {
    height: 6,
    backgroundColor: colors.neutral[200],
    borderRadius: radius.full,
    overflow: "hidden",
  },
  tierProgressFill: {
    height: "100%",
    backgroundColor: colors.primary[500],
    borderRadius: radius.full,
  },
  tierProgressText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  // Elite Partner Banner Styles
  largeBusinessBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.success[50],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  largeBusinessBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  largeBusinessTrophyContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.warning[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  largeBusinessBannerTitleContainer: {
    flex: 1,
  },
  largeBusinessBannerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  largeBusinessBannerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    marginTop: 2,
  },
  largeBusinessBannerMessage: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  largeBusinessPerksRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  largeBizPerkCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: spacing.sm,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.sm,
  },
  largeBizPerkValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  largeBizPerkLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  // Elite Partner Promo Styles (non-qualified users)
  elitePartnerPromo: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.warning[200],
    ...shadows.sm,
  },
  elitePartnerPromoHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  elitePartnerPromoIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.warning[50],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  elitePartnerPromoTitleSection: {
    flex: 1,
  },
  elitePartnerPromoTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  elitePartnerPromoSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.xxs,
  },
  elitePartnerPromoProgress: {
    marginBottom: spacing.md,
  },
  elitePartnerPromoProgressBar: {
    height: 10,
    backgroundColor: colors.neutral[200],
    borderRadius: radius.full,
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  elitePartnerPromoProgressFill: {
    height: "100%",
    backgroundColor: colors.warning[500],
    borderRadius: radius.full,
  },
  elitePartnerPromoProgressText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
  },
  elitePartnerPromoUnlock: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  elitePartnerPromoBenefits: {
    gap: spacing.xs,
  },
  elitePartnerPromoBenefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  elitePartnerPromoBenefitText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  // Enhanced Tier Progress Styles
  tierProgressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  tierProgressTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  tierProgressSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  tierProgressBenefits: {
    marginTop: spacing.sm,
    gap: spacing.xxs,
  },
  tierBenefitItem: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  // Monthly Tracker Styles
  monthlyTrackerSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  monthlyTrackerCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  monthlyTrackerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  monthlyTrackerMonth: {
    width: 70,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  monthlyTrackerBarContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  monthlyTrackerBarQualified: {
    height: 24,
    backgroundColor: colors.success[500],
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  monthlyTrackerBarQualifiedText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    letterSpacing: 1,
  },
  monthlyTrackerBarProgress: {
    height: 24,
    backgroundColor: colors.neutral[200],
    borderRadius: radius.md,
    overflow: "hidden",
  },
  monthlyTrackerBarFill: {
    height: "100%",
    backgroundColor: colors.primary[400],
    borderRadius: radius.md,
  },
  monthlyTrackerStats: {
    flexDirection: "row",
    alignItems: "center",
    width: 50,
    justifyContent: "flex-end",
  },
  monthlyTrackerCleanings: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  monthlyTrackerCleaningsQualified: {
    color: colors.success[600],
    fontWeight: typography.fontWeight.bold,
  },
  bottomPadding: {
    height: spacing["4xl"],
  },
  // Enhanced Client Insights Styles
  clientStatsSummary: {
    flexDirection: "row",
    backgroundColor: colors.secondary[50],
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    justifyContent: "space-around",
  },
  clientStatItem: {
    alignItems: "center",
    gap: spacing.xxs,
  },
  clientStatValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  clientStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  clientInsightSection: {
    marginBottom: spacing.lg,
  },
  clientInsightSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xxs,
  },
  clientInsightSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  clientInsightSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  clientInsightSectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
  },
  atRiskCountBadge: {
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  atRiskCountText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[700],
  },
  clientInsightCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  topClientCard: {
    borderWidth: 2,
    borderColor: colors.primary[300],
    backgroundColor: colors.primary[50],
  },
  atRiskClientCard: {
    borderWidth: 1,
    borderColor: colors.warning[300],
    backgroundColor: colors.warning[50],
  },
  topClientBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
    gap: 4,
  },
  topClientBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    letterSpacing: 0.5,
  },
  atRiskClientBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.warning[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
    gap: 4,
  },
  atRiskClientBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    letterSpacing: 0.5,
  },
  clientInsightHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  clientRank: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  clientRankText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  clientInsightInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  clientInsightName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  clientInsightSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  loyaltyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  loyaltyBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  daysBadge: {
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  daysBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  clientInsightStats: {
    flexDirection: "row",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  clientInsightStatItem: {
    flex: 1,
  },
  clientInsightStatDivider: {
    width: 1,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing.md,
  },
  clientInsightStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xxs,
  },
  clientInsightStatValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  clientInsightStatValueMuted: {
    color: colors.text.secondary,
  },
  frequencyIndicator: {
    flexDirection: "row",
    gap: 4,
    marginTop: spacing.xxs,
  },
  frequencyDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[200],
  },
  frequencyDotFilled: {
    backgroundColor: colors.success[500],
  },
});

export default BusinessAnalyticsDashboard;
