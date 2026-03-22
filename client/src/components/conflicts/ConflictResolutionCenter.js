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
import { useNavigate } from "react-router-native";
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
  const navigate = useNavigate();

  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [lookupMode, setLookupMode] = useState(false); // Toggle between search and lookup
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [filters, setFilters] = useState({
    caseType: null,
    status: null,
    priority: null,
    includeResolved: false,
  });

  // Check if a string looks like a case number
  const isCaseNumber = (str) => {
    const caseNumberPattern = /^(APL|ADJ|PD|ST)-\d{8}-[A-Z0-9]{5}$/i;
    return caseNumberPattern.test(str.trim().toUpperCase());
  };

  // Handle quick lookup (case number or user search)
  const handleQuickLookup = async () => {
    const query = lookupQuery.trim();
    if (!query) return;

    setLookupLoading(true);
    setLookupError(null);

    try {
      if (isCaseNumber(query)) {
        // Direct case number lookup
        const result = await ConflictService.lookupByNumber(user.token, query);
        if (result.success && result.case) {
          navigate(`/conflicts/${result.case.caseType}/${result.case.id}`);
          setLookupQuery("");
        } else {
          setLookupError(`Case "${query.toUpperCase()}" not found. Please check the case number and try again.`);
        }
      } else {
        // User search (email, phone, or ID)
        const result = await ConflictService.searchUserCases(user.token, query);
        if (result.success && result.users?.length > 0) {
          navigate("/conflicts/user-cases", {
            state: { users: result.users, searchQuery: query }
          });
          setLookupQuery("");
        } else if (result.success && result.users?.length === 0) {
          setLookupError(`No users found matching "${query}". Try searching by email, phone number, or user ID.`);
        } else {
          setLookupError(result.error || "Search failed. Please try again.");
        }
      }
    } catch (err) {
      setLookupError("Something went wrong. Please check your connection and try again.");
    } finally {
      setLookupLoading(false);
    }
  };

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
    navigate(`/conflicts/${caseItem.caseType}/${caseItem.id}`);
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
      pending_info: colors.warning[600],
      approved: colors.success[500],
      owner_approved: colors.success[500],
      denied: colors.error[500],
      owner_denied: colors.error[500],
      partially_approved: colors.primary[500],
      resolved: colors.success[500],
      closed: colors.neutral[500],
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
      {/* Mode Toggle */}
      <View style={styles.modeToggleContainer}>
        <TouchableOpacity
          style={[styles.modeToggle, !lookupMode && styles.modeToggleActive]}
          onPress={() => setLookupMode(false)}
        >
          <Icon name="list" size={14} color={!lookupMode ? colors.neutral[0] : colors.text.secondary} />
          <Text style={[styles.modeToggleText, !lookupMode && styles.modeToggleTextActive]}>Queue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeToggle, lookupMode && styles.modeToggleActive]}
          onPress={() => setLookupMode(true)}
        >
          <Icon name="bolt" size={14} color={lookupMode ? colors.neutral[0] : colors.text.secondary} />
          <Text style={[styles.modeToggleText, lookupMode && styles.modeToggleTextActive]}>Quick Lookup</Text>
        </TouchableOpacity>
      </View>

      {lookupMode ? (
        <View style={styles.lookupContainer}>
          <Text style={styles.searchLabel}>Quick Lookup</Text>
          <View style={styles.searchRow}>
            <View style={styles.lookupInputContainer}>
              <Icon name="bolt" size={18} color={colors.primary[500]} />
              <TextInput
                style={styles.searchInput}
                placeholder="Case # or email/phone/user ID..."
                placeholderTextColor={colors.text.secondary}
                value={lookupQuery}
                onChangeText={(text) => { setLookupQuery(text); setLookupError(null); }}
                onSubmitEditing={handleQuickLookup}
                autoCapitalize="none"
              />
              {lookupQuery.length > 0 && !lookupLoading && (
                <TouchableOpacity onPress={() => { setLookupQuery(""); setLookupError(null); }}>
                  <Icon name="times-circle" size={18} color={colors.neutral[400]} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.searchButton, (!lookupQuery.trim() || lookupLoading) && styles.searchButtonDisabled]}
              onPress={handleQuickLookup}
              disabled={!lookupQuery.trim() || lookupLoading}
            >
              {lookupLoading ? (
                <ActivityIndicator size="small" color={colors.neutral[0]} />
              ) : (
                <>
                  <Icon name="search" size={16} color={colors.neutral[0]} />
                  <Text style={styles.searchButtonText}>Go</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {lookupError && (
            <View style={styles.lookupErrorContainer}>
              <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
              <Text style={styles.lookupErrorText}>{lookupError}</Text>
            </View>
          )}
          <Text style={styles.lookupHint}>
            Enter a case number to jump directly, or search by email/phone to see all cases for a user
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.searchWrapper}>
            <Text style={styles.searchLabel}>Search Queue</Text>
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <Icon name="search" size={18} color={colors.primary[500]} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Name, email, phone, case #..."
                  placeholderTextColor={colors.text.secondary}
                  value={search}
                  onChangeText={setSearch}
                  onSubmitEditing={fetchData}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearch(""); fetchData(); }}>
                    <Icon name="times-circle" size={18} color={colors.neutral[400]} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.searchButton}
                onPress={fetchData}
              >
                <Icon name="search" size={16} color={colors.neutral[0]} />
                <Text style={styles.searchButtonText}>Search</Text>
              </TouchableOpacity>
            </View>
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
        <TouchableOpacity
          style={[styles.filterChip, filters.caseType === "payment" && styles.filterChipActive]}
          onPress={() => setFilters(f => ({ ...f, caseType: "payment" }))}
        >
          <Icon name="usd" size={12} color={filters.caseType === "payment" ? colors.neutral[0] : colors.text.secondary} style={{ marginRight: 4 }} />
          <Text style={[styles.filterChipText, filters.caseType === "payment" && styles.filterChipTextActive]}>Payments</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filters.caseType === "support" && styles.filterChipActive]}
          onPress={() => setFilters(f => ({ ...f, caseType: "support" }))}
        >
          <Icon name="life-ring" size={12} color={filters.caseType === "support" ? colors.neutral[0] : colors.text.secondary} style={{ marginRight: 4 }} />
          <Text style={[styles.filterChipText, filters.caseType === "support" && styles.filterChipTextActive]}>Support</Text>
        </TouchableOpacity>
        <View style={styles.filterDivider} />
        <TouchableOpacity
          style={[styles.filterChip, filters.priority === "urgent" && styles.filterChipUrgent]}
          onPress={() => setFilters(f => ({ ...f, priority: f.priority === "urgent" ? null : "urgent" }))}
        >
          <Icon name="flag" size={12} color={filters.priority === "urgent" ? colors.neutral[0] : colors.error[500]} style={{ marginRight: 4 }} />
          <Text style={[styles.filterChipText, filters.priority === "urgent" && styles.filterChipTextActive]}>Urgent</Text>
        </TouchableOpacity>
        <View style={styles.filterDivider} />
        <TouchableOpacity
          style={[styles.filterChip, filters.includeResolved && styles.filterChipArchive]}
          onPress={() => setFilters(f => ({ ...f, includeResolved: !f.includeResolved }))}
        >
          <Icon name="archive" size={12} color={filters.includeResolved ? colors.neutral[0] : colors.text.secondary} style={{ marginRight: 4 }} />
          <Text style={[styles.filterChipText, filters.includeResolved && styles.filterChipTextActive]}>Archive</Text>
        </TouchableOpacity>
      </ScrollView>
        </>
      )}
    </View>
  );

  const getCaseTypeColors = (caseType) => {
    const colorMap = {
      appeal: { bg: colors.primary[100], text: colors.primary[600] },
      payment: { bg: colors.error[100], text: colors.error[600] },
      adjustment: { bg: colors.warning[100], text: colors.warning[600] },
      support: { bg: colors.secondary[100], text: colors.secondary[600] },
    };
    return colorMap[caseType] || { bg: colors.neutral[100], text: colors.neutral[600] };
  };

  const getCaseTypeIcon = (caseType) => {
    const iconMap = {
      appeal: "gavel",
      payment: "dollar",
      adjustment: "home",
      support: "life-ring",
    };
    return iconMap[caseType] || "question";
  };

  const isResolvedStatus = (status) => {
    return ["approved", "partially_approved", "denied", "resolved", "closed", "owner_approved", "owner_denied", "expired"].includes(status);
  };

  const renderCaseCard = ({ item }) => {
    const caseColors = getCaseTypeColors(item.caseType);
    const caseIcon = getCaseTypeIcon(item.caseType);
    const isOverdue = item.isPastSLA;
    const isResolved = isResolvedStatus(item.status);

    return (
      <TouchableOpacity
        style={[styles.caseCard, isOverdue && styles.caseCardOverdue, isResolved && styles.caseCardResolved]}
        onPress={() => handleCasePress(item)}
        activeOpacity={0.7}
      >
        {/* Left accent bar */}
        <View style={[styles.caseAccent, { backgroundColor: isResolved ? colors.neutral[300] : caseColors.text }]} />

        <View style={styles.caseContent}>
          {/* Top row: case type icon, number, priority, status */}
          <View style={styles.caseHeader}>
            <View style={styles.caseHeaderLeft}>
              <View style={[styles.caseIconCircle, { backgroundColor: caseColors.bg }]}>
                <Icon name={caseIcon} size={14} color={caseColors.text} />
              </View>
              <View style={styles.caseNumberContainer}>
                <Text style={styles.caseNumber}>{item.caseNumber}</Text>
                <Text style={styles.caseType}>{item.caseType}</Text>
              </View>
              {item.priority === "urgent" && (
                <View style={styles.urgentBadge}>
                  <Icon name="bolt" size={10} color={colors.neutral[0]} />
                  <Text style={styles.urgentText}>URGENT</Text>
                </View>
              )}
              {item.priority === "high" && (
                <View style={styles.highPriorityBadge}>
                  <Icon name="flag" size={10} color={colors.warning[700]} />
                </View>
              )}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "15" }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.replace(/_/g, " ")}
              </Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.caseDescription} numberOfLines={2}>
            {item.description}
          </Text>

          {/* Parties */}
          <View style={styles.partiesRow}>
            {item.homeowner && (
              <View style={styles.partyChip}>
                <View style={styles.partyIconCircle}>
                  <Icon name="user" size={10} color={colors.primary[600]} />
                </View>
                <Text style={styles.partyName} numberOfLines={1}>{item.homeowner.name}</Text>
              </View>
            )}
            {item.cleaner && (
              <View style={styles.partyChip}>
                <View style={[styles.partyIconCircle, { backgroundColor: colors.secondary[100] }]}>
                  <Icon name="star" size={10} color={colors.secondary[600]} />
                </View>
                <Text style={styles.partyName} numberOfLines={1}>{item.cleaner.name}</Text>
              </View>
            )}
          </View>

          {/* Footer: SLA, financial, arrow */}
          <View style={styles.caseFooter}>
            <View style={[styles.slaContainer, isOverdue && styles.slaContainerOverdue]}>
              <Icon
                name={isOverdue ? "exclamation-circle" : "clock-o"}
                size={12}
                color={isOverdue ? colors.error[600] : colors.text.tertiary}
              />
              <Text style={[styles.slaText, isOverdue && styles.slaTextOverdue]}>
                {formatTimeRemaining(item.timeUntilSLA)}
              </Text>
            </View>

            <View style={styles.footerRight}>
              {item.financialImpact && (
                <View style={styles.financialBadge}>
                  <Icon name="dollar" size={11} color={colors.success[600]} />
                  <Text style={styles.financialText}>
                    {item.financialImpact.priceDifference
                      ? `${(item.financialImpact.priceDifference / 100).toFixed(0)}`
                      : item.financialImpact.penaltyAmount
                        ? `${(item.financialImpact.penaltyAmount / 100).toFixed(0)}`
                        : ""
                    }
                  </Text>
                </View>
              )}
              <View style={styles.viewButton}>
                <Text style={styles.viewButtonText}>View</Text>
                <Icon name="chevron-right" size={12} color={colors.primary[600]} />
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
  modeToggleContainer: {
    flexDirection: "row",
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: 4,
  },
  modeToggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  modeToggleActive: {
    backgroundColor: colors.primary[500],
  },
  modeToggleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  modeToggleTextActive: {
    color: colors.neutral[0],
  },
  lookupContainer: {
    paddingHorizontal: spacing.md,
  },
  lookupInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary[300],
    gap: spacing.sm,
    flex: 1,
    minHeight: 52,
    ...shadows.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  searchButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  searchButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  lookupErrorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  lookupErrorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.error[700],
  },
  lookupHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  searchWrapper: {
    paddingHorizontal: spacing.md,
  },
  searchLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.neutral[200],
    gap: spacing.sm,
    minHeight: 52,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
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
  filterChipArchive: {
    backgroundColor: colors.neutral[600],
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
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
    flexDirection: "row",
    overflow: "hidden",
    ...shadows.md,
  },
  caseCardOverdue: {
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  caseCardResolved: {
    opacity: 0.75,
    backgroundColor: colors.neutral[50],
  },
  caseAccent: {
    width: 4,
  },
  caseContent: {
    flex: 1,
    padding: spacing.md,
    paddingLeft: spacing.md,
    gap: spacing.sm,
  },
  caseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  caseHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  caseIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  caseNumberContainer: {
    flex: 1,
  },
  caseNumber: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    letterSpacing: 0.3,
  },
  caseType: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textTransform: "capitalize",
    marginTop: 1,
  },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.error[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.md,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    letterSpacing: 0.5,
  },
  highPriorityBadge: {
    backgroundColor: colors.warning[100],
    padding: spacing.xs,
    borderRadius: radius.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: "capitalize",
  },
  caseDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  partiesRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  partyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.neutral[50],
    paddingRight: spacing.sm,
    paddingVertical: 4,
    paddingLeft: 4,
    borderRadius: radius.full,
    maxWidth: "48%",
  },
  partyIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  partyName: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  caseFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginTop: spacing.xs,
  },
  slaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  slaContainerOverdue: {
    backgroundColor: colors.error[50],
  },
  slaText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },
  slaTextOverdue: {
    color: colors.error[600],
    fontWeight: typography.fontWeight.semibold,
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  financialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  financialText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    fontWeight: typography.fontWeight.bold,
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  viewButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
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
