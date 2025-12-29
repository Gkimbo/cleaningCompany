import reducer from "../../src/services/reducerFunction";

describe("Reducer Function", () => {
  const initialState = {
    account: null,
    currentUser: { token: null, id: null, email: null },
    bill: { cancellationFee: 0, totalPaid: 0, appointmentDue: 0, totalDue: 0 },
    homes: [],
    appointments: [],
    requests: [],
    error: null,
  };

  describe("ERROR action", () => {
    it("should set error state", () => {
      const action = { type: "ERROR", payload: "Something went wrong" };
      const newState = reducer(initialState, action);

      expect(newState.error).toBe("Something went wrong");
    });
  });

  describe("CURRENT_USER action", () => {
    it("should set current user token", () => {
      const action = { type: "CURRENT_USER", payload: "jwt_token_123" };
      const newState = reducer(initialState, action);

      expect(newState.currentUser.token).toBe("jwt_token_123");
    });

    it("should preserve other currentUser properties", () => {
      const stateWithUser = {
        ...initialState,
        currentUser: { token: null, id: 1, email: "test@example.com" },
      };
      const action = { type: "CURRENT_USER", payload: "new_token" };
      const newState = reducer(stateWithUser, action);

      expect(newState.currentUser.token).toBe("new_token");
      expect(newState.currentUser.id).toBe(1);
      expect(newState.currentUser.email).toBe("test@example.com");
    });
  });

  describe("SET_USER_ID action", () => {
    it("should set user ID", () => {
      const action = { type: "SET_USER_ID", payload: 42 };
      const newState = reducer(initialState, action);

      expect(newState.currentUser.id).toBe(42);
    });
  });

  describe("SET_USER_EMAIL action", () => {
    it("should set user email", () => {
      const action = { type: "SET_USER_EMAIL", payload: "user@example.com" };
      const newState = reducer(initialState, action);

      expect(newState.currentUser.email).toBe("user@example.com");
    });
  });

  describe("UPDATE_BILL action", () => {
    it("should update bill with partial data", () => {
      const action = { type: "UPDATE_BILL", payload: { totalPaid: 150 } };
      const newState = reducer(initialState, action);

      expect(newState.bill.totalPaid).toBe(150);
      expect(newState.bill.cancellationFee).toBe(0);
    });

    it("should merge bill updates", () => {
      const stateWithBill = {
        ...initialState,
        bill: { cancellationFee: 25, totalPaid: 100, appointmentDue: 200 },
      };
      const action = { type: "UPDATE_BILL", payload: { totalPaid: 200 } };
      const newState = reducer(stateWithBill, action);

      expect(newState.bill.totalPaid).toBe(200);
      expect(newState.bill.cancellationFee).toBe(25);
      expect(newState.bill.appointmentDue).toBe(200);
    });
  });

  describe("USER_ACCOUNT action", () => {
    it("should set account type to cleaner", () => {
      const action = { type: "USER_ACCOUNT", payload: "cleaner" };
      const newState = reducer(initialState, action);

      expect(newState.account).toBe("cleaner");
    });

    it("should set account type to owner", () => {
      const action = { type: "USER_ACCOUNT", payload: "owner1" };
      const newState = reducer(initialState, action);

      expect(newState.account).toBe("owner1");
    });
  });

  describe("USER_HOME action", () => {
    it("should set homes array", () => {
      const homes = [
        { id: 1, nickName: "Home 1" },
        { id: 2, nickName: "Home 2" },
      ];
      const action = { type: "USER_HOME", payload: homes };
      const newState = reducer(initialState, action);

      expect(newState.homes).toEqual(homes);
      expect(newState.homes.length).toBe(2);
    });
  });

  describe("USER_APPOINTMENTS action", () => {
    it("should set appointments array", () => {
      const appointments = [
        { id: 1, date: "2025-01-15", price: "150" },
        { id: 2, date: "2025-01-20", price: "200" },
      ];
      const action = { type: "USER_APPOINTMENTS", payload: appointments };
      const newState = reducer(initialState, action);

      expect(newState.appointments).toEqual(appointments);
      expect(newState.appointments.length).toBe(2);
    });
  });

  describe("CLEANING_REQUESTS action", () => {
    it("should set requests array", () => {
      const requests = [
        { id: 1, status: "pending" },
        { id: 2, status: "approved" },
      ];
      const action = { type: "CLEANING_REQUESTS", payload: requests };
      const newState = reducer(initialState, action);

      expect(newState.requests).toEqual(requests);
    });
  });

  describe("UPDATE_REQUEST_STATUS action", () => {
    it("should update specific request status", () => {
      const stateWithRequests = {
        ...initialState,
        requests: [
          { request: { appointmentId: 1, employeeId: 2, status: "pending" } },
          { request: { appointmentId: 3, employeeId: 4, status: "pending" } },
        ],
      };
      const action = {
        type: "UPDATE_REQUEST_STATUS",
        payload: { appointmentId: 1, employeeId: 2, status: "approved" },
      };
      const newState = reducer(stateWithRequests, action);

      expect(newState.requests[0].request.status).toBe("approved");
      expect(newState.requests[1].request.status).toBe("pending");
    });
  });

  describe("ADD_DATES action", () => {
    it("should add new appointments to existing array", () => {
      const stateWithAppointments = {
        ...initialState,
        appointments: [{ id: 1, date: "2025-01-15" }],
      };
      const newAppointments = [
        { id: 2, date: "2025-01-20" },
        { id: 3, date: "2025-01-25" },
      ];
      const action = { type: "ADD_DATES", payload: newAppointments };
      const newState = reducer(stateWithAppointments, action);

      expect(newState.appointments.length).toBe(3);
      expect(newState.appointments[2].date).toBe("2025-01-25");
    });
  });

  describe("DELETE_HOME action", () => {
    it("should remove home by ID", () => {
      const stateWithHomes = {
        ...initialState,
        homes: [
          { id: 1, nickName: "Home 1" },
          { id: 2, nickName: "Home 2" },
          { id: 3, nickName: "Home 3" },
        ],
      };
      const action = { type: "DELETE_HOME", payload: 2 };
      const newState = reducer(stateWithHomes, action);

      expect(newState.homes.length).toBe(2);
      expect(newState.homes.find((h) => h.id === 2)).toBeUndefined();
    });
  });

  describe("UPDATE_HOME action", () => {
    it("should update home by ID", () => {
      const stateWithHomes = {
        ...initialState,
        homes: [
          { id: 1, nickName: "Old Name", address: "123 Test St" },
          { id: 2, nickName: "Another Home", address: "456 Main St" },
        ],
      };
      const action = {
        type: "UPDATE_HOME",
        payload: {
          id: 1,
          updatedHome: { id: 1, nickName: "New Name", address: "789 New St" },
        },
      };
      const newState = reducer(stateWithHomes, action);

      expect(newState.homes[0].nickName).toBe("New Name");
      expect(newState.homes[0].address).toBe("789 New St");
      expect(newState.homes[1].nickName).toBe("Another Home");
    });
  });

  describe("DB_BILL action", () => {
    it("should replace entire bill state", () => {
      const newBill = {
        appointmentDue: 300,
        cancellationFee: 50,
        totalDue: 350,
      };
      const action = { type: "DB_BILL", payload: newBill };
      const newState = reducer(initialState, action);

      expect(newState.bill).toEqual(newBill);
    });
  });

  describe("ADD_FEE action", () => {
    it("should add cancellation fee", () => {
      const stateWithBill = {
        ...initialState,
        bill: { cancellationFee: 25, totalDue: 175 },
      };
      const action = { type: "ADD_FEE", payload: 30 };
      const newState = reducer(stateWithBill, action);

      expect(newState.bill.cancellationFee).toBe(55);
      expect(newState.bill.totalDue).toBe(205);
    });
  });

  describe("SUBTRACT_FEE action", () => {
    it("should subtract cancellation fee", () => {
      const stateWithBill = {
        ...initialState,
        bill: { cancellationFee: 50, totalDue: 200 },
      };
      const action = { type: "SUBTRACT_FEE", payload: 25 };
      const newState = reducer(stateWithBill, action);

      expect(newState.bill.cancellationFee).toBe(25);
      expect(newState.bill.totalDue).toBe(175);
    });
  });

  describe("ADD_BILL action", () => {
    it("should add to appointment due", () => {
      const stateWithBill = {
        ...initialState,
        bill: { appointmentDue: 100, totalDue: 150 },
      };
      const action = { type: "ADD_BILL", payload: 75 };
      const newState = reducer(stateWithBill, action);

      expect(newState.bill.appointmentDue).toBe(175);
      expect(newState.bill.totalDue).toBe(225);
    });
  });

  describe("SUBTRACT_BILL action", () => {
    it("should subtract from appointment due", () => {
      const stateWithBill = {
        ...initialState,
        bill: { appointmentDue: 200, totalDue: 250 },
      };
      const action = { type: "SUBTRACT_BILL", payload: 100 };
      const newState = reducer(stateWithBill, action);

      expect(newState.bill.appointmentDue).toBe(100);
      expect(newState.bill.totalDue).toBe(150);
    });
  });

  describe("Messaging Actions", () => {
    it("should handle SET_CONVERSATIONS action", () => {
      const conversations = [
        { conversationId: 1, title: "Chat 1" },
        { conversationId: 2, title: "Chat 2" },
      ];
      const action = { type: "SET_CONVERSATIONS", payload: conversations };
      const stateWithMessaging = { ...initialState, conversations: [], currentMessages: [], unreadCount: 0 };
      const newState = reducer(stateWithMessaging, action);

      expect(newState.conversations).toEqual(conversations);
    });

    it("should handle ADD_CONVERSATION action", () => {
      const stateWithConvos = {
        ...initialState,
        conversations: [{ conversationId: 1, title: "Existing" }],
        currentMessages: [],
        unreadCount: 0,
      };
      const newConvo = { conversationId: 2, title: "New Chat" };
      const action = { type: "ADD_CONVERSATION", payload: newConvo };
      const newState = reducer(stateWithConvos, action);

      expect(newState.conversations).toHaveLength(2);
      expect(newState.conversations[0]).toEqual(newConvo);
    });

    it("should handle UPDATE_CONVERSATION action", () => {
      const stateWithConvos = {
        ...initialState,
        conversations: [{ conversationId: 1, title: "Old Title" }],
        currentMessages: [],
        unreadCount: 0,
      };
      const action = {
        type: "UPDATE_CONVERSATION",
        payload: { conversationId: 1, title: "New Title" },
      };
      const newState = reducer(stateWithConvos, action);

      expect(newState.conversations[0].title).toBe("New Title");
    });

    it("should handle SET_CURRENT_MESSAGES action", () => {
      const messages = [{ id: 1, content: "Hello" }];
      const stateWithMessaging = { ...initialState, conversations: [], currentMessages: [], unreadCount: 0 };
      const action = { type: "SET_CURRENT_MESSAGES", payload: messages };
      const newState = reducer(stateWithMessaging, action);

      expect(newState.currentMessages).toEqual(messages);
    });

    it("should handle ADD_MESSAGE action", () => {
      const stateWithMessages = {
        ...initialState,
        conversations: [],
        currentMessages: [{ id: 1, content: "Hello" }],
        unreadCount: 0,
      };
      const newMessage = { id: 2, content: "World" };
      const action = { type: "ADD_MESSAGE", payload: newMessage };
      const newState = reducer(stateWithMessages, action);

      expect(newState.currentMessages).toHaveLength(2);
    });

    it("should handle SET_UNREAD_COUNT action", () => {
      const stateWithMessaging = { ...initialState, conversations: [], currentMessages: [], unreadCount: 0 };
      const action = { type: "SET_UNREAD_COUNT", payload: 5 };
      const newState = reducer(stateWithMessaging, action);

      expect(newState.unreadCount).toBe(5);
    });

    it("should handle INCREMENT_UNREAD action", () => {
      const stateWithUnread = { ...initialState, conversations: [], currentMessages: [], unreadCount: 3 };
      const action = { type: "INCREMENT_UNREAD" };
      const newState = reducer(stateWithUnread, action);

      expect(newState.unreadCount).toBe(4);
    });

    it("should handle DECREMENT_UNREAD action", () => {
      const stateWithUnread = { ...initialState, conversations: [], currentMessages: [], unreadCount: 3 };
      const action = { type: "DECREMENT_UNREAD", payload: 2 };
      const newState = reducer(stateWithUnread, action);

      expect(newState.unreadCount).toBe(1);
    });

    it("should not go below 0 for DECREMENT_UNREAD", () => {
      const stateWithUnread = { ...initialState, conversations: [], currentMessages: [], unreadCount: 1 };
      const action = { type: "DECREMENT_UNREAD", payload: 5 };
      const newState = reducer(stateWithUnread, action);

      expect(newState.unreadCount).toBe(0);
    });

    it("should handle UPDATE_CONVERSATION_UNREAD action", () => {
      const stateWithConvos = {
        ...initialState,
        conversations: [{ conversationId: 1, unreadCount: 5 }],
        currentMessages: [],
        unreadCount: 5,
      };
      const action = {
        type: "UPDATE_CONVERSATION_UNREAD",
        payload: { conversationId: 1, unreadCount: 0 },
      };
      const newState = reducer(stateWithConvos, action);

      expect(newState.conversations[0].unreadCount).toBe(0);
    });

    it("should handle REMOVE_CONVERSATION action", () => {
      const stateWithConvos = {
        ...initialState,
        conversations: [
          { conversationId: 1, title: "Chat 1" },
          { conversationId: 2, title: "Chat 2" },
          { conversationId: 3, title: "Chat 3" },
        ],
        currentMessages: [],
        unreadCount: 0,
      };
      const action = {
        type: "REMOVE_CONVERSATION",
        payload: 2,  // Just the conversationId, not an object
      };
      const newState = reducer(stateWithConvos, action);

      expect(newState.conversations).toHaveLength(2);
      expect(newState.conversations.find((c) => c.conversationId === 2)).toBeUndefined();
      expect(newState.conversations[0].conversationId).toBe(1);
      expect(newState.conversations[1].conversationId).toBe(3);
    });

    it("should handle REMOVE_CONVERSATION when conversation does not exist", () => {
      const stateWithConvos = {
        ...initialState,
        conversations: [
          { conversationId: 1, title: "Chat 1" },
        ],
        currentMessages: [],
        unreadCount: 0,
      };
      const action = {
        type: "REMOVE_CONVERSATION",
        payload: 999,  // Just the conversationId
      };
      const newState = reducer(stateWithConvos, action);

      expect(newState.conversations).toHaveLength(1);
    });

    it("should handle UPDATE_CONVERSATION_TITLE action", () => {
      const stateWithConvos = {
        ...initialState,
        conversations: [
          {
            conversationId: 1,
            conversation: { id: 1, title: "Old Title" }
          },
          {
            conversationId: 2,
            conversation: { id: 2, title: "Another Chat" }
          },
        ],
        currentMessages: [],
        unreadCount: 0,
      };
      const action = {
        type: "UPDATE_CONVERSATION_TITLE",
        payload: { conversationId: 1, title: "New Title" },
      };
      const newState = reducer(stateWithConvos, action);

      expect(newState.conversations[0].conversation.title).toBe("New Title");
      expect(newState.conversations[1].conversation.title).toBe("Another Chat");
    });

    it("should handle UPDATE_CONVERSATION_TITLE when conversation does not exist", () => {
      const stateWithConvos = {
        ...initialState,
        conversations: [
          {
            conversationId: 1,
            conversation: { id: 1, title: "Chat 1" }
          },
        ],
        currentMessages: [],
        unreadCount: 0,
      };
      const action = {
        type: "UPDATE_CONVERSATION_TITLE",
        payload: { conversationId: 999, title: "New Title" },
      };
      const newState = reducer(stateWithConvos, action);

      expect(newState.conversations).toHaveLength(1);
      expect(newState.conversations[0].conversation.title).toBe("Chat 1");
    });

  });

  describe("Pending Cleaner Requests Actions", () => {
    it("should handle SET_PENDING_CLEANER_REQUESTS action", () => {
      const stateWithPending = { ...initialState, pendingCleanerRequests: 0 };
      const action = { type: "SET_PENDING_CLEANER_REQUESTS", payload: 5 };
      const newState = reducer(stateWithPending, action);

      expect(newState.pendingCleanerRequests).toBe(5);
    });

    it("should set pendingCleanerRequests to zero", () => {
      const stateWithPending = { ...initialState, pendingCleanerRequests: 10 };
      const action = { type: "SET_PENDING_CLEANER_REQUESTS", payload: 0 };
      const newState = reducer(stateWithPending, action);

      expect(newState.pendingCleanerRequests).toBe(0);
    });

    it("should preserve other state properties when setting pending requests", () => {
      const stateWithData = {
        ...initialState,
        account: "owner1",
        pendingCleanerRequests: 0,
      };
      const action = { type: "SET_PENDING_CLEANER_REQUESTS", payload: 3 };
      const newState = reducer(stateWithData, action);

      expect(newState.pendingCleanerRequests).toBe(3);
      expect(newState.account).toBe("owner1");
    });

    it("should handle DECREMENT_PENDING_CLEANER_REQUESTS action", () => {
      const stateWithPending = { ...initialState, pendingCleanerRequests: 5 };
      const action = { type: "DECREMENT_PENDING_CLEANER_REQUESTS" };
      const newState = reducer(stateWithPending, action);

      expect(newState.pendingCleanerRequests).toBe(4);
    });

    it("should not go below zero when decrementing", () => {
      const stateWithPending = { ...initialState, pendingCleanerRequests: 0 };
      const action = { type: "DECREMENT_PENDING_CLEANER_REQUESTS" };
      const newState = reducer(stateWithPending, action);

      expect(newState.pendingCleanerRequests).toBe(0);
    });

    it("should handle undefined pendingCleanerRequests when decrementing", () => {
      const action = { type: "DECREMENT_PENDING_CLEANER_REQUESTS" };
      const newState = reducer(initialState, action);

      expect(newState.pendingCleanerRequests).toBe(0);
    });

    it("should correctly decrement from 1 to 0", () => {
      const stateWithPending = { ...initialState, pendingCleanerRequests: 1 };
      const action = { type: "DECREMENT_PENDING_CLEANER_REQUESTS" };
      const newState = reducer(stateWithPending, action);

      expect(newState.pendingCleanerRequests).toBe(0);
    });

    it("should handle set then decrement sequence", () => {
      let state = { ...initialState, pendingCleanerRequests: 0 };

      // Set to 3
      state = reducer(state, { type: "SET_PENDING_CLEANER_REQUESTS", payload: 3 });
      expect(state.pendingCleanerRequests).toBe(3);

      // Decrement to 2
      state = reducer(state, { type: "DECREMENT_PENDING_CLEANER_REQUESTS" });
      expect(state.pendingCleanerRequests).toBe(2);

      // Decrement to 1
      state = reducer(state, { type: "DECREMENT_PENDING_CLEANER_REQUESTS" });
      expect(state.pendingCleanerRequests).toBe(1);

      // Decrement to 0
      state = reducer(state, { type: "DECREMENT_PENDING_CLEANER_REQUESTS" });
      expect(state.pendingCleanerRequests).toBe(0);

      // Try to decrement below 0
      state = reducer(state, { type: "DECREMENT_PENDING_CLEANER_REQUESTS" });
      expect(state.pendingCleanerRequests).toBe(0);
    });
  });

  describe("Unknown action", () => {
    it("should throw error for unknown action type", () => {
      const action = { type: "UNKNOWN_ACTION", payload: {} };

      expect(() => reducer(initialState, action)).toThrow();
    });
  });
});
