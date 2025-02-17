class ReviewSerializer {
	static serializeArray(reviewArray) {
		const allowedAttributes = ["id","availability", "email", "experience", "firstName", "lastName", "message", "phone"];
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