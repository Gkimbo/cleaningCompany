import React from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const DISCLAIMER_SECTIONS = [
  {
    title: "Calendar Sync Notice",
    content:
      "Calendar synchronization is provided as a convenience feature only. It pulls data from third-party calendar services (such as Airbnb, VRBO, and Booking.com) to help identify checkout dates for scheduling cleaning appointments.",
  },
  {
    title: "Auto-Sync Disclaimer",
    content:
      "When auto-sync is enabled, the system checks your linked calendars approximately once per hour. This is not real-time synchronization. Last-minute bookings, cancellations, or changes made within the hour may not be reflected immediately. You should always verify your schedule before accepting or assigning jobs.",
  },
  {
    title: "Third-Party Calendar Services",
    content:
      "We do not control or guarantee the accuracy, availability, or timeliness of data from external calendar providers. Calendar export URLs may change, expire, or become unavailable without notice. Sync failures or delays may occur due to issues with the third-party service.",
  },
  {
    title: "Conflict Resolution",
    content:
      "If you have synced calendars from multiple platforms for the same property, overlapping bookings or conflicting dates may occur. The system will attempt to avoid duplicate appointments, but you are responsible for reviewing and resolving any scheduling conflicts.",
  },
  {
    title: "Offline Availability",
    content:
      "Calendar sync requires an internet connection. If you are offline, no new data will be synced and your calendar may be out of date until connectivity is restored.",
  },
  {
    title: "Availability Responsibility",
    content:
      "Calendar sync does not guarantee that your availability is accurate. Before accepting a job assignment, you must confirm that you are actually available on that date. Synced calendars are a reference tool, not a substitute for personal schedule management.",
  },
  {
    title: "Business Owner Assignments",
    content:
      "If you are a business owner assigning jobs to employees based on calendar sync data, you are responsible for confirming employee availability. Calendar sync data should be used as a starting point, not as definitive proof of availability.",
  },
  {
    title: "No Guarantee",
    content:
      "We make no guarantees regarding the accuracy, completeness, or reliability of calendar sync functionality. Use of this feature is at your own risk. We are not liable for missed appointments, double bookings, or any other issues arising from reliance on calendar sync data.",
  },
];

const CalendarSyncDisclaimerView = ({ visible, onClose, acceptedAt }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Calendar Sync Disclaimer</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>X</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {acceptedAt && (
              <View style={styles.acceptedBanner}>
                <Text style={styles.acceptedText}>
                  You accepted this disclaimer on {formatDate(acceptedAt)}
                </Text>
              </View>
            )}

            {DISCLAIMER_SECTIONS.map((section, index) => (
              <View key={index} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionContent}>{section.content}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeFooterButton} onPress={onClose}>
              <Text style={styles.closeFooterButtonText}>Close</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  modalContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    width: "100%",
    maxHeight: SCREEN_HEIGHT * 0.85,
    ...shadows.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },
  scrollView: {
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  acceptedBanner: {
    backgroundColor: colors.success[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  acceptedText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    textAlign: "center",
    fontWeight: typography.fontWeight.medium,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionContent: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.neutral[50],
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  closeFooterButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.md,
  },
  closeFooterButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});

export default CalendarSyncDisclaimerView;
