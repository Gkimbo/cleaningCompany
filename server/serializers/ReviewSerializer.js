const EncryptionService = require("../services/EncryptionService");

class ReviewSerializer {
	static allowedAttributes = [
		"id",
		"userId",
		"reviewerId",
		"reviewerName",
		"appointmentId",
		"reviewType",
		"review",
		"reviewComment",
		"createdAt",
		"isPublished",
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

	static decryptField(value) {
		if (!value) return null;
		return EncryptionService.decrypt(value);
	}

	static serializeOne(review) {
		if (!review) return null;
		const newReview = {};
		const reviewData = review.dataValues || review;
		for (const attribute of this.allowedAttributes) {
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
	}

	static serializeArray(reviewArray) {
		return reviewArray.map((review) => this.serializeOne(review));
	}
}

module.exports = ReviewSerializer;