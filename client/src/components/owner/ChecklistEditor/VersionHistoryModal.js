import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import styles from "./ChecklistEditorStyles";
import { colors } from "../../../services/styles/theme";

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const countItems = (sections) => {
  if (!sections) return 0;
  return sections.reduce((sum, section) => {
    return sum + (section.items?.length || 0);
  }, 0);
};

const VersionHistoryModal = ({
  visible,
  onClose,
  versions,
  loading,
  onRevert,
  currentVersion,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { maxWidth: 500, maxHeight: "80%" }]}>
          <Text style={styles.modalTitle}>Version History</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary[500]} />
              <Text style={styles.loadingText}>Loading versions...</Text>
            </View>
          ) : versions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No versions published yet</Text>
              <Text style={styles.emptyStateHint}>
                Publish your first version to see it here
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 400 }}>
              <View style={styles.historyList}>
                {versions.map((version, index) => {
                  const isCurrent = version.isActive;
                  const sectionCount = version.snapshotData?.sections?.length || 0;
                  const itemCount = countItems(version.snapshotData?.sections);

                  return (
                    <View
                      key={version.id}
                      style={[
                        styles.historyItem,
                        isCurrent && styles.historyItemFirst,
                      ]}
                    >
                      <View style={styles.historyItemLeft}>
                        <View
                          style={[
                            styles.historyVersionBadge,
                            isCurrent && styles.historyVersionBadgeCurrent,
                          ]}
                        >
                          <Text
                            style={[
                              styles.historyVersionText,
                              isCurrent && styles.historyVersionTextCurrent,
                            ]}
                          >
                            v{version.version}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.historyItemContent}>
                        <View style={styles.historyItemHeader}>
                          <Text style={styles.historyItemMeta}>
                            {formatDate(version.publishedAt)}
                          </Text>
                          {!isCurrent && (
                            <Pressable
                              style={styles.historyRevertButton}
                              onPress={() => onRevert(version.id)}
                            >
                              <Text style={styles.historyRevertButtonText}>
                                Revert
                              </Text>
                            </Pressable>
                          )}
                        </View>
                        <Text style={styles.historyItemStats}>
                          {sectionCount} sections, {itemCount} tasks
                        </Text>
                        {isCurrent && (
                          <Text
                            style={[
                              styles.historyItemMeta,
                              { color: colors.success[600], marginTop: 4 },
                            ]}
                          >
                            Currently Active
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          <View style={[styles.modalButtons, { marginTop: 20 }]}>
            <Pressable style={styles.modalCancelButton} onPress={onClose}>
              <Text style={styles.modalCancelButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default VersionHistoryModal;
