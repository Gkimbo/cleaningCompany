/**
 * CleanerRoomAssignment Model
 *
 * Maps cleaners to specific rooms/areas in a multi-cleaner job.
 * Each room is assigned to exactly one cleaner.
 */
module.exports = (sequelize, DataTypes) => {
  const CleanerRoomAssignment = sequelize.define("CleanerRoomAssignment", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    multiCleanerJobId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cleanerId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Null if not yet assigned
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    roomType: {
      type: DataTypes.ENUM(
        "bedroom",
        "bathroom",
        "kitchen",
        "living_room",
        "dining_room",
        "other"
      ),
      allowNull: false,
    },
    roomNumber: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    roomLabel: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    estimatedMinutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "in_progress", "completed"),
      allowNull: false,
      defaultValue: "pending",
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cleanerEarningsShare: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  });

  CleanerRoomAssignment.associate = (models) => {
    CleanerRoomAssignment.belongsTo(models.MultiCleanerJob, {
      foreignKey: "multiCleanerJobId",
      as: "multiCleanerJob",
    });

    CleanerRoomAssignment.belongsTo(models.User, {
      foreignKey: "cleanerId",
      as: "cleaner",
    });

    CleanerRoomAssignment.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });

    CleanerRoomAssignment.hasMany(models.JobPhoto, {
      foreignKey: "roomAssignmentId",
      as: "photos",
    });
  };

  /**
   * Get display label for the room
   */
  CleanerRoomAssignment.prototype.getDisplayLabel = function () {
    if (this.roomLabel) return this.roomLabel;
    const typeLabels = {
      bedroom: "Bedroom",
      bathroom: "Bathroom",
      kitchen: "Kitchen",
      living_room: "Living Room",
      dining_room: "Dining Room",
      other: "Other Area",
    };
    const label = typeLabels[this.roomType] || "Room";
    return this.roomNumber ? `${label} ${this.roomNumber}` : label;
  };

  /**
   * Mark room as started
   */
  CleanerRoomAssignment.prototype.markStarted = async function () {
    this.status = "in_progress";
    this.startedAt = new Date();
    await this.save();
    return this;
  };

  /**
   * Mark room as completed
   */
  CleanerRoomAssignment.prototype.markCompleted = async function () {
    this.status = "completed";
    this.completedAt = new Date();
    await this.save();
    return this;
  };

  return CleanerRoomAssignment;
};
