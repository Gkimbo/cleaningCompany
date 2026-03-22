import HttpClient from "../HttpClient";

class ChecklistService {
  // Get the published checklist (for cleaners and read-only view)
  static async getPublishedChecklist(token) {
    const result = await HttpClient.get("/checklist/published", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Checklist] getPublishedChecklist failed:", result.error);
      return { sections: [], metadata: { version: 0 } };
    }

    return result;
  }

  // Get the current draft (for owner editing)
  static async getDraft(token) {
    const result = await HttpClient.get("/checklist/draft", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Checklist] getDraft failed:", result.error);
      return null;
    }

    return result;
  }

  // Save draft (auto-save)
  static async saveDraft(token, draftData) {
    const result = await HttpClient.put("/checklist/draft", { draftData }, { token });

    if (result.success === false) {
      return {
        success: false,
        error: result.error || "Failed to save draft",
      };
    }

    return {
      success: true,
      ...result,
    };
  }

  // Publish the current draft
  static async publishDraft(token) {
    const result = await HttpClient.post("/checklist/publish", {}, { token });

    if (result.success === false) {
      return {
        success: false,
        error: result.error || "Failed to publish checklist",
      };
    }

    return {
      success: true,
      ...result,
    };
  }

  // Get version history
  static async getVersionHistory(token) {
    const result = await HttpClient.get("/checklist/versions", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Checklist] getVersionHistory failed:", result.error);
      return { versions: [] };
    }

    return result;
  }

  // Get a specific version
  static async getVersion(token, versionId) {
    const result = await HttpClient.get(`/checklist/versions/${versionId}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Checklist] getVersion failed:", result.error);
      return null;
    }

    return result;
  }

  // Revert to a previous version
  static async revertToVersion(token, versionId) {
    const result = await HttpClient.post(`/checklist/revert/${versionId}`, {}, { token });

    if (result.success === false) {
      return {
        success: false,
        error: result.error || "Failed to revert to version",
      };
    }

    return {
      success: true,
      ...result,
    };
  }

  // Seed checklist from hardcoded data (one-time migration)
  static async seedFromHardcoded(token) {
    const result = await HttpClient.post("/checklist/seed", {}, { token });

    if (result.success === false) {
      return {
        success: false,
        error: result.error || "Failed to seed checklist",
      };
    }

    return {
      success: true,
      ...result,
    };
  }

  // Get template stats (for preview before loading)
  static async getTemplateStats(token) {
    const result = await HttpClient.get("/checklist/template", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Checklist] getTemplateStats failed:", result.error);
      return null;
    }

    return result;
  }

  // Load template into current draft (replaces current draft)
  static async loadTemplate(token) {
    const result = await HttpClient.post("/checklist/load-template", {}, { token });

    if (result.success === false) {
      return {
        success: false,
        error: result.error || "Failed to load template",
      };
    }

    return {
      success: true,
      ...result,
    };
  }
}

export default ChecklistService;
