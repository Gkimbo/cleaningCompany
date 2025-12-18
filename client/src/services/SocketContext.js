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

  const value = {
    socket,
    connected,
    joinConversation,
    leaveConversation,
    onNewMessage,
    onBroadcast,
    onUnreadUpdate,
    onAddedToConversation,
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
