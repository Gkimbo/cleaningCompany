import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import BusinessEmployeeService from "../../services/fetchRequests/BusinessEmployeeService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Status configuration
const STATUS_CONFIG = {
  assigned: { bg: colors.primary[100], text: colors.primary[700], label: "Scheduled", icon: "calendar" },
  started: { bg: colors.warning[100], text: colors.warning[700], label: "In Progress", icon: "clock-o" },
  completed: { bg: colors.success[100], text: colors.success[700], label: "Completed", icon: "check-circle" },
  cancelled: { bg: colors.neutral[200], text: colors.neutral[600], label: "Cancelled", icon: "ban" },
  no_show: { bg: colors.error[100], text: colors.error[700], label: "No Show", icon: "times-circle" },
};

// Info Row Component
const InfoRow = ({ icon, label, value, onPress, isLink }) => (
  <Pressable
    style={styles.infoRow}
    onPress={onPress}
    disabled={!onPress}
  >
    <View style={styles.infoIcon}>
      <Icon name={icon} size={16} color={colors.neutral[400]} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, isLink && styles.infoValueLink]}>
        {value}
      </Text>
    </View>
    {onPress && (
      <Icon name="chevron-right" size={14} color={colors.neutral[400]} />
    )}
  </Pressable>
);

// Co-Worker Card Component
const CoWorkerCard = ({ employee, isSelf }) => (
  <View style={[styles.coWorkerCard, isSelf && styles.coWorkerCardSelf]}>
    <View style={[styles.coWorkerAvatar, isSelf && styles.coWorkerAvatarSelf]}>
      <Text style={[styles.coWorkerAvatarText, isSelf && styles.coWorkerAvatarTextSelf]}>
        {(employee.firstName?.[0] || "E").toUpperCase()}
      </Text>
    </View>
    <View style={styles.coWorkerInfo}>
      <Text style={styles.coWorkerName}>
        {employee.firstName} {employee.lastName}
        {isSelf && <Text style={styles.youBadge}> (You)</Text>}
      </Text>
      {employee.phone && (
        <Text style={styles.coWorkerPhone}>{employee.phone}</Text>
      )}
    </View>
    {!isSelf && employee.phone && (
      <Pressable
        style={styles.callButton}
        onPress={() => Linking.openURL(`tel:${employee.phone}`)}
      >
        <Icon name="phone" size={16} color={colors.primary[600]} />
      </Pressable>
    )}
  </View>
);

// Main Component
const EmployeeJobDetail = ({ state }) => {
  const navigate = useNavigate();
  const { assignmentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [flowSettings, setFlowSettings] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchJobFlow = async () => {
    try {
      const flow = await BusinessEmployeeService.getJobFlow(
        state.currentUser.token,
        assignmentId
      );
      setFlowSettings(flow);
    } catch (err) {
      console.error("Error fetching job flow:", err);
    }
  };

  const fetchJobDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await BusinessEmployeeService.getJobDetails(
        state.currentUser.token,
        assignmentId
      );

      if (result?.job) {
        setJob(result.job);
      } else {
        setError("Job not found");
      }
    } catch (err) {
      console.error("Error fetching job details:", err);
      setError("Failed to load job details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobDetails();
    fetchJobFlow();
  }, [assignmentId]);

  const handleStartJob = async () => {
    setActionLoading(true);

    try {
      const result = await BusinessEmployeeService.startJob(
        state.currentUser.token,
        job.id
      );

      if (result.success) {
        Alert.alert("Success", "Job started! Good luck!");
        fetchJobDetails();
      } else {
        Alert.alert("Error", result.error || "Failed to start job");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to start job. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteJob = async () => {
    Alert.alert(
      "Complete Job",
      "Are you sure you want to mark this job as complete?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            setActionLoading(true);

            try {
              const result = await BusinessEmployeeService.completeJob(
                state.currentUser.token,
                job.id
              );

              if (result.success) {
                Alert.alert("Success", "Job completed! Great work!");
                fetchJobDetails();
              } else {
                Alert.alert("Error", result.error || "Failed to complete job");
              }
            } catch (err) {
              Alert.alert("Error", "Failed to complete job. Please try again.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const openMaps = (address) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.google.com/?q=${encodedAddress}`;
    Linking.openURL(url);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours);
    return `${h > 12 ? h - 12 : h}:${minutes} ${h >= 12 ? "PM" : "AM"}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading job details...</Text>
      </View>
    );
  }

  if (error || !job) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-circle" size={48} color={colors.error[400]} />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error || "Job not found"}</Text>
        <Pressable style={styles.retryButton} onPress={() => navigate(-1)}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.assigned;
  const appointment = job.appointment || {};
  const home = appointment.home || {};
  const client = appointment.user || {};
  const coWorkers = job.coWorkers || [];
  const hasCoWorkers = coWorkers.length > 0;

  // Check if job is today
  const isToday = new Date(appointment.date + "T00:00:00").toDateString() === new Date().toDateString();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Job Details</Text>
        <Pressable
          style={styles.calendarButton}
          onPress={() => navigate("/employee/calendar")}
        >
          <Icon name="calendar" size={18} color={colors.primary[600]} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusConfig.bg }]}>
          <Icon name={statusConfig.icon} size={20} color={statusConfig.text} />
          <Text style={[styles.statusText, { color: statusConfig.text }]}>
            {statusConfig.label}
          </Text>
          {isToday && job.status === "assigned" && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>TODAY</Text>
            </View>
          )}
        </View>

        {/* Date & Time Card */}
        <View style={styles.card}>
          <View style={styles.dateTimeHeader}>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeDay}>
                {new Date(appointment.date + "T00:00:00").getDate()}
              </Text>
              <Text style={styles.dateBadgeMonth}>
                {new Date(appointment.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
              </Text>
            </View>
            <View style={styles.dateTimeInfo}>
              <Text style={styles.dateText}>{formatDate(appointment.date)}</Text>
              <Text style={styles.timeText}>
                {formatTime(appointment.startTime)} - {appointment.duration || 2} hours
              </Text>
            </View>
          </View>
        </View>

        {/* Pay Card */}
        {job.payAmount !== undefined && (
          <View style={styles.payCard}>
            <View style={styles.payCardContent}>
              <Text style={styles.payLabel}>Your Pay</Text>
              <Text style={styles.payAmount}>
                ${(job.payAmount / 100).toFixed(2)}
              </Text>
              {job.payType === "hourly" && (
                <Text style={styles.payType}>Hourly rate</Text>
              )}
            </View>
            <View style={styles.payStatusBadge}>
              <Text style={styles.payStatusText}>
                {job.payoutStatus === "paid" ? "Paid" : "Pending"}
              </Text>
            </View>
          </View>
        )}

        {/* Location Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>
          {home.address ? (
            <InfoRow
              icon="map-marker"
              label="Address"
              value={home.address}
              onPress={() => openMaps(home.address)}
              isLink
            />
          ) : (
            <Text style={styles.noDataText}>Address not available</Text>
          )}
          {home.numBeds && (
            <InfoRow
              icon="home"
              label="Home Size"
              value={`${home.numBeds} bedroom, ${home.numBaths} bathroom`}
            />
          )}
          {home.keyPadCode && (
            <InfoRow
              icon="key"
              label="Keypad Code"
              value={home.keyPadCode}
            />
          )}
          {home.keyLocation && (
            <InfoRow
              icon="key"
              label="Key Location"
              value={home.keyLocation}
            />
          )}
          {home.specialNotes && (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Special Instructions</Text>
              <Text style={styles.notesText}>{home.specialNotes}</Text>
            </View>
          )}
        </View>

        {/* Job Notes Card (from flow settings) */}
        {flowSettings?.jobNotes && (
          <View style={styles.jobNotesCard}>
            <View style={styles.jobNotesHeader}>
              <Icon name="sticky-note-o" size={16} color={colors.primary[600]} />
              <Text style={styles.cardTitle}>Instructions from Your Manager</Text>
            </View>
            <Text style={styles.jobNotesText}>{flowSettings.jobNotes}</Text>
          </View>
        )}

        {/* Client Card */}
        {client.firstName && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Client</Text>
            <InfoRow
              icon="user"
              label="Name"
              value={`${client.firstName} ${client.lastName || ""}`}
            />
            {client.phone && (
              <InfoRow
                icon="phone"
                label="Phone"
                value={client.phone}
                onPress={() => Linking.openURL(`tel:${client.phone}`)}
                isLink
              />
            )}
            {client.email && (
              <InfoRow
                icon="envelope"
                label="Email"
                value={client.email}
                onPress={() => Linking.openURL(`mailto:${client.email}`)}
                isLink
              />
            )}
          </View>
        )}

        {/* Team Card - Co-Workers */}
        {hasCoWorkers && (
          <View style={styles.card}>
            <View style={styles.teamHeader}>
              <Text style={styles.cardTitle}>Your Team</Text>
              <View style={styles.teamCountBadge}>
                <Text style={styles.teamCountText}>
                  {coWorkers.length + 1} cleaners
                </Text>
              </View>
            </View>
            <Text style={styles.teamSubtitle}>
              You'll be working with these team members on this job
            </Text>

            {/* Current user first */}
            <CoWorkerCard
              employee={{
                firstName: job.currentEmployee?.firstName || "You",
                lastName: job.currentEmployee?.lastName || "",
              }}
              isSelf={true}
            />

            {/* Other co-workers */}
            {coWorkers.map((worker, index) => (
              <CoWorkerCard key={worker.id || index} employee={worker} isSelf={false} />
            ))}
          </View>
        )}

        {/* Job Timeline */}
        {(job.startedAt || job.completedAt) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Timeline</Text>
            {job.assignedAt && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: colors.primary[500] }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Assigned</Text>
                  <Text style={styles.timelineTime}>
                    {new Date(job.assignedAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
            {job.startedAt && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: colors.warning[500] }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Started</Text>
                  <Text style={styles.timelineTime}>
                    {new Date(job.startedAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
            {job.completedAt && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: colors.success[500] }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Completed</Text>
                  <Text style={styles.timelineTime}>
                    {new Date(job.completedAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Action Buttons */}
      {((job.status === "assigned" && isToday) || job.status === "started") && (
        <View style={styles.actionBar}>
          {job.status === "assigned" && isToday && (
            <Pressable
              style={[styles.startButton, actionLoading && styles.buttonDisabled]}
              onPress={handleStartJob}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="play" size={18} color="#fff" />
                  <Text style={styles.startButtonText}>Start Job</Text>
                </>
              )}
            </Pressable>
          )}
          {job.status === "started" && (
            <Pressable
              style={[styles.completeButton, actionLoading && styles.buttonDisabled]}
              onPress={handleCompleteJob}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="check" size={18} color="#fff" />
                  <Text style={styles.completeButtonText}>Complete Job</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorTitle: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  errorText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: typography.fontWeight.semibold,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  calendarButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  statusText: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  todayBadge: {
    marginLeft: spacing.md,
    backgroundColor: colors.secondary[500],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  todayBadgeText: {
    color: "#fff",
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  card: {
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  dateTimeHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  dateBadgeDay: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  dateBadgeMonth: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    textTransform: "uppercase",
  },
  dateTimeInfo: {
    marginLeft: spacing.lg,
  },
  dateText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  timeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  payCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.success[50],
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  payCardContent: {},
  payLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  payAmount: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  payType: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
  },
  payStatusBadge: {
    backgroundColor: colors.success[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  payStatusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[700],
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  infoContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  infoLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  infoValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginTop: 2,
  },
  infoValueLink: {
    color: colors.primary[600],
  },
  noDataText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  notesSection: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.warning[50],
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning[400],
  },
  notesLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
    marginBottom: spacing.xs,
  },
  notesText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[800],
    lineHeight: 20,
  },
  jobNotesCard: {
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
    ...shadows.sm,
  },
  jobNotesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  jobNotesText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 22,
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.md,
  },
  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  teamCountBadge: {
    backgroundColor: colors.primary[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  teamCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  teamSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  coWorkerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  coWorkerCardSelf: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  coWorkerAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[200],
    justifyContent: "center",
    alignItems: "center",
  },
  coWorkerAvatarSelf: {
    backgroundColor: colors.primary[200],
  },
  coWorkerAvatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[600],
  },
  coWorkerAvatarTextSelf: {
    color: colors.primary[700],
  },
  coWorkerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  coWorkerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  youBadge: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    color: colors.primary[600],
  },
  coWorkerPhone: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: radius.full,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  timelineLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  timelineTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  bottomPadding: {
    height: 100,
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    ...shadows.lg,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
  },
  startButtonText: {
    marginLeft: spacing.sm,
    color: "#fff",
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success[600],
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
  },
  completeButtonText: {
    marginLeft: spacing.sm,
    color: "#fff",
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

export default EmployeeJobDetail;
