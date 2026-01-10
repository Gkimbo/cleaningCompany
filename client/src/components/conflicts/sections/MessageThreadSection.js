import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../services/styles/theme";

const MessageThreadSection = ({ messages, loading }) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  const messageList = messages?.messages || [];

  if (messageList.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="comments" size={48} color={colors.neutral[300]} />
        <Text style={styles.emptyTitle}>No Messages</Text>
        <Text style={styles.emptyText}>
          No conversation history for this appointment.
        </Text>
      </View>
    );
  }

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getSenderColor = (type) => {
    const typeColors = {
      homeowner: colors.primary[500],
      cleaner: colors.success[500],
      hr: colors.warning[500],
      owner: colors.error[500],
      system: colors.neutral[500],
    };
    return typeColors[type] || colors.neutral[500];
  };

  const getSenderIcon = (type) => {
    const typeIcons = {
      homeowner: "user",
      cleaner: "star",
      hr: "briefcase",
      owner: "building",
      system: "cog",
    };
    return typeIcons[type] || "user";
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <Icon name="comments" size={18} color={colors.primary[600]} />
        <Text style={styles.headerTitle}>Conversation History</Text>
        <View style={styles.messageCount}>
          <Text style={styles.messageCountText}>{messageList.length} messages</Text>
        </View>
      </View>

      <View style={styles.threadContainer}>
        {messageList.map((message, index) => {
          const isSystem = message.messageType === "system" || !message.sender;
          const senderType = message.sender?.type || "system";

          if (isSystem) {
            return (
              <View key={message.id || index} style={styles.systemMessage}>
                <View style={styles.systemLine} />
                <Text style={styles.systemText}>{message.content}</Text>
                <View style={styles.systemLine} />
              </View>
            );
          }

          return (
            <View key={message.id || index} style={styles.messageContainer}>
              <View style={styles.avatarContainer}>
                {message.sender?.profileImage ? (
                  <Image
                    source={{ uri: message.sender.profileImage }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: getSenderColor(senderType) + "20" }]}>
                    <Icon
                      name={getSenderIcon(senderType)}
                      size={14}
                      color={getSenderColor(senderType)}
                    />
                  </View>
                )}
              </View>

              <View style={styles.messageBubble}>
                <View style={styles.messageHeader}>
                  <Text style={[styles.senderName, { color: getSenderColor(senderType) }]}>
                    {message.sender?.name || "Unknown"}
                  </Text>
                  <View style={styles.senderTypeContainer}>
                    <Text style={[styles.senderType, { color: getSenderColor(senderType) }]}>
                      {senderType}
                    </Text>
                  </View>
                </View>

                <Text style={styles.messageContent}>{message.content}</Text>

                <View style={styles.messageFooter}>
                  <Text style={styles.messageTime}>{formatDate(message.createdAt)}</Text>
                  {message.hasSuspiciousContent && (
                    <View style={styles.warningBadge}>
                      <Icon name="exclamation-triangle" size={10} color={colors.warning[600]} />
                      <Text style={styles.warningText}>Flagged</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>
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
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  messageCount: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  messageCountText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },
  threadContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  messageContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  avatarContainer: {
    width: 36,
    alignItems: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  messageBubble: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderTopLeftRadius: radius.sm,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  senderName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  senderTypeContainer: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  senderType: {
    fontSize: 9,
    fontWeight: typography.fontWeight.medium,
    textTransform: "uppercase",
  },
  messageContent: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  messageTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  warningText: {
    fontSize: 9,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
  },
  systemMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  systemLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },
  systemText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
});

export default MessageThreadSection;
