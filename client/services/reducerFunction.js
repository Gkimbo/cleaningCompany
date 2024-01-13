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
		default:
			throw new Error();
	}
};

export default reducer;
