import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";
import FetchData from "../../services/fetchRequests/fetchData";

const HomeSizeConfirmationModal = ({
  visible,
  onClose,
  onConfirm,
  onReportSubmitted,
  home,
  appointment,
  token,
}) => {
  const [step, setStep] = useState("confirm"); // confirm, selectSize, capturePhotos, review
  const [reportedBeds, setReportedBeds] = useState(home?.numBeds || "1");
  const [reportedBaths, setReportedBaths] = useState(home?.numBaths || "1");
  const [cleanerNote, setCleanerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Camera state
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [currentRoomType, setCurrentRoomType] = useState(null);
  const [currentRoomNumber, setCurrentRoomNumber] = useState(null);
  const [photos, setPhotos] = useState([]); // Array of { roomType, roomNumber, photoData }
  const cameraRef = useRef(null);

  const bedOptions = ["1", "2", "3", "4", "5", "6", "7", "8+"];
  const bathOptions = ["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5+"];

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setStep("confirm");
      setPhotos([]);
      setCleanerNote("");
      setError("");
      setShowCamera(false);
    }
  }, [visible]);

  // Parse room counts
  const getNumBeds = () => parseInt(reportedBeds.replace('+', ''), 10) || parseInt(reportedBeds, 10);
  const getNumBaths = () => Math.ceil(parseFloat(reportedBaths.replace('+', '')) || parseFloat(reportedBaths));

  // Check which photos are still needed
  const getRequiredPhotos = () => {
    const numBeds = getNumBeds();
    const numBaths = getNumBaths();
    const required = [];

    for (let i = 1; i <= numBeds; i++) {
      const hasPhoto = photos.some(p => p.roomType === 'bedroom' && p.roomNumber === i);
      required.push({ type: 'bedroom', number: i, hasPhoto });
    }

    for (let i = 1; i <= numBaths; i++) {
      const hasPhoto = photos.some(p => p.roomType === 'bathroom' && p.roomNumber === i);
      required.push({ type: 'bathroom', number: i, hasPhoto });
    }

    return required;
  };

  const allPhotosCollected = () => {
    const required = getRequiredPhotos();
    return required.every(r => r.hasPhoto);
  };

  const handleConfirmMatch = () => {
    onConfirm();
  };

  const handleReportDiscrepancy = () => {
    setReportedBeds(home?.numBeds || "1");
    setReportedBaths(home?.numBaths || "1");
    setStep("selectSize");
  };

  const handleProceedToPhotos = () => {
    if (reportedBeds === home?.numBeds && reportedBaths === home?.numBaths) {
      setError("The reported size must be different from what's on file.");
      return;
    }
    setError("");
    setPhotos([]); // Reset photos when room counts change
    setStep("capturePhotos");
  };

  const handleStartCapture = async (roomType, roomNumber) => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Camera Permission", "Camera access is required to take photos.");
        return;
      }
    }
    setCurrentRoomType(roomType);
    setCurrentRoomNumber(roomNumber);
    setShowCamera(true);
  };

  const handleTakePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: true,
        });

        // Remove any existing photo for this room
        setPhotos(prev => prev.filter(
          p => !(p.roomType === currentRoomType && p.roomNumber === currentRoomNumber)
        ));

        // Add new photo
        setPhotos(prev => [...prev, {
          roomType: currentRoomType,
          roomNumber: currentRoomNumber,
          photoData: `data:image/jpeg;base64,${photo.base64}`,
        }]);

        setShowCamera(false);
        setCurrentRoomType(null);
        setCurrentRoomNumber(null);
      } catch (err) {
        console.error("Error taking photo:", err);
        Alert.alert("Error", "Failed to take photo. Please try again.");
      }
    }
  };

  const handleRemovePhoto = (roomType, roomNumber) => {
    setPhotos(prev => prev.filter(
      p => !(p.roomType === roomType && p.roomNumber === roomNumber)
    ));
  };

  const handleProceedToReview = () => {
    if (!allPhotosCollected()) {
      setError("Please take photos of all bedrooms and bathrooms.");
      return;
    }
    setError("");
    setStep("review");
  };

  const handleSubmitReport = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const result = await FetchData.createHomeSizeAdjustment(token, {
        appointmentId: appointment.id,
        reportedNumBeds: reportedBeds,
        reportedNumBaths: reportedBaths,
        cleanerNote: cleanerNote.trim() || null,
        photos: photos,
      });

      if (result.error) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      if (onReportSubmitted) {
        onReportSubmitted(result);
      }

      // Reset and proceed to job
      setStep("confirm");
      setPhotos([]);
      setCleanerNote("");
      setError("");
      onConfirm();
    } catch (err) {
      setError("Failed to submit report. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setStep("confirm");
    setPhotos([]);
    setCleanerNote("");
    setError("");
    onClose();
  };

  const handleBack = () => {
    if (step === "selectSize") {
      setStep("confirm");
    } else if (step === "capturePhotos") {
      setStep("selectSize");
    } else if (step === "review") {
      setStep("capturePhotos");
    }
    setError("");
  };

  if (!home) return null;

  // Camera View
  if (showCamera) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
          >
            <View style={styles.cameraHeader}>
              <TouchableOpacity
                style={styles.cameraCloseButton}
                onPress={() => setShowCamera(false)}
              >
                <Icon name="times" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.cameraTitle}>
                {currentRoomType === 'bedroom' ? 'Bedroom' : 'Bathroom'} {currentRoomNumber}
              </Text>
            </View>

            <View style={styles.cameraControls}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={handleTakePhoto}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <ScrollView style={styles.scrollContent}>
            <View style={styles.content}>
              {/* Step 1: Confirm */}
              {step === "confirm" && (
                <>
                  <Text style={styles.title}>Confirm Home Size</Text>
                  <Text style={styles.subtitle}>
                    Please verify this home's details before starting
                  </Text>

                  <View style={styles.addressContainer}>
                    <Text style={styles.addressText}>{home.address}</Text>
                    <Text style={styles.cityText}>
                      {home.city}, {home.state} {home.zipcode}
                    </Text>
                  </View>

                  <View style={styles.detailsCard}>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Bedrooms</Text>
                        <Text style={styles.detailValue}>{home.numBeds}</Text>
                      </View>
                      <View style={styles.detailDivider} />
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Bathrooms</Text>
                        <Text style={styles.detailValue}>{home.numBaths}</Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.questionText}>
                    Does this match what you see?
                  </Text>

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={styles.confirmButton}
                      onPress={handleConfirmMatch}
                    >
                      <Text style={styles.confirmButtonText}>Yes, This Matches</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.reportButton}
                      onPress={handleReportDiscrepancy}
                    >
                      <Text style={styles.reportButtonText}>No, Report Discrepancy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleCancel}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Step 2: Select Size */}
              {step === "selectSize" && (
                <>
                  <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Text style={styles.backButtonText}>← Back</Text>
                  </TouchableOpacity>

                  <Text style={styles.title}>Report Home Size</Text>
                  <Text style={styles.subtitle}>
                    Enter the actual number of beds and baths
                  </Text>

                  <View style={styles.comparisonContainer}>
                    <View style={styles.comparisonCard}>
                      <Text style={styles.comparisonLabel}>On File</Text>
                      <Text style={styles.comparisonValue}>
                        {home.numBeds} bed / {home.numBaths} bath
                      </Text>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Actual Bedrooms</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={reportedBeds}
                        onValueChange={setReportedBeds}
                        style={styles.picker}
                      >
                        {bedOptions.map((option) => (
                          <Picker.Item key={option} label={option} value={option} />
                        ))}
                      </Picker>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Actual Bathrooms</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={reportedBaths}
                        onValueChange={setReportedBaths}
                        style={styles.picker}
                      >
                        {bathOptions.map((option) => (
                          <Picker.Item key={option} label={option} value={option} />
                        ))}
                      </Picker>
                    </View>
                  </View>

                  {error ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={handleProceedToPhotos}
                    >
                      <Text style={styles.primaryButtonText}>
                        Next: Take Photos
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleCancel}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Step 3: Capture Photos */}
              {step === "capturePhotos" && (
                <>
                  <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Text style={styles.backButtonText}>← Back</Text>
                  </TouchableOpacity>

                  <Text style={styles.title}>Photo Evidence</Text>
                  <Text style={styles.subtitle}>
                    Take a photo of each bedroom and bathroom as proof
                  </Text>

                  <View style={styles.photoGrid}>
                    {getRequiredPhotos().map((room, index) => {
                      const existingPhoto = photos.find(
                        p => p.roomType === room.type && p.roomNumber === room.number
                      );

                      return (
                        <View key={`${room.type}-${room.number}`} style={styles.photoItem}>
                          <Text style={styles.photoLabel}>
                            {room.type === 'bedroom' ? 'Bedroom' : 'Bathroom'} {room.number}
                          </Text>

                          {existingPhoto ? (
                            <View style={styles.photoPreview}>
                              <Image
                                source={{ uri: existingPhoto.photoData }}
                                style={styles.photoThumbnail}
                              />
                              <TouchableOpacity
                                style={styles.retakeButton}
                                onPress={() => handleStartCapture(room.type, room.number)}
                              >
                                <Icon name="refresh" size={12} color={colors.primary[600]} />
                                <Text style={styles.retakeButtonText}>Retake</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.addPhotoButton}
                              onPress={() => handleStartCapture(room.type, room.number)}
                            >
                              <Icon name="camera" size={24} color={colors.primary[600]} />
                              <Text style={styles.addPhotoText}>Take Photo</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {error ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <View style={styles.progressInfo}>
                    <Text style={styles.progressText}>
                      {photos.length} of {getRequiredPhotos().length} photos taken
                    </Text>
                  </View>

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        !allPhotosCollected() && styles.buttonDisabled,
                      ]}
                      onPress={handleProceedToReview}
                      disabled={!allPhotosCollected()}
                    >
                      <Text style={styles.primaryButtonText}>Next: Review</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleCancel}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Step 4: Review */}
              {step === "review" && (
                <>
                  <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Text style={styles.backButtonText}>← Back</Text>
                  </TouchableOpacity>

                  <Text style={styles.title}>Review Report</Text>
                  <Text style={styles.subtitle}>
                    Confirm your report before submitting
                  </Text>

                  <View style={styles.reviewCard}>
                    <View style={styles.reviewRow}>
                      <View style={styles.reviewItem}>
                        <Text style={styles.reviewLabel}>On File</Text>
                        <Text style={styles.reviewValue}>
                          {home.numBeds} bed / {home.numBaths} bath
                        </Text>
                      </View>
                      <Icon name="arrow-right" size={16} color={colors.text.tertiary} />
                      <View style={styles.reviewItem}>
                        <Text style={styles.reviewLabel}>Your Report</Text>
                        <Text style={styles.reviewValueHighlight}>
                          {reportedBeds} bed / {reportedBaths} bath
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.photoSummary}>
                    <Text style={styles.photoSummaryTitle}>
                      {photos.length} Photos Attached
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.photoSummaryRow}>
                        {photos.map((photo, index) => (
                          <Image
                            key={index}
                            source={{ uri: photo.photoData }}
                            style={styles.summaryThumbnail}
                          />
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Notes (Optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={cleanerNote}
                      onChangeText={setCleanerNote}
                      placeholder="Add any additional details..."
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

                  <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                      The homeowner will be notified to confirm your report. Photos will only be visible to owners if the report is disputed.
                    </Text>
                  </View>

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
                      onPress={handleSubmitReport}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color={colors.neutral[0]} />
                      ) : (
                        <Text style={styles.submitButtonText}>Submit Report & Start Job</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleCancel}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  scrollContent: {
    flexGrow: 0,
  },
  content: {
    padding: spacing.xl,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  backButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  addressContainer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  addressText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  cityText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  detailsCard: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  detailItem: {
    alignItems: "center",
    flex: 1,
  },
  detailDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.primary[200],
  },
  detailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginBottom: spacing.xs,
  },
  detailValue: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  questionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  buttonContainer: {
    gap: spacing.md,
  },
  confirmButton: {
    backgroundColor: colors.success[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.sm,
  },
  confirmButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  reportButton: {
    backgroundColor: colors.warning[100],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.warning[300],
  },
  reportButtonText: {
    color: colors.warning[800],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  primaryButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.sm,
  },
  primaryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  cancelButton: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  cancelButtonText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
  },
  comparisonContainer: {
    marginBottom: spacing.lg,
  },
  comparisonCard: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  comparisonLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  comparisonValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  formLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  pickerContainer: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: "hidden",
  },
  picker: {
    height: 50,
  },
  textInput: {
    backgroundColor: colors.neutral[100],
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
  infoBox: {
    backgroundColor: colors.secondary[50],
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  infoText: {
    color: colors.secondary[700],
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    textAlign: "center",
  },
  submitButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadows.sm,
  },
  submitButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Camera styles
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
    justifyContent: "space-between",
  },
  cameraHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
  },
  cameraCloseButton: {
    padding: spacing.md,
  },
  cameraTitle: {
    flex: 1,
    color: "#fff",
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    textAlign: "center",
    marginRight: 48, // Balance the close button
  },
  cameraControls: {
    alignItems: "center",
    paddingBottom: 50,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
  },
  // Photo grid styles
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  photoItem: {
    width: "47%",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  photoLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  addPhotoButton: {
    width: "100%",
    height: 100,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary[200],
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  photoPreview: {
    width: "100%",
    alignItems: "center",
  },
  photoThumbnail: {
    width: "100%",
    height: 100,
    borderRadius: radius.md,
  },
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: 4,
  },
  retakeButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.sm,
  },
  progressInfo: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  // Review styles
  reviewCard: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewItem: {
    flex: 1,
    alignItems: "center",
  },
  reviewLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  reviewValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  reviewValueHighlight: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[700],
  },
  photoSummary: {
    marginBottom: spacing.lg,
  },
  photoSummaryTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  photoSummaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  summaryThumbnail: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
  },
});

export default HomeSizeConfirmationModal;
