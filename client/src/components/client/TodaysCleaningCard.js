import React, { useState, useEffect, useRef } from "react";
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
  Image,
  Dimensions,
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

const { width: screenWidth } = Dimensions.get("window");

const TodaysCleaningCard = ({ appointment, home, state, onReviewSubmitted }) => {
  const navigate = useNavigate();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [cleaningStatus, setCleaningStatus] = useState("not_started");
  const [assignedCleaners, setAssignedCleaners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState({ before: [], after: [] });
  const [photosLoading, setPhotosLoading] = useState(false);
  const [activePhotoTab, setActivePhotoTab] = useState("before");
  const [photoSize, setPhotoSize] = useState(1); // 0.5 to 1.5 scale
  const [expandedRooms, setExpandedRooms] = useState({});
  const [expandedCleaners, setExpandedCleaners] = useState({});
  const alertTimerRef = useRef(null);
  // For multi-cleaner: track which cleaner we're reviewing
  const [reviewingCleaner, setReviewingCleaner] = useState(null);
  const [reviewedCleanerIds, setReviewedCleanerIds] = useState(new Set());
  // Check if this is a multi-cleaner job
  const isMultiCleanerJob = appointment.isMultiCleanerJob ||
    (appointment.cleanersNeeded && appointment.cleanersNeeded > 1) ||
    (assignedCleaners.length > 1);

  useEffect(() => {
    fetchCleaningStatus();
    // Cleanup timer on unmount
    return () => {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
      }
    };
  }, [appointment.id]);

  const fetchCleaningStatus = async () => {
    try {
      console.log("[TodaysCleaningCard] Appointment data:", {
        id: appointment.id,
        completed: appointment.completed,
        date: appointment.date,
      });

      // Check completed status first (doesn't require network request)
      if (appointment.completed) {
        console.log("[TodaysCleaningCard] Setting status to COMPLETED");
        setCleaningStatus("completed");
      } else {
        // Only fetch photo status if not completed
        try {
          const response = await fetch(
            `${API_BASE}/job-photos/${appointment.id}/status`,
            {
              headers: {
                Authorization: `Bearer ${state.currentUser.token}`,
              },
            }
          );
          const data = await response.json();
          console.log("[TodaysCleaningCard] Photo status:", data);

          if (data.hasBeforePhotos) {
            console.log("[TodaysCleaningCard] Setting status to IN_PROGRESS");
            setCleaningStatus("in_progress");
          } else {
            console.log("[TodaysCleaningCard] Setting status to NOT_STARTED");
            setCleaningStatus("not_started");
          }
        } catch (photoError) {
          console.error("Error fetching photo status:", photoError);
          setCleaningStatus("not_started");
        }
      }

      // Fetch assigned cleaners info
      if (appointment.employeesAssigned && appointment.employeesAssigned.length > 0) {
        const cleanerPromises = appointment.employeesAssigned.map(async (cleanerId) => {
          const cleanerRes = await fetch(
            `${API_BASE}/employee-info/cleaner/${cleanerId}`,
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

  const handleReviewComplete = (data) => {
    setShowReviewModal(false);

    // Track which cleaner was reviewed for multi-cleaner jobs
    if (isMultiCleanerJob && reviewingCleaner) {
      setReviewedCleanerIds((prev) => new Set([...prev, reviewingCleaner.id]));
      setReviewingCleaner(null);

      // Only call onReviewSubmitted when ALL cleaners have been reviewed
      const newReviewedCount = reviewedCleanerIds.size + 1;
      if (newReviewedCount >= assignedCleaners.length && onReviewSubmitted) {
        onReviewSubmitted(appointment.id);
      }
    } else {
      // Solo job - update parent state immediately
      if (onReviewSubmitted) {
        onReviewSubmitted(appointment.id);
      }
    }

    // Use setTimeout to ensure the modal is fully closed before showing the alert
    alertTimerRef.current = setTimeout(() => {
      const bothReviewed = data?.status?.bothReviewed;
      if (isMultiCleanerJob) {
        const remaining = assignedCleaners.length - (reviewedCleanerIds.size + 1);
        Alert.alert(
          "Thank you!",
          remaining > 0
            ? `Review submitted! You have ${remaining} more cleaner${remaining > 1 ? "s" : ""} to review.`
            : "All cleaners have been reviewed. Thank you!"
        );
      } else {
        Alert.alert(
          "Thank you!",
          bothReviewed
            ? "Both reviews are now visible to each other."
            : "Your review has been submitted. It will become visible once your cleaner submits their review."
        );
      }
    }, 300);
  };

  // Helper to start reviewing a specific cleaner
  const startReviewForCleaner = (cleaner) => {
    setReviewingCleaner(cleaner);
    setShowReviewModal(true);
  };

  const fetchPhotos = async () => {
    setPhotosLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/job-photos/${appointment.id}`,
        {
          headers: {
            Authorization: `Bearer ${state.currentUser.token}`,
          },
        }
      );
      const data = await response.json();

      console.log("[TodaysCleaningCard] Photos response:", {
        hasBeforePhotos: data.hasBeforePhotos,
        hasAfterPhotos: data.hasAfterPhotos,
        beforeCount: data.beforePhotos?.length || 0,
        afterCount: data.afterPhotos?.length || 0,
        error: data.error,
      });

      if (data.error) {
        Alert.alert("Error", data.error);
        return;
      }

      // Photos already have photoData with full data URI from upload
      const beforePhotos = data.beforePhotos || [];
      const afterPhotos = data.afterPhotos || [];

      setPhotos({ before: beforePhotos, after: afterPhotos });
    } catch (error) {
      console.error("Error fetching photos:", error);
      Alert.alert("Error", "Failed to load photos");
    } finally {
      setPhotosLoading(false);
    }
  };

  const handleViewPhotos = () => {
    setShowPhotosModal(true);
    fetchPhotos();
  };

  // Group photos by room/location
  const groupPhotosByRoom = (photoList) => {
    const grouped = {};
    photoList.forEach((photo) => {
      const room = photo.room || "Other";
      if (!grouped[room]) {
        grouped[room] = [];
      }
      grouped[room].push(photo);
    });
    // Sort rooms alphabetically, but put "Other" at the end
    const sortedRooms = Object.keys(grouped).sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });
    return { grouped, sortedRooms };
  };

  // Group photos by cleaner for multi-cleaner jobs
  const groupPhotosByCleaner = (photoList) => {
    const grouped = {};
    photoList.forEach((photo) => {
      const cleanerId = photo.cleanerId || "unknown";
      if (!grouped[cleanerId]) {
        grouped[cleanerId] = [];
      }
      grouped[cleanerId].push(photo);
    });
    return grouped;
  };

  // Get cleaner name by ID
  const getCleanerName = (cleanerId) => {
    const cleaner = assignedCleaners.find((c) => c.id === cleanerId || c.id === parseInt(cleanerId, 10));
    return cleaner?.username || `Cleaner ${cleanerId}`;
  };

  const toggleRoomExpanded = (room) => {
    setExpandedRooms((prev) => ({
      ...prev,
      [room]: !prev[room],
    }));
  };

  const toggleCleanerExpanded = (cleanerId) => {
    setExpandedCleaners((prev) => ({
      ...prev,
      [cleanerId]: !prev[cleanerId],
    }));
  };

  // Calculate photo dimensions based on size slider
  const getPhotoWidth = () => {
    const baseWidth = screenWidth - spacing.md * 4;
    return baseWidth * photoSize;
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

          {assignedCleaners.length > 0 ? (
            <View style={styles.cleanerInfo}>
              <Text style={styles.cleanerLabel}>Your Cleaner:</Text>
              {assignedCleaners.map((cleaner, index) => (
                <Text key={cleaner?.id || index} style={styles.cleanerName}>
                  {cleaner?.username || "Assigned Cleaner"}
                </Text>
              ))}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.noCleanerInfo}
              onPress={appointment.pendingRequestCount > 0 ? () => navigate("/client-requests") : undefined}
              activeOpacity={appointment.pendingRequestCount > 0 ? 0.7 : 1}
            >
              <Icon name="user-times" size={16} color={colors.warning[600]} />
              <View style={styles.noCleanerTextContainer}>
                <Text style={styles.noCleanerLabel}>No Cleaner Assigned</Text>
                {appointment.pendingRequestCount > 0 ? (
                  <View style={styles.requestsRow}>
                    <Text style={styles.noCleanerTextWithRequests}>
                      {appointment.pendingRequestCount} cleaner{appointment.pendingRequestCount > 1 ? "s" : ""} requesting to clean
                    </Text>
                    <View style={styles.reviewRequestsBadge}>
                      <Text style={styles.reviewRequestsLink}>Review</Text>
                      <Icon name="chevron-right" size={10} color={colors.secondary[600]} />
                    </View>
                  </View>
                ) : (
                  <Text style={styles.noCleanerText}>
                    Waiting for a cleaner to accept this appointment
                  </Text>
                )}
              </View>
            </TouchableOpacity>
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
                <Icon name="tint" size={10} color={
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

          {/* Action buttons when completed */}
          {cleaningStatus === "completed" && (
            <View style={styles.actionButtons}>
              {/* View Photos button */}
              <Pressable
                style={styles.viewPhotosButton}
                onPress={handleViewPhotos}
              >
                <Icon name="camera" size={16} color={colors.primary[600]} />
                <Text style={styles.viewPhotosButtonText}>View Photos</Text>
              </Pressable>

              {/* Review buttons - different for multi-cleaner vs solo */}
              {isMultiCleanerJob ? (
                // Multi-cleaner: Show review button for each cleaner
                <View style={styles.multiCleanerReviews}>
                  <Text style={styles.multiCleanerReviewsTitle}>Review Your Cleaners:</Text>
                  {assignedCleaners.map((cleaner) => {
                    const isReviewed = reviewedCleanerIds.has(cleaner.id);
                    return (
                      <View key={cleaner.id} style={styles.cleanerReviewRow}>
                        <Text style={styles.cleanerReviewName}>{cleaner.username || "Cleaner"}</Text>
                        {isReviewed ? (
                          <View style={styles.cleanerReviewedBadge}>
                            <Icon name="check-circle" size={12} color={colors.success[600]} />
                            <Text style={styles.cleanerReviewedText}>Reviewed</Text>
                          </View>
                        ) : (
                          <Pressable
                            style={styles.cleanerReviewButton}
                            onPress={() => startReviewForCleaner(cleaner)}
                          >
                            <Icon name="star" size={12} color={colors.neutral[0]} />
                            <Text style={styles.cleanerReviewButtonText}>Review</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                // Solo job: Single review button
                <>
                  {!appointment.hasClientReview && (
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
                </>
              )}
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
              onPress={() => {
                setShowReviewModal(false);
                setReviewingCleaner(null);
              }}
              style={styles.reviewModalCloseButton}
            >
              <Icon name="times" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.reviewModalTitle}>
              {isMultiCleanerJob && reviewingCleaner
                ? `Review ${reviewingCleaner.username || "Cleaner"}`
                : "Review Your Cleaner"}
            </Text>
            <View style={styles.reviewModalCloseButton} />
          </View>
          <ScrollView style={styles.reviewModalContent}>
            <MultiAspectReviewForm
              state={state}
              appointmentId={appointment.id}
              userId={
                isMultiCleanerJob && reviewingCleaner
                  ? reviewingCleaner.id
                  : assignedCleaners[0]?.id || parseInt(appointment.employeesAssigned?.[0], 10)
              }
              reviewType="homeowner_to_cleaner"
              revieweeName={
                isMultiCleanerJob && reviewingCleaner
                  ? reviewingCleaner.username || "Cleaner"
                  : assignedCleaners[0]?.username || "Your Cleaner"
              }
              onComplete={handleReviewComplete}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Photos Modal */}
      <Modal
        visible={showPhotosModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.photosModalContainer}>
          <View style={styles.photosModalHeader}>
            <TouchableOpacity
              onPress={() => setShowPhotosModal(false)}
              style={styles.photosModalCloseButton}
            >
              <Icon name="times" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.photosModalTitle}>Cleaning Photos</Text>
            <View style={styles.photosModalCloseButton} />
          </View>

          {/* Photo Type Tabs */}
          <View style={styles.photoTabs}>
            <Pressable
              style={[
                styles.photoTab,
                activePhotoTab === "before" && styles.photoTabActive,
              ]}
              onPress={() => setActivePhotoTab("before")}
            >
              <Text
                style={[
                  styles.photoTabText,
                  activePhotoTab === "before" && styles.photoTabTextActive,
                ]}
              >
                Before ({photos.before.length})
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.photoTab,
                activePhotoTab === "after" && styles.photoTabActive,
              ]}
              onPress={() => setActivePhotoTab("after")}
            >
              <Text
                style={[
                  styles.photoTabText,
                  activePhotoTab === "after" && styles.photoTabTextActive,
                ]}
              >
                After ({photos.after.length})
              </Text>
            </Pressable>
          </View>

          {/* Size Slider */}
          <View style={styles.sizeSliderContainer}>
            <Pressable
              style={styles.sizeButton}
              onPress={() => setPhotoSize(Math.max(0.5, photoSize - 0.25))}
            >
              <Icon name="search-minus" size={16} color={colors.text.secondary} />
            </Pressable>
            <View style={styles.sliderWrapper}>
              {[0.5, 0.75, 1, 1.25, 1.5].map((size) => (
                <Pressable
                  key={size}
                  style={[
                    styles.sliderStep,
                    photoSize === size && styles.sliderStepActive,
                  ]}
                  onPress={() => setPhotoSize(size)}
                >
                  <View
                    style={[
                      styles.sliderDot,
                      photoSize >= size && styles.sliderDotActive,
                    ]}
                  />
                </Pressable>
              ))}
              <View style={styles.sliderTrackLine} />
            </View>
            <Pressable
              style={styles.sizeButton}
              onPress={() => setPhotoSize(Math.min(1.5, photoSize + 0.25))}
            >
              <Icon name="search-plus" size={16} color={colors.text.secondary} />
            </Pressable>
          </View>

          {/* Photos Content */}
          <ScrollView style={styles.photosContent}>
            {photosLoading ? (
              <View style={styles.photosLoading}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
                <Text style={styles.photosLoadingText}>Loading photos...</Text>
              </View>
            ) : (
              <View style={styles.photosGrid}>
                {(() => {
                  const currentPhotos = activePhotoTab === "before" ? photos.before : photos.after;
                  if (currentPhotos.length === 0) {
                    return (
                      <View style={styles.noPhotosContainer}>
                        <Icon name="camera" size={48} color={colors.neutral[300]} />
                        <Text style={styles.noPhotosText}>
                          No {activePhotoTab} photos available
                        </Text>
                      </View>
                    );
                  }

                  // For multi-cleaner jobs, group by cleaner first
                  if (isMultiCleanerJob && assignedCleaners.length > 1) {
                    const photosByCleaner = groupPhotosByCleaner(currentPhotos);
                    const cleanerIds = Object.keys(photosByCleaner);

                    return cleanerIds.map((cleanerId) => {
                      const cleanerPhotos = photosByCleaner[cleanerId];
                      const cleanerName = getCleanerName(cleanerId);
                      const isCleanerExpanded = expandedCleaners[cleanerId] !== false;
                      const { grouped, sortedRooms } = groupPhotosByRoom(cleanerPhotos);

                      return (
                        <View key={cleanerId} style={styles.cleanerPhotoSection}>
                          <Pressable
                            style={styles.cleanerPhotoHeader}
                            onPress={() => toggleCleanerExpanded(cleanerId)}
                          >
                            <View style={styles.cleanerPhotoHeaderLeft}>
                              <Icon
                                name={isCleanerExpanded ? "chevron-down" : "chevron-right"}
                                size={14}
                                color={colors.text.secondary}
                              />
                              <Icon name="user" size={14} color={colors.primary[600]} />
                              <Text style={styles.cleanerPhotoTitle}>{cleanerName}</Text>
                              <View style={styles.cleanerPhotoCount}>
                                <Text style={styles.cleanerPhotoCountText}>{cleanerPhotos.length} photos</Text>
                              </View>
                            </View>
                          </Pressable>

                          {isCleanerExpanded && sortedRooms.map((room) => {
                            const roomPhotos = grouped[room];
                            const roomKey = `${cleanerId}-${room}`;
                            const isRoomExpanded = expandedRooms[roomKey] !== false;

                            return (
                              <View key={roomKey} style={styles.roomSection}>
                                <Pressable
                                  style={styles.roomHeader}
                                  onPress={() => toggleRoomExpanded(roomKey)}
                                >
                                  <View style={styles.roomHeaderLeft}>
                                    <Icon
                                      name={isRoomExpanded ? "chevron-down" : "chevron-right"}
                                      size={14}
                                      color={colors.text.secondary}
                                    />
                                    <Text style={styles.roomTitle}>{room}</Text>
                                    <View style={styles.roomCount}>
                                      <Text style={styles.roomCountText}>{roomPhotos.length}</Text>
                                    </View>
                                  </View>
                                </Pressable>

                                {isRoomExpanded && (
                                  <View style={[
                                    styles.roomPhotos,
                                    photoSize < 0.7 && styles.roomPhotosGrid
                                  ]}>
                                    {roomPhotos.map((photo, index) => (
                                      <View
                                        key={photo.id || index}
                                        style={[
                                          styles.photoItem,
                                          {
                                            width: photoSize < 0.7
                                              ? (screenWidth - spacing.md * 4 - spacing.sm) / 2
                                              : getPhotoWidth(),
                                            alignSelf: photoSize >= 0.7 ? 'center' : 'auto'
                                          }
                                        ]}
                                      >
                                        <Image
                                          source={{ uri: photo.photoData }}
                                          style={[
                                            styles.photoImage,
                                            {
                                              width: '100%',
                                              height: photoSize < 0.7
                                                ? (screenWidth - spacing.md * 4 - spacing.sm) / 2
                                                : getPhotoWidth()
                                            }
                                          ]}
                                          resizeMode="cover"
                                        />
                                        {roomPhotos.length > 1 && (
                                          <View style={styles.photoIndex}>
                                            <Text style={styles.photoIndexText}>
                                              {index + 1}/{roomPhotos.length}
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                    ))}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      );
                    });
                  }

                  // Solo job: group by room only
                  const { grouped, sortedRooms } = groupPhotosByRoom(currentPhotos);

                  return sortedRooms.map((room) => {
                    const roomPhotos = grouped[room];
                    const isExpanded = expandedRooms[room] !== false; // Default to expanded

                    return (
                      <View key={room} style={styles.roomSection}>
                        <Pressable
                          style={styles.roomHeader}
                          onPress={() => toggleRoomExpanded(room)}
                        >
                          <View style={styles.roomHeaderLeft}>
                            <Icon
                              name={isExpanded ? "chevron-down" : "chevron-right"}
                              size={14}
                              color={colors.text.secondary}
                            />
                            <Text style={styles.roomTitle}>{room}</Text>
                            <View style={styles.roomCount}>
                              <Text style={styles.roomCountText}>{roomPhotos.length}</Text>
                            </View>
                          </View>
                        </Pressable>

                        {isExpanded && (
                          <View style={[
                            styles.roomPhotos,
                            photoSize < 0.7 && styles.roomPhotosGrid
                          ]}>
                            {roomPhotos.map((photo, index) => (
                              <View
                                key={photo.id || index}
                                style={[
                                  styles.photoItem,
                                  {
                                    width: photoSize < 0.7
                                      ? (screenWidth - spacing.md * 4 - spacing.sm) / 2
                                      : getPhotoWidth(),
                                    alignSelf: photoSize >= 0.7 ? 'center' : 'auto'
                                  }
                                ]}
                              >
                                <Image
                                  source={{ uri: photo.photoData }}
                                  style={[
                                    styles.photoImage,
                                    {
                                      width: '100%',
                                      height: photoSize < 0.7
                                        ? (screenWidth - spacing.md * 4 - spacing.sm) / 2
                                        : getPhotoWidth()
                                    }
                                  ]}
                                  resizeMode="cover"
                                />
                                {roomPhotos.length > 1 && (
                                  <View style={styles.photoIndex}>
                                    <Text style={styles.photoIndexText}>
                                      {index + 1}/{roomPhotos.length}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  });
                })()}
              </View>
            )}
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
  noCleanerInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning[200],
    gap: spacing.md,
  },
  noCleanerTextContainer: {
    flex: 1,
  },
  noCleanerLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  noCleanerText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
    marginTop: 2,
  },
  noCleanerTextWithRequests: {
    fontSize: typography.fontSize.xs,
    color: colors.secondary[700],
  },
  requestsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  reviewRequestsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.secondary[100],
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  reviewRequestsLink: {
    color: colors.secondary[600],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
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
  // Multi-cleaner review styles
  multiCleanerReviews: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  multiCleanerReviewsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  cleanerReviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  cleanerReviewName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  cleanerReviewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.warning[500],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  cleanerReviewButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  cleanerReviewedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.success[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  cleanerReviewedText: {
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  // Multi-cleaner photo grouping styles
  cleanerPhotoSection: {
    marginBottom: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  cleanerPhotoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: colors.primary[50],
  },
  cleanerPhotoHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cleanerPhotoTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  cleanerPhotoCount: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  cleanerPhotoCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
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
  // Photo viewing styles
  actionButtons: {
    gap: spacing.sm,
  },
  viewPhotosButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  viewPhotosButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  photosModalContainer: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  photosModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  photosModalCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  photosModalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  photoTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  photoTab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  photoTabActive: {
    borderBottomColor: colors.primary[500],
  },
  photoTabText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },
  photoTabTextActive: {
    color: colors.primary[600],
  },
  photosContent: {
    flex: 1,
  },
  photosLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },
  photosLoadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  photosGrid: {
    padding: spacing.md,
  },
  noPhotosContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },
  noPhotosText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
  },
  photoItem: {
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.neutral[100],
  },
  photoImage: {
    backgroundColor: colors.neutral[200],
  },
  photoLabel: {
    position: "absolute",
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  photoLabelText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  // Size slider styles
  sizeSliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    gap: spacing.sm,
  },
  sizeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  sliderWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 36,
    position: "relative",
    paddingHorizontal: spacing.sm,
  },
  sliderTrackLine: {
    position: "absolute",
    left: spacing.sm,
    right: spacing.sm,
    height: 3,
    backgroundColor: colors.neutral[200],
    borderRadius: 2,
    zIndex: 0,
  },
  sliderStep: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  sliderStepActive: {
    // Active step styling if needed
  },
  sliderDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.neutral[300],
    borderWidth: 2,
    borderColor: colors.neutral[0],
    ...shadows.sm,
  },
  sliderDotActive: {
    backgroundColor: colors.primary[500],
  },
  // Room section styles
  roomSection: {
    marginBottom: spacing.md,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  roomHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
  },
  roomHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  roomTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  roomCount: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  roomCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  roomPhotos: {
    padding: spacing.sm,
  },
  roomPhotosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  photoIndex: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  photoIndexText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
});

export default TodaysCleaningCard;
