class ReviewSerializer {
	static serializeArray(reviewArray) {
		const allowedAttributes = ["id", "userId", "reviewerId", "appointmentId", "rating", "comment", "createdAt"];
		const serializedReviews = reviewArray.map((review) => {
			const newReview = {};
			for (const attribute of allowedAttributes) {
				newReview[attribute] = review.dataValues[attribute];
			}
			return newReview;
		});
		return serializedReviews;
	}
}

module.exports = ReviewSerializer;