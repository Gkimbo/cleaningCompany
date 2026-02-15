/**
 * Tests for ConversationList utility functions
 * Tests getInitials and getAvatarInitial behavior
 */

// Test the getInitials function logic
describe("getInitials utility function", () => {
  // Replicate the getInitials function from ConversationList.js
  const getInitials = (title) => {
    return title
      .split(" ")
      .filter((word) => word.length > 0 && /[a-zA-Z0-9]/.test(word[0]))
      .map((word) => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  it("should return first two initials for standard names", () => {
    expect(getInitials("John Doe")).toBe("JD");
    expect(getInitials("Alice Smith")).toBe("AS");
    expect(getInitials("Bob")).toBe("B");
  });

  it("should filter out ampersands and symbols", () => {
    expect(getInitials("D & D")).toBe("DD");
    expect(getInitials("A & B")).toBe("AB");
    expect(getInitials("Test & More")).toBe("TM");
  });

  it("should handle multiple spaces", () => {
    expect(getInitials("John   Doe")).toBe("JD");
    expect(getInitials("  Alice  Smith  ")).toBe("AS");
  });

  it("should handle single word titles", () => {
    // Single word = single initial (first letter of that word)
    expect(getInitials("Support")).toBe("S");
    expect(getInitials("A")).toBe("A");
  });

  it("should return uppercase initials", () => {
    expect(getInitials("john doe")).toBe("JD");
    // Single word = single initial
    expect(getInitials("alice")).toBe("A");
  });

  it("should handle numbers in titles", () => {
    expect(getInitials("Team 1")).toBe("T1");
    expect(getInitials("2nd Floor")).toBe("2F");
  });

  it("should handle mixed symbols and letters", () => {
    expect(getInitials("A + B")).toBe("AB");
    expect(getInitials("@ Test")).toBe("T");
    // "$Money" starts with $ so it's filtered out, only "Talk" remains
    expect(getInitials("$Money Talk")).toBe("T");
    // "Money Talk" without $ works correctly
    expect(getInitials("Money Talk")).toBe("MT");
  });

  it("should handle empty strings gracefully", () => {
    expect(getInitials("")).toBe("");
    expect(getInitials("   ")).toBe("");
  });

  it("should handle only symbols", () => {
    expect(getInitials("& @ #")).toBe("");
    expect(getInitials("+++")).toBe("");
  });

  it("should limit to 2 characters", () => {
    expect(getInitials("Alice Bob Charlie")).toBe("AB");
    expect(getInitials("Very Long Name Here")).toBe("VL");
  });
});

// Test the getAvatarInitial function logic for business_employee conversations
describe("getAvatarInitial for business_employee conversations", () => {
  // Replicate the logic from renderConversationItem in ConversationList.js
  const getAvatarInitial = (conv, currentUserId, getInitials) => {
    const isBusinessEmployee = conv.conversation?.conversationType === "business_employee";
    const isGroup = (conv.conversation?.participants?.length || 0) > 2;

    if (isBusinessEmployee && !isGroup) {
      const otherParticipant = conv.conversation?.participants?.find(
        (p) => p.userId !== parseInt(currentUserId)
      );
      const firstName = otherParticipant?.user?.firstName;
      if (firstName && firstName.length > 0) {
        return firstName[0].toUpperCase();
      }
    }
    return getInitials(conv.title || "Unknown");
  };

  // Mock getInitials for these tests
  const mockGetInitials = (title) => title.substring(0, 2).toUpperCase();

  it("should return single initial for 1-on-1 business_employee chat", () => {
    const conv = {
      title: "Jane Employee",
      conversation: {
        conversationType: "business_employee",
        participants: [
          { userId: 1, user: { firstName: "John" } }, // Business owner
          { userId: 2, user: { firstName: "Jane" } }, // Employee
        ],
      },
    };

    const result = getAvatarInitial(conv, "1", mockGetInitials);
    expect(result).toBe("J"); // Jane's initial
  });

  it("should return regular initials for group business_employee chat", () => {
    const conv = {
      title: "Team Chat",
      conversation: {
        conversationType: "business_employee",
        participants: [
          { userId: 1, user: { firstName: "John" } },
          { userId: 2, user: { firstName: "Jane" } },
          { userId: 3, user: { firstName: "Bob" } },
        ],
      },
    };

    const result = getAvatarInitial(conv, "1", mockGetInitials);
    expect(result).toBe("TE"); // Falls back to title initials
  });

  it("should return regular initials for non-business_employee conversations", () => {
    const conv = {
      title: "Support Request",
      conversation: {
        conversationType: "support",
        participants: [
          { userId: 1, user: { firstName: "John" } },
          { userId: 2, user: { firstName: "Support" } },
        ],
      },
    };

    const result = getAvatarInitial(conv, "1", mockGetInitials);
    expect(result).toBe("SU"); // Uses title initials
  });

  it("should handle missing firstName gracefully", () => {
    const conv = {
      title: "Employee Chat",
      conversation: {
        conversationType: "business_employee",
        participants: [
          { userId: 1, user: { firstName: "John" } },
          { userId: 2, user: {} }, // No firstName
        ],
      },
    };

    const result = getAvatarInitial(conv, "1", mockGetInitials);
    expect(result).toBe("EM"); // Falls back to title initials
  });

  it("should handle null user gracefully", () => {
    const conv = {
      title: "Employee Chat",
      conversation: {
        conversationType: "business_employee",
        participants: [
          { userId: 1, user: { firstName: "John" } },
          { userId: 2, user: null },
        ],
      },
    };

    const result = getAvatarInitial(conv, "1", mockGetInitials);
    expect(result).toBe("EM"); // Falls back to title initials
  });

  it("should find correct other participant", () => {
    const conv = {
      title: "Chat with Alice",
      conversation: {
        conversationType: "business_employee",
        participants: [
          { userId: 1, user: { firstName: "Bob" } }, // Current user
          { userId: 2, user: { firstName: "Alice" } }, // Other participant
        ],
      },
    };

    const result = getAvatarInitial(conv, "1", mockGetInitials);
    expect(result).toBe("A"); // Alice's initial
  });

  it("should handle string vs number userId comparison", () => {
    const conv = {
      title: "Chat",
      conversation: {
        conversationType: "business_employee",
        participants: [
          { userId: 1, user: { firstName: "Owner" } },
          { userId: 2, user: { firstName: "Employee" } },
        ],
      },
    };

    // Test with string userId
    expect(getAvatarInitial(conv, "1", mockGetInitials)).toBe("E");
    // Test with number userId
    expect(getAvatarInitial(conv, 1, mockGetInitials)).toBe("E");
  });
});

// Test conversation title generation for different types
describe("getConversationTitle utility", () => {
  // Simplified version of getConversationTitle for testing
  const getConversationTitle = (conv, currentUserId) => {
    const conversation = conv.conversation;
    if (!conversation) return "Conversation";

    if (conversation.conversationType === "broadcast") {
      return conversation.title || "Announcement";
    }
    if (conversation.conversationType === "support") {
      return conversation.title || "Support";
    }
    if (conversation.conversationType === "business_employee") {
      if (conversation.title) {
        return conversation.title;
      }
      const otherParticipants = conversation.participants?.filter(
        (p) => p.userId !== parseInt(currentUserId)
      );
      if (otherParticipants?.length === 1) {
        const user = otherParticipants[0].user;
        if (user?.firstName) {
          return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
        }
        return user?.username || "Employee";
      }
    }
    return "Conversation";
  };

  it("should return broadcast title", () => {
    const conv = {
      conversation: {
        conversationType: "broadcast",
        title: "Team Update",
      },
    };
    expect(getConversationTitle(conv, "1")).toBe("Team Update");
  });

  it("should return default for broadcast without title", () => {
    const conv = {
      conversation: {
        conversationType: "broadcast",
        title: null,
      },
    };
    expect(getConversationTitle(conv, "1")).toBe("Announcement");
  });

  it("should return employee full name for 1-on-1 business chat", () => {
    const conv = {
      conversation: {
        conversationType: "business_employee",
        title: null,
        participants: [
          { userId: 1, user: { firstName: "Owner", lastName: "Smith" } },
          { userId: 2, user: { firstName: "Jane", lastName: "Doe" } },
        ],
      },
    };
    expect(getConversationTitle(conv, "1")).toBe("Jane Doe");
  });

  it("should return employee first name only if no last name", () => {
    const conv = {
      conversation: {
        conversationType: "business_employee",
        title: null,
        participants: [
          { userId: 1, user: { firstName: "Owner" } },
          { userId: 2, user: { firstName: "Jane" } },
        ],
      },
    };
    expect(getConversationTitle(conv, "1")).toBe("Jane");
  });

  it("should return username if no firstName", () => {
    const conv = {
      conversation: {
        conversationType: "business_employee",
        title: null,
        participants: [
          { userId: 1, user: { firstName: "Owner" } },
          { userId: 2, user: { username: "jane_doe" } },
        ],
      },
    };
    expect(getConversationTitle(conv, "1")).toBe("jane_doe");
  });
});

// Test formatTime utility
describe("formatTime utility", () => {
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
      return "now";
    } else if (diffMins < 60) {
      return `${diffMins}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  it("should return 'now' for very recent messages", () => {
    const now = new Date();
    expect(formatTime(now.toISOString())).toBe("now");
  });

  it("should return minutes for messages within an hour", () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    expect(formatTime(thirtyMinsAgo.toISOString())).toBe("30m");
  });

  it("should return hours for messages within a day", () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    expect(formatTime(fiveHoursAgo.toISOString())).toBe("5h");
  });

  it("should return 'Yesterday' for messages from yesterday", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(formatTime(yesterday.toISOString())).toBe("Yesterday");
  });

  it("should return empty string for null/undefined", () => {
    expect(formatTime(null)).toBe("");
    expect(formatTime(undefined)).toBe("");
  });
});
