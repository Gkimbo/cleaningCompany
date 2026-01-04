import React, { useState, useEffect } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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

const TIME_WINDOWS = [
  { value: "anytime", label: "Anytime" },
  { value: "morning", label: "Morning (8am-12pm)" },
  { value: "afternoon", label: "Afternoon (12pm-5pm)" },
  { value: "evening", label: "Evening (5pm-8pm)" },
];

const EditClientHomeModal = ({ visible, onClose, onSave, home, cleanerClient }) => {
  const isPending = cleanerClient?.status === "pending_invite";

  const [formData, setFormData] = useState({
    keyPadCode: "",
    keyLocation: "",
    sheetsProvided: false,
    towelsProvided: false,
    timeToBeCompleted: "anytime",
    cleanersNeeded: 1,
    specialNotes: "",
  });

  const [isSaving, setIsSaving] = useState(false);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isPending && cleanerClient) {
      // For pending invitations, only notes are editable
      setFormData({
        keyPadCode: "",
        keyLocation: "",
        sheetsProvided: false,
        towelsProvided: false,
        timeToBeCompleted: "anytime",
        cleanersNeeded: 1,
        specialNotes: cleanerClient.invitedNotes || "",
      });
    } else if (home) {
      setFormData({
        keyPadCode: home.keyPadCode || "",
        keyLocation: home.keyLocation || "",
        sheetsProvided: home.sheetsProvided || false,
        towelsProvided: home.towelsProvided || false,
        timeToBeCompleted: home.timeToBeCompleted || "anytime",
        cleanersNeeded: home.cleanersNeeded || 1,
        specialNotes: home.specialNotes || "",
      });
    }
  }, [home, cleanerClient, isPending, visible]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

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
            <Text style={styles.headerTitle}>
              {isPending ? "Edit Invitation Notes" : "Edit Home Details"}
            </Text>
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
            >
              <Feather name="x" size={24} color={colors.text.primary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Access Info Section - only for active clients */}
            {!isPending && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="lock" size={18} color={colors.primary[600]} />
                  <Text style={styles.sectionTitle}>Access Information</Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Keypad Code</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.keyPadCode}
                    onChangeText={(value) => updateField("keyPadCode", value)}
                    placeholder="Enter keypad code"
                    placeholderTextColor={colors.neutral[400]}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Key Location</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.keyLocation}
                    onChangeText={(value) => updateField("keyLocation", value)}
                    placeholder="e.g., Under the mat, in lockbox"
                    placeholderTextColor={colors.neutral[400]}
                  />
                </View>
              </View>
            )}

            {/* Linens Section - only for active clients */}
            {!isPending && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="box" size={18} color={colors.primary[600]} />
                  <Text style={styles.sectionTitle}>Linens</Text>
                </View>

                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>Sheets Provided</Text>
                    <Text style={styles.toggleDescription}>
                      Client provides their own sheets
                    </Text>
                  </View>
                  <Switch
                    value={formData.sheetsProvided}
                    onValueChange={(value) => updateField("sheetsProvided", value)}
                    trackColor={{ false: colors.neutral[300], true: colors.primary[300] }}
                    thumbColor={formData.sheetsProvided ? colors.primary[600] : colors.neutral[100]}
                  />
                </View>

                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>Towels Provided</Text>
                    <Text style={styles.toggleDescription}>
                      Client provides their own towels
                    </Text>
                  </View>
                  <Switch
                    value={formData.towelsProvided}
                    onValueChange={(value) => updateField("towelsProvided", value)}
                    trackColor={{ false: colors.neutral[300], true: colors.primary[300] }}
                    thumbColor={formData.towelsProvided ? colors.primary[600] : colors.neutral[100]}
                  />
                </View>
              </View>
            )}

            {/* Service Preferences Section - only for active clients */}
            {!isPending && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="settings" size={18} color={colors.primary[600]} />
                  <Text style={styles.sectionTitle}>Service Preferences</Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Preferred Time</Text>
                  <View style={styles.optionsRow}>
                    {TIME_WINDOWS.map((option) => (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.optionButton,
                          formData.timeToBeCompleted === option.value &&
                            styles.optionButtonActive,
                        ]}
                        onPress={() => updateField("timeToBeCompleted", option.value)}
                      >
                        <Text
                          style={[
                            styles.optionButtonText,
                            formData.timeToBeCompleted === option.value &&
                              styles.optionButtonTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Cleaners Needed</Text>
                  <View style={styles.counterRow}>
                    <Pressable
                      style={[
                        styles.counterButton,
                        formData.cleanersNeeded <= 1 && styles.counterButtonDisabled,
                      ]}
                      onPress={() =>
                        formData.cleanersNeeded > 1 &&
                        updateField("cleanersNeeded", formData.cleanersNeeded - 1)
                      }
                      disabled={formData.cleanersNeeded <= 1}
                    >
                      <Feather
                        name="minus"
                        size={18}
                        color={
                          formData.cleanersNeeded <= 1
                            ? colors.neutral[300]
                            : colors.primary[600]
                        }
                      />
                    </Pressable>
                    <Text style={styles.counterValue}>{formData.cleanersNeeded}</Text>
                    <Pressable
                      style={styles.counterButton}
                      onPress={() =>
                        updateField("cleanersNeeded", formData.cleanersNeeded + 1)
                      }
                    >
                      <Feather name="plus" size={18} color={colors.primary[600]} />
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {/* Notes Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="file-text" size={18} color={colors.primary[600]} />
                <Text style={styles.sectionTitle}>Special Notes</Text>
              </View>

              <TextInput
                style={styles.notesInput}
                value={formData.specialNotes}
                onChangeText={(value) => updateField("specialNotes", value)}
                placeholder="Add any special instructions or notes..."
                placeholderTextColor={colors.neutral[400]}
                multiline
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
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.saveButtonPressed,
                isSaving && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <Feather name="check" size={18} color={colors.neutral[0]} />
              <Text style={styles.saveButtonText}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    maxHeight: "90%",
    ...shadows.xl,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },

  // Scroll
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },

  // Sections
  section: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  // Fields
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  input: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },

  // Toggle rows
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  toggleInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },

  // Options row
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  optionButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  optionButtonActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  optionButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  optionButtonTextActive: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.medium,
  },

  // Counter
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[0],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  counterButtonDisabled: {
    opacity: 0.5,
  },
  counterValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    minWidth: 30,
    textAlign: "center",
  },

  // Notes input
  notesInput: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    minHeight: 100,
    lineHeight: 22,
  },

  // Footer
  footer: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
  },
  cancelButtonPressed: {
    backgroundColor: colors.neutral[200],
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    ...shadows.md,
  },
  saveButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default EditClientHomeModal;
