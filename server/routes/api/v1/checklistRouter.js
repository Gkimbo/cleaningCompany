const express = require("express");
const jwt = require("jsonwebtoken");
const {
  ChecklistSection,
  ChecklistItem,
  ChecklistDraft,
  ChecklistVersion,
  User,
} = require("../../../models");
const { getEditorFormat, getTemplateStats } = require("../../../data/checklistTemplate");

const checklistRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Hardcoded checklist data for seeding
const SEED_CHECKLIST = {
  kitchen: {
    title: "Kitchen",
    icon: "K",
    tasks: [
      { id: "k1", task: "Clean all countertops and backsplash" },
      { id: "k2", task: "Clean inside and outside of microwave" },
      { id: "k3", task: "Clean inside and outside of oven" },
      { id: "k4", task: "Clean stovetop and burners" },
      { id: "k5", task: "Wipe down all cabinet fronts" },
      { id: "k6", task: "Clean refrigerator exterior" },
      { id: "k7", task: "Clean and sanitize sink" },
      { id: "k8", task: "Clean faucet and handles (remove water spots)" },
      { id: "k9", task: "Restock coffee supplies (coffee, creamer, filters)" },
      { id: "k10", task: "Restock paper towels" },
      { id: "k11", task: "Empty trash can and insert new trash bag" },
      { id: "k12", task: "Clean dishwasher exterior" },
      { id: "k13", task: "Dust light fixtures and ceiling fans" },
      { id: "k14", task: "Vacuum floor including corners and crevices" },
      { id: "k15", task: "Mop entire floor" },
    ],
  },
  bathrooms: {
    title: "Bathrooms",
    icon: "B",
    tasks: [
      { id: "b1", task: "Clean and sanitize toilet (inside bowl, seat, base)" },
      { id: "b2", task: "Remove ALL hair from toilet area" },
      { id: "b3", task: "Clean shower/tub thoroughly (walls, floor, door)" },
      { id: "b4", task: "Remove soap scum and mildew from shower" },
      { id: "b5", task: "Clean shower drain - remove hair buildup" },
      { id: "b6", task: "Clean and polish sink" },
      { id: "b7", task: "Clean sink drain - remove hair" },
      { id: "b8", task: "Clean faucet and handles (remove water spots)" },
      { id: "b9", task: "Clean and polish mirrors" },
      { id: "b10", task: "Wipe down all countertops" },
      { id: "b11", task: "Clean cabinet fronts" },
      { id: "b12", task: "Restock toilet paper (at least 2 rolls visible)" },
      { id: "b13", task: "Empty trash can and insert new trash bag" },
      { id: "b14", task: "Replace/arrange towels neatly" },
      { id: "b15", task: "Dust light fixtures and exhaust fan" },
      { id: "b16", task: "Vacuum floor including corners and behind toilet" },
      { id: "b17", task: "Mop entire floor" },
      { id: "b18", task: "Check for and remove hair from ALL surfaces" },
    ],
  },
  bedrooms: {
    title: "Bedrooms",
    icon: "BR",
    tasks: [
      { id: "br1", task: "Strip all bedding (sheets, pillowcases)" },
      { id: "br2", task: "Make bed with fresh sheets" },
      { id: "br3", task: "Fluff and arrange pillows" },
      { id: "br4", task: "Arrange decorative pillows/throws" },
      { id: "br5", task: "Dust all surfaces (nightstands, dressers)" },
      { id: "br6", task: "Dust headboard and bed frame" },
      { id: "br7", task: "Dust lamps and light fixtures" },
      { id: "br8", task: "Dust ceiling fan blades" },
      { id: "br9", task: "Clean mirrors" },
      { id: "br10", task: "Wipe down door handles" },
      { id: "br11", task: "Dust window sills and blinds" },
      { id: "br12", task: "Empty trash cans and insert new trash bags" },
      { id: "br13", task: "Vacuum entire floor" },
      { id: "br14", task: "Vacuum corners, edges, and under furniture" },
      { id: "br15", task: "Vacuum closet floor" },
    ],
  },
  livingAreas: {
    title: "Living Areas",
    icon: "L",
    tasks: [
      { id: "l1", task: "Dust all surfaces (tables, shelves, entertainment center)" },
      { id: "l2", task: "Dust TV screen (dry microfiber only)" },
      { id: "l3", task: "Dust electronics and remotes" },
      { id: "l4", task: "Dust decorative items and picture frames" },
      { id: "l5", task: "Dust ceiling fan blades" },
      { id: "l6", task: "Dust light fixtures and lamps" },
      { id: "l7", task: "Dust window sills and blinds" },
      { id: "l8", task: "Fluff and arrange couch cushions" },
      { id: "l9", task: "Wipe down door handles" },
      { id: "l10", task: "Clean mirrors and glass surfaces" },
      { id: "l11", task: "Empty trash cans and insert new trash bags" },
      { id: "l12", task: "Vacuum entire floor" },
      { id: "l13", task: "Vacuum corners, edges, and crevices" },
      { id: "l14", task: "Vacuum under furniture (where accessible)" },
      { id: "l15", task: "Mop hard floors" },
    ],
  },
  general: {
    title: "General/Final Walkthrough",
    icon: "G",
    tasks: [
      { id: "g1", task: "Dust all baseboards throughout home" },
      { id: "g2", task: "Dust stair railings (if applicable)" },
      { id: "g3", task: "Clean all door handles throughout home" },
      { id: "g4", task: "Clean light switches and outlets" },
      { id: "g5", task: "Remove cobwebs from corners and ceilings" },
      { id: "g6", task: "Verify all trash cans have new bags inserted" },
      { id: "g7", task: "Take all trash/recycling/compost to designated locations" },
      { id: "g8", task: "Check all lights are off (except entry)" },
      { id: "g9", task: "Lock all doors and windows" },
      { id: "g10", task: "Final walkthrough - no items left behind" },
    ],
  },
};

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid token" });
  }
};

// Middleware to check if user is an owner
const requireOwner = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user || user.type !== "owner") {
      return res.status(403).json({ error: "Owner access required" });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: "Failed to verify permissions" });
  }
};

// Helper to convert database records to nested JSON format
const buildChecklistJSON = (sections, items) => {
  const result = {
    sections: [],
    metadata: {
      lastModified: new Date().toISOString(),
    },
  };

  for (const section of sections) {
    const sectionItems = items
      .filter((item) => item.sectionId === section.id && item.parentId === null)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const buildItemTree = (parentItems) => {
      return parentItems.map((item) => {
        const children = items
          .filter((child) => child.parentId === item.id)
          .sort((a, b) => a.displayOrder - b.displayOrder);

        return {
          id: item.id.toString(),
          content: item.content,
          displayOrder: item.displayOrder,
          indentLevel: item.indentLevel,
          formatting: item.formatting || { bold: false, italic: false, bulletStyle: "disc" },
          children: buildItemTree(children),
        };
      });
    };

    result.sections.push({
      id: section.id.toString(),
      title: section.title,
      icon: section.icon,
      displayOrder: section.displayOrder,
      items: buildItemTree(sectionItems),
    });
  }

  result.sections.sort((a, b) => a.displayOrder - b.displayOrder);
  return result;
};

/**
 * Get published checklist (for cleaners)
 * GET /api/v1/checklist/published
 */
checklistRouter.get("/published", authenticateToken, async (req, res) => {
  try {
    // Get the active published version
    const activeVersion = await ChecklistVersion.findOne({
      where: { isActive: true },
      order: [["version", "DESC"]],
    });

    if (!activeVersion) {
      // No published version, return empty
      return res.json({
        checklist: null,
        message: "No checklist published yet",
      });
    }

    return res.json({
      checklist: activeVersion.snapshotData,
      version: activeVersion.version,
      publishedAt: activeVersion.publishedAt,
    });
  } catch (error) {
    console.error("Error fetching published checklist:", error);
    return res.status(500).json({ error: "Failed to fetch checklist" });
  }
});

/**
 * Get owner's current draft
 * GET /api/v1/checklist/draft
 */
checklistRouter.get("/draft", authenticateToken, requireOwner, async (req, res) => {
  try {
    // Get the latest draft
    const draft = await ChecklistDraft.findOne({
      order: [["updatedAt", "DESC"]],
    });

    if (draft) {
      return res.json({
        draft: draft.draftData,
        lastModified: draft.updatedAt,
        draftId: draft.id,
      });
    }

    // No draft exists, build from current database records
    const sections = await ChecklistSection.findAll({
      order: [["displayOrder", "ASC"]],
    });

    const items = await ChecklistItem.findAll({
      where: { isActive: true },
      order: [["displayOrder", "ASC"]],
    });

    if (sections.length === 0) {
      // No data at all, return empty structure
      return res.json({
        draft: {
          sections: [],
          metadata: { lastModified: new Date().toISOString() },
        },
        lastModified: null,
        draftId: null,
      });
    }

    const checklistData = buildChecklistJSON(sections, items);

    return res.json({
      draft: checklistData,
      lastModified: null,
      draftId: null,
    });
  } catch (error) {
    console.error("Error fetching draft:", error);
    return res.status(500).json({ error: "Failed to fetch draft" });
  }
});

/**
 * Save draft (auto-save)
 * PUT /api/v1/checklist/draft
 */
checklistRouter.put("/draft", authenticateToken, requireOwner, async (req, res) => {
  const { draftData } = req.body;

  if (!draftData) {
    return res.status(400).json({ error: "draftData is required" });
  }

  try {
    // Get existing draft or create new one
    let draft = await ChecklistDraft.findOne({
      order: [["updatedAt", "DESC"]],
    });

    if (draft) {
      await draft.update({
        draftData,
        createdBy: req.user.userId,
      });
    } else {
      draft = await ChecklistDraft.create({
        draftData,
        createdBy: req.user.userId,
      });
    }

    return res.json({
      success: true,
      message: "Draft saved",
      draftId: draft.id,
      lastModified: draft.updatedAt,
    });
  } catch (error) {
    console.error("Error saving draft:", error);
    return res.status(500).json({ error: "Failed to save draft" });
  }
});

/**
 * Publish draft as new version
 * POST /api/v1/checklist/publish
 */
checklistRouter.post("/publish", authenticateToken, requireOwner, async (req, res) => {
  try {
    // Get the current draft
    const draft = await ChecklistDraft.findOne({
      order: [["updatedAt", "DESC"]],
    });

    if (!draft) {
      return res.status(400).json({ error: "No draft to publish" });
    }

    // Get the next version number
    const latestVersion = await ChecklistVersion.findOne({
      order: [["version", "DESC"]],
    });
    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

    // Deactivate all previous versions
    await ChecklistVersion.update(
      { isActive: false },
      { where: { isActive: true } }
    );

    // Create new version
    const newVersion = await ChecklistVersion.create({
      version: nextVersion,
      snapshotData: draft.draftData,
      publishedBy: req.user.userId,
      publishedAt: new Date(),
      isActive: true,
    });

    // Update database tables from draft data
    // First, clear existing data
    await ChecklistItem.destroy({ where: {} });
    await ChecklistSection.destroy({ where: {} });

    // Recreate from draft
    const draftData = draft.draftData;
    for (const sectionData of draftData.sections || []) {
      const section = await ChecklistSection.create({
        title: sectionData.title,
        icon: sectionData.icon,
        displayOrder: sectionData.displayOrder,
      });

      const createItems = async (items, parentId = null) => {
        for (const itemData of items) {
          const item = await ChecklistItem.create({
            sectionId: section.id,
            parentId,
            content: itemData.content,
            displayOrder: itemData.displayOrder,
            indentLevel: itemData.indentLevel || 0,
            formatting: itemData.formatting || { bold: false, italic: false, bulletStyle: "disc" },
            isActive: true,
          });

          if (itemData.children && itemData.children.length > 0) {
            await createItems(itemData.children, item.id);
          }
        }
      };

      await createItems(sectionData.items || []);
    }

    return res.json({
      success: true,
      message: "Checklist published successfully",
      version: newVersion.version,
      publishedAt: newVersion.publishedAt,
    });
  } catch (error) {
    console.error("Error publishing checklist:", error);
    return res.status(500).json({ error: "Failed to publish checklist" });
  }
});

/**
 * Get version history
 * GET /api/v1/checklist/versions
 */
checklistRouter.get("/versions", authenticateToken, requireOwner, async (req, res) => {
  try {
    const versions = await ChecklistVersion.findAll({
      order: [["version", "DESC"]],
      include: [
        {
          model: User,
          as: "publisher",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    return res.json({
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        publishedAt: v.publishedAt,
        publishedBy: v.publisher
          ? `${v.publisher.firstName} ${v.publisher.lastName}`
          : "Unknown",
        isActive: v.isActive,
        sectionsCount: v.snapshotData?.sections?.length || 0,
        itemsCount: v.snapshotData?.sections?.reduce(
          (sum, s) => sum + (s.items?.length || 0),
          0
        ) || 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching version history:", error);
    return res.status(500).json({ error: "Failed to fetch version history" });
  }
});

/**
 * Get specific version
 * GET /api/v1/checklist/versions/:id
 */
checklistRouter.get("/versions/:id", authenticateToken, requireOwner, async (req, res) => {
  const { id } = req.params;

  try {
    const version = await ChecklistVersion.findByPk(id, {
      include: [
        {
          model: User,
          as: "publisher",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }

    return res.json({
      id: version.id,
      version: version.version,
      publishedAt: version.publishedAt,
      publishedBy: version.publisher
        ? `${version.publisher.firstName} ${version.publisher.lastName}`
        : "Unknown",
      isActive: version.isActive,
      checklist: version.snapshotData,
    });
  } catch (error) {
    console.error("Error fetching version:", error);
    return res.status(500).json({ error: "Failed to fetch version" });
  }
});

/**
 * Revert to a previous version
 * POST /api/v1/checklist/revert/:id
 */
checklistRouter.post("/revert/:id", authenticateToken, requireOwner, async (req, res) => {
  const { id } = req.params;

  try {
    const version = await ChecklistVersion.findByPk(id);

    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }

    // Update or create a new draft with the old version's data
    let draft = await ChecklistDraft.findOne({
      order: [["updatedAt", "DESC"]],
    });

    if (draft) {
      await draft.update({
        draftData: version.snapshotData,
        createdBy: req.user.userId,
      });
    } else {
      draft = await ChecklistDraft.create({
        draftData: version.snapshotData,
        createdBy: req.user.userId,
      });
    }

    return res.json({
      success: true,
      message: `Reverted to version ${version.version}. Draft updated - publish to make active.`,
      draftId: draft.id,
      revertedToVersion: version.version,
    });
  } catch (error) {
    console.error("Error reverting version:", error);
    return res.status(500).json({ error: "Failed to revert version" });
  }
});

/**
 * Seed checklist from hardcoded data
 * POST /api/v1/checklist/seed
 */
checklistRouter.post("/seed", authenticateToken, requireOwner, async (req, res) => {
  try {
    // Check if data already exists
    const existingVersions = await ChecklistVersion.count();
    if (existingVersions > 0) {
      return res.status(400).json({
        error: "Checklist data already exists. Use the editor to make changes.",
      });
    }

    // Convert seed data to JSON format
    const sections = [];
    let sectionOrder = 0;

    for (const [key, sectionData] of Object.entries(SEED_CHECKLIST)) {
      const items = sectionData.tasks.map((task, index) => ({
        id: task.id,
        content: task.task,
        displayOrder: index,
        indentLevel: 0,
        formatting: { bold: false, italic: false, bulletStyle: "disc" },
        children: [],
      }));

      sections.push({
        id: key,
        title: sectionData.title,
        icon: sectionData.icon,
        displayOrder: sectionOrder++,
        items,
      });
    }

    const checklistData = {
      sections,
      metadata: {
        lastModified: new Date().toISOString(),
        seedVersion: true,
      },
    };

    // Create initial draft
    const draft = await ChecklistDraft.create({
      draftData: checklistData,
      createdBy: req.user.userId,
    });

    // Create and publish as version 1
    const version = await ChecklistVersion.create({
      version: 1,
      snapshotData: checklistData,
      publishedBy: req.user.userId,
      publishedAt: new Date(),
      isActive: true,
    });

    // Populate database tables
    for (const sectionData of checklistData.sections) {
      const section = await ChecklistSection.create({
        title: sectionData.title,
        icon: sectionData.icon,
        displayOrder: sectionData.displayOrder,
      });

      for (const itemData of sectionData.items) {
        await ChecklistItem.create({
          sectionId: section.id,
          parentId: null,
          content: itemData.content,
          displayOrder: itemData.displayOrder,
          indentLevel: itemData.indentLevel,
          formatting: itemData.formatting,
          isActive: true,
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: "Checklist seeded successfully from hardcoded data",
      version: version.version,
      sectionsCount: sections.length,
      itemsCount: sections.reduce((sum, s) => sum + s.items.length, 0),
    });
  } catch (error) {
    console.error("Error seeding checklist:", error);
    return res.status(500).json({ error: "Failed to seed checklist" });
  }
});

/**
 * Get the checklist template data (from seeder)
 * GET /api/v1/checklist/template
 */
checklistRouter.get("/template", authenticateToken, requireOwner, async (req, res) => {
  try {
    const templateData = getEditorFormat();
    const stats = getTemplateStats();

    return res.json({
      success: true,
      template: templateData,
      stats,
    });
  } catch (error) {
    console.error("Error getting checklist template:", error);
    return res.status(500).json({ error: "Failed to get checklist template" });
  }
});

/**
 * Load template into current draft (replaces current draft)
 * POST /api/v1/checklist/load-template
 */
checklistRouter.post("/load-template", authenticateToken, requireOwner, async (req, res) => {
  try {
    const templateData = getEditorFormat();
    const stats = getTemplateStats();

    // Get existing draft or create new one
    let draft = await ChecklistDraft.findOne({
      order: [["updatedAt", "DESC"]],
    });

    if (draft) {
      await draft.update({
        draftData: templateData,
        createdBy: req.user.userId,
      });
    } else {
      draft = await ChecklistDraft.create({
        draftData: templateData,
        createdBy: req.user.userId,
      });
    }

    return res.json({
      success: true,
      message: "Template loaded successfully",
      draftId: draft.id,
      lastModified: draft.updatedAt,
      stats,
    });
  } catch (error) {
    console.error("Error loading checklist template:", error);
    return res.status(500).json({ error: "Failed to load checklist template" });
  }
});

module.exports = checklistRouter;
