import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

const CleanerCard = ({ title, cleaner, highlighted }) => {
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Icon key={i} name="star" size={12} color={colors.warning?.[500] || "#f59e0b"} />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Icon key={i} name="star-half-full" size={12} color={colors.warning?.[500] || "#f59e0b"} />
        );
      } else {
        stars.push(
          <Icon key={i} name="star-o" size={12} color={colors.text?.tertiary || "#9ca3af"} />
        );
      }
    }
    return stars;
  };

  return (
    <View style={[styles.cleanerCard, highlighted && styles.cleanerCardHighlighted]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cleanerName}>{cleaner?.username || "Unknown"}</Text>
      <View style={styles.ratingRow}>
        <View style={styles.starsContainer}>{renderStars(cleaner?.avgRating || 0)}</View>
        <Text style={styles.ratingText}>
          {cleaner?.avgRating?.toFixed(1) || "0.0"} ({cleaner?.reviewCount || 0} reviews)
        </Text>
      </View>
      <Text style={styles.jobsText}>
        {cleaner?.completedJobs || 0} jobs completed
      </Text>
    </View>
  );
};

const CleanerConflictModal = ({
  visible,
  onClose,
  existingCleaner,
  newCleaner,
  onKeepCurrent,
  onSwitch,
  loading,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <Icon name="exchange" size={28} color={colors.warning?.[600] || "#d97706"} />
          </View>

          <Text style={styles.modalTitle}>Cleaner Already Assigned</Text>
          <Text style={styles.modalMessage}>
            Another cleaner has already been assigned to this appointment. Would you like to keep the current cleaner or switch to the new one?
          </Text>

          <View style={styles.comparisonContainer}>
            <CleanerCard
              title="Currently Assigned"
              cleaner={existingCleaner}
              highlighted={false}
            />
            <View style={styles.vsContainer}>
              <Text style={styles.vsText}>vs</Text>
            </View>
            <CleanerCard
              title="New Request"
              cleaner={newCleaner}
              highlighted={true}
            />
          </View>

          <View style={styles.modalButtons}>
            <Pressable
              style={[styles.keepButton, loading && styles.buttonDisabled]}
              onPress={onKeepCurrent}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.text?.primary || "#1f2937"} />
              ) : (
                <Text style={styles.keepButtonText}>Keep Current</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.switchButton, loading && styles.buttonDisabled]}
              onPress={onSwitch}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.neutral?.[0] || "#ffffff"} />
              ) : (
                <Text style={styles.switchButtonText}>Switch Cleaner</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing?.lg || 16,
  },
  modalContainer: {
    backgroundColor: colors.neutral?.[0] || "#ffffff",
    borderRadius: radius?.xl || 16,
    padding: spacing?.xl || 20,
    width: "100%",
    maxWidth: 400,
    ...shadows?.md,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: spacing?.md || 12,
  },
  modalTitle: {
    fontSize: typography?.fontSize?.xl || 20,
    fontWeight: typography?.fontWeight?.bold || "700",
    color: colors.text?.primary || "#1f2937",
    textAlign: "center",
    marginBottom: spacing?.sm || 8,
  },
  modalMessage: {
    fontSize: typography?.fontSize?.sm || 14,
    color: colors.text?.secondary || "#6b7280",
    textAlign: "center",
    marginBottom: spacing?.lg || 16,
    lineHeight: 20,
  },
  comparisonContainer: {
    marginBottom: spacing?.lg || 16,
  },
  cleanerCard: {
    backgroundColor: colors.background?.secondary || "#f9fafb",
    borderRadius: radius?.lg || 12,
    padding: spacing?.md || 12,
    borderWidth: 2,
    borderColor: colors.border?.light || "#e5e7eb",
  },
  cleanerCardHighlighted: {
    borderColor: colors.primary?.[500] || "#3b82f6",
    backgroundColor: colors.primary?.[50] || "#eff6ff",
  },
  cardTitle: {
    fontSize: typography?.fontSize?.xs || 12,
    fontWeight: typography?.fontWeight?.semibold || "600",
    color: colors.text?.tertiary || "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing?.xs || 4,
  },
  cleanerName: {
    fontSize: typography?.fontSize?.lg || 18,
    fontWeight: typography?.fontWeight?.semibold || "600",
    color: colors.text?.primary || "#1f2937",
    marginBottom: spacing?.xs || 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing?.xs || 4,
  },
  starsContainer: {
    flexDirection: "row",
    marginRight: spacing?.sm || 8,
  },
  ratingText: {
    fontSize: typography?.fontSize?.sm || 14,
    color: colors.text?.secondary || "#6b7280",
  },
  jobsText: {
    fontSize: typography?.fontSize?.sm || 14,
    color: colors.text?.secondary || "#6b7280",
  },
  vsContainer: {
    alignItems: "center",
    paddingVertical: spacing?.sm || 8,
  },
  vsText: {
    fontSize: typography?.fontSize?.sm || 14,
    fontWeight: typography?.fontWeight?.semibold || "600",
    color: colors.text?.tertiary || "#9ca3af",
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing?.sm || 8,
  },
  keepButton: {
    flex: 1,
    backgroundColor: colors.neutral?.[100] || "#f5f5f5",
    borderRadius: radius?.md || 8,
    paddingVertical: spacing?.md || 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border?.light || "#e5e7eb",
  },
  keepButtonText: {
    fontSize: typography?.fontSize?.base || 16,
    fontWeight: typography?.fontWeight?.semibold || "600",
    color: colors.text?.primary || "#1f2937",
  },
  switchButton: {
    flex: 1,
    backgroundColor: colors.primary?.[600] || "#2563eb",
    borderRadius: radius?.md || 8,
    paddingVertical: spacing?.md || 12,
    alignItems: "center",
  },
  switchButtonText: {
    fontSize: typography?.fontSize?.base || 16,
    fontWeight: typography?.fontWeight?.semibold || "600",
    color: colors.neutral?.[0] || "#ffffff",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default CleanerConflictModal;
