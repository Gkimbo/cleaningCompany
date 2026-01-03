import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Switch,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import PreferredCleanerService from "../../services/fetchRequests/PreferredCleanerService";

const PreferredCleanersSection = ({ homeId, token }) => {
  const [loading, setLoading] = useState(true);
  const [preferredCleaners, setPreferredCleaners] = useState([]);
  const [usePreferredCleaners, setUsePreferredCleaners] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchPreferredCleaners = useCallback(async () => {
    if (!homeId || !token) return;

    setLoading(true);
    const result = await PreferredCleanerService.getPreferredCleaners(token, homeId);
    setPreferredCleaners(result.preferredCleaners || []);
    setUsePreferredCleaners(result.usePreferredCleaners !== false);
    setLoading(false);
  }, [token, homeId]);

  useEffect(() => {
    fetchPreferredCleaners();
  }, [fetchPreferredCleaners]);

  const handleToggle = async (value) => {
    setUpdating(true);
    const result = await PreferredCleanerService.updatePreferredSettings(
      token,
      homeId,
      value
    );
    if (result.success) {
      setUsePreferredCleaners(value);
    } else {
      Alert.alert("Error", result.error || "Failed to update settings");
    }
    setUpdating(false);
  };

  const handleRemoveCleaner = (cleaner) => {
    Alert.alert(
      "Remove Preferred Cleaner",
      `Are you sure you want to remove ${cleaner.cleanerName} from your preferred cleaners?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const result = await PreferredCleanerService.removePreferredCleaner(
              token,
              homeId,
              cleaner.cleanerId
            );
            if (result.success) {
              setPreferredCleaners((prev) =>
                prev.filter((c) => c.cleanerId !== cleaner.cleanerId)
              );
            } else {
              Alert.alert("Error", result.error || "Failed to remove cleaner");
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="star" size={18} color={colors.warning[500]} />
        <Text style={styles.title}>Preferred Cleaners</Text>
      </View>

      {/* Toggle Section */}
      <View style={styles.toggleCard}>
        <View style={styles.toggleContent}>
          <Text style={styles.toggleLabel}>Use Preferred Cleaners Only</Text>
          <Text style={styles.toggleDescription}>
            {usePreferredCleaners
              ? "Only your preferred cleaners can request jobs"
              : "All cleaners can request jobs for this home"}
          </Text>
        </View>
        <Switch
          value={usePreferredCleaners}
          onValueChange={handleToggle}
          disabled={updating}
          trackColor={{ false: colors.neutral[300], true: colors.success[400] }}
          thumbColor={usePreferredCleaners ? colors.success[600] : colors.neutral[100]}
        />
      </View>

      {/* Preferred Cleaners List */}
      {preferredCleaners.length > 0 ? (
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>
            Your Preferred Cleaners ({preferredCleaners.length})
          </Text>
          {preferredCleaners.map((cleaner) => (
            <View key={cleaner.id} style={styles.cleanerCard}>
              <View style={styles.cleanerInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {cleaner.cleanerName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cleanerDetails}>
                  <Text style={styles.cleanerName}>{cleaner.cleanerName}</Text>
                  <Text style={styles.cleanerMeta}>
                    Added via {cleaner.setBy} on {formatDate(cleaner.setAt)}
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.removeButton}
                onPress={() => handleRemoveCleaner(cleaner)}
              >
                <Icon name="times" size={16} color={colors.error[600]} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Icon name="user-plus" size={24} color={colors.neutral[400]} />
          <Text style={styles.emptyText}>
            No preferred cleaners yet. Leave a review and mark a cleaner as preferred!
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  loadingContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  toggleContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  toggleDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  listContainer: {
    marginTop: spacing.sm,
  },
  listTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  cleanerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  cleanerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  cleanerDetails: {
    flex: 1,
  },
  cleanerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  cleanerMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  removeButton: {
    padding: spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: "center",
  },
});

export default PreferredCleanersSection;
