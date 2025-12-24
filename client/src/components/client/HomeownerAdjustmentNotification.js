import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";
import FetchData from "../../services/fetchRequests/fetchData";

const HomeownerAdjustmentNotification = ({ adjustment, token, onResponse, onDismiss }) => {
  const [showModal, setShowModal] = useState(false);
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const formatDate = (dateString) => {
    const options = { weekday: "short", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const handleViewDetails = () => {
    setShowModal(true);
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const result = await FetchData.respondToAdjustment(
        token,
        adjustment.id,
        true,
        null
      );

      if (result.error) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      setShowModal(false);
      if (onResponse) {
        onResponse(adjustment.id, "approved", result);
      }
    } catch (err) {
      setError("Failed to submit response. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!denyReason.trim()) {
      setError("Please provide a reason for denying.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const result = await FetchData.respondToAdjustment(
        token,
        adjustment.id,
        false,
        denyReason.trim()
      );

      if (result.error) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      setShowModal(false);
      setShowDenyForm(false);
      setDenyReason("");
      if (onResponse) {
        onResponse(adjustment.id, "denied", result);
      }
    } catch (err) {
      setError("Failed to submit response. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setShowDenyForm(false);
    setDenyReason("");
    setError("");
  };

  const priceDifference = Number(adjustment.priceDifference) || 0;
  const homeAddress = adjustment.home
    ? `${adjustment.home.address}, ${adjustment.home.city}`
    : "Your home";
  const cleanerName = adjustment.cleaner
    ? `${adjustment.cleaner.firstName} ${adjustment.cleaner.lastName}`
    : "A cleaner";

  return (
    <>
      {/* Notification Card */}
      <TouchableOpacity style={styles.notificationCard} onPress={handleViewDetails}>
        <View style={styles.iconContainer}>
          <Icon name="exclamation-circle" size={24} color={colors.warning[600]} />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>Home Size Report</Text>
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {cleanerName} reported your home has more rooms than on file.
            {priceDifference > 0 && ` Additional charge: $${priceDifference.toFixed(2)}`}
          </Text>
          <Text style={styles.tapToReview}>Tap to review</Text>
        </View>
        <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
      </TouchableOpacity>

      {/* Details Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            <ScrollView>
              <View style={styles.modalContent}>
                <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
                  <Icon name="times" size={20} color={colors.text.tertiary} />
                </TouchableOpacity>

                <Text style={styles.modalTitle}>Home Size Discrepancy</Text>
                <Text style={styles.modalSubtitle}>
                  {cleanerName} reported a difference in your home's size
                </Text>

                <View style={styles.addressBadge}>
                  <Icon name="home" size={14} color={colors.primary[600]} />
                  <Text style={styles.addressText}>{homeAddress}</Text>
                </View>

                {adjustment.appointment && (
                  <Text style={styles.dateText}>
                    Cleaning on {formatDate(adjustment.appointment.date)}
                  </Text>
                )}

                {/* Comparison */}
                <View style={styles.comparisonContainer}>
                  <View style={styles.comparisonCard}>
                    <Text style={styles.comparisonLabel}>On File</Text>
                    <Text style={styles.comparisonValue}>
                      {adjustment.originalNumBeds} bed / {adjustment.originalNumBaths} bath
                    </Text>
                  </View>
                  <View style={styles.arrowContainer}>
                    <Icon name="arrow-right" size={20} color={colors.text.tertiary} />
                  </View>
                  <View style={[styles.comparisonCard, styles.comparisonCardHighlight]}>
                    <Text style={styles.comparisonLabel}>Reported</Text>
                    <Text style={styles.comparisonValueHighlight}>
                      {adjustment.reportedNumBeds} bed / {adjustment.reportedNumBaths} bath
                    </Text>
                  </View>
                </View>

                {/* Price Impact */}
                {priceDifference > 0 && (
                  <View style={styles.priceImpactCard}>
                    <Text style={styles.priceImpactLabel}>Price Adjustment</Text>
                    <Text style={styles.priceImpactValue}>
                      +${priceDifference.toFixed(2)}
                    </Text>
                    <Text style={styles.priceImpactNote}>
                      This amount will be charged to your payment method on file
                    </Text>
                  </View>
                )}

                {/* Cleaner's Note */}
                {adjustment.cleanerNote && (
                  <View style={styles.noteContainer}>
                    <Text style={styles.noteLabel}>Cleaner's Note:</Text>
                    <Text style={styles.noteText}>{adjustment.cleanerNote}</Text>
                  </View>
                )}

                {error ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {!showDenyForm ? (
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[styles.approveButton, isSubmitting && styles.buttonDisabled]}
                      onPress={handleApprove}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color={colors.neutral[0]} />
                      ) : (
                        <>
                          <Icon name="check" size={16} color={colors.neutral[0]} />
                          <Text style={styles.approveButtonText}>
                            Approve & Update Home
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.denyButton}
                      onPress={() => setShowDenyForm(true)}
                      disabled={isSubmitting}
                    >
                      <Icon name="times" size={16} color={colors.error[700]} />
                      <Text style={styles.denyButtonText}>Dispute This Report</Text>
                    </TouchableOpacity>

                    <Text style={styles.infoText}>
                      If you dispute, a owner will review the case within 24 hours.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.denyFormContainer}>
                    <Text style={styles.denyFormLabel}>
                      Please explain why you're disputing this report:
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={denyReason}
                      onChangeText={setDenyReason}
                      placeholder="Enter your reason..."
                      placeholderTextColor={colors.text.tertiary}
                      multiline
                      numberOfLines={4}
                    />
                    <View style={styles.denyFormButtons}>
                      <TouchableOpacity
                        style={styles.cancelDenyButton}
                        onPress={() => {
                          setShowDenyForm(false);
                          setDenyReason("");
                          setError("");
                        }}
                        disabled={isSubmitting}
                      >
                        <Text style={styles.cancelDenyButtonText}>Back</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.submitDenyButton, isSubmitting && styles.buttonDisabled]}
                        onPress={handleDeny}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator color={colors.neutral[0]} />
                        ) : (
                          <Text style={styles.submitDenyButtonText}>Submit Dispute</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  notificationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning[200],
    ...shadows.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.warning[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  notificationContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  notificationTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    lineHeight: 18,
  },
  tapToReview: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "90%",
    ...shadows.lg,
  },
  modalContent: {
    padding: spacing.xl,
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    padding: spacing.sm,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  addressBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  addressText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    marginLeft: spacing.sm,
    fontWeight: typography.fontWeight.medium,
  },
  dateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  comparisonContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  comparisonCard: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  comparisonCardHighlight: {
    backgroundColor: colors.warning[100],
    borderWidth: 1,
    borderColor: colors.warning[300],
  },
  arrowContainer: {
    paddingHorizontal: spacing.md,
  },
  comparisonLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  comparisonValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  comparisonValueHighlight: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[800],
  },
  priceImpactCard: {
    backgroundColor: colors.error[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  priceImpactLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
    marginBottom: spacing.xs,
  },
  priceImpactValue: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.error[700],
    marginBottom: spacing.sm,
  },
  priceImpactNote: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
    textAlign: "center",
  },
  noteContainer: {
    backgroundColor: colors.secondary[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noteLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.secondary[700],
    marginBottom: spacing.xs,
  },
  noteText: {
    fontSize: typography.fontSize.sm,
    color: colors.secondary[800],
    lineHeight: 20,
  },
  errorContainer: {
    backgroundColor: colors.error[100],
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    textAlign: "center",
  },
  buttonContainer: {
    gap: spacing.md,
  },
  approveButton: {
    flexDirection: "row",
    backgroundColor: colors.success[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    ...shadows.sm,
  },
  approveButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  denyButton: {
    flexDirection: "row",
    backgroundColor: colors.error[50],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  denyButtonText: {
    color: colors.error[700],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  infoText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  denyFormContainer: {
    gap: spacing.md,
  },
  denyFormLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  textInput: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: "top",
  },
  denyFormButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  cancelDenyButton: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  cancelDenyButtonText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  submitDenyButton: {
    flex: 2,
    backgroundColor: colors.error[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.sm,
  },
  submitDenyButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});

export default HomeownerAdjustmentNotification;
