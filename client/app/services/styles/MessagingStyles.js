import { Dimensions, StyleSheet } from "react-native";
const { width, height } = Dimensions.get("window");

const messagingStyles = StyleSheet.create({
  // Main container
  container: {
    flex: 1,
    backgroundColor: "#f0f4f8",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(58, 141, 255, 0.15)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(58, 141, 255, 0.3)",
  },
  headerTitle: {
    fontSize: width < 400 ? 18 : 22,
    fontWeight: "bold",
    color: "#1e3a8a",
  },

  // Conversation list
  conversationList: {
    flex: 1,
    paddingTop: 8,
  },

  // Conversation item (tile)
  conversationItem: {
    flexDirection: "row",
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 6,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(58, 141, 255, 0.25)",
    shadowColor: "#3a8dff",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  conversationItemUnread: {
    backgroundColor: "rgba(58, 141, 255, 0.12)",
    borderColor: "rgba(58, 141, 255, 0.4)",
  },
  conversationItemBroadcast: {
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },

  conversationContent: {
    flex: 1,
    marginRight: 12,
  },
  conversationTitle: {
    fontSize: width < 400 ? 14 : 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },
  conversationPreview: {
    fontSize: width < 400 ? 12 : 14,
    color: "#64748b",
    numberOfLines: 2,
  },
  conversationTime: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
  },

  // Unread badge
  unreadBadge: {
    backgroundColor: "#ef4444",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  unreadBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },

  // Avatar/Icon
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(58, 141, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3a8dff",
  },

  // Chat screen
  chatContainer: {
    flex: 1,
    backgroundColor: "#f0f4f8",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(58, 141, 255, 0.15)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(58, 141, 255, 0.3)",
  },
  chatHeaderTitle: {
    flex: 1,
    fontSize: width < 400 ? 16 : 18,
    fontWeight: "600",
    color: "#1e3a8a",
    marginLeft: 12,
  },

  // Messages list
  messagesList: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  // Message bubble
  messageBubble: {
    maxWidth: "78%",
    padding: 12,
    borderRadius: 18,
    marginVertical: 4,
  },
  messageBubbleSent: {
    backgroundColor: "#3a8dff",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  messageBubbleReceived: {
    backgroundColor: "#ffffff",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(58, 141, 255, 0.2)",
  },
  messageBubbleBroadcast: {
    backgroundColor: "#fef3c7",
    alignSelf: "center",
    maxWidth: "90%",
    borderColor: "#f59e0b",
    borderWidth: 1,
  },

  messageText: {
    fontSize: width < 400 ? 14 : 15,
    lineHeight: 20,
  },
  messageTextSent: {
    color: "#ffffff",
  },
  messageTextReceived: {
    color: "#0f172a",
  },

  messageSender: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
    color: "#64748b",
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  messageTimeSent: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  messageTimeReceived: {
    color: "#94a3b8",
  },

  // Input area
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "rgba(58, 141, 255, 0.2)",
  },
  inputField: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f0f4f8",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(58, 141, 255, 0.3)",
    fontSize: 15,
    color: "#0f172a",
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: "#3a8dff",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  sendButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },

  // Broadcast form
  broadcastContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f0f4f8",
  },
  broadcastTitle: {
    fontSize: width < 400 ? 18 : 22,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginBottom: 20,
    textAlign: "center",
  },
  broadcastLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
    marginTop: 16,
  },
  broadcastInput: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(58, 141, 255, 0.3)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
  },
  broadcastTextArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },

  // Audience selector
  audienceContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  audienceOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "rgba(58, 141, 255, 0.3)",
    marginRight: 10,
    marginBottom: 10,
  },
  audienceOptionSelected: {
    backgroundColor: "#3a8dff",
    borderColor: "#3a8dff",
  },
  audienceOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#334155",
  },
  audienceOptionTextSelected: {
    color: "#ffffff",
  },

  // Broadcast button
  broadcastButton: {
    backgroundColor: "#f59e0b",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 24,
    alignItems: "center",
    shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  broadcastButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginTop: 16,
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Navigation button with badge
  messagesButtonContainer: {
    position: "relative",
  },
  messagesButton: {
    padding: 8,
  },
  navBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  navBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
  },

  // Participants list
  participantsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(58, 141, 255, 0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(58, 141, 255, 0.15)",
  },
  participantsText: {
    fontSize: 12,
    color: "#64748b",
  },

  // Date separator
  dateSeparator: {
    alignSelf: "center",
    backgroundColor: "rgba(58, 141, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    marginVertical: 12,
  },
  dateSeparatorText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },

  // Back button for chat
  backButton: {
    padding: 8,
  },
});

export default messagingStyles;
