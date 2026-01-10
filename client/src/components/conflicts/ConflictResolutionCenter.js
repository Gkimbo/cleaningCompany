import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome";
import { AuthContext } from "../../services/AuthContext";
import ConflictService from "../../services/fetchRequests/ConflictService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const ConflictResolutionCenter = () => {
  const { user } = useContext(AuthContext);
  const navigation = useNavigation();

  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    caseType: null,
    status: null,
    priority: null,
  });

  const fetchData = useCallback(async () => {
    try {
      const [queueResult, statsResult] = await Promise.all([
        ConflictService.getQueue(user.token, {
          ...filters,
          search: search || undefined,
        }),
        ConflictService.getStats(user.token),
      ]);

      if (queueResult.success) {
        setCases(queueResult.cases || []);
      }
      if (statsResult.success) {
        setStats(statsResult);
      }
    } catch (err) {
      console.error("Failed to fetch conflict data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.token, filters, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCasePress = (caseItem) => {
    navigation.navigate("ConflictCaseView", {
      caseId: caseItem.id,
      caseType: caseItem.caseType,
    });
  };

  const formatTimeRemaining = (seconds) => {
    if (!seconds || seconds <= 0) return "Overdue";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (status) => {
    const statusColors = {
      submitted: colors.warning[500],
      under_review: colors.primary[500],
      awaiting_documents: colors.warning[600],
      escalated: colors.error[500],
      pending_homeowner: colors.warning[500],
      pending_owner: colors.warning[600],
      approved: colors.success[500],
      owner_approved: colors.success[500],
      denied: colors.error[500],
      owner_denied: colors.error[500],
      partially_approved: colors.primary[500],
    };
    return statusColors[status] || colors.neutral[500];
  };

  const getPriorityColor = (priority) => {
    const priorityColors = {
      urgent: colors.error[500],
      high: colors.warning[500],
      normal: colors.neutral[400],
    };
    return priorityColors[priority] || colors.neutral[400];
  };

  const renderStatsHeader = () => {
    if (!stats) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.primary[100] }]}>
            <Icon name="folder-open" size={18} color={colors.primary[600]} />
          </View>
          <Text style={styles.statNumber}>{stats.totalPending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: stats.slaBreachCount > 0 ? colors.error[100] : colors.neutral[100] }]}>
            <Icon
              name="exclamation-triangle"
              size={18}
              color={stats.slaBreachCount > 0 ? colors.error[600] : colors.neutral[400]}
            />
          </View>
          <Text style={[styles.statNumber, stats.slaBreachCount > 0 && { color: colors.error[600] }]}>
            {stats.slaBreachCount}
          </Text>
          <Text style={styles.statLabel}>SLA Breach</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.warning[100] }]}>
            <Icon name="flag" size={18} color={colors.warning[600]} />
          </View>
          <Text style={styles.statNumber}>{stats.appeals?.urgent || 0}</Text>
          <Text style={styles.statLabel}>Urgent</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.success[100] }]}>
            <Icon name="check" size={18} color={colors.success[600]} />
          </View>
          <Text style={[styles.statNumber, { color: colors.success[600] }]}>
            {stats.appeals?.resolvedThisWeek || 0}
          </Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </View>
    );
  };

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={16} color={colors.text.tertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search cases..."
          placeholderTextColor={colors.text.tertiary}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={fetchData}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(""); fetchData(); }}>
            <Icon name="times-circle" size={16} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterChips}
        contentContainerStyle={styles.filterChipsContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, !filters.caseType && styles.filterChipActive]}
          onPress={() => setFilters(f => ({ ...f, caseType: null }))}
        >
          <Text style={[styles.filterChipText, !filters.caseType && styles.filterChipTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filters.caseType === "appeal" && styles.filterChipActive]}
          onPress={() => setFilters(f => ({ ...f, caseType: "appeal" }))}
        >
          <Icon name="gavel" size={12} color={filters.caseType === "appeal" ? colors.neutral[0] : colors.text.secondary} style={{ marginRight: 4 }} />
          <Text style={[styles.filterChipText, filters.caseType === "appeal" && styles.filterChipTextActive]}>Appeals</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filters.caseType === "adjustment" && styles.filterChipActive]}
          onPress={() => setFilters(f => ({ ...f, caseType: "adjustment" }))}
        >
          <Icon name="home" size={12} color={filters.caseType === "adjustment" ? colors.neutral[0] : colors.text.secondary} style={{ marginRight: 4 }} />
          <Text style={[styles.filterChipText, filters.caseType === "adjustment" && styles.filterChipTextActive]}>Adjustments</Text>
        </TouchableOpacity>
        <View style={styles.filterDivider} />
        <TouchableOpacity
          style={[styles.filterChip, filters.priority === "urgent" && styles.filterChipUrgent]}
          onPress={() => setFilters(f => ({ ...f, priority: f.priority === "urgent" ? null : "urgent" }))}
        >
          <Icon name="flag" size={12} color={filters.priority === "urgent" ? colors.neutral[0] : colors.error[500]} style={{ marginRight: 4 }} />
          <Text style={[styles.filterChipText, filters.priority === "urgent" && styles.filterChipTextActive]}>Urgent</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderCaseCard = ({ item }) => (
    <TouchableOpacity
      style={styles.caseCard}
      onPress={() => handleCasePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.caseHeader}>
        <View style={styles.caseTypeContainer}>
          <View style={[styles.caseTypeBadge, { backgroundColor: item.caseType === "appeal" ? colors.primary[100] : colors.warning[100] }]}>
            <Icon
              name={item.caseType === "appeal" ? "gavel" : "home"}
              size={12}
              color={item.caseType === "appeal" ? colors.primary[600] : colors.warning[600]}
            />
            <Text style={[styles.caseTypeText, { color: item.caseType === "appeal" ? colors.primary[600] : colors.warning[600] }]}>
              {item.caseNumber}
            </Text>
          </View>
          <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(item.priority) }]} />
        </View>

        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.replace(/_/g, " ")}
          </Text>
        </View>
      </View>

      <Text style={styles.caseDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.partiesRow}>
        {item.homeowner && (
          <View style={styles.partyChip}>
            <Icon name="user" size={10} color={colors.text.tertiary} />
            <Text style={styles.partyName} numberOfLines={1}>{item.homeowner.name}</Text>
          </View>
        )}
        {item.cleaner && (
          <View style={styles.partyChip}>
            <Icon name="star" size={10} color={colors.text.tertiary} />
            <Text style={styles.partyName} numberOfLines={1}>{item.cleaner.name}</Text>
          </View>
        )}
      </View>

      <View style={styles.caseFooter}>
        <View style={styles.slaContainer}>
          <Icon
            name="clock-o"
            size={12}
            color={item.isPastSLA ? colors.error[500] : colors.text.tertiary}
          />
          <Text style={[styles.slaText, item.isPastSLA && styles.slaTextOverdue]}>
            {formatTimeRemaining(item.timeUntilSLA)}
          </Text>
        </View>

        {item.financialImpact && (
          <View style={styles.financialBadge}>
            <Icon name="usd" size={10} color={colors.success[600]} />
            <Text style={styles.financialText}>
              {item.financialImpact.priceDifference
                ? `$${(item.financialImpact.priceDifference / 100).toFixed(0)}`
                : item.financialImpact.penaltyAmount
                  ? `$${(item.financialImpact.penaltyAmount / 100).toFixed(0)}`
                  : ""
              }
            </Text>
          </View>
        )}

        <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading conflicts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="balance-scale" size={24} color={colors.primary[600]} />
          <Text style={styles.title}>Conflict Resolution</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Icon name="refresh" size={18} color={colors.primary[600]} />
        </TouchableOpacity>
      </View>

      {renderStatsHeader()}
      {renderFilters()}

      {cases.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="check-circle" size={48} color={colors.success[400]} />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptyText}>No pending conflicts to review.</Text>
        </View>
      ) : (
        <FlatList
          data={cases}
          renderItem={renderCaseCard}
          keyExtractor={(item) => `${item.caseType}-${item.id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary[500]]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  refreshButton: {
    padding: spacing.sm,
  },
  statsContainer: {
    flexDirection: "row",
    padding: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  statNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  filtersContainer: {
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  filterChips: {
    marginTop: spacing.sm,
  },
  filterChipsContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
  },
  filterChipActive: {
    backgroundColor: colors.primary[500],
  },
  filterChipUrgent: {
    backgroundColor: colors.error[500],
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: colors.neutral[0],
  },
  filterDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.xs,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  caseCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  caseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  caseTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  caseTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  caseTypeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: "capitalize",
  },
  caseDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  partiesRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  partyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    maxWidth: "45%",
  },
  partyName: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  caseFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  slaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  slaText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  slaTextOverdue: {
    color: colors.error[500],
    fontWeight: typography.fontWeight.semibold,
  },
  financialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  financialText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
});

export default ConflictResolutionCenter;
