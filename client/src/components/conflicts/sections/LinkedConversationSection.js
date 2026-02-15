import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { AuthContext } from "../../../services/AuthContext";
import ConflictService from "../../../services/fetchRequests/ConflictService";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../services/styles/theme";

const LinkedConversationSection = ({ ticketId, conversationId }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (ticketId && user?.token) {
      fetchConversation();
    }
  }, [ticketId, user?.token]);

  const fetchConversation = async () => {
    try {
      setLoading(true);
      const result = await ConflictService.getLinkedConversation(user.token, ticketId);
      if (result.success) {
        setMessages(result.messages || []);
      } else {
        setError(result.error || "Failed to load conversation");
      }
    } catch (err) {
      console.error("Error fetching linked conversation:", err);
      setError("Failed to load conversation");
    } finally {
      setLoading(false);
    }
  };

  const handleViewFullConversation = () => {
    if (conversationId) {
      navigate(`/messages/${conversationId}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading support conversation...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="exclamation-circle" size={48} color={colors.error[400]} />
        <Text style={styles.emptyTitle}>Unable to Load</Text>
        <Text style={styles.emptyText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchConversation}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="comments-o" size={48} color={colors.neutral[300]} />
        <Text style={styles.emptyTitle}>No Conversation</Text>
        <Text style={styles.emptyText}>
          No linked support conversation for this ticket.
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
      humanResources: colors.warning[500],
      owner: colors.error[500],
      system: colors.neutral[500],
    };
    return typeColors[type] || colors.neutral[500];
  };

  const getSenderIcon = (type) => {
    const typeIcons = {
      homeowner: "user",
      cleaner: "star",
      humanResources: "briefcase",
      owner: "building",
      system: "cog",
    };
    return typeIcons[type] || "user";
  };

  const getSenderLabel = (type) => {
    const labels = {
      homeowner: "Client",
      cleaner: "Cleaner",
      humanResources: "HR",
      owner: "Owner",
      system: "System",
    };
    return labels[type] || type || "User";
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <Icon name="life-ring" size={18} color={colors.secondary[600]} />
        <Text style={styles.headerTitle}>Support Conversation</Text>
        <View style={styles.messageCount}>
          <Text style={styles.messageCountText}>{messages.length} messages</Text>
        </View>
      </View>

      <View style={styles.threadContainer}>
        {messages.map((message, index) => {
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
                  <View style={[styles.senderTypeContainer, { backgroundColor: getSenderColor(senderType) + "15" }]}>
                    <Text style={[styles.senderType, { color: getSenderColor(senderType) }]}>
                      {getSenderLabel(senderType)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.messageContent}>{message.content}</Text>

                <Text style={styles.messageTime}>{formatDate(message.createdAt)}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {conversationId && (
        <Pressable style={styles.viewFullButton} onPress={handleViewFullConversation}>
          <Icon name="external-link" size={14} color={colors.primary[600]} />
          <Text style={styles.viewFullButtonText}>View Full Conversation</Text>
        </Pressable>
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
  retryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  retryButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
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
    backgroundColor: colors.secondary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  messageCountText: {
    fontSize: typography.fontSize.xs,
    color: colors.secondary[700],
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
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
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
  messageTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
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
  viewFullButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  viewFullButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
});

export default LinkedConversationSection;
