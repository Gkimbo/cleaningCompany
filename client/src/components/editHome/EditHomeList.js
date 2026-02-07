import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from "react-native";
import { useNavigate } from "react-router-native";
import FetchData from "../../services/fetchRequests/fetchData";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";
import { usePricing } from "../../context/PricingContext";

const EditHomeList = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const { pricing } = usePricing();
  const cancellationFeePerAppt = pricing?.cancellation?.fee ?? 25;
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedHomeId, setSelectedHomeId] = useState(null);
  const [deleteFee, setDeleteFee] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddHome = () => {
    navigate("/add-home");
  };

  const handleBack = () => {
    navigate("/list-of-homes");
  };

  const handleEdit = (id) => {
    navigate(`/edit-home/${id}`);
  };

  const checkAppointmentsWithinWeek = async (homeId) => {
    const appointments = await Appointment.getHomeAppointments(homeId);
    const currentDate = new Date();
    let fee = 0;

    if (appointments?.appointments) {
      appointments.appointments.forEach((appt) => {
        const date = new Date(appt.date);
        if (date.getTime() - currentDate.getTime() <= 7 * 24 * 60 * 60 * 1000 &&
            date.getTime() - currentDate.getTime() >= 0) {
          fee += cancellationFeePerAppt;
        }
      });
    }

    setDeleteFee(fee);
    return fee;
  };

  const handleDeletePress = async (homeId) => {
    setSelectedHomeId(homeId);
    await checkAppointmentsWithinWeek(homeId);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedHomeId) return;

    setIsDeleting(true);
    setDeleteModalVisible(false);

    try {
      const appointments = await Appointment.getHomeAppointments(selectedHomeId);
      const deleteHome = await FetchData.deleteHome(selectedHomeId);

      if (deleteHome) {
        let priceOfAppointments = 0;
        if (appointments?.appointments) {
          appointments.appointments.forEach((appt) => {
            priceOfAppointments += Number(appt.price);
          });

          dispatch({ type: "SUBTRACT_BILL", payload: priceOfAppointments });

          const filteredAppointments = state.appointments.filter(
            (appointment) => !appointments.appointments.some((a) => a.id === appointment.id)
          );
          dispatch({ type: "USER_APPOINTMENTS", payload: filteredAppointments });
        }

        dispatch({ type: "DELETE_HOME", payload: selectedHomeId });
      }
    } catch (error) {
      console.error("Error deleting home:", error);
    } finally {
      setIsDeleting(false);
      setSelectedHomeId(null);
    }
  };

  const HomeTile = ({ home }) => (
    <View style={styles.homeTile}>
      <View style={styles.homeInfo}>
        <Text style={styles.homeName}>{home.nickName || "Unnamed Home"}</Text>
        <Text style={styles.homeAddress}>{home.address}</Text>
        <Text style={styles.homeDetails}>
          {home.city}, {home.state} {home.zipcode}
        </Text>
        <Text style={styles.homeRooms}>
          {home.numBeds} bed, {home.numBaths} bath
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEdit(home.id)}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeletePress(home.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>{"<"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Manage Homes</Text>
        <View style={styles.headerSpacer} />
      </View>

      {state.homes.length > 0 ? (
        <>
          <Text style={styles.subtitle}>
            Edit your home details or remove homes from your account
          </Text>

          <View style={styles.homesList}>
            {state.homes.map((home) => (
              <HomeTile key={home.id} home={home} />
            ))}
          </View>

          <TouchableOpacity style={styles.addButton} onPress={handleAddHome}>
            <Text style={styles.addButtonText}>+ Add Another Home</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>🏠</Text>
          </View>
          <Text style={styles.emptyTitle}>No Homes Yet</Text>
          <Text style={styles.emptyDescription}>
            Add your first home to start booking professional cleaning services.
          </Text>
          <TouchableOpacity style={styles.addFirstButton} onPress={handleAddHome}>
            <Text style={styles.addFirstButtonText}>Add Your First Home</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Home?</Text>
            <Text style={styles.modalText}>
              {deleteFee > 0
                ? `This will cancel all appointments. A $${deleteFee} cancellation fee will be charged for appointments within the next 7 days.`
                : "This will permanently delete this home and all associated data."}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.keepButton}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.keepButtonText}>Keep Home</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={handleConfirmDelete}
                disabled={isDeleting}
              >
                <Text style={styles.confirmDeleteButtonText}>
                  {isDeleting ? "Deleting..." : "Delete"}
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
  homesList: {
    marginBottom: spacing.lg,
  },
  homeTile: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  homeInfo: {
    marginBottom: spacing.lg,
  },
  homeName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  homeAddress: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  homeDetails: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  homeRooms: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.sm,
  },
  actionButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  editButton: {
    flex: 1,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  editButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.error[500],
  },
  deleteButtonText: {
    color: colors.error[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  addButton: {
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.primary[500],
    borderStyle: "dashed",
  },
  addButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
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
  emptyIconText: {
    fontSize: 48,
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
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    lineHeight: 24,
  },
  addFirstButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["3xl"],
    borderRadius: radius.lg,
    ...shadows.md,
  },
  addFirstButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
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

export default EditHomeList;
