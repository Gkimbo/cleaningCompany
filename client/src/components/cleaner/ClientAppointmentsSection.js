/**
 * ClientAppointmentsSection
 * Shows appointments from the business owner's clients that need attention
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { Feather } from "@expo/vector-icons";
import CleanerClientService from "../../services/fetchRequests/CleanerClientService";
import MessageService from "../../services/fetchRequests/MessageClass";
import PendingClientResponseCard from "./PendingClientResponseCard";
import RebookingModal from "./RebookingModal";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Individual appointment card for pending appointments
const PendingAppointmentCard = ({ appointment, onAccept, onDecline, onMessage, loading }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentHeader}>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{appointment.client.name}</Text>
          <Text style={styles.homeAddress} numberOfLines={1}>
            {appointment.home.address}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [
              styles.messageIconButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => onMessage(appointment.client.id)}
          >
            <Icon name="comment" size={16} color={colors.primary[600]} />
          </Pressable>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Your price</Text>
            <Text style={styles.priceValue}>${parseFloat(appointment.price).toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.appointmentDetails}>
        <View style={styles.detailRow}>
          <Icon name="calendar" size={14} color={colors.text.secondary} />
          <Text style={styles.detailText}>{formatDate(appointment.date)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="clock-o" size={14} color={colors.text.secondary} />
          <Text style={styles.detailText}>
            {appointment.timeWindow === "anytime" ? "Anytime" : appointment.timeWindow}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="home" size={14} color={colors.text.secondary} />
          <Text style={styles.detailText}>
            {appointment.home.beds} bed | {appointment.home.baths} bath
          </Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <Pressable
          style={({ pressed }) => [
            styles.declineButton,
            pressed && styles.buttonPressed,
            loading && styles.buttonDisabled,
          ]}
          onPress={() => onDecline(appointment.id)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.error[600]} />
          ) : (
            <>
              <Icon name="times" size={14} color={colors.error[600]} />
              <Text style={styles.declineButtonText}>Can't Do It</Text>
            </>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.acceptButton,
            pressed && styles.buttonPressed,
            loading && styles.buttonDisabled,
          ]}
          onPress={() => onAccept(appointment.id)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="check" size={14} color="#fff" />
              <Text style={styles.acceptButtonText}>Accept</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
};

// Card showing declined appointment awaiting client response
const DeclinedAppointmentCard = ({ appointment, onMessage }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <View style={styles.declinedCard}>
      <View style={styles.declinedBadge}>
        <Icon name="clock-o" size={12} color={colors.warning[700]} />
        <Text style={styles.declinedBadgeText}>Awaiting Client Response</Text>
      </View>
      <View style={styles.appointmentHeader}>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{appointment.client.name}</Text>
          <Text style={styles.homeAddress} numberOfLines={1}>
            {appointment.home.address}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.messageIconButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => onMessage(appointment.client.id)}
        >
          <Icon name="comment" size={16} color={colors.primary[600]} />
        </Pressable>
      </View>
      <View style={styles.appointmentDetails}>
        <View style={styles.detailRow}>
          <Icon name="calendar" size={14} color={colors.text.secondary} />
          <Text style={styles.detailText}>{formatDate(appointment.date)}</Text>
        </View>
      </View>
      <Text style={styles.declinedNote}>
        Client can cancel or open to other cleaners
      </Text>
    </View>
  );
};

const ClientAppointmentsSection = ({ token, onRefresh }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [pendingAppointments, setPendingAppointments] = useState([]);
  const [declinedAppointments, setDeclinedAppointments] = useState([]);
  const [hasClients, setHasClients] = useState(false);

  // State for pending client responses (bookings made FOR clients)
  const [awaitingClientResponse, setAwaitingClientResponse] = useState([]);
  const [showRebookModal, setShowRebookModal] = useState(false);
  const [selectedAppointmentForRebook, setSelectedAppointmentForRebook] = useState(null);

  const fetchClientAppointments = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      // Fetch both types of appointments in parallel
      const [clientAppts, pendingResponses] = await Promise.all([
        CleanerClientService.getClientAppointments(token),
        CleanerClientService.getPendingClientResponses(token),
      ]);

      setPendingAppointments(clientAppts.pending || []);
      setDeclinedAppointments(clientAppts.declined || []);

      // Combine pending, declined, and expired into one list
      const allAwaitingResponse = [
        ...(pendingResponses.pending || []),
        ...(pendingResponses.declined || []),
        ...(pendingResponses.expired || []),
      ];
      setAwaitingClientResponse(allAwaitingResponse);

      // If there are any appointments, they have clients
      setHasClients(
        (clientAppts.pending?.length > 0) ||
        (clientAppts.declined?.length > 0) ||
        (clientAppts.upcoming?.length > 0) ||
        allAwaitingResponse.length > 0
      );
    } catch (error) {
      console.error("Error fetching client appointments:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchClientAppointments();
  }, [fetchClientAppointments]);

  const handleAccept = async (appointmentId) => {
    setActionLoading(appointmentId);
    try {
      const result = await CleanerClientService.acceptClientAppointment(token, appointmentId);
      if (result.success) {
        // Remove from pending list
        setPendingAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
        if (onRefresh) onRefresh();
      } else {
        Alert.alert("Error", result.error || "Failed to accept appointment");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to accept appointment");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (appointmentId) => {
    Alert.alert(
      "Decline Appointment",
      "Are you sure you can't do this cleaning? The client will be notified and can choose to cancel or find another cleaner.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, I Can't Do It",
          style: "destructive",
          onPress: async () => {
            setActionLoading(appointmentId);
            try {
              const result = await CleanerClientService.declineClientAppointment(
                token,
                appointmentId
              );
              if (result.success) {
                // Move from pending to declined
                const appointment = pendingAppointments.find((a) => a.id === appointmentId);
                setPendingAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
                if (appointment) {
                  setDeclinedAppointments((prev) => [
                    ...prev,
                    { ...appointment, awaitingClientResponse: true },
                  ]);
                }
                if (onRefresh) onRefresh();
              } else {
                Alert.alert("Error", result.error || "Failed to decline appointment");
              }
            } catch (error) {
              Alert.alert("Error", "Failed to decline appointment");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleMessage = async (clientId) => {
    try {
      const result = await MessageService.createCleanerClientConversation(clientId, null, token);
      if (result.conversation) {
        navigate(`/messages/${result.conversation.id}`);
      } else {
        Alert.alert("Error", result.error || "Failed to start conversation");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to start conversation");
    }
  };

  const handleRebook = (appointment) => {
    setSelectedAppointmentForRebook(appointment);
    setShowRebookModal(true);
  };

  const handleRebookSuccess = () => {
    setShowRebookModal(false);
    setSelectedAppointmentForRebook(null);
    fetchClientAppointments();
    if (onRefresh) onRefresh();
  };

  const handleCancelBooking = async (appointment) => {
    Alert.alert(
      "Cancel Booking Request",
      `Are you sure you want to cancel this booking request for ${appointment.client?.name || "this client"}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            // TODO: Implement cancel endpoint if needed
            // For now, just remove from local state
            setAwaitingClientResponse((prev) =>
              prev.filter((a) => a.id !== appointment.id)
            );
            if (onRefresh) onRefresh();
          },
        },
      ]
    );
  };

  // Don't show section if user has no clients
  if (!loading && !hasClients && pendingAppointments.length === 0 && declinedAppointments.length === 0 && awaitingClientResponse.length === 0) {
    return null;
  }

  // Don't show section if no appointments at all
  if (!loading && pendingAppointments.length === 0 && declinedAppointments.length === 0 && awaitingClientResponse.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Client Appointments</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Icon name="users" size={16} color={colors.primary[600]} />
          <Text style={styles.sectionTitle}>Client Appointments</Text>
        </View>
        {pendingAppointments.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{pendingAppointments.length}</Text>
          </View>
        )}
      </View>

      {/* Pending appointments that need accept/decline */}
      {pendingAppointments.length > 0 && (
        <View style={styles.pendingSection}>
          <Text style={styles.subsectionTitle}>Needs Your Response</Text>
          {pendingAppointments.map((appointment) => (
            <PendingAppointmentCard
              key={appointment.id}
              appointment={appointment}
              onAccept={handleAccept}
              onDecline={handleDecline}
              onMessage={handleMessage}
              loading={actionLoading === appointment.id}
            />
          ))}
        </View>
      )}

      {/* Declined appointments awaiting client response */}
      {declinedAppointments.length > 0 && (
        <View style={styles.declinedSection}>
          <Text style={styles.subsectionTitle}>Awaiting Client Decision</Text>
          {declinedAppointments.map((appointment) => (
            <DeclinedAppointmentCard
              key={appointment.id}
              appointment={appointment}
              onMessage={handleMessage}
            />
          ))}
        </View>
      )}

      {/* Bookings sent to clients awaiting their response */}
      {awaitingClientResponse.length > 0 && (
        <View style={styles.awaitingSection}>
          <View style={styles.awaitingSectionHeader}>
            <Feather name="send" size={14} color={colors.primary[600]} />
            <Text style={styles.subsectionTitle}>Sent to Clients</Text>
          </View>
          <Text style={styles.subsectionDescription}>
            Booking requests you've sent that are waiting for client approval
          </Text>
          {awaitingClientResponse.map((appointment) => (
            <PendingClientResponseCard
              key={appointment.id}
              appointment={appointment}
              onMessage={handleMessage}
              onRebook={handleRebook}
              onCancel={handleCancelBooking}
              loading={actionLoading === appointment.id}
            />
          ))}
        </View>
      )}

      {/* Rebooking Modal */}
      <RebookingModal
        visible={showRebookModal}
        appointment={selectedAppointmentForRebook}
        onClose={() => {
          setShowRebookModal(false);
          setSelectedAppointmentForRebook(null);
        }}
        onSuccess={handleRebookSuccess}
        token={token}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
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
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  countBadge: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    minWidth: 24,
    alignItems: "center",
  },
  countBadgeText: {
    color: "#fff",
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  pendingSection: {
    marginBottom: spacing.md,
  },
  declinedSection: {
    marginTop: spacing.sm,
  },
  awaitingSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  awaitingSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  subsectionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
  },
  subsectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  appointmentCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },
  appointmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  clientInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  clientName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  homeAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  messageIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  priceLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  priceValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  appointmentDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  actionButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  declineButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error[300],
    backgroundColor: colors.error[50],
  },
  declineButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.error[600],
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.success[600],
  },
  acceptButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: "#fff",
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  declinedCard: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  declinedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.warning[100],
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  declinedBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  declinedNote: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
});

export default ClientAppointmentsSection;
