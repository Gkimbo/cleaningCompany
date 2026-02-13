import React, { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, Alert, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate, useParams } from "react-router-native";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import CleanerApprovalService from "../../services/fetchRequests/CleanerApprovalService";
import CalendarComponent from "../calender/CalendarComponent";
import { API_BASE } from "../../services/config";
import { usePricing } from "../../context/PricingContext";

const { width } = Dimensions.get("window");

const DetailsComponent = ({ state, dispatch }) => {
  const { id } = useParams();
  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
  const [homeDetails, setHomeDetails] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [redirect, setRedirect] = useState(false);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loadingApprovals, setLoadingApprovals] = useState(true);
  const [processingApprovalId, setProcessingApprovalId] = useState(null);
  const navigate = useNavigate();

  // Get pricing from database
  const { pricing } = usePricing();

  // Check if user has a payment method
  useEffect(() => {
    const checkPaymentMethod = async () => {
      if (!state.currentUser?.token) {
        setCheckingPayment(false);
        return;
      }
      try {
        const response = await fetch(`${API_BASE}/payments/payment-method-status`, {
          headers: {
            Authorization: `Bearer ${state.currentUser.token}`,
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
  }, [state.currentUser?.token]);

  // Fetch pending cleaner approval requests for this home
  const fetchPendingApprovals = useCallback(async () => {
    if (!state.currentUser?.token || !id) {
      setLoadingApprovals(false);
      return;
    }
    try {
      const result = await CleanerApprovalService.getPendingRequests(state.currentUser.token);
      // Filter to only show requests for this home
      const homeId = Number(id);
      const filtered = (result.requests || []).filter((r) => r.homeId === homeId);
      setPendingApprovals(filtered);
    } catch (err) {
      console.error("Error fetching pending approvals:", err);
    } finally {
      setLoadingApprovals(false);
    }
  }, [state.currentUser?.token, id]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  const handleApproveRequest = async (requestId, cleanerName) => {
    Alert.alert(
      "Approve Cleaner",
      `Are you sure you want to approve ${cleanerName} to join your cleaning job?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            setProcessingApprovalId(requestId);
            try {
              const result = await CleanerApprovalService.approveRequest(
                state.currentUser.token,
                requestId
              );
              if (result.success) {
                setPendingApprovals((prev) => prev.filter((r) => r.id !== requestId));
                Alert.alert("Success", "Cleaner has been approved and assigned.");
              } else {
                Alert.alert("Error", result.error || "Failed to approve request");
              }
            } catch (error) {
              Alert.alert("Error", "Failed to approve request");
            } finally {
              setProcessingApprovalId(null);
            }
          },
        },
      ]
    );
  };

  const handleDeclineRequest = async (requestId, cleanerName) => {
    Alert.alert(
      "Decline Cleaner",
      `Are you sure you want to decline ${cleanerName}'s request?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setProcessingApprovalId(requestId);
            try {
              const result = await CleanerApprovalService.declineRequest(
                state.currentUser.token,
                requestId
              );
              if (result.success) {
                setPendingApprovals((prev) => prev.filter((r) => r.id !== requestId));
                Alert.alert("Done", "Request has been declined.");
              } else {
                Alert.alert("Error", result.error || "Failed to decline request");
              }
            } catch (error) {
              Alert.alert("Error", "Failed to decline request");
            } finally {
              setProcessingApprovalId(null);
            }
          },
        },
      ]
    );
  };

  const formatApprovalDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTimeRemaining = (expiresAt) => {
    if (!expiresAt) return "";
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      return `${days}d left`;
    }
    if (diffHours > 0) return `${diffHours}h ${diffMins}m left`;
    if (diffMins > 0) return `${diffMins}m left`;
    return "Expiring soon";
  };

  const onAppointmentDelete = async (date, cancellationFee) => {
    if (!homeDetails) return;
    try {
      const homeId = homeDetails.id;
      const arrayOfAppointments = await Appointment.getHomeAppointments(homeId);
      const appointmentToDelete = arrayOfAppointments.appointments.find(
        (appointment) => appointment.date === date.dateString
      );
      if (appointmentToDelete) {
        let response;
        if (cancellationFee) {
          response = await Appointment.deleteAppointment(
            appointmentToDelete.id,
            cancellationFee,
            state.currentUser.token
          );
          dispatch({ type: "ADD_FEE", payload: cancellationFee });
          dispatch({ type: "SUBTRACT_BILL", payload: appointmentToDelete.price });
        } else {
          response = await Appointment.deleteAppointment(
            appointmentToDelete.id,
            0,
            state.currentUser.token
          );
          dispatch({ type: "SUBTRACT_BILL", payload: appointmentToDelete.price });
        }
        if (response.message === "Appointment Deleted") {
          const updatedAppointments = appointments.filter(
            (appointment) => appointment.date !== appointmentToDelete.date
          );
          setAppointments(updatedAppointments);
          dispatch({ type: "USER_APPOINTMENTS", payload: updatedAppointments });
        } else {
          console.error("Failed to delete appointment");
        }
      }
    } catch (error) {
      console.error("Error deleting appointment:", error);
    }
  };

  const onDatesSelected = async (datesOfCleaning) => {
    if (!homeDetails) return;
    const infoObject = {
      dateArray: datesOfCleaning,
      homeId: homeDetails.id,
      token: state.currentUser.token,
      keyPadCode: homeDetails.keyPadCode,
      keyLocation: homeDetails.keyLocation,
    };
    const response = await Appointment.addAppointmentToDb(infoObject);
    if (response.success) {
      const stateApp = datesOfCleaning.map((app) => ({ ...app, homeId: homeDetails.id }));
      let apptTotal = 0;
      datesOfCleaning.forEach((date) => {
        apptTotal += date.price;
      });
      dispatch({ type: "ADD_BILL", payload: apptTotal });
      dispatch({ type: "ADD_DATES", payload: stateApp });
      navigate("/list-of-homes");
    } else {
      console.error("Failed to save appointment:", response.error);
      alert(response.error || "Failed to save appointment. Please try again.");
    }
  };

  const handlePress = () => {
    setRedirect(true);
  };

  useEffect(() => {
    const idNeeded = Number(id);
    const foundHome = state.homes.find((home) => home.id === idNeeded) || null;
    setHomeDetails(foundHome);

    const filteredAppointments = state.appointments.filter(
      (appointment) => appointment.homeId === idNeeded
    );
    setAppointments(filteredAppointments);

    if (redirect) {
      navigate("/list-of-homes");
      setRedirect(false);
    }
  }, [id, redirect, state.appointments, state.homes]);

  const getTimeWindowText = (time) => {
    const { timeWindows } = pricing;
    const windowConfig = timeWindows[time];

    if (!windowConfig) {
      return { text: "Not set", surcharge: null };
    }

    const surcharge = windowConfig.surcharge > 0 ? `+$${windowConfig.surcharge}` : null;
    return { text: windowConfig.label, surcharge };
  };

  const DetailRow = ({ icon, label, value, valueStyle, surcharge }) => (
    <View style={styles.detailRow}>
      <View style={styles.detailIconContainer}>
        <Icon name={icon} size={14} color="#6366f1" />
      </View>
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <View style={styles.detailValueRow}>
          <Text style={[styles.detailValue, valueStyle]}>{value}</Text>
          {surcharge && (
            <View style={styles.surchargeTag}>
              <Text style={styles.surchargeText}>{surcharge}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  if (!homeDetails) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <Icon name="home" size={32} color="#6366f1" />
          <Text style={styles.loadingText}>Loading home details...</Text>
        </View>
      </View>
    );
  }

  const timeWindow = getTimeWindowText(homeDetails.timeToBeCompleted);

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
        <Pressable style={styles.backButton} onPress={handlePress}>
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
            <Text style={styles.homeNickname}>{homeDetails.nickName || "My Home"}</Text>
            <Text style={styles.homeAddress}>{homeDetails.address}</Text>
            <Text style={styles.homeCityZip}>
              {homeDetails.city}, {homeDetails.state} {homeDetails.zipcode}
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon name="bed" size={16} color="#6366f1" />
            <Text style={styles.statValue}>{homeDetails.numBeds}</Text>
            <Text style={styles.statLabel}>Beds</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Icon name="bath" size={16} color="#6366f1" />
            <Text style={styles.statValue}>{homeDetails.numBaths}</Text>
            <Text style={styles.statLabel}>Baths</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Icon name="clock-o" size={16} color="#6366f1" />
            <Text style={styles.statValue}>{timeWindow.text}</Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
        </View>
      </View>

      {/* Services Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Icon name="star" size={14} color="#f59e0b" />
          <Text style={styles.sectionTitle}>Services</Text>
        </View>

        <View style={styles.serviceGrid}>
          <View style={[styles.serviceItem, homeDetails.sheetsProvided === "yes" && styles.serviceItemActive]}>
            <Icon
              name="bed"
              size={18}
              color={homeDetails.sheetsProvided === "yes" ? "#10b981" : "#94a3b8"}
            />
            <Text style={[styles.serviceLabel, homeDetails.sheetsProvided === "yes" && styles.serviceLabelActive]}>
              Fresh Sheets
            </Text>
            <Text style={styles.servicePrice}>
              {homeDetails.sheetsProvided === "yes" ? "Included" : `$${pricing.linens.sheetFeePerBed}/bed`}
            </Text>
          </View>

          <View style={[styles.serviceItem, homeDetails.towelsProvided === "yes" && styles.serviceItemActive]}>
            <Icon
              name="bath"
              size={18}
              color={homeDetails.towelsProvided === "yes" ? "#10b981" : "#94a3b8"}
            />
            <Text style={[styles.serviceLabel, homeDetails.towelsProvided === "yes" && styles.serviceLabelActive]}>
              Fresh Towels
            </Text>
            <Text style={styles.servicePrice}>
              {homeDetails.towelsProvided === "yes" ? "Included" : `$${pricing.linens.towelFee}/towel`}
            </Text>
          </View>
        </View>

        {timeWindow.surcharge && (
          <View style={styles.timeWindowNote}>
            <Icon name="info-circle" size={12} color="#6366f1" />
            <Text style={styles.timeWindowNoteText}>
              Time window surcharge: {timeWindow.surcharge} per cleaning
            </Text>
          </View>
        )}
      </View>

      {/* Access Info Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Icon name="key" size={14} color="#6366f1" />
          <Text style={styles.sectionTitle}>Access Information</Text>
        </View>

        {homeDetails.keyPadCode && (
          <DetailRow
            icon="lock"
            label="Keypad Code"
            value={homeDetails.keyPadCode}
            valueStyle={styles.codeText}
          />
        )}

        {homeDetails.keyLocation && (
          <DetailRow
            icon="map-marker"
            label="Key Location"
            value={homeDetails.keyLocation}
          />
        )}

        <DetailRow
          icon="trash"
          label="Trash Location"
          value={homeDetails.trashLocation}
        />

        {homeDetails.recyclingLocation && (
          <DetailRow
            icon="recycle"
            label="Recycling"
            value={homeDetails.recyclingLocation}
          />
        )}

        {homeDetails.compostLocation && (
          <DetailRow
            icon="leaf"
            label="Compost"
            value={homeDetails.compostLocation}
          />
        )}
      </View>

      {/* Calendar Sync Button */}
      <Pressable
        style={styles.calendarSyncButton}
        onPress={() => navigate(`/calendar-sync/${homeDetails.id}`)}
      >
        <View style={styles.calendarSyncIcon}>
          <Icon name="calendar" size={18} color="#6366f1" />
        </View>
        <View style={styles.calendarSyncContent}>
          <Text style={styles.calendarSyncTitle}>Connect Calendar</Text>
          <Text style={styles.calendarSyncSubtitle}>Sync with Airbnb or VRBO</Text>
        </View>
        <Icon name="chevron-right" size={14} color="#94a3b8" />
      </Pressable>

      {/* Edit Home Button */}
      <Pressable
        style={styles.editButton}
        onPress={() => navigate(`/edit-home/${homeDetails.id}`)}
      >
        <Icon name="pencil" size={14} color="#6366f1" />
        <Text style={styles.editButtonText}>Edit Home Details</Text>
      </Pressable>

      {/* Payment Method Required Message */}
      {homeDetails && !homeDetails.outsideServiceArea && !checkingPayment && !hasPaymentMethod && (
        <View style={styles.paymentWarning}>
          <View style={styles.paymentWarningIcon}>
            <Icon name="credit-card" size={20} color="#f59e0b" />
          </View>
          <View style={styles.paymentWarningContent}>
            <Text style={styles.paymentWarningTitle}>Payment Method Required</Text>
            <Text style={styles.paymentWarningText}>
              Add a payment method to start booking cleanings.
            </Text>
          </View>
          <Pressable
            style={styles.paymentWarningButton}
            onPress={() => navigate("/payment-setup")}
          >
            <Text style={styles.paymentWarningButtonText}>Set Up</Text>
            <Icon name="arrow-right" size={12} color="#fff" />
          </Pressable>
        </View>
      )}

      {/* Pending Cleaner Approvals */}
      {pendingApprovals.length > 0 && (
        <View style={styles.approvalSection}>
          <View style={styles.sectionHeader}>
            <Icon name="user-plus" size={14} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Pending Cleaner Requests</Text>
            <View style={styles.approvalBadge}>
              <Text style={styles.approvalBadgeText}>{pendingApprovals.length}</Text>
            </View>
          </View>
          {pendingApprovals.map((request) => (
            <View key={request.id} style={styles.approvalCard}>
              <View style={styles.approvalHeader}>
                <View style={styles.cleanerAvatarSmall}>
                  <Text style={styles.cleanerInitialsSmall}>
                    {request.cleanerFirstName?.charAt(0) || "?"}
                  </Text>
                </View>
                <View style={styles.approvalInfo}>
                  <Text style={styles.approvalCleanerName}>{request.cleanerName}</Text>
                  <Text style={styles.approvalSubtext}>
                    For {formatApprovalDate(request.appointmentDate)}
                  </Text>
                </View>
                <View style={styles.approvalTimeBadge}>
                  <Icon name="clock-o" size={10} color="#f59e0b" />
                  <Text style={styles.approvalTimeText}>{formatTimeRemaining(request.expiresAt)}</Text>
                </View>
              </View>
              <View style={styles.approvalActions}>
                <Pressable
                  style={[styles.declineBtn, processingApprovalId === request.id && styles.btnDisabled]}
                  onPress={() => handleDeclineRequest(request.id, request.cleanerName)}
                  disabled={processingApprovalId === request.id}
                >
                  {processingApprovalId === request.id ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <>
                      <Icon name="times" size={12} color="#ef4444" />
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.approveBtn, processingApprovalId === request.id && styles.btnDisabled]}
                  onPress={() => handleApproveRequest(request.id, request.cleanerName)}
                  disabled={processingApprovalId === request.id}
                >
                  {processingApprovalId === request.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="check" size={12} color="#fff" />
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ))}
          <Text style={styles.approvalNote}>
            If you don't respond, cleaners will be auto-approved when the timer expires.
          </Text>
        </View>
      )}

      {/* Calendar Component */}
      {homeDetails && !homeDetails.outsideServiceArea && hasPaymentMethod && (
        <View style={styles.calendarSection}>
          <View style={styles.calendarHeader}>
            <Icon name="calendar-check-o" size={16} color="#10b981" />
            <Text style={styles.calendarTitle}>Book a Cleaning</Text>
          </View>
          <CalendarComponent
            onDatesSelected={onDatesSelected}
            numBeds={homeDetails.numBeds}
            numBaths={homeDetails.numBaths}
            appointments={appointments}
            onAppointmentDelete={onAppointmentDelete}
            confirmationModalVisible={confirmationModalVisible}
            setConfirmationModalVisible={setConfirmationModalVisible}
            sheets={homeDetails.sheetsProvided}
            towels={homeDetails.towelsProvided}
            timeToBeCompleted={homeDetails.timeToBeCompleted}
            bedConfigurations={homeDetails.bedConfigurations}
            bathroomConfigurations={homeDetails.bathroomConfigurations}
          />
        </View>
      )}

      {/* Outside Service Area Message */}
      {homeDetails && homeDetails.outsideServiceArea && (
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
      )}
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

  // Section Card
  sectionCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    marginLeft: 8,
  },

  // Service Grid
  serviceGrid: {
    flexDirection: "row",
    gap: 10,
  },
  serviceItem: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  serviceItemActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#10b981",
  },
  serviceLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 8,
  },
  serviceLabelActive: {
    color: "#059669",
  },
  servicePrice: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
  },
  timeWindowNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eef2ff",
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  timeWindowNoteText: {
    fontSize: 12,
    color: "#6366f1",
    marginLeft: 8,
    fontWeight: "500",
  },

  // Detail Rows
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  detailIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValueRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailValue: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 15,
    fontWeight: "700",
    color: "#6366f1",
    letterSpacing: 1,
  },
  surchargeTag: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  surchargeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#d97706",
  },

  // Calendar Sync Button
  calendarSyncButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  calendarSyncIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  calendarSyncContent: {
    flex: 1,
  },
  calendarSyncTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  calendarSyncSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },

  // Edit Button
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366f1",
    marginLeft: 8,
  },

  // Payment Warning
  paymentWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffbeb",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  paymentWarningIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#fef3c7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  paymentWarningContent: {
    flex: 1,
  },
  paymentWarningTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400e",
  },
  paymentWarningText: {
    fontSize: 12,
    color: "#a16207",
    marginTop: 2,
  },
  paymentWarningButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6366f1",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  paymentWarningButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
    marginRight: 6,
  },

  // Calendar Section
  calendarSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginLeft: 8,
  },

  // Outside Area
  outsideAreaCard: {
    backgroundColor: "#fffbeb",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fcd34d",
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

  // Pending Approvals Section
  approvalSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#fcd34d",
    backgroundColor: "#fffbeb",
  },
  approvalBadge: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: "auto",
  },
  approvalBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  approvalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  approvalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  cleanerAvatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
  },
  cleanerInitialsSmall: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  approvalInfo: {
    flex: 1,
    marginLeft: 10,
  },
  approvalCleanerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  approvalSubtext: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 1,
  },
  approvalTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  approvalTimeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#d97706",
  },
  approvalActions: {
    flexDirection: "row",
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef2f2",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  declineBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ef4444",
  },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  approvalNote: {
    fontSize: 11,
    color: "#92400e",
    textAlign: "center",
    marginTop: 4,
    fontStyle: "italic",
  },
});

export default DetailsComponent;
