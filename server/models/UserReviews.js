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
			allowNull: false,
		},
		appointmentId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
        review: {
            type: DataTypes.FLOAT,  
            allowNull: false,
        },
        reviewComment: {
            type: DataTypes.TEXT,
            allowNull: false,
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
