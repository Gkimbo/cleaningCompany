import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Application from "../../../services/fetchRequests/ApplicationClass";
import FetchData from "../../../services/fetchRequests/fetchData";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import ApplicationTile from "./ApplicationTile";

const { width } = Dimensions.get("window");

// Status configuration
const STATUS_CONFIG = {
  pending: { label: "Pending", color: colors.warning[500], bgColor: colors.warning[50] },
  under_review: { label: "Under Review", color: colors.primary[500], bgColor: colors.primary[50] },
  background_check: { label: "Background Check", color: colors.secondary[500], bgColor: colors.secondary[50] },
  approved: { label: "Approved", color: colors.success[500], bgColor: colors.success[50] },
  rejected: { label: "Rejected", color: colors.error[500], bgColor: colors.error[50] },
  hired: { label: "Hired", color: colors.success[700], bgColor: colors.success[100] },
};

const ListOfApplications = ({ state }) => {
  const [applications, setApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [stats, setStats] = useState({});

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    filterApplications();
  }, [applications, searchQuery, selectedStatus]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const token = state?.currentUser?.token;
      const response = await FetchData.getApplicationsFromBackend(token);
      const apps = response.serializedApplications || [];
      setApplications(apps);
      calculateStats(apps);
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (apps) => {
    const counts = {
      total: apps.length,
      pending: 0,
      under_review: 0,
      background_check: 0,
      approved: 0,
      rejected: 0,
      hired: 0,
    };
    apps.forEach((app) => {
      const status = app.status || "pending";
      if (counts[status] !== undefined) counts[status]++;
    });
    setStats(counts);
  };

  const filterApplications = () => {
    let filtered = [...applications];

    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter((app) => (app.status || "pending") === selectedStatus);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.firstName?.toLowerCase().includes(query) ||
          app.lastName?.toLowerCase().includes(query) ||
          app.email?.toLowerCase().includes(query) ||
          app.phone?.includes(query)
      );
    }

    setFilteredApplications(filtered);
  };

  const handleDeleteApplication = async (id) => {
    try {
      const token = state?.currentUser?.token;
      await Application.deleteApplication(id, token);
      await fetchApplications();
    } catch (error) {
      console.error("Error deleting application:", error);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const token = state?.currentUser?.token;
      await Application.updateApplicationStatus(id, newStatus, token);
      await fetchApplications();
    } catch (error) {
      console.error("Error updating status:", error);
      Alert.alert("Error", error.message || "Failed to update status");
    }
  };

  const handleUpdateNotes = async (id, adminNotes) => {
    try {
      const token = state?.currentUser?.token;
      await Application.updateApplicationNotes(id, adminNotes, token);
    } catch (error) {
      console.error("Error updating notes:", error);
      throw error;
    }
  };

  const StatusFilterButton = ({ status, label, count }) => {
    const isSelected = selectedStatus === status;
    const config = status === "all" ? { color: colors.text.primary, bgColor: colors.neutral[100] } : STATUS_CONFIG[status];

    return (
      <Pressable
        onPress={() => setSelectedStatus(status)}
        style={[
          styles.filterButton,
          isSelected && { backgroundColor: config.bgColor, borderColor: config.color },
        ]}
      >
        <Text style={[styles.filterButtonText, isSelected && { color: config.color }]}>
          {label}
        </Text>
        <View style={[styles.filterBadge, { backgroundColor: isSelected ? config.color : colors.neutral[200] }]}>
          <Text style={[styles.filterBadgeText, { color: isSelected ? colors.neutral[0] : colors.text.secondary }]}>
            {count}
          </Text>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading applications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Search */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Applications</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{stats.total}</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, or phone..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </Pressable>
          )}
        </View>

        {/* Status Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          <StatusFilterButton status="all" label="All" count={stats.total} />
          <StatusFilterButton status="pending" label="Pending" count={stats.pending || 0} />
          <StatusFilterButton status="under_review" label="Review" count={stats.under_review || 0} />
          <StatusFilterButton status="background_check" label="Background" count={stats.background_check || 0} />
          <StatusFilterButton status="approved" label="Approved" count={stats.approved || 0} />
          <StatusFilterButton status="hired" label="Hired" count={stats.hired || 0} />
          <StatusFilterButton status="rejected" label="Rejected" count={stats.rejected || 0} />
        </ScrollView>
      </View>

      {/* Applications List */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredApplications.length > 0 ? (
          filteredApplications.map((application) => (
            <ApplicationTile
              key={application.id}
              application={application}
              onDelete={handleDeleteApplication}
              onUpdateStatus={handleUpdateStatus}
              onUpdateNotes={handleUpdateNotes}
              onRefresh={fetchApplications}
              statusConfig={STATUS_CONFIG}
              token={state?.currentUser?.token}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No Applications Found</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery || selectedStatus !== "all"
                ? "Try adjusting your filters or search query."
                : "New applications will appear here."}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.tertiary,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerBadge: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  headerBadgeText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  clearButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  clearButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  // Filters
  filtersContent: {
    gap: spacing.sm,
    flexDirection: "row",
    paddingBottom: spacing.xs,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border.light,
    backgroundColor: colors.neutral[0],
    gap: spacing.sm,
  },
  filterButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.semibold,
  },
  filterBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    minWidth: 24,
    alignItems: "center",
  },
  filterBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  // List
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["4xl"],
    paddingHorizontal: spacing.xl,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    textAlign: "center",
  },
});

export default ListOfApplications;
