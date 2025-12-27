import Application from "../../src/services/fetchRequests/ApplicationClass";

// Mock global fetch
global.fetch = jest.fn();

describe("ApplicationClass", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPendingCount", () => {
    it("should return pending count on successful response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ count: 5 }),
      });

      const result = await Application.getPendingCount();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/applications/pending-count")
      );
      expect(result).toBe(5);
    });

    it("should return 0 when count is not in response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await Application.getPendingCount();

      expect(result).toBe(0);
    });

    it("should return 0 on non-ok response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await Application.getPendingCount();

      expect(result).toBe(0);
    });

    it("should return 0 on network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await Application.getPendingCount();

      expect(result).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error fetching pending applications:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should handle zero pending applications", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ count: 0 }),
      });

      const result = await Application.getPendingCount();

      expect(result).toBe(0);
    });

    it("should handle large pending counts", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ count: 9999 }),
      });

      const result = await Application.getPendingCount();

      expect(result).toBe(9999);
    });
  });

  describe("addApplicationToDb", () => {
    const validApplicationData = {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "555-1234",
      experience: "3 years",
      message: "Looking forward to joining",
    };

    it("should submit application successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ applicationInfo: { id: 1 } }),
      });

      const result = await Application.addApplicationToDb(validApplicationData);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/applications/submitted"),
        expect.objectContaining({
          method: "post",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validApplicationData),
        })
      );
      expect(result).toBe(true);
    });

    it("should return response data on 400 error", async () => {
      const errorData = { error: "Email already exists" };

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => errorData,
      });

      const result = await Application.addApplicationToDb(validApplicationData);

      expect(result).toEqual(errorData);
    });

    it("should throw error on other non-ok responses", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await Application.addApplicationToDb(validApplicationData);

      expect(result).toBeInstanceOf(Error);
    });

    it("should handle network errors", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await Application.addApplicationToDb(validApplicationData);

      expect(result).toBeInstanceOf(Error);
    });
  });

  describe("deleteApplication", () => {
    const mockToken = "test-token-123";

    it("should delete application successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Application deleted successfully" }),
      });

      const result = await Application.deleteApplication(123, mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/applications/123"),
        expect.objectContaining({
          method: "delete",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
        })
      );
      expect(result.message).toBe("Application deleted successfully");
    });

    it("should throw error on 400 response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Bad request" }),
      });

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await expect(Application.deleteApplication(123, mockToken)).rejects.toThrow(
        /Failed to delete appointment/
      );

      consoleSpy.mockRestore();
    });

    it("should throw error on other non-ok responses", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error",
      });

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await expect(Application.deleteApplication(123, mockToken)).rejects.toThrow();

      consoleSpy.mockRestore();
    });

    it("should handle network errors", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await expect(Application.deleteApplication(123, mockToken)).rejects.toThrow(
        /Failed to delete appointment/
      );

      consoleSpy.mockRestore();
    });

    it("should handle string ID", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Deleted" }),
      });

      await Application.deleteApplication("456", mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/applications/456"),
        expect.any(Object)
      );
    });
  });

  describe("getApplications", () => {
    it("should fetch single application by ID", async () => {
      const mockApplication = {
        id: 1,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApplication,
      });

      const result = await Application.getApplications(1);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/applications/1")
      );
      expect(result).toEqual(mockApplication);
    });

    it("should return error on non-ok response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await Application.getApplications(999);

      expect(result).toBeInstanceOf(Error);
    });

    it("should handle network errors", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await Application.getApplications(1);

      expect(result).toBeInstanceOf(Error);
    });
  });

  describe("updateApplicationStatus", () => {
    const mockToken = "test-token-123";

    it("should update application status successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "Status updated successfully",
          status: "approved",
        }),
      });

      const result = await Application.updateApplicationStatus(1, "approved", mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/applications/1/status"),
        expect.objectContaining({
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify({ status: "approved" }),
        })
      );
      expect(result.status).toBe("approved");
    });

    it("should handle different status values", async () => {
      const statuses = [
        "pending",
        "under_review",
        "background_check",
        "approved",
        "rejected",
      ];

      for (const status of statuses) {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status }),
        });

        const result = await Application.updateApplicationStatus(1, status, mockToken);

        expect(result.status).toBe(status);
      }
    });

    it("should throw error on non-ok response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await expect(
        Application.updateApplicationStatus(1, "invalid", mockToken)
      ).rejects.toThrow();

      consoleSpy.mockRestore();
    });

    it("should handle network errors", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await expect(
        Application.updateApplicationStatus(1, "approved", mockToken)
      ).rejects.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe("updateApplicationNotes", () => {
    const mockToken = "test-token-123";

    it("should update application notes successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Notes updated successfully" }),
      });

      const result = await Application.updateApplicationNotes(
        1,
        "Interviewed on Monday",
        mockToken
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/applications/1/notes"),
        expect.objectContaining({
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify({ adminNotes: "Interviewed on Monday" }),
        })
      );
      expect(result.message).toBe("Notes updated successfully");
    });

    it("should handle empty notes", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Notes updated" }),
      });

      await Application.updateApplicationNotes(1, "", mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ adminNotes: "" }),
        })
      );
    });

    it("should throw error on non-ok response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await expect(
        Application.updateApplicationNotes(999, "Notes", mockToken)
      ).rejects.toThrow();

      consoleSpy.mockRestore();
    });

    it("should handle network errors", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await expect(
        Application.updateApplicationNotes(1, "Notes", mockToken)
      ).rejects.toThrow();

      consoleSpy.mockRestore();
    });
  });
});
