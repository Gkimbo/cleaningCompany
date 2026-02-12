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

// Generate avatar colors based on name
const getAvatarColor = (name) => {
  const avatarColors = [
    { bg: colors.primary[100], text: colors.primary[700] },
    { bg: colors.success[100], text: colors.success[700] },
    { bg: "#E0E7FF", text: "#4338CA" }, // Indigo
    { bg: "#FCE7F3", text: "#BE185D" }, // Pink
    { bg: "#CCFBF1", text: "#0F766E" }, // Teal
    { bg: "#FEF3C7", text: "#B45309" }, // Amber
  ];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
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
      return { label: "Today", isToday: true };
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return { label: "Tomorrow", isToday: false };
    } else {
      return {
        label: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        isToday: false,
      };
    }
  };

  // Get client name
  const clientName = client.clientUser?.firstName
    ? `${client.clientUser.firstName} ${client.clientUser.lastName || ""}`
    : client.clientName || "Unknown Client";

  // Get initials
  const getInitials = (name) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get address preview
  const addressPreview = client.home?.address
    ? client.home.address.split(",")[0]
    : "No address";

  // Home details
  const homeDetails = client.home
    ? `${client.home.numBeds || 0}bd • ${client.home.numBaths || 0}ba`
    : null;

  // Payment status from next appointment
  const paymentStatus = nextAppointment?.paymentStatus || null;
  const isUnpaid = paymentStatus && paymentStatus !== "paid" && paymentStatus !== "not_required";

  const avatarColor = getAvatarColor(clientName);
  const dateInfo = nextAppointment ? formatDate(nextAppointment.date) : null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.clientCard,
        pressed && styles.clientCardPressed,
      ]}
      onPress={() => navigate(`/my-clients/${client.id}`)}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarColor.bg }]}>
        <Text style={[styles.avatarText, { color: avatarColor.text }]}>
          {getInitials(clientName)}
        </Text>
      </View>

      {/* Client Info */}
      <View style={styles.clientMain}>
        <View style={styles.clientNameRow}>
          <Text style={styles.clientName} numberOfLines={1}>
            {clientName}
          </Text>
          {statusTier && (
            <View style={[styles.tierBadge, { backgroundColor: statusTier.bgColor }]}>
              <Icon name="star" size={8} color={statusTier.color} />
            </View>
          )}
        </View>
        <View style={styles.clientDetailsRow}>
          <Icon name="map-marker" size={10} color={colors.neutral[400]} />
          <Text style={styles.clientAddress} numberOfLines={1}>
            {addressPreview}
          </Text>
          {homeDetails && (
            <>
              <View style={styles.detailDot} />
              <Text style={styles.homeDetails}>{homeDetails}</Text>
            </>
          )}
        </View>
      </View>

      {/* Right Side - Appointment Info */}
      <View style={styles.clientMeta}>
        {nextAppointment ? (
          <View style={[
            styles.appointmentBadge,
            dateInfo?.isToday && styles.appointmentBadgeToday,
            isUnpaid && styles.appointmentBadgeUnpaid,
          ]}>
            <Icon
              name="calendar"
              size={10}
              color={dateInfo?.isToday ? colors.primary[600] : isUnpaid ? colors.warning[600] : colors.neutral[500]}
            />
            <Text style={[
              styles.appointmentDate,
              dateInfo?.isToday && styles.appointmentDateToday,
              isUnpaid && styles.appointmentDateUnpaid,
            ]}>
              {dateInfo?.label}
            </Text>
          </View>
        ) : (
          <View style={styles.noAppointmentBadge}>
            <Text style={styles.noAppointmentText}>—</Text>
          </View>
        )}
        <Icon name="chevron-right" size={12} color={colors.neutral[300]} />
      </View>
    </Pressable>
  );
};

const MyClientsSection = ({ state, refreshTrigger }) => {
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
  }, [fetchClients, refreshTrigger]);

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
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.md,
  },
  clientCardPressed: {
    backgroundColor: colors.neutral[50],
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: "700",
  },
  clientMain: {
    flex: 1,
    gap: 4,
  },
  clientNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  clientName: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
    flexShrink: 1,
  },
  tierBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  clientDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  clientAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    flexShrink: 1,
  },
  detailDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.neutral[300],
    marginHorizontal: 4,
  },
  homeDetails: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[400],
  },
  clientMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  appointmentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.neutral[100],
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  appointmentBadgeToday: {
    backgroundColor: colors.primary[50],
  },
  appointmentBadgeUnpaid: {
    backgroundColor: colors.warning[50],
  },
  appointmentDate: {
    fontSize: typography.fontSize.xs,
    fontWeight: "600",
    color: colors.neutral[600],
  },
  appointmentDateToday: {
    color: colors.primary[600],
  },
  appointmentDateUnpaid: {
    color: colors.warning[600],
  },
  noAppointmentBadge: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  noAppointmentText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[300],
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
