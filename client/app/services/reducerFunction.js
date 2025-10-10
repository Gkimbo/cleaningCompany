const reducer = (state, action) => {
  switch (action.type) {
    case "ERROR":
      return {
        ...state,
        error: action.payload,
      };
    case "CURRENT_USER":
      return {
        ...state,
        currentUser: { token: action.payload },
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
    default:
      throw new Error();
  }
};

export default reducer;
