import React, { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate, useParams } from "react-router-native";
import { AuthContext } from "../../services/AuthContext";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import { API_BASE } from "../../services/config";
import CalendarComponent from "../calender/CalendarComponent";

const QuickBookFlow = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const { homeId } = useParams();
  const { user } = useContext(AuthContext);

  const [home, setHome] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [existingAppointments, setExistingAppointments] = useState([]);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);

  // Check if user has a payment method
  useEffect(() => {
    const checkPaymentMethod = async () => {
      const token = user?.token || state.currentUser?.token;
      if (!token) {
        setCheckingPayment(false);
        return;
      }
      try {
        const response = await fetch(`${API_BASE}/payments/payment-method-status`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (response.ok) {
          setHasPaymentMethod(data.hasPaymentMethod);
        }
      } catch (err) {
        console.error("Error checking payment method:", err);
      } finally {
        setCheckingPayment(false);
      }
    };
    checkPaymentMethod();
  }, [user?.token, state.currentUser?.token]);

  useEffect(() => {
    loadHomeData();
  }, [homeId, state.homes, state.appointments]);

  const loadHomeData = async () => {
    try {
      const homeData = state.homes.find((h) => h.id === Number(homeId));
      if (homeData) {
        setHome(homeData);
        const appts = state.appointments.filter((a) => a.homeId === Number(homeId));
        setExistingAppointments(appts);
      }
    } catch (err) {
      setError("Failed to load home details");
    } finally {
      setIsLoading(false);
    }
  };

  const onDatesSelected = async (datesOfCleaning) => {
    if (!home) return;

    setError(null);

    try {
      const infoObject = {
        dateArray: datesOfCleaning,
        homeId: home.id,
        token: user?.token || state.currentUser?.token,
        keyPadCode: home.keyPadCode,
        keyLocation: home.keyLocation,
      };

      const response = await Appointment.addAppointmentToDb(infoObject);

      if (response) {
        const stateApp = datesOfCleaning.map((app) => ({ ...app, homeId: home.id }));
        let apptTotal = 0;
        datesOfCleaning.forEach((date) => {
          apptTotal += date.price;
        });
        dispatch({ type: "ADD_BILL", payload: apptTotal });
        dispatch({ type: "ADD_DATES", payload: stateApp });
        navigate("/list-of-homes");
      } else {
        setError("Failed to book appointments. Please try again.");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    }
  };

  const onAppointmentDelete = async (date, cancellationFee) => {
    if (!home) return;
    try {
      const arrayOfAppointments = await Appointment.getHomeAppointments(home.id);
      const appointmentToDelete = arrayOfAppointments.appointments.find(
        (appointment) => appointment.date === date.dateString
      );
      if (appointmentToDelete) {
        const token = user?.token || state.currentUser?.token;
        let response;
        if (cancellationFee) {
          response = await Appointment.deleteAppointment(
            appointmentToDelete.id,
            cancellationFee,
            token
          );
          dispatch({ type: "ADD_FEE", payload: cancellationFee });
          dispatch({ type: "SUBTRACT_BILL", payload: appointmentToDelete.price });
        } else {
          response = await Appointment.deleteAppointment(
            appointmentToDelete.id,
            0,
            token
          );
          dispatch({ type: "SUBTRACT_BILL", payload: appointmentToDelete.price });
        }
        if (response.message === "Appointment Deleted") {
          const updatedAppointments = existingAppointments.filter(
            (appointment) => appointment.date !== appointmentToDelete.date
          );
          setExistingAppointments(updatedAppointments);
          dispatch({ type: "USER_APPOINTMENTS", payload: updatedAppointments });
        } else {
          console.error("Failed to delete appointment");
        }
      }
    } catch (error) {
      console.error("Error deleting appointment:", error);
    }
  };

  if (isLoading || checkingPayment) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!home) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <Icon name="home" size={32} color="#6366f1" />
          <Text style={styles.loadingText}>Home not found</Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigate("/list-of-homes")}
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Prevent booking for homes outside service area
  if (home.outsideServiceArea) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.outsideAreaCard}>
          <View style={styles.outsideAreaIconContainer}>
            <Icon name="map-marker" size={28} color="#f59e0b" />
          </View>
          <Text style={styles.outsideAreaTitle}>Outside Service Area</Text>
          <Text style={styles.outsideAreaText}>
            This home is currently outside our service area. Booking is not available at this time.
          </Text>
          <Text style={styles.outsideAreaSubtext}>
            We'll notify you when we expand to your area.
          </Text>
          <Pressable
            style={styles.outsideAreaButton}
            onPress={() => navigate("/list-of-homes")}
          >
            <Icon name="arrow-left" size={12} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.outsideAreaButtonText}>Back to My Homes</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Require payment method before booking
  if (!hasPaymentMethod) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.paymentCard}>
          <View style={styles.paymentIconContainer}>
            <Icon name="credit-card" size={28} color="#f59e0b" />
          </View>
          <Text style={styles.paymentTitle}>Payment Method Required</Text>
          <Text style={styles.paymentText}>
            Add a payment method before booking. Your card will be charged 3 days before each cleaning.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigate("/payment-setup")}
          >
            <Text style={styles.primaryButtonText}>Set Up Payment</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigate("/list-of-homes")}
          >
            <Text style={styles.secondaryButtonText}>Back to My Homes</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[
        styles.container,
        confirmationModalVisible && styles.containerDimmed,
      ]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header with Back Button */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(`/details/${homeId}`)}>
          <Icon name="chevron-left" size={12} color="#6366f1" />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      {/* Main Card */}
      <View style={styles.mainCard}>
        {/* Home Title Section */}
        <View style={styles.titleSection}>
          <View style={styles.homeIconContainer}>
            <Icon name="home" size={24} color="#fff" />
          </View>
          <View style={styles.titleContent}>
            <Text style={styles.homeNickname}>{home.nickName || "My Home"}</Text>
            <Text style={styles.homeAddress}>{home.address}</Text>
            <Text style={styles.homeCityZip}>
              {home.city}, {home.state} {home.zipcode}
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon name="bed" size={16} color="#6366f1" />
            <Text style={styles.statValue}>{home.numBeds}</Text>
            <Text style={styles.statLabel}>Beds</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Icon name="bath" size={16} color="#6366f1" />
            <Text style={styles.statValue}>{home.numBaths}</Text>
            <Text style={styles.statLabel}>Baths</Text>
          </View>
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Icon name="exclamation-circle" size={14} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Calendar Section */}
      <View style={styles.calendarSection}>
        <View style={styles.calendarHeaderRow}>
          <View style={styles.calendarHeader}>
            <Icon name="calendar-check-o" size={16} color="#10b981" />
            <Text style={styles.calendarTitle}>Book a Cleaning</Text>
          </View>
          <Pressable
            style={styles.connectCalendarButton}
            onPress={() => navigate(`/calendar-sync/${homeId}`)}
          >
            <Icon name="link" size={12} color="#6366f1" />
            <Text style={styles.connectCalendarText}>Connect Airbnb/VRBO</Text>
          </Pressable>
        </View>
        <CalendarComponent
          onDatesSelected={onDatesSelected}
          numBeds={home.numBeds}
          numBaths={home.numBaths}
          appointments={existingAppointments}
          onAppointmentDelete={onAppointmentDelete}
          confirmationModalVisible={confirmationModalVisible}
          setConfirmationModalVisible={setConfirmationModalVisible}
          sheets={home.sheetsProvided}
          towels={home.towelsProvided}
          timeToBeCompleted={home.timeToBeCompleted}
          bedConfigurations={home.bedConfigurations}
          bathroomConfigurations={home.bathroomConfigurations}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  containerDimmed: {
    backgroundColor: "#9ca3af",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748b",
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  backButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#6366f1",
  },

  // Main Card
  mainCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  titleSection: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  homeIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  titleContent: {
    flex: 1,
  },
  homeNickname: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  homeAddress: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
  },
  homeCityZip: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#e2e8f0",
  },

  // Error Container
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    flex: 1,
    fontWeight: "500",
  },

  // Calendar Section
  calendarSection: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  calendarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginLeft: 8,
  },
  connectCalendarButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eef2ff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  connectCalendarText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6366f1",
  },

  // Outside Area Card
  outsideAreaCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fcd34d",
    maxWidth: 360,
    width: "100%",
  },
  outsideAreaIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fef3c7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  outsideAreaTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#92400e",
    marginBottom: 8,
  },
  outsideAreaText: {
    fontSize: 14,
    color: "#a16207",
    textAlign: "center",
    lineHeight: 22,
  },
  outsideAreaSubtext: {
    fontSize: 13,
    color: "#ca8a04",
    textAlign: "center",
    marginTop: 8,
    fontWeight: "500",
  },
  outsideAreaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f59e0b",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 20,
  },
  outsideAreaButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },

  // Payment Card
  paymentCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fcd34d",
    maxWidth: 360,
    width: "100%",
  },
  paymentIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fef3c7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#92400e",
    marginBottom: 8,
  },
  paymentText: {
    fontSize: 14,
    color: "#a16207",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },

  // Buttons
  primaryButton: {
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: "#92400e",
    fontSize: 14,
    fontWeight: "500",
  },
});

export default QuickBookFlow;
