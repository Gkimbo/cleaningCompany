const reducer = (state, action) => {
  switch (action.type) {
    case "LOGOUT":
      return {
        ...state,
        account: null,
        currentUser: { token: null, id: null, email: null },
        homes: [],
        appointments: [],
        bill: { cancellationFee: 0, totalPaid: 0 },
        requests: [],
        conversations: [],
        currentMessages: [],
        unreadCount: 0,
      };
    case "ERROR":
      return {
        ...state,
        error: action.payload,
      };
    case "CURRENT_USER":
      return {
        ...state,
        currentUser: { ...state.currentUser, token: action.payload },
      };
    case "SET_USER_ID":
      return {
        ...state,
        currentUser: { ...state.currentUser, id: action.payload },
      };
    case "SET_USER_EMAIL":
      return {
        ...state,
        currentUser: { ...state.currentUser, email: action.payload },
      };
    case "UPDATE_USER":
      return {
        ...state,
        currentUser: { ...state.currentUser, user: action.payload },
      };
    case "UPDATE_BILL":
      return {
        ...state,
        bill: { ...state.bill, ...action.payload },
      };
    case "USER_ACCOUNT":
      return {
        ...state,
        account: action.payload,
      };
    case "USER_HOME":
      return {
        ...state,
        homes: action.payload,
      };
    case "USER_APPOINTMENTS":
      return {
        ...state,
        appointments: action.payload,
      };
    case "CLEANING_REQUESTS":
      return {
        ...state,
        requests: action.payload,
      };
    case "UPDATE_REQUEST_STATUS":
      return {
        ...state,
        requests: state.requests.map((request) =>
          request.request.appointmentId === action.payload.appointmentId &&
          request.request.employeeId === action.payload.employeeId
            ? {
                ...request,
                request: { ...request.request, status: action.payload.status },
              }
            : request
        ),
      };
    case "ADD_DATES":
      return {
        ...state,
        appointments: [...state.appointments, ...action.payload],
      };
    case "ADD_HOME":
      return {
        ...state,
        homes: [...state.homes, action.payload],
      };
    case "DELETE_HOME":
      return {
        ...state,
        homes: state.homes.filter((home) => home.id !== action.payload),
      };
    case "UPDATE_HOME":
      const updatedHomes = state.homes.map((home) =>
        home.id === action.payload.id ? action.payload.updatedHome : home
      );
      return { ...state, homes: updatedHomes };
    case "DB_BILL":
      return {
        ...state,
        bill: action.payload,
      };
    case "ADD_FEE":
      return {
        ...state,
        bill: {
          ...state.bill,
          cancellationFee: state.bill.cancellationFee + action.payload,
          totalDue: state.bill.totalDue + action.payload,
        },
      };
    case "SUBTRACT_FEE":
      return {
        ...state,
        bill: {
          ...state.bill,
          cancellationFee: state.bill.cancellationFee - action.payload,
          totalDue: state.bill.totalDue - action.payload,
        },
      };
    case "ADD_BILL":
      return {
        ...state,
        bill: {
          ...state.bill,
          appointmentDue: state.bill.appointmentDue + action.payload,
          totalDue: state.bill.totalDue + action.payload,
        },
      };
    case "SUBTRACT_BILL":
      return {
        ...state,
        bill: {
          ...state.bill,
          appointmentDue: state.bill.appointmentDue - action.payload,
          totalDue: state.bill.totalDue - action.payload,
        },
      };
    // Messaging actions
    case "SET_CONVERSATIONS":
      return {
        ...state,
        conversations: action.payload,
      };
    case "ADD_CONVERSATION":
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
      };
    case "UPDATE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.map((conv) =>
          conv.conversationId === action.payload.conversationId
            ? { ...conv, ...action.payload }
            : conv
        ),
      };
    case "SET_CURRENT_MESSAGES":
      return {
        ...state,
        currentMessages: action.payload,
      };
    case "ADD_MESSAGE":
      return {
        ...state,
        currentMessages: [...state.currentMessages, action.payload],
      };
    case "SET_UNREAD_COUNT":
      return {
        ...state,
        unreadCount: action.payload,
      };
    case "INCREMENT_UNREAD":
      return {
        ...state,
        unreadCount: state.unreadCount + 1,
      };
    case "DECREMENT_UNREAD":
      return {
        ...state,
        unreadCount: Math.max(0, state.unreadCount - action.payload),
      };
    case "UPDATE_CONVERSATION_UNREAD":
      return {
        ...state,
        conversations: state.conversations.map((conv) =>
          conv.conversationId === action.payload.conversationId
            ? { ...conv, unreadCount: action.payload.unreadCount }
            : conv
        ),
      };
    case "REMOVE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.filter(
          (conv) => conv.conversationId !== action.payload
        ),
      };
    case "UPDATE_CONVERSATION_TITLE":
      return {
        ...state,
        conversations: state.conversations.map((conv) =>
          conv.conversationId === action.payload.conversationId
            ? { ...conv, conversation: { ...conv.conversation, title: action.payload.title } }
            : conv
        ),
      };
    case "SET_PENDING_CLEANER_REQUESTS":
      return {
        ...state,
        pendingCleanerRequests: action.payload,
      };
    case "DECREMENT_PENDING_CLEANER_REQUESTS":
      return {
        ...state,
        pendingCleanerRequests: Math.max(0, (state.pendingCleanerRequests || 0) - 1),
      };
    case "SET_PENDING_APPLICATIONS":
      return {
        ...state,
        pendingApplications: action.payload,
      };
    default:
      throw new Error();
  }
};

export default reducer;
