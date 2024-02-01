/* eslint-disable no-console */
const baseURL = "http://localhost:3000";

class Appointment {
	static async addAppointmentToDb(data) {
		try {
			const response = await fetch(baseURL + "/api/v1/appointments", {
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
			return true;
		} catch (err) {
			return err;
		}
	}

	static async deleteAppointment(id, fee, user) {
		try {
			const response = await fetch(baseURL + `/api/v1/appointments/${id}`, {
				body: JSON.stringify({ fee: fee, user: user }),
				method: "delete",
				headers: {
					"Content-Type": "application/json",
				},
			});
			if (!response.ok) {
				if (response.status === 400) {
					const responseData = await response.json();
					throw new Error(`Bad Request: ${JSON.stringify(responseData)}`);
				}
				throw new Error(`${response.status} (${response.statusText})`);
			}
			const responseData = await response.json();
			return responseData;
		} catch (err) {
			console.log(err);
			throw new Error(`Failed to delete appointment: ${err.message}`);
		}
	}

	static async getHomeAppointments(homeId) {
		try {
			const response = await fetch(baseURL + `/api/v1/appointments/${homeId}`);
			if (!response.ok) {
				throw new Error("No data received");
			}
			const responseData = await response.json();
			return responseData;
		} catch (error) {
			return error;
		}
	}

	static async updateSheetsAppointments(value, appointmentId) {
		try {
			const response = await fetch(
				baseURL + `/api/v1/appointments/${appointmentId}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ bringSheets: value, id: appointmentId }),
				}
			);
			if (!response.ok) {
				throw new Error("No data received");
			}
			const responseData = await response.json();
			return responseData;
		} catch (error) {
			return error;
		}
	}

	static async updateTowelsAppointments(value, appointmentId) {
		try {
			const response = await fetch(
				baseURL + `/api/v1/appointments/${appointmentId}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ bringTowels: value, id: appointmentId }),
				}
			);
			if (!response.ok) {
				throw new Error("No data received");
			}
			const responseData = await response.json();
			return responseData;
		} catch (error) {
			return error;
		}
	}
}

export default Appointment;
