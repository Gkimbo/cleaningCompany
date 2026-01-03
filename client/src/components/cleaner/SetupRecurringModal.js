import React, { useState, useMemo } from "react";
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
import CleanerClientService from "../../services/fetchRequests/CleanerClientService";

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly", description: "Every week on the same day" },
  { value: "biweekly", label: "Every 2 Weeks", description: "Alternating weeks" },
  { value: "monthly", label: "Monthly", description: "Once a month" },
];

const DAY_OPTIONS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

const TIME_WINDOWS = [
  { value: "anytime", label: "Anytime" },
  { value: "10-3", label: "10am - 3pm" },
  { value: "11-4", label: "11am - 4pm" },
  { value: "12-2", label: "12pm - 2pm" },
];

const SetupRecurringModal = ({ visible, onClose, onSuccess, client, token }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [frequency, setFrequency] = useState("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday default
  const [timeWindow, setTimeWindow] = useState("anytime");
  const [customPrice, setCustomPrice] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get client display info
  const clientName = client?.client
    ? `${client.client.firstName} ${client.client.lastName}`
    : client?.invitedName || "Client";

  const homeAddress = client?.home
    ? `${client.home.address}, ${client.home.city}`
    : "No address set";

  const defaultPrice = client?.defaultPrice
    ? parseFloat(client.defaultPrice).toFixed(0)
    : null;

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
      const dayNum = date.getDay();
      days.push({ day, date: dateString, isPast, dayOfWeek: dayNum });
    }

    return days;
  }, [currentMonth]);

  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString + "T12:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getNextOccurrences = () => {
    if (!startDate) return [];

    const occurrences = [];
    let currentDate = new Date(startDate + "T12:00:00");
    const today = new Date();

    // Find first occurrence on selected day
    while (currentDate.getDay() !== dayOfWeek) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Generate next 4 occurrences
    for (let i = 0; i < 4; i++) {
      if (hasEndDate && endDate && currentDate > new Date(endDate + "T12:00:00")) {
        break;
      }
      occurrences.push(new Date(currentDate));

      if (frequency === "weekly") {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (frequency === "biweekly") {
        currentDate.setDate(currentDate.getDate() + 14);
      } else {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    return occurrences;
  };

  const handleSubmit = async () => {
    if (!startDate) {
      Alert.alert("Error", "Please select a start date");
      return;
    }

    setIsLoading(true);
    try {
      const scheduleData = {
        cleanerClientId: client.id,
        frequency,
        dayOfWeek,
        timeWindow,
        startDate,
      };

      if (customPrice && customPrice.trim()) {
        scheduleData.price = parseFloat(customPrice);
      }

      if (hasEndDate && endDate) {
        scheduleData.endDate = endDate;
      }

      const result = await CleanerClientService.createRecurringSchedule(
        token,
        scheduleData
      );

      if (result.success) {
        Alert.alert(
          "Schedule Created!",
          `${result.appointmentsCreated} appointments have been scheduled for ${clientName}.`,
          [{ text: "OK", onPress: () => onSuccess() }]
        );
        resetForm();
      } else {
        Alert.alert("Error", result.error || "Failed to create schedule");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to create schedule. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFrequency("weekly");
    setDayOfWeek(1);
    setTimeWindow("anytime");
    setCustomPrice("");
    setStartDate(null);
    setHasEndDate(false);
    setEndDate(null);
    setCurrentMonth(new Date());
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!client) return null;

  const nextOccurrences = getNextOccurrences();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Up Recurring</Text>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Feather name="x" size={24} color={colors.neutral[500]} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Client Info Card */}
            <View style={styles.clientCard}>
              <View style={styles.clientInfo}>
                <View style={styles.avatar}>
                  <Feather name="repeat" size={20} color={colors.primary[600]} />
                </View>
                <View style={styles.clientDetails}>
                  <Text style={styles.clientName}>{clientName}</Text>
                  <View style={styles.addressRow}>
                    <Feather name="home" size={12} color={colors.neutral[400]} />
                    <Text style={styles.addressText}>{homeAddress}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Frequency Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How Often?</Text>
              <View style={styles.frequencyOptions}>
                {FREQUENCY_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.frequencyOption,
                      frequency === option.value && styles.frequencyOptionActive,
                    ]}
                    onPress={() => setFrequency(option.value)}
                  >
                    <Text
                      style={[
                        styles.frequencyLabel,
                        frequency === option.value && styles.frequencyLabelActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={[
                        styles.frequencyDesc,
                        frequency === option.value && styles.frequencyDescActive,
                      ]}
                    >
                      {option.description}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Day of Week Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Which Day?</Text>
              <View style={styles.dayOptions}>
                {DAY_OPTIONS.map((day) => (
                  <Pressable
                    key={day.value}
                    style={[
                      styles.dayOption,
                      dayOfWeek === day.value && styles.dayOptionActive,
                    ]}
                    onPress={() => setDayOfWeek(day.value)}
                  >
                    <Text
                      style={[
                        styles.dayOptionText,
                        dayOfWeek === day.value && styles.dayOptionTextActive,
                      ]}
                    >
                      {day.short}
                    </Text>
                  </Pressable>
                ))}
              </View>
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
                        timeWindow === option.value && styles.timeWindowOptionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Start Date Calendar */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Start Date</Text>
              <View style={styles.calendar}>
                <View style={styles.calendarHeader}>
                  <Pressable style={styles.monthNavButton} onPress={goToPreviousMonth}>
                    <Feather name="chevron-left" size={20} color={colors.text.primary} />
                  </Pressable>
                  <Text style={styles.monthText}>{monthName}</Text>
                  <Pressable style={styles.monthNavButton} onPress={goToNextMonth}>
                    <Feather name="chevron-right" size={20} color={colors.text.primary} />
                  </Pressable>
                </View>

                <View style={styles.dayHeaders}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                    <Text key={i} style={styles.dayHeader}>{day}</Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {calendarData.map((item, index) => (
                    <Pressable
                      key={index}
                      style={[
                        styles.dayCell,
                        !item.day && styles.dayCellEmpty,
                        item.isPast && styles.dayCellPast,
                        startDate === item.date && styles.dayCellSelected,
                        item.dayOfWeek === dayOfWeek && !item.isPast && styles.dayCellHighlight,
                      ]}
                      onPress={() => !item.isPast && setStartDate(item.date)}
                      disabled={!item.day || item.isPast}
                    >
                      {item.day && (
                        <Text
                          style={[
                            styles.dayText,
                            item.isPast && styles.dayTextPast,
                            startDate === item.date && styles.dayTextSelected,
                          ]}
                        >
                          {item.day}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>

              {startDate && (
                <View style={styles.selectedDateBadge}>
                  <Feather name="calendar" size={14} color={colors.primary[600]} />
                  <Text style={styles.selectedDateText}>
                    Starting {formatDate(startDate)}
                  </Text>
                </View>
              )}
            </View>

            {/* End Date Toggle */}
            <View style={styles.section}>
              <Pressable
                style={styles.toggleRow}
                onPress={() => setHasEndDate(!hasEndDate)}
              >
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>Set End Date</Text>
                  <Text style={styles.toggleDesc}>Leave off for ongoing schedule</Text>
                </View>
                <View style={[styles.toggle, hasEndDate && styles.toggleActive]}>
                  {hasEndDate && <Feather name="check" size={14} color={colors.neutral[0]} />}
                </View>
              </Pressable>

              {hasEndDate && (
                <View style={styles.endDateInput}>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.neutral[400]}
                    value={endDate || ""}
                    onChangeText={setEndDate}
                  />
                </View>
              )}
            </View>

            {/* Price */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Price per Cleaning {defaultPrice && `(Default: $${defaultPrice})`}
              </Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.pricePrefix}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder={defaultPrice || "Enter price"}
                  placeholderTextColor={colors.neutral[400]}
                  value={customPrice}
                  onChangeText={setCustomPrice}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Preview */}
            {startDate && nextOccurrences.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Upcoming Cleanings</Text>
                <View style={styles.previewCard}>
                  {nextOccurrences.map((date, index) => (
                    <View key={index} style={styles.previewRow}>
                      <Feather name="check-circle" size={14} color={colors.success[500]} />
                      <Text style={styles.previewText}>
                        {date.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.previewNote}>
                    + more appointments will be auto-generated
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.cancelButtonPressed,
              ]}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitButtonPressed,
                (!startDate || isLoading) && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!startDate || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.neutral[0]} />
              ) : (
                <>
                  <Feather name="repeat" size={18} color={colors.neutral[0]} />
                  <Text style={styles.submitButtonText}>Create Schedule</Text>
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

  // Header
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

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },

  // Client Card
  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  clientInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[0],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  addressText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    flex: 1,
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

  // Frequency Options
  frequencyOptions: {
    gap: spacing.sm,
  },
  frequencyOption: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[50],
    borderWidth: 2,
    borderColor: colors.neutral[200],
  },
  frequencyOptionActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  frequencyLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  frequencyLabelActive: {
    color: colors.primary[700],
  },
  frequencyDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  frequencyDescActive: {
    color: colors.primary[600],
  },

  // Day Options
  dayOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayOption: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  dayOptionActive: {
    backgroundColor: colors.primary[600],
  },
  dayOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  dayOptionTextActive: {
    color: colors.neutral[0],
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
  dayCellHighlight: {
    backgroundColor: colors.primary[100],
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

  // Toggle
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  toggleDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  toggle: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: colors.primary[600],
  },
  endDateInput: {
    marginTop: spacing.md,
  },
  dateInput: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
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

  // Preview
  previewCard: {
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  previewText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  previewNote: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    marginTop: spacing.sm,
    fontStyle: "italic",
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
  submitButton: {
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
  submitButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default SetupRecurringModal;
