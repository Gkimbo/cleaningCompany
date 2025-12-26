/**
 * Comprehensive tests for Internal Messaging Components
 * Tests owner-HR messaging, custom groups, search, and display names
 */

describe("Internal Messaging Component Logic", () => {
  // ============================================
  // MOCK DATA
  // ============================================
  const mockOwner = {
    id: 1,
    username: "owner1",
    firstName: "John",
    lastName: "Owner",
    type: "owner",
  };

  const mockHRStaff = [
    { id: 2, username: "hr1", firstName: "Jane", lastName: "Smith", type: "humanResources" },
    { id: 3, username: "hr2", firstName: "Bob", lastName: "Jones", type: "humanResources" },
    { id: 4, username: "hr3", firstName: "Sarah", lastName: "Wilson", type: "humanResources" },
    { id: 5, username: "hr4", firstName: "Mike", lastName: "Brown", type: "humanResources" },
    { id: 6, username: "hr5", firstName: "Lisa", lastName: "Davis", type: "humanResources" },
  ];

  const mockConversations = [
    {
      id: 100,
      title: "HR Team",
      displayName: "Jane, Bob, Sarah +2 more",
      isGroupChat: true,
      unreadCount: 3,
      participants: [mockOwner, ...mockHRStaff],
      otherParticipants: mockHRStaff,
      lastMessage: {
        content: "Hello team!",
        sender: { id: 2, displayName: "Jane Smith" },
        createdAt: "2025-01-15T10:00:00Z",
      },
      updatedAt: "2025-01-15T10:00:00Z",
    },
    {
      id: 101,
      title: "Direct - Jane Smith",
      displayName: "Jane Smith",
      isGroupChat: false,
      unreadCount: 0,
      participants: [mockOwner, mockHRStaff[0]],
      otherParticipants: [mockHRStaff[0]],
      lastMessage: null,
      updatedAt: "2025-01-14T10:00:00Z",
    },
  ];

  // ============================================
  // DISPLAY NAME FORMATTING
  // ============================================
  describe("Display Name Formatting", () => {
    const formatDisplayName = (user) => {
      const firstName = user.firstName || "";
      const lastName = user.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || user.username;
    };

    it("should format full name correctly", () => {
      expect(formatDisplayName(mockHRStaff[0])).toBe("Jane Smith");
    });

    it("should use username when no name provided", () => {
      const userNoName = { id: 10, username: "testuser" };
      expect(formatDisplayName(userNoName)).toBe("testuser");
    });

    it("should handle first name only", () => {
      const user = { id: 10, username: "test", firstName: "Alice", lastName: "" };
      expect(formatDisplayName(user)).toBe("Alice");
    });

    it("should handle last name only", () => {
      const user = { id: 10, username: "test", firstName: "", lastName: "Wonder" };
      expect(formatDisplayName(user)).toBe("Wonder");
    });

    it("should handle null values", () => {
      const user = { id: 10, username: "test", firstName: null, lastName: null };
      expect(formatDisplayName(user)).toBe("test");
    });

    it("should handle undefined values", () => {
      const user = { id: 10, username: "test" };
      expect(formatDisplayName(user)).toBe("test");
    });
  });

  // ============================================
  // GROUP DISPLAY NAME GENERATION
  // ============================================
  describe("Group Display Name Generation", () => {
    const generateGroupDisplayName = (participants, currentUserId, maxNames = 3) => {
      const others = participants
        .filter((p) => p.id !== currentUserId)
        .map((p) => p.firstName || p.username);

      if (others.length <= maxNames) {
        return others.join(", ");
      }

      const shown = others.slice(0, maxNames);
      const remaining = others.length - maxNames;
      return `${shown.join(", ")} +${remaining} more`;
    };

    it("should show all names for small groups", () => {
      const participants = [mockOwner, mockHRStaff[0], mockHRStaff[1]];
      expect(generateGroupDisplayName(participants, 1)).toBe("Jane, Bob");
    });

    it("should show +X more for large groups", () => {
      const participants = [mockOwner, ...mockHRStaff];
      expect(generateGroupDisplayName(participants, 1)).toBe("Jane, Bob, Sarah +2 more");
    });

    it("should exclude current user from display", () => {
      const participants = [mockOwner, mockHRStaff[0]];
      expect(generateGroupDisplayName(participants, 1)).toBe("Jane");
    });

    it("should handle empty other participants", () => {
      const participants = [mockOwner];
      expect(generateGroupDisplayName(participants, 1)).toBe("");
    });

    it("should use username if no first name", () => {
      const participants = [
        mockOwner,
        { id: 10, username: "testhr", type: "humanResources" },
      ];
      expect(generateGroupDisplayName(participants, 1)).toBe("testhr");
    });
  });

  // ============================================
  // SEARCH FUNCTIONALITY
  // ============================================
  describe("Staff Search", () => {
    const searchStaff = (staff, query) => {
      if (!query || !query.trim()) return staff;

      const lowerQuery = query.toLowerCase().trim();
      return staff.filter((s) => {
        const firstName = (s.firstName || "").toLowerCase();
        const lastName = (s.lastName || "").toLowerCase();
        const username = (s.username || "").toLowerCase();
        const fullName = `${firstName} ${lastName}`;

        return (
          firstName.includes(lowerQuery) ||
          lastName.includes(lowerQuery) ||
          username.includes(lowerQuery) ||
          fullName.includes(lowerQuery)
        );
      });
    };

    it("should return all staff when query is empty", () => {
      expect(searchStaff(mockHRStaff, "")).toHaveLength(5);
    });

    it("should return all staff when query is null", () => {
      expect(searchStaff(mockHRStaff, null)).toHaveLength(5);
    });

    it("should return all staff when query is whitespace", () => {
      expect(searchStaff(mockHRStaff, "   ")).toHaveLength(5);
    });

    it("should filter by first name", () => {
      const results = searchStaff(mockHRStaff, "jane");
      expect(results).toHaveLength(1);
      expect(results[0].firstName).toBe("Jane");
    });

    it("should filter by last name", () => {
      const results = searchStaff(mockHRStaff, "wilson");
      expect(results).toHaveLength(1);
      expect(results[0].lastName).toBe("Wilson");
    });

    it("should filter by username", () => {
      const results = searchStaff(mockHRStaff, "hr3");
      expect(results).toHaveLength(1);
      expect(results[0].username).toBe("hr3");
    });

    it("should be case insensitive", () => {
      expect(searchStaff(mockHRStaff, "JANE")).toHaveLength(1);
      expect(searchStaff(mockHRStaff, "JaNe")).toHaveLength(1);
    });

    it("should match partial strings", () => {
      const results = searchStaff(mockHRStaff, "jan");
      expect(results).toHaveLength(1);
    });

    it("should match full name", () => {
      const results = searchStaff(mockHRStaff, "jane smith");
      expect(results).toHaveLength(1);
    });

    it("should return empty array when no matches", () => {
      expect(searchStaff(mockHRStaff, "xyz")).toHaveLength(0);
    });

    it("should match multiple results", () => {
      // Both "Brown" and "Bob" should match if we search for 'b'
      const results = searchStaff(mockHRStaff, "b");
      expect(results.length).toBeGreaterThan(1);
    });
  });

  // ============================================
  // MEMBER SELECTION FOR CUSTOM GROUPS
  // ============================================
  describe("Custom Group Member Selection", () => {
    const validateMemberSelection = (memberIds, currentUserId) => {
      if (!memberIds || !Array.isArray(memberIds)) {
        return { valid: false, error: "At least one member is required" };
      }

      const uniqueIds = [...new Set(memberIds.filter((id) => id !== currentUserId))];

      if (uniqueIds.length < 1) {
        return { valid: false, error: "At least one other member is required" };
      }

      return { valid: true, uniqueIds };
    };

    it("should reject null memberIds", () => {
      const result = validateMemberSelection(null, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("member");
    });

    it("should reject empty array", () => {
      const result = validateMemberSelection([], 1);
      expect(result.valid).toBe(false);
    });

    it("should reject array with only current user", () => {
      const result = validateMemberSelection([1], 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("other member");
    });

    it("should accept valid member selection", () => {
      const result = validateMemberSelection([2, 3, 4], 1);
      expect(result.valid).toBe(true);
      expect(result.uniqueIds).toEqual([2, 3, 4]);
    });

    it("should remove duplicates", () => {
      const result = validateMemberSelection([2, 2, 3, 3, 3], 1);
      expect(result.valid).toBe(true);
      expect(result.uniqueIds).toEqual([2, 3]);
    });

    it("should remove current user from selection", () => {
      const result = validateMemberSelection([1, 2, 3], 1);
      expect(result.valid).toBe(true);
      expect(result.uniqueIds).not.toContain(1);
      expect(result.uniqueIds).toEqual([2, 3]);
    });
  });

  // ============================================
  // CONVERSATION TYPE DETECTION
  // ============================================
  describe("Conversation Type Detection", () => {
    const isGroupChat = (conversation) => {
      return conversation.participants && conversation.participants.length > 2;
    };

    const isHRTeamChat = (conversation) => {
      return conversation.title === "HR Team" && conversation.isGroupChat;
    };

    const isDirectMessage = (conversation) => {
      return !conversation.isGroupChat && conversation.participants.length === 2;
    };

    it("should detect group chat (3+ participants)", () => {
      expect(isGroupChat(mockConversations[0])).toBe(true);
    });

    it("should detect 1-on-1 as non-group", () => {
      expect(isGroupChat(mockConversations[1])).toBe(false);
    });

    it("should identify HR Team conversation", () => {
      expect(isHRTeamChat(mockConversations[0])).toBe(true);
    });

    it("should not identify direct message as HR Team", () => {
      expect(isHRTeamChat(mockConversations[1])).toBe(false);
    });

    it("should detect direct message", () => {
      expect(isDirectMessage(mockConversations[1])).toBe(true);
    });

    it("should not detect group as direct message", () => {
      expect(isDirectMessage(mockConversations[0])).toBe(false);
    });
  });

  // ============================================
  // UNREAD COUNT DISPLAY
  // ============================================
  describe("Unread Count Display", () => {
    const formatUnreadCount = (count) => {
      if (!count || count <= 0) return null;
      if (count > 99) return "99+";
      return count.toString();
    };

    const shouldShowUnreadBadge = (count) => {
      return count > 0;
    };

    it("should return null for 0", () => {
      expect(formatUnreadCount(0)).toBeNull();
    });

    it("should return null for negative", () => {
      expect(formatUnreadCount(-5)).toBeNull();
    });

    it("should return null for null/undefined", () => {
      expect(formatUnreadCount(null)).toBeNull();
      expect(formatUnreadCount(undefined)).toBeNull();
    });

    it("should return string for valid counts", () => {
      expect(formatUnreadCount(5)).toBe("5");
      expect(formatUnreadCount(99)).toBe("99");
    });

    it("should cap at 99+", () => {
      expect(formatUnreadCount(100)).toBe("99+");
      expect(formatUnreadCount(999)).toBe("99+");
    });

    it("should show badge for positive count", () => {
      expect(shouldShowUnreadBadge(1)).toBe(true);
      expect(shouldShowUnreadBadge(50)).toBe(true);
    });

    it("should not show badge for zero", () => {
      expect(shouldShowUnreadBadge(0)).toBe(false);
    });
  });

  // ============================================
  // CONVERSATION SORTING
  // ============================================
  describe("Conversation Sorting", () => {
    const sortByUpdatedAt = (conversations) => {
      return [...conversations].sort((a, b) => {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
    };

    const sortByUnreadFirst = (conversations) => {
      return [...conversations].sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
    };

    it("should sort by most recent first", () => {
      const convos = [
        { id: 1, updatedAt: "2025-01-10T10:00:00Z" },
        { id: 2, updatedAt: "2025-01-15T10:00:00Z" },
        { id: 3, updatedAt: "2025-01-12T10:00:00Z" },
      ];
      const sorted = sortByUpdatedAt(convos);
      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(3);
      expect(sorted[2].id).toBe(1);
    });

    it("should sort unread conversations first", () => {
      const convos = [
        { id: 1, unreadCount: 0, updatedAt: "2025-01-15T10:00:00Z" },
        { id: 2, unreadCount: 5, updatedAt: "2025-01-10T10:00:00Z" },
        { id: 3, unreadCount: 0, updatedAt: "2025-01-12T10:00:00Z" },
      ];
      const sorted = sortByUnreadFirst(convos);
      expect(sorted[0].id).toBe(2);
    });
  });

  // ============================================
  // GROUP TITLE GENERATION
  // ============================================
  describe("Group Title Generation", () => {
    const generateGroupTitle = (members, maxNames = 3) => {
      if (!members || members.length === 0) return "New Group";

      const names = members.map((m) => m.firstName || m.username).slice(0, maxNames);
      let title = names.join(", ");

      if (members.length > maxNames) {
        title += ` +${members.length - maxNames} more`;
      }

      return title;
    };

    it("should generate title from 1 member", () => {
      expect(generateGroupTitle([mockHRStaff[0]])).toBe("Jane");
    });

    it("should generate title from 2 members", () => {
      expect(generateGroupTitle([mockHRStaff[0], mockHRStaff[1]])).toBe("Jane, Bob");
    });

    it("should generate title from 3 members", () => {
      expect(generateGroupTitle([mockHRStaff[0], mockHRStaff[1], mockHRStaff[2]])).toBe("Jane, Bob, Sarah");
    });

    it("should truncate for 4+ members", () => {
      expect(generateGroupTitle(mockHRStaff)).toBe("Jane, Bob, Sarah +2 more");
    });

    it("should handle empty array", () => {
      expect(generateGroupTitle([])).toBe("New Group");
    });

    it("should handle null", () => {
      expect(generateGroupTitle(null)).toBe("New Group");
    });

    it("should use username when no firstName", () => {
      const members = [{ id: 1, username: "testuser" }];
      expect(generateGroupTitle(members)).toBe("testuser");
    });
  });

  // ============================================
  // LAST MESSAGE FORMATTING
  // ============================================
  describe("Last Message Formatting", () => {
    const formatLastMessage = (message, maxLength = 50) => {
      if (!message || !message.content) return "No messages yet";

      const content = message.content.trim();
      if (content.length <= maxLength) return content;

      return content.substring(0, maxLength - 3) + "...";
    };

    const formatLastMessageWithSender = (message, currentUserId) => {
      if (!message) return "No messages yet";

      const isOwn = message.sender && message.sender.id === currentUserId;
      const prefix = isOwn ? "You: " : `${message.sender.displayName || "Unknown"}: `;

      return prefix + (message.content || "");
    };

    it("should return placeholder for null message", () => {
      expect(formatLastMessage(null)).toBe("No messages yet");
    });

    it("should return placeholder for empty content", () => {
      expect(formatLastMessage({ content: "" })).toBe("No messages yet");
    });

    it("should return full message if short", () => {
      expect(formatLastMessage({ content: "Hello" })).toBe("Hello");
    });

    it("should truncate long messages", () => {
      const longMessage = "A".repeat(100);
      const result = formatLastMessage({ content: longMessage });
      expect(result.length).toBe(50);
      expect(result.endsWith("...")).toBe(true);
    });

    it("should prefix with You for own messages", () => {
      const message = { content: "Hello", sender: { id: 1, displayName: "John" } };
      expect(formatLastMessageWithSender(message, 1)).toBe("You: Hello");
    });

    it("should prefix with sender name for others", () => {
      const message = { content: "Hello", sender: { id: 2, displayName: "Jane" } };
      expect(formatLastMessageWithSender(message, 1)).toBe("Jane: Hello");
    });
  });

  // ============================================
  // RELATIVE TIME FORMATTING
  // ============================================
  describe("Relative Time Formatting", () => {
    const formatRelativeTime = (dateString) => {
      if (!dateString) return "";

      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };

    it("should return empty for null date", () => {
      expect(formatRelativeTime(null)).toBe("");
    });

    it("should return empty for undefined date", () => {
      expect(formatRelativeTime(undefined)).toBe("");
    });

    it("should handle valid date string", () => {
      const result = formatRelativeTime("2025-01-15T10:00:00Z");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // USER PERMISSION CHECKS
  // ============================================
  describe("User Permission Checks", () => {
    const canAccessInternalMessaging = (user) => {
      if (!user) return false;
      return user.type === "owner" || user.type === "humanResources";
    };

    const canCreateHRGroup = (user) => {
      return user && user.type === "owner";
    };

    const canMessageTarget = (currentUser, targetUser) => {
      if (!currentUser || !targetUser) return false;
      if (currentUser.id === targetUser.id) return false;

      if (currentUser.type === "owner") {
        return targetUser.type === "humanResources";
      }

      if (currentUser.type === "humanResources") {
        return targetUser.type === "owner" || targetUser.type === "humanResources";
      }

      return false;
    };

    describe("canAccessInternalMessaging", () => {
      it("should allow owner", () => {
        expect(canAccessInternalMessaging(mockOwner)).toBe(true);
      });

      it("should allow HR", () => {
        expect(canAccessInternalMessaging(mockHRStaff[0])).toBe(true);
      });

      it("should deny cleaner", () => {
        expect(canAccessInternalMessaging({ type: "cleaner" })).toBe(false);
      });

      it("should deny homeowner", () => {
        expect(canAccessInternalMessaging({ type: "homeowner" })).toBe(false);
      });

      it("should deny null user", () => {
        expect(canAccessInternalMessaging(null)).toBe(false);
      });
    });

    describe("canCreateHRGroup", () => {
      it("should allow owner", () => {
        expect(canCreateHRGroup(mockOwner)).toBe(true);
      });

      it("should deny HR", () => {
        expect(canCreateHRGroup(mockHRStaff[0])).toBe(false);
      });
    });

    describe("canMessageTarget", () => {
      it("should allow owner to message HR", () => {
        expect(canMessageTarget(mockOwner, mockHRStaff[0])).toBe(true);
      });

      it("should deny owner to message cleaner", () => {
        expect(canMessageTarget(mockOwner, { id: 10, type: "cleaner" })).toBe(false);
      });

      it("should deny owner to message homeowner", () => {
        expect(canMessageTarget(mockOwner, { id: 10, type: "homeowner" })).toBe(false);
      });

      it("should allow HR to message owner", () => {
        expect(canMessageTarget(mockHRStaff[0], mockOwner)).toBe(true);
      });

      it("should allow HR to message other HR", () => {
        expect(canMessageTarget(mockHRStaff[0], mockHRStaff[1])).toBe(true);
      });

      it("should deny messaging self", () => {
        expect(canMessageTarget(mockHRStaff[0], mockHRStaff[0])).toBe(false);
      });

      it("should deny HR to message cleaner", () => {
        expect(canMessageTarget(mockHRStaff[0], { id: 10, type: "cleaner" })).toBe(false);
      });
    });
  });

  // ============================================
  // FORM VALIDATION
  // ============================================
  describe("Custom Group Form Validation", () => {
    const validateGroupForm = (title, memberIds) => {
      const errors = {};

      if (title && title.length > 50) {
        errors.title = "Title must be 50 characters or less";
      }

      if (!memberIds || memberIds.length === 0) {
        errors.members = "Select at least one member";
      }

      return {
        valid: Object.keys(errors).length === 0,
        errors,
      };
    };

    it("should pass with valid inputs", () => {
      const result = validateGroupForm("My Team", [2, 3]);
      expect(result.valid).toBe(true);
    });

    it("should pass with no title (auto-generated)", () => {
      const result = validateGroupForm("", [2, 3]);
      expect(result.valid).toBe(true);
    });

    it("should fail with long title", () => {
      const longTitle = "A".repeat(51);
      const result = validateGroupForm(longTitle, [2, 3]);
      expect(result.valid).toBe(false);
      expect(result.errors.title).toBeDefined();
    });

    it("should fail with no members", () => {
      const result = validateGroupForm("Team", []);
      expect(result.valid).toBe(false);
      expect(result.errors.members).toBeDefined();
    });
  });

  // ============================================
  // CONVERSATION STATE MANAGEMENT
  // ============================================
  describe("Conversation State Management", () => {
    const createInitialState = () => ({
      conversations: [],
      loading: true,
      error: null,
      selectedConversation: null,
      searchQuery: "",
      selectedMembers: [],
    });

    const reducer = (state, action) => {
      switch (action.type) {
        case "SET_CONVERSATIONS":
          return { ...state, conversations: action.payload, loading: false };
        case "SET_LOADING":
          return { ...state, loading: action.payload };
        case "SET_ERROR":
          return { ...state, error: action.payload, loading: false };
        case "SELECT_CONVERSATION":
          return { ...state, selectedConversation: action.payload };
        case "SET_SEARCH_QUERY":
          return { ...state, searchQuery: action.payload };
        case "TOGGLE_MEMBER":
          const { selectedMembers } = state;
          const memberId = action.payload;
          const isSelected = selectedMembers.includes(memberId);
          return {
            ...state,
            selectedMembers: isSelected
              ? selectedMembers.filter((id) => id !== memberId)
              : [...selectedMembers, memberId],
          };
        case "CLEAR_MEMBERS":
          return { ...state, selectedMembers: [] };
        case "ADD_CONVERSATION":
          return {
            ...state,
            conversations: [action.payload, ...state.conversations],
          };
        case "UPDATE_UNREAD":
          return {
            ...state,
            conversations: state.conversations.map((c) =>
              c.id === action.payload.conversationId
                ? { ...c, unreadCount: action.payload.count }
                : c
            ),
          };
        default:
          return state;
      }
    };

    it("should create initial state", () => {
      const state = createInitialState();
      expect(state.loading).toBe(true);
      expect(state.conversations).toEqual([]);
    });

    it("should handle SET_CONVERSATIONS", () => {
      const state = createInitialState();
      const newState = reducer(state, {
        type: "SET_CONVERSATIONS",
        payload: mockConversations,
      });
      expect(newState.conversations).toHaveLength(2);
      expect(newState.loading).toBe(false);
    });

    it("should handle SELECT_CONVERSATION", () => {
      const state = createInitialState();
      const newState = reducer(state, {
        type: "SELECT_CONVERSATION",
        payload: mockConversations[0],
      });
      expect(newState.selectedConversation.id).toBe(100);
    });

    it("should handle SET_SEARCH_QUERY", () => {
      const state = createInitialState();
      const newState = reducer(state, {
        type: "SET_SEARCH_QUERY",
        payload: "jane",
      });
      expect(newState.searchQuery).toBe("jane");
    });

    it("should handle TOGGLE_MEMBER - add", () => {
      const state = createInitialState();
      const newState = reducer(state, {
        type: "TOGGLE_MEMBER",
        payload: 2,
      });
      expect(newState.selectedMembers).toContain(2);
    });

    it("should handle TOGGLE_MEMBER - remove", () => {
      const state = { ...createInitialState(), selectedMembers: [2, 3] };
      const newState = reducer(state, {
        type: "TOGGLE_MEMBER",
        payload: 2,
      });
      expect(newState.selectedMembers).not.toContain(2);
      expect(newState.selectedMembers).toContain(3);
    });

    it("should handle CLEAR_MEMBERS", () => {
      const state = { ...createInitialState(), selectedMembers: [2, 3, 4] };
      const newState = reducer(state, { type: "CLEAR_MEMBERS" });
      expect(newState.selectedMembers).toEqual([]);
    });

    it("should handle ADD_CONVERSATION", () => {
      const state = { ...createInitialState(), conversations: mockConversations };
      const newConvo = { id: 999, title: "New Chat" };
      const newState = reducer(state, {
        type: "ADD_CONVERSATION",
        payload: newConvo,
      });
      expect(newState.conversations[0].id).toBe(999);
      expect(newState.conversations).toHaveLength(3);
    });

    it("should handle UPDATE_UNREAD", () => {
      const state = { ...createInitialState(), conversations: mockConversations };
      const newState = reducer(state, {
        type: "UPDATE_UNREAD",
        payload: { conversationId: 100, count: 10 },
      });
      expect(newState.conversations.find((c) => c.id === 100).unreadCount).toBe(10);
    });
  });

  // ============================================
  // SOCKET EVENT HANDLING
  // ============================================
  describe("Socket Event Handling", () => {
    const handleNewInternalConversation = (event, currentConversations) => {
      const { conversationId, title, initiator, isGroup } = event;

      // Check if already exists
      if (currentConversations.some((c) => c.id === conversationId)) {
        return currentConversations;
      }

      const newConvo = {
        id: conversationId,
        title: title || "New Conversation",
        isGroupChat: isGroup || false,
        unreadCount: 0,
        initiator,
      };

      return [newConvo, ...currentConversations];
    };

    it("should add new conversation from socket event", () => {
      const event = {
        conversationId: 999,
        title: "New Group",
        initiator: { id: 1, username: "owner1" },
        isGroup: true,
      };
      const result = handleNewInternalConversation(event, mockConversations);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(999);
    });

    it("should not duplicate existing conversation", () => {
      const event = {
        conversationId: 100,
        title: "HR Team",
        initiator: { id: 1 },
        isGroup: true,
      };
      const result = handleNewInternalConversation(event, mockConversations);
      expect(result).toHaveLength(2);
    });

    it("should set isGroup correctly", () => {
      const event = { conversationId: 998, isGroup: false };
      const result = handleNewInternalConversation(event, []);
      expect(result[0].isGroupChat).toBe(false);
    });
  });

  // ============================================
  // ERROR HANDLING
  // ============================================
  describe("Error Message Handling", () => {
    const getErrorMessage = (error) => {
      if (!error) return "An unknown error occurred";

      if (typeof error === "string") return error;

      if (error.message) return error.message;

      if (error.error) return error.error;

      return "An unknown error occurred";
    };

    it("should handle string error", () => {
      expect(getErrorMessage("Something went wrong")).toBe("Something went wrong");
    });

    it("should handle error object with message", () => {
      expect(getErrorMessage({ message: "Failed to load" })).toBe("Failed to load");
    });

    it("should handle error object with error field", () => {
      expect(getErrorMessage({ error: "Unauthorized" })).toBe("Unauthorized");
    });

    it("should handle null", () => {
      expect(getErrorMessage(null)).toBe("An unknown error occurred");
    });

    it("should handle empty object", () => {
      expect(getErrorMessage({})).toBe("An unknown error occurred");
    });
  });

  // ============================================
  // LOADING STATES
  // ============================================
  describe("Loading State Management", () => {
    const getLoadingState = (isLoading, isRefreshing, data) => {
      if (isLoading && !data) return "initial";
      if (isRefreshing) return "refreshing";
      if (isLoading) return "updating";
      return "ready";
    };

    it("should return initial for first load", () => {
      expect(getLoadingState(true, false, null)).toBe("initial");
    });

    it("should return refreshing when pull to refresh", () => {
      expect(getLoadingState(false, true, [])).toBe("refreshing");
    });

    it("should return updating when loading with existing data", () => {
      expect(getLoadingState(true, false, [])).toBe("updating");
    });

    it("should return ready when loaded", () => {
      expect(getLoadingState(false, false, [])).toBe("ready");
    });
  });
});
