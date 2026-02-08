import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import { formatCurrency } from "../../../services/formatters";
import CleanerClientService from "../../../services/fetchRequests/CleanerClientService";

const getStatusTierBadge = (tier) => {
  const tiers = {
    gold: { label: "Gold", color: "#FFD700", bgColor: "#FFF8DC" },
    silver: { label: "Silver", color: "#C0C0C0", bgColor: "#F5F5F5" },
    bronze: { label: "Bronze", color: "#CD7F32", bgColor: "#FDF5E6" },
  };
  return tiers[tier] || null;
};

const ClientCard = ({ client }) => {
  const navigate = useNavigate();

  // Get next appointment if available
  const nextAppointment = client.nextAppointment;
  const statusTier = getStatusTierBadge(client.preferredStatusTier);

  // Format appointment date
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }
  };

  // Get client name
  const clientName = client.clientUser?.firstName
    ? `${client.clientUser.firstName} ${client.clientUser.lastName || ""}`
    : client.clientName || "Unknown Client";

  // Get address preview
  const addressPreview = client.home?.address
    ? client.home.address.split(",")[0]
    : "No address";

  // Payment status from next appointment
  const paymentStatus = nextAppointment?.paymentStatus || null;
  const isUnpaid = paymentStatus && paymentStatus !== "paid" && paymentStatus !== "not_required";

  return (
    <Pressable
      style={styles.clientCard}
      onPress={() => navigate(`/my-clients/${client.id}`)}
    >
      <View style={styles.clientMain}>
        <View style={styles.clientInfo}>
          <View style={styles.clientNameRow}>
            <Text style={styles.clientName} numberOfLines={1}>
              {clientName}
            </Text>
            {statusTier && (
              <View style={[styles.tierBadge, { backgroundColor: statusTier.bgColor }]}>
                <Icon name="star" size={10} color={statusTier.color} />
                <Text style={[styles.tierText, { color: statusTier.color }]}>
                  {statusTier.label}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.clientAddress} numberOfLines={1}>
            {addressPreview}
          </Text>
        </View>
      </View>

      <View style={styles.clientMeta}>
        {nextAppointment ? (
          <View style={styles.appointmentInfo}>
            <Text style={styles.appointmentDate}>{formatDate(nextAppointment.date)}</Text>
            {isUnpaid && (
              <View style={styles.unpaidBadge}>
                <Icon name="exclamation-circle" size={10} color={colors.warning[600]} />
                <Text style={styles.unpaidText}>Unpaid</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.noAppointment}>No upcoming</Text>
        )}
        <Icon name="chevron-right" size={12} color={colors.neutral[300]} />
      </View>
    </Pressable>
  );
};

const MyClientsSection = ({ state }) => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    if (!state?.currentUser?.token) return;

    try {
      const result = await CleanerClientService.getClients(state.currentUser.token, "active");
      setClients(result.clients || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  }, [state?.currentUser?.token]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Show only first 4 clients in the summary
  const displayedClients = clients.slice(0, 4);
  const remainingCount = Math.max(0, clients.length - 4);

  // Count clients with unpaid appointments
  const clientsWithUnpaid = clients.filter(c =>
    c.nextAppointment?.paymentStatus &&
    c.nextAppointment.paymentStatus !== "paid" &&
    c.nextAppointment.paymentStatus !== "not_required"
  ).length;

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Icon name="home" size={16} color={colors.primary[600]} />
          <Text style={styles.sectionTitle}>My Clients</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{clients.length}</Text>
          </View>
        </View>
        <Pressable
          style={styles.viewAllButton}
          onPress={() => navigate("/my-clients")}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <Icon name="chevron-right" size={12} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Clients Card */}
      <View style={styles.clientsCard}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
          </View>
        ) : clients.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="user-plus" size={28} color={colors.neutral[300]} />
            <Text style={styles.emptyStateText}>No clients yet</Text>
            <Pressable
              style={styles.addButton}
              onPress={() => navigate("/my-clients")}
            >
              <Icon name="plus" size={12} color={colors.neutral[0]} />
              <Text style={styles.addButtonText}>Add Client</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Unpaid Alert */}
            {clientsWithUnpaid > 0 && (
              <View style={styles.alertBanner}>
                <Icon name="exclamation-triangle" size={14} color={colors.warning[600]} />
                <Text style={styles.alertText}>
                  {clientsWithUnpaid} client{clientsWithUnpaid > 1 ? "s" : ""} with unpaid appointments
                </Text>
              </View>
            )}

            {/* Client List */}
            {displayedClients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}

            {/* Show More */}
            {remainingCount > 0 && (
              <Pressable
                style={styles.showMoreButton}
                onPress={() => navigate("/my-clients")}
              >
                <Text style={styles.showMoreText}>
                  +{remainingCount} more client{remainingCount > 1 ? "s" : ""}
                </Text>
              </Pressable>
            )}

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <Pressable
                style={styles.quickActionButton}
                onPress={() => navigate("/my-clients")}
              >
                <Icon name="user-plus" size={14} color={colors.primary[600]} />
                <Text style={styles.quickActionText}>Add Client</Text>
              </Pressable>
              <View style={styles.actionDivider} />
              <Pressable
                style={styles.quickActionButton}
                onPress={() => navigate("/my-clients")}
              >
                <Icon name="calendar-plus-o" size={14} color={colors.primary[600]} />
                <Text style={styles.quickActionText}>Schedule</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  countBadge: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  countText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  viewAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  clientsCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    ...shadows.sm,
    overflow: "hidden",
  },
  loadingState: {
    padding: spacing["2xl"],
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    gap: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  addButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    gap: spacing.sm,
  },
  alertText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
  },
  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  clientMain: {
    flex: 1,
    marginRight: spacing.md,
  },
  clientInfo: {
    gap: spacing.xxs,
  },
  clientNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  clientName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    flexShrink: 1,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    gap: 3,
  },
  tierText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
  },
  clientAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  clientMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  appointmentInfo: {
    alignItems: "flex-end",
    gap: spacing.xxs,
  },
  appointmentDate: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  unpaidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  unpaidText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
    fontWeight: typography.fontWeight.medium,
  },
  noAppointment: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  showMoreButton: {
    padding: spacing.md,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  showMoreText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  quickActions: {
    flexDirection: "row",
    padding: spacing.md,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  quickActionText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  actionDivider: {
    width: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.xs,
  },
});

export default MyClientsSection;
