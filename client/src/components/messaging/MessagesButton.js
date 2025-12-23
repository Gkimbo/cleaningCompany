import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigate } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import MessageService from "../../services/fetchRequests/MessageClass";
import { useSocket } from "../../services/SocketContext";
import { colors, spacing, radius } from "../../services/styles/theme";

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
      style={({ pressed }) => [
        styles.messageButton,
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      <Feather name="message-circle" size={20} color="white" />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  messageButton: {
    padding: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.error[500],
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.neutral[800],
  },
  badgeText: {
    color: colors.neutral[0],
    fontSize: 10,
    fontWeight: "700",
  },
});

export default MessagesButton;
