import React, { useEffect, useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { SegmentedButtons, TextInput } from "react-native-paper";
import { useNavigate } from "react-router-native";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

const EachAppointment = ({
  id,
  index,
  date,
  price,
  bringSheets,
  bringTowels,
  keyPadCode,
  keyLocation,
  isDisabled,
  formatDate,
  handleTowelToggle,
  handleSheetsToggle,
  setChangesSubmitted,
  changeNotification,
  setChangeNotification,
  contact,
  paid,
  completed,
  timeToBeCompleted,
}) => {
  const [code, setCode] = useState("");
  const [key, setKeyLocation] = useState("");
  const [keyCodeToggle, setKeyCodeToggle] = useState("");
  const [error, setError] = useState(null);
  const [redirect, setRedirect] = useState(false);
  const [showAccessDetails, setShowAccessDetails] = useState(false);
  const navigate = useNavigate();

  // Handle code and key inputs
  const handleKeyPadCode = (newCode) => {
    const regex = /^[\d#]*(\.\d*)?(\s*)?$/;
    if (!regex.test(newCode)) {
      setError("Key Pad Code can only be a number!");
      return;
    }
    if (newCode === "") {
      setError("Key Pad Code cannot be blank!");
    } else {
      setError(null);
    }
    setCode(newCode);
    setChangeNotification({ message: "", appointment: "" });
  };

  const handleKeyLocation = (newLocation) => {
    setKeyLocation(newLocation);
    setChangeNotification({ message: "", appointment: "" });
  };

  // Submit updates
  const handleSubmit = async () => {
    if (!code && !key) {
      setError(
        "Please provide instructions on how to get into the property with either a key or a code"
      );
      return;
    }
    setError(null);
    if (code !== keyPadCode || key !== keyLocation) {
      if (code) {
        await Appointment.updateCodeAppointments(code, id);
      } else {
        await Appointment.updateKeyAppointments(key, id);
      }
      setChangesSubmitted(true);
      setChangeNotification({
        message: `Changes made only to the ${formatDate(date)} appointment!`,
        appointment: id,
      });
    } else {
      setError("No changes made.");
    }
  };

  // Toggle between code/key
  const handleKeyToggle = (text) => {
    if (text === "code") {
      setKeyCodeToggle("code");
      setKeyLocation("");
    } else {
      setKeyCodeToggle("key");
      setCode("");
    }
    setChangeNotification({ message: "", appointment: "" });
  };

  // Preload values
  useEffect(() => {
    if (keyPadCode !== "") {
      setCode(keyPadCode);
      setKeyCodeToggle("code");
    }
    if (keyLocation !== "") {
      setKeyLocation(keyLocation);
      setKeyCodeToggle("key");
    }
  }, []);

  // Redirect handler
  useEffect(() => {
    if (redirect) {
      navigate("/bill");
      setRedirect(false);
    }
  }, [redirect]);

  const handleRedirectToBill = () => {
    setRedirect(true);
  };

  // Format time display
  const getTimeDisplay = () => {
    switch (timeToBeCompleted) {
      case "anytime":
        return "Anytime";
      case "10-3":
        return "10am - 3pm";
      case "11-4":
        return "11am - 4pm";
      case "12-2":
        return "12pm - 2pm";
      default:
        return "Anytime";
    }
  };

  // Get card status style
  const getCardStatusStyle = () => {
    if (completed && paid) return styles.cardComplete;
    if (completed && !paid) return styles.cardNeedsPay;
    if (isDisabled) return styles.cardUpcoming;
    return styles.cardScheduled;
  };

  // --- Render Completed States ---
  if (completed && !paid) {
    return (
      <Pressable onPress={handleRedirectToBill} style={({ pressed }) => [styles.card, styles.cardNeedsPay, pressed && styles.cardPressed]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.dateText}>{formatDate(date)}</Text>
            <View style={[styles.badge, styles.badgeWarning]}>
              <Text style={[styles.badgeText, styles.badgeTextWarning]}>Payment Due</Text>
            </View>
          </View>
          <Text style={styles.priceText}>${price}</Text>
        </View>
        <View style={styles.paymentPrompt}>
          <Text style={styles.paymentPromptText}>Cleaning complete - Tap to pay</Text>
        </View>
      </Pressable>
    );
  }

  if (completed && paid) {
    return (
      <View style={[styles.card, styles.cardComplete]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.dateText}>{formatDate(date)}</Text>
            <View style={[styles.badge, styles.badgeSuccess]}>
              <Text style={[styles.badgeText, styles.badgeTextSuccess]}>Completed</Text>
            </View>
          </View>
          <Text style={[styles.priceText, styles.priceComplete]}>${price}</Text>
        </View>
      </View>
    );
  }

  // --- Render Active Appointment ---
  return (
    <View style={[styles.card, getCardStatusStyle()]}>
      {/* Header with Date & Price */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>{formatDate(date)}</Text>
          {isDisabled ? (
            <View style={[styles.badge, styles.badgePrimary]}>
              <Text style={[styles.badgeText, styles.badgeTextPrimary]}>Coming Soon</Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.badgeDefault]}>
              <Text style={[styles.badgeText, styles.badgeTextDefault]}>Scheduled</Text>
            </View>
          )}
        </View>
        <Text style={styles.priceText}>${price}</Text>
      </View>

      {/* Quick Info Row */}
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Time</Text>
          <Text style={styles.infoValue}>{getTimeDisplay()}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Contact</Text>
          <Text style={styles.infoValue}>{contact}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Services Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add-on Services</Text>

        {/* Sheets Toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabelContainer}>
            <Text style={styles.toggleLabel}>Bring Sheets</Text>
            <Text style={styles.togglePrice}>+$25</Text>
          </View>
          {isDisabled ? (
            <View style={[styles.lockedValue, bringSheets === "yes" && styles.lockedValueActive]}>
              <Text style={[styles.lockedValueText, bringSheets === "yes" && styles.lockedValueTextActive]}>
                {bringSheets === "yes" ? "Yes" : "No"}
              </Text>
            </View>
          ) : (
            <SegmentedButtons
              value={bringSheets}
              onValueChange={(value) => handleSheetsToggle(value, id)}
              buttons={[
                { value: "no", label: "No" },
                { value: "yes", label: "Yes" },
              ]}
              style={styles.segmentedButton}
              density="small"
            />
          )}
        </View>

        {/* Towels Toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabelContainer}>
            <Text style={styles.toggleLabel}>Bring Towels</Text>
            <Text style={styles.togglePrice}>+$25</Text>
          </View>
          {isDisabled ? (
            <View style={[styles.lockedValue, bringTowels === "yes" && styles.lockedValueActive]}>
              <Text style={[styles.lockedValueText, bringTowels === "yes" && styles.lockedValueTextActive]}>
                {bringTowels === "yes" ? "Yes" : "No"}
              </Text>
            </View>
          ) : (
            <SegmentedButtons
              value={bringTowels}
              onValueChange={(value) => handleTowelToggle(value, id)}
              buttons={[
                { value: "no", label: "No" },
                { value: "yes", label: "Yes" },
              ]}
              style={styles.segmentedButton}
              density="small"
            />
          )}
        </View>

        {isDisabled && (
          <View style={styles.lockedNotice}>
            <Text style={styles.lockedNoticeText}>
              Changes locked within 1 week of appointment. Contact us for modifications.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      {/* Access Details Section - Collapsible */}
      <Pressable onPress={() => setShowAccessDetails(!showAccessDetails)} style={styles.collapsibleHeader}>
        <Text style={styles.sectionTitle}>Access Instructions</Text>
        <Text style={styles.chevron}>{showAccessDetails ? "−" : "+"}</Text>
      </Pressable>

      {showAccessDetails && (
        <View style={styles.accessSection}>
          {/* Access Method Toggle */}
          <View style={styles.accessMethodRow}>
            <SegmentedButtons
              value={keyCodeToggle}
              onValueChange={handleKeyToggle}
              buttons={[
                { value: "key", label: "Key Location" },
                { value: "code", label: "Door Code" },
              ]}
              style={styles.accessToggle}
            />
          </View>

          {/* Code Input */}
          {keyCodeToggle === "code" && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Door Code</Text>
              <TextInput
                mode="outlined"
                value={code || ""}
                onChangeText={handleKeyPadCode}
                style={styles.codeInput}
                placeholder="1234#"
                keyboardType="numeric"
                outlineColor={colors.border.default}
                activeOutlineColor={colors.primary[500]}
              />
            </View>
          )}

          {/* Key Location Input */}
          {keyCodeToggle === "key" && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Key Location</Text>
              <TextInput
                mode="outlined"
                value={key || ""}
                onChangeText={handleKeyLocation}
                style={styles.keyInput}
                placeholder="Under the mat by the back door..."
                multiline
                outlineColor={colors.border.default}
                activeOutlineColor={colors.primary[500]}
              />
              <Text style={styles.inputHint}>
                Be specific - include landmarks or details to help find it easily.
              </Text>
            </View>
          )}

          {/* Change Notification */}
          {changeNotification.appointment === id && (
            <View style={styles.successNotice}>
              <Text style={styles.successNoticeText}>{changeNotification.message}</Text>
            </View>
          )}

          {/* Submit Button */}
          {(code !== keyPadCode || key !== keyLocation) && (
            <Pressable onPress={handleSubmit} style={({ pressed }) => [styles.submitButton, pressed && styles.submitButtonPressed]}>
              <Text style={styles.submitButtonText}>Save Changes</Text>
            </Pressable>
          )}

          {error && (
            <View style={styles.errorNotice}>
              <Text style={styles.errorNoticeText}>{error}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.md,
  },
  cardScheduled: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[400],
  },
  cardUpcoming: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[600],
  },
  cardNeedsPay: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
    backgroundColor: colors.warning[50],
  },
  cardComplete: {
    borderLeftWidth: 4,
    borderLeftColor: colors.success[500],
    backgroundColor: colors.success[50],
    opacity: 0.85,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  dateText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  priceText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.secondary[600],
  },
  priceComplete: {
    color: colors.success[600],
  },

  // Badges
  badge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  badgeDefault: {
    backgroundColor: colors.neutral[100],
  },
  badgePrimary: {
    backgroundColor: colors.primary[100],
  },
  badgeSuccess: {
    backgroundColor: colors.success[100],
  },
  badgeWarning: {
    backgroundColor: colors.warning[100],
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  badgeTextDefault: {
    color: colors.text.secondary,
  },
  badgeTextPrimary: {
    color: colors.primary[700],
  },
  badgeTextSuccess: {
    color: colors.success[700],
  },
  badgeTextWarning: {
    color: colors.warning[700],
  },

  // Payment Prompt
  paymentPrompt: {
    backgroundColor: colors.warning[100],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
  },
  paymentPromptText: {
    color: colors.warning[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: "center",
  },

  // Info Row
  infoRow: {
    flexDirection: "row",
    gap: spacing.xl,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.md,
  },

  // Section
  section: {
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  // Toggle Row
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  toggleLabelContainer: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  togglePrice: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  segmentedButton: {
    width: 120,
  },
  lockedValue: {
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  lockedValueActive: {
    backgroundColor: colors.primary[100],
  },
  lockedValueText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  lockedValueTextActive: {
    color: colors.primary[700],
  },

  // Locked Notice
  lockedNotice: {
    backgroundColor: colors.neutral[50],
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  lockedNoticeText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "center",
  },

  // Collapsible
  collapsibleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  chevron: {
    fontSize: typography.fontSize.xl,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.light,
  },

  // Access Section
  accessSection: {
    marginTop: spacing.sm,
  },
  accessMethodRow: {
    marginBottom: spacing.md,
  },
  accessToggle: {
    width: "100%",
  },

  // Inputs
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  codeInput: {
    backgroundColor: colors.neutral[0],
    fontSize: typography.fontSize.lg,
    textAlign: "center",
    letterSpacing: 4,
  },
  keyInput: {
    backgroundColor: colors.neutral[0],
    minHeight: 80,
  },
  inputHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },

  // Notices
  successNotice: {
    backgroundColor: colors.success[50],
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success[200],
    marginBottom: spacing.md,
  },
  successNoticeText: {
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
    textAlign: "center",
  },
  errorNotice: {
    backgroundColor: colors.error[50],
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error[200],
    marginTop: spacing.sm,
  },
  errorNoticeText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    textAlign: "center",
  },

  // Submit Button
  submitButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  submitButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  submitButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: "center",
  },
});

export default EachAppointment;
