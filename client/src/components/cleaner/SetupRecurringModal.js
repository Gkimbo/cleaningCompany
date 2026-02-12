import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  { value: "weekly", label: "Weekly", icon: "repeat" },
  { value: "biweekly", label: "Bi-weekly", icon: "refresh-cw" },
  { value: "monthly", label: "Monthly", icon: "calendar" },
];

const DAY_OPTIONS = [
  { value: 0, label: "S" },
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIME_WINDOWS = [
  { value: "anytime", label: "Anytime", icon: "clock" },
  { value: "10-3", label: "10am-3pm", icon: "sun" },
  { value: "11-4", label: "11am-4pm", icon: "sun" },
  { value: "12-2", label: "12pm-2pm", icon: "sun" },
];

const SetupRecurringModal = ({ visible, onClose, onSuccess, client, token }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [frequency, setFrequency] = useState("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [timeWindow, setTimeWindow] = useState("anytime");
  const [customPrice, setCustomPrice] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Existing schedules state
  const [existingSchedules, setExistingSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // scheduleId being actioned

  // Today's date string for comparison (use local date, not UTC)
  const todayDate = new Date();
  const todayString = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

  // Get client display info
  const clientName = client?.client
    ? `${client.client.firstName} ${client.client.lastName}`
    : client?.invitedName || "Client";

  const defaultPrice = client?.defaultPrice
    ? parseFloat(client.defaultPrice).toFixed(0)
    : null;

  // Fetch existing schedules when modal opens
  const fetchExistingSchedules = useCallback(async () => {
    if (!client?.id || !token) return;

    setLoadingSchedules(true);
    try {
      const result = await CleanerClientService.getRecurringSchedules(token, client.id);
      if (result.schedules) {
        setExistingSchedules(result.schedules.filter(s => s.isActive));
      }
    } catch (error) {
      console.error("Error fetching schedules:", error);
    } finally {
      setLoadingSchedules(false);
    }
  }, [client?.id, token]);

  useEffect(() => {
    if (visible && client?.id) {
      fetchExistingSchedules();
    }
  }, [visible, client?.id, fetchExistingSchedules]);

  // Handle cancel schedule
  const handleCancelSchedule = async (scheduleId, cancelAppointments = false) => {
    Alert.alert(
      "Cancel Recurring Schedule",
      cancelAppointments
        ? "This will deactivate the schedule AND cancel all future appointments. Continue?"
        : "This will deactivate the schedule but keep existing appointments. Continue?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setActionLoading(scheduleId);
            try {
              const result = await CleanerClientService.deleteRecurringSchedule(
                token,
                scheduleId,
                cancelAppointments
              );
              if (result.success) {
                Alert.alert("Success", "Schedule cancelled");
                fetchExistingSchedules();
              } else {
                Alert.alert("Error", result.error || "Failed to cancel schedule");
              }
            } catch (error) {
              Alert.alert("Error", "Failed to cancel schedule");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  // Handle pause/resume
  const handleTogglePause = async (schedule) => {
    setActionLoading(schedule.id);
    try {
      if (schedule.isPaused) {
        const result = await CleanerClientService.resumeRecurringSchedule(token, schedule.id);
        if (result.success) {
          Alert.alert("Resumed", `Schedule resumed. ${result.appointmentsCreated || 0} new appointments created.`);
          fetchExistingSchedules();
        } else {
          Alert.alert("Error", result.error || "Failed to resume schedule");
        }
      } else {
        const result = await CleanerClientService.pauseRecurringSchedule(token, schedule.id);
        if (result.success) {
          Alert.alert("Paused", "Schedule paused. No new appointments will be generated.");
          fetchExistingSchedules();
        } else {
          Alert.alert("Error", result.error || "Failed to pause schedule");
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update schedule");
    } finally {
      setActionLoading(null);
    }
  };

  // Calculate which dates would be scheduled based on frequency
  // Shows pattern from startDate if selected, otherwise from today
  const scheduledDates = useMemo(() => {
    const dates = new Set();

    // Use startDate if selected, otherwise use today
    const baseDate = startDate
      ? new Date(startDate + "T12:00:00")
      : new Date();
    baseDate.setHours(12, 0, 0, 0);

    // Find first occurrence of dayOfWeek on or after base date
    let currentDate = new Date(baseDate);
    while (currentDate.getDay() !== dayOfWeek) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Generate dates for the next 6 months
    const horizon = new Date(baseDate);
    horizon.setMonth(horizon.getMonth() + 6);

    while (currentDate <= horizon) {
      if (hasEndDate && endDate && currentDate > new Date(endDate + "T12:00:00")) {
        break;
      }

      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      dates.add(`${year}-${month}-${day}`);

      // Move to next occurrence based on frequency
      if (frequency === "weekly") {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (frequency === "biweekly") {
        currentDate.setDate(currentDate.getDate() + 14);
      } else {
        // Monthly - same day of week next month
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1);
        while (currentDate.getDay() !== dayOfWeek) {
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    }

    return dates;
  }, [startDate, dayOfWeek, frequency, hasEndDate, endDate]);

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
      // Use local date format instead of UTC
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayNum = date.getDay();
      const isScheduled = scheduledDates.has(dateString);
      days.push({ day, date: dateString, isPast, dayOfWeek: dayNum, isScheduled });
    }

    return days;
  }, [currentMonth, scheduledDates]);

  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "short",
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
      month: "short",
      day: "numeric",
    });
  };

  const getNextOccurrences = () => {
    if (!startDate) return [];
    const occurrences = [];
    let currentDate = new Date(startDate + "T12:00:00");

    while (currentDate.getDay() !== dayOfWeek) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    for (let i = 0; i < 3; i++) {
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

      const result = await CleanerClientService.createRecurringSchedule(token, scheduleData);

      if (result.success) {
        Alert.alert(
          "Schedule Created!",
          `${result.appointmentsCreated} appointments scheduled for ${clientName}.`,
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
  const frequencyLabel = FREQUENCY_OPTIONS.find(f => f.value === frequency)?.label;
  const timeLabel = TIME_WINDOWS.find(t => t.value === timeWindow)?.label;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Feather name="repeat" size={20} color={colors.primary[600]} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Recurring Schedule</Text>
                <Text style={styles.headerSubtitle}>{clientName}</Text>
              </View>
            </View>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Feather name="x" size={22} color={colors.neutral[400]} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Existing Schedules Section */}
            {(existingSchedules.length > 0 || loadingSchedules) && (
              <View style={styles.existingSection}>
                <View style={styles.existingHeader}>
                  <Feather name="calendar" size={16} color={colors.primary[600]} />
                  <Text style={styles.existingTitle}>Active Schedules</Text>
                </View>

                {loadingSchedules ? (
                  <ActivityIndicator size="small" color={colors.primary[600]} />
                ) : (
                  existingSchedules.map((schedule) => (
                    <View key={schedule.id} style={styles.existingCard}>
                      <View style={styles.existingCardMain}>
                        <View style={styles.existingCardInfo}>
                          <View style={styles.scheduleRow}>
                            <Text style={styles.scheduleFreq}>
                              {schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)}
                            </Text>
                            <View style={[
                              styles.statusBadge,
                              schedule.isPaused && styles.statusBadgePaused
                            ]}>
                              <Text style={[
                                styles.statusBadgeText,
                                schedule.isPaused && styles.statusBadgeTextPaused
                              ]}>
                                {schedule.isPaused ? "Paused" : "Active"}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.scheduleDay}>
                            {DAY_NAMES[schedule.dayOfWeek]}s • {schedule.timeWindow === "anytime" ? "Anytime" : schedule.timeWindow}
                          </Text>
                          {schedule.nextScheduledDate && !schedule.isPaused && (
                            <Text style={styles.scheduleNext}>
                              Next: {new Date(schedule.nextScheduledDate + "T12:00:00").toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </Text>
                          )}
                        </View>

                        <View style={styles.existingCardActions}>
                          {actionLoading === schedule.id ? (
                            <ActivityIndicator size="small" color={colors.primary[600]} />
                          ) : (
                            <>
                              <Pressable
                                style={styles.actionBtn}
                                onPress={() => handleTogglePause(schedule)}
                              >
                                <Feather
                                  name={schedule.isPaused ? "play" : "pause"}
                                  size={16}
                                  color={schedule.isPaused ? colors.success[600] : colors.warning[600]}
                                />
                              </Pressable>
                              <Pressable
                                style={styles.actionBtn}
                                onPress={() => {
                                  Alert.alert(
                                    "Cancel Schedule",
                                    "What would you like to do?",
                                    [
                                      { text: "Never mind", style: "cancel" },
                                      {
                                        text: "Keep Appointments",
                                        onPress: () => handleCancelSchedule(schedule.id, false),
                                      },
                                      {
                                        text: "Cancel All",
                                        style: "destructive",
                                        onPress: () => handleCancelSchedule(schedule.id, true),
                                      },
                                    ]
                                  );
                                }}
                              >
                                <Feather name="trash-2" size={16} color={colors.error[600]} />
                              </Pressable>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Divider if existing schedules */}
            {existingSchedules.length > 0 && (
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Add New Schedule</Text>
                <View style={styles.dividerLine} />
              </View>
            )}

            {/* Frequency Selection - Horizontal Pills */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Frequency</Text>
              <View style={styles.frequencyRow}>
                {FREQUENCY_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.frequencyPill,
                      frequency === option.value && styles.frequencyPillActive,
                    ]}
                    onPress={() => setFrequency(option.value)}
                  >
                    <Feather
                      name={option.icon}
                      size={14}
                      color={frequency === option.value ? colors.neutral[0] : colors.neutral[500]}
                    />
                    <Text
                      style={[
                        styles.frequencyPillText,
                        frequency === option.value && styles.frequencyPillTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Day Selection - Compact Row */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Day of Week</Text>
              <View style={styles.dayRow}>
                {DAY_OPTIONS.map((day) => (
                  <Pressable
                    key={day.value}
                    style={[
                      styles.dayCircle,
                      dayOfWeek === day.value && styles.dayCircleActive,
                    ]}
                    onPress={() => setDayOfWeek(day.value)}
                  >
                    <Text
                      style={[
                        styles.dayCircleText,
                        dayOfWeek === day.value && styles.dayCircleTextActive,
                      ]}
                    >
                      {day.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Time Window - Inline */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Preferred Time</Text>
              <View style={styles.timeRow}>
                {TIME_WINDOWS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.timeChip,
                      timeWindow === option.value && styles.timeChipActive,
                    ]}
                    onPress={() => setTimeWindow(option.value)}
                  >
                    <Text
                      style={[
                        styles.timeChipText,
                        timeWindow === option.value && styles.timeChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Start Date - Calendar */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Start Date</Text>
              <View style={styles.calendarCard}>
                {/* Month Navigation */}
                <View style={styles.calendarNav}>
                  <Pressable onPress={goToPreviousMonth} style={styles.navButton}>
                    <View style={styles.navButtonInner}>
                      <Feather name="chevron-left" size={20} color={colors.primary[600]} />
                    </View>
                  </Pressable>
                  <Text style={styles.monthLabel}>{monthName}</Text>
                  <Pressable onPress={goToNextMonth} style={styles.navButton}>
                    <View style={styles.navButtonInner}>
                      <Feather name="chevron-right" size={20} color={colors.primary[600]} />
                    </View>
                  </Pressable>
                </View>

                {/* Day Headers */}
                <View style={styles.dayLabelsRow}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                    <View key={i} style={styles.dayLabelCell}>
                      <Text style={[
                        styles.dayLabelText,
                        i === dayOfWeek && styles.dayLabelTextActive
                      ]}>{d}</Text>
                    </View>
                  ))}
                </View>

                {/* Calendar Grid */}
                <View style={styles.calendarGrid}>
                  {calendarData.map((item, index) => {
                    // Skip styling for empty cells (padding days)
                    if (!item.day) {
                      return (
                        <View key={index} style={styles.calendarDayWrapper}>
                          <View style={styles.calendarDay} />
                        </View>
                      );
                    }

                    const isSelected = startDate === item.date;
                    const isScheduled = item.isScheduled && !item.isPast;
                    const isToday = item.date === todayString;

                    return (
                      <View key={index} style={styles.calendarDayWrapper}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.calendarDay,
                            item.isPast && styles.calendarDayPast,
                            isScheduled && !isSelected && styles.calendarDayHighlight,
                            isSelected && styles.calendarDaySelected,
                            isToday && !isSelected && !isScheduled && styles.calendarDayToday,
                            pressed && !item.isPast && styles.calendarDayPressed,
                          ]}
                          onPress={() => !item.isPast && setStartDate(isSelected ? null : item.date)}
                          disabled={item.isPast}
                        >
                          <Text
                            style={[
                              styles.calendarDayText,
                              item.isPast && styles.calendarDayTextPast,
                              isScheduled && !isSelected && styles.calendarDayTextHighlight,
                              isSelected && styles.calendarDayTextSelected,
                              isToday && !isSelected && !isScheduled && styles.calendarDayTextToday,
                            ]}
                          >
                            {item.day}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>

                {/* Selected Date Display */}
                {startDate && (
                  <View style={styles.selectedDateRow}>
                    <Feather name="check-circle" size={16} color={colors.primary[600]} />
                    <Text style={styles.selectedDateText}>
                      Starting {new Date(startDate + "T12:00:00").toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Price - Compact Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Price per Cleaning
                {defaultPrice && <Text style={styles.defaultPriceHint}> (Default: ${defaultPrice})</Text>}
              </Text>
              <View style={styles.priceRow}>
                <View style={styles.priceInputWrapper}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder={defaultPrice || "0"}
                    placeholderTextColor={colors.neutral[400]}
                    value={customPrice}
                    onChangeText={setCustomPrice}
                    keyboardType="decimal-pad"
                  />
                </View>
                {defaultPrice && !customPrice && (
                  <View style={styles.usingDefaultBadge}>
                    <Text style={styles.usingDefaultText}>Using default</Text>
                  </View>
                )}
              </View>
            </View>

            {/* End Date Toggle */}
            <View style={styles.section}>
              <Pressable
                style={styles.endDateToggle}
                onPress={() => {
                  setHasEndDate(!hasEndDate);
                  if (!hasEndDate) setShowEndDatePicker(true);
                }}
              >
                <View style={styles.endDateToggleLeft}>
                  <Feather
                    name={hasEndDate ? "calendar" : "repeat"}
                    size={16}
                    color={hasEndDate ? colors.primary[600] : colors.neutral[500]}
                  />
                  <Text style={styles.endDateToggleText}>
                    {hasEndDate ? `Ends ${endDate ? formatDate(endDate) : "..."}` : "No end date (ongoing)"}
                  </Text>
                </View>
                <View style={[styles.toggleSwitch, hasEndDate && styles.toggleSwitchActive]}>
                  <View style={[styles.toggleKnob, hasEndDate && styles.toggleKnobActive]} />
                </View>
              </Pressable>

              {hasEndDate && (
                <View style={styles.endDatePicker}>
                  <TextInput
                    style={styles.endDateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.neutral[400]}
                    value={endDate || ""}
                    onChangeText={setEndDate}
                  />
                </View>
              )}
            </View>

            {/* Preview Summary */}
            {startDate && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Feather name="check-circle" size={16} color={colors.success[600]} />
                  <Text style={styles.summaryTitle}>Schedule Preview</Text>
                </View>
                <Text style={styles.summaryText}>
                  {frequencyLabel} on {DAY_NAMES[dayOfWeek]}s, {timeLabel.toLowerCase()}
                </Text>
                <View style={styles.upcomingDates}>
                  {nextOccurrences.map((date, i) => (
                    <View key={i} style={styles.upcomingDate}>
                      <Text style={styles.upcomingDateText}>
                        {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.upcomingMore}>
                    <Text style={styles.upcomingMoreText}>+more</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={{ height: spacing.lg }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.submitBtn, (!startDate || isLoading) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!startDate || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.neutral[0]} size="small" />
              ) : (
                <>
                  <Feather name="check" size={18} color={colors.neutral[0]} />
                  <Text style={styles.submitBtnText}>Create Schedule</Text>
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
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    height: "75%",
    maxHeight: "90%",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: "700",
    color: colors.neutral[900],
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
  },
  closeButton: {
    padding: spacing.sm,
  },

  // Scroll
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  // Section
  section: {
    marginTop: spacing.lg,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
    color: colors.neutral[700],
    marginBottom: spacing.sm,
  },
  defaultPriceHint: {
    fontWeight: "400",
    color: colors.neutral[400],
  },

  // Frequency Pills
  frequencyRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  frequencyPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
  },
  frequencyPillActive: {
    backgroundColor: colors.primary[600],
  },
  frequencyPillText: {
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
    color: colors.neutral[600],
  },
  frequencyPillTextActive: {
    color: colors.neutral[0],
  },

  // Day Circles
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleActive: {
    backgroundColor: colors.primary[600],
  },
  dayCircleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
    color: colors.neutral[600],
  },
  dayCircleTextActive: {
    color: colors.neutral[0],
  },

  // Time Chips
  timeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  timeChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
  },
  timeChipActive: {
    backgroundColor: colors.primary[600],
  },
  timeChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: "500",
    color: colors.neutral[600],
  },
  timeChipTextActive: {
    color: colors.neutral[0],
  },

  // Calendar
  calendarCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  calendarNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  navButton: {
    padding: spacing.xs,
  },
  navButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: "700",
    color: colors.neutral[800],
    letterSpacing: 0.5,
  },
  dayLabelsRow: {
    flexDirection: "row",
    marginBottom: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  dayLabelCell: {
    width: "14.28%",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  dayLabelText: {
    fontSize: typography.fontSize.xs,
    fontWeight: "600",
    color: colors.neutral[400],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dayLabelTextActive: {
    color: colors.primary[600],
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: spacing.xs,
  },
  calendarDayWrapper: {
    width: "14.28%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  calendarDay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayPast: {
    opacity: 0.3,
  },
  calendarDayHighlight: {
    backgroundColor: colors.primary[100],
    borderWidth: 2,
    borderColor: colors.primary[200],
  },
  calendarDaySelected: {
    backgroundColor: colors.primary[600],
    ...shadows.sm,
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: colors.primary[400],
  },
  calendarDayPressed: {
    backgroundColor: colors.primary[50],
    transform: [{ scale: 0.95 }],
  },
  calendarDayText: {
    fontSize: typography.fontSize.sm,
    fontWeight: "500",
    color: colors.neutral[800],
  },
  calendarDayTextPast: {
    color: colors.neutral[400],
  },
  calendarDayTextHighlight: {
    color: colors.primary[700],
    fontWeight: "700",
  },
  calendarDayTextSelected: {
    color: colors.neutral[0],
    fontWeight: "700",
  },
  calendarDayTextToday: {
    color: colors.primary[600],
    fontWeight: "700",
  },
  selectedDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  selectedDateText: {
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
    color: colors.primary[700],
  },

  // Price
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  priceInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    flex: 1,
    maxWidth: 140,
  },
  dollarSign: {
    fontSize: typography.fontSize.lg,
    fontWeight: "600",
    color: colors.neutral[600],
  },
  priceInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.xs,
    fontSize: typography.fontSize.lg,
    fontWeight: "600",
    color: colors.neutral[900],
  },
  usingDefaultBadge: {
    backgroundColor: colors.success[50],
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  usingDefaultText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
    fontWeight: "500",
  },

  // End Date
  endDateToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  endDateToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  endDateToggleText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.neutral[300],
    padding: 2,
    justifyContent: "center",
  },
  toggleSwitchActive: {
    backgroundColor: colors.primary[600],
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.neutral[0],
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
  endDatePicker: {
    marginTop: spacing.sm,
  },
  endDateInput: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.neutral[900],
  },

  // Summary
  summaryCard: {
    backgroundColor: colors.success[50],
    borderRadius: radius.xl,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  summaryTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
    color: colors.success[700],
  },
  summaryText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[800],
    marginBottom: spacing.sm,
  },
  upcomingDates: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  upcomingDate: {
    backgroundColor: colors.success[100],
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  upcomingDateText: {
    fontSize: typography.fontSize.xs,
    fontWeight: "500",
    color: colors.success[700],
  },
  upcomingMore: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  upcomingMoreText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    fontStyle: "italic",
  },

  // Footer
  footer: {
    flexDirection: "row",
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cancelBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.neutral[600],
  },
  submitBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
    ...shadows.md,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.neutral[0],
  },

  // Existing Schedules
  existingSection: {
    marginTop: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  existingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  existingTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: "700",
    color: colors.neutral[700],
  },
  existingCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  existingCardMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  existingCardInfo: {
    flex: 1,
    gap: 2,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  scheduleFreq: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.neutral[900],
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.success[100],
  },
  statusBadgePaused: {
    backgroundColor: colors.warning[100],
  },
  statusBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: "600",
    color: colors.success[700],
  },
  statusBadgeTextPaused: {
    color: colors.warning[700],
  },
  scheduleDay: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
  },
  scheduleNext: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: "500",
    marginTop: 2,
  },
  existingCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.lg,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.neutral[200],
  },
  dividerText: {
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
    color: colors.neutral[400],
  },
});

export default SetupRecurringModal;
