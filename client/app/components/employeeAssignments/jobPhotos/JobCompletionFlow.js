import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { UserContext } from "../../../context/UserContext";
import JobPhotoCapture from "./JobPhotoCapture";
import styles from "./JobCompletionFlowStyles";

const baseURL = "http://localhost:3000";

const STEPS = {
  BEFORE_PHOTOS: "before_photos",
  CLEANING: "cleaning",
  AFTER_PHOTOS: "after_photos",
  REVIEW: "review",
};

const JobCompletionFlow = ({ appointment, home, onJobCompleted, onCancel }) => {
  const { currentUser } = useContext(UserContext);
  const [currentStep, setCurrentStep] = useState(STEPS.BEFORE_PHOTOS);
  const [photoStatus, setPhotoStatus] = useState({
    hasBeforePhotos: false,
    hasAfterPhotos: false,
    beforePhotosCount: 0,
    afterPhotosCount: 0,
  });
  const [allPhotos, setAllPhotos] = useState({ before: [], after: [] });
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    checkPhotoStatus();
  }, [appointment.id]);

  const checkPhotoStatus = async () => {
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
        // Auto-advance to appropriate step based on existing photos
        if (data.hasBeforePhotos && data.hasAfterPhotos) {
          setCurrentStep(STEPS.REVIEW);
        } else if (data.hasBeforePhotos) {
          setCurrentStep(STEPS.CLEANING);
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

  const handleAfterPhotosComplete = () => {
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
        Alert.alert(
          "Job Completed!",
          "Great work! Your payout has been processed.",
          [
            {
              text: "OK",
              onPress: () => onJobCompleted && onJobCompleted(data),
            },
          ]
        );
      } else {
        Alert.alert("Error", data.error || "Failed to complete job");
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
    <View style={styles.cleaningContainer}>
      <View style={styles.cleaningHeader}>
        <Text style={styles.cleaningTitle}>Time to Clean!</Text>
        <Text style={styles.cleaningSubtitle}>
          Before photos have been captured. Now complete the cleaning job.
        </Text>
      </View>

      <View style={styles.jobDetailsCard}>
        <Text style={styles.jobDetailsTitle}>Job Details</Text>
        <View style={styles.jobDetailRow}>
          <Text style={styles.jobDetailLabel}>Address:</Text>
          <Text style={styles.jobDetailValue}>
            {home?.address}, {home?.city}
          </Text>
        </View>
        <View style={styles.jobDetailRow}>
          <Text style={styles.jobDetailLabel}>Beds:</Text>
          <Text style={styles.jobDetailValue}>{home?.numBeds}</Text>
        </View>
        <View style={styles.jobDetailRow}>
          <Text style={styles.jobDetailLabel}>Baths:</Text>
          <Text style={styles.jobDetailValue}>{home?.numBaths}</Text>
        </View>
        {appointment.bringSheets === "Yes" && (
          <View style={styles.reminderBadge}>
            <Text style={styles.reminderText}>Remember: Bring Sheets</Text>
          </View>
        )}
        {appointment.bringTowels === "Yes" && (
          <View style={styles.reminderBadge}>
            <Text style={styles.reminderText}>Remember: Bring Towels</Text>
          </View>
        )}
        {home?.specialNotes && (
          <View style={styles.specialNotesContainer}>
            <Text style={styles.specialNotesLabel}>Special Notes:</Text>
            <Text style={styles.specialNotesText}>{home.specialNotes}</Text>
          </View>
        )}
      </View>

      <View style={styles.photoStatusCard}>
        <Text style={styles.photoStatusTitle}>Photo Status</Text>
        <View style={styles.photoStatusRow}>
          <Text style={styles.photoStatusLabel}>Before Photos:</Text>
          <Text style={styles.photoStatusValue}>
            {photoStatus.beforePhotosCount} captured
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.finishedButton}
        onPress={handleStartAfterPhotos}
      >
        <Text style={styles.finishedButtonText}>
          Finished Cleaning - Take After Photos
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderReviewStep = () => (
    <ScrollView style={styles.reviewContainer}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewTitle}>Review & Complete</Text>
        <Text style={styles.reviewSubtitle}>
          Review your before and after photos, then complete the job.
        </Text>
      </View>

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

      <View style={styles.payoutCard}>
        <Text style={styles.payoutTitle}>Your Payout</Text>
        <Text style={styles.payoutAmount}>
          ${(Number(appointment.price) * 0.9).toFixed(2)}
        </Text>
        <Text style={styles.payoutNote}>
          (90% of ${appointment.price} job total)
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

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Completion</Text>
        <View style={styles.headerSpacer} />
      </View>

      {renderStepIndicator()}

      {currentStep === STEPS.BEFORE_PHOTOS && (
        <JobPhotoCapture
          appointmentId={appointment.id}
          photoType="before"
          onPhotosUpdated={checkPhotoStatus}
          onComplete={handleBeforePhotosComplete}
        />
      )}

      {currentStep === STEPS.CLEANING && renderCleaningStep()}

      {currentStep === STEPS.AFTER_PHOTOS && (
        <JobPhotoCapture
          appointmentId={appointment.id}
          photoType="after"
          onPhotosUpdated={checkPhotoStatus}
          onComplete={handleAfterPhotosComplete}
        />
      )}

      {currentStep === STEPS.REVIEW && renderReviewStep()}
    </View>
  );
};

export default JobCompletionFlow;
