import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import { useNavigate } from "react-router-native";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import EachAppointment from "./EachAppointment";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

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
      const updatedAppointments = appointments.map((appointment) => {
        if (appointment.id === appointmentId) {
          const priceChange = value === "yes" ? 25 : -25;
          if (value === appointment.bringSheets) return appointment;
          return { ...appointment, bringSheets: value, price: Number(appointment.price) + priceChange };
        }
        return appointment;
      });

      const appointmentToUpdate = appointments.find((a) => a.id === appointmentId);
      if (value !== appointmentToUpdate.bringSheets) {
        await Appointment.updateSheetsAppointments(value, appointmentId);
        setChangeNotification({
          message: "Sheets updated. Price adjusted.",
          appointment: appointmentId,
        });
      } else setChangeNotification({ message: "", appointment: "" });

      setAppointments(updatedAppointments);
    } catch (error) {
      console.error("Error updating sheetsProvided:", error);
    }
  };

  const handleTowelToggle = async (value, appointmentId) => {
    try {
      const updatedAppointments = appointments.map((appointment) => {
        if (appointment.id === appointmentId) {
          const priceChange = value === "yes" ? 25 : -25;
          if (value === appointment.bringTowels) return appointment;
          return { ...appointment, bringTowels: value, price: Number(appointment.price) + priceChange };
        }
        return appointment;
      });

      const appointmentToUpdate = appointments.find((a) => a.id === appointmentId);
      if (value !== appointmentToUpdate.bringTowels) {
        await Appointment.updateTowelsAppointments(value, appointmentId);
        setChangeNotification({
          message: "Towels updated. Price adjusted.",
          appointment: appointmentId,
        });
      } else setChangeNotification({ message: "", appointment: "" });

      setAppointments(updatedAppointments);
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
        <View style={styles.headerContent}>
          <Text style={styles.title}>{nickName}</Text>
          <Text style={styles.address}>{address}</Text>
          <Text style={styles.address}>{`${city}, ${state} ${zipcode}`}</Text>
        </View>

        {/* Stats Badge */}
        {totalAppointments > 0 && (
          <View style={styles.statsBadge}>
            <Text style={styles.statsNumber}>{upcomingCount}</Text>
            <Text style={styles.statsLabel}>Upcoming</Text>
          </View>
        )}
      </View>

      {/* Action Button */}
      <Pressable
        onPress={handleOnPress}
        style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
      >
        <Text style={styles.actionButtonText}>Book or Cancel Cleaning</Text>
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
            <Text style={styles.emptyStateTitle}>No Appointments</Text>
            <Text style={styles.emptyStateText}>
              Tap "Book or Cancel Cleaning" to schedule your first cleaning.
            </Text>
          </View>
        ) : (
          <>
            {/* Needs Payment Section */}
            {needsPayment.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, styles.sectionDotWarning]} />
                  <Text style={styles.sectionTitle}>Payment Required</Text>
                  <View style={styles.sectionCount}>
                    <Text style={styles.sectionCountText}>{needsPayment.length}</Text>
                  </View>
                </View>
                {needsPayment.map((appointment, index) => renderAppointment(appointment, index))}
              </View>
            )}

            {/* Upcoming Section */}
            {upcoming.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, styles.sectionDotPrimary]} />
                  <Text style={styles.sectionTitle}>Upcoming</Text>
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
                  <View style={[styles.sectionDot, styles.sectionDotSuccess]} />
                  <Text style={styles.sectionTitle}>Completed</Text>
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
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  address: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  // Stats Badge
  statsBadge: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  statsNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  statsLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginTop: 2,
  },

  // Action Button
  actionButton: {
    backgroundColor: colors.secondary[500],
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
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
    textAlign: "center",
  },

  // Appointments Container
  appointmentsContainer: {
    maxHeight: 500,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
  },
  appointmentsContent: {
    paddingBottom: spacing.md,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.base,
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
    marginBottom: spacing.sm,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  sectionDotPrimary: {
    backgroundColor: colors.primary[500],
  },
  sectionDotWarning: {
    backgroundColor: colors.warning[500],
  },
  sectionDotSuccess: {
    backgroundColor: colors.success[500],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    flex: 1,
  },
  sectionCount: {
    backgroundColor: colors.neutral[100],
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  sectionCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
});

export default HomeAppointmentTile;
