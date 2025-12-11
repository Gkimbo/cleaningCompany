import reducer from "../../app/services/reducerFunction";

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

    it("should set account type to manager", () => {
      const action = { type: "USER_ACCOUNT", payload: "manager1" };
      const newState = reducer(initialState, action);

      expect(newState.account).toBe("manager1");
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

  describe("Unknown action", () => {
    it("should throw error for unknown action type", () => {
      const action = { type: "UNKNOWN_ACTION", payload: {} };

      expect(() => reducer(initialState, action)).toThrow();
    });
  });
});
