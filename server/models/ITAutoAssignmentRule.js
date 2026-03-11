module.exports = (sequelize, DataTypes) => {
  const ITAutoAssignmentRule = sequelize.define("ITAutoAssignmentRule", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Rule conditions
    conditions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: "Conditions that trigger this rule: {category, priority, reporterType, etc.}",
    },
    // Assignment target
    assignToUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      comment: "Specific user to assign to",
    },
    assignmentStrategy: {
      type: DataTypes.ENUM("specific_user", "round_robin", "least_loaded", "random"),
      allowNull: false,
      defaultValue: "specific_user",
      comment: "How to determine assignee when not a specific user",
    },
    // Pool of users for round_robin/least_loaded/random strategies
    assignmentPool: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: "Array of user IDs to choose from for non-specific strategies",
    },
    // Round robin tracking
    lastAssignedIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Index for round robin assignment",
    },
    // Rule ordering and status
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
      comment: "Lower numbers = higher priority. Rules evaluated in order.",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    // Tracking
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    triggerCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "How many times this rule has been triggered",
    },
    lastTriggeredAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  ITAutoAssignmentRule.associate = (models) => {
    ITAutoAssignmentRule.belongsTo(models.User, {
      foreignKey: "assignToUserId",
      as: "assignee",
    });
    ITAutoAssignmentRule.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });
    ITAutoAssignmentRule.belongsTo(models.User, {
      foreignKey: "updatedBy",
      as: "updater",
    });
  };

  /**
   * Check if this rule matches the given dispute
   */
  ITAutoAssignmentRule.prototype.matchesDispute = function (dispute) {
    const conditions = this.conditions || {};

    // Check category
    if (conditions.categories && conditions.categories.length > 0) {
      if (!conditions.categories.includes(dispute.category)) {
        return false;
      }
    }

    // Check priority
    if (conditions.priorities && conditions.priorities.length > 0) {
      if (!conditions.priorities.includes(dispute.priority)) {
        return false;
      }
    }

    // Check reporter type (requires reporter to be loaded)
    if (conditions.reporterTypes && conditions.reporterTypes.length > 0 && dispute.reporter) {
      if (!conditions.reporterTypes.includes(dispute.reporter.type)) {
        return false;
      }
    }

    // Check platform
    if (conditions.platforms && conditions.platforms.length > 0) {
      if (!conditions.platforms.includes(dispute.platform)) {
        return false;
      }
    }

    // Check tags
    if (conditions.tags && conditions.tags.length > 0) {
      const disputeTags = dispute.tags || [];
      const hasMatchingTag = conditions.tags.some(tag => disputeTags.includes(tag));
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  };

  /**
   * Get the next assignee based on this rule's strategy
   */
  ITAutoAssignmentRule.prototype.getNextAssignee = async function (models) {
    const { User, ITDispute } = models;
    const { Op } = require("sequelize");

    switch (this.assignmentStrategy) {
      case "specific_user":
        return this.assignToUserId;

      case "round_robin": {
        const pool = this.assignmentPool || [];
        if (pool.length === 0) return null;

        // Get next index
        const nextIndex = (this.lastAssignedIndex + 1) % pool.length;

        // Update the index
        await this.update({ lastAssignedIndex: nextIndex });

        return pool[nextIndex];
      }

      case "least_loaded": {
        const pool = this.assignmentPool || [];
        if (pool.length === 0) return null;

        // Get open dispute count for each user in pool
        const counts = await Promise.all(
          pool.map(async (userId) => {
            const count = await ITDispute.count({
              where: {
                assignedTo: userId,
                status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] },
              },
            });
            return { userId, count };
          })
        );

        // Sort by count and return the least loaded
        counts.sort((a, b) => a.count - b.count);
        return counts[0]?.userId || null;
      }

      case "random": {
        const pool = this.assignmentPool || [];
        if (pool.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * pool.length);
        return pool[randomIndex];
      }

      default:
        return null;
    }
  };

  return ITAutoAssignmentRule;
};
