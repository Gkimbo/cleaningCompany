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
    // Business review fields (for dual review system)
    businessOwnerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "The business owner who owns the reviewed employee",
    },
    isBusinessReview: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if this is a copy created for the business profile",
    },
    sourceReviewId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Links to the original employee review (for business copies)",
    },
    isEmployeeReviewCopy: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if this is a copy created for an employee's profile from a multi-employee job",
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
    // Business review relationships
    UserReviews.belongsTo(models.User, {
      foreignKey: "businessOwnerId",
      as: "businessOwner",
    });
    UserReviews.belongsTo(UserReviews, {
      foreignKey: "sourceReviewId",
      as: "sourceReview",
    });
    UserReviews.hasOne(UserReviews, {
      foreignKey: "sourceReviewId",
      as: "businessCopy",
    });
  };

  return UserReviews;
};
