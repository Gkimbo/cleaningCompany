import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import CreateNewEmployeeForm from "./CreateNewEmployeeForm";
import Application from "../../../services/fetchRequests/ApplicationClass";

const ApplicationTile = ({
  application,
  onDelete,
  onUpdateStatus,
  onRefresh,
  statusConfig,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showHireForm, setShowHireForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [adminNotes, setAdminNotes] = useState(application.adminNotes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);

  const status = application.status || "pending";
  const config = statusConfig[status] || statusConfig.pending;

  const formatDate = (dateString) => {
    if (!dateString) return "Not provided";
    // Parse date string without timezone conversion (for DATEONLY fields)
    // '2026-01-01' should display as Jan 1, 2026, not Dec 31, 2025
    const [year, month, day] = dateString.split("-");
    if (year && month && day) {
      const date = new Date(year, month - 1, day); // month is 0-indexed
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    // Fallback for other date formats
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await Application.updateApplicationNotes(application.id, adminNotes);
      Alert.alert("Saved", "Admin notes updated successfully.");
    } catch (error) {
      Alert.alert("Error", "Failed to save notes.");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleStatusChange = (newStatus) => {
    Alert.alert(
      "Update Status",
      `Change status to "${statusConfig[newStatus]?.label}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update",
          onPress: () => {
            onUpdateStatus(application.id, newStatus);
            // If approved, automatically open the hire form
            if (newStatus === "approved") {
              setExpanded(true);
              setShowHireForm(true);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete(application.id);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleSavePhoto = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "We need access to your photos.");
        return;
      }

      const filename = application.idPhoto.split("/").pop();
      const dest = FileSystem.cacheDirectory + filename;

      await FileSystem.copyAsync({ from: application.idPhoto, to: dest });
      const asset = await MediaLibrary.createAssetAsync(dest);
      await MediaLibrary.createAlbumAsync("Kleanr IDs", asset, false);

      Alert.alert("Saved!", "ID photo saved to your gallery.");
    } catch (error) {
      Alert.alert("Error", "Could not save photo.");
    }
  };

  const CheckIndicator = ({ checked }) => (
    <View style={[styles.checkIndicator, checked ? styles.checkIndicatorYes : styles.checkIndicatorNo]}>
      <Text style={[styles.checkIndicatorIcon, checked ? styles.checkIconYesText : styles.checkIconNoText]}>
        {checked ? "✓" : "✗"}
      </Text>
      <Text style={[styles.checkIndicatorText, checked ? styles.checkTextYes : styles.checkTextNo]}>
        {checked ? "Yes" : "No"}
      </Text>
    </View>
  );

  return (
    <View style={[styles.card, { borderLeftColor: config.color }]}>
      {/* Main Card Content - Always Visible */}
      <View style={styles.cardMain}>
        {/* Top Row: Name + Status */}
        <View style={styles.topRow}>
          <View style={styles.nameSection}>
            <Text style={styles.applicantName}>
              {application.firstName} {application.lastName}
            </Text>
            <Text style={styles.appliedDate}>Applied {formatDate(application.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.bgColor, borderColor: config.color }]}>
            <Text style={[styles.statusBadgeText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        </View>

        {/* Contact Info */}
        <View style={styles.contactRow}>
          <View style={styles.contactItem}>
            <Text style={styles.contactLabel}>Email</Text>
            <Text style={styles.contactValue}>{application.email}</Text>
          </View>
          <View style={styles.contactItem}>
            <Text style={styles.contactLabel}>Phone</Text>
            <Text style={styles.contactValue}>{application.phone}</Text>
          </View>
        </View>

        {/* Key Info Grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoGridItem}>
            <Text style={styles.infoGridLabel}>Experience</Text>
            <Text style={styles.infoGridValue}>{application.experience || "Not specified"}</Text>
          </View>
          <View style={styles.infoGridItem}>
            <Text style={styles.infoGridLabel}>Reliable Transportation</Text>
            <CheckIndicator checked={application.hasReliableTransportation} />
          </View>
          <View style={styles.infoGridItem}>
            <Text style={styles.infoGridLabel}>Valid Driver's License</Text>
            <CheckIndicator checked={application.hasValidDriversLicense} />
          </View>
          <View style={styles.infoGridItem}>
            <Text style={styles.infoGridLabel}>Authorized to Work in US</Text>
            <CheckIndicator checked={application.isAuthorizedToWork} />
          </View>
        </View>

        {/* Personal Statement Preview */}
        {application.message && (
          <View style={styles.statementPreview}>
            <Text style={styles.statementLabel}>Personal Statement</Text>
            <Text style={styles.statementText} numberOfLines={expanded ? undefined : 2}>
              "{application.message}"
            </Text>
          </View>
        )}

        {/* Expand Button */}
        <Pressable onPress={() => setExpanded(!expanded)} style={styles.expandButton}>
          <Text style={styles.expandButtonText}>
            {expanded ? "Show Less" : "Show More Details"}
          </Text>
        </Pressable>
      </View>

      {/* Expanded Content */}
      {expanded && (
        <View style={styles.expandedContent}>
          {/* ID Photo */}
          {application.idPhoto && (
            <View style={styles.photoSection}>
              <Text style={styles.sectionTitle}>ID Photo</Text>
              <Pressable onPress={() => setPhotoExpanded(!photoExpanded)} onLongPress={handleSavePhoto}>
                <Image
                  source={{ uri: application.idPhoto }}
                  style={[styles.idPhoto, photoExpanded && styles.idPhotoExpanded]}
                  resizeMode="contain"
                />
              </Pressable>
              <Text style={styles.photoHint}>Tap to expand • Long press to save</Text>
            </View>
          )}

          {/* Additional Details */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Additional Details</Text>

            {application.streetAddress && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address</Text>
                <Text style={styles.detailValue}>
                  {application.streetAddress}, {application.city}, {application.state} {application.zipCode}
                </Text>
              </View>
            )}

            {application.dateOfBirth && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date of Birth</Text>
                <Text style={styles.detailValue}>{formatDate(application.dateOfBirth)}</Text>
              </View>
            )}

            {application.availableStartDate && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Available Start</Text>
                <Text style={styles.detailValue}>{formatDate(application.availableStartDate)}</Text>
              </View>
            )}
          </View>

          {/* Previous Employment */}
          {application.previousEmployer && (
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Previous Employment</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Employer</Text>
                <Text style={styles.detailValue}>{application.previousEmployer}</Text>
              </View>
              {application.previousEmployerPhone && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Contact</Text>
                  <Text style={styles.detailValue}>{application.previousEmployerPhone}</Text>
                </View>
              )}
              {application.previousEmploymentDuration && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>{application.previousEmploymentDuration}</Text>
                </View>
              )}
            </View>
          )}

          {/* Emergency Contact */}
          {application.emergencyContactName && (
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Emergency Contact</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Name</Text>
                <Text style={styles.detailValue}>{application.emergencyContactName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{application.emergencyContactPhone}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Relationship</Text>
                <Text style={styles.detailValue}>{application.emergencyContactRelation}</Text>
              </View>
            </View>
          )}

          {/* Consents */}
          <View style={styles.consentsSection}>
            <Text style={styles.sectionTitle}>Consents</Text>
            <View style={styles.consentsGrid}>
              <View style={styles.consentItem}>
                <Text style={styles.consentLabel}>Background Check Consent</Text>
                <CheckIndicator checked={application.backgroundConsent} />
              </View>
              <View style={styles.consentItem}>
                <Text style={styles.consentLabel}>Drug Test Consent</Text>
                <CheckIndicator checked={application.drugTestConsent} />
              </View>
              <View style={styles.consentItem}>
                <Text style={styles.consentLabel}>Reference Check Consent</Text>
                <CheckIndicator checked={application.referenceCheckConsent} />
              </View>
            </View>
          </View>

          {/* Status Update */}
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Update Status</Text>
            <View style={styles.statusButtons}>
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <Pressable
                  key={key}
                  onPress={() => handleStatusChange(key)}
                  style={[
                    styles.statusButton,
                    status === key && { backgroundColor: cfg.color },
                  ]}
                >
                  <Text style={[
                    styles.statusButtonText,
                    status === key && { color: colors.neutral[0] }
                  ]}>
                    {cfg.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Admin Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Admin Notes</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              placeholder="Add notes about this applicant..."
              placeholderTextColor={colors.text.tertiary}
              value={adminNotes}
              onChangeText={setAdminNotes}
            />
            <Pressable
              onPress={handleSaveNotes}
              style={[styles.saveNotesButton, savingNotes && styles.saveNotesButtonDisabled]}
              disabled={savingNotes}
            >
              <Text style={styles.saveNotesButtonText}>
                {savingNotes ? "Saving..." : "Save Notes"}
              </Text>
            </Pressable>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            <Pressable
              onPress={() => setShowHireForm(!showHireForm)}
              style={[styles.actionButton, styles.hireButton]}
            >
              <Text style={styles.hireButtonText}>
                {showHireForm ? "Cancel Hire" : "Hire Applicant"}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDelete}
              style={[
                styles.actionButton,
                styles.deleteButton,
                showDeleteConfirm && styles.deleteButtonConfirm,
              ]}
            >
              <Text style={[
                styles.deleteButtonText,
                showDeleteConfirm && { color: colors.neutral[0] }
              ]}>
                {showDeleteConfirm ? "Confirm Delete" : "Delete Application"}
              </Text>
            </Pressable>

            {showDeleteConfirm && (
              <Pressable
                onPress={() => setShowDeleteConfirm(false)}
                style={[styles.actionButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            )}
          </View>

          {/* Hire Form */}
          {showHireForm && (
            <View style={styles.hireFormContainer}>
              <Text style={styles.hireFormTitle}>Create Employee Account</Text>
              <CreateNewEmployeeForm
                id={application.id}
                firstName={application.firstName}
                lastName={application.lastName}
                email={application.email}
                phone={application.phone}
                setApplicationsList={onRefresh}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    borderLeftWidth: 5,
    ...shadows.lg,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },

  // Main Card
  cardMain: {
    padding: spacing.xl,
  },

  // Top Row
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  nameSection: {
    flex: 1,
  },
  applicantName: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  appliedDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  statusBadge: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 2,
  },
  statusBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  // Contact Row
  contactRow: {
    flexDirection: "row",
    gap: spacing.xl,
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  contactItem: {
    flex: 1,
  },
  contactLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  contactValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },

  // Info Grid
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  infoGridItem: {
    width: "47%",
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  infoGridLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoGridValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
  },

  // Check Indicator
  checkIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  checkIndicatorYes: {
    backgroundColor: colors.success[100],
  },
  checkIndicatorNo: {
    backgroundColor: colors.error[100],
  },
  checkIndicatorIcon: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  checkIconYesText: {
    color: colors.success[700],
  },
  checkIconNoText: {
    color: colors.error[700],
  },
  checkIndicatorText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  checkTextYes: {
    color: colors.success[700],
  },
  checkTextNo: {
    color: colors.error[700],
  },

  // Statement Preview
  statementPreview: {
    backgroundColor: colors.primary[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[400],
  },
  statementLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: typography.fontWeight.semibold,
  },
  statementText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 24,
    fontStyle: "italic",
  },

  // Expand Button
  expandButton: {
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  expandButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },

  // Expanded Content
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.secondary,
  },

  // Section Title
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  // Photo Section
  photoSection: {
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  idPhoto: {
    width: "100%",
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[200],
  },
  idPhotoExpanded: {
    height: 400,
  },
  photoHint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: "center",
    marginTop: spacing.sm,
  },

  // Details Section
  detailsSection: {
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
    textAlign: "right",
  },

  // Consents Section
  consentsSection: {
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  consentsGrid: {
    flexDirection: "column",
    gap: spacing.md,
  },
  consentItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  consentLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },

  // Status Section
  statusSection: {
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  statusButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statusButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.default,
    backgroundColor: colors.neutral[0],
  },
  statusButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.semibold,
  },

  // Notes Section
  notesSection: {
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  notesInput: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 120,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    textAlignVertical: "top",
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  saveNotesButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
  },
  saveNotesButtonDisabled: {
    opacity: 0.6,
  },
  saveNotesButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    textAlign: "center",
  },

  // Actions
  actionSection: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.xl,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  hireButton: {
    backgroundColor: colors.success[600],
  },
  hireButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  deleteButton: {
    backgroundColor: colors.neutral[0],
    borderWidth: 2,
    borderColor: colors.error[400],
  },
  deleteButtonConfirm: {
    backgroundColor: colors.error[600],
    borderColor: colors.error[600],
  },
  deleteButtonText: {
    color: colors.error[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  cancelButton: {
    backgroundColor: colors.neutral[200],
  },
  cancelButtonText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  // Hire Form
  hireFormContainer: {
    padding: spacing.xl,
    backgroundColor: colors.success[50],
  },
  hireFormTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
    marginBottom: spacing.lg,
  },
});

export default ApplicationTile;
