import reducer from "../../src/services/reducerFunction";

describe("Reducer Function", () => {
  const initialState = {
    account: "cleaner",
    currentUser: { token: "test_token", id: 5, email: "test@example.com" },
    homes: [{ id: 1, name: "Home 1" }],
    appointments: [{ id: 1, date: "2025-01-15" }],
    bill: { cancellationFee: 50, totalPaid: 100, totalDue: 150 },
    requests: [{ id: 1, status: "pending" }],
    conversations: [{ conversationId: 1, title: "Test" }],
    currentMessages: [{ id: 1, content: "Hello" }],
    unreadCount: 3,
  };

  describe("LOGOUT action", () => {
    it("should clear all user-related state on logout", () => {
      const newState = reducer(initialState, { type: "LOGOUT" });

      expect(newState.account).toBeNull();
      expect(newState.currentUser.token).toBeNull();
      expect(newState.currentUser.id).toBeNull();
      expect(newState.currentUser.email).toBeNull();
      expect(newState.homes).toEqual([]);
      expect(newState.appointments).toEqual([]);
      expect(newState.bill.cancellationFee).toBe(0);
      expect(newState.bill.totalPaid).toBe(0);
      expect(newState.requests).toEqual([]);
      expect(newState.conversations).toEqual([]);
      expect(newState.currentMessages).toEqual([]);
      expect(newState.unreadCount).toBe(0);
    });

    it("should reset bill to default values", () => {
      const newState = reducer(initialState, { type: "LOGOUT" });

      expect(newState.bill).toEqual({ cancellationFee: 0, totalPaid: 0 });
    });

    it("should reset currentUser object completely", () => {
      const newState = reducer(initialState, { type: "LOGOUT" });

      expect(newState.currentUser).toEqual({ token: null, id: null, email: null });
    });
  });

  describe("SET_USER_ID action", () => {
    it("should set user ID while preserving other currentUser fields", () => {
      const state = {
        ...initialState,
        currentUser: { token: "existing_token", id: null, email: "user@test.com" },
      };

      const newState = reducer(state, { type: "SET_USER_ID", payload: 42 });

      expect(newState.currentUser.id).toBe(42);
      expect(newState.currentUser.token).toBe("existing_token");
      expect(newState.currentUser.email).toBe("user@test.com");
    });

    it("should handle setting user ID on fresh state", () => {
      const state = {
        ...initialState,
        currentUser: { token: null, id: null, email: null },
      };

      const newState = reducer(state, { type: "SET_USER_ID", payload: 1 });

      expect(newState.currentUser.id).toBe(1);
    });
  });

  describe("SET_USER_EMAIL action", () => {
    it("should set user email while preserving other currentUser fields", () => {
      const state = {
        ...initialState,
        currentUser: { token: "token123", id: 5, email: null },
      };

      const newState = reducer(state, { type: "SET_USER_EMAIL", payload: "new@email.com" });

      expect(newState.currentUser.email).toBe("new@email.com");
      expect(newState.currentUser.token).toBe("token123");
      expect(newState.currentUser.id).toBe(5);
    });
  });

  describe("CURRENT_USER action", () => {
    it("should set token while preserving other currentUser fields", () => {
      const state = {
        ...initialState,
        currentUser: { token: null, id: 10, email: "test@test.com" },
      };

      const newState = reducer(state, { type: "CURRENT_USER", payload: "new_jwt_token" });

      expect(newState.currentUser.token).toBe("new_jwt_token");
      expect(newState.currentUser.id).toBe(10);
      expect(newState.currentUser.email).toBe("test@test.com");
    });
  });

  describe("USER_ACCOUNT action", () => {
    it("should set account type", () => {
      const state = { ...initialState, account: null };

      const newState = reducer(state, { type: "USER_ACCOUNT", payload: "owner" });

      expect(newState.account).toBe("owner");
    });

    it("should update account type from one type to another", () => {
      const state = { ...initialState, account: "cleaner" };

      const newState = reducer(state, { type: "USER_ACCOUNT", payload: "humanResources" });

      expect(newState.account).toBe("humanResources");
    });
  });

  describe("Bill actions", () => {
    describe("ADD_FEE", () => {
      it("should add to cancellation fee and totalDue", () => {
        const state = {
          ...initialState,
          bill: { cancellationFee: 25, totalDue: 100, totalPaid: 50 },
        };

        const newState = reducer(state, { type: "ADD_FEE", payload: 15 });

        expect(newState.bill.cancellationFee).toBe(40);
        expect(newState.bill.totalDue).toBe(115);
      });
    });

    describe("SUBTRACT_FEE", () => {
      it("should subtract from cancellation fee and totalDue", () => {
        const state = {
          ...initialState,
          bill: { cancellationFee: 50, totalDue: 150, totalPaid: 50 },
        };

        const newState = reducer(state, { type: "SUBTRACT_FEE", payload: 25 });

        expect(newState.bill.cancellationFee).toBe(25);
        expect(newState.bill.totalDue).toBe(125);
      });
    });
  });

  describe("Messaging actions", () => {
    describe("SET_UNREAD_COUNT", () => {
      it("should set unread count", () => {
        const state = { ...initialState, unreadCount: 0 };

        const newState = reducer(state, { type: "SET_UNREAD_COUNT", payload: 5 });

        expect(newState.unreadCount).toBe(5);
      });
    });

    describe("INCREMENT_UNREAD", () => {
      it("should increment unread count by 1", () => {
        const state = { ...initialState, unreadCount: 3 };

        const newState = reducer(state, { type: "INCREMENT_UNREAD" });

        expect(newState.unreadCount).toBe(4);
      });
    });

    describe("DECREMENT_UNREAD", () => {
      it("should decrement unread count by payload", () => {
        const state = { ...initialState, unreadCount: 5 };

        const newState = reducer(state, { type: "DECREMENT_UNREAD", payload: 2 });

        expect(newState.unreadCount).toBe(3);
      });

      it("should not go below zero", () => {
        const state = { ...initialState, unreadCount: 1 };

        const newState = reducer(state, { type: "DECREMENT_UNREAD", payload: 5 });

        expect(newState.unreadCount).toBe(0);
      });
    });
  });

  describe("Home actions", () => {
    describe("ADD_HOME", () => {
      it("should add a new home to the list", () => {
        const state = { ...initialState, homes: [{ id: 1 }] };
        const newHome = { id: 2, name: "New Home" };

        const newState = reducer(state, { type: "ADD_HOME", payload: newHome });

        expect(newState.homes).toHaveLength(2);
        expect(newState.homes[1]).toEqual(newHome);
      });
    });

    describe("DELETE_HOME", () => {
      it("should remove a home by id", () => {
        const state = { ...initialState, homes: [{ id: 1 }, { id: 2 }, { id: 3 }] };

        const newState = reducer(state, { type: "DELETE_HOME", payload: 2 });

        expect(newState.homes).toHaveLength(2);
        expect(newState.homes.find((h) => h.id === 2)).toBeUndefined();
      });
    });
  });

  describe("Error handling", () => {
    it("should throw error for unknown action type", () => {
      expect(() => {
        reducer(initialState, { type: "UNKNOWN_ACTION" });
      }).toThrow();
    });
  });
});
