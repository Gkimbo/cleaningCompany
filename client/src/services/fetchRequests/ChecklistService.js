import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class ChecklistService {
  static async fetchWithFallback(url, token, fallback = {}) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.warn(`[Checklist] ${url} returned ${response.status}`);
        return fallback;
      }
      return await response.json();
    } catch (error) {
      console.warn(`[Checklist] ${url} failed:`, error.message);
      return fallback;
    }
  }

  // Get the published checklist (for cleaners and read-only view)
  static async getPublishedChecklist(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/checklist/published`,
      token,
      { sections: [], metadata: { version: 0 } }
    );
  }

  // Get the current draft (for owner editing)
  static async getDraft(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/checklist/draft`,
      token,
      null
    );
  }

  // Save draft (auto-save)
  static async saveDraft(token, draftData) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/checklist/draft`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ draftData }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to save draft",
        };
      }

      return {
        success: true,
        ...data,
      };
    } catch (error) {
      console.error("[Checklist] saveDraft failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // Publish the current draft
  static async publishDraft(token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/checklist/publish`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to publish checklist",
        };
      }

      return {
        success: true,
        ...data,
      };
    } catch (error) {
      console.error("[Checklist] publishDraft failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // Get version history
  static async getVersionHistory(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/checklist/versions`,
      token,
      { versions: [] }
    );
  }

  // Get a specific version
  static async getVersion(token, versionId) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/checklist/versions/${versionId}`,
      token,
      null
    );
  }

  // Revert to a previous version
  static async revertToVersion(token, versionId) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/checklist/revert/${versionId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to revert to version",
        };
      }

      return {
        success: true,
        ...data,
      };
    } catch (error) {
      console.error("[Checklist] revertToVersion failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // Seed checklist from hardcoded data (one-time migration)
  static async seedFromHardcoded(token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/checklist/seed`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to seed checklist",
        };
      }

      return {
        success: true,
        ...data,
      };
    } catch (error) {
      console.error("[Checklist] seedFromHardcoded failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // Get template stats (for preview before loading)
  static async getTemplateStats(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/checklist/template`,
      token,
      null
    );
  }

  // Load template into current draft (replaces current draft)
  static async loadTemplate(token) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/checklist/load-template`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to load template",
        };
      }

      return {
        success: true,
        ...data,
      };
    } catch (error) {
      console.error("[Checklist] loadTemplate failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }
}

export default ChecklistService;
