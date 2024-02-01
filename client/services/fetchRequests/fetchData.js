/* eslint-disable no-console */
const baseURL = "http://localhost:3000";

class FetchData {
	static async get(url, user) {
		try {
			const response = await fetch(baseURL + url, {
				headers: {
					Authorization: `Bearer ${user}`,
				},
			});
			if (!response.ok) {
				throw new Error("No data received");
			}
			const responseData = await response.json();
			return responseData;
		} catch (error) {
			return error;
		}
	}

	static async login(loginData) {
		try {
			const response = await fetch(baseURL + "/api/v1/user-sessions/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					username: loginData.userName,
					password: loginData.password,
				}),
			});
			if (!response.ok) {
				if (response.status === 401) {
					return "Invalid password";
				} else if (response.status === 404) {
					return "That User Name does not exist, please sign up.";
				} else {
					throw new Error("Failed to login");
				}
			}
			const responseData = await response.json();
			return responseData;
		} catch (error) {
			return error;
		}
	}

	static async makeNewUser(data) {
		try {
			const response = await fetch(baseURL + "/api/v1/users", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					username: data.userName,
					password: data.password,
					email: data.email,
				}),
			});
			if (!response.ok) {
				if (response.status === 409) {
					return "An account already has this email";
				} else if (response.status === 410) {
					return "Username already exists";
				} else {
					throw new Error("Failed to create user");
				}
			}
			const responseData = await response.json();
			return responseData;
		} catch (error) {
			return error;
		}
	}

	static async makeNewEmployee(data) {
		try {
			const response = await fetch(baseURL + "/api/v1/users/new-employee", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					username: data.userName,
					password: data.password,
					email: data.email,
					type: data.type,
				}),
			});
			if (!response.ok) {
				if (response.status === 409) {
					return "An account already has this email";
				} else if (response.status === 410) {
					return "Username already exists";
				} else {
					throw new Error("Failed to create user");
				}
			}
			const responseData = await response.json();
			return responseData;
		} catch (error) {
			return error;
		}
	}
	static async editEmployee(data) {
		try {
			const response = await fetch(baseURL + "/api/v1/users/employee", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					id: data.id,
					username: data.userName,
					password: data.password,
					email: data.email,
					type: data.type,
				}),
			});
			if (!response.ok) {
				if (response.status === 409) {
					return "An account already has this email";
				} else if (response.status === 410) {
					return "Username already exists";
				} else {
					throw new Error("Failed to create user");
				}
			}
			const responseData = await response.json();
			return responseData;
		} catch (error) {
			return error;
		}
	}

	static async updateTimestamp(data) {
		try {
			const response = await fetch(
				baseURL + "/api/v1/user-info/collect-rewards",
				{
					method: "post",
					body: JSON.stringify(data),
					headers: {
						"Content-Type": "application/json",
					},
				}
			);
			if (!response.ok) {
				if (response.status === 401) {
					const responseData = await response.json();
					return responseData;
				}
				const error = new Error(`${response.status}(${response.statusText})`);
				throw error;
			}
			const responseData = await response.json();
			return responseData;
		} catch (err) {
			return err;
		}
	}
	static async addHomeInfo(data) {
		try {
			const response = await fetch(baseURL + "/api/v1/user-info/home", {
				method: "post",
				body: JSON.stringify(data),
				headers: {
					"Content-Type": "application/json",
				},
			});
			if (!response.ok) {
				if (response.status === 400) {
					const responseData = await response.json();
					return responseData;
				}
				const error = new Error(`${response.status}(${response.statusText})`);
				throw error;
			}
			const responseData = await response.json();
			return responseData;
		} catch (err) {
			return err;
		}
	}

	static async editHomeInfo(data) {
		try {
			const response = await fetch(baseURL + "/api/v1/user-info/home", {
				method: "PATCH",
				body: JSON.stringify(data),
				headers: {
					"Content-Type": "application/json",
				},
			});
			if (!response.ok) {
				if (response.status === 400) {
					const responseData = await response.json();
					return responseData;
				}
				const error = new Error(`${response.status}(${response.statusText})`);
				throw error;
			}
			const responseData = await response.json();
			return responseData;
		} catch (err) {
			return err;
		}
	}

	static async deleteHome(id) {
		try {
			const response = await fetch(baseURL + "/api/v1/user-info/home", {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					id,
				}),
			});
			if (!response.ok) {
				throw new Error("Failed to delete");
			}

			const responseData = await response.json();
			return true;
		} catch (error) {
			return error;
		}
	}
	static async deleteEmployee(id) {
		try {
			const response = await fetch(baseURL + "/api/v1/users/employee", {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					id,
				}),
			});
			if (!response.ok) {
				throw new Error("Failed to delete");
			}

			const responseData = await response.json();
			return true;
		} catch (error) {
			return error;
		}
	}
}

export default FetchData;
