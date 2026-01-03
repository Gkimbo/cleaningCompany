import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import CleanerClientService from "../../services/fetchRequests/CleanerClientService";
import ClientCard from "./ClientCard";
import InviteClientModal from "./InviteClientModal";
import BookForClientModal from "./BookForClientModal";
import SetupRecurringModal from "./SetupRecurringModal";

const MyClientsPage = ({ state }) => {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'active', 'pending'
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedClientForBooking, setSelectedClientForBooking] = useState(null);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [selectedClientForRecurring, setSelectedClientForRecurring] = useState(null);

  const fetchClients = useCallback(async () => {
    if (!state?.currentUser?.token) return;

    try {
      const status = activeTab === "all" ? null : activeTab === "pending" ? "pending_invite" : activeTab;
      const data = await CleanerClientService.getClients(
        state.currentUser.token,
        status
      );
      setClients(data.clients || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      Alert.alert("Error", "Failed to load clients");
    } finally {
      setIsLoading(false);
    }
  }, [state?.currentUser?.token, activeTab]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchClients();
    setRefreshing(false);
  };

  const handleResendInvite = async (client) => {
    try {
      const result = await CleanerClientService.resendInvite(
        state.currentUser.token,
        client.id
      );
      if (result.success) {
        Alert.alert("Success", "Invitation resent successfully");
      } else {
        Alert.alert("Error", result.error || "Failed to resend invitation");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to resend invitation");
    }
  };

  const handleClientPress = (client) => {
    // TODO: Navigate to client detail page
    console.log("Client pressed:", client);
  };

  const handleInviteSuccess = () => {
    setShowInviteModal(false);
    fetchClients();
  };

  const handleBookCleaning = (client) => {
    setSelectedClientForBooking(client);
    setShowBookingModal(true);
  };

  const handleBookingSuccess = () => {
    setShowBookingModal(false);
    setSelectedClientForBooking(null);
    // Optionally refresh clients to update any state
    fetchClients();
  };

  const handleSetupRecurring = (client) => {
    setSelectedClientForRecurring(client);
    setShowRecurringModal(true);
  };

  const handleRecurringSuccess = () => {
    setShowRecurringModal(false);
    setSelectedClientForRecurring(null);
    fetchClients();
  };

  const filteredClients = clients.filter((client) => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return client.status === "active";
    if (activeTab === "pending") return client.status === "pending_invite";
    return true;
  });

  const activeCount = clients.filter((c) => c.status === "active").length;
  const pendingCount = clients.filter((c) => c.status === "pending_invite").length;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading clients...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Clients</Text>
          <Text style={styles.headerSubtitle}>
            Manage your existing clients and invite new ones
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
          onPress={() => setShowInviteModal(true)}
        >
          <Feather name="user-plus" size={20} color={colors.neutral[0]} />
          <Text style={styles.addButtonText}>Add Client</Text>
        </Pressable>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.activeStatCard]}>
          <View style={styles.statHeader}>
            <Feather name="users" size={18} color="rgba(255,255,255,0.9)" />
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <Text style={styles.statValue}>{activeCount}</Text>
        </View>
        <View style={[styles.statCard, styles.pendingStatCard]}>
          <View style={styles.statHeader}>
            <Feather name="clock" size={18} color="rgba(255,255,255,0.9)" />
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <Text style={styles.statValue}>{pendingCount}</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { key: "all", label: "All", count: clients.length },
          { key: "active", label: "Active", count: activeCount },
          { key: "pending", label: "Pending", count: pendingCount },
        ].map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  activeTab === tab.key && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === tab.key && styles.tabBadgeTextActive,
                  ]}
                >
                  {tab.count}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Client List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[600]}
          />
        }
      >
        {filteredClients.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Feather
                name={activeTab === "pending" ? "clock" : "users"}
                size={40}
                color={colors.neutral[400]}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === "pending"
                ? "No pending invitations"
                : activeTab === "active"
                ? "No active clients yet"
                : "No clients yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "pending"
                ? "Invitations you send will appear here"
                : "Add your existing clients to get started"}
            </Text>
            {activeTab !== "pending" && (
              <Pressable
                style={({ pressed }) => [
                  styles.emptyButton,
                  pressed && styles.emptyButtonPressed,
                ]}
                onPress={() => setShowInviteModal(true)}
              >
                <Feather name="user-plus" size={18} color={colors.neutral[0]} />
                <Text style={styles.emptyButtonText}>Invite Your First Client</Text>
              </Pressable>
            )}
          </View>
        ) : (
          filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onPress={handleClientPress}
              onResendInvite={handleResendInvite}
              onBookCleaning={handleBookCleaning}
              onSetupRecurring={handleSetupRecurring}
            />
          ))
        )}
      </ScrollView>

      {/* Invite Modal */}
      <InviteClientModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={handleInviteSuccess}
        token={state?.currentUser?.token}
      />

      {/* Booking Modal */}
      <BookForClientModal
        visible={showBookingModal}
        onClose={() => {
          setShowBookingModal(false);
          setSelectedClientForBooking(null);
        }}
        onSuccess={handleBookingSuccess}
        client={selectedClientForBooking}
        token={state?.currentUser?.token}
      />

      {/* Recurring Schedule Modal */}
      <SetupRecurringModal
        visible={showRecurringModal}
        onClose={() => {
          setShowRecurringModal(false);
          setSelectedClientForRecurring(null);
        }}
        onSuccess={handleRecurringSuccess}
        client={selectedClientForRecurring}
        token={state?.currentUser?.token}
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
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.neutral[500],
    fontSize: typography.fontSize.sm,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  addButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  addButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  activeStatCard: {
    backgroundColor: colors.primary[600],
  },
  pendingStatCard: {
    backgroundColor: colors.warning[500],
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  statValue: {
    color: colors.neutral[0],
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
  },

  // Tab Bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primary[600],
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.neutral[0],
  },
  tabBadge: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  tabBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  tabBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  tabBadgeTextActive: {
    color: colors.neutral[0],
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: 0,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    padding: spacing["3xl"],
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    ...shadows.md,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  emptyButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  emptyButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default MyClientsPage;
