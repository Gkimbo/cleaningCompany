/* eslint-disable no-console */
import HttpClient from "../HttpClient";

class Review {
  // Submit a new multi-aspect review
  static async submitReview(token, reviewData) {
    const result = await HttpClient.post("/reviews/submit", reviewData, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to submit review" };
    }

    return result;
  }

  // Legacy method for backwards compatibility
  static async addReviewToDb(data) {
    const result = await HttpClient.post("/reviews/submit-legacy", data, { skipAuth: true });

    if (result.success === false) {
      if (result.status === 400) {
        return result;
      }
      throw new Error(result.error || "Failed to submit review");
    }

    return true;
  }

  static async deleteReview(token, id) {
    const result = await HttpClient.delete(`/reviews/${id}`, { token });

    if (result.success === false) {
      throw new Error(result.error || "Failed to delete review");
    }

    return result;
  }

  // Get published reviews for authenticated user
  static async getReviews(token) {
    const result = await HttpClient.get("/reviews", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Review] getReviews failed:", result.error);
      return { reviews: [] };
    }

    return result;
  }

  // Get pending reviews for authenticated user
  static async getPendingReviews(token) {
    const result = await HttpClient.get("/reviews/pending", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Review] getPendingReviews failed:", result.error);
      return { pendingReviews: [] };
    }

    return result;
  }

  // Get review status for an appointment
  static async getReviewStatus(token, appointmentId) {
    const result = await HttpClient.get(`/reviews/status/${appointmentId}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Review] getReviewStatus failed:", result.error);
      return null;
    }

    return result;
  }

  // Get review statistics for authenticated user
  static async getReviewStats(token) {
    const result = await HttpClient.get("/reviews/stats", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Review] getReviewStats failed:", result.error);
      return {
        averageRating: 0,
        totalReviews: 0,
        recommendationRate: 0,
        aspectAverages: {},
      };
    }

    return result;
  }

  // Get public reviews for a user profile
  static async getUserReviews(userId) {
    const result = await HttpClient.get(`/reviews/user/${userId}`, { skipAuth: true });

    if (result.success === false) {
      if (__DEV__) console.warn("[Review] getUserReviews failed:", result.error);
      return { reviews: [], stats: null };
    }

    return result;
  }

  // Get reviews written by authenticated user
  static async getWrittenReviews(token) {
    const result = await HttpClient.get("/reviews/written", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Review] getWrittenReviews failed:", result.error);
      return { reviews: [] };
    }

    return result;
  }
}

export default Review;
