import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import * as Location from "expo-location";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import { UserContext } from "../../../context/UserContext";
import GuestNotLeftService from "../../../services/fetchRequests/GuestNotLeftService";

// Modal states
const STATES = {
  INITIAL: "initial",
  SUBMITTING: "submitting",
  WAITING_HOMEOWNER: "waiting_homeowner",
  HOMEOWNER_RESPONDED: "homeowner_responded",
  TIMEOUT: "timeout",
  SELECTING_ACTION: "selecting_action",
  PROCESSING_ACTION: "processing_action",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const TenantPresentModal = ({
  visible,
  onClose,
  appointment,
  home,
  token,
  onCancelled,
  onProceeding,
}) => {
  const { state: userState } = useContext(UserContext);
  const [modalState, setModalState] = useState(STATES.INITIAL);
  const [report, setReport] = useState(null);
  const [notes, setNotes] = useState("");
  const [gpsData, setGpsData] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [pollInterval, setPollInterval] = useState(null);
  const [error, setError] = useState(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setModalState(STATES.INITIAL);
      setReport(null);
      setNotes("");
      setGpsData(null);
      setGpsError(null);
      setError(null);
      setCountdown(null);
      getLocation();
    } else {
      // Clear interval on close
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }
    }
  }, [visible]);

  // Countdown timer for homeowner response
  useEffect(() => {
    if (modalState === STATES.WAITING_HOMEOWNER && report?.responseDeadline) {
      const deadlineTime = new Date(report.responseDeadline).getTime();

      const updateCountdown = () => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((deadlineTime - now) / 1000));
        setCountdown(remaining);

        if (remaining <= 0) {
          setModalState(STATES.TIMEOUT);
        }
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);

      return () => clearInterval(interval);
    }
  }, [modalState, report?.responseDeadline]);

  // Poll for homeowner response while waiting
  useEffect(() => {
    if (modalState === STATES.WAITING_HOMEOWNER && report?.id) {
      const checkForResponse = async () => {
        try {
          const result = await GuestNotLeftService.getReport(token, report.id);
          if (result.success && result.report) {
            if (result.report.homeownerResponse) {
              setReport(result.report);
              setModalState(STATES.HOMEOWNER_RESPONDED);
            } else if (result.report.isResponseExpired) {
              setReport(result.report);
              setModalState(STATES.TIMEOUT);
            }
          }
        } catch (err) {
          console.error("[TenantPresentModal] Poll error:", err);
        }
      };

      const interval = setInterval(checkForResponse, 15000); // Poll every 15 seconds
      setPollInterval(interval);

      return () => clearInterval(interval);
    }
  }, [modalState, report?.id, token]);

  const getLocation = async () => {
    setGpsLoading(true);
    setGpsError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsError("Location permission denied. You can still report, but GPS verification will not be available.");
        setGpsLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setGpsData({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (err) {
      console.error("[TenantPresentModal] GPS error:", err);
      setGpsError("Could not get location. You can still report without GPS verification.");
    }

    setGpsLoading(false);
  };

  const handleSubmitReport = async () => {
    setModalState(STATES.SUBMITTING);
    setError(null);

    try {
      const result = await GuestNotLeftService.reportTenantPresent(
        token,
        appointment.id,
        gpsData,
        notes || null
      );

      if (result.success) {
        setReport(result.report);
        setModalState(STATES.WAITING_HOMEOWNER);
      } else {
        setError(result.error || "Failed to submit report");
        setModalState(STATES.INITIAL);
      }
    } catch (err) {
      console.error("[TenantPresentModal] Submit error:", err);
      setError("An unexpected error occurred");
      setModalState(STATES.INITIAL);
    }
  };

  const handleCleanerAction = async (action) => {
    setModalState(STATES.PROCESSING_ACTION);
    setError(null);

    try {
      let result;

      switch (action) {
        case "wait":
          result = await GuestNotLeftService.cleanerWillWait(token, report.id);
          if (result.success) {
            Alert.alert(
              "Waiting",
              "You've indicated you'll wait on-site. Let us know when the tenant leaves or if you need to cancel."
            );
            setReport(result.report);
            setModalState(STATES.WAITING_HOMEOWNER);
          }
          break;

        case "return":
          result = await GuestNotLeftService.cleanerWillReturn(token, report.id);
          if (result.success) {
            Alert.alert(
              "Come Back Later",
              "You've chosen to return later. Please make sure to return before the time window ends.",
              [{ text: "OK", onPress: onClose }]
            );
            setModalState(STATES.COMPLETED);
            onClose();
          }
          break;

        case "cancel":
          result = await GuestNotLeftService.cleanerCancel(token, report.id);
          if (result.success) {
            setModalState(STATES.CANCELLED);
            setTimeout(() => {
              onCancelled && onCancelled();
            }, 1500);
          }
          break;

        case "proceed":
          result = await GuestNotLeftService.cleanerProceed(token, report.id);
          if (result.success) {
            setModalState(STATES.COMPLETED);
            setTimeout(() => {
              onProceeding && onProceeding();
            }, 1000);
          }
          break;

        default:
          break;
      }

      if (!result?.success) {
        setError(result?.error || "Action failed");
        setModalState(STATES.HOMEOWNER_RESPONDED);
      }
    } catch (err) {
      console.error("[TenantPresentModal] Action error:", err);
      setError("An unexpected error occurred");
      setModalState(STATES.HOMEOWNER_RESPONDED);
    }
  };

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderInitialState = () => (
    <>
      <View style={styles.header}>
        <View style={styles.iconContainerWarning}>
          <Icon name="user-times" size={32} color={colors.warning[600]} />
        </View>
        <Text style={styles.headerTitle}>Tenant Still Present?</Text>
        <Text style={styles.headerSubtitle}>
          Report this issue to notify the homeowner
        </Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.addressBox}>
          <Icon name="map-marker" size={16} color={colors.primary[600]} />
          <View style={styles.addressTextContainer}>
            <Text style={styles.addressText}>{home?.address}</Text>
            <Text style={styles.addressSubtext}>{home?.city}, {home?.state} {home?.zipcode}</Text>
          </View>
        </View>

        {/* GPS Status */}
        <View style={styles.gpsContainer}>
          {gpsLoading ? (
            <View style={styles.gpsRow}>
              <ActivityIndicator size="small" color={colors.primary[600]} />
              <Text style={styles.gpsText}>Getting your location...</Text>
            </View>
          ) : gpsData ? (
            <View style={[styles.gpsRow, styles.gpsSuccess]}>
              <Icon name="check-circle" size={16} color={colors.success[600]} />
              <Text style={styles.gpsSuccessText}>Location verified</Text>
            </View>
          ) : gpsError ? (
            <View style={[styles.gpsRow, styles.gpsWarning]}>
              <Icon name="exclamation-triangle" size={16} color={colors.warning[600]} />
              <Text style={styles.gpsWarningText}>{gpsError}</Text>
            </View>
          ) : null}
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>What happens next?</Text>
          <View style={styles.infoItem}>
            <Icon name="bell" size={14} color={colors.primary[600]} />
            <Text style={styles.infoText}>Homeowner will be notified immediately</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="clock-o" size={14} color={colors.primary[600]} />
            <Text style={styles.infoText}>They have 30 minutes to respond</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="check" size={14} color={colors.primary[600]} />
            <Text style={styles.infoText}>If unresolved, you can cancel with no penalty</Text>
          </View>
        </View>

        {/* Optional Notes */}
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Additional notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="E.g., 'I can see someone inside through the window'"
            placeholderTextColor={colors.text.tertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Icon name="exclamation-circle" size={16} color={colors.error[600]} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onClose}
        >
          <Text style={styles.cancelButtonText}>Go Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.submitButton]}
          onPress={handleSubmitReport}
        >
          <Icon name="exclamation-triangle" size={16} color={colors.neutral[0]} />
          <Text style={styles.submitButtonText}>Report Issue</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSubmittingState = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={colors.primary[600]} />
      <Text style={styles.loadingText}>Submitting report...</Text>
    </View>
  );

  const renderWaitingState = () => (
    <>
      <View style={[styles.header, styles.headerInfo]}>
        <View style={styles.iconContainerInfo}>
          <Icon name="clock-o" size={32} color={colors.primary[600]} />
        </View>
        <Text style={styles.headerTitle}>Waiting for Homeowner</Text>
        <Text style={styles.headerSubtitle}>
          The homeowner has been notified
        </Text>
      </View>

      <View style={styles.content}>
        {/* Countdown */}
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownLabel}>Time remaining for response</Text>
          <Text style={styles.countdownValue}>
            {countdown !== null ? formatCountdown(countdown) : "--:--"}
          </Text>
          <View style={styles.countdownProgress}>
            <View
              style={[
                styles.countdownProgressBar,
                { width: `${(countdown / (30 * 60)) * 100}%` },
              ]}
            />
          </View>
        </View>

        <View style={styles.waitingInfoBox}>
          <Text style={styles.waitingInfoTitle}>While you wait</Text>
          <Text style={styles.waitingInfoText}>
            The homeowner may contact the tenant directly or respond here with next steps.
          </Text>
        </View>

        {/* Options while waiting */}
        <View style={styles.waitingOptionsContainer}>
          <Text style={styles.waitingOptionsTitle}>You can:</Text>

          <TouchableOpacity
            style={styles.waitingOption}
            onPress={() => handleCleanerAction("proceed")}
          >
            <Icon name="check" size={18} color={colors.success[600]} />
            <View style={styles.waitingOptionContent}>
              <Text style={styles.waitingOptionTitle}>Tenant Left</Text>
              <Text style={styles.waitingOptionDesc}>Start the job if they leave</Text>
            </View>
            <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.waitingOption}
            onPress={() => handleCleanerAction("cancel")}
          >
            <Icon name="times-circle" size={18} color={colors.error[600]} />
            <View style={styles.waitingOptionContent}>
              <Text style={styles.waitingOptionTitle}>Cancel Job</Text>
              <Text style={styles.waitingOptionDesc}>No penalty to you or homeowner</Text>
            </View>
            <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  const renderHomeownerResponseState = () => {
    const response = report?.homeownerResponse;
    const additionalTime = report?.additionalTimeRequested;
    const canReturn = report?.canReturn;

    return (
      <>
        <View style={[styles.header, response === "resolved" ? styles.headerSuccess : styles.headerWarning]}>
          <View style={response === "resolved" ? styles.iconContainerSuccess : styles.iconContainerWarning}>
            <Icon
              name={response === "resolved" ? "check-circle" : response === "need_time" ? "clock-o" : "times-circle"}
              size={32}
              color={response === "resolved" ? colors.success[600] : colors.warning[600]}
            />
          </View>
          <Text style={styles.headerTitle}>
            {response === "resolved"
              ? "Tenant Leaving!"
              : response === "need_time"
              ? "More Time Needed"
              : "Cannot Resolve"}
          </Text>
        </View>

        <ScrollView style={styles.content}>
          {response === "resolved" && (
            <View style={styles.responseBox}>
              <Text style={styles.responseText}>
                The homeowner says the tenant is leaving. You can proceed with the cleaning.
              </Text>
              {report?.homeownerResponseNote && (
                <Text style={styles.responseNote}>&ldquo;{report.homeownerResponseNote}&rdquo;</Text>
              )}
            </View>
          )}

          {response === "need_time" && (
            <View style={styles.responseBox}>
              <Text style={styles.responseText}>
                The homeowner needs {additionalTime} more minutes for the tenant to leave.
              </Text>
              {report?.homeownerResponseNote && (
                <Text style={styles.responseNote}>&ldquo;{report.homeownerResponseNote}&rdquo;</Text>
              )}
            </View>
          )}

          {response === "cannot_resolve" && (
            <View style={styles.responseBox}>
              <Text style={styles.responseText}>
                The homeowner cannot resolve this today. The appointment will be cancelled with no penalty.
              </Text>
            </View>
          )}

          {/* Action options */}
          <View style={styles.actionOptionsContainer}>
            <Text style={styles.actionOptionsTitle}>Your options:</Text>

            {response === "resolved" && (
              <TouchableOpacity
                style={[styles.actionOption, styles.actionOptionPrimary]}
                onPress={() => handleCleanerAction("proceed")}
              >
                <Icon name="check" size={18} color={colors.neutral[0]} />
                <Text style={styles.actionOptionPrimaryText}>Start Job</Text>
              </TouchableOpacity>
            )}

            {(response === "need_time" || response === "resolved") && (
              <TouchableOpacity
                style={[styles.actionOption, styles.actionOptionSecondary]}
                onPress={() => handleCleanerAction("wait")}
              >
                <Icon name="clock-o" size={18} color={colors.primary[700]} />
                <Text style={styles.actionOptionSecondaryText}>Wait Here</Text>
              </TouchableOpacity>
            )}

            {canReturn && response !== "cannot_resolve" && (
              <TouchableOpacity
                style={[styles.actionOption, styles.actionOptionSecondary]}
                onPress={() => handleCleanerAction("return")}
              >
                <Icon name="refresh" size={18} color={colors.primary[700]} />
                <Text style={styles.actionOptionSecondaryText}>Come Back Later</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionOption, styles.actionOptionDanger]}
              onPress={() => handleCleanerAction("cancel")}
            >
              <Icon name="times" size={18} color={colors.error[700]} />
              <Text style={styles.actionOptionDangerText}>
                {response === "cannot_resolve" ? "Confirm Cancellation" : "Cancel Appointment"}
              </Text>
            </TouchableOpacity>

            {response !== "cannot_resolve" && (
              <Text style={styles.noPenaltyNote}>
                No penalty to you or the homeowner if cancelled
              </Text>
            )}
          </View>
        </ScrollView>
      </>
    );
  };

  const renderTimeoutState = () => (
    <>
      <View style={[styles.header, styles.headerWarning]}>
        <View style={styles.iconContainerWarning}>
          <Icon name="clock-o" size={32} color={colors.warning[600]} />
        </View>
        <Text style={styles.headerTitle}>No Response</Text>
        <Text style={styles.headerSubtitle}>
          The homeowner did not respond in time
        </Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.timeoutInfoBox}>
          <Text style={styles.timeoutInfoText}>
            You can choose to wait longer, come back later if time allows, or cancel the appointment with no penalty.
          </Text>
        </View>

        <View style={styles.actionOptionsContainer}>
          <Text style={styles.actionOptionsTitle}>Your options:</Text>

          <TouchableOpacity
            style={[styles.actionOption, styles.actionOptionSecondary]}
            onPress={() => handleCleanerAction("wait")}
          >
            <Icon name="clock-o" size={18} color={colors.primary[700]} />
            <Text style={styles.actionOptionSecondaryText}>Wait Longer</Text>
          </TouchableOpacity>

          {report?.canReturn && (
            <TouchableOpacity
              style={[styles.actionOption, styles.actionOptionSecondary]}
              onPress={() => handleCleanerAction("return")}
            >
              <Icon name="refresh" size={18} color={colors.primary[700]} />
              <Text style={styles.actionOptionSecondaryText}>Come Back Later</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionOption, styles.actionOptionDanger]}
            onPress={() => handleCleanerAction("cancel")}
          >
            <Icon name="times" size={18} color={colors.error[700]} />
            <Text style={styles.actionOptionDangerText}>Cancel Appointment</Text>
          </TouchableOpacity>

          <Text style={styles.noPenaltyNote}>
            No penalty to you or the homeowner
          </Text>
        </View>
      </ScrollView>
    </>
  );

  const renderProcessingState = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={colors.primary[600]} />
      <Text style={styles.loadingText}>Processing...</Text>
    </View>
  );

  const renderCompletedState = () => (
    <View style={styles.centerContainer}>
      <View style={styles.iconContainerSuccess}>
        <Icon name="check" size={48} color={colors.success[600]} />
      </View>
      <Text style={styles.completedText}>Done!</Text>
    </View>
  );

  const renderCancelledState = () => (
    <View style={styles.centerContainer}>
      <View style={styles.iconContainerInfo}>
        <Icon name="check-circle" size={48} color={colors.primary[600]} />
      </View>
      <Text style={styles.cancelledText}>Appointment Cancelled</Text>
      <Text style={styles.cancelledSubtext}>No penalty has been applied</Text>
    </View>
  );

  const renderContent = () => {
    switch (modalState) {
      case STATES.INITIAL:
        return renderInitialState();
      case STATES.SUBMITTING:
        return renderSubmittingState();
      case STATES.WAITING_HOMEOWNER:
        return renderWaitingState();
      case STATES.HOMEOWNER_RESPONDED:
        return renderHomeownerResponseState();
      case STATES.TIMEOUT:
        return renderTimeoutState();
      case STATES.PROCESSING_ACTION:
        return renderProcessingState();
      case STATES.COMPLETED:
        return renderCompletedState();
      case STATES.CANCELLED:
        return renderCancelledState();
      default:
        return renderInitialState();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Close button for states that allow it */}
        {[STATES.INITIAL, STATES.WAITING_HOMEOWNER, STATES.HOMEOWNER_RESPONDED, STATES.TIMEOUT].includes(modalState) && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="times" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        )}

        {renderContent()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 80 : 60,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    backgroundColor: colors.warning[50],
  },
  headerInfo: {
    backgroundColor: colors.primary[50],
  },
  headerSuccess: {
    backgroundColor: colors.success[50],
  },
  headerWarning: {
    backgroundColor: colors.warning[50],
  },
  iconContainerWarning: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.warning[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  iconContainerInfo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  iconContainerSuccess: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
  content: {
    flex: 1,
    padding: spacing.xl,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
  },
  completedText: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  cancelledText: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  cancelledSubtext: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  addressBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primary[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  addressSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  gpsContainer: {
    marginBottom: spacing.lg,
  },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[50],
  },
  gpsSuccess: {
    backgroundColor: colors.success[50],
  },
  gpsWarning: {
    backgroundColor: colors.warning[50],
  },
  gpsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  gpsSuccessText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  gpsWarningText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    flex: 1,
  },
  infoBox: {
    backgroundColor: colors.primary[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  infoTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[800],
    marginBottom: spacing.md,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    flex: 1,
  },
  notesContainer: {
    marginBottom: spacing.lg,
  },
  notesLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  notesInput: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: "top",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  cancelButton: {
    backgroundColor: colors.neutral[100],
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  submitButton: {
    backgroundColor: colors.warning[500],
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  countdownContainer: {
    alignItems: "center",
    backgroundColor: colors.primary[50],
    padding: spacing.xl,
    borderRadius: radius.xl,
    marginBottom: spacing.xl,
  },
  countdownLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  countdownValue: {
    fontSize: typography.fontSize["4xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
    marginBottom: spacing.md,
  },
  countdownProgress: {
    width: "100%",
    height: 8,
    backgroundColor: colors.primary[100],
    borderRadius: 4,
    overflow: "hidden",
  },
  countdownProgressBar: {
    height: "100%",
    backgroundColor: colors.primary[500],
    borderRadius: 4,
  },
  waitingInfoBox: {
    backgroundColor: colors.neutral[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
  },
  waitingInfoTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  waitingInfoText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  waitingOptionsContainer: {
    marginTop: spacing.md,
  },
  waitingOptionsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  waitingOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing.md,
  },
  waitingOptionContent: {
    flex: 1,
  },
  waitingOptionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  waitingOptionDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  responseBox: {
    backgroundColor: colors.neutral[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
  },
  responseText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
  responseNote: {
    fontSize: typography.fontSize.sm,
    fontStyle: "italic",
    color: colors.text.secondary,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  actionOptionsContainer: {
    gap: spacing.md,
  },
  actionOptionsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  actionOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  actionOptionPrimary: {
    backgroundColor: colors.success[500],
  },
  actionOptionPrimaryText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  actionOptionSecondary: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  actionOptionSecondaryText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  actionOptionDanger: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  actionOptionDangerText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[700],
  },
  noPenaltyNote: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  timeoutInfoBox: {
    backgroundColor: colors.warning[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  timeoutInfoText: {
    fontSize: typography.fontSize.base,
    color: colors.warning[800],
    lineHeight: 22,
  },
});

export default TenantPresentModal;
