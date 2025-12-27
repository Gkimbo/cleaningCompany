import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import messagingStyles from "../../services/styles/MessagingStyles";
import MessageService from "../../services/fetchRequests/MessageClass";
import { useSocket } from "../../services/SocketContext";
import MessageBubble from "./MessageBubble";

const ChatScreen = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const scrollViewRef = useRef(null);
  const { joinConversation, leaveConversation, onNewMessage } = useSocket();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [conversation, setConversation] = useState(null);

  const fetchMessages = useCallback(async () => {
    if (!state.currentUser?.token || !conversationId) return;

    try {
      const response = await MessageService.getMessages(
        conversationId,
        state.currentUser.token
      );
      if (response.messages) {
        dispatch({ type: "SET_CURRENT_MESSAGES", payload: response.messages });
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
        dispatch({ type: "ADD_MESSAGE", payload: newMessage });

        // Mark as read since we're viewing
        MessageService.markAsRead(conversationId, state.currentUser.token);

        // Scroll to bottom
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });
    return unsubscribe;
  }, [onNewMessage, conversationId, dispatch, state.currentUser?.token]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (!loading && state.currentMessages?.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [loading, state.currentMessages?.length]);

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
        setMessageText(content); // Restore message on error
      }
      // Message will be added via socket event
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageText(content);
    } finally {
      setSending(false);
    }
  };

  const getConversationTitle = () => {
    if (!conversation) return "Loading...";

    if (conversation.conversationType === "broadcast") {
      return conversation.title || "Announcement";
    }

    if (conversation.conversationType === "support") {
      // For owners, show the user's name from the title
      if (state.account === "owner") {
        return conversation.title || "Support Request";
      }
      return "Support - Owner";
    }

    if (conversation.appointment) {
      const date = new Date(conversation.appointment.date);
      return `Appointment - ${date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    }

    const otherParticipants = conversation.participants?.filter(
      (p) => p.userId !== state.currentUser?.id
    );
    if (otherParticipants?.length > 0) {
      return otherParticipants.map((p) => p.user?.username).join(", ");
    }

    return "Conversation";
  };

  const getParticipantsText = () => {
    if (!conversation?.participants) return "";

    const names = conversation.participants
      .map((p) => {
        if (p.userId === state.currentUser?.id) return "You";
        return p.user?.username || "Unknown";
      })
      .join(", ");

    return `Participants: ${names}`;
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

  if (loading) {
    return (
      <View style={messagingStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#3a8dff" />
      </View>
    );
  }

  const messages = state.currentMessages || [];
  const isBroadcast = conversation?.conversationType === "broadcast";
  const isSupport = conversation?.conversationType === "support";

  return (
    <KeyboardAvoidingView
      style={messagingStyles.chatContainer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {/* Header */}
      <View style={messagingStyles.chatHeader}>
        <Pressable onPress={() => navigate("/messages")} style={messagingStyles.backButton}>
          <Icon name="arrow-left" size={20} color="#1e3a8a" />
        </Pressable>
        <Text style={messagingStyles.chatHeaderTitle} numberOfLines={1}>
          {getConversationTitle()}
        </Text>
        {isBroadcast && <Icon name="bullhorn" size={18} color="#f59e0b" />}
        {isSupport && <Icon name="life-ring" size={18} color="#1e3a8a" />}
      </View>

      {/* Participants */}
      {!isBroadcast && conversation?.participants?.length > 0 && (
        <View style={messagingStyles.participantsContainer}>
          <Text style={messagingStyles.participantsText} numberOfLines={1}>
            {getParticipantsText()}
          </Text>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={messagingStyles.messagesList}
        contentContainerStyle={{ paddingBottom: 16 }}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: false })
        }
      >
        {messages.length === 0 ? (
          <View style={messagingStyles.emptyContainer}>
            <Icon name="comment-o" size={40} color="#94a3b8" />
            <Text style={messagingStyles.emptyText}>
              No messages yet. Start the conversation!
            </Text>
          </View>
        ) : (
          messages.map((message, index) => {
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const showDateSeparator = shouldShowDateSeparator(message, prevMessage);

            return (
              <React.Fragment key={message.id}>
                {showDateSeparator && (
                  <View style={messagingStyles.dateSeparator}>
                    <Text style={messagingStyles.dateSeparatorText}>
                      {formatDateSeparator(message.createdAt)}
                    </Text>
                  </View>
                )}
                <MessageBubble
                  message={message}
                  isOwn={message.senderId === state.currentUser?.id}
                  isBroadcast={message.messageType === "broadcast"}
                />
              </React.Fragment>
            );
          })
        )}
      </ScrollView>

      {/* Input - hide for broadcast conversations if not owner */}
      {(!isBroadcast || state.account === "owner") && (
        <View style={messagingStyles.inputContainer}>
          <TextInput
            style={messagingStyles.inputField}
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <Pressable
            style={[
              messagingStyles.sendButton,
              (!messageText.trim() || sending) && messagingStyles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Icon name="send" size={16} color="#ffffff" />
            )}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

export default ChatScreen;
