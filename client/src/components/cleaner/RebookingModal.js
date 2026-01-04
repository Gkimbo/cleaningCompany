import React, { useState, useMemo, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import NotificationsService from "../../services/fetchRequests/NotificationsService";

const RebookingModal = ({
  visible,
  onClose,
  onSuccess,
  originalAppointment,
  token,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [customPrice, setCustomPrice] = useState("");
  const [timeWindow, setTimeWindow] = useState("anytime");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const TIME_WINDOWS = [
    { value: "anytime", label: "Anytime" },
    { value: "10-3", label: "10am - 3pm" },
    { value: "11-4", label: "11am - 4pm" },
    { value: "12-2", label: "12pm - 2pm" },
  ];

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedDate(null);
      setCustomPrice(originalAppointment?.price?.toString() || "");
      setTimeWindow("anytime");
      setCurrentMonth(new Date());
    }
  }, [visible, originalAppointment]);

  // Parse suggested dates from original appointment
  const suggestedDates = useMemo(() => {
    if (!originalAppointment?.suggestedDates) return [];
    try {
      const dates = typeof originalAppointment.suggestedDates === "string"
        ? JSON.parse(originalAppointment.suggestedDates)
        : originalAppointment.suggestedDates;
      return dates.map((d) => new Date(d));
    } catch (e) {
      return [];
    }
  }, [originalAppointment]);

  // Generate calendar days
  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDay; i++) {
      days.push({ day: null, date: null });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isPast = date < today;
      const dateString = date.toISOString().split("T")[0];
      const isSuggested = suggestedDates.some(
        (sd) => sd.toDateString() === date.toDateString()
      );
      days.push({ day, date: dateString, isPast, isSuggested });
    }

    return days;
  }, [currentMonth, suggestedDates]);

  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const goToPreviousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  const handleDateSelect = (dateString) => {
    if (dateString) {
      setSelectedDate(dateString);
    }
  };

  const formatSelectedDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString + "T12:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleSubmit = async () => {
    if (!selectedDate) {
      Alert.alert("Error", "Please select a date for the new appointment");
      return;
    }

    setIsLoading(true);
    try {
      const bookingData = {
        date: selectedDate,
        timeWindow,
      };

      if (customPrice && customPrice.trim()) {
        bookingData.price = parseFloat(customPrice);
      }

      const result = await NotificationsService.rebookAppointment(
        token,
        originalAppointment.id,
        bookingData
      );

      if (result.error) {
        Alert.alert("Error", result.error);
      } else {
        Alert.alert(
          "Rebooked!",
          `New cleaning scheduled for ${formatSelectedDate(selectedDate)}. The client will be notified.`,
          [{ text: "OK", onPress: () => onSuccess && onSuccess(result.appointment) }]
        );
        onClose();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to rebook appointment. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!originalAppointment) return null;

  // Get client name
  const clientName = originalAppointment.cleanerClient?.client
    ? `${originalAppointment.cleanerClient.client.firstName} ${originalAppointment.cleanerClient.client.lastName}`
    : originalAppointment.cleanerClient?.invitedName || "Client";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Rebook Appointment</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Feather name="x" size={24} color={colors.neutral[500]} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Decline Info */}
            <View style={styles.declineInfoCard}>
              <View style={styles.declineHeader}>
                <Feather name="x-circle" size={18} color={colors.error[600]} />
                <Text style={styles.declineHeaderText}>
                  {clientName} declined your booking
                </Text>
              </View>
              {originalAppointment.declineReason && (
                <View style={styles.declineReasonBox}>
                  <Text style={styles.declineReasonLabel}>Reason:</Text>
                  <Text style={styles.declineReasonText}>
                    "{originalAppointment.declineReason}"
                  </Text>
                </View>
              )}
              {suggestedDates.length > 0 && (
                <View style={styles.suggestedDatesBox}>
                  <Text style={styles.suggestedDatesLabel}>
                    Suggested alternatives:
                  </Text>
                  <View style={styles.suggestedDatesList}>
                    {suggestedDates.map((date, index) => (
                      <Pressable
                        key={index}
                        style={[
                          styles.suggestedDateChip,
                          selectedDate === date.toISOString().split("T")[0] &&
                            styles.suggestedDateChipSelected,
                        ]}
                        onPress={() =>
                          handleDateSelect(date.toISOString().split("T")[0])
                        }
                      >
                        <Text
                          style={[
                            styles.suggestedDateChipText,
                            selectedDate === date.toISOString().split("T")[0] &&
                              styles.suggestedDateChipTextSelected,
                          ]}
                        >
                          {date.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Calendar */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select New Date</Text>
              <View style={styles.calendar}>
                <View style={styles.calendarHeader}>
                  <Pressable
                    style={styles.monthNavButton}
                    onPress={goToPreviousMonth}
                  >
                    <Feather
                      name="chevron-left"
                      size={20}
                      color={colors.text.primary}
                    />
                  </Pressable>
                  <Text style={styles.monthText}>{monthName}</Text>
                  <Pressable
                    style={styles.monthNavButton}
                    onPress={goToNextMonth}
                  >
                    <Feather
                      name="chevron-right"
                      size={20}
                      color={colors.text.primary}
                    />
                  </Pressable>
                </View>

                <View style={styles.dayHeaders}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <Text key={day} style={styles.dayHeader}>
                        {day}
                      </Text>
                    )
                  )}
                </View>

                <View style={styles.calendarGrid}>
                  {calendarData.map((item, index) => (
                    <Pressable
                      key={index}
                      style={[
                        styles.dayCell,
                        !item.day && styles.dayCellEmpty,
                        item.isPast && styles.dayCellPast,
                        selectedDate === item.date && styles.dayCellSelected,
                        item.isSuggested &&
                          selectedDate !== item.date &&
                          styles.dayCellSuggested,
                      ]}
                      onPress={() => !item.isPast && handleDateSelect(item.date)}
                      disabled={!item.day || item.isPast}
                    >
                      {item.day && (
                        <Text
                          style={[
                            styles.dayText,
                            item.isPast && styles.dayTextPast,
                            selectedDate === item.date && styles.dayTextSelected,
                            item.isSuggested &&
                              selectedDate !== item.date &&
                              styles.dayTextSuggested,
                          ]}
                        >
                          {item.day}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>

              {selectedDate && (
                <View style={styles.selectedDateBadge}>
                  <Feather name="calendar" size={14} color={colors.primary[600]} />
                  <Text style={styles.selectedDateText}>
                    {formatSelectedDate(selectedDate)}
                  </Text>
                </View>
              )}

              {suggestedDates.length > 0 && (
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: colors.success[400] },
                      ]}
                    />
                    <Text style={styles.legendText}>Client suggested</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Time Window */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Time Window</Text>
              <View style={styles.timeWindowOptions}>
                {TIME_WINDOWS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.timeWindowOption,
                      timeWindow === option.value && styles.timeWindowOptionActive,
                    ]}
                    onPress={() => setTimeWindow(option.value)}
                  >
                    <Text
                      style={[
                        styles.timeWindowOptionText,
                        timeWindow === option.value &&
                          styles.timeWindowOptionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Price */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Price</Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.pricePrefix}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Enter price"
                  placeholderTextColor={colors.neutral[400]}
                  value={customPrice}
                  onChangeText={setCustomPrice}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Info Banner */}
            <View style={styles.infoBanner}>
              <Feather name="info" size={16} color={colors.primary[600]} />
              <Text style={styles.infoBannerText}>
                The client will receive a new notification to approve this booking.
                They have 48 hours to respond.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.cancelButtonPressed,
              ]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.rebookButton,
                pressed && styles.rebookButtonPressed,
                (!selectedDate || isLoading) && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedDate || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.neutral[0]} />
              ) : (
                <>
                  <Feather name="refresh-cw" size={18} color={colors.neutral[0]} />
                  <Text style={styles.rebookButtonText}>Send New Request</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    maxHeight: "90%",
    ...shadows.xl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },

  // Decline info card
  declineInfoCard: {
    backgroundColor: colors.error[50],
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  declineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  declineHeaderText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[700],
  },
  declineReasonBox: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  declineReasonLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[500],
    marginBottom: spacing.xs,
  },
  declineReasonText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontStyle: "italic",
  },
  suggestedDatesBox: {
    marginTop: spacing.md,
  },
  suggestedDatesLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.error[700],
    marginBottom: spacing.sm,
  },
  suggestedDatesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  suggestedDateChip: {
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success[400],
  },
  suggestedDateChipSelected: {
    backgroundColor: colors.success[500],
    borderColor: colors.success[500],
  },
  suggestedDateChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[700],
  },
  suggestedDateChipTextSelected: {
    color: colors.neutral[0],
  },

  // Section
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  // Calendar
  calendar: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  monthNavButton: {
    padding: spacing.sm,
  },
  monthText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  dayHeaders: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  dayHeader: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[400],
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellEmpty: {},
  dayCellPast: {
    opacity: 0.3,
  },
  dayCellSelected: {
    backgroundColor: colors.primary[600],
    borderRadius: radius.full,
  },
  dayCellSuggested: {
    backgroundColor: colors.success[100],
    borderRadius: radius.full,
  },
  dayText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  dayTextPast: {
    color: colors.neutral[400],
  },
  dayTextSelected: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
  },
  dayTextSuggested: {
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },
  selectedDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  selectedDateText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },

  // Time Window
  timeWindowOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  timeWindowOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  timeWindowOptionActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  timeWindowOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  timeWindowOptionTextActive: {
    color: colors.neutral[0],
  },

  // Price Input
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  pricePrefix: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginRight: spacing.sm,
  },
  priceInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },

  // Info Banner
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  infoBannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },

  // Footer
  footer: {
    flexDirection: "row",
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  cancelButtonPressed: {
    backgroundColor: colors.neutral[100],
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  rebookButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  rebookButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  rebookButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default RebookingModal;
