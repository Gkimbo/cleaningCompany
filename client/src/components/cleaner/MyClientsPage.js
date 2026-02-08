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
import { useNavigate } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { API_BASE } from "../../services/config";
import CleanerClientService from "../../services/fetchRequests/CleanerClientService";
import MessageClass from "../../services/fetchRequests/MessageClass";
import ClientCard from "./ClientCard";
import InviteClientModal from "./InviteClientModal";
import BookForClientModal from "./BookForClientModal";
import SetupRecurringModal from "./SetupRecurringModal";
import { usePricing } from "../../context/PricingContext";

// Payment Setup Banner Component
const PaymentSetupBanner = ({ onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.paymentBanner,
      pressed && styles.paymentBannerPressed,
    ]}
  >
    <View style={styles.paymentBannerIcon}>
      <Icon name="credit-card" size={20} color={colors.warning[600]} />
    </View>
    <View style={styles.paymentBannerContent}>
      <Text style={styles.paymentBannerTitle}>Complete Payment Setup</Text>
      <Text style={styles.paymentBannerSubtitle}>
        Set up your bank account to receive payments from your clients
      </Text>
    </View>
    <View style={styles.paymentBannerAction}>
      <Text style={styles.paymentBannerActionText}>Set Up</Text>
      <Icon name="chevron-right" size={12} color={colors.primary[600]} />
    </View>
  </Pressable>
);

const MyClientsPage = ({ state }) => {
  const navigate = useNavigate();
  const { pricing } = usePricing();
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'active', 'pending'
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedClientForBooking, setSelectedClientForBooking] = useState(null);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [selectedClientForRecurring, setSelectedClientForRecurring] = useState(null);

  // Stripe account status for payment setup banner
  const [showPaymentBanner, setShowPaymentBanner] = useState(false);

  // Calculate platform price for a client based on their home's beds/baths
  const calculatePlatformPrice = useCallback((client) => {
    if (!pricing?.basePrice) return null;

    // Use invitedBeds/invitedBaths for pending clients, or home data for active clients
    const beds = client.invitedBeds || client.home?.numBeds;
    const baths = client.invitedBaths || client.home?.numBaths;

    if (!beds || !baths) return null;

    const numBeds = parseInt(beds) || 1;
    const numBaths = parseFloat(baths) || 1;

    const basePrice = pricing.basePrice || 150;
    const extraBedBathFee = pricing.extraBedBathFee || 50;
    const halfBathFee = pricing.halfBathFee || 25;

    const extraBeds = Math.max(0, numBeds - 1);
    const fullBaths = Math.floor(numBaths);
    const halfBaths = numBaths % 1 >= 0.5 ? 1 : 0;
    const extraFullBaths = Math.max(0, fullBaths - 1);

    return basePrice +
           (extraBeds * extraBedBathFee) +
           (extraFullBaths * extraBedBathFee) +
           (halfBaths * halfBathFee);
  }, [pricing]);

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

  // Fetch Stripe account status to determine if banner should show
  const fetchStripeAccountStatus = useCallback(async () => {
    if (!state?.currentUser?.id) return;

    try {
      const res = await fetch(
        `${API_BASE}/stripe-connect/account-status/${state.currentUser.id}`
      );
      const data = await res.json();

      if (res.ok) {
        // Show banner if account doesn't exist or onboarding isn't complete
        setShowPaymentBanner(!data.hasAccount || !data.onboardingComplete);
      }
    } catch (err) {
      console.log("[MyClientsPage] Error fetching Stripe status:", err.message);
      // If we can't fetch status, show the banner to be safe
      setShowPaymentBanner(true);
    }
  }, [state?.currentUser?.id]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    if (state?.currentUser?.token) {
      fetchStripeAccountStatus();
    }
  }, [state?.currentUser?.token, fetchStripeAccountStatus]);

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

  const handleDeleteInvitation = (client) => {
    Alert.alert(
      "Cancel Invitation?",
      `Are you sure you want to cancel the invitation for ${client.invitedName}?\n\nThey can still create a Kleanr account using the invitation link, but they won't be connected to your business.`,
      [
        { text: "Keep Invitation", style: "cancel" },
        {
          text: "Cancel Invitation",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await CleanerClientService.deactivateClient(
                state.currentUser.token,
                client.id
              );
              if (result.success) {
                Alert.alert("Success", "Invitation cancelled");
                fetchClients();
              } else {
                Alert.alert("Error", result.error || "Failed to cancel invitation");
              }
            } catch (error) {
              Alert.alert("Error", "Failed to cancel invitation");
            }
          },
        },
      ]
    );
  };

  const handleClientPress = (client) => {
    navigate(`/client-detail/${client.id}`);
  };

  const handleMessageClient = async (client) => {
    if (!client.clientId) {
      Alert.alert("Cannot Message", "This client hasn't accepted their invitation yet.");
      return;
    }

    try {
      const result = await MessageClass.createCleanerClientConversation(
        client.clientId,
        null, // null = current user is the cleaner
        state.currentUser.token
      );

      if (result.conversation) {
        navigate(`/messages/${result.conversation.id}`);
      } else if (result.error) {
        Alert.alert("Error", result.error);
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
      Alert.alert("Error", "Failed to start conversation");
    }
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

  const handlePriceUpdate = async (clientId, newPrice) => {
    try {
      const result = await CleanerClientService.updateDefaultPrice(
        state.currentUser.token,
        clientId,
        newPrice
      );

      if (result.success) {
        // Update local state
        setClients((prev) =>
          prev.map((c) =>
            c.id === clientId ? { ...c, defaultPrice: newPrice } : c
          )
        );
        return true;
      } else {
        Alert.alert("Error", result.error || "Failed to update price");
        return false;
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update price");
      return false;
    }
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
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
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

      {/* Payment Setup Banner */}
      {showPaymentBanner && (
        <View style={styles.bannerContainer}>
          <PaymentSetupBanner onPress={() => navigate("/earnings")} />
        </View>
      )}

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
              onDeleteInvitation={handleDeleteInvitation}
              onBookCleaning={handleBookCleaning}
              onSetupRecurring={handleSetupRecurring}
              onMessage={handleMessageClient}
              onPriceUpdate={handlePriceUpdate}
              platformPrice={calculatePlatformPrice(client)}
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
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

  // Payment Banner
  bannerContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  paymentBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.warning[200],
    ...shadows.sm,
  },
  paymentBannerPressed: {
    backgroundColor: colors.warning[100],
  },
  paymentBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.warning[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  paymentBannerContent: {
    flex: 1,
  },
  paymentBannerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
    marginBottom: 2,
  },
  paymentBannerSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    lineHeight: 16,
  },
  paymentBannerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  paymentBannerActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
});

export default MyClientsPage;
