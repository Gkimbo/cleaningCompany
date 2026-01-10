import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../services/styles/theme";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const PhotoComparisonModal = ({ visible, onClose, beforePhotos = [], afterPhotos = [] }) => {
  const [selectedBefore, setSelectedBefore] = useState(0);
  const [selectedAfter, setSelectedAfter] = useState(0);

  if (!visible) return null;

  const currentBefore = beforePhotos[selectedBefore];
  const currentAfter = afterPhotos[selectedAfter];

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="times" size={24} color={colors.neutral[0]} />
          </TouchableOpacity>
          <Text style={styles.title}>Photo Comparison</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Comparison Area */}
        <View style={styles.comparisonContainer}>
          {/* Before Section */}
          <View style={styles.photoSection}>
            <View style={styles.sectionHeader}>
              <View style={[styles.badge, { backgroundColor: colors.warning[500] }]}>
                <Text style={styles.badgeText}>BEFORE</Text>
              </View>
            </View>

            {currentBefore ? (
              <View style={styles.photoContainer}>
                <Image
                  source={{ uri: currentBefore.photoData }}
                  style={styles.photo}
                  resizeMode="contain"
                />
                <View style={styles.photoInfo}>
                  {currentBefore.room && (
                    <Text style={styles.photoInfoText}>{currentBefore.room}</Text>
                  )}
                  {currentBefore.takenAt && (
                    <Text style={styles.photoInfoTime}>
                      {formatDate(currentBefore.takenAt)}
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.noPhotoContainer}>
                <Icon name="image" size={32} color={colors.neutral[500]} />
                <Text style={styles.noPhotoText}>No before photos</Text>
              </View>
            )}

            {/* Before Thumbnails */}
            {beforePhotos.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailStrip}>
                {beforePhotos.map((photo, index) => (
                  <TouchableOpacity
                    key={`before-${index}`}
                    style={[
                      styles.thumbnail,
                      index === selectedBefore && styles.thumbnailActive,
                    ]}
                    onPress={() => setSelectedBefore(index)}
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

          {/* Divider */}
          <View style={styles.divider}>
            <Icon name="arrows-h" size={20} color={colors.neutral[400]} />
          </View>

          {/* After Section */}
          <View style={styles.photoSection}>
            <View style={styles.sectionHeader}>
              <View style={[styles.badge, { backgroundColor: colors.success[500] }]}>
                <Text style={styles.badgeText}>AFTER</Text>
              </View>
            </View>

            {currentAfter ? (
              <View style={styles.photoContainer}>
                <Image
                  source={{ uri: currentAfter.photoData }}
                  style={styles.photo}
                  resizeMode="contain"
                />
                <View style={styles.photoInfo}>
                  {currentAfter.room && (
                    <Text style={styles.photoInfoText}>{currentAfter.room}</Text>
                  )}
                  {currentAfter.takenAt && (
                    <Text style={styles.photoInfoTime}>
                      {formatDate(currentAfter.takenAt)}
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.noPhotoContainer}>
                <Icon name="image" size={32} color={colors.neutral[500]} />
                <Text style={styles.noPhotoText}>No after photos</Text>
              </View>
            )}

            {/* After Thumbnails */}
            {afterPhotos.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailStrip}>
                {afterPhotos.map((photo, index) => (
                  <TouchableOpacity
                    key={`after-${index}`}
                    style={[
                      styles.thumbnail,
                      index === selectedAfter && styles.thumbnailActive,
                    ]}
                    onPress={() => setSelectedAfter(index)}
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

        {/* Instructions */}
        <View style={styles.instructions}>
          <Icon name="info-circle" size={14} color={colors.neutral[400]} />
          <Text style={styles.instructionsText}>
            Compare before and after photos side by side. Tap thumbnails to switch photos.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  headerSpacer: {
    width: 44,
  },
  comparisonContainer: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
  },
  photoSection: {
    flex: 1,
    padding: spacing.xs,
  },
  sectionHeader: {
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    letterSpacing: 1,
  },
  photoContainer: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  photo: {
    flex: 1,
    width: "100%",
  },
  photoInfo: {
    padding: spacing.sm,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  photoInfoText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[200],
    fontWeight: typography.fontWeight.medium,
  },
  photoInfoTime: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
    marginTop: 2,
  },
  noPhotoContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: radius.lg,
  },
  noPhotoText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    marginTop: spacing.sm,
  },
  divider: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailStrip: {
    marginTop: spacing.sm,
    maxHeight: 60,
  },
  thumbnail: {
    width: 50,
    height: 50,
    marginRight: spacing.xs,
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
  instructions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  instructionsText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
    textAlign: "center",
  },
});

export default PhotoComparisonModal;
