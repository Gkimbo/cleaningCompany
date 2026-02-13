import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, spacing, typography } from "../../services/styles/theme";
import { calculateNavigation, TRANSPORT_MODES } from "../../utils/distanceUtils";

const TRANSPORT_MODE_KEY = "cleaner_transport_mode";

/**
 * Shows navigation info (distance and travel time) between two job locations
 * with selectable transport mode (driving, walking, transit)
 */
const NavigationConnector = ({ fromLocation, toLocation, compact = false }) => {
  const [mode, setMode] = useState("driving");

  // Load saved transport mode preference
  useEffect(() => {
    AsyncStorage.getItem(TRANSPORT_MODE_KEY).then((savedMode) => {
      if (savedMode && TRANSPORT_MODES[savedMode]) {
        setMode(savedMode);
      }
    }).catch(() => {});
  }, []);

  // Save mode preference when changed
  const handleModeChange = (newMode) => {
    setMode(newMode);
    AsyncStorage.setItem(TRANSPORT_MODE_KEY, newMode).catch(() => {});
  };

  const nav = calculateNavigation(fromLocation, toLocation, mode);
  const currentModeInfo = TRANSPORT_MODES[mode];

  if (!nav.available) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Icon name="map-marker" size={14} color={colors.neutral[400]} />
          </View>
          <Text style={styles.unavailableText}>Location data unavailable</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.card}>
        <View style={styles.leftSection}>
          <View style={styles.iconCircle}>
            <Icon name={currentModeInfo.icon} size={14} color={colors.primary[600]} />
          </View>
          <View style={styles.routeLine} />
          <Icon name="chevron-down" size={8} color={colors.primary[400]} />
        </View>
        <View style={styles.infoSection}>
          <View style={styles.headerRow}>
            <Text style={styles.labelText}>Next stop</Text>
            <View style={styles.modeSelector}>
              {Object.values(TRANSPORT_MODES).map((modeOption) => (
                <TouchableOpacity
                  key={modeOption.id}
                  style={[
                    styles.modeButton,
                    mode === modeOption.id && styles.modeButtonActive,
                  ]}
                  onPress={() => handleModeChange(modeOption.id)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={modeOption.icon}
                    size={12}
                    color={mode === modeOption.id ? colors.primary[600] : colors.neutral[400]}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Icon name="road" size={10} color={colors.primary[500]} />
              <Text style={styles.statValue}>{nav.formattedDistance}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Icon name="clock-o" size={10} color={colors.neutral[500]} />
              <Text style={styles.statValueSecondary}>{nav.formattedTime}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  containerCompact: {
    paddingVertical: spacing.xs,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[100],
    borderStyle: "dashed",
  },
  leftSection: {
    alignItems: "center",
    marginRight: spacing.md,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[0],
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  routeLine: {
    width: 2,
    height: 6,
    backgroundColor: colors.primary[200],
    marginVertical: 2,
    borderRadius: 1,
  },
  infoSection: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  labelText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modeSelector: {
    flexDirection: "row",
    backgroundColor: colors.neutral[0],
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  modeButton: {
    width: 28,
    height: 24,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: colors.primary[100],
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statValueSecondary: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[600],
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: colors.primary[200],
    marginHorizontal: spacing.md,
  },
  unavailableText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    flex: 1,
  },
});

export default NavigationConnector;
