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
import { useParams } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import { UserContext } from "../../context/UserContext";
import NotificationsService from "../../services/fetchRequests/NotificationsService";
import HttpClient from "../../services/HttpClient";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";
import { formatCurrency } from "../../services/formatters";
import PendingBookingModal from "../client/PendingBookingModal";
import BusinessOwnerDeclinedModal from "../client/BusinessOwnerDeclinedModal";
import CleanerDropoutModal from "../multiCleaner/CleanerDropoutModal";

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

  // Modal states
  const [showPendingBookingModal, setShowPendingBookingModal] = useState(false);
  const [showDeclinedModal, setShowDeclinedModal] = useState(false);
  const [showDropoutModal, setShowDropoutModal] = useState(false);
  const [dropoutLoading, setDropoutLoading] = useState(false);

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
      case "solo_completion_offer":
        return { name: "dollar-sign", color: colors.success[500], bg: colors.success[50] };
      case "edge_case_decision_required":
        return { name: "alert-triangle", color: colors.warning[500], bg: colors.warning[50] };
      case "multi_cleaner_urgent":
      case "multi_cleaner_final_warning":
        return { name: "users", color: colors.warning[500], bg: colors.warning[50] };
      case "cleaner_dropout":
        return { name: "user-minus", color: colors.warning[500], bg: colors.warning[50] };
      case "payment_failed":
      case "payment_retry_failed":
        return { name: "credit-card", color: colors.error[500], bg: colors.error[50] };
      case "appointment_cancelled_payment":
        return { name: "x-circle", color: colors.error[500], bg: colors.error[50] };
      case "guest_not_left":
        return { name: "alert-triangle", color: colors.error[500], bg: colors.error[50] };
      case "unassigned_reminder_bo":
        return { name: "user-plus", color: colors.warning[500], bg: colors.warning[50] };
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
      case "solo_completion_offer":
        return "Solo Completion Offer";
      case "edge_case_decision_required":
        return "Decision Required";
      case "multi_cleaner_urgent":
        return "Multi-Cleaner Urgent";
      case "multi_cleaner_final_warning":
        return "Final Warning - Unfilled Slots";
      case "cleaner_dropout":
        return "Cleaner Unavailable";
      case "payment_failed":
        return "Payment Failed";
      case "payment_retry_failed":
        return "Payment Retry Failed";
      case "appointment_cancelled_payment":
        return "Appointment Cancelled";
      case "guest_not_left":
        return "Guest Still Present";
      case "unassigned_reminder_bo":
        return "Unassigned Appointment";
      default:
        return "Notification";
    }
  };

  const handleActionPress = () => {
    if (!notification) return;

    switch (notification.type) {
      case "pending_booking":
        // Show the pending booking modal to accept/decline
        setShowPendingBookingModal(true);
        break;

      case "business_owner_declined":
        // Show the declined modal to choose cancel or marketplace
        setShowDeclinedModal(true);
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

      case "payment_failed":
      case "payment_retry_failed":
      case "appointment_cancelled_payment":
        // Navigate to payment setup to update payment method
        navigate("/payment-setup");
        break;

      case "edge_case_decision_required":
      case "cleaner_dropout":
      case "multi_cleaner_final_warning":
        // Show the cleaner dropout modal for multi-cleaner decisions
        setShowDropoutModal(true);
        break;

      case "multi_cleaner_urgent":
      case "multi_cleaner_offer":
      case "last_minute_urgent":
        // Navigate to job search page filtered to this specific appointment
        if (notification.data?.appointmentId) {
          navigate(`/new-job-choice?appointmentId=${notification.data.appointmentId}`);
        } else {
          navigate("/new-job-choice");
        }
        break;

      case "unassigned_reminder_bo":
        // Navigate to job assignment for this appointment
        if (notification.data?.appointmentId) {
          navigate(`/business-owner/assign?jobId=${notification.data.appointmentId}`);
        } else {
          navigate("/business-owner/assign");
        }
        break;

      case "guest_not_left":
        // Navigate to dashboard where TenantPresentAlertCard will show
        navigate("/");
        break;

      case "new_home_declined":
        // Navigate to home details to re-request or list on marketplace
        if (notification.data?.homeId) {
          navigate(`/edit-home?homeId=${notification.data.homeId}`);
        } else {
          navigate("/list-of-homes");
        }
        break;

      default:
        navigate("/");
        break;
    }
  };

  // Handle pending booking modal actions
  const handlePendingBookingAction = (action, result) => {
    setShowPendingBookingModal(false);
    if (action === "accepted" || action === "declined") {
      // Update notification state to mark action complete
      setNotification(prev => prev ? { ...prev, actionRequired: false } : prev);
      Alert.alert(
        action === "accepted" ? "Booking Accepted" : "Booking Declined",
        action === "accepted"
          ? "Your appointment has been confirmed!"
          : "The booking has been declined.",
        [{ text: "OK", onPress: () => navigate("/notifications") }]
      );
    }
  };

  // Handle cleaner dropout/edge case modal actions
  const handleDropoutProceed = async () => {
    if (!notification?.data?.appointmentId) return;
    setDropoutLoading(true);
    try {
      const isEdgeCase = notification.type === "edge_case_decision_required";
      const response = isEdgeCase ? "proceed_edge_case" : "proceed_with_one";

      const result = await HttpClient.post(
        `/multi-cleaner/${notification.data.appointmentId}/homeowner-response`,
        { response },
        { token: state.currentUser.token }
      );

      if (result.success) {
        setShowDropoutModal(false);
        // Update notification with decision made
        setNotification(prev => prev ? {
          ...prev,
          actionRequired: false,
          data: {
            ...prev.data,
            decisionMade: "proceed",
            decisionMadeAt: new Date().toISOString(),
          },
        } : prev);
        Alert.alert(
          "Cleaning Confirmed",
          "Your cleaning will proceed with the available cleaner(s)."
        );
      } else {
        Alert.alert("Error", result.error || "Failed to confirm. Please try again.");
      }
    } catch (error) {
      console.error("Error confirming proceed:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setDropoutLoading(false);
    }
  };

  const handleDropoutWait = async () => {
    // Wait for replacement - just close modal for now
    setShowDropoutModal(false);
    Alert.alert(
      "Waiting for Replacement",
      "We'll notify you if we find a replacement cleaner before your appointment."
    );
  };

  const handleDropoutReschedule = () => {
    setShowDropoutModal(false);
    // Navigate to appointments calendar to reschedule
    navigate("/appointments");
  };

  const handleDropoutCancel = async () => {
    if (!notification?.data?.appointmentId) return;
    setDropoutLoading(true);
    try {
      const isEdgeCase = notification.type === "edge_case_decision_required";
      const response = isEdgeCase ? "cancel_edge_case" : "cancel";

      const result = await HttpClient.post(
        `/multi-cleaner/${notification.data.appointmentId}/homeowner-response`,
        { response },
        { token: state.currentUser.token }
      );

      if (result.success) {
        setShowDropoutModal(false);
        // Update notification with decision made
        setNotification(prev => prev ? {
          ...prev,
          actionRequired: false,
          data: {
            ...prev.data,
            decisionMade: "cancelled",
            decisionMadeAt: new Date().toISOString(),
          },
        } : prev);
        Alert.alert(
          "Appointment Cancelled",
          "Your appointment has been cancelled without any fees."
        );
      } else {
        Alert.alert("Error", result.error || "Failed to cancel. Please try again.");
      }
    } catch (error) {
      console.error("Error cancelling:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setDropoutLoading(false);
    }
  };

  const handleAcceptNewHome = async () => {
    if (!notification?.data?.requestId) return;

    Alert.alert(
      "Accept Home Request",
      `Accept this home and add it to your client list?\n\nCalculated Price: $${notification.data?.calculatedPriceDollars || (notification.data?.calculatedPrice ? (notification.data.calculatedPrice / 100).toFixed(2) : "N/A")}`,
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

  const handleAcceptSoloOffer = async () => {
    if (!notification?.data?.appointmentId) return;

    const earnings = notification.data?.fullEarnings || notification.data?.fullEarningsDollars;
    Alert.alert(
      "Accept Solo Completion",
      `Accept to complete this job by yourself for full pay${earnings ? ` ($${typeof earnings === "number" ? (earnings / 100).toFixed(2) : earnings})` : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            setProcessing(true);
            try {
              const result = await NotificationsService.acceptSoloCompletionOffer(
                state.currentUser.token,
                notification.data.appointmentId
              );
              if (result.success) {
                Alert.alert("Success", "You've accepted to complete this job solo!", [
                  { text: "OK", onPress: () => navigate("/") },
                ]);
              } else {
                Alert.alert("Error", result.error || "Failed to accept solo offer");
              }
            } catch (error) {
              console.error("Error accepting solo offer:", error);
              Alert.alert("Error", "Something went wrong. Please try again.");
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleDeclineSoloOffer = async () => {
    if (!notification?.data?.appointmentId) return;

    Alert.alert(
      "Decline Solo Completion",
      "Are you sure you want to decline? The homeowner will be notified and offered options.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setProcessing(true);
            try {
              const result = await NotificationsService.declineSoloCompletionOffer(
                state.currentUser.token,
                notification.data.appointmentId
              );
              if (result.success) {
                Alert.alert("Declined", "The homeowner has been notified.", [
                  { text: "OK", onPress: () => navigate("/notifications") },
                ]);
              } else {
                Alert.alert("Error", result.error || "Failed to decline solo offer");
              }
            } catch (error) {
              console.error("Error declining solo offer:", error);
              Alert.alert("Error", "Something went wrong. Please try again.");
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
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

        {/* Additional Details — hidden for urgent job types which have their own details card */}
        {notification.data && Object.keys(notification.data).length > 0 &&
          !["multi_cleaner_urgent", "multi_cleaner_offer", "last_minute_urgent"].includes(notification.type) && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Details</Text>

            {notification.data.date && (
              <View style={styles.detailRow}>
                <Feather name="calendar" size={16} color={colors.neutral[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {new Date(notification.data.date + "T12:00:00").toLocaleDateString("en-US", {
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
                  <Text style={styles.detailValue}>{formatCurrency(notification.data.price)}</Text>
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

            {/* Cleaner Profile Card */}
            {notification.data.cleanerProfile && (
              <View style={styles.cleanerProfileCard}>
                <View style={styles.cleanerProfileHeader}>
                  <View style={styles.cleanerAvatar}>
                    <Feather name="user" size={24} color={colors.primary[600]} />
                  </View>
                  <View style={styles.cleanerProfileInfo}>
                    <Text style={styles.cleanerProfileName}>{notification.data.cleanerName}</Text>
                    {notification.data.cleanerProfile.totalReviews > 0 ? (
                      <View style={styles.cleanerRatingRow}>
                        <View style={styles.starsContainer}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Feather
                              key={star}
                              name="star"
                              size={14}
                              color={star <= Math.round(notification.data.cleanerProfile.averageRating)
                                ? colors.warning[500]
                                : colors.neutral[300]}
                              style={{ marginRight: 2 }}
                            />
                          ))}
                        </View>
                        <Text style={styles.cleanerRatingText}>
                          {notification.data.cleanerProfile.averageRating.toFixed(1)} ({notification.data.cleanerProfile.totalReviews} reviews)
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.noReviewsText}>New cleaner - no reviews yet</Text>
                    )}
                  </View>
                </View>

                {notification.data.cleanerProfile.recommendationRate > 0 && (
                  <View style={styles.recommendationBadge}>
                    <Feather name="thumbs-up" size={14} color={colors.success[600]} />
                    <Text style={styles.recommendationText}>
                      {notification.data.cleanerProfile.recommendationRate}% would recommend
                    </Text>
                  </View>
                )}

                {/* Recent Reviews */}
                {notification.data.cleanerProfile.recentReviews?.length > 0 && (
                  <View style={styles.recentReviewsSection}>
                    <Text style={styles.recentReviewsTitle}>Recent Reviews</Text>
                    {notification.data.cleanerProfile.recentReviews.map((review, index) => (
                      <View key={review.id || index} style={styles.reviewItem}>
                        <View style={styles.reviewHeader}>
                          <View style={styles.reviewStars}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Feather
                                key={star}
                                name="star"
                                size={12}
                                color={star <= Math.round(review.rating)
                                  ? colors.warning[500]
                                  : colors.neutral[300]}
                              />
                            ))}
                          </View>
                          <Text style={styles.reviewerName}>
                            {review.reviewerFirstName || "Client"}
                          </Text>
                        </View>
                        {review.comment && (
                          <Text style={styles.reviewComment} numberOfLines={2}>
                            {review.comment}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
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

            {notification.data?.calculatedPrice && (
              <View style={styles.priceDisplay}>
                <Text style={styles.priceLabel}>Calculated Price</Text>
                <Text style={styles.priceValue}>${notification.data?.calculatedPriceDollars || (notification.data?.calculatedPrice / 100).toFixed(2)}</Text>
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

        {/* Pending Booking Accept/Decline Buttons */}
        {notification.type === "pending_booking" && notification.actionRequired && notification.data?.appointmentId && (
          <View style={styles.newHomeActionCard}>
            <Text style={styles.newHomeActionTitle}>Respond to Booking</Text>
            <Text style={styles.newHomeActionDescription}>
              Your cleaner has proposed this appointment. Would you like to accept?
            </Text>

            <View style={styles.newHomeButtonRow}>
              <Pressable
                style={[styles.declineButton, processing && styles.buttonDisabled]}
                onPress={() => setShowPendingBookingModal(true)}
                disabled={processing}
              >
                <Feather name="x" size={18} color={colors.error[600]} />
                <Text style={styles.declineButtonText}>Decline</Text>
              </Pressable>
              <Pressable
                style={[styles.acceptButton, processing && styles.buttonDisabled]}
                onPress={() => setShowPendingBookingModal(true)}
                disabled={processing}
              >
                <Feather name="check" size={18} color={colors.neutral[0]} />
                <Text style={styles.acceptButtonText}>Review & Accept</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Business Owner Declined - Action Buttons */}
        {notification.type === "business_owner_declined" && notification.actionRequired && (
          <View style={styles.newHomeActionCard}>
            <Text style={styles.newHomeActionTitle}>Your Cleaner Declined</Text>
            <Text style={styles.newHomeActionDescription}>
              What would you like to do with this appointment?
            </Text>

            <View style={styles.optionsContainer}>
              <Pressable
                style={styles.actionOptionButton}
                onPress={() => setShowDeclinedModal(true)}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: colors.error[50] }]}>
                  <Feather name="x-circle" size={22} color={colors.error[500]} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Cancel Appointment</Text>
                  <Text style={styles.optionDescription}>Remove this appointment from your schedule</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
              </Pressable>

              <Pressable
                style={styles.actionOptionButton}
                onPress={() => setShowDeclinedModal(true)}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: colors.primary[50] }]}>
                  <Feather name="search" size={22} color={colors.primary[500]} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Find Another Cleaner</Text>
                  <Text style={styles.optionDescription}>Open to marketplace for other cleaners</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Payment Failed - Action Buttons */}
        {(notification.type === "payment_failed" || notification.type === "payment_retry_failed") && notification.actionRequired && (
          <View style={styles.newHomeActionCard}>
            <Text style={styles.newHomeActionTitle}>Update Payment Method</Text>
            <Text style={styles.newHomeActionDescription}>
              Your payment failed. Please update your payment method to keep your appointment.
            </Text>

            <View style={styles.urgentWarningBox}>
              <Feather name="alert-triangle" size={18} color={colors.error[600]} />
              <Text style={styles.urgentWarningText}>
                {notification.data?.hoursRemaining
                  ? `You have ${notification.data.hoursRemaining} hours to update your payment method.`
                  : "Please update your payment method as soon as possible to avoid cancellation."}
              </Text>
            </View>

            <Pressable
              style={[styles.primaryActionButton, processing && styles.buttonDisabled]}
              onPress={() => navigate("/payment-setup")}
              disabled={processing}
            >
              <Feather name="credit-card" size={18} color={colors.neutral[0]} />
              <Text style={styles.primaryActionButtonText}>Update Payment Method</Text>
            </Pressable>
          </View>
        )}

        {/* Decision Made - Show when a decision has already been recorded */}
        {notification.data?.decisionMade && (
          <View style={styles.decisionMadeCard}>
            <View style={[
              styles.decisionMadeIconContainer,
              notification.data.decisionMade === "proceed"
                ? { backgroundColor: colors.success[100] }
                : { backgroundColor: colors.error[100] }
            ]}>
              <Feather
                name={notification.data.decisionMade === "proceed" ? "check-circle" : "x-circle"}
                size={28}
                color={notification.data.decisionMade === "proceed" ? colors.success[600] : colors.error[600]}
              />
            </View>
            <Text style={styles.decisionMadeTitle}>
              {notification.data.decisionMade === "proceed"
                ? "You chose to proceed"
                : "You cancelled this appointment"}
            </Text>
            <Text style={styles.decisionMadeDescription}>
              {notification.data.decisionMade === "proceed"
                ? "Your cleaning will continue with the available cleaner(s). Normal cancellation fees apply going forward."
                : "This appointment was cancelled without any fees due to the cleaner shortage."}
            </Text>
            {notification.data.decisionMadeAt && (
              <Text style={styles.decisionMadeTime}>
                Decision made on {new Date(notification.data.decisionMadeAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            )}
          </View>
        )}

        {/* Edge Case Decision Required - Action Buttons */}
        {notification.type === "edge_case_decision_required" && notification.actionRequired && !notification.data?.decisionMade && (
          <View style={styles.newHomeActionCard}>
            <Text style={styles.newHomeActionTitle}>Decision Required</Text>
            <Text style={styles.newHomeActionDescription}>
              Your cleaning requires {notification.data?.originalRequired || 2} cleaners, but only {notification.data?.confirmedCleaners || 1} is available.
              What would you like to do?
            </Text>

            <View style={styles.optionsContainer}>
              <Pressable
                style={[styles.actionOptionButton, dropoutLoading && styles.buttonDisabled]}
                onPress={handleDropoutProceed}
                disabled={dropoutLoading}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: colors.success[50] }]}>
                  <Feather name="check-circle" size={22} color={colors.success[500]} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Proceed with 1 Cleaner</Text>
                  <Text style={styles.optionDescription}>
                    Continue with available cleaner. Normal cancellation fees apply.
                  </Text>
                </View>
                {dropoutLoading ? (
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                ) : (
                  <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
                )}
              </Pressable>

              <Pressable
                style={[styles.actionOptionButton, dropoutLoading && styles.buttonDisabled]}
                onPress={handleDropoutCancel}
                disabled={dropoutLoading}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: colors.error[50] }]}>
                  <Feather name="x-circle" size={22} color={colors.error[500]} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Cancel Without Fee</Text>
                  <Text style={styles.optionDescription}>
                    Cancel this appointment with no cancellation fee.
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
              </Pressable>
            </View>

            {notification.data?.decisionExpiresAt && (
              <View style={styles.expirationNote}>
                <Feather name="clock" size={14} color={colors.warning[600]} />
                <Text style={styles.expirationText}>
                  Decision auto-proceeds in 24 hours if no action taken.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Cleaner Dropout - Action Buttons */}
        {notification.type === "cleaner_dropout" && notification.actionRequired && !notification.data?.decisionMade && (
          <View style={styles.newHomeActionCard}>
            <Text style={styles.newHomeActionTitle}>Cleaner Unavailable</Text>
            <Text style={styles.newHomeActionDescription}>
              One of your cleaners is no longer available for this appointment.
              {notification.data?.remainingCleaners
                ? ` You have ${notification.data.remainingCleaners} remaining cleaner(s).`
                : ""}
            </Text>

            <View style={styles.optionsContainer}>
              <Pressable
                style={[styles.actionOptionButton, dropoutLoading && styles.buttonDisabled]}
                onPress={handleDropoutProceed}
                disabled={dropoutLoading}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: colors.success[50] }]}>
                  <Feather name="check-circle" size={22} color={colors.success[500]} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Proceed with Remaining</Text>
                  <Text style={styles.optionDescription}>Continue with available cleaner(s)</Text>
                </View>
                {dropoutLoading ? (
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                ) : (
                  <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
                )}
              </Pressable>

              <Pressable
                style={styles.actionOptionButton}
                onPress={handleDropoutWait}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: colors.primary[50] }]}>
                  <Feather name="clock" size={22} color={colors.primary[500]} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Wait for Replacement</Text>
                  <Text style={styles.optionDescription}>We will try to find another cleaner</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
              </Pressable>

              <Pressable
                style={styles.actionOptionButton}
                onPress={handleDropoutReschedule}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: colors.warning[50] }]}>
                  <Feather name="calendar" size={22} color={colors.warning[500]} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Reschedule</Text>
                  <Text style={styles.optionDescription}>Move to a different date</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
              </Pressable>

              <Pressable
                style={[styles.actionOptionButton, dropoutLoading && styles.buttonDisabled]}
                onPress={handleDropoutCancel}
                disabled={dropoutLoading}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: colors.error[50] }]}>
                  <Feather name="x-circle" size={22} color={colors.error[500]} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Cancel Appointment</Text>
                  <Text style={styles.optionDescription}>No fee due to cleaner change</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Multi-Cleaner Final Warning - Action Buttons */}
        {notification.type === "multi_cleaner_final_warning" && notification.actionRequired && !notification.data?.decisionMade && (
          <View style={styles.newHomeActionCard}>
            <Text style={styles.newHomeActionTitle}>Unfilled Slots Warning</Text>
            <Text style={styles.newHomeActionDescription}>
              Your cleaning appointment is coming up, but not all cleaner slots have been filled.
              {notification.data?.confirmedCleaners && notification.data?.requiredCleaners
                ? ` ${notification.data.confirmedCleaners} of ${notification.data.requiredCleaners} cleaners confirmed.`
                : ""}
            </Text>

            <View style={styles.optionsContainer}>
              <Pressable
                style={[styles.actionOptionButton, dropoutLoading && styles.buttonDisabled]}
                onPress={handleDropoutProceed}
                disabled={dropoutLoading}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: colors.success[50] }]}>
                  <Feather name="check-circle" size={22} color={colors.success[500]} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Proceed Anyway</Text>
                  <Text style={styles.optionDescription}>Continue with available cleaners</Text>
                </View>
                {dropoutLoading ? (
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                ) : (
                  <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
                )}
              </Pressable>

              <Pressable
                style={[styles.actionOptionButton, dropoutLoading && styles.buttonDisabled]}
                onPress={handleDropoutCancel}
                disabled={dropoutLoading}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: colors.error[50] }]}>
                  <Feather name="x-circle" size={22} color={colors.error[500]} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Cancel Without Fee</Text>
                  <Text style={styles.optionDescription}>Cancel with no cancellation fee</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Solo Completion Offer Accept/Decline Buttons */}
        {notification.type === "solo_completion_offer" && notification.data?.appointmentId && (
          <View style={styles.newHomeActionCard}>
            <Text style={styles.newHomeActionTitle}>Solo Completion Offer</Text>
            <Text style={styles.newHomeActionDescription}>
              Another cleaner dropped from this job. Would you like to complete it by yourself for the full pay?
            </Text>

            {/* Job Details Section */}
            <View style={styles.soloJobDetails}>
              {/* Date & Time */}
              {(notification.data?.formattedDate || notification.data?.date) && (
                <View style={styles.soloDetailRow}>
                  <Feather name="calendar" size={16} color={colors.primary[600]} />
                  <Text style={styles.soloDetailText}>
                    {notification.data?.formattedDate || (() => {
                      // Parse YYYY-MM-DD as local time to avoid timezone shift
                      const d = notification.data?.date;
                      if (typeof d === "string" && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        const [year, month, day] = d.split("-");
                        return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                      }
                      return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    })()}
                    {notification.data?.timeToBeCompleted && ` • ${notification.data.timeToBeCompleted}`}
                  </Text>
                </View>
              )}

              {/* Home Size */}
              {(notification.data?.numBeds || notification.data?.numBaths) && (
                <View style={styles.soloDetailRow}>
                  <Feather name="home" size={16} color={colors.primary[600]} />
                  <Text style={styles.soloDetailText}>
                    {notification.data?.numBeds || 0} bed, {notification.data?.numBaths || 0} bath
                    {notification.data?.city && ` in ${notification.data.city}`}
                  </Text>
                </View>
              )}

              {/* Square Footage */}
              {notification.data?.squareFootage && (
                <View style={styles.soloDetailRow}>
                  <Feather name="maximize" size={16} color={colors.primary[600]} />
                  <Text style={styles.soloDetailText}>
                    {notification.data.squareFootage.toLocaleString()} sq ft
                  </Text>
                </View>
              )}

              {/* Estimated Duration */}
              {notification.data?.estimatedHours && (
                <View style={styles.soloDetailRow}>
                  <Feather name="clock" size={16} color={colors.primary[600]} />
                  <Text style={styles.soloDetailText}>
                    Est. {notification.data.estimatedHours} {notification.data.estimatedHours === 1 ? "hour" : "hours"}
                  </Text>
                </View>
              )}

              {/* Linen Requirements */}
              {(notification.data?.bringSheets || notification.data?.bringTowels) && (
                <View style={styles.soloDetailRow}>
                  <Feather name="package" size={16} color={colors.warning[600]} />
                  <Text style={styles.soloDetailText}>
                    Bring: {[
                      notification.data?.bringSheets && "sheets",
                      notification.data?.bringTowels && "towels"
                    ].filter(Boolean).join(" & ")}
                  </Text>
                </View>
              )}
            </View>

            {/* Earnings Display */}
            {(notification.data?.earningsOffered || notification.data?.fullEarnings || notification.data?.fullEarningsDollars) && (
              <View style={styles.soloEarningsDisplay}>
                <Text style={styles.soloEarningsLabel}>Your Earnings</Text>
                <Text style={styles.soloEarningsValue}>
                  ${notification.data?.fullEarningsDollars ||
                    (typeof notification.data?.earningsOffered === "number"
                      ? (notification.data.earningsOffered / 100).toFixed(2)
                      : typeof notification.data?.fullEarnings === "number"
                        ? (notification.data.fullEarnings / 100).toFixed(2)
                        : notification.data?.fullEarnings || "0.00")}
                </Text>
              </View>
            )}

            <View style={styles.newHomeButtonRow}>
              <Pressable
                style={[styles.declineButton, processing && styles.buttonDisabled]}
                onPress={handleDeclineSoloOffer}
                disabled={processing}
              >
                <Feather name="x" size={18} color={colors.error[600]} />
                <Text style={styles.declineButtonText}>Decline</Text>
              </Pressable>
              <Pressable
                style={[styles.acceptButton, processing && styles.buttonDisabled]}
                onPress={handleAcceptSoloOffer}
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
            </View>
          </View>
        )}

        {/* Urgent Job Notification - Appointment Details + Action/Status */}
        {["multi_cleaner_urgent", "multi_cleaner_offer", "last_minute_urgent"].includes(notification.type) && (() => {
          const isExpired = notification.expiresAt && new Date() > new Date(notification.expiresAt);
          const isFilled = notification.data?.filled;
          const appt = notification.appointment;
          const home = appt?.home;
          const appointmentGone = !appt;

          // Earnings: multi-cleaner uses earningsAmount, last-minute uses price
          const earningsCents = notification.data?.earningsAmount || appt?.price;
          const earningsDisplay = earningsCents
            ? `$${(earningsCents / 100).toFixed(2)}`
            : null;

          const appointmentDate = appt?.date;
          const formattedDate = appointmentDate
            ? (() => {
                const d = appointmentDate;
                if (typeof d === "string" && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  const [year, month, day] = d.split("-");
                  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric", year: "numeric",
                  });
                }
                return new Date(d).toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric", year: "numeric",
                });
              })()
            : null;

          return (
            <>
              {/* Appointment Details Card — only when appointment still exists */}
              {!appointmentGone && <View style={styles.urgentJobDetailsCard}>
                <Text style={styles.urgentJobDetailsTitle}>Appointment Details</Text>

                {formattedDate && (
                  <View style={styles.urgentJobDetailRow}>
                    <Feather name="calendar" size={16} color={colors.primary[600]} />
                    <Text style={styles.urgentJobDetailText}>{formattedDate}</Text>
                  </View>
                )}

                {appt?.timeToBeCompleted && (
                  <View style={styles.urgentJobDetailRow}>
                    <Feather name="clock" size={16} color={colors.primary[600]} />
                    <Text style={styles.urgentJobDetailText}>{appt.timeToBeCompleted}</Text>
                  </View>
                )}

                {earningsDisplay && (
                  <View style={styles.urgentJobDetailRow}>
                    <Feather name="dollar-sign" size={16} color={colors.success[600]} />
                    <Text style={[styles.urgentJobDetailText, styles.urgentJobEarnings]}>{earningsDisplay}</Text>
                  </View>
                )}

                {home && (home.numBeds || home.numBaths) && (
                  <View style={styles.urgentJobDetailRow}>
                    <Feather name="home" size={16} color={colors.primary[600]} />
                    <Text style={styles.urgentJobDetailText}>
                      {[home.numBeds && `${home.numBeds} bed`, home.numBaths && `${home.numBaths} bath`].filter(Boolean).join(", ")}
                      {home.squareFootage ? ` · ${home.squareFootage.toLocaleString()} sq ft` : ""}
                    </Text>
                  </View>
                )}

                {home?.city && (
                  <View style={styles.urgentJobDetailRow}>
                    <Feather name="map-pin" size={16} color={colors.primary[600]} />
                    <Text style={styles.urgentJobDetailText}>{home.city}</Text>
                  </View>
                )}

                {notification.data?.distanceMiles && (
                  <View style={styles.urgentJobDetailRow}>
                    <Feather name="navigation" size={16} color={colors.primary[600]} />
                    <Text style={styles.urgentJobDetailText}>{notification.data.distanceMiles} miles away</Text>
                  </View>
                )}

                {(appt?.bringSheets?.toLowerCase() === "yes" || appt?.bringTowels?.toLowerCase() === "yes") && (
                  <View style={styles.urgentJobDetailRow}>
                    <Feather name="package" size={16} color={colors.warning[600]} />
                    <Text style={styles.urgentJobDetailText}>
                      {"Bring: " + [
                        appt.bringSheets?.toLowerCase() === "yes" && "sheets",
                        appt.bringTowels?.toLowerCase() === "yes" && "towels",
                      ].filter(Boolean).join(" & ")}
                    </Text>
                  </View>
                )}

                {notification.type === "multi_cleaner_urgent" && notification.data?.daysRemaining != null && (
                  <View style={[styles.urgentJobDetailRow, styles.urgentJobWarningRow]}>
                    <Feather name="alert-circle" size={16} color={colors.error[600]} />
                    <Text style={styles.urgentJobWarningText}>
                      {notification.data.daysRemaining === 0
                        ? "Job is today — act now!"
                        : `${notification.data.daysRemaining} day${notification.data.daysRemaining === 1 ? "" : "s"} until appointment`}
                    </Text>
                  </View>
                )}
              </View>}

              {/* Action / Status Card */}
              <View style={styles.newHomeActionCard}>
                {appointmentGone ? (
                  <>
                    <View style={styles.filledJobIconContainer}>
                      <Feather name="x-circle" size={28} color={colors.neutral[400]} />
                    </View>
                    <Text style={styles.filledJobTitle}>Appointment No Longer Available</Text>
                    <Text style={styles.filledJobDescription}>
                      This appointment has been removed or cancelled. Check out other available jobs in your area.
                    </Text>
                    <Pressable style={styles.viewButton} onPress={() => navigate("/new-job-choice")}>
                      <Feather name="search" size={16} color={colors.primary[600]} />
                      <Text style={styles.viewButtonText}>Browse Other Jobs</Text>
                    </Pressable>
                  </>
                ) : isFilled ? (
                  <>
                    <View style={styles.filledJobIconContainer}>
                      <Feather name="check-circle" size={28} color={colors.neutral[500]} />
                    </View>
                    <Text style={styles.filledJobTitle}>Job Already Filled</Text>
                    <Text style={styles.filledJobDescription}>
                      Another cleaner has already taken this job. Check out other available appointments.
                    </Text>
                    <Pressable style={styles.viewButton} onPress={() => navigate("/new-job-choice")}>
                      <Feather name="search" size={16} color={colors.primary[600]} />
                      <Text style={styles.viewButtonText}>Browse Other Jobs</Text>
                    </Pressable>
                  </>
                ) : isExpired ? (
                  <>
                    <View style={styles.filledJobIconContainer}>
                      <Feather name="clock" size={28} color={colors.neutral[400]} />
                    </View>
                    <Text style={styles.filledJobTitle}>This Job Has Passed</Text>
                    <Text style={styles.filledJobDescription}>
                      The window for this job has closed. Check out other available appointments in your area.
                    </Text>
                    <Pressable style={styles.viewButton} onPress={() => navigate("/new-job-choice")}>
                      <Feather name="search" size={16} color={colors.primary[600]} />
                      <Text style={styles.viewButtonText}>Browse Other Jobs</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.newHomeActionTitle}>
                      {notification.type === "last_minute_urgent" ? "Last-Minute Job Available" : "Urgent: Job Needs Cleaners"}
                    </Text>
                    <Text style={styles.newHomeActionDescription}>
                      {notification.type === "last_minute_urgent"
                        ? "A last-minute cleaning is available. Tap below to view and request it."
                        : "This multi-cleaner job still has open slots. Tap below to view and join."}
                    </Text>
                    <Pressable style={styles.primaryActionButton} onPress={handleActionPress}>
                      <Feather name="briefcase" size={18} color={colors.neutral[0]} />
                      <Text style={styles.primaryActionButtonText}>View & Request Appointment</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </>
          );
        })()}

        {/* Action Button - only for types without inline actions */}
        {notification.actionRequired &&
          !["solo_completion_offer", "new_home_request", "pending_booking", "business_owner_declined",
            "payment_failed", "payment_retry_failed", "edge_case_decision_required",
            "cleaner_dropout", "multi_cleaner_final_warning",
            "multi_cleaner_urgent", "multi_cleaner_offer", "last_minute_urgent"].includes(notification.type) && (
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

      {/* Pending Booking Modal */}
      {notification && (
        <PendingBookingModal
          visible={showPendingBookingModal}
          booking={{
            id: notification.data?.appointmentId,
            date: notification.data?.date,
            price: notification.data?.price,
            timeWindow: notification.data?.timeWindow,
            expiresAt: notification.expiresAt,
            cleanerBusiness: {
              name: notification.data?.cleanerName || notification.data?.businessOwnerName,
            },
            Home: {
              nickname: notification.data?.homeName,
              address: notification.data?.homeAddress,
            },
            notes: notification.data?.notes,
          }}
          onClose={() => setShowPendingBookingModal(false)}
          onActionComplete={handlePendingBookingAction}
        />
      )}

      {/* Business Owner Declined Modal */}
      {notification && (
        <BusinessOwnerDeclinedModal
          visible={showDeclinedModal}
          notification={notification}
          onClose={() => setShowDeclinedModal(false)}
          onComplete={() => {
            setShowDeclinedModal(false);
            setNotification(prev => prev ? { ...prev, actionRequired: false } : prev);
            navigate("/notifications");
          }}
        />
      )}

      {/* Cleaner Dropout Modal */}
      {notification && (
        <CleanerDropoutModal
          visible={showDropoutModal}
          appointmentDetails={{
            date: notification.data?.date,
            address: notification.data?.homeAddress,
          }}
          remainingCleaners={notification.data?.remainingCleaners || notification.data?.confirmedCleaners || 1}
          originalCleaners={notification.data?.originalCleaners || notification.data?.requiredCleaners || 2}
          onProceed={handleDropoutProceed}
          onWaitReplacement={handleDropoutWait}
          onReschedule={handleDropoutReschedule}
          onCancel={handleDropoutCancel}
          onClose={() => setShowDropoutModal(false)}
          loading={dropoutLoading}
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
  // Solo job details styles
  soloJobDetails: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  soloDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  soloDetailText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[700],
    flex: 1,
  },
  soloEarningsDisplay: {
    backgroundColor: colors.success[50],
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  soloEarningsLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    marginBottom: spacing.xs,
    fontWeight: "500",
  },
  soloEarningsValue: {
    fontSize: typography.fontSize.xxxl || 32,
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
  // Action options styles (for multi-choice notification actions)
  optionsContainer: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing.md,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.neutral[800],
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
  },
  // Urgent warning box (for payment failed)
  urgentWarningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error[200],
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  urgentWarningText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
    lineHeight: 20,
  },
  // Primary action button (full-width)
  primaryActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  primaryActionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.neutral[0],
  },
  // Expiration note
  expirationNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  expirationText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
  },
  // Decision Made card styles
  decisionMadeCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: spacing.lg,
    alignItems: "center",
    ...shadows.md,
  },
  decisionMadeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  decisionMadeTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: "700",
    color: colors.neutral[900],
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  decisionMadeDescription: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[600],
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  decisionMadeTime: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[400],
    textAlign: "center",
  },
  // Urgent job appointment details card
  urgentJobDetailsCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  urgentJobDetailsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: "700",
    color: colors.neutral[800],
    marginBottom: spacing.md,
  },
  urgentJobDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  urgentJobDetailText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[700],
    flex: 1,
  },
  urgentJobEarnings: {
    fontWeight: "700",
    color: colors.success[700],
    fontSize: typography.fontSize.lg,
  },
  urgentJobWarningRow: {
    marginTop: spacing.xs,
    backgroundColor: colors.error[50],
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  urgentJobWarningText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
    fontWeight: "600",
    flex: 1,
  },
  // Filled job state styles
  filledJobIconContainer: {
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  filledJobTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: "600",
    color: colors.neutral[600],
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  filledJobDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  // Cleaner Profile Card styles
  cleanerProfileCard: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  cleanerProfileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  cleanerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  cleanerProfileInfo: {
    flex: 1,
  },
  cleanerProfileName: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.neutral[900],
    marginBottom: 4,
  },
  cleanerRatingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  starsContainer: {
    flexDirection: "row",
    marginRight: spacing.sm,
  },
  cleanerRatingText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
  },
  noReviewsText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    fontStyle: "italic",
  },
  recommendationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  recommendationText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    fontWeight: "500",
  },
  recentReviewsSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.primary[200],
  },
  recentReviewsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
    color: colors.neutral[700],
    marginBottom: spacing.sm,
  },
  reviewItem: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  reviewStars: {
    flexDirection: "row",
  },
  reviewerName: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
  reviewComment: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
    lineHeight: 18,
  },
});

export default NotificationDetailScreen;
