import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  StatusBar,
} from "react-native";
import { UserContext } from "../../../context/UserContext";
import { usePricing } from "../../../context/PricingContext";
import JobPhotoCapture from "./JobPhotoCapture";
import PassVerificationCapture from "./PassVerificationCapture";
import CleaningChecklist, { clearChecklistProgress } from "./CleaningChecklist";
import styles from "./JobCompletionFlowStyles";
import { API_BASE } from "../../../services/config";

const baseURL = API_BASE.replace("/api/v1", "");

const STEPS = {
  BEFORE_PHOTOS: "before_photos",
  CLEANING: "cleaning",
  AFTER_PHOTOS: "after_photos",
  PASSES: "passes",
  REVIEW: "review",
};

const JobCompletionFlow = ({ appointment, home, onJobCompleted, onCancel }) => {
  const { currentUser } = useContext(UserContext);
  const { pricing } = usePricing();
  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const [currentStep, setCurrentStep] = useState(STEPS.BEFORE_PHOTOS);
  const [photoStatus, setPhotoStatus] = useState({
    hasBeforePhotos: false,
    hasAfterPhotos: false,
    hasPassesPhotos: false,
    beforePhotosCount: 0,
    afterPhotosCount: 0,
    passesPhotosCount: 0,
  });
  const [allPhotos, setAllPhotos] = useState({ before: [], after: [], passes: [] });
  const [completing, setCompleting] = useState(false);
  const [checklistProgress, setChecklistProgress] = useState({
    percent: 0,
    completed: 0,
    total: 0,
  });

  // Check if current user is the business owner (preferred cleaner) for this home
  const isBusinessOwner = home?.preferredCleanerId === currentUser?.id;

  useEffect(() => {
    // Auto-advance on initial load only (e.g., resuming a job)
    checkPhotoStatus(true);
  }, [appointment.id]);

  const checkPhotoStatus = async (autoAdvance = false) => {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/job-photos/${appointment.id}/status`,
        {
          headers: {
            Authorization: `Bearer ${currentUser.token}`,
          },
        }
      );
      const data = await response.json();

      if (response.ok) {
        setPhotoStatus(data);
        // Only auto-advance on initial load (when autoAdvance is true)
        // This prevents advancing when user is still adding photos
        if (autoAdvance) {
          if (data.hasBeforePhotos && data.hasAfterPhotos && data.hasPassesPhotos) {
            setCurrentStep(STEPS.REVIEW);
            // Load photos for the review screen
            loadAllPhotos();
          } else if (data.hasBeforePhotos && data.hasAfterPhotos) {
            setCurrentStep(STEPS.PASSES);
          } else if (data.hasBeforePhotos) {
            setCurrentStep(STEPS.CLEANING);
          }
        }
      }
    } catch (error) {
      console.error("Error checking photo status:", error);
    }
  };

  const loadAllPhotos = async () => {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/job-photos/${appointment.id}`,
        {
          headers: {
            Authorization: `Bearer ${currentUser.token}`,
          },
        }
      );
      const data = await response.json();

      if (response.ok) {
        setAllPhotos({
          before: data.beforePhotos || [],
          after: data.afterPhotos || [],
          passes: data.passesPhotos || [],
        });
      }
    } catch (error) {
      console.error("Error loading photos:", error);
    }
  };

  const handleBeforePhotosComplete = () => {
    checkPhotoStatus();
    setCurrentStep(STEPS.CLEANING);
  };

  const handleStartAfterPhotos = () => {
    setCurrentStep(STEPS.AFTER_PHOTOS);
  };

  const handleChecklistProgress = (percent, completed, total) => {
    setChecklistProgress({ percent, completed, total });
  };

  const handleChecklistComplete = () => {
    setCurrentStep(STEPS.AFTER_PHOTOS);
  };

  const handleAfterPhotosComplete = () => {
    checkPhotoStatus();
    setCurrentStep(STEPS.PASSES);
  };

  const handlePassesComplete = () => {
    checkPhotoStatus();
    loadAllPhotos();
    setCurrentStep(STEPS.REVIEW);
  };

  const handleCompleteJob = async () => {
    setCompleting(true);

    try {
      const response = await fetch(`${baseURL}/api/v1/payments/complete-job`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          appointmentId: appointment.id,
          cleanerId: currentUser.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Check payout results to give appropriate feedback
        const payoutResults = data.payoutResults || [];
        const myPayout = payoutResults.find(
          (p) => String(p.cleanerId) === String(currentUser.id)
        );

        let message = "Great work!";
        if (myPayout) {
          if (myPayout.status === "success") {
            const amount = myPayout.amountCents
              ? `$${(myPayout.amountCents / 100).toFixed(2)}`
              : "";
            message = `Great work! Your payout${amount ? ` of ${amount}` : ""} has been processed.`;
          } else if (myPayout.status === "skipped") {
            message =
              "Job completed! However, your payout could not be processed. Please complete your Stripe account setup to receive payments.";
          } else if (myPayout.status === "already_paid") {
            message = "Job completed! Your payout was already processed.";
          }
        } else {
          message = "Job completed successfully!";
        }

        // Clear the saved checklist progress since job is complete
        await clearChecklistProgress(appointment.id);

        Alert.alert("Job Completed!", message, [
          {
            text: "OK",
            onPress: () => onJobCompleted && onJobCompleted(data),
          },
        ]);
      } else {
        // Handle early completion blocked error
        if (data.reason === "early_completion_blocked") {
          Alert.alert(
            "Cannot Complete Yet",
            data.error || "Please wait until the time window starts or be on-site for at least 30 minutes.",
            [{ text: "OK" }]
          );
        } else {
          Alert.alert("Error", data.error || "Failed to complete job");
        }
      }
    } catch (error) {
      console.error("Error completing job:", error);
      Alert.alert("Error", "Failed to complete job. Please try again.");
    } finally {
      setCompleting(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: STEPS.BEFORE_PHOTOS, label: "Before" },
      { key: STEPS.CLEANING, label: "Clean" },
      { key: STEPS.AFTER_PHOTOS, label: "After" },
      { key: STEPS.PASSES, label: "Passes" },
      { key: STEPS.REVIEW, label: "Complete" },
    ];

    const currentIndex = steps.findIndex((s) => s.key === currentStep);

    return (
      <View style={styles.stepIndicator}>
        {steps.map((step, index) => (
          <View key={step.key} style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                index <= currentIndex && styles.stepCircleActive,
                index < currentIndex && styles.stepCircleCompleted,
              ]}
            >
              <Text
                style={[
                  styles.stepNumber,
                  index <= currentIndex && styles.stepNumberActive,
                ]}
              >
                {index < currentIndex ? "✓" : index + 1}
              </Text>
            </View>
            <Text
              style={[
                styles.stepLabel,
                index <= currentIndex && styles.stepLabelActive,
              ]}
            >
              {step.label}
            </Text>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  index < currentIndex && styles.stepLineActive,
                ]}
              />
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderCleaningStep = () => (
    <View style={{ flex: 1 }}>
      <CleaningChecklist
        home={home}
        token={currentUser.token}
        appointmentId={appointment.id}
        onChecklistComplete={handleChecklistComplete}
        onProgressUpdate={handleChecklistProgress}
      />
      {isBusinessOwner && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => setCurrentStep(STEPS.AFTER_PHOTOS)}
        >
          <Text style={styles.skipButtonText}>Skip Checklist</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderReviewStep = () => {
    const hasAnyPhotos = allPhotos.before.length > 0 || allPhotos.after.length > 0 || allPhotos.passes.length > 0;
    const passesPhotosOnly = allPhotos.passes.filter((p) => !p.isNotApplicable);
    const hasNAPasses = allPhotos.passes.some((p) => p.isNotApplicable);

    return (
    <ScrollView style={styles.reviewContainer}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewTitle}>Review & Complete</Text>
        <Text style={styles.reviewSubtitle}>
          {hasAnyPhotos
            ? "Review your photos and pass verification, then complete the job."
            : isBusinessOwner
            ? "Complete the job for your client."
            : "Review and complete the job."}
        </Text>
      </View>

      {allPhotos.before.length > 0 && (
        <View style={styles.photosReviewSection}>
          <Text style={styles.photosReviewTitle}>Before Photos</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photosReviewScroll}
          >
            {allPhotos.before.map((photo) => (
              <View key={photo.id} style={styles.reviewPhotoCard}>
                <Image
                  source={{ uri: photo.photoData }}
                  style={styles.reviewPhotoImage}
                  resizeMode="cover"
                />
                {photo.room && (
                  <Text style={styles.reviewPhotoRoom}>{photo.room}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {allPhotos.after.length > 0 && (
        <View style={styles.photosReviewSection}>
          <Text style={styles.photosReviewTitle}>After Photos</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photosReviewScroll}
          >
            {allPhotos.after.map((photo) => (
              <View key={photo.id} style={styles.reviewPhotoCard}>
                <Image
                  source={{ uri: photo.photoData }}
                  style={styles.reviewPhotoImage}
                  resizeMode="cover"
                />
                {photo.room && (
                  <Text style={styles.reviewPhotoRoom}>{photo.room}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Pass Verification Section */}
      <View style={styles.photosReviewSection}>
        <Text style={styles.photosReviewTitle}>Pass Verification</Text>
        {hasNAPasses ? (
          <View style={styles.naPassesBadge}>
            <Text style={styles.naPassesText}>✓ No passes at this property (N/A)</Text>
          </View>
        ) : passesPhotosOnly.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photosReviewScroll}
          >
            {passesPhotosOnly.map((photo) => (
              <View key={photo.id} style={styles.reviewPhotoCard}>
                <Image
                  source={{ uri: photo.photoData }}
                  style={styles.reviewPhotoImage}
                  resizeMode="cover"
                />
                {photo.room && (
                  <Text style={styles.reviewPhotoRoom}>{photo.room}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.naPassesBadge}>
            <Text style={styles.naPassesTextPending}>⚠ Pass verification pending</Text>
          </View>
        )}
      </View>

      {isBusinessOwner && !hasAnyPhotos && (
        <View style={styles.noPhotosPlaceholder}>
          <Text style={styles.noPhotosText}>No photos taken for this job</Text>
        </View>
      )}

      <View style={styles.payoutCard}>
        <Text style={styles.payoutTitle}>Your Payout</Text>
        <Text style={styles.payoutAmount}>
          ${(Number(appointment.price) * cleanerSharePercent).toFixed(2)}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.completeButton, completing && styles.buttonDisabled]}
        onPress={handleCompleteJob}
        disabled={completing}
      >
        {completing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.completeButtonText}>Complete Job & Get Paid</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.addMorePhotosButton}
        onPress={() => setCurrentStep(STEPS.AFTER_PHOTOS)}
      >
        <Text style={styles.addMorePhotosText}>Add More After Photos</Text>
      </TouchableOpacity>
    </ScrollView>
    );
  };

  const statusBarHeight = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0;

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Completion</Text>
        <View style={styles.headerSpacer} />
      </View>

      {renderStepIndicator()}

      {currentStep === STEPS.BEFORE_PHOTOS && (
        <View style={{ flex: 1 }}>
          <JobPhotoCapture
            appointmentId={appointment.id}
            photoType="before"
            home={home}
            onPhotosUpdated={checkPhotoStatus}
            onComplete={handleBeforePhotosComplete}
          />
          {isBusinessOwner && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => setCurrentStep(STEPS.CLEANING)}
            >
              <Text style={styles.skipButtonText}>Skip Before Photos</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {currentStep === STEPS.CLEANING && renderCleaningStep()}

      {currentStep === STEPS.AFTER_PHOTOS && (
        <View style={{ flex: 1 }}>
          <JobPhotoCapture
            appointmentId={appointment.id}
            photoType="after"
            home={home}
            onPhotosUpdated={checkPhotoStatus}
            onComplete={handleAfterPhotosComplete}
          />
          {isBusinessOwner && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => setCurrentStep(STEPS.PASSES)}
            >
              <Text style={styles.skipButtonText}>Skip After Photos</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {currentStep === STEPS.PASSES && (
        <View style={{ flex: 1 }}>
          <PassVerificationCapture
            appointmentId={appointment.id}
            onPhotosUpdated={checkPhotoStatus}
            onComplete={handlePassesComplete}
          />
          {isBusinessOwner && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => {
                loadAllPhotos();
                setCurrentStep(STEPS.REVIEW);
              }}
            >
              <Text style={styles.skipButtonText}>Skip Pass Verification</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {currentStep === STEPS.REVIEW && renderReviewStep()}
    </View>
  );
};

export default JobCompletionFlow;
