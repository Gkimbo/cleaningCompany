import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { API_BASE } from "../../services/config";
import { parseLocalDate, compareDates } from "../../utils/dateUtils";

const { width: screenWidth } = Dimensions.get("window");

const ArchivedCleanings = ({ state }) => {
  const [loading, setLoading] = useState(true);
  const [archivedAppointments, setArchivedAppointments] = useState([]);
  const [error, setError] = useState(null);

  // Photo modal state
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [photos, setPhotos] = useState({ before: [], after: [] });
  const [photosLoading, setPhotosLoading] = useState(false);
  const [activePhotoTab, setActivePhotoTab] = useState("before");
  const [photoSize, setPhotoSize] = useState(1);
  const [expandedRooms, setExpandedRooms] = useState({});

  useEffect(() => {
    fetchArchivedCleanings();
  }, [state.currentUser.token]);

  const fetchArchivedCleanings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/appointments/archived`, {
        headers: {
          Authorization: `Bearer ${state.currentUser.token}`,
        },
      });
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        // Sort by date descending (most recent first)
        const sorted = (data.appointments || []).sort((a, b) =>
          compareDates(b.date, a.date)
        );
        setArchivedAppointments(sorted);
      }
    } catch (err) {
      console.error("Error fetching archived cleanings:", err);
      setError("Failed to load archived cleanings");
    } finally {
      setLoading(false);
    }
  };

  const fetchPhotos = async (appointmentId) => {
    setPhotosLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/job-photos/${appointmentId}`,
        {
          headers: {
            Authorization: `Bearer ${state.currentUser.token}`,
          },
        }
      );
      const data = await response.json();

      if (data.error) {
        console.error("Error fetching photos:", data.error);
        setPhotos({ before: [], after: [] });
      } else {
        setPhotos({
          before: data.beforePhotos || [],
          after: data.afterPhotos || [],
        });
      }
    } catch (err) {
      console.error("Error fetching photos:", err);
      setPhotos({ before: [], after: [] });
    } finally {
      setPhotosLoading(false);
    }
  };

  const handleViewPhotos = (appointment) => {
    setSelectedAppointment(appointment);
    setShowPhotosModal(true);
    setActivePhotoTab("before");
    setExpandedRooms({});
    fetchPhotos(appointment.id);
  };

  const groupPhotosByRoom = (photoList) => {
    const grouped = {};
    photoList.forEach((photo) => {
      const room = photo.room || "Other";
      if (!grouped[room]) {
        grouped[room] = [];
      }
      grouped[room].push(photo);
    });
    const sortedRooms = Object.keys(grouped).sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });
    return { grouped, sortedRooms };
  };

  const toggleRoomExpanded = (room) => {
    setExpandedRooms((prev) => ({
      ...prev,
      [room]: !prev[room],
    }));
  };

  const getPhotoWidth = () => {
    const baseWidth = screenWidth - spacing.md * 4;
    return baseWidth * photoSize;
  };

  const formatDate = (dateString) => {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading archived cleanings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-circle" size={48} color={colors.error[400]} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchArchivedCleanings}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Icon name="archive" size={24} color={colors.primary[600]} />
        <Text style={styles.headerTitle}>Cleaning Archive</Text>
      </View>
      <Text style={styles.headerSubtitle}>
        View photos from your past cleanings
      </Text>

      {/* Archived Cleanings List */}
      {archivedAppointments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="history" size={64} color={colors.neutral[300]} />
          <Text style={styles.emptyTitle}>No Archived Cleanings</Text>
          <Text style={styles.emptySubtitle}>
            Completed cleanings with reviews will appear here
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {archivedAppointments.map((appointment) => (
            <View key={appointment.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.dateContainer}>
                  <Icon name="calendar" size={14} color={colors.primary[600]} />
                  <Text style={styles.dateText}>{formatDate(appointment.date)}</Text>
                </View>
                <View style={styles.completedBadge}>
                  <Icon name="check-circle" size={12} color={colors.success[600]} />
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.homeName}>
                  {appointment.home?.nickName || appointment.nickName || "Home"}
                </Text>
                {appointment.cleanerName && (
                  <View style={styles.cleanerRow}>
                    <Icon name="user" size={12} color={colors.text.tertiary} />
                    <Text style={styles.cleanerName}>{appointment.cleanerName}</Text>
                  </View>
                )}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.photosButton,
                  pressed && styles.photosButtonPressed,
                ]}
                onPress={() => handleViewPhotos(appointment)}
              >
                <Icon name="camera" size={16} color={colors.primary[600]} />
                <Text style={styles.photosButtonText}>View Photos</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

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
            <Text style={styles.photosModalTitle}>
              {selectedAppointment?.home?.nickName || "Cleaning"} Photos
            </Text>
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

                  const { grouped, sortedRooms } = groupPhotosByRoom(currentPhotos);

                  return sortedRooms.map((room) => {
                    const roomPhotos = grouped[room];
                    const isExpanded = expandedRooms[room] !== false;

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

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  contentContainer: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error[600],
    textAlign: "center",
    marginVertical: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  retryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["4xl"],
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  list: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dateText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.success[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  completedText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[700],
  },
  cardBody: {
    marginBottom: spacing.md,
  },
  homeName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  cleanerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  cleanerName: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  photosButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  photosButtonPressed: {
    backgroundColor: colors.primary[100],
  },
  photosButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  // Photo Modal Styles
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
  sliderStepActive: {},
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
  photoItem: {
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.neutral[100],
  },
  photoImage: {
    backgroundColor: colors.neutral[200],
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
  bottomPadding: {
    height: spacing["4xl"],
  },
});

export default ArchivedCleanings;
