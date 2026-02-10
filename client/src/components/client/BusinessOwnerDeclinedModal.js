import React, { useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { UserContext } from "../../context/UserContext";
import { API_BASE } from "../../services/config";
import { colors, spacing, radius, typography } from "../../services/styles/theme";
import { formatCurrency } from "../../services/formatters";
import { parseLocalDate } from "../../utils/dateUtils";

// Step constants
const STEP_CHOICE = "choice";
const STEP_HOME_DETAILS = "home_details";
const STEP_PRICE_CONFIRM = "price_confirm";
const STEP_SUCCESS = "success";

const BusinessOwnerDeclinedModal = ({ visible, notification, onClose, onComplete }) => {
  const { state } = useContext(UserContext);
  const [step, setStep] = useState(STEP_CHOICE);
  const [loading, setLoading] = useState(false);
  const [homeDetails, setHomeDetails] = useState({
    numBeds: "",
    numBaths: "",
    timeToBeCompleted: "",
  });
  const [marketplacePrice, setMarketplacePrice] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [homeId, setHomeId] = useState(null);
  const [missingFields, setMissingFields] = useState([]);

  const appointmentId = notification?.data?.appointmentId;
  const businessOwnerName = notification?.data?.businessOwnerName;
  const appointmentDate = notification?.data?.appointmentDate;
  const declineReason = notification?.data?.reason;

  const formattedDate = appointmentDate
    ? parseLocalDate(appointmentDate).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "your scheduled date";

  const handleCancel = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/appointments/${appointmentId}/decline-response`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${state.currentUser?.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "cancel" }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        Alert.alert(
          "Appointment Cancelled",
          "Your appointment has been cancelled.",
          [{ text: "OK", onPress: handleClose }]
        );
      } else {
        Alert.alert("Error", data.error || "Failed to cancel appointment");
      }
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      Alert.alert("Error", "Failed to cancel appointment");
    } finally {
      setLoading(false);
    }
  };

  const handleMarketplace = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/appointments/${appointmentId}/decline-response`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${state.currentUser?.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "marketplace" }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        if (data.needsHomeDetails) {
          setMissingFields(data.missingFields || []);
          setHomeId(data.homeId);
          setStep(STEP_HOME_DETAILS);
        } else if (data.confirmRequired) {
          setMarketplacePrice(data.marketplacePrice);
          setCurrentPrice(data.currentPrice);
          setHomeId(data.homeId);
          setStep(STEP_PRICE_CONFIRM);
        }
      } else {
        Alert.alert("Error", data.error || "Failed to process request");
      }
    } catch (error) {
      console.error("Error processing marketplace request:", error);
      Alert.alert("Error", "Failed to process request");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateHomeDetails = async () => {
    // Validate fields
    if (missingFields.includes("numBeds") && !homeDetails.numBeds) {
      Alert.alert("Missing Information", "Please enter the number of bedrooms");
      return;
    }
    if (missingFields.includes("numBaths") && !homeDetails.numBaths) {
      Alert.alert("Missing Information", "Please enter the number of bathrooms");
      return;
    }
    if (missingFields.includes("timeToBeCompleted") && !homeDetails.timeToBeCompleted) {
      Alert.alert("Missing Information", "Please select the cleaning time");
      return;
    }

    try {
      setLoading(true);

      // Update home details
      const updateBody = {};
      if (homeDetails.numBeds) updateBody.numBeds = homeDetails.numBeds;
      if (homeDetails.numBaths) updateBody.numBaths = homeDetails.numBaths;
      if (homeDetails.timeToBeCompleted) updateBody.timeToBeCompleted = homeDetails.timeToBeCompleted;

      const updateResponse = await fetch(`${API_BASE}/user-info/home/${homeId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${state.currentUser?.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateBody),
      });

      if (!updateResponse.ok) {
        const data = await updateResponse.json();
        Alert.alert("Error", data.error || "Failed to update home details");
        return;
      }

      // Now try marketplace request again
      const response = await fetch(
        `${API_BASE}/appointments/${appointmentId}/decline-response`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${state.currentUser?.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "marketplace" }),
        }
      );

      const data = await response.json();
      if (response.ok && data.confirmRequired) {
        setMarketplacePrice(data.marketplacePrice);
        setCurrentPrice(data.currentPrice);
        setStep(STEP_PRICE_CONFIRM);
      } else {
        Alert.alert("Error", data.error || "Failed to calculate price");
      }
    } catch (error) {
      console.error("Error updating home details:", error);
      Alert.alert("Error", "Failed to update home details");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmMarketplace = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/appointments/${appointmentId}/confirm-marketplace`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${state.currentUser?.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      if (response.ok) {
        setStep(STEP_SUCCESS);
      } else {
        Alert.alert("Error", data.error || "Failed to open to marketplace");
      }
    } catch (error) {
      console.error("Error confirming marketplace:", error);
      Alert.alert("Error", "Failed to open to marketplace");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(STEP_CHOICE);
    setHomeDetails({ numBeds: "", numBaths: "", timeToBeCompleted: "" });
    setMarketplacePrice(null);
    setCurrentPrice(null);
    setMissingFields([]);
    onClose();
    if (onComplete) onComplete();
  };

  const timeOptions = [
    { value: "2", label: "2 hours" },
    { value: "2.5", label: "2.5 hours" },
    { value: "3", label: "3 hours" },
    { value: "3.5", label: "3.5 hours" },
    { value: "4", label: "4+ hours" },
  ];

  const renderChoiceStep = () => (
    <>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Feather name="alert-circle" size={32} color={colors.warning[500]} />
        </View>
        <Text style={styles.title}>Appointment Update</Text>
        <Text style={styles.subtitle}>
          {businessOwnerName || "Your cleaning service"} is unable to clean on{" "}
          {formattedDate}.
        </Text>
        {declineReason && (
          <View style={styles.reasonContainer}>
            <Text style={styles.reasonLabel}>Reason:</Text>
            <Text style={styles.reasonText}>{declineReason}</Text>
          </View>
        )}
      </View>

      <Text style={styles.questionText}>What would you like to do?</Text>

      <View style={styles.optionsContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.optionButton,
            styles.cancelOption,
            pressed && styles.optionPressed,
          ]}
          onPress={handleCancel}
          disabled={loading}
        >
          <View style={styles.optionIconContainer}>
            <Feather name="x-circle" size={24} color={colors.error[500]} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Cancel Appointment</Text>
            <Text style={styles.optionDescription}>
              Remove this appointment from your schedule
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.optionButton,
            styles.marketplaceOption,
            pressed && styles.optionPressed,
          ]}
          onPress={handleMarketplace}
          disabled={loading}
        >
          <View style={[styles.optionIconContainer, styles.marketplaceIconContainer]}>
            <Feather name="search" size={24} color={colors.primary[500]} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Find Another Cleaner</Text>
            <Text style={styles.optionDescription}>
              Open to marketplace for other cleaners to claim
            </Text>
          </View>
        </Pressable>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      )}
    </>
  );

  const renderHomeDetailsStep = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, styles.infoIconContainer]}>
          <Feather name="home" size={32} color={colors.primary[500]} />
        </View>
        <Text style={styles.title}>Complete Home Details</Text>
        <Text style={styles.subtitle}>
          We need a few more details about your home to calculate the marketplace
          price.
        </Text>
      </View>

      <View style={styles.formContainer}>
        {missingFields.includes("numBeds") && (
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Number of Bedrooms</Text>
            <View style={styles.numberInputRow}>
              {["1", "2", "3", "4", "5+"].map((num) => (
                <Pressable
                  key={num}
                  style={[
                    styles.numberButton,
                    homeDetails.numBeds === num && styles.numberButtonSelected,
                  ]}
                  onPress={() => setHomeDetails({ ...homeDetails, numBeds: num })}
                >
                  <Text
                    style={[
                      styles.numberButtonText,
                      homeDetails.numBeds === num && styles.numberButtonTextSelected,
                    ]}
                  >
                    {num}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {missingFields.includes("numBaths") && (
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Number of Bathrooms</Text>
            <View style={styles.numberInputRow}>
              {["1", "1.5", "2", "2.5", "3+"].map((num) => (
                <Pressable
                  key={num}
                  style={[
                    styles.numberButton,
                    homeDetails.numBaths === num && styles.numberButtonSelected,
                  ]}
                  onPress={() => setHomeDetails({ ...homeDetails, numBaths: num })}
                >
                  <Text
                    style={[
                      styles.numberButtonText,
                      homeDetails.numBaths === num && styles.numberButtonTextSelected,
                    ]}
                  >
                    {num}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {missingFields.includes("timeToBeCompleted") && (
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Estimated Cleaning Time</Text>
            <View style={styles.timeOptionsContainer}>
              {timeOptions.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.timeButton,
                    homeDetails.timeToBeCompleted === option.value &&
                      styles.timeButtonSelected,
                  ]}
                  onPress={() =>
                    setHomeDetails({ ...homeDetails, timeToBeCompleted: option.value })
                  }
                >
                  <Text
                    style={[
                      styles.timeButtonText,
                      homeDetails.timeToBeCompleted === option.value &&
                        styles.timeButtonTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={styles.actionButtons}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => setStep(STEP_CHOICE)}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleUpdateHomeDetails}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.neutral[0]} />
          ) : (
            <Text style={styles.primaryButtonText}>Continue</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderPriceConfirmStep = () => (
    <>
      <View style={styles.header}>
        <View style={[styles.iconContainer, styles.priceIconContainer]}>
          <Feather name="dollar-sign" size={32} color={colors.success[500]} />
        </View>
        <Text style={styles.title}>Marketplace Price</Text>
        <Text style={styles.subtitle}>
          Here's the price for your cleaning on the marketplace.
        </Text>
      </View>

      <View style={styles.priceCard}>
        <Text style={styles.priceLabel}>Marketplace Price</Text>
        <Text style={styles.priceValue}>
          {formatCurrency(marketplacePrice * 100)}
        </Text>
        {currentPrice && currentPrice !== marketplacePrice && (
          <View style={styles.priceComparison}>
            <Text style={styles.previousPriceLabel}>Previous price: </Text>
            <Text style={styles.previousPrice}>
              {formatCurrency(currentPrice * 100)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.infoBox}>
        <Feather name="info" size={16} color={colors.primary[600]} />
        <Text style={styles.infoText}>
          Once confirmed, your appointment will be visible to other cleaners who can
          claim it.
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => setStep(STEP_CHOICE)}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleConfirmMarketplace}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.neutral[0]} />
          ) : (
            <>
              <Feather name="check" size={18} color={colors.neutral[0]} />
              <Text style={styles.primaryButtonText}>Confirm</Text>
            </>
          )}
        </Pressable>
      </View>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <View style={styles.header}>
        <View style={[styles.iconContainer, styles.successIconContainer]}>
          <Feather name="check-circle" size={32} color={colors.success[500]} />
        </View>
        <Text style={styles.title}>You're All Set!</Text>
        <Text style={styles.subtitle}>
          Your appointment is now open to the marketplace. We'll notify you when a
          cleaner claims it.
        </Text>
      </View>

      <Pressable style={styles.doneButton} onPress={handleClose}>
        <Text style={styles.doneButtonText}>Done</Text>
      </Pressable>
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Feather name="x" size={24} color={colors.neutral[500]} />
          </Pressable>

          {step === STEP_CHOICE && renderChoiceStep()}
          {step === STEP_HOME_DETAILS && renderHomeDetailsStep()}
          {step === STEP_PRICE_CONFIRM && renderPriceConfirmStep()}
          {step === STEP_SUCCESS && renderSuccessStep()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: spacing.xl + 20,
    maxHeight: "90%",
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    padding: spacing.sm,
    zIndex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.warning[100],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  infoIconContainer: {
    backgroundColor: colors.primary[100],
  },
  priceIconContainer: {
    backgroundColor: colors.success[100],
  },
  successIconContainer: {
    backgroundColor: colors.success[100],
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: "700",
    color: colors.neutral[900],
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.neutral[600],
    textAlign: "center",
    lineHeight: 22,
  },
  reasonContainer: {
    marginTop: spacing.md,
    backgroundColor: colors.neutral[100],
    padding: spacing.md,
    borderRadius: radius.md,
    width: "100%",
  },
  reasonLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
    color: colors.neutral[700],
    marginBottom: spacing.xs,
  },
  reasonText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
    fontStyle: "italic",
  },
  questionText: {
    fontSize: typography.fontSize.md,
    fontWeight: "600",
    color: colors.neutral[800],
    marginBottom: spacing.md,
    textAlign: "center",
  },
  optionsContainer: {
    gap: spacing.md,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.md,
  },
  cancelOption: {
    borderColor: colors.error[200],
    backgroundColor: colors.error[50],
  },
  marketplaceOption: {
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
  },
  optionPressed: {
    opacity: 0.8,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.error[100],
    justifyContent: "center",
    alignItems: "center",
  },
  marketplaceIconContainer: {
    backgroundColor: colors.primary[100],
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: "600",
    color: colors.neutral[900],
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 24,
  },
  formContainer: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  formField: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: "600",
    color: colors.neutral[800],
  },
  numberInputRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  numberButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  numberButtonSelected: {
    backgroundColor: colors.primary[100],
    borderColor: colors.primary[500],
  },
  numberButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: "600",
    color: colors.neutral[600],
  },
  numberButtonTextSelected: {
    color: colors.primary[700],
  },
  timeOptionsContainer: {
    gap: spacing.sm,
  },
  timeButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  timeButtonSelected: {
    backgroundColor: colors.primary[100],
    borderColor: colors.primary[500],
  },
  timeButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: "500",
    color: colors.neutral[600],
  },
  timeButtonTextSelected: {
    color: colors.primary[700],
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[500],
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primaryButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: "600",
    color: colors.neutral[0],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  priceCard: {
    backgroundColor: colors.success[50],
    padding: spacing.xl,
    borderRadius: radius.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  priceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    marginBottom: spacing.xs,
  },
  priceValue: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.success[700],
  },
  priceComparison: {
    flexDirection: "row",
    marginTop: spacing.sm,
  },
  previousPriceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
  },
  previousPrice: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    textDecorationLine: "line-through",
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },
  doneButton: {
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[500],
    alignItems: "center",
  },
  doneButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: "600",
    color: colors.neutral[0],
  },
});

export default BusinessOwnerDeclinedModal;
