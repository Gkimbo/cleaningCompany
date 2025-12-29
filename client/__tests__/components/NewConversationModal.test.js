/**
 * Comprehensive tests for NewConversationModal component
 * Tests staff selection, quick actions, search, and conversation creation
 */

describe("NewConversationModal Component Logic", () => {
  // ============================================
  // MOCK DATA
  // ============================================
  const mockStaff = [
    { id: 1, username: "owner1", firstName: "John", lastName: "Owner", type: "owner" },
    { id: 2, username: "hr1", firstName: "Sarah", lastName: "Smith", type: "humanResources" },
    { id: 3, username: "hr2", firstName: "Mike", lastName: "Johnson", type: "humanResources" },
    { id: 4, username: "hr3", firstName: "Emily", lastName: "Davis", type: "humanResources" },
  ];

  const mockCurrentUser = {
    userId: "1",
    token: "test-token",
  };

  // ============================================
  // DISPLAY NAME FORMATTING
  // ============================================
  describe("Display Name Formatting", () => {
    const getDisplayName = (user) => {
      if (user.firstName || user.lastName) {
        return `${user.firstName || ""} ${user.lastName || ""}`.trim();
      }
      return user.username;
    };

    it("should return full name when both first and last name exist", () => {
      const user = { firstName: "John", lastName: "Doe", username: "johnd" };
      expect(getDisplayName(user)).toBe("John Doe");
    });

    it("should return first name only when no last name", () => {
      const user = { firstName: "John", username: "johnd" };
      expect(getDisplayName(user)).toBe("John");
    });

    it("should return last name only when no first name", () => {
      const user = { lastName: "Doe", username: "johnd" };
      expect(getDisplayName(user)).toBe("Doe");
    });

    it("should return username when no name provided", () => {
      const user = { username: "johnd" };
      expect(getDisplayName(user)).toBe("johnd");
    });

    it("should handle empty strings in names", () => {
      const user = { firstName: "", lastName: "", username: "johnd" };
      expect(getDisplayName(user)).toBe("johnd");
    });
  });

  // ============================================
  // INITIALS GENERATION
  // ============================================
  describe("Initials Generation", () => {
    const getInitials = (user) => {
      const getDisplayName = (u) => {
        if (u.firstName || u.lastName) {
          return `${u.firstName || ""} ${u.lastName || ""}`.trim();
        }
        return u.username;
      };

      const name = getDisplayName(user);
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    };

    it("should return two initials for full name", () => {
      const user = { firstName: "John", lastName: "Doe" };
      expect(getInitials(user)).toBe("JD");
    });

    it("should return one initial for single name", () => {
      const user = { firstName: "John", username: "johnd" };
      expect(getInitials(user)).toBe("J");
    });

    it("should return uppercase initials", () => {
      const user = { firstName: "john", lastName: "doe" };
      expect(getInitials(user)).toBe("JD");
    });

    it("should limit to 2 characters for long names", () => {
      const user = { firstName: "John", lastName: "James Smith" };
      const initials = getInitials(user);
      expect(initials.length).toBeLessThanOrEqual(2);
    });

    it("should handle username only", () => {
      const user = { username: "johndoe" };
      expect(getInitials(user)).toBe("J");
    });
  });

  // ============================================
  // ROLE BADGE LOGIC
  // ============================================
  describe("Role Badge Logic", () => {
    const getRoleBadge = (type) => {
      if (type === "owner") {
        return { label: "Owner", color: "#1d4ed8", bg: "#eff6ff" };
      }
      if (type === "humanResources") {
        return { label: "HR", color: "#7c3aed", bg: "#f5f3ff" };
      }
      return null;
    };

    it("should return Owner badge for owner type", () => {
      const badge = getRoleBadge("owner");
      expect(badge).not.toBeNull();
      expect(badge.label).toBe("Owner");
    });

    it("should return HR badge for humanResources type", () => {
      const badge = getRoleBadge("humanResources");
      expect(badge).not.toBeNull();
      expect(badge.label).toBe("HR");
    });

    it("should return null for cleaner type", () => {
      const badge = getRoleBadge("cleaner");
      expect(badge).toBeNull();
    });

    it("should return null for unknown type", () => {
      const badge = getRoleBadge("unknown");
      expect(badge).toBeNull();
    });

    it("should return null for undefined type", () => {
      const badge = getRoleBadge(undefined);
      expect(badge).toBeNull();
    });
  });

  // ============================================
  // MEMBER SELECTION
  // ============================================
  describe("Member Selection", () => {
    const toggleMember = (selectedMembers, member) => {
      const exists = selectedMembers.find((m) => m.id === member.id);
      if (exists) {
        return selectedMembers.filter((m) => m.id !== member.id);
      }
      return [...selectedMembers, member];
    };

    it("should add member when not selected", () => {
      const selected = [];
      const member = { id: 1, username: "user1" };
      const result = toggleMember(selected, member);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("should remove member when already selected", () => {
      const member = { id: 1, username: "user1" };
      const selected = [member];
      const result = toggleMember(selected, member);
      expect(result).toHaveLength(0);
    });

    it("should add multiple members", () => {
      let selected = [];
      const member1 = { id: 1, username: "user1" };
      const member2 = { id: 2, username: "user2" };

      selected = toggleMember(selected, member1);
      selected = toggleMember(selected, member2);

      expect(selected).toHaveLength(2);
    });

    it("should remove specific member from multiple", () => {
      const member1 = { id: 1, username: "user1" };
      const member2 = { id: 2, username: "user2" };
      const selected = [member1, member2];

      const result = toggleMember(selected, member1);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("should not affect other members when toggling", () => {
      const member1 = { id: 1, username: "user1" };
      const member2 = { id: 2, username: "user2" };
      const member3 = { id: 3, username: "user3" };
      const selected = [member1, member2];

      const result = toggleMember(selected, member3);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual(member1);
      expect(result).toContainEqual(member2);
      expect(result).toContainEqual(member3);
    });
  });

  // ============================================
  // SEARCH FILTERING
  // ============================================
  describe("Search Filtering", () => {
    const filterStaff = (staff, searchTerm) => {
      if (!searchTerm.trim()) return staff;

      const query = searchTerm.toLowerCase();
      return staff.filter((member) => {
        const fullName = `${member.firstName || ""} ${member.lastName || ""}`.toLowerCase();
        const username = (member.username || "").toLowerCase();
        return fullName.includes(query) || username.includes(query);
      });
    };

    it("should return all staff when search is empty", () => {
      const result = filterStaff(mockStaff, "");
      expect(result).toHaveLength(mockStaff.length);
    });

    it("should filter by first name", () => {
      const result = filterStaff(mockStaff, "Sarah");
      expect(result).toHaveLength(1);
      expect(result[0].firstName).toBe("Sarah");
    });

    it("should filter by last name", () => {
      const result = filterStaff(mockStaff, "Smith");
      expect(result).toHaveLength(1);
      expect(result[0].lastName).toBe("Smith");
    });

    it("should filter by username", () => {
      const result = filterStaff(mockStaff, "hr1");
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe("hr1");
    });

    it("should be case insensitive", () => {
      const result = filterStaff(mockStaff, "SARAH");
      expect(result).toHaveLength(1);
      expect(result[0].firstName).toBe("Sarah");
    });

    it("should match partial names", () => {
      const result = filterStaff(mockStaff, "Jo");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should return empty array when no matches", () => {
      const result = filterStaff(mockStaff, "xyz123");
      expect(result).toHaveLength(0);
    });

    it("should handle whitespace in search", () => {
      const result = filterStaff(mockStaff, "   ");
      expect(result).toHaveLength(mockStaff.length);
    });
  });

  // ============================================
  // ROLE-BASED ACCESS
  // ============================================
  describe("Role-Based Access", () => {
    const canCreateConversation = (account) => {
      return account === "owner" || account === "humanResources";
    };

    const getQuickActions = (account) => {
      if (account === "owner") {
        return ["hr-group"];
      }
      if (account === "humanResources") {
        return ["message-owner"];
      }
      return [];
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

    it("should not allow client to create conversations", () => {
      expect(canCreateConversation("client")).toBe(false);
    });

    it("should show HR group action for owner", () => {
      const actions = getQuickActions("owner");
      expect(actions).toContain("hr-group");
    });

    it("should show message owner action for HR", () => {
      const actions = getQuickActions("humanResources");
      expect(actions).toContain("message-owner");
    });

    it("should show no quick actions for cleaner", () => {
      const actions = getQuickActions("cleaner");
      expect(actions).toHaveLength(0);
    });
  });

  // ============================================
  // CONVERSATION TYPE DETERMINATION
  // ============================================
  describe("Conversation Type Determination", () => {
    const getConversationType = (selectedMembers) => {
      if (selectedMembers.length === 0) return null;
      if (selectedMembers.length === 1) return "direct";
      return "group";
    };

    it("should return null when no members selected", () => {
      expect(getConversationType([])).toBeNull();
    });

    it("should return direct for single member", () => {
      const selected = [{ id: 1 }];
      expect(getConversationType(selected)).toBe("direct");
    });

    it("should return group for multiple members", () => {
      const selected = [{ id: 1 }, { id: 2 }];
      expect(getConversationType(selected)).toBe("group");
    });

    it("should return group for many members", () => {
      const selected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      expect(getConversationType(selected)).toBe("group");
    });
  });

  // ============================================
  // GROUP NAME VALIDATION
  // ============================================
  describe("Group Name Validation", () => {
    const shouldShowGroupNameInput = (selectedMembers) => {
      return selectedMembers.length > 1;
    };

    const validateGroupName = (name) => {
      if (!name || !name.trim()) return { valid: true, name: null };
      const trimmed = name.trim();
      if (trimmed.length > 50) {
        return { valid: false, error: "Group name too long" };
      }
      return { valid: true, name: trimmed };
    };

    it("should show group name input for multiple members", () => {
      expect(shouldShowGroupNameInput([{ id: 1 }, { id: 2 }])).toBe(true);
    });

    it("should not show group name input for single member", () => {
      expect(shouldShowGroupNameInput([{ id: 1 }])).toBe(false);
    });

    it("should not show group name input for no members", () => {
      expect(shouldShowGroupNameInput([])).toBe(false);
    });

    it("should accept empty group name", () => {
      const result = validateGroupName("");
      expect(result.valid).toBe(true);
      expect(result.name).toBeNull();
    });

    it("should trim group name", () => {
      const result = validateGroupName("  Team Chat  ");
      expect(result.valid).toBe(true);
      expect(result.name).toBe("Team Chat");
    });

    it("should reject group name over 50 characters", () => {
      const longName = "a".repeat(51);
      const result = validateGroupName(longName);
      expect(result.valid).toBe(false);
    });
  });

  // ============================================
  // SELECTED MEMBERS DISPLAY
  // ============================================
  describe("Selected Members Display", () => {
    const getSelectedDisplay = (selectedMembers) => {
      if (selectedMembers.length === 0) return { count: 0, names: "" };

      const getDisplayName = (user) => {
        if (user.firstName || user.lastName) {
          return `${user.firstName || ""} ${user.lastName || ""}`.trim();
        }
        return user.username;
      };

      return {
        count: selectedMembers.length,
        names: selectedMembers.map((m) => getDisplayName(m)).join(", "),
      };
    };

    it("should return zero count for empty selection", () => {
      const result = getSelectedDisplay([]);
      expect(result.count).toBe(0);
      expect(result.names).toBe("");
    });

    it("should format single member correctly", () => {
      const selected = [{ id: 1, firstName: "John", lastName: "Doe" }];
      const result = getSelectedDisplay(selected);
      expect(result.count).toBe(1);
      expect(result.names).toBe("John Doe");
    });

    it("should format multiple members with comma separation", () => {
      const selected = [
        { id: 1, firstName: "John", lastName: "Doe" },
        { id: 2, firstName: "Jane", lastName: "Smith" },
      ];
      const result = getSelectedDisplay(selected);
      expect(result.count).toBe(2);
      expect(result.names).toBe("John Doe, Jane Smith");
    });
  });

  // ============================================
  // STAFF LIST SORTING
  // ============================================
  describe("Staff List Sorting", () => {
    const sortStaff = (staff) => {
      const roleOrder = { owner: 0, humanResources: 1, cleaner: 2 };
      return [...staff].sort((a, b) => {
        const orderA = roleOrder[a.type] ?? 99;
        const orderB = roleOrder[b.type] ?? 99;
        if (orderA !== orderB) return orderA - orderB;

        const nameA = `${a.firstName || ""} ${a.lastName || ""}`.trim().toLowerCase();
        const nameB = `${b.firstName || ""} ${b.lastName || ""}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
    };

    it("should sort owner first", () => {
      const staff = [
        { id: 1, firstName: "Sarah", type: "humanResources" },
        { id: 2, firstName: "John", type: "owner" },
      ];
      const sorted = sortStaff(staff);
      expect(sorted[0].type).toBe("owner");
    });

    it("should sort HR before cleaners", () => {
      const staff = [
        { id: 1, firstName: "Mike", type: "cleaner" },
        { id: 2, firstName: "Sarah", type: "humanResources" },
      ];
      const sorted = sortStaff(staff);
      expect(sorted[0].type).toBe("humanResources");
    });

    it("should sort alphabetically within same role", () => {
      const staff = [
        { id: 1, firstName: "Zoe", lastName: "Smith", type: "humanResources" },
        { id: 2, firstName: "Alice", lastName: "Jones", type: "humanResources" },
      ];
      const sorted = sortStaff(staff);
      expect(sorted[0].firstName).toBe("Alice");
    });
  });

  // ============================================
  // MODAL STATE MANAGEMENT
  // ============================================
  describe("Modal State Management", () => {
    const getInitialState = () => ({
      search: "",
      staff: [],
      loading: false,
      selectedMembers: [],
      groupName: "",
      creating: false,
    });

    const resetState = (state) => ({
      ...state,
      search: "",
      selectedMembers: [],
      groupName: "",
    });

    it("should have correct initial state", () => {
      const state = getInitialState();
      expect(state.search).toBe("");
      expect(state.staff).toHaveLength(0);
      expect(state.loading).toBe(false);
      expect(state.selectedMembers).toHaveLength(0);
      expect(state.groupName).toBe("");
      expect(state.creating).toBe(false);
    });

    it("should reset search and selection on close", () => {
      const state = {
        search: "test",
        staff: mockStaff,
        loading: false,
        selectedMembers: [mockStaff[0]],
        groupName: "Test Group",
        creating: false,
      };
      const reset = resetState(state);
      expect(reset.search).toBe("");
      expect(reset.selectedMembers).toHaveLength(0);
      expect(reset.groupName).toBe("");
      expect(reset.staff).toEqual(mockStaff); // Staff should remain
    });
  });

  // ============================================
  // BUTTON STATE
  // ============================================
  describe("Button State", () => {
    const getStartButtonState = (selectedMembers, creating) => {
      if (creating) return { disabled: true, text: "Creating..." };
      if (selectedMembers.length === 0) return { disabled: true, text: "Select members" };
      if (selectedMembers.length === 1) return { disabled: false, text: "Start Chat" };
      return { disabled: false, text: "Create Group" };
    };

    it("should be disabled when creating", () => {
      const state = getStartButtonState([{ id: 1 }], true);
      expect(state.disabled).toBe(true);
      expect(state.text).toBe("Creating...");
    });

    it("should be disabled with no selection", () => {
      const state = getStartButtonState([], false);
      expect(state.disabled).toBe(true);
    });

    it("should show Start Chat for single member", () => {
      const state = getStartButtonState([{ id: 1 }], false);
      expect(state.disabled).toBe(false);
      expect(state.text).toBe("Start Chat");
    });

    it("should show Create Group for multiple members", () => {
      const state = getStartButtonState([{ id: 1 }, { id: 2 }], false);
      expect(state.disabled).toBe(false);
      expect(state.text).toBe("Create Group");
    });
  });

  // ============================================
  // ACCESSIBILITY
  // ============================================
  describe("Accessibility", () => {
    const getAccessibilityLabel = (member, isSelected) => {
      const name = `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.username;
      const role = member.type === "owner" ? "Owner" : member.type === "humanResources" ? "HR" : "";
      const selectedState = isSelected ? "Selected" : "Not selected";
      return `${name}${role ? `, ${role}` : ""}. ${selectedState}. Double tap to toggle.`;
    };

    it("should include name in accessibility label", () => {
      const member = { firstName: "John", lastName: "Doe", type: "humanResources" };
      const label = getAccessibilityLabel(member, false);
      expect(label).toContain("John Doe");
    });

    it("should include role in accessibility label", () => {
      const member = { firstName: "John", type: "owner" };
      const label = getAccessibilityLabel(member, false);
      expect(label).toContain("Owner");
    });

    it("should indicate selected state", () => {
      const member = { firstName: "John", type: "humanResources" };
      const selectedLabel = getAccessibilityLabel(member, true);
      const unselectedLabel = getAccessibilityLabel(member, false);
      expect(selectedLabel).toContain("Selected");
      expect(unselectedLabel).toContain("Not selected");
    });
  });
});
