const { UserReviews} = require("../models");

class ReviewsClass{
	static async addReviewToDB({
		userId, 
        reviewerId, 
        appointmentId, 
        rating, 
        comment,
	}) {
		 await UserReviews.create({
			userId, 
            reviewerId, 
            appointmentId, 
            rating, 
            comment,
		});
        return UserReviews
	}
}

module.exports = ReviewsClass;