/* eslint-disable no-console */
import HttpClient from "../HttpClient";

class Appointment {
  static async addAppointmentToDb(data) {
    const result = await HttpClient.post("/appointments", data, { skipAuth: true });

    if (result.success === false) {
      if (__DEV__) console.warn("[Appointment] addAppointmentToDb failed:", result.error);
      return { success: false, error: result.error || "Failed to add appointment" };
    }

    return { success: true, data: result };
  }

  static async deleteAppointment(id, fee, user) {
    const result = await HttpClient.delete(`/appointments/${id}`, { skipAuth: true, body: { fee, user } });

    if (result.success === false) {
      throw new Error(result.error || "Failed to delete appointment");
    }

    return result;
  }

  static async deleteAppointmentById(id, token) {
    const result = await HttpClient.delete(`/appointments/id/${id}`, { token });

    if (result.success === false) {
      throw new Error(result.error || "Failed to delete appointment");
    }

    return result;
  }

  static async getHomeAppointments(homeId) {
    const result = await HttpClient.get(`/appointments/${homeId}`, { skipAuth: true });

    if (result.success === false) {
      throw new Error("No data received");
    }

    return result;
  }

  static async getHomeInfo(homeId, token) {
    const result = await HttpClient.get(`/appointments/home/${homeId}`, { token });

    if (result.success === false) {
      throw new Error("No data received");
    }

    return result;
  }

  static async updateSheetsAppointments(value, appointmentId) {
    const result = await HttpClient.patch(`/appointments/${appointmentId}`, { bringSheets: value, id: appointmentId }, { skipAuth: true });

    if (result.success === false) {
      throw new Error("No data received");
    }

    return result;
  }

  static async updateTowelsAppointments(value, appointmentId) {
    const result = await HttpClient.patch(`/appointments/${appointmentId}`, { bringTowels: value, id: appointmentId }, { skipAuth: true });

    if (result.success === false) {
      throw new Error("No data received");
    }

    return result;
  }

  static async updateCodeAppointments(value, appointmentId) {
    const result = await HttpClient.patch(`/appointments/${appointmentId}`, { keyPadCode: value, id: appointmentId }, { skipAuth: true });

    if (result.success === false) {
      throw new Error("No data received");
    }

    return result;
  }

  static async updateKeyAppointments(value, appointmentId) {
    const result = await HttpClient.patch(`/appointments/${appointmentId}`, { keyLocation: value, id: appointmentId }, { skipAuth: true });

    if (result.success === false) {
      throw new Error("No data received");
    }

    return result;
  }

  static async updateAppointmentLinens(appointmentId, data, token) {
    const result = await HttpClient.patch(`/appointments/${appointmentId}/linens`, data, { token });

    if (result.success === false) {
      throw new Error(result.error || "Failed to update linens");
    }

    return result;
  }
}

export default Appointment;
