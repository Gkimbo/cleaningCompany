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
		default:
			throw new Error();
	}
};

export default reducer;
