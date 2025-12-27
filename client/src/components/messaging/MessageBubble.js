import React, { useState, useContext } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import { UserContext } from "../../context/UserContext";
import MessageService from "../../services/fetchRequests/MessageClass";
import ReactionPicker, { ReactionDisplay } from "./ReactionPicker";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const MessageBubble = ({
  message,
  isOwn,
  isBroadcast,
  isGroupChat = false,
  showSender = true,
  isFirstInGroup = true,
  isLastInGroup = true,
  onReactionUpdate,
  onMessageDeleted,
}) => {
  const { state } = useContext(UserContext);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getDisplayName = (sender) => {
    if (!sender) return "Unknown";
    if (sender.firstName || sender.lastName) {
      return `${sender.firstName || ""} ${sender.lastName || ""}`.trim();
    }
    return sender.username;
  };

  const getInitials = (sender) => {
    const name = getDisplayName(sender);
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = isOwn ? "You" : getDisplayName(message.sender);

  const handleLongPress = () => {
    setShowReactionPicker(true);
  };

  const handleReaction = async (emoji) => {
    setShowReactionPicker(false);
    try {
      const result = await MessageService.addReaction(
        message.id,
        emoji,
        state.currentUser.token
      );
      if (onReactionUpdate) {
        onReactionUpdate(message.id, result);
      }
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  };

  const handleDelete = () => {
    setShowReactionPicker(false);
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await MessageService.deleteMessage(
                message.id,
                state.currentUser.token
              );
              if (result.success && onMessageDeleted) {
                onMessageDeleted(message.id);
              }
            } catch (error) {
              console.error("Error deleting message:", error);
            }
          },
        },
      ]
    );
  };

  const closeReactionPicker = () => {
    setShowReactionPicker(false);
  };

  // Check if message is deleted
  if (message.deletedAt) {
    return (
      <View style={styles.messageCard}>
        {/* Header row: Avatar + Name + Timestamp */}
        <View style={[styles.header, isOwn && styles.headerOwn]}>
          {!isOwn && (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(message.sender)}</Text>
            </View>
          )}
          <Text style={[styles.senderName, isOwn && styles.senderNameOwn]}>
            {displayName}
          </Text>
          <Text style={styles.timestamp}>{formatTime(message.createdAt)}</Text>
        </View>

        {/* Deleted message indicator */}
        <View style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn]}>
          {!isOwn && <View style={styles.avatarSpacer} />}
          <View style={styles.deletedBubble}>
            <Icon name="trash-2" size={14} color={colors.text.tertiary} />
            <Text style={styles.deletedText}>This message was deleted</Text>
          </View>
        </View>
      </View>
    );
  }

  // Get read receipt info
  const readReceipts = message.readReceipts || [];
  const hasBeenRead = readReceipts.length > 0;

  // Broadcast message
  if (isBroadcast) {
    return (
      <View style={styles.broadcastContainer}>
        <View style={styles.broadcastBubble}>
          <View style={styles.broadcastHeader}>
            <Icon name="radio" size={14} color={colors.warning[600]} />
            <Text style={styles.broadcastSender}>
              {getDisplayName(message.sender)}
            </Text>
          </View>
          <Text style={styles.broadcastText}>{message.content}</Text>
          <Text style={styles.broadcastTime}>{formatTime(message.createdAt)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.messageCard}>
      {/* Header row: Avatar + Name + Timestamp */}
      <View style={[styles.header, isOwn && styles.headerOwn]}>
        {!isOwn && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(message.sender)}</Text>
          </View>
        )}
        <Text style={[styles.senderName, isOwn && styles.senderNameOwn]}>
          {displayName}
        </Text>
        <Text style={styles.timestamp}>{formatTime(message.createdAt)}</Text>
        {isOwn && (
          <View style={styles.readReceipt}>
            {hasBeenRead ? (
              <Icon name="check-circle" size={14} color={colors.primary[500]} />
            ) : (
              <Icon name="check" size={14} color={colors.text.tertiary} />
            )}
          </View>
        )}
      </View>

      {/* Message bubble */}
      <View style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn]}>
        {!isOwn && <View style={styles.avatarSpacer} />}
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={300}
          style={({ pressed }) => [
            styles.bubble,
            isOwn ? styles.bubbleOwn : styles.bubbleOther,
            pressed && styles.bubblePressed,
          ]}
        >
          <Text style={[styles.messageText, isOwn ? styles.messageTextOwn : styles.messageTextOther]}>
            {message.content}
          </Text>
        </Pressable>
      </View>

      {/* Reactions display */}
      {message.reactions && message.reactions.length > 0 && (
        <View style={[styles.reactionsRow, isOwn && styles.reactionsRowOwn]}>
          {!isOwn && <View style={styles.avatarSpacer} />}
          <ReactionDisplay
            reactions={message.reactions}
            currentUserId={parseInt(state.currentUser.userId)}
            onReactionPress={handleReaction}
          />
        </View>
      )}

      {/* Reaction picker - shows as modal on long press */}
      <ReactionPicker
        visible={showReactionPicker}
        onSelect={handleReaction}
        onClose={closeReactionPicker}
        currentReactions={message.reactions || []}
        userId={parseInt(state.currentUser.userId)}
        isOwn={isOwn}
        onDelete={isOwn ? handleDelete : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // Teams-style message card
  messageCard: {
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  // Header row with avatar, name, and time
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  headerOwn: {
    justifyContent: "flex-end",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  avatarSpacer: {
    width: 28,
    marginRight: spacing.sm,
  },
  senderName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  senderNameOwn: {
    color: colors.primary[600],
  },
  timestamp: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  readReceipt: {
    marginLeft: spacing.xs,
  },
  // Bubble row
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bubbleRowOwn: {
    justifyContent: "flex-end",
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    maxWidth: "80%",
  },
  bubbleOwn: {
    backgroundColor: colors.primary[500],
    borderTopRightRadius: radius.xs,
  },
  bubbleOther: {
    backgroundColor: colors.neutral[200],
    borderTopLeftRadius: radius.xs,
  },
  bubblePressed: {
    opacity: 0.9,
  },
  messageText: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
  },
  messageTextOwn: {
    color: colors.white,
  },
  messageTextOther: {
    color: colors.text.primary,
  },
  // Reactions row
  reactionsRow: {
    flexDirection: "row",
    marginTop: spacing.xs,
  },
  reactionsRowOwn: {
    justifyContent: "flex-end",
  },
  // Deleted message
  deletedBubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    gap: spacing.sm,
  },
  deletedText: {
    fontSize: typography.fontSize.sm,
    fontStyle: "italic",
    color: colors.text.tertiary,
  },
  // Broadcast
  broadcastContainer: {
    alignItems: "center",
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  broadcastBubble: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxWidth: "90%",
  },
  broadcastHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  broadcastSender: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  broadcastText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
  broadcastTime: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    textAlign: "right",
  },
});

export default MessageBubble;
