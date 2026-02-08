import React, { useContext, useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import { UserContext } from "../../context/UserContext";
import CleanerApprovalService from "../../services/fetchRequests/CleanerApprovalService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const PendingCleanerApprovals = () => {
  const { state } = useContext(UserContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  const fetchRequests = useCallback(async () => {
    if (!state.currentUser?.token) return;

    try {
      const result = await CleanerApprovalService.getPendingRequests(
        state.currentUser.token
      );
      setRequests(result.requests || []);
    } catch (error) {
      console.error("Error fetching pending requests:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.currentUser?.token]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const handleApprove = async (requestId, cleanerName) => {
    Alert.alert(
      "Approve Cleaner",
      `Are you sure you want to approve ${cleanerName} to join your cleaning job?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            setProcessingId(requestId);
            try {
              const result = await CleanerApprovalService.approveRequest(
                state.currentUser.token,
                requestId
              );
              if (result.success) {
                setRequests((prev) => prev.filter((r) => r.id !== requestId));
                Alert.alert("Success", "Cleaner has been approved and assigned to your job.");
              } else {
                Alert.alert("Error", result.error || "Failed to approve request");
              }
            } catch (error) {
              Alert.alert("Error", "Failed to approve request");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleDecline = async (requestId, cleanerName) => {
    Alert.alert(
      "Decline Cleaner",
      `Are you sure you want to decline ${cleanerName}'s request?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setProcessingId(requestId);
            try {
              const result = await CleanerApprovalService.declineRequest(
                state.currentUser.token,
                requestId
              );
              if (result.success) {
                setRequests((prev) => prev.filter((r) => r.id !== requestId));
                Alert.alert("Done", "Request has been declined.");
              } else {
                Alert.alert("Error", result.error || "Failed to decline request");
              }
            } catch (error) {
              Alert.alert("Error", "Failed to decline request");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString) => {
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
      return `${days} day${days > 1 ? "s" : ""} left`;
    }
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m left`;
    }
    if (diffMins > 0) {
      return `${diffMins}m left`;
    }
    return "Expiring soon";
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderRequest = ({ item }) => {
    const isProcessing = processingId === item.id;

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.cleanerAvatar}>
            <Text style={styles.cleanerInitials}>{getInitials(item.cleanerName)}</Text>
          </View>
          <View style={styles.cleanerInfo}>
            <Text style={styles.cleanerName}>{item.cleanerName}</Text>
            <Text style={styles.requestSubtitle}>Wants to join your cleaning</Text>
          </View>
          <View style={styles.timeBadge}>
            <Icon name="clock-o" size={10} color={colors.warning[600]} />
            <Text style={styles.timeText}>{formatTimeRemaining(item.expiresAt)}</Text>
          </View>
        </View>

        <View style={styles.appointmentInfo}>
          <View style={styles.infoRow}>
            <Icon name="calendar" size={14} color={colors.text.secondary} />
            <Text style={styles.infoText}>{formatDate(item.appointmentDate)}</Text>
          </View>
          {item.homeAddress && (
            <View style={styles.infoRow}>
              <Icon name="map-marker" size={14} color={colors.text.secondary} />
              <Text style={styles.infoText} numberOfLines={1}>
                {item.homeAddress}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.noteBox}>
          <Icon name="info-circle" size={12} color={colors.primary[600]} />
          <Text style={styles.noteText}>
            If you don't respond, the cleaner will be automatically approved in{" "}
            {formatTimeRemaining(item.expiresAt)}.
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <Pressable
            style={[styles.declineButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleDecline(item.id, item.cleanerName)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.error[600]} />
            ) : (
              <>
                <Icon name="times" size={16} color={colors.error[600]} />
                <Text style={styles.declineButtonText}>Decline</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={[styles.approveButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleApprove(item.id, item.cleanerName)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Icon name="check" size={16} color={colors.white} />
                <Text style={styles.approveButtonText}>Approve</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Cleaner Requests</Text>
        <View style={styles.headerSpacer} />
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Icon name="users" size={48} color={colors.neutral[300]} />
          </View>
          <Text style={styles.emptyTitle}>No Pending Requests</Text>
          <Text style={styles.emptyText}>
            When cleaners request to join your multi-cleaner jobs, they'll appear here for
            your approval.
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRequest}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary[500]}
            />
          }
        />
      )}
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
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
  },
  // List
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing["4xl"],
  },
  requestCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  cleanerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
  },
  cleanerInitials: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  cleanerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cleanerName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  requestSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: 4,
  },
  timeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  appointmentInfo: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  noteText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.primary[700],
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  declineButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error[50],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  declineButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[600],
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success[500],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  approveButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default PendingCleanerApprovals;
