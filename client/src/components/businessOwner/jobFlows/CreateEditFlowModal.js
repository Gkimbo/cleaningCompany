import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import JobFlowService from "../../../services/fetchRequests/JobFlowService";

const PHOTO_OPTIONS = [
  {
    value: "required",
    label: "Required",
    description: "Employees must take before/after photos",
    icon: "camera",
  },
  {
    value: "optional",
    label: "Optional",
    description: "Photos can be skipped",
    icon: "camera",
  },
  {
    value: "hidden",
    label: "Hidden",
    description: "Photo steps are not shown",
    icon: "eye-slash",
  },
];

const CreateEditFlowModal = ({ visible, flow, token, onClose, onSave }) => {
  const isEditing = !!flow;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [photoRequirement, setPhotoRequirement] = useState("required");
  const [jobNotes, setJobNotes] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens/closes or flow changes
  useEffect(() => {
    if (visible) {
      if (flow) {
        setName(flow.name || "");
        setDescription(flow.description || "");
        setPhotoRequirement(flow.photoRequirement || "required");
        setJobNotes(flow.jobNotes || "");
        setIsDefault(flow.isDefault || false);
      } else {
        setName("");
        setDescription("");
        setPhotoRequirement("required");
        setJobNotes("");
        setIsDefault(false);
      }
    }
  }, [visible, flow]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Flow name is required");
      return;
    }

    setSaving(true);

    try {
      const flowData = {
        name: name.trim(),
        description: description.trim() || null,
        photoRequirement,
        jobNotes: jobNotes.trim() || null,
        isDefault,
      };

      let result;
      if (isEditing) {
        result = await JobFlowService.updateFlow(token, flow.id, flowData);
      } else {
        result = await JobFlowService.createFlow(token, flowData);
      }

      if (result.success) {
        onSave(result.flow);
      } else {
        Alert.alert("Error", result.error || "Failed to save job flow");
      }
    } catch (error) {
      console.error("Error saving job flow:", error);
      Alert.alert("Error", "Failed to save job flow");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Icon name="times" size={18} color={colors.text.secondary} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {isEditing ? "Edit Job Flow" : "Create Job Flow"}
          </Text>
          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.neutral[0]} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Flow Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Standard Clean, Deep Clean"
              placeholderTextColor={colors.text.tertiary}
              autoFocus={!isEditing}
            />
          </View>

          {/* Description Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description for this flow"
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Photo Requirement */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Photo Requirement</Text>
            <Text style={styles.hint}>
              Control whether employees must take before/after photos
            </Text>
            <View style={styles.optionsContainer}>
              {PHOTO_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.optionCard,
                    photoRequirement === option.value && styles.optionCardSelected,
                  ]}
                  onPress={() => setPhotoRequirement(option.value)}
                >
                  <View style={styles.optionHeader}>
                    <View
                      style={[
                        styles.optionRadio,
                        photoRequirement === option.value && styles.optionRadioSelected,
                      ]}
                    >
                      {photoRequirement === option.value && (
                        <View style={styles.optionRadioInner} />
                      )}
                    </View>
                    <Icon
                      name={option.icon}
                      size={16}
                      color={
                        photoRequirement === option.value
                          ? colors.primary[600]
                          : colors.neutral[400]
                      }
                    />
                    <Text
                      style={[
                        styles.optionLabel,
                        photoRequirement === option.value && styles.optionLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </View>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Job Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Job Notes for Employees</Text>
            <Text style={styles.hint}>
              These notes will be shown to employees when they start a job using this flow
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={jobNotes}
              onChangeText={setJobNotes}
              placeholder="Special instructions, reminders, or tips for your employees..."
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Set as Default */}
          <Pressable
            style={styles.checkboxRow}
            onPress={() => setIsDefault(!isDefault)}
          >
            <View
              style={[styles.checkbox, isDefault && styles.checkboxChecked]}
            >
              {isDefault && (
                <Icon name="check" size={12} color={colors.neutral[0]} />
              )}
            </View>
            <View style={styles.checkboxContent}>
              <Text style={styles.checkboxLabel}>Set as default flow</Text>
              <Text style={styles.checkboxHint}>
                New clients will automatically use this flow
              </Text>
            </View>
          </Pressable>

          {/* Checklist Note */}
          {!isEditing && (
            <View style={styles.noteCard}>
              <Icon name="info-circle" size={16} color={colors.primary[600]} />
              <Text style={styles.noteText}>
                After creating this flow, you can add a custom checklist by editing
                it from the flow details screen.
              </Text>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background.primary,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  saveButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    minWidth: 70,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.error[500],
  },
  hint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  textArea: {
    minHeight: 80,
    paddingTop: spacing.md,
  },
  optionsContainer: {
    gap: spacing.sm,
  },
  optionCard: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionCardSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    justifyContent: "center",
    alignItems: "center",
  },
  optionRadioSelected: {
    borderColor: colors.primary[600],
  },
  optionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
  },
  optionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  optionLabelSelected: {
    color: colors.primary[700],
  },
  optionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginLeft: 28,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  checkboxContent: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  checkboxHint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  noteCard: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  noteText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },
  bottomPadding: {
    height: 50,
  },
});

export default CreateEditFlowModal;
