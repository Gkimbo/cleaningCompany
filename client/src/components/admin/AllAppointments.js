import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import FetchData from "../../services/fetchRequests/fetchData";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";

const AllAppointments = ({ state }) => {
  const [allAppointments, setAllAppointments] = useState([]);
  const [homeDetails, setHomeDetails] = useState({});
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [minCleaners, setMinCleaners] = useState(1);
  const navigate = useNavigate();

  const fetchStaffingConfig = async () => {
    try {
      const config = await FetchData.getStaffingConfig();
      setMinCleaners(config.minCleanersForAssignment || 1);
    } catch (error) {
      console.error("Error fetching staffing config:", error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await FetchData.get(
        "/api/v1/users/appointments",
        state.currentUser.token
      );
      setAllAppointments(response.appointments || []);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  };

  const fetchHomeInfo = async (homeId) => {
    if (homeDetails[homeId]) return;
    try {
      const response = await Appointment.getHomeInfo(homeId);
      if (response?.home?.[0]) {
        setHomeDetails((prev) => ({ ...prev, [homeId]: response.home[0] }));
      }
    } catch (error) {
      console.error("Error fetching home info:", error);
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchStaffingConfig();
  }, []);

  useEffect(() => {
    const homeIds = [...new Set(allAppointments.map((apt) => apt.homeId))];
    homeIds.forEach((homeId) => fetchHomeInfo(homeId));
  }, [allAppointments]);

  const handleBack = () => navigate("/");

  const handleDeletePress = (appointment) => {
    setSelectedAppointment(appointment);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedAppointment) return;
    setIsDeleting(true);
    try {
      await Appointment.deleteAppointmentById(selectedAppointment.id);
      await fetchAppointments();
    } catch (error) {
      console.error("Error deleting appointment:", error);
    } finally {
      setIsDeleting(false);
      setDeleteModalVisible(false);
      setSelectedAppointment(null);
    }
  };

  const handleAssignPress = (appointmentId) => {
    navigate(`/assign-cleaner/${appointmentId}`);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPrice = (price) => {
    return `$${Number(price).toFixed(2)}`;
  };

  const getStatusInfo = (employeesAssigned) => {
    const assigned = Array.isArray(employeesAssigned) ? employeesAssigned.length : 0;

    if (assigned >= 1) {
      return { color: colors.success[500], label: "Assigned", bgColor: colors.success[100] };
    }
    return { color: colors.error[500], label: "Needs Staff", bgColor: colors.error[100] };
  };

  const sortedAppointments = [...allAppointments].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const upcomingAppointments = sortedAppointments.filter(
    (apt) => new Date(apt.date) >= new Date().setHours(0, 0, 0, 0)
  );
  const pastAppointments = sortedAppointments.filter(
    (apt) => new Date(apt.date) < new Date().setHours(0, 0, 0, 0)
  );

  const AppointmentCard = ({ appointment }) => {
    const home = homeDetails[appointment.homeId] || {};
    const assigned = Array.isArray(appointment.employeesAssigned)
      ? appointment.employeesAssigned.length
      : 0;
    const status = getStatusInfo(appointment.employeesAssigned);

    return (
      <View style={styles.appointmentCard}>
        <View style={[styles.statusBar, { backgroundColor: status.color }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.dateContainer}>
              <Icon name="calendar" size={14} color={colors.primary[600]} />
              <Text style={styles.dateText}>{formatDate(appointment.date)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          <View style={styles.homeInfo}>
            <Text style={styles.homeName}>{home.nickName || "Loading..."}</Text>
            {home.address && (
              <Text style={styles.homeAddress}>
                {home.address}, {home.city}, {home.state} {home.zipcode}
              </Text>
            )}
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Icon name="usd" size={14} color={colors.text.secondary} />
              <Text style={styles.detailText}>{formatPrice(appointment.price)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Icon name="users" size={14} color={colors.text.secondary} />
              <Text style={styles.detailText}>
                {assigned}/{minCleaners} Cleaners
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

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.assignButton}
              onPress={() => handleAssignPress(appointment.id)}
            >
              <Icon name="user-plus" size={14} color={colors.neutral[0]} />
              <Text style={styles.assignButtonText}>Manage Staff</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeletePress(appointment)}
            >
              <Icon name="trash" size={14} color={colors.error[600]} />
              <Text style={styles.deleteButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>{"<"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>All Appointments</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.subtitle}>
        View and manage all scheduled cleaning appointments
      </Text>

      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{upcomingAppointments.length}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {upcomingAppointments.filter((apt) => {
              const assigned = Array.isArray(apt.employeesAssigned)
                ? apt.employeesAssigned.length
                : 0;
              return assigned === 0;
            }).length}
          </Text>
          <Text style={styles.statLabel}>Need Staff</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{pastAppointments.length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Upcoming Appointments */}
      {upcomingAppointments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Upcoming Appointments ({upcomingAppointments.length})
          </Text>
          {upcomingAppointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))}
        </View>
      )}

      {/* Past Appointments */}
      {pastAppointments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Past Appointments ({pastAppointments.length})
          </Text>
          {pastAppointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))}
        </View>
      )}

      {/* Empty State */}
      {allAppointments.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Icon name="calendar-o" size={48} color={colors.primary[400]} />
          </View>
          <Text style={styles.emptyTitle}>No Appointments</Text>
          <Text style={styles.emptyDescription}>
            There are no scheduled appointments yet.
          </Text>
        </View>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Icon name="exclamation-triangle" size={32} color={colors.error[500]} />
            </View>
            <Text style={styles.modalTitle}>Cancel Appointment?</Text>
            <Text style={styles.modalText}>
              Are you sure you want to cancel this appointment
              {selectedAppointment && homeDetails[selectedAppointment.homeId]
                ? ` at ${homeDetails[selectedAppointment.homeId].nickName}`
                : ""}
              ? This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.keepButton}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.keepButtonText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={handleConfirmDelete}
                disabled={isDeleting}
              >
                <Text style={styles.confirmDeleteButtonText}>
                  {isDeleting ? "Cancelling..." : "Cancel Appointment"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing["4xl"],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 60,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  statsContainer: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: "center",
    ...shadows.md,
  },
  statNumber: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  appointmentCard: {
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
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["4xl"],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    padding: spacing.xl,
    margin: spacing.xl,
    ...shadows.lg,
    maxWidth: 400,
    width: "90%",
    alignItems: "center",
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.error[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  modalText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textAlign: "center",
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
  },
  keepButton: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.primary[500],
  },
  keepButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: colors.error[600],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  confirmDeleteButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
  },
});

export default AllAppointments;
