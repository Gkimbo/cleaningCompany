import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import IncentivesService from "../../services/fetchRequests/IncentivesService";

const IncentivesManagement = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalValues, setOriginalValues] = useState(null);

  // Form state for all incentive fields
  const [formData, setFormData] = useState({
    cleanerIncentiveEnabled: false,
    cleanerFeeReductionPercent: "100",
    cleanerEligibilityDays: "30",
    cleanerMaxCleanings: "5",
    homeownerIncentiveEnabled: false,
    homeownerDiscountPercent: "10",
    homeownerMaxCleanings: "4",
    changeNote: "",
  });

  useEffect(() => {
    fetchIncentiveConfig();
  }, []);

  const fetchIncentiveConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await IncentivesService.getFullConfig(state.currentUser.token);

      if (result) {
        let values;
        if (result.config) {
          // Database config exists
          values = {
            cleanerIncentiveEnabled: result.config.cleanerIncentiveEnabled,
            cleanerFeeReductionPercent: (result.config.cleanerFeeReductionPercent * 100).toString(),
            cleanerEligibilityDays: result.config.cleanerEligibilityDays.toString(),
            cleanerMaxCleanings: result.config.cleanerMaxCleanings.toString(),
            homeownerIncentiveEnabled: result.config.homeownerIncentiveEnabled,
            homeownerDiscountPercent: (result.config.homeownerDiscountPercent * 100).toString(),
            homeownerMaxCleanings: result.config.homeownerMaxCleanings.toString(),
            changeNote: "",
          };
        } else {
          // Use defaults from formatted config
          values = {
            cleanerIncentiveEnabled: result.formattedConfig.cleaner.enabled,
            cleanerFeeReductionPercent: (result.formattedConfig.cleaner.feeReductionPercent * 100).toString(),
            cleanerEligibilityDays: result.formattedConfig.cleaner.eligibilityDays.toString(),
            cleanerMaxCleanings: result.formattedConfig.cleaner.maxCleanings.toString(),
            homeownerIncentiveEnabled: result.formattedConfig.homeowner.enabled,
            homeownerDiscountPercent: (result.formattedConfig.homeowner.discountPercent * 100).toString(),
            homeownerMaxCleanings: result.formattedConfig.homeowner.maxCleanings.toString(),
            changeNote: "",
          };
        }

        if (values) {
          setFormData(values);
          setOriginalValues(values);
        }
      }
    } catch (err) {
      setError("Failed to load incentive configuration");
      console.error("Error fetching incentive config:", err);
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

  const handleToggleChange = (field, value) => {
    handleInputChange(field, value);
  };

  const handleSave = async () => {
    if (!hasChanges) {
      setError("No changes to save");
      return;
    }

    // Validate inputs
    const feeReduction = parseFloat(formData.cleanerFeeReductionPercent);
    const eligibilityDays = parseInt(formData.cleanerEligibilityDays);
    const cleanerMax = parseInt(formData.cleanerMaxCleanings);
    const discount = parseFloat(formData.homeownerDiscountPercent);
    const homeownerMax = parseInt(formData.homeownerMaxCleanings);

    if (isNaN(feeReduction) || feeReduction < 0 || feeReduction > 100) {
      setError("Fee reduction must be between 0 and 100%");
      return;
    }
    if (isNaN(eligibilityDays) || eligibilityDays < 1 || eligibilityDays > 365) {
      setError("Eligibility days must be between 1 and 365");
      return;
    }
    if (isNaN(cleanerMax) || cleanerMax < 1 || cleanerMax > 100) {
      setError("Max cleanings must be between 1 and 100");
      return;
    }
    if (isNaN(discount) || discount < 0 || discount > 100) {
      setError("Discount must be between 0 and 100%");
      return;
    }
    if (isNaN(homeownerMax) || homeownerMax < 1 || homeownerMax > 100) {
      setError("Max cleanings must be between 1 and 100");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const incentiveData = {
        cleanerIncentiveEnabled: formData.cleanerIncentiveEnabled,
        cleanerFeeReductionPercent: feeReduction / 100,
        cleanerEligibilityDays: eligibilityDays,
        cleanerMaxCleanings: cleanerMax,
        homeownerIncentiveEnabled: formData.homeownerIncentiveEnabled,
        homeownerDiscountPercent: discount / 100,
        homeownerMaxCleanings: homeownerMax,
        changeNote: formData.changeNote || null,
      };

      const result = await IncentivesService.updateIncentives(
        state.currentUser.token,
        incentiveData
      );

      if (result.success) {
        setSuccess("Incentives updated successfully!");
        setHasChanges(false);
        setOriginalValues({ ...formData });
      } else {
        setError(result.error || "Failed to update incentives");
      }
    } catch (err) {
      setError("Failed to save incentive configuration");
      console.error("Error saving incentives:", err);
    } finally {
      setSaving(false);
    }
  };

  const renderNumberInput = (label, field, suffix = "", helpText = null) => {
    return (
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, suffix && styles.inputWithSuffix]}
            value={formData[field]}
            onChangeText={(value) => handleInputChange(field, value)}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.text.tertiary}
          />
          {suffix && <Text style={styles.inputSuffix}>{suffix}</Text>}
        </View>
        {helpText && <Text style={styles.inputHelp}>{helpText}</Text>}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading incentive settings...</Text>
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
        <Text style={styles.headerTitle}>Manage Incentives</Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="gift" size={20} color={colors.success[600]} />
        <Text style={styles.infoBannerText}>
          Incentives help attract new cleaners and homeowners. When enabled, promotional banners will appear on landing pages.
        </Text>
      </View>

      {/* Cleaner Incentive Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Icon name="users" size={20} color={colors.primary[600]} />
            <Text style={styles.sectionTitle}>New Cleaner Incentive</Text>
          </View>
          <Switch
            value={formData.cleanerIncentiveEnabled}
            onValueChange={(value) => handleToggleChange("cleanerIncentiveEnabled", value)}
            trackColor={{ false: colors.neutral[300], true: colors.success[400] }}
            thumbColor={formData.cleanerIncentiveEnabled ? colors.success[600] : colors.neutral[100]}
          />
        </View>

        <Text style={styles.sectionDescription}>
          Reduce or eliminate platform fees for newly signed up cleaners to encourage them to complete their first jobs.
        </Text>

        {formData.cleanerIncentiveEnabled && (
          <View style={styles.incentiveDetails}>
            <View style={styles.previewBanner}>
              <Icon name="bullhorn" size={14} color={colors.success[700]} />
              <Text style={styles.previewBannerText}>
                New cleaners get {formData.cleanerFeeReductionPercent}% reduced platform fees for first {formData.cleanerMaxCleanings} cleanings!
              </Text>
            </View>

            {renderNumberInput(
              "Fee Reduction",
              "cleanerFeeReductionPercent",
              "%",
              "100% means 0% platform fees for qualifying cleanings"
            )}
            {renderNumberInput(
              "Eligibility Window",
              "cleanerEligibilityDays",
              " days",
              "Cleaners must have signed up within this many days"
            )}
            {renderNumberInput(
              "Max Qualifying Cleanings",
              "cleanerMaxCleanings",
              " cleanings",
              "Number of cleanings that get the reduced fee"
            )}
          </View>
        )}
      </View>

      {/* Homeowner Incentive Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Icon name="home" size={20} color={colors.secondary[600]} />
            <Text style={styles.sectionTitle}>New Homeowner Incentive</Text>
          </View>
          <Switch
            value={formData.homeownerIncentiveEnabled}
            onValueChange={(value) => handleToggleChange("homeownerIncentiveEnabled", value)}
            trackColor={{ false: colors.neutral[300], true: colors.success[400] }}
            thumbColor={formData.homeownerIncentiveEnabled ? colors.success[600] : colors.neutral[100]}
          />
        </View>

        <Text style={styles.sectionDescription}>
          Offer discounts to new homeowners on their first cleanings to encourage them to try the service.
        </Text>

        {formData.homeownerIncentiveEnabled && (
          <View style={styles.incentiveDetails}>
            <View style={[styles.previewBanner, styles.previewBannerHomeowner]}>
              <Icon name="tag" size={14} color={colors.secondary[700]} />
              <Text style={[styles.previewBannerText, styles.previewBannerTextHomeowner]}>
                First {formData.homeownerMaxCleanings} cleanings get {formData.homeownerDiscountPercent}% off!
              </Text>
            </View>

            {renderNumberInput(
              "Discount Percentage",
              "homeownerDiscountPercent",
              "%",
              "Percentage off the total cleaning price"
            )}
            {renderNumberInput(
              "Max Qualifying Cleanings",
              "homeownerMaxCleanings",
              " cleanings",
              "Number of cleanings that get the discount"
            )}
          </View>
        )}
      </View>

      {/* Change Note Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Note (Optional)</Text>
        <Text style={styles.sectionDescription}>
          Document the reason for this incentive update
        </Text>
        <TextInput
          style={styles.noteInput}
          value={formData.changeNote}
          onChangeText={(value) => handleInputChange("changeNote", value)}
          placeholder="e.g., Launching summer promotion..."
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
        onPress={handleSave}
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
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
    gap: spacing.md,
  },
  infoBannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.success[800],
    lineHeight: 20,
  },
  section: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  incentiveDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  previewBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
    gap: spacing.sm,
  },
  previewBannerHomeowner: {
    backgroundColor: colors.secondary[50],
    borderColor: colors.secondary[200],
  },
  previewBannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[700],
  },
  previewBannerTextHomeowner: {
    color: colors.secondary[700],
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
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
  input: {
    flex: 1,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  inputWithSuffix: {
    paddingRight: spacing.sm,
  },
  inputSuffix: {
    paddingRight: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
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

export default IncentivesManagement;
