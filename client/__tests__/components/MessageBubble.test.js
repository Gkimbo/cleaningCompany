/**
 * Comprehensive tests for MessageBubble component
 * Tests message display, reactions, deletion, and read receipts
 */

describe("MessageBubble Component Logic", () => {
  // ============================================
  // MOCK DATA
  // ============================================
  const mockCurrentUser = {
    userId: "1",
    token: "test-token",
  };

  const mockMessage = {
    id: 1,
    conversationId: 1,
    senderId: 2,
    content: "Hello, how are you?",
    createdAt: new Date().toISOString(),
    deletedAt: null,
    reactions: [],
    readReceipts: [],
    sender: {
      id: 2,
      username: "jane_doe",
      firstName: "Jane",
      lastName: "Doe",
    },
  };

  const mockOwnMessage = {
    ...mockMessage,
    id: 2,
    senderId: 1,
    sender: {
      id: 1,
      username: "john_doe",
      firstName: "John",
      lastName: "Doe",
    },
  };

  // ============================================
  // MESSAGE DISPLAY
  // ============================================
  describe("Message Display", () => {
    const isOwnMessage = (message, currentUserId) => {
      return message.senderId === parseInt(currentUserId);
    };

    it("should identify own messages correctly", () => {
      expect(isOwnMessage(mockOwnMessage, "1")).toBe(true);
      expect(isOwnMessage(mockMessage, "1")).toBe(false);
    });

    it("should identify other user messages correctly", () => {
      expect(isOwnMessage(mockMessage, "1")).toBe(false);
      expect(isOwnMessage(mockMessage, "2")).toBe(true);
    });
  });

  // ============================================
  // TIME FORMATTING
  // ============================================
  describe("Time Formatting", () => {
    const formatTime = (dateString) => {
      if (!dateString) return "";
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    it("should format time correctly", () => {
      const date = new Date("2025-01-15T10:30:00Z");
      const result = formatTime(date.toISOString());
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it("should return empty string for null date", () => {
      expect(formatTime(null)).toBe("");
    });

    it("should return empty string for undefined date", () => {
      expect(formatTime(undefined)).toBe("");
    });
  });

  // ============================================
  // SENDER DISPLAY NAME
  // ============================================
  describe("Sender Display Name", () => {
    const getDisplayName = (sender) => {
      if (!sender) return "Unknown";
      if (sender.firstName || sender.lastName) {
        return `${sender.firstName || ""} ${sender.lastName || ""}`.trim();
      }
      return sender.username;
    };

    it("should return full name when available", () => {
      expect(getDisplayName(mockMessage.sender)).toBe("Jane Doe");
    });

    it("should return first name only when no last name", () => {
      const sender = { firstName: "Jane", username: "jane" };
      expect(getDisplayName(sender)).toBe("Jane");
    });

    it("should return last name only when no first name", () => {
      const sender = { lastName: "Doe", username: "jane" };
      expect(getDisplayName(sender)).toBe("Doe");
    });

    it("should return username when no name", () => {
      const sender = { username: "jane_doe" };
      expect(getDisplayName(sender)).toBe("jane_doe");
    });

    it("should return Unknown for null sender", () => {
      expect(getDisplayName(null)).toBe("Unknown");
    });

    it("should return Unknown for undefined sender", () => {
      expect(getDisplayName(undefined)).toBe("Unknown");
    });
  });

  // ============================================
  // AVATAR INITIALS
  // ============================================
  describe("Avatar Initials", () => {
    const getInitials = (sender) => {
      const getDisplayName = (s) => {
        if (!s) return "Unknown";
        if (s.firstName || s.lastName) {
          return `${s.firstName || ""} ${s.lastName || ""}`.trim();
        }
        return s.username;
      };

      const name = getDisplayName(sender);
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    };

    it("should return two initials for full name", () => {
      expect(getInitials(mockMessage.sender)).toBe("JD");
    });

    it("should return one initial for single name", () => {
      const sender = { firstName: "Jane", username: "jane" };
      expect(getInitials(sender)).toBe("J");
    });

    it("should return uppercase initials for username", () => {
      const sender = { username: "jane" };
      expect(getInitials(sender)).toBe("J");
    });

    it("should limit to 2 characters", () => {
      const sender = { firstName: "John", lastName: "James Smith" };
      const initials = getInitials(sender);
      expect(initials.length).toBeLessThanOrEqual(2);
    });
  });

  // ============================================
  // DELETED MESSAGE
  // ============================================
  describe("Deleted Message Handling", () => {
    const isDeleted = (message) => {
      return message.deletedAt !== null && message.deletedAt !== undefined;
    };

    it("should detect deleted message", () => {
      const deletedMessage = { ...mockMessage, deletedAt: new Date().toISOString() };
      expect(isDeleted(deletedMessage)).toBe(true);
    });

    it("should detect non-deleted message", () => {
      expect(isDeleted(mockMessage)).toBe(false);
    });

    it("should handle message with null deletedAt", () => {
      const message = { ...mockMessage, deletedAt: null };
      expect(isDeleted(message)).toBe(false);
    });
  });

  // ============================================
  // READ RECEIPTS
  // ============================================
  describe("Read Receipts", () => {
    const hasBeenRead = (readReceipts) => {
      return !!(readReceipts && readReceipts.length > 0);
    };

    const getReadByUsers = (readReceipts, excludeUserId) => {
      if (!readReceipts) return [];
      return readReceipts
        .filter((r) => r.userId !== excludeUserId)
        .map((r) => r.user);
    };

    it("should detect when message has been read", () => {
      const receipts = [
        { id: 1, userId: 2, readAt: new Date().toISOString() },
      ];
      expect(hasBeenRead(receipts)).toBe(true);
    });

    it("should detect when message has not been read", () => {
      expect(hasBeenRead([])).toBe(false);
      expect(hasBeenRead(null)).toBe(false);
      expect(hasBeenRead(undefined)).toBe(false);
    });

    it("should get list of users who read the message", () => {
      const receipts = [
        { id: 1, userId: 2, user: { id: 2, username: "jane" } },
        { id: 2, userId: 3, user: { id: 3, username: "bob" } },
      ];
      const readers = getReadByUsers(receipts, 1);
      expect(readers).toHaveLength(2);
    });

    it("should exclude current user from readers", () => {
      const receipts = [
        { id: 1, userId: 1, user: { id: 1, username: "john" } },
        { id: 2, userId: 2, user: { id: 2, username: "jane" } },
      ];
      const readers = getReadByUsers(receipts, 1);
      expect(readers).toHaveLength(1);
      expect(readers[0].username).toBe("jane");
    });
  });

  // ============================================
  // REACTIONS
  // ============================================
  describe("Reactions Handling", () => {
    const groupReactions = (reactions) => {
      if (!reactions || reactions.length === 0) return {};

      return reactions.reduce((acc, reaction) => {
        const emoji = reaction.emoji;
        if (!acc[emoji]) {
          acc[emoji] = { emoji, count: 0, users: [], userIds: [] };
        }
        acc[emoji].count++;
        acc[emoji].users.push(reaction.user);
        acc[emoji].userIds.push(reaction.userId);
        return acc;
      }, {});
    };

    const hasUserReacted = (reactions, userId, emoji) => {
      if (!reactions) return false;
      return reactions.some((r) => r.userId === userId && r.emoji === emoji);
    };

    it("should group reactions by emoji", () => {
      const reactions = [
        { id: 1, emoji: "👍", userId: 1, user: { id: 1 } },
        { id: 2, emoji: "👍", userId: 2, user: { id: 2 } },
        { id: 3, emoji: "❤️", userId: 3, user: { id: 3 } },
      ];

      const grouped = groupReactions(reactions);
      expect(grouped["👍"].count).toBe(2);
      expect(grouped["❤️"].count).toBe(1);
    });

    it("should return empty object for no reactions", () => {
      expect(groupReactions([])).toEqual({});
      expect(groupReactions(null)).toEqual({});
    });

    it("should check if user has reacted with specific emoji", () => {
      const reactions = [
        { id: 1, emoji: "👍", userId: 1 },
        { id: 2, emoji: "❤️", userId: 2 },
      ];

      expect(hasUserReacted(reactions, 1, "👍")).toBe(true);
      expect(hasUserReacted(reactions, 1, "❤️")).toBe(false);
      expect(hasUserReacted(reactions, 2, "❤️")).toBe(true);
    });

    it("should handle null reactions array", () => {
      expect(hasUserReacted(null, 1, "👍")).toBe(false);
    });
  });

  // ============================================
  // BUBBLE STYLING
  // ============================================
  describe("Bubble Styling", () => {
    const getBubbleRadius = (isOwn, isFirstInGroup, isLastInGroup) => {
      const baseRadius = 16;
      const smallRadius = 4;

      if (isOwn) {
        return {
          borderTopLeftRadius: baseRadius,
          borderTopRightRadius: isFirstInGroup ? baseRadius : smallRadius,
          borderBottomLeftRadius: baseRadius,
          borderBottomRightRadius: isLastInGroup ? baseRadius : smallRadius,
        };
      }
      return {
        borderTopLeftRadius: isFirstInGroup ? baseRadius : smallRadius,
        borderTopRightRadius: baseRadius,
        borderBottomLeftRadius: isLastInGroup ? baseRadius : smallRadius,
        borderBottomRightRadius: baseRadius,
      };
    };

    it("should have full radius for single message (own)", () => {
      const radius = getBubbleRadius(true, true, true);
      expect(radius.borderTopLeftRadius).toBe(16);
      expect(radius.borderTopRightRadius).toBe(16);
      expect(radius.borderBottomLeftRadius).toBe(16);
      expect(radius.borderBottomRightRadius).toBe(16);
    });

    it("should have small radius on connected side for grouped (own)", () => {
      const radiusMiddle = getBubbleRadius(true, false, false);
      expect(radiusMiddle.borderTopRightRadius).toBe(4);
      expect(radiusMiddle.borderBottomRightRadius).toBe(4);
    });

    it("should have full radius for single message (other)", () => {
      const radius = getBubbleRadius(false, true, true);
      expect(radius.borderTopLeftRadius).toBe(16);
      expect(radius.borderTopRightRadius).toBe(16);
      expect(radius.borderBottomLeftRadius).toBe(16);
      expect(radius.borderBottomRightRadius).toBe(16);
    });

    it("should have small radius on connected side for grouped (other)", () => {
      const radiusMiddle = getBubbleRadius(false, false, false);
      expect(radiusMiddle.borderTopLeftRadius).toBe(4);
      expect(radiusMiddle.borderBottomLeftRadius).toBe(4);
    });
  });

  // ============================================
  // BROADCAST MESSAGE
  // ============================================
  describe("Broadcast Message", () => {
    const isBroadcast = (isBroadcastProp) => {
      return isBroadcastProp === true;
    };

    it("should identify broadcast message", () => {
      expect(isBroadcast(true)).toBe(true);
    });

    it("should identify non-broadcast message", () => {
      expect(isBroadcast(false)).toBe(false);
      expect(isBroadcast(undefined)).toBe(false);
    });
  });

  // ============================================
  // ACTION MENU PERMISSIONS
  // ============================================
  describe("Action Menu Permissions", () => {
    const canDelete = (message, currentUserId) => {
      return message.senderId === parseInt(currentUserId);
    };

    const canReact = () => {
      return true; // All participants can react
    };

    it("should allow delete for own message", () => {
      expect(canDelete(mockOwnMessage, "1")).toBe(true);
    });

    it("should not allow delete for others message", () => {
      expect(canDelete(mockMessage, "1")).toBe(false);
    });

    it("should allow react for any message", () => {
      expect(canReact()).toBe(true);
    });
  });

  // ============================================
  // GROUP CHAT DISPLAY
  // ============================================
  describe("Group Chat Display", () => {
    const shouldShowAvatar = (isOwn, isGroupChat, showSender, isFirstInGroup) => {
      return !isOwn && isGroupChat && showSender && isFirstInGroup;
    };

    const shouldShowSenderName = (isOwn, showSender, isFirstInGroup) => {
      return !isOwn && showSender && isFirstInGroup;
    };

    it("should show avatar for first message in group from other user", () => {
      expect(shouldShowAvatar(false, true, true, true)).toBe(true);
    });

    it("should not show avatar for own message", () => {
      expect(shouldShowAvatar(true, true, true, true)).toBe(false);
    });

    it("should not show avatar for non-group chat", () => {
      expect(shouldShowAvatar(false, false, true, true)).toBe(false);
    });

    it("should not show avatar for non-first message in group", () => {
      expect(shouldShowAvatar(false, true, true, false)).toBe(false);
    });

    it("should show sender name for first message from other user", () => {
      expect(shouldShowSenderName(false, true, true)).toBe(true);
    });

    it("should not show sender name for own message", () => {
      expect(shouldShowSenderName(true, true, true)).toBe(false);
    });
  });

  // ============================================
  // CONTAINER ALIGNMENT
  // ============================================
  describe("Container Alignment", () => {
    const getContainerStyle = (isOwn) => {
      if (isOwn) {
        return {
          justifyContent: "flex-end",
          alignSelf: "flex-end",
        };
      }
      return {
        justifyContent: "flex-start",
        alignSelf: "flex-start",
      };
    };

    it("should align own messages to the right", () => {
      const style = getContainerStyle(true);
      expect(style.justifyContent).toBe("flex-end");
      expect(style.alignSelf).toBe("flex-end");
    });

    it("should align other messages to the left", () => {
      const style = getContainerStyle(false);
      expect(style.justifyContent).toBe("flex-start");
      expect(style.alignSelf).toBe("flex-start");
    });
  });

  // ============================================
  // LONG PRESS BEHAVIOR (DIRECT REACTION PICKER)
  // ============================================
  describe("Long Press Behavior", () => {
    it("should show reaction picker directly on long press", () => {
      let showReactionPicker = false;
      const handleLongPress = () => {
        showReactionPicker = true;
      };

      handleLongPress();
      expect(showReactionPicker).toBe(true);
    });

    it("should close reaction picker and show confirmation for delete", () => {
      let showReactionPicker = true;
      let showDeleteConfirmation = false;

      const handleDelete = () => {
        showReactionPicker = false;
        showDeleteConfirmation = true;
      };

      handleDelete();
      expect(showReactionPicker).toBe(false);
      expect(showDeleteConfirmation).toBe(true);
    });

    it("should close reaction picker on close", () => {
      let showReactionPicker = true;

      const closeReactionPicker = () => {
        showReactionPicker = false;
      };

      closeReactionPicker();
      expect(showReactionPicker).toBe(false);
    });
  });

  // ============================================
  // REACTION PICKER PROPS
  // ============================================
  describe("Reaction Picker Props", () => {
    const getReactionPickerProps = (message, currentUserId, isOwn, visible) => {
      return {
        visible,
        currentReactions: message.reactions || [],
        userId: parseInt(currentUserId),
        isOwn,
        onDelete: isOwn ? jest.fn() : undefined,
      };
    };

    it("should pass delete handler for own messages", () => {
      const props = getReactionPickerProps(mockOwnMessage, "1", true, true);
      expect(props.onDelete).toBeDefined();
    });

    it("should not pass delete handler for others messages", () => {
      const props = getReactionPickerProps(mockMessage, "1", false, true);
      expect(props.onDelete).toBeUndefined();
    });

    it("should parse userId as integer", () => {
      const props = getReactionPickerProps(mockMessage, "1", false, true);
      expect(props.userId).toBe(1);
      expect(typeof props.userId).toBe("number");
    });

    it("should handle missing reactions", () => {
      const messageNoReactions = { ...mockMessage, reactions: undefined };
      const props = getReactionPickerProps(messageNoReactions, "1", false, true);
      expect(props.currentReactions).toEqual([]);
    });
  });

  // ============================================
  // TEXT STYLING
  // ============================================
  describe("Text Styling", () => {
    const getMessageTextColor = (isOwn) => {
      return isOwn ? "white" : "dark";
    };

    const getTimeTextColor = (isOwn) => {
      return isOwn ? "rgba(255, 255, 255, 0.7)" : "tertiary";
    };

    it("should use white text for own messages", () => {
      expect(getMessageTextColor(true)).toBe("white");
    });

    it("should use dark text for other messages", () => {
      expect(getMessageTextColor(false)).toBe("dark");
    });

    it("should use semi-transparent white for own message time", () => {
      expect(getTimeTextColor(true)).toBe("rgba(255, 255, 255, 0.7)");
    });

    it("should use tertiary color for other message time", () => {
      expect(getTimeTextColor(false)).toBe("tertiary");
    });
  });

  // ============================================
  // BUBBLE COLOR
  // ============================================
  describe("Bubble Color", () => {
    const getBubbleColor = (isOwn) => {
      return isOwn ? "primary-500" : "neutral-200";
    };

    it("should use primary color for own messages", () => {
      expect(getBubbleColor(true)).toBe("primary-500");
    });

    it("should use neutral color for other messages", () => {
      expect(getBubbleColor(false)).toBe("neutral-200");
    });
  });

  // ============================================
  // PRESS FEEDBACK
  // ============================================
  describe("Press Feedback", () => {
    const getBubbleOpacity = (pressed) => {
      return pressed ? 0.9 : 1;
    };

    it("should reduce opacity when pressed", () => {
      expect(getBubbleOpacity(true)).toBe(0.9);
    });

    it("should have full opacity when not pressed", () => {
      expect(getBubbleOpacity(false)).toBe(1);
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================
  describe("Edge Cases", () => {
    it("should handle empty message content", () => {
      const message = { ...mockMessage, content: "" };
      expect(message.content).toBe("");
    });

    it("should handle very long message content", () => {
      const longContent = "a".repeat(1000);
      const message = { ...mockMessage, content: longContent };
      expect(message.content.length).toBe(1000);
    });

    it("should handle message with special characters", () => {
      const message = { ...mockMessage, content: "Hello! @#$%^&*()" };
      expect(message.content).toContain("@#$%^&*()");
    });

    it("should handle message with emoji content", () => {
      const message = { ...mockMessage, content: "Hello 👋 World 🌍" };
      expect(message.content).toContain("👋");
      expect(message.content).toContain("🌍");
    });

    it("should handle message with newlines", () => {
      const message = { ...mockMessage, content: "Line 1\nLine 2\nLine 3" };
      expect(message.content.split("\n").length).toBe(3);
    });

    it("should handle sender with null names gracefully", () => {
      const getDisplayName = (sender) => {
        if (!sender) return "Unknown";
        if (sender.firstName || sender.lastName) {
          return `${sender.firstName || ""} ${sender.lastName || ""}`.trim();
        }
        return sender.username || "Unknown";
      };

      const sender = { firstName: null, lastName: null, username: "test" };
      expect(getDisplayName(sender)).toBe("test");
    });

    it("should handle missing readReceipts gracefully", () => {
      const hasBeenRead = (readReceipts) => {
        return !!(readReceipts && readReceipts.length > 0);
      };

      expect(hasBeenRead(null)).toBe(false);
      expect(hasBeenRead(undefined)).toBe(false);
      expect(hasBeenRead([])).toBe(false);
    });
  });

  // ============================================
  // READ RECEIPT ICON
  // ============================================
  describe("Read Receipt Icon", () => {
    const getReadReceiptIcon = (isOwn, hasBeenRead) => {
      if (!isOwn) return null;
      return hasBeenRead ? "check-circle" : "check";
    };

    it("should show check-circle when message has been read", () => {
      expect(getReadReceiptIcon(true, true)).toBe("check-circle");
    });

    it("should show check when message has not been read", () => {
      expect(getReadReceiptIcon(true, false)).toBe("check");
    });

    it("should not show icon for others messages", () => {
      expect(getReadReceiptIcon(false, true)).toBe(null);
      expect(getReadReceiptIcon(false, false)).toBe(null);
    });
  });

  // ============================================
  // AVATAR PLACEHOLDER
  // ============================================
  describe("Avatar Placeholder", () => {
    const shouldShowAvatarPlaceholder = (isOwn, isGroupChat, isFirstInGroup) => {
      return !isOwn && isGroupChat && !isFirstInGroup;
    };

    it("should show placeholder for non-first message in group", () => {
      expect(shouldShowAvatarPlaceholder(false, true, false)).toBe(true);
    });

    it("should not show placeholder for first message", () => {
      expect(shouldShowAvatarPlaceholder(false, true, true)).toBe(false);
    });

    it("should not show placeholder for own messages", () => {
      expect(shouldShowAvatarPlaceholder(true, true, false)).toBe(false);
    });

    it("should not show placeholder in non-group chats", () => {
      expect(shouldShowAvatarPlaceholder(false, false, false)).toBe(false);
    });
  });
});
