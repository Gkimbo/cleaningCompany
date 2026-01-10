import React, { useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { AuthContext } from "../../../services/AuthContext";
import ConflictService from "../../../services/fetchRequests/ConflictService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../../services/styles/theme";

const AddNoteModal = ({ visible, onClose, onSuccess, caseType, caseId }) => {
  const { user } = useContext(AuthContext);
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!note.trim()) {
      Alert.alert("Error", "Please enter a note");
      return;
    }

    setProcessing(true);
    try {
      const result = await ConflictService.addNote(
        user.token,
        caseType,
        caseId,
        note.trim()
      );

      if (result.success) {
        setNote("");
        onSuccess?.();
      } else {
        Alert.alert("Error", result.error || "Failed to add note");
      }
    } catch (err) {
      Alert.alert("Error", "Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setNote("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Icon name="sticky-note" size={24} color={colors.primary[500]} />
            </View>
            <Text style={styles.title}>Add Note</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Icon name="times" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Note</Text>
              <TextInput
                style={styles.noteInput}
                multiline
                numberOfLines={5}
                placeholder="Add your internal note about this case..."
                placeholderTextColor={colors.text.tertiary}
                value={note}
                onChangeText={setNote}
                autoFocus
              />
              <Text style={styles.helperText}>
                This note will be visible in the audit trail and to other reviewers.
              </Text>
            </View>

            {/* Quick Note Templates */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Quick Templates</Text>
              <View style={styles.templates}>
                {[
                  "Waiting for additional documentation",
                  "Contacted homeowner for clarification",
                  "Reviewed photos - discrepancy confirmed",
                  "Escalating to supervisor",
                ].map((template, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.templateButton}
                    onPress={() => setNote(note ? `${note}\n${template}` : template)}
                  >
                    <Text style={styles.templateText}>{template}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, (!note.trim() || processing) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!note.trim() || processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color={colors.neutral[0]} />
              ) : (
                <>
                  <Icon name="check" size={14} color={colors.neutral[0]} />
                  <Text style={styles.submitButtonText}>Add Note</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.glass.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  container: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    overflow: "hidden",
    ...shadows.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.sm,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  noteInput: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 120,
    textAlignVertical: "top",
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  templates: {
    gap: spacing.xs,
  },
  templateButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
  },
  templateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  submitButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary[500],
    borderRadius: radius.lg,
  },
  submitButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default AddNoteModal;
