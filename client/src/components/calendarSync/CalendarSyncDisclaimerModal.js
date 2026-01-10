import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Checkbox } from "react-native-paper";
import {
  colors,
  spacing,
  radius,
  shadows,
  typography,
} from "../../services/styles/theme";

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

const ACKNOWLEDGMENT_TEXT =
  "I understand that calendar sync is not real-time and does not guarantee availability accuracy. I remain responsible for confirming my schedule before accepting or assigning jobs.";

const CalendarSyncDisclaimerModal = ({ visible, onAccept, onCancel }) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const scrollViewRef = useRef(null);

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 40;
    const isAtBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;

    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = () => {
    if (isChecked && hasScrolledToBottom) {
      onAccept();
      // Reset state for next time
      setHasScrolledToBottom(false);
      setIsChecked(false);
    }
  };

  const handleClose = () => {
    setHasScrolledToBottom(false);
    setIsChecked(false);
    onCancel();
  };

  const canAccept = hasScrolledToBottom && isChecked;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Calendar Sync Disclaimer</Text>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
          >
            <Text style={styles.introText}>
              Please read the following disclaimer carefully before enabling
              calendar sync.
            </Text>

            {DISCLAIMER_SECTIONS.map((section, index) => (
              <View key={index} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionContent}>{section.content}</Text>
              </View>
            ))}

            {!hasScrolledToBottom && (
              <View style={styles.scrollPrompt}>
                <Text style={styles.scrollPromptText}>
                  Scroll down to continue reading
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => hasScrolledToBottom && setIsChecked(!isChecked)}
              activeOpacity={hasScrolledToBottom ? 0.7 : 1}
            >
              <Checkbox
                status={isChecked ? "checked" : "unchecked"}
                onPress={() => hasScrolledToBottom && setIsChecked(!isChecked)}
                color={colors.primary[600]}
                disabled={!hasScrolledToBottom}
              />
              <Text
                style={[
                  styles.checkboxLabel,
                  !hasScrolledToBottom && styles.checkboxLabelDisabled,
                ]}
              >
                {ACKNOWLEDGMENT_TEXT}
              </Text>
            </TouchableOpacity>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  !canAccept && styles.acceptButtonDisabled,
                ]}
                onPress={handleAccept}
                disabled={!canAccept}
              >
                <Text
                  style={[
                    styles.acceptButtonText,
                    !canAccept && styles.acceptButtonTextDisabled,
                  ]}
                >
                  Accept & Continue
                </Text>
              </TouchableOpacity>
            </View>
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
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
  },
  scrollView: {
    maxHeight: SCREEN_HEIGHT * 0.45,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  introText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
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
  scrollPrompt: {
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    alignItems: "center",
  },
  scrollPromptText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.neutral[50],
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 20,
    marginLeft: spacing.xs,
  },
  checkboxLabelDisabled: {
    color: colors.text.tertiary,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  cancelButtonText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.md,
  },
  acceptButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  acceptButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  acceptButtonTextDisabled: {
    color: colors.neutral[500],
  },
});

export default CalendarSyncDisclaimerModal;
