import React, { useEffect, useState, useContext } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import { UserContext } from "../../context/UserContext";
import NotificationsService from "../../services/fetchRequests/NotificationsService";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

const NotificationDetailScreen = () => {
  const { id } = useParams();
  const { state } = useContext(UserContext);
  const navigate = useNavigate();

  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotification = async () => {
      try {
        const data = await NotificationsService.getNotificationById(
          state.currentUser.token,
          id
        );
        setNotification(data.notification);

        // Mark as read if not already
        if (data.notification && !data.notification.isRead) {
          await NotificationsService.markAsRead(state.currentUser.token, id);
        }
      } catch (error) {
        console.error("Error fetching notification:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotification();
  }, [id, state.currentUser.token]);

  const getIcon = (type) => {
    switch (type) {
      case "pending_booking":
        return { name: "calendar", color: colors.warning[500], bg: colors.warning[50] };
      case "booking_accepted":
        return { name: "check-circle", color: colors.success[500], bg: colors.success[50] };
      case "booking_declined":
        return { name: "x-circle", color: colors.error[500], bg: colors.error[50] };
      case "booking_expired":
        return { name: "clock", color: colors.neutral[500], bg: colors.neutral[100] };
      case "business_owner_declined":
        return { name: "alert-circle", color: colors.warning[500], bg: colors.warning[50] };
      case "client_booked":
      case "client_booked_appointment":
        return { name: "calendar", color: colors.success[500], bg: colors.success[50] };
      case "client_opened_to_marketplace":
        return { name: "shopping-bag", color: colors.primary[500], bg: colors.primary[50] };
      case "client_cancelled_after_decline":
        return { name: "x-circle", color: colors.error[500], bg: colors.error[50] };
      case "new_message":
        return { name: "message-circle", color: colors.primary[500], bg: colors.primary[50] };
      case "payment_received":
        return { name: "dollar-sign", color: colors.success[500], bg: colors.success[50] };
      case "review_received":
        return { name: "star", color: colors.warning[500], bg: colors.warning[50] };
      default:
        return { name: "bell", color: colors.primary[500], bg: colors.primary[50] };
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case "pending_booking":
        return "Pending Booking";
      case "booking_accepted":
        return "Booking Accepted";
      case "booking_declined":
        return "Booking Declined";
      case "booking_expired":
        return "Booking Expired";
      case "business_owner_declined":
        return "Request Declined";
      case "client_booked":
      case "client_booked_appointment":
        return "New Client Appointment";
      case "client_opened_to_marketplace":
        return "Marketplace Listing";
      case "client_cancelled_after_decline":
        return "Booking Cancelled";
      case "new_message":
        return "New Message";
      case "payment_received":
        return "Payment Received";
      case "review_received":
        return "New Review";
      default:
        return "Notification";
    }
  };

  const handleActionPress = () => {
    if (!notification) return;

    switch (notification.type) {
      case "pending_booking":
        if (notification.data?.appointmentId) {
          navigate("/");
        }
        break;
      case "booking_accepted":
      case "booking_declined":
        if (notification.data?.cleanerClientId) {
          navigate(`/client-detail/${notification.data.cleanerClientId}`);
        }
        break;
      case "client_booked":
      case "client_booked_appointment":
        // Navigate to assign employees for this appointment
        if (notification.data?.appointmentId) {
          navigate(`/assign-cleaner/${notification.data.appointmentId}`);
        } else {
          navigate("/business-owner/assign");
        }
        break;
      case "new_message":
        if (notification.data?.conversationId) {
          navigate(`/messages/${notification.data.conversationId}`);
        }
        break;
      default:
        navigate("/");
        break;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (!notification) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigate(-1)} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={colors.neutral[700]} />
          </Pressable>
          <Text style={styles.headerTitle}>Notification</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={colors.neutral[400]} />
          <Text style={styles.errorText}>Notification not found</Text>
          <Pressable style={styles.backLink} onPress={() => navigate("/notifications")}>
            <Text style={styles.backLinkText}>Back to Notifications</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const icon = getIcon(notification.type);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigate(-1)} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.neutral[700]} />
        </Pressable>
        <Text style={styles.headerTitle}>Notification Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Icon and Type */}
        <View style={styles.iconSection}>
          <View style={[styles.iconContainer, { backgroundColor: icon.bg }]}>
            <Feather name={icon.name} size={32} color={icon.color} />
          </View>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{getTypeLabel(notification.type)}</Text>
          </View>
        </View>

        {/* Title and Body */}
        <View style={styles.contentCard}>
          <Text style={styles.title}>{notification.title}</Text>
          <Text style={styles.body}>{notification.body}</Text>
          <View style={styles.dateRow}>
            <Feather name="clock" size={14} color={colors.neutral[500]} />
            <Text style={styles.dateText}>{formatDate(notification.createdAt)}</Text>
          </View>
        </View>

        {/* Additional Details */}
        {notification.data && Object.keys(notification.data).length > 0 && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Details</Text>

            {notification.data.date && (
              <View style={styles.detailRow}>
                <Feather name="calendar" size={16} color={colors.neutral[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {new Date(notification.data.date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              </View>
            )}

            {notification.data.timeWindow && (
              <View style={styles.detailRow}>
                <Feather name="clock" size={16} color={colors.neutral[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Time Window</Text>
                  <Text style={styles.detailValue}>{notification.data.timeWindow}</Text>
                </View>
              </View>
            )}

            {notification.data.price && (
              <View style={styles.detailRow}>
                <Feather name="dollar-sign" size={16} color={colors.neutral[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Price</Text>
                  <Text style={styles.detailValue}>${notification.data.price}</Text>
                </View>
              </View>
            )}

            {notification.data.clientName && (
              <View style={styles.detailRow}>
                <Feather name="user" size={16} color={colors.neutral[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Client</Text>
                  <Text style={styles.detailValue}>{notification.data.clientName}</Text>
                </View>
              </View>
            )}

            {notification.data.cleanerName && (
              <View style={styles.detailRow}>
                <Feather name="user" size={16} color={colors.neutral[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Cleaner</Text>
                  <Text style={styles.detailValue}>{notification.data.cleanerName}</Text>
                </View>
              </View>
            )}

            {notification.data.homeAddress && (
              <View style={styles.detailRow}>
                <Feather name="map-pin" size={16} color={colors.neutral[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Address</Text>
                  <Text style={styles.detailValue}>{notification.data.homeAddress}</Text>
                </View>
              </View>
            )}

            {notification.data.declineReason && (
              <View style={styles.detailRow}>
                <Feather name="info" size={16} color={colors.neutral[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Reason</Text>
                  <Text style={styles.detailValue}>{notification.data.declineReason}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Action Button */}
        {notification.actionRequired && (
          <Pressable style={styles.actionButton} onPress={handleActionPress}>
            <Text style={styles.actionButtonText}>Take Action</Text>
            <Feather name="arrow-right" size={18} color={colors.neutral[0]} />
          </Pressable>
        )}

        {/* View Related Button */}
        {!notification.actionRequired && notification.data?.appointmentId && (
          <Pressable style={styles.viewButton} onPress={handleActionPress}>
            <Text style={styles.viewButtonText}>View Details</Text>
            <Feather name="external-link" size={16} color={colors.primary[600]} />
          </Pressable>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    ...shadows.sm,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: "600",
    color: colors.neutral[900],
  },
  headerSpacer: {
    width: 40,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.fontSize.lg,
    color: colors.neutral[600],
    marginTop: spacing.md,
  },
  backLink: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  backLinkText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  iconSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  typeBadge: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  typeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  contentCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: "700",
    color: colors.neutral[900],
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[600],
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dateText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
  },
  detailsCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  detailsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: "600",
    color: colors.neutral[900],
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  detailContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  detailValue: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[800],
    fontWeight: "500",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  actionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.neutral[0],
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  viewButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.primary[600],
  },
  bottomSpacer: {
    height: spacing.xl,
  },
});

export default NotificationDetailScreen;
