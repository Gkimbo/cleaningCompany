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
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import * as Location from "expo-location";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import ServiceAreaService from "../../services/fetchRequests/ServiceAreaService";
import useSafeNavigation from "../../hooks/useSafeNavigation";

const ServiceAreaManagement = ({ state }) => {
  const { goBack } = useSafeNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recheckingHomes, setRecheckingHomes] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalValues, setOriginalValues] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [stats, setStats] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    enabled: true,
    mode: "list", // "list" or "radius"
    // List mode fields
    cities: "",
    states: "",
    zipcodes: "",
    // Radius mode fields
    centerAddress: "",
    centerLatitude: null,
    centerLongitude: null,
    radiusMiles: "25",
    // Common
    outsideAreaMessage: "We don't currently service this area. We're expanding soon!",
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const [configResult, historyResult] = await Promise.all([
        ServiceAreaService.getConfig(state.currentUser.token),
        ServiceAreaService.getHistory(state.currentUser.token, 10),
      ]);

      if (configResult && configResult.config) {
        const config = configResult.config;
        const values = {
          enabled: config.enabled ?? true,
          mode: config.mode || "list",
          cities: (config.cities || []).join("\n"),
          states: (config.states || []).join(", "),
          zipcodes: (config.zipcodes || []).join(", "),
          centerAddress: config.centerAddress || "",
          centerLatitude: config.centerLatitude,
          centerLongitude: config.centerLongitude,
          radiusMiles: config.radiusMiles?.toString() || "25",
          outsideAreaMessage: config.outsideAreaMessage || "We don't currently service this area. We're expanding soon!",
        };
        setFormData(values);
        setOriginalValues(values);
        setStats(configResult.stats);
      }

      if (historyResult && historyResult.history) {
        setHistory(historyResult.history);
      }
    } catch (err) {
      setError("Failed to load service area configuration");
      console.error("Error fetching service area config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    if (originalValues) {
      const changed = Object.keys(originalValues).some((key) => {
        if (key === "centerLatitude" || key === "centerLongitude") {
          return newFormData[key] !== originalValues[key];
        }
        return String(newFormData[key]) !== String(originalValues[key]);
      });
      setHasChanges(changed);
    }
  };

  const handleModeChange = (newMode) => {
    handleInputChange("mode", newMode);
  };

  const handleGetCurrentLocation = async () => {
    setGettingLocation(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Reverse geocode to get address
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const addressString = address
        ? `${address.street || ""} ${address.city || ""}, ${address.region || ""} ${address.postalCode || ""}`.trim()
        : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

      const newFormData = {
        ...formData,
        centerAddress: addressString,
        centerLatitude: latitude,
        centerLongitude: longitude,
      };
      setFormData(newFormData);
      setHasChanges(true);
    } catch (err) {
      setError("Failed to get current location");
      console.error("Error getting location:", err);
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSavePress = async () => {
    setError(null);
    setSuccess(null);

    // Validate based on mode
    if (formData.mode === "list") {
      const citiesArray = formData.cities.split(/[\n,]/).map(c => c.trim()).filter(c => c);
      const statesArray = formData.states.split(/[\n,]/).map(s => s.trim().toUpperCase()).filter(s => s);

      if (formData.enabled && citiesArray.length === 0 && statesArray.length === 0) {
        setError("Please add at least one city or state for list mode");
        return;
      }
    }

    if (formData.mode === "radius") {
      if (!formData.centerLatitude || !formData.centerLongitude) {
        setError("Please set a center location for radius mode");
        return;
      }
      const radius = parseFloat(formData.radiusMiles);
      if (isNaN(radius) || radius <= 0 || radius > 500) {
        setError("Radius must be between 0 and 500 miles");
        return;
      }
    }

    setSaving(true);

    try {
      const configData = {
        enabled: formData.enabled,
        mode: formData.mode,
        cities: formData.cities.split(/[\n,]/).map(c => c.trim()).filter(c => c),
        states: formData.states.split(/[\n,]/).map(s => s.trim().toUpperCase()).filter(s => s),
        zipcodes: formData.zipcodes.split(/[\n,]/).map(z => z.trim()).filter(z => z),
        centerAddress: formData.centerAddress,
        centerLatitude: formData.centerLatitude,
        centerLongitude: formData.centerLongitude,
        radiusMiles: parseFloat(formData.radiusMiles) || 25,
        outsideAreaMessage: formData.outsideAreaMessage,
      };

      const result = await ServiceAreaService.updateConfig(
        state.currentUser.token,
        configData
      );

      if (result.success) {
        setSuccess("Service area configuration updated successfully!");
        setHasChanges(false);
        setOriginalValues({ ...formData });
        setStats(result.stats);

        // Refresh history
        const historyResult = await ServiceAreaService.getHistory(state.currentUser.token, 10);
        if (historyResult && historyResult.history) {
          setHistory(historyResult.history);
        }
      } else {
        setError(result.error || "Failed to update service area configuration");
      }
    } catch (err) {
      setError("Failed to save service area configuration");
      console.error("Error saving service area config:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRecheckHomes = async () => {
    Alert.alert(
      "Recheck All Homes",
      "This will re-evaluate all homes against the current service area settings and notify affected homeowners. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Recheck",
          onPress: async () => {
            setRecheckingHomes(true);
            setError(null);
            setSuccess(null);

            try {
              const result = await ServiceAreaService.recheckAllHomes(state.currentUser.token);

              if (result.success) {
                setSuccess(`Checked ${result.totalHomes} homes. ${result.updated} homes had status changes.`);
                // Refresh stats
                const configResult = await ServiceAreaService.getConfig(state.currentUser.token);
                if (configResult && configResult.stats) {
                  setStats(configResult.stats);
                }
              } else {
                setError(result.error || "Failed to recheck homes");
              }
            } catch (err) {
              setError("Failed to recheck homes");
              console.error("Error rechecking homes:", err);
            } finally {
              setRecheckingHomes(false);
            }
          },
        },
      ]
    );
  };

  const hasFieldChanged = (field) => {
    if (!originalValues) return false;
    if (field === "centerLatitude" || field === "centerLongitude") {
      return formData[field] !== originalValues[field];
    }
    return String(formData[field]) !== String(originalValues[field]);
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

  const renderTextInput = (label, field, placeholder, multiline = false) => {
    const changed = hasFieldChanged(field);

    return (
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={[styles.inputWrapper, changed && styles.inputWrapperChanged]}>
          <TextInput
            style={[styles.input, multiline && styles.inputMultiline]}
            value={formData[field]}
            onChangeText={(value) => handleInputChange(field, value)}
            placeholder={placeholder}
            placeholderTextColor={colors.text.tertiary}
            multiline={multiline}
            numberOfLines={multiline ? 4 : 1}
          />
          {changed && (
            <View style={styles.changedIndicator}>
              <Icon name="pencil" size={12} color={colors.warning[600]} />
            </View>
          )}
        </View>
      </View>
    );
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading service area configuration...</Text>
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
        <Text style={styles.headerTitle}>Service Areas</Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="map-marker" size={20} color={colors.primary[600]} />
        <Text style={styles.infoBannerText}>
          Define where your business operates. Homes outside this area won't be able to book appointments.
        </Text>
      </View>

      {/* Stats Section */}
      {stats && (
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalHomes}</Text>
            <Text style={styles.statLabel}>Total Homes</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success[600] }]}>{stats.homesInArea}</Text>
            <Text style={styles.statLabel}>In Service Area</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.warning[600] }]}>{stats.homesOutsideArea}</Text>
            <Text style={styles.statLabel}>Outside Area</Text>
          </View>
        </View>
      )}

      {/* Enable/Disable Toggle */}
      <View style={styles.section}>
        {renderToggle(
          "Enable Service Area Restrictions",
          "enabled",
          "When disabled, all addresses are accepted"
        )}
      </View>

      {formData.enabled && (
        <>
          {/* Mode Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Configuration Mode</Text>
            <View style={styles.modeSelector}>
              <Pressable
                style={[
                  styles.modeButton,
                  formData.mode === "list" && styles.modeButtonActive,
                ]}
                onPress={() => handleModeChange("list")}
              >
                <Icon
                  name="list"
                  size={18}
                  color={formData.mode === "list" ? colors.neutral[0] : colors.text.secondary}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    formData.mode === "list" && styles.modeButtonTextActive,
                  ]}
                >
                  Cities & Zipcodes
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modeButton,
                  formData.mode === "radius" && styles.modeButtonActive,
                ]}
                onPress={() => handleModeChange("radius")}
              >
                <Icon
                  name="bullseye"
                  size={18}
                  color={formData.mode === "radius" ? colors.neutral[0] : colors.text.secondary}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    formData.mode === "radius" && styles.modeButtonTextActive,
                  ]}
                >
                  Radius from Location
                </Text>
              </Pressable>
            </View>
          </View>

          {/* List Mode Fields */}
          {formData.mode === "list" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Service Area List</Text>
              <Text style={styles.sectionDescription}>
                Enter cities, states, and zipcodes you service
              </Text>

              {renderTextInput("Cities", "cities", "Enter cities (one per line or comma-separated)", true)}
              <Text style={styles.inputHelp}>e.g., Boston, Cambridge, Somerville</Text>

              {renderTextInput("States", "states", "Enter state codes (comma-separated)")}
              <Text style={styles.inputHelp}>e.g., MA, NH, RI</Text>

              {renderTextInput("Zipcodes", "zipcodes", "Enter zipcodes or prefixes (comma-separated)")}
              <Text style={styles.inputHelp}>e.g., 02138, 021 (matches all 021xx)</Text>
            </View>
          )}

          {/* Radius Mode Fields */}
          {formData.mode === "radius" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Service Area Radius</Text>
              <Text style={styles.sectionDescription}>
                Define a center point and radius for your service area
              </Text>

              {renderTextInput("Center Address", "centerAddress", "Enter or use current location")}

              <Pressable
                style={styles.locationButton}
                onPress={handleGetCurrentLocation}
                disabled={gettingLocation}
              >
                {gettingLocation ? (
                  <ActivityIndicator size="small" color={colors.primary[600]} />
                ) : (
                  <>
                    <Icon name="crosshairs" size={16} color={colors.primary[600]} />
                    <Text style={styles.locationButtonText}>Use Current Location</Text>
                  </>
                )}
              </Pressable>

              {formData.centerLatitude && formData.centerLongitude && (
                <View style={styles.coordinatesDisplay}>
                  <Icon name="check-circle" size={14} color={colors.success[600]} />
                  <Text style={styles.coordinatesText}>
                    Location set: {formData.centerLatitude.toFixed(4)}, {formData.centerLongitude.toFixed(4)}
                  </Text>
                </View>
              )}

              {renderNumberInput("Service Radius", "radiusMiles", "miles")}
              <Text style={styles.inputHelp}>Maximum distance from center point (1-500 miles)</Text>
            </View>
          )}

          {/* Custom Message */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Out-of-Area Message</Text>
            {renderTextInput(
              "Message shown to customers",
              "outsideAreaMessage",
              "Message for addresses outside service area",
              true
            )}
          </View>
        </>
      )}

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

      {/* Recheck Homes Button */}
      <Pressable
        style={[styles.recheckButton, recheckingHomes && styles.recheckButtonDisabled]}
        onPress={handleRecheckHomes}
        disabled={recheckingHomes}
      >
        {recheckingHomes ? (
          <ActivityIndicator size="small" color={colors.primary[600]} />
        ) : (
          <>
            <Icon name="refresh" size={16} color={colors.primary[600]} />
            <Text style={styles.recheckButtonText}>Recheck All Homes</Text>
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
                      {entry.updatedBy ? entry.updatedBy.username : "System"}
                    </Text>
                  </View>
                  <View style={styles.historyConfig}>
                    <Text style={styles.historyConfigText}>
                      Mode: {entry.config.mode} | Enabled: {entry.config.enabled ? "Yes" : "No"}
                    </Text>
                    {entry.config.mode === "list" && (
                      <Text style={styles.historyConfigText}>
                        Cities: {(entry.config.cities || []).length} | States: {(entry.config.states || []).length}
                      </Text>
                    )}
                    {entry.config.mode === "radius" && (
                      <Text style={styles.historyConfigText}>
                        Radius: {entry.config.radiusMiles} miles
                      </Text>
                    )}
                  </View>
                  {entry.changeNote && (
                    <Text style={styles.historyNote}>Note: {entry.changeNote}</Text>
                  )}
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
  statsSection: {
    flexDirection: "row",
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    justifyContent: "space-around",
    ...shadows.sm,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: "700",
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  section: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  modeSelector: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.primary,
    backgroundColor: colors.background.secondary,
    gap: spacing.xs,
  },
  modeButtonActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  modeButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  modeButtonTextActive: {
    color: colors.neutral[0],
  },
  inputGroup: {
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
    alignItems: "flex-start",
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
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  inputWithSuffix: {
    paddingRight: spacing.xs,
  },
  inputSuffix: {
    paddingRight: spacing.md,
    paddingTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  inputHelp: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  changedIndicator: {
    paddingRight: spacing.sm,
    paddingTop: spacing.sm,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary[300],
    backgroundColor: colors.primary[50],
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  locationButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: "500",
  },
  coordinatesDisplay: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  coordinatesText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  toggleGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
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
  recheckButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[300],
    gap: spacing.sm,
  },
  recheckButtonDisabled: {
    opacity: 0.6,
  },
  recheckButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: "500",
    color: colors.primary[600],
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
  historyConfig: {
    marginTop: spacing.xs,
  },
  historyConfigText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  historyNote: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
});

export default ServiceAreaManagement;
