module.exports = (sequelize, DataTypes) => {
  const UserReviews = sequelize.define("UserReviews", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reviewerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reviewerName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reviewType: {
      type: DataTypes.ENUM("homeowner_to_cleaner", "cleaner_to_homeowner", "system_cancellation_penalty"),
      allowNull: true,
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Overall rating (average of aspects or standalone)
    review: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    reviewComment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    privateComment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Homeowner reviewing Cleaner aspects
    cleaningQuality: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    punctuality: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    professionalism: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    communication: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    attentionToDetail: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    thoroughness: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    respectOfProperty: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    followedInstructions: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    wouldRecommend: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    // Cleaner reviewing Homeowner aspects
    accuracyOfDescription: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    homeReadiness: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    easeOfAccess: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    homeCondition: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    respectfulness: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    safetyConditions: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    wouldWorkForAgain: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
  });

  UserReviews.associate = (models) => {
    UserReviews.belongsTo(models.User, {
      foreignKey: "userId",
      as: "reviewedUser",
    });
    UserReviews.belongsTo(models.User, {
      foreignKey: "reviewerId",
      as: "reviewer",
    });
    UserReviews.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });
  };

  return UserReviews;
};
