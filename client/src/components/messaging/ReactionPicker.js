import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View, Modal } from "react-native";
import Icon from "react-native-vector-icons/Feather";
import {
  colors,
  spacing,
  radius,
  shadows,
  typography,
} from "../../services/styles/theme";

const REACTIONS = [
  { emoji: "\u{1F44D}", label: "thumbs up" },    // 👍
  { emoji: "\u{2764}\u{FE0F}", label: "heart" }, // ❤️
  { emoji: "\u{1F602}", label: "laugh" },        // 😂
  { emoji: "\u{1F62E}", label: "wow" },          // 😮
  { emoji: "\u{1F622}", label: "sad" },          // 😢
  { emoji: "\u{1F44E}", label: "thumbs down" },  // 👎
];

const ReactionPicker = ({
  onSelect,
  onClose,
  currentReactions = [],
  userId,
  isOwn = false,
  onDelete,
  visible = true,
}) => {
  // Check if user has already reacted with each emoji
  const hasReacted = (emoji) => {
    return currentReactions.some((r) => r.emoji === emoji && r.userId === userId);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.pickerContainer}>
          <View style={styles.picker}>
            {/* Emoji reactions */}
            {REACTIONS.map((reaction) => {
              const isActive = hasReacted(reaction.emoji);
              return (
                <Pressable
                  key={reaction.emoji}
                  style={({ pressed }) => [
                    styles.reactionButton,
                    isActive && styles.reactionButtonActive,
                    pressed && styles.reactionButtonPressed,
                  ]}
                  onPress={() => onSelect(reaction.emoji)}
                  accessibilityLabel={isActive ? `Remove ${reaction.label}` : `React with ${reaction.label}`}
                >
                  <Text style={styles.emoji}>{reaction.emoji}</Text>
                </Pressable>
              );
            })}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Delete button (only for own messages) */}
            {isOwn && onDelete && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && styles.actionButtonPressed,
                ]}
                onPress={onDelete}
                accessibilityLabel="Delete message"
              >
                <Icon name="trash-2" size={18} color={colors.error[500]} />
              </Pressable>
            )}

            {/* Cancel button */}
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={onClose}
              accessibilityLabel="Cancel"
            >
              <Icon name="x" size={18} color={colors.text.tertiary} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

// Modal to show who reacted with a specific emoji
const ReactorListModal = ({ visible, reaction, currentUserId, onClose }) => {
  if (!reaction) return null;

  const formatNames = (users) => {
    if (!users || users.length === 0) return "";

    const names = users.map((user) => {
      if (!user) return "Unknown";
      if (user.id === currentUserId) return "You";
      if (user.firstName) return user.firstName;
      return user.username || "Unknown";
    });

    return names.join(", ");
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.reactorModalOverlay} onPress={onClose}>
        <View style={styles.reactorModalContent}>
          <Text style={styles.reactorModalEmoji}>{reaction.emoji}</Text>
          <Text style={styles.reactorModalNames}>{formatNames(reaction.users)}</Text>
        </View>
      </Pressable>
    </Modal>
  );
};

// Component to display reactions under a message
export const ReactionDisplay = ({ reactions = [], onReactionPress, currentUserId }) => {
  const [selectedReaction, setSelectedReaction] = useState(null);

  if (!reactions || reactions.length === 0) return null;

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    const emoji = reaction.emoji;
    if (!acc[emoji]) {
      acc[emoji] = { emoji, count: 0, users: [], hasCurrentUser: false };
    }
    acc[emoji].count++;
    acc[emoji].users.push(reaction.user);
    if (reaction.userId === currentUserId) {
      acc[emoji].hasCurrentUser = true;
    }
    return acc;
  }, {});

  const reactionList = Object.values(groupedReactions);

  const handleReactionPress = (reaction) => {
    setSelectedReaction(reaction);
  };

  const handleLongPress = (emoji) => {
    // Long press toggles the reaction (add/remove)
    if (onReactionPress) {
      onReactionPress(emoji);
    }
  };

  return (
    <View style={styles.displayContainer}>
      {reactionList.map((reaction) => (
        <Pressable
          key={reaction.emoji}
          style={[
            styles.displayBadge,
            reaction.hasCurrentUser && styles.displayBadgeActive,
          ]}
          onPress={() => handleReactionPress(reaction)}
          onLongPress={() => handleLongPress(reaction.emoji)}
          delayLongPress={300}
        >
          <Text style={styles.displayEmoji}>{reaction.emoji}</Text>
          <Text style={[
            styles.displayCount,
            reaction.hasCurrentUser && styles.displayCountActive,
          ]}>
            {reaction.count}
          </Text>
        </Pressable>
      ))}

      {/* Modal to show who reacted */}
      <ReactorListModal
        visible={!!selectedReaction}
        reaction={selectedReaction}
        currentUserId={currentUserId}
        onClose={() => setSelectedReaction(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerContainer: {
    alignItems: "center",
  },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius["2xl"],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...shadows.lg,
  },
  reactionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
  },
  reactionButtonActive: {
    backgroundColor: colors.primary[100],
  },
  reactionButtonPressed: {
    backgroundColor: colors.neutral[100],
    transform: [{ scale: 1.1 }],
  },
  emoji: {
    fontSize: 28,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing.xs,
  },
  actionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonPressed: {
    backgroundColor: colors.neutral[100],
  },
  // Reaction Display Styles
  displayContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  displayBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  displayBadgeActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  displayEmoji: {
    fontSize: 14,
  },
  displayCount: {
    fontSize: 12,
    color: colors.text.secondary,
    marginLeft: 2,
    fontWeight: "600",
  },
  displayCountActive: {
    color: colors.primary[600],
  },
  // Reactor List Modal Styles
  reactorModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  reactorModalContent: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    minWidth: 150,
    ...shadows.lg,
  },
  reactorModalEmoji: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  reactorModalNames: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    textAlign: "center",
    fontWeight: typography.fontWeight.medium,
  },
});

export default ReactionPicker;
