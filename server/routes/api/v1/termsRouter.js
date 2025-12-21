const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { TermsAndConditions, UserTermsAcceptance, User } = require("../../../models");

const termsRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.body.type || "homeowner";
    const uploadDir = path.join(__dirname, "../../../public/uploads/terms", type);

    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const version = req.nextVersion || 1;
    cb(null, `v${version}_terms_${timestamp}.pdf`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

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

// Middleware to check if user is a manager
const requireManager = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user || user.type !== "admin") {
      return res.status(403).json({ error: "Manager access required" });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: "Failed to verify permissions" });
  }
};

// Helper to get next version number
const getNextVersion = async (type) => {
  const latest = await TermsAndConditions.findOne({
    where: { type },
    order: [["version", "DESC"]],
  });
  return latest ? latest.version + 1 : 1;
};

/**
 * Get current T&C for a type (public - no auth required)
 * GET /api/v1/terms/current/:type
 */
termsRouter.get("/current/:type", async (req, res) => {
  const { type } = req.params;

  if (!["homeowner", "cleaner"].includes(type)) {
    return res.status(400).json({ error: "Type must be 'homeowner' or 'cleaner'" });
  }

  try {
    const terms = await TermsAndConditions.findOne({
      where: { type },
      order: [["version", "DESC"]],
      attributes: ["id", "type", "version", "title", "content", "contentType", "pdfFileName", "effectiveDate"],
    });

    if (!terms) {
      return res.json({ terms: null, message: "No terms available yet" });
    }

    // If PDF, include the URL to fetch it
    const response = {
      id: terms.id,
      type: terms.type,
      version: terms.version,
      title: terms.title,
      contentType: terms.contentType,
      effectiveDate: terms.effectiveDate,
    };

    if (terms.contentType === "text") {
      response.content = terms.content;
    } else {
      response.pdfFileName = terms.pdfFileName;
      response.pdfUrl = `/api/v1/terms/pdf/${terms.id}`;
    }

    return res.json({ terms: response });
  } catch (error) {
    console.error("Error fetching current terms:", error);
    return res.status(500).json({ error: "Failed to fetch terms" });
  }
});

/**
 * Check if user needs to accept new terms
 * GET /api/v1/terms/check
 */
termsRouter.get("/check", authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Determine user type for terms
    const termsType = user.type === "employee" ? "cleaner" : "homeowner";

    // Get current terms for this user type
    const currentTerms = await TermsAndConditions.findOne({
      where: { type: termsType },
      order: [["version", "DESC"]],
    });

    if (!currentTerms) {
      // No terms exist yet - no acceptance needed
      return res.json({
        requiresAcceptance: false,
        message: "No terms configured yet",
      });
    }

    // Check if user has accepted the current version
    const userVersion = user.termsAcceptedVersion;
    const requiresAcceptance = !userVersion || userVersion < currentTerms.version;

    const response = {
      requiresAcceptance,
      currentVersion: currentTerms.version,
      acceptedVersion: userVersion,
    };

    if (requiresAcceptance) {
      response.terms = {
        id: currentTerms.id,
        type: currentTerms.type,
        version: currentTerms.version,
        title: currentTerms.title,
        contentType: currentTerms.contentType,
        effectiveDate: currentTerms.effectiveDate,
      };

      if (currentTerms.contentType === "text") {
        response.terms.content = currentTerms.content;
      } else {
        response.terms.pdfFileName = currentTerms.pdfFileName;
        response.terms.pdfUrl = `/api/v1/terms/pdf/${currentTerms.id}`;
      }
    }

    return res.json(response);
  } catch (error) {
    console.error("Error checking terms status:", error);
    return res.status(500).json({ error: "Failed to check terms status" });
  }
});

/**
 * Accept T&C
 * POST /api/v1/terms/accept
 */
termsRouter.post("/accept", authenticateToken, async (req, res) => {
  const { termsId } = req.body;
  const userId = req.user.userId;

  if (!termsId) {
    return res.status(400).json({ error: "termsId is required" });
  }

  try {
    const terms = await TermsAndConditions.findByPk(termsId);
    if (!terms) {
      return res.status(404).json({ error: "Terms not found" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Create snapshot for text content
    let termsContentSnapshot = null;
    let pdfSnapshotPath = null;

    if (terms.contentType === "text") {
      termsContentSnapshot = terms.content;
    } else if (terms.pdfFilePath) {
      // Copy PDF to snapshots folder
      const snapshotsDir = path.join(
        __dirname,
        "../../../public/uploads/terms",
        terms.type,
        "snapshots"
      );

      if (!fs.existsSync(snapshotsDir)) {
        fs.mkdirSync(snapshotsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
      const snapshotFilename = `user_${userId}_v${terms.version}_${timestamp}.pdf`;
      pdfSnapshotPath = path.join(snapshotsDir, snapshotFilename);

      // Copy the file
      if (fs.existsSync(terms.pdfFilePath)) {
        fs.copyFileSync(terms.pdfFilePath, pdfSnapshotPath);
      }
    }

    // Get client IP
    const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Create acceptance record
    await UserTermsAcceptance.create({
      userId,
      termsId,
      acceptedAt: new Date(),
      ipAddress,
      termsContentSnapshot,
      pdfSnapshotPath,
    });

    // Update user's accepted version
    await user.update({ termsAcceptedVersion: terms.version });

    return res.json({
      success: true,
      message: "Terms accepted successfully",
      acceptedVersion: terms.version,
    });
  } catch (error) {
    console.error("Error accepting terms:", error);
    return res.status(500).json({ error: "Failed to accept terms" });
  }
});

/**
 * Get version history (manager only)
 * GET /api/v1/terms/history/:type
 */
termsRouter.get("/history/:type", authenticateToken, requireManager, async (req, res) => {
  const { type } = req.params;

  if (!["homeowner", "cleaner"].includes(type)) {
    return res.status(400).json({ error: "Type must be 'homeowner' or 'cleaner'" });
  }

  try {
    const history = await TermsAndConditions.findAll({
      where: { type },
      order: [["version", "DESC"]],
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    return res.json({
      type,
      versions: history.map((t) => ({
        id: t.id,
        version: t.version,
        title: t.title,
        contentType: t.contentType,
        effectiveDate: t.effectiveDate,
        createdAt: t.createdAt,
        createdBy: t.creator
          ? `${t.creator.firstName} ${t.creator.lastName}`
          : "Unknown",
        pdfFileName: t.pdfFileName,
        pdfUrl: t.contentType === "pdf" ? `/api/v1/terms/pdf/${t.id}` : null,
      })),
    });
  } catch (error) {
    console.error("Error fetching terms history:", error);
    return res.status(500).json({ error: "Failed to fetch terms history" });
  }
});

/**
 * Create new T&C version (text) - Manager only
 * POST /api/v1/terms
 */
termsRouter.post("/", authenticateToken, requireManager, async (req, res) => {
  const { type, title, content, effectiveDate } = req.body;

  if (!type || !title || !content) {
    return res.status(400).json({ error: "type, title, and content are required" });
  }

  if (!["homeowner", "cleaner"].includes(type)) {
    return res.status(400).json({ error: "Type must be 'homeowner' or 'cleaner'" });
  }

  try {
    const version = await getNextVersion(type);

    const terms = await TermsAndConditions.create({
      type,
      version,
      title,
      content,
      contentType: "text",
      effectiveDate: effectiveDate || new Date(),
      createdBy: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Terms created successfully",
      terms: {
        id: terms.id,
        type: terms.type,
        version: terms.version,
        title: terms.title,
        contentType: terms.contentType,
        effectiveDate: terms.effectiveDate,
      },
    });
  } catch (error) {
    console.error("Error creating terms:", error);
    return res.status(500).json({ error: "Failed to create terms" });
  }
});

/**
 * Upload PDF for new T&C version - Manager only
 * POST /api/v1/terms/upload-pdf
 */
termsRouter.post(
  "/upload-pdf",
  authenticateToken,
  requireManager,
  async (req, res, next) => {
    // First get the next version before multer processes the file
    try {
      const type = req.body.type || req.query.type || "homeowner";
      req.nextVersion = await getNextVersion(type);
      next();
    } catch (error) {
      return res.status(500).json({ error: "Failed to determine version" });
    }
  },
  upload.single("pdf"),
  async (req, res) => {
    const { type, title, effectiveDate } = req.body;

    if (!type || !title) {
      return res.status(400).json({ error: "type and title are required" });
    }

    if (!["homeowner", "cleaner"].includes(type)) {
      return res.status(400).json({ error: "Type must be 'homeowner' or 'cleaner'" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "PDF file is required" });
    }

    try {
      const version = req.nextVersion;

      const terms = await TermsAndConditions.create({
        type,
        version,
        title,
        contentType: "pdf",
        pdfFileName: req.file.originalname,
        pdfFilePath: req.file.path,
        pdfFileSize: req.file.size,
        effectiveDate: effectiveDate || new Date(),
        createdBy: req.user.userId,
      });

      return res.status(201).json({
        success: true,
        message: "Terms PDF uploaded successfully",
        terms: {
          id: terms.id,
          type: terms.type,
          version: terms.version,
          title: terms.title,
          contentType: terms.contentType,
          pdfFileName: terms.pdfFileName,
          pdfUrl: `/api/v1/terms/pdf/${terms.id}`,
          effectiveDate: terms.effectiveDate,
        },
      });
    } catch (error) {
      console.error("Error uploading terms PDF:", error);
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ error: "Failed to upload terms PDF" });
    }
  }
);

/**
 * Download/view PDF file (public)
 * GET /api/v1/terms/pdf/:id
 */
termsRouter.get("/pdf/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const terms = await TermsAndConditions.findByPk(id);
    if (!terms) {
      return res.status(404).json({ error: "Terms not found" });
    }

    if (terms.contentType !== "pdf" || !terms.pdfFilePath) {
      return res.status(400).json({ error: "This terms version is not a PDF" });
    }

    if (!fs.existsSync(terms.pdfFilePath)) {
      return res.status(404).json({ error: "PDF file not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${terms.pdfFileName}"`
    );

    const fileStream = fs.createReadStream(terms.pdfFilePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error serving PDF:", error);
    return res.status(500).json({ error: "Failed to serve PDF" });
  }
});

/**
 * Get user's acceptance record - Manager only
 * GET /api/v1/terms/user-acceptance/:userId
 */
termsRouter.get(
  "/user-acceptance/:userId",
  authenticateToken,
  requireManager,
  async (req, res) => {
    const { userId } = req.params;

    try {
      const user = await User.findByPk(userId, {
        attributes: ["id", "firstName", "lastName", "email", "type", "termsAcceptedVersion"],
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const acceptances = await UserTermsAcceptance.findAll({
        where: { userId },
        include: [
          {
            model: TermsAndConditions,
            as: "terms",
            attributes: ["id", "type", "version", "title", "contentType"],
          },
        ],
        order: [["acceptedAt", "DESC"]],
      });

      return res.json({
        user: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          type: user.type,
          currentAcceptedVersion: user.termsAcceptedVersion,
        },
        acceptances: acceptances.map((a) => ({
          id: a.id,
          termsId: a.termsId,
          termsVersion: a.terms?.version,
          termsTitle: a.terms?.title,
          termsType: a.terms?.type,
          contentType: a.terms?.contentType,
          acceptedAt: a.acceptedAt,
          ipAddress: a.ipAddress,
          hasSnapshot: !!(a.termsContentSnapshot || a.pdfSnapshotPath),
          snapshotUrl: a.pdfSnapshotPath
            ? `/api/v1/terms/acceptance-snapshot/${a.id}`
            : null,
        })),
      });
    } catch (error) {
      console.error("Error fetching user acceptance:", error);
      return res.status(500).json({ error: "Failed to fetch user acceptance" });
    }
  }
);

/**
 * Get the exact terms content that a user agreed to - Manager only
 * GET /api/v1/terms/acceptance-snapshot/:acceptanceId
 */
termsRouter.get(
  "/acceptance-snapshot/:acceptanceId",
  authenticateToken,
  requireManager,
  async (req, res) => {
    const { acceptanceId } = req.params;

    try {
      const acceptance = await UserTermsAcceptance.findByPk(acceptanceId, {
        include: [
          {
            model: TermsAndConditions,
            as: "terms",
            attributes: ["id", "type", "version", "title", "contentType"],
          },
          {
            model: User,
            as: "user",
            attributes: ["id", "firstName", "lastName", "email"],
          },
        ],
      });

      if (!acceptance) {
        return res.status(404).json({ error: "Acceptance record not found" });
      }

      // Check if this is a PDF or text snapshot
      if (acceptance.terms?.contentType === "pdf" && acceptance.pdfSnapshotPath) {
        // Serve the PDF file
        if (!fs.existsSync(acceptance.pdfSnapshotPath)) {
          return res.status(404).json({ error: "PDF snapshot file not found" });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `inline; filename="terms_accepted_by_${acceptance.user?.firstName}_${acceptance.user?.lastName}_v${acceptance.terms?.version}.pdf"`
        );

        const fileStream = fs.createReadStream(acceptance.pdfSnapshotPath);
        fileStream.pipe(res);
      } else {
        // Return text content as JSON
        return res.json({
          acceptance: {
            id: acceptance.id,
            acceptedAt: acceptance.acceptedAt,
            ipAddress: acceptance.ipAddress,
          },
          user: {
            id: acceptance.user?.id,
            name: `${acceptance.user?.firstName} ${acceptance.user?.lastName}`,
            email: acceptance.user?.email,
          },
          terms: {
            id: acceptance.terms?.id,
            type: acceptance.terms?.type,
            version: acceptance.terms?.version,
            title: acceptance.terms?.title,
            contentType: acceptance.terms?.contentType,
          },
          snapshot: {
            contentType: "text",
            content: acceptance.termsContentSnapshot,
          },
        });
      }
    } catch (error) {
      console.error("Error fetching acceptance snapshot:", error);
      return res.status(500).json({ error: "Failed to fetch acceptance snapshot" });
    }
  }
);

/**
 * Get all acceptance records for a specific terms version - Manager only
 * Useful for auditing who accepted a particular version
 * GET /api/v1/terms/:termsId/acceptances
 */
termsRouter.get(
  "/:termsId/acceptances",
  authenticateToken,
  requireManager,
  async (req, res) => {
    const { termsId } = req.params;

    try {
      const terms = await TermsAndConditions.findByPk(termsId);
      if (!terms) {
        return res.status(404).json({ error: "Terms not found" });
      }

      const acceptances = await UserTermsAcceptance.findAll({
        where: { termsId },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "firstName", "lastName", "email", "type"],
          },
        ],
        order: [["acceptedAt", "DESC"]],
      });

      return res.json({
        terms: {
          id: terms.id,
          type: terms.type,
          version: terms.version,
          title: terms.title,
          contentType: terms.contentType,
          effectiveDate: terms.effectiveDate,
        },
        totalAcceptances: acceptances.length,
        acceptances: acceptances.map((a) => ({
          id: a.id,
          user: {
            id: a.user?.id,
            name: `${a.user?.firstName} ${a.user?.lastName}`,
            email: a.user?.email,
            type: a.user?.type,
          },
          acceptedAt: a.acceptedAt,
          ipAddress: a.ipAddress,
          hasSnapshot: !!(a.termsContentSnapshot || a.pdfSnapshotPath),
        })),
      });
    } catch (error) {
      console.error("Error fetching terms acceptances:", error);
      return res.status(500).json({ error: "Failed to fetch terms acceptances" });
    }
  }
);

module.exports = termsRouter;
