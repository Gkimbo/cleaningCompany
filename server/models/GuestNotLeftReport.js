module.exports = (sequelize, DataTypes) => {
  const GuestNotLeftReport = sequelize.define("GuestNotLeftReport", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    employeeJobAssignmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reportedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "The cleaner who reported guest not left",
    },
    reportedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    cleanerLatitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      comment: "GPS latitude at time of report (if available)",
    },
    cleanerLongitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      comment: "GPS longitude at time of report (if available)",
    },
    distanceFromHome: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Distance in meters from property at time of report",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Optional notes from cleaner",
    },
    resolved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    resolvedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    resolution: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "job_completed, cancelled, expired, manually_resolved",
    },
  });

  GuestNotLeftReport.associate = (models) => {
    GuestNotLeftReport.belongsTo(models.EmployeeJobAssignment, {
      foreignKey: "employeeJobAssignmentId",
      as: "assignment",
    });
    GuestNotLeftReport.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });
    GuestNotLeftReport.belongsTo(models.User, {
      foreignKey: "reportedBy",
      as: "reporter",
    });
    GuestNotLeftReport.belongsTo(models.User, {
      foreignKey: "resolvedBy",
      as: "resolver",
    });
  };

  return GuestNotLeftReport;
};
