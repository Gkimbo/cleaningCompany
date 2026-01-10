import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import { AuthContext } from "../../services/AuthContext";
import {
  colors,
  spacing,
  radius,
  shadows,
  typography,
} from "../../services/styles/theme";
import { API_BASE } from "../../services/config";
import CalendarSyncDisclaimerModal from "./CalendarSyncDisclaimerModal";
import CalendarSyncDisclaimerView from "./CalendarSyncDisclaimerView";

const baseURL = API_BASE.replace("/api/v1", "");

const PLATFORM_INFO = {
  airbnb: {
    name: "Airbnb",
    color: "#FF5A5F",
    icon: "A",
    instructions:
      "Host Dashboard > Listings > Select listing > Calendar > Availability > Sync calendars > Export calendar",
  },

  vrbo: {
    name: "VRBO",
    color: "#3B5998",
    icon: "V",
    instructions:
      "Dashboard > Calendar > Import & Export > Export calendar (copy iCal URL)",
  },

  booking: {
    name: "Booking.com",
    color: "#003580",
    icon: "B",
    instructions:
      "Extranet > Rates & Availability > Calendar > Sync calendars > Export calendar",
  },

  tripAdvisor: {
    name: "Tripadvisor Rentals",
    color: "#00AF87",
    icon: "T",
    instructions:
      "Owner Dashboard > Calendar > Calendar Sync or Export calendar (iCal URL)",
  },

  nineFlats: {
    name: "9flats",
    color: "#FF5A5F",
    icon: "9",
    instructions:
      "Host Dashboard > Calendar > iCal / Synchronization > Export calendar",
  },

  other: {
    name: "Other",
    color: colors.neutral[500],
    icon: "?",
    instructions:
      "Find your platform’s calendar or availability settings and copy the iCal (.ics) export URL",
  },
};

const CalendarSyncManager = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const { homeId } = useParams();
  const { user } = useContext(AuthContext);

  const [syncs, setSyncs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [daysAfterCheckout, setDaysAfterCheckout] = useState("0");
  const [autoCreate, setAutoCreate] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(null); // null = loading, true/false = known
  const [disclaimerAcceptedAt, setDisclaimerAcceptedAt] = useState(null);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [showDisclaimerView, setShowDisclaimerView] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const home = state.homes?.find((h) => h.id === Number(homeId));

  useEffect(() => {
    if (homeId) {
      fetchSyncs();
    }
  }, [homeId]);

  useEffect(() => {
    fetchDisclaimerStatus();
  }, []);

  const fetchDisclaimerStatus = async () => {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/calendar-sync/disclaimer/status`,
        {
          headers: {
            Authorization: `Bearer ${user?.token}`,
          },
        }
      );
      const data = await response.json();
      if (response.ok) {
        setDisclaimerAccepted(data.accepted);
        setDisclaimerAcceptedAt(data.acceptedAt);
      }
    } catch (err) {
      console.error("Error fetching disclaimer status:", err);
      setDisclaimerAccepted(false);
    }
  };

  const acceptDisclaimer = async () => {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/calendar-sync/disclaimer/accept`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.token}`,
          },
        }
      );
      const data = await response.json();
      if (response.ok) {
        setDisclaimerAccepted(true);
        setDisclaimerAcceptedAt(data.acceptedAt);
        setShowDisclaimerModal(false);
        // Execute pending action if any
        if (pendingAction) {
          pendingAction();
          setPendingAction(null);
        }
      }
    } catch (err) {
      setError("Failed to accept disclaimer. Please try again.");
    }
  };

  const requireDisclaimer = (action) => {
    if (disclaimerAccepted) {
      action();
    } else {
      setPendingAction(() => action);
      setShowDisclaimerModal(true);
    }
  };

  const fetchSyncs = async () => {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/calendar-sync/home/${homeId}`,
        {
          headers: {
            Authorization: `Bearer ${user?.token}`,
          },
        }
      );
      const data = await response.json();
      if (response.ok) {
        setSyncs(data.syncs || []);
      }
    } catch (err) {
      console.error("Error fetching syncs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSync = async () => {
    if (!newUrl.trim()) {
      setError("Please enter an iCal URL");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`${baseURL}/api/v1/calendar-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          homeId: Number(homeId),
          icalUrl: newUrl.trim(),
          autoCreateAppointments: autoCreate,
          daysAfterCheckout: parseInt(daysAfterCheckout) || 0,
          autoSync: autoSync,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSyncs([data.sync, ...syncs]);
        setSuccess(data.message);
        setNewUrl("");
        setShowAddForm(false);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(data.error || "Failed to add calendar sync");
      }
    } catch (err) {
      setError("Failed to connect. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSync = async (syncId, isActive) => {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/calendar-sync/${syncId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.token}`,
          },
          body: JSON.stringify({ isActive: !isActive }),
        }
      );

      if (response.ok) {
        setSyncs(
          syncs.map((s) =>
            s.id === syncId ? { ...s, isActive: !isActive } : s
          )
        );
      }
    } catch (err) {
      Alert.alert("Error", "Failed to update sync");
    }
  };

  const handleDeleteSync = async (syncId) => {
    Alert.alert(
      "Remove Calendar",
      "Are you sure you want to disconnect this calendar?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(
                `${baseURL}/api/v1/calendar-sync/${syncId}`,
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${user?.token}`,
                  },
                }
              );

              if (response.ok) {
                setSyncs(syncs.filter((s) => s.id !== syncId));
              }
            } catch (err) {
              Alert.alert("Error", "Failed to remove calendar");
            }
          },
        },
      ]
    );
  };

  const handleManualSync = async (syncId) => {
    setSyncingId(syncId);

    try {
      const response = await fetch(
        `${baseURL}/api/v1/calendar-sync/${syncId}/sync`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${user?.token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setSuccess(
          `Sync complete! Found ${data.checkoutsFound} checkouts, created ${data.appointmentsCreated} new appointments.`
        );
        fetchSyncs(); // Refresh to update lastSyncAt
        setTimeout(() => setSuccess(null), 5000);
      } else {
        Alert.alert("Sync Failed", data.error);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to sync calendar");
    } finally {
      setSyncingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  const detectPlatformFromUrl = (url) => {
    if (!url) return "other";
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("airbnb")) return "airbnb";
    if (lowerUrl.includes("vrbo") || lowerUrl.includes("homeaway"))
      return "vrbo";
    if (lowerUrl.includes("booking.com")) return "booking";
    return "other";
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigate(`/details/${homeId}`)}
        >
          <Text style={styles.backButtonText}>{"<"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Calendar Sync</Text>
        <TouchableOpacity
          style={styles.infoButton}
          onPress={() => setShowDisclaimerView(true)}
        >
          <Text style={styles.infoButtonText}>i</Text>
        </TouchableOpacity>
      </View>

      {home && (
        <Text style={styles.homeLabel}>{home.nickName || home.address}</Text>
      )}

      <Text style={styles.subtitle}>
        Connect your Airbnb, VRBO, or other rental calendar to automatically
        create cleaning appointments after each checkout.
      </Text>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {success && (
        <View style={styles.successContainer}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      )}

      {/* Connected Calendars */}
      {syncs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Calendars</Text>
          {syncs.map((sync) => {
            const platformInfo =
              PLATFORM_INFO[sync.platform] || PLATFORM_INFO.other;
            return (
              <View key={sync.id} style={styles.syncCard}>
                <View style={styles.syncHeader}>
                  <View
                    style={[
                      styles.platformIcon,
                      { backgroundColor: platformInfo.color },
                    ]}
                  >
                    <Text style={styles.platformIconText}>
                      {platformInfo.icon}
                    </Text>
                  </View>
                  <View style={styles.syncInfo}>
                    <Text style={styles.syncPlatform}>{platformInfo.name}</Text>
                    <Text style={styles.syncStatus}>
                      {sync.isActive ? "Active" : "Paused"} • Last sync:{" "}
                      {formatDate(sync.lastSyncAt)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      sync.isActive && styles.toggleButtonActive,
                    ]}
                    onPress={() => handleToggleSync(sync.id, sync.isActive)}
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        sync.isActive && styles.toggleKnobActive,
                      ]}
                    />
                  </TouchableOpacity>
                </View>

                {sync.lastSyncStatus === "error" && (
                  <View style={styles.syncError}>
                    <Text style={styles.syncErrorText}>
                      {sync.lastSyncError || "Sync error"}
                    </Text>
                  </View>
                )}

                <View style={styles.syncDetails}>
                  <Text style={styles.syncDetailText}>
                    Cleaning:{" "}
                    {sync.daysAfterCheckout === 0
                      ? "Same day as checkout"
                      : `${sync.daysAfterCheckout} day(s) after checkout`}
                  </Text>
                  <Text style={styles.syncDetailText}>
                    Auto-create appointments:{" "}
                    {sync.autoCreateAppointments ? "Yes" : "No"}
                  </Text>
                  <Text style={styles.syncDetailText}>
                    Auto-sync every hour: {sync.autoSync ? "Yes" : "No"}
                  </Text>
                </View>

                <View style={styles.syncActions}>
                  <TouchableOpacity
                    style={styles.syncButton}
                    onPress={() => handleManualSync(sync.id)}
                    disabled={syncingId === sync.id}
                  >
                    {syncingId === sync.id ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primary[600]}
                      />
                    ) : (
                      <Text style={styles.syncButtonText}>Sync Now</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteSync(sync.id)}
                  >
                    <Text style={styles.deleteButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Add New Calendar */}
      {!showAddForm ? (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => requireDisclaimer(() => setShowAddForm(true))}
        >
          <Text style={styles.addButtonText}>+ Connect a Calendar</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.addForm}>
          <Text style={styles.sectionTitle}>Connect New Calendar</Text>

          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsTitle}>
              How to get your calendar URL:
            </Text>
            <Text style={styles.instructionsText}>
              1. Log into your rental platform (Airbnb, VRBO, etc.){"\n"}
              2. Go to your listing's calendar settings{"\n"}
              3. Look for "Export calendar" or "Sync calendars"{"\n"}
              4. Copy the iCal URL (it usually ends in .ics)
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>iCal URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://www.airbnb.com/calendar/ical/..."
              value={newUrl}
              onChangeText={setNewUrl}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
            {newUrl && (
              <View style={styles.detectedPlatform}>
                <Text style={styles.detectedPlatformText}>
                  Detected:{" "}
                  {PLATFORM_INFO[detectPlatformFromUrl(newUrl)]?.name ||
                    "Unknown"}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Schedule cleaning</Text>
            <View style={styles.choiceRow}>
              {["0", "1"].map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.choiceButton,
                    daysAfterCheckout === value && styles.choiceButtonSelected,
                  ]}
                  onPress={() => setDaysAfterCheckout(value)}
                >
                  <Text
                    style={[
                      styles.choiceButtonText,
                      daysAfterCheckout === value &&
                        styles.choiceButtonTextSelected,
                    ]}
                  >
                    {value === "0" ? "Checkout day" : "Day after"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.toggleCard, autoCreate && styles.toggleCardActive]}
            onPress={() => setAutoCreate(!autoCreate)}
          >
            <View style={styles.toggleCardContent}>
              <Text style={styles.toggleCardTitle}>
                Auto-create appointments
              </Text>
              <Text style={styles.toggleCardDescription}>
                Automatically add cleaning appointments when new bookings are
                detected
              </Text>
            </View>
            <View
              style={[
                styles.toggleSwitch,
                autoCreate && styles.toggleSwitchActive,
              ]}
            >
              <View
                style={[
                  styles.toggleSwitchKnob,
                  autoCreate && styles.toggleSwitchKnobActive,
                ]}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleCard, autoSync && styles.toggleCardActive]}
            onPress={() => setAutoSync(!autoSync)}
          >
            <View style={styles.toggleCardContent}>
              <Text style={styles.toggleCardTitle}>Auto-sync every hour</Text>
              <Text style={styles.toggleCardDescription}>
                Automatically check for new bookings and update appointments
                every hour
              </Text>
            </View>
            <View
              style={[
                styles.toggleSwitch,
                autoSync && styles.toggleSwitchActive,
              ]}
            >
              <View
                style={[
                  styles.toggleSwitchKnob,
                  autoSync && styles.toggleSwitchKnobActive,
                ]}
              />
            </View>
          </TouchableOpacity>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowAddForm(false);
                setNewUrl("");
                setError(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.buttonDisabled]}
              onPress={handleAddSync}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.neutral[0]} />
              ) : (
                <Text style={styles.saveButtonText}>Connect Calendar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Empty state */}
      {syncs.length === 0 && !showAddForm && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>📅</Text>
          </View>
          <Text style={styles.emptyTitle}>No Calendars Connected</Text>
          <Text style={styles.emptyDescription}>
            Connect your Airbnb or VRBO calendar to automatically schedule
            cleanings after guest checkouts.
          </Text>
        </View>
      )}

      {/* Disclaimer Modal */}
      <CalendarSyncDisclaimerModal
        visible={showDisclaimerModal}
        onAccept={acceptDisclaimer}
        onCancel={() => {
          setShowDisclaimerModal(false);
          setPendingAction(null);
        }}
      />

      {/* Disclaimer View (read-only) */}
      <CalendarSyncDisclaimerView
        visible={showDisclaimerView}
        onClose={() => setShowDisclaimerView(false)}
        acceptedAt={disclaimerAcceptedAt}
      />
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
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
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primary[300],
  },
  infoButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  homeLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  errorContainer: {
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },
  successContainer: {
    backgroundColor: colors.success[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  successText: {
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
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
  syncCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  syncHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  platformIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  platformIconText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  syncInfo: {
    flex: 1,
  },
  syncPlatform: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  syncStatus: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  toggleButton: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral[300],
    padding: 2,
    justifyContent: "center",
  },
  toggleButtonActive: {
    backgroundColor: colors.success[500],
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.neutral[0],
    ...shadows.sm,
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
  syncError: {
    backgroundColor: colors.error[50],
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  syncErrorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.xs,
  },
  syncDetails: {
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  syncDetailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  syncActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  syncButton: {
    flex: 1,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  syncButtonText: {
    color: colors.primary[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  deleteButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  deleteButtonText: {
    color: colors.error[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
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
  addForm: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadows.lg,
  },
  instructionsBox: {
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },
  instructionsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[800],
    marginBottom: spacing.sm,
  },
  instructionsText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    minHeight: 60,
  },
  detectedPlatform: {
    marginTop: spacing.sm,
  },
  detectedPlatformText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
  },
  choiceRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  choiceButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[50],
    borderWidth: 2,
    borderColor: colors.border.light,
    alignItems: "center",
  },
  choiceButtonSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  choiceButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  choiceButtonTextSelected: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutral[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  toggleCardActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  toggleCardContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleCardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  toggleCardDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral[300],
    padding: 2,
    justifyContent: "center",
  },
  toggleSwitchActive: {
    backgroundColor: colors.primary[500],
  },
  toggleSwitchKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.neutral[0],
    ...shadows.sm,
  },
  toggleSwitchKnobActive: {
    alignSelf: "flex-end",
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  cancelButtonText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.md,
  },
  saveButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  buttonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyIconText: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    lineHeight: 22,
  },
});

export default CalendarSyncManager;
