import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/FontAwesome";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, typography } from "../../services/styles/theme";
import TodaysAppointment from "../employeeAssignments/tiles/TodaysAppointment";
import CompactJobCard from "./CompactJobCard";
import NavigationConnector from "./NavigationConnector";
import { calculateRouteTotal } from "../../utils/distanceUtils";
import { usePricing } from "../../context/PricingContext";

const STORAGE_KEY_PREFIX = "cleaner_job_order_";

/**
 * Today's Jobs List with drag-and-drop reordering and navigation info
 */
const TodaysJobsList = ({
  appointments,
  homeDetails,
  onJobCompleted,
  onJobUnstarted,
  token,
}) => {
  const { pricing } = usePricing();
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [orderedAppointments, setOrderedAppointments] = useState([]);
  const [jobLocations, setJobLocations] = useState({});

  // Get today's date string for storage key
  const getTodayKey = () => {
    const today = new Date();
    return `${STORAGE_KEY_PREFIX}${today.toISOString().split("T")[0]}`;
  };

  // Calculate payout for an appointment
  const calculatePayout = useCallback((appointment) => {
    const isMultiCleanerJob = appointment.isMultiCleanerJob;
    const platformFeePercent = isMultiCleanerJob
      ? (pricing?.platform?.multiCleanerPlatformFeePercent || 0.13)
      : (pricing?.platform?.feePercent || 0.1);
    const cleanerSharePercent = 1 - platformFeePercent;
    const totalPrice = Number(appointment.price);
    const numCleaners = isMultiCleanerJob
      ? (appointment.multiCleanerJob?.totalCleanersRequired || appointment.employeesAssigned?.length || 1)
      : 1;
    return (totalPrice / numCleaners) * cleanerSharePercent;
  }, [pricing]);

  // Load saved order or use default
  useEffect(() => {
    const loadOrder = async () => {
      try {
        const savedOrder = await AsyncStorage.getItem(getTodayKey());
        if (savedOrder) {
          const orderIds = JSON.parse(savedOrder);
          // Reorder appointments based on saved order
          const orderedList = [];
          const appointmentMap = new Map(appointments.map((apt) => [apt.id, apt]));

          // First add appointments in saved order
          orderIds.forEach((id) => {
            if (appointmentMap.has(id)) {
              orderedList.push(appointmentMap.get(id));
              appointmentMap.delete(id);
            }
          });

          // Then add any new appointments not in saved order
          appointmentMap.forEach((apt) => orderedList.push(apt));

          setOrderedAppointments(orderedList);
        } else {
          setOrderedAppointments(appointments);
        }
      } catch (_err) {
        setOrderedAppointments(appointments);
      }
    };

    if (appointments.length > 0) {
      loadOrder();
    }
  }, [appointments]);

  // Build locations map from homeDetails
  useEffect(() => {
    const locations = {};
    orderedAppointments.forEach((apt) => {
      const home = homeDetails[apt.homeId];
      if (home?.latitude && home?.longitude) {
        locations[apt.id] = {
          latitude: parseFloat(home.latitude),
          longitude: parseFloat(home.longitude),
        };
      }
    });
    setJobLocations(locations);
  }, [orderedAppointments, homeDetails]);

  // Save order to AsyncStorage
  const saveOrder = useCallback(async (newOrder) => {
    try {
      const orderIds = newOrder.map((apt) => apt.id);
      await AsyncStorage.setItem(getTodayKey(), JSON.stringify(orderIds));

      // Clean up old orders (keep only today and yesterday)
      const allKeys = await AsyncStorage.getAllKeys();
      const orderKeys = allKeys.filter((k) => k.startsWith(STORAGE_KEY_PREFIX));
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const todayStr = today.toISOString().split("T")[0];
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const keysToDelete = orderKeys.filter((k) => {
        const dateStr = k.replace(STORAGE_KEY_PREFIX, "");
        return dateStr !== todayStr && dateStr !== yesterdayStr;
      });

      if (keysToDelete.length > 0) {
        await AsyncStorage.multiRemove(keysToDelete);
      }
    } catch (_err) {
      // Silently fail - order persistence is not critical
    }
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(({ data }) => {
    setOrderedAppointments(data);
    saveOrder(data);

    // Haptic feedback on drop
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [saveOrder]);

  // Handle drag start
  const handleDragBegin = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // Calculate route totals
  const routeInfo = useMemo(() => {
    const locations = orderedAppointments
      .map((apt) => jobLocations[apt.id])
      .filter(Boolean);
    return calculateRouteTotal(locations);
  }, [orderedAppointments, jobLocations]);

  // Render item for DraggableFlatList
  const renderItem = useCallback(({ item, drag, isActive, getIndex }) => {
    const index = getIndex();
    const home = homeDetails[item.homeId] || {};
    const payout = calculatePayout(item);
    const fromLocation = index > 0 ? jobLocations[orderedAppointments[index - 1]?.id] : null;
    const toLocation = jobLocations[item.id];

    return (
      <ScaleDecorator>
        <View>
          {/* Navigation connector (except for first item) */}
          {index > 0 && (
            <NavigationConnector
              fromLocation={fromLocation}
              toLocation={toLocation}
              compact={isReorderMode}
            />
          )}

          {/* Job card */}
          {isReorderMode ? (
            <CompactJobCard
              appointment={item}
              home={home}
              payout={payout}
              drag={drag}
              isActive={isActive}
              index={index}
            />
          ) : (
            <TodaysAppointment
              appointment={item}
              onJobCompleted={onJobCompleted}
              onJobUnstarted={onJobUnstarted}
              token={token}
            />
          )}
        </View>
      </ScaleDecorator>
    );
  }, [homeDetails, jobLocations, orderedAppointments, isReorderMode, calculatePayout, onJobCompleted, onJobUnstarted, token]);

  // Don't show reorder if only 1 job
  const showReorderButton = orderedAppointments.length > 1;

  if (orderedAppointments.length === 0) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isReorderMode ? "Drag to reorder" : `Today's Jobs (${orderedAppointments.length})`}
        </Text>
        {showReorderButton && (
          <TouchableOpacity
            style={[styles.reorderButton, isReorderMode && styles.reorderButtonActive]}
            onPress={() => setIsReorderMode(!isReorderMode)}
            activeOpacity={0.7}
          >
            <Icon
              name={isReorderMode ? "check" : "sort"}
              size={14}
              color={isReorderMode ? colors.success[600] : colors.primary[600]}
            />
            <Text style={[styles.reorderButtonText, isReorderMode && styles.reorderButtonTextActive]}>
              {isReorderMode ? "Done" : "Reorder"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Jobs List */}
      <DraggableFlatList
        data={orderedAppointments}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        onDragEnd={handleDragEnd}
        onDragBegin={handleDragBegin}
        scrollEnabled={false}
        activationDistance={isReorderMode ? 0 : 100}
        containerStyle={styles.listContainer}
      />

      {/* Route Summary (only in reorder mode) */}
      {isReorderMode && orderedAppointments.length > 1 && routeInfo.totalDistanceMiles > 0 && (
        <View style={styles.routeSummary}>
          <Icon name="road" size={14} color={colors.neutral[500]} />
          <Text style={styles.routeSummaryText}>
            Total: {routeInfo.formattedDistance} • {routeInfo.formattedTime}
          </Text>
        </View>
      )}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  reorderButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  reorderButtonActive: {
    backgroundColor: colors.success[50],
  },
  reorderButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  reorderButtonTextActive: {
    color: colors.success[600],
  },
  listContainer: {
    paddingBottom: spacing.md,
  },
  routeSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  routeSummaryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[600],
  },
});

export default TodaysJobsList;
