module.exports = (sequelize, DataTypes) => {
  const ClientJobFlowAssignment = sequelize.define("ClientJobFlowAssignment", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    businessOwnerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cleanerClientId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Assign flow to all jobs for this client",
    },
    homeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Assign flow to all jobs for this specific home (higher priority than client)",
    },
    customJobFlowId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });

  // Instance methods
  ClientJobFlowAssignment.prototype.isHomeAssignment = function () {
    return this.homeId !== null;
  };

  ClientJobFlowAssignment.prototype.isClientAssignment = function () {
    return this.cleanerClientId !== null && this.homeId === null;
  };

  ClientJobFlowAssignment.associate = (models) => {
    ClientJobFlowAssignment.belongsTo(models.User, {
      foreignKey: "businessOwnerId",
      as: "businessOwner",
    });

    ClientJobFlowAssignment.belongsTo(models.CleanerClient, {
      foreignKey: "cleanerClientId",
      as: "cleanerClient",
    });

    ClientJobFlowAssignment.belongsTo(models.UserHomes, {
      foreignKey: "homeId",
      as: "home",
    });

    ClientJobFlowAssignment.belongsTo(models.CustomJobFlow, {
      foreignKey: "customJobFlowId",
      as: "flow",
    });
  };

  return ClientJobFlowAssignment;
};
