import React, { useState, useEffect, useContext, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { UserContext } from "../../../context/UserContext";
import { colors, spacing, radius, shadows, typography } from "../../../services/styles/theme";
import { StyleSheet } from "react-native";
import { API_BASE } from "../../../services/config";
import { useNetworkStatus, PhotoStorage } from "../../../services/offline";

const baseURL = API_BASE.replace("/api/v1", "");

const PASS_TYPES = [
  { key: "beach-pass", name: "Beach Pass", icon: "🏖️" },
  { key: "parking-pass", name: "Parking Pass", icon: "🅿️" },
  { key: "lift-pass", name: "Lift Pass", icon: "🎿" },
  { key: "pool-pass", name: "Pool Pass", icon: "🏊" },
  { key: "other-pass", name: "Other Pass", icon: "🎫" },
];

// Local storage key for N/A status
const getLocalNAKey = (jobId) => `passes_na_${jobId}`;

const PassVerificationCapture = ({
  appointmentId,
  localJobId, // Local WatermelonDB job ID for offline storage
  onComplete,
  onPhotosUpdated,
}) => {
  const { currentUser } = useContext(UserContext);
  const { isOnline, isOffline } = useNetworkStatus();
  const [photos, setPhotos] = useState([]);
  const [localPhotos, setLocalPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [activePassType, setActivePassType] = useState(null);
  const [isNotApplicable, setIsNotApplicable] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Use localJobId if provided, otherwise use appointmentId for local storage
  const effectiveLocalJobId = localJobId || (isOffline ? `appointment_${appointmentId}` : null);

  useEffect(() => {
    loadExistingPhotos();
    loadLocalNAStatus();
  }, [appointmentId, isOnline]);

  const loadLocalNAStatus = async () => {
    // Check if N/A was stored locally (for offline mode)
    if (effectiveLocalJobId) {
      try {
        const hasNA = await PhotoStorage.hasNAPassesForJob(effectiveLocalJobId);
        if (hasNA) {
          setIsNotApplicable(true);
        }
      } catch (error) {
        console.error("Error loading local N/A status:", error);
      }
    }
  };

  const loadExistingPhotos = async () => {
    // Load local photos
    if (effectiveLocalJobId) {
      try {
        const allLocalPhotos = await PhotoStorage.getPhotosForJob(effectiveLocalJobId);
        const filteredLocal = allLocalPhotos.filter((p) => p.photoType === "passes");
        setLocalPhotos(filteredLocal);
      } catch (error) {
        console.error("Error loading local passes photos:", error);
      }
    }

    // Load server photos when online
    if (isOnline && appointmentId) {
      try {
        const response = await fetch(
          `${baseURL}/api/v1/job-photos/${appointmentId}`,
          {
            headers: {
              Authorization: `Bearer ${currentUser.token}`,
            },
          }
        );
        const data = await response.json();

        if (response.ok) {
          const passesPhotos = data.passesPhotos || [];
          setPhotos(passesPhotos);
          // Check if N/A was previously set on server
          const naPhoto = passesPhotos.find((p) => p.isNotApplicable);
          if (naPhoto) {
            setIsNotApplicable(true);
          }
        }
      } catch (error) {
        console.error("Error loading passes photos:", error);
      }
    }
  };

  // Combine local and server photos
  const allPhotos = useMemo(() => {
    // Convert local photos to display format
    const localDisplay = localPhotos.map((p) => ({
      id: `local_${p.id}`,
      localId: p.id,
      photoData: p.localUri,
      room: p.room,
      isLocal: true,
      uploaded: p.uploaded,
      isNotApplicable: p._raw?.is_not_applicable || false,
    }));

    // Server photos
    const serverDisplay = photos.map((p) => ({
      ...p,
      isLocal: false,
    }));

    return [...serverDisplay, ...localDisplay];
  }, [photos, localPhotos]);

  const requestPermissions = async () => {
    const { status: cameraStatus } =
      await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== "granted" || libraryStatus !== "granted") {
      Alert.alert(
        "Permissions Required",
        "Camera and photo library permissions are needed to capture pass photos."
      );
      return false;
    }
    return true;
  };

  const takePhoto = async (passType) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setActivePassType(passType);

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await savePhoto(result.assets[0], passType);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    } finally {
      setActivePassType(null);
    }
  };

  const pickFromLibrary = async (passType) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setActivePassType(passType);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await savePhoto(result.assets[0], passType);
      }
    } catch (error) {
      console.error("Error picking photo:", error);
      Alert.alert("Error", "Failed to select photo. Please try again.");
    } finally {
      setActivePassType(null);
    }
  };

  const savePhoto = async (imageAsset, passType) => {
    setUploading(true);

    try {
      // When offline or we have a local job, save locally first
      if (isOffline && effectiveLocalJobId) {
        // Save to local storage
        const watermarkData = {
          timestamp: new Date().toISOString(),
          appointmentId,
          photoType: "passes",
          room: passType,
        };

        await PhotoStorage.savePhoto(imageAsset.uri, effectiveLocalJobId, "passes", passType, watermarkData);
        setIsNotApplicable(false);
        await loadExistingPhotos();
        if (onPhotosUpdated) onPhotosUpdated();
        return;
      }

      // When online and no local job, upload directly
      let photoData;

      if (imageAsset.base64) {
        photoData = `data:image/jpeg;base64,${imageAsset.base64}`;
      } else if (Platform.OS === "web" && imageAsset.uri) {
        try {
          const response = await fetch(imageAsset.uri);
          const blob = await response.blob();
          const reader = new FileReader();
          photoData = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (conversionError) {
          console.error("Error converting blob to base64:", conversionError);
          Alert.alert("Error", "Failed to process the image.");
          setUploading(false);
          return;
        }
      } else {
        Alert.alert("Error", "Could not process the selected image.");
        setUploading(false);
        return;
      }

      const response = await fetch(`${baseURL}/api/v1/job-photos/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          appointmentId,
          photoType: "passes",
          photoData,
          room: passType,
          isNotApplicable: false,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsNotApplicable(false);
        await loadExistingPhotos();
        if (onPhotosUpdated) onPhotosUpdated();
      } else {
        Alert.alert("Error", data.error || "Failed to upload photo");
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      Alert.alert("Error", "Failed to upload photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleMarkNotApplicable = async () => {
    const hasPhotos = allPhotos.some((p) => !p.isNotApplicable);

    if (hasPhotos) {
      Alert.alert(
        "Confirm",
        "You have already uploaded pass photos. Do you want to mark this as N/A instead? This will not delete existing photos.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Mark as N/A", onPress: submitNotApplicable },
        ]
      );
    } else {
      submitNotApplicable();
    }
  };

  const submitNotApplicable = async () => {
    setSubmitting(true);

    try {
      // When offline, save N/A status locally using PhotoStorage
      if (isOffline && effectiveLocalJobId) {
        await PhotoStorage.saveNARecord(effectiveLocalJobId, "No passes available at this property");
        setIsNotApplicable(true);
        await loadExistingPhotos();
        if (onPhotosUpdated) onPhotosUpdated();
        setSubmitting(false);
        return;
      }

      // When online, submit to server
      const response = await fetch(`${baseURL}/api/v1/job-photos/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          appointmentId,
          photoType: "passes",
          isNotApplicable: true,
          notes: "No passes available at this property",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsNotApplicable(true);
        await loadExistingPhotos();
        if (onPhotosUpdated) onPhotosUpdated();
      } else {
        Alert.alert("Error", data.error || "Failed to mark as N/A");
      }
    } catch (error) {
      console.error("Error marking as N/A:", error);
      Alert.alert("Error", "Failed to mark as N/A. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const deletePhoto = async (photo) => {
    const confirmDelete = () =>
      new Promise((resolve) => {
        Alert.alert("Delete Photo", "Are you sure you want to delete this photo?", [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Delete", style: "destructive", onPress: () => resolve(true) },
        ]);
      });

    const confirmed = await confirmDelete();
    if (!confirmed) return;

    try {
      if (photo.isLocal) {
        // Delete local photo
        await PhotoStorage.deletePhoto(photo.localId);
      } else {
        // Delete server photo
        const response = await fetch(
          `${baseURL}/api/v1/job-photos/${photo.id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${currentUser.token}`,
            },
          }
        );

        if (!response.ok) {
          const data = await response.json();
          Alert.alert("Error", data.error || "Failed to delete photo");
          return;
        }
      }

      await loadExistingPhotos();
      if (onPhotosUpdated) onPhotosUpdated();
    } catch (error) {
      console.error("Error deleting photo:", error);
      Alert.alert("Error", "Failed to delete photo");
    }
  };

  const handleContinue = () => {
    const hasPassPhotos = allPhotos.some((p) => !p.isNotApplicable);
    const hasNAMarked = isNotApplicable || allPhotos.some((p) => p.isNotApplicable);

    if (!hasPassPhotos && !hasNAMarked) {
      Alert.alert(
        "Verification Required",
        "Please take a photo of any passes (beach, parking, lift, etc.) or mark as N/A if none are available."
      );
      return;
    }
    if (onComplete) onComplete();
  };

  const getPhotosByPassType = (passTypeName) => {
    return allPhotos.filter((photo) => photo.room === passTypeName && !photo.isNotApplicable);
  };

  const hasAnyPhotos = allPhotos.some((p) => !p.isNotApplicable);
  const hasNAMarked = isNotApplicable || allPhotos.some((p) => p.isNotApplicable);
  const canProceed = hasAnyPhotos || hasNAMarked;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pass Verification</Text>
        <Text style={styles.subtitle}>
          Take photos of any beach passes, parking passes, lift passes, or similar items to verify they are present.
          If there are no passes at this property, mark as N/A.
        </Text>
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>Offline - Photos saved locally</Text>
          </View>
        )}
      </View>

      {/* Status indicator */}
      <View style={[styles.statusBadge, canProceed ? styles.statusComplete : styles.statusIncomplete]}>
        <Text style={styles.statusText}>
          {hasNAMarked
            ? "✓ Marked as N/A (no passes)"
            : hasAnyPhotos
            ? `✓ ${allPhotos.filter((p) => !p.isNotApplicable).length} pass photo(s) ${isOffline ? "saved locally" : "uploaded"}`
            : "⚠ Verification required"}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* N/A Option */}
        <TouchableOpacity
          style={[
            styles.naButton,
            hasNAMarked && styles.naButtonActive,
            submitting && styles.buttonDisabled,
          ]}
          onPress={handleMarkNotApplicable}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={hasNAMarked ? colors.neutral[0] : colors.text.secondary} />
          ) : (
            <>
              <Text style={[styles.naIcon, hasNAMarked && styles.naIconActive]}>🚫</Text>
              <View style={styles.naTextContainer}>
                <Text style={[styles.naTitle, hasNAMarked && styles.naTitleActive]}>
                  No Passes Available
                </Text>
                <Text style={[styles.naSubtitle, hasNAMarked && styles.naSubtitleActive]}>
                  This property does not have beach, parking, or other passes
                </Text>
              </View>
              {hasNAMarked && <Text style={styles.checkmark}>✓</Text>}
            </>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Pass Type Sections */}
        <Text style={styles.sectionTitle}>Take Photos of Passes</Text>

        {PASS_TYPES.map((passType) => {
          const passPhotos = getPhotosByPassType(passType.name);
          const isUploadingToType = activePassType === passType.name && uploading;

          return (
            <View key={passType.key} style={styles.passTypeSection}>
              <View style={styles.passTypeHeader}>
                <Text style={styles.passTypeIcon}>{passType.icon}</Text>
                <Text style={styles.passTypeName}>{passType.name}</Text>
                {passPhotos.length > 0 && (
                  <View style={styles.photoCountBadge}>
                    <Text style={styles.photoCountText}>
                      {passPhotos.length} {passPhotos.length === 1 ? "photo" : "photos"}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.photoGrid}>
                {passPhotos.map((photo) => (
                  <View key={photo.id} style={styles.photoCard}>
                    <Image
                      source={{ uri: photo.photoData }}
                      style={styles.photoThumbnail}
                      resizeMode="cover"
                    />
                    {photo.isLocal && !photo.uploaded && (
                      <View style={styles.localBadge}>
                        <Text style={styles.localBadgeText}>Local</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deletePhoto(photo)}
                    >
                      <Text style={styles.deleteButtonText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.addPhotoButton, isUploadingToType && styles.buttonDisabled]}
                  onPress={() => takePhoto(passType.name)}
                  disabled={uploading}
                >
                  {isUploadingToType ? (
                    <ActivityIndicator size="small" color={colors.primary[500]} />
                  ) : (
                    <>
                      <Text style={styles.addPhotoIcon}>📷</Text>
                      <Text style={styles.addPhotoText}>Camera</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.addPhotoButton, styles.libraryButton, isUploadingToType && styles.buttonDisabled]}
                  onPress={() => pickFromLibrary(passType.name)}
                  disabled={uploading}
                >
                  <Text style={styles.addPhotoIcon}>🖼️</Text>
                  <Text style={styles.addPhotoText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.continueButton, !canProceed && styles.continueButtonDisabled]}
        onPress={handleContinue}
      >
        <Text style={styles.continueButtonText}>Continue to Review</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  offlineBanner: {
    backgroundColor: colors.warning[100],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  offlineBannerText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[800],
    fontWeight: typography.fontWeight.medium,
    textAlign: "center",
  },
  statusBadge: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  statusComplete: {
    backgroundColor: colors.success[50] || "#f0fdf4",
    borderLeftWidth: 4,
    borderLeftColor: colors.success[600],
  },
  statusIncomplete: {
    backgroundColor: colors.warning[100],
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[700],
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  naButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    borderWidth: 2,
    borderColor: colors.neutral[300],
    marginBottom: spacing.md,
  },
  naButtonActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  naIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  naIconActive: {
    opacity: 1,
  },
  naTextContainer: {
    flex: 1,
  },
  naTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  naTitleActive: {
    color: colors.neutral[0],
  },
  naSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  naSubtitleActive: {
    color: colors.neutral[100],
  },
  checkmark: {
    fontSize: 24,
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.default,
  },
  dividerText: {
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  passTypeSection: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  passTypeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  passTypeIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  passTypeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  photoCountBadge: {
    backgroundColor: colors.success[100] || colors.success[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  photoCountText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  photoCard: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    overflow: "hidden",
    ...shadows.sm,
  },
  photoThumbnail: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.neutral[200],
  },
  localBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: colors.warning[500],
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  localBadgeText: {
    fontSize: 10,
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
  },
  deleteButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.error[500] || colors.error[700],
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: colors.neutral[0],
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 18,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    borderWidth: 2,
    borderColor: colors.primary[300],
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  libraryButton: {
    backgroundColor: colors.secondary[50],
    borderColor: colors.secondary[300] || colors.secondary[700],
  },
  addPhotoIcon: {
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  addPhotoText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  continueButton: {
    backgroundColor: colors.secondary[500] || colors.secondary[700],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.md,
    ...shadows.md,
  },
  continueButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  continueButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});

export default PassVerificationCapture;
