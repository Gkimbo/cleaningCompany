import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { API_BASE } from "../../services/config";

const StarRating = ({ rating, onRatingChange, label, description }) => {
  const [hoveredStar, setHoveredStar] = useState(null);

  return (
    <View style={styles.ratingSection}>
      <View style={styles.ratingHeader}>
        <Text style={styles.ratingLabel}>{label}</Text>
        <Text style={styles.ratingValue}>{rating > 0 ? rating.toFixed(1) : "-"}</Text>
      </View>
      {description && <Text style={styles.ratingDescription}>{description}</Text>}
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => onRatingChange(star)}
            style={styles.starButton}
          >
            <Icon
              name={star <= rating ? "star" : "star-o"}
              size={32}
              color={star <= rating ? "#FFD700" : colors.neutral[300]}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const ThumbsRating = ({ value, onChange, label, description }) => {
  return (
    <View style={styles.ratingSection}>
      <Text style={styles.ratingLabel}>{label}</Text>
      {description && <Text style={styles.ratingDescription}>{description}</Text>}
      <View style={styles.thumbsContainer}>
        <Pressable
          style={[
            styles.thumbButton,
            value === true && styles.thumbButtonActiveYes,
          ]}
          onPress={() => onChange(true)}
        >
          <Icon
            name="thumbs-up"
            size={28}
            color={value === true ? colors.success[600] : colors.neutral[400]}
          />
          <Text
            style={[
              styles.thumbText,
              value === true && styles.thumbTextActiveYes,
            ]}
          >
            Yes
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.thumbButton,
            value === false && styles.thumbButtonActiveNo,
          ]}
          onPress={() => onChange(false)}
        >
          <Icon
            name="thumbs-down"
            size={28}
            color={value === false ? colors.error[600] : colors.neutral[400]}
          />
          <Text
            style={[
              styles.thumbText,
              value === false && styles.thumbTextActiveNo,
            ]}
          >
            No
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const MultiAspectReviewForm = ({
  state,
  appointmentId,
  userId, // User being reviewed
  reviewType, // "homeowner_to_cleaner" or "cleaner_to_homeowner"
  revieweeName,
  homeId, // Home ID for preferred cleaner feature
  onComplete,
}) => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  // Common fields
  const [overallRating, setOverallRating] = useState(0);
  const [publicComment, setPublicComment] = useState("");
  const [privateComment, setPrivateComment] = useState("");

  // Homeowner reviewing Cleaner
  const [cleaningQuality, setCleaningQuality] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [professionalism, setProfessionalism] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [attentionToDetail, setAttentionToDetail] = useState(0);
  const [thoroughness, setThoroughness] = useState(0);
  const [respectOfProperty, setRespectOfProperty] = useState(0);
  const [followedInstructions, setFollowedInstructions] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState(null);

  // Cleaner reviewing Homeowner
  const [accuracyOfDescription, setAccuracyOfDescription] = useState(0);
  const [homeReadiness, setHomeReadiness] = useState(0);
  const [easeOfAccess, setEaseOfAccess] = useState(0);
  const [homeCondition, setHomeCondition] = useState(0);
  const [respectfulness, setRespectfulness] = useState(0);
  const [safetyConditions, setSafetyConditions] = useState(0);
  const [wouldWorkForAgain, setWouldWorkForAgain] = useState(null);

  // Preferred cleaner option (homeowner reviewing cleaner only)
  const [setAsPreferred, setSetAsPreferred] = useState(false);

  const isHomeownerReview = reviewType === "homeowner_to_cleaner";

  const calculateOverall = () => {
    if (isHomeownerReview) {
      const ratings = [
        cleaningQuality, punctuality, professionalism, communication,
        attentionToDetail, thoroughness, respectOfProperty, followedInstructions
      ].filter((r) => r > 0);
      if (ratings.length === 0) return 0;
      return ratings.reduce((a, b) => a + b, 0) / ratings.length;
    } else {
      const ratings = [
        accuracyOfDescription, homeReadiness, easeOfAccess, communication,
        homeCondition, respectfulness, safetyConditions
      ].filter((r) => r > 0);
      if (ratings.length === 0) return 0;
      return ratings.reduce((a, b) => a + b, 0) / ratings.length;
    }
  };

  const canProceedStep1 = () => {
    if (isHomeownerReview) {
      return cleaningQuality > 0 && punctuality > 0 && thoroughness > 0;
    } else {
      return accuracyOfDescription > 0 && homeReadiness > 0 && homeCondition > 0;
    }
  };

  const canProceedStep2 = () => {
    if (isHomeownerReview) {
      return attentionToDetail > 0 && respectOfProperty > 0 && followedInstructions > 0;
    } else {
      return easeOfAccess > 0 && safetyConditions > 0;
    }
  };

  const canProceedStep3 = () => {
    if (isHomeownerReview) {
      return professionalism > 0 && communication > 0 && wouldRecommend !== null;
    } else {
      return respectfulness > 0 && communication > 0 && wouldWorkForAgain !== null;
    }
  };

  const handleSubmit = async () => {
    const calculatedOverall = calculateOverall();

    if (calculatedOverall === 0) {
      Alert.alert("Missing Ratings", "Please rate all aspects before submitting.");
      return;
    }

    if (!userId || isNaN(userId)) {
      Alert.alert("Error", "Unable to identify who to review. Please try again later.");
      return;
    }

    setSubmitting(true);

    try {
      const reviewData = {
        userId,
        appointmentId,
        reviewType,
        review: calculatedOverall,
        reviewComment: publicComment.trim() || null,
        privateComment: privateComment.trim() || null,
        communication,
      };

      if (isHomeownerReview) {
        reviewData.cleaningQuality = cleaningQuality;
        reviewData.punctuality = punctuality;
        reviewData.professionalism = professionalism;
        reviewData.attentionToDetail = attentionToDetail;
        reviewData.thoroughness = thoroughness;
        reviewData.respectOfProperty = respectOfProperty;
        reviewData.followedInstructions = followedInstructions;
        reviewData.wouldRecommend = wouldRecommend;
        // Preferred cleaner feature
        reviewData.setAsPreferred = setAsPreferred;
        if (homeId) {
          reviewData.homeId = homeId;
        }
      } else {
        reviewData.accuracyOfDescription = accuracyOfDescription;
        reviewData.homeReadiness = homeReadiness;
        reviewData.easeOfAccess = easeOfAccess;
        reviewData.homeCondition = homeCondition;
        reviewData.respectfulness = respectfulness;
        reviewData.safetyConditions = safetyConditions;
        reviewData.wouldWorkForAgain = wouldWorkForAgain;
      }

      const response = await fetch(`${API_BASE}/reviews/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.currentUser.token}`,
        },
        body: JSON.stringify(reviewData),
      });

      const data = await response.json();
      console.log("[Review] Response:", response.status, data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit review");
      }

      // Call onComplete - let the parent handle showing feedback
      // This avoids Alert issues inside pageSheet modals on iOS
      if (onComplete) {
        onComplete(data);
      } else {
        navigate("/");
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>
          {isHomeownerReview ? "How was the cleaning?" : "How was the job?"}
        </Text>
        <Text style={styles.stepSubtitle}>
          Rate your experience with {revieweeName}
        </Text>
      </View>

      {isHomeownerReview ? (
        <>
          <StarRating
            rating={cleaningQuality}
            onRatingChange={setCleaningQuality}
            label="Cleaning Quality"
            description="How well was the space cleaned overall?"
          />
          <StarRating
            rating={punctuality}
            onRatingChange={setPunctuality}
            label="Punctuality"
            description="Did they arrive on time?"
          />
          <StarRating
            rating={thoroughness}
            onRatingChange={setThoroughness}
            label="Thoroughness"
            description="How thorough was the cleaning?"
          />
        </>
      ) : (
        <>
          <StarRating
            rating={accuracyOfDescription}
            onRatingChange={setAccuracyOfDescription}
            label="Job Accuracy"
            description="Was the job as described?"
          />
          <StarRating
            rating={homeReadiness}
            onRatingChange={setHomeReadiness}
            label="Home Readiness"
            description="Was the home prepared for cleaning?"
          />
          <StarRating
            rating={homeCondition}
            onRatingChange={setHomeCondition}
            label="Home Condition"
            description="What was the overall condition of the home?"
          />
        </>
      )}

      <View style={styles.navigationButtons}>
        <View style={styles.buttonSpacer} />
        <Pressable
          style={[styles.nextButton, !canProceedStep1() && styles.buttonDisabled]}
          onPress={() => setStep(2)}
          disabled={!canProceedStep1()}
        >
          <Text style={styles.nextButtonText}>Continue</Text>
          <Icon name="chevron-right" size={14} color={colors.neutral[0]} />
        </Pressable>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>
          {isHomeownerReview ? "Quality details" : "Working conditions"}
        </Text>
      </View>

      {isHomeownerReview ? (
        <>
          <StarRating
            rating={attentionToDetail}
            onRatingChange={setAttentionToDetail}
            label="Attention to Detail"
            description="Did they pay attention to small details?"
          />
          <StarRating
            rating={respectOfProperty}
            onRatingChange={setRespectOfProperty}
            label="Respect of Property"
            description="Did they treat your belongings with care?"
          />
          <StarRating
            rating={followedInstructions}
            onRatingChange={setFollowedInstructions}
            label="Followed Instructions"
            description="Did they follow any special instructions?"
          />
        </>
      ) : (
        <>
          <StarRating
            rating={easeOfAccess}
            onRatingChange={setEaseOfAccess}
            label="Ease of Access"
            description="Was it easy to access the property?"
          />
          <StarRating
            rating={safetyConditions}
            onRatingChange={setSafetyConditions}
            label="Safety Conditions"
            description="Was the home safe to work in?"
          />
        </>
      )}

      <View style={styles.navigationButtons}>
        <Pressable style={styles.backButton} onPress={() => setStep(1)}>
          <Icon name="chevron-left" size={14} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Pressable
          style={[styles.nextButton, !canProceedStep2() && styles.buttonDisabled]}
          onPress={() => setStep(3)}
          disabled={!canProceedStep2()}
        >
          <Text style={styles.nextButtonText}>Continue</Text>
          <Icon name="chevron-right" size={14} color={colors.neutral[0]} />
        </Pressable>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>
          {isHomeownerReview ? "How was the experience?" : "How was working with them?"}
        </Text>
      </View>

      {isHomeownerReview ? (
        <>
          <StarRating
            rating={professionalism}
            onRatingChange={setProfessionalism}
            label="Professionalism"
            description="Were they courteous and professional?"
          />
          <StarRating
            rating={communication}
            onRatingChange={setCommunication}
            label="Communication"
            description="How was their communication before and during the job?"
          />
          <ThumbsRating
            value={wouldRecommend}
            onChange={setWouldRecommend}
            label="Would you recommend this cleaner?"
          />
        </>
      ) : (
        <>
          <StarRating
            rating={respectfulness}
            onRatingChange={setRespectfulness}
            label="Respectfulness"
            description="Was the homeowner respectful?"
          />
          <StarRating
            rating={communication}
            onRatingChange={setCommunication}
            label="Communication"
            description="How was their communication?"
          />
          <ThumbsRating
            value={wouldWorkForAgain}
            onChange={setWouldWorkForAgain}
            label="Would you work for them again?"
          />
        </>
      )}

      <View style={styles.navigationButtons}>
        <Pressable style={styles.backButton} onPress={() => setStep(2)}>
          <Icon name="chevron-left" size={14} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Pressable
          style={[styles.nextButton, !canProceedStep3() && styles.buttonDisabled]}
          onPress={() => setStep(4)}
          disabled={!canProceedStep3()}
        >
          <Text style={styles.nextButtonText}>Continue</Text>
          <Icon name="chevron-right" size={14} color={colors.neutral[0]} />
        </Pressable>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Add your comments</Text>
        <Text style={styles.stepSubtitle}>
          Share details that will help others
        </Text>
      </View>

      <View style={styles.overallCard}>
        <Text style={styles.overallLabel}>Overall Rating</Text>
        <View style={styles.overallStars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Icon
              key={star}
              name={star <= Math.round(calculateOverall()) ? "star" : "star-o"}
              size={24}
              color={star <= Math.round(calculateOverall()) ? "#FFD700" : colors.neutral[300]}
            />
          ))}
        </View>
        <Text style={styles.overallValue}>{calculateOverall().toFixed(1)} / 5.0</Text>
      </View>

      <View style={styles.commentSection}>
        <Text style={styles.commentLabel}>Public Review</Text>
        <Text style={styles.commentHint}>
          This will be visible to {revieweeName} and others once both reviews are submitted.
        </Text>
        <TextInput
          style={styles.commentInput}
          multiline
          numberOfLines={4}
          placeholder="Share your experience..."
          placeholderTextColor={colors.text.tertiary}
          value={publicComment}
          onChangeText={setPublicComment}
        />
      </View>

      <View style={styles.commentSection}>
        <Text style={styles.commentLabel}>Private Feedback (Optional)</Text>
        <Text style={styles.commentHint}>
          Only visible to the platform, not to {revieweeName}.
        </Text>
        <TextInput
          style={styles.commentInput}
          multiline
          numberOfLines={3}
          placeholder="Any additional feedback for us..."
          placeholderTextColor={colors.text.tertiary}
          value={privateComment}
          onChangeText={setPrivateComment}
        />
      </View>

      {/* Preferred Cleaner Option - only for homeowner reviewing cleaner */}
      {isHomeownerReview && homeId && (
        <View style={styles.preferredCleanerSection}>
          <View style={styles.preferredCleanerRow}>
            <View style={styles.preferredCleanerContent}>
              <View style={styles.preferredCleanerHeader}>
                <Icon name="star" size={16} color={colors.success[600]} />
                <Text style={styles.preferredCleanerLabel}>
                  Make {revieweeName} a preferred cleaner
                </Text>
              </View>
              <Text style={styles.preferredCleanerHint}>
                They can book directly for this home without needing your approval each time.
              </Text>
            </View>
            <Switch
              value={setAsPreferred}
              onValueChange={setSetAsPreferred}
              trackColor={{ false: colors.neutral[300], true: colors.success[400] }}
              thumbColor={setAsPreferred ? colors.success[600] : colors.neutral[100]}
            />
          </View>
        </View>
      )}

      <View style={styles.navigationButtons}>
        <Pressable style={styles.backButton} onPress={() => setStep(3)}>
          <Icon name="chevron-left" size={14} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Pressable
          style={[styles.submitButton, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.neutral[0]} size="small" />
          ) : (
            <>
              <Icon name="check" size={14} color={colors.neutral[0]} />
              <Text style={styles.submitButtonText}>Submit Review</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4].map((s) => (
          <View key={s} style={styles.progressItem}>
            <View
              style={[
                styles.progressDot,
                s <= step && styles.progressDotActive,
                s < step && styles.progressDotCompleted,
              ]}
            >
              {s < step ? (
                <Icon name="check" size={12} color={colors.neutral[0]} />
              ) : (
                <Text
                  style={[
                    styles.progressNumber,
                    s <= step && styles.progressNumberActive,
                  ]}
                >
                  {s}
                </Text>
              )}
            </View>
            {s < 4 && (
              <View
                style={[
                  styles.progressLine,
                  s < step && styles.progressLineActive,
                ]}
              />
            )}
          </View>
        ))}
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="eye-slash" size={16} color={colors.primary[600]} />
        <Text style={styles.infoText}>
          Your review stays private until {revieweeName} also submits their review.
          Then both become visible at the same time.
        </Text>
      </View>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing["4xl"],
  },

  // Progress
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  progressItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotActive: {
    backgroundColor: colors.primary[500],
  },
  progressDotCompleted: {
    backgroundColor: colors.success[500],
  },
  progressNumber: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
  },
  progressNumberActive: {
    color: colors.neutral[0],
  },
  progressLine: {
    width: 28,
    height: 3,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing.xs,
  },
  progressLineActive: {
    backgroundColor: colors.success[500],
  },

  // Info Banner
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },

  // Step Container
  stepContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  stepHeader: {
    marginBottom: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },

  // Rating Section
  ratingSection: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  ratingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  ratingLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  ratingValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  ratingDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  starsContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  starButton: {
    padding: spacing.xs,
  },

  // Thumbs Rating
  thumbsContainer: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  thumbButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    backgroundColor: colors.neutral[0],
  },
  thumbButtonActiveYes: {
    borderColor: colors.success[500],
    backgroundColor: colors.success[50],
  },
  thumbButtonActiveNo: {
    borderColor: colors.error[500],
    backgroundColor: colors.error[50],
  },
  thumbText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  thumbTextActiveYes: {
    color: colors.success[600],
  },
  thumbTextActiveNo: {
    color: colors.error[600],
  },

  // Overall Card
  overallCard: {
    alignItems: "center",
    backgroundColor: colors.primary[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  overallLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    marginBottom: spacing.sm,
  },
  overallStars: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  overallValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },

  // Comment Section
  commentSection: {
    marginBottom: spacing.lg,
  },
  commentLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  commentHint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  commentInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: "top",
  },

  // Navigation Buttons
  navigationButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  buttonSpacer: {
    flex: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  nextButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Preferred Cleaner Section
  preferredCleanerSection: {
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  preferredCleanerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  preferredCleanerContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  preferredCleanerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  preferredCleanerLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  preferredCleanerHint: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    lineHeight: 18,
  },
});

export default MultiAspectReviewForm;
