// Mock HttpClient
jest.mock("../../src/services/HttpClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import HttpClient from "../../src/services/HttpClient";
import Appointment from "../../src/services/fetchRequests/AppointmentClass";

describe("Appointment Service", () => {
  const mockToken = "test-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addAppointmentToDb", () => {
    const validAppointmentData = {
      token: mockToken,
      homeId: 1,
      dateArray: [
        {
          date: "2025-01-15",
          bringTowels: "no",
          bringSheets: "no",
          paid: false,
        },
      ],
      keyPadCode: "1234",
      keyLocation: "Under mat",
    };

    it("should create appointments successfully", async () => {
      HttpClient.post.mockResolvedValueOnce({ appointments: [{ id: 1 }] });

      const result = await Appointment.addAppointmentToDb(validAppointmentData);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/appointments",
        validAppointmentData,
        { skipAuth: true }
      );
      expect(result.success).toBe(true);
      expect(result.data.appointments).toHaveLength(1);
    });

    it("should return error data on 400 response", async () => {
      HttpClient.post.mockResolvedValueOnce({
        success: false,
        status: 400,
        error: "Invalid date format",
      });

      const result = await Appointment.addAppointmentToDb(validAppointmentData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid date format");
    });

    it("should return error on server error", async () => {
      HttpClient.post.mockResolvedValueOnce({
        success: false,
        status: 500,
        error: "500 Internal Server Error",
      });

      const result = await Appointment.addAppointmentToDb(validAppointmentData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("500");
    });

    it("should handle network error", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network error" });

      const result = await Appointment.addAppointmentToDb(validAppointmentData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should create multiple appointments in batch", async () => {
      const batchData = {
        ...validAppointmentData,
        dateArray: [
          { date: "2025-01-15", bringTowels: "no", bringSheets: "no" },
          { date: "2025-01-16", bringTowels: "yes", bringSheets: "no" },
          { date: "2025-01-17", bringTowels: "no", bringSheets: "yes" },
        ],
      };

      HttpClient.post.mockResolvedValueOnce({
        appointments: [{ id: 1 }, { id: 2 }, { id: 3 }],
      });

      const result = await Appointment.addAppointmentToDb(batchData);

      expect(result.success).toBe(true);
      expect(result.data.appointments).toHaveLength(3);
    });
  });

  describe("deleteAppointment", () => {
    it("should delete appointment successfully", async () => {
      HttpClient.delete.mockResolvedValueOnce({ message: "Appointment Deleted" });

      const result = await Appointment.deleteAppointment(1, 25, mockToken);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/appointments/1",
        { skipAuth: true, body: { fee: 25, user: mockToken } }
      );
      expect(result.message).toBe("Appointment Deleted");
    });

    it("should delete appointment with zero fee", async () => {
      HttpClient.delete.mockResolvedValueOnce({ message: "Appointment Deleted" });

      const result = await Appointment.deleteAppointment(1, 0, mockToken);

      expect(result.message).toBe("Appointment Deleted");
    });

    it("should throw error on 400 response", async () => {
      HttpClient.delete.mockResolvedValueOnce({
        success: false,
        status: 400,
        error: "Invalid appointment ID",
      });

      await expect(
        Appointment.deleteAppointment(999, 0, mockToken)
      ).rejects.toThrow();
    });

    it("should throw error on server error", async () => {
      HttpClient.delete.mockResolvedValueOnce({
        success: false,
        status: 500,
        error: "Internal Server Error",
      });

      await expect(
        Appointment.deleteAppointment(1, 0, mockToken)
      ).rejects.toThrow();
    });

    it("should handle network error", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      await expect(
        Appointment.deleteAppointment(1, 0, mockToken)
      ).rejects.toThrow();
    });
  });

  describe("deleteAppointmentById", () => {
    it("should delete appointment by ID successfully", async () => {
      HttpClient.delete.mockResolvedValueOnce({ message: "Appointment Deleted" });

      const result = await Appointment.deleteAppointmentById(5);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/appointments/id/5",
        { skipAuth: true }
      );
      expect(result.message).toBe("Appointment Deleted");
    });

    it("should throw error on 400 response", async () => {
      HttpClient.delete.mockResolvedValueOnce({
        success: false,
        status: 400,
        error: "Invalid ID",
      });

      await expect(Appointment.deleteAppointmentById(999)).rejects.toThrow();
    });

    it("should throw error on server error", async () => {
      HttpClient.delete.mockResolvedValueOnce({
        success: false,
        status: 500,
        error: "Internal Server Error",
      });

      await expect(Appointment.deleteAppointmentById(1)).rejects.toThrow();
    });
  });

  describe("getHomeAppointments", () => {
    const mockAppointments = {
      appointments: [
        {
          id: 1,
          date: "2025-01-15",
          price: "150",
          hasBeenAssigned: false,
        },
        {
          id: 2,
          date: "2025-01-16",
          price: "175",
          hasBeenAssigned: true,
        },
      ],
    };

    it("should fetch appointments for a home successfully", async () => {
      HttpClient.get.mockResolvedValueOnce(mockAppointments);

      const result = await Appointment.getHomeAppointments(1);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/appointments/1",
        { skipAuth: true }
      );
      expect(result.appointments).toHaveLength(2);
      expect(result.appointments[0].date).toBe("2025-01-15");
    });

    it("should return empty array for home with no appointments", async () => {
      HttpClient.get.mockResolvedValueOnce({ appointments: [] });

      const result = await Appointment.getHomeAppointments(999);

      expect(result.appointments).toHaveLength(0);
    });

    it("should return error on failed response", async () => {
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        status: 404,
        error: "Not Found",
      });

      const result = await Appointment.getHomeAppointments(999);

      expect(result).toBeInstanceOf(Error);
    });

    it("should handle network error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await Appointment.getHomeAppointments(1);

      expect(result).toBeInstanceOf(Error);
    });
  });

  describe("getHomeInfo", () => {
    const mockHomeInfo = {
      home: [
        {
          id: 1,
          nickName: "Test Home",
          address: "123 Test St",
          numBeds: 3,
          numBaths: 2,
        },
      ],
    };

    it("should fetch home info successfully", async () => {
      HttpClient.get.mockResolvedValueOnce(mockHomeInfo);

      const result = await Appointment.getHomeInfo(1);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/appointments/home/1",
        { skipAuth: true }
      );
      expect(result.home[0].nickName).toBe("Test Home");
    });

    it("should return error for non-existent home", async () => {
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        status: 404,
        error: "Not Found",
      });

      const result = await Appointment.getHomeInfo(999);

      expect(result).toBeInstanceOf(Error);
    });
  });

  describe("updateSheetsAppointments", () => {
    it("should update sheets to yes", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: true });

      const result = await Appointment.updateSheetsAppointments("yes", 1);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/appointments/1",
        { bringSheets: "yes", id: 1 },
        { skipAuth: true }
      );
      expect(result.success).toBe(true);
    });

    it("should update sheets to no", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: true });

      const result = await Appointment.updateSheetsAppointments("no", 1);

      expect(result.success).toBe(true);
    });

    it("should return error on failed response", async () => {
      HttpClient.patch.mockResolvedValueOnce({
        success: false,
        status: 500,
        error: "Server error",
      });

      const result = await Appointment.updateSheetsAppointments("yes", 1);

      expect(result).toBeInstanceOf(Error);
    });
  });

  describe("updateTowelsAppointments", () => {
    it("should update towels to yes", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: true });

      const result = await Appointment.updateTowelsAppointments("yes", 1);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/appointments/1",
        { bringTowels: "yes", id: 1 },
        { skipAuth: true }
      );
      expect(result.success).toBe(true);
    });

    it("should update towels to no", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: true });

      const result = await Appointment.updateTowelsAppointments("no", 1);

      expect(result.success).toBe(true);
    });

    it("should return error on failed response", async () => {
      HttpClient.patch.mockResolvedValueOnce({
        success: false,
        status: 500,
        error: "Server error",
      });

      const result = await Appointment.updateTowelsAppointments("yes", 1);

      expect(result).toBeInstanceOf(Error);
    });
  });

  describe("updateCodeAppointments", () => {
    it("should update keypad code successfully", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: true });

      const result = await Appointment.updateCodeAppointments("5678", 1);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/appointments/1",
        { keyPadCode: "5678", id: 1 },
        { skipAuth: true }
      );
      expect(result.success).toBe(true);
    });

    it("should handle numeric code", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: true });

      const result = await Appointment.updateCodeAppointments("123456", 1);

      expect(result.success).toBe(true);
    });

    it("should return error on failed response", async () => {
      HttpClient.patch.mockResolvedValueOnce({
        success: false,
        status: 500,
        error: "Server error",
      });

      const result = await Appointment.updateCodeAppointments("1234", 1);

      expect(result).toBeInstanceOf(Error);
    });
  });

  describe("updateKeyAppointments", () => {
    it("should update key location successfully", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: true });

      const result = await Appointment.updateKeyAppointments("Under doormat", 1);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/appointments/1",
        { keyLocation: "Under doormat", id: 1 },
        { skipAuth: true }
      );
      expect(result.success).toBe(true);
    });

    it("should handle various key locations", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: true });

      const result = await Appointment.updateKeyAppointments(
        "Lockbox code 4321",
        1
      );

      expect(result.success).toBe(true);
    });

    it("should return error on failed response", async () => {
      HttpClient.patch.mockResolvedValueOnce({
        success: false,
        status: 500,
        error: "Server error",
      });

      const result = await Appointment.updateKeyAppointments("Under mat", 1);

      expect(result).toBeInstanceOf(Error);
    });
  });

  describe("updateAppointmentLinens", () => {
    const linenData = {
      sheetConfigurations: [
        { bedId: 1, type: "queen", bringSheets: true },
        { bedId: 2, type: "twin", bringSheets: false },
      ],
      towelConfigurations: [
        { bathroomId: 1, count: 4, bringTowels: true },
        { bathroomId: 2, count: 2, bringTowels: false },
      ],
      bringSheets: "yes",
      bringTowels: "yes",
    };

    it("should update linens successfully", async () => {
      HttpClient.patch.mockResolvedValueOnce({
        appointment: {
          id: 1,
          sheetConfigurations: linenData.sheetConfigurations,
          towelConfigurations: linenData.towelConfigurations,
          price: "175",
        },
      });

      const result = await Appointment.updateAppointmentLinens(
        1,
        linenData,
        mockToken
      );

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/appointments/1/linens",
        linenData,
        { token: mockToken }
      );
      expect(result.appointment.price).toBe("175");
    });

    it("should update only sheet configurations", async () => {
      const sheetsOnly = {
        sheetConfigurations: linenData.sheetConfigurations,
        bringSheets: "yes",
      };

      HttpClient.patch.mockResolvedValueOnce({
        appointment: { id: 1, sheetConfigurations: sheetsOnly.sheetConfigurations },
      });

      const result = await Appointment.updateAppointmentLinens(
        1,
        sheetsOnly,
        mockToken
      );

      expect(result.appointment).toBeDefined();
    });

    it("should throw error on failed response", async () => {
      HttpClient.patch.mockResolvedValueOnce({
        success: false,
        status: 403,
        error: "Not authorized to update this appointment",
      });

      await expect(
        Appointment.updateAppointmentLinens(1, linenData, mockToken)
      ).rejects.toThrow("Not authorized to update this appointment");
    });

    it("should throw error on 404 response", async () => {
      HttpClient.patch.mockResolvedValueOnce({
        success: false,
        status: 404,
        error: "Appointment not found",
      });

      await expect(
        Appointment.updateAppointmentLinens(999, linenData, mockToken)
      ).rejects.toThrow("Appointment not found");
    });

    it("should handle network error", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      await expect(
        Appointment.updateAppointmentLinens(1, linenData, mockToken)
      ).rejects.toThrow();
    });

    it("should recalculate price when linens change", async () => {
      const updateData = {
        ...linenData,
        bringSheets: "no",
        bringTowels: "no",
      };

      HttpClient.patch.mockResolvedValueOnce({
        appointment: {
          id: 1,
          price: "150", // Lower price without linens
        },
      });

      const result = await Appointment.updateAppointmentLinens(
        1,
        updateData,
        mockToken
      );

      expect(result.appointment.price).toBe("150");
    });
  });

  describe("URL construction", () => {
    beforeEach(() => {
      HttpClient.get.mockResolvedValue({});
      HttpClient.post.mockResolvedValue({});
      HttpClient.patch.mockResolvedValue({});
      HttpClient.delete.mockResolvedValue({});
    });

    it("should construct correct URL for addAppointmentToDb", async () => {
      await Appointment.addAppointmentToDb({ token: mockToken });

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/appointments",
        { token: mockToken },
        { skipAuth: true }
      );
    });

    it("should construct correct URL for deleteAppointment with ID", async () => {
      await Appointment.deleteAppointment(42, 0, mockToken);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/appointments/42",
        { skipAuth: true, body: { fee: 0, user: mockToken } }
      );
    });

    it("should construct correct URL for deleteAppointmentById", async () => {
      await Appointment.deleteAppointmentById(99);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/appointments/id/99",
        { skipAuth: true }
      );
    });

    it("should construct correct URL for getHomeAppointments", async () => {
      await Appointment.getHomeAppointments(7);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/appointments/7",
        { skipAuth: true }
      );
    });

    it("should construct correct URL for getHomeInfo", async () => {
      await Appointment.getHomeInfo(15);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/appointments/home/15",
        { skipAuth: true }
      );
    });

    it("should construct correct URL for updateAppointmentLinens", async () => {
      await Appointment.updateAppointmentLinens(25, {}, mockToken);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/appointments/25/linens",
        {},
        { token: mockToken }
      );
    });
  });

  describe("HTTP methods", () => {
    beforeEach(() => {
      HttpClient.get.mockResolvedValue({});
      HttpClient.post.mockResolvedValue({});
      HttpClient.patch.mockResolvedValue({});
      HttpClient.delete.mockResolvedValue({});
    });

    it("should use POST for creating appointments", async () => {
      await Appointment.addAppointmentToDb({ token: mockToken });

      expect(HttpClient.post).toHaveBeenCalled();
    });

    it("should use DELETE for deleting appointments", async () => {
      await Appointment.deleteAppointment(1, 0, mockToken);

      expect(HttpClient.delete).toHaveBeenCalled();
    });

    it("should use PATCH for updating appointments", async () => {
      await Appointment.updateSheetsAppointments("yes", 1);

      expect(HttpClient.patch).toHaveBeenCalled();
    });

    it("should use GET for fetching appointments", async () => {
      await Appointment.getHomeAppointments(1);

      expect(HttpClient.get).toHaveBeenCalled();
    });
  });

  describe("Authorization header", () => {
    it("should include token in updateAppointmentLinens", async () => {
      HttpClient.patch.mockResolvedValueOnce({});

      await Appointment.updateAppointmentLinens(1, {}, mockToken);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/appointments/1/linens",
        {},
        { token: mockToken }
      );
    });

    it("should use skipAuth in getHomeAppointments", async () => {
      HttpClient.get.mockResolvedValueOnce({ appointments: [] });

      await Appointment.getHomeAppointments(1);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/appointments/1",
        { skipAuth: true }
      );
    });
  });
});
