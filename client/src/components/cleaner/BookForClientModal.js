import React, { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import CleanerClientService from "../../services/fetchRequests/CleanerClientService";

const TIME_WINDOWS = [
  { value: "anytime", label: "Anytime" },
  { value: "10-3", label: "10am - 3pm" },
  { value: "11-4", label: "11am - 4pm" },
  { value: "12-2", label: "12pm - 2pm" },
];

const BookForClientModal = ({ visible, onClose, onSuccess, client, token }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [customPrice, setCustomPrice] = useState("");
  const [timeWindow, setTimeWindow] = useState("anytime");
  const [notes, setNotes] = useState("");
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

  // Generate calendar days for the current month
  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push({ day: null, date: null });
    }

    // Add days of the month
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isPast = date < today;
      const dateString = date.toISOString().split("T")[0];
      days.push({ day, date: dateString, isPast });
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
      Alert.alert("Error", "Please select a date for the appointment");
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

      if (notes && notes.trim()) {
        bookingData.notes = notes.trim();
      }

      const result = await CleanerClientService.bookForClient(
        token,
        client.id,
        bookingData
      );

      if (result.success) {
        Alert.alert(
          "Appointment Booked!",
          `Cleaning scheduled for ${formatSelectedDate(selectedDate)}. ${clientName} will be notified.`,
          [{ text: "OK", onPress: () => onSuccess() }]
        );
        resetForm();
      } else {
        Alert.alert("Error", result.error || "Failed to book appointment");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to book appointment. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedDate(null);
    setCustomPrice("");
    setTimeWindow("anytime");
    setNotes("");
    setCurrentMonth(new Date());
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!client) return null;

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
            <Text style={styles.modalTitle}>Book Cleaning</Text>
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
                  <Feather name="user" size={20} color={colors.primary[600]} />
                </View>
                <View style={styles.clientDetails}>
                  <Text style={styles.clientName}>{clientName}</Text>
                  <View style={styles.addressRow}>
                    <Feather name="home" size={12} color={colors.neutral[400]} />
                    <Text style={styles.addressText}>{homeAddress}</Text>
                  </View>
                </View>
              </View>
              {defaultPrice && (
                <View style={styles.priceTag}>
                  <Text style={styles.priceTagText}>${defaultPrice}</Text>
                </View>
              )}
            </View>

            {/* Calendar */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Date</Text>
              <View style={styles.calendar}>
                {/* Month Navigation */}
                <View style={styles.calendarHeader}>
                  <Pressable
                    style={styles.monthNavButton}
                    onPress={goToPreviousMonth}
                  >
                    <Feather name="chevron-left" size={20} color={colors.text.primary} />
                  </Pressable>
                  <Text style={styles.monthText}>{monthName}</Text>
                  <Pressable
                    style={styles.monthNavButton}
                    onPress={goToNextMonth}
                  >
                    <Feather name="chevron-right" size={20} color={colors.text.primary} />
                  </Pressable>
                </View>

                {/* Day Headers */}
                <View style={styles.dayHeaders}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <Text key={day} style={styles.dayHeader}>
                      {day}
                    </Text>
                  ))}
                </View>

                {/* Calendar Grid */}
                <View style={styles.calendarGrid}>
                  {calendarData.map((item, index) => (
                    <Pressable
                      key={index}
                      style={[
                        styles.dayCell,
                        !item.day && styles.dayCellEmpty,
                        item.isPast && styles.dayCellPast,
                        selectedDate === item.date && styles.dayCellSelected,
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

            {/* Custom Price */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Price {defaultPrice && `(Default: $${defaultPrice})`}
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
              <Text style={styles.priceHint}>
                Leave blank to use {defaultPrice ? "default price" : "calculated price"}
              </Text>
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Any special instructions for this cleaning..."
                placeholderTextColor={colors.neutral[400]}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
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
                styles.bookButton,
                pressed && styles.bookButtonPressed,
                (!selectedDate || isLoading) && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedDate || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.neutral[0]} />
              ) : (
                <>
                  <Feather name="check" size={18} color={colors.neutral[0]} />
                  <Text style={styles.bookButtonText}>Book Cleaning</Text>
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
    justifyContent: "space-between",
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
  priceTag: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
  },
  priceTagText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
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
  priceHint: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
    marginTop: spacing.xs,
  },

  // Notes
  notesInput: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 80,
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
  bookButton: {
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
  bookButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  bookButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default BookForClientModal;
