/* eslint-disable no-console */
import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class Review {
  // Submit a new multi-aspect review
  static async submitReview(token, reviewData) {
    try {
      const response = await fetch(baseURL + "/api/v1/reviews/submit", {
        method: "POST",
        body: JSON.stringify(reviewData),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const responseData = await response.json();
      if (!response.ok) {
        return { error: responseData.error || "Failed to submit review" };
      }
      return responseData;
    } catch (err) {
      console.error("Error submitting review:", err);
      return { error: "Failed to submit review" };
    }
  }

  // Legacy method for backwards compatibility
  static async addReviewToDb(data) {
    try {
      const response = await fetch(baseURL + "/api/v1/reviews/submit-legacy", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        if (response.status === 400) {
          const responseData = await response.json();
          return responseData;
        }
        const error = new Error(`${response.status}(${response.statusText})`);
        throw error;
      }
      const responseData = await response.json();
      return true;
    } catch (err) {
      return err;
    }
  }

  static async deleteReview(token, id) {
    try {
      const response = await fetch(baseURL + `/api/v1/reviews/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        if (response.status === 400) {
          const responseData = await response.json();
          throw new Error(`Bad Request: ${JSON.stringify(responseData)}`);
        }
        throw new Error(`${response.status} (${response.statusText})`);
      }
      const responseData = await response.json();
      return responseData;
    } catch (err) {
      console.error("Error deleting review:", err);
      throw new Error(`Failed to delete review: ${err.message}`);
    }
  }

  // Get published reviews for authenticated user
  static async getReviews(token) {
    try {
      const response = await fetch(baseURL + `/api/v1/reviews`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("No data received");
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error("Error fetching reviews:", error);
      return { reviews: [] };
    }
  }

  // Get pending reviews for authenticated user
  static async getPendingReviews(token) {
    try {
      const response = await fetch(baseURL + `/api/v1/reviews/pending`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch pending reviews");
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error("Error fetching pending reviews:", error);
      return { pendingReviews: [] };
    }
  }

  // Get review status for an appointment
  static async getReviewStatus(token, appointmentId) {
    try {
      const response = await fetch(
        baseURL + `/api/v1/reviews/status/${appointmentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch review status");
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error("Error fetching review status:", error);
      return null;
    }
  }

  // Get review statistics for authenticated user
  static async getReviewStats(token) {
    try {
      const response = await fetch(baseURL + `/api/v1/reviews/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch review stats");
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error("Error fetching review stats:", error);
      return {
        averageRating: 0,
        totalReviews: 0,
        recommendationRate: 0,
        aspectAverages: {},
      };
    }
  }

  // Get public reviews for a user profile
  static async getUserReviews(userId) {
    try {
      const response = await fetch(baseURL + `/api/v1/reviews/user/${userId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch user reviews");
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error("Error fetching user reviews:", error);
      return { reviews: [], stats: null };
    }
  }

  // Get reviews written by authenticated user
  static async getWrittenReviews(token) {
    try {
      const response = await fetch(baseURL + `/api/v1/reviews/written`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch written reviews");
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error("Error fetching written reviews:", error);
      return { reviews: [] };
    }
  }
}

export default Review;
