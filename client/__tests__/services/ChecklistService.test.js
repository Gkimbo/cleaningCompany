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
import ChecklistService from "../../src/services/fetchRequests/ChecklistService";

describe("ChecklistService", () => {
  const mockToken = "test-token-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPublishedChecklist", () => {
    it("should fetch published checklist successfully", async () => {
      const mockResponse = {
        sections: [
          { id: "s1", title: "Kitchen", items: [] },
        ],
        metadata: { version: 1 },
      };

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await ChecklistService.getPublishedChecklist(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/checklist/published", { token: mockToken });
      expect(result.sections).toHaveLength(1);
      expect(result.metadata.version).toBe(1);
    });

    it("should return fallback on fetch failure", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await ChecklistService.getPublishedChecklist(mockToken);

      expect(result).toEqual({ sections: [], metadata: { version: 0 } });
    });

    it("should return fallback on non-ok response", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Server error" });

      const result = await ChecklistService.getPublishedChecklist(mockToken);

      expect(result).toEqual({ sections: [], metadata: { version: 0 } });
    });
  });

  describe("getDraft", () => {
    it("should fetch draft successfully", async () => {
      const mockDraft = {
        id: 1,
        draftData: {
          sections: [{ id: "s1", title: "Kitchen" }],
        },
      };

      HttpClient.get.mockResolvedValueOnce(mockDraft);

      const result = await ChecklistService.getDraft(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/checklist/draft", { token: mockToken });
      expect(result.draftData.sections).toHaveLength(1);
    });

    it("should return null on failure", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await ChecklistService.getDraft(mockToken);

      expect(result).toBeNull();
    });
  });

  describe("saveDraft", () => {
    it("should save draft successfully", async () => {
      const draftData = {
        sections: [{ id: "s1", title: "Kitchen", items: [] }],
      };

      HttpClient.put.mockResolvedValueOnce({ draft: { id: 1 } });

      const result = await ChecklistService.saveDraft(mockToken, draftData);

      expect(HttpClient.put).toHaveBeenCalledWith(
        "/checklist/draft",
        { draftData },
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on save failure", async () => {
      HttpClient.put.mockResolvedValueOnce({ success: false, error: "Save failed" });

      const result = await ChecklistService.saveDraft(mockToken, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Save failed");
    });

    it("should handle network errors", async () => {
      HttpClient.put.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await ChecklistService.saveDraft(mockToken, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network request failed");
    });
  });

  describe("publishDraft", () => {
    it("should publish draft successfully", async () => {
      HttpClient.post.mockResolvedValueOnce({
        version: { id: 1, version: 2 },
      });

      const result = await ChecklistService.publishDraft(mockToken);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/checklist/publish",
        {},
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.version.version).toBe(2);
    });

    it("should return error on publish failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "No draft to publish" });

      const result = await ChecklistService.publishDraft(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No draft to publish");
    });

    it("should handle network errors", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await ChecklistService.publishDraft(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network request failed");
    });
  });

  describe("getVersionHistory", () => {
    it("should fetch version history successfully", async () => {
      const mockVersions = {
        versions: [
          { id: 2, version: 2, isActive: true },
          { id: 1, version: 1, isActive: false },
        ],
      };

      HttpClient.get.mockResolvedValueOnce(mockVersions);

      const result = await ChecklistService.getVersionHistory(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith("/checklist/versions", { token: mockToken });
      expect(result.versions).toHaveLength(2);
    });

    it("should return empty versions on failure", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await ChecklistService.getVersionHistory(mockToken);

      expect(result).toEqual({ versions: [] });
    });
  });

  describe("getVersion", () => {
    it("should fetch specific version successfully", async () => {
      const mockVersion = {
        id: 1,
        version: 1,
        snapshotData: { sections: [] },
      };

      HttpClient.get.mockResolvedValueOnce(mockVersion);

      const result = await ChecklistService.getVersion(mockToken, 1);

      expect(HttpClient.get).toHaveBeenCalledWith("/checklist/versions/1", { token: mockToken });
      expect(result.version).toBe(1);
    });

    it("should return null on failure", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Not found" });

      const result = await ChecklistService.getVersion(mockToken, 999);

      expect(result).toBeNull();
    });
  });

  describe("revertToVersion", () => {
    it("should revert to version successfully", async () => {
      HttpClient.post.mockResolvedValueOnce({
        draft: { draftData: { sections: [] } },
      });

      const result = await ChecklistService.revertToVersion(mockToken, 1);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/checklist/revert/1",
        {},
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should return error on revert failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Version not found" });

      const result = await ChecklistService.revertToVersion(mockToken, 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Version not found");
    });

    it("should handle network errors", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await ChecklistService.revertToVersion(mockToken, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network request failed");
    });
  });

  describe("seedFromHardcoded", () => {
    it("should seed successfully", async () => {
      HttpClient.post.mockResolvedValueOnce({
        message: "Checklist seeded successfully",
      });

      const result = await ChecklistService.seedFromHardcoded(mockToken);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/checklist/seed",
        {},
        { token: mockToken }
      );
      expect(result.success).toBe(true);
    });

    it("should return error if already seeded", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Checklist already exists" });

      const result = await ChecklistService.seedFromHardcoded(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Checklist already exists");
    });

    it("should handle network errors", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await ChecklistService.seedFromHardcoded(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network request failed");
    });
  });

  describe("Authorization header", () => {
    it("should include token in all requests", async () => {
      HttpClient.get.mockResolvedValue({});

      await ChecklistService.getPublishedChecklist(mockToken);
      await ChecklistService.getDraft(mockToken);
      await ChecklistService.getVersionHistory(mockToken);

      expect(HttpClient.get).toHaveBeenCalledTimes(3);
      HttpClient.get.mock.calls.forEach((call) => {
        expect(call[1]).toEqual({ token: mockToken });
      });
    });
  });

  describe("Content-Type header", () => {
    it("should use POST/PUT methods for write requests", async () => {
      HttpClient.put.mockResolvedValue({});
      HttpClient.post.mockResolvedValue({});

      await ChecklistService.saveDraft(mockToken, {});
      await ChecklistService.publishDraft(mockToken);
      await ChecklistService.revertToVersion(mockToken, 1);
      await ChecklistService.seedFromHardcoded(mockToken);

      expect(HttpClient.put).toHaveBeenCalledTimes(1);
      expect(HttpClient.post).toHaveBeenCalledTimes(3);
    });
  });
});
