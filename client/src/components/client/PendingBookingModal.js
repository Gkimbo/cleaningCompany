import React, { useState, useEffect, useContext } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { UserContext } from "../../context/UserContext";
import NotificationsService from "../../services/fetchRequests/NotificationsService";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";
import useCountdown from "../../hooks/useCountdown";

const PendingBookingModal = ({ visible, booking, onClose, onActionComplete }) => {
  const { state } = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [showDeclineOptions, setShowDeclineOptions] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [suggestDates, setSuggestDates] = useState(false);
  const [suggestedDates, setSuggestedDates] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Use countdown hook for expiration timer
  const { timeRemaining, isExpired, isWarning, isUrgent } = useCountdown(booking?.expiresAt);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setShowDeclineOptions(false);
      setDeclineReason("");
      setSuggestDates(false);
      setSuggestedDates([]);
    }
  }, [visible]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatPrice = (price) => {
    if (!price) return "Price TBD";
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const handleAccept = async () => {
    setLoading(true);
    try {
      const result = await NotificationsService.respondToBooking(
        state.currentUser.token,
        booking.id,
        "accept"
      );

      if (result.error) {
        console.error("Error accepting booking:", result.error);
        alert(result.error);
      } else {
        onActionComplete && onActionComplete("accepted", result.appointment);
        onClose();
      }
    } catch (error) {
      console.error("Error accepting booking:", error);
      alert("Failed to accept booking. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    setLoading(true);
    try {
      const result = await NotificationsService.respondToBooking(
        state.currentUser.token,
        booking.id,
        "decline",
        declineReason || null,
        suggestedDates.length > 0 ? suggestedDates.map(d => d.toISOString()) : null
      );

      if (result.error) {
        console.error("Error declining booking:", result.error);
        alert(result.error);
      } else {
        onActionComplete && onActionComplete("declined", result.appointment);
        onClose();
      }
    } catch (error) {
      console.error("Error declining booking:", error);
      alert("Failed to decline booking. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSuggestedDate = (event, date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (date) {
      // Check if date already exists
      const exists = suggestedDates.some(
        (d) => d.toDateString() === date.toDateString()
      );
      if (!exists && suggestedDates.length < 3) {
        setSuggestedDates([...suggestedDates, date]);
      }
      setSelectedDate(new Date());
    }
  };

  const removeSuggestedDate = (index) => {
    setSuggestedDates(suggestedDates.filter((_, i) => i !== index));
  };

  if (!booking) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Booking Request</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={colors.neutral[600]} />
            </Pressable>
          </View>

          {/* Timer Badge */}
          {timeRemaining && (
            <View
              style={[
                styles.timerBanner,
                isWarning && styles.warningBanner,
                isUrgent && styles.urgentBanner,
                isExpired && styles.expiredBanner,
              ]}
            >
              <Feather
                name="clock"
                size={16}
                color={
                  isExpired ? colors.neutral[600] :
                  isUrgent ? colors.error[700] :
                  isWarning ? colors.warning[700] :
                  colors.primary[700]
                }
              />
              <Text
                style={[
                  styles.timerBannerText,
                  isWarning && styles.warningBannerText,
                  isUrgent && styles.urgentBannerText,
                  isExpired && styles.expiredBannerText,
                ]}
              >
                {isExpired ? "This request has expired" : `Expires in ${timeRemaining}`}
              </Text>
            </View>
          )}

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Business Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>From</Text>
              <Text style={styles.businessName}>
                {booking.cleanerBusiness?.name || "Your Cleaning Service"}
              </Text>
            </View>

            {/* Appointment Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Appointment Details</Text>

              <View style={styles.detailRow}>
                <Feather name="calendar" size={18} color={colors.primary[500]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{formatDate(booking.date)}</Text>
                </View>
              </View>

              {booking.timeWindow && (
                <View style={styles.detailRow}>
                  <Feather name="clock" size={18} color={colors.primary[500]} />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Time Window</Text>
                    <Text style={styles.detailValue}>{booking.timeWindow}</Text>
                  </View>
                </View>
              )}

              <View style={styles.detailRow}>
                <Feather name="dollar-sign" size={18} color={colors.success[500]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Price</Text>
                  <Text style={[styles.detailValue, styles.priceValue]}>
                    {formatPrice(booking.price)}
                  </Text>
                </View>
              </View>

              {booking.Home && (
                <View style={styles.detailRow}>
                  <Feather name="home" size={18} color={colors.primary[500]} />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Home</Text>
                    <Text style={styles.detailValue}>
                      {booking.Home.nickname || booking.Home.address || "Your Home"}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Notes */}
            {booking.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.notesText}>{booking.notes}</Text>
              </View>
            )}

            {/* Decline Options (shown when declining) */}
            {showDeclineOptions && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Decline Options</Text>

                <Text style={styles.inputLabel}>Reason (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Let them know why this doesn't work..."
                  placeholderTextColor={colors.neutral[400]}
                  value={declineReason}
                  onChangeText={setDeclineReason}
                  multiline
                  numberOfLines={3}
                />

                {/* Suggest Dates Toggle */}
                <Pressable
                  style={styles.suggestToggle}
                  onPress={() => setSuggestDates(!suggestDates)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      suggestDates && styles.checkboxChecked,
                    ]}
                  >
                    {suggestDates && (
                      <Feather name="check" size={14} color={colors.neutral[0]} />
                    )}
                  </View>
                  <Text style={styles.suggestToggleText}>
                    Suggest alternative dates
                  </Text>
                </Pressable>

                {/* Suggested Dates */}
                {suggestDates && (
                  <View style={styles.suggestedDatesContainer}>
                    {suggestedDates.map((date, index) => (
                      <View key={index} style={styles.suggestedDateChip}>
                        <Text style={styles.suggestedDateText}>
                          {date.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                        <Pressable onPress={() => removeSuggestedDate(index)}>
                          <Feather name="x" size={16} color={colors.neutral[500]} />
                        </Pressable>
                      </View>
                    ))}
                    {suggestedDates.length < 3 && (
                      <Pressable
                        style={styles.addDateButton}
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Feather name="plus" size={16} color={colors.primary[600]} />
                        <Text style={styles.addDateText}>Add Date</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    minimumDate={new Date()}
                    onChange={handleAddSuggestedDate}
                  />
                )}
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            {!showDeclineOptions ? (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.declineButton,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setShowDeclineOptions(true)}
                  disabled={loading || isExpired}
                >
                  <Text style={styles.declineButtonText}>Decline</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.acceptButton,
                    pressed && { opacity: 0.8 },
                    (loading || isExpired) && styles.disabledButton,
                  ]}
                  onPress={handleAccept}
                  disabled={loading || isExpired}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.neutral[0]} />
                  ) : (
                    <>
                      <Feather name="check" size={20} color={colors.neutral[0]} />
                      <Text style={styles.acceptButtonText}>Accept Booking</Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setShowDeclineOptions(false)}
                  disabled={loading}
                >
                  <Text style={styles.cancelButtonText}>Back</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.confirmDeclineButton,
                    pressed && { opacity: 0.8 },
                    loading && styles.disabledButton,
                  ]}
                  onPress={handleDecline}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.neutral[0]} />
                  ) : (
                    <Text style={styles.confirmDeclineText}>Confirm Decline</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "90%",
    ...shadows.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: "700",
    color: colors.neutral[900],
  },
  closeButton: {
    padding: spacing.xs,
  },
  timerBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary[100],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  timerBannerText: {
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
    color: colors.primary[700],
  },
  warningBanner: {
    backgroundColor: colors.warning[100],
  },
  warningBannerText: {
    color: colors.warning[700],
  },
  urgentBanner: {
    backgroundColor: colors.error[100],
  },
  urgentBannerText: {
    color: colors.error[700],
  },
  expiredBanner: {
    backgroundColor: colors.neutral[200],
  },
  expiredBannerText: {
    color: colors.neutral[600],
  },
  content: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
    color: colors.neutral[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  businessName: {
    fontSize: typography.fontSize.lg,
    fontWeight: "600",
    color: colors.neutral[900],
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  detailValue: {
    fontSize: typography.fontSize.md,
    fontWeight: "500",
    color: colors.neutral[800],
  },
  priceValue: {
    color: colors.success[600],
    fontSize: typography.fontSize.lg,
    fontWeight: "700",
  },
  notesText: {
    fontSize: typography.fontSize.md,
    color: colors.neutral[700],
    lineHeight: 22,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: "500",
    color: colors.neutral[700],
    marginBottom: spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: typography.fontSize.md,
    color: colors.neutral[800],
    minHeight: 80,
    textAlignVertical: "top",
  },
  suggestToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.neutral[400],
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  suggestToggleText: {
    fontSize: typography.fontSize.md,
    color: colors.neutral[700],
  },
  suggestedDatesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  suggestedDateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  suggestedDateText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    fontWeight: "500",
  },
  addDateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary[400],
    borderStyle: "dashed",
  },
  addDateText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingBottom: Platform.OS === "ios" ? spacing.xl : spacing.md,
  },
  declineButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  declineButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  acceptButton: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.success[500],
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  acceptButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: "700",
    color: colors.neutral[0],
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  confirmDeclineButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.error[500],
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDeclineText: {
    fontSize: typography.fontSize.md,
    fontWeight: "700",
    color: colors.neutral[0],
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default PendingBookingModal;
