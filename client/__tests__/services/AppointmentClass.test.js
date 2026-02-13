import Appointment from "../../src/services/fetchRequests/AppointmentClass";

// Mock global fetch
global.fetch = jest.fn();

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ appointments: [{ id: 1 }] }),
      });

      const result = await Appointment.addAppointmentToDb(validAppointmentData);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments"),
        expect.objectContaining({
          method: "post",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validAppointmentData),
        })
      );
      expect(result.success).toBe(true);
      expect(result.data.appointments).toHaveLength(1);
    });

    it("should return error data on 400 response", async () => {
      const errorResponse = { error: "Invalid date format" };
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => errorResponse,
      });

      const result = await Appointment.addAppointmentToDb(validAppointmentData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid date format");
    });

    it("should return error on server error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({}),
      });

      const result = await Appointment.addAppointmentToDb(validAppointmentData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("500");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          appointments: [{ id: 1 }, { id: 2 }, { id: 3 }],
        }),
      });

      const result = await Appointment.addAppointmentToDb(batchData);

      expect(result.success).toBe(true);
      expect(result.data.appointments).toHaveLength(3);
    });
  });

  describe("deleteAppointment", () => {
    it("should delete appointment successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Appointment Deleted" }),
      });

      const result = await Appointment.deleteAppointment(1, 25, mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/1"),
        expect.objectContaining({
          method: "delete",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fee: 25, user: mockToken }),
        })
      );
      expect(result.message).toBe("Appointment Deleted");
    });

    it("should delete appointment with zero fee", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Appointment Deleted" }),
      });

      const result = await Appointment.deleteAppointment(1, 0, mockToken);

      expect(result.message).toBe("Appointment Deleted");
    });

    it("should throw error on 400 response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ error: "Invalid appointment ID" }),
      });

      await expect(
        Appointment.deleteAppointment(999, 0, mockToken)
      ).rejects.toThrow("Failed to delete appointment");
    });

    it("should throw error on server error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(
        Appointment.deleteAppointment(1, 0, mockToken)
      ).rejects.toThrow("Failed to delete appointment");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        Appointment.deleteAppointment(1, 0, mockToken)
      ).rejects.toThrow("Failed to delete appointment");
    });
  });

  describe("deleteAppointmentById", () => {
    it("should delete appointment by ID successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Appointment Deleted" }),
      });

      const result = await Appointment.deleteAppointmentById(5);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/id/5"),
        expect.objectContaining({
          method: "delete",
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(result.message).toBe("Appointment Deleted");
    });

    it("should throw error on 400 response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ error: "Invalid ID" }),
      });

      await expect(Appointment.deleteAppointmentById(999)).rejects.toThrow(
        "Failed to delete appointment"
      );
    });

    it("should throw error on server error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(Appointment.deleteAppointmentById(1)).rejects.toThrow(
        "Failed to delete appointment"
      );
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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAppointments,
      });

      const result = await Appointment.getHomeAppointments(1);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/1")
      );
      expect(result.appointments).toHaveLength(2);
      expect(result.appointments[0].date).toBe("2025-01-15");
    });

    it("should return empty array for home with no appointments", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ appointments: [] }),
      });

      const result = await Appointment.getHomeAppointments(999);

      expect(result.appointments).toHaveLength(0);
    });

    it("should return error on failed response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await Appointment.getHomeAppointments(999);

      expect(result).toBeInstanceOf(Error);
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHomeInfo,
      });

      const result = await Appointment.getHomeInfo(1);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/home/1")
      );
      expect(result.home[0].nickName).toBe("Test Home");
    });

    it("should return error for non-existent home", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await Appointment.getHomeInfo(999);

      expect(result).toBeInstanceOf(Error);
    });
  });

  describe("updateSheetsAppointments", () => {
    it("should update sheets to yes", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await Appointment.updateSheetsAppointments("yes", 1);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/1"),
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bringSheets: "yes", id: 1 }),
        })
      );
      expect(result.success).toBe(true);
    });

    it("should update sheets to no", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await Appointment.updateSheetsAppointments("no", 1);

      expect(result.success).toBe(true);
    });

    it("should return error on failed response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await Appointment.updateSheetsAppointments("yes", 1);

      expect(result).toBeInstanceOf(Error);
    });
  });

  describe("updateTowelsAppointments", () => {
    it("should update towels to yes", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await Appointment.updateTowelsAppointments("yes", 1);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/1"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ bringTowels: "yes", id: 1 }),
        })
      );
      expect(result.success).toBe(true);
    });

    it("should update towels to no", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await Appointment.updateTowelsAppointments("no", 1);

      expect(result.success).toBe(true);
    });

    it("should return error on failed response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await Appointment.updateTowelsAppointments("yes", 1);

      expect(result).toBeInstanceOf(Error);
    });
  });

  describe("updateCodeAppointments", () => {
    it("should update keypad code successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await Appointment.updateCodeAppointments("5678", 1);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/1"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ keyPadCode: "5678", id: 1 }),
        })
      );
      expect(result.success).toBe(true);
    });

    it("should handle numeric code", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await Appointment.updateCodeAppointments("123456", 1);

      expect(result.success).toBe(true);
    });

    it("should return error on failed response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await Appointment.updateCodeAppointments("1234", 1);

      expect(result).toBeInstanceOf(Error);
    });
  });

  describe("updateKeyAppointments", () => {
    it("should update key location successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await Appointment.updateKeyAppointments("Under doormat", 1);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/1"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ keyLocation: "Under doormat", id: 1 }),
        })
      );
      expect(result.success).toBe(true);
    });

    it("should handle various key locations", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await Appointment.updateKeyAppointments(
        "Lockbox code 4321",
        1
      );

      expect(result.success).toBe(true);
    });

    it("should return error on failed response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          appointment: {
            id: 1,
            sheetConfigurations: linenData.sheetConfigurations,
            towelConfigurations: linenData.towelConfigurations,
            price: "175",
          },
        }),
      });

      const result = await Appointment.updateAppointmentLinens(
        1,
        linenData,
        mockToken
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/1/linens"),
        expect.objectContaining({
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify(linenData),
        })
      );
      expect(result.appointment.price).toBe("175");
    });

    it("should update only sheet configurations", async () => {
      const sheetsOnly = {
        sheetConfigurations: linenData.sheetConfigurations,
        bringSheets: "yes",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          appointment: { id: 1, sheetConfigurations: sheetsOnly.sheetConfigurations },
        }),
      });

      const result = await Appointment.updateAppointmentLinens(
        1,
        sheetsOnly,
        mockToken
      );

      expect(result.appointment).toBeDefined();
    });

    it("should throw error on failed response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: "Not authorized to update this appointment" }),
      });

      await expect(
        Appointment.updateAppointmentLinens(1, linenData, mockToken)
      ).rejects.toThrow("Not authorized to update this appointment");
    });

    it("should throw error on 404 response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: "Appointment not found" }),
      });

      await expect(
        Appointment.updateAppointmentLinens(999, linenData, mockToken)
      ).rejects.toThrow("Appointment not found");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          appointment: {
            id: 1,
            price: "150", // Lower price without linens
          },
        }),
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
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
    });

    it("should construct correct URL for addAppointmentToDb", async () => {
      await Appointment.addAppointmentToDb({ token: mockToken });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments"),
        expect.any(Object)
      );
    });

    it("should construct correct URL for deleteAppointment with ID", async () => {
      await Appointment.deleteAppointment(42, 0, mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/42"),
        expect.any(Object)
      );
    });

    it("should construct correct URL for deleteAppointmentById", async () => {
      await Appointment.deleteAppointmentById(99);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/id/99"),
        expect.any(Object)
      );
    });

    it("should construct correct URL for getHomeAppointments", async () => {
      await Appointment.getHomeAppointments(7);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/7")
      );
    });

    it("should construct correct URL for getHomeInfo", async () => {
      await Appointment.getHomeInfo(15);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/home/15")
      );
    });

    it("should construct correct URL for updateAppointmentLinens", async () => {
      await Appointment.updateAppointmentLinens(25, {}, mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/25/linens"),
        expect.any(Object)
      );
    });
  });

  describe("HTTP methods", () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
    });

    it("should use POST for creating appointments", async () => {
      await Appointment.addAppointmentToDb({ token: mockToken });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "post" })
      );
    });

    it("should use DELETE for deleting appointments", async () => {
      await Appointment.deleteAppointment(1, 0, mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "delete" })
      );
    });

    it("should use PATCH for updating appointments", async () => {
      await Appointment.updateSheetsAppointments("yes", 1);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("should use GET for fetching appointments", async () => {
      await Appointment.getHomeAppointments(1);

      // GET request doesn't explicitly specify method
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/appointments/1"));
    });
  });

  describe("Authorization header", () => {
    it("should include Authorization header in updateAppointmentLinens", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await Appointment.updateAppointmentLinens(1, {}, mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it("should NOT include Authorization header in getHomeAppointments", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ appointments: [] }),
      });

      await Appointment.getHomeAppointments(1);

      // GET request is made without headers object
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/appointments/1")
      );
    });
  });
});
