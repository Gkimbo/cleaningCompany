import React from "react";
import { Modal, View, Text, Pressable, ActivityIndicator } from "react-native";
import styles from "./ChecklistEditorStyles";
import { colors } from "../../../services/styles/theme";

const PublishConfirmModal = ({
  visible,
  onClose,
  onConfirm,
  loading,
  currentVersion,
  sectionCount,
  itemCount,
}) => {
  const nextVersion = (currentVersion || 0) + 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Publish Checklist</Text>

          <Text style={styles.modalMessage}>
            This will create Version {nextVersion} of the cleaning checklist.
            All cleaners will see the updated checklist on their next job.
          </Text>

          <View style={styles.modalStats}>
            <View style={styles.modalStatRow}>
              <Text style={styles.modalStatLabel}>New Version</Text>
              <Text style={styles.modalStatValue}>v{nextVersion}</Text>
            </View>
            <View style={styles.modalStatRow}>
              <Text style={styles.modalStatLabel}>Sections</Text>
              <Text style={styles.modalStatValue}>{sectionCount}</Text>
            </View>
            <View style={styles.modalStatRow}>
              <Text style={styles.modalStatLabel}>Total Tasks</Text>
              <Text style={styles.modalStatValue}>{itemCount}</Text>
            </View>
          </View>

          <View style={styles.modalButtons}>
            <Pressable
              style={styles.modalCancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.modalConfirmButton,
                loading && { opacity: 0.6 },
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.neutral[0]} />
              ) : (
                <Text style={styles.modalConfirmButtonText}>Publish</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default PublishConfirmModal;
