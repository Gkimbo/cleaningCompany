const getCurrentUser = async () => {
	const baseURL = "http://localhost:3000";
	const response = await fetch(`${baseURL}/api/v1/user-sessions/current`, {
		headers: new Headers({
			"Content-Type": "application/json",
			Authorization: `Bearer ${localStorage.getItem("token")}`,
		}),
	});
	if (!response.ok) {
		const errorMessage = `${response.status} (${response.statusText})`;
		const error = new Error(errorMessage);
		throw error;
	}
	const userData = await response.json();
	return userData;
};

export default getCurrentUser;
