import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../services/styles/theme";

const { width: screenWidth } = Dimensions.get("window");
const PHOTO_SIZE = (screenWidth - spacing.md * 2 - spacing.sm * 2) / 3;

const EvidenceGallerySection = ({ photos, evidencePhotos, loading, onPhotoPress, onComparePress }) => {
  const [activeCategory, setActiveCategory] = useState("all");

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading photos...</Text>
      </View>
    );
  }

  const allPhotos = [
    ...(photos?.before || []).map(p => ({ ...p, category: "before" })),
    ...(photos?.after || []).map(p => ({ ...p, category: "after" })),
    ...(photos?.passes || []).map(p => ({ ...p, category: "passes" })),
    ...(evidencePhotos || []).map(p => ({ ...p, category: "evidence" })),
  ];

  const categories = [
    { id: "all", label: "All", count: allPhotos.length },
    { id: "before", label: "Before", count: photos?.before?.length || 0 },
    { id: "after", label: "After", count: photos?.after?.length || 0 },
    { id: "passes", label: "Passes", count: photos?.passes?.length || 0 },
    { id: "evidence", label: "Evidence", count: evidencePhotos?.length || 0 },
  ].filter(c => c.count > 0 || c.id === "all");

  const filteredPhotos = activeCategory === "all"
    ? allPhotos
    : allPhotos.filter(p => p.category === activeCategory);

  const getCategoryColor = (category) => {
    const categoryColors = {
      before: colors.warning[500],
      after: colors.success[500],
      passes: colors.primary[500],
      evidence: colors.error[500],
    };
    return categoryColors[category] || colors.neutral[500];
  };

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (allPhotos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="camera" size={48} color={colors.neutral[300]} />
        <Text style={styles.emptyTitle}>No Photos Available</Text>
        <Text style={styles.emptyText}>
          No photos have been uploaded for this appointment.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryTab, activeCategory === cat.id && styles.categoryTabActive]}
            onPress={() => setActiveCategory(cat.id)}
          >
            <Text style={[styles.categoryTabText, activeCategory === cat.id && styles.categoryTabTextActive]}>
              {cat.label}
            </Text>
            <View style={[styles.categoryCount, activeCategory === cat.id && styles.categoryCountActive]}>
              <Text style={[styles.categoryCountText, activeCategory === cat.id && styles.categoryCountTextActive]}>
                {cat.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Photo Grid */}
      <View style={styles.photoGrid}>
        {filteredPhotos.map((photo, index) => (
          <TouchableOpacity
            key={`${photo.category}-${photo.id || index}`}
            style={styles.photoItem}
            onPress={() => onPhotoPress?.(photo)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: photo.photoData }}
              style={styles.photoImage}
              resizeMode="cover"
            />
            <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(photo.category) }]}>
              <Text style={styles.categoryBadgeText}>
                {photo.category.charAt(0).toUpperCase()}
              </Text>
            </View>
            {photo.room && (
              <View style={styles.roomBadge}>
                <Text style={styles.roomText} numberOfLines={1}>{photo.room}</Text>
              </View>
            )}
            {photo.takenAt && (
              <View style={styles.timeBadge}>
                <Icon name="clock-o" size={8} color={colors.neutral[0]} />
                <Text style={styles.timeText}>{formatDate(photo.takenAt)}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Room-grouped view for before/after comparison */}
      {activeCategory === "all" && photos?.before?.length > 0 && photos?.after?.length > 0 && (
        <View style={styles.comparisonSection}>
          <View style={styles.comparisonHeader}>
            <View>
              <Text style={styles.comparisonTitle}>Before & After Comparison</Text>
              <Text style={styles.comparisonSubtitle}>
                Tap any photo to view full screen
              </Text>
            </View>
            {onComparePress && (
              <TouchableOpacity style={styles.compareButton} onPress={onComparePress}>
                <Icon name="columns" size={14} color={colors.neutral[0]} />
                <Text style={styles.compareButtonText}>Full Compare</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Get unique rooms */}
          {[...new Set([
            ...(photos.before?.map(p => p.room) || []),
            ...(photos.after?.map(p => p.room) || []),
          ])].filter(Boolean).map((room) => {
            const beforePhoto = photos.before?.find(p => p.room === room);
            const afterPhoto = photos.after?.find(p => p.room === room);

            if (!beforePhoto && !afterPhoto) return null;

            return (
              <View key={room} style={styles.comparisonRow}>
                <Text style={styles.comparisonRoomLabel}>{room}</Text>
                <View style={styles.comparisonPhotos}>
                  <TouchableOpacity
                    style={styles.comparisonPhoto}
                    onPress={() => beforePhoto && onPhotoPress?.({ ...beforePhoto, category: "before" })}
                    disabled={!beforePhoto}
                  >
                    {beforePhoto ? (
                      <Image
                        source={{ uri: beforePhoto.photoData }}
                        style={styles.comparisonImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.comparisonPlaceholder}>
                        <Text style={styles.placeholderText}>No photo</Text>
                      </View>
                    )}
                    <View style={[styles.comparisonLabel, { backgroundColor: colors.warning[500] }]}>
                      <Text style={styles.comparisonLabelText}>Before</Text>
                    </View>
                  </TouchableOpacity>

                  <Icon name="arrow-right" size={16} color={colors.neutral[300]} />

                  <TouchableOpacity
                    style={styles.comparisonPhoto}
                    onPress={() => afterPhoto && onPhotoPress?.({ ...afterPhoto, category: "after" })}
                    disabled={!afterPhoto}
                  >
                    {afterPhoto ? (
                      <Image
                        source={{ uri: afterPhoto.photoData }}
                        style={styles.comparisonImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.comparisonPlaceholder}>
                        <Text style={styles.placeholderText}>No photo</Text>
                      </View>
                    )}
                    <View style={[styles.comparisonLabel, { backgroundColor: colors.success[500] }]}>
                      <Text style={styles.comparisonLabelText}>After</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  categoriesContainer: {
    marginBottom: spacing.sm,
  },
  categoriesContent: {
    gap: spacing.sm,
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  categoryTabActive: {
    backgroundColor: colors.primary[500],
  },
  categoryTabText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  categoryTabTextActive: {
    color: colors.neutral[0],
  },
  categoryCount: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  categoryCountActive: {
    backgroundColor: colors.primary[400],
  },
  categoryCountText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  categoryCountTextActive: {
    color: colors.neutral[0],
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.neutral[200],
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  categoryBadge: {
    position: "absolute",
    top: spacing.xs,
    left: spacing.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  roomBadge: {
    position: "absolute",
    bottom: spacing.xs,
    left: spacing.xs,
    right: spacing.xs,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  roomText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[0],
  },
  timeBadge: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  timeText: {
    fontSize: 9,
    color: colors.neutral[0],
  },
  comparisonSection: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  comparisonHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  comparisonTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  comparisonSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  compareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  compareButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[0],
  },
  comparisonRow: {
    marginBottom: spacing.md,
  },
  comparisonRoomLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  comparisonPhotos: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  comparisonPhoto: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 140,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.neutral[100],
  },
  comparisonImage: {
    width: "100%",
    height: "100%",
  },
  comparisonPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  comparisonLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: spacing.xs,
    alignItems: "center",
  },
  comparisonLabelText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[0],
  },
});

export default EvidenceGallerySection;
