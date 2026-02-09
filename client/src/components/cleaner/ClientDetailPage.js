import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import CleanerClientService from "../../services/fetchRequests/CleanerClientService";
import EditClientHomeModal from "./EditClientHomeModal";
import BookForClientModal from "./BookForClientModal";

// Format time constraint for display: "10-3" → "10am - 3pm"
const formatTimeConstraint = (timeToBeCompleted) => {
  if (!timeToBeCompleted || timeToBeCompleted.toLowerCase() === "anytime") {
    return "Anytime";
  }
  const match = timeToBeCompleted.match(/^(\d+)(am|pm)?-(\d+)(am|pm)?$/i);
  if (!match) return timeToBeCompleted;
  const startHour = parseInt(match[1], 10);
  const startPeriod = match[2]?.toLowerCase() || (startHour >= 8 && startHour <= 11 ? "am" : "pm");
  const endHour = parseInt(match[3], 10);
  const endPeriod = match[4]?.toLowerCase() || (endHour >= 1 && endHour <= 6 ? "pm" : "am");
  return `${startHour}${startPeriod} - ${endHour}${endPeriod}`;
};

// Status badge component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    active: {
      label: "Active",
      backgroundColor: colors.success[100],
      textColor: colors.success[700],
    },
    pending_invite: {
      label: "Awaiting Response",
      backgroundColor: colors.warning[100],
      textColor: colors.warning[700],
    },
    inactive: {
      label: "Inactive",
      backgroundColor: colors.neutral[200],
      textColor: colors.neutral[600],
    },
    cancelled: {
      label: "Cancelled",
      backgroundColor: colors.error[100],
      textColor: colors.error[700],
    },
  };

  const config = statusConfig[status] || statusConfig.inactive;

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.backgroundColor }]}>
      <Text style={[styles.statusBadgeText, { color: config.textColor }]}>
        {config.label}
      </Text>
    </View>
  );
};

// Appointment card component
const AppointmentCard = ({ appointment }) => {
  const date = new Date(appointment.date);
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const getStatusIcon = () => {
    switch (appointment.status) {
      case "completed":
        return { icon: "check-circle", color: colors.success[600] };
      case "cancelled":
        return { icon: "x-circle", color: colors.error[600] };
      case "pending":
      case "assigned":
        return { icon: "clock", color: colors.primary[600] };
      default:
        return { icon: "circle", color: colors.neutral[400] };
    }
  };

  const statusIcon = getStatusIcon();

  return (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentCardLeft}>
        <Text style={styles.appointmentDate}>{formattedDate}</Text>
        <Text style={styles.appointmentDetails}>
          {formatTimeConstraint(appointment.timeToBeCompleted)}
          {appointment.home?.numBeds && ` • ${appointment.home.numBeds}bd/${appointment.home?.numBaths || 1}ba`}
        </Text>
      </View>
      <View style={styles.appointmentCardRight}>
        <Text style={styles.appointmentPrice}>${appointment.price || 0}</Text>
        <Feather name={statusIcon.icon} size={18} color={statusIcon.color} />
      </View>
    </View>
  );
};

// Empty state for appointments
const EmptyAppointments = ({ tab }) => (
  <View style={styles.emptyAppointments}>
    <Feather name="calendar" size={24} color={colors.neutral[400]} />
    <Text style={styles.emptyAppointmentsText}>
      {tab === "history"
        ? "No past appointments"
        : tab === "today"
        ? "No appointments today"
        : "No upcoming appointments"}
    </Text>
  </View>
);

const ClientDetailPage = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const { clientId } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [notes, setNotes] = useState("");
  const [notesChanged, setNotesChanged] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [platformPriceData, setPlatformPriceData] = useState(null);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  // Fetch client data
  const fetchClientData = useCallback(async () => {
    if (!state?.currentUser?.token || !clientId) return;

    try {
      const data = await CleanerClientService.getClientFull(
        state.currentUser.token,
        clientId
      );

      if (data.error) {
        Alert.alert("Error", data.error);
        navigate(-1);
        return;
      }

      setClientData(data);

      // Set notes from home or invited notes
      if (data.cleanerClient.status === "pending_invite") {
        setNotes(data.cleanerClient.invitedNotes || "");
      } else if (data.home) {
        setNotes(data.home.specialNotes || "");
      }
    } catch (error) {
      console.error("Error fetching client data:", error);
      Alert.alert("Error", "Failed to load client details");
      navigate(-1);
    } finally {
      setIsLoading(false);
    }
  }, [state?.currentUser?.token, clientId, navigate]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  // Fetch platform price when client data loads
  useEffect(() => {
    const fetchPlatformPrice = async () => {
      if (!clientData?.cleanerClient?.id || !state?.currentUser?.token) return;

      try {
        const data = await CleanerClientService.getPlatformPrice(
          state.currentUser.token,
          clientData.cleanerClient.id
        );
        if (!data.error) {
          setPlatformPriceData(data);
        }
      } catch (error) {
        console.error("Error fetching platform price:", error);
      }
    };

    fetchPlatformPrice();
  }, [clientData?.cleanerClient?.id, state?.currentUser?.token]);

  // Update price input when client data changes
  useEffect(() => {
    if (clientData?.cleanerClient?.defaultPrice) {
      setPriceInput(clientData.cleanerClient.defaultPrice.toString());
    }
  }, [clientData?.cleanerClient?.defaultPrice]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchClientData();
    setRefreshing(false);
  };

  // Save notes
  const handleSaveNotes = async () => {
    if (!notesChanged) return;

    setSavingNotes(true);
    try {
      const result = await CleanerClientService.updateClientHome(
        state.currentUser.token,
        clientId,
        { specialNotes: notes }
      );

      if (result.success) {
        setNotesChanged(false);
        Alert.alert("Success", "Notes saved");
      } else {
        Alert.alert("Error", result.error || "Failed to save notes");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  // Handle save price
  const handleSavePrice = async () => {
    if (!priceInput || isNaN(parseFloat(priceInput))) {
      Alert.alert("Error", "Please enter a valid price");
      return;
    }

    setSavingPrice(true);
    try {
      const result = await CleanerClientService.updateDefaultPrice(
        state.currentUser.token,
        clientData.cleanerClient.id,
        parseFloat(priceInput)
      );

      if (result.success) {
        setEditingPrice(false);
        // Update local state
        setClientData((prev) => ({
          ...prev,
          cleanerClient: {
            ...prev.cleanerClient,
            defaultPrice: parseFloat(priceInput),
          },
        }));
        Alert.alert("Success", "Price updated");
      } else {
        Alert.alert("Error", result.error || "Failed to update price");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update price");
    } finally {
      setSavingPrice(false);
    }
  };

  // Handle align with platform price
  const handleAlignWithPlatform = () => {
    if (!platformPriceData?.platformPrice) return;

    setPriceInput(platformPriceData.platformPrice.toString());
    setEditingPrice(true);
  };

  // Handle edit modal save
  const handleEditSave = async (updates) => {
    try {
      const result = await CleanerClientService.updateClientHome(
        state.currentUser.token,
        clientId,
        updates
      );

      if (result.success) {
        setShowEditModal(false);
        fetchClientData(); // Refresh data
        Alert.alert("Success", "Home details updated");
      } else {
        Alert.alert("Error", result.error || "Failed to update home details");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update home details");
    }
  };

  // Build marked dates for calendar
  const getMarkedDates = () => {
    const marked = {};

    if (!clientData?.appointments) return marked;

    const allAppointments = [
      ...(clientData.appointments.history || []),
      ...(clientData.appointments.today || []),
      ...(clientData.appointments.upcoming || []),
    ];

    allAppointments.forEach((apt) => {
      const dateStr = apt.date;
      let dotColor = colors.neutral[400];

      if (apt.status === "completed") {
        dotColor = colors.success[600];
      } else if (apt.status === "cancelled") {
        dotColor = colors.error[600];
      } else {
        dotColor = colors.primary[600];
      }

      marked[dateStr] = {
        marked: true,
        dotColor,
      };
    });

    return marked;
  };

  // Get appointments for the selected tab
  const getTabAppointments = () => {
    if (!clientData?.appointments) return [];

    switch (activeTab) {
      case "history":
        return clientData.appointments.history || [];
      case "today":
        return clientData.appointments.today || [];
      case "upcoming":
        return clientData.appointments.upcoming || [];
      default:
        return [];
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading client details...</Text>
      </View>
    );
  }

  if (!clientData || !clientData.cleanerClient) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Client not found</Text>
        <Pressable
          style={styles.backButtonLarge}
          onPress={() => navigate(-1)}
        >
          <Text style={styles.backButtonLargeText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const { cleanerClient, home, client } = clientData;
  const isPending = cleanerClient.status === "pending_invite";

  // Get display name and email
  const displayName = isPending
    ? cleanerClient.invitedName
    : client
    ? `${client.firstName} ${client.lastName}`
    : cleanerClient.invitedName;

  const displayEmail = isPending
    ? cleanerClient.invitedEmail
    : client?.email || cleanerClient.invitedEmail;

  // Get address info (from home or invited data)
  const addressData = isPending
    ? cleanerClient.invitedAddress || {}
    : home || {};

  const tabAppointments = getTabAppointments();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigate(-1)}
        >
          <Feather name="arrow-left" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {displayName}
            </Text>
            <StatusBadge status={cleanerClient.status} />
          </View>
          <Text style={styles.headerEmail} numberOfLines={1}>
            {displayEmail}
          </Text>
        </View>
        {/* Book for Client button - only show for active clients */}
        {cleanerClient.status === "active" && (
          <Pressable
            style={({ pressed }) => [
              styles.bookButton,
              pressed && styles.bookButtonPressed,
            ]}
            onPress={() => setShowBookModal(true)}
          >
            <Feather name="calendar" size={16} color={colors.neutral[0]} />
            <Text style={styles.bookButtonText}>Book</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[600]}
          />
        }
      >
        {/* Home Details Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Feather name="home" size={18} color={colors.primary[600]} />
              <Text style={styles.cardTitle}>Home Details</Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.editButton,
                pressed && styles.editButtonPressed,
              ]}
              onPress={() => setShowEditModal(true)}
            >
              <Feather name="edit-2" size={14} color={colors.primary[600]} />
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.cardBody}>
            {/* Address */}
            <Text style={styles.addressLine}>
              {addressData.address || "No address provided"}
            </Text>
            <Text style={styles.addressLine}>
              {[addressData.city, addressData.state, addressData.zipcode]
                .filter(Boolean)
                .join(", ")}
            </Text>

            {/* Bed/Bath */}
            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Feather name="moon" size={14} color={colors.neutral[500]} />
                <Text style={styles.detailText}>
                  {isPending
                    ? cleanerClient.invitedBeds || 1
                    : home?.numBeds || 1}{" "}
                  beds
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Feather name="droplet" size={14} color={colors.neutral[500]} />
                <Text style={styles.detailText}>
                  {isPending
                    ? cleanerClient.invitedBaths || 1
                    : home?.numBaths || 1}{" "}
                  baths
                </Text>
              </View>
            </View>

            {/* Access Info (only for active clients) */}
            {!isPending && home && (
              <>
                {(home.keyPadCode || home.keyLocation) && (
                  <View style={styles.accessSection}>
                    {home.keyPadCode && (
                      <View style={styles.detailItem}>
                        <Feather name="lock" size={14} color={colors.neutral[500]} />
                        <Text style={styles.detailText}>
                          Keypad: {home.keyPadCode}
                        </Text>
                      </View>
                    )}
                    {home.keyLocation && (
                      <View style={styles.detailItem}>
                        <Feather name="map-pin" size={14} color={colors.neutral[500]} />
                        <Text style={styles.detailText}>
                          {home.keyLocation}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Linens */}
                <View style={styles.linensRow}>
                  <View style={styles.linenItem}>
                    <Feather
                      name={home.sheetsProvided ? "check-circle" : "circle"}
                      size={14}
                      color={home.sheetsProvided ? colors.success[600] : colors.neutral[400]}
                    />
                    <Text style={styles.detailText}>Sheets</Text>
                  </View>
                  <View style={styles.linenItem}>
                    <Feather
                      name={home.towelsProvided ? "check-circle" : "circle"}
                      size={14}
                      color={home.towelsProvided ? colors.success[600] : colors.neutral[400]}
                    />
                    <Text style={styles.detailText}>Towels</Text>
                  </View>
                </View>

                {/* Service Preferences */}
                <View style={styles.preferencesRow}>
                  <View style={styles.detailItem}>
                    <Feather name="clock" size={14} color={colors.neutral[500]} />
                    <Text style={styles.detailText}>
                      {formatTimeConstraint(home.timeToBeCompleted)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Feather name="users" size={14} color={colors.neutral[500]} />
                    <Text style={styles.detailText}>
                      {home.cleanersNeeded || 1} cleaner(s)
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* Pricing Section - Enhanced */}
            <View style={styles.pricingSection}>
              <View style={styles.pricingHeader}>
                <Text style={styles.pricingSectionTitle}>Pricing</Text>
                {cleanerClient.defaultFrequency && (
                  <Text style={styles.frequencyBadge}>
                    {cleanerClient.defaultFrequency}
                  </Text>
                )}
              </View>

              {/* Default Price Row */}
              <View style={styles.priceEditRow}>
                <Text style={styles.priceLabel}>Default Price:</Text>
                {editingPrice ? (
                  <View style={styles.priceInputContainer}>
                    <Text style={styles.dollarSign}>$</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={priceInput}
                      onChangeText={setPriceInput}
                      keyboardType="decimal-pad"
                      autoFocus
                    />
                    <Pressable
                      style={({ pressed }) => [
                        styles.priceSaveButton,
                        pressed && styles.priceSaveButtonPressed,
                        savingPrice && styles.priceButtonDisabled,
                      ]}
                      onPress={handleSavePrice}
                      disabled={savingPrice}
                    >
                      {savingPrice ? (
                        <ActivityIndicator size="small" color={colors.neutral[0]} />
                      ) : (
                        <Feather name="check" size={16} color={colors.neutral[0]} />
                      )}
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.priceCancelButton,
                        pressed && styles.priceCancelButtonPressed,
                      ]}
                      onPress={() => {
                        setEditingPrice(false);
                        setPriceInput(cleanerClient.defaultPrice?.toString() || "");
                      }}
                    >
                      <Feather name="x" size={16} color={colors.neutral[600]} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.priceDisplayRow}>
                    <Text style={styles.priceValue}>
                      ${cleanerClient.defaultPrice || "0"}
                    </Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.priceEditButton,
                        pressed && styles.priceEditButtonPressed,
                      ]}
                      onPress={() => setEditingPrice(true)}
                    >
                      <Feather name="edit-2" size={14} color={colors.primary[600]} />
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Platform Price Reference */}
              {platformPriceData && (
                <View style={styles.platformPriceSection}>
                  <View style={styles.platformPriceRow}>
                    <View style={styles.platformPriceInfo}>
                      <Text style={styles.platformPriceLabel}>Platform rate:</Text>
                      <Text style={styles.platformPriceValue}>
                        ${platformPriceData.platformPrice}
                      </Text>
                      <Text style={styles.platformPriceBreakdown}>
                        ({platformPriceData.numBeds} bed, {platformPriceData.numBaths} bath)
                      </Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [
                        styles.alignButton,
                        pressed && styles.alignButtonPressed,
                      ]}
                      onPress={handleAlignWithPlatform}
                    >
                      <Feather name="trending-up" size={14} color={colors.neutral[0]} />
                      <Text style={styles.alignButtonText}>Align with Platform</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Notes Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Feather name="file-text" size={18} color={colors.primary[600]} />
              <Text style={styles.cardTitle}>Notes</Text>
            </View>
            {notesChanged && (
              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.saveButtonPressed,
                  savingNotes && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveNotes}
                disabled={savingNotes}
              >
                {savingNotes ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <>
                    <Feather name="save" size={14} color={colors.neutral[0]} />
                    <Text style={styles.saveButtonText}>Save</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
          <View style={styles.cardBody}>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={(text) => {
                setNotes(text);
                setNotesChanged(true);
              }}
              placeholder="Add notes about this client..."
              placeholderTextColor={colors.neutral[400]}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Appointments Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Feather name="calendar" size={18} color={colors.primary[600]} />
              <Text style={styles.cardTitle}>Appointments</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.appointmentTabs}>
            {[
              { key: "history", label: "History" },
              { key: "today", label: "Today" },
              { key: "upcoming", label: "Upcoming" },
            ].map((tab) => (
              <Pressable
                key={tab.key}
                style={[
                  styles.appointmentTab,
                  activeTab === tab.key && styles.appointmentTabActive,
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text
                  style={[
                    styles.appointmentTabText,
                    activeTab === tab.key && styles.appointmentTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Appointments List */}
          <View style={styles.appointmentsList}>
            {tabAppointments.length === 0 ? (
              <EmptyAppointments tab={activeTab} />
            ) : (
              tabAppointments.map((apt) => (
                <AppointmentCard key={apt.id} appointment={apt} />
              ))
            )}
          </View>
        </View>

        {/* Calendar Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Feather name="calendar" size={18} color={colors.primary[600]} />
              <Text style={styles.cardTitle}>Calendar</Text>
            </View>
          </View>
          <View style={styles.calendarContainer}>
            <Calendar
              markedDates={getMarkedDates()}
              theme={{
                backgroundColor: colors.neutral[0],
                calendarBackground: colors.neutral[0],
                textSectionTitleColor: colors.neutral[500],
                selectedDayBackgroundColor: colors.primary[600],
                selectedDayTextColor: colors.neutral[0],
                todayTextColor: colors.primary[600],
                dayTextColor: colors.text.primary,
                textDisabledColor: colors.neutral[300],
                dotColor: colors.primary[600],
                selectedDotColor: colors.neutral[0],
                arrowColor: colors.primary[600],
                monthTextColor: colors.text.primary,
                textDayFontWeight: "400",
                textMonthFontWeight: typography.fontWeight.semibold,
                textDayHeaderFontWeight: typography.fontWeight.medium,
                textDayFontSize: 14,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 12,
              }}
              onDayPress={(day) => {
                // Find appointments for this day
                const allAppointments = [
                  ...(clientData.appointments?.history || []),
                  ...(clientData.appointments?.today || []),
                  ...(clientData.appointments?.upcoming || []),
                ];
                const dayAppointments = allAppointments.filter(
                  (apt) => apt.date === day.dateString
                );

                if (dayAppointments.length > 0) {
                  const apt = dayAppointments[0];
                  Alert.alert(
                    `Appointment on ${day.dateString}`,
                    `Time: ${formatTimeConstraint(apt.timeToBeCompleted)}\nPrice: $${apt.price || 0}\nStatus: ${apt.status}`
                  );
                }
              }}
            />
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success[600] }]} />
              <Text style={styles.legendText}>Completed</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary[600] }]} />
              <Text style={styles.legendText}>Upcoming</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.error[600] }]} />
              <Text style={styles.legendText}>Cancelled</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <EditClientHomeModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleEditSave}
        home={home}
        cleanerClient={cleanerClient}
      />

      {/* Book for Client Modal */}
      <BookForClientModal
        visible={showBookModal}
        onClose={() => setShowBookModal(false)}
        onSuccess={() => {
          setShowBookModal(false);
          fetchClientData(); // Refresh to show pending booking
        }}
        client={cleanerClient}
        token={state?.currentUser?.token}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.neutral[500],
    fontSize: typography.fontSize.sm,
  },
  errorText: {
    color: colors.error[600],
    fontSize: typography.fontSize.base,
    marginBottom: spacing.md,
  },
  backButtonLarge: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
  },
  backButtonLargeText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
  },
  headerEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },

  // Book button
  bookButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
  },
  bookButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  bookButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },

  // Status Badge
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing["3xl"],
  },

  // Cards
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    ...shadows.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  cardBody: {
    padding: spacing.lg,
  },

  // Edit button
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
  },
  editButtonPressed: {
    backgroundColor: colors.primary[100],
  },
  editButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },

  // Save button
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.success[600],
    minWidth: 70,
    justifyContent: "center",
  },
  saveButtonPressed: {
    backgroundColor: colors.success[700],
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[0],
  },

  // Address
  addressLine: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  // Details row
  detailsRow: {
    flexDirection: "row",
    gap: spacing.xl,
    marginTop: spacing.md,
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

  // Access section
  accessSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    gap: spacing.sm,
  },

  // Linens
  linensRow: {
    flexDirection: "row",
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  linenItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },

  // Preferences
  preferencesRow: {
    flexDirection: "row",
    gap: spacing.xl,
    marginTop: spacing.md,
  },

  // Pricing Section - Enhanced
  pricingSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  pricingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  pricingSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  frequencyBadge: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  priceEditRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  priceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  priceDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  priceValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  priceEditButton: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  priceEditButtonPressed: {
    backgroundColor: colors.primary[100],
  },
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dollarSign: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  priceInput: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    minWidth: 80,
    textAlign: "right",
  },
  priceSaveButton: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.success[600],
    alignItems: "center",
    justifyContent: "center",
  },
  priceSaveButtonPressed: {
    backgroundColor: colors.success[700],
  },
  priceCancelButton: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
  },
  priceCancelButtonPressed: {
    backgroundColor: colors.neutral[300],
  },
  priceButtonDisabled: {
    opacity: 0.7,
  },
  platformPriceSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  platformPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  platformPriceInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  platformPriceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  platformPriceValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  platformPriceBreakdown: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  alignButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  alignButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  alignButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },

  // Notes
  notesInput: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 80,
    lineHeight: 22,
  },

  // Appointment Tabs
  appointmentTabs: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  appointmentTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
  },
  appointmentTabActive: {
    backgroundColor: colors.primary[600],
  },
  appointmentTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  appointmentTabTextActive: {
    color: colors.neutral[0],
  },

  // Appointments List
  appointmentsList: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  appointmentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
  },
  appointmentCardLeft: {
    flex: 1,
  },
  appointmentDate: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  appointmentDetails: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  appointmentCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  appointmentPrice: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },

  // Empty Appointments
  emptyAppointments: {
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyAppointmentsText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[400],
  },

  // Calendar
  calendarContainer: {
    paddingHorizontal: spacing.sm,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xl,
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
});

export default ClientDetailPage;
