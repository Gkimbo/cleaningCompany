import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import messagingStyles from "../../services/styles/MessagingStyles";
import MessageService from "../../services/fetchRequests/MessageClass";
import { useSocket } from "../../services/SocketContext";

const MessagesButton = ({ state, dispatch, style }) => {
  const navigate = useNavigate();
  const { onBroadcast, onUnreadUpdate } = useSocket();

  // Fetch unread count on mount and periodically
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!state.currentUser?.token) return;

      try {
        const response = await MessageService.getUnreadCount(state.currentUser.token);
        if (response.unreadCount !== undefined) {
          dispatch({ type: "SET_UNREAD_COUNT", payload: response.unreadCount });
        }
      } catch (error) {
        console.error("Error fetching unread count:", error);
      }
    };

    fetchUnreadCount();

    // Refresh every 30 seconds as a fallback
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [state.currentUser?.token, dispatch]);

  // Listen for broadcasts to update count
  useEffect(() => {
    const unsubscribe = onBroadcast(() => {
      dispatch({ type: "INCREMENT_UNREAD" });
    });
    return unsubscribe;
  }, [onBroadcast, dispatch]);

  // Listen for unread updates
  useEffect(() => {
    const unsubscribe = onUnreadUpdate(() => {
      dispatch({ type: "INCREMENT_UNREAD" });
    });
    return unsubscribe;
  }, [onUnreadUpdate, dispatch]);

  const unreadCount = state.unreadCount || 0;

  return (
    <Pressable
      onPress={() => navigate("/messages")}
      style={[messagingStyles.messagesButtonContainer, style]}
    >
      <View style={messagingStyles.messagesButton}>
        <Icon name="comments" size={22} color="#1e3a8a" />
      </View>
      {unreadCount > 0 && (
        <View style={messagingStyles.navBadge}>
          <Text style={messagingStyles.navBadgeText}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

export default MessagesButton;
