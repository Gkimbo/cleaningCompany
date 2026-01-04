import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  Modal,
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import BusinessOwnerService from "../../services/fetchRequests/BusinessOwnerService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Days of the week
const DAYS = [
  { key: "monday", label: "Mon", full: "Monday" },
  { key: "tuesday", label: "Tue", full: "Tuesday" },
  { key: "wednesday", label: "Wed", full: "Wednesday" },
  { key: "thursday", label: "Thu", full: "Thursday" },
  { key: "friday", label: "Fri", full: "Friday" },
  { key: "saturday", label: "Sat", full: "Saturday" },
  { key: "sunday", label: "Sun", full: "Sunday" },
];

// Job types
const JOB_TYPES = [
  { key: "standard", label: "Standard", icon: "home" },
  { key: "deep", label: "Deep Clean", icon: "refresh" },
  { key: "move_in", label: "Move-In", icon: "truck" },
  { key: "move_out", label: "Move-Out", icon: "sign-out" },
];

// Time options for picker
const TIME_OPTIONS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00",
];

// Format time for display (24h to 12h)
const formatTime = (time) => {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const suffix = h >= 12 ? "PM" : "AM";
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayHour}:${minutes} ${suffix}`;
};

// Day Selector Component
const DaySelector = ({ day, schedule, onToggle, onEditTimes }) => {
  const isAvailable = schedule[day.key]?.available ?? true;
  const hasTimeRestriction = schedule[day.key]?.start && schedule[day.key]?.end;

  return (
    <View style={styles.dayRow}>
      <Pressable
        style={[styles.dayToggle, isAvailable && styles.dayToggleActive]}
        onPress={() => onToggle(day.key)}
      >
        <Text style={[styles.dayLabel, isAvailable && styles.dayLabelActive]}>
          {day.label}
        </Text>
      </Pressable>
      {isAvailable && (
        <Pressable style={styles.timeButton} onPress={() => onEditTimes(day.key)}>
          {hasTimeRestriction ? (
            <Text style={styles.timeText}>
              {formatTime(schedule[day.key].start)} - {formatTime(schedule[day.key].end)}
            </Text>
          ) : (
            <Text style={styles.timeTextAll}>All Day</Text>
          )}
          <Icon name="clock-o" size={14} color={colors.primary[500]} />
        </Pressable>
      )}
      {!isAvailable && (
        <Text style={styles.unavailableText}>Not Available</Text>
      )}
    </View>
  );
};

// Job Type Chip Component
const JobTypeChip = ({ jobType, selected, onToggle }) => (
  <Pressable
    style={[styles.jobTypeChip, selected && styles.jobTypeChipSelected]}
    onPress={() => onToggle(jobType.key)}
  >
    <Icon
      name={jobType.icon}
      size={14}
      color={selected ? colors.primary[600] : colors.neutral[500]}
    />
    <Text style={[styles.jobTypeLabel, selected && styles.jobTypeLabelSelected]}>
      {jobType.label}
    </Text>
    {selected && <Icon name="check" size={12} color={colors.primary[600]} />}
  </Pressable>
);

// Time Picker Modal Component
const TimePickerModal = ({ visible, day, currentStart, currentEnd, onSave, onClose }) => {
  const [startTime, setStartTime] = useState(currentStart || "09:00");
  const [endTime, setEndTime] = useState(currentEnd || "17:00");

  useEffect(() => {
    setStartTime(currentStart || "09:00");
    setEndTime(currentEnd || "17:00");
  }, [currentStart, currentEnd, visible]);

  const dayInfo = DAYS.find((d) => d.key === day);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{dayInfo?.full} Hours</Text>
            <Pressable style={styles.modalClose} onPress={onClose}>
              <Icon name="times" size={18} color={colors.text.secondary} />
            </Pressable>
          </View>

          <Text style={styles.modalSubtitle}>
            Set the hours this employee is available to work
          </Text>

          <View style={styles.timePickerContainer}>
            <View style={styles.timePickerColumn}>
              <Text style={styles.timePickerLabel}>Start Time</Text>
              <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                {TIME_OPTIONS.map((time) => (
                  <Pressable
                    key={time}
                    style={[
                      styles.timeOption,
                      time === startTime && styles.timeOptionSelected,
                    ]}
                    onPress={() => setStartTime(time)}
                  >
                    <Text
                      style={[
                        styles.timeOptionText,
                        time === startTime && styles.timeOptionTextSelected,
                      ]}
                    >
                      {formatTime(time)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.timePickerDivider}>
              <Icon name="arrow-right" size={16} color={colors.neutral[400]} />
            </View>

            <View style={styles.timePickerColumn}>
              <Text style={styles.timePickerLabel}>End Time</Text>
              <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                {TIME_OPTIONS.map((time) => (
                  <Pressable
                    key={time}
                    style={[
                      styles.timeOption,
                      time === endTime && styles.timeOptionSelected,
                    ]}
                    onPress={() => setEndTime(time)}
                  >
                    <Text
                      style={[
                        styles.timeOptionText,
                        time === endTime && styles.timeOptionTextSelected,
                      ]}
                    >
                      {formatTime(time)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.modalActions}>
            <Pressable
              style={styles.modalClearButton}
              onPress={() => onSave(null, null)}
            >
              <Text style={styles.modalClearText}>Clear Restriction</Text>
            </Pressable>
            <Pressable
              style={styles.modalSaveButton}
              onPress={() => onSave(startTime, endTime)}
            >
              <Text style={styles.modalSaveText}>Save Hours</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Permission Row Component
const PermissionRow = ({ label, description, value, onChange }) => (
  <View style={styles.permissionRow}>
    <View style={styles.permissionInfo}>
      <Text style={styles.permissionLabel}>{label}</Text>
      <Text style={styles.permissionDescription}>{description}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.neutral[300], true: colors.primary[400] }}
      thumbColor={value ? colors.primary[600] : colors.neutral[100]}
    />
  </View>
);

// Payment Method Option
const PaymentMethodOption = ({ icon, label, value, selected, onSelect }) => (
  <Pressable
    style={[styles.paymentOption, selected && styles.paymentOptionSelected]}
    onPress={() => onSelect(value)}
  >
    <Icon
      name={icon}
      size={20}
      color={selected ? colors.primary[600] : colors.neutral[500]}
    />
    <Text style={[styles.paymentOptionText, selected && styles.paymentOptionTextSelected]}>
      {label}
    </Text>
    {selected && <Icon name="check" size={16} color={colors.primary[600]} />}
  </Pressable>
);

// Main Component
const EmployeeEditForm = ({ state }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Time picker modal state
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [editingDay, setEditingDay] = useState(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    defaultHourlyRate: "",
    paymentMethod: "direct_payment",
    canViewClientDetails: true,
    canViewJobEarnings: false,
    canMessageClients: true,
    notes: "",
  });

  // Availability state
  const [availableSchedule, setAvailableSchedule] = useState({});
  const [selectedJobTypes, setSelectedJobTypes] = useState([]);
  const [maxJobsPerDay, setMaxJobsPerDay] = useState("");

  useEffect(() => {
    fetchEmployee();
  }, [id]);

  const fetchEmployee = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await BusinessOwnerService.getEmployee(state.currentUser.token, id);
      if (result.employee) {
        const emp = result.employee;
        setFormData({
          firstName: emp.firstName || "",
          lastName: emp.lastName || "",
          email: emp.email || "",
          phone: emp.phone || "",
          defaultHourlyRate: emp.defaultHourlyRate
            ? (emp.defaultHourlyRate / 100).toFixed(2)
            : "",
          paymentMethod: emp.paymentMethod || "direct_payment",
          canViewClientDetails: emp.canViewClientDetails ?? true,
          canViewJobEarnings: emp.canViewJobEarnings ?? false,
          canMessageClients: emp.canMessageClients ?? true,
          notes: emp.notes || "",
        });

        // Load availability settings
        setAvailableSchedule(emp.availableSchedule || {});
        setSelectedJobTypes(emp.defaultJobTypes || []);
        setMaxJobsPerDay(emp.maxJobsPerDay ? String(emp.maxJobsPerDay) : "");
      }
    } catch (err) {
      console.error("Error fetching employee:", err);
      setError("Failed to load employee details");
    } finally {
      setLoading(false);
    }
  };

  // Toggle day availability
  const toggleDayAvailability = (dayKey) => {
    setAvailableSchedule((prev) => {
      const current = prev[dayKey] || { available: true };
      return {
        ...prev,
        [dayKey]: { ...current, available: !current.available },
      };
    });
  };

  // Open time picker for a day
  const openTimePicker = (dayKey) => {
    setEditingDay(dayKey);
    setTimePickerVisible(true);
  };

  // Save time restrictions for a day
  const saveTimeRestriction = (start, end) => {
    setAvailableSchedule((prev) => ({
      ...prev,
      [editingDay]: {
        ...prev[editingDay],
        available: prev[editingDay]?.available ?? true,
        start,
        end,
      },
    }));
    setTimePickerVisible(false);
    setEditingDay(null);
  };

  // Toggle job type selection
  const toggleJobType = (jobTypeKey) => {
    setSelectedJobTypes((prev) => {
      if (prev.includes(jobTypeKey)) {
        return prev.filter((k) => k !== jobTypeKey);
      }
      return [...prev, jobTypeKey];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Update basic info
      const updates = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        defaultHourlyRate: formData.defaultHourlyRate
          ? Math.round(parseFloat(formData.defaultHourlyRate) * 100)
          : null,
        paymentMethod: formData.paymentMethod,
        canViewClientDetails: formData.canViewClientDetails,
        canViewJobEarnings: formData.canViewJobEarnings,
        canMessageClients: formData.canMessageClients,
        notes: formData.notes,
      };

      const result = await BusinessOwnerService.updateEmployee(
        state.currentUser.token,
        id,
        updates
      );

      if (!result.success) {
        setError(result.error || "Failed to update employee");
        setSaving(false);
        return;
      }

      // Update availability settings
      const availResult = await BusinessOwnerService.updateAvailability(
        state.currentUser.token,
        id,
        {
          schedule: Object.keys(availableSchedule).length > 0 ? availableSchedule : null,
          defaultJobTypes: selectedJobTypes.length > 0 ? selectedJobTypes : null,
          maxJobsPerDay: maxJobsPerDay ? parseInt(maxJobsPerDay) : null,
        }
      );

      if (availResult.success) {
        setSuccess("Employee updated successfully!");
        setTimeout(() => navigate("/business-owner/employees"), 1500);
      } else {
        setError(availResult.error || "Failed to update availability");
      }
    } catch (err) {
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const updateFormField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading employee...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Edit Employee</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Messages */}
        {error && (
          <View style={styles.errorMessage}>
            <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
            <Text style={styles.errorMessageText}>{error}</Text>
          </View>
        )}
        {success && (
          <View style={styles.successMessage}>
            <Icon name="check-circle" size={16} color={colors.success[600]} />
            <Text style={styles.successMessageText}>{success}</Text>
          </View>
        )}

        {/* Basic Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <View style={styles.card}>
            <View style={styles.formRow}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={formData.firstName}
                  onChangeText={(text) => updateFormField("firstName", text)}
                  placeholder="First name"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={formData.lastName}
                  onChangeText={(text) => updateFormField("lastName", text)}
                  placeholder="Last name"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={formData.email}
                editable={false}
                placeholder="Email address"
              />
              <Text style={styles.helperText}>Email cannot be changed</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => updateFormField("phone", text)}
                placeholder="(555) 123-4567"
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        {/* Pay Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pay Settings</Text>
          <View style={styles.card}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Default Hourly Rate</Text>
              <View style={styles.currencyInput}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.currencyInputField}
                  value={formData.defaultHourlyRate}
                  onChangeText={(text) => updateFormField("defaultHourlyRate", text)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.currencySuffix}>/hr</Text>
              </View>
              <Text style={styles.helperText}>
                You can override this per job when assigning
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Payment Method</Text>
              <View style={styles.paymentOptions}>
                <PaymentMethodOption
                  icon="money"
                  label="Direct Payment"
                  value="direct_payment"
                  selected={formData.paymentMethod === "direct_payment"}
                  onSelect={(v) => updateFormField("paymentMethod", v)}
                />
                <PaymentMethodOption
                  icon="credit-card"
                  label="Stripe Connect"
                  value="stripe_connect"
                  selected={formData.paymentMethod === "stripe_connect"}
                  onSelect={(v) => updateFormField("paymentMethod", v)}
                />
              </View>
              <Text style={styles.helperText}>
                {formData.paymentMethod === "direct_payment"
                  ? "You pay the employee directly (cash, check, Venmo, etc.)"
                  : "Employee receives payment through Stripe automatically"}
              </Text>
            </View>
          </View>
        </View>

        {/* Permissions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permissions</Text>
          <View style={styles.card}>
            <PermissionRow
              label="View Client Details"
              description="Can see client name, address, and contact info"
              value={formData.canViewClientDetails}
              onChange={(v) => updateFormField("canViewClientDetails", v)}
            />
            <View style={styles.permissionDivider} />
            <PermissionRow
              label="View Job Earnings"
              description="Can see how much they earned per job"
              value={formData.canViewJobEarnings}
              onChange={(v) => updateFormField("canViewJobEarnings", v)}
            />
            <View style={styles.permissionDivider} />
            <PermissionRow
              label="Message Clients"
              description="Can send messages to clients through the app"
              value={formData.canMessageClients}
              onChange={(v) => updateFormField("canMessageClients", v)}
            />
          </View>
        </View>

        {/* Availability Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability Schedule</Text>
          <View style={styles.card}>
            <Text style={styles.cardDescription}>
              Tap a day to toggle availability. Tap the time to set specific hours.
            </Text>
            <View style={styles.daysContainer}>
              {DAYS.map((day) => (
                <DaySelector
                  key={day.key}
                  day={day}
                  schedule={availableSchedule}
                  onToggle={toggleDayAvailability}
                  onEditTimes={openTimePicker}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Job Types Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Types</Text>
          <View style={styles.card}>
            <Text style={styles.cardDescription}>
              Select which job types this employee can be assigned to.
              Leave all unselected to allow all types.
            </Text>
            <View style={styles.jobTypesContainer}>
              {JOB_TYPES.map((jobType) => (
                <JobTypeChip
                  key={jobType.key}
                  jobType={jobType}
                  selected={selectedJobTypes.includes(jobType.key)}
                  onToggle={toggleJobType}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Max Jobs Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Limit</Text>
          <View style={styles.card}>
            <View style={styles.maxJobsRow}>
              <View style={styles.maxJobsInfo}>
                <Text style={styles.maxJobsLabel}>Max jobs per day</Text>
                <Text style={styles.maxJobsDescription}>
                  Leave empty for no limit
                </Text>
              </View>
              <TextInput
                style={styles.maxJobsInput}
                value={maxJobsPerDay}
                onChangeText={setMaxJobsPerDay}
                placeholder="-"
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          </View>
        </View>

        {/* Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Internal Notes</Text>
          <View style={styles.card}>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(text) => updateFormField("notes", text)}
              placeholder="Add private notes about this employee..."
              multiline
              numberOfLines={4}
            />
            <Text style={styles.helperText}>
              Only visible to you, not the employee
            </Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Time Picker Modal */}
      <TimePickerModal
        visible={timePickerVisible}
        day={editingDay}
        currentStart={availableSchedule[editingDay]?.start}
        currentEnd={availableSchedule[editingDay]?.end}
        onSave={saveTimeRestriction}
        onClose={() => setTimePickerVisible(false)}
      />

      {/* Save Button */}
      <View style={styles.footer}>
        <Pressable style={styles.cancelButton} onPress={() => navigate(-1)}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="check" size={16} color="#fff" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  formRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  formGroup: {
    flex: 1,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  inputDisabled: {
    backgroundColor: colors.neutral[100],
    color: colors.text.tertiary,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  currencyInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  currencySymbol: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  currencyInputField: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
  },
  currencySuffix: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
  },
  paymentOptions: {
    gap: spacing.sm,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  paymentOptionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  paymentOptionText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  paymentOptionTextSelected: {
    color: colors.primary[700],
  },
  permissionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  permissionInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  permissionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  permissionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  permissionDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.sm,
  },
  errorMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.error[600],
  },
  errorMessageText: {
    marginLeft: spacing.sm,
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  successMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.success[600],
  },
  successMessageText: {
    marginLeft: spacing.sm,
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    padding: spacing.lg,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
  },
  cancelButtonText: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
  saveButton: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  saveButtonDisabled: {
    backgroundColor: colors.primary[300],
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
  bottomPadding: {
    height: spacing.xl,
  },

  // Availability styles
  cardDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  daysContainer: {
    gap: spacing.xs,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  dayToggle: {
    width: 48,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  dayToggleActive: {
    backgroundColor: colors.primary[100],
  },
  dayLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[400],
  },
  dayLabelActive: {
    color: colors.primary[600],
  },
  timeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutral[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  timeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  timeTextAll: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  unavailableText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },

  // Job types styles
  jobTypesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  jobTypeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border.default,
    gap: spacing.xs,
  },
  jobTypeChipSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[400],
  },
  jobTypeLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  jobTypeLabelSelected: {
    color: colors.primary[700],
  },

  // Max jobs styles
  maxJobsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  maxJobsInfo: {
    flex: 1,
  },
  maxJobsLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  maxJobsDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  maxJobsInput: {
    width: 60,
    height: 44,
    backgroundColor: colors.neutral[50],
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    textAlign: "center",
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  modalSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  timePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  timePickerColumn: {
    flex: 1,
  },
  timePickerLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  timeScroll: {
    height: 200,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.xs,
  },
  timeOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  timeOptionSelected: {
    backgroundColor: colors.primary[100],
  },
  timeOptionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
  timeOptionTextSelected: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },
  timePickerDivider: {
    width: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  modalClearButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
  },
  modalClearText: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
  modalSaveButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
    alignItems: "center",
  },
  modalSaveText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
});

export default EmployeeEditForm;
