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
		case "DELETE_HOME":
			return {
				...state,
				homes: state.homes.filter((home) => home.id !== action.payload),
			};
		default:
			throw new Error();
	}
};

export default reducer;
