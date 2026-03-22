/**
 * ServiceAreaConfig Model
 *
 * Stores the company's service area configuration.
 * Only one row should be active at a time (isActive: true).
 * Historical records are kept for audit trail.
 *
 * Supports two modes:
 * - "list": Define service area by cities, states, and zipcodes
 * - "radius": Define service area by center point and radius in miles
 */
module.exports = (sequelize, DataTypes) => {
  const ServiceAreaConfig = sequelize.define("ServiceAreaConfig", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    // Feature toggle
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether service area restrictions are enabled",
    },

    // Configuration mode
    mode: {
      type: DataTypes.ENUM("list", "radius"),
      allowNull: false,
      defaultValue: "list",
      comment: "Configuration mode: list (cities/zipcodes) or radius (center point + miles)",
    },

    // LIST MODE fields
    cities: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: "Array of city names (case-insensitive matching)",
    },
    states: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: "Array of state abbreviations (e.g., 'MA', 'CA')",
    },
    zipcodes: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: "Array of zipcodes or prefixes (e.g., '90210' or '902' for all 902xx)",
    },

    // RADIUS MODE fields
    centerAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Human-readable center address for radius mode",
    },
    centerLatitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      comment: "Latitude of center point for radius mode",
    },
    centerLongitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      comment: "Longitude of center point for radius mode",
    },
    radiusMiles: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 25.0,
      comment: "Service radius in miles from center point",
    },

    // Custom message
    outsideAreaMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "We don't currently service this area. We're expanding soon!",
      comment: "Message shown when address is outside service area",
    },

    // Audit fields
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether this is the current active config",
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "User ID of owner who made the update",
    },
    changeNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Note describing why the change was made",
    },
  });

  ServiceAreaConfig.associate = (models) => {
    ServiceAreaConfig.belongsTo(models.User, {
      foreignKey: "updatedBy",
      as: "updatedByUser",
    });
  };

  /**
   * Get the current active service area configuration.
   * Returns null if no active config exists.
   */
  ServiceAreaConfig.getActive = async () => {
    return ServiceAreaConfig.findOne({
      where: { isActive: true },
      order: [["createdAt", "DESC"]],
    });
  };

  /**
   * Get service area config in a formatted structure
   */
  ServiceAreaConfig.getFormattedConfig = async () => {
    const config = await ServiceAreaConfig.getActive();
    if (!config) return null;

    return {
      enabled: config.enabled,
      mode: config.mode,
      // List mode fields
      cities: config.cities || [],
      states: config.states || [],
      zipcodes: config.zipcodes || [],
      // Radius mode fields
      centerAddress: config.centerAddress,
      centerLatitude: config.centerLatitude ? parseFloat(config.centerLatitude) : null,
      centerLongitude: config.centerLongitude ? parseFloat(config.centerLongitude) : null,
      radiusMiles: config.radiusMiles ? parseFloat(config.radiusMiles) : 25,
      // Common
      outsideAreaMessage: config.outsideAreaMessage,
    };
  };

  /**
   * Create a new service area config and deactivate the old one.
   * @param {Object} configData - New config values
   * @param {number} ownerId - ID of the owner making the change
   * @param {string} changeNote - Optional note about the change
   */
  ServiceAreaConfig.updateConfig = async (configData, ownerId, changeNote = null) => {
    const transaction = await sequelize.transaction();

    try {
      // Deactivate current active config
      await ServiceAreaConfig.update(
        { isActive: false },
        { where: { isActive: true }, transaction }
      );

      // Create new active config
      const newConfig = await ServiceAreaConfig.create(
        {
          ...configData,
          isActive: true,
          updatedBy: ownerId,
          changeNote,
        },
        { transaction }
      );

      await transaction.commit();
      return newConfig;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  /**
   * Get service area config change history
   */
  ServiceAreaConfig.getHistory = async (limit = 20) => {
    return ServiceAreaConfig.findAll({
      order: [["createdAt", "DESC"]],
      limit,
      include: [
        {
          association: "updatedByUser",
          attributes: ["id", "username", "email"],
        },
      ],
    });
  };

  return ServiceAreaConfig;
};
