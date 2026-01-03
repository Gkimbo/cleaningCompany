import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Feather";
import { UserContext } from "../../context/UserContext";
import { useSocket } from "../../services/SocketContext";
import SuspiciousReportsService from "../../services/fetchRequests/SuspiciousReportsService";
import SuspiciousReportCard from "./SuspiciousReportCard";
import SuspiciousReportDetailModal from "./SuspiciousReportDetailModal";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

/**
 * SuspiciousReportsPage
 *
 * Main page for HR/Owner to view and manage suspicious activity reports
 */
const SuspiciousReportsPage = () => {
  const navigation = useNavigation();
  const { state } = useContext(UserContext);
  const { onSuspiciousActivityReport, onSuspiciousReportUpdated } = useSocket();

  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const filters = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "reviewed", label: "Reviewed" },
    { id: "action_taken", label: "Action Taken" },
    { id: "dismissed", label: "Dismissed" },
  ];

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);

    try {
      const [reportsResult, statsResult] = await Promise.all([
        SuspiciousReportsService.getReports(state.currentUser.token, {
          status: selectedFilter === "all" ? undefined : selectedFilter,
          search: searchQuery || undefined,
        }),
        SuspiciousReportsService.getStats(state.currentUser.token),
      ]);

      setReports(reportsResult.reports || []);
      setStats(statsResult);
    } catch (error) {
      console.error("Error loading suspicious reports:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.currentUser.token, selectedFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for real-time updates via socket
  useEffect(() => {
    const unsubscribeNew = onSuspiciousActivityReport(() => {
      // Refresh the list when a new report is created
      loadData(true);
    });

    const unsubscribeUpdated = onSuspiciousReportUpdated(() => {
      // Refresh the list when a report is updated
      loadData(true);
    });

    return () => {
      unsubscribeNew();
      unsubscribeUpdated();
    };
  }, [onSuspiciousActivityReport, onSuspiciousReportUpdated, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleReportPress = (report) => {
    setSelectedReportId(report.id);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setSelectedReportId(null);
  };

  const handleActionTaken = () => {
    // Refresh the list after an action is taken
    loadData();
  };

  const getFilterCount = (filterId) => {
    if (!stats) return 0;
    switch (filterId) {
      case "all":
        return stats.pending + stats.reviewed + stats.dismissed + stats.actionTaken;
      case "pending":
        return stats.pending;
      case "reviewed":
        return stats.reviewed;
      case "action_taken":
        return stats.actionTaken;
      case "dismissed":
        return stats.dismissed;
      default:
        return 0;
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Back button and title */}
      <View style={styles.titleRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Suspicious Activity Reports</Text>
      </View>

      {/* Stats summary */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.warnedUsers}</Text>
            <Text style={styles.statLabel}>Warned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.suspendedUsers}</Text>
            <Text style={styles.statLabel}>Suspended</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.resolvedThisWeek}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
        </View>
      )}

      {/* Filter tabs */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filters}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterTab,
                selectedFilter === item.id && styles.filterTabActive,
              ]}
              onPress={() => setSelectedFilter(item.id)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  selectedFilter === item.id && styles.filterTabTextActive,
                ]}
              >
                {item.label}
              </Text>
              <View
                style={[
                  styles.filterBadge,
                  selectedFilter === item.id && styles.filterBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterBadgeText,
                    selectedFilter === item.id && styles.filterBadgeTextActive,
                  ]}
                >
                  {getFilterCount(item.id)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filtersContent}
        />
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={18} color={colors.text.tertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by user name..."
          placeholderTextColor={colors.text.tertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => loadData()}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Icon name="x" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="inbox" size={48} color={colors.neutral[300]} />
      <Text style={styles.emptyStateTitle}>No Reports Found</Text>
      <Text style={styles.emptyStateText}>
        {selectedFilter !== "all"
          ? `No ${selectedFilter.replace("_", " ")} reports found.`
          : searchQuery
          ? "No reports match your search."
          : "There are no suspicious activity reports yet."}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <SuspiciousReportCard report={item} onPress={handleReportPress} />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary[500]}
            />
          }
        />
      )}

      {/* Detail Modal */}
      <SuspiciousReportDetailModal
        visible={modalVisible}
        reportId={selectedReportId}
        onClose={handleModalClose}
        onActionTaken={handleActionTaken}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContainer: {
    backgroundColor: colors.white,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary[50],
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: "100%",
    backgroundColor: colors.primary[200],
  },
  filtersContainer: {
    marginBottom: spacing.sm,
  },
  filtersContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  filterTabActive: {
    backgroundColor: colors.primary[500],
  },
  filterTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  filterTabTextActive: {
    color: colors.white,
  },
  filterBadge: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.full,
    minWidth: 20,
    alignItems: "center",
  },
  filterBadgeActive: {
    backgroundColor: colors.primary[400],
  },
  filterBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
  },
  filterBadgeTextActive: {
    color: colors.white,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl * 2,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    textAlign: "center",
  },
});

export default SuspiciousReportsPage;
