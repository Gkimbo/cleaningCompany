import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import PricingService from "../../services/fetchRequests/PricingService";
import PricingWarningModal from "./PricingWarningModal";
import { usePricing } from "../../context/PricingContext";

const PricingManagement = ({ state }) => {
  const navigate = useNavigate();
  const { refreshPricing } = usePricing();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalValues, setOriginalValues] = useState(null);

  // Form state for all pricing fields
  const [formData, setFormData] = useState({
    basePrice: "",
    extraBedBathFee: "",
    halfBathFee: "",
    sheetFeePerBed: "",
    towelFee: "",
    faceClothFee: "",
    timeWindowAnytime: "",
    timeWindow10To3: "",
    timeWindow11To4: "",
    timeWindow12To2: "",
    cancellationFee: "",
    cancellationWindowDays: "",
    homeownerPenaltyDays: "",
    cleanerPenaltyDays: "",
    refundPercentage: "",
    platformFeePercent: "",
    highVolumeFee: "",
    changeNote: "",
  });

  useEffect(() => {
    fetchPricingConfig();
  }, []);

  const fetchPricingConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await PricingService.getFullConfig(state.currentUser.token);

      if (result) {
        let values;
        if (result.config) {
          // Database config exists
          values = {
            basePrice: result.config.basePrice?.toString() || "",
            extraBedBathFee: result.config.extraBedBathFee?.toString() || "",
            halfBathFee: result.config.halfBathFee?.toString() || "",
            sheetFeePerBed: result.config.sheetFeePerBed?.toString() || "",
            towelFee: result.config.towelFee?.toString() || "",
            faceClothFee: result.config.faceClothFee?.toString() || "",
            timeWindowAnytime: result.config.timeWindowAnytime?.toString() || "",
            timeWindow10To3: result.config.timeWindow10To3?.toString() || "",
            timeWindow11To4: result.config.timeWindow11To4?.toString() || "",
            timeWindow12To2: result.config.timeWindow12To2?.toString() || "",
            cancellationFee: result.config.cancellationFee?.toString() || "",
            cancellationWindowDays: result.config.cancellationWindowDays?.toString() || "",
            homeownerPenaltyDays: result.config.homeownerPenaltyDays?.toString() || "",
            cleanerPenaltyDays: result.config.cleanerPenaltyDays?.toString() || "",
            refundPercentage: (parseFloat(result.config.refundPercentage) * 100).toString() || "",
            platformFeePercent: (parseFloat(result.config.platformFeePercent) * 100).toString() || "",
            highVolumeFee: result.config.highVolumeFee?.toString() || "",
            changeNote: "",
          };
        } else if (result.staticDefaults) {
          // Use static defaults
          values = {
            basePrice: result.staticDefaults.basePrice?.toString() || "",
            extraBedBathFee: result.staticDefaults.extraBedBathFee?.toString() || "",
            halfBathFee: result.staticDefaults.halfBathFee?.toString() || "",
            sheetFeePerBed: result.staticDefaults.sheetFeePerBed?.toString() || "",
            towelFee: result.staticDefaults.towelFee?.toString() || "",
            faceClothFee: result.staticDefaults.faceClothFee?.toString() || "",
            timeWindowAnytime: result.staticDefaults.timeWindowAnytime?.toString() || "",
            timeWindow10To3: result.staticDefaults.timeWindow10To3?.toString() || "",
            timeWindow11To4: result.staticDefaults.timeWindow11To4?.toString() || "",
            timeWindow12To2: result.staticDefaults.timeWindow12To2?.toString() || "",
            cancellationFee: result.staticDefaults.cancellationFee?.toString() || "",
            cancellationWindowDays: result.staticDefaults.cancellationWindowDays?.toString() || "",
            homeownerPenaltyDays: result.staticDefaults.homeownerPenaltyDays?.toString() || "",
            cleanerPenaltyDays: result.staticDefaults.cleanerPenaltyDays?.toString() || "",
            refundPercentage: (result.staticDefaults.refundPercentage * 100).toString() || "",
            platformFeePercent: (result.staticDefaults.platformFeePercent * 100).toString() || "",
            highVolumeFee: result.staticDefaults.highVolumeFee?.toString() || "",
            changeNote: "",
          };
        }

        if (values) {
          setFormData(values);
          setOriginalValues(values);
        }
      }
    } catch (err) {
      setError("Failed to load pricing configuration");
      console.error("Error fetching pricing config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Check if values have changed from original
    if (originalValues) {
      const changed = Object.keys(originalValues).some(
        (key) => key !== "changeNote" && newFormData[key] !== originalValues[key]
      );
      setHasChanges(changed);
    }
  };

  const handleSavePress = () => {
    if (!hasChanges) {
      setError("No changes to save");
      return;
    }

    // Validate inputs
    const numericFields = [
      "basePrice",
      "extraBedBathFee",
      "halfBathFee",
      "sheetFeePerBed",
      "towelFee",
      "faceClothFee",
      "timeWindowAnytime",
      "timeWindow10To3",
      "timeWindow11To4",
      "timeWindow12To2",
      "cancellationFee",
      "cancellationWindowDays",
      "homeownerPenaltyDays",
      "cleanerPenaltyDays",
      "refundPercentage",
      "platformFeePercent",
      "highVolumeFee",
    ];

    for (const field of numericFields) {
      const value = parseFloat(formData[field]);
      if (isNaN(value) || value < 0) {
        setError(`Invalid value for ${field.replace(/([A-Z])/g, " $1").toLowerCase()}`);
        return;
      }
    }

    // Validate percentages
    const refund = parseFloat(formData.refundPercentage);
    const platform = parseFloat(formData.platformFeePercent);
    if (refund < 0 || refund > 100) {
      setError("Refund percentage must be between 0 and 100");
      return;
    }
    if (platform < 0 || platform > 100) {
      setError("Platform fee percentage must be between 0 and 100");
      return;
    }

    setError(null);
    setShowWarningModal(true);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    setShowWarningModal(false);
    setError(null);
    setSuccess(null);

    try {
      const pricingData = {
        basePrice: parseInt(formData.basePrice),
        extraBedBathFee: parseInt(formData.extraBedBathFee),
        halfBathFee: parseInt(formData.halfBathFee),
        sheetFeePerBed: parseInt(formData.sheetFeePerBed),
        towelFee: parseInt(formData.towelFee),
        faceClothFee: parseInt(formData.faceClothFee),
        timeWindowAnytime: parseInt(formData.timeWindowAnytime),
        timeWindow10To3: parseInt(formData.timeWindow10To3),
        timeWindow11To4: parseInt(formData.timeWindow11To4),
        timeWindow12To2: parseInt(formData.timeWindow12To2),
        cancellationFee: parseInt(formData.cancellationFee),
        cancellationWindowDays: parseInt(formData.cancellationWindowDays),
        homeownerPenaltyDays: parseInt(formData.homeownerPenaltyDays),
        cleanerPenaltyDays: parseInt(formData.cleanerPenaltyDays),
        refundPercentage: parseFloat(formData.refundPercentage) / 100,
        platformFeePercent: parseFloat(formData.platformFeePercent) / 100,
        highVolumeFee: parseInt(formData.highVolumeFee),
        changeNote: formData.changeNote || null,
      };

      const result = await PricingService.updatePricing(
        state.currentUser.token,
        pricingData
      );

      if (result.success) {
        setSuccess("Pricing updated successfully!");
        setHasChanges(false);
        setOriginalValues({ ...formData });
        // Refresh the pricing context
        refreshPricing();
      } else {
        setError(result.error || "Failed to update pricing");
      }
    } catch (err) {
      setError("Failed to save pricing configuration");
      console.error("Error saving pricing:", err);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrentValue = (field, prefix, suffix) => {
    if (!originalValues || !originalValues[field]) return null;
    const value = originalValues[field];
    return `${prefix}${value}${suffix}`;
  };

  const hasFieldChanged = (field) => {
    if (!originalValues) return false;
    return formData[field] !== originalValues[field];
  };

  const renderPriceInput = (label, field, prefix = "$", suffix = "", helpText = null) => {
    const currentValue = formatCurrentValue(field, prefix, suffix);
    const changed = hasFieldChanged(field);

    return (
      <View style={styles.inputGroup}>
        <View style={styles.labelRow}>
          <Text style={styles.inputLabel}>{label}</Text>
          {currentValue && (
            <View style={[styles.currentValueBadge, changed && styles.currentValueBadgeChanged]}>
              <Text style={styles.currentValueLabel}>Current:</Text>
              <Text style={[styles.currentValueText, changed && styles.currentValueTextChanged]}>
                {currentValue}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.inputWrapper, changed && styles.inputWrapperChanged]}>
          {prefix && <Text style={styles.inputPrefix}>{prefix}</Text>}
          <TextInput
            style={[styles.input, prefix && styles.inputWithPrefix, suffix && styles.inputWithSuffix]}
            value={formData[field]}
            onChangeText={(value) => handleInputChange(field, value)}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.text.tertiary}
          />
          {suffix && <Text style={styles.inputSuffix}>{suffix}</Text>}
          {changed && (
            <View style={styles.changedIndicator}>
              <Icon name="pencil" size={12} color={colors.warning[600]} />
            </View>
          )}
        </View>
        {helpText && <Text style={styles.inputHelp}>{helpText}</Text>}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading pricing configuration...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigate(-1)} style={styles.backButton}>
          <Icon name="arrow-left" size={16} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Manage Pricing</Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="info-circle" size={20} color={colors.primary[600]} />
        <Text style={styles.infoBannerText}>
          Changes will apply to all new bookings. Existing appointments are not affected.
        </Text>
      </View>

      {/* Base Pricing Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Base Pricing</Text>
        <Text style={styles.sectionDescription}>
          Starting prices for cleaning services
        </Text>
        {renderPriceInput("Base Price (1 bed/1 bath)", "basePrice", "$", "", "Starting price for a standard cleaning")}
        {renderPriceInput("Extra Bed/Bath Fee", "extraBedBathFee", "$", "", "Additional charge per extra bedroom or full bathroom")}
        {renderPriceInput("Half Bath Fee", "halfBathFee", "$", "", "Additional charge per half bathroom")}
      </View>

      {/* Linen Services Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Linen Services</Text>
        <Text style={styles.sectionDescription}>
          Charges for providing linens
        </Text>
        {renderPriceInput("Sheet Fee (per bed)", "sheetFeePerBed", "$", "/bed")}
        {renderPriceInput("Towel Fee (per towel)", "towelFee", "$", "/towel")}
        {renderPriceInput("Face Cloth Fee (each)", "faceClothFee", "$", "/each")}
      </View>

      {/* Time Windows Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Time Window Surcharges</Text>
        <Text style={styles.sectionDescription}>
          Additional charges for specific arrival time windows
        </Text>
        {renderPriceInput("Anytime (flexible)", "timeWindowAnytime", "$", "", "Usually $0 for maximum flexibility")}
        {renderPriceInput("10am - 3pm Window", "timeWindow10To3", "$")}
        {renderPriceInput("11am - 4pm Window", "timeWindow11To4", "$")}
        {renderPriceInput("12pm - 2pm Window", "timeWindow12To2", "$", "", "Narrowest window, highest surcharge")}
      </View>

      {/* Cancellation Policy Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cancellation Policy</Text>
        <Text style={styles.sectionDescription}>
          Fees and timing for cancellations
        </Text>
        {renderPriceInput("Cancellation Fee", "cancellationFee", "$")}
        {renderPriceInput("Free Cancel Window", "cancellationWindowDays", "", " days", "Days before appointment for free cancellation")}
        {renderPriceInput("Homeowner Penalty Days", "homeownerPenaltyDays", "", " days", "Days before when partial refund applies")}
        {renderPriceInput("Cleaner Penalty Days", "cleanerPenaltyDays", "", " days", "Days before when cleaner gets penalty")}
        {renderPriceInput("Refund Percentage", "refundPercentage", "", "%", "Percentage refunded within penalty window")}
      </View>

      {/* Platform Fees Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Platform Fees</Text>
        <Text style={styles.sectionDescription}>
          Service fees for the platform
        </Text>
        {renderPriceInput("Platform Fee", "platformFeePercent", "", "%", "Percentage taken from cleaner payouts")}
        {renderPriceInput("High Volume Day Fee", "highVolumeFee", "$", "", "Additional fee for holidays and busy days")}
      </View>

      {/* Change Note Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Note (Optional)</Text>
        <Text style={styles.sectionDescription}>
          Document the reason for this pricing update
        </Text>
        <TextInput
          style={styles.noteInput}
          value={formData.changeNote}
          onChangeText={(value) => handleInputChange("changeNote", value)}
          placeholder="e.g., Adjusted for inflation, holiday pricing update..."
          placeholderTextColor={colors.text.tertiary}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Error/Success Messages */}
      {error && (
        <View style={styles.messageError}>
          <Icon name="exclamation-circle" size={16} color={colors.error[700]} />
          <Text style={styles.messageErrorText}>{error}</Text>
        </View>
      )}

      {success && (
        <View style={styles.messageSuccess}>
          <Icon name="check-circle" size={16} color={colors.success[700]} />
          <Text style={styles.messageSuccessText}>{success}</Text>
        </View>
      )}

      {/* Save Button */}
      <Pressable
        style={[
          styles.saveButton,
          (!hasChanges || saving) && styles.saveButtonDisabled,
        ]}
        onPress={handleSavePress}
        disabled={!hasChanges || saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color={colors.neutral[0]} />
        ) : (
          <>
            <Icon name="save" size={18} color={colors.neutral[0]} />
            <Text style={styles.saveButtonText}>
              {hasChanges ? "Save Changes" : "No Changes"}
            </Text>
          </>
        )}
      </Pressable>

      <View style={{ height: 40 }} />

      {/* Warning Modal */}
      <PricingWarningModal
        visible={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        onConfirm={handleConfirmSave}
        loading={saving}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.tertiary,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  backButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    gap: spacing.md,
  },
  infoBannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[800],
    lineHeight: 20,
  },
  section: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  currentValueBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    gap: 4,
  },
  currentValueBadgeChanged: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  currentValueLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  currentValueText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  currentValueTextChanged: {
    color: colors.warning[700],
    textDecorationLine: "line-through",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: "hidden",
  },
  inputWrapperChanged: {
    borderColor: colors.warning[400],
    backgroundColor: colors.warning[50],
  },
  changedIndicator: {
    paddingRight: spacing.md,
  },
  inputPrefix: {
    paddingLeft: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  inputSuffix: {
    paddingRight: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  input: {
    flex: 1,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  inputWithPrefix: {
    paddingLeft: spacing.sm,
  },
  inputWithSuffix: {
    paddingRight: spacing.sm,
  },
  inputHelp: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  noteInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    minHeight: 80,
    textAlignVertical: "top",
  },
  messageError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error[200],
    gap: spacing.sm,
  },
  messageErrorText: {
    flex: 1,
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },
  messageSuccess: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success[200],
    gap: spacing.sm,
  },
  messageSuccessText: {
    flex: 1,
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.lg,
  },
  saveButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  saveButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
});

export default PricingManagement;
