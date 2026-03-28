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
import Application from "../../src/services/fetchRequests/ApplicationClass";

describe("ApplicationClass", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPendingCount", () => {
    it("should return pending count on successful response", async () => {
      HttpClient.get.mockResolvedValueOnce({ count: 5 });

      const result = await Application.getPendingCount();

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/applications/pending-count",
        { skipAuth: true }
      );
      expect(result).toBe(5);
    });

    it("should return 0 when count is not in response", async () => {
      HttpClient.get.mockResolvedValueOnce({});

      const result = await Application.getPendingCount();

      expect(result).toBe(0);
    });

    it("should return 0 on non-ok response", async () => {
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        error: "Server error",
      });

      const result = await Application.getPendingCount();

      expect(result).toBe(0);
    });

    it("should return 0 on network error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await Application.getPendingCount();

      expect(result).toBe(0);
    });

    it("should handle zero pending applications", async () => {
      HttpClient.get.mockResolvedValueOnce({ count: 0 });

      const result = await Application.getPendingCount();

      expect(result).toBe(0);
    });

    it("should handle large pending counts", async () => {
      HttpClient.get.mockResolvedValueOnce({ count: 9999 });

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
      HttpClient.post.mockResolvedValueOnce({ applicationInfo: { id: 1 } });

      const result = await Application.addApplicationToDb(validApplicationData);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/applications/submitted",
        validApplicationData,
        { skipAuth: true }
      );
      expect(result).toBe(true);
    });

    it("should return response data on 400 error", async () => {
      const errorData = { success: false, status: 400, error: "Email already exists" };

      HttpClient.post.mockResolvedValueOnce(errorData);

      const result = await Application.addApplicationToDb(validApplicationData);

      expect(result).toEqual(errorData);
    });

    it("should throw error on other non-ok responses", async () => {
      HttpClient.post.mockResolvedValueOnce({
        success: false,
        status: 500,
        error: "Internal Server Error",
      });

      await expect(Application.addApplicationToDb(validApplicationData)).rejects.toThrow("Internal Server Error");
    });

    it("should throw error on network errors", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      await expect(Application.addApplicationToDb(validApplicationData)).rejects.toThrow("Network request failed");
    });
  });

  describe("deleteApplication", () => {
    const mockToken = "test-token-123";

    it("should delete application successfully", async () => {
      HttpClient.delete.mockResolvedValueOnce({ message: "Application deleted successfully" });

      const result = await Application.deleteApplication(123, mockToken);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/applications/123",
        { token: mockToken }
      );
      expect(result.message).toBe("Application deleted successfully");
    });

    it("should throw error on 400 response", async () => {
      HttpClient.delete.mockResolvedValueOnce({
        success: false,
        status: 400,
        error: "Bad request",
      });

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await expect(Application.deleteApplication(123, mockToken)).rejects.toThrow();

      consoleSpy.mockRestore();
    });

    it("should throw error on other non-ok responses", async () => {
      HttpClient.delete.mockResolvedValueOnce({
        success: false,
        status: 500,
        error: "Server Error",
      });

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await expect(Application.deleteApplication(123, mockToken)).rejects.toThrow();

      consoleSpy.mockRestore();
    });

    it("should handle network errors", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await expect(Application.deleteApplication(123, mockToken)).rejects.toThrow();

      consoleSpy.mockRestore();
    });

    it("should handle string ID", async () => {
      HttpClient.delete.mockResolvedValueOnce({ message: "Deleted" });

      await Application.deleteApplication("456", mockToken);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/applications/456",
        { token: mockToken }
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

      HttpClient.get.mockResolvedValueOnce(mockApplication);

      const result = await Application.getApplications(1);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/applications/1",
        { skipAuth: true }
      );
      expect(result).toEqual(mockApplication);
    });

    it("should throw error on non-ok response", async () => {
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        status: 404,
        error: "Not found",
      });

      await expect(Application.getApplications(999)).rejects.toThrow("No data received");
    });

    it("should throw error on network errors", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      await expect(Application.getApplications(1)).rejects.toThrow("No data received");
    });
  });

  describe("updateApplicationStatus", () => {
    const mockToken = "test-token-123";

    it("should update application status successfully", async () => {
      HttpClient.patch.mockResolvedValueOnce({
        message: "Status updated successfully",
        status: "approved",
      });

      const result = await Application.updateApplicationStatus(1, "approved", mockToken);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/applications/1/status",
        { status: "approved" },
        { token: mockToken }
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
        HttpClient.patch.mockResolvedValueOnce({ status });

        const result = await Application.updateApplicationStatus(1, status, mockToken);

        expect(result.status).toBe(status);
      }
    });

    it("should throw error on non-ok response", async () => {
      HttpClient.patch.mockResolvedValueOnce({
        success: false,
        status: 400,
        error: "Bad Request",
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await expect(
        Application.updateApplicationStatus(1, "invalid", mockToken)
      ).rejects.toThrow();

      consoleSpy.mockRestore();
    });

    it("should handle network errors", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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
      HttpClient.patch.mockResolvedValueOnce({ message: "Notes updated successfully" });

      const result = await Application.updateApplicationNotes(
        1,
        "Interviewed on Monday",
        mockToken
      );

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/applications/1/notes",
        { adminNotes: "Interviewed on Monday" },
        { token: mockToken }
      );
      expect(result.message).toBe("Notes updated successfully");
    });

    it("should handle empty notes", async () => {
      HttpClient.patch.mockResolvedValueOnce({ message: "Notes updated" });

      await Application.updateApplicationNotes(1, "", mockToken);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/applications/1/notes",
        { adminNotes: "" },
        { token: mockToken }
      );
    });

    it("should throw error on non-ok response", async () => {
      HttpClient.patch.mockResolvedValueOnce({
        success: false,
        status: 404,
        error: "Not Found",
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await expect(
        Application.updateApplicationNotes(999, "Notes", mockToken)
      ).rejects.toThrow();

      consoleSpy.mockRestore();
    });

    it("should handle network errors", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await expect(
        Application.updateApplicationNotes(1, "Notes", mockToken)
      ).rejects.toThrow();

      consoleSpy.mockRestore();
    });
  });
});
