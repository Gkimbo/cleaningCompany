import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "./config";

const SocketContext = createContext(null);

export const SocketProvider = ({ children, token }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      // Disconnect if no token
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Create socket connection with auth
    const socketInstance = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on("connect", () => {
      setConnected(true);
      console.log("Socket connected");
    });

    socketInstance.on("disconnect", (reason) => {
      setConnected(false);
      console.log("Socket disconnected:", reason);
    });

    socketInstance.on("connect_error", (error) => {
      console.log("Socket connection error:", error.message);
    });

    setSocket(socketInstance);

    // Cleanup on unmount or token change
    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  // Join a conversation room
  const joinConversation = useCallback((conversationId) => {
    if (socket && connected) {
      socket.emit("join_conversation", conversationId);
    }
  }, [socket, connected]);

  // Leave a conversation room
  const leaveConversation = useCallback((conversationId) => {
    if (socket && connected) {
      socket.emit("leave_conversation", conversationId);
    }
  }, [socket, connected]);

  // Listen for new messages
  const onNewMessage = useCallback((callback) => {
    if (socket) {
      socket.on("new_message", callback);
      return () => socket.off("new_message", callback);
    }
    return () => {};
  }, [socket]);

  // Listen for broadcasts
  const onBroadcast = useCallback((callback) => {
    if (socket) {
      socket.on("broadcast", callback);
      return () => socket.off("broadcast", callback);
    }
    return () => {};
  }, [socket]);

  // Listen for unread updates
  const onUnreadUpdate = useCallback((callback) => {
    if (socket) {
      socket.on("unread_update", callback);
      return () => socket.off("unread_update", callback);
    }
    return () => {};
  }, [socket]);

  // Listen for being added to a conversation
  const onAddedToConversation = useCallback((callback) => {
    if (socket) {
      socket.on("added_to_conversation", callback);
      return () => socket.off("added_to_conversation", callback);
    }
    return () => {};
  }, [socket]);

  // Listen for new internal conversations (owner/HR)
  const onNewInternalConversation = useCallback((callback) => {
    if (socket) {
      socket.on("new_internal_conversation", callback);
      return () => socket.off("new_internal_conversation", callback);
    }
    return () => {};
  }, [socket]);

  // Listen for message reactions
  const onMessageReaction = useCallback((callback) => {
    if (socket) {
      socket.on("message_reaction", callback);
      return () => socket.off("message_reaction", callback);
    }
    return () => {};
  }, [socket]);

  // Listen for message deletions
  const onMessageDeleted = useCallback((callback) => {
    if (socket) {
      socket.on("message_deleted", callback);
      return () => socket.off("message_deleted", callback);
    }
    return () => {};
  }, [socket]);

  // Listen for message read receipts
  const onMessageRead = useCallback((callback) => {
    if (socket) {
      socket.on("message_read", callback);
      return () => socket.off("message_read", callback);
    }
    return () => {};
  }, [socket]);

  // Listen for reaction notifications (sent to message sender)
  const onReactionNotification = useCallback((callback) => {
    if (socket) {
      socket.on("reaction_notification", callback);
      return () => socket.off("reaction_notification", callback);
    }
    return () => {};
  }, [socket]);

  // Listen for conversation deletion (owner deleted a conversation)
  const onConversationDeleted = useCallback((callback) => {
    if (socket) {
      socket.on("conversation_deleted", callback);
      return () => socket.off("conversation_deleted", callback);
    }
    return () => {};
  }, [socket]);

  // Listen for conversation title changes
  const onConversationTitleChanged = useCallback((callback) => {
    if (socket) {
      socket.on("conversation_title_changed", callback);
      return () => socket.off("conversation_title_changed", callback);
    }
    return () => {};
  }, [socket]);

  // Listen for new suspicious activity reports (HR/Owner only)
  const onSuspiciousActivityReport = useCallback((callback) => {
    if (socket) {
      socket.on("suspicious_activity_report", callback);
      return () => socket.off("suspicious_activity_report", callback);
    }
    return () => {};
  }, [socket]);

  // Listen for suspicious report updates (HR/Owner only)
  const onSuspiciousReportUpdated = useCallback((callback) => {
    if (socket) {
      socket.on("suspicious_report_updated", callback);
      return () => socket.off("suspicious_report_updated", callback);
    }
    return () => {};
  }, [socket]);

  const value = {
    socket,
    connected,
    joinConversation,
    leaveConversation,
    onNewMessage,
    onBroadcast,
    onUnreadUpdate,
    onAddedToConversation,
    onNewInternalConversation,
    onMessageReaction,
    onMessageDeleted,
    onMessageRead,
    onReactionNotification,
    onConversationDeleted,
    onConversationTitleChanged,
    onSuspiciousActivityReport,
    onSuspiciousReportUpdated,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export default SocketContext;
