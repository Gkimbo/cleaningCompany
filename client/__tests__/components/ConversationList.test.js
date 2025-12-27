/**
 * Comprehensive tests for ConversationList component
 * Tests tabs, search, filtering, and conversation display
 */

describe("ConversationList Component Logic", () => {
  // ============================================
  // MOCK DATA
  // ============================================
  const TABS = {
    ALL: "all",
    SUPPORT: "support",
    TEAM: "team",
    BROADCASTS: "broadcasts",
  };

  const mockConversations = [
    {
      id: 1,
      conversationId: 1,
      unreadCount: 3,
      conversation: {
        id: 1,
        conversationType: "support",
        title: "Support - John Doe",
        participants: [
          { userId: 1, user: { id: 1, username: "owner1", type: "owner" } },
          { userId: 2, user: { id: 2, username: "john", firstName: "John", lastName: "Doe" } },
        ],
        messages: [{ id: 1, content: "Need help", createdAt: "2025-01-15T10:00:00Z" }],
        updatedAt: "2025-01-15T10:00:00Z",
      },
    },
    {
      id: 2,
      conversationId: 2,
      unreadCount: 0,
      conversation: {
        id: 2,
        conversationType: "internal",
        title: "HR Team",
        participants: [
          { userId: 1, user: { id: 1, username: "owner1", type: "owner" } },
          { userId: 3, user: { id: 3, username: "hr1", type: "humanResources" } },
        ],
        messages: [{ id: 2, content: "Meeting at 3pm", createdAt: "2025-01-15T09:00:00Z" }],
        updatedAt: "2025-01-15T09:00:00Z",
      },
    },
    {
      id: 3,
      conversationId: 3,
      unreadCount: 1,
      conversation: {
        id: 3,
        conversationType: "broadcast",
        title: "Company Announcement",
        participants: [],
        messages: [{ id: 3, content: "Important update", createdAt: "2025-01-14T12:00:00Z" }],
        updatedAt: "2025-01-14T12:00:00Z",
      },
    },
    {
      id: 4,
      conversationId: 4,
      unreadCount: 0,
      conversation: {
        id: 4,
        conversationType: "appointment",
        title: null,
        appointment: { id: 1, date: "2025-01-20T10:00:00Z" },
        participants: [],
        messages: [],
        updatedAt: "2025-01-13T10:00:00Z",
      },
    },
  ];

  // ============================================
  // TAB VISIBILITY
  // ============================================
  describe("Tab Visibility by Role", () => {
    const getAvailableTabs = (isOwner, isHR) => {
      if (isOwner || isHR) {
        return [
          { key: TABS.ALL, label: "All", icon: "inbox" },
          { key: TABS.SUPPORT, label: "Support", icon: "life-buoy" },
          { key: TABS.TEAM, label: "Team", icon: "users" },
          { key: TABS.BROADCASTS, label: "Broadcasts", icon: "radio" },
        ];
      }
      return [{ key: TABS.ALL, label: "All", icon: "inbox" }];
    };

    it("should show all tabs for owner", () => {
      const tabs = getAvailableTabs(true, false);
      expect(tabs).toHaveLength(4);
    });

    it("should show all tabs for HR", () => {
      const tabs = getAvailableTabs(false, true);
      expect(tabs).toHaveLength(4);
    });

    it("should show only All tab for cleaner", () => {
      const tabs = getAvailableTabs(false, false);
      expect(tabs).toHaveLength(1);
      expect(tabs[0].key).toBe(TABS.ALL);
    });

    it("should show only All tab for homeowner", () => {
      const tabs = getAvailableTabs(false, false);
      expect(tabs).toHaveLength(1);
    });

    it("should have correct icons for tabs", () => {
      const tabs = getAvailableTabs(true, false);
      expect(tabs.find((t) => t.key === TABS.SUPPORT).icon).toBe("life-buoy");
      expect(tabs.find((t) => t.key === TABS.TEAM).icon).toBe("users");
      expect(tabs.find((t) => t.key === TABS.BROADCASTS).icon).toBe("radio");
    });
  });

  // ============================================
  // CONVERSATION TYPE DETECTION
  // ============================================
  describe("Conversation Type Detection", () => {
    const getConversationType = (conv) => {
      const type = conv.conversation?.conversationType;
      if (type === "broadcast") return TABS.BROADCASTS;
      if (type === "support") return TABS.SUPPORT;
      if (type === "internal") return TABS.TEAM;
      return TABS.ALL;
    };

    it("should detect support conversation", () => {
      expect(getConversationType(mockConversations[0])).toBe(TABS.SUPPORT);
    });

    it("should detect internal/team conversation", () => {
      expect(getConversationType(mockConversations[1])).toBe(TABS.TEAM);
    });

    it("should detect broadcast conversation", () => {
      expect(getConversationType(mockConversations[2])).toBe(TABS.BROADCASTS);
    });

    it("should return ALL for appointment conversations", () => {
      expect(getConversationType(mockConversations[3])).toBe(TABS.ALL);
    });

    it("should handle null conversation", () => {
      expect(getConversationType({ conversation: null })).toBe(TABS.ALL);
    });
  });

  // ============================================
  // TAB FILTERING
  // ============================================
  describe("Tab Filtering", () => {
    const filterByTab = (conversations, activeTab) => {
      if (activeTab === TABS.ALL) return conversations;

      return conversations.filter((conv) => {
        const type = conv.conversation?.conversationType;
        if (activeTab === TABS.BROADCASTS) return type === "broadcast";
        if (activeTab === TABS.SUPPORT) return type === "support";
        if (activeTab === TABS.TEAM) return type === "internal";
        return false;
      });
    };

    it("should return all conversations for ALL tab", () => {
      const filtered = filterByTab(mockConversations, TABS.ALL);
      expect(filtered).toHaveLength(4);
    });

    it("should filter support conversations", () => {
      const filtered = filterByTab(mockConversations, TABS.SUPPORT);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].conversation.conversationType).toBe("support");
    });

    it("should filter team conversations", () => {
      const filtered = filterByTab(mockConversations, TABS.TEAM);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].conversation.conversationType).toBe("internal");
    });

    it("should filter broadcast conversations", () => {
      const filtered = filterByTab(mockConversations, TABS.BROADCASTS);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].conversation.conversationType).toBe("broadcast");
    });
  });

  // ============================================
  // SEARCH FILTERING
  // ============================================
  describe("Search Filtering", () => {
    const filterBySearch = (conversations, query, getTitle, getPreview) => {
      if (!query || !query.trim()) return conversations;

      const lowerQuery = query.toLowerCase().trim();
      return conversations.filter((conv) => {
        const title = getTitle(conv).toLowerCase();
        const preview = getPreview(conv).toLowerCase();
        return title.includes(lowerQuery) || preview.includes(lowerQuery);
      });
    };

    const getTitle = (conv) => conv.conversation?.title || "Conversation";
    const getPreview = (conv) => conv.conversation?.messages?.[0]?.content || "";

    it("should return all conversations for empty search", () => {
      const filtered = filterBySearch(mockConversations, "", getTitle, getPreview);
      expect(filtered).toHaveLength(4);
    });

    it("should return all conversations for whitespace search", () => {
      const filtered = filterBySearch(mockConversations, "   ", getTitle, getPreview);
      expect(filtered).toHaveLength(4);
    });

    it("should filter by title", () => {
      const filtered = filterBySearch(mockConversations, "John", getTitle, getPreview);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].conversation.title).toContain("John");
    });

    it("should filter by message content", () => {
      const filtered = filterBySearch(mockConversations, "help", getTitle, getPreview);
      expect(filtered).toHaveLength(1);
    });

    it("should be case insensitive", () => {
      const filtered1 = filterBySearch(mockConversations, "JOHN", getTitle, getPreview);
      const filtered2 = filterBySearch(mockConversations, "john", getTitle, getPreview);
      expect(filtered1).toHaveLength(filtered2.length);
    });

    it("should return empty array when no matches", () => {
      const filtered = filterBySearch(mockConversations, "xyz123", getTitle, getPreview);
      expect(filtered).toHaveLength(0);
    });
  });

  // ============================================
  // CONVERSATION TITLE
  // ============================================
  describe("Conversation Title Generation", () => {
    const getConversationTitle = (conv, isOwner, isHR, currentUserId) => {
      const conversation = conv.conversation;
      if (!conversation) return "Conversation";

      if (conversation.conversationType === "broadcast") {
        return conversation.title || "Announcement";
      }
      if (conversation.conversationType === "support") {
        if (isOwner || isHR) {
          return conversation.title || "Support Request";
        }
        return "Support";
      }
      if (conversation.conversationType === "internal") {
        if (conversation.title) return conversation.title;
        const otherParticipants = conversation.participants?.filter(
          (p) => p.userId !== currentUserId
        );
        if (otherParticipants?.length === 1) {
          const user = otherParticipants[0].user;
          if (user?.firstName || user?.lastName) {
            return `${user.firstName || ""} ${user.lastName || ""}`.trim();
          }
          return user?.username || "Team Member";
        }
        if (otherParticipants?.length > 1) return "Team Chat";
      }
      if (conversation.appointment) {
        const date = new Date(conversation.appointment.date);
        return `Appt - ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
      }
      return "Conversation";
    };

    it("should return broadcast title", () => {
      const title = getConversationTitle(mockConversations[2], true, false, 1);
      expect(title).toBe("Company Announcement");
    });

    it("should return support title for owner", () => {
      const title = getConversationTitle(mockConversations[0], true, false, 1);
      expect(title).toBe("Support - John Doe");
    });

    it("should return Support for non-owner/HR", () => {
      const title = getConversationTitle(mockConversations[0], false, false, 2);
      expect(title).toBe("Support");
    });

    it("should return internal conversation title", () => {
      const title = getConversationTitle(mockConversations[1], true, false, 1);
      expect(title).toBe("HR Team");
    });

    it("should generate appointment title with date", () => {
      const title = getConversationTitle(mockConversations[3], true, false, 1);
      expect(title).toContain("Appt");
    });
  });

  // ============================================
  // PREVIEW TEXT
  // ============================================
  describe("Preview Text Generation", () => {
    const getPreviewText = (conv, currentUserId) => {
      const lastMessage = conv.conversation?.messages?.[0];
      if (lastMessage) {
        if (lastMessage.deletedAt) return "Message was deleted";
        const isMine = lastMessage.senderId === currentUserId;
        const prefix = isMine ? "You: " : "";
        const content = lastMessage.content.length > 50
          ? lastMessage.content.substring(0, 50) + "..."
          : lastMessage.content;
        return `${prefix}${content}`;
      }
      return "No messages yet";
    };

    it("should show message content", () => {
      const preview = getPreviewText(mockConversations[0], 1);
      expect(preview).toBe("Need help");
    });

    it("should prefix with You: for own messages", () => {
      const convWithOwnMessage = {
        conversation: {
          messages: [{ content: "Hello", senderId: 1 }],
        },
      };
      const preview = getPreviewText(convWithOwnMessage, 1);
      expect(preview).toBe("You: Hello");
    });

    it("should truncate long messages", () => {
      const longMessage = "A".repeat(100);
      const convWithLongMessage = {
        conversation: {
          messages: [{ content: longMessage, senderId: 2 }],
        },
      };
      const preview = getPreviewText(convWithLongMessage, 1);
      expect(preview.length).toBeLessThanOrEqual(53); // 50 + "..."
      expect(preview.endsWith("...")).toBe(true);
    });

    it("should show placeholder for no messages", () => {
      const emptyConv = { conversation: { messages: [] } };
      const preview = getPreviewText(emptyConv, 1);
      expect(preview).toBe("No messages yet");
    });

    it("should show deleted message indicator", () => {
      const deletedConv = {
        conversation: {
          messages: [{ content: "Secret", deletedAt: "2025-01-15T10:00:00Z" }],
        },
      };
      const preview = getPreviewText(deletedConv, 1);
      expect(preview).toBe("Message was deleted");
    });
  });

  // ============================================
  // TIME FORMATTING
  // ============================================
  describe("Time Formatting", () => {
    const formatTime = (dateString) => {
      if (!dateString) return "";
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return "now";
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    it("should return 'now' for very recent", () => {
      const recentDate = new Date(Date.now() - 30000).toISOString();
      expect(formatTime(recentDate)).toBe("now");
    });

    it("should return minutes for less than an hour", () => {
      const minutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatTime(minutesAgo)).toBe("5m");
    });

    it("should return hours for less than a day", () => {
      const hoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      expect(formatTime(hoursAgo)).toBe("3h");
    });

    it("should return empty string for null date", () => {
      expect(formatTime(null)).toBe("");
    });
  });

  // ============================================
  // UNREAD COUNT
  // ============================================
  describe("Unread Count", () => {
    const hasUnread = (conv) => conv.unreadCount > 0;

    const formatUnreadCount = (count) => {
      if (count > 99) return "99+";
      return count.toString();
    };

    const calculateTotalUnread = (conversations) => {
      return conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
    };

    it("should detect conversation with unread messages", () => {
      expect(hasUnread(mockConversations[0])).toBe(true);
    });

    it("should detect conversation without unread messages", () => {
      expect(hasUnread(mockConversations[1])).toBe(false);
    });

    it("should format unread count correctly", () => {
      expect(formatUnreadCount(5)).toBe("5");
      expect(formatUnreadCount(99)).toBe("99");
    });

    it("should cap unread count at 99+", () => {
      expect(formatUnreadCount(100)).toBe("99+");
      expect(formatUnreadCount(999)).toBe("99+");
    });

    it("should calculate total unread across all conversations", () => {
      const total = calculateTotalUnread(mockConversations);
      expect(total).toBe(4); // 3 + 0 + 1 + 0
    });
  });

  // ============================================
  // TYPE ICONS
  // ============================================
  describe("Type Icons", () => {
    const getTypeIcon = (conv) => {
      const type = conv.conversation?.conversationType;
      if (type === "broadcast") return { name: "radio", color: "#F59E0B" };
      if (type === "support") return { name: "life-buoy", color: "#3B82F6" };
      if (type === "internal") return { name: "users", color: "#8B5CF6" };
      if (conv.conversation?.appointment) return { name: "calendar", color: "#10B981" };
      return { name: "message-circle", color: "#9CA3AF" };
    };

    it("should return broadcast icon", () => {
      const icon = getTypeIcon(mockConversations[2]);
      expect(icon.name).toBe("radio");
    });

    it("should return support icon", () => {
      const icon = getTypeIcon(mockConversations[0]);
      expect(icon.name).toBe("life-buoy");
    });

    it("should return team icon", () => {
      const icon = getTypeIcon(mockConversations[1]);
      expect(icon.name).toBe("users");
    });

    it("should return appointment icon", () => {
      const icon = getTypeIcon(mockConversations[3]);
      expect(icon.name).toBe("calendar");
    });
  });

  // ============================================
  // AVATAR DISPLAY
  // ============================================
  describe("Avatar Display", () => {
    const getInitials = (title) => {
      return title
        .split(" ")
        .filter((word) => word.length > 0)
        .map((word) => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
    };

    const isGroupChat = (conv) => {
      return (conv.conversation?.participants?.length || 0) > 2;
    };

    it("should generate initials from title", () => {
      expect(getInitials("John Doe")).toBe("JD");
      expect(getInitials("Support")).toBe("S");
      expect(getInitials("HR Team")).toBe("HT");
    });

    it("should limit initials to 2 characters", () => {
      expect(getInitials("John James Doe").length).toBe(2);
    });

    it("should detect group chat", () => {
      const groupConv = {
        conversation: {
          participants: [{ userId: 1 }, { userId: 2 }, { userId: 3 }],
        },
      };
      expect(isGroupChat(groupConv)).toBe(true);
    });

    it("should detect 1-on-1 chat", () => {
      const directConv = {
        conversation: {
          participants: [{ userId: 1 }, { userId: 2 }],
        },
      };
      expect(isGroupChat(directConv)).toBe(false);
    });
  });

  // ============================================
  // CREATE CONVERSATION PERMISSION
  // ============================================
  describe("Create Conversation Permission", () => {
    const canCreateConversation = (account) => {
      return account === "owner" || account === "humanResources";
    };

    it("should allow owner to create conversations", () => {
      expect(canCreateConversation("owner")).toBe(true);
    });

    it("should allow HR to create conversations", () => {
      expect(canCreateConversation("humanResources")).toBe(true);
    });

    it("should not allow cleaner to create conversations", () => {
      expect(canCreateConversation("cleaner")).toBe(false);
    });

    it("should not allow homeowner to create conversations", () => {
      expect(canCreateConversation(null)).toBe(false);
    });
  });

  // ============================================
  // COMBINED FILTERING
  // ============================================
  describe("Combined Filtering (Tab + Search)", () => {
    const filterConversations = (conversations, activeTab, searchQuery) => {
      let filtered = conversations;

      // Filter by tab
      if (activeTab !== TABS.ALL) {
        filtered = filtered.filter((conv) => {
          const type = conv.conversation?.conversationType;
          if (activeTab === TABS.BROADCASTS) return type === "broadcast";
          if (activeTab === TABS.SUPPORT) return type === "support";
          if (activeTab === TABS.TEAM) return type === "internal";
          return false;
        });
      }

      // Filter by search
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter((conv) => {
          const title = (conv.conversation?.title || "").toLowerCase();
          const content = (conv.conversation?.messages?.[0]?.content || "").toLowerCase();
          return title.includes(query) || content.includes(query);
        });
      }

      return filtered;
    };

    it("should filter by both tab and search", () => {
      const filtered = filterConversations(mockConversations, TABS.SUPPORT, "John");
      expect(filtered).toHaveLength(1);
    });

    it("should return empty when no matches for both filters", () => {
      const filtered = filterConversations(mockConversations, TABS.TEAM, "xyz");
      expect(filtered).toHaveLength(0);
    });

    it("should apply only tab filter when no search", () => {
      const filtered = filterConversations(mockConversations, TABS.BROADCASTS, "");
      expect(filtered).toHaveLength(1);
    });

    it("should apply only search filter on ALL tab", () => {
      const filtered = filterConversations(mockConversations, TABS.ALL, "meeting");
      expect(filtered).toHaveLength(1);
    });
  });
});
