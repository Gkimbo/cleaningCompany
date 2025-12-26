import ChecklistService from "../../src/services/fetchRequests/ChecklistService";

// Mock fetch globally
global.fetch = jest.fn();

describe("ChecklistService", () => {
  const mockToken = "test-token-123";

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  describe("getPublishedChecklist", () => {
    it("should fetch published checklist successfully", async () => {
      const mockResponse = {
        sections: [
          { id: "s1", title: "Kitchen", items: [] },
        ],
        metadata: { version: 1 },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await ChecklistService.getPublishedChecklist(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/checklist/published"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.sections).toHaveLength(1);
      expect(result.metadata.version).toBe(1);
    });

    it("should return fallback on fetch failure", async () => {
      fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await ChecklistService.getPublishedChecklist(mockToken);

      expect(result).toEqual({ sections: [], metadata: { version: 0 } });
    });

    it("should return fallback on non-ok response", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

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

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDraft),
      });

      const result = await ChecklistService.getDraft(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/checklist/draft"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.draftData.sections).toHaveLength(1);
    });

    it("should return null on failure", async () => {
      fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await ChecklistService.getDraft(mockToken);

      expect(result).toBeNull();
    });
  });

  describe("saveDraft", () => {
    it("should save draft successfully", async () => {
      const draftData = {
        sections: [{ id: "s1", title: "Kitchen", items: [] }],
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, draft: { id: 1 } }),
      });

      const result = await ChecklistService.saveDraft(mockToken, draftData);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/checklist/draft"),
        expect.objectContaining({
          method: "PUT",
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ draftData }),
        })
      );
      expect(result.success).toBe(true);
    });

    it("should return error on save failure", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Save failed" }),
      });

      const result = await ChecklistService.saveDraft(mockToken, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Save failed");
    });

    it("should handle network errors", async () => {
      fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await ChecklistService.saveDraft(mockToken, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });

  describe("publishDraft", () => {
    it("should publish draft successfully", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          version: { id: 1, version: 2 },
        }),
      });

      const result = await ChecklistService.publishDraft(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/checklist/publish"),
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
        })
      );
      expect(result.success).toBe(true);
      expect(result.version.version).toBe(2);
    });

    it("should return error on publish failure", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "No draft to publish" }),
      });

      const result = await ChecklistService.publishDraft(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No draft to publish");
    });

    it("should handle network errors", async () => {
      fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await ChecklistService.publishDraft(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
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

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVersions),
      });

      const result = await ChecklistService.getVersionHistory(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/checklist/versions"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.versions).toHaveLength(2);
    });

    it("should return empty versions on failure", async () => {
      fetch.mockRejectedValueOnce(new Error("Network error"));

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

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVersion),
      });

      const result = await ChecklistService.getVersion(mockToken, 1);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/checklist/versions/1"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.version).toBe(1);
    });

    it("should return null on failure", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await ChecklistService.getVersion(mockToken, 999);

      expect(result).toBeNull();
    });
  });

  describe("revertToVersion", () => {
    it("should revert to version successfully", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          draft: { draftData: { sections: [] } },
        }),
      });

      const result = await ChecklistService.revertToVersion(mockToken, 1);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/checklist/revert/1"),
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
        })
      );
      expect(result.success).toBe(true);
    });

    it("should return error on revert failure", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Version not found" }),
      });

      const result = await ChecklistService.revertToVersion(mockToken, 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Version not found");
    });

    it("should handle network errors", async () => {
      fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await ChecklistService.revertToVersion(mockToken, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });

  describe("seedFromHardcoded", () => {
    it("should seed successfully", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: "Checklist seeded successfully",
        }),
      });

      const result = await ChecklistService.seedFromHardcoded(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/checklist/seed"),
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(result.success).toBe(true);
    });

    it("should return error if already seeded", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Checklist already exists" }),
      });

      const result = await ChecklistService.seedFromHardcoded(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Checklist already exists");
    });

    it("should handle network errors", async () => {
      fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await ChecklistService.seedFromHardcoded(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });

  describe("Authorization header", () => {
    it("should include Bearer token in all requests", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await ChecklistService.getPublishedChecklist(mockToken);
      await ChecklistService.getDraft(mockToken);
      await ChecklistService.getVersionHistory(mockToken);

      expect(fetch).toHaveBeenCalledTimes(3);
      fetch.mock.calls.forEach((call) => {
        expect(call[1].headers.Authorization).toBe(`Bearer ${mockToken}`);
      });
    });
  });

  describe("Content-Type header", () => {
    it("should include Content-Type for POST/PUT requests", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await ChecklistService.saveDraft(mockToken, {});
      await ChecklistService.publishDraft(mockToken);
      await ChecklistService.revertToVersion(mockToken, 1);
      await ChecklistService.seedFromHardcoded(mockToken);

      fetch.mock.calls.forEach((call) => {
        expect(call[1].headers["Content-Type"]).toBe("application/json");
      });
    });
  });
});
