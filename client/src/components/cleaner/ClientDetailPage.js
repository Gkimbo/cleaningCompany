import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useParams } from "react-router-native";
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
import SetupRecurringModal from "./SetupRecurringModal";

import useSafeNavigation from "../../hooks/useSafeNavigation";
// Home picker modal component
const HomePickerModal = ({ visible, onClose, homes, onSelectHome, actionType }) => {
  if (!visible) return null;

  const actionLabel = actionType === "recurring" ? "Set Up Recurring" : "Book";
  const actionIcon = actionType === "recurring" ? "repeat" : "calendar";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={homePickerStyles.overlay} onPress={onClose}>
        <View style={homePickerStyles.container}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={homePickerStyles.content}>
              <View style={homePickerStyles.header}>
                <View style={homePickerStyles.headerIcon}>
                  <Feather name={actionIcon} size={20} color={colors.primary[600]} />
                </View>
                <Text style={homePickerStyles.title}>Select a Home</Text>
                <Pressable style={homePickerStyles.closeButton} onPress={onClose}>
                  <Feather name="x" size={20} color={colors.neutral[500]} />
                </Pressable>
              </View>
              <Text style={homePickerStyles.subtitle}>
                Which home would you like to {actionType === "recurring" ? "set up recurring for" : "book"}?
              </Text>
              <View style={homePickerStyles.homesList}>
                {homes.map((home, index) => (
                  <Pressable
                    key={home.id}
                    style={({ pressed }) => [
                      homePickerStyles.homeOption,
                      pressed && homePickerStyles.homeOptionPressed,
                    ]}
                    onPress={() => onSelectHome(home)}
                  >
                    <View style={homePickerStyles.homeIconContainer}>
                      <Feather name="home" size={18} color={colors.primary[600]} />
                    </View>
                    <View style={homePickerStyles.homeInfo}>
                      <Text style={homePickerStyles.homeName}>
                        Home {index + 1}{home.nickName ? `: ${home.nickName}` : ""}
                      </Text>
                      <Text style={homePickerStyles.homeAddress} numberOfLines={1}>
                        {home.address ? `${home.address}, ${home.city}` : "No address"}
                      </Text>
                      <Text style={homePickerStyles.homeDetails}>
                        {home.numBeds || 1} bed • {home.numBaths || 1} bath
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
                  </Pressable>
                ))}
              </View>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
};

const homePickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  container: {
    width: "100%",
    maxWidth: 400,
  },
  content: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    ...shadows.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[900],
  },
  closeButton: {
    padding: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  homesList: {
    padding: spacing.md,
  },
  homeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[50],
    marginBottom: spacing.sm,
  },
  homeOptionPressed: {
    backgroundColor: colors.primary[50],
  },
  homeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  homeInfo: {
    flex: 1,
  },
  homeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[900],
    marginBottom: 2,
  },
  homeAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
    marginBottom: 2,
  },
  homeDetails: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
});

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
      backgroundColor: colors.success[50],
      textColor: colors.success[700],
      borderColor: colors.success[200],
    },
    pending_invite: {
      label: "Pending",
      backgroundColor: colors.warning[50],
      textColor: colors.warning[700],
      borderColor: colors.warning[200],
    },
    inactive: {
      label: "Inactive",
      backgroundColor: colors.neutral[100],
      textColor: colors.neutral[500],
      borderColor: colors.neutral[200],
    },
    cancelled: {
      label: "Cancelled",
      backgroundColor: colors.error[50],
      textColor: colors.error[700],
      borderColor: colors.error[200],
    },
  };

  const config = statusConfig[status] || statusConfig.inactive;

  return (
    <View style={[
      styles.statusBadge,
      { backgroundColor: config.backgroundColor, borderColor: config.borderColor }
    ]}>
      <Text style={[styles.statusBadgeText, { color: config.textColor }]}>
        {config.label}
      </Text>
    </View>
  );
};

// Appointment card component with expandable details
const AppointmentCard = ({ appointment, homes }) => {
  const [expanded, setExpanded] = useState(false);

  const date = new Date(appointment.date);
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedFullDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const getStatusConfig = () => {
    switch (appointment.status) {
      case "completed":
        return { icon: "check-circle", color: colors.success[600], bg: colors.success[50], label: "Completed" };
      case "cancelled":
        return { icon: "x-circle", color: colors.error[600], bg: colors.error[50], label: "Cancelled" };
      case "pending":
        return { icon: "clock", color: colors.warning[600], bg: colors.warning[50], label: "Pending" };
      case "assigned":
        return { icon: "user-check", color: colors.primary[600], bg: colors.primary[50], label: "Assigned" };
      default:
        return { icon: "circle", color: colors.neutral[400], bg: colors.neutral[100], label: "Unknown" };
    }
  };

  // Get home label (nickname or "Home 1", "Home 2", etc.)
  const getHomeLabel = () => {
    if (!appointment.home) return null;
    const homeIndex = homes.findIndex(h => h.id === appointment.home.id);
    if (appointment.home.nickName) {
      return appointment.home.nickName;
    }
    return homeIndex >= 0 ? `Home ${homeIndex + 1}` : "Home";
  };

  const statusConfig = getStatusConfig();
  const homeLabel = getHomeLabel();
  const home = appointment.home;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.appointmentCard,
        expanded && styles.appointmentCardExpanded,
        pressed && !expanded && styles.appointmentCardPressed,
      ]}
      onPress={() => setExpanded(!expanded)}
    >
      {/* Header Row - Always Visible */}
      <View style={styles.appointmentHeader}>
        <View style={styles.appointmentCardLeft}>
          <View style={styles.appointmentDateRow}>
            <Text style={styles.appointmentDate}>{formattedDate}</Text>
            {homeLabel && (
              <View style={styles.appointmentHomeTag}>
                <Feather name="home" size={10} color={colors.primary[600]} />
                <Text style={styles.appointmentHomeTagText}>{homeLabel}</Text>
              </View>
            )}
          </View>
          <Text style={styles.appointmentDetails}>
            {formatTimeConstraint(appointment.timeToBeCompleted)}
            {home?.numBeds && ` • ${home.numBeds}bd/${home?.numBaths || 1}ba`}
          </Text>
        </View>
        <View style={styles.appointmentCardRight}>
          <Text style={styles.appointmentPrice}>${appointment.price || 0}</Text>
          <Feather name={statusConfig.icon} size={18} color={statusConfig.color} />
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.neutral[400]}
          />
        </View>
      </View>

      {/* Expanded Details */}
      {expanded && (
        <View style={styles.appointmentExpanded}>
          {/* Status Badge */}
          <View style={styles.appointmentStatusRow}>
            <View style={[styles.appointmentStatusBadge, { backgroundColor: statusConfig.bg }]}>
              <Feather name={statusConfig.icon} size={12} color={statusConfig.color} />
              <Text style={[styles.appointmentStatusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
            <Text style={styles.appointmentFullDate}>{formattedFullDate}</Text>
          </View>

          {/* Details Grid */}
          <View style={styles.appointmentDetailsGrid}>
            {/* Address */}
            {home?.address && (
              <View style={styles.appointmentDetailItem}>
                <View style={styles.appointmentDetailIcon}>
                  <Feather name="map-pin" size={14} color={colors.neutral[500]} />
                </View>
                <View style={styles.appointmentDetailContent}>
                  <Text style={styles.appointmentDetailLabel}>Address</Text>
                  <Text style={styles.appointmentDetailValue}>{home.address}</Text>
                  {home.city && (
                    <Text style={styles.appointmentDetailSubvalue}>
                      {[home.city, home.state, home.zipcode].filter(Boolean).join(", ")}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Time Window */}
            <View style={styles.appointmentDetailItem}>
              <View style={styles.appointmentDetailIcon}>
                <Feather name="clock" size={14} color={colors.neutral[500]} />
              </View>
              <View style={styles.appointmentDetailContent}>
                <Text style={styles.appointmentDetailLabel}>Time Window</Text>
                <Text style={styles.appointmentDetailValue}>
                  {formatTimeConstraint(appointment.timeToBeCompleted)}
                </Text>
              </View>
            </View>

            {/* Property Size */}
            {home && (
              <View style={styles.appointmentDetailItem}>
                <View style={styles.appointmentDetailIcon}>
                  <Feather name="home" size={14} color={colors.neutral[500]} />
                </View>
                <View style={styles.appointmentDetailContent}>
                  <Text style={styles.appointmentDetailLabel}>Property</Text>
                  <Text style={styles.appointmentDetailValue}>
                    {home.numBeds || 1} bed, {home.numBaths || 1} bath
                  </Text>
                </View>
              </View>
            )}

            {/* Cleaners */}
            <View style={styles.appointmentDetailItem}>
              <View style={styles.appointmentDetailIcon}>
                <Feather name="users" size={14} color={colors.neutral[500]} />
              </View>
              <View style={styles.appointmentDetailContent}>
                <Text style={styles.appointmentDetailLabel}>Cleaners</Text>
                <Text style={styles.appointmentDetailValue}>
                  {home?.cleanersNeeded || 1} cleaner{(home?.cleanersNeeded || 1) > 1 ? "s" : ""} needed
                </Text>
              </View>
            </View>

            {/* Price Breakdown */}
            <View style={styles.appointmentDetailItem}>
              <View style={styles.appointmentDetailIcon}>
                <Feather name="dollar-sign" size={14} color={colors.neutral[500]} />
              </View>
              <View style={styles.appointmentDetailContent}>
                <Text style={styles.appointmentDetailLabel}>Price</Text>
                <Text style={[styles.appointmentDetailValue, styles.appointmentDetailPrice]}>
                  ${appointment.price || 0}
                </Text>
              </View>
            </View>

            {/* Linens */}
            {home && (
              <View style={styles.appointmentDetailItem}>
                <View style={styles.appointmentDetailIcon}>
                  <Feather name="box" size={14} color={colors.neutral[500]} />
                </View>
                <View style={styles.appointmentDetailContent}>
                  <Text style={styles.appointmentDetailLabel}>Linens</Text>
                  <View style={styles.appointmentLinensRow}>
                    <View style={[
                      styles.appointmentLinenChip,
                      home.sheetsProvided && styles.appointmentLinenChipActive,
                    ]}>
                      <Text style={[
                        styles.appointmentLinenChipText,
                        home.sheetsProvided && styles.appointmentLinenChipTextActive,
                      ]}>
                        {home.sheetsProvided ? "✓" : "✗"} Sheets
                      </Text>
                    </View>
                    <View style={[
                      styles.appointmentLinenChip,
                      home.towelsProvided && styles.appointmentLinenChipActive,
                    ]}>
                      <Text style={[
                        styles.appointmentLinenChipText,
                        home.towelsProvided && styles.appointmentLinenChipTextActive,
                      ]}>
                        {home.towelsProvided ? "✓" : "✗"} Towels
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Special Notes */}
          {home?.specialNotes && (
            <View style={styles.appointmentNotes}>
              <Text style={styles.appointmentNotesLabel}>Notes</Text>
              <Text style={styles.appointmentNotesText}>{home.specialNotes}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
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
  const { goBack } = useSafeNavigation();
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
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showHomePicker, setShowHomePicker] = useState(false);
  const [homePickerAction, setHomePickerAction] = useState(null); // "book" or "recurring"
  const [selectedHomeForBooking, setSelectedHomeForBooking] = useState(null);
  const [editingPriceHomeId, setEditingPriceHomeId] = useState(null);
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
        goBack();
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
      goBack();
    } finally {
      setIsLoading(false);
    }
  }, [state?.currentUser?.token, clientId, navigate]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

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

  // Handle save price for a specific home
  const handleSavePrice = async (homeId) => {
    if (!priceInput || isNaN(parseFloat(priceInput))) {
      Alert.alert("Error", "Please enter a valid price");
      return;
    }

    // Find the home to get its cleanerClientId
    const targetHome = homes.find(h => h.id === homeId) || home;
    const cleanerClientIdToUpdate = targetHome?.cleanerClientId || clientData.cleanerClient.id;

    setSavingPrice(true);
    try {
      const result = await CleanerClientService.updateDefaultPrice(
        state.currentUser.token,
        cleanerClientIdToUpdate,
        parseFloat(priceInput)
      );

      if (result.success) {
        setEditingPriceHomeId(null);
        // Update local state - update the specific home's price
        setClientData((prev) => ({
          ...prev,
          homes: prev.homes.map(h =>
            h.id === homeId
              ? { ...h, defaultPrice: parseFloat(priceInput) }
              : h
          ),
          // Also update cleanerClient if it's the primary home
          cleanerClient: targetHome?.cleanerClientId === prev.cleanerClient.id
            ? { ...prev.cleanerClient, defaultPrice: parseFloat(priceInput) }
            : prev.cleanerClient,
        }));
        Alert.alert("Success", "Price updated for this home");
      } else {
        Alert.alert("Error", result.error || "Failed to update price");
      }
    } catch (_error) {
      Alert.alert("Error", "Failed to update price");
    } finally {
      setSavingPrice(false);
    }
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

  // Handle Book or Recurring button click
  const handleActionButtonClick = (actionType) => {
    // If only one home, skip the picker and go directly to modal
    if (homes.length === 1) {
      setSelectedHomeForBooking(homes[0]);
      if (actionType === "recurring") {
        setShowRecurringModal(true);
      } else {
        setShowBookModal(true);
      }
    } else if (homes.length > 1) {
      // Multiple homes - show picker
      setHomePickerAction(actionType);
      setShowHomePicker(true);
    }
  };

  // Handle home selection from picker
  const handleHomeSelected = (selectedHome) => {
    setSelectedHomeForBooking(selectedHome);
    setShowHomePicker(false);

    if (homePickerAction === "recurring") {
      setShowRecurringModal(true);
    } else {
      setShowBookModal(true);
    }
  };

  // Build marked dates for calendar with clear visual styling
  const getMarkedDates = () => {
    const marked = {};

    if (!clientData?.appointments) return marked;

    const allAppointments = [
      ...(clientData.appointments.history || []),
      ...(clientData.appointments.today || []),
      ...(clientData.appointments.upcoming || []),
    ];

    // Group appointments by date
    const appointmentsByDate = {};
    allAppointments.forEach((apt) => {
      const dateStr = apt.date;
      if (!appointmentsByDate[dateStr]) {
        appointmentsByDate[dateStr] = [];
      }
      appointmentsByDate[dateStr].push(apt);
    });

    // Create marked dates with visible styling
    Object.entries(appointmentsByDate).forEach(([dateStr, apts]) => {
      // Determine the primary status for background color
      const hasUpcoming = apts.some(a => a.status === "pending" || a.status === "assigned");
      const hasCompleted = apts.some(a => a.status === "completed");
      const allCancelled = apts.every(a => a.status === "cancelled");

      let customStyles = {};
      let dotColor = colors.primary[600];

      if (allCancelled) {
        customStyles = {
          container: {
            backgroundColor: colors.error[100],
            borderRadius: 8,
          },
          text: {
            color: colors.error[700],
            fontWeight: "600",
          },
        };
        dotColor = colors.error[600];
      } else if (hasUpcoming) {
        customStyles = {
          container: {
            backgroundColor: colors.warning[100],
            borderRadius: 8,
          },
          text: {
            color: colors.warning[700],
            fontWeight: "600",
          },
        };
        dotColor = colors.warning[600];
      } else if (hasCompleted) {
        customStyles = {
          container: {
            backgroundColor: colors.success[100],
            borderRadius: 8,
          },
          text: {
            color: colors.success[700],
            fontWeight: "600",
          },
        };
        dotColor = colors.success[600];
      }

      marked[dateStr] = {
        customStyles,
        marked: true,
        dotColor,
        // Show appointment count if more than 1
        ...(apts.length > 1 && { appointmentCount: apts.length }),
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
          onPress={() => goBack()}
        >
          <Text style={styles.backButtonLargeText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const { cleanerClient, home, homes = [], client } = clientData;

  // Merge client (User) data into cleanerClient so modals can access it as client.client
  const cleanerClientWithUser = {
    ...cleanerClient,
    client: client, // Nest the User data for modal compatibility
  };

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

  const tabAppointments = getTabAppointments();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => goBack()}
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
      </View>

      {/* Action Bar - below header */}
      {cleanerClient.status === "active" && homes.length > 0 && (
        <View style={styles.actionBar}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBarButton,
              styles.actionBarButtonSecondary,
              pressed && styles.actionBarButtonSecondaryPressed,
            ]}
            onPress={() => handleActionButtonClick("recurring")}
          >
            <Feather name="repeat" size={18} color={colors.primary[600]} />
            <Text style={styles.actionBarButtonTextSecondary}>Set Up Recurring</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBarButton,
              styles.actionBarButtonPrimary,
              pressed && styles.actionBarButtonPrimaryPressed,
            ]}
            onPress={() => handleActionButtonClick("book")}
          >
            <Feather name="plus-circle" size={18} color={colors.neutral[0]} />
            <Text style={styles.actionBarButtonTextPrimary}>Book Cleaning</Text>
          </Pressable>
        </View>
      )}

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
              <Text style={styles.cardTitle}>
                {homes.length > 1 ? `Homes (${homes.length})` : "Home Details"}
              </Text>
            </View>
            {homes.length <= 1 && (
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
            )}
          </View>

          <View style={styles.cardBody}>
            {/* Show pending invite info */}
            {isPending && (
              <>
                <Text style={styles.addressLine}>
                  {cleanerClient.invitedAddress?.address || "No address provided"}
                </Text>
                <Text style={styles.addressLine}>
                  {[cleanerClient.invitedAddress?.city, cleanerClient.invitedAddress?.state, cleanerClient.invitedAddress?.zipcode]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
                <View style={styles.detailsRow}>
                  <View style={styles.detailItem}>
                    <Feather name="moon" size={14} color={colors.neutral[500]} />
                    <Text style={styles.detailText}>
                      {cleanerClient.invitedBeds || 1} beds
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Feather name="droplet" size={14} color={colors.neutral[500]} />
                    <Text style={styles.detailText}>
                      {cleanerClient.invitedBaths || 1} baths
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* Show homes for active clients */}
            {!isPending && homes.length > 0 && homes.map((homeItem, index) => (
              <View
                key={homeItem.id}
                style={[
                  styles.homeCard,
                  index > 0 && styles.homeCardBorder,
                ]}
              >
                {/* Home Header */}
                <View style={styles.homeCardHeader}>
                  <View style={styles.homeCardLabel}>
                    <Feather name="home" size={14} color={colors.primary[600]} />
                    <Text style={styles.homeCardLabelText}>
                      Home {index + 1}{homeItem.nickName ? `: ${homeItem.nickName}` : ""}
                    </Text>
                  </View>
                </View>

                {/* Address */}
                <View style={styles.homeSection}>
                  <Text style={styles.homeSectionLabel}>Address</Text>
                  <Text style={styles.homeAddressText}>
                    {homeItem.address || "No address"}
                  </Text>
                  <Text style={styles.homeAddressSubtext}>
                    {[homeItem.city, homeItem.state, homeItem.zipcode]
                      .filter(Boolean)
                      .join(", ")}
                  </Text>
                </View>

                {/* Property Details Grid */}
                <View style={styles.homeSection}>
                  <Text style={styles.homeSectionLabel}>Property Details</Text>
                  <View style={styles.homeDetailsGrid}>
                    <View style={styles.homeDetailBox}>
                      <Feather name="moon" size={16} color={colors.primary[600]} />
                      <Text style={styles.homeDetailValue}>{homeItem.numBeds || 1}</Text>
                      <Text style={styles.homeDetailLabel}>Beds</Text>
                    </View>
                    <View style={styles.homeDetailBox}>
                      <Feather name="droplet" size={16} color={colors.primary[600]} />
                      <Text style={styles.homeDetailValue}>{homeItem.numBaths || 1}</Text>
                      <Text style={styles.homeDetailLabel}>Baths</Text>
                    </View>
                    <View style={styles.homeDetailBox}>
                      <Feather name="users" size={16} color={colors.primary[600]} />
                      <Text style={styles.homeDetailValue}>{homeItem.cleanersNeeded || 1}</Text>
                      <Text style={styles.homeDetailLabel}>Cleaners</Text>
                    </View>
                  </View>
                </View>

                {/* Linens Row */}
                <View style={styles.homeSection}>
                  <Text style={styles.homeSectionLabel}>Linens</Text>
                  <View style={styles.homeLinensRow}>
                    <View style={[
                      styles.homeLinenChip,
                      homeItem.sheetsProvided && styles.homeLinenChipActive,
                    ]}>
                      <Feather
                        name={homeItem.sheetsProvided ? "check" : "x"}
                        size={12}
                        color={homeItem.sheetsProvided ? colors.success[600] : colors.neutral[400]}
                      />
                      <Text style={[
                        styles.homeLinenText,
                        homeItem.sheetsProvided && styles.homeLinenTextActive,
                      ]}>Sheets</Text>
                    </View>
                    <View style={[
                      styles.homeLinenChip,
                      homeItem.towelsProvided && styles.homeLinenChipActive,
                    ]}>
                      <Feather
                        name={homeItem.towelsProvided ? "check" : "x"}
                        size={12}
                        color={homeItem.towelsProvided ? colors.success[600] : colors.neutral[400]}
                      />
                      <Text style={[
                        styles.homeLinenText,
                        homeItem.towelsProvided && styles.homeLinenTextActive,
                      ]}>Towels</Text>
                    </View>
                  </View>
                </View>

                {/* Access Info */}
                {(homeItem.keyPadCode || homeItem.keyLocation) && (
                  <View style={styles.homeSection}>
                    <Text style={styles.homeSectionLabel}>Access</Text>
                    <View style={styles.homeAccessRow}>
                      {homeItem.keyPadCode && (
                        <View style={styles.homeAccessItem}>
                          <Feather name="lock" size={14} color={colors.neutral[500]} />
                          <Text style={styles.homeAccessText}>Code: {homeItem.keyPadCode}</Text>
                        </View>
                      )}
                      {homeItem.keyLocation && (
                        <View style={styles.homeAccessItem}>
                          <Feather name="map-pin" size={14} color={colors.neutral[500]} />
                          <Text style={styles.homeAccessText}>{homeItem.keyLocation}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Pricing for this home */}
                <View style={styles.homePricingSection}>
                  <View style={styles.homePricingHeader}>
                    <Text style={styles.homeSectionLabel}>Pricing</Text>
                  </View>
                  {editingPriceHomeId === homeItem.id ? (
                    <View style={styles.homePriceEditContainer}>
                      <View style={styles.homePriceInputRow}>
                        <Text style={styles.homePriceDollar}>$</Text>
                        <TextInput
                          style={styles.homePriceInput}
                          value={priceInput}
                          onChangeText={setPriceInput}
                          keyboardType="decimal-pad"
                          autoFocus
                        />
                      </View>
                      <View style={styles.homePriceActions}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.homePriceSaveBtn,
                            pressed && styles.homePriceSaveBtnPressed,
                            savingPrice && styles.homePriceBtnDisabled,
                          ]}
                          onPress={() => handleSavePrice(homeItem.id)}
                          disabled={savingPrice}
                        >
                          {savingPrice ? (
                            <ActivityIndicator size="small" color={colors.neutral[0]} />
                          ) : (
                            <>
                              <Feather name="check" size={14} color={colors.neutral[0]} />
                              <Text style={styles.homePriceSaveBtnText}>Save</Text>
                            </>
                          )}
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            styles.homePriceCancelBtn,
                            pressed && styles.homePriceCancelBtnPressed,
                          ]}
                          onPress={() => setEditingPriceHomeId(null)}
                        >
                          <Feather name="x" size={14} color={colors.neutral[600]} />
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.homePricingContent}>
                      <View style={styles.homePriceDisplay}>
                        <Text style={styles.homePriceLabel}>Default Price</Text>
                        <Text style={styles.homePriceValue}>
                          ${homeItem.defaultPrice || cleanerClient.defaultPrice || "0"}
                        </Text>
                      </View>
                      <Pressable
                        style={({ pressed }) => [
                          styles.homePriceEditBtn,
                          pressed && styles.homePriceEditBtnPressed,
                        ]}
                        onPress={() => {
                          setPriceInput((homeItem.defaultPrice || cleanerClient.defaultPrice || 0).toString());
                          setEditingPriceHomeId(homeItem.id);
                        }}
                      >
                        <Feather name="edit-2" size={14} color={colors.primary[600]} />
                        <Text style={styles.homePriceEditBtnText}>Edit</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            ))}

            {/* Show single home for active clients with no homes array (fallback) */}
            {!isPending && homes.length === 0 && home && (
              <View style={styles.homeCard}>
                {/* Home Header */}
                <View style={styles.homeCardHeader}>
                  <View style={styles.homeCardLabel}>
                    <Feather name="home" size={14} color={colors.primary[600]} />
                    <Text style={styles.homeCardLabelText}>
                      Home 1{home.nickName ? `: ${home.nickName}` : ""}
                    </Text>
                  </View>
                </View>

                {/* Address */}
                <View style={styles.homeSection}>
                  <Text style={styles.homeSectionLabel}>Address</Text>
                  <Text style={styles.homeAddressText}>
                    {home.address || "No address"}
                  </Text>
                  <Text style={styles.homeAddressSubtext}>
                    {[home.city, home.state, home.zipcode]
                      .filter(Boolean)
                      .join(", ")}
                  </Text>
                </View>

                {/* Property Details Grid */}
                <View style={styles.homeSection}>
                  <Text style={styles.homeSectionLabel}>Property Details</Text>
                  <View style={styles.homeDetailsGrid}>
                    <View style={styles.homeDetailBox}>
                      <Feather name="moon" size={16} color={colors.primary[600]} />
                      <Text style={styles.homeDetailValue}>{home.numBeds || 1}</Text>
                      <Text style={styles.homeDetailLabel}>Beds</Text>
                    </View>
                    <View style={styles.homeDetailBox}>
                      <Feather name="droplet" size={16} color={colors.primary[600]} />
                      <Text style={styles.homeDetailValue}>{home.numBaths || 1}</Text>
                      <Text style={styles.homeDetailLabel}>Baths</Text>
                    </View>
                    <View style={styles.homeDetailBox}>
                      <Feather name="users" size={16} color={colors.primary[600]} />
                      <Text style={styles.homeDetailValue}>{home.cleanersNeeded || 1}</Text>
                      <Text style={styles.homeDetailLabel}>Cleaners</Text>
                    </View>
                  </View>
                </View>

                {/* Linens Row */}
                <View style={styles.homeSection}>
                  <Text style={styles.homeSectionLabel}>Linens</Text>
                  <View style={styles.homeLinensRow}>
                    <View style={[
                      styles.homeLinenChip,
                      home.sheetsProvided && styles.homeLinenChipActive,
                    ]}>
                      <Feather
                        name={home.sheetsProvided ? "check" : "x"}
                        size={12}
                        color={home.sheetsProvided ? colors.success[600] : colors.neutral[400]}
                      />
                      <Text style={[
                        styles.homeLinenText,
                        home.sheetsProvided && styles.homeLinenTextActive,
                      ]}>Sheets</Text>
                    </View>
                    <View style={[
                      styles.homeLinenChip,
                      home.towelsProvided && styles.homeLinenChipActive,
                    ]}>
                      <Feather
                        name={home.towelsProvided ? "check" : "x"}
                        size={12}
                        color={home.towelsProvided ? colors.success[600] : colors.neutral[400]}
                      />
                      <Text style={[
                        styles.homeLinenText,
                        home.towelsProvided && styles.homeLinenTextActive,
                      ]}>Towels</Text>
                    </View>
                  </View>
                </View>

                {/* Access Info */}
                {(home.keyPadCode || home.keyLocation) && (
                  <View style={styles.homeSection}>
                    <Text style={styles.homeSectionLabel}>Access</Text>
                    <View style={styles.homeAccessRow}>
                      {home.keyPadCode && (
                        <View style={styles.homeAccessItem}>
                          <Feather name="lock" size={14} color={colors.neutral[500]} />
                          <Text style={styles.homeAccessText}>Code: {home.keyPadCode}</Text>
                        </View>
                      )}
                      {home.keyLocation && (
                        <View style={styles.homeAccessItem}>
                          <Feather name="map-pin" size={14} color={colors.neutral[500]} />
                          <Text style={styles.homeAccessText}>{home.keyLocation}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Pricing */}
                <View style={styles.homePricingSection}>
                  <View style={styles.homePricingHeader}>
                    <Text style={styles.homeSectionLabel}>Pricing</Text>
                  </View>
                  {editingPriceHomeId === home.id ? (
                    <View style={styles.homePriceEditContainer}>
                      <View style={styles.homePriceInputRow}>
                        <Text style={styles.homePriceDollar}>$</Text>
                        <TextInput
                          style={styles.homePriceInput}
                          value={priceInput}
                          onChangeText={setPriceInput}
                          keyboardType="decimal-pad"
                          autoFocus
                        />
                      </View>
                      <View style={styles.homePriceActions}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.homePriceSaveBtn,
                            pressed && styles.homePriceSaveBtnPressed,
                            savingPrice && styles.homePriceBtnDisabled,
                          ]}
                          onPress={() => handleSavePrice(home.id)}
                          disabled={savingPrice}
                        >
                          {savingPrice ? (
                            <ActivityIndicator size="small" color={colors.neutral[0]} />
                          ) : (
                            <>
                              <Feather name="check" size={14} color={colors.neutral[0]} />
                              <Text style={styles.homePriceSaveBtnText}>Save</Text>
                            </>
                          )}
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            styles.homePriceCancelBtn,
                            pressed && styles.homePriceCancelBtnPressed,
                          ]}
                          onPress={() => setEditingPriceHomeId(null)}
                        >
                          <Feather name="x" size={14} color={colors.neutral[600]} />
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.homePricingContent}>
                      <View style={styles.homePriceDisplay}>
                        <Text style={styles.homePriceLabel}>Default Price</Text>
                        <Text style={styles.homePriceValue}>
                          ${cleanerClient.defaultPrice || "0"}
                        </Text>
                      </View>
                      <Pressable
                        style={({ pressed }) => [
                          styles.homePriceEditBtn,
                          pressed && styles.homePriceEditBtnPressed,
                        ]}
                        onPress={() => {
                          setPriceInput((cleanerClient.defaultPrice || 0).toString());
                          setEditingPriceHomeId(home.id);
                        }}
                      >
                        <Feather name="edit-2" size={14} color={colors.primary[600]} />
                        <Text style={styles.homePriceEditBtnText}>Edit</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            )}

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
                <AppointmentCard key={apt.id} appointment={apt} homes={homes} />
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
              markingType="custom"
              theme={{
                backgroundColor: colors.neutral[0],
                calendarBackground: colors.neutral[0],
                textSectionTitleColor: colors.neutral[500],
                selectedDayBackgroundColor: colors.primary[600],
                selectedDayTextColor: colors.neutral[0],
                todayTextColor: colors.primary[600],
                todayBackgroundColor: colors.primary[50],
                dayTextColor: colors.text.primary,
                textDisabledColor: colors.neutral[300],
                dotColor: colors.primary[600],
                selectedDotColor: colors.neutral[0],
                arrowColor: colors.primary[600],
                monthTextColor: colors.text.primary,
                textDayFontWeight: "500",
                textMonthFontWeight: typography.fontWeight.bold,
                textDayHeaderFontWeight: typography.fontWeight.semibold,
                textDayFontSize: 15,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 13,
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
                  // Build message showing all appointments for the day
                  const appointmentDetails = dayAppointments.map((apt) => {
                    const homeIndex = homes.findIndex(h => h.id === apt.home?.id);
                    const homeLabel = apt.home?.nickName || (homeIndex >= 0 ? `Home ${homeIndex + 1}` : "Home");
                    return `• ${homeLabel}\n  Time: ${formatTimeConstraint(apt.timeToBeCompleted)}\n  Price: $${apt.price || 0}\n  Status: ${apt.status}`;
                  }).join("\n\n");

                  Alert.alert(
                    `Appointments on ${day.dateString}`,
                    dayAppointments.length === 1
                      ? appointmentDetails.replace("• ", "").replace(/\n  /g, "\n")
                      : appointmentDetails
                  );
                }
              }}
            />
          </View>

          {/* Legend */}
          <View style={styles.legendContainer}>
            <Text style={styles.legendTitle}>Legend</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: colors.success[100] }]}>
                  <Text style={[styles.legendBoxText, { color: colors.success[700] }]}>12</Text>
                </View>
                <Text style={styles.legendText}>Completed</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: colors.warning[100] }]}>
                  <Text style={[styles.legendBoxText, { color: colors.warning[700] }]}>12</Text>
                </View>
                <Text style={styles.legendText}>Upcoming</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: colors.error[100] }]}>
                  <Text style={[styles.legendBoxText, { color: colors.error[700] }]}>12</Text>
                </View>
                <Text style={styles.legendText}>Cancelled</Text>
              </View>
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
        onClose={() => {
          setShowBookModal(false);
          setSelectedHomeForBooking(null);
        }}
        onSuccess={() => {
          setShowBookModal(false);
          setSelectedHomeForBooking(null);
          fetchClientData(); // Refresh to show pending booking
        }}
        client={cleanerClientWithUser}
        token={state?.currentUser?.token}
        homes={homes}
        selectedHome={selectedHomeForBooking}
      />

      {/* Setup Recurring Modal */}
      <SetupRecurringModal
        visible={showRecurringModal}
        onClose={() => {
          setShowRecurringModal(false);
          setSelectedHomeForBooking(null);
        }}
        onSuccess={() => {
          setShowRecurringModal(false);
          setSelectedHomeForBooking(null);
          fetchClientData();
        }}
        client={cleanerClientWithUser}
        token={state?.currentUser?.token}
        selectedHome={selectedHomeForBooking}
      />

      {/* Home Picker Modal */}
      <HomePickerModal
        visible={showHomePicker}
        onClose={() => {
          setShowHomePicker(false);
          setHomePickerAction(null);
        }}
        homes={homes}
        onSelectHome={handleHomeSelected}
        actionType={homePickerAction}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
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
    paddingTop: spacing.xl,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    gap: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
  },
  headerEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
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

  // Action Bar (below header)
  actionBar: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  actionBarButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  actionBarButtonPrimary: {
    backgroundColor: colors.primary[600],
    ...shadows.sm,
  },
  actionBarButtonPrimaryPressed: {
    backgroundColor: colors.primary[700],
  },
  actionBarButtonSecondary: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  actionBarButtonSecondaryPressed: {
    backgroundColor: colors.primary[100],
  },
  actionBarButtonTextPrimary: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  actionBarButtonTextSecondary: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },

  // Status Badge
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "transparent",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing["3xl"],
  },

  // Cards
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius["2xl"],
    borderWidth: 1,
    borderColor: colors.neutral[100],
    ...shadows.sm,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  cardBody: {
    padding: spacing.lg,
  },

  // Edit button
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  editButtonPressed: {
    backgroundColor: colors.primary[100],
  },
  editButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },

  // Save button
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.success[600],
    minWidth: 80,
    justifyContent: "center",
    ...shadows.sm,
  },
  saveButtonPressed: {
    backgroundColor: colors.success[700],
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },

  // Home Card Styles
  homeCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  homeCardBorder: {
    marginTop: spacing.md,
  },
  homeCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  homeCardLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  homeCardLabelText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  homeSection: {
    marginBottom: spacing.lg,
  },
  homeSectionLabel: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  homeAddressText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  homeAddressSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  homeDetailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  homeDetailBox: {
    flex: 1,
    minWidth: 70,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  homeDetailValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  homeDetailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  homeLinensRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  homeLinenChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  homeLinenChipActive: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[200],
  },
  homeLinenText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    fontWeight: typography.fontWeight.medium,
  },
  homeLinenTextActive: {
    color: colors.success[700],
  },
  homeTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  homeTimeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  homeAccessRow: {
    gap: spacing.sm,
  },
  homeAccessItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  homeAccessText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  homePricingSection: {
    marginTop: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  homePricingHeader: {
    marginBottom: spacing.sm,
  },
  homePricingContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.success[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success[100],
  },
  homePriceDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  homePriceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },
  homePriceValue: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  homePriceEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
  },
  homePriceEditBtnPressed: {
    backgroundColor: colors.primary[100],
  },
  homePriceEditBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  homePriceEditContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  homePriceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[300],
  },
  homePriceDollar: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  homePriceInput: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    minWidth: 80,
  },
  homePriceActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  homePriceSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.success[600],
    borderRadius: radius.md,
  },
  homePriceSaveBtnPressed: {
    backgroundColor: colors.success[700],
  },
  homePriceSaveBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[0],
  },
  homePriceCancelBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[200],
    borderRadius: radius.md,
  },
  homePriceCancelBtnPressed: {
    backgroundColor: colors.neutral[300],
  },
  homePriceBtnDisabled: {
    opacity: 0.7,
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

  // Notes
  notesInput: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 100,
    lineHeight: 24,
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },

  // Appointment Tabs
  appointmentTabs: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.neutral[50],
  },
  appointmentTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  appointmentTabActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  appointmentTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  appointmentTabTextActive: {
    color: colors.neutral[0],
  },

  // Appointments List
  appointmentsList: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  appointmentCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  appointmentCardExpanded: {
    backgroundColor: colors.neutral[0],
    borderWidth: 2,
    borderColor: colors.primary[200],
    ...shadows.md,
  },
  appointmentCardPressed: {
    backgroundColor: colors.neutral[50],
  },
  appointmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  appointmentCardLeft: {
    flex: 1,
  },
  appointmentDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 2,
  },
  appointmentDate: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  appointmentHomeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.primary[50],
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
  },
  appointmentHomeTagText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  appointmentDetails: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  appointmentCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  appointmentPrice: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },

  // Expanded Appointment Details
  appointmentExpanded: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  appointmentStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  appointmentStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  appointmentStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  appointmentFullDate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  appointmentDetailsGrid: {
    gap: spacing.md,
  },
  appointmentDetailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  appointmentDetailIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  appointmentDetailContent: {
    flex: 1,
  },
  appointmentDetailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  appointmentDetailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  appointmentDetailSubvalue: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 1,
  },
  appointmentDetailPrice: {
    color: colors.success[600],
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.lg,
  },
  appointmentLinensRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  appointmentLinenChip: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.sm,
  },
  appointmentLinenChipActive: {
    backgroundColor: colors.success[50],
  },
  appointmentLinenChipText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
  appointmentLinenChipTextActive: {
    color: colors.success[700],
  },
  appointmentNotes: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.warning[50],
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning[400],
  },
  appointmentNotesLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
    marginBottom: spacing.xs,
  },
  appointmentNotesText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[800],
    lineHeight: 20,
  },

  // Empty Appointments
  emptyAppointments: {
    alignItems: "center",
    padding: spacing["2xl"],
    gap: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    margin: spacing.sm,
  },
  emptyAppointmentsText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[400],
    fontWeight: typography.fontWeight.medium,
  },

  // Calendar
  calendarContainer: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
  },
  legendContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    marginTop: spacing.sm,
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  legendBox: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  legendBoxText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  legendText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
});

export default ClientDetailPage;
