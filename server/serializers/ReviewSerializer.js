const EncryptionService = require("../services/EncryptionService");

class ReviewSerializer {
	static decryptField(value) {
		if (!value) return null;
		return EncryptionService.decrypt(value);
	}

	static serializeArray(reviewArray) {
		const allowedAttributes = [
			"id",
			"userId",
			"reviewerId",
			"reviewerName",
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
			const reviewData = review.dataValues || review;
			for (const attribute of allowedAttributes) {
				newReview[attribute] = reviewData[attribute];
			}
			// Include the reviewer association if present, otherwise use stored reviewerName
			if (review.reviewer) {
				const reviewerData = review.reviewer.dataValues || review.reviewer;
				newReview.reviewer = {
					id: reviewerData.id,
					username: reviewerData.username,
					firstName: this.decryptField(reviewerData.firstName),
					lastName: this.decryptField(reviewerData.lastName),
				};
			} else if (reviewData.reviewerName) {
				// Reviewer was deleted but we have their stored name
				newReview.reviewer = {
					id: null,
					username: null,
					displayName: reviewData.reviewerName,
				};
			}
			return newReview;
		});
		return serializedReviews;
	}
}

module.exports = ReviewSerializer;