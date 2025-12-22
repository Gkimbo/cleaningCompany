import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import EachAppointment from "./EachAppointment";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";
import { API_BASE } from "../../services/config";

const HomeAppointmentTile = ({
  id,
  nickName,
  address,
  city,
  state,
  zipcode,
  contact,
  allAppointments,
  setChangesSubmitted,
  token,
  onAppointmentCancelled,
  numBeds,
  numBaths,
}) => {
  const [appointments, setAppointments] = useState([]);
  const [changeNotification, setChangeNotification] = useState({
    message: "",
    appointment: "",
  });

  const navigate = useNavigate();

  useEffect(() => {
    setAppointments(allAppointments);
  }, [allAppointments]);

  const handleSheetsToggle = async (value, appointmentId) => {
    try {
      const appointmentToUpdate = appointments.find((a) => a.id === appointmentId);
      if (value === appointmentToUpdate.bringSheets) {
        setChangeNotification({ message: "", appointment: "" });
        return;
      }

      // Use the linens endpoint which recalculates price correctly
      const response = await fetch(`${API_BASE}/appointments/${appointmentId}/linens`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bringSheets: value,
          bringTowels: appointmentToUpdate.bringTowels,
          sheetConfigurations: appointmentToUpdate.sheetConfigurations,
          towelConfigurations: appointmentToUpdate.towelConfigurations,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const updatedAppointments = appointments.map((appointment) => {
          if (appointment.id === appointmentId) {
            return { ...appointment, ...data.appointment };
          }
          return appointment;
        });
        setAppointments(updatedAppointments);
        setChangesSubmitted(true);
        setChangeNotification({
          message: "Sheets updated. Price adjusted.",
          appointment: appointmentId,
        });
      }
    } catch (error) {
      console.error("Error updating sheetsProvided:", error);
    }
  };

  const handleTowelToggle = async (value, appointmentId) => {
    try {
      const appointmentToUpdate = appointments.find((a) => a.id === appointmentId);
      if (value === appointmentToUpdate.bringTowels) {
        setChangeNotification({ message: "", appointment: "" });
        return;
      }

      // Use the linens endpoint which recalculates price correctly
      const response = await fetch(`${API_BASE}/appointments/${appointmentId}/linens`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bringSheets: appointmentToUpdate.bringSheets,
          bringTowels: value,
          sheetConfigurations: appointmentToUpdate.sheetConfigurations,
          towelConfigurations: appointmentToUpdate.towelConfigurations,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const updatedAppointments = appointments.map((appointment) => {
          if (appointment.id === appointmentId) {
            return { ...appointment, ...data.appointment };
          }
          return appointment;
        });
        setAppointments(updatedAppointments);
        setChangesSubmitted(true);
        setChangeNotification({
          message: "Towels updated. Price adjusted.",
          appointment: appointmentId,
        });
      }
    } catch (error) {
      console.error("Error updating towelsProvided:", error);
    }
  };

  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split("-").map(Number);
    const newDate = new Date(year, month - 1, day);
    return newDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const isWithinOneWeek = (dateString) => {
    const oneWeekInMilliseconds = 7 * 24 * 60 * 60 * 1000;
    const appointmentDate = new Date(dateString).getTime();
    const currentDate = new Date().getTime();
    return appointmentDate - currentDate < oneWeekInMilliseconds;
  };

  const filteredAppointments = appointments
    .filter((appointment) => appointment.homeId === id)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Group appointments by status
  const needsPayment = filteredAppointments.filter((a) => a.completed && !a.paid);
  const upcoming = filteredAppointments.filter((a) => !a.completed);
  const completed = filteredAppointments.filter((a) => a.completed && a.paid);

  // Calculate totals
  const totalDue = needsPayment.reduce((sum, a) => sum + Number(a.price || 0), 0);
  const upcomingTotal = upcoming.reduce((sum, a) => sum + Number(a.price || 0), 0);

  const handleCancel = (appointmentId) => {
    // Remove from local state
    setAppointments(prev => prev.filter(a => a.id !== appointmentId));
    // Notify parent
    if (onAppointmentCancelled) {
      onAppointmentCancelled(appointmentId);
    }
  };

  const handleConfigurationsUpdate = (appointmentId, updatedAppointment) => {
    setAppointments(prev =>
      prev.map(a => a.id === appointmentId ? { ...a, ...updatedAppointment } : a)
    );
  };

  const renderAppointment = (appointment, index) => {
    const isDisabled = isWithinOneWeek(appointment.date);
    return (
      <EachAppointment
        key={appointment.id ?? appointment.date}
        id={appointment.id}
        index={index}
        date={appointment.date}
        price={appointment.price}
        bringSheets={appointment.bringSheets}
        bringTowels={appointment.bringTowels}
        keyPadCode={appointment.keyPadCode}
        keyLocation={appointment.keyLocation}
        isDisabled={isDisabled}
        formatDate={formatDate}
        handleTowelToggle={handleTowelToggle}
        handleSheetsToggle={handleSheetsToggle}
        setChangesSubmitted={setChangesSubmitted}
        changeNotification={changeNotification}
        setChangeNotification={setChangeNotification}
        contact={contact}
        paid={appointment.paid}
        completed={appointment.completed}
        timeToBeCompleted={appointment.timeToBeCompleted}
        cleanerName={appointment.cleanerName}
        token={token}
        onCancel={handleCancel}
        numBeds={numBeds}
        numBaths={numBaths}
        sheetConfigurations={appointment.sheetConfigurations}
        towelConfigurations={appointment.towelConfigurations}
        onConfigurationsUpdate={handleConfigurationsUpdate}
      />
    );
  };

  const handleOnPress = () => {
    navigate(`/details/${id}`);
  };

  const totalAppointments = filteredAppointments.length;
  const upcomingCount = upcoming.length;

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Icon name="home" size={20} color={colors.primary[600]} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{nickName}</Text>
          <View style={styles.addressRow}>
            <Icon name="map-marker" size={12} color={colors.text.tertiary} />
            <Text style={styles.address}>{address}</Text>
          </View>
          <Text style={styles.addressSecondary}>{`${city}, ${state} ${zipcode}`}</Text>
        </View>
      </View>

      {/* Stats Row */}
      {totalAppointments > 0 && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, upcomingCount > 0 && styles.statCardPrimary]}>
            <Icon name="calendar" size={14} color={upcomingCount > 0 ? colors.primary[600] : colors.text.tertiary} />
            <Text style={[styles.statNumber, upcomingCount > 0 && styles.statNumberPrimary]}>{upcomingCount}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
          {needsPayment.length > 0 && (
            <View style={[styles.statCard, styles.statCardWarning]}>
              <Icon name="credit-card" size={14} color={colors.warning[600]} />
              <Text style={[styles.statNumber, styles.statNumberWarning]}>${totalDue}</Text>
              <Text style={styles.statLabel}>Due</Text>
            </View>
          )}
          {upcomingTotal > 0 && (
            <View style={styles.statCard}>
              <Icon name="dollar" size={14} color={colors.text.tertiary} />
              <Text style={styles.statNumber}>${upcomingTotal}</Text>
              <Text style={styles.statLabel}>Scheduled</Text>
            </View>
          )}
        </View>
      )}

      {/* Action Button */}
      <Pressable
        onPress={handleOnPress}
        style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
      >
        <Icon name="calendar-plus-o" size={16} color={colors.neutral[0]} />
        <Text style={styles.actionButtonText}>Book or Cancel Cleaning</Text>
        <Icon name="chevron-right" size={12} color={colors.neutral[0]} />
      </Pressable>

      {/* Appointments Section */}
      <ScrollView
        style={styles.appointmentsContainer}
        contentContainerStyle={styles.appointmentsContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {totalAppointments === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="calendar-o" size={32} color={colors.primary[300]} />
            </View>
            <Text style={styles.emptyStateTitle}>No Appointments Yet</Text>
            <Text style={styles.emptyStateText}>
              Tap the button above to schedule your first cleaning for this home.
            </Text>
          </View>
        ) : (
          <>
            {/* Needs Payment Section */}
            {needsPayment.length > 0 && (
              <View style={styles.section}>
                <View style={[styles.sectionHeader, styles.sectionHeaderWarning]}>
                  <View style={styles.sectionTitleRow}>
                    <Icon name="exclamation-circle" size={14} color={colors.warning[600]} />
                    <Text style={[styles.sectionTitle, styles.sectionTitleWarning]}>Payment Required</Text>
                  </View>
                  <View style={[styles.sectionCount, styles.sectionCountWarning]}>
                    <Text style={[styles.sectionCountText, styles.sectionCountTextWarning]}>{needsPayment.length}</Text>
                  </View>
                </View>
                {needsPayment.map((appointment, index) => renderAppointment(appointment, index))}
              </View>
            )}

            {/* Upcoming Section */}
            {upcoming.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Icon name="clock-o" size={14} color={colors.primary[500]} />
                    <Text style={styles.sectionTitle}>Upcoming Cleanings</Text>
                  </View>
                  <View style={styles.sectionCount}>
                    <Text style={styles.sectionCountText}>{upcoming.length}</Text>
                  </View>
                </View>
                {upcoming.map((appointment, index) => renderAppointment(appointment, index))}
              </View>
            )}

            {/* Completed Section */}
            {completed.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Icon name="check-circle" size={14} color={colors.success[500]} />
                    <Text style={styles.sectionTitle}>Completed</Text>
                  </View>
                  <View style={styles.sectionCount}>
                    <Text style={styles.sectionCountText}>{completed.length}</Text>
                  </View>
                </View>
                {completed.map((appointment, index) => renderAppointment(appointment, index))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    marginVertical: spacing.md,
    padding: spacing.lg,
    ...shadows.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  address: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  addressSecondary: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginLeft: spacing.lg,
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.neutral[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  statCardPrimary: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  statCardWarning: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  statNumber: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statNumberPrimary: {
    color: colors.primary[600],
  },
  statNumberWarning: {
    color: colors.warning[700],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  // Action Button
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.secondary[500],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  actionButtonPressed: {
    backgroundColor: colors.secondary[600],
    transform: [{ scale: 0.98 }],
  },
  actionButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
    textAlign: "center",
  },

  // Appointments Container
  appointmentsContainer: {
    maxHeight: 600,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.md,
  },
  appointmentsContent: {
    paddingBottom: spacing.md,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
  },

  // Section
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
  },
  sectionHeaderWarning: {
    backgroundColor: colors.warning[50],
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sectionTitleWarning: {
    color: colors.warning[700],
  },
  sectionCount: {
    backgroundColor: colors.neutral[200],
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    minWidth: 24,
    alignItems: "center",
  },
  sectionCountWarning: {
    backgroundColor: colors.warning[200],
  },
  sectionCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },
  sectionCountTextWarning: {
    color: colors.warning[700],
  },
});

export default HomeAppointmentTile;
