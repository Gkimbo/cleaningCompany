class ReviewSerializer {
	static serializeArray(reviewArray) {
		const allowedAttributes = [
			"id",
			"userId",
			"reviewerId",
			"appointmentId",
			"reviewType",
			"review",
			"reviewComment",
			"createdAt",
			// Cleaner reviewing homeowner aspects
			"accuracyOfDescription",
			"homeReadiness",
			"easeOfAccess",
			"homeCondition",
			"respectfulness",
			"safetyConditions",
			"communication",
			"wouldWorkForAgain",
			// Homeowner reviewing cleaner aspects
			"cleaningQuality",
			"punctuality",
			"professionalism",
			"attentionToDetail",
			"thoroughness",
			"respectOfProperty",
			"followedInstructions",
			"wouldRecommend",
		];
		const serializedReviews = reviewArray.map((review) => {
			const newReview = {};
			for (const attribute of allowedAttributes) {
				newReview[attribute] = review.dataValues[attribute];
			}
			// Include the reviewer association if present
			if (review.reviewer) {
				// Access dataValues for decrypted PII fields (firstName, lastName are encrypted)
				const reviewerData = review.reviewer.dataValues || review.reviewer;
				newReview.reviewer = {
					id: reviewerData.id,
					username: reviewerData.username,
					firstName: reviewerData.firstName,
					lastName: reviewerData.lastName,
				};
			}
			return newReview;
		});
		return serializedReviews;
	}
}

module.exports = ReviewSerializer;