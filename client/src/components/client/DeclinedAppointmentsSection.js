/**
 * DeclinedAppointmentsSection
 * Shows appointments where the preferred cleaner declined and homeowner needs to respond
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import CleanerClientService from "../../services/fetchRequests/CleanerClientService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Response Modal Component
const ResponseModal = ({ visible, appointment, onClose, onRespond, loading }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  if (!appointment) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.warningIcon}>
              <Icon name="exclamation-circle" size={32} color={colors.warning[500]} />
            </View>
            <Text style={styles.modalTitle}>Cleaner Unavailable</Text>
            <Text style={styles.modalSubtitle}>
              {appointment.cleaner?.name || "Your cleaner"} can't make it on{" "}
              {formatDate(appointment.date)}
            </Text>
          </View>

          <View style={styles.appointmentInfo}>
            <View style={styles.infoRow}>
              <Icon name="home" size={14} color={colors.text.secondary} />
              <Text style={styles.infoText}>{appointment.home.address}</Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="dollar" size={14} color={colors.text.secondary} />
              <Text style={styles.infoText}>
                Your price: ${parseFloat(appointment.price).toFixed(2)}
              </Text>
            </View>
          </View>

          <Text style={styles.optionsTitle}>What would you like to do?</Text>

          <View style={styles.optionButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.optionButton,
                styles.cancelOption,
                pressed && styles.optionPressed,
                loading && styles.optionDisabled,
              ]}
              onPress={() => onRespond("cancel")}
              disabled={loading}
            >
              {loading === "cancel" ? (
                <ActivityIndicator size="small" color={colors.error[600]} />
              ) : (
                <>
                  <Icon name="times-circle" size={24} color={colors.error[600]} />
                  <Text style={styles.cancelOptionTitle}>Cancel Appointment</Text>
                  <Text style={styles.optionDescription}>
                    Remove this appointment from your schedule
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.optionButton,
                styles.openOption,
                pressed && styles.optionPressed,
                loading && styles.optionDisabled,
              ]}
              onPress={() => onRespond("open_to_market")}
              disabled={loading}
            >
              {loading === "open_to_market" ? (
                <ActivityIndicator size="small" color={colors.primary[600]} />
              ) : (
                <>
                  <Icon name="users" size={24} color={colors.primary[600]} />
                  <Text style={styles.openOptionTitle}>Find Another Cleaner</Text>
                  <Text style={styles.optionDescription}>
                    Open to other available cleaners (platform pricing applies)
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
            onPress={onClose}
            disabled={!!loading}
          >
            <Text style={styles.closeButtonText}>Decide Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

// Individual declined appointment card
const DeclinedAppointmentCard = ({ appointment, onPress }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.appointmentCard,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.urgentBadge}>
        <Icon name="exclamation-triangle" size={12} color={colors.warning[700]} />
        <Text style={styles.urgentBadgeText}>Action Needed</Text>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardInfo}>
          <Text style={styles.cleanerName}>
            {appointment.cleaner?.name || "Your cleaner"} is unavailable
          </Text>
          <Text style={styles.appointmentDate}>{formatDate(appointment.date)}</Text>
          <Text style={styles.homeAddress} numberOfLines={1}>
            {appointment.home.nickName || appointment.home.address}
          </Text>
        </View>
        <View style={styles.respondPrompt}>
          <Text style={styles.respondText}>Respond</Text>
          <Icon name="chevron-right" size={12} color={colors.primary[600]} />
        </View>
      </View>
    </Pressable>
  );
};

const DeclinedAppointmentsSection = ({ token, onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchPendingResponses = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      const result = await CleanerClientService.getPendingResponses(token);
      setAppointments(result.appointments || []);
    } catch (error) {
      console.error("Error fetching pending responses:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPendingResponses();
  }, [fetchPendingResponses]);

  const handleOpenModal = (appointment) => {
    setSelectedAppointment(appointment);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedAppointment(null);
  };

  const handleRespond = async (action) => {
    if (!selectedAppointment) return;

    setActionLoading(action);
    try {
      const result = await CleanerClientService.respondToDecline(
        token,
        selectedAppointment.id,
        action
      );

      if (result.success) {
        // Remove from list
        setAppointments((prev) => prev.filter((a) => a.id !== selectedAppointment.id));
        handleCloseModal();

        if (action === "cancelled") {
          Alert.alert("Appointment Cancelled", "Your appointment has been cancelled.");
        } else if (action === "opened_to_market") {
          Alert.alert(
            "Opened to Other Cleaners",
            `Your appointment is now open to other cleaners. The price has been updated to platform pricing ($${result.newPrice?.toFixed(2) || "varies"}).`
          );
        }

        if (onRefresh) onRefresh();
      } else {
        Alert.alert("Error", result.error || "Failed to respond. Please try again.");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to respond. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // Don't show section if no pending responses
  if (!loading && appointments.length === 0) {
    return null;
  }

  if (loading) {
    return null; // Don't show loading state, just wait for data
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Icon name="bell" size={16} color={colors.warning[600]} />
          <Text style={styles.sectionTitle}>Needs Your Attention</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{appointments.length}</Text>
        </View>
      </View>

      {appointments.map((appointment) => (
        <DeclinedAppointmentCard
          key={appointment.id}
          appointment={appointment}
          onPress={() => handleOpenModal(appointment)}
        />
      ))}

      <ResponseModal
        visible={showModal}
        appointment={selectedAppointment}
        onClose={handleCloseModal}
        onRespond={handleRespond}
        loading={actionLoading}
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
    backgroundColor: colors.warning[500],
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
  appointmentCard: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  urgentBadge: {
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
  urgentBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  cardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
  },
  cleanerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  appointmentDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  homeAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  respondPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  respondText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    padding: spacing.xl,
    paddingBottom: spacing["3xl"],
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  warningIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.warning[100],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
  appointmentInfo: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  optionsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  optionButtons: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  optionButton: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 2,
  },
  cancelOption: {
    borderColor: colors.error[200],
    backgroundColor: colors.error[50],
  },
  openOption: {
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
  },
  optionPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  optionDisabled: {
    opacity: 0.6,
  },
  cancelOptionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[700],
    marginTop: spacing.sm,
  },
  openOptionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
    marginTop: spacing.sm,
  },
  optionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  closeButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  closeButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
});

export default DeclinedAppointmentsSection;
