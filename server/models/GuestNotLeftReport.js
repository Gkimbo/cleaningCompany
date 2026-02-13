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
      comment: "completed, cancelled_no_penalty, expired_no_response, cleaner_no_return, manually_resolved",
    },
    // === Homeowner Response Fields ===
    homeownerNotifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When homeowner was notified of tenant present",
    },
    homeownerResponseAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When homeowner responded",
    },
    homeownerResponse: {
      type: DataTypes.ENUM("resolved", "need_time", "cannot_resolve", "no_response"),
      allowNull: true,
      comment: "Homeowner's response to tenant present report",
    },
    homeownerResponseNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Optional note from homeowner",
    },
    additionalTimeRequested: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Minutes of additional time requested by homeowner",
    },
    // === Cleaner Action Fields ===
    cleanerAction: {
      type: DataTypes.ENUM("waiting", "will_return", "cancelled", "proceeded"),
      allowNull: true,
      comment: "Cleaner's chosen action after report",
    },
    cleanerActionAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When cleaner chose their action",
    },
    scheduledReturnTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When cleaner plans to return (if will_return)",
    },
    actualReturnTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When cleaner actually returned",
    },
    cleanerReturnedGpsLat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      comment: "GPS latitude when cleaner returned",
    },
    cleanerReturnedGpsLng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      comment: "GPS longitude when cleaner returned",
    },
    // === Time Tracking ===
    responseDeadline: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Deadline for homeowner response (30 min from report)",
    },
    timeWindowEnd: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "End of appointment time window",
    },
    // === Verification ===
    gpsVerifiedOnSite: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
      comment: "Whether GPS verified cleaner was at property",
    },
  });

  // Instance methods
  GuestNotLeftReport.prototype.isAwaitingHomeownerResponse = function () {
    return !this.homeownerResponse && this.responseDeadline && new Date() < this.responseDeadline;
  };

  GuestNotLeftReport.prototype.isResponseExpired = function () {
    return !this.homeownerResponse && this.responseDeadline && new Date() >= this.responseDeadline;
  };

  GuestNotLeftReport.prototype.canCleanerReturn = function () {
    // Can only return if 2+ hours remain in time window
    if (!this.timeWindowEnd) return false;
    const hoursRemaining = (new Date(this.timeWindowEnd) - new Date()) / (1000 * 60 * 60);
    return hoursRemaining >= 2;
  };

  GuestNotLeftReport.prototype.isTimeWindowExpired = function () {
    return this.timeWindowEnd && new Date() >= this.timeWindowEnd;
  };

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
