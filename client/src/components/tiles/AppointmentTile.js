import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import FetchData from "../../services/fetchRequests/fetchData";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";

const AppointmentTile = ({
  id,
  date,
  price,
  homeId,
  empoyeesNeeded,
  employeesAssigned,
  handleDeletePress,
  deleteConfirmation,
  handleNoPress,
}) => {
  const [home, setHome] = useState({});
  const [minCleaners, setMinCleaners] = useState(1);
  const navigate = useNavigate();
  const numberOfAssigned = Array.isArray(employeesAssigned)
    ? employeesAssigned.length
    : 0;

  const fetchHomeInfo = async () => {
    try {
      const response = await Appointment.getHomeInfo(homeId);
      if (response?.home?.[0]) {
        setHome(response.home[0]);
      }
    } catch (error) {
      console.error("Error fetching home info:", error);
    }
  };

  const fetchStaffingConfig = async () => {
    try {
      const config = await FetchData.getStaffingConfig();
      setMinCleaners(config.minCleanersForAssignment || 1);
    } catch (error) {
      console.error("Error fetching staffing config:", error);
    }
  };

  useEffect(() => {
    fetchHomeInfo();
    fetchStaffingConfig();
  }, []);

  const formatDate = (dateString) => {
    const options = { weekday: "short", month: "short", day: "numeric", year: "numeric" };
    return new Date(dateString).toLocaleDateString("en-US", options);
  };

  const formatPrice = (priceValue) => {
    return `$${Number(priceValue).toFixed(2)}`;
  };

  const handleAppointmentPress = () => {
    navigate(`/assign-cleaner/${id}`);
  };

  const getStatusInfo = () => {
    if (numberOfAssigned >= 1) {
      return { color: colors.success[500], label: "Assigned", bgColor: colors.success[100] };
    }
    return { color: colors.error[500], label: "Needs Staff", bgColor: colors.error[100] };
  };

  const status = getStatusInfo();

  return (
    <View style={styles.card}>
      <View style={[styles.statusBar, { backgroundColor: status.color }]} />
      <View style={styles.cardContent}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.dateContainer}>
            <Icon name="calendar" size={14} color={colors.primary[600]} />
            <Text style={styles.dateText}>{formatDate(date)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Home Info */}
        <View style={styles.homeInfo}>
          <Text style={styles.homeName}>{home.nickName || "Loading..."}</Text>
          {home.address && (
            <Text style={styles.homeAddress}>
              {home.address}, {home.city}, {home.state} {home.zipcode}
            </Text>
          )}
        </View>

        {/* Details Row */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Icon name="usd" size={14} color={colors.text.secondary} />
            <Text style={styles.detailText}>{formatPrice(price)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Icon name="users" size={14} color={colors.text.secondary} />
            <Text style={styles.detailText}>
              {numberOfAssigned}/{minCleaners} Cleaners
            </Text>
          </View>
          {home.numBeds && (
            <View style={styles.detailItem}>
              <Icon name="bed" size={14} color={colors.text.secondary} />
              <Text style={styles.detailText}>
                {home.numBeds} Bed / {home.numBaths} Bath
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.assignButton} onPress={handleAppointmentPress}>
            <Icon name="user-plus" size={14} color={colors.neutral[0]} />
            <Text style={styles.assignButtonText}>Manage Staff</Text>
          </TouchableOpacity>

          {!deleteConfirmation[id] ? (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeletePress(id)}
            >
              <Icon name="trash" size={14} color={colors.error[600]} />
              <Text style={styles.deleteButtonText}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={() => handleDeletePress(id)}
              >
                <Text style={styles.confirmDeleteText}>Confirm Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.keepButton}
                onPress={() => handleNoPress(id)}
              >
                <Text style={styles.keepButtonText}>Keep</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...shadows.md,
  },
  statusBar: {
    width: 6,
  },
  cardContent: {
    flex: 1,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dateText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  homeInfo: {
    marginBottom: spacing.md,
  },
  homeName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  homeAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
    marginBottom: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  actionButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  assignButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  assignButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.error[500],
  },
  deleteButtonText: {
    color: colors.error[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  confirmButtons: {
    flexDirection: "column",
    gap: spacing.sm,
  },
  confirmDeleteButton: {
    backgroundColor: colors.error[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  confirmDeleteText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  keepButton: {
    backgroundColor: colors.success[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  keepButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
});

export default AppointmentTile;
