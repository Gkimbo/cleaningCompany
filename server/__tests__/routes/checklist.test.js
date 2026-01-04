const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => {
    if (!value) return value;
    if (typeof value !== "string") return value;
    return value.replace("encrypted_", "");
  }),
  encrypt: jest.fn((value) => `encrypted_${value}`),
}));

// Mock models
jest.mock("../../models", () => ({
  ChecklistSection: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 1, title: "Section" }),
    bulkCreate: jest.fn(),
    destroy: jest.fn().mockResolvedValue(1),
  },
  ChecklistItem: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 1, content: "Item" }),
    bulkCreate: jest.fn(),
    destroy: jest.fn().mockResolvedValue(1),
  },
  ChecklistDraft: {
    findOne: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 1, draftData: {} }),
    upsert: jest.fn(),
  },
  ChecklistVersion: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn().mockResolvedValue([1]),
    count: jest.fn(),
    max: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
}));

const {
  ChecklistSection,
  ChecklistItem,
  ChecklistDraft,
  ChecklistVersion,
  User,
} = require("../../models");

const checklistRouter = require("../../routes/api/v1/checklistRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/checklist", checklistRouter);

const secretKey = process.env.SESSION_SECRET || "test_secret";

// Helper to create tokens
const createToken = (userId) => jwt.sign({ userId }, secretKey);
const ownerToken = createToken(1);
const cleanerToken = createToken(2);

describe("Checklist Router", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /checklist/published", () => {
    it("should return published checklist for authenticated user", async () => {
      const mockVersion = {
        id: 1,
        version: 1,
        snapshotData: {
          sections: [
            {
              id: "section-1",
              title: "Kitchen",
              icon: "K",
              items: [
                { id: "item-1", content: "Clean countertops", indentLevel: 0 },
              ],
            },
          ],
          metadata: { version: 1 },
        },
        isActive: true,
        publishedAt: new Date(),
      };

      User.findByPk.mockResolvedValue({ id: 1, type: "client" });
      ChecklistVersion.findOne.mockResolvedValue(mockVersion);

      const response = await request(app)
        .get("/api/v1/checklist/published")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);
      // Router returns { checklist: snapshotData, version: number, publishedAt }
      expect(response.body.checklist.sections).toHaveLength(1);
      expect(response.body.checklist.sections[0].title).toBe("Kitchen");
      expect(response.body.version).toBe(1);
    });

    it("should return empty checklist if none published", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "client" });
      ChecklistVersion.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/checklist/published")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);
      // Router returns { checklist: null, message: "..." } when no version exists
      expect(response.body.checklist).toBeNull();
      expect(response.body.message).toContain("No checklist");
    });

    it("should return 401 without token", async () => {
      const response = await request(app).get("/api/v1/checklist/published");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /checklist/draft", () => {
    it("should return draft for owner", async () => {
      const mockDraft = {
        id: 1,
        draftData: {
          sections: [
            { id: "s1", title: "Kitchen", items: [] },
          ],
        },
        createdBy: 1,
        updatedAt: new Date(),
      };

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistDraft.findOne.mockResolvedValue(mockDraft);

      const response = await request(app)
        .get("/api/v1/checklist/draft")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      // Router returns { draft: draftData, lastModified, draftId }
      expect(response.body.draft.sections).toHaveLength(1);
      expect(response.body.draftId).toBe(1);
    });

    it("should return empty structure if no draft exists", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistDraft.findOne.mockResolvedValue(null);
      // Router also calls findAll on sections and items when no draft
      ChecklistSection.findAll.mockResolvedValue([]);
      ChecklistItem.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/checklist/draft")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      // Router returns empty structure when no draft and no sections
      expect(response.body.draft.sections).toEqual([]);
      expect(response.body.draftId).toBeNull();
    });

    it("should return 403 for non-owner", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const response = await request(app)
        .get("/api/v1/checklist/draft")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe("PUT /checklist/draft", () => {
    it("should save draft for owner", async () => {
      const draftData = {
        sections: [
          {
            id: "s1",
            title: "Kitchen",
            icon: "K",
            items: [
              { id: "i1", content: "Clean counters", indentLevel: 0 },
            ],
          },
        ],
      };

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistDraft.findOne.mockResolvedValue(null);
      ChecklistDraft.create.mockResolvedValue({
        id: 1,
        draftData,
        createdBy: 1,
      });

      const response = await request(app)
        .put("/api/v1/checklist/draft")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ draftData });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(ChecklistDraft.create).toHaveBeenCalled();
    });

    it("should update existing draft", async () => {
      const draftData = {
        sections: [{ id: "s1", title: "Kitchen Updated", items: [] }],
      };

      const existingDraft = {
        id: 1,
        draftData: { sections: [] },
        update: jest.fn().mockResolvedValue(true),
      };

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistDraft.findOne.mockResolvedValue(existingDraft);

      const response = await request(app)
        .put("/api/v1/checklist/draft")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ draftData });

      expect(response.status).toBe(200);
      // Router also passes createdBy with the update
      expect(existingDraft.update).toHaveBeenCalledWith({
        draftData,
        createdBy: 1,
      });
    });

    it("should return 400 if draftData is missing", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });

      const response = await request(app)
        .put("/api/v1/checklist/draft")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("draftData");
    });

    it("should return 403 for non-owner", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const response = await request(app)
        .put("/api/v1/checklist/draft")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ draftData: { sections: [] } });

      expect(response.status).toBe(403);
    });
  });

  describe("POST /checklist/publish", () => {
    it("should publish draft as new version", async () => {
      const mockDraft = {
        id: 1,
        draftData: {
          sections: [
            { id: "s1", title: "Kitchen", items: [{ id: "i1", content: "Clean" }] },
          ],
        },
      };

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistDraft.findOne.mockResolvedValue(mockDraft);
      // Router uses findOne to get latest version
      ChecklistVersion.findOne.mockResolvedValue({ version: 1 });
      ChecklistVersion.update.mockResolvedValue([1]);
      ChecklistVersion.create.mockResolvedValue({
        id: 2,
        version: 2,
        snapshotData: mockDraft.draftData,
        isActive: true,
        publishedAt: new Date(),
      });

      const response = await request(app)
        .post("/api/v1/checklist/publish")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Router returns version as a number, not an object
      expect(response.body.version).toBe(2);
      expect(ChecklistVersion.update).toHaveBeenCalledWith(
        { isActive: false },
        { where: { isActive: true } }
      );
    });

    it("should create version 1 if no previous versions", async () => {
      const mockDraft = {
        id: 1,
        draftData: { sections: [] },
      };

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistDraft.findOne.mockResolvedValue(mockDraft);
      ChecklistVersion.findOne.mockResolvedValue(null);
      ChecklistVersion.update.mockResolvedValue([0]);
      ChecklistVersion.create.mockResolvedValue({
        id: 1,
        version: 1,
        snapshotData: mockDraft.draftData,
        isActive: true,
        publishedAt: new Date(),
      });

      const response = await request(app)
        .post("/api/v1/checklist/publish")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(ChecklistVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ version: 1 })
      );
    });

    it("should return 400 if no draft exists", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistDraft.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/checklist/publish")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("No draft");
    });

    it("should return 403 for non-owner", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const response = await request(app)
        .post("/api/v1/checklist/publish")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe("GET /checklist/versions", () => {
    it("should return version history for owner", async () => {
      const mockVersions = [
        {
          id: 2,
          version: 2,
          snapshotData: { sections: [{ title: "Kitchen" }] },
          publishedBy: 1,
          publishedAt: new Date(),
          isActive: true,
          publisher: { firstName: "Owner", lastName: "User" },
        },
        {
          id: 1,
          version: 1,
          snapshotData: { sections: [] },
          publishedBy: 1,
          publishedAt: new Date(),
          isActive: false,
          publisher: { firstName: "Owner", lastName: "User" },
        },
      ];

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistVersion.findAll.mockResolvedValue(mockVersions);

      const response = await request(app)
        .get("/api/v1/checklist/versions")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.versions).toHaveLength(2);
      expect(response.body.versions[0].version).toBe(2);
      expect(response.body.versions[0].isActive).toBe(true);
    });

    it("should return empty array if no versions", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistVersion.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/checklist/versions")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.versions).toEqual([]);
    });

    it("should return 403 for non-owner", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const response = await request(app)
        .get("/api/v1/checklist/versions")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe("GET /checklist/versions/:id", () => {
    it("should return specific version for owner", async () => {
      const mockVersion = {
        id: 1,
        version: 1,
        snapshotData: {
          sections: [{ id: "s1", title: "Kitchen", items: [] }],
        },
        publishedBy: 1,
        publishedAt: new Date(),
        isActive: false,
        publisher: { firstName: "Owner", lastName: "User" },
      };

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistVersion.findByPk.mockResolvedValue(mockVersion);

      const response = await request(app)
        .get("/api/v1/checklist/versions/1")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.version).toBe(1);
      // Router returns 'checklist' not 'snapshotData'
      expect(response.body.checklist.sections).toHaveLength(1);
    });

    it("should return 404 if version not found", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistVersion.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/checklist/versions/999")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /checklist/revert/:id", () => {
    it("should revert to previous version by creating draft", async () => {
      const mockVersion = {
        id: 1,
        version: 1,
        snapshotData: {
          sections: [{ id: "s1", title: "Kitchen Old", items: [] }],
        },
      };

      const existingDraft = {
        id: 1,
        update: jest.fn().mockResolvedValue(true),
      };

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistVersion.findByPk.mockResolvedValue(mockVersion);
      ChecklistDraft.findOne.mockResolvedValue(existingDraft);

      const response = await request(app)
        .post("/api/v1/checklist/revert/1")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Check that update was called (router may add createdBy)
      expect(existingDraft.update).toHaveBeenCalled();
      const updateArg = existingDraft.update.mock.calls[0][0];
      expect(updateArg.draftData).toEqual(mockVersion.snapshotData);
    });

    it("should create new draft if none exists", async () => {
      const mockVersion = {
        id: 1,
        version: 1,
        snapshotData: { sections: [] },
      };

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistVersion.findByPk.mockResolvedValue(mockVersion);
      ChecklistDraft.findOne.mockResolvedValue(null);
      ChecklistDraft.create.mockResolvedValue({
        id: 1,
        draftData: mockVersion.snapshotData,
      });

      const response = await request(app)
        .post("/api/v1/checklist/revert/1")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(ChecklistDraft.create).toHaveBeenCalled();
    });

    it("should return 404 if version not found", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistVersion.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/checklist/revert/999")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(404);
    });

    it("should return 403 for non-owner", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const response = await request(app)
        .post("/api/v1/checklist/revert/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe("POST /checklist/seed", () => {
    it("should seed checklist from hardcoded data", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistVersion.count.mockResolvedValue(0); // No existing versions
      ChecklistDraft.create.mockResolvedValue({
        id: 1,
        draftData: { sections: [] },
      });
      ChecklistVersion.create.mockResolvedValue({
        id: 1,
        version: 1,
        isActive: true,
        publishedAt: new Date(),
      });

      const response = await request(app)
        .post("/api/v1/checklist/seed")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("seeded");
    });

    it("should return 400 if checklist already exists", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistVersion.count.mockResolvedValue(1); // Has existing versions

      const response = await request(app)
        .post("/api/v1/checklist/seed")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("already exists");
    });

    it("should return 403 for non-owner", async () => {
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });

      const response = await request(app)
        .post("/api/v1/checklist/seed")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe("Authentication", () => {
    it("should return 403 for invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/checklist/published")
        .set("Authorization", "Bearer invalid_token");

      expect(response.status).toBe(403);
    });

    it("should return 401 for missing Authorization header", async () => {
      const response = await request(app).get("/api/v1/checklist/published");

      expect(response.status).toBe(401);
    });

    it("should return 401 for missing token in Authorization header", async () => {
      const response = await request(app)
        .get("/api/v1/checklist/published")
        .set("Authorization", "Bearer ");

      expect(response.status).toBe(401);
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully on GET /published", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "client" });
      ChecklistVersion.findOne.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .get("/api/v1/checklist/published")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });

    it("should handle database errors gracefully on PUT /draft", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistDraft.findOne.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .put("/api/v1/checklist/draft")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ draftData: { sections: [] } });

      expect(response.status).toBe(500);
    });

    it("should handle database errors gracefully on POST /publish", async () => {
      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistDraft.findOne.mockResolvedValue({ draftData: { sections: [] } });
      // Router uses findOne, not max, to get latest version
      ChecklistVersion.findOne.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .post("/api/v1/checklist/publish")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(500);
    });
  });

  describe("Data Validation", () => {
    it("should accept valid draft data structure", async () => {
      const validDraftData = {
        sections: [
          {
            id: "section-uuid-1",
            title: "Kitchen",
            icon: "K",
            displayOrder: 0,
            items: [
              {
                id: "item-uuid-1",
                content: "Clean countertops",
                displayOrder: 0,
                indentLevel: 0,
                formatting: {
                  bold: false,
                  italic: false,
                  bulletStyle: "disc",
                },
              },
              {
                id: "item-uuid-2",
                content: "Sub-task",
                displayOrder: 1,
                indentLevel: 1,
                formatting: {
                  bold: false,
                  italic: false,
                  bulletStyle: "circle",
                },
              },
            ],
          },
        ],
        metadata: {
          lastModified: new Date().toISOString(),
        },
      };

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistDraft.findOne.mockResolvedValue(null);
      ChecklistDraft.create.mockResolvedValue({
        id: 1,
        draftData: validDraftData,
      });

      const response = await request(app)
        .put("/api/v1/checklist/draft")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ draftData: validDraftData });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should handle nested items with multiple indent levels", async () => {
      const nestedDraftData = {
        sections: [
          {
            id: "s1",
            title: "Section",
            items: [
              { id: "i1", content: "Level 0", indentLevel: 0 },
              { id: "i2", content: "Level 1", indentLevel: 1 },
              { id: "i3", content: "Level 2", indentLevel: 2 },
            ],
          },
        ],
      };

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistDraft.findOne.mockResolvedValue(null);
      ChecklistDraft.create.mockResolvedValue({
        id: 1,
        draftData: nestedDraftData,
      });

      const response = await request(app)
        .put("/api/v1/checklist/draft")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ draftData: nestedDraftData });

      expect(response.status).toBe(200);
    });
  });

  describe("Version Management", () => {
    it("should create new version when publishing", async () => {
      const mockDraft = {
        id: 1,
        draftData: { sections: [] },
      };

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistDraft.findOne.mockResolvedValue(mockDraft);
      ChecklistVersion.findOne.mockResolvedValue({ version: 5 });
      ChecklistVersion.update.mockResolvedValue([1]);
      ChecklistVersion.create.mockResolvedValue({
        id: 6,
        version: 6,
        isActive: true,
        publishedAt: new Date(),
      });

      const response = await request(app)
        .post("/api/v1/checklist/publish")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(ChecklistVersion.create).toHaveBeenCalled();
    });

    it("should deactivate previous versions on publish", async () => {
      const mockDraft = {
        id: 1,
        draftData: { sections: [] },
      };

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistDraft.findOne.mockResolvedValue(mockDraft);
      ChecklistVersion.findOne.mockResolvedValue({ version: 1 });
      ChecklistVersion.update.mockResolvedValue([1]);
      ChecklistVersion.create.mockResolvedValue({
        id: 2,
        version: 2,
        isActive: true,
        publishedAt: new Date(),
      });

      const response = await request(app)
        .post("/api/v1/checklist/publish")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(ChecklistVersion.update).toHaveBeenCalledWith(
        { isActive: false },
        { where: { isActive: true } }
      );
    });
  });

  describe("Multiple Sections and Items", () => {
    it("should handle checklist with many sections and items", async () => {
      const largeDraft = {
        sections: Array.from({ length: 10 }, (_, sIndex) => ({
          id: `section-${sIndex}`,
          title: `Section ${sIndex + 1}`,
          icon: String.fromCharCode(65 + sIndex),
          items: Array.from({ length: 20 }, (_, iIndex) => ({
            id: `item-${sIndex}-${iIndex}`,
            content: `Task ${iIndex + 1} in Section ${sIndex + 1}`,
            indentLevel: iIndex % 3,
          })),
        })),
      };

      User.findByPk.mockResolvedValue({ id: 1, type: "owner" });
      ChecklistDraft.findOne.mockResolvedValue(null);
      ChecklistDraft.create.mockResolvedValue({
        id: 1,
        draftData: largeDraft,
      });

      const response = await request(app)
        .put("/api/v1/checklist/draft")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ draftData: largeDraft });

      expect(response.status).toBe(200);
    });
  });
});
