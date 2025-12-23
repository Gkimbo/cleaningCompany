import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import Icon from "react-native-vector-icons/FontAwesome";

const { width: screenWidth } = Dimensions.get("window");
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";
import FetchData from "../../services/fetchRequests/fetchData";

// Status badge component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    pending_homeowner: { label: "Pending Homeowner", color: colors.warning[500], bg: colors.warning[100] },
    approved: { label: "Approved", color: colors.success[600], bg: colors.success[100] },
    denied: { label: "Denied by Homeowner", color: colors.error[600], bg: colors.error[100] },
    pending_owner: { label: "Needs Review", color: colors.warning[600], bg: colors.warning[100] },
    expired: { label: "Expired", color: colors.error[600], bg: colors.error[100] },
    owner_approved: { label: "Owner Approved", color: colors.success[600], bg: colors.success[100] },
    owner_denied: { label: "Owner Denied", color: colors.error[600], bg: colors.error[100] },
  };

  const config = statusConfig[status] || { label: status, color: colors.text.tertiary, bg: colors.neutral[100] };

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

// Adjustment Card Component
const AdjustmentCard = ({ adjustment, onPress }) => {
  const formatDate = (dateString) => {
    const options = { month: "short", day: "numeric", year: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const priceDifference = Number(adjustment.priceDifference) || 0;
  const homeAddress = adjustment.home
    ? `${adjustment.home.address}, ${adjustment.home.city}`
    : "Unknown address";
  const cleanerName = adjustment.cleaner
    ? `${adjustment.cleaner.firstName} ${adjustment.cleaner.lastName}`
    : "Unknown cleaner";
  const homeownerName = adjustment.homeowner
    ? `${adjustment.homeowner.firstName} ${adjustment.homeowner.lastName}`
    : "Unknown homeowner";

  const needsReview = adjustment.status === "denied" || adjustment.status === "expired" || adjustment.status === "pending_owner";

  return (
    <TouchableOpacity
      style={[styles.adjustmentCard, needsReview && styles.adjustmentCardUrgent]}
      onPress={() => onPress(adjustment)}
    >
      <View style={styles.cardHeader}>
        <StatusBadge status={adjustment.status} />
        <Text style={styles.requestId}>#{adjustment.id}</Text>
      </View>

      <Text style={styles.homeAddress} numberOfLines={1}>{homeAddress}</Text>

      <View style={styles.cardInfoRow}>
        <View style={styles.cardInfoItem}>
          <Text style={styles.cardInfoLabel}>Cleaner</Text>
          <Text style={styles.cardInfoValue}>{cleanerName}</Text>
        </View>
        <View style={styles.cardInfoItem}>
          <Text style={styles.cardInfoLabel}>Homeowner</Text>
          <Text style={styles.cardInfoValue}>{homeownerName}</Text>
        </View>
      </View>

      <View style={styles.comparisonRow}>
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonLabel}>On File</Text>
          <Text style={styles.comparisonValue}>
            {adjustment.originalNumBeds}b/{adjustment.originalNumBaths}ba
          </Text>
        </View>
        <Icon name="arrow-right" size={14} color={colors.text.tertiary} />
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonLabel}>Reported</Text>
          <Text style={styles.comparisonValueHighlight}>
            {adjustment.reportedNumBeds}b/{adjustment.reportedNumBaths}ba
          </Text>
        </View>
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonLabel}>Difference</Text>
          <Text style={[styles.comparisonValue, priceDifference > 0 && styles.pricePositive]}>
            {priceDifference > 0 ? `+$${priceDifference.toFixed(2)}` : "$0.00"}
          </Text>
        </View>
      </View>

      {adjustment.appointment && (
        <Text style={styles.appointmentDate}>
          Appointment: {formatDate(adjustment.appointment.date)}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const HomeSizeAdjustmentReview = ({ state }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adjustments, setAdjustments] = useState([]);
  const [selectedAdjustment, setSelectedAdjustment] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filter, setFilter] = useState("needs_review"); // needs_review, all, resolved

  // Resolution form state
  const [finalBeds, setFinalBeds] = useState("");
  const [finalBaths, setFinalBaths] = useState("");
  const [ownerNote, setOwnerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const bedOptions = ["1", "2", "3", "4", "5", "6", "7", "8+"];
  const bathOptions = ["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5+"];

  useEffect(() => {
    if (state.currentUser.token) {
      fetchAdjustments();
    }
  }, [state.currentUser.token]);

  const fetchAdjustments = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await FetchData.getPendingAdjustments(state.currentUser.token);
      if (result.adjustments) {
        setAdjustments(result.adjustments);
      }
    } catch (err) {
      console.error("[HomeSizeAdjustmentReview] Error fetching adjustments:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    fetchAdjustments(true);
  }, [state.currentUser.token]);

  const handleCardPress = (adjustment) => {
    setSelectedAdjustment(adjustment);
    setFinalBeds(adjustment.reportedNumBeds);
    setFinalBaths(adjustment.reportedNumBaths);
    setOwnerNote("");
    setError("");
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedAdjustment(null);
    setOwnerNote("");
    setError("");
  };

  const handleResolve = async (approved) => {
    if (!ownerNote.trim()) {
      setError("Please provide a note explaining your decision.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const result = await FetchData.ownerResolveAdjustment(
        state.currentUser.token,
        selectedAdjustment.id,
        {
          approved,
          finalNumBeds: finalBeds,
          finalNumBaths: finalBaths,
          ownerNote: ownerNote.trim(),
        }
      );

      if (result.error) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      // Update local state
      setAdjustments(prev =>
        prev.map(adj =>
          adj.id === selectedAdjustment.id
            ? { ...adj, status: approved ? "owner_approved" : "owner_denied" }
            : adj
        )
      );

      handleCloseModal();
    } catch (err) {
      setError("Failed to submit resolution. Please try again.");
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { weekday: "short", month: "short", day: "numeric", year: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Filter adjustments
  const filteredAdjustments = adjustments.filter(adj => {
    if (filter === "needs_review") {
      return ["denied", "expired", "pending_owner"].includes(adj.status);
    } else if (filter === "resolved") {
      return ["owner_approved", "owner_denied", "approved"].includes(adj.status);
    }
    return true;
  });

  const needsReviewCount = adjustments.filter(adj =>
    ["denied", "expired", "pending_owner"].includes(adj.status)
  ).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading adjustments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Home Size Adjustments</Text>
        {needsReviewCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{needsReviewCount} need review</Text>
          </View>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, filter === "needs_review" && styles.filterTabActive]}
          onPress={() => setFilter("needs_review")}
        >
          <Text style={[styles.filterTabText, filter === "needs_review" && styles.filterTabTextActive]}>
            Needs Review
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === "all" && styles.filterTabActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[styles.filterTabText, filter === "all" && styles.filterTabTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === "resolved" && styles.filterTabActive]}
          onPress={() => setFilter("resolved")}
        >
          <Text style={[styles.filterTabText, filter === "resolved" && styles.filterTabTextActive]}>
            Resolved
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
          />
        }
      >
        {filteredAdjustments.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="check-circle" size={48} color={colors.success[400]} />
            <Text style={styles.emptyStateText}>
              {filter === "needs_review"
                ? "No adjustments need review"
                : "No adjustments found"}
            </Text>
          </View>
        ) : (
          filteredAdjustments.map((adjustment) => (
            <AdjustmentCard
              key={adjustment.id}
              adjustment={adjustment}
              onPress={handleCardPress}
            />
          ))
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            <ScrollView>
              <View style={styles.modalContent}>
                <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
                  <Icon name="times" size={20} color={colors.text.tertiary} />
                </TouchableOpacity>

                {selectedAdjustment && (
                  <>
                    <Text style={styles.modalTitle}>Review Adjustment #{selectedAdjustment.id}</Text>
                    <StatusBadge status={selectedAdjustment.status} />

                    {/* Parties */}
                    <View style={styles.partiesContainer}>
                      <View style={styles.partyCard}>
                        <Text style={styles.partyLabel}>Cleaner</Text>
                        <Text style={styles.partyName}>
                          {selectedAdjustment.cleaner
                            ? `${selectedAdjustment.cleaner.firstName} ${selectedAdjustment.cleaner.lastName}`
                            : "Unknown"}
                        </Text>
                        {selectedAdjustment.cleaner?.falseClaimCount > 0 && (
                          <View style={styles.warningBadge}>
                            <Icon name="exclamation-triangle" size={10} color={colors.error[700]} />
                            <Text style={styles.warningBadgeText}>
                              {selectedAdjustment.cleaner.falseClaimCount} false claim{selectedAdjustment.cleaner.falseClaimCount > 1 ? 's' : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.partyCard}>
                        <Text style={styles.partyLabel}>Homeowner</Text>
                        <Text style={styles.partyName}>
                          {selectedAdjustment.homeowner
                            ? `${selectedAdjustment.homeowner.firstName} ${selectedAdjustment.homeowner.lastName}`
                            : "Unknown"}
                        </Text>
                        {selectedAdjustment.homeowner?.falseHomeSizeCount > 0 && (
                          <View style={styles.warningBadge}>
                            <Icon name="exclamation-triangle" size={10} color={colors.error[700]} />
                            <Text style={styles.warningBadgeText}>
                              {selectedAdjustment.homeowner.falseHomeSizeCount} false size{selectedAdjustment.homeowner.falseHomeSizeCount > 1 ? 's' : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Owner Private Notes - shown if either party has notes */}
                    {(selectedAdjustment.cleaner?.ownerPrivateNotes || selectedAdjustment.homeowner?.ownerPrivateNotes) && (
                      <View style={styles.ownerNotesSection}>
                        <Text style={styles.ownerNotesTitle}>
                          <Icon name="lock" size={12} color={colors.warning[600]} /> Owner Notes (Private)
                        </Text>
                        {selectedAdjustment.cleaner?.ownerPrivateNotes && (
                          <View style={styles.ownerNoteBox}>
                            <Text style={styles.ownerNoteLabel}>
                              {selectedAdjustment.cleaner.firstName} {selectedAdjustment.cleaner.lastName} (Cleaner):
                            </Text>
                            <Text style={styles.ownerNoteText}>
                              {selectedAdjustment.cleaner.ownerPrivateNotes}
                            </Text>
                          </View>
                        )}
                        {selectedAdjustment.homeowner?.ownerPrivateNotes && (
                          <View style={styles.ownerNoteBox}>
                            <Text style={styles.ownerNoteLabel}>
                              {selectedAdjustment.homeowner.firstName} {selectedAdjustment.homeowner.lastName} (Homeowner):
                            </Text>
                            <Text style={styles.ownerNoteText}>
                              {selectedAdjustment.homeowner.ownerPrivateNotes}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Home & Appointment */}
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Home</Text>
                      <Text style={styles.detailValue}>
                        {selectedAdjustment.home
                          ? `${selectedAdjustment.home.address}, ${selectedAdjustment.home.city}`
                          : "Unknown address"}
                      </Text>
                    </View>

                    {selectedAdjustment.appointment && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>Appointment</Text>
                        <Text style={styles.detailValue}>
                          {formatDate(selectedAdjustment.appointment.date)}
                        </Text>
                      </View>
                    )}

                    {/* Size Comparison */}
                    <View style={styles.comparisonContainer}>
                      <View style={styles.comparisonCard}>
                        <Text style={styles.comparisonCardLabel}>On File</Text>
                        <Text style={styles.comparisonCardValue}>
                          {selectedAdjustment.originalNumBeds} bed / {selectedAdjustment.originalNumBaths} bath
                        </Text>
                        <Text style={styles.comparisonCardPrice}>
                          ${Number(selectedAdjustment.originalPrice).toFixed(2)}
                        </Text>
                      </View>
                      <View style={[styles.comparisonCard, styles.comparisonCardHighlight]}>
                        <Text style={styles.comparisonCardLabel}>Reported</Text>
                        <Text style={styles.comparisonCardValueHighlight}>
                          {selectedAdjustment.reportedNumBeds} bed / {selectedAdjustment.reportedNumBaths} bath
                        </Text>
                        <Text style={styles.comparisonCardPrice}>
                          ${Number(selectedAdjustment.calculatedNewPrice).toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.priceDifferenceBox}>
                      <Text style={styles.priceDifferenceLabel}>Price Difference</Text>
                      <Text style={styles.priceDifferenceValue}>
                        +${Number(selectedAdjustment.priceDifference).toFixed(2)}
                      </Text>
                    </View>

                    {/* Notes */}
                    {selectedAdjustment.cleanerNote && (
                      <View style={styles.noteBox}>
                        <Text style={styles.noteLabel}>Cleaner's Note:</Text>
                        <Text style={styles.noteText}>{selectedAdjustment.cleanerNote}</Text>
                      </View>
                    )}

                    {selectedAdjustment.homeownerResponse && (
                      <View style={[styles.noteBox, styles.noteBoxDeny]}>
                        <Text style={styles.noteLabel}>Homeowner's Response:</Text>
                        <Text style={styles.noteText}>{selectedAdjustment.homeownerResponse}</Text>
                      </View>
                    )}

                    {/* Photo Evidence - Only shown to owners */}
                    {selectedAdjustment.photos && selectedAdjustment.photos.length > 0 && (
                      <View style={styles.photoEvidenceSection}>
                        <Text style={styles.photoEvidenceTitle}>
                          <Icon name="camera" size={14} color={colors.primary[600]} /> Photo Evidence ({selectedAdjustment.photos.length} photos)
                        </Text>
                        <Text style={styles.photoEvidenceSubtitle}>
                          Photos taken by cleaner as proof of reported home size
                        </Text>
                        <View style={styles.photoEvidenceGrid}>
                          {selectedAdjustment.photos.map((photo, index) => (
                            <View key={photo.id || index} style={styles.photoEvidenceItem}>
                              <Text style={styles.photoEvidenceLabel}>
                                {photo.roomType === 'bedroom' ? 'Bedroom' : 'Bathroom'} {photo.roomNumber}
                              </Text>
                              <Image
                                source={{ uri: photo.photoUrl }}
                                style={styles.photoEvidenceImage}
                                resizeMode="cover"
                              />
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Resolution Form */}
                    {["denied", "expired", "pending_owner"].includes(selectedAdjustment.status) && (
                      <View style={styles.resolutionForm}>
                        <Text style={styles.resolutionTitle}>Owner Resolution</Text>

                        <View style={styles.formRow}>
                          <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Final Bedrooms</Text>
                            <View style={styles.pickerContainer}>
                              <Picker
                                selectedValue={finalBeds}
                                onValueChange={setFinalBeds}
                                style={styles.picker}
                              >
                                {bedOptions.map((option) => (
                                  <Picker.Item key={option} label={option} value={option} />
                                ))}
                              </Picker>
                            </View>
                          </View>
                          <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Final Bathrooms</Text>
                            <View style={styles.pickerContainer}>
                              <Picker
                                selectedValue={finalBaths}
                                onValueChange={setFinalBaths}
                                style={styles.picker}
                              >
                                {bathOptions.map((option) => (
                                  <Picker.Item key={option} label={option} value={option} />
                                ))}
                              </Picker>
                            </View>
                          </View>
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.formLabel}>Owner Note *</Text>
                          <TextInput
                            style={styles.textInput}
                            value={ownerNote}
                            onChangeText={setOwnerNote}
                            placeholder="Explain your decision..."
                            placeholderTextColor={colors.text.tertiary}
                            multiline
                            numberOfLines={3}
                          />
                        </View>

                        {error ? (
                          <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                          </View>
                        ) : null}

                        <View style={styles.resolutionButtons}>
                          <TouchableOpacity
                            style={[styles.denyResolutionButton, isSubmitting && styles.buttonDisabled]}
                            onPress={() => handleResolve(false)}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? (
                              <ActivityIndicator color={colors.error[700]} />
                            ) : (
                              <>
                                <Icon name="times" size={16} color={colors.error[700]} />
                                <Text style={styles.denyResolutionButtonText}>Deny</Text>
                              </>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.approveResolutionButton, isSubmitting && styles.buttonDisabled]}
                            onPress={() => handleResolve(true)}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? (
                              <ActivityIndicator color={colors.neutral[0]} />
                            ) : (
                              <>
                                <Icon name="check" size={16} color={colors.neutral[0]} />
                                <Text style={styles.approveResolutionButtonText}>Approve</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>

                        <Text style={styles.resolutionNote}>
                          Approving will update the home and charge the homeowner.
                        </Text>
                      </View>
                    )}

                    {/* Already resolved */}
                    {["owner_approved", "owner_denied", "approved"].includes(selectedAdjustment.status) && (
                      <View style={styles.resolvedBox}>
                        <Icon
                          name={selectedAdjustment.status === "owner_denied" ? "times-circle" : "check-circle"}
                          size={24}
                          color={selectedAdjustment.status === "owner_denied" ? colors.error[500] : colors.success[500]}
                        />
                        <Text style={styles.resolvedText}>
                          {selectedAdjustment.status === "approved"
                            ? "Approved by homeowner"
                            : selectedAdjustment.status === "owner_approved"
                            ? "Approved by owner"
                            : "Denied by owner"}
                        </Text>
                        {selectedAdjustment.ownerNote && (
                          <Text style={styles.resolvedNote}>{selectedAdjustment.ownerNote}</Text>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  badge: {
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  filterTabs: {
    flexDirection: "row",
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
  },
  filterTabActive: {
    backgroundColor: colors.primary[100],
  },
  filterTabText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  filterTabTextActive: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["2xl"],
  },
  emptyStateText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  adjustmentCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  adjustmentCardUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  requestId: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  homeAddress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  cardInfoRow: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  cardInfoItem: {
    flex: 1,
  },
  cardInfoLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  cardInfoValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  comparisonItem: {
    flex: 1,
    alignItems: "center",
  },
  comparisonLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  comparisonValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  comparisonValueHighlight: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[700],
  },
  pricePositive: {
    color: colors.success[600],
  },
  appointmentDate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "90%",
    ...shadows.lg,
  },
  modalContent: {
    padding: spacing.xl,
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    padding: spacing.sm,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  partiesContainer: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  partyCard: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  partyLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  partyName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textAlign: "center",
  },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: spacing.xs,
    gap: 4,
  },
  warningBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[700],
    fontWeight: typography.fontWeight.semibold,
  },
  ownerNotesSection: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  ownerNotesTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
    marginBottom: spacing.sm,
  },
  ownerNoteBox: {
    backgroundColor: colors.neutral[0],
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  ownerNoteLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  ownerNoteText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.primary,
    lineHeight: 16,
  },
  detailSection: {
    marginBottom: spacing.md,
  },
  detailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  comparisonContainer: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  comparisonCard: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  comparisonCardHighlight: {
    backgroundColor: colors.warning[100],
    borderWidth: 1,
    borderColor: colors.warning[300],
  },
  comparisonCardLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  comparisonCardValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: 2,
  },
  comparisonCardValueHighlight: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[800],
    marginTop: 2,
  },
  comparisonCardPrice: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  priceDifferenceBox: {
    backgroundColor: colors.success[50],
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  priceDifferenceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  priceDifferenceValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  noteBox: {
    backgroundColor: colors.secondary[50],
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  noteBoxDeny: {
    backgroundColor: colors.error[50],
  },
  noteLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  noteText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  resolutionForm: {
    backgroundColor: colors.primary[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginTop: spacing.md,
  },
  resolutionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[800],
    marginBottom: spacing.md,
    textAlign: "center",
  },
  formRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  formGroup: {
    flex: 1,
    marginBottom: spacing.md,
  },
  formLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  pickerContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: "hidden",
  },
  picker: {
    height: 50,
  },
  textInput: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: "top",
  },
  errorContainer: {
    backgroundColor: colors.error[100],
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    textAlign: "center",
  },
  resolutionButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  denyResolutionButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.error[100],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error[300],
  },
  denyResolutionButtonText: {
    color: colors.error[700],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  approveResolutionButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.success[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    ...shadows.sm,
  },
  approveResolutionButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resolutionNote: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    textAlign: "center",
    marginTop: spacing.md,
  },
  resolvedBox: {
    backgroundColor: colors.neutral[100],
    padding: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  resolvedText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  resolvedNote: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  photoEvidenceSection: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  photoEvidenceTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
    marginBottom: spacing.xs,
  },
  photoEvidenceSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  photoEvidenceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  photoEvidenceItem: {
    width: (Dimensions.get("window").width - spacing.xl * 2 - spacing.lg * 2 - spacing.md) / 2,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  photoEvidenceLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    padding: spacing.sm,
    backgroundColor: colors.neutral[100],
    textAlign: "center",
  },
  photoEvidenceImage: {
    width: "100%",
    height: 120,
    resizeMode: "cover",
  },
});

export default HomeSizeAdjustmentReview;
