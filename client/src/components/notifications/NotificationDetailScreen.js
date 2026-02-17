import React, { useEffect, useState, useContext } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import { UserContext } from "../../context/UserContext";
import NotificationsService from "../../services/fetchRequests/NotificationsService";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

import useSafeNavigation from "../../hooks/useSafeNavigation";
const NotificationDetailScreen = () => {
  const { id } = useParams();
  const { state } = useContext(UserContext);
  const { goBack, navigate } = useSafeNavigation();

  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

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
      case "new_home_request":
        return { name: "home", color: colors.primary[500], bg: colors.primary[50] };
      case "new_home_accepted":
        return { name: "check-circle", color: colors.success[500], bg: colors.success[50] };
      case "new_home_declined":
        return { name: "x-circle", color: colors.warning[500], bg: colors.warning[50] };
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
      case "new_home_request":
        return "New Home Request";
      case "new_home_accepted":
        return "Home Request Accepted";
      case "new_home_declined":
        return "Home Request Declined";
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
        // Navigate to Job Assignment for this appointment
        if (notification.data?.appointmentId) {
          navigate(`/business-owner/assign?jobId=${notification.data.appointmentId}`);
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

  const handleAcceptNewHome = async () => {
    if (!notification?.data?.requestId) return;

    Alert.alert(
      "Accept Home Request",
      `Accept this home and add it to your client list?\n\nCalculated Price: $${notification.data.calculatedPrice || "N/A"}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            setProcessing(true);
            try {
              const result = await NotificationsService.acceptNewHomeRequest(
                state.currentUser.token,
                notification.data.requestId
              );
              if (result.success) {
                Alert.alert("Success", "Home added to your client list!", [
                  { text: "OK", onPress: () => navigate("/notifications") },
                ]);
              } else {
                Alert.alert("Error", result.error || "Failed to accept request");
              }
            } catch (error) {
              console.error("Error accepting new home request:", error);
              Alert.alert("Error", "Something went wrong. Please try again.");
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleDeclineNewHome = async () => {
    if (!notification?.data?.requestId) return;

    if (!showDeclineInput) {
      setShowDeclineInput(true);
      return;
    }

    setProcessing(true);
    try {
      const result = await NotificationsService.declineNewHomeRequest(
        state.currentUser.token,
        notification.data.requestId,
        declineReason.trim() || null
      );
      if (result.success) {
        Alert.alert("Declined", "The client has been notified.", [
          { text: "OK", onPress: () => navigate("/notifications") },
        ]);
      } else {
        Alert.alert("Error", result.error || "Failed to decline request");
      }
    } catch (error) {
      console.error("Error declining new home request:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setProcessing(false);
      setShowDeclineInput(false);
      setDeclineReason("");
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
          <Pressable onPress={() => goBack()} style={styles.backButton}>
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
        <Pressable onPress={() => goBack()} style={styles.backButton}>
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

        {/* New Home Request Accept/Decline Buttons */}
        {notification.type === "new_home_request" && notification.data?.requestId && (
          <View style={styles.newHomeActionCard}>
            <Text style={styles.newHomeActionTitle}>Respond to Request</Text>
            <Text style={styles.newHomeActionDescription}>
              Would you like to add this home to your client list?
            </Text>

            {notification.data.calculatedPrice && (
              <View style={styles.priceDisplay}>
                <Text style={styles.priceLabel}>Calculated Price</Text>
                <Text style={styles.priceValue}>${notification.data.calculatedPrice}</Text>
              </View>
            )}

            {showDeclineInput && (
              <View style={styles.declineInputContainer}>
                <Text style={styles.declineInputLabel}>Reason for declining (optional)</Text>
                <TextInput
                  style={styles.declineInput}
                  placeholder="e.g., At full capacity, area too far..."
                  value={declineReason}
                  onChangeText={setDeclineReason}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}

            <View style={styles.newHomeButtonRow}>
              {!showDeclineInput ? (
                <>
                  <Pressable
                    style={[styles.declineButton, processing && styles.buttonDisabled]}
                    onPress={handleDeclineNewHome}
                    disabled={processing}
                  >
                    <Feather name="x" size={18} color={colors.error[600]} />
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.acceptButton, processing && styles.buttonDisabled]}
                    onPress={handleAcceptNewHome}
                    disabled={processing}
                  >
                    {processing ? (
                      <ActivityIndicator size="small" color={colors.neutral[0]} />
                    ) : (
                      <>
                        <Feather name="check" size={18} color={colors.neutral[0]} />
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    style={styles.cancelDeclineButton}
                    onPress={() => {
                      setShowDeclineInput(false);
                      setDeclineReason("");
                    }}
                    disabled={processing}
                  >
                    <Text style={styles.cancelDeclineButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.confirmDeclineButton, processing && styles.buttonDisabled]}
                    onPress={handleDeclineNewHome}
                    disabled={processing}
                  >
                    {processing ? (
                      <ActivityIndicator size="small" color={colors.neutral[0]} />
                    ) : (
                      <Text style={styles.confirmDeclineButtonText}>Confirm Decline</Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}

        {/* Action Button */}
        {notification.actionRequired && (
          <Pressable style={styles.actionButton} onPress={handleActionPress}>
            <Text style={styles.actionButtonText}>Take Action</Text>
            <Feather name="arrow-right" size={18} color={colors.neutral[0]} />
          </Pressable>
        )}

        {/* Back to Home Button */}
        {!notification.actionRequired && (
          <Pressable style={styles.viewButton} onPress={() => navigate("/")}>
            <Feather name="home" size={16} color={colors.primary[600]} />
            <Text style={styles.viewButtonText}>Back to Home</Text>
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
  newHomeActionCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  newHomeActionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: "600",
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  newHomeActionDescription: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[600],
    marginBottom: spacing.md,
  },
  priceDisplay: {
    backgroundColor: colors.success[50],
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  priceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    marginBottom: spacing.xs,
  },
  priceValue: {
    fontSize: typography.fontSize.xxl,
    fontWeight: "700",
    color: colors.success[600],
  },
  declineInputContainer: {
    marginBottom: spacing.md,
  },
  declineInputLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
    marginBottom: spacing.xs,
  },
  declineInput: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.neutral[800],
    minHeight: 80,
    textAlignVertical: "top",
  },
  newHomeButtonRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success[500],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  acceptButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.neutral[0],
  },
  declineButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error[50],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
    gap: spacing.sm,
  },
  declineButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.error[600],
  },
  cancelDeclineButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  cancelDeclineButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.neutral[600],
  },
  confirmDeclineButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error[500],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  confirmDeclineButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.neutral[0],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default NotificationDetailScreen;
