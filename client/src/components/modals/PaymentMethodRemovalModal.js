import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { Checkbox } from "react-native-paper";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { API_BASE } from "../../services/config";

const PaymentMethodRemovalModal = ({
  visible,
  onClose,
  onSuccess,
  paymentMethodId,
  eligibilityData,
  token,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [acknowledgedCancellation, setAcknowledgedCancellation] = useState(false);
  const [error, setError] = useState(null);

  if (!eligibilityData) return null;

  const {
    outstandingFees,
    unpaidAppointments,
    totalToPrepay,
    totalCancellationFees,
    options,
  } = eligibilityData;

  const hasOutstandingFees = outstandingFees?.totalDue > 0;
  const appointmentsWithFees = unpaidAppointments?.filter((apt) => apt.isWithinCancellationWindow) || [];

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const handlePrepayAll = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/payments/prepay-all-and-remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paymentMethodId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to prepay appointments");
      }

      Alert.alert(
        "Success",
        `All appointments prepaid ($${data.totalPrepaid.toFixed(2)}) and card removed.`,
        [{ text: "OK", onPress: () => onSuccess && onSuccess(data) }]
      );
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelAll = async () => {
    if (!acknowledgedCancellation && totalCancellationFees > 0) {
      setError("Please acknowledge the cancellation fees first");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/payments/cancel-all-and-remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentMethodId,
          acknowledgedCancellationFees: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel appointments");
      }

      const feeMessage = data.totalFeesPaid > 0
        ? ` $${data.totalFeesPaid.toFixed(2)} in fees has been charged.`
        : "";

      Alert.alert(
        "Success",
        `${data.cancelledAppointments.length} appointment(s) cancelled and card removed.${feeMessage}`,
        [{ text: "OK", onPress: () => onSuccess && onSuccess(data) }]
      );
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon name="exclamation-triangle" size={32} color={colors.warning[600]} />
            </View>
            <Text style={styles.headerTitle}>Cannot Remove Card</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Icon name="times" size={20} color={colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Outstanding Fees Warning */}
            {hasOutstandingFees && (
              <View style={styles.warningBox}>
                <Icon name="dollar" size={18} color={colors.error[600]} />
                <View style={styles.warningContent}>
                  <Text style={styles.warningTitle}>Outstanding Fees</Text>
                  <Text style={styles.warningText}>
                    You have ${outstandingFees.totalDue.toFixed(2)} in outstanding fees that must be paid.
                  </Text>
                  {outstandingFees.cancellationFee > 0 && (
                    <Text style={styles.feeDetail}>
                      Cancellation fees: ${outstandingFees.cancellationFee.toFixed(2)}
                    </Text>
                  )}
                  {outstandingFees.appointmentDue > 0 && (
                    <Text style={styles.feeDetail}>
                      Appointment dues: ${outstandingFees.appointmentDue.toFixed(2)}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Unpaid Appointments */}
            {unpaidAppointments?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Unpaid Appointments ({unpaidAppointments.length})
                </Text>
                <Text style={styles.sectionSubtitle}>
                  You have booked appointments that haven't been paid yet.
                </Text>

                {unpaidAppointments.map((apt) => (
                  <View key={apt.id} style={styles.appointmentItem}>
                    <View style={styles.appointmentInfo}>
                      <Text style={styles.appointmentDate}>{formatDate(apt.date)}</Text>
                      <Text style={styles.appointmentPrice}>${apt.price.toFixed(2)}</Text>
                    </View>
                    {apt.isWithinCancellationWindow && (
                      <View style={styles.feeTag}>
                        <Icon name="warning" size={12} color={colors.warning[700]} />
                        <Text style={styles.feeTagText}>
                          ${apt.cancellationFee} fee if cancelled
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Options Section */}
            <View style={styles.optionsSection}>
              <Text style={styles.optionsTitle}>Choose an Option</Text>

              {/* Prepay All Option */}
              {options?.canPrepayAll && (
                <View style={styles.optionCard}>
                  <View style={styles.optionHeader}>
                    <Icon name="credit-card" size={20} color={colors.primary[600]} />
                    <Text style={styles.optionTitle}>Prepay All Appointments</Text>
                  </View>
                  <Text style={styles.optionDescription}>
                    Pay for all your booked appointments now. Total: ${totalToPrepay.toFixed(2)}
                    {hasOutstandingFees && ` + $${outstandingFees.totalDue.toFixed(2)} fees`}
                  </Text>
                  <Pressable
                    style={[styles.optionButton, styles.prepayButton, isProcessing && styles.buttonDisabled]}
                    onPress={handlePrepayAll}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={colors.neutral[0]} />
                    ) : (
                      <>
                        <Icon name="check" size={16} color={colors.neutral[0]} />
                        <Text style={styles.optionButtonText}>
                          Prepay ${(totalToPrepay + (outstandingFees?.totalDue || 0)).toFixed(2)}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}

              {/* Cancel All Option */}
              {options?.canCancelAll && (
                <View style={styles.optionCard}>
                  <View style={styles.optionHeader}>
                    <Icon name="times-circle" size={20} color={colors.error[600]} />
                    <Text style={styles.optionTitle}>Cancel All Appointments</Text>
                  </View>
                  <Text style={styles.optionDescription}>
                    Cancel all your booked appointments and remove your card.
                  </Text>

                  {totalCancellationFees > 0 && (
                    <View style={styles.cancellationWarning}>
                      <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
                      <Text style={styles.cancellationWarningText}>
                        {appointmentsWithFees.length} appointment(s) within 7 days will incur a
                        ${totalCancellationFees.toFixed(2)} cancellation fee.
                      </Text>
                    </View>
                  )}

                  {totalCancellationFees > 0 && (
                    <Pressable
                      style={styles.acknowledgeRow}
                      onPress={() => setAcknowledgedCancellation(!acknowledgedCancellation)}
                    >
                      <Checkbox
                        status={acknowledgedCancellation ? "checked" : "unchecked"}
                        onPress={() => setAcknowledgedCancellation(!acknowledgedCancellation)}
                        color={colors.error[600]}
                      />
                      <Text style={styles.acknowledgeText}>
                        I understand I will be charged ${(totalCancellationFees + (outstandingFees?.totalDue || 0)).toFixed(2)} in fees
                      </Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={[
                      styles.optionButton,
                      styles.cancelButton,
                      (isProcessing || (totalCancellationFees > 0 && !acknowledgedCancellation)) && styles.buttonDisabled,
                    ]}
                    onPress={handleCancelAll}
                    disabled={isProcessing || (totalCancellationFees > 0 && !acknowledgedCancellation)}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={colors.neutral[0]} />
                    ) : (
                      <>
                        <Icon name="trash" size={16} color={colors.neutral[0]} />
                        <Text style={styles.optionButtonText}>
                          Cancel All & Remove Card
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorBox}>
                <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.goBackButton, isProcessing && styles.buttonDisabled]}
              onPress={onClose}
              disabled={isProcessing}
            >
              <Icon name="arrow-left" size={16} color={colors.text.secondary} />
              <Text style={styles.goBackText}>Go Back</Text>
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
    backgroundColor: colors.glass.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
    overflow: "hidden",
    ...shadows.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.warning[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.warning[200],
  },
  iconContainer: {
    marginRight: spacing.md,
  },
  headerTitle: {
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
    maxHeight: 400,
  },
  warningBox: {
    flexDirection: "row",
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  warningContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  warningTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[700],
    marginBottom: spacing.xs,
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
    lineHeight: 20,
  },
  feeDetail: {
    fontSize: typography.fontSize.xs,
    color: colors.error[500],
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  appointmentItem: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  appointmentInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  appointmentDate: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  appointmentPrice: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  feeTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[100],
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  feeTagText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
  },
  optionsSection: {
    marginTop: spacing.md,
  },
  optionsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  optionCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  optionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  optionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  prepayButton: {
    backgroundColor: colors.primary[600],
  },
  cancelButton: {
    backgroundColor: colors.error[600],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  optionButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  cancellationWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.error[50],
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cancellationWarningText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.error[700],
    lineHeight: 18,
  },
  acknowledgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  acknowledgeText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  goBackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  goBackText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
});

export default PaymentMethodRemovalModal;
