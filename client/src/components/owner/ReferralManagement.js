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
import ReferralService from "../../services/fetchRequests/ReferralService";

const ReferralManagement = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalConfig, setOriginalConfig] = useState(null);

  // Form state for all referral program settings
  const [formData, setFormData] = useState({
    // Client -> Client
    clientToClientEnabled: false,
    clientToClientReferrerReward: "2500",
    clientToClientReferredReward: "2500",
    clientToClientCleaningsRequired: "1",
    clientToClientMaxPerMonth: "",

    // Client -> Cleaner
    clientToCleanerEnabled: false,
    clientToCleanerReferrerReward: "5000",
    clientToCleanerCleaningsRequired: "3",
    clientToCleanerMaxPerMonth: "",

    // Cleaner -> Cleaner
    cleanerToCleanerEnabled: false,
    cleanerToCleanerReferrerReward: "5000",
    cleanerToCleanerCleaningsRequired: "1",
    cleanerToCleanerMaxPerMonth: "",

    // Cleaner -> Client
    cleanerToClientEnabled: false,
    cleanerToClientDiscountPercent: "10",
    cleanerToClientMinReferrals: "3",
    cleanerToClientMaxPerMonth: "",

    // Change note
    changeNote: "",
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await ReferralService.getFullConfig(state.currentUser.token);

      if (result && result.formattedConfig) {
        const config = result.formattedConfig;
        const values = {
          clientToClientEnabled: config.clientToClient?.enabled || false,
          clientToClientReferrerReward: (config.clientToClient?.referrerReward || 2500).toString(),
          clientToClientReferredReward: (config.clientToClient?.referredReward || 2500).toString(),
          clientToClientCleaningsRequired: (config.clientToClient?.cleaningsRequired || 1).toString(),
          clientToClientMaxPerMonth: config.clientToClient?.maxPerMonth?.toString() || "",

          clientToCleanerEnabled: config.clientToCleaner?.enabled || false,
          clientToCleanerReferrerReward: (config.clientToCleaner?.referrerReward || 5000).toString(),
          clientToCleanerCleaningsRequired: (config.clientToCleaner?.cleaningsRequired || 3).toString(),
          clientToCleanerMaxPerMonth: config.clientToCleaner?.maxPerMonth?.toString() || "",

          cleanerToCleanerEnabled: config.cleanerToCleaner?.enabled || false,
          cleanerToCleanerReferrerReward: (config.cleanerToCleaner?.referrerReward || 5000).toString(),
          cleanerToCleanerCleaningsRequired: (config.cleanerToCleaner?.cleaningsRequired || 1).toString(),
          cleanerToCleanerMaxPerMonth: config.cleanerToCleaner?.maxPerMonth?.toString() || "",

          cleanerToClientEnabled: config.cleanerToClient?.enabled || false,
          cleanerToClientDiscountPercent: (config.cleanerToClient?.discountPercent || 10).toString(),
          cleanerToClientMinReferrals: (config.cleanerToClient?.minReferrals || 3).toString(),
          cleanerToClientMaxPerMonth: config.cleanerToClient?.maxPerMonth?.toString() || "",

          changeNote: "",
        };
        setFormData(values);
        setOriginalConfig(values);
      }
    } catch (err) {
      setError("Failed to load referral configuration");
      console.error("Error fetching referral config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    checkForChanges(newFormData);
  };

  const handleToggle = (field) => {
    const newFormData = { ...formData, [field]: !formData[field] };
    setFormData(newFormData);
    checkForChanges(newFormData);
  };

  const checkForChanges = (newFormData) => {
    if (!originalConfig) return;
    const changed = Object.keys(originalConfig).some(
      (key) => key !== "changeNote" && newFormData[key] !== originalConfig[key]
    );
    setHasChanges(changed);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Build the config object
      const configData = {
        clientToClient: {
          enabled: formData.clientToClientEnabled,
          referrerReward: parseInt(formData.clientToClientReferrerReward) || 0,
          referredReward: parseInt(formData.clientToClientReferredReward) || 0,
          cleaningsRequired: parseInt(formData.clientToClientCleaningsRequired) || 1,
          rewardType: "credit",
          maxPerMonth: formData.clientToClientMaxPerMonth ? parseInt(formData.clientToClientMaxPerMonth) : null,
        },
        clientToCleaner: {
          enabled: formData.clientToCleanerEnabled,
          referrerReward: parseInt(formData.clientToCleanerReferrerReward) || 0,
          cleaningsRequired: parseInt(formData.clientToCleanerCleaningsRequired) || 1,
          rewardType: "credit",
          maxPerMonth: formData.clientToCleanerMaxPerMonth ? parseInt(formData.clientToCleanerMaxPerMonth) : null,
        },
        cleanerToCleaner: {
          enabled: formData.cleanerToCleanerEnabled,
          referrerReward: parseInt(formData.cleanerToCleanerReferrerReward) || 0,
          cleaningsRequired: parseInt(formData.cleanerToCleanerCleaningsRequired) || 1,
          rewardType: "bonus",
          maxPerMonth: formData.cleanerToCleanerMaxPerMonth ? parseInt(formData.cleanerToCleanerMaxPerMonth) : null,
        },
        cleanerToClient: {
          enabled: formData.cleanerToClientEnabled,
          discountPercent: parseFloat(formData.cleanerToClientDiscountPercent) || 10,
          minReferrals: parseInt(formData.cleanerToClientMinReferrals) || 3,
          rewardType: "discount_percent",
          maxPerMonth: formData.cleanerToClientMaxPerMonth ? parseInt(formData.cleanerToClientMaxPerMonth) : null,
        },
        changeNote: formData.changeNote || null,
      };

      const result = await ReferralService.updateConfig(state.currentUser.token, configData);

      if (result.success) {
        setSuccess("Referral programs updated successfully!");
        setHasChanges(false);
        setOriginalConfig({ ...formData });
      } else {
        setError(result.error || "Failed to update referral programs");
      }
    } catch (err) {
      setError("Failed to save referral configuration");
      console.error("Error saving referral config:", err);
    } finally {
      setSaving(false);
    }
  };

  const formatCentsAsDollars = (cents) => {
    return (parseInt(cents) / 100).toFixed(2);
  };

  const renderProgramSection = (title, description, icon, enabled, enabledField, children) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIcon, enabled && styles.sectionIconEnabled]}>
            <Icon name={icon} size={16} color={enabled ? colors.primary[600] : colors.text.tertiary} />
          </View>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionDescription}>{description}</Text>
          </View>
        </View>
        <Switch
          value={enabled}
          onValueChange={() => handleToggle(enabledField)}
          trackColor={{ false: colors.neutral[300], true: colors.primary[400] }}
          thumbColor={enabled ? colors.primary[600] : colors.neutral[100]}
        />
      </View>
      {enabled && (
        <View style={styles.sectionContent}>
          {children}
        </View>
      )}
    </View>
  );

  const renderInput = (label, field, prefix = "", suffix = "", placeholder = "0", helpText = null) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        {prefix && <Text style={styles.inputPrefix}>{prefix}</Text>}
        <TextInput
          style={[styles.input, prefix && styles.inputWithPrefix, suffix && styles.inputWithSuffix]}
          value={formData[field]}
          onChangeText={(value) => handleInputChange(field, value)}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
        />
        {suffix && <Text style={styles.inputSuffix}>{suffix}</Text>}
      </View>
      {helpText && <Text style={styles.inputHelp}>{helpText}</Text>}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading referral programs...</Text>
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
        <Text style={styles.headerTitle}>Referral Programs</Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="gift" size={20} color={colors.primary[600]} />
        <Text style={styles.infoBannerText}>
          Configure referral rewards for clients and cleaners. Rewards are applied as account credits.
        </Text>
      </View>

      {/* Client -> Client Program */}
      {renderProgramSection(
        "Client Referrals",
        '"Give $X, Get $X" - Clients refer other clients',
        "users",
        formData.clientToClientEnabled,
        "clientToClientEnabled",
        <>
          <View style={styles.previewBanner}>
            <Text style={styles.previewText}>
              Give ${formatCentsAsDollars(formData.clientToClientReferredReward)}, Get ${formatCentsAsDollars(formData.clientToClientReferrerReward)}
            </Text>
          </View>
          {renderInput("Referrer Reward (cents)", "clientToClientReferrerReward", "", " cents", "2500", `$${formatCentsAsDollars(formData.clientToClientReferrerReward)} credit for the person who refers`)}
          {renderInput("Referred Reward (cents)", "clientToClientReferredReward", "", " cents", "2500", `$${formatCentsAsDollars(formData.clientToClientReferredReward)} credit for the new user`)}
          {renderInput("Cleanings Required", "clientToClientCleaningsRequired", "", " cleanings", "1", "How many cleanings before rewards trigger")}
          {renderInput("Max Per Month", "clientToClientMaxPerMonth", "", "/month", "", "Leave empty for unlimited")}
        </>
      )}

      {/* Client -> Cleaner Program */}
      {renderProgramSection(
        "Client Refers Cleaner",
        "Reward clients who refer new cleaners",
        "user-plus",
        formData.clientToCleanerEnabled,
        "clientToCleanerEnabled",
        <>
          <View style={styles.previewBanner}>
            <Text style={styles.previewText}>
              Earn ${formatCentsAsDollars(formData.clientToCleanerReferrerReward)} when your cleaner referral completes {formData.clientToCleanerCleaningsRequired} cleaning(s)
            </Text>
          </View>
          {renderInput("Referrer Reward (cents)", "clientToCleanerReferrerReward", "", " cents", "5000", `$${formatCentsAsDollars(formData.clientToCleanerReferrerReward)} credit after cleaner qualifies`)}
          {renderInput("Cleanings Required", "clientToCleanerCleaningsRequired", "", " cleanings", "3", "Cleanings the referred cleaner must complete")}
          {renderInput("Max Per Month", "clientToCleanerMaxPerMonth", "", "/month", "", "Leave empty for unlimited")}
        </>
      )}

      {/* Cleaner -> Cleaner Program */}
      {renderProgramSection(
        "Cleaner Referrals",
        "Bonus for cleaners who refer other cleaners",
        "handshake-o",
        formData.cleanerToCleanerEnabled,
        "cleanerToCleanerEnabled",
        <>
          <View style={styles.previewBanner}>
            <Text style={styles.previewText}>
              Earn ${formatCentsAsDollars(formData.cleanerToCleanerReferrerReward)} bonus when your referral completes {formData.cleanerToCleanerCleaningsRequired} cleaning(s)
            </Text>
          </View>
          {renderInput("Referrer Bonus (cents)", "cleanerToCleanerReferrerReward", "", " cents", "5000", `$${formatCentsAsDollars(formData.cleanerToCleanerReferrerReward)} bonus added to next payout`)}
          {renderInput("Cleanings Required", "cleanerToCleanerCleaningsRequired", "", " cleanings", "1", "Cleanings the referred cleaner must complete")}
          {renderInput("Max Per Month", "cleanerToCleanerMaxPerMonth", "", "/month", "", "Leave empty for unlimited")}
        </>
      )}

      {/* Cleaner -> Client Program */}
      {renderProgramSection(
        "Cleaner Brings Clients",
        "Reward cleaners who bring in new clients",
        "percent",
        formData.cleanerToClientEnabled,
        "cleanerToClientEnabled",
        <>
          <View style={styles.previewBanner}>
            <Text style={styles.previewText}>
              Refer {formData.cleanerToClientMinReferrals} clients for a {formData.cleanerToClientDiscountPercent}% fee reduction
            </Text>
          </View>
          {renderInput("Discount Percent", "cleanerToClientDiscountPercent", "", "%", "10", "Fee reduction percentage for the cleaner")}
          {renderInput("Min Referrals Required", "cleanerToClientMinReferrals", "", " referrals", "3", "Bulk threshold for discount to apply")}
          {renderInput("Max Per Month", "cleanerToClientMaxPerMonth", "", "/month", "", "Leave empty for unlimited")}
        </>
      )}

      {/* Change Note Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Note (Optional)</Text>
        <Text style={styles.sectionDescription}>
          Document the reason for this update
        </Text>
        <TextInput
          style={styles.noteInput}
          value={formData.changeNote}
          onChangeText={(value) => handleInputChange("changeNote", value)}
          placeholder="e.g., Holiday promotion, new referral incentive..."
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
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color={colors.neutral[0]} />
        ) : (
          <>
            <Icon name="save" size={18} color={colors.neutral[0]} />
            <Text style={styles.saveButtonText}>Save Changes</Text>
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  sectionIconEnabled: {
    backgroundColor: colors.primary[100],
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  sectionContent: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  previewBanner: {
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  previewText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
    textAlign: "center",
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
    marginTop: spacing.md,
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

export default ReferralManagement;
