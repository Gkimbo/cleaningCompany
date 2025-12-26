import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import messagingStyles from "../../services/styles/MessagingStyles";
import MessageService from "../../services/fetchRequests/MessageClass";
import { useSocket } from "../../services/SocketContext";

const ConversationList = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { onBroadcast, onUnreadUpdate } = useSocket();

  const fetchConversations = useCallback(async () => {
    if (!state.currentUser?.token) return;

    try {
      const response = await MessageService.getConversations(state.currentUser.token);
      if (response.conversations) {
        dispatch({ type: "SET_CONVERSATIONS", payload: response.conversations });

        // Calculate total unread
        const totalUnread = response.conversations.reduce(
          (sum, conv) => sum + (conv.unreadCount || 0),
          0
        );
        dispatch({ type: "SET_UNREAD_COUNT", payload: totalUnread });
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.currentUser?.token, dispatch]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Listen for broadcasts
  useEffect(() => {
    const unsubscribe = onBroadcast((data) => {
      dispatch({ type: "ADD_CONVERSATION", payload: data.conversation });
      dispatch({ type: "INCREMENT_UNREAD" });
    });
    return unsubscribe;
  }, [onBroadcast, dispatch]);

  // Listen for unread updates
  useEffect(() => {
    const unsubscribe = onUnreadUpdate(() => {
      fetchConversations();
    });
    return unsubscribe;
  }, [onUnreadUpdate, fetchConversations]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const getConversationTitle = (conv) => {
    if (conv.conversation?.conversationType === "broadcast") {
      return conv.conversation?.title || "Announcement";
    }
    if (conv.conversation?.conversationType === "support") {
      // For owners, show the user's name; for users, show "Support"
      if (state.account === "owner") {
        return conv.conversation?.title || "Support Request";
      }
      return "Support - Owner";
    }
    if (conv.conversation?.appointment) {
      const date = new Date(conv.conversation.appointment.date);
      return `Appointment - ${date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      })}`;
    }
    // Get other participant names
    const otherParticipants = conv.conversation?.participants?.filter(
      (p) => p.userId !== state.currentUser?.id
    );
    if (otherParticipants?.length > 0) {
      return otherParticipants.map((p) => p.user?.username).join(", ");
    }
    return "Conversation";
  };

  const getPreviewText = (conv) => {
    const lastMessage = conv.conversation?.messages?.[0];
    if (lastMessage) {
      const senderName =
        lastMessage.senderId === state.currentUser?.id
          ? "You"
          : lastMessage.sender?.username || "Someone";
      return `${senderName}: ${lastMessage.content}`;
    }
    return "No messages yet";
  };

  const getInitials = (title) => {
    return title
      .split(" ")
      .map((word) => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const handleConversationPress = (conv) => {
    navigate(`/messages/${conv.conversationId}`);
  };

  if (loading) {
    return (
      <View style={messagingStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#3a8dff" />
      </View>
    );
  }

  const conversations = state.conversations || [];

  return (
    <View style={messagingStyles.container}>
      <View style={messagingStyles.header}>
        <Pressable onPress={() => navigate(-1)} style={{ padding: 8 }}>
          <Icon name="arrow-left" size={20} color="#1e3a8a" />
        </Pressable>
        <Text style={messagingStyles.headerTitle}>Messages</Text>
        {state.account === "owner" && (
          <Pressable
            onPress={() => navigate("/messages/broadcast")}
            style={{ padding: 8 }}
          >
            <Icon name="bullhorn" size={20} color="#f59e0b" />
          </Pressable>
        )}
      </View>

      <ScrollView
        style={messagingStyles.conversationList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {conversations.length === 0 ? (
          <View style={messagingStyles.emptyContainer}>
            <Icon name="comments-o" size={48} color="#94a3b8" />
            <Text style={messagingStyles.emptyText}>
              No conversations yet. Start a conversation from an appointment.
            </Text>
          </View>
        ) : (
          conversations.map((conv) => {
            const title = getConversationTitle(conv);
            const isBroadcast =
              conv.conversation?.conversationType === "broadcast";
            const isSupport =
              conv.conversation?.conversationType === "support";
            const hasUnread = conv.unreadCount > 0;

            return (
              <Pressable
                key={conv.id}
                onPress={() => handleConversationPress(conv)}
                style={({ pressed }) => [
                  messagingStyles.conversationItem,
                  hasUnread && messagingStyles.conversationItemUnread,
                  isBroadcast && messagingStyles.conversationItemBroadcast,
                  isSupport && { borderLeftColor: "#1e3a8a", borderLeftWidth: 3 },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View style={messagingStyles.avatarContainer}>
                  {isBroadcast ? (
                    <Icon name="bullhorn" size={20} color="#f59e0b" />
                  ) : isSupport ? (
                    <Icon name="life-ring" size={20} color="#1e3a8a" />
                  ) : (
                    <Text style={messagingStyles.avatarText}>
                      {getInitials(title)}
                    </Text>
                  )}
                </View>

                <View style={messagingStyles.conversationContent}>
                  <Text
                    style={[
                      messagingStyles.conversationTitle,
                      hasUnread && { fontWeight: "bold" },
                    ]}
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                  <Text
                    style={[
                      messagingStyles.conversationPreview,
                      hasUnread && { color: "#334155" },
                    ]}
                    numberOfLines={2}
                  >
                    {getPreviewText(conv)}
                  </Text>
                  <Text style={messagingStyles.conversationTime}>
                    {formatTime(
                      conv.conversation?.messages?.[0]?.createdAt ||
                        conv.conversation?.updatedAt
                    )}
                  </Text>
                </View>

                {hasUnread && (
                  <View style={messagingStyles.unreadBadge}>
                    <Text style={messagingStyles.unreadBadgeText}>
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

export default ConversationList;
