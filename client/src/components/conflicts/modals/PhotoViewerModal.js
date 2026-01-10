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

const PhotoViewerModal = ({ visible, onClose, photo, allPhotos }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!photo) return null;

  // Find all photos in the same category for navigation
  const categoryPhotos = allPhotos
    ? [
        ...(allPhotos.before || []).map(p => ({ ...p, category: "before" })),
        ...(allPhotos.after || []).map(p => ({ ...p, category: "after" })),
        ...(allPhotos.passes || []).map(p => ({ ...p, category: "passes" })),
      ]
    : [photo];

  const currentPhoto = categoryPhotos[currentIndex] || photo;

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getCategoryColor = (category) => {
    const categoryColors = {
      before: colors.warning[500],
      after: colors.success[500],
      passes: colors.primary[500],
      evidence: colors.error[500],
    };
    return categoryColors[category] || colors.neutral[500];
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < categoryPhotos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
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

          <View style={styles.headerCenter}>
            <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(currentPhoto.category) }]}>
              <Text style={styles.categoryText}>
                {currentPhoto.category?.toUpperCase()}
              </Text>
            </View>
            {categoryPhotos.length > 1 && (
              <Text style={styles.counterText}>
                {currentIndex + 1} / {categoryPhotos.length}
              </Text>
            )}
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {/* Image */}
        <View style={styles.imageContainer}>
          {categoryPhotos.length > 1 && currentIndex > 0 && (
            <TouchableOpacity style={[styles.navButton, styles.navButtonLeft]} onPress={handlePrevious}>
              <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
            </TouchableOpacity>
          )}

          <Image
            source={{ uri: currentPhoto.photoData }}
            style={styles.image}
            resizeMode="contain"
          />

          {categoryPhotos.length > 1 && currentIndex < categoryPhotos.length - 1 && (
            <TouchableOpacity style={[styles.navButton, styles.navButtonRight]} onPress={handleNext}>
              <Icon name="chevron-right" size={24} color={colors.neutral[0]} />
            </TouchableOpacity>
          )}
        </View>

        {/* Info Panel */}
        <View style={styles.infoPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {currentPhoto.room && (
              <View style={styles.infoItem}>
                <Icon name="home" size={12} color={colors.neutral[300]} />
                <Text style={styles.infoText}>{currentPhoto.room}</Text>
              </View>
            )}
            {currentPhoto.takenAt && (
              <View style={styles.infoItem}>
                <Icon name="clock-o" size={12} color={colors.neutral[300]} />
                <Text style={styles.infoText}>{formatDate(currentPhoto.takenAt)}</Text>
              </View>
            )}
            {currentPhoto.cleaner && (
              <View style={styles.infoItem}>
                <Icon name="user" size={12} color={colors.neutral[300]} />
                <Text style={styles.infoText}>{currentPhoto.cleaner.name}</Text>
              </View>
            )}
          </ScrollView>

          {currentPhoto.notes && (
            <View style={styles.notesContainer}>
              <Icon name="comment" size={12} color={colors.neutral[300]} />
              <Text style={styles.notesText}>{currentPhoto.notes}</Text>
            </View>
          )}
        </View>

        {/* Thumbnail Strip */}
        {categoryPhotos.length > 1 && (
          <View style={styles.thumbnailStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categoryPhotos.map((p, index) => (
                <TouchableOpacity
                  key={`${p.category}-${p.id || index}`}
                  style={[styles.thumbnail, index === currentIndex && styles.thumbnailActive]}
                  onPress={() => setCurrentIndex(index)}
                >
                  <Image
                    source={{ uri: p.photoData }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                  <View style={[styles.thumbnailBadge, { backgroundColor: getCategoryColor(p.category) }]}>
                    <Text style={styles.thumbnailBadgeText}>{p.category?.charAt(0).toUpperCase()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
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
  headerCenter: {
    alignItems: "center",
    gap: spacing.xs,
  },
  headerSpacer: {
    width: 44,
  },
  categoryBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  categoryText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
    letterSpacing: 1,
  },
  counterText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[300],
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  image: {
    width: screenWidth,
    height: screenHeight * 0.5,
  },
  navButton: {
    position: "absolute",
    top: "50%",
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  navButtonLeft: {
    left: spacing.md,
  },
  navButtonRight: {
    right: spacing.md,
  },
  infoPanel: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    marginRight: spacing.sm,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[200],
  },
  notesContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  notesText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.neutral[200],
    lineHeight: 18,
  },
  thumbnailStrip: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  thumbnail: {
    width: 60,
    height: 60,
    marginHorizontal: spacing.xs,
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
  thumbnailBadge: {
    position: "absolute",
    top: 2,
    left: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailBadgeText: {
    fontSize: 8,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
});

export default PhotoViewerModal;
