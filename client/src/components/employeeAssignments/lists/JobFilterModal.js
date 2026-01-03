import React, { useState, useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Slider,
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
} from "../../../services/styles/theme";

const defaultFilters = {
  distance: { preset: "any", customValue: 25 },
  sheets: "any", // 'any' | 'needed' | 'not_needed'
  towels: "any", // 'any' | 'needed' | 'not_needed'
  bedrooms: "any", // 'any' | '1' | '2' | '3' | '4' | '5+'
  bathrooms: "any", // 'any' | '1' | '1.5' | '2' | '2.5' | '3+'
  timeWindow: "any", // 'any' | 'anytime' | '10-3' | '11-4' | '12-2'
  city: "any",
  preferredOnly: false, // Show only preferred homes
};

const distancePresets = [
  { value: "5", label: "5 mi" },
  { value: "10", label: "10 mi" },
  { value: "15", label: "15 mi" },
  { value: "25", label: "25 mi" },
  { value: "any", label: "Any" },
  { value: "custom", label: "Custom" },
];

const sheetsTowelsOptions = [
  { value: "any", label: "Any" },
  { value: "not_needed", label: "Not Needed" },
  { value: "needed", label: "Needed" },
];

const bedroomOptions = [
  { value: "any", label: "Any" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5+", label: "5+" },
];

const bathroomOptions = [
  { value: "any", label: "Any" },
  { value: "1", label: "1" },
  { value: "1.5", label: "1.5" },
  { value: "2", label: "2" },
  { value: "2.5", label: "2.5" },
  { value: "3+", label: "3+" },
];

const timeWindowOptions = [
  { value: "any", label: "Any" },
  { value: "anytime", label: "Flexible" },
  { value: "10-3", label: "10am-3pm" },
  { value: "11-4", label: "11am-4pm" },
  { value: "12-2", label: "12pm-2pm" },
];


const JobFilterModal = ({
  visible,
  onClose,
  filters,
  onApply,
  availableCities = [],
  matchCount = 0,
  hasGeolocation = true,
  hasPreferredHomes = false,
}) => {
  const [tempFilters, setTempFilters] = useState(filters || defaultFilters);

  // Reset temp filters when modal opens
  React.useEffect(() => {
    if (visible) {
      setTempFilters(filters || defaultFilters);
    }
  }, [visible, filters]);

  const handleClearAll = () => {
    setTempFilters(defaultFilters);
  };

  const handleApply = () => {
    onApply(tempFilters);
    onClose();
  };

  const updateFilter = (key, value) => {
    setTempFilters((prev) => ({ ...prev, [key]: value }));
  };

  const updateDistancePreset = (preset) => {
    setTempFilters((prev) => ({
      ...prev,
      distance: { ...prev.distance, preset },
    }));
  };

  const updateDistanceCustomValue = (value) => {
    setTempFilters((prev) => ({
      ...prev,
      distance: { ...prev.distance, customValue: value },
    }));
  };

  const ChipButton = ({ selected, label, onPress }) => (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filter Jobs</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Icon name="times" size={20} color={colors.text.secondary} />
            </Pressable>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Distance Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Distance</Text>
              {!hasGeolocation && (
                <View style={styles.warningBox}>
                  <Icon name="exclamation-circle" size={14} color={colors.warning[600]} />
                  <Text style={styles.warningText}>
                    Location unavailable. Enable location for distance filtering.
                  </Text>
                </View>
              )}
              <View style={styles.chipRow}>
                {distancePresets.map((preset) => (
                  <ChipButton
                    key={preset.value}
                    selected={tempFilters.distance.preset === preset.value}
                    label={preset.label}
                    onPress={() => updateDistancePreset(preset.value)}
                  />
                ))}
              </View>
              {tempFilters.distance.preset === "custom" && (
                <View style={styles.sliderContainer}>
                  <Slider
                    style={styles.slider}
                    minimumValue={1}
                    maximumValue={50}
                    step={1}
                    value={tempFilters.distance.customValue}
                    onValueChange={updateDistanceCustomValue}
                    minimumTrackTintColor={colors.primary[500]}
                    maximumTrackTintColor={colors.neutral[200]}
                    thumbTintColor={colors.primary[600]}
                  />
                  <Text style={styles.sliderValue}>
                    {tempFilters.distance.customValue} miles
                  </Text>
                </View>
              )}
            </View>

            {/* Preferred Homes Section */}
            {hasPreferredHomes && (
              <View style={styles.section}>
                <View style={styles.preferredRow}>
                  <View style={styles.preferredContent}>
                    <View style={styles.preferredHeader}>
                      <Icon name="star" size={14} color={colors.success[600]} />
                      <Text style={styles.preferredLabel}>Preferred Jobs Only</Text>
                    </View>
                    <Text style={styles.preferredHint}>
                      Show only homes where you have preferred status
                    </Text>
                  </View>
                  <Switch
                    value={tempFilters.preferredOnly}
                    onValueChange={(value) => updateFilter("preferredOnly", value)}
                    trackColor={{ false: colors.neutral[300], true: colors.success[400] }}
                    thumbColor={tempFilters.preferredOnly ? colors.success[600] : colors.neutral[100]}
                  />
                </View>
              </View>
            )}

            {/* Sheets & Towels Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sheets & Towels</Text>
              <View style={styles.subsection}>
                <Text style={styles.subsectionLabel}>Sheets:</Text>
                <View style={styles.chipRow}>
                  {sheetsTowelsOptions.map((option) => (
                    <ChipButton
                      key={option.value}
                      selected={tempFilters.sheets === option.value}
                      label={option.label}
                      onPress={() => updateFilter("sheets", option.value)}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.subsection}>
                <Text style={styles.subsectionLabel}>Towels:</Text>
                <View style={styles.chipRow}>
                  {sheetsTowelsOptions.map((option) => (
                    <ChipButton
                      key={option.value}
                      selected={tempFilters.towels === option.value}
                      label={option.label}
                      onPress={() => updateFilter("towels", option.value)}
                    />
                  ))}
                </View>
              </View>
            </View>

            {/* Home Size Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Home Size</Text>
              <View style={styles.subsection}>
                <Text style={styles.subsectionLabel}>Bedrooms:</Text>
                <View style={styles.chipRow}>
                  {bedroomOptions.map((option) => (
                    <ChipButton
                      key={option.value}
                      selected={tempFilters.bedrooms === option.value}
                      label={option.label}
                      onPress={() => updateFilter("bedrooms", option.value)}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.subsection}>
                <Text style={styles.subsectionLabel}>Bathrooms:</Text>
                <View style={styles.chipRow}>
                  {bathroomOptions.map((option) => (
                    <ChipButton
                      key={option.value}
                      selected={tempFilters.bathrooms === option.value}
                      label={option.label}
                      onPress={() => updateFilter("bathrooms", option.value)}
                    />
                  ))}
                </View>
              </View>
            </View>

            {/* Time Window Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Time Window</Text>
              <View style={styles.chipRow}>
                {timeWindowOptions.map((option) => (
                  <ChipButton
                    key={option.value}
                    selected={tempFilters.timeWindow === option.value}
                    label={option.label}
                    onPress={() => updateFilter("timeWindow", option.value)}
                  />
                ))}
              </View>
            </View>

            {/* City Section */}
            {availableCities.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>City</Text>
                <View style={styles.chipRow}>
                  <ChipButton
                    selected={tempFilters.city === "any"}
                    label="Any"
                    onPress={() => updateFilter("city", "any")}
                  />
                  {availableCities.map((city) => (
                    <ChipButton
                      key={city}
                      selected={tempFilters.city === city}
                      label={city}
                      onPress={() => updateFilter("city", city)}
                    />
                  ))}
                </View>
              </View>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.clearButton} onPress={handleClearAll}>
              <Text style={styles.clearButtonText}>Clear All</Text>
            </Pressable>
            <Pressable style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>
                Apply ({matchCount})
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.glass.overlay,
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    maxHeight: "85%",
    height: "75%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  sectionHint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  subsection: {
    marginBottom: spacing.md,
  },
  subsectionLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  chipSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  chipTextSelected: {
    color: colors.primary[600],
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    flex: 1,
  },
  sliderContainer: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
    marginTop: spacing.xs,
  },
  preferredRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.success[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  preferredContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  preferredHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  preferredLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  preferredHint: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.md,
  },
  clearButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  clearButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  applyButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    alignItems: "center",
  },
  applyButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  bottomSpacer: {
    height: spacing.lg,
  },
});

export { defaultFilters };
export default JobFilterModal;
