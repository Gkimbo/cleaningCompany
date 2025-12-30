import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import MultiAspectReviewForm from "../reviews/MultiAspectReviewForm";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { API_BASE } from "../../services/config";

const TodaysCleaningCard = ({ appointment, home, state, onReviewSubmitted }) => {
  const navigate = useNavigate();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [cleaningStatus, setCleaningStatus] = useState("not_started");
  const [assignedCleaners, setAssignedCleaners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCleaningStatus();
  }, [appointment.id]);

  const fetchCleaningStatus = async () => {
    try {
      // Check if cleaning has started by looking at before photos
      const response = await fetch(
        `${API_BASE}/api/v1/job-photos/${appointment.id}/status`,
        {
          headers: {
            Authorization: `Bearer ${state.currentUser.token}`,
          },
        }
      );
      const data = await response.json();

      if (appointment.completed) {
        setCleaningStatus("completed");
      } else if (data.hasBeforePhotos) {
        setCleaningStatus("in_progress");
      } else {
        setCleaningStatus("not_started");
      }

      // Fetch assigned cleaners info
      if (appointment.employeesAssigned && appointment.employeesAssigned.length > 0) {
        const cleanerPromises = appointment.employeesAssigned.map(async (cleanerId) => {
          const cleanerRes = await fetch(
            `${API_BASE}/api/v1/employee-info/cleaner/${cleanerId}`,
            {
              headers: {
                Authorization: `Bearer ${state.currentUser.token}`,
              },
            }
          );
          return cleanerRes.json();
        });
        const cleanerResults = await Promise.all(cleanerPromises);
        setAssignedCleaners(cleanerResults.map(r => r.cleaner).filter(Boolean));
      }
    } catch (error) {
      console.error("Error fetching cleaning status:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = () => {
    switch (cleaningStatus) {
      case "not_started":
        return {
          icon: "clock-o",
          color: colors.neutral[400],
          bgColor: colors.neutral[100],
          text: "Not Started Yet",
          description: "Your cleaner hasn't started yet",
        };
      case "in_progress":
        return {
          icon: "spinner",
          color: colors.primary[500],
          bgColor: colors.primary[50],
          text: "In Progress",
          description: "Your home is being cleaned",
        };
      case "completed":
        return {
          icon: "check-circle",
          color: colors.success[500],
          bgColor: colors.success[50],
          text: "Completed",
          description: "Your cleaning is complete!",
        };
      default:
        return {
          icon: "question",
          color: colors.neutral[400],
          bgColor: colors.neutral[100],
          text: "Unknown",
          description: "",
        };
    }
  };

  const handleReviewComplete = () => {
    setShowReviewModal(false);
    Alert.alert("Thank you!", "Your review has been submitted.");
    if (onReviewSubmitted) {
      onReviewSubmitted(appointment.id);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return "";
    // Handle "10-3" format
    if (timeString.includes("-")) {
      const [start, end] = timeString.split("-");
      const formatHour = (h) => {
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        const displayHour = hour % 12 || 12;
        return `${displayHour}${ampm}`;
      };
      return `${formatHour(start)} - ${formatHour(end)}`;
    }
    return timeString;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
        </View>
      </View>
    );
  }

  const statusInfo = getStatusInfo();

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Icon name="calendar-check-o" size={18} color={colors.primary[600]} />
            <Text style={styles.headerTitle}>Today's Cleaning</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
            <Icon name={statusInfo.icon} size={12} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.homeInfo}>
            <Text style={styles.homeName}>{home?.nickName || "Your Home"}</Text>
            <Text style={styles.homeAddress}>
              {home?.address}, {home?.city}
            </Text>
            {appointment.timeToBeCompleted && (
              <Text style={styles.timeText}>
                <Icon name="clock-o" size={12} color={colors.text.tertiary} />{" "}
                {formatTime(appointment.timeToBeCompleted)}
              </Text>
            )}
          </View>

          {assignedCleaners.length > 0 && (
            <View style={styles.cleanerInfo}>
              <Text style={styles.cleanerLabel}>Your Cleaner:</Text>
              {assignedCleaners.map((cleaner, index) => (
                <Text key={cleaner?.id || index} style={styles.cleanerName}>
                  {cleaner?.username || "Assigned Cleaner"}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.statusDescription}>
            <Text style={styles.descriptionText}>{statusInfo.description}</Text>
          </View>

          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressStep}>
              <View style={[
                styles.progressDot,
                cleaningStatus !== "not_started" && styles.progressDotActive
              ]}>
                <Icon name="home" size={10} color={
                  cleaningStatus !== "not_started" ? colors.neutral[0] : colors.neutral[400]
                } />
              </View>
              <Text style={styles.progressLabel}>Arrived</Text>
            </View>
            <View style={[
              styles.progressLine,
              cleaningStatus === "in_progress" || cleaningStatus === "completed"
                ? styles.progressLineActive : null
            ]} />
            <View style={styles.progressStep}>
              <View style={[
                styles.progressDot,
                cleaningStatus === "in_progress" && styles.progressDotInProgress,
                cleaningStatus === "completed" && styles.progressDotActive
              ]}>
                <Icon name="spray" size={10} color={
                  cleaningStatus === "in_progress" || cleaningStatus === "completed"
                    ? colors.neutral[0] : colors.neutral[400]
                } />
              </View>
              <Text style={styles.progressLabel}>Cleaning</Text>
            </View>
            <View style={[
              styles.progressLine,
              cleaningStatus === "completed" ? styles.progressLineActive : null
            ]} />
            <View style={styles.progressStep}>
              <View style={[
                styles.progressDot,
                cleaningStatus === "completed" && styles.progressDotActive
              ]}>
                <Icon name="check" size={10} color={
                  cleaningStatus === "completed" ? colors.neutral[0] : colors.neutral[400]
                } />
              </View>
              <Text style={styles.progressLabel}>Complete</Text>
            </View>
          </View>

          {/* Review button when completed */}
          {cleaningStatus === "completed" && !appointment.hasClientReview && (
            <Pressable
              style={styles.reviewButton}
              onPress={() => setShowReviewModal(true)}
            >
              <Icon name="star" size={16} color={colors.neutral[0]} />
              <Text style={styles.reviewButtonText}>Leave a Review</Text>
            </Pressable>
          )}

          {appointment.hasClientReview && (
            <View style={styles.reviewedBadge}>
              <Icon name="check-circle" size={14} color={colors.success[600]} />
              <Text style={styles.reviewedText}>Review Submitted</Text>
            </View>
          )}
        </View>
      </View>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.reviewModalContainer}>
          <View style={styles.reviewModalHeader}>
            <TouchableOpacity
              onPress={() => setShowReviewModal(false)}
              style={styles.reviewModalCloseButton}
            >
              <Icon name="times" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.reviewModalTitle}>Review Your Cleaner</Text>
            <View style={styles.reviewModalCloseButton} />
          </View>
          <ScrollView style={styles.reviewModalContent}>
            <MultiAspectReviewForm
              state={state}
              appointmentId={appointment.id}
              userId={assignedCleaners[0]?.id}
              reviewType="homeowner_to_cleaner"
              revieweeName={assignedCleaners[0]?.username || "Your Cleaner"}
              onComplete={handleReviewComplete}
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    ...shadows.md,
    overflow: "hidden",
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.primary[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[100],
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  content: {
    padding: spacing.lg,
  },
  homeInfo: {
    marginBottom: spacing.md,
  },
  homeName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  homeAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  timeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  cleanerInfo: {
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  cleanerLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  cleanerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  statusDescription: {
    marginBottom: spacing.lg,
  },
  descriptionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    fontStyle: "italic",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  progressStep: {
    alignItems: "center",
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  progressDotActive: {
    backgroundColor: colors.success[500],
  },
  progressDotInProgress: {
    backgroundColor: colors.primary[500],
  },
  progressLine: {
    width: 40,
    height: 3,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing.xs,
    marginBottom: spacing.lg,
  },
  progressLineActive: {
    backgroundColor: colors.success[500],
  },
  progressLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  reviewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.warning[500],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  reviewButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  reviewedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.success[50],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  reviewedText: {
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  reviewModalContainer: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  reviewModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  reviewModalCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewModalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  reviewModalContent: {
    flex: 1,
  },
});

export default TodaysCleaningCard;
