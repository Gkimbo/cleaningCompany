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
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import PreferredPerksService from "../../services/fetchRequests/PreferredPerksService";

import useSafeNavigation from "../../hooks/useSafeNavigation";
const TierManagement = ({ state }) => {
  const { goBack } = useSafeNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalValues, setOriginalValues] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Form state for tier configuration
  const [formData, setFormData] = useState({
    // Bronze tier
    bronzeMinHomes: "1",
    bronzeMaxHomes: "2",
    bronzeBonusPercent: "0",
    // Silver tier
    silverMinHomes: "3",
    silverMaxHomes: "5",
    silverBonusPercent: "3",
    // Gold tier
    goldMinHomes: "6",
    goldMaxHomes: "10",
    goldBonusPercent: "5",
    goldFasterPayouts: true,
    goldPayoutHours: "24",
    // Platinum tier
    platinumMinHomes: "11",
    platinumBonusPercent: "7",
    platinumFasterPayouts: true,
    platinumPayoutHours: "24",
    platinumEarlyAccess: true,
    // Platform settings
    backupCleanerTimeoutHours: "24",
    platformMaxDailyJobs: "5",
    platformMaxConcurrentJobs: "3",
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const [configResult, historyResult] = await Promise.all([
        PreferredPerksService.getConfig(state.currentUser.token),
        PreferredPerksService.getHistory(state.currentUser.token, 10),
      ]);

      if (configResult && configResult.config) {
        const config = configResult.config;
        const values = {
          bronzeMinHomes: config.bronzeMinHomes?.toString() || "1",
          bronzeMaxHomes: config.bronzeMaxHomes?.toString() || "2",
          bronzeBonusPercent: config.bronzeBonusPercent?.toString() || "0",
          silverMinHomes: config.silverMinHomes?.toString() || "3",
          silverMaxHomes: config.silverMaxHomes?.toString() || "5",
          silverBonusPercent: config.silverBonusPercent?.toString() || "3",
          goldMinHomes: config.goldMinHomes?.toString() || "6",
          goldMaxHomes: config.goldMaxHomes?.toString() || "10",
          goldBonusPercent: config.goldBonusPercent?.toString() || "5",
          goldFasterPayouts: config.goldFasterPayouts ?? true,
          goldPayoutHours: config.goldPayoutHours?.toString() || "24",
          platinumMinHomes: config.platinumMinHomes?.toString() || "11",
          platinumBonusPercent: config.platinumBonusPercent?.toString() || "7",
          platinumFasterPayouts: config.platinumFasterPayouts ?? true,
          platinumPayoutHours: config.platinumPayoutHours?.toString() || "24",
          platinumEarlyAccess: config.platinumEarlyAccess ?? true,
          backupCleanerTimeoutHours: config.backupCleanerTimeoutHours?.toString() || "24",
          platformMaxDailyJobs: config.platformMaxDailyJobs?.toString() || "5",
          platformMaxConcurrentJobs: config.platformMaxConcurrentJobs?.toString() || "3",
        };
        setFormData(values);
        setOriginalValues(values);
      }

      if (historyResult && historyResult.history) {
        setHistory(historyResult.history);
      }
    } catch (err) {
      setError("Failed to load tier configuration");
      console.error("Error fetching tier config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    if (originalValues) {
      const changed = Object.keys(originalValues).some(
        (key) => newFormData[key] !== originalValues[key]
      );
      setHasChanges(changed);
    }
  };

  const handleSavePress = async () => {
    setError(null);
    setSuccess(null);

    // Validate tier thresholds
    const bronzeMin = parseInt(formData.bronzeMinHomes);
    const bronzeMax = parseInt(formData.bronzeMaxHomes);
    const silverMin = parseInt(formData.silverMinHomes);
    const silverMax = parseInt(formData.silverMaxHomes);
    const goldMin = parseInt(formData.goldMinHomes);
    const goldMax = parseInt(formData.goldMaxHomes);
    const platinumMin = parseInt(formData.platinumMinHomes);

    if (bronzeMin !== 1) {
      setError("Bronze tier must start at 1 home");
      return;
    }

    if (bronzeMax + 1 !== silverMin) {
      setError("Silver tier must start immediately after Bronze ends");
      return;
    }

    if (silverMax + 1 !== goldMin) {
      setError("Gold tier must start immediately after Silver ends");
      return;
    }

    if (goldMax + 1 !== platinumMin) {
      setError("Platinum tier must start immediately after Gold ends");
      return;
    }

    // Validate bonus percentages
    const bonusFields = ['bronzeBonusPercent', 'silverBonusPercent', 'goldBonusPercent', 'platinumBonusPercent'];
    for (const field of bonusFields) {
      const value = parseFloat(formData[field]);
      if (isNaN(value) || value < 0 || value > 100) {
        setError(`Invalid bonus percentage for ${field.replace('BonusPercent', '').replace(/([A-Z])/g, ' $1')}`);
        return;
      }
    }

    // Validate payout hours
    if (parseInt(formData.goldPayoutHours) < 1) {
      setError("Gold payout hours must be at least 1");
      return;
    }
    if (parseInt(formData.platinumPayoutHours) < 1) {
      setError("Platinum payout hours must be at least 1");
      return;
    }

    setSaving(true);

    try {
      const configData = {
        bronzeMinHomes: parseInt(formData.bronzeMinHomes),
        bronzeMaxHomes: parseInt(formData.bronzeMaxHomes),
        bronzeBonusPercent: parseFloat(formData.bronzeBonusPercent),
        silverMinHomes: parseInt(formData.silverMinHomes),
        silverMaxHomes: parseInt(formData.silverMaxHomes),
        silverBonusPercent: parseFloat(formData.silverBonusPercent),
        goldMinHomes: parseInt(formData.goldMinHomes),
        goldMaxHomes: parseInt(formData.goldMaxHomes),
        goldBonusPercent: parseFloat(formData.goldBonusPercent),
        goldFasterPayouts: formData.goldFasterPayouts,
        goldPayoutHours: parseInt(formData.goldPayoutHours),
        platinumMinHomes: parseInt(formData.platinumMinHomes),
        platinumBonusPercent: parseFloat(formData.platinumBonusPercent),
        platinumFasterPayouts: formData.platinumFasterPayouts,
        platinumPayoutHours: parseInt(formData.platinumPayoutHours),
        platinumEarlyAccess: formData.platinumEarlyAccess,
        backupCleanerTimeoutHours: parseInt(formData.backupCleanerTimeoutHours),
        platformMaxDailyJobs: parseInt(formData.platformMaxDailyJobs),
        platformMaxConcurrentJobs: parseInt(formData.platformMaxConcurrentJobs),
      };

      const result = await PreferredPerksService.updateConfig(
        state.currentUser.token,
        configData
      );

      if (result.success) {
        setSuccess("Tier configuration updated successfully!");
        setHasChanges(false);
        setOriginalValues({ ...formData });
        // Refresh history
        const historyResult = await PreferredPerksService.getHistory(state.currentUser.token, 10);
        if (historyResult && historyResult.history) {
          setHistory(historyResult.history);
        }
      } else {
        setError(result.error || "Failed to update tier configuration");
      }
    } catch (err) {
      setError("Failed to save tier configuration");
      console.error("Error saving tier config:", err);
    } finally {
      setSaving(false);
    }
  };

  const hasFieldChanged = (field) => {
    if (!originalValues) return false;
    return formData[field] !== originalValues[field];
  };

  const renderNumberInput = (label, field, suffix = "") => {
    const changed = hasFieldChanged(field);

    return (
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={[styles.inputWrapper, changed && styles.inputWrapperChanged]}>
          <TextInput
            style={[styles.input, suffix && styles.inputWithSuffix]}
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
      </View>
    );
  };

  const renderToggle = (label, field, description) => {
    const changed = hasFieldChanged(field);

    return (
      <View style={[styles.toggleGroup, changed && styles.toggleGroupChanged]}>
        <View style={styles.toggleContent}>
          <Text style={styles.toggleLabel}>{label}</Text>
          {description && <Text style={styles.toggleDescription}>{description}</Text>}
        </View>
        <Switch
          value={formData[field]}
          onValueChange={(value) => handleInputChange(field, value)}
          trackColor={{ false: colors.neutral[300], true: colors.primary[400] }}
          thumbColor={formData[field] ? colors.primary[600] : colors.neutral[100]}
        />
      </View>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading tier configuration...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={16} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Manage Tiers</Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="info-circle" size={20} color={colors.primary[600]} />
        <Text style={styles.infoBannerText}>
          Configure preferred cleaner tier thresholds and bonuses. Changes affect how cleaners progress through tiers.
        </Text>
      </View>

      {/* Bronze Tier */}
      <View style={styles.section}>
        <View style={[styles.tierHeader, { backgroundColor: "#FDF4E8" }]}>
          <Icon name="trophy" size={20} color="#CD7F32" />
          <Text style={[styles.tierHeaderText, { color: "#CD7F32" }]}>Bronze Tier</Text>
        </View>
        <View style={styles.tierContent}>
          <View style={styles.tierRow}>
            {renderNumberInput("Min Homes", "bronzeMinHomes", "homes")}
            {renderNumberInput("Max Homes", "bronzeMaxHomes", "homes")}
          </View>
          {renderNumberInput("Bonus Percentage", "bronzeBonusPercent", "%")}
          <Text style={styles.tierNote}>Bronze is the starting tier - no additional perks</Text>
        </View>
      </View>

      {/* Silver Tier */}
      <View style={styles.section}>
        <View style={[styles.tierHeader, { backgroundColor: "#F4F4F5" }]}>
          <Icon name="trophy" size={20} color="#71717A" />
          <Text style={[styles.tierHeaderText, { color: "#71717A" }]}>Silver Tier</Text>
        </View>
        <View style={styles.tierContent}>
          <View style={styles.tierRow}>
            {renderNumberInput("Min Homes", "silverMinHomes", "homes")}
            {renderNumberInput("Max Homes", "silverMaxHomes", "homes")}
          </View>
          {renderNumberInput("Bonus Percentage", "silverBonusPercent", "%")}
        </View>
      </View>

      {/* Gold Tier */}
      <View style={styles.section}>
        <View style={[styles.tierHeader, { backgroundColor: "#FEF9C3" }]}>
          <Icon name="star" size={20} color="#CA8A04" />
          <Text style={[styles.tierHeaderText, { color: "#CA8A04" }]}>Gold Tier</Text>
        </View>
        <View style={styles.tierContent}>
          <View style={styles.tierRow}>
            {renderNumberInput("Min Homes", "goldMinHomes", "homes")}
            {renderNumberInput("Max Homes", "goldMaxHomes", "homes")}
          </View>
          {renderNumberInput("Bonus Percentage", "goldBonusPercent", "%")}
          {renderToggle("Faster Payouts", "goldFasterPayouts", "Enable faster payout processing for Gold tier")}
          {formData.goldFasterPayouts && renderNumberInput("Payout Hours", "goldPayoutHours", "hours")}
        </View>
      </View>

      {/* Platinum Tier */}
      <View style={styles.section}>
        <View style={[styles.tierHeader, { backgroundColor: "#EEF2FF" }]}>
          <Icon name="diamond" size={20} color="#6366F1" />
          <Text style={[styles.tierHeaderText, { color: "#6366F1" }]}>Platinum Tier</Text>
        </View>
        <View style={styles.tierContent}>
          {renderNumberInput("Min Homes", "platinumMinHomes", "homes")}
          <Text style={styles.tierNote}>Platinum has no upper limit</Text>
          {renderNumberInput("Bonus Percentage", "platinumBonusPercent", "%")}
          {renderToggle("Faster Payouts", "platinumFasterPayouts", "Enable faster payout processing")}
          {formData.platinumFasterPayouts && renderNumberInput("Payout Hours", "platinumPayoutHours", "hours")}
          {renderToggle("Early Access", "platinumEarlyAccess", "Get early access to new homes on the platform")}
        </View>
      </View>

      {/* Platform Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Platform Settings</Text>
        <Text style={styles.sectionDescription}>
          Configure platform-wide limits and timeouts
        </Text>
        {renderNumberInput("Backup Cleaner Timeout", "backupCleanerTimeoutHours", "hours")}
        <Text style={styles.inputHelp}>Hours backup cleaners have to respond before escalating</Text>
        {renderNumberInput("Max Daily Jobs", "platformMaxDailyJobs", "jobs")}
        <Text style={styles.inputHelp}>Maximum jobs per cleaner per day</Text>
        {renderNumberInput("Max Concurrent Jobs", "platformMaxConcurrentJobs", "jobs")}
        <Text style={styles.inputHelp}>Maximum overlapping jobs per cleaner</Text>
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

      {/* History Section */}
      {history.length > 0 && (
        <View style={styles.historySection}>
          <Pressable
            style={styles.historyToggle}
            onPress={() => setShowHistory(!showHistory)}
          >
            <Icon name="history" size={16} color={colors.text.secondary} />
            <Text style={styles.historyToggleText}>
              {showHistory ? "Hide Change History" : "Show Change History"}
            </Text>
            <Icon
              name={showHistory ? "chevron-up" : "chevron-down"}
              size={14}
              color={colors.text.secondary}
            />
          </Pressable>

          {showHistory && (
            <View style={styles.historyList}>
              {history.map((entry) => (
                <View key={entry.id} style={styles.historyItem}>
                  <View style={styles.historyItemHeader}>
                    <Text style={styles.historyDate}>{formatDate(entry.createdAt)}</Text>
                    <Text style={styles.historyUser}>
                      {entry.changedBy ? entry.changedBy.name : "System"}
                    </Text>
                  </View>
                  <View style={styles.historyChanges}>
                    {Object.entries(entry.changes).map(([field, change]) => (
                      <Text key={field} style={styles.historyChange}>
                        {field}: {String(change.old)} → {String(change.new)}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

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
  },
  backButtonText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: "500",
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: "700",
    color: colors.text.primary,
    textAlign: "center",
    marginRight: 60,
  },
  infoBanner: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  infoBannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[800],
    lineHeight: 20,
  },
  section: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
  },
  tierHeaderText: {
    fontSize: typography.fontSize.lg,
    fontWeight: "600",
  },
  tierContent: {
    padding: spacing.md,
    paddingTop: 0,
  },
  tierRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  tierNote: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
  inputGroup: {
    flex: 1,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: "500",
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  inputWrapperChanged: {
    borderColor: colors.warning[400],
    backgroundColor: colors.warning[50],
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  inputWithSuffix: {
    paddingRight: spacing.xs,
  },
  inputSuffix: {
    paddingRight: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  inputHelp: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  changedIndicator: {
    paddingRight: spacing.sm,
  },
  toggleGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  toggleGroupChanged: {
    backgroundColor: colors.warning[50],
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  toggleContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: "500",
    color: colors.text.primary,
  },
  toggleDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  messageError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  messageErrorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
  },
  messageSuccess: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  messageSuccessText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.md,
  },
  saveButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  saveButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.neutral[0],
  },
  historySection: {
    marginTop: spacing.lg,
  },
  historyToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    gap: spacing.sm,
  },
  historyToggleText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  historyList: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  historyItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
  },
  historyItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  historyDate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  historyUser: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: "500",
  },
  historyChanges: {
    marginTop: spacing.xs,
  },
  historyChange: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontFamily: "monospace",
  },
});

export default TierManagement;
