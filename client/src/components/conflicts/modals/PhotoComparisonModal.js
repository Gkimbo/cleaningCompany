import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
  Pressable,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../services/styles/theme";

const { width: screenWidth } = Dimensions.get("window");

const PhotoComparisonModal = ({ visible, onClose, beforePhotos = [], afterPhotos = [] }) => {
  const [selectedRoomIndices, setSelectedRoomIndices] = useState({});
  const [expandedRooms, setExpandedRooms] = useState({});
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);

  // Group photos by room
  const roomData = useMemo(() => {
    const rooms = {};

    // Process before photos
    beforePhotos.forEach((photo) => {
      const room = photo.room || "Other";
      if (!rooms[room]) {
        rooms[room] = { before: [], after: [] };
      }
      rooms[room].before.push(photo);
    });

    // Process after photos
    afterPhotos.forEach((photo) => {
      const room = photo.room || "Other";
      if (!rooms[room]) {
        rooms[room] = { before: [], after: [] };
      }
      rooms[room].after.push(photo);
    });

    // Sort rooms alphabetically, but put "Other" at the end
    const sortedRoomNames = Object.keys(rooms).sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });

    return { rooms, sortedRoomNames };
  }, [beforePhotos, afterPhotos]);

  const getSelectedIndex = (room, type) => {
    const key = `${room}-${type}`;
    return selectedRoomIndices[key] || 0;
  };

  const setSelectedIndex = (room, type, index) => {
    const key = `${room}-${type}`;
    setSelectedRoomIndices((prev) => ({ ...prev, [key]: index }));
  };

  const toggleRoomExpanded = (room) => {
    setExpandedRooms((prev) => ({
      ...prev,
      [room]: prev[room] === false ? true : false,
    }));
  };

  const isRoomExpanded = (room) => {
    return expandedRooms[room] !== false; // Default to expanded
  };

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const totalPhotos = beforePhotos.length + afterPhotos.length;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="times" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Before & After Photos</Text>
            <Text style={styles.subtitle}>
              {roomData.sortedRoomNames.length} rooms • {totalPhotos} photos
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Room List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {roomData.sortedRoomNames.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="image" size={48} color={colors.neutral[300]} />
              <Text style={styles.emptyText}>No photos available</Text>
            </View>
          ) : (
            roomData.sortedRoomNames.map((room) => {
              const { before, after } = roomData.rooms[room];
              const isExpanded = isRoomExpanded(room);
              const beforeIndex = getSelectedIndex(room, "before");
              const afterIndex = getSelectedIndex(room, "after");
              const currentBefore = before[beforeIndex];
              const currentAfter = after[afterIndex];

              return (
                <View key={room} style={styles.roomCard}>
                  {/* Room Header */}
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
                    </View>
                    <View style={styles.roomBadges}>
                      {before.length > 0 && (
                        <View style={[styles.photoBadge, styles.beforeBadge]}>
                          <Text style={styles.photoBadgeText}>{before.length} before</Text>
                        </View>
                      )}
                      {after.length > 0 && (
                        <View style={[styles.photoBadge, styles.afterBadge]}>
                          <Text style={styles.photoBadgeText}>{after.length} after</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>

                  {/* Room Content */}
                  {isExpanded && (
                    <View style={styles.roomContent}>
                      {/* Comparison Grid */}
                      <View style={styles.comparisonGrid}>
                        {/* Before Column */}
                        <View style={styles.photoColumn}>
                          <View style={[styles.columnHeader, styles.beforeHeader]}>
                            <Icon name="clock-o" size={12} color={colors.warning[700]} />
                            <Text style={styles.columnHeaderText}>Before</Text>
                          </View>

                          {currentBefore ? (
                            <Pressable
                              style={styles.photoWrapper}
                              onPress={() => setFullscreenPhoto(currentBefore)}
                            >
                              <Image
                                source={{ uri: currentBefore.photoData }}
                                style={styles.photo}
                                resizeMode="cover"
                              />
                              <View style={styles.photoOverlay}>
                                <Icon name="expand" size={16} color={colors.neutral[0]} />
                              </View>
                              {currentBefore.takenAt && (
                                <View style={styles.photoTime}>
                                  <Text style={styles.photoTimeText}>
                                    {formatDate(currentBefore.takenAt)}
                                  </Text>
                                </View>
                              )}
                            </Pressable>
                          ) : (
                            <View style={styles.noPhoto}>
                              <Icon name="image" size={24} color={colors.neutral[400]} />
                              <Text style={styles.noPhotoText}>No photo</Text>
                            </View>
                          )}

                          {/* Before Thumbnails */}
                          {before.length > 1 && (
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              style={styles.thumbnailStrip}
                              contentContainerStyle={styles.thumbnailContent}
                            >
                              {before.map((photo, index) => (
                                <TouchableOpacity
                                  key={`before-${room}-${index}`}
                                  style={[
                                    styles.thumbnail,
                                    index === beforeIndex && styles.thumbnailActive,
                                  ]}
                                  onPress={() => setSelectedIndex(room, "before", index)}
                                >
                                  <Image
                                    source={{ uri: photo.photoData }}
                                    style={styles.thumbnailImage}
                                    resizeMode="cover"
                                  />
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          )}
                        </View>

                        {/* Arrow Divider */}
                        <View style={styles.arrowDivider}>
                          <Icon name="arrow-right" size={16} color={colors.primary[500]} />
                        </View>

                        {/* After Column */}
                        <View style={styles.photoColumn}>
                          <View style={[styles.columnHeader, styles.afterHeader]}>
                            <Icon name="check-circle" size={12} color={colors.success[700]} />
                            <Text style={styles.columnHeaderText}>After</Text>
                          </View>

                          {currentAfter ? (
                            <Pressable
                              style={styles.photoWrapper}
                              onPress={() => setFullscreenPhoto(currentAfter)}
                            >
                              <Image
                                source={{ uri: currentAfter.photoData }}
                                style={styles.photo}
                                resizeMode="cover"
                              />
                              <View style={styles.photoOverlay}>
                                <Icon name="expand" size={16} color={colors.neutral[0]} />
                              </View>
                              {currentAfter.takenAt && (
                                <View style={styles.photoTime}>
                                  <Text style={styles.photoTimeText}>
                                    {formatDate(currentAfter.takenAt)}
                                  </Text>
                                </View>
                              )}
                            </Pressable>
                          ) : (
                            <View style={styles.noPhoto}>
                              <Icon name="image" size={24} color={colors.neutral[400]} />
                              <Text style={styles.noPhotoText}>No photo</Text>
                            </View>
                          )}

                          {/* After Thumbnails */}
                          {after.length > 1 && (
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              style={styles.thumbnailStrip}
                              contentContainerStyle={styles.thumbnailContent}
                            >
                              {after.map((photo, index) => (
                                <TouchableOpacity
                                  key={`after-${room}-${index}`}
                                  style={[
                                    styles.thumbnail,
                                    index === afterIndex && styles.thumbnailActive,
                                  ]}
                                  onPress={() => setSelectedIndex(room, "after", index)}
                                >
                                  <Image
                                    source={{ uri: photo.photoData }}
                                    style={styles.thumbnailImage}
                                    resizeMode="cover"
                                  />
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          )}
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Fullscreen Photo Viewer */}
        {fullscreenPhoto && (
          <Modal
            visible={true}
            animationType="fade"
            transparent={true}
            onRequestClose={() => setFullscreenPhoto(null)}
          >
            <View style={styles.fullscreenContainer}>
              <TouchableOpacity
                style={styles.fullscreenClose}
                onPress={() => setFullscreenPhoto(null)}
              >
                <Icon name="times" size={28} color={colors.neutral[0]} />
              </TouchableOpacity>
              <Image
                source={{ uri: fullscreenPhoto.photoData }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
              <View style={styles.fullscreenInfo}>
                {fullscreenPhoto.room && (
                  <Text style={styles.fullscreenRoom}>{fullscreenPhoto.room}</Text>
                )}
                {fullscreenPhoto.takenAt && (
                  <Text style={styles.fullscreenTime}>
                    {formatDate(fullscreenPhoto.takenAt)}
                  </Text>
                )}
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  headerSpacer: {
    width: 44,
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
    paddingVertical: spacing["4xl"],
  },
  emptyText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
  },
  roomCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border.light,
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
  roomBadges: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  photoBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  beforeBadge: {
    backgroundColor: colors.warning[100],
  },
  afterBadge: {
    backgroundColor: colors.success[100],
  },
  photoBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  roomContent: {
    padding: spacing.md,
  },
  comparisonGrid: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  photoColumn: {
    flex: 1,
  },
  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  beforeHeader: {
    backgroundColor: colors.warning[50],
  },
  afterHeader: {
    backgroundColor: colors.success[50],
  },
  columnHeaderText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  arrowDivider: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  photoWrapper: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.neutral[100],
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoOverlay: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  photoTime: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  photoTimeText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[0],
    textAlign: "center",
  },
  noPhoto: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.light,
    borderStyle: "dashed",
  },
  noPhotoText: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  thumbnailStrip: {
    marginTop: spacing.sm,
  },
  thumbnailContent: {
    gap: spacing.xs,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbnailActive: {
    borderColor: colors.primary[500],
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  bottomSpacer: {
    height: spacing.xl,
  },

  // Fullscreen styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenClose: {
    position: "absolute",
    top: 50,
    left: spacing.md,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 22,
  },
  fullscreenImage: {
    width: screenWidth,
    height: "80%",
  },
  fullscreenInfo: {
    position: "absolute",
    bottom: 50,
    alignItems: "center",
  },
  fullscreenRoom: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  fullscreenTime: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[400],
    marginTop: spacing.xs,
  },
});

export default PhotoComparisonModal;
