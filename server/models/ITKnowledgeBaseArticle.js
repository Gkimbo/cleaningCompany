/**
 * IT Knowledge Base Article Model
 * For internal IT documentation and guides
 */
module.exports = (sequelize, DataTypes) => {
  const ITKnowledgeBaseArticle = sequelize.define("ITKnowledgeBaseArticle", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    // Article content
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true,
      comment: "URL-friendly identifier",
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Brief description for search results",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Markdown content",
    },
    // Categorization
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "general",
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    // Related dispute categories
    relatedCategories: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: "IT dispute categories this article helps with",
    },
    // Visibility
    isPublished: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Access control
    visibleToRoles: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: ["it", "owner"],
      comment: "User types that can view this article",
    },
    // Usage tracking
    viewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    helpfulCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    notHelpfulCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // Versioning
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    // Authorship
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    lastUpdatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    // Pinned/featured
    isPinned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    pinnedOrder: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  });

  ITKnowledgeBaseArticle.associate = (models) => {
    ITKnowledgeBaseArticle.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "author",
    });
    ITKnowledgeBaseArticle.belongsTo(models.User, {
      foreignKey: "lastUpdatedBy",
      as: "lastEditor",
    });
  };

  // Generate slug before create
  ITKnowledgeBaseArticle.beforeCreate((article) => {
    if (!article.slug && article.title) {
      article.slug = article.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }
  });

  return ITKnowledgeBaseArticle;
};
