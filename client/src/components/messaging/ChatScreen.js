import React, { useState, useEffect, useRef, useCallback, useContext } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import Icon from "react-native-vector-icons/Feather";
import { UserContext } from "../../context/UserContext";
import MessageService from "../../services/fetchRequests/MessageClass";
import { useSocket } from "../../services/SocketContext";
import MessageBubble from "./MessageBubble";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const ChatScreen = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { state, dispatch } = useContext(UserContext);
  const scrollViewRef = useRef(null);
  const {
    joinConversation,
    leaveConversation,
    onNewMessage,
    onMessageReaction,
    onMessageDeleted,
    onMessageRead,
  } = useSocket();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);

  const fetchMessages = useCallback(async () => {
    if (!state.currentUser?.token || !conversationId) return;

    try {
      const response = await MessageService.getMessages(
        conversationId,
        state.currentUser.token
      );
      if (response.messages) {
        setMessages(response.messages);
      }
      if (response.conversation) {
        setConversation(response.conversation);
      }

      // Mark as read and update unread count
      await MessageService.markAsRead(conversationId, state.currentUser.token);

      // Update the conversation's unread count in state
      dispatch({
        type: "UPDATE_CONVERSATION_UNREAD",
        payload: { conversationId: parseInt(conversationId), unreadCount: 0 },
      });

      // Recalculate total unread
      const unreadResponse = await MessageService.getUnreadCount(
        state.currentUser.token
      );
      if (unreadResponse.unreadCount !== undefined) {
        dispatch({ type: "SET_UNREAD_COUNT", payload: unreadResponse.unreadCount });
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }, [state.currentUser?.token, conversationId, dispatch]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Join conversation room on mount
  useEffect(() => {
    if (conversationId) {
      joinConversation(conversationId);
    }
    return () => {
      if (conversationId) {
        leaveConversation(conversationId);
      }
    };
  }, [conversationId, joinConversation, leaveConversation]);

  // Listen for new messages
  useEffect(() => {
    const unsubscribe = onNewMessage((newMessage) => {
      if (newMessage.conversationId === parseInt(conversationId)) {
        setMessages((prev) => [...prev, newMessage]);

        // Mark as read since we're viewing
        MessageService.markAsRead(conversationId, state.currentUser.token);

        // Scroll to bottom
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });
    return unsubscribe;
  }, [onNewMessage, conversationId, state.currentUser?.token]);

  // Listen for message reactions
  useEffect(() => {
    const unsubscribe = onMessageReaction((data) => {
      const { messageId, reaction, action, emoji, userId } = data;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            let newReactions = [...(msg.reactions || [])];
            if (action === "added" && reaction) {
              newReactions.push(reaction);
            } else if (action === "removed") {
              newReactions = newReactions.filter(
                (r) => !(r.emoji === emoji && r.userId === userId)
              );
            }
            return { ...msg, reactions: newReactions };
          }
          return msg;
        })
      );
    });
    return unsubscribe;
  }, [onMessageReaction]);

  // Listen for message deletions
  useEffect(() => {
    const unsubscribe = onMessageDeleted((data) => {
      const { messageId } = data;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            return { ...msg, deletedAt: new Date().toISOString() };
          }
          return msg;
        })
      );
    });
    return unsubscribe;
  }, [onMessageDeleted]);

  // Listen for read receipts
  useEffect(() => {
    const unsubscribe = onMessageRead((data) => {
      const { messageId, readBy, readAt } = data;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            const newReceipts = [...(msg.readReceipts || [])];
            if (!newReceipts.some((r) => r.userId === readBy)) {
              newReceipts.push({ userId: readBy, readAt });
            }
            return { ...msg, readReceipts: newReceipts };
          }
          return msg;
        })
      );
    });
    return unsubscribe;
  }, [onMessageRead]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [loading, messages.length]);

  const handleSend = async () => {
    if (!messageText.trim() || sending) return;

    setSending(true);
    const content = messageText.trim();
    setMessageText("");

    try {
      const response = await MessageService.sendMessage(
        conversationId,
        content,
        state.currentUser.token
      );

      if (response.error) {
        console.error("Failed to send message:", response.error);
        setMessageText(content);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageText(content);
    } finally {
      setSending(false);
    }
  };

  const handleReactionUpdate = (messageId, result) => {
    // Local update handled by socket listener
  };

  const handleMessageDeleted = (messageId) => {
    // Local update handled by socket listener
  };

  const getDisplayName = (user) => {
    if (!user) return "Unknown";
    if (user.firstName || user.lastName) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim();
    }
    return user.username;
  };

  const getConversationTitle = () => {
    if (!conversation) return "Loading...";

    if (conversation.conversationType === "broadcast") {
      return conversation.title || "Announcement";
    }

    if (conversation.conversationType === "support") {
      if (state.account === "owner" || state.account === "humanResources") {
        return conversation.title || "Support Request";
      }
      return "Support";
    }

    if (conversation.conversationType === "internal") {
      // For internal conversations, show the other participants
      const otherParticipants = conversation.participants?.filter(
        (p) => p.userId !== parseInt(state.currentUser?.userId)
      );
      if (otherParticipants?.length === 1) {
        return getDisplayName(otherParticipants[0].user);
      }
      if (otherParticipants?.length > 1) {
        return conversation.title || `Group (${otherParticipants.length + 1})`;
      }
    }

    if (conversation.appointment) {
      const date = new Date(conversation.appointment.date);
      return `Appointment - ${date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      })}`;
    }

    const otherParticipants = conversation.participants?.filter(
      (p) => p.userId !== parseInt(state.currentUser?.userId)
    );
    if (otherParticipants?.length > 0) {
      return otherParticipants.map((p) => getDisplayName(p.user)).join(", ");
    }

    return "Conversation";
  };

  const getConversationSubtitle = () => {
    if (!conversation?.participants) return "";

    const participantCount = conversation.participants.length;
    if (participantCount <= 2) return "";

    return `${participantCount} participants`;
  };

  const getConversationIcon = () => {
    if (!conversation) return null;

    if (conversation.conversationType === "broadcast") {
      return { name: "radio", color: colors.warning[500] };
    }
    if (conversation.conversationType === "support") {
      return { name: "help-circle", color: colors.primary[500] };
    }
    if (conversation.conversationType === "internal") {
      if (conversation.participants?.length > 2) {
        return { name: "users", color: colors.secondary[500] };
      }
      return { name: "message-circle", color: colors.secondary[500] };
    }
    return null;
  };

  const formatDateSeparator = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }
  };

  const shouldShowDateSeparator = (currentMsg, prevMsg) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.createdAt).toDateString();
    const prevDate = new Date(prevMsg.createdAt).toDateString();
    return currentDate !== prevDate;
  };

  // Determine message grouping (same sender, within 2 minutes)
  const isConsecutiveMessage = (currentMsg, prevMsg) => {
    if (!prevMsg) return false;
    if (currentMsg.senderId !== prevMsg.senderId) return false;
    const timeDiff = new Date(currentMsg.createdAt) - new Date(prevMsg.createdAt);
    return timeDiff < 2 * 60 * 1000; // 2 minutes
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  const isBroadcast = conversation?.conversationType === "broadcast";
  const isGroupChat = conversation?.participants?.length > 2;
  const conversationIcon = getConversationIcon();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigate("/messages")}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={22} color={colors.text.primary} />
        </Pressable>

        <View style={styles.headerInfo}>
          <View style={styles.headerTitleRow}>
            {conversationIcon && (
              <Icon
                name={conversationIcon.name}
                size={18}
                color={conversationIcon.color}
                style={styles.headerIcon}
              />
            )}
            <Text style={styles.headerTitle} numberOfLines={1}>
              {getConversationTitle()}
            </Text>
          </View>
          {getConversationSubtitle() && (
            <Text style={styles.headerSubtitle}>{getConversationSubtitle()}</Text>
          )}
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: false })
        }
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Icon name="message-circle" size={32} color={colors.text.tertiary} />
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>Start the conversation!</Text>
          </View>
        ) : (
          messages.map((message, index) => {
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
            const showDateSeparator = shouldShowDateSeparator(message, prevMessage);
            const isFirstInGroup = !isConsecutiveMessage(message, prevMessage) || showDateSeparator;
            const isLastInGroup = !nextMessage || !isConsecutiveMessage(nextMessage, message);

            return (
              <React.Fragment key={message.id}>
                {showDateSeparator && (
                  <View style={styles.dateSeparator}>
                    <View style={styles.dateSeparatorLine} />
                    <Text style={styles.dateSeparatorText}>
                      {formatDateSeparator(message.createdAt)}
                    </Text>
                    <View style={styles.dateSeparatorLine} />
                  </View>
                )}
                <MessageBubble
                  message={message}
                  isOwn={message.senderId === parseInt(state.currentUser?.userId)}
                  isBroadcast={message.messageType === "broadcast"}
                  isGroupChat={isGroupChat}
                  showSender={isGroupChat || conversation?.conversationType === "support"}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  onReactionUpdate={handleReactionUpdate}
                  onMessageDeleted={handleMessageDeleted}
                />
              </React.Fragment>
            );
          })
        )}
      </ScrollView>

      {/* Input - hide for broadcast conversations if not owner */}
      {(!isBroadcast || state.account === "owner") && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.inputField}
            placeholder="Type a message..."
            placeholderTextColor={colors.text.tertiary}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={2000}
            editable={!sending}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              (!messageText.trim() || sending) && styles.sendButtonDisabled,
              pressed && styles.sendButtonPressed,
            ]}
            onPress={handleSend}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Icon name="send" size={18} color={colors.white} />
            )}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    ...shadows.sm,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  // Messages List
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: spacing.md,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing["3xl"],
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  // Date separator
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.neutral[200],
  },
  dateSeparatorText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    paddingHorizontal: spacing.md,
    fontWeight: typography.fontWeight.medium,
  },
  // Input
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    gap: spacing.sm,
  },
  inputField: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    maxHeight: 120,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[500],
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  sendButtonPressed: {
    backgroundColor: colors.primary[600],
  },
});

export default ChatScreen;
